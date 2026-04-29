# 07 - State Management

## The Problem

In a React app, different components need access to the same data:

- The **header** needs to show the cart item count
- The **cart page** needs the full cart items list
- The **product detail** page needs to add items to the cart

### Prop Drilling

The simplest approach is passing data through props:

```
App → Layout → Header → CartBadge (needs cartCount)
App → Layout → Cart (needs cartItems)
```

But if App holds the cart state, it must pass it through Layout and Header just to reach CartBadge. These intermediate components don't use the data — they just pass it along. This is "prop drilling" and it gets messy fast.

## React Context API

Context lets you share data across the component tree without passing props at every level.

### How It Works

1. **Create** a context:

```tsx
const CartContext = createContext<CartContextType | null>(null);
```

2. **Provide** the context (wrap components that need access):

```tsx
function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart }}>
      {children}
    </CartContext.Provider>
  );
}
```

3. **Consume** the context (in any child component):

```tsx
function CartBadge() {
  const { items } = useCart(); // Direct access — no props needed
  return <span>{items.length}</span>;
}
```

### Provider Nesting

In App.tsx, we nest providers so inner contexts can access outer ones:

```tsx
<ThemeProvider>
  {" "}
  {/* Theme available everywhere */}
  <NotificationProvider>
    {" "}
    {/* Notifications available everywhere */}
    <AuthProvider>
      {" "}
      {/* Auth available everywhere */}
      <CartProvider>
        {" "}
        {/* Cart available, can check auth state */}
        <Routes>...</Routes>
      </CartProvider>
    </AuthProvider>
  </NotificationProvider>
</ThemeProvider>
```

Order matters: CartProvider needs to be inside AuthProvider because the cart syncs with the backend only when the user is authenticated.

## Our Four Contexts

### 1. AuthContext

**Purpose**: Track who's logged in

**State**:

- `user` — Current user object (or null)
- `isLoading` — True while checking session on page load
- `isAuthenticated` — Boolean shortcut
- `isAdmin` — Boolean shortcut

**Actions**: `login()`, `register()`, `logout()`

**Uses `useReducer`** because the state transitions are complex (multiple related values change together):

```typescript
// Instead of multiple setState calls:
setUser(data.user);
setIsLoading(false);
setIsAuthenticated(true);

// One dispatch updates everything atomically:
dispatch({ type: "AUTH_SUCCESS", user: data.user });
```

### 2. CartContext

**Purpose**: Manage shopping cart, synced with backend

**State**: `items`, `isLoading`

**Computed values**: `itemCount`, `cartTotal` — derived from items, not stored separately

**Actions**: `addToCart()`, `updateQuantity()`, `removeFromCart()`, `clearCart()`

**Key behavior**: The cart re-fetches from the API when the user logs in and clears when they log out. This is done via a `useEffect` that depends on `isAuthenticated`.

### 3. NotificationContext

**Purpose**: Toast notifications for user feedback

**State**: Array of `{ id, message, type }` objects

**Actions**: `notify(message, type)` — adds a notification, auto-removes after 3 seconds

This is a good example of Context for cross-cutting concerns. Any component can call `notify()` without knowing how notifications are displayed.

### 4. ThemeContext

**Purpose**: Dark/light theme toggle

**State**: `theme` ('light' or 'dark')

**Actions**: `toggleTheme()`

**Persistence**: Reads from localStorage on mount, writes on change. The theme is applied by setting a `data-theme` attribute on the `<html>` element, which CSS selectors match against.

## useState vs useReducer

### useState — Simple independent values

```tsx
const [search, setSearch] = useState("");
const [page, setPage] = useState(1);
```

### useReducer — Complex state with related transitions

```tsx
const [state, dispatch] = useReducer(reducer, initialState);

function reducer(state, action) {
  switch (action.type) {
    case "AUTH_SUCCESS":
      return {
        user: action.user,
        isLoading: false,
        isAuthenticated: true,
        isAdmin: action.user.role === "admin",
      };
    case "LOGOUT":
      return {
        user: null,
        isLoading: false,
        isAuthenticated: false,
        isAdmin: false,
      };
  }
}
```

Rule of thumb: If updating one value requires updating other related values, use `useReducer`. If values are independent, use `useState`.

## When NOT to Use Context

- **Frequently changing values** that cause many re-renders (use local state instead)
- **Server state** that's fetched and cached (our `useFetch` hook handles this locally)
- **Form state** — keep it local to the form component

Context is for data that many components need and changes infrequently (auth, theme) or data that needs to be synchronized (cart).
