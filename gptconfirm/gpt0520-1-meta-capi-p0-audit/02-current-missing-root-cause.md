harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
  lane: Green
  allowed_actions:
    - read_only_candidate_recompute
    - vm_log_read_only_audit
  forbidden_actions:
    - meta_send_or_backfill
    - vm_deploy_or_restart
    - raw_identifier_output
  source_window_freshness_confidence:
    source: live ledger + CAPI log + VM pm2 logs
    window: rolling_24h
    confidence: medium_high

# Current Missing Root Cause

## What Was Ruled Out

### 1. Not a simple sync limit starvation

`listAttributionLedgerEntries()` reads latest rows first with `ORDER BY logged_at DESC, rowid DESC`, and both current missing rows were inside the recomputed sync limit 100 window.

### 2. Not blocked by visible no-send guard

Both rows recomputed as eligible:

- payment_page_seen: not applicable.
- semantic payment_page_seen: not applicable.
- explicit non-purchase candidate: not present.
- non-positive value: false.
- refund/cancel marker: false.
- value mismatch: false.
- value guard required not pass: false.

### 3. Not a visible duplicate

For both safe_refs:

- event_id seen in history: false.
- order event key seen in history: false.
- expected event_id shape: order-code based.
- order event key basis: payment key.

### 4. Not a site/pixel mixup in the visible queue

The missing rows are biocom rows and the CAPI log lookup used biocom Pixel `1283400029487161`.

## What Remains Likely

### A. Auto-sync internal failure without row-level visibility

The VM logs show aggregate CAPI auto-sync runs, but do not show row-level safe_ref reasons. A row can fail inside `buildSyncInput`, provider status check, or send path and still not produce an inspectable per-row reason in the current dashboard.

### B. Candidate/build/send mismatch

The local recompute says the rows are candidates. The actual live auto-sync loop may be applying a runtime condition not represented in the action queue, or may fail before appending a CAPI send log.

### C. Window mismatch is less likely

The two rows are in rolling 24h and 7d current queue, and are absent from any-pixel CAPI logs checked for today and recent 7d.

## Evidence From VM Logs

PM2 logs confirm auto-sync is running and sending:

- Examples observed: `CAPI auto-sync` sending 1-3 rows in recent runs.
- No current-row-specific failure was visible.
- One older aggregate failure existed, but not enough to map to these safe_refs.

## Current Root-Cause Verdict

`AUTO_SYNC_VISIBILITY_GAP_WITH_ELIGIBLE_CURRENT_MISSING`

This means the data proves the rows are eligible and unsent, but the live service does not yet expose enough row-level diagnostic detail to explain why.
