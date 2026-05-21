작성 시각: 2026-05-21 09:45 KST
기준일: 2026-05-21
문서 성격: Google Ads 주문 기준 24시간 click id health 백엔드 설계

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - gdn/google-ads-campaignid-url-suffix-approval-20260521.md
    - gdn/google-ads-gad-campaignid-campaign-matching-design-20260520.md
  lane: Green
  allowed_actions:
    - local_code_inspection
    - live_public_api_read_only_check
    - local_design_doc_write
  forbidden_actions:
    - operating_db_write
    - vm_cloud_write
    - google_ads_conversion_upload
    - google_ads_ui_change
    - gtm_publish
    - deploy_or_restart
  source_window_freshness_confidence:
    source: backend code inspection + VM Cloud public read-only API
    window: design based on last_7d and rolling 24h landing snapshot
    site: biocom
    freshness: 2026-05-21 09:25~09:45 KST 확인
    confidence: high for backend limitation, medium_high for proposed API design
```

# Google Ads 주문 기준 24시간 click id health 백엔드 설계

## 10초 요약

현재 `/ads/google-roas-report`의 click id health는 주문 기준으로는 `last_7d/last_30d` 같은 완료일 프리셋만 본다. `last_24h`를 넣어도 백엔드가 `last_30d`로 되돌리므로, "최근 24시간 동안 실제 결제완료 주문까지 Google click id가 살아남았는가"를 정확히 볼 수 없다.

해결책은 Google Ads 대시보드 전체를 다시 무겁게 호출하는 것이 아니라, 주문 기준 click id health만 읽는 가벼운 백엔드 API를 별도로 만드는 것이다. 이 API는 운영DB 결제완료 주문을 분모로 두고, VM Cloud attribution/intent 원장을 광고 클릭 evidence로 붙인다. 외부 전송, Google Ads upload, 운영DB write는 전혀 하지 않는다.

운영 화면의 기본값은 rolling 24h보다 `last_1d`가 낫다. 여기서 `last_1d`는 "최근 24시간"이 아니라 **어제 00:00~23:59:59 KST 결제완료일 기준**이다. rolling 24h는 URL suffix 반영 직후 smoke, 수집 장애 감지, 당일 이상 징후 확인용 보조 지표로 둔다.

## 현재 구조에서 확인된 문제

Source: local backend code inspection, live public API read-only
Window: 2026-05-21 09:25~09:45 KST 확인
Site: biocom
Confidence: high

1. `backend/src/routes/googleAds.ts`의 `DATE_PRESETS`는 `last_7d`, `last_14d`, `last_30d`, `last_90d`만 지원한다.
2. `parseDatePreset()`은 모르는 값이 들어오면 에러를 내지 않고 `last_30d`로 fallback한다.
3. 실제로 `date_preset=last_24h` 호출은 `returnedDatePreset=last_30d`로 돌아온다.
4. 기존 `buildGoogleAdsClickIdHealth()`는 `resolvePresetDateRange()`를 통해 "오늘 제외, 어제까지의 KST 완료일" 범위를 만든다.
5. `/api/attribution/site-landing/summary?windowHours=24`는 rolling 24h를 지원하지만, 이것은 랜딩 기준이다. 주문 기준 보존률이 아니다.

따라서 부족한 것은 프론트 문구가 아니라 백엔드 contract다.

## 지표 정의

### 사람이 보는 이름

`최근 24시간 주문 기준 Google click id 보존률`

### 쉬운 뜻

최근 24시간 동안 실제 결제완료된 주문 중에서, 고객이 Google 광고를 클릭했다는 식별자(`gclid/gbraid/wbraid`)가 내부 evidence 원장까지 이어진 비율이다.

### 분모

운영DB `public.tb_iamweb_users`의 biocom 실제 결제완료 주문.

V1 권장 필터:

- `payment_complete_time`이 rolling 24h 범위 안에 있음
- `payment_status = 'PAYMENT_COMPLETE'`
- 취소/반품/환불 사유 없음
- 주문 금액 양수
- order number 존재

기존 `last_7d` health와 숫자를 맞춰야 하는 경우에는 `order_date` fallback을 진단값으로만 별도 표시한다. 24시간 지표의 primary는 `payment_complete_time`이어야 한다.

### 분자

분모 주문 중 VM Cloud evidence에서 Google click id가 확인된 주문.

V1 exact evidence:

1. `attribution_ledger`
   - `touchpoint = 'payment_success'`
   - `payment_status = 'confirmed'`
   - `source = 'biocom_imweb'`
   - `order_id`, `payment_key`, metadata의 `order_number`, `channelOrderNo` 중 하나가 운영DB 주문과 exact match
   - `gclid`, `gbraid`, `wbraid`, landing/referrer URL query, metadata firstTouch 중 하나에 Google click id evidence 존재
2. `npay_intent_log`
   - `site = 'biocom'`
   - `environment = 'live'`
   - `matched_order_no`가 운영DB `order_number`와 exact match
   - `gclid`, `gbraid`, `wbraid`, page URL query 중 하나 존재

V1에서는 fuzzy time-window matching을 넣지 않는다. 여러 후보가 붙는 순간 ROAS 판단이 오염되기 때문이다.

## API 설계

### 새 endpoint

```text
GET /api/google-ads/click-id-health?site=biocom&window=last_1d
```

왜 별도 endpoint인가:

- `/api/google-ads/dashboard`는 Google Ads API 호출, 캠페인 지표, 내부 ROAS reconciliation을 함께 수행해서 무겁다.
- click id health는 운영DB와 VM Cloud SQLite read-only만 있으면 된다.
- 24시간 카드는 자주 새로고침될 가능성이 있어 Google Ads API rate limit과 분리하는 것이 안전하다.

### 지원 window

```ts
type GoogleAdsClickIdHealthWindowKey =
  | "last_1d"
  | "rolling_24h"
  | "last_7d"
  | "last_30d";
