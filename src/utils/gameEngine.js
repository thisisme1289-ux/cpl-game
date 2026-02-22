// ============================================
// GAME ENGINE - Cricket Logic
// ============================================

const { MATCH, BOT } = require('../config/game');

/**
 * Game Engine
 * 
 * Handles:
 * - Match state management
 * - Finger cricket rules
 * - Score calculation
 * - Over tracking
 * - Innings management
 */

class GameEngine {
  constructor(roomId, overs = MATCH.OVERS) {
    this.roomId = roomId;
    this.overs = overs;
    
    // Match state
    this.innings = 1;  // 1 or 2
    this.currentOver = 0;
    this.currentBall = 0;
    this.target = null;
    
    // Current innings stats
    this.runs = 0;
    this.wickets = 0;
    this.balls = 0;
    
    // Ball-by-ball tracking
    this.ballHistory = [];
    
    // Last 6 balls for display
    this.lastSixBalls = [];
    
    // Current players
    this.currentBatter = null;
    this.currentBowler = null;
    
    // Waiting for player inputs
    this.batterChoice = null;
    this.bowlerChoice = null;
  }

  /**
   * Start a new innings
   */
  startInnings(innings = 1) {
    this.innings = innings;
    this.currentOver = 0;
    this.currentBall = 0;
    this.runs = 0;
    this.wickets = 0;
    this.balls = 0;
    this.lastSixBalls = [];
    this.ballHistory = [];
  }

  /**
   * Set current players
   */
  setPlayers(batter, bowler) {
    this.currentBatter = batter;
    this.currentBowler = bowler;
  }

  /**
   * Submit a player's choice (finger)
   * 
   * @param {String} role - 'batter' or 'bowler'
   * @param {Number} choice - Finger choice (1-5)
   * @returns {Boolean} Are both choices submitted?
   */
  submitChoice(role, choice) {
    // Validate choice
    if (choice < MATCH.MIN_FINGER || choice > MATCH.MAX_FINGER) {
      throw new Error('Invalid finger choice');
    }

    // Store choice
    if (role === 'batter') {
      this.batterChoice = choice;
    } else if (role === 'bowler') {
      this.bowlerChoice = choice;
    } else {
      throw new Error('Invalid role');
    }

    // Check if both choices are in
    return this.batterChoice !== null && this.bowlerChoice !== null;
  }

  /**
   * Process the ball (after both choices submitted)
   * 
   * @returns {Object} Result of the ball
   */
  processBall() {
    if (this.batterChoice === null || this.bowlerChoice === null) {
      throw new Error('Both choices not submitted');
    }

    const batter = this.batterChoice;
    const bowler = this.bowlerChoice;

    // Determine result
    const isOut = batter === bowler;
    const runsScored = isOut ? 0 : batter;

    // Update stats
    this.balls++;
    this.currentBall++;

    if (isOut) {
      this.wickets++;
    } else {
      this.runs += runsScored;
    }

    // Track ball result
    const ballResult = {
      over: this.currentOver,
      ball: this.currentBall,
      batter: batter,
      bowler: bowler,
      isOut: isOut,
      runs: runsScored,
      timestamp: new Date(),
    };

    this.ballHistory.push(ballResult);

    // Update last 6 balls (for UI display)
    this.lastSixBalls.unshift(isOut ? 'W' : runsScored);
    if (this.lastSixBalls.length > 6) {
      this.lastSixBalls.pop();
    }

    // Check if over is complete
    if (this.currentBall === MATCH.BALLS_PER_OVER) {
      this.currentOver++;
      this.currentBall = 0;
    }

    // Reset choices
    this.batterChoice = null;
    this.bowlerChoice = null;

    return {
      batter,
      bowler,
      isOut,
      runs: runsScored,
      totalRuns: this.runs,
      wickets: this.wickets,
      balls: this.balls,
      over: this.currentOver,
      ball: this.currentBall,
      overComplete: this.currentBall === 0 && this.balls > 0,
    };
  }

