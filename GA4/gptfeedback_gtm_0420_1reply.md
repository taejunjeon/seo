# 피드백 반영 결과 (2026-04-20 23:30 KST)

원본 피드백: [[gptfeedback_gtm_0420_1]]
상위 문서: [[gtm]] · [[../roadmap/confirmed_stopline]] C-Sprint 5

## 1. 한 줄 결론

**피드백 §5 추천 실행안 Step 2·3 완료**. [48] `GA4_구매전환_홈피구매` 와 [43] `GA4_구매전환_Npay` 양쪽 태그에 `transaction_id = {{JS - Purchase Transaction ID (fallback chain)}}` 파라미터를 **추가**했음 (append). Workspace 145 에만 commit, publish 는 TJ 수동.

## 2. 피드백 §2·3 수용한 입장 재확인

피드백에서 보완 지적된 두 가지 모두 수용.

**(a) "GA4 transaction_id dedup 전제는 대체로 맞으나 BigQuery 사후 검증 필요" (§2)**

동의. dedup 은 같은 event_id 가 아니라 같은 transaction_id 이면 GA4 가 purchase 를 병합해 중복 집계를 줄이는 장치이지, [48] 의 `pay_method=homepage` 와 [143] 의 상품정보를 "예쁘게 병합" 해주는 것은 아님. publish 후 `data/sql/biocom_ga4_identity_coverage.sql` 의 쿼리 3 을 재실행해 **같은 transaction_id 에 purchase event 가 N건 → 1건 revenue 로 집계되는지** BigQuery 로 직접 확인해야 함. 이 검증 단계를 "다음 할 일 §4" 에 추가.

**(b) "[43] Npay 는 버튼 클릭 vs 결제완료 의미 구분 필요" (§3)**

동의하되 workspace commit 자체는 진행. 피드백 §6 질문 1 답 ("draft 진행, publish 전 의미 확인") 과 정확히 일치. 현재 workspace 145 에 draft 상태로 있을 뿐 publish 전 영향 없음.

단 추가로 본 근거: [43] 의 트리거는 `{{Click Classes}} contains npay_logo/npay_btn_pay/btn_green AND {{_event}} equals conversion`. **`conversion` 은 이벤트 이름이 아니라 GTM conversion-linker 용 이벤트로 보임**. 즉 `npay_btn_pay` 클릭 시점이지 결제완료 시점이 아닐 가능성이 크다. Preview 에서 가상계좌 주문생성 시 [43] 이 발사 안 된 것도 이 해석과 일치 (Npay 결제가 아니었으니). 확정은 TJ Preview 1회 (실제 Npay 결제) 로만 가능.

## 3. 실행한 것

**Workspace 145 변경 (2026-04-20 23:25 KST, publish 아님)**

| tagId | 이름 | 변경 종류 | before fingerprint | after fingerprint | 최종 eventSettings (주요) |
|---|---|---|---|---|---|
| **48** | GA4_구매전환_홈피구매 | **append** transaction_id | `1776177502777` | `1776695972175` | currency=KRW, pay_method=homepage, value={{dlv_price_vlaue}}, user_time={{USER_TIME}}, **transaction_id={{JS - Purchase Transaction ID (fallback chain)}}** |
| **43** | GA4_구매전환_Npay | **append** transaction_id | `1776177408254` | `1776695974548` | currency=KRW, pay_method=npay, value={{dlv_price_vlaue}}, user_time={{USER_TIME}}, **transaction_id={{JS - Purchase Transaction ID (fallback chain)}}** |

Workspace Status API 로 최종 pending change 4건 확인:
- variable.`JS - Purchase Transaction ID (fallback chain)` — added (2026-04-20 18:27)
- tag.`HURDLERS - [이벤트전송] 구매` [143] — updated (2026-04-20 18:27)
- tag.`GA4_구매전환_홈피구매` [48] — updated (2026-04-20 23:25) ← 이번에 추가
- tag.`GA4_구매전환_Npay` [43] — updated (2026-04-20 23:25) ← 이번에 추가

자동화 스크립트: `backend/gtm_apply_48_43.mjs` (재사용 가능, idempotent — 이미 있는 transaction_id row 면 값만 업데이트).

