// ============================================
// ADMIN SETUP SCRIPT
// One-time script to generate admin password hash
// Run this to set up your admin credentials
// ============================================

const readline = require('readline');
const { hashPassword } = require('./utils/password');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Prompt user for input
function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer);
        });
    });
}

async function setupAdmin() {
    console.log('\n========================================');
    console.log('   ADMIN CREDENTIALS SETUP');
    console.log('========================================\n');

    try {
        // Get admin username
        const username = await question('Enter admin username (default: admin): ');
        const adminUsername = username.trim() || 'admin';

        // Get admin password
        const password = await question('Enter admin password: ');

        if (!password || password.length < 8) {
            console.log('\n❌ Error: Password must be at least 8 characters long');
            rl.close();
            return;
        }

        // Confirm password
        const confirmPassword = await question('Confirm admin password: ');

        if (password !== confirmPassword) {
            console.log('\n❌ Error: Passwords do not match');
            rl.close();
            return;
        }

        console.log('\n⏳ Generating password hash...\n');

        // Hash the password
        const passwordHash = await hashPassword(password);

        console.log('✅ Admin credentials generated successfully!\n');
        console.log('========================================');
        console.log('   ADD THESE TO YOUR .env FILE');
        console.log('========================================\n');
        console.log('ADMIN_USERNAME=' + adminUsername);
        console.log('ADMIN_PASSWORD_HASH=' + passwordHash);
        console.log('JWT_SECRET=' + generateRandomSecret());
        console.log('\n========================================\n');
        console.log('📝 Instructions:');
        console.log('1. Copy the lines above');
        console.log('2. Open backend/.env file');
        console.log('3. Paste these lines at the end');
        console.log('4. Save the file');
        console.log('5. Never commit .env to git!');
        console.log('\n========================================\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    } finally {
        rl.close();
    }
}

// Generate random secret for JWT
function generateRandomSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let secret = '';
    for (let i = 0; i < 64; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
}

// Run the setup
setupAdmin();