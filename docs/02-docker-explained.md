# 02 - Docker Explained

## What is Docker?

Docker is a tool that packages your application and all its dependencies (Node.js, PostgreSQL, etc.) into isolated "containers." Think of a container as a lightweight virtual machine — it has its own filesystem, networking, and processes, but shares the host OS kernel.

**Why use it?**

- "Works on my machine" problem is eliminated — everyone runs the same environment
- No need to install PostgreSQL, Node.js, etc. on your computer
- One command (`docker compose up`) starts everything

## What is Docker Compose?

Docker Compose is a tool for defining and running multi-container applications. Instead of starting each container manually, you define all services in a `docker-compose.yml` file.

## Our docker-compose.yml Explained

### Services

We define 4 services:

#### 1. `postgres` — The Database

```yaml
postgres:
  image: postgres:16-alpine # Use official PostgreSQL 16 image (Alpine = small)
  environment:
    POSTGRES_USER: ... # Database username
    POSTGRES_PASSWORD: ... # Database password
    POSTGRES_DB: ... # Database name to create
  ports:
    - "5432:5432" # Map container's 5432 to host's 5432
  volumes:
    - pgdata:/var/lib/postgresql/data # Persist data even when container restarts
  healthcheck: # Docker checks if postgres is ready
    test: pg_isready
```

**Key concepts:**

- `image` — Downloads a pre-built image from Docker Hub
- `ports` — `"host:container"` mapping. You can connect from your machine on port 5432
- `volumes` — Without this, all data would be lost when the container stops. The named volume `pgdata` persists data to disk
- `healthcheck` — Runs `pg_isready` every 5 seconds. Other services can wait until this passes

#### 2. `postgres-test` — Test Database

Identical to `postgres` but on port 5433 with a separate database. Tests run against this so they don't affect your development data.

#### 3. `server` — The Backend

```yaml
server:
  build:
    context: ./server # Build from the server/ directory
    dockerfile: Dockerfile # Using this Dockerfile
  environment:
    DATABASE_URL: postgres://...@postgres:5432/... # Note: "postgres" is the service name
  volumes:
    - ./server/src:/app/src # Mount source code for hot reload
  depends_on:
    postgres:
      condition: service_healthy # Wait until postgres healthcheck passes
```

**Key concepts:**

- `build` — Instead of downloading an image, Docker builds one from our Dockerfile
- `DATABASE_URL` uses `postgres` (the service name) as the hostname — Docker Compose creates a network where services find each other by name
- `volumes` mount your local `src/` into the container, so code changes are reflected immediately
- `depends_on` with `service_healthy` ensures the database is ready before the server starts

#### 4. `client` — The Frontend

Similar to server. The Vite dev server proxies `/api` requests to `http://server:3001` using Docker's internal networking.

### Volumes

```yaml
volumes:
  pgdata: # Named volume for PostgreSQL data persistence
```

Named volumes are managed by Docker. Data survives `docker compose down` but is deleted with `docker compose down -v`.

## Dockerfile Explained

Each service with `build` needs a Dockerfile:

```dockerfile
FROM node:20-alpine    # Start from Node.js 20 on Alpine Linux (tiny ~5MB base)
WORKDIR /app           # Set working directory inside container
COPY package.json .    # Copy dependency list first
RUN npm install        # Install dependencies (cached if package.json unchanged)
COPY . .               # Copy rest of the source code
EXPOSE 3001            # Document which port the app uses
CMD ["npm", "run", "dev"]  # Command to run when container starts
```

**Layer caching**: Docker caches each step. By copying `package.json` first and running `npm install` before copying source code, Docker only re-runs `npm install` when dependencies change — not every time you edit a `.ts` file. This makes rebuilds fast.

## Key Commands

| Command                         | What it does                                          |
| ------------------------------- | ----------------------------------------------------- |
| `docker compose up --build`     | Build images and start all services                   |
| `docker compose up`             | Start services (skip build if images exist)           |
| `docker compose down`           | Stop and remove containers (data preserved)           |
| `docker compose down -v`        | Stop, remove containers AND delete volumes (reset DB) |
| `docker compose logs server`    | View logs from the server service                     |
| `docker compose exec server sh` | Open a shell inside the running server container      |

## Networking

Docker Compose creates a private network. Services communicate using their service names as hostnames:

- Server → Database: `postgres://user:pass@postgres:5432/db` (not `localhost`)
- Client → Server: `http://server:3001` (the Vite proxy target)

From your machine (outside Docker), use `localhost` with the mapped ports:

- Database: `localhost:5432`
- Server API: `localhost:3001`
- Client: `localhost:5173`

## Environment Variables

The `.env` file at the project root is automatically loaded by Docker Compose. Variables defined there are substituted into `docker-compose.yml` using `${VARIABLE_NAME}` syntax.

**Security note**: `.env` is in `.gitignore` — never commit secrets to version control. In production, use proper secret management (environment variables set on the server, Docker secrets, etc.).
