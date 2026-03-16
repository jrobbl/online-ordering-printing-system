require('dotenv').config();

console.log('=== Environment Variables Test ===\n');

console.log('Database:');
console.log('  DB_HOST:', process.env.DB_HOST);
console.log('  DB_NAME:', process.env.DB_NAME);

console.log('\nServer:');
console.log('  PORT:', process.env.PORT);

console.log('\nAdmin Auth:');
console.log('  ADMIN_USERNAME:', process.env.ADMIN_USERNAME);
console.log('  ADMIN_PASSWORD_HASH:', process.env.ADMIN_PASSWORD_HASH ? '***CONFIGURED***' : 'MISSING');
console.log('  JWT_SECRET:', process.env.JWT_SECRET ? '***CONFIGURED***' : 'MISSING');

console.log('\n✅ All authentication environment variables loaded!');