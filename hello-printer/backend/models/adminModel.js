const { verifyPassword } = require('../utils/password');

async function verifyAdminCredentials(username, password) {
    try {
        const validUsername = process.env.ADMIN_USERNAME;
        const storedPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        if (!validUsername || !storedPasswordHash) {
            console.error('Admin credentials not configured in environment variables');
            return false;
        }

        if (username !== validUsername) {
            console.log('Invalid username attempt:', username);
            return false;
        }

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

function getAdminUsername() {
    return process.env.ADMIN_USERNAME || null;
}

module.exports = {
    verifyAdminCredentials,
    getAdminUsername
};
