# reportcoffee weekly aggregate scripts 20260522

작성 시각: 2026-05-22 00:51 KST
기준일: 2026-05-21
문서 성격: 더클린커피 주간 매출 집계 스크립트 결과
담당: Codex
관련 문서: [[reportcoffee]], [[reportcoffee-selfmall-dedupe-rule-20260522]], [[reportcoffee-coupang-source-readiness-20260522]]

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - data/!data_inventory.md
    - report/reportcoffee.md
  lane: Green
  allowed_actions:
    - local_read_only_script
    - coupang_read_only_api_aggregate
    - local_json_markdown_output
    - no_send_preview_input
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: local SQLite imweb_orders smoke + Coupang Wing TeamKeto ordersheets API
    window: 2026-05-15 - 2026-05-21 KST
    freshness: NPay local DB stale, Coupang API fresh
    confidence: high for script behavior, medium for NPay amount until VM Cloud fresh DB run
```

## 10초 요약

더클린커피 주간 보고에서 비어 있던 두 칸을 채우는 집계 경로를 만들었다.

NPay는 주문 원장(`imweb_orders`)에서 주간 합계를 뽑는 스크립트를 만들었고, 쿠팡은 TeamKeto 주문서 API에서 고객/주문 식별자 없이 금액과 제품 분류만 뽑는 스크립트를 만들었다. 로컬 DB는 더클린커피 NPay가 2026-04-04에서 멈춰 있어 실제 주간 NPay 금액은 VM Cloud fresh DB에서 같은 스크립트를 실행해야 한다. 쿠팡은 2026-05-15 - 2026-05-21 기준 41건 / 1,968,100원이 read-only로 확인됐다.

## 만든 파일

- `backend/scripts/reportcoffee-npay-weekly-aggregate.ts`
- `backend/scripts/reportcoffee-coupang-teamketo-ordersheets-aggregate.ts`
- `report/reportcoffee-npay-weekly-aggregate-smoke-20260522.json`
- `report/reportcoffee-coupang-teamketo-ordersheets-weekly-smoke-20260522.json`
- `report/reportcoffee-weekly-aggregate-scripts-20260522.json`

## NPay 주간 집계 경로

목적은 NPay 클릭이나 결제 시작이 아니라 실제 결제완료 후보 금액만 주간으로 뽑는 것이다.

집계 기준:

- site: `thecleancoffee`
- 결제수단: `pay_type=npay`
- 금액: `payment_amount > 0`
- 기간: KST `--start` - `--end`
- 제외: `imweb_status`가 `CANCEL`, `RETURN`, `EXCHANGE`
- 진단 전용: `complete_time`, `imweb_status`, `imweb_status_synced_at`

실행 예:

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/reportcoffee-npay-weekly-aggregate.ts \
  --site=thecleancoffee \
  --start=2026-05-15 \
  --end=2026-05-21 \
  --out ../report/reportcoffee-npay-weekly-aggregate-smoke-20260522.json
```

VM Cloud fresh DB에서 실행할 때는 DB 경로만 바꾼다.

```bash
CRM_LOCAL_DB_PATH=/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 \
npx tsx scripts/reportcoffee-npay-weekly-aggregate.ts \
  --site=thecleancoffee \
  --start=2026-05-15 \
  --end=2026-05-21
```

로컬 smoke 결과:

- window: 2026-05-15 - 2026-05-21 KST
- 로컬 NPay actual: 0건 / 0원
- 이유: 로컬 `imweb_orders(site='thecleancoffee', pay_type='npay')` 최신 주문 시간이 2026-04-04다.
- 판정: 스크립트는 PASS, 금액은 `source_freshness_gap`으로 VM Cloud fresh DB 실행 필요.

## 쿠팡 TeamKeto 주문서 집계

목적은 더클린커피 쿠팡 매출을 현재 주간 보고에 붙일 수 있는지 확인하는 것이다.

