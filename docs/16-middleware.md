# 16 - Middleware Deep Dive

## What is Middleware?

Middleware functions sit between the incoming HTTP request and your route handler. They run in the order they're registered and can:

- Modify the request or response
- End the request early (e.g., reject unauthorized users)
- Pass control to the next middleware with `next()`

```
Request → Security Headers → CORS → Cookie Parser → JSON Parser → Rate Limiter → Route Handler → Error Handler → Response
```

Our middleware stack (`app.ts`):

```typescript
app.use(securityHeaders);                            // 1. Set security headers
app.use(cors({ origin: ..., credentials: true }));   // 2. CORS
app.use(cookieParser());                             // 3. Parse cookies
app.use(express.json({ limit: '1mb' }));             // 4. Parse JSON body
app.use('/api/auth', rateLimiter(20, 15 * 60 * 1000));   // 5a. Auth rate limit
app.use('/api', rateLimiter(100, 15 * 60 * 1000));        // 5b. General rate limit
```

Order matters. Security headers go first so even error responses include them. The error handler goes last so it catches errors from all routes.

## Security Headers

```typescript
export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
}
```

Each header defends against a different attack:

| Header                   | Value                             | Prevents                                                                                                                                                                                                                           |
| ------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Content-Type-Options` | `nosniff`                         | **MIME sniffing** — browsers guessing file types. Without this, an uploaded `.txt` file containing HTML could be executed as a page                                                                                                |
| `X-Frame-Options`        | `DENY`                            | **Clickjacking** — embedding your site in an iframe on an attacker's page. User thinks they're clicking on the attacker's page but are actually clicking buttons on yours                                                          |
| `X-XSS-Protection`       | `0`                               | Set to `0` to **disable** the browser's built-in XSS filter. This is the modern recommendation — the old filter had bugs that actually _created_ XSS vulnerabilities. Proper output sanitization (which we do) is the real defense |
| `Referrer-Policy`        | `strict-origin-when-cross-origin` | Controls what URL info is sent in the `Referer` header. Same-origin requests get the full URL; cross-origin requests only get the origin (no path). Prevents leaking sensitive URL paths to third parties                          |

### Why `X-XSS-Protection: 0`?

This surprises many developers. The old `X-XSS-Protection: 1` told browsers to detect and block reflected XSS. But the detection had false positives and could be exploited:

- Attackers could use it to selectively disable legitimate scripts on a page
- The "block" mode could leak cross-origin data

Modern browsers (Chrome 78+) removed the XSS auditor entirely. Setting it to `0` explicitly disables it for older browsers, avoiding the known vulnerabilities. Your actual XSS defense should be input sanitization (our `sanitizeString()`) and proper output encoding.

## CORS Configuration

```typescript
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL
        : ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  }),
);
```

### Development vs Production

- **Development**: Accepts requests from both `localhost:5173` and `127.0.0.1:5173` (Vite's default dev server addresses). These are technically different origins.
- **Production**: Only accepts requests from the configured `CLIENT_URL` environment variable (your deployed frontend URL).

### Why `credentials: true`?

Our JWT is stored in an httpOnly cookie. Browsers only send cookies on cross-origin requests if:

1. The server responds with `Access-Control-Allow-Credentials: true`
2. The client explicitly sets `credentials: 'include'` on the fetch request

Without this, authentication would silently fail — requests would arrive at the server without the JWT cookie.

## JSON Body Parser

```typescript
app.use(express.json({ limit: "1mb" }));
```

This parses incoming `Content-Type: application/json` request bodies into `req.body`. The `limit: '1mb'` option is a security measure:

- Without a limit, an attacker could send a multi-gigabyte JSON payload
- The server would try to parse it, consuming CPU and memory
- This is a simple denial-of-service vector

1MB is generous for our API (the largest legitimate request is a shipping address object). Production APIs with file uploads would use multipart form data with its own size limits.

## Cookie Parser

```typescript
app.use(cookieParser());
```

Parses the `Cookie` header into `req.cookies` — an object where keys are cookie names:

```typescript
// Header: Cookie: token=eyJhbGci...; theme=dark
req.cookies.token; // "eyJhbGci..."
req.cookies.theme; // "dark"
```

Without this middleware, `req.cookies` would be undefined and our authentication middleware wouldn't be able to read the JWT.

## Rate Limiting

### How It Works

Our rate limiter uses an in-memory store (a `Map`) keyed by `IP:route`:

```typescript
const store = new Map<string, RateLimitEntry>();

// Each entry tracks:
interface RateLimitEntry {
  count: number; // Requests so far in this window
  resetTime: number; // When the window expires (Unix ms)
}
```

### The Algorithm

```
Request arrives from 192.168.1.1 to /api/auth
  ├── Key = "192.168.1.1:/api/auth"
  ├── No entry OR window expired?
  │     → Create entry: { count: 1, resetTime: now + 15min }
  │     → Allow request ✅
  └── Entry exists and within window?
        ├── Increment count
        ├── count ≤ 20? → Allow ✅
        └── count > 20? → Reject with 429 ❌
