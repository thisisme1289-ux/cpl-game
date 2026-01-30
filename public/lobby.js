// CPL Game Client - Enhanced lobby.js
const socket = io();

// Game state
let roomId = null;
let playerName = null;
let myTeam = null;
let selectedFingers = null;
let isLeader = false;
let currentBatter = null;
let currentBowler = null;
let roomType = 'random'; // NEW: Track room type

// Player selection state
let selectionRole = null;
let selectedPlayer = null;
let selectedBatter = null; // NEW: Store batter selection
let selectedBowler = null; // NEW: Store bowler selection
let selectionTimer = null;
let selectionTimeLeft = 30;

// NEW: New game timer
let newGameTimer = 60;
let newGameInterval = null;

// Sound settings
let soundEnabled = localStorage.getItem('cpl-soundEnabled') !== 'false';

// Game statistics
let gameStats = {
  totalRuns: 0,
  totalBalls: 0,
  boundaries: 0,
  dots: 0
};

// DOM elements
const roomIdDisplay = document.getElementById('roomIdDisplay');
const playerNameDisplay = document.getElementById('playerNameDisplay');
const gameStateBanner = document.getElementById('gameStateBanner');
const scoreDisplay = document.getElementById('scoreDisplay');
const oversDisplay = document.getElementById('oversDisplay');
const teamAList = document.getElementById('teamAList');
const teamBList = document.getElementById('teamBList');
const selectLeadersBtn = document.getElementById('selectLeadersBtn');
const startGameBtn = document.getElementById('startGameBtn');
const fingerSelection = document.getElementById('fingerSelection');
const confirmFingerBtn = document.getElementById('confirmFingerBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const resultOverlay = document.getElementById('resultOverlay');
const resultFingers = document.getElementById('resultFingers');
const resultText = document.getElementById('resultText');
const playerSelectionModal = document.getElementById('playerSelectionModal');
const modalHeader = document.getElementById('modalHeader');
const modalSubtitle = document.getElementById('modalSubtitle');
const playerSelectGrid = document.getElementById('playerSelectGrid');
const confirmPlayerBtn = document.getElementById('confirmPlayerBtn');
const cancelPlayerBtn = document.getElementById('cancelPlayerBtn');
const timerFill = document.getElementById('timerFill');
const waitingIndicator = document.getElementById('waitingIndicator');
const waitingMessage = document.getElementById('waitingMessage');
const matchSummary = document.getElementById('matchSummary');
const summaryScore = document.getElementById('summaryScore');
const summaryReason = document.getElementById('summaryReason');
const statRuns = document.getElementById('statRuns');
const statWickets = document.getElementById('statWickets');
const statOvers = document.getElementById('statOvers');
const soundToggle = document.getElementById('soundToggle');
const copyRoomCode = document.getElementById('copyRoomCode'); // NEW
const newGameBtn = document.getElementById('newGameBtn'); // NEW
const newGameTimerDisplay = document.getElementById('newGameTimer'); // NEW

// Sound effects
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (!soundEnabled) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  switch(type) {
    case 'runs':
      oscillator.frequency.value = 800;
      gainNode.gain.value = 0.3;
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
      break;
    case 'out':
      oscillator.frequency.value = 200;
      gainNode.gain.value = 0.5;
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
    case 'notification':
      oscillator.frequency.value = 600;
      gainNode.gain.value = 0.2;
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.05);
      break;
    case 'selection':
      oscillator.frequency.value = 400;
      gainNode.gain.value = 0.2;
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.05);
      break;
  }
}

// Initialize
function init() {
  roomId = localStorage.getItem('cpl-roomId');
  playerName = localStorage.getItem('cpl-playerName');
  myTeam = localStorage.getItem('cpl-team');
  roomType = localStorage.getItem('cpl-roomType') || 'random';

  if (!roomId || !playerName) {
    window.location.href = '/';
    return;
  }

  playerNameDisplay.textContent = playerName;
  roomIdDisplay.textContent = roomId;
  updateSoundToggle();

  // Show copy button for custom rooms
  if (roomType === 'custom' && copyRoomCode) {
    copyRoomCode.style.display = 'inline-block';
  }

  socket.emit('rejoin-room', { playerName, roomId });
}

// Socket handlers
socket.on('rejoin-success', (data) => {
  myTeam = data.team;
  localStorage.setItem('cpl-team', data.team);
});

