# OCI Free Tier VM Setup Guide

Step-by-step guide to setting up a free AMD compute instance on Oracle Cloud Infrastructure (OCI) for deploying a Node.js + React + PostgreSQL app with Docker.

---

## Stack

- **Frontend** — React + Vite
- **Backend** — Node.js (pnpm)
- **Database** — PostgreSQL (Docker container)
- **Reverse proxy** — Nginx
- **Containerisation** — Docker + Docker Compose
- **CI/CD** — GitHub Actions
- **Hosting** — OCI Free Tier (AMD VM.Standard.E2.1.Micro)

---

## Instance Specs (Always Free)

| Resource | Value |
|---|---|
| Shape | VM.Standard.E2.1.Micro |
| OCPU | 1 (AMD) |
| RAM | 1 GB |
| Storage | 50 GB boot volume |
| Cost | Always free — no credit card required |

---

## Phase 0 — Prerequisites (local machine)

### Generate a dedicated SSH key for OCI

Generate a separate key so your existing GitHub SSH key is not affected.

```bash
ssh-keygen -t ed25519 -C "oci-free" -f ~/.ssh/id_ed25519_oci
```

This creates:
- `~/.ssh/id_ed25519_oci` — private key (never share this)
- `~/.ssh/id_ed25519_oci.pub` — public key (paste into OCI console)

A public key has 3 parts — all safe to share, only the private key file is sensitive:
```
ssh-ed25519  AAAAC3Nz...longstring...  oci-free
  (type)         (actual key)           (comment — optional label)
```

Print the public key to copy:
```bash
cat ~/.ssh/id_ed25519_oci.pub
```

---

## Phase 1 — Create a Virtual Cloud Network (VCN)

A VCN is Oracle's private network — like a building with walls around your server. Nothing gets in or out unless you explicitly allow it.

