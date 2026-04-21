# GA4 Purchase 가상계좌 차단 — Exception Trigger Draft

작성: 2026-04-21 01:30 KST
대상: biocom GTM `GTM-W2Z6PHN` workspace 146
상태: **Workspace commit 완료, publish 미실행**
근거: [[gptfeedback_gtm_0421_2reply]] §13-5, TJ 2026-04-21 Go 승인
관련: [[gtm]] v5, [[../roadmap/confirmed_stopline]] C-Sprint 3 `vbank_expired` GA4 확장

## 10초 요약

- **목표**: GA4 `[143]` / `[48]` / `[154]` 가 가상계좌 미입금 주문에서 purchase 이벤트를 발사하지 않도록 차단
- **수단**: Custom JS Variable `JS - vbank blocked` + Exception Trigger `Exception - vbank blocked (all events)` + 3개 태그에 blockingTriggerId 연결
- **판단 근거**: `window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__.branch` 가 `block_*` (예: `block_purchase_virtual_account`) 이면 GA4 차단
- **범위**: Meta Pixel / TikTok 은 이미 server-decision-guard 가 차단 중. GA4 만 남은 구멍 — 이걸 같은 원칙으로 닫음
- **publish**: ❌ 미실행. Preview 필수

---

## ① GTM Workspace 변경안

### 변경 객체 (workspace 146 pending 6건 누적)

| 객체 | 종류 | id | 상태 |
|---|---|---:|---|
| **variable [252]** `JS - vbank blocked` | 신규 jsm | 252 | added |
| **trigger [253]** `Exception - vbank blocked (all events)` | 신규 customEvent | 253 | added |
| **tag [143]** `HURDLERS - [이벤트전송] 구매` | updated (blockingTriggerId += 253) | - | updated |
| **tag [48]** `GA4_구매전환_홈피구매` | updated (blockingTriggerId += 253) | - | updated |
| **tag [154]** `HURDLERS - [데이터레이어] 구매` | updated (blockingTriggerId += 253) | - | updated |
| tag [251] prep (이전 v3) | added | - | 유지 |

### Variable [252] `JS - vbank blocked`

- Type: `jsm` (Custom JavaScript)
- Folder: `37` (biocom.kr)
- Code:

```js
function() {
  try {
    var last = window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__;
    if (!last || typeof last.branch !== 'string') return false;
    return last.branch.indexOf('block_') === 0;
  } catch (e) {
    return false;
  }
}
```

**반환값**:
- `true`: branch 가 `block_purchase_virtual_account` / `block_purchase_pending` / `block_purchase_refunded` 등 **block_ 접두어**
- `false`: branch 가 없거나 `allow_purchase` / 기타 — 정상 발사 허용

**설계 원칙**:
- 실패 안전 (fail-safe): 객체나 속성이 없으면 `false` 반환 → **기존 동작 유지**. 즉 v136 live 와 완전히 동일한 발사 빈도부터 시작.
- branch 문자열을 신뢰 (guard 가 이미 canonical 상태 판정 완료)
- 추가 DOM/URL 조사 없음 → 성능 영향 미미

### Trigger [253] `Exception - vbank blocked (all events)`

- Type: `customEvent`
- Event name: `.*` (matchRegex) — **모든 customEvent 에 매칭**
- Filter: `{{JS - vbank blocked}}` **equals** `"true"` (문자열)
- Folder: `37`

**동작 방식**:
- Exception Trigger 는 primary firing trigger 와 **같은 이벤트 맥락**에서 평가됨
- [143] primary trigger `h_purchase` 가 발사되어 [143] 평가 시, 같은 `h_purchase` 이벤트에서 trigger [253] 도 평가
- 이때 `JS - vbank blocked == true` 이면 [253] fire → [143] 의 blockingTriggerId 목록에 있으므로 **[143] 발사 취소**

### 태그별 변경

