# 01 - Project Setup

## Overview

This document explains how the project is organized, why it's structured this way, and how the three parts (frontend, backend, database) connect.

## Folder Structure

```
ecommerce-app/
├── docker-compose.yml    ← Orchestrates all services
├── .env                  ← Environment variables (secrets, config)
├── server/               ← Backend (Node.js + Express + TypeScript)
│   ├── src/              ← Source code
│   │   ├── index.ts      ← Entry point (starts the server)
│   │   ├── app.ts        ← Express app (separated for testability)
│   │   ├── config/       ← Database connection, migrations
│   │   ├── middleware/    ← Auth, error handling, rate limiting, etc.
│   │   ├── routes/       ← API endpoint handlers
│   │   ├── types/        ← TypeScript type definitions
│   │   └── utils/        ← Helper utilities (logger)
│   ├── migrations/       ← SQL migration files (create tables)
│   └── __tests__/        ← Backend tests
├── client/               ← Frontend (React + TypeScript + Vite)
│   ├── src/
│   │   ├── main.tsx      ← Entry point (renders the app)
│   │   ├── App.tsx       ← Router setup, context providers
│   │   ├── api/          ← HTTP client for talking to the backend
│   │   ├── context/      ← React Context providers (auth, cart, theme, notifications)
│   │   ├── hooks/        ← Custom React hooks
│   │   ├── pages/        ← Page-level components (one per route)
│   │   ├── components/   ← Reusable UI components
│   │   └── styles/       ← CSS files
│   └── __tests__/        ← Frontend tests
└── docs/                 ← These concept documents
```

## Why This Structure?

### Separation of Concerns

Each folder has a single job:

- `routes/` handles HTTP requests
- `middleware/` processes requests before they reach routes
- `context/` manages global state in React
- `pages/` are tied to URL routes
- `components/` are reusable building blocks

### app.ts vs index.ts (Server)

We separate the Express app creation (`app.ts`) from the server startup (`index.ts`). This is a real-world pattern because:

- Tests can import the Express app without starting a real server
- The app configuration is independent of how it's served
- `index.ts` handles "infrastructure" concerns (connecting to DB, starting the server, graceful shutdown)

### How The Three Parts Connect

```
Browser (User)
    ↓ HTTP requests
React App (client, port 5173)
    ↓ API calls to /api/*
Express Server (server, port 3001)
    ↓ SQL queries
PostgreSQL Database (port 5432)
```

1. The **React app** runs in the user's browser. When it needs data, it sends HTTP requests to `/api/*` endpoints
2. The **Vite dev server** proxies `/api/*` requests to the Express server (avoids CORS issues in development)
3. The **Express server** receives requests, processes them (validate input, check auth), queries the database, and returns JSON responses
4. **PostgreSQL** stores all persistent data (users, products, orders, cart items)

## package.json Scripts

### Server

- `npm run dev` — Start with hot reload (tsx watch). Changes to `.ts` files auto-restart the server
- `npm run build` — Compile TypeScript to JavaScript (for production)
- `npm test` — Run backend tests with Jest
- `npm run migrate` — Run database migrations manually

### Client

- `npm run dev` — Start Vite dev server with hot module replacement (HMR)
- `npm run build` — Build optimized production bundle
- `npm test` — Run frontend tests with Jest + React Testing Library

## TypeScript

Both frontend and backend use TypeScript. This gives us:

- **Type safety**: Catch errors at compile time, not runtime
- **IDE support**: Autocomplete, inline errors, refactoring tools
- **Documentation**: Types serve as documentation for function parameters and return values
- `strict: true` in `tsconfig.json` enables the strictest checks — this catches more bugs but requires more explicit typing
