// Bot Player - Enhanced with Leader Selection
class BotPlayer {
  constructor(roomId) {
    this.roomId = roomId;
    this.socketId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = this.generateName();
    this.difficulty = 'medium';
  }

  generateName() {
    const names = [
      'Cricket Bot 🤖',
      'Thunder Bot ⚡',
      'AI Bowler 🎯',
      'Robo Batsman 🏏',
      'Smart Player 🧠',
      'Fast Bot 🚀',
      'Power Bot 💪',
      'Spin Master 🌀'
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  // Bot chooses fingers based on game state
  chooseFingers(gameState) {
    const { isBatting, currentScore, target, wickets } = gameState;

    if (this.difficulty === 'easy') {
      return Math.floor(Math.random() * 5) + 1;
    }

    if (this.difficulty === 'medium') {
      const weights = [10, 20, 30, 25, 15];
      const rand = Math.random() * 100;
      let cumulative = 0;
      for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (rand < cumulative) return i + 1;
      }
      return 3;
    }

    // Hard difficulty
    if (isBatting) {
      if (target && currentScore < target - 10) {
        return Math.random() < 0.6 ? 4 : 5;
      } else {
        return Math.floor(Math.random() * 3) + 2;
      }
    } else {
      if (wickets > 7) {
        return Math.floor(Math.random() * 2) + 4;
      } else {
        return Math.floor(Math.random() * 4) + 1;
      }
    }
  }

  // Bot selects players when it's leader
  selectPlayers(availableBatters, availableBowlers) {
    const batter = availableBatters[Math.floor(Math.random() * availableBatters.length)];
    const bowler = availableBowlers[Math.floor(Math.random() * availableBowlers.length)];
    return { batter, bowler };
  }

  getThinkingDelay() {
    return Math.floor(Math.random() * 1200) + 300;
  }
}

// Bot Manager
class BotManager {
  constructor() {
    this.activeBots = new Map();
    this.botTimers = new Map();
  }

  shouldAddBot(room) {
    const totalPlayers = room.players.length;
    const hasBot = room.players.some(sid => this.activeBots.has(room.roomId));
    return totalPlayers === 1 && !hasBot && room.game.state === 'LOBBY';
  }

  addBot(roomId, io, room) {
    if (this.activeBots.has(roomId)) {
      console.log('⚠️ Bot already exists');
      return null;
    }

    const bot = new BotPlayer(roomId);
    this.activeBots.set(roomId, bot);

    room.players.push(bot.socketId);
    room.playerNames[bot.socketId] = bot.name;

    if (room.teamA.length > 0) {
      room.teamB.push(bot.socketId);
      console.log(`🤖 Bot "${bot.name}" added to Team B`);
    } else {
      room.teamA.push(bot.socketId);
      console.log(`🤖 Bot "${bot.name}" added to Team A`);
    }

    return bot;
  }

  removeBot(roomId) {
    if (this.activeBots.has(roomId)) {
      this.activeBots.delete(roomId);
      this.clearBotTimer(roomId);
      console.log(`🤖 Bot removed from ${roomId}`);
    }
  }

  clearBotTimer(roomId) {
    const timer = this.botTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.botTimers.delete(roomId);
    }
  }

