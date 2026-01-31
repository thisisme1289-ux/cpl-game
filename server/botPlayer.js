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
    // Add bot if only 1 human player and game not started
    const humanPlayers = room.players.filter(p => !p.isBot);
    return humanPlayers.length === 1 && room.game.state === 'LOBBY';
  }

  // Add bot to room
  addBot(roomId, io, room) {
    if (this.activeBots.has(roomId)) {
      return; // Bot already exists
    }

    const bot = new BotPlayer(roomId);
    this.activeBots.set(roomId, bot);

    // Add bot to room
    room.players.push({
      id: bot.socketId,
      name: bot.name,
      isBot: true
    });

    // Assign to team
    const teamA = room.players.filter(p => p.team === 'A').length;
    const teamB = room.players.filter(p => p.team === 'B').length;
    
    const botPlayer = room.players.find(p => p.id === bot.socketId);
    botPlayer.team = teamA <= teamB ? 'A' : 'B';

    console.log(`🤖 Bot "${bot.name}" joined room ${roomId}`);

    // Emit to all players
    io.to(roomId).emit('player-joined', {
      playerName: bot.name,
      players: room.players
    });

    return bot;
  }

  // Remove bot from room
  removeBot(roomId, io, room) {
    const bot = this.activeBots.get(roomId);
    if (!bot) return;

    // Remove from room
    room.players = room.players.filter(p => p.id !== bot.socketId);

    // Clear any timers
    if (this.botTimers.has(roomId)) {
      clearTimeout(this.botTimers.get(roomId));
      this.botTimers.delete(roomId);
    }

    this.activeBots.delete(roomId);

    console.log(`🤖 Bot removed from room ${roomId}`);

    // Emit to all players
    io.to(roomId).emit('player-left', {
      playerName: bot.name
    });
  }

  // Bot makes a move
  makeBotMove(roomId, io, room, gameLogic) {
    const bot = this.activeBots.get(roomId);
    if (!bot) return;

    const game = room.game;

    // Determine if bot is batting or bowling (by name comparison)
    const isBotBatter = game.currentBatter && room.playerNames[game.currentBatter] === bot.name;
    const isBotBowler = game.currentBowler && room.playerNames[game.currentBowler] === bot.name;

    if (!isBotBatter && !isBotBowler) return;

    // Bot makes decision
    const fingers = bot.chooseFingers({
      isBatting: isBotBatter,
      currentScore: game.score || 0,
      target: game.innings === 2 ? game.innings1Score + 1 : null,
      wickets: game.wickets || 0
    });

    // Delay to simulate thinking
    const delay = bot.getThinkingDelay();

    const timer = setTimeout(() => {
      // Record bot's input using socket ID (not name)
      gameLogic.recordPlayerInput(roomId, bot.socketId, fingers);

      // Emit bot's choice
      io.to(roomId).emit('bot-selected', {
        botName: bot.name,
        role,
        fingers
      });

      // Check if both inputs received
      if (gameLogic.areBothInputsReceived(roomId)) {
        // Process the round
        const result = gameLogic.processRound(roomId);
        if (result.success) {
          io.to(roomId).emit('round-result', result);
        }
      }
    }, delay);

    this.botTimers.set(roomId, timer);
  }

  // Check if room needs bot action
  checkBotAction(roomId, io, room, gameLogic) {
    const bot = this.activeBots.get(roomId);
    if (!bot) return;

    const game = room.game;

    // Only act during PLAYING state
    if (game.state !== 'PLAYING') return;

    // Check if it's bot's turn (compare by name, not socket ID)
    const isBotBatter = game.currentBatter && room.playerNames[game.currentBatter] === bot.name;
    const isBotBowler = game.currentBowler && room.playerNames[game.currentBowler] === bot.name;
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
