# hurdlers_ga4 Purchase 값 준비 태그 — Draft 설계안

작성: 2026-04-21 00:15 KST
대상: biocom GTM `GTM-W2Z6PHN` workspace 146 (Default)
상태: **Workspace commit 완료, publish 미실행**
근거: [[gptfeedback_gtm_0420_1reply]] §12 (근본 원인) + TJ 2026-04-21 지시사항 (데이터 준비 태그 + tag sequencing + vbank guard)
관련: [[gtm]] v3 (2026-04-20 publish 완료)

---

## 10초 요약

- **목적**: 결제완료 페이지에서 [143] HURDLERS 구매 태그가 `transaction_id/value/items/shipping` 을 읽기 전에 **`hurdlers_ga4` dataLayer 값을 preparing push** 하여 items/value 빈 값 문제 해결
- **수단**: 새 Custom HTML 태그 [251] + 태그 [154] 의 `setupTag` 로 연결 (tag sequencing)
- **금지 준수**: `gtag('event','purchase')` / `event: 'purchase'` / `event: 'hurdlers_purchase'` / `event: 'conversion'` 재push **전부 없음**. 오직 `hurdlers_ga4: {...}` 프로퍼티만 event 키 없이 push
- **Guard**: URL path + order_no + rk=S + `window.__seo_allow_purchase !== false` + sessionStorage idempotency — 가상계좌 미입금 차단
- **Publish**: ❌ 아직 안 함. 24-48h 관측 후 TJ 결정

---

## ① GTM Workspace 변경안

### 워크스페이스 상태

| 항목 | 값 |
|---|---|
| Container | `GTM-W2Z6PHN` (biocom.kr, id `13158774`) |
| Workspace | 146 Default (v136 publish 후 자동 생성) |
| Pending changes (작업 후) | 2건 |
| Publish | ❌ 실행하지 않음 |

### 변경 1 — 신규 태그 [251] 생성

| 속성 | 값 |
|---|---|
| tagId | **251** |
| name | `biocom - [데이터 준비] hurdlers_ga4 purchase 값 주입 (Claude)` |
| type | `html` (Custom HTML) |
| parentFolderId | `37` (biocom.kr 폴더 — HURDLERS 폴더 분리) |
| firingTriggerId | `[]` **빈 배열** — 자체 트리거 없음 |
| blockingTriggerId | 없음 |
| supportDocumentWrite | `false` |
| setupTag / teardownTag | 없음 |
| notes | Claude Code draft 2026-04-21. setupTag 로만 실행. event 키 없는 prep push. 가상계좌 guard 포함. |

**핵심 설계 포인트**
- `firingTriggerId: []` 로 설정 — 이 태그는 **자체 트리거로 절대 발사되지 않음**. 오직 다른 태그의 setupTag 로만 실행됨.
- 이로써 실수로 다른 이벤트 (page_view 등) 에서 발사되는 위험을 원천 차단.

### 변경 2 — 태그 [154] `HURDLERS - [데이터레이어] 구매` 의 `setupTag` 추가

| 변경 전 | 변경 후 |
|---|---|
| `setupTag: []` | `setupTag: [{tagName: "biocom - [데이터 준비] hurdlers_ga4 purchase 값 주입 (Claude)"}]` |
| fingerprint `1756796645863` | `1776698860195` |

**GTM Tag Sequencing 동작**
- Trigger `hurdlers_purchase` 가 발사되어 [154] 가 실행될 직전에 GTM 이 setupTag 목록을 먼저 실행
- [251] 이 dataLayer push 를 완료한 후에만 [154] 가 실행됨
- [154] 가 `{{HURDLERS - GA4 Transaction_id}}` 변수 평가할 때 [251] 이 방금 push 한 최신 `hurdlers_ga4.transaction_id` 를 읽음
- [154] 가 `HurdlersTracker.pushEvent('h_purchase', a)` 로 `h_purchase` 이벤트를 쏘면, 그 이벤트로 [143] 이 발사됨 → [143] 의 `{{HURDLERS - GA4 Transaction_id}}` / `Value` / `상품정보` 도 모두 채워진 상태
- 같은 원리로 [128] HURDLERS - [이벤트전송] 네이버페이 구매 (`add_payment_info`) 도 `h_add_payment_info` 이벤트 트리거 내부라 영향 없음. 영향받는 건 `hurdlers_purchase → h_purchase` 체인뿐

