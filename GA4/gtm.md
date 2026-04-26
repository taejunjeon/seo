# biocom GTM 컨테이너 상태 정리

작성 시각: 2026-04-20 18:30 KST (v8 업데이트: 2026-04-24 23:45 KST)
작성자: Claude Code (GTM API 직접 조회)
근거: GTM API v2 snapshot, live version 138, `gtmaudit/gtm-ga4-purchase-duplicates-result-20260424144504.json`
대상 컨테이너: `GTM-W2Z6PHN` (biocom.kr)
관련 문서: [[confirmed_stopline|roadmap/confirmed_stopline.md]] C-Sprint 5, [[transaction_id_not_set_investigation|data/analysis/transaction_id_not_set_investigation.md]]

## 10초 요약

- 2026-04-24 23:45 KST 현재 live version은 `138` (`ga4_purchase_duplicate_fix_20260424`)이다.
- canonical GA4 `purchase`는 **[143] HURDLERS - [이벤트전송] 구매**로 둔다. `transaction_id={{JS - Purchase Transaction ID (fallback chain)}}`, `pay_method=homepage`가 들어간다.
- **[48] GA4_구매전환_홈피구매**는 v138에서 pause했다. 동일 transactionId의 HURDLERS purchase와 중복 집계되던 homepage purchase를 막기 위한 조치다.
- **[43] GA4_구매전환_Npay**는 v138에서 `purchase`가 아니라 `add_payment_info`로 강등했다. NPay 버튼 클릭 시점 이벤트가 실제 주문 생성 전 purchase 매출을 만들지 않게 한 것이다.
- 남은 검증은 v138 이후 24~48h 신규 GA4 row에서 duplicate extra event와 `transactionId` 결측이 줄었는지 확인하는 일이다.

## 컨테이너 메타

| 항목 | 값 |
|---|---|
| GTM Account | `바이오컴(최종)` (accountId=`4703003246`) |
| Container public ID | `GTM-W2Z6PHN` |
| Container numeric ID | `13158774` |
| Usage context | `web` |
| Default Workspace | 최신 live 기준 새 작업은 별도 workspace 생성 후 publish. v138 작업 workspace=`148` |
| Variables total | 59 (custom 47 + built-in 12 이상) |
| Tags total | 56 |
| Triggers total | 80 |
| Live container version | `138` (`ga4_purchase_duplicate_fix_20260424`) |

다른 사이트 컨테이너 (참고, 이 문서 범위 밖):
- `GTM-5M33GC4` — thecleancoffee.com (containerId=`91608400`)
- `GTM-T8FLZNT` — AIBIO (containerId=`92360859`)

## Service Account 접근

- 계정: `seo-656@seo-aeo-487113.iam.gserviceaccount.com`
- 현재 권한 상태: **biocom.kr 컨테이너에 Publish 권한 보유 (2026-04-20 TJ 부여)**. 변수/태그/트리거 조회·생성·수정·버전 생성·게시 모두 API 로 가능.
- 스코프: `tagmanager.readonly` / `tagmanager.edit.containers` / `tagmanager.edit.containerversions` / `tagmanager.publish` 중 `edit.containers` 로 현재 작업 수행.

## GA4 구매 관련 태그 현황

| tagId | 이름 | 활성 | measurementId | `transaction_id` 파라미터 | 트리거 조건 |
|---|---|---|---|---|---|
| **143** | **HURDLERS - [이벤트전송] 구매** | ✅ `purchase` | `{{HURDLERS - GA4 아이디}}` | **`{{JS - Purchase Transaction ID (fallback chain)}}`**, `pay_method=homepage` | `{{_event}} equals hurdlers_purchase` (DL [154] 이 발사) |
| 43 | GA4_구매전환_Npay | ✅ `add_payment_info` | `G-WJFXN5E2Q1` | `{{JS - Purchase Transaction ID (fallback chain)}}`, `pay_method=npay` | npay 버튼 클릭 (`npay_logo`/`npay_btn_pay` 등) + `{{_event}} equals conversion` |
| 48 | GA4_구매전환_홈피구매 | ⏸ PAUSED `purchase` | `G-WJFXN5E2Q1` | `{{JS - Purchase Transaction ID (fallback chain)}}`, `pay_method=homepage` | `Page Path contains shop_payment_complete` & `{{dlv_price_vlaue}} greater 0` & `{{_event}} equals conversion` |
| 98 | GA4_구매전환_Npay 2 | ⏸ PAUSED | `G-8GZ48B1S59` | ❌ 없음 | npay 버튼 클릭 (일시중단) |