| 태그 | 기존 blockingTriggerId | 변경 후 |
|---|---|---|
| [143] HURDLERS - [이벤트전송] 구매 | `[]` | `[253]` |
| [48] GA4_구매전환_홈피구매 | `[]` | `[253]` |
| [154] HURDLERS - [데이터레이어] 구매 | `[]` | `[253]` (Preview 에서 영향 별도 관찰 대상) |

### 금지 항목 준수 (변경 없음)

- `gtag('event','purchase')` 직접 호출: 없음
- `event: 'purchase'` / `'hurdlers_purchase'` / `'conversion'` 재push: 없음
- 이 변경은 **순수하게 차단만** 추가. 새 이벤트 발사 없음

---

## ② Preview 시나리오 3개

TJ 가 GTM Preview 모드 (workspace 146) 로 biocom.kr 접속하여 각 시나리오 실행.

### 시나리오 A — 카드 결제 (정상 플로우)

**기대**: 기존 v136 과 동일. Exception Trigger 는 fire 되지 않음.

1. [ ] `{{JS - vbank blocked}}` 변수 평가값 **`false`** (변수 탭에서 확인)
2. [ ] `Exception - vbank blocked (all events)` 트리거 **fire 되지 않음**
3. [ ] `[143] HURDLERS - [이벤트전송] 구매` **정상 발사** (`h_purchase` 이벤트)
4. [ ] `[48] GA4_구매전환_홈피구매` **정상 발사** (`conversion` 이벤트)
5. [ ] `[154] HURDLERS - [데이터레이어] 구매` **정상 발사**
6. [ ] `[251]` `SET_OK` 로그 + transaction_id/value/items 채워짐
7. [ ] GA4 Realtime 에서 purchase 이벤트 1회 기록 확인
8. [ ] Meta Pixel Purchase 정상 발사 (기존 동작 유지)

### 시나리오 B — 가상계좌 주문생성 (미입금) ★ 핵심

**기대**: Exception Trigger 가 fire 되어 GA4 purchase 3개 태그 모두 차단. Meta/TikTok 은 여전히 server-decision-guard 로 차단.

1. [ ] 콘솔 로그 확인:
   - `[biocom-server-payment-decision-guard] decision branch=block_purchase_virtual_account`
2. [ ] `{{JS - vbank blocked}}` 변수 평가값 **`true`**
3. [ ] `Exception - vbank blocked (all events)` 트리거 **fire 됨** (`h_purchase` 이벤트에서)
4. [ ] **[143] 차단 확인** — "태그 실행 안 됨" 목록에 있음, 이유 "차단 트리거" 노출
5. [ ] **[48] 차단 확인** — 동일 ("실행되지 않은 태그" 목록에 `Exception ...` 로 블록 표시)
6. [ ] **[154] 차단 확인** — 동일
7. [ ] **이건 별도 관찰**: [154] 차단으로 인해 다른 태그/이벤트가 안 쏘이게 되는 부작용이 있는지 점검 (아래 §2-B-부작용 체크)
8. [ ] `[251]` prep 태그의 동작: G3 server-branch guard 로 `GUARD_BLOCKED` 로그 출력 + dataLayer.set 실행 안 됨
9. [ ] GA4 Realtime 에서 해당 주문의 purchase 이벤트 **미기록** 확인
10. [ ] Meta Pixel `VirtualAccountIssued` 이벤트는 **정상 발사** (기존 동작 유지)
11. [ ] TikTok `PlaceAnOrder` replacement 도 정상

**2-B 부작용 체크 리스트**:
- [ ] 채널톡_구매전환 발사 여부 — 가상계좌에서 발사되는지 확인 (기존 v136 에서는 발사됐음)
- [ ] `h_purchase` dataLayer 자체는 push 되는가 (HURDLERS 플러그인 외부 의존성 확인)
- [ ] 주문서 재확인 페이지 같은 곳의 다른 태그 영향