### HTML 본문 요약 (전체 코드는 `backend/gtm_draft_prep_tag.mjs` 참조)

```js
(function(){
  // Guard 1: URL path contains 'shop_payment_complete'
  // Guard 2: URLSearchParams.order_no 존재
  // Guard 3: URL rk 가 있으면 'S' 여야 함 (가상계좌 미입금 차단 핵심)
  // Guard 4: window.__seo_allow_purchase !== false (header guard 플래그 존중)
  // Guard 5: sessionStorage idempotency — 같은 order_no 반복 실행 방지

  // Value 추출 우선순위:
  //   1. eventModel.value  ← dlv_price_vlaue 변수가 읽는 경로
  //   2. ecommerce.value
  //   3. hurdlers_ga4.value (기존 값이 있으면 유지)

  // Items 추출 우선순위:
  //   1. hurdlers_ga4.items (기존 값 유지)
  //   2. ecommerce.items

  // dataLayer.push 내용 — **event 키 없음**:
  window.dataLayer.push({
    hurdlers_ga4: { transaction_id, value, items, shipping: 0, currency: 'KRW' },
    _seo_hurdlers_ga4_prep: { /* 디버그용 메타 */ }
  });
})();
```

**금지 항목 준수 확인**:
- ❌ `gtag('event', 'purchase', ...)` — 호출 없음
- ❌ `dataLayer.push({event: 'purchase'})` — 없음
- ❌ `dataLayer.push({event: 'hurdlers_purchase'})` — 없음
- ❌ `dataLayer.push({event: 'conversion'})` — 없음
- ✅ `dataLayer.push({hurdlers_ga4: {...}})` 만 수행 (event 키 없음 → GTM 이벤트 유발 안 함)

### 가상계좌 미입금 Guard 상세

**현 상황**: 가상계좌 주문생성 단계에서 URL 이 `shop_payment_complete?...` 로 들어오고, HURDLERS 플러그인이 `hurdlers_purchase` 를 dataLayer 에 push 하여 [154]/[143] 이 발사됨. 이게 [[gptfeedback_gtm_0420_1reply]] §4 "2층 문제".

**이 태그의 Guard 로직**:

| Guard | 조건 | 가상계좌 미입금 시 효과 |
|---|---|---|
| G1 Path | `location.pathname.indexOf('shop_payment_complete') !== -1` | 가상계좌 주문생성 URL 도 같은 path. **통과** |
| G2 order_no | `URLSearchParams.get('order_no')` 존재 | 가상계좌 주문서에도 order_no 있음. **통과** |
| G3 rk=S | `URLSearchParams.get('rk')` 없거나 `'S'` 여야 함 | Toss/PG 결제완료 성공 마커. 가상계좌 주문생성 URL 에 `rk=S` 가 있는지 확인 필요. **Preview 1번째로 검증할 항목** |
| G4 allow_purchase | `window.__seo_allow_purchase === false` 면 skip | `header_purchase_guard_server_decision_0412_v3.md` 가 설정하는 플래그. 현재 구현 확인 필요 |
| G5 idempotency | `sessionStorage['__seo_hurdlers_ga4_prepared__:{order_no}']` | 같은 order_no 중복 실행 방지 |

**만약 가상계좌 주문생성 URL 에도 `rk=S` 가 있다면 G3 로는 차단 불가**. 그 경우 G4 로 방어하거나 추가 DOM-기반 guard (예: `.vbank-pending-notice` 같은 페이지 내 텍스트 감지) 가 필요. Preview 에서 확정 필요.

**G3 는 currently "없거나 'S'" 로 설계**. 즉 rk 파라미터 자체가 없는 URL 도 통과. 근거:
- 과거 Imweb 결제완료 URL 샘플에서 일부는 rk 없이도 성공 상태였을 가능성 (레거시 링크)
- 운영상 False Negative (정상 결제인데 prep 안 됨) 보다 False Positive (가상계좌 미입금에 prep 됨) 쪽이 덜 위험 — [143] 자체는 이미 상시 발사 중이고 value 가 0 이므로 이번 prep 로 value>0 이 들어가면 GA4 revenue 가 늘어나는 건 **맞는 revenue 만큼** (만약 가상계좌 미입금을 잘못 포함한다면 vbank_expired 와 연결된 2층 문제가 악화)
- **그래서 Preview 에서 가상계좌 시나리오의 URL 에 `rk=?` 가 어떤 값인지 확인이 핵심**