  /**
   * Check if innings is complete
   * 
   * @returns {Boolean} Is innings over?
   */
  isInningsComplete() {
    // All wickets fallen
    if (this.wickets >= MATCH.MAX_WICKETS) {
      return true;
    }

    // All overs bowled
    if (this.currentOver >= this.overs) {
      return true;
    }

    // Chasing team reached target
    if (this.innings === 2 && this.target !== null && this.runs > this.target) {
      return true;
    }

    return false;
  }

  /**
   * Set target for second innings
   */
  setTarget(runs) {
    this.target = runs;
  }

  /**
   * Get current run rate
   */
  getCurrentRunRate() {
    const totalOvers = this.currentOver + (this.currentBall / MATCH.BALLS_PER_OVER);
    if (totalOvers === 0) return 0;
    return (this.runs / totalOvers).toFixed(2);
  }

  /**
   * Get required run rate (for second innings)
   */
  getRequiredRunRate() {
    if (this.innings !== 2 || this.target === null) return null;

    const ballsRemaining = (this.overs * MATCH.BALLS_PER_OVER) - this.balls;
    const oversRemaining = ballsRemaining / MATCH.BALLS_PER_OVER;
    
    if (oversRemaining === 0) return 0;

    const runsRequired = this.target - this.runs + 1;
    return (runsRequired / oversRemaining).toFixed(2);
  }

  /**
   * Get current state
   */
  getState() {
    return {
      innings: this.innings,
      runs: this.runs,
      wickets: this.wickets,
      balls: this.balls,
      currentOver: this.currentOver,
      currentBall: this.currentBall,
      target: this.target,
      currentRunRate: this.getCurrentRunRate(),
      requiredRunRate: this.getRequiredRunRate(),
      lastSixBalls: this.lastSixBalls,
      isComplete: this.isInningsComplete(),
    };
  }

  /**
   * Generate bot choice based on strategy
   * 
   * @param {String} strategy - 'aggressive', 'balanced', or 'defensive'
   * @returns {Number} Bot's finger choice (1-5)
   */
  static generateBotChoice(strategy = 'balanced') {
    const probabilities = BOT.STRATEGY[strategy.toUpperCase()] || BOT.STRATEGY.BALANCED;
    
    // Random selection based on probabilities
    const rand = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < probabilities.length; i++) {
      cumulative += probabilities[i];
      if (rand < cumulative) {
        return i + 1;  // Return 1-5
      }
    }
    
    return 3;  // Fallback to middle choice
  }

  /**
   * Get match result
   * 
   * @param {Number} firstInningsRuns - Runs from first innings
   * @param {Number} secondInningsRuns - Runs from second innings
   * @param {Number} secondInningsWickets - Wickets in second innings
   * @param {String} battingFirst - Which team batted first ('A' or 'B')
   * @returns {Object} Match result
   */
  static calculateMatchResult(firstInningsRuns, secondInningsRuns, secondInningsWickets, battingFirst) {
    const chasingTeam = battingFirst === 'A' ? 'B' : 'A';
    
    if (secondInningsRuns > firstInningsRuns) {
      // Chasing team won
      const wickets = MATCH.MAX_WICKETS - secondInningsWickets;
      return {
        winner: chasingTeam,
        result: `Team ${chasingTeam} won by ${wickets} wicket${wickets > 1 ? 's' : ''}`,
        margin: wickets,
        marginType: 'wickets',
      };
    } else if (firstInningsRuns > secondInningsRuns) {
      // Batting first team won
      const runs = firstInningsRuns - secondInningsRuns;
      return {
        winner: battingFirst,
        result: `Team ${battingFirst} won by ${runs} run${runs > 1 ? 's' : ''}`,
        margin: runs,
        marginType: 'runs',
      };
    } else {
      // Tie
      return {
        winner: 'tie',
        result: 'Match tied',
        margin: 0,
        marginType: 'tie',
      };
    }
  }
}

module.exports = GameEngine;
