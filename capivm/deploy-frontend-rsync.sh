#!/usr/bin/env bash
# VM으로 frontend 소스 전송 (빌드·재시작은 SSH 원격 스텝에서)
# 사용: VM_USER=<user> VM_HOST=<host> capivm/deploy-frontend-rsync.sh
#
# 변경점 vs deploy-backend-rsync.sh
#   - exclude 에 backend 빌드 산출물 추가 (seo-frontend만 동기화해도 backend 상태는 건드리지 않음)
#   - .next 는 VM에서 다시 빌드하므로 exclude 유지

set -euo pipefail

VM_HOST="${VM_HOST:-}"
VM_USER="${VM_USER:-}"
VM_REPO_DIR="${VM_REPO_DIR:-/opt/seo/repo}"
LOCAL_ROOT="${LOCAL_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

if [[ -z "$VM_HOST" || -z "$VM_USER" ]]; then
  echo "Usage: VM_USER=<user> VM_HOST=<host> $0" >&2
  exit 1
fi

# frontend 폴더만 rsync (backend dist·데이터 건드리지 않음)
rsync -az --delete \
  --exclude "node_modules" \
  --exclude ".next" \
  --exclude ".DS_Store" \
  "$LOCAL_ROOT/frontend/" "$VM_USER@$VM_HOST:$VM_REPO_DIR/frontend/"

echo "Synced frontend to $VM_USER@$VM_HOST:$VM_REPO_DIR/frontend"
echo ""
echo "Next on VM:"
echo "  cd $VM_REPO_DIR/frontend"
echo "  cp .env.vm.example .env.local   # (최초 1회 · NEXT_PUBLIC_API_BASE_URL 설정)"
echo "  npm ci"
echo "  npm run build"
echo "  pm2 reload ecosystem.config.cjs"