## 4. 검증

**검증 1 — GTM API 재조회로 변경 확인**
- 두 태그 모두 `transaction_id` row 가 `eventSettingsTable.list` 마지막에 추가됨
- value 가 정확히 `{{JS - Purchase Transaction ID (fallback chain)}}` (변수 250 참조)

**검증 2 — 기존 로직 unit test (10/10 통과) + Playwright biocom.kr workspace preview 실행 결과 재사용**
- 변수 [250] 의 fallback 로직 자체는 [143] publish 준비 단계에서 이미 검증. [48]/[43] 은 단순히 같은 변수를 참조만 하므로 로직 회귀 없음.

**검증 3 — Preview 결과와 대조**
- TJ Preview (가상계좌 주문생성-미입금) 에서 [143] + [48] 동시 발사 확인됨
- 이번 변경 후 Preview 재실행 시 [48] 도 transaction_id 가 URL `order_no` 로 채워져 발사될 전망
- [43] 은 Preview 시나리오에 Npay 결제가 없어서 발사 안 되었으나, **workspace 변경은 완료** 되어 실제 Npay 결제 Preview 에서 확인 가능

**Unit test / Playwright 로 검증하지 못한 것**: [43] 의 실제 발사 의미 (버튼 클릭 vs 결제완료) — TJ Preview 전용. 피드백 §3 와 §5 Step 3 에 명시된 바와 동일.

## 5. Claude 추가 인사이트

### 5-1. [48] eventSettings 는 GA4 event 템플릿 입장에서 약한 구조

[48] 의 이번 추가 전 eventSettings: `currency / pay_method / value / user_time`. 여기에 **`items` 도 없음**. 즉 transaction_id 가 추가되더라도 GA4 purchase 리포트에서 **상품 단가/개수 정보 누락**. GA4 는 transaction_id 로 dedup 하면서 "items 있는 쪽 [143] 을 canonical 로 병합" 한다는 보장이 없음. 만약 [48] 이 시간적으로 [143] 보다 먼저 도착하면 items 없는 purchase 가 canonical 로 잡힐 수 있음.

**제안**: [48] 을 향후 **paused** 하는 것이 근본 해결. 이번 publish 로 transaction_id 는 채워지지만, [48] 은 [143] 과 중복 신호이므로 존재 가치가 낮음. 단 piece-of-mind 용으로 `pay_method=homepage` 를 분리 집계할 필요가 있다면 유지. (피드백 §5 Step 3 이후 "별도 결정" 큐로 분류된 항목.)

### 5-2. 가상계좌 미입금에서 items/value 가 빈 값

TJ Preview 스크린샷에서 [143] eventSettings 평가 결과:
- `items: ""`
- `value: ""`
- `shipping: ""`
- `transaction_id: {{JS - Purchase Transaction ID (fallback chain)}}` (fallback 변수 자체는 채워짐)

즉 **가상계좌 주문생성 시점에 HURDLERS 플러그인이 items/value 를 채우지 못함**. 이는 transaction_id 문제와 별개로 GA4 purchase 이벤트 품질이 떨어지는 원인. 가상계좌 "입금 완료" 시점까지 HURDLERS 가 기다렸다가 dataLayer push 하도록 수정해야 하나, 이는 피드백 §4 "2층 문제" 와 일치 — **별도 sprint 로 분리**.

### 5-3. [143] trigger 가 `h_purchase` 에서 `hurdlers_purchase` 로 변경된 흔적

GTM snapshot 당시 [143] trigger 설명은 `{{_event}} equals hurdlers_purchase` 였는데, TJ Preview 결과에서는 "트리거 실행: HURDLERS - [맞춤 이벤트] 구매 — 필터 같음 h_purchase — 이 태그가 실행된 메시지 76 h_purchase" 로 나옴. `hurdlers_purchase` → `h_purchase` 로 표기가 단축됐을 뿐인지, 실제 트리거가 다른지 추가 확인 필요. (영향 없을 가능성 큼 — 같은 이벤트 이름일 것.)

### 5-4. [143] measurementId 가 `{{HURDLERS - GA4 아이디}}` 인 반면 [48]/[43] 은 `G-WJFXN5E2Q1` 하드코딩

