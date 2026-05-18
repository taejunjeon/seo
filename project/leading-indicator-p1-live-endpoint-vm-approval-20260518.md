# Leading Indicator P1 Live Endpoint VM Cloud 배포 승인안

작성 시각: 2026-05-19 00:02 KST
기준 작업일: 2026-05-18
문서 성격: Yellow Lane 승인안 / VM Cloud backend deploy packet
대상 기능: 구매 전 선행지표 분석 에이전트 P1 live aggregate endpoint
대상 API: `GET /api/attribution/leading-indicators`
대상 화면: `/ai-crm/leading-indicators`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - project/leading-indicator-aggregate-endpoint-design-20260518.md
    - project/biocom-meta-only-buyer-leaver-truth-table-20260518-3d.md
    - project/coffee-channel-cohort-truth-table-20260518-3d.md
  lane: Yellow
  allowed_actions_after_approval:
    - VM Cloud backend target file backup
    - deploy backend/src/leadingIndicators.ts
    - deploy backend/src/routes/attribution.ts scoped leading-indicators route change
    - deploy backend/src/bootstrap/startBackgroundJobs.ts scoped precompute worker registration
    - backend typecheck/build
    - seo-backend restart
    - read-only API smoke/post-check
    - response raw identifier scan
  forbidden_actions:
    - Meta CAPI send/backfill
    - GA4 Measurement Protocol send
    - Google Ads upload/send
    - TikTok/Naver/Meta/GA4 platform mutate
    - GTM submit/create_version/publish
    - Imweb header/footer save
    - operating DB write/import
    - VM Cloud schema migration
    - VM Cloud source ledger write
    - raw identifier report/chat/telegram/git output
  source_window_freshness_confidence:
    primary_source: VM Cloud SQLite attribution_ledger aggregate
    cross_check_source: GA4 BigQuery dry-run snapshots
    supported_window: 1d, 7d, 14d, 30d
    current_evidence_window: recent 3d and 7d dry-run
    freshness: live endpoint returns cache.cached_at_kst and source freshness
    confidence: medium_high deploy mechanics, medium behavior interpretation until row-level bridge improves
```

## 10초 요약

P1은 지금 프론트가 읽는 정적 snapshot을 VM Cloud live API로 바꾸기 위한 백엔드 준비 단계입니다.

승인하면 VM Cloud backend에 `GET /api/attribution/leading-indicators`를 붙이고, 백엔드가 30분 주기로 주요 조합을 미리 계산해 프론트가 빠르게 읽을 수 있게 합니다.

이 API는 주문/결제/click id 같은 raw identifier를 절대 내려주지 않고, 이미 묶인 cohort 숫자만 내려줍니다. Meta, GA4, Google Ads 등 외부 전송은 0입니다.

## 2026-05-19 GA4 Purchase Conflict 반영 결과

판정: 승인안 변경과 로컬 contract 보강을 반영했습니다.

현재 로컬 P1 endpoint는 `ga4_purchase_conflict`와 `pending_payment_success`를 순수 비결제자에서 분리합니다. 2026-05-18 3일 dry-run에서 확인된 충돌 2건 중 1건이 `vm_payment_success_not_confirmed`였기 때문에, `pending/unknown/canceled payment_success`를 일반 비결제자로 섞지 않도록 backend contract를 보강했습니다.

따라서 VM Cloud 배포 승인은 아래 조건으로 진행하는 것이 맞습니다.

1. 배포 조건:
   - `checkout_non_buyer`는 GA4 purchase conflict를 제외해야 합니다.
   - `checkout_non_buyer`는 pending/unknown/canceled payment_success도 제외해야 합니다.
   - `ga4_purchase_conflict_sessions`와 `ga4_purchase_conflict_rate_pct`가 응답에 있어야 합니다.
   - `pending_payment_success_sessions`와 `comparison.pending_payment_success`가 응답에 있어야 합니다.
   - post-check에서 conflict row가 non_buyer 평균에 섞이지 않았는지 확인해야 합니다.

2. 보강 완료 내용:
   - `pending_payment_success`를 별도 cohort로 노출합니다.
   - 이유: VM에는 `payment_success`가 있지만 confirmed가 아닌 row는 실제 미결제일 수도 있고, 확인 source가 늦은 실제 결제일 수도 있습니다. 이를 순수 이탈자로 섞으면 “광고 유입자가 왜 안 샀는가” 분석이 흐려집니다.

3. 승인안 변경 후 권장 순서:
   - 로컬 typecheck/build/API smoke 결과를 확인합니다.
   - 이 승인안으로 VM Cloud backend 배포/restart를 진행합니다.

현재 추천은 “보강된 contract 기준으로 배포”입니다. 외부 전송·운영DB write·GTM publish 없이 backend endpoint와 precompute worker만 반영합니다.

## 승인 문구

아래 문구로 승인하면 됩니다.

```text
[승인] Leading Indicator P1 live endpoint VM Cloud backend 배포/restart 진행.
범위는 backend/src/leadingIndicators.ts, backend/src/routes/attribution.ts,
backend/src/bootstrap/startBackgroundJobs.ts 배포와 read-only post-check까지.
외부 전송, 운영DB write, GTM publish, raw identifier 출력은 금지.
```

## 무엇이 바뀌나

### 사용자 입장 변화

현재 `/ai-crm/leading-indicators` 화면은 과거 dry-run JSON을 보고 있습니다. P1 backend가 붙으면 화면이 다음 단계로 넘어갈 수 있습니다.

- 오늘/최근 7일/최근 30일 기준 선행지표를 최신 캐시에서 읽습니다.
- 바이오컴과 더클린커피를 site별로 분리해서 봅니다.
- Meta 유입 결제자, 결제 직전 이탈자, GA4 구매 충돌 cohort를 분리해서 봅니다.
- “이탈자가 어디서 멈췄는지”, “결제자는 어떤 행동을 더 많이 했는지”를 raw 주문 없이 cohort 숫자로 봅니다.

### 백엔드 변화

VM Cloud backend에 아래 API를 추가합니다.

```text
GET /api/attribution/leading-indicators
  ?site=biocom|thecleancoffee
  &window=1d|7d|14d|30d
  &channel=meta|youtube|naver_paid_or_brand|organic|direct_or_unknown|all
  &dimension=buyer_vs_leaver|channel|landing_bucket|campaign|product
