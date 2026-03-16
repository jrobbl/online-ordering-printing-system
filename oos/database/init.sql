-- Create products table
CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_branch VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL
);

-- Insert products (prices are demo placeholders — all $15.00)
INSERT INTO products (product_name, price) VALUES
    ('Croissant natural',                15.00),
    ('Croissant almendrado',             15.00),
    ('Chocolatín',                       15.00),
    ('Chocolatín almendrado',            15.00),
    ('Flor de limón',                    15.00),
    ('Concha de chocolate',              15.00),
    ('Concha vainilla',                  15.00),
    ('Concha bicolor',                   15.00),
    ('Concha chocolate',                 15.00),
    ('Bisquet',                          15.00),
    ('Concha vainilla VEGANA',           15.00),
    ('Chocolatín VEGANO',                15.00),
    ('Croissant VEGANO',                 15.00),
    ('Rol de canela VEGANO',             15.00),
    ('KA',                               15.00),
    ('Nido Cheesecake',                  15.00),
    ('Orejita',                          15.00),
    ('Scone',                            15.00),
    ('Scone mini',                       15.00),
    ('Babka chocolate',                  15.00),
    ('Trenza Pistache',                  15.00),
    ('Rol de cardamono',                 15.00),
    ('Panqué marmoleado chocolate',      15.00),
    ('Panqué de matcha',                 15.00),
    ('Panqué de plátano',                15.00),
    ('Panqué de elote',                  15.00),
    ('Galleta vegana avena',             15.00),
    ('Galleta vegana doble chocolate',   15.00),
    ('Bollo de hamburguesa',             15.00),
    ('Brioche de caja',                  15.00),
    ('Bagel natural',                    15.00),
    ('Baguette',                         15.00),
    ('Campesino redondo ajonjolí',       15.00),
    ('Campesino ajonjolí',               15.00),
    ('Campesino multigrano',             15.00)
ON CONFLICT DO NOTHING;

-- Create print_jobs table
CREATE TABLE IF NOT EXISTS print_jobs (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    copy_type   VARCHAR(10) NOT NULL CHECK (copy_type IN ('customer', 'store')),
    status      VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    printed_at  TIMESTAMP DEFAULT NULL
);