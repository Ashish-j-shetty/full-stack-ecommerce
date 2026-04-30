import { createApp } from "./app";
import { connectWithRetry } from "./config/db";
import { runMigrations } from "./config/migrate";
import pool from "./config/db";
import { logger } from "./utils/logger";
// [SCALING] Redis — initRedis is safe to call always; it's a no-op when ENABLE_REDIS is not set
import { initRedis, disconnectRedis } from "./config/redis";
// [SCALING] Clustering — uncomment the import below and the clustering block at the bottom
// import cluster from 'cluster';
// import os from 'os';

const PORT = parseInt(process.env.PORT || "3001", 10);

async function start() {
  try {
    await connectWithRetry();
    await runMigrations();
    // [SCALING] Initialize Redis connection (no-op if ENABLE_REDIS is not set)
    await initRedis();

    const app = createApp();
    const server = app.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      server.close(async () => {
        logger.info("HTTP server closed");
        await pool.end();
        logger.info("Database pool closed");
        // [SCALING] Disconnect Redis gracefully (no-op if Redis is disabled)
        await disconnectRedis();
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
}

// =============================================================================
// [SCALING] Node.js Clustering
// =============================================================================
// Uncomment the block below (and the cluster/os imports at the top) to run
// one worker per CPU core. Each worker runs its own event loop + connection pool.
// Only enable this when deploying to a multi-core server.
//
// if (cluster.isPrimary) {
//   const numCPUs = os.cpus().length;
//   logger.info(`Primary process ${process.pid} starting ${numCPUs} workers...`);
//
//   for (let i = 0; i < numCPUs; i++) {
//     cluster.fork();
//   }
//
//   cluster.on('exit', (worker, code) => {
//     logger.warn(`Worker ${worker.process.pid} exited with code ${code}. Restarting...`);
//     cluster.fork(); // auto-restart crashed workers
//   });
// } else {
//   start();
// }
// =============================================================================

start();
