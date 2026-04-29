# E-Commerce Store — Full-Stack Learning App

A production-ready e-commerce application built with **React 19 + TypeScript**, **Node.js + Express**, **PostgreSQL**, and **Docker Compose**. Designed for learning — no component libraries, no ORMs, vanilla CSS with dark/light theming.

## Features

- **Authentication** — Register, login, logout with bcrypt password hashing and JWT in httpOnly cookies
- **Product Browsing** — Grid layout with category filters, search (debounced), and pagination
- **Shopping Cart** — Server-side cart with add/remove/update quantity
- **Checkout** — Shipping form with mock payment, order creation via database transaction
- **Order History** — View past orders with expandable item details
- **Admin Panel** — Add, edit, and delete products (admin role only)
- **Dark/Light Theme** — Toggle with localStorage persistence
- **Toast Notifications** — User feedback for all actions

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

## Quick Start

```bash
# Clone the repo and navigate to it
cd ecommerce-app

# Start all services (postgres + server + client)
docker compose up --build
```

Once everything is up:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Database**: localhost:5432

## Default Admin Account

| Username | Password |
|----------|----------|
| admin | admin123 |

## Project Structure

```
ecommerce-app/
├── docker-compose.yml   — Orchestrates 3 services + test DB
├── .env                 — Environment variables (DB creds, JWT secret)
├── docs/                — 12 concept documentation files
├── server/              — Backend (Express + TypeScript)
│   ├── src/
│   │   ├── app.ts       — Express app setup (middleware + routes)
│   │   ├── index.ts     — Server entry point (startup + graceful shutdown)
│   │   ├── config/      — Database connection, migrations
│   │   ├── middleware/   — Auth, error handler, rate limiter, security headers
│   │   ├── routes/      — API endpoint handlers
│   │   ├── types/       — TypeScript type definitions
│   │   └── utils/       — Logger
│   ├── migrations/      — SQL migration + seed files
│   └── __tests__/       — Backend tests (Jest + supertest)
├── client/              — Frontend (React 19 + TypeScript + Vite)
│   ├── src/
│   │   ├── App.tsx      — Router setup + context providers
│   │   ├── api/         — HTTP client for API calls
│   │   ├── context/     — Auth, Cart, Theme, Notification providers
│   │   ├── hooks/       — useFetch, useDebounce
│   │   ├── pages/       — Page components (one per route)
│   │   ├── components/  — Reusable UI components
│   │   ├── styles/      — Vanilla CSS with theme variables
│   │   └── __tests__/   — Frontend tests (Jest + RTL)
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Create account |
| POST | /api/auth/login | No | Login |
| POST | /api/auth/logout | No | Logout |
| GET | /api/auth/me | Yes | Current user |
| GET | /api/products | No | List products (paginated, filterable) |
| GET | /api/products/categories | No | List categories |
| GET | /api/products/:id | No | Single product |
| GET | /api/cart | Yes | User's cart |
| POST | /api/cart | Yes | Add to cart |
| PUT | /api/cart/:productId | Yes | Update quantity |
| DELETE | /api/cart/:productId | Yes | Remove from cart |
| POST | /api/orders | Yes | Place order |
| GET | /api/orders | Yes | Order history |
| GET | /api/orders/:id | Yes | Order details |
| POST | /api/admin/products | Admin | Create product |
| PUT | /api/admin/products/:id | Admin | Update product |
| DELETE | /api/admin/products/:id | Admin | Delete product |

## Concept Documentation

The `docs/` folder contains 12 guides explaining every concept used in this project:

1. **Project Setup** — Folder structure, how parts connect
2. **Docker Explained** — Services, volumes, networking, Dockerfiles
3. **Database Design** — Schema, normalization, indexes, foreign keys
4. **Authentication** — bcrypt, JWT, httpOnly cookies, auth flow
5. **API Design** — REST conventions, status codes, parameterized queries
6. **React Frontend** — Components, JSX, props, state, effects
7. **State Management** — Context API, useReducer, when to use what
8. **Routing** — React Router, protected routes, URL params
9. **Error Handling** — try/catch, error boundaries, error middleware
10. **Production Best Practices** — Security, performance, reliability
11. **Theming** — CSS custom properties, data attributes, localStorage
12. **Testing** — Jest, RTL, supertest, mocking, what to test

## Common Commands

```bash
# Start everything
docker compose up --build

# Stop everything (data preserved)
docker compose down

# Stop and delete all data (reset DB)
docker compose down -v

# View server logs
docker compose logs server

# View client logs
docker compose logs client

# Open shell in server container
docker compose exec server sh
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, React Router v7, Vite |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL 16 with pg (raw SQL) |
| Auth | bcrypt, jsonwebtoken, httpOnly cookies |
| Styling | Vanilla CSS with custom properties (dark/light) |
| Testing | Jest, React Testing Library, supertest |
| DevOps | Docker Compose |
 