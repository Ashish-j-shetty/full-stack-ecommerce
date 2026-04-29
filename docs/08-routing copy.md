# 08 - Routing

## Client-Side vs Server-Side Routing

### Server-Side Routing (Traditional)

```
User clicks link → Browser requests /products/5 → Server returns HTML for that page
```

Every navigation causes a full page reload.

### Client-Side Routing (React Router)

```
User clicks link → JavaScript changes the URL → React renders the new page component
```

No page reload — only the changed parts of the UI update. The browser's URL changes (for bookmarking/sharing), but no HTTP request is made to the server.

## React Router v7

### Setup

```tsx
// App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {" "}
          {/* Layout wraps all routes */}
          <Route path="/" element={<Home />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NotFound />} /> {/* Catch-all */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### Key Concepts

**`<BrowserRouter>`** — Wraps the app and provides routing context. Uses the browser's History API to manage the URL.

**`<Routes>`** — Contains all route definitions. React Router matches the current URL against these routes and renders the matching component.

**`<Route>`** — Maps a URL path to a component:

- `path="/"` — Exact match for the home page
- `path="/products/:id"` — `:id` is a URL parameter (dynamic segment)
- `path="*"` — Matches any URL that doesn't match other routes

**`<Outlet />`** — In the Layout component, `<Outlet />` is where the matched child route renders:

```tsx
function Layout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>{" "}
      {/* Child route component renders here */}
      <Footer />
    </>
  );
}
```

### Navigation

**`<Link>`** — Like an `<a>` tag but prevents page reload:

```tsx
<Link to="/products/5">View Product</Link>
<Link to={`/products/${product.id}`}>View Product</Link>
```

**`useNavigate()`** — Programmatic navigation (like redirect):

```tsx
const navigate = useNavigate();
navigate("/orders/123"); // Navigate after placing an order
navigate(-1); // Go back
```

### URL Parameters

```tsx
// Route definition
<Route path="/products/:id" element={<ProductDetail />} />;

// Inside the component
function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  // URL = /products/5 → id = "5"
  // Note: params are always strings — parse to number if needed
}
```

### Query Parameters

```tsx
function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category");
  // URL = /?category=Electronics → category = "Electronics"
}
```

We also build query strings manually for API calls:

```tsx
const params = new URLSearchParams();
params.set("page", "2");
params.set("category", "Electronics");
// Result: "page=2&category=Electronics"
```

## Protected Routes

Some routes should only be accessible to logged-in users:

```tsx
function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;

  return children;
}
```

Usage:

```tsx
<Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
<Route path="/admin/products" element={<ProtectedRoute requireAdmin><AdminProducts /></ProtectedRoute>} />
```

**How it works:**

1. Check if auth is still loading → show spinner
2. If not authenticated → redirect to login with the current URL as a `?redirect=` parameter
3. If admin required but user isn't admin → redirect to home
4. If all checks pass → render the child component

**After login**, the Login page reads `?redirect=` and navigates the user back to where they were trying to go:

```tsx
const redirect = searchParams.get("redirect") || "/";
navigate(redirect);
```

## Route Structure Summary

```
/                → Home (public)
/products/:id    → ProductDetail (public)
/login           → Login (public)
/register        → Register (public)
/cart            → Cart (requires auth)
/checkout        → Checkout (requires auth)
/orders          → OrderHistory (requires auth)
/orders/:id      → OrderConfirmation (requires auth)
/admin/products  → AdminProducts (requires admin)
*                → NotFound (catch-all, public)
```
