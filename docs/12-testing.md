# 12 - Testing

## Why Test?

1. **Catch regressions** — When you change code, tests tell you if you accidentally broke something
2. **Confidence to refactor** — Tests let you restructure code without fear
3. **Documentation** — Tests describe what the code should do, in executable form
4. **Faster feedback** — Running tests is faster than manually clicking through the app

## Testing Tools

### Jest

A test runner and assertion library. It finds test files, runs them, and reports pass/fail.

```typescript
describe("add function", () => {
  it("adds two numbers", () => {
    expect(add(1, 2)).toBe(3);
  });

  it("handles negative numbers", () => {
    expect(add(-1, 1)).toBe(0);
  });
});
```

- `describe` — Groups related tests
- `it` (or `test`) — A single test case
- `expect` — Makes an assertion
- `toBe`, `toEqual`, `toContain`, etc. — Matchers

### React Testing Library (RTL)

A library for testing React components by interacting with them like a user would.

**Philosophy**: Test behavior, not implementation. Don't test that state variable X has value Y. Test that the user sees the right thing on screen.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

test("clicking add to cart shows success message", async () => {
  render(<ProductDetail />);

  const button = screen.getByRole("button", { name: /add to cart/i });
  await userEvent.click(button);

  expect(screen.getByText(/added to cart/i)).toBeInTheDocument();
});
```

### Key RTL Methods

**Queries** — Find elements:

- `getByRole` — Best way. Queries by ARIA role (`button`, `heading`, `textbox`)
- `getByText` — Find by text content
- `getByLabelText` — Find form inputs by their label
- `getByPlaceholderText` — Find by placeholder
- `queryBy...` — Like `getBy` but returns null instead of throwing

**User Events** — Simulate user actions:

```typescript
const user = userEvent.setup();
await user.click(button);
await user.type(input, "hello");
await user.clear(input);
```

**Async** — Wait for things to appear:

```typescript
await waitFor(() => {
  expect(screen.getByText("Product loaded")).toBeInTheDocument();
});
// or
const element = await screen.findByText("Product loaded");
```

### Supertest (Backend Testing)

Sends HTTP requests to an Express app without starting a real server:

```typescript
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

test("GET /api/products returns products", async () => {
  const res = await request(app).get("/api/products");
  expect(res.status).toBe(200);
  expect(res.body.data).toBeInstanceOf(Array);
});

test("POST /api/auth/register creates a user", async () => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      username: "testuser",
      email: "test@test.com",
      password: "password123",
    });
  expect(res.status).toBe(201);
  expect(res.body.user.username).toBe("testuser");
});
```

## Backend Test Setup

### Test Database

Tests use a separate PostgreSQL instance (`postgres-test` on port 5433) so they don't affect development data.

### Test Lifecycle

```typescript
beforeAll(async () => {
  // Connect to test DB, run migrations, seed data
});

afterEach(async () => {
  // Truncate tables (delete all data, keep schema)
  // Re-seed base data
});

afterAll(async () => {
  // Close database connection
});
```

This ensures each test starts with a clean, known state.

## Frontend Test Setup

### Mocking

Tests don't make real API calls. We mock the `apiClient`:

```typescript
jest.mock("../api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));
```

This lets us control what the "API" returns:

```typescript
(apiClient.get as jest.Mock).mockResolvedValue({
  data: [{ id: 1, name: "Test Product", price: 9.99 }],
  total: 1,
  page: 1,
  totalPages: 1,
});
```

### CSS Modules

CSS imports are mocked to return empty objects (using `identity-obj-proxy`). Tests care about behavior, not styles.

### Rendering with Providers

Components that use Context need to be wrapped in their providers during testing:

```tsx
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <NotificationProvider>
          <AuthProvider>
            <CartProvider>{ui}</CartProvider>
          </AuthProvider>
        </NotificationProvider>
      </ThemeProvider>
    </BrowserRouter>,
  );
}
```

## What to Test

### DO test:

- **User flows** — Can a user log in? Can they add to cart? Can they place an order?
- **Edge cases** — Empty cart, invalid input, out of stock, network errors
- **Conditional rendering** — Is the admin link shown only for admins? Is "Out of Stock" shown when stock is 0?
- **Error states** — Wrong password shows error message, not found shows 404

### DON'T test:

- **Implementation details** — Don't test that `useState` was called with a specific value
- **Third-party libraries** — Don't test that React Router navigates (it works)
- **Exact styling** — Don't test CSS classes or pixel values
- **Trivial code** — Don't test that a component renders without crashing (unless it has complex logic)

## Test Organization

```
server/__tests__/
  ├── setup.ts                 # DB setup, teardown, helpers
  ├── auth.test.ts             # Registration, login, logout
  ├── products.test.ts         # Product listing, filtering
  ├── cart.test.ts             # Cart CRUD operations
  └── orders.test.ts           # Order placement, history

client/src/__tests__/
  ├── components/
  │   ├── ProductCard.test.tsx
  │   ├── ProtectedRoute.test.tsx
  │   ├── ThemeToggle.test.tsx
  │   └── Layout.test.tsx
  ├── pages/
  │   ├── Home.test.tsx
  │   ├── Cart.test.tsx
  │   ├── Login.test.tsx
  │   └── Checkout.test.tsx
  ├── context/
  │   ├── AuthContext.test.tsx
  │   ├── CartContext.test.tsx
  │   └── ThemeContext.test.tsx
  └── hooks/
      └── useDebounce.test.ts
```

## Running Tests

```bash
# Backend tests
cd server && npm test

# Frontend tests
cd client && npm test

# Run a specific test file
npm test -- auth.test.ts
```