집계 기준:

- 계정: `teamketo`
- source: Coupang Wing ordersheets API
- 기간: KST `--start` - `--end`
- status: `ACCEPT`, `INSTRUCT`, `DEPARTURE`, `DELIVERING`, `FINAL_DELIVERY`, `NONE_TRACKING`
- 출력: 주문서 수, 상품 수, 수량, 금액, 상태별 합계, 일별 합계, 제품 분류, 상위 상품
- 미출력: 주문번호, 배송지, 수취인, 전화, 이메일, 결제키

실행 예:

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/reportcoffee-coupang-teamketo-ordersheets-aggregate.ts \
  --start=2026-05-15 \
  --end=2026-05-21 \
  --delayMs=450 \
  --topProducts=10 \
  --out ../report/reportcoffee-coupang-teamketo-ordersheets-weekly-smoke-20260522.json
```

2026-05-15 - 2026-05-21 KST smoke 결과:

- API calls: 42
- API errors: 0
- 주문서: 41건
- 상품 row: 43건
- 수량: 44개
- 금액: 1,968,100원
- coffee hint: 30개 row / 31개 / 1,044,900원
- teamketo hint: 13개 row / 13개 / 923,200원

상위 상품은 `report/reportcoffee-coupang-teamketo-ordersheets-weekly-smoke-20260522.json`에 제품명과 합계만 남겼다. 고객/주문 식별자는 남기지 않았다.

## 현재 리포트 영향

이번 작업으로 더클린커피 주간 보고의 쿠팡 칸은 `source pending`에서 `TeamKeto ordersheets API included candidate`로 올릴 수 있다.

단, TeamKeto 계정에는 커피 상품과 팀키토 상품이 같이 들어 있으므로 Slack 보고에서는 먼저 둘을 나눠 표시하는 것이 안전하다.

NPay 주간 칸은 경로가 생겼지만, 로컬 DB가 낡아서 실제 숫자는 아직 채우면 안 된다. VM Cloud fresh DB에서 같은 스크립트를 read-only로 실행하면 Slack 주간 자사몰 매출의 NPay 부분을 채울 수 있다.

## Track 진척률

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 38% | 42% | +4% |
| B | 더클린커피 매출 source 확인 | 68% | 78% | +10% |
| C | 더클린커피 광고비 source 확인 | 35% | 35% | +0% |
| D | 바이오컴 리포트 source map | 10% | 10% | +0% |
| E | Slack no-send 메시지 설계 | 40% | 42% | +2% |
| F | 자동화/배포 readiness | 15% | 28% | +13% |

## 다음 할일

1. Codex가 VM Cloud fresh DB에서 NPay 주간 합계를 read-only로 실행한다.
   이유: 로컬 DB는 2026-04-04에서 멈춰 있어 2026-05-15 - 2026-05-21 주간 숫자를 못 만든다.
   성공 기준: NPay actual count/amount/max_order_time이 2026-05-21까지 나온다.
   Lane: Green if read-only SSH/query only.
   추천 점수/자신감: 91%.

2. Codex가 더클린커피 Slack no-send preview에 쿠팡 TeamKeto 합계를 붙인다.
   이유: 쿠팡이 `source pending`에서 포함 후보로 올라왔으므로 총매출 분모를 더 현실적으로 만들 수 있다.
   성공 기준: 자사몰, 스마트스토어, 쿠팡, Meta 광고비가 같은 KST window로 한 메시지에 보인다.
   Lane: Green.
   추천 점수/자신감: 88%.

3. TJ님은 아직 할 일이 없다.
   이유: 현재 남은 작업은 read-only 실행과 no-send preview라 Codex가 대신 할 수 있다.
   성공 기준: Slack 실제 발송 전 preview 문구와 source warning을 보고 승인 여부만 판단하면 된다.
   승인 필요: 실제 Slack 발송 단계에서만 YES.
   추천 점수/자신감: 95%.
