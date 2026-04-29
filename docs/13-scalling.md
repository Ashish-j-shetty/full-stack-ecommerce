# 13 - Scaling for Production

## When Do You Need This?

You're fine without scaling if:
- You have fewer than ~500 concurrent users
- Your server CPU stays under 70%
- API response times are under 200ms

Consider scaling when:
- Response times are creeping up
- Database connections are maxing out (errors about pool exhaustion)
- CPU is consistently above 80%

## What's Already Prepared

This project has three scaling features **ready but disabled**. All scaling code is marked with `// [SCALING]` comments. Nothing changes until you explicitly enable them.

| Feature | What it does | How to enable |
|---------|-------------|---------------|
| **Redis Caching** | Caches product data in memory — avoids hitting the database for every request | Set `ENABLE_REDIS=true` + start Redis service |
| **Node.js Clustering** | Runs multiple server processes (one per CPU core) — multiplies throughput | Uncomment clustering block in `index.ts` |
| **Nginx Reverse Proxy** | Serves static files fast, compresses responses, proxies API calls | Uncomment Nginx service in `docker-compose.yml` |
| **Pool Tuning** | Adjusts how many database connections to keep open | Set `DB_POOL_MAX` env var |

---

## 1. Redis Caching

### What is Redis?

Redis is an in-memory data store. Think of it as a giant JavaScript `Map` that:
- Lives outside your Node.js process (shared between workers)
- Survives server restarts (optional persistence)
- Is incredibly fast (~0.1ms reads vs ~5ms for PostgreSQL)

### What Gets Cached?

| Endpoint | Cache Key | TTL | Why |
|----------|-----------|-----|-----|
| `GET /api/products` | `products:list:{page}:{limit}:{category}:{search}` | 5 min | Most visited page, data rarely changes |
| `GET /api/products/categories` | `products:categories` | 10 min | Almost never changes |
| `GET /api/products/:id` | `products:detail:{id}` | 5 min | Frequently viewed |

Cart and orders are **not cached** — they're user-specific and change with every action.

### Cache Invalidation

When an admin creates, updates, or deletes a product, all product caches (`products:*`) are cleared. This ensures users always see accurate data after changes.

### How It Works in Code

```
server/src/config/redis.ts     — Redis client + helper functions (getCache, setCache, clearCache)
server/src/routes/products.ts  — Calls getCache before DB, setCache after DB
server/src/routes/admin.ts     — Calls clearCache after product mutations
```

The helpers are **no-ops when Redis is disabled** — they return `null` / do nothing. So the code runs safely without Redis installed.

### How to Enable

**Step 1**: Install the Redis client library in the server:
```bash
cd server
npm install ioredis
npm install -D @types/ioredis
```

**Step 2**: Uncomment the Redis service in `docker-compose.yml`:
```yaml
redis:
  image: redis:7-alpine
  restart: unless-stopped
  ports:
    - "6379:6379"
  volumes:
    - redisdata:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 5s
    retries: 5
```

**Step 3**: Add environment variables to the server service in `docker-compose.yml`:
```yaml
environment:
  ENABLE_REDIS: "true"
  REDIS_URL: redis://redis:6379
```

**Step 4**: Add Redis to the server's `depends_on`:
```yaml
depends_on:
  postgres:
    condition: service_healthy
  redis:
    condition: service_healthy
```

**Step 5**: Uncomment `redisdata:` in the `volumes:` section.

**Step 6**: Rebuild and start:
```bash
docker compose up --build
```

You'll see `[INFO] Redis connected` in the server logs when it's working.

### Performance Impact

```
Without Redis:  GET /api/products → PostgreSQL query → ~5-15ms
With Redis:     GET /api/products → Redis cache hit  → ~0.5ms   (10-30x faster)
                                  → Redis cache miss → PostgreSQL → cache → ~6-16ms (first request only)
```

For 1000 users browsing products, ~90% of requests will be cache hits.

---

## 2. Node.js Clustering

### What is Clustering?

Node.js runs on a single CPU core by default. If your server has 4 cores, 75% of your CPU is wasted. Clustering forks multiple worker processes — one per core — each running its own copy of the server.

```
Without clustering (current):
  CPU Core 1: [Express Server]
  CPU Core 2: [idle]
  CPU Core 3: [idle]
  CPU Core 4: [idle]

With clustering (2 workers on a 2-core server):
  CPU Core 1: [Express Worker 1 — pool of 20]
  CPU Core 2: [Express Worker 2 — pool of 20]
```

### How to Enable

**Step 1**: Uncomment the imports at the top of `server/src/index.ts`:
```typescript
import cluster from 'cluster';
import os from 'os';
```

