#!/usr/bin/env bash
set -euo pipefail

VM_HOST="${VM_HOST:-}"
VM_USER="${VM_USER:-}"
VM_REPO_DIR="${VM_REPO_DIR:-/opt/seo/repo}"
LOCAL_ROOT="${LOCAL_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

if [[ -z "$VM_HOST" || -z "$VM_USER" ]]; then
  echo "Usage: VM_USER=<user> VM_HOST=<host> $0" >&2
  exit 1
fi

rsync -az --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "frontend/.next" \
  --exclude "backend/dist" \
  --exclude "backend/.env" \
  --exclude "backend/data" \
  --exclude "backend/logs" \
  --exclude ".DS_Store" \
  "$LOCAL_ROOT/" "$VM_USER@$VM_HOST:$VM_REPO_DIR/"

echo "Synced repo to $VM_USER@$VM_HOST:$VM_REPO_DIR"
echo "Next on VM:"
echo "cd $VM_REPO_DIR/backend && npm ci && npm run typecheck && npm run build"
