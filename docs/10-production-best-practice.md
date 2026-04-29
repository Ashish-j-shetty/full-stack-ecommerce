# 10 - Production Best Practices

## Security

### 1. Password Hashing (bcrypt)

Never store plain text passwords. bcrypt with cost factor 12 takes ~250ms per hash, making brute-force attacks impractical. See `docs/04-authentication.md` for details.

### 2. JWT in httpOnly Cookies

Tokens in httpOnly cookies can't be accessed by JavaScript (prevents XSS token theft). Combined with `SameSite: strict` (prevents CSRF) and `Secure: true` in production (HTTPS only).

Cookie configuration adapts to the environment:

- **Development**: `secure: false` (HTTP doesn't support Secure cookies)
- **Production**: `secure: true` (HTTPS only)
- **Both**: `httpOnly: true`, `sameSite: 'strict'`, `maxAge: 7 days`, `path: '/'`

The `path: '/'` ensures the cookie is sent on all routes, not just `/api/auth`. The 7-day `maxAge` matches the JWT expiry.

### 3. Parameterized SQL Queries

Always use `$1`, `$2` placeholders — never string interpolation. This makes SQL injection impossible. See `docs/05-api-design.md`.

### 4. Input Validation

Validate all user input at the API boundary: check types, lengths, formats. Sanitize strings (escape HTML characters) to prevent stored XSS.

### 5. Security Headers

```typescript
res.setHeader("X-Content-Type-Options", "nosniff"); // Prevent MIME sniffing
res.setHeader("X-Frame-Options", "DENY"); // Prevent clickjacking
res.setHeader("X-XSS-Protection", "0"); // Disable legacy XSS filter (see below)
res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
```

`X-XSS-Protection: 0` disables the browser's legacy XSS auditor, which had known vulnerabilities. Modern defense relies on input sanitization instead. See `docs/16-middleware-deep-dive.md` for full details.

### 6. Rate Limiting

Limit requests per IP to prevent brute-force and DoS attacks:

- Auth endpoints: 20 requests per 15 minutes (prevent password guessing)
- General API: 100 requests per 15 minutes

### 7. CORS

Only allow requests from our frontend's origin. Without CORS, any website could make API requests on behalf of logged-in users.

### 8. Role-Based Access Control

Admin routes check both `authenticate` (is logged in) and `requireAdmin` (has admin role). This is enforced at the middleware level — individual route handlers don't need to check.

## Performance

### 1. Database Connection Pooling

```typescript
const pool = new Pool({ max: 20 });
```

Instead of creating a new database connection for every request (expensive), we maintain a pool of reusable connections. A request borrows one, uses it, and returns it.

### 2. Database Indexes

Indexes on frequently queried columns (category, user_id, email) speed up reads from O(n) to O(log n). Our schema has indexes on all foreign keys and filter columns.

### 3. Pagination

Loading all products at once is wasteful. Pagination with `LIMIT`/`OFFSET` returns only what's needed per page.

### 4. Search Debouncing

The search input waits 300ms after the user stops typing before firing an API call. Without this, typing "laptop" would fire 6 API calls (l, la, lap, lapt, lapto, laptop).

## Reliability

### 1. Database Connection Retry

```
Attempt 1 → Failed (Postgres not ready)
Wait 2s
Attempt 2 → Failed
Wait 4s
Attempt 3 → Connected!
```

Exponential backoff (wait time doubles each attempt) is standard for retry logic. Without this, the server would crash if Postgres takes a few seconds to start.

### 2. Graceful Shutdown

When Docker sends SIGTERM (during `docker compose down`):

1. Stop accepting new connections
2. Finish processing in-flight requests
3. Close the database pool
4. Exit cleanly

Without this, in-flight requests would be severed mid-processing, potentially leaving the database in an inconsistent state.

### 3. Database Transactions

Order creation (insert order → insert items → update stock → clear cart) uses a transaction:

```sql
BEGIN;
  INSERT INTO orders ...
  INSERT INTO order_items ...
  UPDATE products SET stock = stock - quantity ...
  DELETE FROM cart_items ...
COMMIT;
```

If ANY step fails, `ROLLBACK` undoes ALL changes. Otherwise, you could end up with an order but no items, or decreased stock but no order.

### 4. Idempotent Migrations

Migrations use `CREATE TABLE IF NOT EXISTS` and track applied migrations in a table. Running migrations multiple times is safe — already-applied migrations are skipped.

## Code Quality

### 1. TypeScript Strict Mode

`strict: true` in tsconfig.json enables all strict checks:

- `strictNullChecks` — Must handle null/undefined explicitly
- `noImplicitAny` — Must type everything
- `strictFunctionTypes` — Stricter function type checking

### 2. Separation of Concerns

Each file has one job. Routes handle HTTP, middleware handles cross-cutting concerns, the database module handles connections, types are centralized.

### 3. Consistent Error Format

All API errors return `{ error: { message, status } }`. The frontend can always handle errors the same way.

### 4. Environment Configuration

Configuration (database URL, JWT secret, ports) comes from environment variables. The same code runs in development and production with different configs. Secrets never appear in source code.

Environment variables used by this project:

| Variable       | Purpose                                                     | Example                             |
| -------------- | ----------------------------------------------------------- | ----------------------------------- |
| `NODE_ENV`     | Controls dev/prod behavior (CORS, cookie security, logging) | `development`                       |
| `PORT`         | Server listen port                                          | `3001`                              |
| `DATABASE_URL` | PostgreSQL connection string                                | `postgres://user:pass@host:5432/db` |
| `JWT_SECRET`   | Secret key for signing JWTs                                 | (random string, never commit)       |
| `CLIENT_URL`   | Frontend URL for CORS in production                         | `https://myapp.com`                 |
| `DB_POOL_MAX`  | Max database connections in pool (default: 20)              | `20`                                |
| `REDIS_URL`    | Redis connection URL (scaling only)                         | `redis://redis:6379`                |

### 5. Logging

The logger suppresses debug output in production (`NODE_ENV=production`), preventing verbose logs from filling disk space. Info, warn, and error levels are always active. Error stack traces are logged server-side but never sent to clients.

## What a Production Deployment Would Add

Things we've simulated or omitted that a real production app would need:

| Area          | What We Have      | Production Would Add                                      |
| ------------- | ----------------- | --------------------------------------------------------- |
| Payment       | Mock checkout     | Stripe/PayPal integration                                 |
| Images        | URL references    | S3/Cloudinary upload + CDN                                |
| Email         | None              | Transactional emails (order confirmation)                 |
| HTTPS         | Not in Docker dev | SSL/TLS certificate (Let's Encrypt)                       |
| Logging       | Console logger    | Structured logging to a service (Datadog, CloudWatch)     |
| Monitoring    | None              | Health checks, uptime monitoring, error tracking (Sentry) |
| CI/CD         | None              | GitHub Actions → automated tests → deploy                 |
| Caching       | None              | Redis for sessions, product catalog caching               |
| Search        | SQL ILIKE         | Full-text search (PostgreSQL tsvector or Elasticsearch)   |
| Rate Limiting | In-memory         | Redis-backed (shared across server instances)             |
