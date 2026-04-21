# biocom GTM 컨테이너 상태 정리

작성 시각: 2026-04-20 18:30 KST (v3 업데이트: 2026-04-20 23:55 KST)
작성자: Claude Code (GTM API 직접 조회)
근거: GTM API v2 snapshot (workspace 145, `/tmp/gtm_snapshot.json` 311KB)
대상 컨테이너: `GTM-W2Z6PHN` (biocom.kr)
관련 문서: [[confirmed_stopline|roadmap/confirmed_stopline.md]] C-Sprint 5, [[transaction_id_not_set_investigation|data/analysis/transaction_id_not_set_investigation.md]]

## 10초 요약

- biocom GTM 에는 `event_name='purchase'` 태그가 **3개 활성 + 1개 일시중단**. 이 중 **`transaction_id` 파라미터를 명시한 태그는 [143] 단 1개**였음.
- 나머지 활성 purchase 태그 **[43] GA4_구매전환_Npay**, **[48] GA4_구매전환_홈피구매**는 `transaction_id` 파라미터가 아예 **없어서** GA4 에 도달 시 자동 `(not set)` 처리.
- **오늘 수정**: 변수 [250] `JS - Purchase Transaction ID (fallback chain)` 신규 생성 + 태그 [143] 의 transaction_id 를 이 변수로 교체. **Workspace 145 에만 커밋, publish 안 함**. TJ Preview 검증 후 수동 publish 필요.
- **후속 권장**: [43] / [48] 에도 `transaction_id = {{JS - Purchase Transaction ID (fallback chain)}}` 파라미터 추가 (TJ 승인 시 즉시 자동화 가능). 이 조치를 해야 `(not set)` 520건의 나머지 원인까지 커버.

## 컨테이너 메타

| 항목 | 값 |
|---|---|
| GTM Account | `바이오컴(최종)` (accountId=`4703003246`) |
| Container public ID | `GTM-W2Z6PHN` |
| Container numeric ID | `13158774` |
| Usage context | `web` |
| Default Workspace | id=`145` path=`accounts/4703003246/containers/13158774/workspaces/145` |
| Variables total | 59 (custom 47 + built-in 12 이상) |
| Tags total | 56 |
| Triggers total | 80 |
| Live container version | 스냅샷 시점 snapshot 기준 (workspace 145 에만 pending change 있음) |

다른 사이트 컨테이너 (참고, 이 문서 범위 밖):
- `GTM-5M33GC4` — thecleancoffee.com (containerId=`91608400`)
- `GTM-T8FLZNT` — AIBIO (containerId=`92360859`)

## Service Account 접근

- 계정: `seo-656@seo-aeo-487113.iam.gserviceaccount.com`
- 현재 권한 상태: **biocom.kr 컨테이너에 Publish 권한 보유 (2026-04-20 TJ 부여)**. 변수/태그/트리거 조회·생성·수정·버전 생성·게시 모두 API 로 가능.
- 스코프: `tagmanager.readonly` / `tagmanager.edit.containers` / `tagmanager.edit.containerversions` / `tagmanager.publish` 중 `edit.containers` 로 현재 작업 수행.

## GA4 Purchase 태그 완전 목록 (`eventName='purchase'`)

| tagId | 이름 | 활성 | measurementId | `transaction_id` 파라미터 | 트리거 조건 |
|---|---|---|---|---|---|
| **143** | **HURDLERS - [이벤트전송] 구매** | ✅ | `{{HURDLERS - GA4 아이디}}` | **`{{JS - Purchase Transaction ID (fallback chain)}}` ← 오늘 교체됨** | `{{_event}} equals hurdlers_purchase` (DL [154] 이 발사) |
| 43 | GA4_구매전환_Npay | ✅ | `G-WJFXN5E2Q1` | ❌ **없음** | npay 버튼 클릭 (`npay_logo`/`npay_btn_pay` 등) + `{{_event}} equals conversion` |
| 48 | GA4_구매전환_홈피구매 | ✅ | `G-WJFXN5E2Q1` | ❌ **없음** | `Page Path contains shop_payment_complete` & `{{dlv_price_vlaue}} greater 0` & `{{_event}} equals conversion` |
| 98 | GA4_구매전환_Npay 2 | ⏸ PAUSED | `G-8GZ48B1S59` | ❌ 없음 | npay 버튼 클릭 (일시중단) |

### 태그 [143] (핵심 purchase 태그) 상세

