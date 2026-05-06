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

## Instance specs (Always Free)

| Resource | Value                                 |
| -------- | ------------------------------------- |
| Shape    | VM.Standard.E2.1.Micro                |
| OCPU     | 1 (AMD)                               |
| RAM      | 1 GB                                  |
| Storage  | 50 GB boot volume                     |
| Cost     | Always free — no credit card required |

---

## Phase 0 — Prerequisites (local machine)

### 1. Generate a dedicated SSH key for OCI

Generate a separate key so your existing GitHub SSH key is not affected.

```bash
ssh-keygen -t ed25519 -C "oci-free" -f ~/.ssh/id_ed25519_oci
```

This creates:

- `~/.ssh/id_ed25519_oci` — private key (never share this)
- `~/.ssh/id_ed25519_oci.pub` — public key (paste into OCI console)

Print the public key to copy:

```bash
cat ~/.ssh/id_ed25519_oci.pub
```

---

## Phase 1 — Create a Virtual Cloud Network (VCN)

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
5. Networking:
   - VCN: `vcn-myapp`
   - Subnet: select the existing **public subnet** (10.0.0.0/24)
   - ✅ Assign a public IPv4 address
6. SSH keys: select **"Paste public keys"** → paste contents of `~/.ssh/id_ed25519_oci.pub`
7. Click **Create** — wait ~3 minutes for status to show **RUNNING**
8. Copy the **Public IP address** from the instance details page

> **Note:** If you see a subnet CIDR overlap error, the VCN wizard already created the subnet. Select the existing subnet instead of creating a new one.

---

## Phase 3 — Open Firewall Ports

OCI has two firewall layers — both must be configured.

### 3a. OCI Security List (cloud level)

1. ☰ → **Networking → Virtual Cloud Networks → vcn-myapp → Security tab → Default Security List for vcn-myapp**
2. Click **Add Ingress Rules** and add:

| Source CIDR | IP Protocol | Source Port Range | Destination Port |
| ----------- | ----------- | ----------------- | ---------------- |
| 0.0.0.0/0   | TCP         | (leave blank)     | 80               |
| 0.0.0.0/0   | TCP         | (leave blank)     | 443              |

> Port 22 (SSH) is already present by default — do not remove it.

### 3b. OS-level firewall (iptables)

SSH into your instance from your local machine:

```bash
ssh -i ~/.ssh/id_ed25519_oci ubuntu@<YOUR_PUBLIC_IP>
```

Once inside the server (prompt shows `ubuntu@myapp-server:~$`), run:

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

Expected output example:

```
              total   used   free
Mem:           957M   200M   757M
Swap:            0B     0B     0B

Filesystem  Size  Used Avail
/dev/sda1    47G  2.5G   45G
```

---

## Phase 5 — Swapfile Setup (safety net for 1 GB RAM)

Swap is disk space that acts as emergency RAM. Without it, a memory spike during deployment or heavy load will crash your app. With it, the app slows down temporarily and recovers.

Run these inside the server:

**Create and enable the swapfile:**

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

**Make it permanent across reboots:**

```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Tune swappiness** — only use swap when RAM is 90% full (not aggressively):

```bash
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

**Verify swap is active:**

```bash
free -h
```

Expected output:

```
              total   used   free
Mem:           956Mi  223Mi   87Mi
Swap:          1.0Gi    0B   1.0Gi
```

`1.0Gi` under Swap confirms it is active. ✅

---

## Phase 6 — Install Docker + Docker Compose

> Your `Dockerfile` and `docker-compose.yml` in the repo are just instructions. Docker must be installed on the server to actually execute them.

**Install Docker:**

```bash
curl -fsSL https://get.docker.com | sh
```

> This takes 2–4 minutes. The `apt-get update` step looks slow — it is not stuck, just downloading package lists. Wait until your prompt returns.

**Add your user to the docker group** (avoids needing `sudo` every time):

```bash
sudo usermod -aG docker ubuntu
```

**Apply the group change without logging out:**

```bash
newgrp docker
```

**Install Docker Compose plugin:**

```bash
sudo apt-get install -y docker-compose-plugin
```

**Verify both are installed:**

```bash
docker --version
docker compose version
```

Expected output:

```
Docker version 26.x.x, build xxxxxxx
Docker Compose version v2.x.x
```

---

## Phase 7 — Production docker-compose.prod.yml

The production compose file runs: **Postgres + Node server + Nginx** (no test DB, no Vite dev server, no volume mounts — code is baked into images).

Two required changes from the default compose for the OCI 1 GB server:

### 7a. Cap Postgres RAM usage

Without memory limits Postgres will grab as much RAM as it wants and starve Node. Add a `command` block to the postgres service:

```yaml
postgres:
  image: postgres:16-alpine
  restart: unless-stopped
  environment:
    POSTGRES_USER: ${POSTGRES_USER}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    POSTGRES_DB: ${POSTGRES_DB}
  volumes:
    - pgdata:/var/lib/postgresql/data
  # Caps Postgres RAM on a 1 GB server
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
```

### 7b. Add port 443 to Nginx

