/**
 * CPL Game Logic Module
 * 
 * Implements complete finger cricket game flow with proper state machine
 * Server is authoritative - all game decisions happen here
 */

const { getRoom } = require('./room');

// Game States (Finite State Machine)
const GAME_STATES = {
  LOBBY: 'LOBBY',                      // Players joining, teams forming
  LEADER_SELECTION: 'LEADER_SELECTION', // Captains being chosen
  PLAYER_SELECTION: 'PLAYER_SELECTION', // Selecting batter & bowler
  PLAYING: 'PLAYING',                   // Active ball - waiting for inputs
  BALL_RESULT: 'BALL_RESULT',          // Showing result animation
  OVER_END: 'OVER_END',                // Over completed
  INNINGS_END: 'INNINGS_END',          // Team innings finished
  MATCH_END: 'MATCH_END'               // Game finished
};

/**
 * Start Game
 * Called when leader clicks "Start Game"
 * 
 * Flow:
 * 1. Validate leaders exist
 * 2. Initialize game state
 * 3. Move to PLAYER_SELECTION
 * 4. Request leaders to select batter/bowler
 */
function startGame(roomId) {
  const room = getRoom(roomId);
  
  if (!room) {
    return { success: false, message: 'Room not found' };
  }
  
  if (room.game.state !== GAME_STATES.LOBBY) {
    return { success: false, message: 'Game already started' };
  }
  
  if (!room.leaderA || !room.leaderB) {
    return { success: false, message: 'Leaders must be selected first' };
  }
  
  // Initialize game state for FIRST INNINGS
  room.game.state = GAME_STATES.PLAYER_SELECTION;
  room.game.innings = 1; // Start with innings 1
  room.game.score = 0;
  room.game.wickets = 0;
  room.game.overs = 0;
  room.game.balls = 0;
  room.game.battingTeam = 'A'; // Team A bats first
  room.game.bowlingTeam = 'B';
  room.game.currentBatter = null;
  room.game.currentBowler = null;
  room.game.batterInput = null;
  room.game.bowlerInput = null;
  room.game.history = [];
  room.game.outPlayers = []; // Reset for this innings
  
  // Initialize innings scores
  room.game.innings1Score = 0;
  room.game.innings1Wickets = 0;
  room.game.innings1Overs = 0;
  room.game.innings2Score = 0;
  room.game.innings2Wickets = 0;
  room.game.innings2Overs = 0;
  
  console.log(`[GAME START] ${roomId}: State → PLAYER_SELECTION, Innings 1`);
  
  return { 
    success: true,
    state: GAME_STATES.PLAYER_SELECTION,
    message: 'Game started! Innings 1 - Leaders, select batter and bowler.'
  };
}

/**
 * Select Batter and Bowler
 * Called by leaders to choose active players
 * 
 * Rules:
 * - Batter must be from batting team
 * - Bowler must be from bowling team
 * - Cannot select player who is already out
 * 
 * Once both selected → Move to PLAYING state
 */
function selectPlayers(roomId, batterSocket, bowlerSocket) {
  const room = getRoom(roomId);
  
  if (!room) {
    return { success: false, message: 'Room not found' };
  }
  
  if (room.game.state !== GAME_STATES.PLAYER_SELECTION) {
    return { success: false, message: 'Not in player selection phase' };
  }
  
  // Verify batter is from batting team
  const batterInA = room.teamA.includes(batterSocket);
  const batterInB = room.teamB.includes(batterSocket);
  
  // Verify bowler is from bowling team
  const bowlerInA = room.teamA.includes(bowlerSocket);
  const bowlerInB = room.teamB.includes(bowlerSocket);
  
  // Batter must be from batting team
  const battingTeam = room.game.battingTeam;
  if (battingTeam === 'A' && !batterInA) {
    return { success: false, message: 'Batter must be from Team A (batting team)' };
  }
  if (battingTeam === 'B' && !batterInB) {
    return { success: false, message: 'Batter must be from Team B (batting team)' };
  }
  
  // Bowler must be from bowling team
  const bowlingTeam = room.game.bowlingTeam;
  if (bowlingTeam === 'A' && !bowlerInA) {
    return { success: false, message: 'Bowler must be from Team A (bowling team)' };
  }
  if (bowlingTeam === 'B' && !bowlerInB) {
    return { success: false, message: 'Bowler must be from Team B (bowling team)' };
  }
  
  // Check if batter is already out
  if (room.game.outPlayers.includes(batterSocket)) {
    return { success: false, message: 'Cannot select a player who is already out' };
  }
  
  // Set current players
  room.game.currentBatter = batterSocket;
  room.game.currentBowler = bowlerSocket;
  room.game.batterInput = null;
  room.game.bowlerInput = null;
  
  // Move to PLAYING state
  room.game.state = GAME_STATES.PLAYING;
  
  console.log(`[PLAYER SELECT] ${roomId}: Batter ${room.playerNames[batterSocket]} vs Bowler ${room.playerNames[bowlerSocket]}`);
  console.log(`[STATE CHANGE] ${roomId}: PLAYER_SELECTION → PLAYING`);
  
  return { 
    success: true,
    state: GAME_STATES.PLAYING,
    batter: room.playerNames[batterSocket],
    bowler: room.playerNames[bowlerSocket]
  };
}