```

응답은 aggregate-only입니다.

```json
{
  "schema_version": "leading-indicators-v1",
  "site": "thecleancoffee",
  "window": "7d",
  "channel": "meta",
  "dimension": "buyer_vs_leaver",
  "cohort": {
    "safe_sessions": 0,
    "confirmed_buyer_sessions": 0,
    "checkout_non_buyer_sessions": 0,
    "ga4_purchase_conflict_sessions": 0,
    "pending_payment_success_sessions": 0,
    "ga4_purchase_conflict_rate_pct": null
  },
  "comparison": {
    "confirmed_buyer": { "sessions": 0 },
    "checkout_non_buyer": { "sessions": 0 },
    "ga4_purchase_conflict": { "sessions": 0 },
    "pending_payment_success": { "sessions": 0 }
  },
  "safety": {
    "raw_identifier_output": false,
    "external_platform_send": 0,
    "operating_db_write": 0,
    "vm_cloud_write": 0,
    "gtm_publish": 0,
    "aggregate_only": true
  }
}
```

## 왜 필요한가

매출과 ROAS는 후행 지표라서 결과가 나온 뒤에야 보입니다. P1 endpoint는 “구매 전에 어떤 행동이 구매를 예고하는지”를 매일 자동으로 볼 수 있게 만드는 기반입니다.

특히 더클린커피와 바이오컴은 유입 구조와 이벤트 품질이 다르므로, 같은 숫자로 합치면 안 됩니다. 이 API는 site를 반드시 분리하고, source/window/freshness/confidence를 함께 내려줍니다.

## 배포 대상

배포 대상은 아래 3개 backend 파일로 제한합니다.

```text
backend/src/leadingIndicators.ts
backend/src/routes/attribution.ts
backend/src/bootstrap/startBackgroundJobs.ts
```

프론트엔드 fetch 전환은 별도 Claude Code 작업입니다. 이번 승인안은 “VM Cloud backend에 live endpoint를 붙이고, 프론트가 붙을 수 있는 API를 준비하는 것”까지입니다.

## 승인 범위

1. VM Cloud pre-snapshot
   - `/health` 상태
   - `seo-backend` pm2 상태
   - 현재 배포 파일 checksum 또는 timestamp
   - 현재 `LEADING_INDICATORS_PRECOMPUTE_ENABLED` 환경값
   - 현재 `/api/attribution/leading-indicators` 존재 여부

2. Backup
   - VM Cloud에서 배포 대상 3개 파일을 timestamp backup 폴더에 보관합니다.
   - 기존 `backend/src/leadingIndicators.ts`가 없으면 “absent marker”를 기록합니다.

3. Deploy
   - 로컬 준비 파일 3개만 VM Cloud backend에 반영합니다.
   - unrelated dirty file은 배포하지 않습니다.

4. Build/typecheck
   - VM Cloud backend에서 typecheck/build를 실행합니다.
   - 실패하면 restart하지 않고 중단합니다.

5. Restart
   - `seo-backend`만 restart합니다.
   - 다른 process, frontend, GTM, Imweb은 건드리지 않습니다.

6. Post-check
   - read-only curl/API smoke만 수행합니다.
   - 외부 전송, DB write, GTM publish는 수행하지 않습니다.

## Precompute 설정

기본 원칙은 “화면 요청 때마다 큰 SQL을 돌리지 않고, backend가 미리 계산한 캐시를 읽게 한다”입니다.

권장 운영 설정:

```text
LEADING_INDICATORS_PRECOMPUTE_ENABLED=1
LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000
```

의미:

- 30분마다 주요 조합을 미리 계산합니다.
- 화면 첫 응답 목표는 500ms 이하입니다.
- 캐시가 비어 있거나 `freshness=force`일 때만 live 계산을 허용합니다.

사전 계산 대상 조합:

```text
biocom / 1d / meta / buyer_vs_leaver
biocom / 7d / meta / buyer_vs_leaver
biocom / 7d / meta / landing_bucket
biocom / 7d / all / channel
thecleancoffee / 1d / meta / buyer_vs_leaver
thecleancoffee / 7d / meta / buyer_vs_leaver
thecleancoffee / 7d / meta / landing_bucket
thecleancoffee / 7d / all / channel
```

## Post-check 기준

### API 200

아래 API가 모두 200이어야 합니다.

```text
/api/health
/api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=meta&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=biocom&window=7d&channel=meta&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=all&dimension=channel
```

### 응답 안전성

응답에는 아래 값이 있어야 합니다.

```text
safety.raw_identifier_output=false
safety.external_platform_send=0
safety.operating_db_write=0
safety.vm_cloud_write=0
safety.gtm_publish=0
safety.aggregate_only=true
```

응답에 아래 raw key/value가 나오면 실패입니다.

```text
order_code
order_no
payment_code
payment_key
member_id
member_code
email
phone
fbclid
gclid
client_id
user_pseudo_id
ga_session_id
```

단, `client_id_present`, `ga_session_id_present`처럼 presence를 나타내는 boolean/aggregate field는 허용합니다.

### cohort 분리

최소 아래 4개 cohort가 응답 또는 명시적인 breakdown에 포함되어야 합니다.

```text
confirmed_buyer
checkout_non_buyer
ga4_purchase_conflict
pending_payment_success
```

의미:

- `confirmed_buyer`: VM Cloud 기준 실제 결제완료로 닫힌 사람/세션 묶음
- `checkout_non_buyer`: VM confirmed purchase도 GA4 purchase도 pending payment_success도 없는 순수 비결제 묶음
- `ga4_purchase_conflict`: GA4에서는 purchase처럼 보이지만 VM Cloud confirmed purchase로 닫히지 않은 충돌 묶음
- `pending_payment_success`: VM에는 payment_success 흔적이 있으나 아직 confirmed로 닫히지 않은 보류 묶음

`ga4_purchase_conflict`와 `pending_payment_success`는 순수 비결제자 평균에 섞으면 안 됩니다.

### 성능

캐시 hit 기준 목표:

```text
response_ms <= 500ms
```

강제 live 계산 또는 cache miss 기준 허용:

```text
response_ms <= 10000ms
```

10초를 넘거나 backend CPU/memory가 급등하면 precompute 조합을 줄이고 rollback 후보로 봅니다.

## 성공 기준

성공 기준은 아래입니다.

- VM Cloud `/health` 200.
- `/api/attribution/leading-indicators` 200.
- site별로 `biocom`과 `thecleancoffee`가 분리됨.
- 응답에 `source`, `window`, `freshness`, `confidence`, `safety`가 포함됨.
- raw identifier output 0.
- 외부 platform send 0.
- 운영DB write 0.
- VM Cloud schema migration 0.
- GTM publish 0.
- cached response 500ms 이하.
- `ga4_purchase_conflict` cohort가 존재해 “GA4 purchase인데 내부 confirmed가 아닌 건”을 별도 분리함.
- `pending_payment_success`가 일반 비결제자에 섞이지 않음.
- 2026-05-18 3일 dry-run 기준 conflict 2건 같은 케이스가 `checkout_non_buyer` 평균에서 제외됨.

## 실패 조건

아래 중 하나라도 발생하면 실패입니다.

- backend build/typecheck 실패.
- `seo-backend` restart 후 `/health` 비정상.
- leading-indicators API 500.
- raw identifier가 API 응답에 노출됨.
- response가 site를 무시하고 biocom/coffee를 섞음.
- precompute worker가 5분 이상 반복 실패.
- 화면 요청마다 live 계산이 반복되어 backend hammer가 재발함.
- 외부 send/upload/write/publish가 발생함.

## Rollback

실패 시 rollback은 아래 원칙으로 합니다.

1. `LEADING_INDICATORS_PRECOMPUTE_ENABLED=0`으로 worker를 끕니다.
2. backup 폴더의 기존 파일 3개를 원복합니다.
3. backend build를 다시 실행합니다.
4. `seo-backend`만 restart합니다.
5. `/health` 200과 기존 funnel-health/roas endpoint 정상 여부를 확인합니다.
6. 프론트는 P0 정적 JSON 화면으로 남겨두며, P1 fetch 전환은 진행하지 않습니다.

## 예상 리스크와 해석

### 1. 바이오컴 row-level bridge가 아직 완벽하지 않음

바이오컴은 GA4와 VM Cloud가 같은 사람/주문으로 붙는 비율이 아직 중간 수준입니다. 그래서 P1 API는 “Meta 광고 유입 결제자/비결제자 확정값”이라고 과장하지 않고, `confidence`와 `ga4_purchase_conflict`를 같이 내려야 합니다.

### 2. 더클린커피는 GTM 이벤트명이 정리 중

더클린커피는 `begin_checkout`을 AGENTSOS 태그로 보강했고, 기존 HURDLERS/HURDLES 명칭이 아직 일부 남아 있습니다. P1 API는 이벤트명을 표준화된 funnel 단계로 매핑하되, source field에 원본 이름을 caveat로 남겨야 합니다.

### 3. precompute cache가 비면 첫 요청이 느릴 수 있음

restart 직후 첫 tick 전에는 live fallback이 실행될 수 있습니다. 그래서 post-check에서 cache source와 generation time을 반드시 확인합니다.

## Codex 실행 순서

승인 후 Codex는 아래 순서로 진행합니다.

1. VM Cloud pre-snapshot을 찍습니다.
2. 배포 대상 3개 파일을 backup합니다.
3. 로컬 준비 파일 3개만 scp/rsync로 반영합니다.
4. VM Cloud backend typecheck/build를 실행합니다.
5. `seo-backend`를 restart합니다.
6. `/health`와 leading-indicators API를 smoke합니다.
7. raw identifier 응답 scan을 실행합니다.
8. 결과를 이 문서 또는 신규 결과 문서에 기록합니다.

## 승인 후 하지 않는 것

이번 승인으로 아래 작업은 하지 않습니다.

- 프론트 fetch 전환 배포.
- Meta CAPI 추가 전송.
- GA4 Measurement Protocol 전송.
- Google Ads upload.
- GTM publish.
- Imweb 코드 저장.
- 운영DB write/import.
- VM Cloud schema migration.
- raw 주문/결제/member/click id 출력.

## 2026-05-19 로컬 검증 결과

로컬 backend contract 보강 후 아래 검증을 완료했습니다.

```text
npm run typecheck PASS
npm run build PASS
synthetic cohort smoke PASS
local API smoke PASS
```

synthetic cohort smoke에서는 4개 safe session을 넣어 아래 분리가 확인됐습니다.

```json
{
  "confirmed_buyer_sessions": 1,
  "checkout_non_buyer_sessions": 1,
  "ga4_purchase_conflict_sessions": 1,
  "pending_payment_success_sessions": 1
}
```

local API smoke에서는 `/api/attribution/leading-indicators?site=biocom&window=1d&channel=meta&dimension=buyer_vs_leaver&force=true`가 200으로 응답했고, `cohort.pending_payment_success_sessions`와 `comparison.pending_payment_success`가 포함됐습니다.

## 다음 단계

### 이번 승인 직후

VM Cloud backend API를 붙이고, Claude Code가 프론트를 정적 JSON import에서 live fetch로 바꿀 수 있는 상태를 만듭니다.

### 다음 승인 또는 작업

프론트 전환은 별도 작업입니다.

```text
P0: 정적 dry-run JSON 화면
P1 backend: live aggregate endpoint 준비
P1 frontend: dry-run import를 fetch로 교체
P2: daily monitor와 action queue 연결
```

## 최종 추천

진행 추천: 92%

이유:

- 이미 로컬 backend에 endpoint와 precompute skeleton이 준비되어 있습니다.
- 응답은 aggregate-only라 raw id 노출과 외부 전송 리스크가 낮습니다.
- VM Cloud backend deploy/restart는 Yellow Lane이라 승인은 필요하지만, 기능상 다음 단계로 넘어가기 위해 필요합니다.
- 남은 핵심 리스크는 해석 정확도이며, 이는 `confidence`, `source`, `ga4_purchase_conflict` cohort로 화면에서 분리 표시할 수 있습니다.