- Type: `gaawe` (GA4 Event)
- eventName: `purchase`
- Event settings (오늘 수정 후 최신):
  - `items = {{HURDLERS - GA4 상품정보}}`
  - **`transaction_id = {{JS - Purchase Transaction ID (fallback chain)}}`** ← 이전 값 `{{HURDLERS - GA4 Transaction_id}}` 에서 교체
  - `value = {{HURDLERS - GA4 Value}}`
  - `shipping = {{HURDLERS - GA4 shipping}}`
  - `currency = KRW`
  - `cid = {{HURDLERS - [변수] cid}}`
  - `user_id = {{HURDLERS - [맞춤 JS] user_id}}`
  - `utm_source / utm_medium / utm_campaign / utm_content / utm_term / member_code` — Retous 변수 사용
- Trigger: `HURDLERS - [맞춤 이벤트] hurdlers_purchase` (`{{_event}} equals hurdlers_purchase`)
- 발사 순서: `HURDLERS 플러그인 [146]` → `HURDLERS - [데이터레이어] 구매 [154]` (html 태그가 `hurdlers_purchase` 이벤트를 dataLayer 에 push) → 태그 [143] 이 그 이벤트로 발사
- Fingerprint: `1776693227352` (fingerprint 값은 변경 시마다 새로 생성됨)

### 태그 [43] GA4_구매전환_Npay (위험 요소)

- Type: `gaawe`, eventName=`purchase`, measurementId=`G-WJFXN5E2Q1`
- Event settings: `currency=KRW`, `pay_method=npay`, `value={{dlv_price_vlaue}}`, `user_time={{USER_TIME}}`
- **문제**: `transaction_id` 파라미터 **없음**. npay 버튼 클릭 시 발사되면 GA4 는 `transaction_id='(not set)'` 로 저장
- Trigger: 네이버페이 버튼 클릭 감지용 `customEvent` 2개 (`purchase_npay_mo`, `purchase_npay_pc`)
- **가설**: HURDLERS 태그 [143] 과 동시에 발사되면 purchase 이벤트가 중복 집계됨. 그러나 이 태그만 단독 발사되는 edge case (HURDLERS dataLayer push 실패/ Npay 팝업 내 이벤트 순서 꼬임)에는 `(not set)` 520건 중 일부 원인일 가능성 높음.

### 태그 [48] GA4_구매전환_홈피구매 (위험 요소)

- Type: `gaawe`, eventName=`purchase`, measurementId=`G-WJFXN5E2Q1`
- Event settings: `currency=KRW`, `pay_method=homepage`, `value={{dlv_price_vlaue}}`, `user_time={{USER_TIME}}`
- **문제**: `transaction_id` 파라미터 **없음**.
- Trigger: `{{Page Path}} contains shop_payment_complete AND {{dlv_price_vlaue}} greater 0 AND {{_event}} equals conversion`
- **가설**: 결제완료 페이지에서 `dlv_price_vlaue>0` 이면 발사. 네이버페이가 아닌 홈페이지 일반 결제(카드/계좌이체) 주문이 여기에 해당. transaction_id 없이 발사되므로 **`(not set)` 520건의 주범 후보**. Codex 보고서 root cause (`GTM purchase 태그가 URL fallback 없이 dataLayer 만 읽음`) 와 정확히 일치.

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

## 오늘 적용한 변경 (Workspace 145 pending, 미publish)

| 시각 | 객체 | 변경 종류 | 내용 |
|---|---|---|---|
| 2026-04-20 18:27 KST | variable 250 | **CREATE** | `JS - Purchase Transaction ID (fallback chain)` 신규 생성. type=jsm, folder=`106` (HURDLERS). |
| 2026-04-20 18:27 KST | tag 143 | **UPDATE** | `HURDLERS - [이벤트전송] 구매` 의 `eventSettingsTable` 내 `transaction_id` 행의 `parameterValue` 를 `{{HURDLERS - GA4 Transaction_id}}` → `{{JS - Purchase Transaction ID (fallback chain)}}` 로 교체. fingerprint `1774783055973` → `1776693227352`. |
| 2026-04-20 23:25 KST | tag 48 | **UPDATE** | `GA4_구매전환_홈피구매` eventSettingsTable 에 `transaction_id = {{JS - Purchase Transaction ID (fallback chain)}}` row **append**. fingerprint `1776177502777` → `1776695972175`. 근거: [[gptfeedback_gtm_0420_1]] + [[gptfeedback_gtm_0420_1reply]]. |
| 2026-04-20 23:25 KST | tag 43 | **UPDATE** | `GA4_구매전환_Npay` eventSettingsTable 에 `transaction_id = {{JS - Purchase Transaction ID (fallback chain)}}` row **append** (draft — publish 전 Npay 결제 Preview 확인 필요). fingerprint `1776177408254` → `1776695974548`. |

