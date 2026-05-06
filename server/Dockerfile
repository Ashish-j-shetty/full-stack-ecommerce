# =============================================================================
# BASE — shared foundation for all stages
# =============================================================================
# node:24-alpine uses Alpine Linux (~5MB) instead of Debian (~900MB), much
# smaller image. We name it "base" so other stages can inherit from it.
FROM node:24-alpine AS base

# corepack is Node's built-in package manager manager (ships with Node 16.9+).
# "enable" activates it, "prepare" installs the exact pnpm version we want.
# Pinning to 8.10.3 (instead of "latest") makes builds deterministic —
# "latest" can silently change and break your build months later.
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

# All subsequent commands in this stage run from /app inside the container.
WORKDIR /app

# Copy ONLY the package files first (before source code).
# Docker builds in layers — if these files don't change, Docker reuses the
# cached "pnpm install" layer and skips reinstalling on every code change.
COPY package.json pnpm-lock.yaml ./

# --frozen-lockfile means "fail if pnpm-lock.yaml is out of sync with
# package.json" — prevents accidental installs of wrong dependency versions.
RUN pnpm install --frozen-lockfile

# =============================================================================
# DEV — used by docker-compose.yml (local development)
# =============================================================================
# Inherits Node, pnpm, /app, and installed node_modules from base.
FROM base AS dev

# Copy the full source code into the container.
# In dev, hot reload is handled by volume mounts in docker-compose.yml —
# changes on your host are reflected inside the container immediately.
COPY . .

# Documents that the server listens on port 3001.
# EXPOSE is metadata only — you still need to map it in docker-compose (ports:).
EXPOSE 3001

# "pnpm run dev" runs tsx watch, which compiles+runs TypeScript on the fly
# and restarts the server whenever a .ts file changes.
CMD ["pnpm", "run", "dev"]

# =============================================================================
# BUILDER — intermediate stage, compiles TypeScript (never deployed)
# =============================================================================
FROM base AS builder

COPY . .

# Runs tsc (TypeScript compiler) — outputs plain JavaScript to ./dist.
# This stage exists only to produce the compiled output; it is never deployed.
RUN pnpm run build

# =============================================================================
# PRODUCTION — used by docker-compose.prod.yml
# =============================================================================
# Starts fresh from node:22-alpine — does NOT inherit node_modules from base.
# This keeps the final image small by only installing production dependencies.
FROM node:24-alpine AS production

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Set NODE_ENV before "pnpm install" so pnpm knows to skip devDependencies.
# Libraries like Express also behave differently (faster) when this is set.
ENV NODE_ENV=production

# --prod skips devDependencies (typescript, tsx, jest, etc.) — roughly half
# the install size compared to a full install.
RUN pnpm install --frozen-lockfile --prod

# Copy only the compiled JS from the builder stage — no TypeScript source,
# no node_modules from builder. This is what "multi-stage build" means.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations


# Create a non-root user and group. Containers run as root by default which
# is a security risk — if the app is compromised, the attacker gets root.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

# Docker periodically runs this command to check if the container is healthy.
# --interval=30s  → check every 30 seconds
# --timeout=5s    → fail the check if it takes longer than 5 seconds
# --start-period=10s → give the app 10 seconds to boot before checks start
# --retries=3     → mark unhealthy only after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# In production we run the compiled JS directly with Node — no TypeScript,
# no tsx, no hot reload. Faster startup and lower memory usage.
CMD ["node", "dist/index.js"]