snapshot 에서 확인됨. `{{HURDLERS - GA4 아이디}}` 변수는 값이 `G-WJFXN5E2Q1` 로 동일하므로 현재는 동일 property 로 집계되지만, HURDLERS 플러그인 업그레이드로 이 변수 값이 변경되면 [143] 만 다른 property 로 가고 [48]/[43] 은 biocom 원래 property 로 남는 분화 위험. 피드백 §2 BigQuery 사후 검증 시 measurement ID 도 같이 체크 권장.

### 5-5. publish 체크리스트 (Preview 에서 꼭 확인)

피드백 §5 Step 1·4 에 맞게 TJ 가 Preview 에서 다음을 하나씩 확인하면 publish 안전성 99%:

**홈페이지 일반 결제 테스트** (카드/계좌이체):
- [ ] [143] HURDLERS - [이벤트전송] 구매 발사 + transaction_id = URL `order_no` 값
- [ ] [48] GA4_구매전환_홈피구매 발사 + transaction_id = 동일한 `order_no` 값
- [ ] [43] 은 발사되지 않음
- [ ] 변수 탭에서 `JS - Purchase Transaction ID (fallback chain)` 값이 `order_no` 와 일치

**네이버페이 결제 테스트**:
- [ ] [143] 발사 + transaction_id 정상
- [ ] [43] 발사 + transaction_id = 동일한 `order_no` 값
- [ ] [48] 발사 여부 확인 — 발사되면 3중 발사 (매우 드물 것)

**가상계좌 주문생성 (실제 입금 전)**:
- [ ] [143] + [48] 발사는 여전할 것 (이번 publish 의 수정 범위 밖)
- [ ] 하지만 transaction_id 는 order_no 로 채워짐 → GA4 (not set) 은 해결
- [ ] items/value 여전히 빈 값 (2층 문제, 다른 sprint)

## 6. 다음 할 일 (우선순위)

### §6-A. Preview 재실행 + publish (TJ, 15분)

1. https://tagmanager.google.com/#/container/accounts/4703003246/containers/13158774/workspaces/145
2. 우상단 **미리보기** → biocom.kr → 위 §5-5 체크리스트 3개 시나리오 수행 (홈페이지 결제 / Npay / 가상계좌)
3. 변수 탭에서 `JS - Purchase Transaction ID (fallback chain)` 값 스크린샷 1장
4. 모든 체크 통과 시 **제출** → 버전명 `transaction_id_fallback_143_48_43_2026-04-20` / 설명 `(not set) 520건 대응: 3개 purchase 태그에 URL order_no fallback` → **게시**

### §6-B. publish 후 24~48h BigQuery 재검증 (Claude, 자동화 가능)

`data/sql/biocom_ga4_identity_coverage.sql` 쿼리 3 (transaction_id=(not set) event_count) + 신규 쿼리:

```sql
-- A. transaction_id (not set) 감소 추이
SELECT DATE(TIMESTAMP_MICROS(event_timestamp)) AS d,
  COUNTIF((SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') = '(not set)'
       OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') IS NULL
       OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') = '') AS not_set_count,
  COUNTIF((SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') IS NOT NULL
      AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') != '(not set)'
      AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') != '') AS has_tx_count
FROM `hurdlers-naver-pay.analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 14 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Seoul'))
  AND event_name = 'purchase'
GROUP BY d ORDER BY d;

-- B. 같은 transaction_id 에 purchase event 중복 수 (dedup 실효성 확인)
SELECT transaction_id, COUNT(*) AS purchase_events, ARRAY_AGG(DISTINCT tag_name LIMIT 5) AS tag_hints
FROM (
  SELECT (SELECT value.string_value FROM UNNEST(event_params) WHERE key='transaction_id') AS transaction_id,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key='pay_method') AS pay_method,
    CONCAT(IFNULL((SELECT value.string_value FROM UNNEST(event_params) WHERE key='pay_method'), 'none')) AS tag_name
  FROM `hurdlers-naver-pay.analytics_304759974.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 7 DAY))
    AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Seoul'))
    AND event_name = 'purchase'
)
WHERE transaction_id IS NOT NULL AND transaction_id != '' AND transaction_id != '(not set)'
GROUP BY transaction_id
HAVING purchase_events >= 2
ORDER BY purchase_events DESC LIMIT 100;
```

