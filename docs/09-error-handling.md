# 09 - Error Handling

## Why Error Handling Matters

Errors are inevitable — network failures, invalid input, database issues. Good error handling means:

1. The app doesn't crash
2. The user sees helpful feedback
3. Developers can debug issues from logs

## Backend Error Handling

### Custom AppError Class

```typescript
export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}
```

Route handlers throw `AppError` for expected errors:

```typescript
if (result.rows.length === 0) {
  throw new AppError("Product not found", 404);
}
```

### Global Error Middleware

Express has a special error-handling middleware (4 parameters):

```typescript
function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof AppError) {
    // Known/expected error — return the status and message
    res.status(err.statusCode).json({
      error: { message: err.message, status: err.statusCode },
    });
  } else {
    // Unknown error — log it, return generic 500
    logger.error("Unhandled error", err);
    res.status(500).json({
      error: { message: "Internal server error", status: 500 },
    });
  }
}
```

**Key principle**: Known errors (bad input, not found, unauthorized) return specific status codes and messages. Unknown errors return generic 500 — never expose stack traces or internal details to users. But we DO log them for debugging.

### try/catch in Route Handlers

Every async route handler wraps its logic in try/catch:

```typescript
router.get("/:id", async (req, res, next) => {
  try {
    // Route logic...
    if (!found) throw new AppError("Not found", 404);
    res.json({ data });
  } catch (err) {
    next(err); // Pass error to global error handler
  }
});
```

`next(err)` passes the error to the next error-handling middleware (our `errorHandler`). Without this, Express would send a default HTML error page.

### Database Transaction Error Handling

For operations that modify multiple tables (like placing an order):

```typescript
const client = await pool.connect();
try {
  await client.query("BEGIN");
  // Multiple operations...
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK"); // Undo ALL changes if ANY step fails
  next(err);
} finally {
  client.release(); // Always return connection to pool
}
```

`ROLLBACK` ensures the database stays consistent. Without it, a failure midway through could leave partially created orders.

## Frontend Error Handling

### API Client Errors

Our `apiClient` throws typed errors:

```typescript
if (!response.ok) {
  const body = await response.json();
  throw new ApiError(body.error.message, response.status);
}
```

Components catch these and show user-friendly messages:

```typescript
try {
  await addToCart(productId);
  notify("Added to cart", "success");
} catch (err) {
  notify(
    err instanceof ApiError ? err.message : "Something went wrong",
    "error",
  );
}
```

### React Error Boundaries

Error Boundaries catch JavaScript errors in the component tree during rendering:

```tsx
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Error Boundaries catch**: Errors during rendering, in lifecycle methods, and in constructors.

**Error Boundaries DON'T catch**: Event handler errors, async errors (in setTimeout, fetch, etc.), errors in the boundary itself. Those need try/catch.

In our app, the ErrorBoundary wraps the entire app in App.tsx as a safety net.

### Page-Level Error States

Every page that fetches data handles three states:

```tsx
function ProductDetail() {
  const { data, isLoading, error } = useFetch("/api/products/5");

  if (isLoading) return <LoadingSpinner />; // Loading state
  if (error) return <p className="error-text">{error}</p>; // Error state
  if (!data) return null; // No data

  return <div>{data.product.name}</div>; // Success state
}
```

### Form Validation Errors

Forms have two layers of validation:

1. **Client-side** (immediate feedback):

```typescript
const validate = () => {
  const errors = {};
  if (!form.name.trim()) errors.name = "Name is required";
  if (form.password.length < 8) errors.password = "Min 8 characters";
  return errors;
};
```

2. **Server-side** (authoritative, catches what client missed):

```typescript
try {
  await register(username, email, password);
} catch (err) {
  setServerError(err.message); // "Username already taken"
}
```

Both are needed. Client-side validation provides instant feedback. Server-side validation is the actual enforcement — never trust client-side validation alone.

## Error Flow Summary

```
Frontend Form Submit
  ├── Client validation fails → Show field errors instantly
  └── Client validation passes → API call
       ├── Network error → "Something went wrong" toast
       ├── 400 Bad Request → Show server error message
       ├── 401 Unauthorized → Redirect to login
       ├── 404 Not Found → Show "not found" message
       └── 500 Server Error → "Something went wrong" toast

Backend Route Handler
  ├── Input validation fails → throw AppError(msg, 400)
  ├── Resource not found → throw AppError(msg, 404)
  ├── Auth check fails → throw AppError(msg, 401/403)
  ├── Database error → ROLLBACK + throw
  └── Unexpected error → Caught by errorHandler → logged + 500 response
```
