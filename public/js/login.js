// ============================================
// LOGIN PAGE JAVASCRIPT
// ============================================

// DOM Elements
const googleBtn = document.getElementById('googleLoginBtn');
const loadingState = document.getElementById('loadingState');

/**
 * Check if already logged in
 */
async function checkExistingLogin() {
    if (!isLoggedIn()) return;

    try {
        const response = await fetch(`${CONFIG.API_URL}/api/auth/verify`, {
            headers: getAuthHeaders(),
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Already logged in, redirecting to dashboard...');
            window.location.href = '/dashboard';
        } else {
            // Token invalid, clear storage
            logout();
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        logout();
    }
}

/**
 * Initialize Google Sign-In
 */
function initializeGoogleSignIn() {
    if (typeof google === 'undefined') {
        console.error('Google Sign-In library not loaded');
        return;
    }

    google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback: handleGoogleLogin,
    });

    // Also render the One Tap prompt
    google.accounts.id.prompt();
}

/**
 * Handle Google Login Button Click
 */
googleBtn.addEventListener('click', () => {
    if (typeof google !== 'undefined') {
        google.accounts.id.prompt();
    } else {
        alert('Google Sign-In not loaded. Please refresh the page.');
    }
});

/**
 * Handle Google Login Callback
 */
async function handleGoogleLogin(response) {
    try {
        console.log('✅ Google authentication successful');
        
        // Show loading state
        googleBtn.style.display = 'none';
        loadingState.style.display = 'block';

        // Get ID token from Google
        const idToken = response.credential;

        // Send to backend
        const result = await fetch(`${CONFIG.API_URL}/api/auth/google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
        });

        const data = await result.json();

        if (!result.ok || !data.success) {
            throw new Error(data.message || 'Authentication failed');
        }

        console.log('✅ Backend authentication successful');
        
        // Store token and user info
        localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, data.token);
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(data.user));

        // Show success message
        document.querySelector('.preparing-text').textContent = `✅ Welcome, ${data.user.name}!`;
        document.querySelector('.preparing-text').style.color = '#10b981';

        // Redirect to dashboard after 1 second
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 1000);

    } catch (error) {
        console.error('❌ Login error:', error);
        
        // Show error
        loadingState.innerHTML = `
            <p style="color: #ef4444; font-size: 1.1rem; font-weight: 600;">
                ❌ Login failed. Please try again.
            </p>
        `;

        // Reset after 2 seconds
        setTimeout(() => {
            loadingState.style.display = 'none';
            loadingState.innerHTML = `
                <div class="spinner"></div>
                <p class="preparing-text">Preparing your kit...</p>
                <div class="cricket-ball-bounce">🏏</div>
            `;
            googleBtn.style.display = 'flex';
        }, 2000);
    }
}

// Make handleGoogleLogin available globally for Google's callback
window.handleGoogleLogin = handleGoogleLogin;

/**
 * Initialize on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏏 CPL Login page loaded');
    
    // Check if already logged in
    checkExistingLogin();
    
    // Initialize Google Sign-In when library is ready
    if (typeof google !== 'undefined') {
        initializeGoogleSignIn();
    } else {
        // Wait for Google library to load
        window.addEventListener('load', () => {
            setTimeout(initializeGoogleSignIn, 1000);
        });
    }
});