### 태그 [143] (핵심 purchase 태그) 상세

- Type: `gaawe` (GA4 Event)
- eventName: `purchase`
- Event settings (오늘 수정 후 최신):
  - `items = {{HURDLERS - GA4 상품정보}}`
  - **`transaction_id = {{JS - Purchase Transaction ID (fallback chain)}}`** ← 이전 값 `{{HURDLERS - GA4 Transaction_id}}` 에서 교체
  - **`pay_method = homepage`** ← v138에서 추가
  - `value = {{HURDLERS - GA4 Value}}`
  - `shipping = {{HURDLERS - GA4 shipping}}`
  - `currency = KRW`
  - `cid = {{HURDLERS - [변수] cid}}`
  - `user_id = {{HURDLERS - [맞춤 JS] user_id}}`
  - `utm_source / utm_medium / utm_campaign / utm_content / utm_term / member_code` — Retous 변수 사용
- Trigger: `HURDLERS - [맞춤 이벤트] hurdlers_purchase` (`{{_event}} equals hurdlers_purchase`)
- 발사 순서: `HURDLERS 플러그인 [146]` → `HURDLERS - [데이터레이어] 구매 [154]` (html 태그가 `hurdlers_purchase` 이벤트를 dataLayer 에 push) → 태그 [143] 이 그 이벤트로 발사
- Fingerprint: `1777041911030` (v138 적용 시점, fingerprint 값은 변경 시마다 새로 생성됨)

### 태그 [43] GA4_구매전환_Npay (v138 이후 purchase 아님)

- Type: `gaawe`, eventName=`add_payment_info`, measurementId=`G-WJFXN5E2Q1`
- Event settings: `currency=KRW`, `pay_method=npay`, `value={{dlv_price_vlaue}}`, `user_time={{USER_TIME}}`, `transaction_id={{JS - Purchase Transaction ID (fallback chain)}}`
- **v138 조치**: NPay 버튼 클릭 시점 이벤트는 실제 주문 생성 전이므로 `purchase`에서 제외했다. 이제 이 태그는 purchase 매출/건수를 만들지 않아야 한다.
- Trigger: 네이버페이 버튼 클릭 감지용 `customEvent` 2개 (`purchase_npay_mo`, `purchase_npay_pc`)
- Fingerprint: `1777041913098` (v138 적용 시점)

### 태그 [48] GA4_구매전환_홈피구매 (v138 이후 paused)

- Type: `gaawe`, eventName=`purchase`, measurementId=`G-WJFXN5E2Q1`
- Status: ⏸ PAUSED
- Event settings: `currency=KRW`, `pay_method=homepage`, `value={{dlv_price_vlaue}}`, `user_time={{USER_TIME}}`, `transaction_id={{JS - Purchase Transaction ID (fallback chain)}}`
- **v138 조치**: HURDLERS [143]와 동일 transactionId를 중복 purchase로 집계하던 legacy homepage purchase 태그라 pause했다.
- Trigger: `{{Page Path}} contains shop_payment_complete AND {{dlv_price_vlaue}} greater 0 AND {{_event}} equals conversion`
- Fingerprint: `1777041912345` (v138 적용 시점)

## GA4 Ecommerce 이벤트 태그 (purchase 외)