Preview 결과에 따라 로직 조정:
- 만약 가상계좌 주문생성 URL 에 `rk=` 없음 → G3 를 더 엄격하게 `rk === 'S'` 로 변경 (없으면 skip)
- 만약 가상계좌 URL 에도 `rk=S` 있음 → G4 의 `__seo_allow_purchase` 활용 또는 DOM guard 추가

---

## ② Preview 체크리스트

TJ 는 **GTM UI 에서 Preview 모드 진입 후 biocom.kr 접속**. 각 시나리오별 확인 포인트:

### 시나리오 A — 카드 주문완료 (성공)

1. [ ] `biocom - [데이터 준비] hurdlers_ga4 purchase 값 주입 (Claude)` [251] **1회 실행됨**
2. [ ] [251] 실행 시점이 [154] `HURDLERS - [데이터레이어] 구매` **직전** (setupTag 순서 확인)
3. [ ] **변수 탭** → `HURDLERS - GA4 Transaction_id` [121] 값 = URL `order_no`
4. [ ] **변수 탭** → `HURDLERS - GA4 Value` [125] 값 = 실제 주문 금액 (not 0)
5. [ ] **변수 탭** → `HURDLERS - GA4 상품정보` [122] 값 = 빈 배열이 아닌 실제 상품 배열 (또는 여전히 빈 배열이면 dataLayer 에 items 가 없는 상태라 prep 태그가 default `[]` 를 유지)
6. [ ] **태그 탭** → [143] `HURDLERS - [이벤트전송] 구매` 실행 시 eventSettingsTable 평가값에서 items/value/transaction_id 모두 채워짐
7. [ ] **Data Layer 탭** → `hurdlers_ga4` 객체에 `transaction_id/value/items/shipping/currency` 정상
8. [ ] **Data Layer 탭** → `_seo_hurdlers_ga4_prep` 디버그 객체 존재 (`value_source`, `items_source` 확인)
9. [ ] **콘솔** → `[seo-hurdlers-prep] order_no=... value=... items=...` 로그 1회
10. [ ] **중복 발사 없음** — [251] 이 정확히 1회만

### 시나리오 B — 네이버페이 주문완료

11. [ ] 시나리오 A 와 동일 검증
12. [ ] [43] `GA4_구매전환_Npay` 실행 시 `transaction_id` 파라미터에 URL `order_no` 가 들어가는지 (이미 publish 된 v136 동작 확인 겸)

### 시나리오 C — 가상계좌 주문생성 (미입금) ★ 핵심

13. [ ] URL 확인 — `rk=` 파라미터 값이 무엇인지 기록 (S / F / 없음)
14. [ ] Data Layer 탭 → `_seo_hurdlers_ga4_prep` 객체 **부재 여부** 확인 — 존재하면 guard 통과해 버렸다는 뜻
15. [ ] [251] 이 **발사되지 않음** (태그 탭에서 "실행되지 않음" 에 있어야 함)
16. [ ] 만약 [251] 이 실행됐으면 → `_seo_hurdlers_ga4_prep` 객체의 `rk` 값 확인 → G3 guard 강화 필요
17. [ ] 기존 [154]/[143] 은 여전히 발사되지만 `hurdlers_ga4.value` 는 여전히 빈 값 (prep 태그가 차단했으므로)

### 시나리오 D — 비구매 페이지 (홈 / 상세 / 장바구니)

18. [ ] [251] 이 **절대 실행되지 않음** (URL path guard)

### 시나리오 E — 결제완료 페이지 새로고침 / 뒤로가기

19. [ ] sessionStorage idempotency guard 로 **2번째 실행 시 dataLayer push 안 함** 확인
20. [ ] 콘솔에 `[seo-hurdlers-prep]` 로그가 2회 나오지 않음

### 시나리오 F — URL 에 order_no 없는 `shop_payment_complete` 접근

21. [ ] [251] 조기 return 되어 dataLayer push 없음 (G2 guard)

### 통과 기준