socket.on('room-update', (data) => {
  roomIdDisplay.textContent = data.roomId;
  updateTeamList('A', data.teamA, data.leaderA, currentBatter, currentBowler);
  updateTeamList('B', data.teamB, data.leaderB, currentBatter, currentBowler);
  
  isLeader = (data.leaderA === playerName || data.leaderB === playerName);
  
  // Show start game button when both leaders are selected
  if (data.leaderA && data.leaderB) {
    startGameBtn.style.display = 'flex'; // Show button
    if (isLeader) {
      startGameBtn.disabled = false;
    }
  } else {
    startGameBtn.style.display = 'none'; // Hide if no leaders
  }
});

socket.on('game-state', (data) => {
  updateGameStateBanner(data.state, data.innings, data.target);
  updateScore(data.score || 0, data.wickets || 0, data.target);
  updateOvers(data.overs || 0, data.balls || 0, data.totalOvers || 5);
  
  // Update team status display
  if (data.battingTeam && data.bowlingTeam) {
    updateTeamStatus(data.battingTeam, data.bowlingTeam);
  }
  
  currentBatter = data.currentBatter;
  currentBowler = data.currentBowler;
  
  const isMyTurn = (currentBatter === playerName || currentBowler === playerName);
  if (data.state === 'PLAYING' && isMyTurn) {
    fingerSelection.classList.add('active');
    waitingIndicator.classList.remove('active');
  } else {
    fingerSelection.classList.remove('active');
    if (data.state === 'PLAYING') {
      waitingIndicator.classList.add('active');
      let message = `${currentBatter} vs ${currentBowler}`;
      if (data.innings === 2 && data.target) {
        message += `<br><span style="color: #4CAF50;">Target: ${data.target}</span>`;
      }
      waitingMessage.innerHTML = message;
    }
  }
});

socket.on('leaders-selected', (data) => {
  showNotification(`Leaders: ${data.leaderA} 👑 & ${data.leaderB} 👑`);
  playSound('notification');
  selectLeadersBtn.disabled = true;
  
  // Show start game button
  startGameBtn.style.display = 'flex';
  
  isLeader = (data.leaderA === playerName || data.leaderB === playerName);
  if (isLeader) {
    startGameBtn.disabled = false;
    showNotification('You are a leader! Click "Start Game" when ready.');
  }
});

socket.on('game-started', (data) => {
  showNotification(data.message);
  playSound('notification');
  startGameBtn.disabled = true;
  gameStats = { totalRuns: 0, totalBalls: 0, boundaries: 0, dots: 0 };
});

socket.on('request-player-selection', (data) => {
  if (!isLeader) return;
  
  // Store the selection based on role
  if (data.role === 'batter') {
    showPlayerSelectionModal(data.role, data.availablePlayers, data.reason, 'batting');
  } else if (data.role === 'bowler') {
    showPlayerSelectionModal(data.role, data.availablePlayers, data.reason, 'bowling');
  }
});

socket.on('players-selected', (data) => {
  showNotification(`${data.batter} 🏏 vs ${data.bowler} ⚾`);
  playSound('notification');
  currentBatter = data.batter;
  currentBowler = data.bowler;
  waitingIndicator.classList.remove('active');
});

socket.on('round-result', (data) => {
  if (data.runs === 4 || data.runs === 5) gameStats.boundaries++;
  if (data.runs === 0 && !data.isOut) gameStats.dots++;
  showResultAnimation(data);
});

socket.on('input-confirmed', (data) => {
  showNotification(`You chose ${data.fingers} fingers`);
  playSound('selection');
});

socket.on('waiting-for-selection', (data) => {
  waitingIndicator.classList.add('active');
  waitingMessage.textContent = data.message;
});

socket.on('next-ball', (data) => {
  showNotification(data.message);
  waitingIndicator.classList.remove('active');
});

socket.on('over-complete', (data) => {
  showNotification(`Over ${data.over} Complete! 🎉`, 5000);
  playSound('notification');
});

// NEW: Innings complete
socket.on('innings-complete', (data) => {
  showNotification(`🏏 INNINGS ${data.innings} COMPLETE! 🏏`, 8000);
  playSound('out');
  
  // Show innings break screen
  waitingIndicator.classList.add('active');
  waitingMessage.innerHTML = `
    <div style="text-align: center; font-size: 18px;">
      <div style="font-size: 24px; font-weight: bold; margin-bottom: 15px;">
        ✨ INNINGS BREAK ✨
      </div>
      <div style="margin: 10px 0;">
        Innings 1: ${data.score}/${data.wickets}
      </div>
      <div style="margin: 10px 0; font-size: 20px; color: #4CAF50;">
        🎯 Target: ${data.target} runs
      </div>
      <div style="margin-top: 20px; opacity: 0.8;">
        Innings 2 starting soon...
      </div>
    </div>
  `;
});

