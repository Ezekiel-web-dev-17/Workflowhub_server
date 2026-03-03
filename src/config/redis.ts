import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 2000);
    logger.warn(`Redis reconnecting... attempt ${times}`);
    return delay;
  },
});

// ─── Connection Events ────────────────────────────────
redis.on("connect", () => {
  logger.info("🔴 Redis connected successfully");
});

redis.on("error", (error: Error) => {
  logger.error("❌ Redis connection error:", error.message);
});

redis.on("close", () => {
  logger.warn("🔴 Redis connection closed");
});

// ─── Helper Methods ───────────────────────────────────

/**
 * Set a value in Redis with an optional TTL (in seconds).
 */
export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  const serialized = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

/**
 * Get a value from Redis and parse it as JSON.
 * Returns null if the key doesn't exist.
 */
export async function getCache<T = unknown>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (!data) return null;
  return JSON.parse(data) as T;
}

/**
 * Delete one or more keys from Redis.
 */
export async function deleteCache(...keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  return redis.del(...keys);
}

/**
 * Check if a key exists in Redis.
 */
export async function existsInCache(key: string): Promise<boolean> {
  const result = await redis.exists(key);
  return result === 1;
}

/**
 * Disconnect from Redis gracefully.
 */
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  logger.info("🔴 Redis disconnected");
}

export default redis;