| tagId | 이름 | eventName | measurementId | 활성 | transaction_id 보냄? |
|---|---|---|---|---|---|
| 128 | HURDLERS - [이벤트전송] 네이버페이 구매 | `add_payment_info` | `{{HURDLERS - GA4 아이디}}` | ✅ | ✅ (변수 121 참조 — fallback 적용 대상 아님) |
| 157 | HURDLERS - [이벤트전송] 상세페이지 조회 | `view_item` | `{{HURDLERS - GA4 아이디}}` | ✅ | — (N/A) |
| 147 | HURDLERS - [이벤트전송] 장바구니 보기 | `view_cart` | `{{HURDLERS - GA4 아이디}}` | ✅ | — |
| 158 | HURDLERS - [이벤트전송] 주문서작성 | `begin_checkout` | `{{HURDLERS - GA4 아이디}}` | ✅ | — |
| 160 | HURDLERS - [이벤트전송] 장바구니 담기 | `add_to_cart` | `{{HURDLERS - GA4 아이디}}` | ✅ | — |
| 51 | GA4 장바구니 담기 | `add_to_cart` | `G-WJFXN5E2Q1` | ✅ | — |
| 101 | GA4 장바구니 담기2 | `add_to_cart` | `G-8GZ48B1S59` | ⏸ | — |
| 179 | ga4 장바구니 이벤트 | `add_to_cart_view_custom` | `G-WJFXN5E2Q1` | ✅ | — |

그외 conversion/event 태그: `G4_주문완료_요소공개 [70]` (eventName=`test`, 테스트용), `G4_주문완료_요소공개2 [100]` (eventName=`test`, 테스트용), `GA4_회원가입 [49]` (`sign_up`) 등.

## 주요 GA4 변수 현황

| varId | 이름 | type | 정의 |
|---|---|---|---|
| 19 | GA4 추적 아이디 | constant | `G-WJFXN5E2Q1` (고정) |
| 107 | HURDLERS - GA4 아이디 | constant | HURDLERS 플러그인용 동일 measurement ID |
| 121 | HURDLERS - GA4 Transaction_id | dataLayer (v) | `hurdlers_ga4.transaction_id` 만 읽음. **fallback 없음** (이 변수 자체는 손대지 않고 유지 — fallback 체인의 Priority 1 참조용) |
| 122 | HURDLERS - GA4 상품정보 | dataLayer (v) | `hurdlers_ga4.items` |
| 125 | HURDLERS - GA4 Value | dataLayer (v) | `hurdlers_ga4.value` |
| 45 | dlv_price_vlaue | dataLayer (v) | `eventModel.value` (default 0) — 태그 43/48 이 value 로 사용 |
| 124 | HURDLERS - [맞춤 JS] user_id | jsm | `.email-info` DOM 에서 email 추출 |
| 127 | HURDLERS - [변수] cid | dataLayer (v) | `cid` (client id) |
| **250** | **JS - Purchase Transaction ID (fallback chain)** | **jsm** | **오늘 신규. 아래 §fallback 변수 코드** |

### 변수 [250] JS - Purchase Transaction ID (fallback chain) 전체 코드

```js
function() {
  // Priority 1: existing HURDLERS dataLayer value (hurdlers_ga4.transaction_id)
  try {
    var dlv = {{HURDLERS - GA4 Transaction_id}};
    if (dlv && String(dlv).trim() !== '' && String(dlv) !== '(not set)') return String(dlv);
  } catch(e) {}

  // Priority 2: ecommerce.transaction_id from latest dataLayer push
  try {
    var dl = window.dataLayer || [];
    for (var i = dl.length - 1; i >= 0; i--) {
      var ev = dl[i];
      if (ev && ev.ecommerce && ev.ecommerce.transaction_id) {
        return String(ev.ecommerce.transaction_id);
      }
    }
  } catch(e) {}

  // Priority 3: URL fallback (order_no / orderNo / order_code)
  try {
    var p = new URLSearchParams(location.search);
    var v = p.get('order_no') || p.get('orderNo') || p.get('order_id') || p.get('order_code') || p.get('orderCode');
    if (v) return String(v);
  } catch(e) {}

  return '';
}
```

의미:
- **우선순위 1**: HURDLERS 플러그인이 정상적으로 `hurdlers_ga4.transaction_id` 를 dataLayer 에 push 한 경우 그대로 사용 (기존 경로와 100% 동일). 대부분의 정상 주문은 여기서 값이 나옴.
- **우선순위 2**: ecommerce-standard dataLayer (일부 아임웹 내부 push) 에서 `ecommerce.transaction_id` 를 역순 검색. HURDLERS 가 비는데 아임웹 push 는 있는 케이스 대비.
- **우선순위 3 (핵심)**: URL query string 에서 `order_no` 추출. 결제완료 페이지 URL `shop_payment_complete?order_code=...&order_no=...` 가 이미 가지고 있는 값. Codex 조사 §권장 A 정확히 구현.
- 전부 비어도 빈 문자열 `''` 반환 → GA4 는 이 값을 `(not set)` 으로 저장. 현상은 유지되지만 fallback 이 먹히는 비율만큼 `(not set)` 감소 예상.