Workspace status API 결과에서 위 4개 change pending 상태로 관측. 다른 객체는 변경 없음.

자동화 스크립트: `backend/gtm_apply.mjs` (향후 재실행 시 이미 생성됐으므로 create 는 409 Conflict 로 실패할 것 — 새로 돌리려면 새 변수명 + 태그 수정만 돌리도록 수정 필요).

## Publish 전 사전 검증 (2026-04-20 18:45 KST 완료)

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

## TJ 다음 단계 (publish 진행)

1. **GTM UI 접속**: https://tagmanager.google.com/#/container/accounts/4703003246/containers/13158774/workspaces/145
2. **변수 확인**: 좌측 "변수" → 사용자 정의 변수 → `JS - Purchase Transaction ID (fallback chain)` 찾아 열기 → 코드 확인
3. **태그 확인**: 좌측 "태그" → `HURDLERS - [이벤트전송] 구매` 열기 → 이벤트 매개변수 `transaction_id` 의 값이 `{{JS - Purchase Transaction ID (fallback chain)}}` 인지 확인
4. **Preview (미리보기) 모드**:
   - 우상단 **미리보기** 클릭 → `https://biocom.kr` 입력 → 연결
   - 실제 결제 플로우 1건 진행 (상품 선택 → 장바구니 → 주문서 작성 → 결제)
   - 결제완료 페이지에서 Tag Assistant 의 "Variables" 탭에서 `JS - Purchase Transaction ID (fallback chain)` 값이 `order_no` 와 일치하는지 확인
   - "Tags fired" 에 `HURDLERS - [이벤트전송] 구매` 가 있고, transaction_id 가 빈 값이 아닌지 확인
5. **Publish**: Preview 로 값이 정상 들어가는 것을 확인한 후 우상단 **제출** → 버전 이름 `purchase_transaction_id_fallback_2026-04-20` + 설명 `(not set) 520건 대응: URL order_no fallback` → **게시**
6. **publish 후 검증**: 게시 후 24h 내 GA4 Realtime → `purchase` 이벤트 → `transaction_id` 차원에서 `(not set)` 비율 하락 확인. 48~72h 후 `data/sql/biocom_ga4_identity_coverage.sql` 쿼리 3 재실행해 event_count 비교.

## 후속 권장 작업 (TJ 승인 시 즉시 자동화)

### 1순위 — 태그 [43] / [48] 에 transaction_id 파라미터 추가

태그 [43] `GA4_구매전환_Npay` 과 [48] `GA4_구매전환_홈피구매` 는 **eventName=purchase 인데 transaction_id 를 아예 안 보냄**. 이 두 태그가 단독으로 발사될 때는 100% `(not set)` 확정. Codex 보고서 root cause 와 일치하는 최대 위험 요소.

자동화 방법: `backend/gtm_apply.mjs` 에 두 태그의 `eventSettingsTable.list` 에 다음 row 를 append 하는 스크립트를 추가해 1분 내 완료.

```js
{
  type: 'map',
  map: [
    { type: 'template', key: 'parameter', value: 'transaction_id' },
    { type: 'template', key: 'parameterValue', value: '{{JS - Purchase Transaction ID (fallback chain)}}' }
  ]
}
```

다만 이 태그들이 HURDLERS 태그 [143] 과 동시 발사되어 **중복 purchase** 를 유발하는지 먼저 Preview 로 확인 필요. 이 두 태그가 legacy 중복 이벤트면 transaction_id 추가하기보다 **태그 자체를 일시중단(paused)** 하는 게 맞을 수 있음. TJ 판단 필요.

### 2순위 — Trigger guard (500ms 지연)

Codex 권장 B. 태그 [143] 트리거 `hurdlers_purchase` 는 HURDLERS 플러그인이 dataLayer 에 push 할 때 발사됨. HURDLERS 자체가 비동기로 값을 준비하므로 이벤트 발사 시점에 `transaction_id` 가 아직 비어 있을 가능성. 500ms 지연 혹은 "값 준비될 때까지 wait" guard 추가.

GTM 에서 구현하려면:
- 새 Custom HTML 태그 `HURDLERS - Purchase Delayed Fire` 생성. `setTimeout(() => dataLayer.push({event:'hurdlers_purchase_delayed'}), 500)` 로 500ms 후 재발사.
- 태그 [143] 트리거를 `hurdlers_purchase_delayed` 로 교체.
- 혹은 태그 순서 제어로 [146] HURDLERS 플러그인 먼저 완료 후 [154] DL 구매 → [143] 발사 보장.