```

### Per-Endpoint Limits

```typescript
app.use("/api/auth", rateLimiter(20, 15 * 60 * 1000)); // 20 req/15min
app.use("/api", rateLimiter(100, 15 * 60 * 1000)); // 100 req/15min
```

Auth endpoints get a stricter limit because they're the target of brute-force attacks (password guessing). General API endpoints are more lenient since normal browsing can generate many requests.

**Middleware ordering matters here**: a request to `/api/auth/login` hits BOTH rate limiters. The auth limiter (`/api/auth`) runs first. If it passes, the general limiter (`/api`) also increments. This means auth requests consume from both budgets.

### IP Detection

```typescript
const ip = req.ip || req.socket.remoteAddress || "unknown";
```

This fallback chain handles different deployment configurations:

- `req.ip` — the standard Express property, respects `trust proxy` settings
- `req.socket.remoteAddress` — raw TCP connection IP (fallback)
- `'unknown'` — if both fail (shouldn't happen in practice, but prevents crashes)

Behind a reverse proxy (like Nginx), `req.ip` reads the `X-Forwarded-For` header — but only if Express is configured with `app.set('trust proxy', true)`. Without this, all users behind the proxy look like the same IP.

### Memory Cleanup

```typescript
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  },
  5 * 60 * 1000,
); // Every 5 minutes
```

Expired entries are cleaned up every 5 minutes to prevent unbounded memory growth. Without this, the Map would accumulate entries for every IP that ever made a request.

### In-Memory vs Redis-Backed

Our rate limiter stores counts in process memory. This is fine for a single server but has limitations:

|                         | In-Memory                  | Redis-Backed             |
| ----------------------- | -------------------------- | ------------------------ |
| Shared across instances | ❌ No                      | ✅ Yes                   |
| Survives server restart | ❌ No                      | ✅ Yes                   |
| Setup complexity        | None                       | Requires Redis           |
| Good for                | Development, single server | Production, multi-server |

With multiple server instances (behind a load balancer), each instance has its own Map — an attacker could spread requests across instances and exceed the limit. Redis-backed rate limiting is recommended for production (see `docs/13-scaling.md`).

## Authentication Middleware

```typescript
export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.token;

  if (!token) {
    next(new AppError("Authentication required", 401));
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      username: string;
      role: string;
    };
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
    };
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
}
```

This middleware is NOT applied globally — it's applied per-route or per-router:

```typescript
// Applied to all cart routes
router.use(authenticate);

// Applied to a single route
router.get('/me', authenticate, async (req, res, next) => { ... });
```

It reads the JWT from the `token` cookie, verifies it, and attaches the decoded user info to `req.user` so route handlers can use it.

## Cookie Configuration

```typescript
export function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true, // JavaScript can't read the cookie
    secure: isProduction, // HTTPS only in production
    sameSite: "strict" as const, // Only sent on same-site requests
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: "/", // Available on all paths
  };
}
```

| Option     | Dev Value | Prod Value | Why                                                       |
| ---------- | --------- | ---------- | --------------------------------------------------------- |
| `httpOnly` | `true`    | `true`     | Always prevent JavaScript access (XSS protection)         |
| `secure`   | `false`   | `true`     | Dev uses HTTP; prod requires HTTPS                        |
| `sameSite` | `strict`  | `strict`   | Cookie only sent on same-site requests (CSRF protection)  |
| `maxAge`   | 7 days    | 7 days     | Matches JWT expiry. User stays logged in for a week       |
| `path`     | `/`       | `/`        | Cookie available for all API routes, not just `/api/auth` |

### Why `secure: false` in Development?

The `Secure` flag means the cookie is only sent over HTTPS. Development uses HTTP (`http://localhost:3001`), so `Secure: true` would prevent the cookie from being sent at all — login would silently fail.

## Admin Authorization

```typescript
export function requireAdmin(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void {
  if (req.user?.role !== "admin") {
    next(new AppError("Admin access required", 403));
    return;
  }
  next();
}
```

Used in conjunction with `authenticate`, never alone:

```typescript
// Admin routes: must be logged in AND be admin
router.use(authenticate, requireAdmin);
```

`authenticate` runs first (sets `req.user`), then `requireAdmin` checks the role. If `requireAdmin` ran first, `req.user` wouldn't exist yet.

## Global Error Handler

```typescript
app.use(errorHandler); // Must be last middleware
```

This catches all errors thrown or passed via `next(err)` from any route. It's covered in detail in `docs/09-error-handling.md`, but the key point for middleware ordering: it MUST be the last `app.use()` call. Express only routes errors to four-argument middleware `(err, req, res, next)`, and it checks them in registration order.
