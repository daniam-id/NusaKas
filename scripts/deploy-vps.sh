#!/bin/bash
# NusaKas Backend Deployment Script
# Usage: curl -sSL https://raw.githubusercontent.com/daniam-id/NusaKas/main/scripts/deploy-vps.sh | bash

set -e

echo "================================================"
echo "  NusaKas Backend Deployment"
echo "================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  error "Please run as root: sudo bash deploy-vps.sh"
fi

# ============================================
# 1. Install dependencies
# ============================================
log "Installing dependencies..."

apt update -y
apt install -y curl git

# Install Docker (handle conflicts)
if ! command -v docker &> /dev/null; then
  log "Installing Docker..."
  # Remove conflicting packages
  apt remove -y containerd docker.io docker-compose 2>/dev/null || true
  
  # Install Docker from official repo
  curl -fsSL https://get.docker.com | sh
else
  log "Docker already installed"
fi

# Install docker-compose plugin
if ! docker compose version &> /dev/null; then
  apt install -y docker-compose-plugin 2>/dev/null || apt install -y docker-compose
fi

# Start Docker
systemctl enable docker
systemctl start docker

log "Docker installed ✓"

# ============================================
# 2. Install Cloudflared
# ============================================
log "Installing Cloudflare Tunnel..."

if ! command -v cloudflared &> /dev/null; then
  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
  chmod +x /usr/local/bin/cloudflared
fi

log "Cloudflared installed ✓"

# ============================================
# 3. Clone/Update repository
# ============================================
DEPLOY_DIR="/opt/nusakas"

if [ -d "$DEPLOY_DIR" ]; then
  log "Updating existing installation..."
  cd $DEPLOY_DIR
  git pull origin main
else
  log "Cloning repository..."
  git clone https://github.com/daniam-id/NusaKas.git $DEPLOY_DIR
  cd $DEPLOY_DIR
fi

log "Repository ready ✓"

# ============================================
# 4. Setup environment variables
# ============================================
ENV_FILE="$DEPLOY_DIR/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
  log "Setting up environment variables..."
  
  read -p "Enter SUPABASE_URL: " SUPABASE_URL
  read -p "Enter SUPABASE_SERVICE_KEY: " SUPABASE_SERVICE_KEY
  read -p "Enter GEMINI_API_KEY: " GEMINI_API_KEY
  read -p "Enter JWT_SECRET (min 32 chars): " JWT_SECRET

  cat > $ENV_FILE << EOF
NODE_ENV=production
PORT=3000
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
GEMINI_API_KEY=$GEMINI_API_KEY
JWT_SECRET=$JWT_SECRET
WA_SESSION_PATH=/app/.wa-session
EOF

  log "Environment configured ✓"
else
  log "Environment file exists, skipping..."
fi

# ============================================
# 5. Build and start containers
# ============================================
log "Building and starting containers..."

cd $DEPLOY_DIR

# Create backend-only docker-compose for VPS
cat > docker-compose.vps.yml << 'EOF'
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: nusakas-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - ./backend/.env
    volumes:
      - wa-session:/app/.wa-session
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  wa-session:
    name: nusakas-wa-session
EOF

docker compose -f docker-compose.vps.yml up -d --build

log "Backend running on port 3000 ✓"

# ============================================
# 6. Setup Cloudflare Tunnel
# ============================================
log "Setting up Cloudflare Tunnel..."

echo ""
echo "Choose tunnel type:"
echo "1) Quick tunnel (temporary URL, no login required)"
echo "2) Named tunnel (permanent, requires Cloudflare login)"
read -p "Enter choice [1/2]: " TUNNEL_CHOICE

if [ "$TUNNEL_CHOICE" = "1" ]; then
  # Quick tunnel
  log "Starting quick tunnel..."
  
  # Create systemd service for quick tunnel
  cat > /etc/systemd/system/cloudflared-quick.service << EOF
[Unit]
Description=Cloudflare Quick Tunnel
After=network.target docker.service

[Service]
Type=simple
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable cloudflared-quick
  systemctl start cloudflared-quick

  sleep 5
  
  echo ""
  log "Quick tunnel started!"
  echo ""
  echo "================================================"
  echo "  Check tunnel URL with:"
  echo "  journalctl -u cloudflared-quick -f"
  echo "================================================"

else
  # Named tunnel with login
  log "Please login to Cloudflare..."
  cloudflared tunnel login
  
  read -p "Enter tunnel name (e.g., nusakas-api): " TUNNEL_NAME
  read -p "Enter your domain (e.g., api.nusakas.app): " TUNNEL_DOMAIN
  
  # Create tunnel
  cloudflared tunnel create $TUNNEL_NAME
  
  # Get tunnel credentials
  TUNNEL_ID=$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}')
  
  # Create config
  mkdir -p /etc/cloudflared
  cat > /etc/cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: /root/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $TUNNEL_DOMAIN
    service: http://localhost:3000
  - service: http_status:404
EOF

  # Route DNS
  cloudflared tunnel route dns $TUNNEL_NAME $TUNNEL_DOMAIN
  
  # Install as service
  cloudflared service install
  systemctl enable cloudflared
  systemctl start cloudflared

  echo ""
  log "Named tunnel configured!"
  echo ""
  echo "================================================"
  echo "  Your API is available at:"
  echo "  https://$TUNNEL_DOMAIN"
  echo "================================================"
fi

# ============================================
# 7. Summary
# ============================================
echo ""
echo "================================================"
echo -e "  ${GREEN}Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "Backend Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Useful commands:"
echo "  - View logs: docker logs -f nusakas-backend"
echo "  - Restart: docker compose -f /opt/nusakas/docker-compose.vps.yml restart"
echo "  - Update: cd /opt/nusakas && git pull && docker compose -f docker-compose.vps.yml up -d --build"
echo ""
echo "Next steps:"
echo "  1. Copy the tunnel URL"
echo "  2. Update PRODUCTION_API_URL in frontend"
echo "  3. Deploy frontend to Netlify/Vercel"
echo ""