- A, B 모든 항목 체크 + C 14-17 확인 + D/E/F 조건 만족 → **publish 준비 완료**
- C 에서 [251] 이 가상계좌 미입금에 실행되면 → **publish 전 guard 강화** (`rk === 'S'` 엄격화 또는 DOM 가드 추가)

---

## ③ Rollback Plan

### Rollback 조건

| 상황 | 조치 |
|---|---|
| Preview 에서 C 시나리오 guard 실패 | 태그 [251] HTML 코드만 수정. workspace 상태는 유지 |
| Preview 에서 [154] 가 정상 발사되지 않음 (setup failure) | setupTag 의 `stopOnSetupFailure: false` 로 설정돼 있으니 [154] 는 계속 실행됨. 단 prep 실패 시 원래 빈 값 상태와 동일하게 회귀 (= 현재 live 와 같음) |
| Preview 에서 실수로 `event: 'purchase'` 등 금지 이벤트 발견 | 즉시 workspace 변경 삭제. HTML 본문에 금지 문자열 정적 검사 자동화 |
| Publish 후 운영 트래픽에서 문제 | 이전 live 버전 `136` 으로 강제 롤백 (아래 API) |

### Rollback 방법 A — Publish 전 (현재 단계)

Workspace 146 에 변경 두 건 pending. 둘 다 개별 revert 가능:

**1) 태그 [251] 삭제**
```
DELETE /tagmanager/v2/accounts/4703003246/containers/13158774/workspaces/146/tags/251
```

**2) 태그 [154] setupTag 원복**
```js
// PUT tags/154 with setupTag: []
```

**또는 workspace 전체 리셋**: 
- GTM UI → Default Workspace → "편집 내용 되돌리기" → 변경 사항 모두 무효화 (workspace 146 은 v136 시점 상태로 되돌아감)

### Rollback 방법 B — Publish 후 (만약 미래에 publish 한다면)

**1) 이전 버전 136 으로 강제 publish**
```
POST /tagmanager/v2/accounts/4703003246/containers/13158774/versions/136:publish
```
- 즉시 효과. biocom.kr 방문자가 136 버전 컨테이너 로드
- 하지만 브라우저 캐시 때문에 일부 사용자는 최대 몇 분간 신버전 유지 가능

**2) 또는 새 버전 만들어 롤백 commit**
- workspace 에서 태그 [251] 삭제 + [154] setupTag 제거 → 새 version 생성 → publish

### Rollback 시간 목표

- Publish 전: **즉시** (workspace 편집만으로 충분)
- Publish 후: **5분 이내** (API 로 136 재publish)

### Rollback 영향 분석

**태그 [251] 제거 + [154] setupTag 원복 시**:
- [143] transaction_id: fallback 변수 [250] 덕에 여전히 URL `order_no` 로 복구 (v136 에서 publish 된 상태 유지)
- [143] value/items: 다시 빈 값으로 복귀 (rollback 전과 동일)
- [48] transaction_id: 여전히 fallback 변수 참조 (v136 유지)
- GA4 revenue 영향: `dlv_price_vlaue` 로 value 를 채우는 [48] 경로가 그대로 남아 있으므로 GA4 revenue 집계는 계속 유효
- **순수 회귀: prep 도입 이전 상태로 돌아감** → 서비스 장애 없음

---

## ④ Publish 전후 검증 쿼리 (BigQuery)

### Baseline (publish 전)

publish 결정 전에 최소 24~48h 동안 **v136 (지금 상태) 의 효과**를 먼저 관측. 다음 3개 쿼리를 BQ Console 에서 실행해 기준선 확보.

**Q1. transaction_id `(not set)` 추이 (지난 14일)**

```sql
SELECT 
  event_date,
  COUNT(*) AS total_purchase,
  COUNTIF((SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') = '(not set)'
       OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') IS NULL
       OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') = '') AS not_set_count,
  SAFE_DIVIDE(
    COUNTIF((SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') = '(not set)'
         OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') IS NULL
         OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') = ''),
    COUNT(*)
  ) AS not_set_ratio
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 14 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Seoul'))
  AND event_name = 'purchase'
GROUP BY event_date
ORDER BY event_date;
```

**기대**: 2026-04-20 publish 이전 일자는 이전 수치 유지, 2026-04-21 이후는 0 또는 극소. 이 자체가 v136 효과 측정.

**Q2. purchase 이벤트의 value=0 비율 (지난 14일)**

