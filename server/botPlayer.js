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

  chooseFingers(gameState) {
    const { isBatting, currentScore, target, wickets } = gameState;

    if (this.difficulty === 'easy') {
      return Math.floor(Math.random() * 5) + 1;
    }

    if (this.difficulty === 'medium') {
      if (isBatting) {
        const random = Math.random() * 9;
        if (random < 1) return 1;
        if (random < 3) return 2;
        if (random < 6) return 3;
        if (random < 8) return 4;
        return 5;
      } else {
        return Math.floor(Math.random() * 5) + 1;
      }
    }

    if (this.difficulty === 'hard') {
      if (isBatting) {
        if (target && currentScore < target - 20) {
          return Math.random() < 0.6 ? (Math.random() < 0.5 ? 4 : 5) : 3;
        }
        if (wickets >= 7) {
          return Math.floor(Math.random() * 3) + 1;
        }
        return Math.floor(Math.random() * 5) + 1;
      } else {
        return Math.random() < 0.5
          ? Math.floor(Math.random() * 2) + 1
          : Math.floor(Math.random() * 2) + 4;
      }
    }

    return Math.floor(Math.random() * 5) + 1;
  }

  getThinkingDelay() {
    return Math.floor(Math.random() * 1200) + 300;
  }
}

class BotManager {
  constructor() {
    this.activeBots = new Map();
    this.botTimers = new Map();
  }

  shouldAddBot(room) {
    const totalPlayers = room.players.length;
    const hasBot = room.players.some(p => p.isBot);
    return totalPlayers === 1 && !hasBot && room.game.state === 'LOBBY';
  }

  addBot(roomId, io, room) {
    if (this.activeBots.has(roomId)) return null;

    const bot = new BotPlayer(roomId);
    this.activeBots.set(roomId, bot);

    room.players.push(bot.socketId);
    room.playerNames[bot.socketId] = bot.name;

    if (room.teamA.length > 0) {
      room.teamB.push(bot.socketId);
    } else {
      room.teamA.push(bot.socketId);
    }

    return bot;
  }

  removeBot(roomId, io, room) {
    const bot = this.activeBots.get(roomId);
    if (!bot) return;

    // FIX: players array contains socketIds, not objects
    room.players = room.players.filter(id => id !== bot.socketId);
    room.teamA = room.teamA.filter(id => id !== bot.socketId);
    room.teamB = room.teamB.filter(id => id !== bot.socketId);

    delete room.playerNames[bot.socketId];

    if (this.botTimers.has(roomId)) {
      clearTimeout(this.botTimers.get(roomId));
      this.botTimers.delete(roomId);
    }

    this.activeBots.delete(roomId);

    io.to(roomId).emit('player-left', {
      playerName: bot.name
    });
  }

  makeBotMove(roomId, io, room, gameLogic) {
    const bot = this.activeBots.get(roomId);
    if (!bot) return;

    const game = room.game;

    const isBotBatter = game.currentBatter === bot.socketId;
    const isBotBowler = game.currentBowler === bot.socketId;

    if (!isBotBatter && !isBotBowler) return;

    const role = isBotBatter ? 'batter' : 'bowler';

    const fingers = bot.chooseFingers({
      isBatting: isBotBatter,
      currentScore: game.score || 0,
      target: game.innings === 2 ? game.innings1Score + 1 : null,
      wickets: game.wickets || 0
    });

    const delay = bot.getThinkingDelay();

    const timer = setTimeout(() => {
      const result = gameLogic.recordPlayerInput(roomId, bot.socketId, fingers);
      if (!result.success) return;

      io.to(roomId).emit('bot-action', {
        botName: bot.name,
        role,
        fingers
      });

      if (gameLogic.areBothInputsReceived(roomId)) {
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

  checkBotAction(roomId, io, room, gameLogic) {
    const bot = this.activeBots.get(roomId);
    if (!bot) return;

    const game = room.game;
    if (game.state !== 'PLAYING') return;

    const isBotBatter = game.currentBatter === bot.socketId;
    const isBotBowler = game.currentBowler === bot.socketId;

    if (isBotBatter || isBotBowler) {
      this.makeBotMove(roomId, io, room, gameLogic);
    }
  }

  getBot(roomId) {
    return this.activeBots.get(roomId);
  }
}

module.exports = { BotPlayer, BotManager };