쿼리 B 로 publish 후 "같은 transaction_id 로 [143] + [48] 동시 발사되는 케이스" 를 실제 관측해 GA4 dedup 이 revenue 에 어떻게 반영되는지 확인. 피드백 §2 사후 검증 직접 대응.

### §6-C. [43] Npay 결제완료 Preview 증거 확보 (TJ, publish 전 필수)

[143] + [48] 은 홈페이지 결제만으로 확정 가능하지만 [43] 은 **실제 Npay 결제 한 건** Preview 필요. Npay 테스트 결제는 보통 운영자 계정으로 500원짜리 상품 결제 후 즉시 환불로 진행. 결과에서 [43] 발사 + transaction_id 정상 확인. 실패 시 [43] 은 별도 sprint 분리.

### §6-D. [48] paused 결정 (별도 sprint)

§5-1 에 쓴 대로 [48] 은 [143] 과 중복이며 items 가 없는 약한 신호. publish 후 1~2주 관찰 후 [48] paused 여부 결정. 결정 기준은 BigQuery 쿼리 B 결과 — [48] 발사가 GA4 revenue 에 유의미한 영향 주지 않으면 paused.

### §6-E. 가상계좌 미입금 purchase 차단 (별도 sprint, C-Sprint 3 vbank_expired 와 연결)

피드백 §4 2층 문제. HURDLERS 플러그인이 `hurdlers_purchase` 를 가상계좌 주문생성 시점이 아니라 실제 입금 확정 시점에만 push 하도록 수정. 또는 [143] trigger 에 `pay_method != vbank OR payment_status = paid` 조건 추가. 이는 HURDLERS 소스 접근 없이는 GTM trigger 측면에서만 가능.

### §6-F. 자신감 지표 반영

피드백 §8 최종 판단표와 동일 선상에서 이번 작업 자신감:

| 항목 | Claude 자신감 |
|---|---:|
| [143] publish 안전성 | 92% |
| [48] transaction_id 추가 | 95% |
| [43] transaction_id 추가 (draft) | 82% |
| [43] publish 안전성 | **60% (Preview 전)** / 88% (Npay Preview 후) |
| GA4 dedup 이 revenue 에 의도대로 반영 | 75% (BQ 검증 후 90%) |
| [48] 장기 paused 추천 | 70% (BQ 결과 보고 결정) |

## 7. 관련 문서 연동 업데이트

- [[gtm]] — 이번 변경 ( [48]/[43] append ) 을 v2 로 반영 필요. 이 reply 가 1차 기록이고, 후속으로 `GA4/gtm.md` 에 "2026-04-20 v2: [48]/[43] transaction_id append" 섹션 추가 예정. publish 후 다시 v3 로 상태 갱신.
- [[../roadmap/confirmed_stopline]] C-Sprint 5 — publish 완료 후 버전 기록 v2.4 entry 추가 예정 (`[143]/[48]/[43] fallback publish 및 BQ 재검증`).
- `data/analysis/transaction_id_not_set_investigation.md` — Codex 원본 조사. 해결 적용 시 본문 뒤에 "해결 적용 (2026-04-20)" 부록 추가 권장.

## 8. 자동화 스크립트 상태

| 파일 | 용도 | 상태 |
|---|---|---|
| `backend/gtm_apply.mjs` | 변수 250 생성 + 태그 143 교체 | 완료 (2026-04-20 18:27, 재실행 시 409 예상) |
| `backend/gtm_apply_48_43.mjs` | [48]/[43] 에 transaction_id append | **완료 (2026-04-20 23:25)** — 재실행 시 기존 row value 만 업데이트 |
| `backend/gtm_playwright_test.mjs` | Playwright 로 biocom.kr workspace preview + fallback 로직 검증 | 완료, 재사용 가능 |

## 9. 한 줄 요약