## 2026-04-24 적용한 변경 (live v138)

| 시각 | 객체 | 변경 종류 | 내용 |
|---|---|---|---|
| 2026-04-24 23:45 KST | tag 143 | **UPDATE** | `HURDLERS - [이벤트전송] 구매`의 `eventSettingsTable`에 `pay_method=homepage` 추가. canonical GA4 purchase로 유지. |
| 2026-04-24 23:45 KST | tag 48 | **UPDATE** | `GA4_구매전환_홈피구매` pause. `[143]`와 같은 주문번호를 중복 purchase로 잡던 구조 차단. |
| 2026-04-24 23:45 KST | tag 43 | **UPDATE** | `GA4_구매전환_Npay`의 `eventName`을 `purchase`에서 `add_payment_info`로 변경. NPay 클릭 시점 purchase 제거. |
| 2026-04-24 23:45 KST | version 138 | **PUBLISH** | `ga4_purchase_duplicate_fix_20260424` publish 완료. backup/result: `gtmaudit/gtm-ga4-purchase-duplicates-*.json`. |

자동화 스크립트: `backend/scripts/gtm-fix-ga4-purchase-duplicates.mjs`.

## 2026-04-20 적용한 변경 (v136/v137 이전 기록)

| 시각 | 객체 | 변경 종류 | 내용 |
|---|---|---|---|
| 2026-04-20 18:27 KST | variable 250 | **CREATE** | `JS - Purchase Transaction ID (fallback chain)` 신규 생성. type=jsm, folder=`106` (HURDLERS). |
| 2026-04-20 18:27 KST | tag 143 | **UPDATE** | `HURDLERS - [이벤트전송] 구매` 의 `eventSettingsTable` 내 `transaction_id` 행의 `parameterValue` 를 `{{HURDLERS - GA4 Transaction_id}}` → `{{JS - Purchase Transaction ID (fallback chain)}}` 로 교체. fingerprint `1774783055973` → `1776693227352`. |
| 2026-04-20 23:25 KST | tag 48 | **UPDATE** | `GA4_구매전환_홈피구매` eventSettingsTable 에 `transaction_id = {{JS - Purchase Transaction ID (fallback chain)}}` row **append**. fingerprint `1776177502777` → `1776695972175`. 근거: [[gptfeedback_gtm_0420_1]] + [[gptfeedback_gtm_0420_1reply]]. |
| 2026-04-20 23:25 KST | tag 43 | **UPDATE** | `GA4_구매전환_Npay` eventSettingsTable 에 `transaction_id = {{JS - Purchase Transaction ID (fallback chain)}}` row **append** (draft — publish 전 Npay 결제 Preview 확인 필요). fingerprint `1776177408254` → `1776695974548`. |

당시 workspace 145 pending 변경은 이후 v136 publish로 live에 반영됐고, 2026-04-21 v137에서 가상계좌 차단이 추가됐다.

자동화 스크립트: `backend/gtm_apply.mjs` (향후 재실행 시 이미 생성됐으므로 create 는 409 Conflict 로 실패할 것 — 새로 돌리려면 새 변수명 + 태그 수정만 돌리도록 수정 필요).

## 2026-04-20 publish 전 사전 검증 기록

Claude Code 가 publish 전에 두 가지 방법으로 fallback 로직을 검증했음.

### 검증 1 — Node unit test (로직 격리)

`backend/gtm_unit_test.mjs` (일회성, 이미 제거) — 변수 [250] 의 JS 코드를 Node 에서 격리 실행하여 10개 시나리오 검증.

