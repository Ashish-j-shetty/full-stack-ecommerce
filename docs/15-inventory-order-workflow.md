# 15 - Inventory & Order Workflow

## The Problem

E-commerce has a tricky data integrity challenge: multiple users can add the same product to their carts, but there might only be 3 in stock. When orders are placed, we need to:

1. Verify stock is actually available (it may have changed since the user added it to their cart)
2. Decrement stock atomically (two users can't both claim the last item)
3. Snapshot the price (so historical orders show what was actually charged)
4. Clean up the cart after a successful order

All of this must happen as a single atomic operation — if any step fails, ALL changes roll back.

## Cart: The UPSERT Pattern

When a user adds a product to their cart, two things could happen:

- **New item**: insert a cart row
- **Already in cart**: increment the existing quantity

SQL has an elegant solution — `ON CONFLICT ... DO UPDATE` (also called UPSERT):

```sql
INSERT INTO cart_items (user_id, product_id, quantity)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, product_id)
DO UPDATE SET quantity = cart_items.quantity + $3
```

This works because `cart_items` has a unique constraint on `(user_id, product_id)`. If the pair already exists, instead of failing with a duplicate key error, it updates the existing row.

**Why not check first, then insert or update?**

```typescript
// ❌ Race condition!
const existing = await pool.query("SELECT * FROM cart_items WHERE ...");
if (existing.rows.length > 0) {
  await pool.query("UPDATE cart_items SET quantity = ...");
} else {
  await pool.query("INSERT INTO cart_items ...");
}
```

Between the SELECT and INSERT, another request could insert the same item — resulting in a duplicate key error. UPSERT is atomic: the database handles the check-and-write as one operation.

## Stock Validation

Stock is validated at two points:

### 1. When Adding to Cart

```typescript
const product = await pool.query(
  "SELECT id, stock FROM products WHERE id = $1",
  [productId],
);
if (product.rows.length === 0) {
  throw new AppError("Product not found", 404);
}
if (product.rows[0].stock < quantity) {
  throw new AppError("Not enough stock available", 400);
}
```

This gives immediate feedback: "Sorry, only 2 left." But it's a **soft check** — stock could change between adding to cart and placing the order.

### 2. When Placing an Order (inside the transaction)

```typescript
for (const item of cartResult.rows) {
  if (item.stock < item.quantity) {
    throw new AppError(
      `Not enough stock for ${item.name}. Available: ${item.stock}`,
      400,
    );
  }
}
```

This is the **hard check** — it happens inside a database transaction, so the stock numbers are accurate at the moment of order creation. If stock is insufficient, the entire transaction rolls back.

### When Updating Cart Quantity

```typescript
const product = await pool.query("SELECT stock FROM products WHERE id = $1", [
  productId,
]);
if (product.rows[0].stock < quantity) {
  throw new AppError("Not enough stock available", 400);
}
```

Setting quantity to 0 deletes the cart item instead of keeping a zero-quantity row.

## Order Creation: The Transaction

Order creation is the most complex operation in the app. Here's the full flow:

```
BEGIN Transaction
  ├── 1. Fetch cart items (with product details)
  ├── 2. Validate all items have stock
  ├── 3. Calculate total
  ├── 4. Create order record
  ├── 5. For each cart item:
  │     ├── Insert order_item (with price snapshot)
  │     └── Decrement product stock
  ├── 6. Clear the user's cart
  └── COMMIT
```

If anything fails at any step → `ROLLBACK` (undo everything).

### The Code

```typescript
const client = await pool.connect(); // Dedicated connection for this transaction
try {
  await client.query("BEGIN");

  // 1. Get cart items with product info
  const cartResult = await client.query(
    `SELECT ci.product_id, ci.quantity, p.price, p.stock, p.name
     FROM cart_items ci JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = $1`,
    [req.user.id],
  );

  if (cartResult.rows.length === 0) {
    throw new AppError("Cart is empty", 400);
  }

  // 2. Validate stock
  for (const item of cartResult.rows) {
    if (item.stock < item.quantity) {
      throw new AppError(
        `Not enough stock for ${item.name}. Available: ${item.stock}`,
        400,
      );
    }
  }

  // 3 & 4. Calculate total and create order
  const total = cartResult.rows.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0,
  );
  const orderResult = await client.query(
    "INSERT INTO orders (user_id, total, shipping_address) VALUES ($1, $2, $3) RETURNING *",
    [req.user.id, total.toFixed(2), addressString],
  );

  // 5. Insert items and decrement stock
  for (const item of cartResult.rows) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
       VALUES ($1, $2, $3, $4)`,
      [order.id, item.product_id, item.quantity, item.price],
    );
    await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [
      item.quantity,
      item.product_id,
    ]);
  }

  // 6. Clear cart
  await client.query("DELETE FROM cart_items WHERE user_id = $1", [
    req.user.id,
  ]);

  await client.query("COMMIT");
  res.status(201).json({ order: { ...order, items: orderItems } });
} catch (err) {
  await client.query("ROLLBACK");
  next(err);
} finally {
  client.release(); // ALWAYS return connection to pool
}
```

### Why `pool.connect()` Instead of `pool.query()`?

Normal queries use `pool.query()`, which borrows a connection, runs one query, and returns it. But a transaction needs multiple queries on the **same connection** (BEGIN, queries, COMMIT must all happen on one connection). So we get a dedicated connection with `pool.connect()` and must manually `release()` it.

The `finally` block ensures the connection is released even if an error occurs — without this, connections would leak and the pool would eventually run out.

## Price Snapshots

```sql
INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
                                                         ^^^^^^^^^^^^^^^^^
```

`price_at_purchase` captures the product's price **at the moment the order was placed**. This is critical because:

- Product prices change over time
- An order placed today at $29.99 must still show $29.99 in order history even if the price changes to $39.99 tomorrow
- Without this, changing a product's price would retroactively change all historical order totals

This is a common pattern called **event sourcing** or **historical snapshots** — you record the facts as they were, not as they currently are.

## Order Statuses

Orders have a status field with four possible values:

```typescript
type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered";
```

| Status      | Meaning                              |
| ----------- | ------------------------------------ |
| `pending`   | Order just placed, not yet processed |
| `confirmed` | Payment verified, being prepared     |
| `shipped`   | In transit to customer               |
| `delivered` | Customer received the order          |

New orders start as `pending` (the database default). In a full production app, status transitions would be managed by admin actions or external service webhooks (payment processor, shipping provider).

## Shipping Address

Orders require four shipping address fields:

| Field     | Type   | Example               |
| --------- | ------ | --------------------- |
| `name`    | string | "Jane Smith"          |
| `address` | string | "123 Main St, Apt 4B" |
| `city`    | string | "Portland"            |
| `zip`     | string | "97201"               |

These are validated individually (each must be a non-empty string) and stored as a concatenated string on the order record:

```typescript
const addressString = `${shippingAddress.name}, ${shippingAddress.address}, ${shippingAddress.city}, ${shippingAddress.zip}`;
```

## What Could Go Wrong Without Transactions?

Imagine the order steps run independently (no transaction):

```
1. ✅ Create order record
2. ✅ Insert first order_item, decrement stock
3. ❌ Second item out of stock → ERROR
```

Without a transaction, you'd have:

- An order with an incorrect total
- One item shipped, one missing
- Stock decremented for the first item but no way to fulfill the order

With a transaction: step 3 fails → `ROLLBACK` → steps 1 and 2 are undone. The database is exactly as it was before the attempt. The user sees a clear error message and can adjust their cart.
