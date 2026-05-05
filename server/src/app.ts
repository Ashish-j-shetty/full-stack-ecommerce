import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { securityHeaders } from "./middleware/securityHeaders";
import { rateLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";
import cartRoutes from "./routes/cart";
import orderRoutes from "./routes/orders";
import adminRoutes from "./routes/admin";

export function createApp(): express.Express {
  const app = express();

  // Middleware
  app.use(securityHeaders);
  app.use(
    cors({
      origin:
        process.env.NODE_ENV === "production"
          ? process.env.CLIENT_URL
          : ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  // Rate limiting (higher limits in development to avoid issues with hot-reload)
  const isDev = process.env.NODE_ENV !== "production";
  app.use("/api/auth", rateLimiter(isDev ? 100 : 20, 15 * 60 * 1000));
  app.use("/api", rateLimiter(isDev ? 1000 : 100, 15 * 60 * 1000));

  // Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/admin", adminRoutes);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
