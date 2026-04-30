import { Router, Response, NextFunction } from "express";
import pool from "../config/db";
import { AuthRequest, AppError } from "../types";
import { authenticate } from "../middleware/auth";
import { isNonEmptyString } from "../middleware/validate";

const router = Router();

router.use(authenticate);

// POST /api/orders
router.post(
  "/",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { shippingAddress } = req.body;

      if (
        !shippingAddress ||
        !isNonEmptyString(shippingAddress.name) ||
        !isNonEmptyString(shippingAddress.address) ||
        !isNonEmptyString(shippingAddress.city) ||
        !isNonEmptyString(shippingAddress.zip)
      ) {
        throw new AppError(
          "Complete shipping address is required (name, address, city, zip)",
          400,
        );
      }

      await client.query("BEGIN");

      // Get cart items with product info
      const cartResult = await client.query(
        `SELECT ci.product_id, ci.quantity, p.price, p.stock, p.name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = $1`,
        [req.user!.id],
      );

      if (cartResult.rows.length === 0) {
        throw new AppError("Cart is empty", 400);
      }

      // Validate stock for all items
      for (const item of cartResult.rows) {
        if (item.stock < item.quantity) {
          throw new AppError(
            `Not enough stock for ${item.name}. Available: ${item.stock}`,
            400,
          );
        }
      }

      // Calculate total
      const total = cartResult.rows.reduce(
        (sum, item) => sum + parseFloat(item.price) * item.quantity,
        0,
      );

      const addressString = `${shippingAddress.name}, ${shippingAddress.address}, ${shippingAddress.city}, ${shippingAddress.zip}`;

      // Create order
      const orderResult = await client.query(
        "INSERT INTO orders (user_id, total, shipping_address) VALUES ($1, $2, $3) RETURNING *",
        [req.user!.id, total.toFixed(2), addressString],
      );
      const order = orderResult.rows[0];

      // Insert order items and decrement stock
      const orderItems = [];
      for (const item of cartResult.rows) {
        const itemResult = await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
         VALUES ($1, $2, $3, $4) RETURNING *`,
          [order.id, item.product_id, item.quantity, item.price],
        );
        orderItems.push({ ...itemResult.rows[0], name: item.name });

        await client.query(
          "UPDATE products SET stock = stock - $1 WHERE id = $2",
          [item.quantity, item.product_id],
        );
      }

      // Clear cart
      await client.query("DELETE FROM cart_items WHERE user_id = $1", [
        req.user!.id,
      ]);

      await client.query("COMMIT");

      res.status(201).json({
        order: { ...order, items: orderItems },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      next(err);
    } finally {
      client.release();
    }
  },
);

// GET /api/orders
router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      `SELECT o.*,
              COUNT(oi.id)::int AS item_count
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user!.id],
    );
    res.json({ orders: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
router.get(
  "/:id",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        throw new AppError("Invalid order ID", 400);
      }

      const orderResult = await pool.query(
        "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
        [orderId, req.user!.id],
      );
      if (orderResult.rows.length === 0) {
        throw new AppError("Order not found", 404);
      }

      const itemsResult = await pool.query(
        `SELECT oi.*, p.name, p.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
        [orderId],
      );

      res.json({
        order: { ...orderResult.rows[0], items: itemsResult.rows },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