socket.on('game-over', (data) => {
  showMatchSummary(data);
  playSound('out');
  fingerSelection.classList.remove('active');
  waitingIndicator.classList.remove('active');
});

socket.on('chat-message', (data) => {
  addChatMessage(data.playerName, data.message);
});

socket.on('player-left', (data) => {
  showNotification(`${data.playerName} left`);
});

socket.on('error', (data) => {
  showNotification(data.message);
  playSound('out');
});

// NEW: Game reset (new game started)
socket.on('game-reset', (data) => {
  showNotification(data.message);
  playSound('notification');
  
  // Close match summary
  matchSummary.classList.remove('active');
  clearInterval(newGameInterval);
  
  // Reset UI
  fingerSelection.classList.remove('active');
  waitingIndicator.classList.remove('active');
  
  // Reset selections
  selectedBatter = null;
  selectedBowler = null;
  selectedFingers = null;
});

// Button handlers
selectLeadersBtn.addEventListener('click', () => {
  socket.emit('select-leaders', roomId);
});

startGameBtn.addEventListener('click', () => {
  socket.emit('start-game', roomId);
});

const fingerBtns = document.querySelectorAll('.finger-btn');
fingerBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    fingerBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedFingers = parseInt(btn.dataset.fingers);
    confirmFingerBtn.disabled = false;
    playSound('selection');
  });
});

confirmFingerBtn.addEventListener('click', () => {
  if (selectedFingers === null) return;
  
  socket.emit('player-input', { roomId, fingers: selectedFingers });
  
  confirmFingerBtn.disabled = true;
  fingerBtns.forEach(btn => btn.disabled = true);
  fingerSelection.classList.remove('active');
  waitingIndicator.classList.add('active');
  waitingMessage.textContent = 'Waiting for other player...';
});

confirmPlayerBtn.addEventListener('click', () => {
  if (!selectedPlayer) return;
  
  // Submit THIS leader's selection
  socket.emit('submit-player-selection', {
    roomId: roomId,
    role: selectionRole,
    playerName: selectedPlayer
  });
  
  showNotification(`${selectionRole === 'batter' ? 'Batter' : 'Bowler'} selected: ${selectedPlayer}`);
  playSound('selection');
  
  closePlayerSelectionModal();
});

cancelPlayerBtn.addEventListener('click', () => {
  closePlayerSelectionModal();
});

chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    socket.emit('chat-message', { roomId, message: chatInput.value.trim() });
    chatInput.value = '';
  }
});

soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('cpl-soundEnabled', soundEnabled);
  updateSoundToggle();
  playSound('selection');
});

// NEW: Copy room code
if (copyRoomCode) {
  copyRoomCode.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId).then(() => {
      showNotification('Room code copied to clipboard! 📋');
      playSound('selection');
      copyRoomCode.textContent = '✅';
      setTimeout(() => {
        copyRoomCode.textContent = '📋';
      }, 2000);
    }).catch(() => {
      showNotification('Failed to copy room code');
    });
  });
}

// NEW: New game button  
if (newGameBtn) {
  newGameBtn.addEventListener('click', () => {
    socket.emit('request-new-game', { roomId });
    clearInterval(newGameInterval);
    showNotification('Starting new game...');
  });
}

// Helper functions
function updateTeamList(team, players, leader, batter, bowler) {
  const list = team === 'A' ? teamAList : teamBList;
  list.innerHTML = '';
  
  if (players.length === 0) {
    list.innerHTML = '<li class="player-item">Waiting...</li>';
    return;
  }
  
  players.forEach(player => {
    const li = document.createElement('li');
    li.className = 'player-item';
    
    if (player === leader) li.classList.add('leader');
    if (player === batter || player === bowler) li.classList.add('active');
    
    let badges = '';
    if (player === leader) badges += '<span class="badge badge-leader">👑</span>';
    if (player === batter) badges += '<span class="badge badge-batting">🏏</span>';
    if (player === bowler) badges += '<span class="badge badge-bowling">⚾</span>';
    
    li.innerHTML = `
      <div>
        <span style="font-weight: ${player === playerName ? 'bold' : 'normal'}">
          ${player} ${player === playerName ? '(You)' : ''}
        </span>
        ${badges ? `<div style="margin-top: 5px;">${badges}</div>` : ''}
      </div>
    `;
    
    list.appendChild(li);
  });
}