```

권장 기본값은 `last_1d`다.

- `last_1d`: 어제 00:00~23:59:59 KST 결제완료일 기준. 운영 판단/사전계산/일별 리포트 기본값.
- `rolling_24h`: 조회 시각 기준 직전 24시간. 신규 수집 smoke와 최신 이상 감지용.
- `last_7d`, `last_30d`: 기존 화면과 비교용. 오늘 제외, 어제까지 완료일 기준.

### 응답 예시

```json
{
  "ok": true,
  "site": "biocom",
  "window": {
    "key": "last_1d",
    "label": "전일 완료일 기준",
    "timezone": "Asia/Seoul",
    "startAt": "2026-05-20T00:00:00.000+09:00",
    "endExclusiveAt": "2026-05-21T00:00:00.000+09:00",
    "basis": "payment_complete_time"
  },
  "source": {
    "orders": "operational_db.public.tb_iamweb_users",
    "evidence": [
      "vm_cloud_sqlite.attribution_ledger",
      "vm_cloud_sqlite.npay_intent_log"
    ],
    "mode": "read_only_no_send"
  },
  "orderCount": 42,
  "totalValueKrw": 12345678,
  "withGoogleClickId": 4,
  "missingGoogleClickId": 38,
  "preservationRate": 0.0952,
  "clickIdBreakdown": {
    "gclid": 3,
    "gbraid": 1,
    "wbraid": 0
  },
  "paymentMethodBreakdown": [
    {
      "paymentMethod": "homepage",
      "orders": 35,
      "withGoogleClickId": 4,
      "missingGoogleClickId": 31,
      "preservationRate": 0.1143
    },
    {
      "paymentMethod": "npay",
      "orders": 7,
      "withGoogleClickId": 0,
      "missingGoogleClickId": 7,
      "preservationRate": 0
    }
  ],
  "evidenceBreakdown": {
    "paymentSuccessLedger": 3,
    "npayIntentExact": 1,
    "both": 0,
    "none": 38
  },
  "blockReasonCounts": {
    "readOnlyPhase": 42,
    "approvalRequired": 42,
    "missingGoogleClickId": 38,
    "missingAttributionVmEvidence": 12,
    "orderDateFallbackExcluded": 0
  },
  "invariants": {
    "uploadCandidateCount": 0,
    "sendCandidateCount": 0,
    "externalSendCount": 0,
    "operationalDbWrite": 0,
    "rawClickIdInResponse": false
  },
  "sourceFreshness": {
    "source": "operational_db_tb_iamweb_users",
    "maxOrderDateKst": "2026-05-21 18:00:13.000 KST",
    "maxPaymentCompleteKst": "2026-05-21 09:00:17.000 KST",
    "syncLagMinutes": 0,
    "status": "fresh",
    "warnings": []
  },
  "caveats": [
    "이 지표는 read-only health다. Google Ads conversion upload 후보가 아니다.",
    "분모는 실제 결제완료 주문, 분자는 Google click id evidence exact match다.",
    "NPay fuzzy matching은 제외한다."
  ]
}
```

## 백엔드 구현 계획

### Step 1. window resolver 분리

현재 `resolvePresetDateRange()`는 일 단위 프리셋만 처리한다. 24시간 지표에는 맞지 않는다.

추가할 helper:

```ts
type ClickIdHealthWindow = {
  key: GoogleAdsClickIdHealthWindowKey;
  label: string;
  timezone: "Asia/Seoul";
  startAt: string;
  endExclusiveAt: string;
  startDate: string;
  endDate: string;
  basis: "payment_complete_time";
  isRolling: boolean;
};
```

중요한 수정:

- `readGoogleClickIdHealthOrders()`가 더 이상 `shiftIsoDate(range.endDate, 1)`로 끝 시각을 만들면 안 된다.
- 반드시 `range.endExclusiveAt`을 그대로 SQL `$2`에 넣는다.
- 이렇게 해야 `rolling_24h`가 오늘 밤 24시까지 늘어나는 오류를 막을 수 있다.

### Step 2. 주문 조회 함수를 actual 기준으로 고정

권장 함수명:

```ts
const readGoogleClickIdHealthOrdersForWindow = async (
  window: ClickIdHealthWindow,
): Promise<GoogleAdsClickIdHealthOrderRow[]>
```

SQL 변경 방향:

- `paid_at`은 `payment_complete_time::timestamptz` primary
- `payment_complete_time`이 없는 row는 V1 분모에서 제외
- 기존 호환이 필요하면 `orderDateFallbackExcluded`로 따로 count
- `payment_status = 'PAYMENT_COMPLETE'`를 명시
- 취소/반품/환불 제외

이 변경은 24h endpoint에 먼저 적용한다. 기존 dashboard `last_7d`의 숫자가 갑자기 바뀌는 것은 별도 스프린트로 둔다.

### Step 3. 계산기 재사용

기존 `buildGoogleAdsClickIdHealth(datePreset, freshness)`는 유지하되 내부 계산기를 분리한다.

```ts
const buildGoogleAdsClickIdHealthForWindow = async (
  window: ClickIdHealthWindow,
  sourceFreshness: OperationalDbFreshness,
): Promise<GoogleAdsClickIdHealthResponse>
```

기존 dashboard는 이 계산기를 `last_7d/last_30d` window로 호출한다. 새 endpoint는 `rolling_24h` window로 호출한다.

### Step 4. 새 route 추가

권장 위치: `backend/src/routes/googleAds.ts`

```ts
router.get("/api/google-ads/click-id-health", async (req, res) => {
  const site = parseSite(req.query.site);
  const windowKey = parseClickIdHealthWindow(req.query.window);
  const window = resolveClickIdHealthWindow(windowKey, new Date());
  const sourceFreshness = await buildOperationalDbFreshness();
  const health = await buildGoogleAdsClickIdHealthForWindow(window, sourceFreshness);
  res.json({ ok: true, site, ...health });
});
```

`site=biocom`만 V1에서 허용한다. 다른 site는 400 또는 `unsupported_site`로 명확히 반환한다.

### Step 5. silent fallback 제거

새 endpoint에서는 unsupported window를 절대 `last_30d`로 fallback하지 않는다.

응답:

```json
{
  "ok": false,
  "error": "unsupported_window",
  "allowedWindows": ["last_1d", "rolling_24h", "last_7d", "last_30d"]
}
```

기존 `/api/google-ads/dashboard?date_preset=last_24h`의 fallback은 호환성 때문에 당장 깨지 않더라도, 응답에 `warnings`를 추가하는 것이 좋다.

## 프론트 반영 계획

V1에서는 `/ads/google-roas-report` 상단 health 영역에 별도 카드를 추가한다.

카드 이름:

`주문 기준 click id 보존률`

표시 문구:

- 기본값: `전일 완료일 기준`
- 보조값: `최근 24시간(조회 시각 기준)`
- `분모: 실제 결제완료 주문`
- `분자: 주문 exact evidence에 Google click id가 남은 주문`
- `외부 전송 없음 / upload 후보 0건`

기존 `Google click id 보존률` 카드와 다른 점:

- 기존 카드는 dashboard preset 기준이다.
- 새 카드는 기본적으로 전일 완료일 주문 기준이다.
- rolling 24h는 카드 안의 보조 탭 또는 진단 배지로만 둔다.
- landing 기준 24h와 섞지 않는다.

## 검증 계획

### 로컬 검증

1. TypeScript typecheck
   - `npm --prefix backend run typecheck` 또는 repo에서 쓰는 backend typecheck 명령
2. API smoke
   - `curl 'http://localhost:7020/api/google-ads/click-id-health?site=biocom&window=last_1d'`
   - `curl 'http://localhost:7020/api/google-ads/click-id-health?site=biocom&window=rolling_24h'`
3. unsupported window smoke
   - `curl 'http://localhost:7020/api/google-ads/click-id-health?site=biocom&window=last_24h'`
   - 기대값: 400 `unsupported_window`
4. raw click id 노출 확인
   - 응답에 `gclid`, `gbraid`, `wbraid` 원문이 없어야 한다.

### 운영 배포 후 smoke

운영 배포는 별도 Yellow 승인 필요.

1. `/api/google-ads/click-id-health?site=biocom&window=rolling_24h` 200
2. `mode=read_only_no_send`
3. `invariants.uploadCandidateCount=0`
4. `sourceFreshness.status`가 `fresh` 또는 `lagged`
5. 프론트 카드가 기존 last_7d 카드와 다른 window임을 명확히 표시

## 100% 조건

1. 백엔드가 `last_1d`와 rolling 24h 주문 기준 health를 `last_30d` fallback 없이 반환한다.
2. 분모가 실제 결제완료 주문임을 응답에 명시한다.
3. landing 기준 24h와 주문 기준 24h를 화면에서 혼동하지 않는다.
4. raw click id 원문을 응답하지 않는다.
5. upload/send 후보는 계속 0건이다.
6. 운영DB/VM Cloud write, Google Ads conversion upload, GTM publish가 없다.

## 로컬 구현 결과

Source: local backend API, operational DB `public.tb_iamweb_users`, VM Cloud SQLite evidence read-only
Window: 2026-05-21 10:15~10:17 KST 확인
Site: biocom
Freshness: 운영DB `maxPaymentCompleteKst=2026-05-21 00:00:17 KST`, sync lag 약 76분
Confidence: high for endpoint contract, medium for live preservation rate because 운영DB sync is lagged

구현된 endpoint:

```text
GET /api/google-ads/click-id-health?site=biocom&window=last_1d
GET /api/google-ads/click-id-health?site=biocom&window=rolling_24h
```

로컬 smoke 결과:

| window | 기준 | 주문수 | 주문금액 | Google click id evidence | 보존률 | 판정 |
|---|---|---:|---:|---:|---:|---|
| `last_1d` | 2026-05-20 00:00~24:00 KST 완료일 | 60 | ₩11,638,229 | 0 | 0% | endpoint 정상, evidence 없음 |
| `rolling_24h` | 2026-05-20 10:16~2026-05-21 10:16 KST 완료시각 | 46 | ₩10,524,050 | 0 | 0% | endpoint 정상, evidence 없음 |

추가 smoke:

- `window=last_24h`는 400 `unsupported_window`를 반환한다.
- 허용 window는 `last_1d`, `rolling_24h`, `last_7d`, `last_30d`다.
- 응답 invariants는 `uploadCandidateCount=0`, `sendCandidateCount=0`, `externalSendCount=0`, `operationalDbWrite=0`, `vmCloudWrite=0`, `rawClickIdInResponse=false`다.
- 응답에는 raw `gclid/gbraid/wbraid` 원문을 싣지 않는다.

해석:

현재 로컬 endpoint는 "주문 기준 분모"를 계산할 수 있다. 다만 Google click id가 주문 exact evidence까지 이어진 주문은 아직 0건이다. 이 0%는 endpoint 실패가 아니라, VM Cloud evidence 원장에 주문과 exact match되는 Google click id가 아직 붙지 않았다는 뜻으로 해석한다.

## 하지 않는 것

| 항목 | 이유 |
|---|---|
| Google Ads conversion upload | health 지표 설계 범위 밖이며 Red Lane |
| Google Ads UI URL suffix 변경 | 별도 승인안 범위 |
| 운영DB write | read-only 지표이므로 불필요 |
| VM Cloud schema 변경 | 기존 원장 read-only join만 사용 |
| fuzzy time-window attribution | 캠페인/주문 오염 위험 |
| 실제 광고 클릭/구매 테스트 | 설계 단계에서는 불필요 |

## 다음 구현 추천

### Auto Green

1. `ClickIdHealthWindow` resolver와 새 endpoint를 로컬 구현한다.
2. 기존 `last_7d` health와 새 `last_1d/rolling_24h` health를 같은 계산기로 묶되, 기존 화면 숫자는 갑자기 바꾸지 않는다.
3. `/ads/google-roas-report`에는 새 카드를 "전일 완료일 기준" 기본값으로 표시하고, rolling 24h는 진단용 보조값으로 둔다.

### Approval Needed

1. VM Cloud backend/frontend 배포.
2. 배포 후 30분/2시간/24시간 smoke.

### Blocked/Parked

1. Google Ads conversion upload.
2. Google Ads Primary 전환 변경.
3. 실제 결제 테스트.