/**
 * Record Player Input
 * Called when batter or bowler selects fingers
 * 
 * Validation:
 * - Only accept from current batter/bowler
 * - Only accept 1-5
 * - Only accept in PLAYING state
 */
function recordPlayerInput(roomId, socketId, fingers) {
  const room = getRoom(roomId);
  
  if (!room) {
    return { success: false, message: 'Room not found' };
  }
  
  if (room.game.state !== GAME_STATES.PLAYING) {
    return { success: false, message: 'Not in playing state' };
  }
  
  // Validate finger value
  if (typeof fingers !== 'number' || fingers < 1 || fingers > 5) {
    return { success: false, message: 'Invalid finger value (must be 1-5)' };
  }
  
  // Check if player is current batter or bowler
  if (socketId === room.game.currentBatter) {
    if (room.game.batterInput !== null) {
      return { success: false, message: 'Input already recorded' };
    }
    room.game.batterInput = fingers;
    console.log(`[INPUT] ${roomId}: Batter chose ${fingers}`);
  } else if (socketId === room.game.currentBowler) {
    if (room.game.bowlerInput !== null) {
      return { success: false, message: 'Input already recorded' };
    }
    room.game.bowlerInput = fingers;
    console.log(`[INPUT] ${roomId}: Bowler chose ${fingers}`);
  } else {
    return { success: false, message: 'Only current batter/bowler can input' };
  }
  
  return { success: true };
}

/**
 * Check if both inputs received
 */
function areBothInputsReceived(roomId) {
  const room = getRoom(roomId);
  if (!room) return false;
  
  return room.game.batterInput !== null && room.game.bowlerInput !== null;
}

/**
 * Process Round
 * Called after both batter and bowler have input
 * 
 * Flow:
 * 1. Compare finger values
 * 2. Determine OUT or RUN
 * 3. Update score/wickets
 * 4. Increment balls/overs
 * 5. Move to BALL_RESULT state
 * 6. Check for game end conditions
 */
