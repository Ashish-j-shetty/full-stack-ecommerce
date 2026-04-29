# 06 - React Frontend

## What is React?

React is a JavaScript library for building user interfaces. Instead of manually updating the DOM (like with jQuery), you describe what the UI should look like, and React figures out how to update the DOM efficiently.

## Core Concepts

### Components

A component is a reusable piece of UI. It's a function that returns JSX (HTML-like syntax in JavaScript):

```tsx
function ProductCard({ name, price }: { name: string; price: number }) {
  return (
    <div className="product-card">
      <h3>{name}</h3>
      <p>${price.toFixed(2)}</p>
    </div>
  );
}
```

- Components are JavaScript functions that return JSX
- Component names must start with a capital letter
- Components can be composed (a `ProductGrid` contains multiple `ProductCard`s)

### JSX

JSX looks like HTML but is actually JavaScript:

```tsx
// This JSX:
<h1 className="title">Hello {name}</h1>;

// Is compiled to:
React.createElement("h1", { className: "title" }, `Hello ${name}`);
```

Key JSX differences from HTML:

- `className` instead of `class` (because `class` is a reserved word in JS)
- `htmlFor` instead of `for`
- JavaScript expressions in curly braces: `{variable}`, `{condition && <Element />}`
- Self-closing tags required: `<img />` not `<img>`

### Props

Props are how you pass data from a parent component to a child:

```tsx
// Parent passes data:
<ProductCard name="Wireless Headphones" price={79.99} />;

// Child receives it:
function ProductCard({ name, price }: { name: string; price: number }) {
  // Use name and price here
}
```

Props are read-only — a child should never modify its props.

### State (useState)

State is data that changes over time. When state changes, React re-renders the component:

```tsx
function Counter() {
  const [count, setCount] = useState(0); // Initial value: 0
  //     ↑ current value   ↑ function to update it

  return (
    <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>
  );
}
```

- `useState(0)` returns `[currentValue, setterFunction]`
- Calling `setCount(newValue)` triggers a re-render with the new value
- State is preserved between re-renders
- Never modify state directly: `count++` ❌, `setCount(count + 1)` ✅

### Effects (useEffect)

Effects let you run code after rendering — typically for side effects like fetching data:

```tsx
function ProductDetail({ id }: { id: number }) {
  const [product, setProduct] = useState(null);

  useEffect(() => {
    // This runs after the component renders
    fetch(`/api/products/${id}`)
      .then((res) => res.json())
      .then((data) => setProduct(data.product));
  }, [id]); // Re-run only when `id` changes
  //  ↑ dependency array

  return product ? <h1>{product.name}</h1> : <p>Loading...</p>;
}
```

The dependency array controls when the effect re-runs:

- `[]` — Run once on mount
- `[id]` — Run on mount and whenever `id` changes
- No array — Run after every render (rarely wanted)

### How React Renders

```
1. State changes (setCount, setState, etc.)
2. React calls the component function again
3. React compares the new JSX with the previous JSX (diffing)
4. React updates only the parts of the DOM that changed (reconciliation)
```

This is why React is efficient — it doesn't re-create the entire page, just the parts that changed.

## TypeScript with React

TypeScript adds type safety to React:

```tsx
// Typed props
interface ProductCardProps {
  id: number;
  name: string;
  price: number;
  onAddToCart: (id: number) => void; // Function type
}

function ProductCard({ id, name, price, onAddToCart }: ProductCardProps) {
  return (
    <button onClick={() => onAddToCart(id)}>
      Add {name} (${price})
    </button>
  );
}

// Typed state
const [products, setProducts] = useState<Product[]>([]);
const [error, setError] = useState<string | null>(null);
```

TypeScript catches errors at compile time:

- Passing wrong prop types
- Accessing properties that don't exist
- Forgetting required props

## Our Component Hierarchy

```
App
└── Layout (header, nav, footer, notifications)
    ├── Home
    │   ├── ProductCard (×n)
    │   └── EmptyState / LoadingSpinner
    ├── ProductDetail
    ├── Cart
    ├── Checkout
    ├── OrderConfirmation
    ├── OrderHistory
    ├── Login
    ├── Register
    ├── NotFound
    └── admin/Products
```

- `App` sets up routing and context providers
- `Layout` wraps all pages with shared header/footer
- Each page is a route-level component
- Reusable components (ProductCard, EmptyState, LoadingSpinner) are used across pages
