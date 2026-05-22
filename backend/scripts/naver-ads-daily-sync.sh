#!/usr/bin/env bash
set -euo pipefail

export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
export TZ=Asia/Seoul

cd /home/biocomkr_sns/seo/repo/backend

mode="${NAVER_ADS_MODE:-write}"
site="${NAVER_ADS_SITE:-biocom}"
since="${NAVER_ADS_SINCE:-$(date -d '30 days ago' +%F)}"
until="${NAVER_ADS_UNTIL:-$(date -d 'yesterday' +%F)}"
max_rows="${NAVER_ADS_MAX_ROWS:-1200}"

if [[ "$mode" != "write" && "$mode" != "dry-run" ]]; then
  echo "NAVER_ADS_MODE must be write or dry-run" >&2
  exit 2
fi

cmd=(
  npx tsx scripts/naver-ads-collect-7d-20260513.ts
  "--$mode"
  "--site=$site"
  "--since=$since"
  "--until=$until"
)

if [[ "$mode" == "write" ]]; then
  cmd+=("--max-rows=$max_rows")
fi

cmd+=("--json")

"${cmd[@]}"