function processRound(roomId) {
  const room = getRoom(roomId);
  
  if (!room) {
    return { success: false, message: 'Room not found' };
  }
  
  if (room.game.state !== GAME_STATES.PLAYING) {
    return { success: false, message: 'Not in playing state' };
  }
  
  const batterFingers = room.game.batterInput;
  const bowlerFingers = room.game.bowlerInput;
  
  // Validate both inputs exist
  if (batterFingers === null || bowlerFingers === null) {
    return { success: false, message: 'Waiting for both inputs' };
  }
  
  // Validate inputs (should already be validated, but double-check)
  if (batterFingers < 1 || batterFingers > 5 || bowlerFingers < 1 || bowlerFingers > 5) {
    return { success: false, message: 'Invalid finger values' };
  }
  
  let isOut = false;
  let runs = 0;
  
  // CORE GAME RULE: If numbers match → OUT
  if (batterFingers === bowlerFingers) {
    isOut = true;
    room.game.wickets = (room.game.wickets || 0) + 1;
    room.game.outPlayers.push(room.game.currentBatter);
    console.log(`[RESULT] ${roomId}: OUT! (${batterFingers} = ${bowlerFingers})`);
  } else {
    runs = batterFingers;
    room.game.score = (room.game.score || 0) + runs;
    console.log(`[RESULT] ${roomId}: ${runs} runs (${batterFingers} ≠ ${bowlerFingers})`);
  }
  
  // Increment balls
  room.game.balls = (room.game.balls || 0) + 1;
  
  // Check if over is complete
  let isOverComplete = false;
  if (room.game.balls >= 6) {
    room.game.overs = (room.game.overs || 0) + 1;
    room.game.balls = 0;
    isOverComplete = true;
    console.log(`[OVER END] ${roomId}: Over ${room.game.overs} complete`);
  }
  
  // Add to history
  room.game.history.push({
    ball: room.game.overs * 6 + room.game.balls,
    batter: room.playerNames[room.game.currentBatter],
    bowler: room.playerNames[room.game.currentBowler],
    batterFingers,
    bowlerFingers,
    runs,
    isOut,
    timestamp: Date.now()
  });
  
  // Move to BALL_RESULT state
  room.game.state = GAME_STATES.BALL_RESULT;
  
  // Reset inputs
  room.game.batterInput = null;
  room.game.bowlerInput = null;
  
  // Determine next state
  let nextState = null;
  let gameOverReason = null;
  let inningsComplete = false;
  let switchingInnings = false;
  
  // CHECK TARGET ACHIEVEMENT FIRST (Innings 2 only)
  if (room.game.innings === 2 && room.game.score > room.game.innings1Score) {
    // TARGET ACHIEVED! Match won!
    room.game.innings2Score = room.game.score || 0;
    room.game.innings2Wickets = room.game.wickets || 0;
    room.game.innings2Overs = room.game.overs || 0;
    nextState = GAME_STATES.MATCH_END;
    gameOverReason = getGameOverReason(roomId);
    console.log(`[MATCH END - TARGET ACHIEVED] ${roomId}: ${gameOverReason}`);
  }
  // Check if CURRENT INNINGS is over (not match)
  else if (isInningsOver(roomId)) {
    console.log(`[INNINGS OVER] ${roomId}: Innings ${room.game.innings} complete`);
    
    // Check if this was innings 1 or 2
    if (room.game.innings === 1) {
      // Save innings 1 score and switch to innings 2
      const switchResult = switchInnings(roomId);
      if (switchResult.success) {
        nextState = GAME_STATES.PLAYER_SELECTION;
        inningsComplete = true;
        switchingInnings = true;
        console.log(`[INNINGS SWITCH] ${roomId}: Now Innings 2, Target: ${switchResult.target}`);
      }
    } else {
      // Innings 2 complete = Match over (failed to achieve target or all out)
      room.game.innings2Score = room.game.score || 0;
      room.game.innings2Wickets = room.game.wickets || 0;
      room.game.innings2Overs = room.game.overs || 0;
      nextState = GAME_STATES.MATCH_END;
      gameOverReason = getGameOverReason(roomId);
      console.log(`[MATCH END] ${roomId}: ${gameOverReason}`);
    }
  } else if (isOut || isOverComplete) {
    // Need to select new players (but stay in same innings)
    nextState = GAME_STATES.PLAYER_SELECTION;
    console.log(`[STATE CHANGE] ${roomId}: BALL_RESULT → PLAYER_SELECTION`);
  } else {
    // Continue with same players
    nextState = GAME_STATES.PLAYING;
  }
  
  return {
    success: true,
    batterFingers,
    bowlerFingers,
    runs,
    isOut,
    isOverComplete,
    inningsComplete,
    switchingInnings,
    nextState,
    gameOverReason,
    score: room.game.score || 0,
    wickets: room.game.wickets || 0,
    overs: room.game.overs || 0,
    balls: room.game.balls || 0,
    innings: room.game.innings || 1,
    target: room.game.innings === 2 ? (room.game.innings1Score || 0) + 1 : null
  };
}

/**
 * Check if current innings is over
 */
function isInningsOver(roomId) {
  const room = getRoom(roomId);
  if (!room) return false;
  
  // Innings over if all overs completed
  if (room.game.overs >= room.totalOvers) {
    return true;
  }
  
  // Innings over if all players are out
  const battingTeam = room.game.battingTeam === 'A' ? room.teamA : room.teamB;
  const remainingPlayers = battingTeam.filter(
    sid => !room.game.outPlayers.includes(sid)
  );
  
  if (remainingPlayers.length === 0) {
    return true; // All out
  }
  
  return false;
}

/**
 * Switch innings (Team A batted, now Team B bats)
 */
