# Coffee Status Blank Root Cause

작성 시각: 2026-05-13 02:29 KST
상태: Green read-only 원인 분류 완료
Owner: Codex
Do not use for: 운영DB write, VM Cloud schema migration, Imweb API write, platform send/upload

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - data/!coffeedata.md
  lane: Green read-only source freshness audit
  allowed_actions:
    - VM Cloud SQLite read-only aggregate
    - local JSON/Markdown evidence
  forbidden_actions:
    - operational DB write/import
    - VM Cloud schema migration
    - platform send/upload
    - GTM publish
  source_window_freshness_confidence:
    source: "VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 imweb_orders"
    window: "thecleancoffee NPay recent 7d/30d"
    freshness: "query generated 2026-05-13 02:02 KST; order sync max 2026-05-12 16:59:56; status sync max 2026-05-12 04:11:07"
    confidence: 0.9
```

## 10초 요약

`status blank`는 VM Cloud SQLite `imweb_orders.imweb_status`가 비어 있다는 뜻이다. 이번 확인에서 blank 16건은 모두 `imweb_status_synced_at` marker가 없고 최신 status sync 이후에 주문 row가 들어왔다. 따라서 현재 원인은 미결제 확정이 아니라 `source_freshness_gap/status sync lag`다.

## 확인한 source

| 항목 | 값 |
|---|---|
| DB 위치 | VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` |
| 테이블 | `imweb_orders` |
| status 컬럼 | `imweb_status` |
| site | `thecleancoffee` |
| pay_type | `npay` |
| latest order sync | `2026-05-12 16:59:56` |
| latest status sync | `2026-05-12 04:11:07` |

## 핵심 숫자

| window | included_with_warning | status blank | blank complete_time present | blank status sync marker |
|---|---:|---:|---:|---:|
| 7d | 101건 / 6,034,000원 | 16건 / 1,012,700원 | 0건 | 0건 |
| 30d | 311건 / 14,970,600원 | 16건 / 1,012,700원 | 0건 | 0건 |

## 판단

blank row 16건은 모두 `imweb_status_synced_at`이 비어 있다. 또 16건 모두 VM Cloud SQLite `imweb_orders.synced_at`이 최신 status sync 시각 이후다. 즉 주문 헤더는 새로 들어왔지만 status 보강 sync가 아직 따라오지 않은 상태다.

이 값은 운영DB PostgreSQL `dashboard.public.tb_iamweb_users.payment_status` blank가 아니다. 로컬DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`의 row도 아니다. 따라서 `complete_time` 공백이나 `imweb_status` blank만으로 미결제라고 단정하지 않는다.

## 다음 할일

### Auto Green

1. [Codex] 24h 후 같은 aggregate를 다시 실행한다.
- 무엇을 하는가: VM Cloud SQLite `imweb_orders`에서 blank count와 `imweb_status_synced_at`을 다시 본다.
- 왜 하는가: status sync lag가 자연 해소되는지 봐야 한다.
- 성공 기준: blank row가 status로 채워지거나, 계속 blank이면 sync job blocker로 분류된다.
- 승인 필요 여부: NO, read-only.

2. [Codex] `/ads/site-landing`과 `/total` 화면 문구를 같은 설명으로 맞춘다.
- 무엇을 하는가: status blank를 “미결제”가 아니라 “상태 보강 지연”으로 표시한다.
- 왜 하는가: 운영자가 blank를 매출 제외로 오해하지 않게 하기 위해서다.
- 성공 기준: 화면과 문서가 같은 DB 위치와 같은 원인 분류를 쓴다.
- 승인 필요 여부: NO, Green.
