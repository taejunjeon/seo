#!/bin/zsh
set -euo pipefail

ROOT="/Users/vibetj/coding/seo"
BACKEND="$ROOT/backend"
DATA="$ROOT/data"
NPX="/Users/vibetj/.nvm/versions/node/v20.19.2/bin/npx"
LABEL="${BIOCOM_BQ_POSTCHECK_LABEL:-$(date '+%Y%m%d-%H%M')}"
MARKER="${BIOCOM_BQ_POSTCHECK_CRON_MARKER:-biocom_bq_link_postcheck_once}"
TELEGRAM_SEND="$ROOT/scripts/send-telegram-message.sh"

export PATH="/Users/vibetj/.nvm/versions/node/v20.19.2/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cleanup_cron() {
  local tmp
  tmp="$(mktemp)"
  crontab -l 2>/dev/null | grep -v "$MARKER" > "$tmp" || true
  crontab "$tmp" || true
  rm -f "$tmp"
}

trap cleanup_cron EXIT

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] biocom BigQuery link postcheck start"
cd "$BACKEND"
"$NPX" tsx scripts/biocom-bigquery-link-postcheck.ts --label="$LABEL"
JSON_PATH="$DATA/biocom-bigquery-link-postcheck-${LABEL}.json"
if [ -f "$JSON_PATH" ] && [ -x "$TELEGRAM_SEND" ]; then
  MESSAGE="$(node - "$JSON_PATH" <<'NODE'
const fs = require("node:fs");
const path = process.argv[2];
const result = JSON.parse(fs.readFileSync(path, "utf8"));
const dataset = result.newExport?.dataset ?? {};
const live = result.liveSource?.latestPurchaseSanity;
const archive = result.archive?.latestPurchaseSanity;
const fmt = (value) => value === undefined || value === null ? "-" : Number(value).toLocaleString("en-US");
const datasetStatus = dataset.exists
  ? `생성됨 / location ${dataset.location ?? "-"}`
  : `아직 없음${dataset.errorCode ? ` (${dataset.errorCode})` : ""}`;
const liveLine = live
  ? `${live.tableId}, rows ${fmt(live.rows)}, purchase ${fmt(live.purchase)}, txn ${fmt(live.distinctTransactionId)}`
  : "-";
const archiveLine = archive
  ? `${archive.tableId}, rows ${fmt(archive.rows)}, purchase ${fmt(archive.purchase)}, txn ${fmt(archive.distinctTransactionId)}`
  : "-";
const next =
  result.decision === "new_export_daily_table_available"
    ? "다음: 3일 연속 daily table 안정성 확인 후 sourceFreshness 전환 검토"
    : "다음: 다음 예약 시각 또는 2026-05-09 오전에 dataset/table 재확인";
console.log(`biocom BigQuery 자동 확인
시각: ${result.generatedAtKst} KST
판정: ${result.decision}
신규 dataset: project-dadba7dd-0229-4ff6-81c.analytics_304759974 ${datasetStatus}
live source: ${liveLine}
archive: ${archiveLine}
금지선: sourceFreshness 전환/BigQuery write/GA4 Link 변경 안 함
${next}`);
NODE
)"
  printf '%s\n' "$MESSAGE" | "$TELEGRAM_SEND"
  echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] telegram notification sent"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] telegram notification skipped"
fi
echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] biocom BigQuery link postcheck done"
