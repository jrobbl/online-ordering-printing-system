-- Create products table
CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Pan dulce',
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

-- Insert products (prices are placeholders — update via SQL on the products table)
INSERT INTO products (product_name, price, category) VALUES
    -- Pan dulce
    ('Babka',                                   0.00, 'Pan dulce'),
    ('Bisquet',                                 0.00, 'Pan dulce'),
    ('Chocolatín',                              0.00, 'Pan dulce'),
    ('Chocolatín almendrado',                   0.00, 'Pan dulce'),
    ('Concha bicolor',                          0.00, 'Pan dulce'),
    ('Concha canela',                           0.00, 'Pan dulce'),
    ('Concha chocolate',                        0.00, 'Pan dulce'),
    ('Concha vainilla',                         0.00, 'Pan dulce'),
    ('Croissant',                               0.00, 'Pan dulce'),
    ('Croissant almendra',                      0.00, 'Pan dulce'),
    ('Flan parisién',                           0.00, 'Pan dulce'),
    ('Flor de limón',                           0.00, 'Pan dulce'),
    ('Galette blueberry',                       0.00, 'Pan dulce'),
    ('Galleta chocochips',                      0.00, 'Pan dulce'),
    ('Galleta chocochips vegana',               0.00, 'Pan dulce'),
    ('Galleta red velvet',                      0.00, 'Pan dulce'),
    ('Galleta vegana avena',                    0.00, 'Pan dulce'),
    ('Galleta vegana doble chocolate',          0.00, 'Pan dulce'),
    ('Kouign amann',                            0.00, 'Pan dulce'),
    ('Nido cheesecake maracuyá',                0.00, 'Pan dulce'),
    ('Nudo cardamomo',                          0.00, 'Pan dulce'),
    ('Orejita',                                 0.00, 'Pan dulce'),
    ('Panqué chocolate',                        0.00, 'Pan dulce'),
    ('Panqué elote',                            0.00, 'Pan dulce'),
    ('Panqué matcha',                           0.00, 'Pan dulce'),
    ('Panqué plátano',                          0.00, 'Pan dulce'),
    ('Rol canela vegano',                       0.00, 'Pan dulce'),
    ('Rol de cardamomo',                        0.00, 'Pan dulce'),
    ('Scone',                                   0.00, 'Pan dulce'),
    ('Trenza de pistache',                      0.00, 'Pan dulce'),
    -- Pan salado
    ('Baguette',                                0.00, 'Pan salado'),
    ('Campesino ajonjolí',                      0.00, 'Pan salado'),
    ('Campesino de caja ajonjolí (24h extra)',  0.00, 'Pan salado'),
    ('Campesino multigrano',                    0.00, 'Pan salado'),
    ('Ciabatta',                                0.00, 'Pan salado'),
    -- Pan y productos por pedido
    ('Bagel natural pza',                       0.00, 'Pan y productos por pedido'),
    ('Bagel semillas pza',                      0.00, 'Pan y productos por pedido'),
    ('Baguetin',                                0.00, 'Pan y productos por pedido'),
    ('Base tarta redonda',                      0.00, 'Pan y productos por pedido'),
    ('Bollo brioche hamburguesa',               0.00, 'Pan y productos por pedido'),
    ('Brioche de caja',                         0.00, 'Pan y productos por pedido'),
    ('Charola focaccia',                        0.00, 'Pan y productos por pedido'),
    ('Focaccia completa',                       0.00, 'Pan y productos por pedido'),
    ('1/2 Focaccia',                            0.00, 'Pan y productos por pedido'),
    ('Ganache blanco',                          0.00, 'Pan y productos por pedido'),
    ('Ganache blanco maracuyá',                 0.00, 'Pan y productos por pedido'),
    ('Ganache oscuro',                          0.00, 'Pan y productos por pedido'),
    ('Pan pita',                                0.00, 'Pan y productos por pedido'),
    ('Paq bagels naturales',                    0.00, 'Pan y productos por pedido'),
    ('Paq bagels parmesano',                    0.00, 'Pan y productos por pedido'),
    ('Paq bagels semillas',                     0.00, 'Pan y productos por pedido'),
    -- MINIs
    ('Croissant mini',                          0.00, 'MINIs'),
    ('Chocolatín mini',                         0.00, 'MINIs'),
    ('Concha mini',                             0.00, 'MINIs'),
    ('Galleta mini',                            0.00, 'MINIs'),
    ('Scone arándano y chocolate mini',         0.00, 'MINIs'),
    ('Bollo brioche mini',                      0.00, 'MINIs'),
    ('Ciabatta mini',                           0.00, 'MINIs'),
    ('Bagel mini',                              0.00, 'MINIs'),
    ('Baguetin mini',                           0.00, 'MINIs'),
    -- Congelados y abarrotes
    ('Higos al vino tinto',                     0.00, 'Congelados y abarrotes'),
    ('Hummus',                                  0.00, 'Congelados y abarrotes'),
    ('Mermelada de frambuesa',                  0.00, 'Congelados y abarrotes'),
    ('Mermelada de higo',                       0.00, 'Congelados y abarrotes'),
    ('Pesto',                                   0.00, 'Congelados y abarrotes'),
    ('Tortillas harina chipotle',               0.00, 'Congelados y abarrotes'),
    ('Tortillas harina integrales',             0.00, 'Congelados y abarrotes'),
    ('Tortillas harina mantequilla',            0.00, 'Congelados y abarrotes'),
    ('Tzatziki',                                0.00, 'Congelados y abarrotes'),
    ('Salsa macha',                             0.00, 'Congelados y abarrotes')
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