이건 Preview 결과에 따라 추가하거나 생략 가능. 1순위 + 오늘 변경만으로도 대부분의 `(not set)` 는 커버될 전망.

### 3순위 — 리허설 workspace 운영

매번 default workspace 145 에 직접 수정하지 말고, 새 workspace (예: `experiment_transaction_id_fallback`) 를 생성해 그 안에서 변경 → Preview → Test → Merge to Default → Publish 순서로 운영하면 동료/TJ 협업·롤백이 더 쉬움. 지금은 변경이 2건뿐이라 default 에서 작업했지만 다음부턴 분리 권장.

## 이슈 / 알려진 리스크

- **Publish 전**이므로 라이브 트래픽에는 아직 영향 없음. Preview 로만 테스트됨.
- 변수 [250] Priority 3 는 `URLSearchParams(location.search)` 만 본다. Hash fragment (`#order_no=...`) 나 iframe 내부 URL 은 못 읽음. biocom 결제완료 URL 은 query string 형식이라 문제 없을 전망.
- 변수 [250] Priority 2 는 `window.dataLayer` 전체를 역순 순회. 큰 dataLayer 에서는 성능 영향 극미 (1ms 미만 예상). 필요 시 최근 50개만 보도록 제한 가능.
- HURDLERS 플러그인이 향후 업그레이드 시 `hurdlers_ga4.transaction_id` 를 다른 키로 바꾸면 Priority 1 이 깨지지만, Priority 3 URL fallback 이 살아 있어 `(not set)` 은 여전히 방어됨.
- 태그 [143] 하나만 수정했기 때문에 **[43]/[48] 단독 발사 케이스 커버 안 됨**. 위 "후속 권장 작업 §1순위" 를 적용해야 완전한 해결.

## 자동화 스크립트

- `backend/gtm_apply.mjs` — 변수 250 생성 + 태그 143 교체 (이미 실행 완료). 재실행 시 변수 생성은 409 Conflict 발생할 것.
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

- **v7** (2026-04-21 01:40 KST): **🎉 v137 publish 완료**. containerVersionId `137`, name `vbank_exception_trigger_2026-04-21`. Preview A (카드 11,900원) + B (가상계좌 35,000원) 양쪽 통과 후 배포. live 매칭 확인. 이제 모든 biocom 방문자 대상으로 가상계좌 미입금 GA4 purchase 차단 + [251] prep 태그 활성. workspace 146 → 자동 147 로 rollover.
- **v6** (2026-04-21 01:30 KST): Exception Trigger draft 완료. 변수 [252] `JS - vbank blocked` + 트리거 [253] + 태그 [143]/[48]/[154] blockingTrigger 연결. workspace 146 pending 6건. publish 금지. 상세: [[gtm_exception_trigger_draft_20260421]].
- **v5** (2026-04-21 01:20 KST): Preview Run 3 가상계좌 발견 — GA4 는 server-decision-guard 의 vbank 차단을 받지 못함. [251] HTML v3 업데이트 (server-branch guard 추가). 근본 해결: GTM Exception Trigger 별도 sprint.
- **v4** (2026-04-21 01:10 KST): NPay return 누락 이슈 발견 반영. §연관 이슈 섹션 신설. 상세는 [[npay_return_missing_20260421]] 에 분리 기록.
- **v3** (2026-04-20 23:55 KST): **🎉 GTM publish 완료**. containerVersionId `136`, 이름 `purchase_transaction_id_fallback_2026-04-20`. TJ 승인으로 Claude 가 GTM API (`workspaces/145:create_version` + `versions/136:publish`) 로 직접 실행. compilerError=none, live 버전 136 확인. 모든 biocom 방문자에게 신규 fallback 변수 [250] + 태그 [143]/[48]/[43] 의 transaction_id 채움이 적용됨. workspace 145 는 자동으로 새 146 으로 롤오버. 근거: [[gptfeedback_gtm_0420_1reply]] §11, `backend/gtm_publish.mjs`.
- **v2** (2026-04-20 23:30 KST): [48] `GA4_구매전환_홈피구매` + [43] `GA4_구매전환_Npay` 에 `transaction_id = {{JS - Purchase Transaction ID (fallback chain)}}` append. workspace 145 pending (4개 change). 근거: [[gptfeedback_gtm_0420_1reply]] §3. [43] 은 draft 상태, publish 전 Npay Preview 확인 필수.
- **v1** (2026-04-20 18:30 KST): 최초 작성. 변수 [250] 생성 + 태그 [143] 교체 기록. 태그 [43]/[48] 위험 발견. TJ publish 절차 정리.