**Step 2**: Uncomment the clustering block at the bottom of `server/src/index.ts` and remove the standalone `start()` call:
```typescript
if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  logger.info(`Primary process ${process.pid} starting ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code) => {
    logger.warn(`Worker ${worker.process.pid} exited with code ${code}. Restarting...`);
    cluster.fork();
  });
} else {
  start();
}
```

**Step 3**: Consider reducing `DB_POOL_MAX` per worker so total connections stay under PostgreSQL's limit:
```
2 workers × 15 connections each = 30 total (well under PostgreSQL's 100 limit)
```

Set in `docker-compose.yml`:
```yaml
environment:
  DB_POOL_MAX: "15"
```

### When to Use

- Your server has 2+ CPU cores (most cloud servers do)
- CPU is the bottleneck (not database or network)
- You're not using clustering already (e.g., via PM2 or Kubernetes, which handle this for you)

**Don't use** if you're already running on Kubernetes with multiple pods — that's already horizontal scaling.

---

## 3. Nginx Reverse Proxy

### What is Nginx?

Nginx (pronounced "engine-x") is a high-performance web server and reverse proxy. In this project it sits between the browser and your Express server:

```
Current (without Nginx):
  Browser → Vite dev server (:5173) → serves React + proxies /api to Express (:3001)

With Nginx:
  Browser → Nginx (:80) → serves React static files directly
                        → proxies /api/* to Express (:3001)
```

### Why Use Nginx?

| Benefit | Explanation |
|---------|-------------|
| **Static file serving** | Nginx serves HTML/CSS/JS 10-50x faster than Node.js. It's purpose-built for this. |
| **Gzip compression** | Compresses responses by ~70% — pages load faster on slow connections |
| **Connection buffering** | Holds slow client connections so Node.js doesn't waste time waiting on them |
| **Single entry point** | Users access port 80 (standard HTTP) instead of remembering port numbers |
| **SSL/HTTPS** | Terminates HTTPS at Nginx — Express doesn't need to handle certificates |
| **Security** | Hides Express from direct internet access — only Nginx is exposed |

### Config File

The Nginx config lives at `nginx/nginx.conf`. It's heavily commented explaining every directive:

- `upstream api_server` — Defines where Express is running (`server:3001`)
- `location /` — Serves the React build, falls back to `index.html` for client-side routing
- `location /api/` — Proxies API requests to Express with proper headers
- Gzip and security headers are configured at the Nginx level
- SSL section is commented out with instructions for enabling HTTPS

### How to Enable

**Step 1**: Build the React app for production:
```bash
cd client
npm run build
```
This creates `client/dist/` with optimized static files.

**Step 2**: Uncomment the Nginx service in `docker-compose.yml`:
```yaml
nginx:
  image: nginx:alpine
  restart: unless-stopped
  ports:
    - "80:80"
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - ./client/dist:/usr/share/nginx/html:ro
  depends_on:
    - server
```

**Step 3**: Rebuild and start:
```bash
docker compose up --build
```

**Step 4**: Access the app at `http://localhost` (port 80) instead of `:5173`.

You can optionally stop the client (Vite) container since Nginx now serves the frontend:
```bash
docker compose stop client
```

### Enabling HTTPS

1. Get SSL certificates (e.g., [Let's Encrypt](https://letsencrypt.org/) with certbot)
2. Place `fullchain.pem` and `privkey.pem` in a `certs/` folder at the project root
3. Uncomment the SSL lines in `nginx/nginx.conf`
4. Add certificate volume mount in `docker-compose.yml`:
   ```yaml
   volumes:
     - ./certs:/etc/nginx/certs:ro
   ```
5. Change `listen 80` to `listen 443 ssl` in `nginx/nginx.conf`
6. Add the HTTP → HTTPS redirect server block (shown in the config file)

### When to Use

- **Development**: Not needed. Keep using Vite dev server for hot reload.
- **Staging / Demo**: Nice to have — gives a production-like setup.
- **Production**: Required. Never expose Express directly to the internet.

---

## 4. Connection Pool Tuning

### Current Setup

```typescript
// server/src/config/db.ts
max: parseInt(process.env.DB_POOL_MAX || '20', 10)
```

The pool size is now configurable via the `DB_POOL_MAX` environment variable. Default is still 20.

### Guidelines

| Setup | Recommended Pool Size |
|-------|----------------------|
| Single server (current) | 20 (default) |
| Single server + Redis | 15 (fewer queries reach the DB) |
| Clustered (2 workers) | 15 per worker (30 total) |
| Clustered (4 workers) | 10 per worker (40 total) |

**Rule of thumb**: Total connections across all workers should be 50-80% of PostgreSQL's `max_connections` (default 100).

### How to Change

Add to `docker-compose.yml` server environment:
```yaml
environment:
  DB_POOL_MAX: "15"
```

No code changes needed.

---

## Architecture: Before and After

### Current (works for ~500 users)
```
Browser
  → Vite dev server (port 5173) → serves React + proxies /api
    → Express (port 3001, single process, pool of 20)
      → PostgreSQL (port 5432)
```

### With Nginx (production-ready, ~1000 users)
```
Browser
  → Nginx (port 80) → serves React static files
                     → proxies /api to Express (port 3001)
                       → PostgreSQL (port 5432)
```

### Full scaling: Nginx + Redis + Clustering (~2000-3000 users)
```
Browser
  → Nginx (port 80/443)
    → /api → Express Worker 1 (pool of 15) ──→ PostgreSQL
           → Express Worker 2 (pool of 15) ──→ PostgreSQL
                ↕                    ↕
               Redis (shared cache)
    → /* → static files (served by Nginx directly)
```

---

## Quick Enable Checklist

```
Nginx:
□ Build React for production:   cd client && npm run build
□ Uncomment Nginx service in:   docker-compose.yml
□ Config file is ready at:      nginx/nginx.conf

Redis:
□ Install ioredis:              cd server && npm install ioredis @types/ioredis
□ Uncomment Redis service in:   docker-compose.yml
□ Add ENABLE_REDIS=true in:     docker-compose.yml server environment
□ Add REDIS_URL in:             docker-compose.yml server environment
□ Uncomment redisdata volume:   docker-compose.yml volumes section

Clustering:
□ Uncomment cluster imports:    server/src/index.ts (top)
□ Uncomment cluster block:      server/src/index.ts (bottom)
□ Remove standalone start():    server/src/index.ts (bottom)
□ Set DB_POOL_MAX=15:           docker-compose.yml server environment

Final:
□ Rebuild:                      docker compose up --build
```

## Finding All Scaling Code

Every scaling-related change is marked with `// [SCALING]`. To find them all:

```bash
grep -rn "\[SCALING\]" server/src/ docker-compose.yml nginx/
```
 