// ============================================
// GAME PAGE JAVASCRIPT WITH SOCKET.IO
// ============================================

// Check authentication
if (!isLoggedIn()) {
    window.location.href = '/';
}

// Get game mode from URL
const urlParams = new URLSearchParams(window.location.search);
const gameMode = urlParams.get('mode');
const roomCode = urlParams.get('code');

// Socket.IO connection
let socket = null;
let currentRoom = null;
let userRole = null; // 'batter' or 'bowler'
let currentChoice = null;

// DOM Elements
const numberButtons = document.querySelectorAll('.num-btn');
const bigNumber = document.getElementById('bigNumber');
const numberWord = document.getElementById('numberWord');
const numberDisplay = document.getElementById('numberDisplay');
const statusMessage = document.getElementById('statusMessage');
const leftHand = document.getElementById('leftHand');
const rightHand = document.getElementById('rightHand');
const timerCircle = document.getElementById('timerCircle');
const timerCount = document.getElementById('timerCount');
const resultMessage = document.getElementById('resultMessage');
const resultModal = document.getElementById('resultModal');
const roomCodeEl = document.getElementById('roomCode');
const leftName = document.getElementById('leftName');
const rightName = document.getElementById('rightName');
const leftScore = document.getElementById('leftScore');
const rightScore = document.getElementById('rightScore');
const leftAvatar = document.getElementById('leftAvatar');
const rightAvatar = document.getElementById('rightAvatar');

// Number words mapping
const numberWords = {
    0: 'ZERO',
    1: 'ONE',
    2: 'TWO',
    3: 'THREE',
    4: 'FOUR',
    5: 'FIVE',
    6: 'SIX'
};

// Hand emojis mapping
const handEmojis = {
    1: '☝️',
    2: '✌️',
    3: '🤟',
    4: '🖖',
    5: '✋',
    6: '🖐️'
};

/**
 * Initialize Socket.IO connection
 */
function initializeSocket() {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    
    socket = io(CONFIG.SOCKET_URL, {
        auth: { token }
    });

    // Connection events
    socket.on('connect', () => {
        console.log('✅ Socket connected:', socket.id);
        authenticateSocket();
    });

    socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
        showStatus('Connection lost. Reconnecting...');
    });

    // Authentication events
    socket.on('auth:success', (data) => {
        console.log('✅ Socket authenticated');
        joinGame();
    });

    socket.on('auth:failed', (data) => {
        console.error('❌ Socket auth failed:', data);
        alert('Authentication failed. Please refresh.');
    });

    // Room events
    socket.on('room:joined', (data) => {
        console.log('✅ Joined room:', data.roomId);
        currentRoom = data.roomId;
        updateLobby(data);
    });

    socket.on('lobby:update', (data) => {
        updateLobby(data);
    });

    socket.on('lobby:timer', (data) => {
        showStatus(`Match starting in ${data.countdown}s...`);
    });

    // Game events
    socket.on('game:start', (data) => {
        showStatus('Match starting!');
        updateTossResult(data.toss);
    });

    socket.on('game:state', (data) => {
        updateGameState(data);
    });

    socket.on('game:your_turn', (data) => {
        showFingerChoice(data.role);
    });

    socket.on('game:round_result', (data) => {
        showResult(data);
    });

    socket.on('game:over', (data) => {
        showMatchResult(data);
    });

    socket.on('game:innings_change', (data) => {
        showStatus(data.message);
        setTimeout(() => {
            document.getElementById('inningsBadge').textContent = '2nd Innings';
        }, 2000);
    });

    // Chat events
    socket.on('chat:message', (data) => {
        addChatMessage(data);
    });

    // Error events
    socket.on('error', (data) => {
        console.error('Socket error:', data);
        alert(data.message);
    });
}

/**
 * Authenticate socket with JWT
 */
function authenticateSocket() {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    socket.emit('auth:request', { token });
}

/**
 * Join game based on mode
 */
function joinGame() {
    showStatus('Joining game...');

    const joinData = {
        mode: gameMode,
    };

    if (roomCode) {
        joinData.roomId = roomCode;
    }

    socket.emit('lobby:join', joinData);
}

/**
 * Update lobby (player list)
 */
function updateLobby(data) {
    const teamADiv = document.getElementById('teamAPlayers');
    const teamBDiv = document.getElementById('teamBPlayers');

    // Clear existing
    teamADiv.innerHTML = '';
    teamBDiv.innerHTML = '';

    // Populate teams
    if (data.players) {
        data.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            playerDiv.textContent = player.name;

            if (player.team === 'A') {
                teamADiv.appendChild(playerDiv);
            } else {
                teamBDiv.appendChild(playerDiv);
            }
        });
    }

    showStatus(`${data.players.length} players in lobby. Waiting for match...`);
}

/**
 * Update toss result
 */
function updateTossResult(toss) {
    setTimeout(() => {
        showStatus(`Team ${toss.winner} won the toss and chose to ${toss.decision}`);
    }, 1000);
}

/**
 * Update game state (scoreboard)
 */