```sql
SELECT 
  event_date,
  COUNT(*) AS total_purchase,
  COUNTIF((SELECT value.double_value FROM UNNEST(event_params) WHERE key='value') = 0
       OR (SELECT value.double_value FROM UNNEST(event_params) WHERE key='value') IS NULL) AS value_zero,
  SAFE_DIVIDE(
    COUNTIF((SELECT value.double_value FROM UNNEST(event_params) WHERE key='value') = 0
         OR (SELECT value.double_value FROM UNNEST(event_params) WHERE key='value') IS NULL),
    COUNT(*)
  ) AS value_zero_ratio,
  SUM(COALESCE((SELECT value.double_value FROM UNNEST(event_params) WHERE key='value'), 0)) AS total_revenue
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 14 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Seoul'))
  AND event_name = 'purchase'
GROUP BY event_date
ORDER BY event_date;
```

**기대**: prep 태그 publish 전 `value_zero_ratio` 는 상당히 높을 것 (HURDLERS dataLayer 빈 값 + [143] 이 value=0 으로 발사). publish 후 이 비율이 [48] 의 `dlv_price_vlaue` 경로와 합쳐져 감소.

**Q3. 같은 transaction_id 에 purchase 가 중복 집계되는 건수**

```sql
SELECT 
  tx_id,
  COUNT(*) AS purchase_events,
  ARRAY_AGG(DISTINCT pay_method IGNORE NULLS LIMIT 5) AS pay_methods,
  MAX(event_timestamp) - MIN(event_timestamp) AS ts_spread_us
FROM (
  SELECT 
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') AS tx_id,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key='pay_method') AS pay_method,
    event_timestamp
  FROM `hurdlers-naver-pay.analytics_304759974.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 7 DAY))
    AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Seoul'))
    AND event_name = 'purchase'
)
WHERE tx_id IS NOT NULL AND tx_id NOT IN ('(not set)', '')
GROUP BY tx_id
HAVING purchase_events >= 2
ORDER BY purchase_events DESC, tx_id
LIMIT 100;
```

**기대**: v136 publish 후 [143] + [48] 이 같은 transaction_id 로 들어가는 케이스가 증가. GA4 dedup 이 이를 병합하면 GA4 리포트 purchase 수는 감소하되 revenue 는 유지. 이 쿼리로 "얼마나 중복됐고 얼마나 dedup 됐는지" 확인 가능. 특히 pay_methods 배열이 `['homepage']` + `[null]` 같이 혼합되면 [48] 이 단독 + [143] 이 pay_method 없이 각각 들어온 흔적.

### Post-publish (prep 태그 publish 후 48h)

**Q4. `hurdlers_ga4.items` 가 채워진 purchase 비율 — GA4 리포트 / BQ 양쪽**

```sql
-- GA4 raw BQ: items 는 separate items 배열이 아닌 event_params 에 들어가지 않음
-- GA4 는 items 를 별도 repeated record 로 저장
SELECT 
  event_date,
  COUNT(*) AS total_purchase,
  COUNTIF(ARRAY_LENGTH(items) > 0) AS has_items_count,
  SAFE_DIVIDE(COUNTIF(ARRAY_LENGTH(items) > 0), COUNT(*)) AS has_items_ratio,
  AVG(ARRAY_LENGTH(items)) AS avg_items_per_purchase
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 7 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Seoul'))
  AND event_name = 'purchase'
GROUP BY event_date
ORDER BY event_date;
```

**기대**: prep 태그 publish 후 `has_items_ratio` 가 크게 증가. prep 태그가 URL/dataLayer 에서 items 를 못 찾으면 빈 배열로 default — 이 경우 여전히 0 남음.

**Q5. Debug prep 객체 존재 확인 (publish 후 실측)**

prep 태그가 `_seo_hurdlers_ga4_prep` 디버그 객체도 push 하지만 이는 GA4 로 전송되는 이벤트 파라미터가 아니라 순수 dataLayer 레코드. BQ 에서 조회 불가. 대신 **GA4 DebugView 또는 Realtime 에서 purchase 이벤트 직접 확인** — transaction_id / value / items 가 모두 채워졌는지.

**Q6. prep 태그 이후 가상계좌 guard 실효성 (publish 후)**

```sql
-- 가상계좌 미입금 주문을 판별하려면 로컬 Toss 데이터와 조인 필요.
-- 로컬 DB 쪽에서:
SELECT 
  DATE(l.logged_at) AS d,
  COUNT(DISTINCT l.order_id) AS new_orders,
  SUM(CASE WHEN t.status = 'WAITING_FOR_DEPOSIT' THEN 1 ELSE 0 END) AS vbank_pending,
  SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) AS completed
