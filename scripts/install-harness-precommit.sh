#!/usr/bin/env bash
# install-harness-precommit.sh — .githooks/pre-commit 을 .git/hooks/pre-commit 으로 설치.
# Sprint 23.3 (Yellow Y1-A).
#
# 운영자 1회 실행:
#   bash scripts/install-harness-precommit.sh
#
# git config core.hooksPath 사용 (symlink 대안). 단순 + 깔끔.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "[install] FAIL — $REPO_ROOT 가 git repo 가 아님." >&2
  exit 1
fi

if [ ! -f "$REPO_ROOT/.githooks/pre-commit" ]; then
  echo "[install] FAIL — $REPO_ROOT/.githooks/pre-commit 부재." >&2
  exit 1
fi

# .githooks/pre-commit 실행 권한 보장
chmod +x "$REPO_ROOT/.githooks/pre-commit"

# git config core.hooksPath 설정 (전체 hooks 디렉토리 변경)
cd "$REPO_ROOT"
CURRENT=$(git config core.hooksPath || echo "")
if [ "$CURRENT" = ".githooks" ]; then
  echo "[install] PASS — git config core.hooksPath = .githooks (이미 설정됨)"
else
  git config core.hooksPath .githooks
  echo "[install] OK — git config core.hooksPath = .githooks (설정 완료)"
fi

# 검증
NEW=$(git config core.hooksPath)
echo "[install] 현재 hooks 경로: $NEW"

# pre-commit 동작 시뮬레이션 안내
cat << 'EOF'

[install] 다음 commit 부터 .githooks/pre-commit 자동 실행.
[install] Growth Data 관련 변경 (harness/, tiktok/, coffee/, naver/, aibio/, backend/src/*Attribution*, frontend/src/app/ads/, etc.) 시 preflight-check --strict 자동 호출.
[install] 무관 commit (예: 일반 docs 만) 은 preflight skip.

[install] 긴급 bypass:
  SKIP_HARNESS_PREFLIGHT=1 git commit -m "..."
  (완료 보고 / Auditor verdict 에 명시 의무)

[install] 제거 (necessary):
  git config --unset core.hooksPath

EOF
