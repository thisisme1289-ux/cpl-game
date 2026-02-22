// ============================================
// LEADERBOARD PAGE JAVASCRIPT
// ============================================

// Check authentication
if (!isLoggedIn()) {
    window.location.href = '/';
}

/**
 * Load leaderboard data
 */
async function loadLeaderboard() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/game/leaderboard`, {
            headers: getAuthHeaders(),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error('Failed to load leaderboard');
        }

        // Update podium (top 3)
        updatePodium(data.leaderboard);

        // Update rankings table (4-10 and beyond)
        updateRankingsTable(data.leaderboard);

        // Update stats summary
        updateStatsSummary(data);

    } catch (error) {
        console.error('❌ Failed to load leaderboard:', error);
        
        document.getElementById('rankingsBody').innerHTML = `
            <div class="loading-spinner">
                <p style="color: #ef4444;">Failed to load leaderboard. Please refresh the page.</p>
            </div>
        `;
    }
}

/**
 * Update podium (top 3 players)
 */
function updatePodium(leaderboard) {
    // Get top 3
    const top3 = leaderboard.slice(0, 3);

    // Update each podium position
    top3.forEach((player, index) => {
        const rank = index + 1;
        
        // Update avatar
        const avatar = document.getElementById(`avatar${rank}`);
        avatar.src = player.avatar || '/images/default-avatar.png';
        avatar.alt = player.name;

        // Update name
        document.getElementById(`name${rank}`).textContent = player.name;

        // Update stats
        document.getElementById(`points${rank}`).textContent = player.points || 0;
        document.getElementById(`wins${rank}`).textContent = player.stats?.gamesWon || 0;
    });

    // Hide podium positions if less than 3 players
    if (leaderboard.length < 2) {
        document.getElementById('rank2').style.display = 'none';
    }
    if (leaderboard.length < 3) {
        document.getElementById('rank3').style.display = 'none';
    }
}

/**
 * Update rankings table (4th place onwards)
 */
function updateRankingsTable(leaderboard) {
    const tbody = document.getElementById('rankingsBody');
    tbody.innerHTML = '';

    // Get current user
    const currentUser = getCurrentUser();

    // Show players from 4th place onwards
    const remainingPlayers = leaderboard.slice(3);

    if (remainingPlayers.length === 0) {
        tbody.innerHTML = '<p style="text-align: center; color: var(--text-grey); padding: 2rem;">No more players to display</p>';
        return;
    }

    remainingPlayers.forEach(player => {
        const row = document.createElement('div');
        row.className = 'table-row';

        // Highlight current user
        if (currentUser && player.id === currentUser.id) {
            row.classList.add('current-user');
        }

        row.innerHTML = `
            <div class="col-rank">#${player.rank}</div>
            <div class="col-player">
                <img src="${player.avatar || '/images/default-avatar.png'}" alt="${player.name}" class="player-avatar">
                <span class="player-name">${player.name}</span>
            </div>
            <div class="col-stat" data-label="Points">${player.points || 0}</div>
            <div class="col-stat" data-label="Games">${player.stats?.gamesPlayed || 0}</div>
            <div class="col-stat" data-label="Wins">${player.stats?.gamesWon || 0}</div>
            <div class="col-stat" data-label="Win%">${player.winRate || '0'}%</div>
        `;

        tbody.appendChild(row);
    });
}

/**
 * Update stats summary
 */
function updateStatsSummary(data) {
    document.getElementById('totalPlayers').textContent = data.totalPlayers || 0;

    // Calculate total games (rough estimate)
    const totalGames = data.leaderboard.reduce((sum, player) => {
        return sum + (player.stats?.gamesPlayed || 0);
    }, 0);
    document.getElementById('totalGames').textContent = Math.floor(totalGames / 2); // Divide by 2 since each game has 2 players

    // Show current user's rank
    if (data.currentUser) {
        document.getElementById('yourRank').textContent = `#${data.currentUser.rank}`;
    } else {
        document.getElementById('yourRank').textContent = '-';
    }
}

/**
 * Initialize page
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏆 Leaderboard loaded');
    loadLeaderboard();
});

/**
 * Refresh leaderboard every 30 seconds
 */
setInterval(() => {
    loadLeaderboard();
}, 30000);