**[154] 만 별도로 unblock 해야 할 경우**: blockingTriggerId 에서 [154] 만 제거 → 태그 [154] 는 `h_purchase` dataLayer 만 push 하게 두고 [143]/[48] 에서만 차단. 피드백 §6 안전 순서 준수.

### 시나리오 C — 네이버페이 결제 (선택, 이전 관측 재확인)

**기대**: NPay 는 결제완료 페이지 미도달로 원래부터 [143]/[48]/[251] 발사 안 됨 ([[npay_return_missing_20260421]]). 이번 변경 영향 없어야 함.

1. [ ] NPay 버튼 클릭 → [118] + [128] (`add_payment_info`) + [248] 정상 발사
2. [ ] 네이버 로그인 → 결제 → biocom 복귀 안 됨 (기존과 동일)
3. [ ] 이번 변경으로 **아무 것도 바뀌지 않음** 확인
4. [ ] `{{JS - vbank blocked}}` 는 페이지 로드 시 평가될 일이 없음 (biocom 이탈)

### Preview 통과 기준

- A 정상: 체크 1~8 모두 OK
- B vbank 차단: 체크 1~6 OK, 7 부작용 없음
- C NPay: 변경 없음 확인
- 통과 시 → publish 안내 (별도 TJ 승인 필요)

---

## ③ Rollback Plan

### 즉시 조치 (publish 전)

지금 상태는 workspace 146 pending only. live v136 에 영향 없음. rollback 불필요.

**draft 만 되돌리려면**:

**방법 A — 태그별 blockingTriggerId 제거**:
```bash
node backend/gtm_rollback_exception.mjs   # (아래 §7 참조. 필요 시 작성)
```
- 태그 [143] / [48] / [154] 의 `blockingTriggerId` 에서 `253` 제거
- 트리거 [253] 삭제
- 변수 [252] 삭제

**방법 B — Workspace 전체 리셋 (GTM UI)**:
- https://tagmanager.google.com → Default Workspace 146 → "편집 내용 되돌리기" → workspace 가 v136 시점 상태로 복귀

### Publish 후 Rollback (만약 미래 publish 후 문제 발생)

**시나리오 1 — GA4 purchase 가 전부 안 쏘이게 됨 (JS 변수가 실수로 항상 true 반환)**:
- 즉시 대응 (5분 이내): `versions/136:publish` 로 v136 재publish — 이번 변경 전부 되돌아감
```bash
# 수동 실행 예시 (backend/gtm_rollback_to_v136.mjs 필요 시 작성)
POST /tagmanager/v2/accounts/4703003246/containers/13158774/versions/136:publish
```

**시나리오 2 — 의도하지 않은 태그까지 차단**:
- blockingTriggerId 범위가 너무 넓으면 부분 rollback: 특정 태그만 blockingTriggerId 에서 253 제거하는 새 버전 → publish
- 예: [154] 차단 부작용이 큰 경우 → [154] 만 unblock

**시나리오 3 — 변수 [252] 평가 오류 (branch 읽기 실패 등)**:
- 변수 [252] 는 fail-safe (catch → false) 설계라 최악의 경우에도 `차단 안 함` = 기존 v136 동작
- 추가 rollback 불필요, 로그만 점검

### Rollback 시간 목표

- Publish 전: **0분** (workspace 편집만)
- Publish 후 치명 오류: **5분 이내** (v136 재publish)
- Publish 후 부분 조정: **30분** (새 버전 만들어 부분 unblock)

### Rollback 영향

| 상황 | 복구 후 상태 |
|---|---|
| workspace draft 제거 | v136 상태로 돌아감. 기존 `(not set)` 감소 효과 유지. GA4 vbank purchase 오염 재발 |
| v136 재publish (v136 이후 변경 모두 롤백) | fallback 변수 [250] 유지 + [143]/[48]/[43] transaction_id 채워짐 유지. vbank guard 없는 상태로 복귀 |

---

## ④ Publish 전후 검증 쿼리 (BigQuery)

