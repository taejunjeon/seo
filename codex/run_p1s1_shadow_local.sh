#!/usr/bin/env bash

set -euo pipefail

# P1-S1 shadow mode를 revenue 원본 코드 수정 없이 로컬에서 다시 돌리기 위한 래퍼다.
# 운영 DB를 write target으로 쓰지 말고, 별도 local shadow DB만 대상으로 삼는 것이 전제다.

REVENUE_BACKEND_DIR="${REVENUE_BACKEND_DIR:-/Users/vibetj/coding/revenue/backend}"
SHADOW_DATABASE_URL="${SHADOW_DATABASE_URL:-postgresql+asyncpg://postgres:localdev@localhost:5433/dashboard}"
ORDER_SOURCE_DATABASE_URL="${ORDER_SOURCE_DATABASE_URL:-$SHADOW_DATABASE_URL}"
SECRET_KEY="${SECRET_KEY:-local-shadow}"
ALGORITHM="${ALGORITHM:-HS256}"
ACCESS_TOKEN_EXPIRE_MINUTES="${ACCESS_TOKEN_EXPIRE_MINUTES:-30}"
EXPERIMENT_KEY="${EXPERIMENT_KEY:-temp-shadow-$(date +%Y%m%d%H%M%S)}"
LIMIT="${LIMIT:-120}"
ASSIGNED_AT="${ASSIGNED_AT:-2026-03-01T00:00:00+00:00}"
SEED_START_DATE="${SEED_START_DATE:-${ASSIGNED_AT%%T*}}"
SCAN_LIMIT="${SCAN_LIMIT:-0}"
MESSAGE_LOG_FILE="${MESSAGE_LOG_FILE:-}"
DRY_RUN_ONLY="${DRY_RUN_ONLY:-0}"

if [[ "${PRINT_DB_CHECKLIST:-0}" == "1" ]]; then
  cat <<EOF
[P1-S1 shadow DB 확인 절차]
1. target shadow DB가 로컬인지 확인
   psql -h localhost -p 5433 -U postgres -d dashboard -c "select current_database(), current_user;"
2. docker local Postgres를 쓴다면 컨테이너도 한 번 더 확인
   docker exec dashboard-postgres-local psql -U postgres -d dashboard -c "select current_database(), current_user;"
3. ORDER_SOURCE_DATABASE_URL이 운영 read-only인지, SHADOW_DATABASE_URL과 같은지 다시 확인
EOF
fi

cd "$REVENUE_BACKEND_DIR"

CMD=(
  python scripts/run_crm_phase1_shadow.py
  --experiment-key "$EXPERIMENT_KEY"
  --limit "$LIMIT"
  --assigned-at "$ASSIGNED_AT"
  --seed-start-date "$SEED_START_DATE"
  --scan-limit "$SCAN_LIMIT"
)

if [[ -n "$MESSAGE_LOG_FILE" ]]; then
  CMD+=(--message-log-file "$MESSAGE_LOG_FILE")
fi

if [[ "$DRY_RUN_ONLY" == "1" ]]; then
  CMD+=(--dry-run-only)
fi

PYTHONPATH=. \
ENV=local \
DATABASE_URL="$SHADOW_DATABASE_URL" \
CRM_ORDER_SOURCE_DATABASE_URL="$ORDER_SOURCE_DATABASE_URL" \
SECRET_KEY="$SECRET_KEY" \
ALGORITHM="$ALGORITHM" \
ACCESS_TOKEN_EXPIRE_MINUTES="$ACCESS_TOKEN_EXPIRE_MINUTES" \
"${CMD[@]}" \
  "$@"
