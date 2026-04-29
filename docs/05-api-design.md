# 05 - API Design

## What is a REST API?

REST (Representational State Transfer) is a set of conventions for designing web APIs. It uses HTTP methods and URLs to perform operations on resources.

## Resource Naming

Resources are nouns, not verbs:
- ✅ `GET /api/products` — Get all products
- ❌ `GET /api/getProducts` — Don't use verbs in URLs

URLs are plural and hierarchical:
- `/api/products` — Collection of products
- `/api/products/5` — Single product with ID 5
- `/api/orders/3/items` — Items belonging to order 3 (if we needed this)

## HTTP Methods

| Method | Purpose | Example | Response Code |
|--------|---------|---------|---------------|
| GET | Read data | `GET /api/products` | 200 OK |
| POST | Create new resource | `POST /api/cart` | 201 Created |
| PUT | Update existing resource | `PUT /api/cart/5` | 200 OK |
| DELETE | Remove resource | `DELETE /api/cart/5` | 200 OK |

## Our API Endpoints

### Auth
| Method | Endpoint | Description | Auth? |
|--------|----------|-------------|-------|
| POST | `/api/auth/register` | Create new user | No |
| POST | `/api/auth/login` | Login, get JWT | No |
| POST | `/api/auth/logout` | Clear JWT cookie | No |
| GET | `/api/auth/me` | Get current user | Yes |

### Products
| Method | Endpoint | Description | Auth? |
|--------|----------|-------------|-------|
| GET | `/api/products` | List products (paginated) | No |
| GET | `/api/products/categories` | Get category list | No |
| GET | `/api/products/:id` | Get single product | No |

### Cart
| Method | Endpoint | Description | Auth? |
|--------|----------|-------------|-------|
| GET | `/api/cart` | Get user's cart items | Yes |
| POST | `/api/cart` | Add item to cart (UPSERT — increments quantity if already in cart) | Yes |
| PUT | `/api/cart/:productId` | Update quantity (0 = remove) | Yes |
| DELETE | `/api/cart/:productId` | Remove from cart | Yes |

### Orders
| Method | Endpoint | Description | Auth? |
|--------|----------|-------------|-------|
| POST | `/api/orders` | Place order from cart | Yes |
| GET | `/api/orders` | Get user's orders (with item count) | Yes |
| GET | `/api/orders/:id` | Get order details (with items) | Yes |

**POST `/api/orders`** requires a `shippingAddress` object in the request body:
```json
{
  "shippingAddress": {
    "name": "Jane Smith",
    "address": "123 Main St",
    "city": "Portland",
    "zip": "97201"
  }
}
```

Order statuses: `pending` → `confirmed` → `shipped` → `delivered`. New orders start as `pending`.

### Admin
| Method | Endpoint | Description | Auth? |
|--------|----------|-------------|-------|
| POST | `/api/admin/products` | Create product | Admin |
| PUT | `/api/admin/products/:id` | Update product | Admin |
| DELETE | `/api/admin/products/:id` | Delete product | Admin |

## HTTP Status Codes

| Code | Meaning | When We Use It |
|------|---------|----------------|
| 200 | OK | Successful read, update, or delete |
| 201 | Created | Successfully created a new resource |
| 400 | Bad Request | Invalid input (missing fields, wrong format) |
| 401 | Unauthorized | Not logged in (no/invalid token) |
| 403 | Forbidden | Logged in but not allowed (not admin) |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate (username/email already taken) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

## Error Response Format

All errors return a consistent JSON structure:
```json
{
  "error": {
    "message": "Username already taken",
    "status": 409
  }
}
```

The frontend can always check `response.error.message` for a user-friendly error message.

## Pagination

List endpoints return paginated data:
```
GET /api/products?page=2&limit=12&category=Electronics&search=laptop
```

Response:
```json
{
  "data": [...],        // Array of products for this page
  "total": 45,          // Total matching products
  "page": 2,            // Current page
  "totalPages": 4       // Total pages
}
```

This prevents loading thousands of items at once.

## Parameterized Queries (SQL Injection Prevention)

### The Vulnerability
```javascript
// ❌ NEVER DO THIS — SQL injection
const query = `SELECT * FROM users WHERE username = '${username}'`;
```
If `username` is `' OR '1'='1`, the query becomes:
```sql
SELECT * FROM users WHERE username = '' OR '1'='1'
```
This returns ALL users. An attacker could read, modify, or delete your entire database.

### The Solution
```javascript
// ✅ ALWAYS use parameterized queries
const query = 'SELECT * FROM users WHERE username = $1';
const result = await pool.query(query, [username]);
```
The `$1` is a placeholder. The `pg` driver sends the value separately from the query — the database treats it as data, not SQL code. The value can NEVER be interpreted as SQL.

## Input Validation

Every API endpoint validates input before processing:

```typescript
if (!isNonEmptyString(username) || username.trim().length < 3) {
  throw new AppError('Username must be between 3 and 50 characters', 400);
}
```

Validation happens at the system boundary (where user input enters the server). Internal functions can trust that data has already been validated.

## CORS (Cross-Origin Resource Sharing)

Browsers block requests from one origin (e.g., `localhost:5173`) to another (e.g., `localhost:3001`) by default. CORS headers tell the browser: "It's okay, this server trusts requests from that origin."

```typescript
app.use(cors({
  origin: 'http://localhost:5173',  // Only allow our frontend
  credentials: true,                // Allow cookies to be sent
}));
```

In development, the Vite proxy avoids CORS entirely — but the CORS config is needed for production.

## Request Size Limits

The server limits JSON request bodies to 1MB:
```typescript
app.use(express.json({ limit: '1mb' }));
```

This prevents denial-of-service attacks where an attacker sends an enormous JSON payload to exhaust server memory. 1MB is well above any legitimate request our API handles (a shipping address object is a few hundred bytes).
 