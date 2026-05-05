import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, AppError } from "../types";

const JWT_SECRET = (() => {
  const val = process.env.JWT_SECRET;
  if (!val) throw new Error("JWT_SECRET environment variable is required");
  return val;
})();

export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.token;

  if (!token) {
    next(new AppError("Authentication required", 401));
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      username: string;
      role: "customer" | "admin";
    };
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
    };
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
}

export function requireAdmin(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void {
  if (req.user?.role !== "admin") {
    next(new AppError("Admin access required", 403));
    return;
  }
  next();
}

export function generateToken(user: {
  id: number;
  username: string;
  role: string;
}): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  };
}
