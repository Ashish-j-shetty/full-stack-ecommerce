# 14 - Validation & Input Sanitization

## Why Validate?

User input is the #1 attack vector for web applications. Every piece of data from the client — request body, URL parameters, query strings — could be malicious, malformed, or just accidental. Validation is the gatekeeper that stops bad data before it reaches your database.

Without validation:

- A user could register with an empty username
- An attacker could inject `<script>` tags into product names (stored XSS)
- A cart could accept negative quantities (free items!)
- An order could be placed with no shipping address

## Where to Validate

Validate at the **system boundary** — the point where external data enters your server. In our app, that's the route handlers:

```
Client → [HTTP Request] → Route Handler (VALIDATE HERE) → Database
```

Internal functions do NOT need to re-validate. If `createOrder()` is only called from a route handler that already validated the data, it can trust its inputs.

## Our Validation Helpers

All validation helpers live in `server/src/middleware/validate.ts`. Each one does ONE thing:

### `isNonEmptyString(value)`

Checks if a value is a string AND not empty/whitespace-only:

```typescript
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
```

The `value is string` return type is a TypeScript **type guard** — after calling this, TypeScript knows the value is a string:

```typescript
if (isNonEmptyString(username)) {
  // TypeScript now knows: username is string (not unknown)
  console.log(username.toUpperCase()); // ✅ No error
}
```

### `isValidEmail(email)`

Basic email format check using a regex:

```typescript
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

This checks for the pattern `something@something.something`. It's deliberately simple — fully RFC-compliant email validation is surprisingly complex. For most apps, this catches obvious mistakes while real verification happens via confirmation email.

### `isPositiveNumber(value)` and `isPositiveInteger(value)`

```typescript
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && value > 0 && isFinite(value);
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
```

- `isPositiveNumber` — for prices (decimals OK)
- `isPositiveInteger` — for quantities and IDs (must be whole numbers)
- Both reject `NaN` and `Infinity` (which are technically "numbers" in JavaScript)

### `sanitizeString(value)`

Escapes HTML special characters to prevent stored XSS:

```typescript
export function sanitizeString(value: string): string {
  return value
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
```

Before sanitization: `<script>alert('hacked')</script>`
After sanitization: `&lt;script&gt;alert(&#x27;hacked&#x27;)&lt;/script&gt;`

The browser renders the escaped text as visible characters, not as executable HTML. This is applied to user-controlled strings before they're stored (like usernames):

```typescript
const sanitizedUsername = sanitizeString(username);
```

### `validateRequired(fields, requiredFields)`

Batch-validate that multiple fields exist and aren't empty:

```typescript
export function validateRequired(
  fields: Record<string, unknown>,
  requiredFields: string[],
): void {
  for (const field of requiredFields) {
    if (!isNonEmptyString(fields[field]) && !isPositiveNumber(fields[field])) {
      throw new AppError(`${field} is required`, 400);
    }
  }
}
```

This throws immediately on the first missing field, giving a specific error message.

## Validation in Practice

### Registration — Multi-field validation

```typescript
// Check type + length
if (
  !isNonEmptyString(username) ||
  username.trim().length < 3 ||
  username.trim().length > 50
) {
  throw new AppError("Username must be between 3 and 50 characters", 400);
}
// Check format
if (!isNonEmptyString(email) || !isValidEmail(email)) {
  throw new AppError("Valid email is required", 400);
}
// Check minimum length
if (!isNonEmptyString(password) || password.length < 8) {
  throw new AppError("Password must be at least 8 characters", 400);
}
// Sanitize before storing
const sanitizedUsername = sanitizeString(username);
const sanitizedEmail = email.trim().toLowerCase();
```

Note: password is NOT sanitized — you don't want to alter what the user chose as their password before hashing it.

### Cart — Type coercion defense

```typescript
if (!productId || !Number.isInteger(productId)) {
  throw new AppError("Valid product ID is required", 400);
}
if (!Number.isInteger(quantity) || quantity < 1) {
  throw new AppError("Quantity must be a positive integer", 400);
}
```

JSON.parse turns `"quantity": 3` into the number `3`, but `"quantity": "3"` stays a string. We check for integers to catch both missing values and string values.

### URL Parameters — Always parse

```typescript
const productId = parseInt(req.params.productId);
if (isNaN(productId)) {
  throw new AppError("Invalid product ID", 400);
}
```

URL parameters are always strings (`req.params.id` is `"5"`, not `5`). Always `parseInt()` and check for `NaN`.

### Orders — Nested object validation

```typescript
if (
  !shippingAddress ||
  !isNonEmptyString(shippingAddress.name) ||
  !isNonEmptyString(shippingAddress.address) ||
  !isNonEmptyString(shippingAddress.city) ||
  !isNonEmptyString(shippingAddress.zip)
) {
  throw new AppError(
    "Complete shipping address is required (name, address, city, zip)",
    400,
  );
}
```

The order endpoint validates nested objects — checking both that the parent object exists AND that each required field within it is valid.

## The Validation Pattern

Every route handler follows the same pattern:

```typescript
router.post("/endpoint", async (req, res, next) => {
  try {
    // 1. Extract input
    const { field1, field2 } = req.body;

    // 2. Validate (throw AppError if invalid)
    if (!isNonEmptyString(field1)) {
      throw new AppError("field1 is required", 400);
    }

    // 3. Sanitize (if stored/displayed)
    const clean = sanitizeString(field1);

    // 4. Process (database operations, etc.)
    const result = await pool.query("INSERT INTO ...", [clean]);

    // 5. Respond
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err); // Global error handler formats the response
  }
});
```

Validation errors are thrown as `AppError` with status 400, which the global error handler catches and returns as a consistent JSON error response.