FROM attribution_ledger l
LEFT JOIN toss_transactions t ON t.order_id = l.order_id
WHERE l.logged_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY d ORDER BY d;
```

**활용**: GA4 BigQuery raw 에서 동일 transaction_id 를 찾아 "가상계좌 미입금 건이 GA4 purchase 에도 기록됐는지" 교차검증. prep 태그 guard 가 작동하면 가상계좌 미입금의 GA4 value 는 0 또는 prep 되지 않은 상태로 남아야 함.

### 판정 기준

| 지표 | publish 승인 기준 |
|---|---|
| Q1 `not_set_ratio` | 2026-04-20 이후 1% 미만 유지 (v136 효과 확증) |
| Q2 `value_zero_ratio` | v136 publish 후 측정값 유지 (prep 태그 publish 후 추가 감소 예상) |
| Q3 duplicate tx count | 크게 증가하면 안 됨 — 증가하되 안정 범위 |
| Q4 `has_items_ratio` | **publish 후** 큰 폭 상승 확인 시 성공 |
| Q5 DebugView | purchase 이벤트에 transaction_id/value/items 모두 채워짐 |
| Q6 가상계좌 guard | 가상계좌 미입금 건이 GA4 value>0 으로 기록 안 됨 |

---

## 자동화 / 운영 자료

| 파일 | 역할 |
|---|---|
| `backend/gtm_draft_prep_tag.mjs` | 신규 태그 [251] 생성 + [154] setupTag 연결. 재실행 가능 (멱등 아님 — tag 중복 생성 주의) |
| `backend/gtm_apply.mjs` | 변수 [250] 생성 + 태그 [143] 교체 (v1, 완료) |
| `backend/gtm_apply_48_43.mjs` | 태그 [48]/[43] transaction_id append (v2, 완료) |
| `backend/gtm_publish.mjs` | workspace → version → publish 자동화 (v136 이미 실행) |
| `backend/gtm_playwright_test.mjs` | biocom.kr + workspace preview 접속 테스트 |

**Publish 를 다시 하려면**:
1. `gtm_publish.mjs` 의 `VERSION_NAME` / `VERSION_NOTES` 를 새 값으로 변경
2. `node gtm_publish.mjs` 실행
3. 버전 생성 + publish + live 매칭 확인까지 1분 내 완료

**지금은 실행 금지** (TJ 지시).

---

## 다음 단계 (TJ)

1. **24-48h 대기**: v136 효과 관측 (TJ 권고안 원칙 4)
2. Q1/Q2/Q3 BQ 실행 → baseline 수치 기록
3. GTM Preview 로 §② 체크리스트 A/B/C/D/E/F 실행
4. C 시나리오에서 가상계좌 URL 의 `rk=?` 값 확정
5. 필요 시 [251] HTML guard 강화 (rk 엄격화 등)
6. 모든 체크 통과하고 24-48h 지나면 TJ 가 publish 승인 → `gtm_publish.mjs` 재실행 (Claude 가 대신 실행 가능)
7. publish 후 48h 내 Q4/Q5/Q6 실행해 효과 검증

## 버전 기록

- **v2** (2026-04-21 00:45 KST): 태그 [251] HTML 을 `dataLayer.push()` → `google_tag_manager['GTM-W2Z6PHN'].dataLayer.set()` 방식으로 재작성. 피드백 [[gptfeedback_gtm_0421_2]] 수용. Guard 로그 강화 (`GUARD_BLOCKED` / `SET_OK` / `SET_FAIL`). 디버그 push key 분리 (`_seo_hurdlers_ga4_prep_debug`). 금지 4개 정적 검증 통과. workspace 146 draft 유지, publish 없음. 결과 기록: [[gptfeedback_gtm_0421_2reply]].
- **v1** (2026-04-21 00:15 KST): 최초 작성. 태그 [251] + [154] setupTag 연결 workspace commit. publish 전 산출물 4개 (변경안/체크리스트/롤백/검증쿼리) 정리.
