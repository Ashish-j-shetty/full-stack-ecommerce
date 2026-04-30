-- Seed admin user (password: admin123)
-- bcrypt hash generated with 12 rounds
INSERT INTO users (username, email, password_hash, role)
VALUES ('admin', 'admin@store.com', '$2b$12$LJ3m4ys3Lk0TSwHCbsFbduNt0g/2GXcMODYAR2OI0.VPm.bJrFe2y', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Seed products
INSERT INTO products (name, description, price, image_url, stock, category) VALUES
  ('Wireless Headphones', 'High-quality over-ear wireless headphones with noise cancellation and 30-hour battery life.', 79.99, '/placeholder.png', 50, 'Electronics'),
  ('Bluetooth Speaker', 'Portable waterproof speaker with deep bass and 12-hour playtime.', 49.99, '/placeholder.png', 35, 'Electronics'),
  ('USB-C Hub', '7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader, and power delivery.', 34.99, '/placeholder.png', 100, 'Electronics'),
  ('Mechanical Keyboard', 'Full-size mechanical keyboard with RGB backlight and cherry MX switches.', 89.99, '/placeholder.png', 25, 'Electronics'),

  ('Classic Cotton T-Shirt', 'Comfortable 100% cotton crew neck t-shirt. Available in multiple colors.', 19.99, '/placeholder.png', 200, 'Clothing'),
  ('Denim Jacket', 'Vintage-style denim jacket with button closure and chest pockets.', 59.99, '/placeholder.png', 40, 'Clothing'),
  ('Running Shoes', 'Lightweight breathable running shoes with cushioned sole.', 74.99, '/placeholder.png', 60, 'Clothing'),
  ('Winter Beanie', 'Warm knitted beanie hat for cold weather. One size fits most.', 14.99, '/placeholder.png', 150, 'Clothing'),

  ('JavaScript: The Good Parts', 'A deep dive into the best features of JavaScript by Douglas Crockford.', 29.99, '/placeholder.png', 80, 'Books'),
  ('Clean Code', 'A handbook of agile software craftsmanship by Robert C. Martin.', 34.99, '/placeholder.png', 65, 'Books'),
  ('Design Patterns', 'Elements of reusable object-oriented software by Gang of Four.', 44.99, '/placeholder.png', 30, 'Books'),
  ('The Pragmatic Programmer', 'Your journey to mastery. Classic software engineering wisdom.', 39.99, '/placeholder.png', 45, 'Books'),

  ('Ceramic Coffee Mug', 'Handcrafted 12oz ceramic mug. Microwave and dishwasher safe.', 12.99, '/placeholder.png', 300, 'Home'),
  ('Desk Lamp', 'Adjustable LED desk lamp with 3 brightness levels and USB charging port.', 29.99, '/placeholder.png', 70, 'Home'),
  ('Plant Pot Set', 'Set of 3 minimalist ceramic plant pots in white, grey, and black.', 24.99, '/placeholder.png', 90, 'Home')
ON CONFLICT DO NOTHING;
 