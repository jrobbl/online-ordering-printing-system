const readline = require('readline');
const { hashPassword } = require('./utils/password');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer);
        });
    });
}

function generateRandomSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let secret = '';
    for (let i = 0; i < 64; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
}

async function setupAdmin() {
    console.log('\n========================================');
    console.log('   HELLO PRINTER — ADMIN SETUP');
    console.log('========================================\n');

    try {
        const username = await question('Enter admin username (default: admin): ');
        const adminUsername = username.trim() || 'admin';

        const password = await question('Enter admin password: ');

        if (!password || password.length < 8) {
            console.log('\n❌ Error: Password must be at least 8 characters');
            rl.close();
            return;
        }

        const confirmPassword = await question('Confirm admin password: ');

        if (password !== confirmPassword) {
            console.log('\n❌ Error: Passwords do not match');
            rl.close();
            return;
        }

        console.log('\n⏳ Generating password hash...\n');

        const passwordHash = await hashPassword(password);

        console.log('✅ Done!\n');
        console.log('========================================');
        console.log('   COPY THESE INTO YOUR .env FILE');
        console.log('========================================\n');
        console.log('ADMIN_USERNAME=' + adminUsername);
        console.log('ADMIN_PASSWORD_HASH=' + passwordHash);
        console.log('JWT_SECRET=' + generateRandomSecret());
        console.log('\n========================================\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        rl.close();
    }
}

setupAdmin();