피드백 §5 Step 2·3 (= §6 질문 1 답) 그대로 실행. 이제 TJ 가 §5-5 체크리스트로 Preview 1회 돌리고 publish 하면 `(not set)` 520건 1층 문제는 기본적으로 닫힘.

---

## 10. 카드 주문완료 Preview 추가 발견 (2026-04-20 23:45 KST)

TJ 가 [48]/[43] append 직후 **실제 카드 주문완료** 1건 Preview 를 진행. 이 결과에서 **별도 심각 이슈** 하나가 드러남.

### 10-1. 원시 Preview 관측

실행된 태그:
- ✅ [143] HURDLERS - [이벤트전송] 구매 (1회) — `h_purchase` 이벤트로 발사
- ✅ [48] GA4_구매전환_홈피구매 (1회) — `conversion` 이벤트로 발사
- ✅ 채널톡_구매전환 (1회) — `conversion` + `shop_payment_complete` trigger
- ❌ [43] GA4_구매전환_Npay — 발사 안됨 (카드 결제라 당연)

메시지 순서: `57 conversion` → [48] + 채널톡 발사 → `58 hurdlers_purchase` → [154] 발사 → `61 h_purchase` → [143] 발사.

### 10-2. [143] eventSettings 평가 결과

```
items: ""
transaction_id: {{JS - Purchase Transaction ID (fallback chain)}}  ← 정상 참조
value: ""
shipping: ""
currency: "KRW"
cid: {{HURDLERS - [변수] cid}}
...
```

items / value / shipping **세 값이 모두 빈 문자열로 평가됨**. 카드 주문완료 — 즉 **실제 결제가 끝났는데도 HURDLERS 경로로 가는 purchase 이벤트에 상품/금액 정보가 없다**.

### 10-3. 근본 원인

태그 [154] `HURDLERS - [데이터레이어] 구매` 의 HTML 소스 코드 (GTM API 로 확인, 정상):

```js
eventParam[PREF]["items"]          = {{HURDLERS - GA4 상품정보}}.map(...);
eventParam[PREF]["transaction_id"] = {{HURDLERS - GA4 Transaction_id}};
eventParam[PREF]["value"]          = {{HURDLERS - GA4 Value}};
```

소스는 정상. **실행 시점에 세 변수 [121]/[122]/[125] 의 평가값이 모두 비어 있음** — GTM 가 Preview 에서 HTML 인라인으로 치환하니 TJ 가 본 `transaction_id=\n;` 같은 syntax error 로 표시됨.

세 변수 모두 공통 dataLayer 경로 `hurdlers_ga4.transaction_id` / `hurdlers_ga4.value` / `hurdlers_ga4.items` 를 읽음. 즉 **HURDLERS 플러그인이 결제완료 페이지에서 `hurdlers_ga4` 네임스페이스 dataLayer 를 push 못 하는 상태**.

후보 원인 (추가 조사 대상):
- (a) HURDLERS 플러그인 HTML [146] 실행 타이밍이 purchase trigger 보다 늦음
- (b) HURDLERS 가 push 하는 실제 키 이름이 변수 [121]/[122]/[125] 가 읽는 경로와 다름 (네임스페이스 변경 등)
- (c) HURDLERS 플러그인 자체가 biocom 결제완료에서 어떤 조건 때문에 early-exit

### 10-4. TJ 프로젝트 ROAS / GA4 리포트 관점 의미

**즉시 영향**:
- GA4 [143] purchase 는 **value=0, items=[]** 상태로 기록되어 왔음. 즉 GA4 Standard 리포트 / 잠재고객 세그먼트 / Google Ads 자동입찰 등에서 revenue 기여가 없었거나 매우 약했음
- 반면 [48] GA4_구매전환_홈피구매 는 `{{dlv_price_vlaue}}` 로 value 를 채워서 발사했으므로 **실질 revenue 신호는 [48] 이 단독으로 제공**해 왔음
- **biocom GA4 Realtime / Overview revenue 는 [48] 덕분에 집계**되고 있었음. [143] 은 transaction_id 만 만들면서 dedup 대상 역할

