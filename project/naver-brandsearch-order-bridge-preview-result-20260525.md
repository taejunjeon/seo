# Naver 브랜드검색 주문 단위 bridge preview 결과

작성 시각: 2026-05-25 23:10 KST
기준일: 2026-05-25
문서 성격: 브랜드검색 유입 marker와 주문 정본을 주문 단위로 붙이는 read-only/no-send preview 결과
상위 문서: [[naver-brandsearch-roas-preview-result-20260525]], [[naver-brandsearch-order-source-crosscheck-result-20260525]], [[naver-brandsearch-manual-cost-source-policy-20260525]]
산출 JSON: `data/project/naver-brandsearch-order-bridge-preview-20260525.json`
프론트엔드 화면: `frontend/src/app/ads/naver-roas/page.tsx`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - frontrule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
  required_context_docs:
    - project/naver-brandsearch-roas-preview-result-20260525.md
    - project/naver-brandsearch-order-source-crosscheck-result-20260525.md
    - project/naver-brandsearch-manual-cost-source-policy-20260525.md
    - report/reportbiocom.md
    - report/reportcoffee.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only aggregate query
    - operating DB read-only aggregate query
    - local no-send reader script creation
    - local JSON preview generation
    - local frontend route implementation
    - documentation update
  forbidden_actions:
    - VM Cloud SQLite write
    - operating DB write
    - backend deploy/restart
    - Naver Ads setting change
    - Naver conversion send/upload
    - GA4/Meta/Google/TikTok platform send
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud site_landing_ledger + attribution_ledger + imweb_orders, operating DB tb_iamweb_users
    window: biocom 2026-05-22..2026-05-25 KST, thecleancoffee 2026-05-11..2026-05-25 KST
    freshness: queried 2026-05-25 23:10 KST, cost cache max cached_at 2026-05-25 12:52:49, landing/attribution max 2026-05-25T14:04:42Z, coffee imweb max order_time 2026-05-25T13:32:47Z, operating DB max source date 2026-05-25
    confidence: medium_high for thecleancoffee exact bridge, low for biocom until 5 unresolved marker rows are classified
```

## 10초 요약

브랜드검색으로 들어와 결제완료 marker가 붙은 주문을 주문 정본과 같은 주문 단위로 다시 대조했다.

결론은 더클린커피는 현재 잡힌 marker 11건이 모두 주문 정본과 exact로 붙는다. 바이오컴은 marker 18건 중 13건만 exact이고, 2건은 ambiguous, 3건은 no_bridge라서 예산 판단 전 원인 분해가 필요하다.

## 만든 것

### reader

파일:

```text
backend/scripts/naver-brandsearch-order-bridge-preview.ts
```

실행:

```bash
cd backend
npx tsx scripts/naver-brandsearch-order-bridge-preview.ts \
  --output=../data/project/naver-brandsearch-order-bridge-preview-20260525.json