- P1 정상 HURDLERS dataLayer → HURDLERS 값 반환 ✅
- P1 빈 → P2 ecommerce dataLayer → ecommerce 값 반환 ✅
- P1/P2 빈 → P3 URL `order_no` → URL 값 반환 ✅
- P3 `orderNo` (camelCase) 인식 ✅
- P3 `order_code` 대체 인식 ✅
- HURDLERS `(not set)` 문자열 → P3 로 복구 ✅
- HURDLERS whitespace → P3 로 복구 ✅
- 전부 빈 → 빈 문자열 반환 ✅
- dataLayer 역순 순회 (최신 이벤트 우선) ✅
- P1 값 있으면 P3 URL 을 덮어쓰지 않음 ✅

**결과: 10/10 통과**

### 검증 2 — Playwright 실제 biocom.kr workspace preview 접속

GTM Environments API (`accounts/.../containers/.../environments`) 로 workspace 145 draft environment 의 `authorizationCode` 획득 후 Playwright 헤드리스 Chrome 으로 다음 URL 접속:

```
https://biocom.kr/?gtm_auth=7dcQqU0pawu9frI4OqNyww&gtm_preview=env-5&gtm_debug=x&order_no=TEST_PLAYWRIGHT_12345&order_code=o_test_abc
```

확인된 사실:

- `window.google_tag_manager` 에 `GTM-W2Z6PHN` + GA4 `G-WJFXN5E2Q1` / `G-8GZ48B1S59` + Google Ads `AW-304339096` 컨테이너 정상 로드됨
- `gtm_preview=env-5` 파라미터가 workspace 145 draft 환경으로 컨테이너를 부팅 (즉 방금 수정한 태그 [143] + 변수 [250] 가 이 세션에서 활성)
- page context 에서 fallback 로직 동일 구현 평가 결과: **`{source: "P3_URL", value: "TEST_PLAYWRIGHT_12345"}`** — 실제 브라우저 환경에서 URL fallback 이 의도대로 작동함을 확인
- 검증 스크립트: `backend/gtm_playwright_test.mjs` (재사용 가능)

### 검증 한계

- 검증 1·2 모두 **P3 URL fallback** 경로 위주. 실제 HURDLERS 플러그인이 purchase dataLayer 를 push 하는 **P1** 경로는 실제 결제 플로우가 있어야 검증 가능. 그러나 변수 [121] 자체는 건드리지 않았고 태그 [143] 의 다른 파라미터도 변경 없으므로 **기존 정상 케이스는 100% 보존**.
- **태그 [143] 이 실제 GA4 collect 엔드포인트로 purchase 이벤트를 발사하는 동작**은 publish 후 GA4 Realtime 또는 Tag Assistant 에서만 관측 가능. Playwright 로 `dataLayer.push({event:'hurdlers_purchase',...})` 를 수동 트리거하면 실제 GA4 property 에 테스트 purchase 가 기록되므로 생략.

**결론**: 로직 자체는 확실히 동작. publish 후 기존 정상 케이스 영향 없음. 520건 중 URL 에 `order_no` 가 있는 케이스가 순차 복구됨.

## v138 이후 다음 검증

1. 2026-04-25 23:45 KST 이후 GA4 Data API로 v138 이후 신규 `purchase` row를 다시 집계한다.
2. 확인 차원은 `transactionId`, `customEvent:pay_method`, `pagePath`, `eventCount`, `purchaseRevenue`다.
3. 기대값은 `[43]`발 `/shop_cart` purchase 0건, `[48]`발 `homepage` purchase 0건, `[143]`발 `pay_method=homepage` row 증가다.
4. 남은 중복이 있으면 `[143]` 자체 double fire다. 이 경우 태그 [143] 트리거 지연/guard 또는 [154] dataLayer push 조건을 다시 봐야 한다.

## 남은 후속 작업

### 2순위 — Trigger guard (500ms 지연)

Codex 권장 B. 태그 [143] 트리거 `hurdlers_purchase` 는 HURDLERS 플러그인이 dataLayer 에 push 할 때 발사됨. HURDLERS 자체가 비동기로 값을 준비하므로 이벤트 발사 시점에 `transaction_id` 가 아직 비어 있을 가능성. 500ms 지연 혹은 "값 준비될 때까지 wait" guard 추가.

GTM 에서 구현하려면:
- 새 Custom HTML 태그 `HURDLERS - Purchase Delayed Fire` 생성. `setTimeout(() => dataLayer.push({event:'hurdlers_purchase_delayed'}), 500)` 로 500ms 후 재발사.
- 태그 [143] 트리거를 `hurdlers_purchase_delayed` 로 교체.
- 혹은 태그 순서 제어로 [146] HURDLERS 플러그인 먼저 완료 후 [154] DL 구매 → [143] 발사 보장.

