// Bot Player System for CPL Cricket Game

class BotPlayer {
  constructor(roomId) {
    this.roomId = roomId;
    this.name = this.generateBotName();
    this.socketId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.isBot = true;
    this.difficulty = 'medium'; // easy, medium, hard
  }

  generateBotName() {
    const names = [
      'Cricket Bot 🤖',
      'AI Bowler ⚡',
      'Robo Batsman 🏏',
      'Thunder Bot ⚡',
      'Smart Player 🧠',
      'Quick Bot 🚀',
      'Master AI 👑',
      'Pro Bot 💪',
      'Spin Bot 🌀',
      'Fast Bot 🎯'
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  // Bot decision making for finger selection
  chooseFingers(gameState) {
    const { isBatting, currentScore, target, wickets } = gameState;

    if (this.difficulty === 'easy') {
      // Easy: Random selection
      return Math.floor(Math.random() * 5) + 1;
    }

    if (this.difficulty === 'medium') {
      // Medium: Slightly strategic
      if (isBatting) {
        // Batting: Prefer middle values
        const weights = [1, 2, 3, 2, 1]; // Prefer 2, 3, 4
        const random = Math.random() * 9;
        if (random < 1) return 1;
        if (random < 3) return 2;
        if (random < 6) return 3;
        if (random < 8) return 4;
        return 5;
      } else {
        // Bowling: Try to predict
        return Math.floor(Math.random() * 5) + 1;
      }
    }

    if (this.difficulty === 'hard') {
      // Hard: Advanced strategy
      if (isBatting) {
        // Aggressive if ahead, cautious if behind
        if (target && currentScore < target - 20) {
          // Need quick runs - prefer 4, 5
          return Math.random() < 0.6 ? (Math.random() < 0.5 ? 4 : 5) : 3;
        }
        if (wickets >= 7) {
          // Tail end - play safe
          return Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
        }
        // Normal - balanced
        return Math.floor(Math.random() * 5) + 1;
      } else {
        // Bowling: Counter-strategy
        // Vary between low and high
        return Math.random() < 0.5 ? Math.floor(Math.random() * 2) + 1 : Math.floor(Math.random() * 2) + 4;
      }
    }

    return Math.floor(Math.random() * 5) + 1;
  }

  // Random delay to simulate thinking (300-1500ms)
  getThinkingDelay() {
    return Math.floor(Math.random() * 1200) + 300;
  }
}

// Bot Manager - handles bot players in rooms
class BotManager {
  constructor() {
    this.activeBots = new Map(); // roomId -> BotPlayer
    this.botTimers = new Map(); // roomId -> setTimeout id
  }

  // Check if bot should be added to room
  shouldAddBot(room) {
    // Add bot if only 1 player total and game not started
    const totalPlayers = room.players.length;
    const hasBot = room.players.some(p => p.isBot);
    return totalPlayers === 1 && !hasBot && room.game.state === 'LOBBY';
  }

  // Add bot to room
  addBot(roomId, io, room) {
    if (this.activeBots.has(roomId)) {
      console.log('⚠️ Bot already exists in room');
      return null; // Bot already exists
    }

    const bot = new BotPlayer(roomId);
    this.activeBots.set(roomId, bot);

    // Add bot socket ID to players array (consistent with human players)
    room.players.push(bot.socketId);

    // Add bot name to playerNames
    room.playerNames[bot.socketId] = bot.name;

    // Assign to team opposite of first player
    // If first player is in teamA, bot goes to teamB
    if (room.teamA.length > 0) {
      room.teamB.push(bot.socketId);
      console.log(`🤖 Bot "${bot.name}" added to Team B in ${roomId}`);
    } else {
      room.teamA.push(bot.socketId);
      console.log(`🤖 Bot "${bot.name}" added to Team A in ${roomId}`);
    }

    return bot;
  }

  // Remove bot from room
  removeBot(roomId, io, room) {
    const bot = this.activeBots.get(roomId);
    if (!bot) return;

    // Remove from players array
    room.players = room.players.filter(p => p.id !== bot.socketId);
    
    // Remove from team arrays
    room.teamA = room.teamA.filter(id => id !== bot.socketId);
    room.teamB = room.teamB.filter(id => id !== bot.socketId);
    
    // Remove from playerNames
    delete room.playerNames[bot.socketId];

    // Clear any timers
    if (this.botTimers.has(roomId)) {
      clearTimeout(this.botTimers.get(roomId));
      this.botTimers.delete(roomId);
    }

    this.activeBots.delete(roomId);

    console.log(`🤖 Bot "${bot.name}" removed from room ${roomId}`);

    // Emit to all players
    io.to(roomId).emit('player-left', {
      playerName: bot.name
    });
  }

  // Bot makes a move
  makeBotMove(roomId, io, room, gameLogic) {
    const bot = this.activeBots.get(roomId);
    if (!bot) {
      console.log('⚠️ Bot not found for room:', roomId);
      return;
    }

    const game = room.game;

    // Determine if bot is batting or bowling (by socket ID comparison)
    const isBotBatter = game.currentBatter === bot.socketId;
    const isBotBowler = game.currentBowler === bot.socketId;

    if (!isBotBatter && !isBotBowler) {
      console.log('⚠️ Not bot\'s turn');
      return;
    }

    const role = isBotBatter ? 'batter' : 'bowler';

    // Bot makes decision
    const fingers = bot.chooseFingers({
      isBatting: isBotBatter,
      currentScore: game.score || 0,
      target: game.innings === 2 ? game.innings1Score + 1 : null,
      wickets: game.wickets || 0
    });

    console.log(`🤖 Bot ${bot.name} (${role}) choosing: ${fingers}`);

    // Delay to simulate thinking
    const delay = bot.getThinkingDelay();

    const timer = setTimeout(() => {
      console.log(`🤖 Bot ${bot.name} playing ${fingers} as ${role}`);
      
      // Record bot's input using socket ID
      const result = gameLogic.recordPlayerInput(roomId, bot.socketId, fingers);
      
      if (!result.success) {
        console.error('❌ Bot input failed:', result.message);
        return;
      }

      // Emit bot's choice to all players
      io.to(roomId).emit('bot-action', {
        botName: bot.name,
        role: role,
        fingers: fingers
      });

      console.log(`✅ Bot input recorded, checking if both received...`);

      // Check if both inputs received and process if ready
      if (gameLogic.areBothInputsReceived(roomId)) {
        console.log('✅ Both inputs received, processing round...');
        const roundResult = gameLogic.processRound(roomId);
        if (roundResult.success) {
          io.to(roomId).emit('round-result', {
            batterFingers: roundResult.batterFingers,
            bowlerFingers: roundResult.bowlerFingers,
            runs: roundResult.runs,
            isOut: roundResult.isOut,
            isOverComplete: roundResult.isOverComplete,
            batter: room.playerNames[game.currentBatter],
            bowler: room.playerNames[game.currentBowler],
            score: roundResult.score,
            wickets: roundResult.wickets
          });
        }
      }
    }, delay);

    this.botTimers.set(roomId, timer);
  }

    this.botTimers.set(roomId, timer);
  }

  // Check if room needs bot action
  checkBotAction(roomId, io, room, gameLogic) {
    const bot = this.activeBots.get(roomId);
    if (!bot) return;

    const game = room.game;

    // Only act during PLAYING state
    if (game.state !== 'PLAYING') return;

    // Check if it's bot's turn (compare by socket ID)
    const isBotBatter = game.currentBatter === bot.socketId;
    const isBotBowler = game.currentBowler === bot.socketId;
    const isBotTurn = isBotBatter || isBotBowler;

    if (isBotTurn) {
      console.log(`🤖 Bot's turn! ${bot.name} is ${isBotBatter ? 'batting' : 'bowling'}`);
      this.makeBotMove(roomId, io, room, gameLogic);
    }
  }

  // Get bot for room
  getBot(roomId) {
    return this.activeBots.get(roomId);
  }
}

module.exports = { BotPlayer, BotManager };
