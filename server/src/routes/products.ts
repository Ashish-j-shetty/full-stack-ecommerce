import { Router, Request, Response, NextFunction } from "express";
import pool from "../config/db";
import { AppError } from "../types";
// [SCALING] Redis caching — helpers are no-ops when Redis is disabled, safe to import always
import { getCache, setCache } from "../config/redis";

const router = Router();

// GET /api/products
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit as string) || 12),
    );
    const offset = (page - 1) * limit;
    const category = req.query.category as string;
    const search = req.query.search as string;

    // [SCALING] Check Redis cache first — returns null when Redis is disabled
    const cacheKey = `products:list:${page}:${limit}:${category || ""}:${search || ""}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    let query = "SELECT * FROM products";
    let countQuery = "SELECT COUNT(*) FROM products";
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (category && category.trim()) {
      conditions.push(`category = $${params.length + 1}`);
      params.push(category.trim());
    }

    if (search && search.trim()) {
      conditions.push(
        `(name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`,
      );
      params.push(`%${search.trim()}%`);
    }

    if (conditions.length > 0) {
      const where = " WHERE " + conditions.join(" AND ");
      query += where;
      countQuery += where;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(query, [...params, limit, offset]);

    const response = {
      data: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };

    // [SCALING] Cache for 5 minutes — silently skipped when Redis is disabled
    await setCache(cacheKey, response, 300);

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/categories
router.get(
  "/categories",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // [SCALING] Check Redis cache first
      const cacheKey = "products:categories";
      const cached = await getCache(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const result = await pool.query(
        "SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category",
      );
      const response = { categories: result.rows.map((r) => r.category) };

      // [SCALING] Cache categories for 10 minutes (rarely change)
      await setCache(cacheKey, response, 600);

      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/products/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw new AppError("Invalid product ID", 400);
    }

    // [SCALING] Check Redis cache first
    const cacheKey = `products:detail:${id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const result = await pool.query("SELECT * FROM products WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0) {
      throw new AppError("Product not found", 404);
    }

    const response = { product: result.rows[0] };

    // [SCALING] Cache individual product for 5 minutes
    await setCache(cacheKey, response, 300);

    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
