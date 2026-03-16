const pool = require('../backend/config/database');

async function addSampleProducts() {
    try {
        await pool.query(`
      INSERT INTO products (product_name, price) VALUES
      ('Chocolatín', 15.00),
      ('Galleta de avena', 10),
      ('Croissant', 7),
      ('Muffin', 12),
      ('Baguette', 5.00)
      ON CONFLICT (product_name) DO NOTHING
    `);

        console.log('✅ Sample products added!');

        const result = await pool.query('SELECT * FROM products');
        console.log('\nProducts in database:');
        result.rows.forEach(p => {
            console.log(`  ${p.product_id}. ${p.product_name} - $${p.price}`);
        });

        await pool.end();
    } catch (error) {
        console.error('Error adding products:', error);
    }
}

addSampleProducts();