function updateGameStateBanner(state, innings, target) {
  const bannerText = {
    'LOBBY': 'LOBBY - Waiting for players',
    'PLAYER_SELECTION': innings === 2 ? `👥 INNINGS 2 - Select Players (Target: ${target})` : '👥 Select Batter & Bowler',
    'PLAYING': innings === 2 ? `🏏 INNINGS 2 (Target: ${target})` : '🏏 INNINGS 1',
    'BALL_RESULT': '📊 Processing...',
    'MATCH_END': '🏁 MATCH OVER'
  };
  gameStateBanner.textContent = bannerText[state] || state;
}

function updateTeamStatus(battingTeam, bowlingTeam) {
  const battingStatus = document.getElementById('battingStatus');
  const bowlingStatus = document.getElementById('bowlingStatus');
  
  if (battingStatus && bowlingStatus) {
    battingStatus.querySelector('.status-text').textContent = `Team ${battingTeam} Batting`;
    bowlingStatus.querySelector('.status-text').textContent = `Team ${bowlingTeam} Bowling`;
  }
}

function updateScore(score, wickets, target) {
  const current = parseInt(scoreDisplay.textContent.split('/')[0]) || 0;
  let displayText = `${score}/${wickets}`;
  if (target) {
    displayText += ` (Target: ${target})`;
  }
  
  if (score !== current) {
    animateNumber(scoreDisplay, current, score, wickets, target);
  } else {
    scoreDisplay.textContent = displayText;
  }
}

function animateNumber(element, from, to, wickets, target) {
  const duration = 1000;
  const steps = 20;
  let current = from;
  let step = 0;
  
  const interval = setInterval(() => {
    step++;
    current += (to - from) / steps;
    
    if (step >= steps) {
      clearInterval(interval);
      let displayText = `${to}/${wickets}`;
      if (target) displayText += ` (Target: ${target})`;
      element.textContent = displayText;
    } else {
      let displayText = `${Math.round(current)}/${wickets}`;
      if (target) displayText += ` (Target: ${target})`;
      element.textContent = displayText;
    }
  }, duration / steps);
}

function updateOvers(overs, balls, totalOvers) {
  oversDisplay.textContent = `Overs: ${overs}.${balls} / ${totalOvers}`;
}

function showPlayerSelectionModal(role, availablePlayers, reason, teamType) {
  selectionRole = role;
  selectedPlayer = null;
  selectionTimeLeft = 30;
  
  modalHeader.textContent = role === 'batter' ? 'Select Batter 🏏' : 'Select Bowler ⚾';
  modalSubtitle.textContent = reason === 'out' ? 'Previous batter is OUT' : 
                              reason === 'over-complete' ? 'Over complete' : 
                              `Select a ${role} to start the game`;
  
  playerSelectGrid.innerHTML = '';
  availablePlayers.forEach(player => {
    const div = document.createElement('div');
    div.className = 'player-select-item';
    div.textContent = player;
    div.addEventListener('click', () => {
      document.querySelectorAll('.player-select-item').forEach(i => i.classList.remove('selected'));
      div.classList.add('selected');
      selectedPlayer = player;
      confirmPlayerBtn.disabled = false;
      playSound('selection');
    });
    playerSelectGrid.appendChild(div);
  });
  
  startSelectionTimer();
  playerSelectionModal.classList.add('active');
  confirmPlayerBtn.disabled = true;
}

function closePlayerSelectionModal() {
  playerSelectionModal.classList.remove('active');
  if (selectionTimer) {
    clearInterval(selectionTimer);
    selectionTimer = null;
  }
}

function startSelectionTimer() {
  if (selectionTimer) clearInterval(selectionTimer);
  
  selectionTimer = setInterval(() => {
    selectionTimeLeft--;
    timerFill.style.width = `${(selectionTimeLeft / 30) * 100}%`;
    
    if (selectionTimeLeft <= 0) {
      clearInterval(selectionTimer);
      if (!selectedPlayer && playerSelectGrid.children.length > 0) {
        playerSelectGrid.children[0].click();
        setTimeout(() => confirmPlayerBtn.click(), 500);
      }
    }
  }, 1000);
}

