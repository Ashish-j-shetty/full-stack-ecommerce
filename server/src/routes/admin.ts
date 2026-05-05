import { Router, Response, NextFunction } from "express";
import pool from "../config/db";
import { AuthRequest, AppError } from "../types";
import { authenticate, requireAdmin } from "../middleware/auth";
import { isNonEmptyString, isPositiveNumber } from "../middleware/validate";
// [SCALING] Redis cache invalidation — clearCache is a no-op when Redis is disabled
import { clearCache } from "../config/redis";

const router: Router = Router();

router.use(authenticate);
router.use(requireAdmin);

// POST /api/admin/products
router.post(
  "/products",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, description, price, image_url, stock, category } = req.body;

      if (!isNonEmptyString(name))
        throw new AppError("Product name is required", 400);
      if (!isPositiveNumber(price))
        throw new AppError("Price must be a positive number", 400);
      if (stock === undefined || !Number.isInteger(stock) || stock < 0) {
        throw new AppError("Stock must be a non-negative integer", 400);
      }

      const result = await pool.query(
        `INSERT INTO products (name, description, price, image_url, stock, category)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          name.trim(),
          description?.trim() || "",
          price,
          image_url?.trim() || "/placeholder.png",
          stock,
          category?.trim() || null,
        ],
      );

      // [SCALING] Clear product caches so users see the new product
      await clearCache("products:*");

      res.status(201).json({ product: result.rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/admin/products/:id
router.put(
  "/products/:id",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new AppError("Invalid product ID", 400);

      const { name, description, price, image_url, stock, category } = req.body;

      if (!isNonEmptyString(name))
        throw new AppError("Product name is required", 400);
      if (!isPositiveNumber(price))
        throw new AppError("Price must be a positive number", 400);
      if (stock === undefined || !Number.isInteger(stock) || stock < 0) {
        throw new AppError("Stock must be a non-negative integer", 400);
      }

      const result = await pool.query(
        `UPDATE products SET name = $1, description = $2, price = $3,
       image_url = $4, stock = $5, category = $6 WHERE id = $7 RETURNING *`,
        [
          name.trim(),
          description?.trim() || "",
          price,
          image_url?.trim() || "/placeholder.png",
          stock,
          category?.trim() || null,
          id,
        ],
      );

      if (result.rows.length === 0) {
        throw new AppError("Product not found", 404);
      }

      // [SCALING] Clear product caches so users see the updated product
      await clearCache("products:*");

      res.json({ product: result.rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/admin/products/:id
router.delete(
  "/products/:id",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new AppError("Invalid product ID", 400);

      const result = await pool.query(
        "DELETE FROM products WHERE id = $1 RETURNING id",
        [id],
      );
      if (result.rows.length === 0) {
        throw new AppError("Product not found", 404);
      }

      // [SCALING] Clear product caches so deleted product disappears
      await clearCache("products:*");

      res.json({ message: "Product deleted successfully" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