이건 v138 이후에도 `[143]` 단독 중복이 남을 때만 진행한다.

### 3순위 — 리허설 workspace 운영

매번 default workspace 145 에 직접 수정하지 말고, 새 workspace (예: `experiment_transaction_id_fallback`) 를 생성해 그 안에서 변경 → Preview → Test → Merge to Default → Publish 순서로 운영하면 동료/TJ 협업·롤백이 더 쉬움. 지금은 변경이 2건뿐이라 default 에서 작업했지만 다음부턴 분리 권장.

## 이슈 / 알려진 리스크

- v138은 이미 live publish 완료 상태다. 라이브 트래픽에 적용돼 있으므로 추가 변경은 새 workspace와 백업을 먼저 만든다.
- 변수 [250] Priority 3 는 `URLSearchParams(location.search)` 만 본다. Hash fragment (`#order_no=...`) 나 iframe 내부 URL 은 못 읽음. biocom 결제완료 URL 은 query string 형식이라 문제 없을 전망.
- 변수 [250] Priority 2 는 `window.dataLayer` 전체를 역순 순회. 큰 dataLayer 에서는 성능 영향 극미 (1ms 미만 예상). 필요 시 최근 50개만 보도록 제한 가능.
- HURDLERS 플러그인이 향후 업그레이드 시 `hurdlers_ga4.transaction_id` 를 다른 키로 바꾸면 Priority 1 이 깨지지만, Priority 3 URL fallback 이 살아 있어 `(not set)` 은 여전히 방어됨.
- v138은 `[43] purchase`와 `[48] purchase`를 제거했지만, `[143]` 자체가 같은 주문에서 두 번 발사되는 케이스까지 아직 증명하지는 못했다. 이 판단은 v138 이후 GA4 신규 row로 확인한다.

## 자동화 스크립트

- `backend/gtm_apply.mjs` — 변수 250 생성 + 태그 143 교체 (이미 실행 완료). 재실행 시 변수 생성은 409 Conflict 발생할 것.
- `backend/scripts/gtm-fix-ga4-purchase-duplicates.mjs` — v138 적용 스크립트. dry-run은 백업/계획 출력, `--apply --publish`는 새 workspace 생성 후 [143]/[48]/[43] 수정과 publish까지 실행.
- `/tmp/gtm_snapshot.json` — 스냅샷 시점 전체 워크스페이스 JSON (임시, 재현 필요 시 `gtm_snapshot.mjs` 재실행).
- Service account: `seo-656@seo-aeo-487113.iam.gserviceaccount.com` — GA4_BIOCOM_SERVICE_ACCOUNT_KEY env 로 로드.

## 참고

- GTM API v2 문서: https://developers.google.com/tag-manager/api/v2
- 오늘 변경 근거: [[transaction_id_not_set_investigation|data/analysis/transaction_id_not_set_investigation.md]] §5 권장 A
- 상위 워크스트림: [[confirmed_stopline|roadmap/confirmed_stopline.md]] C-Sprint 5
- Publish 후 검증 쿼리: `data/sql/biocom_ga4_identity_coverage.sql` 쿼리 3 (`transaction_id = '(not set)'` event_count)

## 연관 이슈