function showResultAnimation(data) {
  resultOverlay.classList.add('active');
  
  const fingers = ['', '☝️', '✌️', '🤟', '🖖', '✋'];
  resultFingers.textContent = `${fingers[data.batterFingers]} vs ${fingers[data.bowlerFingers]}`;
  
  if (data.isOut) {
    resultText.innerHTML = '<div class="result-out">OUT! 😱</div>';
    playSound('out');
  } else {
    resultText.innerHTML = `<div class="result-runs">+${data.runs} Runs! 🎉</div>`;
    playSound('runs');
  }
  
  setTimeout(() => {
    resultOverlay.classList.remove('active');
    selectedFingers = null;
    fingerBtns.forEach(btn => {
      btn.classList.remove('selected');
      btn.disabled = false;
    });
  }, 3000);
}

function showMatchSummary(data) {
  const innings1Score = data.innings1Score || 0;
  const innings1Wickets = data.innings1Wickets || 0;
  const innings2Score = data.innings2Score || 0;
  const innings2Wickets = data.innings2Wickets || 0;
  
  // Determine winner
  let winnerTeam = null;
  let isVictory = false;
  
  if (innings2Score > innings1Score) {
    winnerTeam = 'Team B';
    isVictory = (myTeam === 'B');
  } else if (innings1Score > innings2Score) {
    winnerTeam = 'Team A';
    isVictory = (myTeam === 'A');
  }
  
  // Update trophy/medal
  const summaryTrophy = document.getElementById('summaryTrophy');
  const summaryTitle = document.getElementById('summaryTitle');
  const summaryWinner = document.getElementById('summaryWinner');
  
  if (isVictory) {
    summaryTrophy.textContent = '🏆';
    summaryTitle.textContent = 'VICTORY!';
    summaryWinner.textContent = `${winnerTeam} Wins! 🎉`;
    summaryWinner.classList.remove('loss');
  } else {
    summaryTrophy.textContent = '😔';
    summaryTitle.textContent = 'DEFEAT';
    summaryWinner.textContent = `${winnerTeam} Wins`;
    summaryWinner.classList.add('loss');
  }
  
  // Update innings scores
  document.getElementById('innings1Score').textContent = `${innings1Score}/${innings1Wickets}`;
  document.getElementById('innings2Score').textContent = `${innings2Score}/${innings2Wickets}`;
  document.getElementById('innings1Team').textContent = 'Team A';
  document.getElementById('innings2Team').textContent = 'Team B';
  
  // Highlight winner box
  const innings1Box = document.getElementById('innings1Box');
  const innings2Box = document.getElementById('innings2Box');
  innings1Box.classList.remove('winner');
  innings2Box.classList.remove('winner');
  
  if (innings1Score > innings2Score) {
    innings1Box.classList.add('winner');
  } else if (innings2Score > innings1Score) {
    innings2Box.classList.add('winner');
  }
  
  // Show win margin
  const summaryMargin = document.getElementById('summaryMargin');
  summaryMargin.textContent = data.reason || 'Match Complete';
  
  // Update stats
  document.getElementById('statBoundaries').textContent = gameStats.boundaries || 0;
  document.getElementById('statSixes').textContent = gameStats.sixes || 0;
  document.getElementById('statOvers').textContent = `${data.innings2Overs || 0}.0`;
  
  // Show summary
  matchSummary.classList.add('active');
  
  // Start countdown
  startNewGameCountdown();
  
  // Play victory/defeat sound
  if (isVictory) {
    playSound('notification');
  } else {
    playSound('out');
  }
}

// NEW: Start countdown for new game
function startNewGameCountdown() {
  newGameTimer = 60;
  if (newGameTimerDisplay) {
    newGameTimerDisplay.textContent = newGameTimer;
  }
  
  if (newGameInterval) clearInterval(newGameInterval);
  
  newGameInterval = setInterval(() => {
    newGameTimer--;
    if (newGameTimerDisplay) {
      newGameTimerDisplay.textContent = newGameTimer;
    }
    
    if (newGameTimer <= 0) {
      clearInterval(newGameInterval);
      // Auto-exit to lobby
      showNotification('Time expired. Returning to lobby...');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }
  }, 1000);
}

function addChatMessage(sender, message) {
  const div = document.createElement('div');
  div.className = 'chat-message';
  div.innerHTML = `
    <div class="sender">${sender}</div>
    <div class="text">${escapeHtml(message)}</div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showNotification(message, duration = 3000) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

function updateSoundToggle() {
  soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
  soundToggle.title = soundEnabled ? 'Mute' : 'Unmute';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.addEventListener('beforeunload', () => {
  localStorage.setItem('cpl-roomId', roomId);
  localStorage.setItem('cpl-playerName', playerName);
  localStorage.setItem('cpl-team', myTeam);
});

init();