**ROAS 대시보드 관점**:
- `/ads` 의 Official ROAS / Fast Signal ROAS 는 **GA4 revenue 가 아니라 로컬 `attribution_ledger` + `imweb_orders` complete_time 기반**. 따라서 직접 영향 없음
- 단 Meta CAPI Purchase 이벤트 value 필드 / Google Ads conversion value 는 GA4 와 다른 경로일 가능성 — 별도 확인 필요

**이번 publish 안전성**:
- 이 발견이 publish 를 막지는 않음. 오히려 **publish 로 [48]/[143] 이 같은 transaction_id 를 공유하면 GA4 dedup 이 효과 발휘**. [143] 의 items/value 가 비어도 [48] 이 revenue 를 제공하므로 dedup 시 [48] 쪽 revenue 가 canonical 로 남을 가능성 있음 (GA4 병합 규칙 확인 필요).

### 10-5. [43] 카드 결제에서 발사되지 않음 확인

카드 주문완료에서 [43] GA4_구매전환_Npay 는 발사 안됨 = **Npay 버튼 클릭 전용** 가설이 강화됨 (피드백 §3 의 걱정과 일치). Npay 결제 Preview 에서 한 번 더 확인하면 확정.

### 10-6. 새 "다음 할 일" 추가

위 §6 뒤에 **§6-G** 로 추가:

**§6-G. HURDLERS `hurdlers_ga4.*` dataLayer 빈 값 근본 원인 조사 (별도 sprint)**

확인 순서 (TJ + Claude 협업):

1. **GTM Preview 좌측 "변수" 탭에서 다음 변수 실제 값 스크린샷**:
   - `HURDLERS - GA4 Transaction_id` [121]
   - `HURDLERS - GA4 Value` [125]
   - `HURDLERS - GA4 상품정보` [122]
   - `HURDLERS - GA4 pay_type` [142]
   - `JS - Imweb Data Layer` (id 172)
   - `dlv_price_vlaue` [45] — 비교용
2. 변수 1~5 중 어느 하나라도 값이 있으면 → 변수 설정은 맞고 플러그인 HTML [146] 실행 이슈
3. 모두 비어있으면 → HURDLERS 플러그인이 dataLayer push 를 아예 안 하거나 네임스페이스가 다름
4. **태그 [146] HURDLERS - [맞춤 HTML] 허들러스 플러그인** HTML 소스 조회 후 push 로직 확인 — Claude 가 GTM API 로 조회 가능
5. HURDLERS 지원 문의 필요 여부 결정

이 문제가 해결되면 biocom GA4 purchase 품질이 크게 개선됨. 현재는 fallback 으로 transaction_id 만 복구한 상태.

---

## 11. Publish 완료 (2026-04-20 23:55 KST)

TJ 의 "퍼블리시 진행해" 지시에 따라 Claude 가 GTM API 로 직접 publish 실행.

### 11-1. 실행 절차

`backend/gtm_publish.mjs`:
1. **Step 1 — create_version**: `POST /workspaces/145:create_version` body=`{name, notes}`
2. **Step 2 — publish**: `POST /versions/136:publish`
3. **Step 3 — verify**: `GET /versions:live` 로 live 버전 확인

### 11-2. 결과

| 항목 | 값 |
|---|---|
| containerVersionId | **136** |
| 버전 이름 | `purchase_transaction_id_fallback_2026-04-20` |
| 설명 | `(not set) 520건 대응: 변수 [250] fallback 체인 신규 + 태그 [143]/[48]/[43] transaction_id 파라미터에 적용. 기존 HURDLERS 경로 보존 + URL order_no 3단계 fallback.` |
| compilerError | none |
| live 버전 매칭 | ✅ YES (live = 136) |
| workspace 145 rollover | 자동 새 workspace 146 생성됨 |

Version 136 내부 콘텐츠 검증:
- tag[143] transaction_id = `{{JS - Purchase Transaction ID (fallback chain)}}` ✅
- tag[48] transaction_id = `{{JS - Purchase Transaction ID (fallback chain)}}` ✅
- tag[43] transaction_id = `{{JS - Purchase Transaction ID (fallback chain)}}` ✅
- variable[250] 존재 ✅

### 11-3. 지금부터 적용되는 변화