  // 🆕 AUTO-SELECT WHEN BOT IS LEADER
  handleLeaderSelection(roomId, io, room) {
    const bot = this.activeBots.get(roomId);
    if (!bot) return false;

    const isLeaderA = room.leaderA === bot.socketId;
    const isLeaderB = room.leaderB === bot.socketId;

    if (!isLeaderA && !isLeaderB) return false;

    console.log(`🤖 Bot "${bot.name}" is leader, selecting ITSELF...`);

    setTimeout(() => {
      const { getAvailableBatters, getAvailableBowlers, selectPlayers } = require('./gameLogic');
      
      const availableBatters = getAvailableBatters(roomId);
      const availableBowlers = getAvailableBowlers(roomId);

      if (availableBatters.length === 0 || availableBowlers.length === 0) {
        console.log('⚠️ No available players');
        return;
      }

      // 🆕 BOT ALWAYS SELECTS ITSELF
      let selectedBatter = bot.name;
      let selectedBowler = bot.name;

      // Check if bot is available for each role
      const botNameInBatters = availableBatters.map(sid => room.playerNames[sid]).includes(bot.name);
      const botNameInBowlers = availableBowlers.map(sid => room.playerNames[sid]).includes(bot.name);

      // If bot not available, select random teammate
      if (!botNameInBatters) {
        const teammates = isLeaderA ? room.teamA : room.teamB;
        const availableTeammates = teammates
          .filter(sid => availableBatters.includes(sid))
          .map(sid => room.playerNames[sid]);
        selectedBatter = availableTeammates[Math.floor(Math.random() * availableTeammates.length)] || availableBatters.map(sid => room.playerNames[sid])[0];
      }

      if (!botNameInBowlers) {
        const teammates = isLeaderA ? room.teamA : room.teamB;
        const availableTeammates = teammates
          .filter(sid => availableBowlers.includes(sid))
          .map(sid => room.playerNames[sid]);
        selectedBowler = availableTeammates[Math.floor(Math.random() * availableTeammates.length)] || availableBowlers.map(sid => room.playerNames[sid])[0];
      }

      console.log(`🤖 Bot selected: Batter=${selectedBatter}, Bowler=${selectedBowler}`);

      // Set pending selections
      if (!room.game.pendingBatter) room.game.pendingBatter = selectedBatter;
      if (!room.game.pendingBowler) room.game.pendingBowler = selectedBowler;

      io.to(roomId).emit('chat-message', {
        type: 'system',
        message: `🤖 ${bot.name} selected players`
      });

      // If both selected, start game
      if (room.game.pendingBatter && room.game.pendingBowler) {
        const result = selectPlayers(roomId, room.game.pendingBatter, room.game.pendingBowler);
        
        if (result.success) {
          room.game.pendingBatter = null;
          room.game.pendingBowler = null;

          io.to(roomId).emit('players-selected', {
            batter: room.playerNames[room.game.currentBatter],
            bowler: room.playerNames[room.game.currentBowler]
          });

          io.to(roomId).emit('game-state', {
            state: room.game.state,
            score: room.game.score || 0,
            wickets: room.game.wickets || 0,
            overs: room.game.overs || 0,
            balls: room.game.balls || 0,
            totalOvers: room.totalOvers,
            currentBatter: room.playerNames[room.game.currentBatter],
            currentBowler: room.playerNames[room.game.currentBowler],
            battingTeam: room.game.battingTeam,
            bowlingTeam: room.game.bowlingTeam
          });

          console.log(`✅ Game started - Bot playing as ${selectedBatter === bot.name ? 'batter' : ''} ${selectedBowler === bot.name ? 'bowler' : ''}`);
          
          // 🆕 Trigger bot action if it's the bot's turn
          this.checkBotAction(roomId, io, room, require('./gameLogic').recordPlayerInput);
        }
      }
    }, bot.getThinkingDelay());

    return true;
  }

  makeBotMove(roomId, io, room, recordPlayerInput) {
    const bot = this.activeBots.get(roomId);
    if (!bot) return;

    const game = room.game;
    const isBotBatter = game.currentBatter && room.playerNames[game.currentBatter] === bot.name;
    const isBotBowler = game.currentBowler && room.playerNames[game.currentBowler] === bot.name;

    if (!isBotBatter && !isBotBowler) return;

    console.log(`🤖 ${bot.name} is ${isBotBatter ? 'batting' : 'bowling'}`);

    const fingers = bot.chooseFingers({
      isBatting: isBotBatter,
      currentScore: game.score || 0,
      target: game.innings === 2 ? game.innings1Score + 1 : null,
      wickets: game.wickets || 0
    });

    const timer = setTimeout(() => {
      recordPlayerInput(roomId, bot.socketId, fingers);
      console.log(`🤖 Bot chose: ${fingers}`);
    }, bot.getThinkingDelay());

    this.botTimers.set(roomId, timer);
  }

  checkBotAction(roomId, io, room, recordPlayerInput) {
    const bot = this.activeBots.get(roomId);
    if (!bot) return;

    if (room.game.state !== 'PLAYING') return;

    const isBotBatter = room.game.currentBatter && room.playerNames[room.game.currentBatter] === bot.name;
    const isBotBowler = room.game.currentBowler && room.playerNames[room.game.currentBowler] === bot.name;

    if (isBotBatter || isBotBowler) {
      this.makeBotMove(roomId, io, room, recordPlayerInput);
    }
  }

  getBot(roomId) {
    return this.activeBots.get(roomId);
  }
}

module.exports = { BotPlayer, BotManager };
