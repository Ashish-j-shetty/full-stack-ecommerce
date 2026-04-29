# 11 - Theming (Dark/Light Mode)

## Overview

Our app supports light and dark themes. The user can toggle between them, and their preference is saved in `localStorage` so it persists across sessions.

## How It Works

### 1. CSS Custom Properties (Variables)

CSS custom properties are defined on a selector and can be used anywhere in CSS:

```css
[data-theme="light"] {
  --bg-primary: #ffffff;
  --text-primary: #1a1a1a;
}

[data-theme="dark"] {
  --bg-primary: #121212;
  --text-primary: #e0e0e0;
}
```

Then used in any CSS file:

```css
body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
```

When the `data-theme` attribute changes, all `var()` references automatically resolve to the new values. No JavaScript needed to update individual elements.

### 2. HTML Data Attribute

We set the theme on the `<html>` element:

```html
<html data-theme="dark"></html>
```

The CSS selectors `[data-theme="light"]` and `[data-theme="dark"]` match this attribute. Since `<html>` is the root element, all CSS that uses `var(--...)` will pick up the correct theme values.

### 3. React ThemeContext

```tsx
const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);

useEffect(() => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}, [theme]);

const toggleTheme = () =>
  setTheme((prev) => (prev === "light" ? "dark" : "light"));
```

**Flow:**

1. On mount: read theme from `localStorage` (or default to 'light')
2. `useEffect` sets the `data-theme` attribute on `<html>` whenever theme changes
3. CSS custom properties automatically switch
4. Theme is saved to `localStorage` for next visit

### 4. ThemeToggle Component

A simple button in the header:

```tsx
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
```

Shows moon (🌙) when in light mode (click to go dark), sun (☀️) when in dark mode (click to go light).

## Why This Approach?

### CSS Custom Properties vs Class Toggling

An alternative is toggling a `.dark` class and duplicating all CSS rules. CSS custom properties are better because:

- Define colors once, use everywhere
- No CSS duplication
- Easy to add new themes (just add another `[data-theme="new"]` block)
- CSS transitions work naturally

### `data-theme` vs Class

`data-theme="dark"` is more semantic than `class="dark"`. Data attributes are designed for custom metadata. Classes are for styling hooks — but `data-theme` clearly communicates its purpose.

### localStorage vs Cookie

We use `localStorage` for theme because:

- Theme is a UI preference, not a security credential
- No need to send it to the server
- `localStorage` is simpler and synchronous
- Unlike cookies, it has no size overhead on every request

## CSS Variable Organization

```css
/* theme.css defines ALL color variables in two blocks */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  --text-secondary: #555555;
  --border-color: #e0e0e0;
  --card-bg: #ffffff;
  --button-primary-bg: #2563eb;
  --input-bg: #ffffff;
  --success: #16a34a;
  --error: #dc2626;
  /* ... more variables */
}

[data-theme="dark"] {
  /* Same variable names, different values */
  --bg-primary: #121212;
  --bg-secondary: #1e1e1e;
  --text-primary: #e0e0e0;
  /* ... */
}
```

All other CSS files (`layout.css`, `products.css`, etc.) use `var(--variable-name)` exclusively — they never reference hardcoded colors. This means:

- Adding dark mode is a one-time effort
- Every new CSS you write automatically supports both themes
- Changing the color scheme is just editing `theme.css`

## Smooth Transition

```css
body {
  transition:
    background-color 0.2s,
    color 0.2s;
}
```

This adds a subtle 200ms fade when toggling themes, instead of an abrupt flash.
