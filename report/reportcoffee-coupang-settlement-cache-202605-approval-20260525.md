# reportcoffee coupang settlement cache 202605 approval 20260525

작성 시각: 2026-05-25 06:03 KST
기준일: 2026-05-25
문서 성격: 더클린커피 쿠팡 2026-05 정산 cache 로컬 적재 승인안
담당: Codex
상위 문서: [[reportcoffee]], [[!report]], [[reportcoffee-coupang-settlement-refresh-path-20260524]], [[reportcoffee-sales-summary-no-send-20260524]]
JSON 산출물: `report/reportcoffee-coupang-settlement-cache-202605-approval-20260525.json`

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
    - report/reportcoffee-coupang-settlement-refresh-path-20260524.md
    - report/reportcoffee-sales-summary-no-send-20260524.md
    - report/reportcoffee.md
  lane: Yellow approval packet only
  allowed_actions:
    - approval_packet_documentation
    - read_only_local_sqlite_snapshot
    - read_only_coupang_api_preview_summary
    - local_db_apply_runbook_draft
    - rollback_plan_draft
  forbidden_actions:
    - local_sqlite_write_before_tj_approval
    - operating_db_write
    - vm_cloud_write_or_deploy
    - slack_send
    - platform_send_or_upload
    - gtm_publish
    - cron_registration
    - raw_identifier_output
  source_window_freshness_confidence:
    source: Coupang settlement-histories API preview + local SQLite coupang_settlements_api read-only snapshot
    window: settlement recognition month 2026-05
    freshness: 2026-05-25 06:03 KST
    confidence: 0.86 for apply readiness, 0.72 for coffee-only settlement interpretation because settlement-histories is account-level
```

## 10초 요약

이 문서는 쿠팡 2026-05 정산표를 로컬 cache에 적재해도 되는지 승인받기 위한 문서다.

지금 Slack no-send 리포트의 쿠팡 매출 기준은 이미 `revenue-history`다. 쉬운 말로는 “쿠팡이 매출로 인정한 상품별 금액”이다. 반면 이번 승인 대상은 `settlement-histories`다. 쉬운 말로는 “쿠팡이 언제 얼마를 지급할 예정인지 보는 정산표”다.

따라서 이 적재는 매출 총액을 바꾸는 작업이 아니다. 2026-05 쿠팡 정산 대조 카드가 더 이상 2026-04 cache에 묶이지 않게 만드는 작업이다. 승인 전에는 로컬 SQLite 쓰기 0건으로 유지한다.

## 왜 필요한가

더클린커피 Slack 보고는 매출, 광고비, 매출 대비 광고비 비중을 보여주는 것이 목표다.

쿠팡은 현재 두 기준을 분리해야 한다.

1. 매출 보고 기준: `revenue-history` 매출인식 금액.
2. 정산 대조 기준: `settlement-histories` 지급내역 금액.

현재 로컬 cache인 `coupang_settlements_api`는 2026-05 row가 0건이다. TeamKeto 최신 cache도 2026-04-19까지만 있다. 그래서 월간 보고에서 “쿠팡 정산표 최신 대조”가 pending으로 남는다.

## 승인 대상

승인하면 아래 작업만 실행한다.

1. 로컬 SQLite 파일을 백업한다.
2. 쿠팡 API를 read-only로 한 번 더 확인한다.
3. 로컬 DB `backend/data/crm.sqlite3`의 `coupang_settlements_api` 테이블에 2026-05 정산표만 적재한다.
4. 적재 후 row 수, 금액 합계, 중복 여부를 검증한다.
5. 결과 문서를 갱신한다.

승인해도 운영DB, VM Cloud, Slack, 광고 플랫폼, GTM에는 아무 영향이 없다.

## 현재 read-only 기준

source: 쿠팡 정산 API read-only preview + 로컬 SQLite read-only snapshot
window: 2026-05 정산월
freshness: 2026-05-25 06:03 KST
confidence: 86%

로컬 cache 현재 상태:

- 2026-05 row: 0건.
- TeamKeto 최신 cached month: 2026-04.
- TeamKeto 최신 매출인식 종료일: 2026-04-19.
- TeamKeto 최신 synced_at: 2026-04-24 09:35:35.

쿠팡 API read-only preview:

| 계정 | 예상 row | totalSale | finalAmount | 상태 | 매출인식 범위 | 정산일 범위 |
|---|---:|---:|---:|---|---|---|
| TeamKeto | 4 | 7,222,000원 | 2,289,310원 | PENDING 4 | 2026-05-01 - 2026-05-17 | 2026-05-26 - 2026-07-01 |
| biocom | 4 | 1,019,400원 | 256,524원 | DONE 1 / SUBJECT 3 | 2026-05-01 - 2026-05-17 | 2026-05-26 - 2026-07-01 |

주의: TeamKeto 쿠팡 계정에는 더클린커피 상품과 팀키토 상품이 섞여 있다. 그래서 이 cache는 “계정 전체 정산 대조”이며, 더클린커피 매출 strict 기준은 계속 `revenue-history coffee_hint saleAmount`다.

## 승인 문구

아래 블록을 그대로 답하면 실행할 수 있다.

```text
승인합니다: reportcoffee-coupang-settlement-cache-202605 로컬 쿠팡 정산 cache 2026-05 적재 진행.