function switchInnings(roomId) {
  const room = getRoom(roomId);
  if (!room) return { success: false };
  
  console.log(`[INNINGS SWITCH] ${roomId}: Innings ${room.game.innings} complete`);
  
  // Save innings 1 score
  if (room.game.innings === 1) {
    room.game.innings1Score = room.game.score || 0;
    room.game.innings1Wickets = room.game.wickets || 0;
    room.game.innings1Overs = room.game.overs || 0;
    
    // Switch teams
    const tempTeam = room.game.battingTeam;
    room.game.battingTeam = room.game.bowlingTeam;
    room.game.bowlingTeam = tempTeam;
    
    // Reset for innings 2
    room.game.innings = 2;
    room.game.score = 0;
    room.game.wickets = 0;
    room.game.overs = 0;
    room.game.balls = 0;
    room.game.outPlayers = [];
    room.game.currentBatter = null;
    room.game.currentBowler = null;
    room.game.pendingBatter = null; // CRITICAL FIX: Reset pending selections
    room.game.pendingBowler = null; // CRITICAL FIX: Reset pending selections
    room.game.state = GAME_STATES.PLAYER_SELECTION;
    
    console.log(`[INNINGS 2] ${roomId}: Team ${room.game.battingTeam} now batting. Target: ${room.game.innings1Score + 1}`);
    
    return {
      success: true,
      innings: 2,
      target: room.game.innings1Score + 1,
      message: `Innings 2! Team ${room.game.battingTeam} needs ${room.game.innings1Score + 1} runs to win!`
    };
  }
  
  return { success: false };
}

/**
 * Check if match is over (both innings complete)
 */
function isMatchOver(roomId) {
  const room = getRoom(roomId);
  if (!room) return false;
  
  // Match not over if still in innings 1
  if (room.game.innings === 1) {
    return false;
  }
  
  // Match over if innings 2 complete
  if (room.game.innings === 2 && isInningsOver(roomId)) {
    room.game.innings2Score = room.game.score || 0;
    room.game.innings2Wickets = room.game.wickets || 0;
    room.game.innings2Overs = room.game.overs || 0;
    room.game.state = GAME_STATES.MATCH_END;
    return true;
  }
  
  // Match over if innings 2 team achieved target
  if (room.game.innings === 2 && room.game.score > room.game.innings1Score) {
    room.game.innings2Score = room.game.score || 0;
    room.game.innings2Wickets = room.game.wickets || 0;
    room.game.innings2Overs = room.game.overs || 0;
    room.game.state = GAME_STATES.MATCH_END;
    return true;
  }
  
  return false;
}

/**
 * Get game over reason with winner
 */
function getGameOverReason(roomId) {
  const room = getRoom(roomId);
  if (!room) return 'Unknown';
  
  const team1Score = room.game.innings1Score || 0;
  const team2Score = room.game.innings2Score || 0;
  
  let winner = null;
  let margin = '';
  
  if (team2Score > team1Score) {
    winner = room.game.battingTeam; // Current batting team won
    const wicketsRemaining = (room.game.battingTeam === 'A' ? room.teamA.length : room.teamB.length) - (room.game.wickets || 0);
    margin = `by ${wicketsRemaining} wickets`;
  } else if (team1Score > team2Score) {
    winner = room.game.bowlingTeam; // First batting team won
    const runsDiff = team1Score - team2Score;
    margin = `by ${runsDiff} runs`;
  } else {
    return 'Match Tied!';
  }
  
  return `Team ${winner} wins ${margin}!`;
}

/**
 * Transition to next state after ball result animation
 */
function transitionToNextState(roomId, nextState) {
  const room = getRoom(roomId);
  if (!room) return false;
  
  room.game.state = nextState;
  console.log(`[STATE TRANSITION] ${roomId}: → ${nextState}`);
  
  return true;
}

/**
 * Get available batters (not out)
 */
function getAvailableBatters(roomId) {
  const room = getRoom(roomId);
  if (!room) return [];
  
  const battingTeam = room.game.battingTeam === 'A' ? room.teamA : room.teamB;
  return battingTeam.filter(socketId => !room.game.outPlayers.includes(socketId));
}

/**
 * Auto-select next batter (if leader timeout)
 */
function autoSelectBatter(roomId) {
  const room = getRoom(roomId);
  if (!room) return null;
  
  const available = getAvailableBatters(roomId);
  if (available.length === 0) return null;
  
  // Select first available
  return available[0];
}

module.exports = {
  GAME_STATES,
  startGame,
  selectPlayers,
  recordPlayerInput,
  areBothInputsReceived,
  processRound,
  isInningsOver,
  switchInnings,
  isMatchOver,
  getGameOverReason,
  transitionToNextState,
  getAvailableBatters,
  autoSelectBatter
};
