// Test if variables are accessible
console.log('Database Configuration:');
console.log('  Host:', process.env.DB_HOST);
console.log('  Port:', process.env.DB_PORT);
console.log('  Database:', process.env.DB_NAME);
console.log('  User:', process.env.DB_USER);
console.log('  Password:', process.env.DB_PASSWORD ? '***hidden***' : 'NOT LOADED');
console.log('\nServer Configuration:');
console.log('  Port:', process.env.PORT);
console.log('  Environment:', process.env.NODE_ENV);
