// ============================================
// ADMIN MODEL
// Handles admin authentication
// ============================================

const { verifyPassword } = require('../utils/password');

/**
 * Verify admin credentials
 * @param {string} username - The entered username
 * @param {string} password - The entered plain-text password
 * @returns {Promise<boolean>} True if credentials are valid, false otherwise
 */
async function verifyAdminCredentials(username, password) {
    try {
        // Get admin credentials from environment variables
        const validUsername = process.env.ADMIN_USERNAME;
        const storedPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        // Check if environment variables are set
        if (!validUsername || !storedPasswordHash) {
            console.error('Admin credentials not configured in environment variables');
            return false;
        }

        // Check username
        if (username !== validUsername) {
            console.log('Invalid username attempt:', username);
            return false;
        }

        // Verify password against stored hash
        const isPasswordValid = await verifyPassword(password, storedPasswordHash);

        if (isPasswordValid) {
            console.log('✅ Admin login successful:', username);
        } else {
            console.log('❌ Invalid password attempt for:', username);
        }

        return isPasswordValid;

    } catch (error) {
        console.error('Error verifying admin credentials:', error);
        return false;
    }
}

/**
 * Get admin username (for token payload)
 * @returns {string|null} Admin username or null if not configured
 */
function getAdminUsername() {
    return process.env.ADMIN_USERNAME || null;
}

// Export functions
module.exports = {
    verifyAdminCredentials,
    getAdminUsername
};