# 03 - Database Design

## Why PostgreSQL?

PostgreSQL is a powerful, open-source relational database. "Relational" means data is organized in tables with rows and columns, and tables can reference each other through foreign keys.

## Our Schema (5 Tables)

### 1. `users`

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,           -- Auto-incrementing unique ID
  username VARCHAR(50) UNIQUE,     -- Must be unique
  email VARCHAR(255) UNIQUE,       -- Must be unique
  password_hash VARCHAR(255),      -- bcrypt hash, never plain text
  role VARCHAR(20) DEFAULT 'customer',  -- 'customer' or 'admin'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Key decisions:**

- `SERIAL PRIMARY KEY` — Auto-generates unique IDs. Every table has one
- `UNIQUE` on username and email — Postgres enforces no duplicates
- `password_hash` not `password` — We never store plain text passwords
- `role` with a CHECK constraint — Only allows 'customer' or 'admin'

### 2. `products`

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,       -- Product must have a name
  description TEXT,                 -- TEXT allows unlimited length
  price DECIMAL(10, 2) NOT NULL,    -- Up to 99,999,999.99
  stock INTEGER DEFAULT 0,          -- How many are available
  category VARCHAR(100),            -- For filtering
  image_url VARCHAR(500)
);
```

**Why `DECIMAL(10,2)` for price?** Floating point numbers (`FLOAT`) have precision issues: `0.1 + 0.2 = 0.30000000000000004`. `DECIMAL` stores exact values — essential for money.

### 3. `orders`

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),  -- Foreign key to users
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  shipping_address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. `order_items`

```sql
CREATE TABLE order_items (
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price_at_purchase DECIMAL(10, 2) NOT NULL  -- Price snapshot
);
```

**Why `price_at_purchase`?** This is critical. If you only store `product_id`, and the product's price changes later, all historical orders would show the wrong price. Snapshotting the price preserves the actual amount charged.

### 5. `cart_items`

```sql
CREATE TABLE cart_items (
  user_id INTEGER REFERENCES users(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER DEFAULT 1,
  UNIQUE(user_id, product_id)       -- One entry per product per user
);
```

**`UNIQUE(user_id, product_id)`** — This composite unique constraint prevents a user from having two separate cart entries for the same product. Instead, we update the quantity.

## Relationships

```
users ──< orders ──< order_items >── products
  │                                     │
  └──────< cart_items >─────────────────┘
```

- One user can have many orders (one-to-many)
- One order has many order items (one-to-many)
- Each order item references one product (many-to-one)
- One user can have many cart items (one-to-many)

## Foreign Keys

```sql
user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
```

`REFERENCES` creates a foreign key — it enforces that `user_id` must exist in the `users` table. You can't create an order for a non-existent user.

`ON DELETE CASCADE` means: if a user is deleted, their orders are automatically deleted too. For `order_items` → `products`, we use `ON DELETE RESTRICT` — you can't delete a product that has been ordered (preserve history).

## Indexes

```sql
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

An index is like a book's index — instead of reading every row (full table scan), the database can jump directly to matching rows. We add indexes on:

- Columns used in WHERE clauses (`category`, `user_id`)
- Columns used in JOINs (foreign keys)
- Columns used in ORDER BY

**Trade-off**: Indexes speed up reads but slightly slow down writes (the index must be updated). For read-heavy applications (like e-commerce), this trade-off is almost always worth it.

## Normalization

Our schema is in **Third Normal Form (3NF)**:

- No repeating groups (1NF)
- Every non-key column depends on the whole primary key (2NF)
- No transitive dependencies (3NF)

Example: We don't store the product name inside `order_items`. Instead, we store `product_id` and JOIN to get the name. This prevents inconsistency — if a product is renamed, the JOIN always returns the current name.

Exception: `price_at_purchase` in `order_items` intentionally denormalizes the price — because we need the historical value, not the current one.

## Migrations

Migrations are SQL files that evolve the database schema over time. Each file:

1. Has a numeric prefix for ordering (`001_`, `002_`, etc.)
2. Is idempotent (`CREATE TABLE IF NOT EXISTS`)
3. Is tracked in a `_migrations` table to avoid re-running

This ensures every developer (and every deployment) has the same database schema, applied in the same order.
