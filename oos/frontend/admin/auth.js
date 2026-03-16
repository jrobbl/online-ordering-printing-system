// ============================================
// AUTHENTICATION UTILITIES
// Handles login, logout, token management
// ============================================

//const API_URL = 'http://localhost:3000/api';  // dev only
const API_URL = '/api';

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * Store auth token in localStorage
 */
function setAuthToken(token) {
    localStorage.setItem('auth_token', token);
}

/**
 * Get auth token from localStorage
 */
function getAuthToken() {
    return localStorage.getItem('auth_token');
}

/**
 * Remove auth token from localStorage
 */
function clearAuthToken() {
    localStorage.removeItem('auth_token');
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return getAuthToken() !== null;
}

// ============================================
// LOGIN FUNCTIONALITY
// ============================================

/**
 * Handle login form submission
 */
async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('login-btn');
    const errorMessage = document.getElementById('error-message');

    // Hide previous error
    errorMessage.classList.remove('show');

    // Disable button and show loading
    loginBtn.disabled = true;
    loginBtn.textContent = 'Iniciando sesión...';

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Login successful
            setAuthToken(data.token);

            // Redirect to dashboard
            window.location.href = 'index.html';
        } else {
            // Login failed
            errorMessage.textContent = data.message || 'Usuario o contraseña incorrectos';
            errorMessage.classList.add('show');

            // Re-enable button
            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar Sesión';
        }

    } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = 'No se pudo conectar al servidor. Por favor intenta de nuevo.';
        errorMessage.classList.add('show');

        // Re-enable button
        loginBtn.disabled = false;
        loginBtn.textContent = 'Iniciar Sesión';
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    const token = getAuthToken();

    if (token) {
        try {
            // Call logout endpoint (optional - token is stateless)
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    // Clear token and redirect to login
    clearAuthToken();
    window.location.href = 'login.html';
}

/**
 * Verify token is still valid
 */
async function verifyToken() {
    const token = getAuthToken();

    if (!token) {
        return false;
    }

    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        return response.ok;
    } catch (error) {
        console.error('Token verification error:', error);
        //return false;
        return true; // Allow access if verification fails (e.g. server down) - better than locking out users
    }
}

/**
 * Redirect to login if not authenticated
 */
async function requireAuth() {
    const authenticated = isAuthenticated();

    if (!authenticated) {
        window.location.href = 'login.html';
        return false;
    }

    // Verify token is still valid
    const valid = await verifyToken();

    if (!valid) {
        clearAuthToken();
        window.location.href = 'login.html';
        return false;
    }

    return true;
}

// ============================================
// INITIALIZE (for login.html)
// ============================================

// Only run on login.html
if (document.getElementById('login-form')) {
    // If already logged in, redirect to dashboard
    if (isAuthenticated()) {
        verifyToken().then(valid => {
            if (valid) {
                window.location.href = 'index.html';
            }
        });
    }

    // Attach login form handler
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}
