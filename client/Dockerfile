# =============================================================================
# BASE — shared foundation for dev and builder stages
# =============================================================================
# node:20-alpine is a minimal Node image (~130MB vs ~900MB for the full image).
# Named "base" so dev and builder can inherit from it without repeating setup.
FROM node:20-alpine AS base

# corepack is Node's built-in package manager manager.
# Pinning pnpm@8.10.3 ensures every build uses the same version — never "latest"
# because that can silently change and produce different installs over time.
RUN corepack enable && corepack prepare pnpm@8.10.3 --activate

WORKDIR /app

# Copy package files before source code so Docker can cache the install layer.
# If package.json or pnpm-lock.yaml haven't changed, Docker skips reinstalling
# on the next build — saves significant time during development.
COPY package.json pnpm-lock.yaml ./

# --frozen-lockfile fails the build if the lockfile is out of sync with
# package.json, preventing accidental wrong-version installs.
RUN pnpm install --frozen-lockfile

# =============================================================================
# DEV — used by docker-compose.yml (local development)
# =============================================================================
# Inherits Node, pnpm, /app, and installed node_modules from base.
FROM base AS dev

# Copy the full source code. In dev, the docker-compose volume mounts
# (./client/src:/app/src etc.) override this — so live edits on your
# host machine are reflected inside the container instantly.
COPY . .

# Vite's dev server listens on 5173. EXPOSE is documentation — the actual
# port mapping happens in docker-compose.yml under "ports:".
EXPOSE 5173

# Starts the Vite dev server with Hot Module Replacement (HMR) so the
# browser auto-refreshes when you edit a component.
CMD ["pnpm", "run", "dev"]

# =============================================================================
# BUILDER — compiles React app to static files (never deployed directly)
# =============================================================================
FROM base AS builder

COPY . .

# ARG is a build-time variable passed in from docker-compose (args: VITE_API_URL).
# ENV makes it available to the Vite build process.
# Default is "" (empty) — with nginx proxying /api/, the client uses relative
# URLs like /api/products, so no absolute URL is needed.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Runs "tsc -b && vite build" — type-checks TypeScript then bundles the app
# into static HTML/CSS/JS files in the ./dist folder.
RUN pnpm run build

# =============================================================================
# PRODUCTION — used by docker-compose.prod.yml
# =============================================================================
# Starts fresh from the official nginx image (~40MB) — no Node.js, no npm,
# no source code. Just nginx + your compiled static files.
FROM nginx:alpine AS production

# Copy only the compiled output from builder — no node_modules, no source.
# nginx serves these files directly without any runtime processing.
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace nginx's default config with our custom one.
# Handles: SPA routing (try_files), gzip, security headers, /api/ proxy.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx listens on port 80. In docker-compose.prod.yml this is mapped to
# the host machine's port 80 so the app is accessible at http://localhost.
EXPOSE 80

# "daemon off" keeps nginx in the foreground — required for Docker to track
# the process. If nginx ran as a background daemon, Docker would think it
# exited and stop the container.
CMD ["nginx", "-g", "daemon off;"]
