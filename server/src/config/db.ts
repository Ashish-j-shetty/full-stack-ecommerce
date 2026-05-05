import { Pool } from "pg";
import { logger } from "../utils/logger";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  // [SCALING] Pool size is configurable via DB_POOL_MAX env var.
  // Default is 20. For production with clustering (2 workers), consider 30 per worker.
  // Total connections across all workers should stay under PostgreSQL's max_connections (default 100).
  max: parseInt(process.env.DB_POOL_MAX || "20", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  logger.error("Unexpected error on idle database client", err);
});

export async function connectWithRetry(maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      logger.info("Database connected successfully");
      return;
    } catch (err) {
      logger.warn(
        `Database connection attempt ${attempt}/${maxRetries} failed`,
      );
      if (attempt === maxRetries) {
        logger.error("Could not connect to database after max retries", err);
        throw err;
      }
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export default pool;