### Baseline (publish 전 또는 publish 직후)

**Q1. 가상계좌 미입금 주문의 GA4 purchase 기록 비중 (최근 30일)**

```sql
-- GA4 raw 에서 purchase 이벤트 + local toss_transactions 대조는 BQ 직접 join 어려움
-- 대신 비슷한 proxy: pay_method=vbank 인 purchase 이벤트 count
SELECT 
  DATE(TIMESTAMP_MICROS(event_timestamp), 'Asia/Seoul') AS d,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='pay_method') AS pay_method,
  COUNT(*) AS purchase_events,
  SUM(COALESCE((SELECT value.double_value FROM UNNEST(event_params) WHERE key='value'), 0)) AS total_value
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 30 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Seoul'))
  AND event_name = 'purchase'
GROUP BY d, pay_method
ORDER BY d DESC, purchase_events DESC;
```

**기대 (publish 전)**: `pay_method=vbank` 이 상당 수 purchase events (GA4 오염) 로 존재.
**기대 (publish 후 7-14일)**: `pay_method=vbank` purchase events 가 **큰 폭 감소** (guard 작동).

**Q2. 로컬 DB 와 GA4 간 가상계좌 미입금 비교**

```sql
-- 로컬 biocom SQLite 에서 vbank pending 주문 수
SELECT 
  DATE(o.logged_at) AS d,
  COUNT(*) AS vbank_orders,
  SUM(CASE WHEN t.status = 'WAITING_FOR_DEPOSIT' THEN 1 ELSE 0 END) AS vbank_pending,
  SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) AS vbank_completed,
  SUM(o.gross) AS vbank_gross_krw
FROM imweb_orders o
LEFT JOIN toss_transactions t ON t.order_id = o.order_id
WHERE o.pay_type = 'vbank'
  AND o.logged_at >= DATE('now', '-30 days')
GROUP BY d
ORDER BY d DESC;
```

**활용**: Q1 의 GA4 vbank purchase event 수를 Q2 의 `vbank_orders` (= 주문생성) 과 대조. Publish 전에는 두 값이 유사 (GA4 에 주문생성도 purchase 로 들어감). Publish 후에는 GA4 쪽만 감소해야 함.

**Q3. `(not set)` 감소 효과 (v136 baseline, 별개 측정)**

```sql
SELECT 
  event_date,
  COUNT(*) AS total_purchase,
  COUNTIF((SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') = '(not set)'
       OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') IS NULL
       OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') = '') AS not_set_count,
  ROUND(100.0 * COUNTIF((SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') IN ('(not set)', '') 
                    OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') IS NULL) 
                    / NULLIF(COUNT(*), 0), 2) AS not_set_pct
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 30 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Seoul'))
  AND event_name = 'purchase'
GROUP BY event_date
ORDER BY event_date;
```

**활용**: v136 publish (2026-04-20 23:55) 이전/이후 `not_set_pct` 비교. 이번 vbank guard 와 독립 효과 측정.

**Q4. 같은 transaction_id 에 purchase 이벤트 중복수 (dedup 검증)**