function updateGameState(state) {
    // Update scores
    leftScore.textContent = state.teamA?.runs || 0;
    rightScore.textContent = state.teamB?.runs || 0;

    // Update wickets indicators
    const leftWicketsEl = document.getElementById('leftWickets');
    const rightWicketsEl = document.getElementById('rightWickets');
    
    if (leftWicketsEl && state.teamA) {
        updateWickets(leftWicketsEl, state.teamA.wickets);
    }
    if (rightWicketsEl && state.teamB) {
        updateWickets(rightWicketsEl, state.teamB.wickets);
    }

    // Show room code if available
    if (state.roomId) {
        roomCodeEl.textContent = state.roomId;
    }
}

/**
 * Update wickets display
 */
function updateWickets(container, wicketsOut) {
    const dots = container.querySelectorAll('.wicket-dot:not(.last)');
    dots.forEach((dot, index) => {
        if (index < wicketsOut) {
            dot.classList.add('out');
        } else {
            dot.classList.remove('out');
        }
    });
}

/**
 * Show finger choice interface
 */
function showFingerChoice(role) {
    userRole = role;
    
    // Hide number display, show buttons
    numberDisplay.style.display = 'none';
    statusMessage.style.display = 'block';
    statusMessage.textContent = role === 'batter' ? 'Choose your runs!' : 'Choose your ball!';
    resultMessage.style.display = 'none';

    // Reset buttons
    numberButtons.forEach(btn => {
        btn.classList.remove('selected');
        btn.disabled = false;
    });

    currentChoice = null;

    // Start timer
    startChoiceTimer();
}

/**
 * Start choice timer
 */
let timerInterval = null;
function startChoiceTimer() {
    let timeLeft = 30;
    timerCount.textContent = timeLeft;
    timerCircle.classList.remove('warning');

    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timeLeft--;
        timerCount.textContent = timeLeft;

        if (timeLeft <= 10) {
            timerCircle.classList.add('warning');
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // Auto-submit random choice
            if (!currentChoice) {
                const randomChoice = Math.floor(Math.random() * 6) + 1;
                submitChoice(randomChoice);
            }
        }
    }, 1000);
}

/**
 * Number button click handler
 */
numberButtons.forEach(btn => {
    btn.addEventListener('click', function() {
        const number = parseInt(this.dataset.number);

        // Deselect all
        numberButtons.forEach(b => b.classList.remove('selected'));

        // Select this one
        this.classList.add('selected');
        currentChoice = number;

        // Submit choice
        submitChoice(number);
    });
});

/**
 * Submit choice to server
 */
function submitChoice(number) {
    clearInterval(timerInterval);

    // Disable all buttons
    numberButtons.forEach(btn => btn.disabled = true);

    socket.emit('game:choice_made', {
        roomId: currentRoom,
        choice: number,
        role: userRole
    });

    statusMessage.textContent = 'Waiting for opponent...';
}

/**
 * Show round result
 */
function showResult(data) {
    // Hide status, show number display
    statusMessage.style.display = 'none';
    numberDisplay.style.display = 'block';

    // Show the number
    const runs = data.isOut ? 0 : data.runs;
    bigNumber.textContent = runs;
    numberWord.textContent = numberWords[runs];

    // Show hands with choices
    leftHand.innerHTML = `<div class="hand-icon red">${handEmojis[data.batter]}</div>`;
    rightHand.innerHTML = `<div class="hand-icon blue">${handEmojis[data.bowler]}</div>`;

    // Show result message
    resultMessage.style.display = 'block';
    if (data.isOut) {
        resultMessage.textContent = 'OUT! 😱';
        resultMessage.classList.add('out');
    } else {
        const messages = [
            'Wooohoo! 🎉',
            'Nice one! ⭐',
            'Great shot! 🏏',
            'Awesome! 🔥',
            'Well played! 👏'
        ];
        resultMessage.textContent = messages[Math.floor(Math.random() * messages.length)];
        resultMessage.classList.remove('out');
    }

    // Hide after 3 seconds
    setTimeout(() => {
        numberDisplay.style.display = 'none';
        resultMessage.style.display = 'none';
        leftHand.innerHTML = '';
        rightHand.innerHTML = '';
    }, 3000);
}


/**
 * Update last 6 balls ticker
 */
/**
 * Show match result
 */
function showMatchResult(data) {
    const modal = document.getElementById('resultModal');
    const resultTitle = document.getElementById('resultTitle');
    const resultText = document.getElementById('resultText');
    const team1Name = document.getElementById('team1Name');
    const team1Score = document.getElementById('team1Score');
    const team2Name = document.getElementById('team2Name');
    const team2Score = document.getElementById('team2Score');

    resultTitle.textContent = 'Match Complete!';
    resultText.textContent = data.result?.message || 'Match finished!';

    if (data.innings && data.innings.length === 2) {
        team1Name.textContent = 'Team A';
        team1Score.textContent = `${data.innings[0].runs}/${data.innings[0].wickets}`;
        team2Name.textContent = 'Team B';
        team2Score.textContent = `${data.innings[1].runs}/${data.innings[1].wickets}`;
    }

    modal.style.display = 'flex';
}

/**
 * Show status message
 */
function showStatus(message) {
    numberDisplay.style.display = 'none';
    statusMessage.style.display = 'block';
    statusMessage.textContent = message;
}

/**
 * Initialize page
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏏 Game page loaded');
    console.log('Mode:', gameMode);

    if (!gameMode) {
        alert('Invalid game mode');
        window.location.href = '/dashboard';
        return;
    }

    initializeSocket();
});

