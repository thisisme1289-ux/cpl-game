// ============================================
// HELPER UTILITY FUNCTIONS
// ============================================

/**
 * Generate a random room code
 * Format: ABC123 (6 characters)
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
}

/**
 * Generate a random player ID
 */
function generatePlayerId() {
  return `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Shuffle array (Fisher-Yates algorithm)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * Format duration in seconds to readable string
 * Example: 125 => "2m 5s"
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  return `${minutes}m ${secs}s`;
}

/**
 * Calculate win percentage
 */
function calculateWinRate(won, total) {
  if (total === 0) return 0;
  return ((won / total) * 100).toFixed(2);
}

/**
 * Sleep function (for delays)
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get random element from array
 */
function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Clamp number between min and max
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Deep clone object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 */
function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

/**
 * Sanitize string (remove special characters)
 */
function sanitize(str) {
  return str.replace(/[^a-zA-Z0-9 ]/g, '').trim();
}

/**
 * Truncate string
 */
function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Format number with commas
 * Example: 1234567 => "1,234,567"
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Get time ago string
 * Example: "5 minutes ago", "2 hours ago"
 */
function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }
  
  return 'just now';
}

/**
 * Validate email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate random number between min and max (inclusive)
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
      await sleep(delay);
    }
  }
}

module.exports = {
  generateRoomCode,
  generatePlayerId,
  shuffleArray,
  formatDuration,
  calculateWinRate,
  sleep,
  randomElement,
  clamp,
  deepClone,
  isEmpty,
  sanitize,
  truncate,
  formatNumber,
  timeAgo,
  isValidEmail,
  randomInt,
  retryWithBackoff,
};