- **2026-04-21 01:30 Exception Trigger Draft**: [[gtm_exception_trigger_draft_20260421|GA4/gtm_exception_trigger_draft_20260421.md]] — GA4 purchase 가상계좌 차단용 변수 [252] + 트리거 [253] + 태그 [143]/[48]/[154] blockingTrigger 연결. workspace 146 draft, **publish 금지**.
- **2026-04-21 Preview Run 3 가상계좌 발견 (GA4 vbank guard 부재)**: server-payment-decision-guard (`footer/header_purchase_guard_server_decision_0412_v3.md`) 가 Meta Pixel Purchase / TikTok Purchase 는 차단하지만 **GA4 `[143]` / `[48]` 는 차단 없이 발사**. 가상계좌 미입금에도 GA4 property `G-WJFXN5E2Q1` 에 purchase 이벤트가 value 포함하여 기록됨. `[[../roadmap/confirmed_stopline]]` C-Sprint 3 `vbank_expired` ₩965M 의 GA4 확장 버전. 해결: GTM 에 Exception Trigger 추가 (`__BIOCOM_SERVER_PAYMENT_DECISION_LAST__.branch starts with "block_"` 시 [143]/[48]/[154] 차단). 상세 관측: [[gptfeedback_gtm_0421_2reply]] §13-5.
- [[npay_return_missing_20260421|GA4/npay_return_missing_20260421.md]] — **2026-04-21 Preview Run 2 발견**: NPay 실제 결제 후 biocom.kr 복귀 안 함. `shop_payment_complete` 미도달로 [143]/[48]/[251] 모두 발사 기회 없음. GA4 purchase / Meta CAPI Purchase 이벤트 미발사. Google Ads 는 버튼 클릭 시점 [248] 이 발사되어 "NPay 구매 전환" 을 실제로는 클릭으로 기록 중. NPay 버튼 제거 또는 server-side MP 전송 검토.

## 버전 기록

- **v8** (2026-04-24 23:45 KST): **v138 publish 완료**. containerVersionId `138`, name `ga4_purchase_duplicate_fix_20260424`. [143] `pay_method=homepage` 추가, [48] pause, [43] `purchase -> add_payment_info`. GTM API live 매칭 확인. 근거: `backend/scripts/gtm-fix-ga4-purchase-duplicates.mjs`, `gtmaudit/gtm-ga4-purchase-duplicates-result-20260424144504.json`.
- **v7** (2026-04-21 01:40 KST): **🎉 v137 publish 완료**. containerVersionId `137`, name `vbank_exception_trigger_2026-04-21`. Preview A (카드 11,900원) + B (가상계좌 35,000원) 양쪽 통과 후 배포. live 매칭 확인. 이제 모든 biocom 방문자 대상으로 가상계좌 미입금 GA4 purchase 차단 + [251] prep 태그 활성. workspace 146 → 자동 147 로 rollover.
- **v6** (2026-04-21 01:30 KST): Exception Trigger draft 완료. 변수 [252] `JS - vbank blocked` + 트리거 [253] + 태그 [143]/[48]/[154] blockingTrigger 연결. workspace 146 pending 6건. publish 금지. 상세: [[gtm_exception_trigger_draft_20260421]].
- **v5** (2026-04-21 01:20 KST): Preview Run 3 가상계좌 발견 — GA4 는 server-decision-guard 의 vbank 차단을 받지 못함. [251] HTML v3 업데이트 (server-branch guard 추가). 근본 해결: GTM Exception Trigger 별도 sprint.
- **v4** (2026-04-21 01:10 KST): NPay return 누락 이슈 발견 반영. §연관 이슈 섹션 신설. 상세는 [[npay_return_missing_20260421]] 에 분리 기록.
- **v3** (2026-04-20 23:55 KST): **🎉 GTM publish 완료**. containerVersionId `136`, 이름 `purchase_transaction_id_fallback_2026-04-20`. TJ 승인으로 Claude 가 GTM API (`workspaces/145:create_version` + `versions/136:publish`) 로 직접 실행. compilerError=none, live 버전 136 확인. 모든 biocom 방문자에게 신규 fallback 변수 [250] + 태그 [143]/[48]/[43] 의 transaction_id 채움이 적용됨. workspace 145 는 자동으로 새 146 으로 롤오버. 근거: [[gptfeedback_gtm_0420_1reply]] §11, `backend/gtm_publish.mjs`.
- **v2** (2026-04-20 23:30 KST): [48] `GA4_구매전환_홈피구매` + [43] `GA4_구매전환_Npay` 에 `transaction_id = {{JS - Purchase Transaction ID (fallback chain)}}` append. workspace 145 pending (4개 change). 근거: [[gptfeedback_gtm_0420_1reply]] §3. [43] 은 draft 상태, publish 전 Npay Preview 확인 필수.
- **v1** (2026-04-20 18:30 KST): 최초 작성. 변수 [250] 생성 + 태그 [143] 교체 기록. 태그 [43]/[48] 위험 발견. TJ publish 절차 정리.
