import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => console.error('Redis Error:', err));

let connected = false;

export async function connectRedis() {
  if (!connected) {
    await client.connect();
    connected = true;
    console.log('✅ Redis connected');
  }
}

export async function getCache(key: string): Promise<string | null> {
  try {
    return await client.get(key);
  } catch (err) {
    console.error('Cache GET error:', err);
    return null;
  }
}

export async function setCache(key: string, value: string, ttlDays = 1): Promise<void> {
  try {
    const ttlSeconds = ttlDays * 24 * 60 * 60;
    await client.setEx(key, ttlSeconds, value);
    console.log(`✅ Cached: ${key} (${ttlDays}d TTL)`);
  } catch (err) {
    console.error('Cache SET error:', err);
  }
}

export async function getCacheStats() {
  try {
    const info = await client.info('stats');
    return info;
  } catch (err) {
    return 'Error getting stats';
  }
}