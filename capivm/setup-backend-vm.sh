#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/seo}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
SHARED_DIR="${SHARED_DIR:-$APP_ROOT/shared}"
NODE_MAJOR="${NODE_MAJOR:-22}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo on the VM." >&2
  exit 1
fi

mkdir -p "$REPO_DIR" "$SHARED_DIR/backend-data" "$SHARED_DIR/backend-logs" "$SHARED_DIR/env" "$SHARED_DIR/secrets"

apt-get update
apt-get install -y ca-certificates curl git rsync build-essential

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "v${NODE_MAJOR}\\."; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" "$APP_ROOT"

echo "VM base setup completed."
echo "Next:"
echo "1. Copy repo to $REPO_DIR"
echo "2. Copy backend env to $SHARED_DIR/env/backend.env"
echo "3. Symlink backend/.env, backend/data, backend/logs"
echo "4. Build backend and start PM2"
