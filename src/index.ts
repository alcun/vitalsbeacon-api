import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { connectRedis, getCache, setCache, getCacheStats } from './cache';
import { queueAudit, getQueueStats } from './queue';
import crypto from 'crypto';

const app = new Hono();

app.use('*', cors());

connectRedis();

function createCacheKey(url: string, categories: string[]): string {
  const urlHash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
  const catHash = categories.sort().join(',');
  return `audit:${urlHash}:${catHash}`;
}

app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy',
    service: 'VitalsBeacon',
    version: '2.0.0'
  });
});

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>VitalsBeacon API</title>
      <style>
        body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 0 20px; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
        code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
        a { color: #0066cc; }
      </style>
    </head>
    <body>
      <h1>🚨 VitalsBeacon - Core Web Vitals API</h1>
      <p>Lighthouse Performance Audits for Any Website</p>
      
      <h2>🚀 Quick Test</h2>
      <p><a href="/audit?url=https://google.com">Test Google.com</a></p>
      <p><a href="/audit?url=https://github.com">Test GitHub.com</a></p>
      
      <h2>📖 API Documentation</h2>
      
      <h3>Basic Usage:</h3>
      <pre>GET /audit?url=https://example.com</pre>
      
      <h3>Specific Categories:</h3>
      <pre>GET /audit?url=https://example.com&categories=performance,seo</pre>
      
      <h3>Available Categories:</h3>
      <ul>
        <li><code>performance</code> - Core Web Vitals & speed metrics</li>
        <li><code>accessibility</code> - A11y compliance</li>
        <li><code>best-practices</code> - Web best practices</li>
        <li><code>seo</code> - SEO optimization</li>
      </ul>
      
      <h3>Other Endpoints:</h3>
      <ul>
        <li><a href="/health">/health</a> - Service health check</li>
        <li><a href="/status">/status</a> - Queue & memory stats</li>
        <li><a href="/cache-stats">/cache-stats</a> - Redis cache info</li>
      </ul>
    </body>
    </html>
  `);
});

app.get('/audit', async (c) => {
  try {
    const url = c.req.query('url');
    if (!url) {
      return c.json({ error: 'URL parameter is required' }, 400);
    }
    
    try {
      new URL(url);
    } catch {
      return c.json({ error: 'Invalid URL format' }, 400);
    }
    
    const categoriesParam = c.req.query('categories');
    const categories = categoriesParam 
      ? categoriesParam.split(',').map(c => c.trim())
      : ['performance', 'accessibility', 'best-practices', 'seo'];
    
    const validCategories = ['performance', 'accessibility', 'best-practices', 'seo'];
    const invalidCats = categories.filter(c => !validCategories.includes(c));
    if (invalidCats.length > 0) {
      return c.json({ 
        error: 'Invalid categories',
        invalid: invalidCats,
        valid: validCategories
      }, 400);
    }
    
    const cacheKey = createCacheKey(url, categories);
    
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`💾 Cache HIT: ${url}`);
      return c.json({
        ...JSON.parse(cached),
        cached: true
      });
    }
    
    console.log(`🔍 Cache MISS: ${url}`);
    
    const result = await queueAudit({ url, categories });
    
    await setCache(cacheKey, JSON.stringify(result), 1);
    
    return c.json({
      ...result,
      cached: false
    });
    
  } catch (error) {
    console.error('Audit error:', error);
    return c.json({
      error: 'Failed to run audit',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/status', (c) => {
  const memUsage = process.memoryUsage();
  const queueStats = getQueueStats();
  
  return c.json({
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`
    },
    queue: queueStats,
    pid: process.pid
  });
});

app.get('/cache-stats', async (c) => {
  try {
    const stats = await getCacheStats();
    return c.text(stats);
  } catch (error) {
    return c.json({ error: 'Failed to get cache stats' }, 500);
  }
});

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down...');
  process.exit(0);
});

const port = parseInt(process.env.PORT || '3000');
console.log(`🚨 VitalsBeacon running on port ${port}`);

export default {
  port,
  fetch: app.fetch
};