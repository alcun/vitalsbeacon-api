# 🚨 VitalsBeacon API

**Lighthouse-as-a-Service** - Get Core Web Vitals and performance metrics for any website via a simple API.

## 🎯 What It Does

VitalsBeacon runs Google Lighthouse audits on any URL and returns performance metrics, accessibility scores, SEO analysis, and Core Web Vitals. It's like having Lighthouse in the cloud, accessible via HTTP.

## 🏗️ Current Architecture

**Stack:**
- **Runtime:** Bun (fast JavaScript runtime)
- **Framework:** Hono (lightweight web framework)
- **Engine:** Lighthouse + Chromium (headless Chrome)
- **Cache:** Redis (1 day TTL)
- **Queue:** In-memory queue system
- **Deployment:** Coolify (Docker) on VPS

**Pattern:** Follows the SiteLookerAtter pattern (clean separation of concerns)

```
src/
├── index.ts          # Main Hono app, routes, SSE streaming
├── cache.ts          # Redis caching (1 day TTL)
├── queue.ts          # Job queue (max 2 concurrent, max 10 queued)
├── lighthouse.ts     # Lighthouse audit logic (60s timeout)
└── types.ts          # TypeScript interfaces
```

**Deployment:**
- Domain: `api.vitalsbeacon.com`
- Shares Redis with SiteLookerAtter
- VPS: 185.151.31.175
- Managed via Coolify

## 🚀 Current Features

**Core Functionality:**
- ✅ Full Lighthouse audits (Performance, Accessibility, Best Practices, SEO)
- ✅ Quick mode (`?quick=true`) - Performance only, faster
- ✅ Core Web Vitals extraction (LCP, CLS, FCP, TBT, etc.)
- ✅ Redis caching (1 day) - instant responses for cached URLs
- ✅ SSE streaming - real-time progress updates
- ✅ Rate limiting - 10 audits/hour per IP
- ✅ Queue management - max 2 concurrent, max 10 queued
- ✅ 60s timeout protection
- ✅ Custom category selection

**API Endpoints:**
- `GET /audit?url=<url>` - Run full audit
- `GET /audit?url=<url>&quick=true` - Performance only
- `GET /audit?url=<url>&categories=performance,seo` - Custom categories
- `GET /health` - Health check
- `GET /status` - Queue and memory stats
- `GET /cache-stats` - Redis statistics
- `GET /` - API documentation (HTML)

**Resource Protection:**
- Rate limiting (10/hour per IP)
- Queue size limits (reject at 10)
- Timeout protection (60s)
- Concurrent request limits (2 max)
- Memory-efficient caching

## 📊 Current Limitations

- **No authentication** - Anyone can use it (protected by rate limits only)
- **No database** - All state in-memory (rate limits reset on restart)
- **No user accounts** - Can't track usage per user
- **No historical data** - Results not stored long-term
- **Single server** - No horizontal scaling
- **Shared Redis** - Uses same Redis as SiteLookerAtter

## 🔮 Future Plans

### **Phase 1: Production Hardening** (Next)
*Goal: Make it bullet-proof for public use*

- [ ] **Persistent rate limiting** - Use Redis for rate limits (survive restarts)
- [ ] **Better monitoring** - Add metrics, alerts, error tracking
- [ ] **Health checks** - Actually test Lighthouse on /health endpoint
- [ ] **Graceful degradation** - Better handling when resources low
- [ ] **Docker resource limits** - Prevent runaway memory usage

### **Phase 2: User Accounts & Auth** (Future)
*Goal: Track users, offer different tiers*

- [ ] **API keys** - Simple authentication
- [ ] **User database** - PostgreSQL for users, API keys, usage
- [ ] **Usage tracking** - Store audit history per user
- [ ] **Tiers** - Free (10/hour), Pro (100/hour), Enterprise (unlimited)
- [ ] **Dashboard** - Web UI to view usage, manage keys
- [ ] **Webhooks** - Callback URLs when audits complete

### **Phase 3: Advanced Features** (Future)
*Goal: Differentiate from competitors*

- [ ] **Scheduled audits** - Monitor sites over time
- [ ] **Comparison tools** - Before/after, competitor analysis
- [ ] **Custom thresholds** - Alerts when scores drop
- [ ] **Batch audits** - Audit multiple URLs in one request
- [ ] **Historical charts** - Track performance over time
- [ ] **Lighthouse CI integration** - Hook into CI/CD pipelines
- [ ] **Advanced caching** - Configurable TTL per user

### **Phase 4: Landing Page** (Soon)
*Goal: Market the API*

- [ ] **Landing page** at `vitalsbeacon.com` (Astro + Bun)
- [ ] **Live demo** - Try the API right on the page
- [ ] **Documentation** - Better docs, examples, SDKs
- [ ] **Pricing page** - When tiers exist
- [ ] **Blog** - SEO content about Core Web Vitals

### **Phase 5: Scale & Polish** (Future)
*Goal: Handle serious traffic*

- [ ] **Multiple workers** - Horizontal scaling
- [ ] **Load balancer** - Distribute requests
- [ ] **Separate Redis** - Dedicated Redis instance
- [ ] **CDN** - Cache responses at edge
- [ ] **Geographic distribution** - Run audits from multiple regions
- [ ] **Premium features** - Mobile audits, custom devices, screenshots

## 🎨 Design Philosophy

**Keep it simple:**
- Elegant API design (RESTful, predictable)
- Minimal dependencies
- Clear error messages
- Fast responses (cache + streaming)

**Keep it reliable:**
- Rate limiting protects resources
- Timeouts prevent hanging
- Queue prevents overload
- Graceful error handling

**Keep it clean:**
- Follow SiteLookerAtter pattern
- Separate concerns (cache, queue, audit)
- TypeScript for type safety
- Consistent code style

## 🔗 Related Projects

- **SiteLookerAtter** (`api.sitelookeratter.com`) - Screenshot service, same pattern
- **VitalsBeacon Landing** (planned) - Marketing site at `vitalsbeacon.com`

## 📝 Notes

- Built in parallel with SiteLookerAtter migration to Bun
- Learned from old janky Express version
- Designed to be monetizable later (but free to start)
- Authentication/database deferred until needed
- Focus on making it work well first, scale later

---

**Status:** ✅ **Live and working!**  
**URL:** https://api.vitalsbeacon.com  
**Version:** 2.0.0  
**Last Updated:** October 17, 2025