범위:
- 백업 생성
- read-only API preview 재확인
- 로컬 SQLite backend/data/crm.sqlite3 coupang_settlements_api에 2026-05 settlement-histories만 적재
- post-verify
- 실패 시 백업으로 롤백

허용:
- local DB backup
- local DB write only to coupang_settlements_api
- API read-only
- local JSON/Markdown result update

금지:
- 운영DB write
- VM Cloud write/deploy/restart
- Slack send
- platform send/upload
- GTM publish
- cron registration
- raw customer/order/payment identifier output
```

## 실행 계획

### 1. 백업

무엇을 하는가: 현재 로컬 DB 파일을 복사해 되돌릴 지점을 만든다.

왜 하는가: 로컬 DB write라도 잘못 들어가면 보고서 cache가 오염될 수 있기 때문이다.

```bash
mkdir -p /Users/vibetj/coding/seo/backend/data/backups
cp /Users/vibetj/coding/seo/backend/data/crm.sqlite3 /Users/vibetj/coding/seo/backend/data/backups/crm.sqlite3.before-coupang-settlements-202605-$(date +%Y%m%dT%H%M%S).bak
shasum -a 256 /Users/vibetj/coding/seo/backend/data/crm.sqlite3
```

성공 기준: backup 파일이 생성되고 원본 hash가 기록된다.

### 2. 사전 스냅샷

무엇을 하는가: 적재 전 2026-05 row가 비어 있는지 다시 본다.

왜 하는가: 이미 누군가 적재했다면 중복/업데이트 기준을 다시 봐야 하기 때문이다.

```bash
sqlite3 -readonly /Users/vibetj/coding/seo/backend/data/crm.sqlite3 "SELECT vendor_id, recognition_year_month, COUNT(*) rows, COALESCE(SUM(total_sale),0) total_sale, COALESCE(SUM(final_amount),0) final_amount, MIN(recognition_date_from), MAX(recognition_date_to), MAX(synced_at) FROM coupang_settlements_api WHERE recognition_year_month='2026-05' GROUP BY vendor_id, recognition_year_month;"
```

성공 기준: 승인 전 기준으로 2026-05 row가 0건이다. 만약 row가 있으면 적재 전에 원인부터 확인한다.

### 3. 적재

무엇을 하는가: 기존 백필 스크립트로 2026-05 정산월만 로컬 cache에 넣는다.

왜 하는가: report script와 dashboard가 API를 매번 직접 부르지 않고 로컬 정산 cache를 읽을 수 있게 하기 위해서다.

```bash
cd /Users/vibetj/coding/seo/backend
node scripts/coupang-backfill-settlements.cjs 2026-05 2026-05
```

성공 기준:

- 전체 2026-05 row: 8건.
- TeamKeto row: 4건, totalSale 7,222,000원, finalAmount 2,289,310원.
- biocom row: 4건, totalSale 1,019,400원, finalAmount 256,524원.
- 중복 정산 ID 0건.

### 4. 사후 검증

무엇을 하는가: 로컬 DB에 들어간 값이 read-only preview와 같은지 확인한다.

왜 하는가: 정산표는 집계 기준이라 숫자 한 줄이 틀리면 월간 대조가 흔들리기 때문이다.

```bash
sqlite3 -readonly /Users/vibetj/coding/seo/backend/data/crm.sqlite3 "SELECT vendor_id, recognition_year_month, COUNT(*) rows, COALESCE(SUM(total_sale),0) total_sale, COALESCE(SUM(final_amount),0) final_amount, MIN(recognition_date_from), MAX(recognition_date_to), MAX(settlement_date), MAX(synced_at), COUNT(DISTINCT settlement_id) distinct_ids FROM coupang_settlements_api WHERE recognition_year_month='2026-05' GROUP BY vendor_id, recognition_year_month ORDER BY vendor_id;"
```

성공 기준: `rows`와 `distinct_ids`가 vendor별로 같고, 합계가 preview와 맞는다.

### 5. 롤백

무엇을 하는가: 실패하면 백업 파일을 원래 DB 위치로 되돌린다.

왜 하는가: 로컬 보고서 cache 오염을 오래 끌지 않기 위해서다.

```bash
cp <backup_path> /Users/vibetj/coding/seo/backend/data/crm.sqlite3
```

성공 기준: 2026-05 row 수가 사전 스냅샷과 같아진다.

## Hard fail

아래 중 하나라도 발생하면 즉시 중단한다.

- 백업 생성 실패.
- API preview 값이 적용 직전 materially 다름. 여기서 materially 다름은 row 수 또는 금액 합계가 설명 없이 달라지는 상태다.
- 스크립트가 로컬 SQLite 외 다른 DB write를 시도.
- 적용 후 정산 ID 중복 발생.
- 적용 후 합계가 preview와 다름.
- 보고서나 로그에 raw 고객/주문/결제 식별자가 노출.

## 하지 않은 것

- 로컬 DB write: 0건.
- 운영DB write: 0건.
- VM Cloud write/deploy/restart: 0건.
- Slack send: 0건.
- Google Ads/GA4/Meta/TikTok/Naver send/upload: 0건.
- GTM publish: 0건.
- cron 등록: 0건.

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 74% | 75% | +1% |
| B | 더클린커피 매출 source 확인 | 100% | 100% | +0% |
| C | 더클린커피 광고비 source 확인 | 82% | 82% | +0% |
| D | 바이오컴 리포트 source map | 36% | 36% | +0% |
| E | Slack no-send 메시지 설계 | 99% | 99% | +0% |
| F | 자동화/배포 readiness | 96% | 97% | +1% |

## 다음 할일

### TJ님이 할 일

1. 로컬 cache 적재를 승인할지 결정한다.
   - 무엇을 하는지: 위 승인 문구를 그대로 답한다.
   - 왜 하는지: 2026-05 쿠팡 정산표 대조가 2026-04 cache에 묶이지 않게 하기 위해서다.
   - 어떻게 하는지: 이 문서의 `승인 문구` 블록을 복사해 대화창에 보낸다.
   - Codex가 대신 못 하는 이유: 로컬 DB write는 승인 게이트가 필요한 작업이다.
   - 성공 기준: 승인 문구가 명확히 남는다.
   - 실패 시 다음 확인점: 승인 전에는 계속 no-write 상태로 두고, Slack 보고서는 revenue-history 기준 매출만 사용한다.
   - 승인 필요 여부: YES.
   - 의존성: 없음.
   - 추천 점수/자신감: 86%.

### Codex가 할 일

1. 승인 후 백업, 적재, 검증, 결과 문서 갱신을 순서대로 실행한다.
   - 무엇을 하는지: 2026-05 정산표 8건을 로컬 `coupang_settlements_api` cache에 넣고 검증한다.
   - 왜 하는지: 쿠팡 정산 대조를 최신 월 기준으로 만들기 위해서다.
   - 어떻게 하는지: 백업 command, 사전 스냅샷 SQL, 백필 script, 사후 검증 SQL, raw scan 순서로 실행한다.
   - 성공 기준: vendor별 row와 금액 합계가 preview와 맞고 중복이 없다.
   - 실패 시 다음 확인점: backup restore 후 API preview 변동, 스크립트 충돌, schema mismatch를 분리한다.
   - 승인 필요 여부: YES, 승인 후 실행.
   - 의존성: TJ님 승인.
   - 추천 점수/자신감: 86%.
