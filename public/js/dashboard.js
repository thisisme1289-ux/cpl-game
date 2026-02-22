// ============================================
// DASHBOARD PAGE JAVASCRIPT
// ============================================

// Check authentication on page load
if (!isLoggedIn()) {
    window.location.href = '/';
}

// DOM Elements
const modeCards = document.querySelectorAll('.mode-card');
const joinModal = document.getElementById('joinModal');
const botModal = document.getElementById('botModal');
const createModal = document.getElementById('createModal');
const profileModal = document.getElementById('profileModal');
const profileNavBtn = document.getElementById('profileNavBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const confirmJoinBtn = document.getElementById('confirmJoin');
const cancelJoinBtn = document.getElementById('cancelJoin');
const cancelBotBtn = document.getElementById('cancelBot');
const confirmCreateBtn = document.getElementById('confirmCreate');
const cancelCreateBtn = document.getElementById('cancelCreate');
const difficultyBtns = document.querySelectorAll('.difficulty-btn');
const logoutBtn = document.getElementById('logoutBtn');
const closeProfileBtn = document.getElementById('closeProfile');

// User data
let currentUser = null;
let userStats = null;

/**
 * Load user data from API
 */
async function loadUserData() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/game/stats`, {
            headers: getAuthHeaders(),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error('Failed to load user data');
        }

        userStats = data.stats;
        currentUser = getCurrentUser();

        // Update UI
        updateUI();

    } catch (error) {
        console.error('❌ Failed to load user data:', error);
        // If auth failed, logout
        if (error.message.includes('401')) {
            logout();
        }
    }
}

/**
 * Update UI with user data
 */
function updateUI() {
    if (!userStats || !currentUser) return;

    // Profile section
    const nameParts = currentUser.name.split(' ');
    const initials = nameParts.map(n => n[0]).join('').toUpperCase().substring(0, 2);
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('playerName').textContent = currentUser.name;
    
    // Win rate badge
    const winRate = userStats.stats.gamesPlayed > 0 
        ? Math.round((userStats.stats.gamesWon / userStats.stats.gamesPlayed) * 100)
        : 0;
    document.getElementById('winRateText').textContent = `${winRate}%`;

    // Stats card
    document.getElementById('gamesPlayed').textContent = userStats.stats.gamesPlayed || 0;
    document.getElementById('wins').textContent = userStats.stats.gamesWon || 0;
    document.getElementById('losses').textContent = userStats.stats.gamesLost || 0;
    document.getElementById('totalRuns').textContent = userStats.stats.totalRuns || 0;

    // Profile modal
    document.getElementById('profileModalAvatar').src = currentUser.avatar || '';
    document.getElementById('profileModalName').textContent = currentUser.name;
    document.getElementById('profileModalEmail').textContent = currentUser.email;
}

/**
 * Profile modal handlers
 */
profileNavBtn.addEventListener('click', () => {
    profileModal.style.display = 'flex';
});

closeProfileBtn.addEventListener('click', () => {
    profileModal.style.display = 'none';
});

// Close modal when clicking outside
profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
        profileModal.style.display = 'none';
    }
});

/**
 * Logout handler
 */
logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        logout();
    }
});

/**
 * Mode card click handlers
 */
modeCards.forEach(card => {
    card.addEventListener('click', function() {
        const mode = this.dataset.mode;
        handleModeSelection(mode);
    });
});

/**
 * Handle mode selection
 */
function handleModeSelection(mode) {
    switch(mode) {
        case 'random':
            // Join random matchmaking
            joinRandomGame();
            break;
        case 'create':
            // Show create room modal
            createModal.style.display = 'flex';
            document.getElementById('roomName').focus();
            break;
        case 'join':
            // Show join modal
            joinModal.style.display = 'flex';
            roomCodeInput.focus();
            break;
        case 'bot':
            // Show bot difficulty modal
            botModal.style.display = 'flex';
            break;
    }
}

/**
 * Join random game
 */
async function joinRandomGame() {
    try {
        // Show loading
        showLoading('Finding opponents...');

        // Redirect to game page with random mode
        window.location.href = '/game?mode=random';

    } catch (error) {
        console.error('❌ Failed to join random game:', error);
        alert('Failed to join game. Please try again.');
    }
}

/**
 * Create room
 */
confirmCreateBtn.addEventListener('click', () => {
    const roomName = document.getElementById('roomName').value.trim();
    const maxPlayers = parseInt(document.getElementById('maxPlayers').value);
    const overs = parseInt(document.getElementById('overs').value);

    if (!roomName) {
        alert('Please enter a room name');
        return;
    }

    if (maxPlayers < 2 || maxPlayers > 12) {
        alert('Max players must be between 2 and 12');
        return;
    }

    if (overs < 1 || overs > 20) {
        alert('Overs must be between 1 and 20');
        return;
    }

    createModal.style.display = 'none';
    showLoading('Creating room...');
    window.location.href = `/game?mode=create&name=${encodeURIComponent(roomName)}&max=${maxPlayers}&overs=${overs}`;
});

cancelCreateBtn.addEventListener('click', () => {
    createModal.style.display = 'none';
    document.getElementById('roomName').value = '';
    document.getElementById('maxPlayers').value = '12';
    document.getElementById('overs').value = '5';
});

/**
 * Bot difficulty selection
 */
difficultyBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        const difficulty = this.dataset.difficulty;
        botModal.style.display = 'none';
        playWithBot(difficulty);
    });
});

cancelBotBtn.addEventListener('click', () => {
    botModal.style.display = 'none';
});

/**
 * Join room by code
 */
confirmJoinBtn.addEventListener('click', () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    
    if (code.length !== 6) {
        alert('Please enter a valid 6-character room code');
        return;
    }

    joinModal.style.display = 'none';
    window.location.href = `/game?mode=join&code=${code}`;
});

cancelJoinBtn.addEventListener('click', () => {
    joinModal.style.display = 'none';
    roomCodeInput.value = '';
});

// Allow Enter key to submit
roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        confirmJoinBtn.click();
    }
});

/**
 * Play with bot
 */
async function playWithBot(difficulty = 'medium') {
    try {
        showLoading(`Preparing ${difficulty} bot match...`);
        window.location.href = `/game?mode=bot&difficulty=${difficulty}`;
    } catch (error) {
        console.error('❌ Failed to start bot game:', error);
        alert('Failed to start bot game. Please try again.');
    }
}

/**
 * Show loading overlay
 */
function showLoading(message) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="glass-card" style="padding: 3rem; text-align: center; max-width: 400px;">
            <div class="spinner" style="margin: 0 auto 1.5rem;"></div>
            <p style="font-size: 1.2rem; color: var(--neon-cyan); font-weight: 600;">${message}</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

/**
 * Auto-capitalize room code input
 */
roomCodeInput.addEventListener('input', function() {
    this.value = this.value.toUpperCase();
});

/**
 * Initialize page
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏏 Dashboard loaded');
    loadUserData();
});

/**
 * Periodically refresh stats
 */
setInterval(() => {
    loadUserData();
}, 30000); // Refresh every 30 seconds
