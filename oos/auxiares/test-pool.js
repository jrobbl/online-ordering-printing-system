const pool = require('../backend/config/database');

async function testPool() {
  try {
    // Test query
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');

    console.log('\n✅ Pool connection successful!');
    console.log('   Current time:', result.rows[0].current_time);
    console.log('   PostgreSQL version:', result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]);

    // Test your actual tables
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n📋 Available tables:');
    tableCheck.rows.forEach(row => {
      console.log('   -', row.table_name);
    });

    // Close pool
    await pool.end();
    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Pool test failed:');
    console.error('   Error:', error.message);
    process.exit(1);
  }
}

testPool();