```sql
SELECT 
  tx_id, 
  COUNT(*) AS purchase_events,
  ARRAY_AGG(DISTINCT pay_method IGNORE NULLS LIMIT 10) AS pay_methods,
  SUM(COALESCE(val, 0)) AS total_value,
  MIN(ts) AS first_ts,
  MAX(ts) AS last_ts
FROM (
  SELECT 
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') AS tx_id,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key='pay_method') AS pay_method,
    (SELECT value.double_value FROM UNNEST(event_params) WHERE key='value') AS val,
    event_timestamp AS ts
  FROM `hurdlers-naver-pay.analytics_304759974.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 14 DAY))
    AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Seoul'))
    AND event_name = 'purchase'
)
WHERE tx_id IS NOT NULL AND tx_id NOT IN ('(not set)', '')
GROUP BY tx_id
HAVING purchase_events >= 2
ORDER BY purchase_events DESC, first_ts DESC
LIMIT 200;
```

**활용**: [143] + [48] + [154] 이 같은 transaction_id 로 들어올 때 GA4 가 제대로 dedup 하는지. vbank guard publish 후 중복 수는 줄어야 함 (아예 안 쏘이니까).

### 판정 기준

| 지표 | Publish 승인 기준 |
|---|---|
| Q1 `pay_method=vbank` purchase events | publish 후 14일간 대폭 감소 (90%+ 감소 기대) |
| Q2 GA4 vs 로컬 vbank pending 차이 | GA4 쪽만 감소, 로컬은 변동 없음 |
| Q3 `not_set_pct` | v136 효과 측정 — 이번 변경은 `(not set)` 수에 영향 없음 (guard 는 value 차원) |
| Q4 duplicate tx | 가상계좌 주문의 tx_id 에 purchase event 가 0 이어야 함 (완전 차단) |

---

## 예상되는 동작 시뮬레이션

### 카드 결제 (allow_purchase branch)

```
1. 결제완료 페이지 로드
2. server-payment-decision-guard 실행
   → __BIOCOM_SERVER_PAYMENT_DECISION_LAST__.branch = 'allow_purchase'
3. HURDLERS 플러그인이 hurdlers_purchase dataLayer push
4. [154] 트리거 matching
5. Exception Trigger [253] 평가
   → JS - vbank blocked = false (branch indexOf 'block_' !== 0)
   → fire 하지 않음
6. [154] 정상 발사 → h_purchase dataLayer push
7. [143]/[48] 트리거 matching
8. Exception Trigger 재평가 → 여전히 false
9. [143]/[48] 정상 발사 → GA4 purchase 이벤트 전송
```

### 가상계좌 주문생성 (block branch)

```
1. 결제완료 페이지 로드 (rk=S, 가상계좌 미입금)
2. server-payment-decision-guard 실행
   → __BIOCOM_SERVER_PAYMENT_DECISION_LAST__.branch = 'block_purchase_virtual_account'
3. HURDLERS 플러그인이 hurdlers_purchase dataLayer push
4. [154] 트리거 matching
5. Exception Trigger [253] 평가
   → JS - vbank blocked = true (branch indexOf 'block_' === 0)
   → [253] fire!
6. [154] blockingTriggerId 에 253 포함 → **[154] 발사 취소** ❌
7. h_purchase dataLayer push 안 됨
8. [143] 트리거 matching 실패 (이벤트 자체가 push 안 됨)
   → 이 경우 [143] 은 [253] blocking 과 무관하게 애초에 매칭 안 됨
