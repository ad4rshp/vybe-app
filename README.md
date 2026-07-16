# VYBE — Random Video & Text Matchmaking Platform

VYBE is a real-time random video and text matchmaking platform featuring gender-verified queues, live text chats, and optimized media viewport layouts.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Redis Server (local or docker container running on port `6379`)

### 2. Backend Setup (Django Channels / Daphne)
```bash
cd vybe_backend
# Activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r ../requirements.txt

# Run migrations
python manage.py migrate

# Start the Daphne ASGI server
daphne -b 127.0.0.1 -p 8000 vybe_backend.asgi:application
```

### 3. Frontend Setup (Next.js)
```bash
cd vybe_frontend
# Install packages
npm install

# Run the development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Deployment Architecture

- **Docker Compose**: Pre-configured `docker-compose.yml` launches Next.js, Django (Daphne), Redis, and Turnserver services.
- **Kubernetes Scaling**: Located under `k8s/` containing deployment declarations, service boundaries, Nginx Ingress, and HPA (Horizontal Pod Autoscaler) matrices.
- **Cloudflare**: Configured `wrangler.toml` for deploying the Next.js static and serverless edge builds.
