// ============================================
// PASSWORD UTILITIES
// Uses bcrypt for secure password hashing
// ============================================

const bcrypt = require('bcrypt');

// Number of salt rounds for bcrypt
// Higher = more secure but slower
// 10 is the recommended balance
const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password
 * @param {string} plainPassword - The password to hash
 * @returns {Promise<string>} The hashed password
 */
async function hashPassword(plainPassword) {
    try {
        const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
        return hash;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw new Error('Password hashing failed');
    }
}

/**
 * Verify a plain-text password against a hash
 * @param {string} plainPassword - The password to verify
 * @param {string} hashedPassword - The hash to compare against
 * @returns {Promise<boolean>} True if password matches, false otherwise
 */
async function verifyPassword(plainPassword, hashedPassword) {
    try {
        const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
        return isMatch;
    } catch (error) {
        console.error('Error verifying password:', error);
        throw new Error('Password verification failed');
    }
}

// Export functions
module.exports = {
    hashPassword,
    verifyPassword
};