1. Log in to [cloud.oracle.com](https://cloud.oracle.com)
2. ☰ menu → **Networking → Virtual Cloud Networks → Start VCN Wizard**
3. Select **"Create VCN with Internet Connectivity"** → click **Next**
4. Name: `vcn-myapp` — leave all CIDR blocks as default
5. Click **Create** — takes ~30 seconds

This auto-creates a public subnet, private subnet, internet gateway, and route table.

---

## Phase 2 — Create the Compute Instance

1. ☰ menu → **Compute → Instances → Create Instance**
2. Name: `myapp-server`
3. **Change image** → Canonical Ubuntu → **22.04** → Select image
4. **Change shape** → AMD tab → **VM.Standard.E2.1.Micro** (Always Free-eligible) → Select shape
   > The shape appears under "Specialty and previous generation" — this label is normal, it is fully supported and permanently free.
5. Networking:
   - VCN: `vcn-myapp`
   - Subnet: select the existing **public subnet** (10.0.0.0/24)
   - ✅ Assign a public IPv4 address
6. SSH keys: select **"Paste public keys"** → paste contents of `~/.ssh/id_ed25519_oci.pub`
7. Click **Create** — wait ~3 minutes for status to show **RUNNING**
8. Copy the **Public IP address** from the instance details page — just numbers e.g. `152.x.x.x`, no `ubuntu@` prefix

> **Note:** If you see a subnet CIDR overlap error, the VCN wizard already created the subnet. Select the existing subnet instead of creating a new one.

---

## Phase 3 — Open Firewall Ports

OCI has **two** firewall layers — both must be configured or your app will not be reachable.

**What ingress rules are:** By default Oracle blocks ALL incoming connections. Ingress rules are exceptions you carve out — like telling a receptionist "accept visitors on port 80 and 443, turn everyone else away."

| Port | Why |
|---|---|
| 22 | SSH — log into the server from your laptop |
| 80 | HTTP — browsers reach your app |
| 443 | HTTPS — browsers reach your app securely |

### 3a. OCI Security List (cloud level)

1. ☰ → **Networking → Virtual Cloud Networks → vcn-myapp → Security tab → Default Security List for vcn-myapp**
2. Click **Add Ingress Rules** and add:

| Source CIDR | IP Protocol | Source Port Range | Destination Port |
|---|---|---|---|
| 0.0.0.0/0 | TCP | (leave blank) | 80 |
| 0.0.0.0/0 | TCP | (leave blank) | 443 |

> Use **Destination Port**, not Source Port. Leave Source Port Range blank (means any).
> Port 22 (SSH) is already present by default — do not remove it.

### 3b. OS-level firewall (iptables)

SSH into your instance from your local machine:
```bash
ssh -i ~/.ssh/id_ed25519_oci ubuntu@<YOUR_PUBLIC_IP>
```

You know you're inside the server when the prompt changes to `ubuntu@myapp-server:~$`.

Once inside the server run:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

---

## Phase 4 — Verify the Server

Run these inside the server to confirm everything is healthy:
```bash
uname -a      # confirms Ubuntu Linux
free -h       # confirms ~1 GB RAM
df -h /       # confirms ~47 GB disk
```

---

## Phase 5 — Swapfile Setup (safety net for 1 GB RAM)

**What swap is:** Disk space that acts as emergency RAM. When RAM fills up during a deployment spike, Linux moves inactive data to the swapfile instead of killing your app. Slower than RAM but keeps the server alive.

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent across reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Only use swap when RAM is 90% full
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

Verify:
```bash
free -h
# Swap row should show 1.0Gi total
```

---

## Phase 6 — Install Docker + Docker Compose

> Your `Dockerfile` and `docker-compose.yml` in the repo are just text instructions. Docker must be installed on the server to actually execute them — like having a recipe vs having a kitchen.

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
# Takes 2–4 minutes — the apt-get update step looks slow but is not stuck

# Add ubuntu user to docker group (no sudo needed)
sudo usermod -aG docker ubuntu
newgrp docker

# Install Compose plugin
sudo apt-get install -y docker-compose-plugin

# Verify
docker --version
docker compose version
```

---

## Phase 7 — Production docker-compose.prod.yml

### Key differences from dev compose

- Images pulled from GHCR — not built locally (code is baked in)
- No test DB, no Vite dev server, no volume mounts
- Server not exposed publicly — only Nginx talks to it
- Postgres RAM capped for 1 GB server

### Final docker-compose.prod.yml

```yaml
# docker-compose.prod.yml — PRODUCTION
# Usage: docker compose -f docker-compose.prod.yml --env-file .env up -d

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    # Caps Postgres RAM on 1 GB server — without this it starves Node
    command: >
      postgres
      -c shared_buffers=128MB
      -c effective_cache_size=256MB
      -c work_mem=4MB
      -c maintenance_work_mem=32MB
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    # Pre-built image from GHCR — CD workflow builds and pushes on every deploy
    image: ghcr.io/ashish-j-shetty/full-stack-ecommerce-server:latest
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
    # No ports — server is internal only, nginx talks to it
    depends_on:
      postgres:
        condition: service_healthy

  nginx:
    # Pre-built image from GHCR — contains React build + nginx config
    image: ghcr.io/ashish-j-shetty/full-stack-ecommerce-client:latest
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"   # Required for HTTPS/Certbot later
    depends_on:
      - server

volumes:
  pgdata:
```

### RAM budget

| Service | RAM usage |
|---|---|
| OS + Docker daemon | ~200 MB |
| Node.js backend | ~150 MB |
| PostgreSQL (capped) | ~128 MB |
| Nginx | ~10 MB |
| **Total** | **~488 MB** |

### Traffic flow

```
Internet
    ↓
  Nginx (port 80/443) — only public entry point
    ↓
  Node/Express (port 3001) — internal only
    ↓
  PostgreSQL (port 5432) — internal only
```

---

## Phase 7d — .env file on the server

Create on the server — **never commit to git.**

```bash
mkdir -p ~/app
cd ~/app
nano .env
```

```bash
# ============================================================
# Database
# ============================================================
POSTGRES_USER=ecom_user
POSTGRES_PASSWORD=YourMemorablePassword@2026
POSTGRES_DB=ecom_db
DATABASE_URL=postgres://ecom_user:YourMemorablePassword@2026@postgres:5432/ecom_db

# ============================================================
# Server
# ============================================================
NODE_ENV=production
PORT=3001
JWT_SECRET=<output of: openssl rand -base64 64>

# ============================================================
# Client / CORS
# ============================================================
VITE_API_URL=http://YOUR_PUBLIC_IP
CLIENT_URL=http://YOUR_PUBLIC_IP
```

Generate JWT secret:
```bash
openssl rand -base64 64
```

Lock down permissions:
```bash
chmod 600 ~/app/.env
```

**Important notes:**
- `POSTGRES_PASSWORD` — use something memorable, you'll type it in TablePlus
- `JWT_SECRET` — generated, never typed manually, save in a password manager
- `DATABASE_URL` uses `postgres` hostname (not `localhost`) — Docker DNS resolves it
- `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` **must match exactly**
- Once you have a domain replace `YOUR_PUBLIC_IP` with `https://yourdomain.com`

---

## Phase 8 — GitHub Actions CD Workflow

### 8a. Add GitHub Secrets

`github.com/Ashish-j-shetty/full-stack-ecommerce` → **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value |
|---|---|
| `OCI_HOST` | Your server public IP (numbers only) |
| `OCI_SSH_KEY` | Full contents of `~/.ssh/id_ed25519_oci` including `-----BEGIN/END-----` lines |

### 8b. `.github/workflows/cd.yml`

```yaml
name: CD

on:
  workflow_run:
    workflows: ["CI"]         # must match your CI workflow name exactly
    types: [completed]
    branches: [main]

concurrency:
  group: cd-production
  cancel-in-progress: false   # never cancel a running deploy

jobs:
  deploy:
    name: Deploy to OCI
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}

    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push server image
        uses: docker/build-push-action@v5
        with:
          context: ./server
          dockerfile: ./server/Dockerfile
          target: production
          push: true
          tags: ghcr.io/ashish-j-shetty/full-stack-ecommerce-server:latest

      - name: Build and push client image
        uses: docker/build-push-action@v5
        with:
          context: ./client
          dockerfile: ./client/Dockerfile
          target: production
          push: true
          build-args: |
            VITE_API_URL=
          tags: ghcr.io/ashish-j-shetty/full-stack-ecommerce-client:latest

      - name: Deploy to OCI server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.OCI_HOST }}
          username: ubuntu
          key: ${{ secrets.OCI_SSH_KEY }}
          script: |
            echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ashish-j-shetty --password-stdin
            docker pull ghcr.io/ashish-j-shetty/full-stack-ecommerce-server:latest
            docker pull ghcr.io/ashish-j-shetty/full-stack-ecommerce-client:latest
            cd ~/app
            docker compose -f docker-compose.prod.yml --env-file .env up -d --pull always --remove-orphans
            docker image prune -f
```

### 8c. Copy docker-compose.prod.yml to server (one time only)

```bash
scp -i ~/.ssh/id_ed25519_oci docker-compose.prod.yml ubuntu@YOUR_PUBLIC_IP:~/app/
```

> Only re-SCP when `docker-compose.prod.yml` itself changes. Code changes deploy automatically.

### 8d. Full deploy flow

```
git push origin main
    ↓
CI runs (typecheck → lint → tests → build)
    ↓ passes
CD runs:
    → builds server Docker image (code baked in)
    → builds client Docker image (code baked in)
    → pushes both to GHCR
    → SSHs into OCI server
    → pulls latest images
    → docker compose up -d (restarts with new images)
    → prunes old images
```

---

## Phase 9 — Connecting to Postgres via TablePlus

Postgres is not exposed publicly. Connect via SSH tunnel — secure and production-standard.

**In TablePlus → New Connection → PostgreSQL:**

SSH tunnel tab:
| Field | Value |
|---|---|
| SSH Host | Your server public IP |
| SSH User | `ubuntu` |
| SSH Key | `~/.ssh/id_ed25519_oci` |

General tab:
| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| User | `ecom_user` |
| Password | Your `POSTGRES_PASSWORD` from `.env` |
| Database | `ecom_db` |

**Connect manually from inside the server:**
```bash
docker exec -it app-postgres-1 psql -U ecom_user -d ecom_db
```

Useful psql commands:
```sql
\dt                            -- list all tables
\d tablename                   -- describe a table
SELECT * FROM users LIMIT 10;
\q                             -- quit
```

---

## Phase 10 — HTTPS with Let's Encrypt (future)

HTTPS requires a domain name — Certbot cannot issue certificates for raw IP addresses.

**When you have a domain:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Then update `.env` on the server:
```bash
VITE_API_URL=https://yourdomain.com
CLIENT_URL=https://yourdomain.com
```

And uncomment the HTTPS block in `client/nginx.conf`, then redeploy.

**Free domain options:**
- `freedns.afraid.org` — free subdomain (e.g. `myapp.mooo.com`)
- Namecheap / GoDaddy — ~$10/year for a real domain

---

## Operational Commands (day-to-day)

SSH in first:
```bash
ssh -i ~/.ssh/id_ed25519_oci ubuntu@YOUR_PUBLIC_IP
```

### Check container status
```bash
docker ps                      # running containers
docker ps -a                   # all containers including stopped
```

### View logs
```bash
# All containers
docker compose -f ~/app/docker-compose.prod.yml logs

# Specific container — live tail
docker compose -f ~/app/docker-compose.prod.yml logs -f server
docker compose -f ~/app/docker-compose.prod.yml logs -f nginx
docker compose -f ~/app/docker-compose.prod.yml logs -f postgres

# Last 50 lines only
docker compose -f ~/app/docker-compose.prod.yml logs --tail=50 server
```

### Start / stop / restart
```bash
cd ~/app

# Start all containers
docker compose -f docker-compose.prod.yml --env-file .env up -d

# Stop all (data preserved)
docker compose -f docker-compose.prod.yml down

# Restart a single container
docker restart app-server-1
docker restart app-nginx-1
docker restart app-postgres-1

# Restart all
docker compose -f docker-compose.prod.yml --env-file .env restart
```

### Check images
```bash
docker images                  # list all images
```

### Clean up Docker
```bash
# Remove stopped containers
docker container prune -f

# Remove dangling images only
docker image prune -f

# Remove ALL unused images (safe — server pulls fresh from GHCR)
docker image prune -a -f

# Nuclear — removes everything including Postgres data volume
# WARNING: all database data will be lost
docker system prune -a --volumes
```

### Check server resources
```bash
free -h                        # RAM + swap usage
df -h /                        # disk usage
docker stats --no-stream       # RAM/CPU per container (one snapshot)
docker stats                   # live RAM/CPU (Ctrl+C to exit)
```

### Manually redeploy without a git push
```bash
cd ~/app
docker compose -f docker-compose.prod.yml --env-file .env up -d --pull always --remove-orphans
docker image prune -f
```

### Edit .env on the server
```bash
nano ~/app/.env
# After saving, restart to pick up changes:
docker compose -f ~/app/docker-compose.prod.yml --env-file ~/app/.env up -d
```

---

## Progress Checklist

- [x] OCI AMD instance running
- [x] Firewall ports open (22, 80, 443)
- [x] SSHed in successfully
- [x] Swapfile active and permanent (1 GB)
- [x] Docker + Docker Compose installed
- [x] `docker-compose.prod.yml` updated (GHCR images + Postgres RAM caps)
- [x] `.env` file created on server with production values
- [x] GitHub Secrets added (`OCI_HOST`, `OCI_SSH_KEY`)
- [x] CD workflow created (`.github/workflows/cd.yml`)
- [x] `docker-compose.prod.yml` copied to server
- [x] First deploy succeeded via GitHub Actions
- [ ] Connect to Postgres via TablePlus SSH tunnel
- [ ] HTTPS with Let's Encrypt — needs a domain first

---

## Security Reminders

- Never commit `.env` files to git — add `.env` to `.gitignore`
- Never share your private key (`~/.ssh/id_ed25519_oci`)
- Store all secrets as GitHub Actions secrets — never hardcode them
- Postgres is not exposed publicly — always connect via SSH tunnel
- `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` must match exactly

---

## Troubleshooting

| Problem | Fix |
|---|---|
| SSH times out | Check port 22 exists in OCI Security List |
| Subnet CIDR overlap error on instance create | Select existing subnet instead of creating a new one |
| Can't reach port 80/443 | Check both OCI Security List AND iptables rules |
| AMD shape not visible | It's under "Specialty and previous generation" tab — normal, still free |
| Docker install looks stuck on `apt-get update` | Takes 2–4 minutes — wait, do not Ctrl+C |
| `docker` command requires sudo | Run `sudo usermod -aG docker ubuntu` then `newgrp docker` |
| CD workflow not triggering after CI | Check CI workflow name matches exactly: `workflows: ["CI"]` |
| GHCR push permission denied | Ensure `packages: write` is in CD workflow permissions |
| Server can't pull from GHCR on deploy | Check `GITHUB_TOKEN` login step in deploy script |
| Bad gateway (502) on API calls | Server container is crashing — run `docker logs app-server-1` |
| Server container keeps restarting (Up 19 seconds) | Missing env var or DB connection error — check `docker logs app-server-1` |
| `unable to prepare context: path not found` | `docker-compose.prod.yml` still has `build:` sections — replace with `image:` pointing to GHCR |
| `password authentication failed for user` | `POSTGRES_PASSWORD` in `.env` doesn't match what the `pgdata` volume was initialised with. Stop containers, delete volume (`docker volume rm app_pgdata`), fix `.env`, redeploy. **Data will be lost.** |
| `ENOENT: no such file or directory, scandir '/app/migrations'` | `migrations/` folder not copied into Docker image. Add `COPY --from=builder /app/migrations ./migrations` to server Dockerfile production stage. |
| All `/api/*` routes return 404 | Nginx `proxy_pass` has trailing slash (`http://server:3001/`) stripping `/api/` prefix. Remove trailing slash → `http://server:3001`. |
| Protected routes return 401 in prod but work in dev | JWT cookie set with `secure: true` but server is on plain HTTP. Set `secure: false` in cookie options until HTTPS is configured. |