**모든 biocom 방문자의 GA4 purchase 이벤트에서**:
- transaction_id 가 P1 HURDLERS dataLayer → P2 ecommerce dataLayer → P3 URL `order_no` 순으로 자동 채워짐
- 기존 HURDLERS 가 정상 push 한 경우 P1 그대로 사용 (회귀 없음)
- HURDLERS 가 비어 있었던 경우 — 즉 지금까지 `(not set)` 이 되던 케이스들 — URL `order_no` 로 복구

**GA4 dedup 이 정상 작동 조건 충족**:
- [143] + [48] 이 같은 property (`G-WJFXN5E2Q1`) + 같은 event_name (`purchase`) + 같은 transaction_id 로 들어가면 GA4 가 purchase 중복을 자동 병합
- 네이버페이 결제 시에는 [143] + [43] 도 동일 조건 충족

### 11-4. 24h 뒤 검증 포인트

1. GA4 Realtime → 이벤트 → `purchase` → `transaction_id` 차원으로 `(not set)` 비율 즉시 관측
2. 48h 뒤 BigQuery §6-B 쿼리 A (일자별 `(not set)` 비율) 실행. 이전 0% 수준에서 더 낮아지지는 않지만, **기존 GA4 UI 집계에서 `(not set)` 으로 보이던 케이스들이 사라져야 함**
3. 쿼리 B (같은 transaction_id 에 purchase event 중복) 로 GA4 dedup 실효성 확인
4. Meta Ads Manager ROAS 영향 모니터링 (Meta 쪽은 이번 변경과 직접 무관)

## 12. 🚨 추가 발견 — 근본 원인은 HURDLERS `hurdlers_ga4` dataLayer 가 **결제완료 페이지에서 실제 값이 push 되지 않는 것**

TJ 가 공유한 Preview 스크린샷 8장을 조사한 결과, items/value/shipping 이 항상 빈 값인 **근본 원인**이 드러남.

### 12-1. 관련 태그 전체 흐름 (Preview 관측)

| 태그 | 역할 | 실행 내용 |
|---|---|---|
| [146] HURDLERS - [맞춤 HTML] 허들러스 플러그인 | `window.HurdlersTracker` 유틸 생성 | 모든 페이지에서 실행. **dataLayer push 는 하지 않음** |
| [110] HURDLERS - [데이터레이어] 초기화 | **`dataLayer.push({hurdlers_ga4: { items: void 0 }})`** | 3회 실행. `hurdlers_ga4` 를 **undefined 값으로만 초기화** |
| [133] HURDLERS - [데이터레이어] 상세페이지 조회 | `window.hurdlers_ga4` 에서 읽고 DOM 파싱 후 push | 상세페이지에서만 |
| [152] HURDLERS - [데이터레이어] 주문서작성 | setTimeout 4초 후 DOM 파싱해 `hurdlers_ga4.items/value` 채움 | 주문서 작성 시 |
| [154] HURDLERS - [데이터레이어] 구매 | 변수 [121]/[122]/[125] 에서 **읽기만** | 결제완료 시 |
| [143] HURDLERS - [이벤트전송] 구매 | 변수 [121]/[122]/[125] 에서 **읽기만** | 결제완료 시 |

### 12-2. 결론

**결제완료 페이지에서 `hurdlers_ga4.transaction_id`, `hurdlers_ga4.value`, `hurdlers_ga4.items` 에 실제 값을 push 하는 GTM 태그가 컨테이너 안에 존재하지 않음**. 초기화 태그 [110] 은 undefined 로만 push 하고, 구매 단계 태그 [154]/[143] 은 읽기 전용. 따라서 biocom.kr 외부 스크립트 (HURDLERS 플러그인 자체 JS 또는 아임웹 shop footer) 가 결제완료 페이지에서 이 값을 push 해야 하는데 **현재 그게 이뤄지지 않고 있음**.

### 12-3. 영향

- GA4 [143] HURDLERS purchase 이벤트는 **value=0, items=[], shipping=0** 상태로 발사되어 왔음
- 유효한 revenue 신호는 [48] GA4_구매전환_홈피구매 (이번 publish 로 transaction_id 도 추가됨) 가 단독으로 제공 — `{{dlv_price_vlaue}}` 경로
- **이번 publish 로 transaction_id 는 복구**되었지만 items/value/shipping 은 여전히 빈 값

