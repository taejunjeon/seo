# GDN Green Follow-up Checklist

작성 시각: 2026-05-23 22:05 KST
상태: project-local delta
정본 링크: `harness/common/HARNESS_GUIDELINES.md`, `harness/common/AUTONOMY_POLICY.md`, `harness/common/REPORTING_TEMPLATE.md`
목적: Google ROAS 정합성 작업에서 HOLD가 나오면 TJ님에게 넘기기 전 Codex가 먼저 끝낼 Green follow-up을 고정한다.

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
    - harness/gdn/AUDITOR_CHECKLIST.md
  lane: Green
  allowed_actions:
    - project_local_checklist_update
    - read_only_followup_definition
    - no_send_no_write_audit_definition
  forbidden_actions:
    - common_harness_fork
    - google_ads_conversion_upload_or_send
    - google_ads_setting_change
    - vm_cloud_write_or_schema_change
    - operating_db_write
    - gtm_publish
    - backend_deploy
  source_window_freshness_confidence:
    source: project-local harness policy
    window: reusable
    freshness: 2026-05-23 22:05 KST
    confidence: high
```

## 원칙

이 파일은 common harness 본문을 복사하지 않는다.
공통 원칙은 common 정본을 따른다.
여기에는 Google ROAS 정합성 작업에서 자주 빠지는 Green follow-up만 추가한다.

## HOLD가 나오면 먼저 할 일

Google ROAS 정합성 작업에서 아래 HOLD가 나오면 최종 보고로 넘기기 전에 가능한 항목을 먼저 실행한다.

| HOLD category | Codex가 먼저 할 Green follow-up | 성공 기준 |
|---|---|---|
| `missing_click_bridge` | paid click intent, site landing, attribution ledger, NPay intent matcher를 read-only로 재조회한다 | order-level 후보 수와 ambiguous 수가 분리된다 |
| `missing_google_click_id` | gclid, gbraid, wbraid source별 보존률을 read-only로 다시 계산한다 | URL, storage, checkout, payment_success 중 누락 지점이 좁혀진다 |
| `ambiguous_candidates` | A/B/ambiguous tier를 분리하고 time-window-only 후보를 `do_not_send`로 둔다 | A급만 다음 설계 대상으로 남는다 |
| `verification_gap` | GA4 robust guard, no-send/no-write grep, wiki link 또는 preflight check를 실행한다 | guard status와 검증 명령 결과가 남는다 |
| `source_freshness_gap` | VM Cloud, 운영DB, Google Ads API의 기준 시각과 window를 다시 기록한다 | stale인지 데이터 없음인지 분리된다 |
| `approval_required` | 승인 전 실행하지 않고 approval packet을 만든다 | TJ님이 YES/NO로 판단할 수 있다 |

## 필수 자동 follow-up 세트

Google confirmed 주문 또는 NPay actual match가 HOLD이면 아래 순서로 닫는다.

1. `source refresh`
   - VM Cloud SQLite, 운영DB read-only, Google Ads dashboard API 중 해당 source를 다시 조회한다.
   - source/window/freshness/confidence를 기록한다.

2. `matcher dry-run`
   - 주문과 click intent를 붙이는 read-only matcher를 실행한다.
   - A급, B급, ambiguous, clicked-no-purchase, purchase-without-intent를 분리한다.

3. `duplicate guard`
   - Google Ads 또는 GA4 전송 후보가 생기면 GA4 robust guard를 read-only로 실행한다.
   - `present`, `robust_absent`, `unknown`을 분리한다.

4. `frontend existence check`
   - TJ님이 화면 질문을 하면 `/ads/google-roas-report`와 홈 카드 연결 여부를 확인한다.
   - 정적 HTML인지 Next.js 페이지인지 구분한다.

5. `approval packet`
   - 남은 일이 VM Cloud write, backend deploy, Google Ads send, GTM publish라면 승인안을 만든다.
   - 승인 전 실행하지 않는다.

## 보고에 반드시 남길 필드

HOLD를 줄인 뒤 보고에는 아래를 남긴다.

- `hold_reason_category`
- `auto_green_followups_available`
- `auto_green_followups_done`
- `remaining_blocker`
- `next_lane`
- `send_candidate`
- `no_send/no_write/no_deploy/no_publish`

## 이번 보강의 이유

2026-05-23 Google ROAS/NPay actual 작업에서 NPay matcher 재실행과 GA4 robust guard는 Green Lane이었는데, 처음에는 다음 할 일로 밀릴 뻔했다.
앞으로 같은 유형의 작업은 이 체크리스트를 따라 Codex가 먼저 read-only follow-up을 끝낸 뒤, 남은 write/send/deploy만 TJ님에게 넘긴다.