Required for HTTPS (Certbot/Let's Encrypt) later:

```yaml
nginx:
  ports:
    - "80:80"
    - "443:443"
```

### 7c. RAM budget after changes

| Service             | RAM usage   |
| ------------------- | ----------- |
| OS + Docker daemon  | ~200 MB     |
| Node.js backend     | ~150 MB     |
| PostgreSQL (capped) | ~128 MB     |
| Nginx               | ~10 MB      |
| **Total**           | **~488 MB** |

Leaves ~500 MB headroom — safe for a learning project with low traffic. The 1 GB swapfile handles any spikes.

### 7d. .env file on the server

Create the app directory and `.env` file on the server — never commit this to git:

```bash
mkdir -p ~/app
cd ~/app
nano .env
```

Paste and fill in your values:

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

> Once you have a domain, replace `YOUR_PUBLIC_IP` with `https://yourdomain.com`

Generate a strong JWT secret (run on the server):

```bash
openssl rand -base64 64
```

Lock down file permissions:

```bash
chmod 600 ~/app/.env
```

**Notes:**

- `POSTGRES_PASSWORD` — use something memorable since you'll type it in TablePlus
- `JWT_SECRET` — generated, never typed manually, save it in a password manager
- `DATABASE_URL` uses `postgres` (not `localhost`) — Docker internal DNS resolves container names
- `TEST_DATABASE_URL` is not needed on the server (no test DB in production)

---

## Phase 8 — GitHub Actions CD Workflow

The CD workflow triggers automatically after CI passes on `main`. It:

1. Builds Docker images for server and client
2. Pushes them to GHCR (GitHub's free private registry)
3. SSHes into the OCI server and restarts containers with the new images

### 8a. Add GitHub Secrets

Go to: `github.com/Ashish-j-shetty/full-stack-ecommerce` → **Settings → Secrets and variables → Actions → New repository secret**

| Secret name   | Value                                                            |
| ------------- | ---------------------------------------------------------------- |
| `OCI_HOST`    | Your server public IP (numbers only)                             |
| `OCI_SSH_KEY` | Full contents of `~/.ssh/id_ed25519_oci` including header/footer |

Get your private key contents (run on your local machine):

```bash
cat ~/.ssh/id_ed25519_oci
# Copy everything including:
# -----BEGIN OPENSSH PRIVATE KEY-----
# ...
# -----END OPENSSH PRIVATE KEY-----
```

### 8b. Create `.github/workflows/cd.yml`

```yaml
# ─────────────────────────────────────────────────────────────────────────────
# CD — Build, Push, Deploy
# Runs on:
#   - push to main ONLY after CI passes
# Goal:
#   - Build Docker images for server + client/nginx
#   - Push to GitHub Container Registry (GHCR) — free, private
#   - SSH into OCI server and pull + restart containers
# ─────────────────────────────────────────────────────────────────────────────
name: CD

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

concurrency:
  group: cd-production
  cancel-in-progress: false

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
        uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push server image
        uses: docker/build-push-action@v7
        with:
          context: ./server
          dockerfile: ./server/Dockerfile
          target: production
          push: true
          tags: ghcr.io/ashish-j-shetty/full-stack-ecommerce-server:latest

      - name: Build and push client image
        uses: docker/build-push-action@v7
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

The CD workflow SSHes into the server and runs `docker compose` — but the compose file must exist on the server first. Do this once from your local machine inside your project folder:

```bash
scp -i ~/.ssh/id_ed25519_oci docker-compose.prod.yml ubuntu@YOUR_PUBLIC_IP:~/app/
```

After this, only re-SCP if you change `docker-compose.prod.yml`. All code changes deploy automatically via GitHub Actions.

### 8d. Full deploy flow after setup

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
    → docker compose up -d (zero downtime restart)
    → prunes old images
```

---

## Progress Checklist

- [x] OCI AMD instance running
- [x] Firewall ports open (22, 80, 443)
- [x] SSHed in successfully
- [x] Swapfile active and permanent (1 GB)
- [x] Docker + Docker Compose installed
- [x] `docker-compose.prod.yml` reviewed and updated for 1 GB RAM
- [x] `.env` file created on server with production values
- [x] GitHub Secrets added (`OCI_HOST`, `OCI_SSH_KEY`)
- [x] CD workflow created (`.github/workflows/cd.yml`)
- [x] `docker-compose.prod.yml` copied to server
- [ ] Push to main and verify first deploy succeeds
- [ ] Connect to Postgres via TablePlus SSH tunnel
- [ ] HTTPS with Let's Encrypt (Certbot)

---

## Security Reminders

- Never commit `.env` files to git
- Never share your private key (`~/.ssh/id_ed25519_oci`)
- Store all secrets (DB password, JWT secret, etc.) as GitHub Actions secrets
- The public IP of your server is not sensitive but rotate SSH keys if compromised

---

## Troubleshooting

| Problem                        | Fix                                                                 |
| ------------------------------ | ------------------------------------------------------------------- |
| SSH times out                  | Check port 22 exists in OCI Security List                           |
| Subnet CIDR overlap error      | Select existing subnet instead of creating new                      |
| Can't reach port 80/443        | Check both OCI Security List AND iptables rules                     |
| AMD shape not visible          | It's under "Specialty and previous generation" tab — this is normal |
| Docker install looks stuck     | The `apt-get update` step takes 2–4 minutes — wait, do not Ctrl+C   |
| `docker` command requires sudo | Run `sudo usermod -aG docker ubuntu` then `newgrp docker`           |
| CD workflow not triggering     | Check CI workflow name matches exactly: `workflows: ["CI"]`         |
| GHCR push permission denied    | Ensure `packages: write` is in CD workflow permissions              |
| Server can't pull from GHCR    | Check `GITHUB_TOKEN` login step in deploy script                    |