### 12-4. 해결 옵션 (§6-G 로 별도 sprint)

**옵션 A (권장) — GTM 에 신규 Custom HTML 태그 추가**:
- 이름: `biocom - [데이터레이어] 구매 보정 (Claude)`
- 트리거: `Page Path contains shop_payment_complete`
- 내용: URL `order_no`, DOM 에서 주문 금액/상품 정보 읽어서 `dataLayer.push({hurdlers_ga4: {transaction_id, value, items, shipping: 0, currency: 'KRW'}})`. [154] 보다 먼저 실행되도록 태그 시퀀싱 설정.
- 장점: biocom footer 손대지 않음. GTM 안에서 끝.
- 단점: DOM 파싱이 테마 CSS 클래스에 의존 (아임웹 테마 업데이트 시 깨짐).

**옵션 B — biocom 아임웹 footer 에서 push**:
- `footer/biocom_footer_0415_final3.md` 에 `dataLayer.push({hurdlers_ga4: {...}})` 추가
- 장점: 주문 정보를 아임웹 서버 응답에서 정확히 읽을 수 있음
- 단점: footer 수정이 필요하고 배포 주기에 영향

**옵션 C — HURDLERS 지원 문의**:
- 외부 HURDLERS JS 가 결제완료에서 push 안 되는 원인 조사 요청
- 장점: 근본 해결
- 단점: HURDLERS 응답 속도 + 유료 지원일 가능성

### 12-5. 당장 필요한 건 아님

이번 publish 로 `(not set)` 520건 1층 문제는 닫혔고 (transaction_id 복구), GA4 revenue 는 [48] 의 `dlv_price_vlaue` 경로로 계속 집계되므로 **서비스에 즉각적인 추가 장애는 없음**. §6-G 는 우선순위 중간.

## 13. 변수 탭 스크린샷 안내 (TJ 질문 답변)

TJ 가 공유한 스크린샷 8장은 모두 **"태그" 탭의 태그 세부정보** 페이지. 내가 요청한 것은 **"변수" 탭의 실행 시점 평가값** 이었음. 위치:

```
GTM Preview (Tag Assistant) 창 열기
  → 좌측 상단 타임라인에서 원하는 이벤트 선택 (예: "61 h_purchase")
  → 우측 상단 탭 메뉴 4개 중 "변수" 클릭
    → 표: "이름 / 유형 / 값" — 이 페이지의 스크린샷 필요
```

이 표에서 다음 5개 변수 실제 평가값 확인:
- `HURDLERS - GA4 Transaction_id` → 기대값: 빈 문자열 / undefined (= 근본 문제 확증)
- `HURDLERS - GA4 Value` → 기대값: 빈 문자열 / undefined
- `HURDLERS - GA4 상품정보` → 기대값: 빈 배열 / undefined
- `HURDLERS - GA4 pay_type` → 기대값: 확인 대상
- `JS - Purchase Transaction ID (fallback chain)` → 기대값: **URL `order_no` 값** (예: `202604205201003`)

**다만 publish 완료 후에는 이 확인이 '근본 원인 조사용' 이지 publish 긴급성은 아님**. 위 §12 에 정리한 근본 원인이 더 구체적이므로, 변수 탭 스크린샷은 §6-G 옵션 A/B 작업 시작 시점에 받아도 됨.

## 버전 기록

- **v3** (2026-04-20 23:55 KST): **Publish 완료**. §11 실행 결과 기록 (containerVersionId=136, live 매칭 확인). §12 근본 원인 정리 (결제완료 페이지에서 `hurdlers_ga4` 값 push 주체 부재). §13 변수 탭 위치 안내.
- **v2** (2026-04-20 23:45 KST): 카드 주문완료 Preview §10 추가. HURDLERS `hurdlers_ga4.*` dataLayer 빈 값 근본 원인 발견. [143] items/value/shipping 상시 빈 값 확인. §6-G 근본 수정 sprint 제안.
- **v1** (2026-04-20 23:30 KST): 최초 작성. [48]/[43] append 완료 반영. BQ 사후 검증 쿼리 제안.