```

mode:

```text
read_only_no_send_no_write
```

보안 기준:

- 주문키 비교는 SHA-256 one-way hash로만 했다.
- raw 주문번호, 결제키, 고객키, 클릭 식별자, email, phone 출력은 하지 않았다.
- VM Cloud와 운영DB 모두 read-only로만 조회했다.

### 화면

로컬 프론트엔드 route:

```text
/ads/naver-roas
```

화면 역할:

- 브랜드검색 비용
- 브랜드검색 marker ROAS
- 주문 정본 exact bridge ROAS
- site별 confidence
- OKR 진척률
- 액션플랜

을 한 페이지에서 본다.

## bridge preview 결과

| site | window | 브랜드검색 비용 | marker 결제완료 | exact bridge | ambiguous | no_bridge | marker ROAS | exact bridge ROAS | 판단 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| biocom | 2026-05-22..2026-05-25 | 205,336원 | 18건 / 4,786,416원 | 13건 / 3,364,432원 | 2건 | 3건 | 23.31 | 16.39 | 남은 5건 분해 전까지 confidence low |
| thecleancoffee | 2026-05-11..2026-05-25 | 770,005원 | 11건 / 352,564원 | 11건 / 352,564원 | 0건 | 0건 | 0.46 | 0.46 | 현재 marker 범위에서는 confidence medium_high |

## 숫자 해석

### marker ROAS

브랜드검색 marker ROAS는 브랜드검색 유입 흔적이 붙은 결제완료 marker 금액을 비용으로 나눈 값이다.

이 값은 빠르게 흐름을 보는 참고값이다. 주문 정본과 같은 주문으로 붙었는지까지는 보장하지 않는다.

### exact bridge ROAS

exact bridge ROAS는 marker row의 주문키 후보가 주문 정본의 주문키와 일치한 매출만 비용으로 나눈 값이다.

예산 판단에는 marker ROAS보다 exact bridge ROAS를 더 보수적으로 우선한다. 다만 바이오컴은 unresolved 5건이 남아 있어 최종 확정값은 아니다.

### 주문 정본 같은-window 총매출

주문 정본 같은-window 총매출은 사이트 전체 결제완료 매출 sanity check다.

브랜드검색으로 온 매출이 아니다. 브랜드검색 exact 매출과 같은 표에 두되 예산 판단값으로 섞지 않는다.

## OKR 진척률

| KR | 현재 진척률 | 상태 | 근거 |
|---|---:|---|---|
| KR1 비용 source를 수동 계약 기간 배분 cache로 고정 | 100% | done | TJ님 확정 계약 금액을 VM Cloud 비용 cache에 적재했고 reader가 site/window별 비용을 읽음 |
| KR2 브랜드검색 marker ROAS를 site/window별로 산출 | 90% | on_track | biocom 23.31, thecleancoffee 0.46 marker ROAS 산출 |
| KR3 주문 정본과 marker를 주문 단위로 bridge | 83% | needs_work | 전체 marker 29건 중 exact 24건, biocom 5건 unresolved |
| KR4 운영자가 볼 수 있는 Naver ROAS 화면 제공 | 90% | on_track | `/ads/naver-roas` 로컬 화면 구현, 검증 단계 |

## 하지 않은 것

- VM Cloud SQLite write 0건.
- 운영DB write 0건.
- backend deploy/restart 0건.
- Naver Ads 설정 변경 0건.
- Naver conversion send/upload 0건.
- GA4/Meta/Google/TikTok platform send 0건.
- GTM publish 0건.
- raw 주문/결제/고객/클릭 식별자 출력 0건.

## 다음 할일

### Auto Green

1. 바이오컴 unresolved 5건을 분해한다.
   - 무엇: ambiguous 2건과 no_bridge 3건을 `missing_order_key`, `운영DB sync lag`, `amount/date duplicate`, `source mapping gap` 중 하나로 분류한다.
   - 왜: 바이오컴 exact bridge ROAS 16.39와 marker ROAS 23.31 차이가 예산 판단에 영향을 준다.
   - 어떻게: raw 식별자 출력 없이 hash/count/amount bucket 기준으로 read-only 재조회한다.
   - 성공 기준: 5건이 모두 원인 bucket으로 분류된다.
   - 승인 필요: NO.

2. Naver ROAS 화면을 API 연결 승인안으로 분리한다.
   - 무엇: 현재 정적 결과 화면을 backend API로 자동 갱신할 때 필요한 배포 승인안을 만든다.
   - 왜: 운영자가 매번 JSON을 갱신하지 않고 화면에서 최신 비용과 bridge 결과를 보려면 필요하다.
   - 성공 기준: 변경 파일, pre-snapshot, deploy command, rollback, post-smoke가 포함된다.
   - 승인 필요: 문서 작성은 NO, 실제 deploy는 YES.

### Approval Needed

1. backend API route 연결과 배포.
   - 무엇: `naver_brandsearch_manual_cost_daily`와 bridge preview 결과를 대시보드 API로 제공한다.
   - 왜: `/ads/naver-roas`를 운영형 대시보드로 쓰려면 최신 데이터가 자동으로 들어와야 한다.
   - 승인 필요: YES, backend deploy/restart가 필요할 수 있다.

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
Lane: Green
Reader execution: PASS
Frontend local implementation: PASS_PENDING_BROWSER_VERIFY
No-send: YES
No-write: YES
No-deploy: YES
No-publish: YES
Source confidence: medium_high for thecleancoffee, low for biocom unresolved rows
```
