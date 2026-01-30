// Room management module
const rooms = {};

// Generate unique room ID
function generateRoomId() {
  return 'room-' + Math.random().toString(36).substr(2, 5);
}

// Create new room
function createRoom(type = 'random', overs = 5) {
  const roomId = generateRoomId();
  
  rooms[roomId] = {
    id: roomId,
    type: type, // 'random' or 'custom'
    totalOvers: overs,
    players: [], // Array of socket IDs
    playerNames: {}, // Map: socketId -> playerName
    teamA: [],
    teamB: [],
    leaderA: null,
    leaderB: null,
    game: {
      state: 'LOBBY', // Game state machine
      innings: 1, // NEW: Current innings (1 or 2)
      score: 0,
      wickets: 0,
      overs: 0,
      balls: 0,
      // NEW: Store both innings scores
      innings1Score: 0,
      innings1Wickets: 0,
      innings1Overs: 0,
      innings2Score: 0,
      innings2Wickets: 0,
      innings2Overs: 0,
      currentBatter: null,
      currentBowler: null,
      batterInput: null,
      bowlerInput: null,
      battingTeam: null, // 'A' or 'B'
      bowlingTeam: null, // 'A' or 'B'
      outPlayers: [], // Array of socket IDs who are out
      pendingBatter: null, // Temporary storage during selection
      pendingBowler: null, // Temporary storage during selection
      history: [] // Game history
    },
    createdAt: Date.now()
  };
  
  return roomId;
}

// Add player to room
function addPlayerToRoom(roomId, socketId, playerName) {
  const room = rooms[roomId];
  
  if (!room) {
    return { success: false, message: 'Room not found' };
  }
  
  if (room.players.length >= 12) {
    return { success: false, message: 'Room is full' };
  }
  
  // Check if player name already exists in this room
  for (const sid in room.playerNames) {
    if (room.playerNames[sid] === playerName) {
      // Remove old socket, add new one (reconnect case)
      removePlayerFromRoom(roomId, sid);
      break;
    }
  }
  
  // Add player
  room.players.push(socketId);
  room.playerNames[socketId] = playerName;
  
  // Assign to team (balance teams)
  if (room.teamA.length <= room.teamB.length) {
    room.teamA.push(socketId);
    return { success: true, team: 'A' };
  } else {
    room.teamB.push(socketId);
    return { success: true, team: 'B' };
  }
}

// Remove player from room
function removePlayerFromRoom(roomId, socketId) {
  const room = rooms[roomId];
  
  if (!room) return false;
  
  // Remove from players list
  room.players = room.players.filter(id => id !== socketId);
  
  // Remove from teams
  room.teamA = room.teamA.filter(id => id !== socketId);
  room.teamB = room.teamB.filter(id => id !== socketId);
  
  // Remove leader status if applicable
  if (room.leaderA === socketId) room.leaderA = null;
  if (room.leaderB === socketId) room.leaderB = null;
  
  // Delete player name mapping
  delete room.playerNames[socketId];
  
  // Delete room if empty
  if (room.players.length === 0) {
    delete rooms[roomId];
  }
  
  return true;
}

// Rejoin room (for reconnect/refresh)
function rejoinRoom(roomId, newSocketId, playerName) {
  const room = rooms[roomId];
  
  if (!room) {
    return { success: false, message: 'Room not found' };
  }
  
  // Find and remove old socket with same name
  let oldSocketId = null;
  let team = null;
  
  for (const sid in room.playerNames) {
    if (room.playerNames[sid] === playerName) {
      oldSocketId = sid;
      
      // Determine which team
      if (room.teamA.includes(sid)) {
        team = 'A';
      } else if (room.teamB.includes(sid)) {
        team = 'B';
      }
      
      break;
    }
  }
  
  if (!oldSocketId) {
    // Player not found in room - add as new
    return addPlayerToRoom(roomId, newSocketId, playerName);
  }
  
  // Replace old socket with new one
  const playerIndex = room.players.indexOf(oldSocketId);
  if (playerIndex !== -1) {
    room.players[playerIndex] = newSocketId;
  }
  
  if (team === 'A') {
    const teamIndex = room.teamA.indexOf(oldSocketId);
    if (teamIndex !== -1) {
      room.teamA[teamIndex] = newSocketId;
    }
  } else if (team === 'B') {
    const teamIndex = room.teamB.indexOf(oldSocketId);
    if (teamIndex !== -1) {
      room.teamB[teamIndex] = newSocketId;
    }
  }
  
  // Update leader references
  if (room.leaderA === oldSocketId) {
    room.leaderA = newSocketId;
  }
  if (room.leaderB === oldSocketId) {
    room.leaderB = newSocketId;
  }
  
  // Update game references
  if (room.game.currentBatter === oldSocketId) {
    room.game.currentBatter = newSocketId;
  }
  if (room.game.currentBowler === oldSocketId) {
    room.game.currentBowler = newSocketId;
  }
  
  // Update player name mapping
  delete room.playerNames[oldSocketId];
  room.playerNames[newSocketId] = playerName;
  
  return { success: true, team: team };
}

// Get room
function getRoom(roomId) {
  return rooms[roomId];
}

// Find room for player (by name)
function findRoomForPlayer(playerName) {
  for (const roomId in rooms) {
    const room = rooms[roomId];
    for (const sid in room.playerNames) {
      if (room.playerNames[sid] === playerName) {
        return roomId;
      }
    }
  }
  return null;
}

// Get all rooms
function getAllRooms() {
  return rooms;
}

module.exports = {
  createRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  rejoinRoom,
  getRoom,
  findRoomForPlayer,
  getAllRooms
};
