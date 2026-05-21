harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - capivm/!capiplan.md
  lane: Green_then_Yellow
  allowed_actions:
    - local_code_design
    - local_diagnostic_script_or_endpoint
    - typecheck
    - approval_packet
  forbidden_actions:
    - meta_send_or_backfill_without_red_approval
    - vm_deploy_without_yellow_approval
    - raw_identifier_output
  source_window_freshness_confidence:
    source: current P0 audit
    confidence: high_for_need_medium_for_exact_patch

# Next Diagnostic Patch Plan

## Goal

Create a safe diagnostic path that explains, for each Meta CAPI candidate, why it is:

- sent,
- already sent,
- no-send guarded,
- build-input failed,
- provider-status blocked,
- send failed,
- or still eligible but unsent.

No external platform send should happen in this diagnostic path.

## Recommended Local Patch

### Option 1: script first

Add a local script:

`backend/scripts/meta-capi-sync-diagnostic.ts`

Behavior:

- Reads ledger candidates for site/window.
- Reuses no-send and duplicate logic.
- Emits only safe_ref, status bucket, amount bucket, and present/absent flags.
- Does not call `sendMetaConversion`.
- Provider checks default to off, with optional read-only check flag.

Why first:

- Lowest risk.
- No live endpoint exposure.
- Good enough to explain the current 2 rows before any backfill.

Status:

- Implemented as `backend/scripts/meta-capi-current-missing-diagnostic-20260520.ts`.
- Current output confirms 2 eligible unsent rows with safe_refs only.
- Provider/Toss status is intentionally not checked yet to keep first diagnostic fully read-only against VM Cloud APIs only.

### Option 2: live read-only endpoint later

Add:

`GET /api/meta/capi/sync-diagnostics?site=biocom&window=1d&limit=100`

Behavior:

- Same output as script.
- Safe aggregate-only by default.
- Requires Yellow deploy.

Why later:

- Useful for dashboard action queue drilldown.
- Needs backend deployment and access control review.

## Required Output Buckets

- `eligible_unsent`
- `already_sent_event_id`
- `already_sent_order_event_key`
- `no_send_guard`
- `build_input_failed`
- `provider_status_not_done`
- `provider_status_unpaid_or_virtual`
- `send_failed`
- `log_write_gap_possible`

## Approval Boundary

Green:

- local script implementation.
- local typecheck.
- read-only dry-run.
- report update.

Yellow:

- VM Cloud backend endpoint deploy.
- auto-sync logging patch deploy.
- backend restart.

Red:

- any Meta CAPI Purchase send/backfill.
- any production DB write.

## Success Criteria

- Current missing 2 rows get a concrete safe reason bucket.
- Raw identifier output remains 0.
- Meta send remains 0 during diagnostic.
- If code is touched, typecheck passes.
