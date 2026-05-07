#!/bin/zsh
set -euo pipefail

ROOT="/Users/vibetj/coding/seo"
ENV_FILE="$ROOT/backend/.env"

set -a
eval "$(grep -E '^(Telegram_token|Telegram_chat_id)=' "$ENV_FILE" 2>/dev/null || true)"
set +a

if [ -z "${Telegram_token:-}" ] || [ -z "${Telegram_chat_id:-}" ]; then
  echo "telegram env missing; skip send" >&2
  exit 0
fi

TEXT="$(cat)"
if [ -z "$TEXT" ]; then
  echo "telegram text empty; skip send" >&2
  exit 0
fi

if [ "${TELEGRAM_DRY_RUN:-0}" = "1" ]; then
  printf '%s\n' "$TEXT"
  exit 0
fi

curl -sS -X POST "https://api.telegram.org/bot${Telegram_token}/sendMessage" \
  --data-urlencode "chat_id=${Telegram_chat_id}" \
  --data-urlencode "text=${TEXT}" \
  >/dev/null
