import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { connectRedis, getCache, setCache, getCacheStats } from './cache';
import { queueAudit, getQueueStats } from './queue';
import { streamSSE } from 'hono/streaming';
import crypto from 'crypto';

const app = new Hono();

app.use('*', cors());

connectRedis();

// Rate limiting store (in-memory, simple)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(ip: string): { allowed: boolean; resetIn?: number } {
  const now = Date.now();
  const limit = rateLimits.get(ip);
  
  if (!limit || now > limit.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true };
  }
  
  if (limit.count >= RATE_LIMIT) {
    const resetIn = Math.ceil((limit.resetAt - now) / 1000 / 60); // minutes
    return { allowed: false, resetIn };
  }
  
  limit.count++;
  return { allowed: true };
}

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
      <p><a href="/audit?url=https://github.com&quick=true">Test GitHub.com (Quick Mode)</a></p>
      
      <h2>📖 API Documentation</h2>
      
      <h3>Basic Usage:</h3>
      <pre>GET /audit?url=https://example.com</pre>
      
      <h3>Quick Mode (Performance Only, Faster):</h3>
      <pre>GET /audit?url=https://example.com&quick=true</pre>
      
      <h3>Specific Categories:</h3>
      <pre>GET /audit?url=https://example.com&categories=performance,seo</pre>
      
      <h3>Available Categories:</h3>
      <ul>
        <li><code>performance</code> - Core Web Vitals & speed metrics</li>
        <li><code>accessibility</code> - A11y compliance</li>
        <li><code>best-practices</code> - Web best practices</li>
        <li><code>seo</code> - SEO optimization</li>
      </ul>
      
      <h3>Rate Limits:</h3>
      <p>10 audits per hour per IP address</p>
      
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
    
    // Validate URL
    try {
      new URL(url);
    } catch {
      return c.json({ error: 'Invalid URL format' }, 400);
    }
    
    // Check rate limit
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return c.json({ 
        error: 'Rate limit exceeded',
        message: `Try again in ${rateCheck.resetIn} minutes`,
        limit: RATE_LIMIT,
        window: '1 hour'
      }, 429);
    }
    
    // Parse quick mode
    const quick = c.req.query('quick') === 'true';
    
    // Parse categories
    const categoriesParam = c.req.query('categories');
    let categories: string[];
    
    if (quick) {
      categories = ['performance']; // Quick mode = performance only
    } else if (categoriesParam) {
      categories = categoriesParam.split(',').map(c => c.trim());
    } else {
      categories = ['performance', 'accessibility', 'best-practices', 'seo'];
    }
    
    // Validate categories
    const validCategories = ['performance', 'accessibility', 'best-practices', 'seo'];
    const invalidCats = categories.filter(c => !validCategories.includes(c));
    if (invalidCats.length > 0) {
      return c.json({ 
        error: 'Invalid categories',
        invalid: invalidCats,
        valid: validCategories
      }, 400);
    }
    
    // Create cache key
    const cacheKey = createCacheKey(url, categories);
    
    // Check cache - if cached, return immediately
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`💾 Cache HIT: ${url}`);
      return c.json({
        ...JSON.parse(cached),
        cached: true
      });
    }
    
    console.log(`🔍 Cache MISS: ${url}`);
    
    // Check queue size
    const queueStats = getQueueStats();
    if (queueStats.queuedRequests >= 10) {
      return c.json({
        error: 'Queue is full',
        message: 'Too many audits in progress. Try again in a few minutes.',
        queueSize: queueStats.queuedRequests,
        activeRequests: queueStats.activeRequests
      }, 503);
    }
    
    // Stream SSE for progress updates
    return streamSSE(c, async (stream) => {
      try {
        // Send initial status
        await stream.writeSSE({
          data: JSON.stringify({
            status: 'queued',
            position: queueStats.queuedRequests + 1,
            estimatedTime: `${(queueStats.queuedRequests + 1) * 30}s`
          })
        });
        
        // Send processing status
        await stream.writeSSE({
          data: JSON.stringify({
            status: 'processing',
            message: 'Launching Chrome and running Lighthouse audit...'
          })
        });
        
        // Run audit
        const result = await queueAudit({ url, categories });
        
        // Cache it
        await setCache(cacheKey, JSON.stringify(result), 1);
        
        // Send complete result
        await stream.writeSSE({
          data: JSON.stringify({
            status: 'complete',
            result: {
              ...result,
              cached: false
            }
          })
        });
        
      } catch (error) {
        await stream.writeSSE({
          data: JSON.stringify({
            status: 'error',
            error: error instanceof Error ? error.message : 'Audit failed'
          })
        });
      }
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
    rateLimit: {
      limit: RATE_LIMIT,
      window: '1 hour'
    },
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