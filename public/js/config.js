// ============================================
// FRONTEND CONFIGURATION
// ============================================

const CONFIG = {
    // API URL - Change this when deploying
    API_URL: window.location.origin,
    
    // Google OAuth Client ID
    // IMPORTANT: Replace this with your actual Google Client ID
    GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com',
    
    // Socket.IO URL (same as API for simplicity)
    SOCKET_URL: window.location.origin,
    
    // Local Storage Keys
    STORAGE_KEYS: {
        TOKEN: 'cpl_token',
        USER: 'cpl_user',
    },
    
    // Game Settings
    GAME: {
        COUNTDOWN: 60,
        MAX_PLAYERS: 12,
    },
};

// Helper function to get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
    };
}

// Helper function to check if user is logged in
function isLoggedIn() {
    return !!localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
}

// Helper function to logout
function logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
    window.location.href = '/';
}

// Helper function to get current user
function getCurrentUser() {
    const userStr = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
    return userStr ? JSON.parse(userStr) : null;
}
