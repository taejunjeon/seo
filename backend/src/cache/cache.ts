import { createClient } from "redis";

import { env } from "../env";

type MemoryEntry = {
  json: string;
  expiresAtMs: number;
};

const memory = new Map<string, MemoryEntry>();

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;
let redisConnecting: Promise<RedisClient | null> | null = null;
let redisDisabledUntilMs = 0;

const buildKey = (key: string) => `${env.REDIS_PREFIX}${key}`;

const getRedisClient = async (): Promise<RedisClient | null> => {
  if (!env.REDIS_URL) return null;

  const now = Date.now();
  if (now < redisDisabledUntilMs) return null;
  if (redisClient) return redisClient;
  if (redisConnecting) return redisConnecting;

  const client = createClient({ url: env.REDIS_URL });
  redisConnecting = client
    .connect()
    .then(() => {
      redisClient = client;
      return client;
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[redis] connect failed:", error instanceof Error ? error.message : error);
      redisDisabledUntilMs = Date.now() + 30_000; // backoff to avoid log spam
      redisConnecting = null;
      try {
        client.disconnect();
      } catch {
        // ignore
      }
      return null;
    });

  return redisConnecting;
};

export const cacheGetJson = async <T>(key: string): Promise<T | null> => {
  const fullKey = buildKey(key);

  const redis = await getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(fullKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[cache] redis get failed:", error instanceof Error ? error.message : error);
      return null;
    }
  }

  const entry = memory.get(fullKey);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAtMs) {
    memory.delete(fullKey);
    return null;
  }
  try {
    return JSON.parse(entry.json) as T;
  } catch {
    memory.delete(fullKey);
    return null;
  }
};

export const cacheSetJson = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
  const fullKey = buildKey(key);
  const ttl = Math.max(1, Math.floor(ttlSeconds));
  const json = JSON.stringify(value);

  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.set(fullKey, json, { EX: ttl });
      return;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[cache] redis set failed:", error instanceof Error ? error.message : error);
      // fallthrough to memory cache
    }
  }

  memory.set(fullKey, { json, expiresAtMs: Date.now() + ttl * 1000 });
};

export const cacheDel = async (key: string): Promise<void> => {
  const fullKey = buildKey(key);
  memory.delete(fullKey);

  const redis = await getRedisClient();
  if (!redis) return;
  try {
    await redis.del(fullKey);
  } catch {
    // ignore
  }
};
