import { Router, Response, NextFunction } from "express";
import pool from "../config/db";
import { AuthRequest, AppError } from "../types";
import { authenticate } from "../middleware/auth";

const router = Router();

// All cart routes require authentication
router.use(authenticate);

// GET /api/cart
router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      `SELECT ci.id, ci.product_id, ci.quantity,
              p.name, p.price, p.image_url, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = $1
       ORDER BY ci.id`,
      [req.user!.id],
    );
    res.json({ items: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/cart
router.post(
  "/",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { productId, quantity = 1 } = req.body;

      if (!productId || !Number.isInteger(productId)) {
        throw new AppError("Valid product ID is required", 400);
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new AppError("Quantity must be a positive integer", 400);
      }

      // Check product exists and has stock
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

      // UPSERT: add or increment
      await pool.query(
        `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + $3`,
        [req.user!.id, productId, quantity],
      );

      // Return updated cart
      const result = await pool.query(
        `SELECT ci.id, ci.product_id, ci.quantity,
              p.name, p.price, p.image_url, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = $1
       ORDER BY ci.id`,
        [req.user!.id],
      );

      res.status(201).json({ items: result.rows });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/cart/:productId
router.put(
  "/:productId",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const productId = parseInt(req.params.productId);
      const { quantity } = req.body;

      if (isNaN(productId)) {
        throw new AppError("Invalid product ID", 400);
      }
      if (!Number.isInteger(quantity) || quantity < 0) {
        throw new AppError("Quantity must be a non-negative integer", 400);
      }

      if (quantity === 0) {
        await pool.query(
          "DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2",
          [req.user!.id, productId],
        );
      } else {
        // Check stock
        const product = await pool.query(
          "SELECT stock FROM products WHERE id = $1",
          [productId],
        );
        if (product.rows.length === 0) {
          throw new AppError("Product not found", 404);
        }
        if (product.rows[0].stock < quantity) {
          throw new AppError("Not enough stock available", 400);
        }

        const result = await pool.query(
          "UPDATE cart_items SET quantity = $1 WHERE user_id = $2 AND product_id = $3",
          [quantity, req.user!.id, productId],
        );
        if (result.rowCount === 0) {
          throw new AppError("Item not found in cart", 404);
        }
      }

      // Return updated cart
      const cartResult = await pool.query(
        `SELECT ci.id, ci.product_id, ci.quantity,
              p.name, p.price, p.image_url, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = $1
       ORDER BY ci.id`,
        [req.user!.id],
      );

      res.json({ items: cartResult.rows });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/cart/:productId
router.delete(
  "/:productId",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const productId = parseInt(req.params.productId);
      if (isNaN(productId)) {
        throw new AppError("Invalid product ID", 400);
      }

      const result = await pool.query(
        "DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2",
        [req.user!.id, productId],
      );
      if (result.rowCount === 0) {
        throw new AppError("Item not found in cart", 404);
      }

      res.json({ message: "Item removed from cart" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
