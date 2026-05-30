#!/usr/bin/env bash
set -euo pipefail

# Sends Google Ads confirmed-purchase conversions through the bounded VM Cloud pipeline.
# This script intentionally calls the same reviewed endpoints used by the manual smoke:
# 1) create "ready" rows in the upload ledger
# 2) upload only not-yet-sent ready rows to Google Ads

BASE_URL="${GOOGLE_ADS_CONFIRMED_PURCHASE_BASE_URL:-https://att.ainativeos.net}"
SITE="${GOOGLE_ADS_CONFIRMED_PURCHASE_SITE:-biocom}"
WINDOW="${GOOGLE_ADS_CONFIRMED_PURCHASE_WINDOW:-rolling_24h}"
LIMIT="${GOOGLE_ADS_CONFIRMED_PURCHASE_LIMIT:-5}"

WRITE_CONFIRM="vm_cloud_write_smoke_approved"
SEND_CONFIRM="google_ads_limited_send_approved"

now_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

post_and_log() {
  local phase="$1"
  local url="$2"
  local body_file
  local http_status

  body_file="$(mktemp)"
  http_status="$(curl -sS -o "$body_file" -w "%{http_code}" -X POST "$url" || true)"

  printf '{"at":"%s","phase":"%s","http_status":%s,"body":%s}\n' \
    "$(now_utc)" \
    "$phase" \
    "$http_status" \
    "$(cat "$body_file")"

  rm -f "$body_file"

  case "$http_status" in
    200|201|204|409)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

write_url="${BASE_URL}/api/google-ads/confirmed-purchase/upload-ledger-write-smoke?site=${SITE}&window=${WINDOW}&limit=${LIMIT}&confirm=${WRITE_CONFIRM}"
send_url="${BASE_URL}/api/google-ads/confirmed-purchase/limited-upload?site=${SITE}&window=${WINDOW}&limit=${LIMIT}&confirm=${SEND_CONFIRM}"

post_and_log "write_ready_rows" "$write_url"
post_and_log "send_ready_rows" "$send_url"
