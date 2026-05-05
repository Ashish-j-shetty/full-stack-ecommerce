import { Router, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import pool from "../config/db";
import { AuthRequest, AppError } from "../types";
import {
  authenticate,
  generateToken,
  getCookieOptions,
} from "../middleware/auth";
import {
  isNonEmptyString,
  isValidEmail,
  sanitizeString,
} from "../middleware/validate";

const router: Router = Router();

// POST /api/auth/register
router.post(
  "/register",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { username, email, password } = req.body;

      if (
        !isNonEmptyString(username) ||
        username.trim().length < 3 ||
        username.trim().length > 50
      ) {
        throw new AppError("Username must be between 3 and 50 characters", 400);
      }
      if (!isNonEmptyString(email) || !isValidEmail(email)) {
        throw new AppError("Valid email is required", 400);
      }
      if (!isNonEmptyString(password) || password.length < 8) {
        throw new AppError("Password must be at least 8 characters", 400);
      }

      const sanitizedUsername = sanitizeString(username);
      const sanitizedEmail = email.trim().toLowerCase();

      // Check for existing user
      const existing = await pool.query(
        "SELECT id FROM users WHERE username = $1 OR email = $2",
        [sanitizedUsername, sanitizedEmail],
      );
      if (existing.rows.length > 0) {
        throw new AppError("Username or email already taken", 409);
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const result = await pool.query(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, role",
        [sanitizedUsername, sanitizedEmail, passwordHash],
      );

      const user = result.rows[0];
      const token = generateToken(user);

      res.cookie("token", token, getCookieOptions());
      res.status(201).json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/auth/login
router.post(
  "/login",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { username, password } = req.body;

      if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
        throw new AppError("Username and password are required", 400);
      }

      const result = await pool.query(
        "SELECT id, username, email, password_hash, role FROM users WHERE username = $1",
        [username.trim()],
      );
      if (result.rows.length === 0) {
        throw new AppError("Invalid credentials", 401);
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        throw new AppError("Invalid credentials", 401);
      }

      const token = generateToken(user);
      res.cookie("token", token, getCookieOptions());
      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/auth/logout
router.post("/logout", (_req: AuthRequest, res: Response) => {
  res.clearCookie("token", { path: "/" });
  res.json({ message: "Logged out successfully" });
});

// GET /api/auth/me
router.get(
  "/me",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        "SELECT id, username, email, role FROM users WHERE id = $1",
        [req.user!.id],
      );
      if (result.rows.length === 0) {
        throw new AppError("User not found", 404);
      }
      res.json({ user: result.rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