9. 별도로 [48] 트리거 `conversion` 이벤트가 발사되더라도 [253] 이 fire → [48] 차단
10. Meta Pixel Purchase 는 server-decision-guard 가 대체 (VirtualAccountIssued)
11. TikTok purchase_intercepted → PlaceAnOrder
12. 결과: GA4 에 해당 주문의 purchase 이벤트 기록 안 됨 ✅
```

**주의: [154] 차단 후 연쇄 영향**
- [154] 가 `HurdlersTracker.pushEvent('h_purchase', ...)` 를 호출하는 구조
- 이 호출이 안 되면 `h_purchase` 이벤트 자체가 dataLayer 에 push 안 됨
- → [143] 의 primary trigger `h_purchase` 가 발사되지 않음
- 즉 [154] 차단만으로도 [143] 이 "차단" 이 아니라 "아예 발사될 기회 없음" 상태가 됨
- **이중 안전장치**: [143] 에도 blockingTriggerId 연결해 놓았으므로 혹시 다른 경로로 h_purchase 가 발사돼도 차단됨

---

## 자동화 / 재현

| 스크립트 | 용도 |
|---|---|
| `backend/gtm_exception_trigger_draft.mjs` | 변수 [252] + 트리거 [253] 생성 + 태그 [143]/[48]/[154] blockingTrigger 연결 (이미 실행됨) |
| `backend/gtm_publish.mjs` | 향후 publish 실행 (지금은 금지). `VERSION_NAME`/`NOTES` 수정 후 재사용 |
| `backend/gtm_update_prep_tag_v3.mjs` | [251] prep v3 업데이트 (server-branch guard) |

### 재실행 주의

`gtm_exception_trigger_draft.mjs` 를 재실행하면 변수/트리거가 중복 생성됨 (409 conflict 가 아닌 새 id). 부분 실행 복구가 필요하면 아래 순서:
1. 중복된 새 변수 삭제 (DELETE /variables/{id})
2. 중복된 새 트리거 삭제
3. 태그 blockingTriggerId 원상복구 (원래 blockingTriggerId 와 비교해 중복 제거)

---

## 다음 단계

### 지금 TJ 가 할 일

1. **Preview 시작** — https://tagmanager.google.com/#/container/accounts/4703003246/containers/13158774/workspaces/146 → 미리보기 → biocom.kr
2. **시나리오 A (카드)** — 만원 상품으로 정상 결제 → [143]/[48]/[154] 정상 발사 확인
3. **시나리오 B (가상계좌)** — 39,000원 가상계좌 → [143]/[48]/[154] 차단 확인 + [251] `GUARD_BLOCKED` 로그 확인
4. **결과 스크린샷 공유** — 특히 B 의 "태그 실행 안 됨" 목록
5. **승인 시 publish** — Claude 가 `gtm_publish.mjs` 실행 (version name: `vbank_exception_trigger_2026-04-21`)

### Preview 후 의사결정

| 관측 결과 | 권장 조치 |
|---|---|
| A/B 모두 기대대로 동작 | publish OK — 한 번에 배포 |
| B 에서 [154] 차단으로 부작용 확인 | [154] 만 blockingTriggerId 에서 253 제거, [143]/[48] 만 publish. 피드백 §6 권고 |
| `JS - vbank blocked` 가 false 로 return (guard 미인식) | decision 객체 구조 재확인 + 코드 수정 후 재 Preview |

---

## Preview 결과 + Publish (2026-04-21 01:40 KST)

### 시나리오 B 가상계좌 (01:28 KST, 35,000원)

```
[biocom-server-payment-decision-guard] decision branch=block_purchase_virtual_account status=pending
→ JS - vbank blocked = true
→ Exception trigger fire
→ [143]/[48]/[154] 차단, [251] G3 guard skip
→ Meta VirtualAccountIssued / TikTok PlaceAnOrder 정상 대체
```

### 시나리오 A 카드 결제 (01:35 KST, 11,900원 DietMealBox)

```
[biocom-server-payment-decision-guard] decision branch=allow_purchase status=confirmed
→ JS - vbank blocked = false
→ Exception trigger 발사 안 됨
→ [143]/[48]/[154]/[251] 모두 정상 발사
→ 채널톡_구매전환 정상 발사
→ Meta Purchase value=11900 KRW dispatch
→ [seo-hurdlers-prep] SET_OK
```

### Publish

`backend/gtm_publish.mjs` 실행 (workspaceId 146 → version 137 → publish → live 매칭 확인).

| 항목 | 값 |
|---|---|
| containerVersionId | **137** |
| name | `vbank_exception_trigger_2026-04-21` |
| compilerError | none |
| live 매칭 | ✅ YES |
| workspace 146 rollover | 자동 147 생성 |

## 버전 기록

- **v2** (2026-04-21 01:40 KST): **Publish 완료**. Preview A/B 결과 + v137 배포 기록.
- **v1** (2026-04-21 01:30 KST): 최초 작성. workspace 146 pending 6건 commit 완료 (변수 252 + 트리거 253 + 태그 143/48/154 blockingTrigger 연결). Preview 시나리오 3개 + rollback 2경로 + BQ 4쿼리.
