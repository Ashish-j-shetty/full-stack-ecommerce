// =============================================================================
// [SCALING] Redis Cache Configuration
// =============================================================================
// This module provides caching helpers backed by Redis.
// By default, caching is DISABLED. All helper functions are safe to call —
// they silently return null / do nothing when Redis is not enabled.
//
// To enable:
//   1. Install ioredis: npm install ioredis
//   2. Set ENABLE_REDIS=true in your environment / docker-compose.yml
//   3. Ensure a Redis service is running (see docker-compose.yml)
// =============================================================================

import { logger } from "../utils/logger";

// --- Types ---
// Using 'any' here because ioredis is only installed when caching is enabled.
// When you install ioredis, you can replace 'any' with the proper type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisClient: any = null;

// --- Initialization ---
// Only connect to Redis if ENABLE_REDIS is set
async function initRedis(): Promise<void> {
  if (process.env.ENABLE_REDIS !== "true") {
    logger.debug("Redis caching is disabled (set ENABLE_REDIS=true to enable)");
    return;
  }

  try {
    // Dynamic import — ioredis is only loaded when caching is enabled,
    // so the app works without it installed when caching is off.
    const Redis = (await import("ioredis" as string)).default;

    const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) return null; // stop retrying after 3 attempts
        return Math.min(times * 200, 2000);
      },
    });

    redisClient.on("connect", () => logger.info("Redis connected"));
    redisClient.on("error", (err: Error) => logger.error("Redis error", err));
  } catch (err) {
    logger.warn("Redis initialization failed — caching disabled", err);
    redisClient = null;
  }
}

// --- Cache Helpers ---

/**
 * Get a cached value by key. Returns null if not cached or Redis is disabled.
 */
async function getCache<T>(key: string): Promise<T | null> {
  if (!redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.warn(`Cache get failed for key: ${key}`, err);
    return null;
  }
}

/**
 * Set a cached value with a TTL (time-to-live) in seconds.
 * Does nothing if Redis is disabled.
 */
async function setCache(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (!redisClient) return;
  try {
    await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn(`Cache set failed for key: ${key}`, err);
  }
}

/**
 * Clear all cached keys matching a pattern (e.g., "products:*").
 * Does nothing if Redis is disabled.
 */
async function clearCache(pattern: string): Promise<void> {
  if (!redisClient) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      logger.debug(`Cache cleared: ${keys.length} keys matching "${pattern}"`);
    }
  } catch (err) {
    logger.warn(`Cache clear failed for pattern: ${pattern}`, err);
  }
}

/**
 * Disconnect Redis gracefully. Safe to call even when Redis is disabled.
 */
async function disconnectRedis(): Promise<void> {
  if (!redisClient) return;
  try {
    await redisClient.quit();
    logger.info("Redis disconnected");
  } catch (err) {
    logger.warn("Redis disconnect failed", err);
  }
}

export { initRedis, getCache, setCache, clearCache, disconnectRedis };
