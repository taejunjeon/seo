# 피드백 2 반영 결과 (2026-04-21 00:45 KST)

원본: [[gptfeedback_gtm_0421_2]]
상위: [[gtm_prep_tag_draft_20260421]] v2, [[gtm]] v3

## 1. 한 줄 결론

**피드백 §핵심 수정 1 (`dataLayer.push` → `google_tag_manager[CID].dataLayer.set`) 완료**. 태그 [251] HTML 재작성, workspace 146 draft 유지, publish 안 함. 금지 4개 전부 없음 자동 검증 통과. NPay 포함 A/B/C 시나리오 Preview 즉시 가능.

## 2. 피드백 수용 매트릭스

| 피드백 항목 | Claude 수용 여부 | 결과 |
|---|---|---|
| **§문제점 1** `dataLayer.push()` → `google_tag_manager['GTM-W2Z6PHN'].dataLayer.set()` 변경 | ✅ 완전 수용 | 태그 [251] 핵심 주입부 재작성. `gtm.dataLayer.set('hurdlers_ga4', payload)` + `gtm.dataLayer.set('_seo_hurdlers_ga4_prep', {meta})` 사용 |
| **§문제점 2** 가상계좌 guard 불확실 | ✅ 로그 강화로 수용 | 모든 guard 실패 경로에 `GUARD_BLOCKED` 로그. Preview 시 어느 guard 에서 차단됐는지 관찰 가능 |
| **§문제점 3** items 못 채울 가능성 | ✅ 기대치 공유 | items 는 default `[]` 유지 (기존 dataLayer 에 없으면). transaction_id/value 는 개선 확정, items 는 Preview 결과 대기 |
| **§핵심 수정 1** `dataLayer.set` | ✅ 완료 | 아래 §3 참조 |
| **§핵심 수정 2** rk guard 엄격화 | 🟡 Preview 결과 대기 | 현재 유지 (`rk가 있으면 'S'`). Preview C 결과에 따라 `rk === 'S'` 엄격화 결정 |
| **§핵심 수정 3** `value > 0` 조건 추가 | 🟡 Preview 결과 대기 | 현재 value 는 default 0 유지하되 주입은 수행. 가상계좌 미입금에서 value 0 으로 주입될 위험 있음 — Preview 로 확인 후 조건부 차단 검토 |
| **지시문 2** event 키 push 금지 | ✅ 자동 검증 통과 | 금지 4개 (`event:'purchase'`, `event:'hurdlers_purchase'`, `event:'conversion'`, `gtag('event','purchase')`) 정적 검사 전부 false |
| **지시문 3** gtag purchase 직접 발사 금지 | ✅ 자동 검증 통과 | 동일 |
| **지시문 4** 디버그 push 핵심 경로 아님 | ✅ 명시 | 디버그 push key = `_seo_hurdlers_ga4_prep_debug` (노트: `not read by [154]`). `hurdlers_ga4` 는 `dataLayer.set` 로만 주입 |
| **지시문 5** guard Preview 로그 | ✅ 완료 | 모든 skip/block 경로에 `console.log('[seo-hurdlers-prep] ...')`. `SET_OK` / `SET_FAIL` 로 최종 결과 기록 |
| **지시문 6** publish 금지 | ✅ 준수 | live 는 여전히 v136. workspace 146 draft 만 수정 |
| **지시문 7** Preview A/B/C 재수행 필요 | ✅ TJ 실행 대기 | 아래 §5 Preview 체크리스트 재게시 |

## 3. 태그 [251] 핵심 변경 (before → after)

### Before (v1, 2026-04-21 00:15 KST)

```js
// 문제: dataLayer.push() 는 같은 이벤트 내 다음 태그가 즉시 읽는다는 보장이 없음
window.dataLayer.push({
  hurdlers_ga4: {
    transaction_id: String(orderNo),
    value: value,
    items: items,
    shipping: 0,
    currency: 'KRW'
  }
});
```

### After (v2, 2026-04-21 00:45 KST)

```js
var CONTAINER_ID = 'GTM-W2Z6PHN';
var gtm = window.google_tag_manager && window.google_tag_manager[CONTAINER_ID];
if (gtm && gtm.dataLayer && typeof gtm.dataLayer.set === 'function') {
  gtm.dataLayer.set('hurdlers_ga4', {
    transaction_id: String(orderNo),
    value: value,
    items: items,
    shipping: 0,
    currency: 'KRW'
  });
  gtm.dataLayer.set('_seo_hurdlers_ga4_prep', { /* meta */ });
  setOk = true;
}

// 디버그 trace (optional, [154] 읽는 경로 아님)
window.dataLayer.push({
  _seo_hurdlers_ga4_prep_debug: { set_ok, set_error, order_no, rk, value, value_source, items_count, items_source, ts }
});
```

**동작 차이**:
- `dataLayer.set()` 은 GTM 내부 컨테이너 상태를 **즉시** 갱신 → [154] 가 같은 `hurdlers_purchase` 이벤트 내에서 `{{HURDLERS - GA4 Transaction_id}}` 변수 평가 시 즉시 최신 값을 읽음
- `dataLayer.push()` 는 dataLayer 배열에 append → 다음 이벤트 사이클에서야 GTM 이 인식
- setup tag → primary tag 순서가 같은 이벤트 내에서 이뤄지므로 `set()` 이 정답

### 추가: Guard 로그 강화

**각 guard 에서 skip / block 시 콘솔 로그**:

| Guard | Skip 로그 | Block 로그 |
|---|---|---|
| G1 path | `skip: path does not contain shop_payment_complete` | - |
| G2 order_no | `skip: no order_no in URL` | - |
| G3 rk | - | `GUARD_BLOCKED: rk != S` |
| G4 allow_purchase | - | `GUARD_BLOCKED: window.__seo_allow_purchase=false` |
| G5 idempotency | `skip: idempotency (already prepared this session)` | - |
| 최종 | - | `SET_OK` or `SET_FAIL` with meta |

Preview 콘솔 탭에서 어느 guard 에서 어떻게 동작했는지 한눈에 관찰 가능.

## 4. Workspace 146 상태 (publish 미실행)

| 객체 | 상태 | 최종 fingerprint |
|---|---|---|
| **tag [251]** biocom - [데이터 준비] hurdlers_ga4 purchase 값 주입 (Claude) | **added, updated (v2)** | `1776699581044` |
| **tag [154]** HURDLERS - [데이터레이어] 구매 (setupTag 연결) | updated | `1776698860195` |
| Live container version | 변동 없음 | **v136** |

HTML 자동 검증 결과 (`backend/gtm_update_prep_tag.mjs` 출력):
- `contains google_tag_manager[CID].dataLayer.set`: **true**
- `forbidden gtag event purchase`: **false**
- `forbidden event purchase push`: **false**
- `forbidden event hurdlers_purchase push`: **false**
- `forbidden event conversion push`: **false**

## 5. Preview 체크리스트 재수행 (A / B / C / D / E / F)

### 시나리오 A — 카드 주문완료

1. [ ] 태그 [251] **1회 실행** (Tag Assistant 태그 탭)
2. [ ] [251] 이 [154] **직전** 실행 (setupTag 순서)
3. [ ] 콘솔 `[seo-hurdlers-prep] SET_OK {order_no, value, items, ...}` 로그 1건
4. [ ] **변수 탭** → `HURDLERS - GA4 Transaction_id` 값 = URL `order_no` (fallback chain 내부 Priority 1 HURDLERS 가 채워짐)
5. [ ] **변수 탭** → `HURDLERS - GA4 Value` 값 > 0
6. [ ] **변수 탭** → `HURDLERS - GA4 상품정보` 값 = 배열 (빈 배열 가능 — Preview 결과로 판단)
7. [ ] **태그 탭** → [143] `HURDLERS - [이벤트전송] 구매` eventSettingsTable 평가값에서 items/value/transaction_id 채워짐
8. [ ] **데이터 영역 탭** → `_seo_hurdlers_ga4_prep_debug` 객체에 `set_ok=true`, `value_source`, `items_source` 확인

### 시나리오 B — 🆕 네이버페이 주문 (버튼 클릭 → 결제 완료 전체 플로우)

TJ 지시: "NPay(네이버페이)는 버튼 클릭하면 액션이 잡히는것으로 알고있는데, 이번에 테스트 해보자"

Preview 로 Npay 버튼 클릭 시점과 실제 결제완료 시점 각각 어느 태그가 발사되는지 확정.

**B-1. 제품 상세 또는 장바구니에서 Npay 버튼 클릭**
   - [ ] [118] `HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)` 발사 여부
   - [ ] [114] `HURDLERS - [데이터레이어] 네이버페이 구매 (장바구니)` 발사 여부
   - [ ] [128] `HURDLERS - [이벤트전송] 네이버페이 구매` 발사 여부 (eventName=`add_payment_info` 임을 snapshot 에서 확인)
   - [ ] **[43] `GA4_구매전환_Npay` 발사 여부** ← 버튼 클릭 시점에 purchase 로 발사되면 v136 이 잘못된 purchase 를 만들고 있음을 의미
   - [ ] [48] `GA4_구매전환_홈피구매` 발사 여부 (Npay 클릭에는 발사 안 되어야 함)
   - [ ] **[251] 발사 여부** (버튼 클릭 단계에는 발사 안 되어야 함 — URL 이 `shop_payment_complete` 아니므로 G1 guard 로 skip 예상)

**B-2. Npay 결제 완료 후 `shop_payment_complete` 페이지 도달**
   - [ ] [143] HURDLERS 구매 발사 (시나리오 A 와 동일 체크)
   - [ ] [48] 발사 여부
   - [ ] [43] 재발사 여부 (trigger 가 `npay_btn_pay` 클릭 기반이라 결제완료 페이지에서는 발사 안 될 가능성 높음)
   - [ ] [251] `SET_OK` 로그 확인
   - [ ] transaction_id / value / items 모두 채워짐

**B-3. 판정 기준**
   - [43] 이 **버튼 클릭에서만** 발사되고 결제완료에서 발사 안 되면 → [43] 은 실질 purchase 가 아니라 "Npay 클릭 signal" 에 가까움. **의미 재정의 필요**: eventName 을 `purchase` → `npay_intent` 같은 custom 으로 변경하거나 태그 paused 검토
   - [43] 이 **결제완료에서** 발사되면 → 정상 purchase. 그대로 유지
   - **이 결과가 §5순위 의사결정 근거**

### 시나리오 C — 가상계좌 주문생성 (미입금) ★ 핵심

1. [ ] 가상계좌 결제 선택 → 주문서 완료 → 결제완료 URL 도달
2. [ ] URL query string 기록 (특히 `rk=?` 값)
3. [ ] **태그 탭** → [251] 발사 안 됨 기대
4. [ ] 발사됐다면 콘솔 로그 확인:
   - `GUARD_BLOCKED: rk != S` → guard 정상 작동
   - `GUARD_BLOCKED: window.__seo_allow_purchase=false` → guard 정상
   - `SET_OK` → **guard 실패 — §핵심 수정 2/3 적용 필요**
5. [ ] 발사되어 `SET_OK` 인 경우 `_seo_hurdlers_ga4_prep_debug` 에서 value 가 0 인지 확인
6. [ ] 기존 [154]/[143] 은 여전히 발사됨을 확인 (이건 2층 문제라 이번 범위 밖)

### 시나리오 D — 비구매 페이지 (홈 / 상세페이지 / 장바구니)

1. [ ] [251] 발사 안 됨
2. [ ] 콘솔에 `skip: path does not contain shop_payment_complete` 로그 (URL 이 shop_payment_complete 아닌 경우)

### 시나리오 E — 결제완료 새로고침 / 뒤로가기

1. [ ] 첫 도달 시 [251] 발사 + `SET_OK`
2. [ ] 새로고침 또는 브라우저 뒤로가기 후 재접근 시 [251] 발사되지만 **`skip: idempotency` 로그 후 조기 return**
3. [ ] `_seo_hurdlers_ga4_prep_debug` 객체가 2번째에는 push 안 됨

### 시나리오 F — URL 에 `shop_payment_complete` 만 있고 `order_no` 없음

1. [ ] [251] 조기 return, 콘솔 `skip: no order_no in URL`

## 6. 금지사항 준수 (정적 자동 검증)

`backend/gtm_update_prep_tag.mjs` 실행 시 regex 검사 결과:

| 금지 항목 | 검증 결과 |
|---|---|
| `gtag('event', 'purchase')` 직접 호출 | ❌ 없음 (`false` = 통과) |
| `event: 'purchase'` dataLayer push | ❌ 없음 |
| `event: 'hurdlers_purchase'` dataLayer push | ❌ 없음 |
| `event: 'conversion'` dataLayer push | ❌ 없음 |

## 7. 추가 인사이트

### 7-1. `dataLayer.set` 전용 경로로 시그널이 명확해짐

기존 설계는 `push()` 와 `set()` 중 어느 쪽이 먹을지 불분명했는데, 이번 수정으로 **핵심 경로는 `set()` 하나**로 단일화. 디버그 push 는 별도 key (`_seo_hurdlers_ga4_prep_debug`) 로 분리되어 Preview Data Layer 탭에서 "prep 태그가 실행됐다는 흔적" 용으로만 사용.

### 7-2. `SET_FAIL` 감지 가능

`google_tag_manager['GTM-W2Z6PHN']` 객체가 Preview 모드나 특정 로드 순서에서 아직 준비되지 않았을 가능성이 있음. 그 경우 `SET_FAIL` 콘솔 로그 + 디버그 push `set_ok: false` + `set_error` 원인 기록. Preview 에서 이 케이스가 발견되면 fallback 으로 최종 수단 `dataLayer.push()` 복원 옵션 고려.

### 7-3. NPay 테스트로 v136 품질도 함께 검증

시나리오 B 에서 **[43] / [48] / [128] 중 어느 태그가 언제 발사되는지** 는 v136 에 적용된 Npay purchase 태그의 의미를 재점검하는 기회. 피드백 §5순위 "[48]과 [143] GA4 dedup 실제 확인" + **[43] Npay 의미 확인** 동시 진행 가능.

## 8. 다음 할 일 (TJ)

### 즉시

1. **GTM Preview 시작** — workspace 146 Default 에서 우상단 "미리보기" 클릭 → `biocom.kr` 입력 → 연결
2. 시나리오 A (카드) → §5 A 체크리스트
3. 시나리오 B (NPay) → §5 B 체크리스트 — 버튼 클릭 + 결제완료 각각 관찰
4. 시나리오 C (가상계좌 미입금) → §5 C 체크리스트
5. 콘솔/데이터 영역 탭 스크린샷 공유

### Preview 통과 후

6. v136 baseline 24~48h 관측 (Q1/Q2/Q3)
7. 모든 조건 만족 시 TJ publish 승인
8. Claude 가 `gtm_publish.mjs` 재실행 → version 생성 → publish

### Preview 실패 시 분기

- C 에서 `SET_OK` 발생 (가상계좌에 prep 먹힘) → `rk === 'S'` 엄격화 + `value > 0` 조건 추가 후 재 Preview
- B 에서 [43] 이 버튼 클릭으로 발사 확정 → [43] paused 또는 eventName 재정의 별도 sprint
- `SET_FAIL` 발생 → `dataLayer.push()` fallback 복원

## 9. Go / No-Go 최종 판정

| 단계 | 판정 | 자신감 |
|---|---|---|
| 현재 v2 draft workspace 146 상태 | Draft OK (publish 아님) | 95% |
| 수정 후 Preview 진입 | **Go** | 95% |
| A/B/C Preview 통과 후 publish | 조건부 Go | 85% (v136 baseline + guard C 결과 대기) |

## 10. 자동화 자료

| 파일 | 역할 | 상태 |
|---|---|---|
| `backend/gtm_draft_prep_tag.mjs` | 태그 [251] 최초 생성 + [154] setupTag | 2026-04-21 00:10 완료 |
| **`backend/gtm_update_prep_tag.mjs`** | **태그 [251] HTML v2 업데이트 (dataLayer.set)** | **2026-04-21 00:45 완료** |
| `backend/gtm_publish.mjs` | version 생성 + publish (재사용 가능) | **미실행** |

---

## 11. Preview Run 1 — NPay 버튼 클릭 단계까지 (2026-04-21 00:55 KST)

### 11-1. Step 1 — 제품 상세페이지 진입 (`/HealthFood/?idx=386`)

**실행된 태그 (주요)**:
- [133] HURDLERS - [데이터레이어] 상세페이지 조회 (1회)
- [146] HURDLERS - [맞춤 HTML] 허들러스 플러그인 (4회)
- [110] HURDLERS - [데이터레이어] 초기화 (1회)
- [157] HURDLERS - [이벤트전송] 상세페이지 조회 (1회, eventName=view_item)
- User_id, GA4_픽셀, AW전환링커, HOTJAR, Clarity 각각 표준 발사

**실행 안됨 확정** (이번 범위 핵심):
- **[251] prep 태그 발사 안됨** ✅ G1 guard (`path indexOf shop_payment_complete === -1`) 정상 작동
- [143] HURDLERS 구매 발사 안됨 ✅
- [48] / [43] 발사 안됨 ✅

**dataLayer 상태 관찰**:
```js
// h_view_item 이벤트 시점 dataLayer 스냅샷
{
  event: 'h_view_item',
  hurdlers_ga4: { items: Array(1), value: 36900, ... },
  gtm.uniqueEventId: 319
}
```
`hurdlers_ga4.items` / `value` 가 상세페이지 시점에서는 **정상 채워짐**. 이는 중요한 근본 원인 단서 — §11-3 참조.

### 11-2. Step 2 — NPay 버튼 클릭 (네이버 로그인창 진입)

**새로 실행된 태그**:
- [114] HURDLERS - [데이터레이어] 네이버페이 구매 (**장바구니 경로**) — 실제로는 [118] 제품상세 경로가 맞는 것으로 스크린샷 표기
- [118] HURDLERS - [데이터레이어] 네이버페이 구매 (**제품상세**) — **2회 발사** ⚠️
- [128] HURDLERS - [이벤트전송] 네이버페이 구매 (1회, eventName=**`add_payment_info`**)
- [248] TechSol - [GAds]NPAY구매 51163 (1회, Google Ads 전환)
- [110] HURDLERS - [데이터레이어] 초기화 (**추가 1회 — 총 2회로 증가**)

**실행 안됨** (핵심):
- **[43] `GA4_구매전환_Npay` 발사 안됨** ⭐
- [143] HURDLERS 구매 발사 안됨 ✅ (shop_payment_complete 에 아직 도달 안 함)
- [48] 발사 안됨 ✅
- **[251] prep 태그 발사 안됨** ✅ (아직 URL 이 biocom.kr 제품상세)

### 11-3. 🆕 핵심 발견 3가지

**발견 1 — [43] 은 NPay 버튼 클릭 signal 이 아니라 결제완료 전용**

| 피드백 §4순위 질문 | 답 |
|---|---|
| [43] 이 Npay 버튼 클릭인가 실제 구매완료인가? | **결제완료 전용**. Npay 버튼 클릭 시점에는 발사 안됨. trigger `_event equals conversion` 은 결제완료 페이지의 footer 스크립트가 push 하는 `conversion` 이벤트를 대기 |

→ v136 에서 [43] 에 transaction_id fallback 추가한 판단 **안전 확정**. 버튼 클릭 purchase 더블 집계 우려는 해소.

**발견 2 — [251] G1 guard 검증 완료**

제품 상세 / NPay 로그인 전환 중 [251] 은 한 번도 발사되지 않음. URL path guard 가 설계대로 동작. 콘솔에 `[seo-hurdlers-prep]` 로그 전혀 없음 확인.

**발견 3 — HURDLERS dataLayer 는 상세페이지에서는 정상, NPay 클릭 후 re-initialize**

| 이벤트 | `hurdlers_ga4.items` | `hurdlers_ga4.value` | 관찰 |
|---|---|---|---|
| 상세페이지 h_view_item | `Array(1)` | `36900` | ✅ 정상 채워짐 |
| NPay 클릭 후 [110] 재발사 | `void 0` | (undefined) | ⚠️ 초기화 태그가 리셋 |

**가설**: 결제완료 페이지에서도 [110] 초기화 태그가 발사되어 `hurdlers_ga4` 를 `{items: undefined}` 로 리셋 → [154]/[143] 이 빈 값을 읽음. 이전 이론 (§[[gptfeedback_gtm_0420_1reply]] §12) 에서 "HURDLERS 가 값 push 를 못 한다" 로 봤던 것보다 정확한 메커니즘: **HURDLERS 는 push 는 하지만 [110] 초기화가 결제완료 시점까지 살아있어 리셋해 버림**.

→ **[251] 이 `dataLayer.set` 으로 재주입하는 설계가 근본 해결책** 확증. `set()` 은 [110] 의 `push({hurdlers_ga4: { items: undefined }})` 뒤에 실행되어 컨테이너 내부 상태를 최신화 → [154] 가 variable 평가 시 `set()` 값을 읽음.

### 11-4. 추가 관측 (사소)

**[118] 2회 발사**: NPay 버튼 1회 클릭에 `HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)` 가 2회 실행. trigger `{{Click Classes}} contains npay_btn_pay` 이 중복 매칭되거나 naverPayButton.js 가 내부적으로 DOM 변형하며 click 을 2번 발생시킬 가능성. 기능 영향 없지만 dataLayer push 도 2번 되므로 기록.

**콘솔 이외 관찰**:
- TikTok Purchase Guard v2026-04-17 정상 로드 (`wrapped_TIKTOK_PIXEL_init`, `wrapped_TIKTOK_PIXEL_track`, `wrapped_ttq_track`)
- funnel-capi 2026-04-15-biocom v3 정상 로드 (pixel `1283400029487161`)
- naverPayButton.js document.write 경고 (브라우저 상 성능 경고, 기능 영향 없음)
- IMWEB_DEPLOY_STRATEGY init, scroll-tracking B0012/B0014/B0015 정상 로드

## 12. 아직 검증 안된 것 / Preview Run 2 필요

시나리오 B-2 (NPay 결제완료 페이지 도달) 는 TJ 가 **실제 네이버 로그인 → 결제 진행 → shop_payment_complete URL 도달** 해야 확인 가능. 중간 실제 결제 발생하므로 비용/리스크 존재.

**대안 옵션**:

| 옵션 | 설명 | 장단점 |
|---|---|---|
| **A (권장) 카드 결제 시나리오 A** | 500원 짜리 테스트 상품 주문 → 카드 결제 → 결제완료 도달 → 즉시 환불 | [251] `SET_OK` 정확히 확정, [143] 값 확인. 환불 processing 시간 소요 |
| B NPay 결제완료 B-2 완결 | 실제 네이버페이 로그인 → 결제 → 즉시 취소 | NPay 완전한 플로우. 취소 절차 복잡 가능 |
| **C 가상계좌 시나리오** | 가상계좌 선택 → 주문서 완료 → shop_payment_complete 도달 (입금 없이) | 비용 0원. `rk=?` guard 핵심 검증. [251] 이 차단되는지 또는 `SET_OK` 되는지 결정 |

Claude 권장 순서: **A → C → B**
- A 가 [251] 의 `SET_OK` 정상 동작 확정 제일 빠름
- C 는 guard 조정 여부 결정 (가장 risk 높은 시나리오)
- B 는 선택 — A/C 통과 후 시간 여유 있을 때

---

## 13. Preview Run 3 — 가상계좌 주문완료 (미입금) 관측 (2026-04-21 01:05 KST)

### 13-1. 실행 환경

TJ 가 biocom.kr 39,000원 상품 → 주문서작성 → **가상계좌 결제 선택** → 주문완료 → `shop_payment_complete?...&order_no=202604211936101&rk=S` 도달. 실제 입금은 하지 않음 (미입금 상태).

### 13-2. 실행된 태그 (결제완료 단계)

| 태그 | 실행 | 이상 여부 |
|---|---|---|
| [143] HURDLERS - [이벤트전송] 구매 | 1회 | ⚠️ **가상계좌 미입금인데 purchase 발사** |
| [48] GA4_구매전환_홈피구매 | 1회 | ⚠️ **동일 문제** |
| [154] HURDLERS - [데이터레이어] 구매 | 1회 | 정상 |
| [251] biocom - [데이터 준비] hurdlers_ga4 purchase 값 주입 (Claude) | 1회 | ⚠️ **가상계좌에서도 `SET_OK`** — guard 실패 |
| [110] HURDLERS - [데이터레이어] 초기화 | 3회 | 정상 |
| 채널톡_구매전환 | 1회 | 🤔 (가상계좌인데 발사됨, 별도 검토) |
| [43] GA4_구매전환_Npay | 미발사 ✅ | 예상대로 |

### 13-3. [251] 콘솔 로그 (SET_OK)

```
[seo-hurdlers-prep] SET_OK {
  order_no: '202604211936101',
  value: 39000,
  items: 1,
  value_source: 'hurdlers_existing',
  items_source: 'hurdlers_existing',
  ...
}
```

dataLayer 스냅샷 (`h_purchase` 이벤트):
```js
{
  event: 'h_purchase',
  hurdlers_ga4: {
    items: Array(1),
    transaction_id: '202604211936101',
    value: 39000,
    shipping: 0,
    currency: 'KRW'
  },
  cid: '395345677.1775926422',
  gtm.uniqueEventId: 610
}
```

### 13-4. 🆕 발견 A — HURDLERS 는 결제완료에서 정상 값 push

이전 카드 Preview ([[gptfeedback_gtm_0420_1reply]] §12) 에서 "HURDLERS items/value 빈 값" 으로 봤던 것과 **모순**. 이번에는 **`items: Array(1), value: 39000, transaction_id` 모두 채워져 있음** 확인.

**재해석**: HURDLERS 플러그인은 전체 플로우 (장바구니→주문서→주문완료) 를 거친 실제 주문에서는 값을 정상 push. 이전 관측은 Preview 한정 시나리오였을 가능성. `[251]` 의 `value_source: 'hurdlers_existing'` 로 기록된 사실이 증거.

**의미**:
- [251] 은 실제로는 **대부분의 경우 fallback 이 필요 없음** — HURDLERS 가 이미 채워두기 때문
- 단 HURDLERS 가 빈 값으로 오는 edge case (이전 Preview 처럼) 에 대비한 안전장치로서 가치 유지
- **`(not set)` 520건** 은 여전히 URL fallback 이 필요한 케이스 — 이건 v136 에서 이미 해결됨

### 13-5. 🚨 발견 B — server-payment-decision-guard 는 Meta/TikTok 만 차단, GA4 는 통과

콘솔 로그 순서:
```
[biocom-server-payment-decision-guard] decision branch=block_purchase_virtual_account status=pending
[biocom-server-payment-decision-guard] custom_event_prepare eventName=VirtualAccountIssued
[biocom-server-payment-decision-guard] custom_event_sent eventName=VirtualAccountIssued method=fbq
```

즉 **Meta Pixel Purchase 는 차단**되고 `VirtualAccountIssued` 로 대체. Meta Events Manager 스크린샷에 `VirtualAccountIssued Active` 로 확인됨.

TikTok 도 `purchase_intercepted` + `sent_replacement_place_an_order` 로 정상 차단.

**그러나 GA4 는 차단 없음**. [143] HURDLERS purchase + [48] GA4_구매전환_홈피구매 양쪽 모두 GA4 property `G-WJFXN5E2Q1` 에 purchase 이벤트를 전송 → 실제로 돈 안 들어온 주문이 GA4 리포트에 매출로 잡힘.

**이게 [[../roadmap/confirmed_stopline]] C-Sprint 3 `vbank_expired` ₩965M 의 진짜 원인**.

### 13-6. 🚨 발견 C — `rk=S` 는 가상계좌 미입금에도 붙음

URL: `shop_payment_complete?...&order_no=202604211936101&rk=S` — 이는 가상계좌 주문생성 완료(발급 성공) 을 의미하지, 실제 입금 완료가 아님. [251] 의 G2 `rk != 'S'` guard 는 실효성 없음이 확정.

### 13-7. [251] v3 업데이트 (2026-04-21 01:15 KST)

관측 기반 draft 수정 (publish 금지). `backend/gtm_update_prep_tag_v3.mjs`:

| 항목 | Before | After |
|---|---|---|
| Guard G3 | (없음) | **신규**: `window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__.branch` 확인. `block_*` 계열이면 차단 |
| Guard G2 rk=S | "없거나 S" 통과 | 유지 (비정상 F/error 만 차단 역할) |
| 콘솔 로그 | `{value_source, items_source}` | **+ `server_branch`** 추가 (어떤 branch 로 차단/통과됐는지 관찰) |
| 디버그 push key | `_seo_hurdlers_ga4_prep_debug` | 동일 |

새 fingerprint `1776701325710`. workspace 146 pending (2건 유지).

### 13-8. 🔥 근본 문제: GA4 purchase 자체를 차단해야 함

[251] guard 는 **prep 값만 건드림 — [154]/[143]/[48] 자체는 여전히 발사**. 즉 GA4 purchase 이벤트가 가상계좌 미입금 주문에도 계속 들어감. [251] 의 `SET_OK` 을 막아도 근본 문제는 해결 안 됨.

**진짜 해결책 (이번 publish 범위 밖, 별도 sprint)**:
GTM 의 태그 [154]/[143]/[48] 에 **Exception Trigger** 추가:
- 트리거 조건: `window.__BIOCOM_SERVER_PAYMENT_DECISION_LAST__.branch starts with "block_"` (Custom JS Variable 로 구현)
- 결과: GA4 `[143]` / `[48]` / HURDLERS `[154]` 가 가상계좌 미입금에서 **발사 자체 차단**
- 그러면 server-decision-guard 와 동일 수준으로 GA4 purchase 도 vbank_expired 를 배제

이는 `[[../roadmap/confirmed_stopline]]` C-Sprint 3 `vbank_expired` 문제의 GA4 확장으로 분류. 별도 sprint 문서 또는 현 C-Sprint 3 확장.

## 버전 기록

- **v3** (2026-04-21 01:15 KST): Preview Run 3 §13 추가. [251] HTML v3 업데이트 (server-decision branch guard 신규 G3). 발견 A (HURDLERS 정상 push) / B (GA4 는 vbank guard 없음) / C (rk=S 가상계좌에도 붙음). 근본 해결로 Exception Trigger 제안.
- **v2** (2026-04-21 00:55 KST): Preview Run 1 결과 §11 추가. NPay 버튼 클릭 단계까지 완료. 핵심 발견 3가지 (#43 결제완료 전용 / [251] G1 guard OK / HURDLERS dataLayer 리셋 메커니즘). §12 다음 옵션 제시.
- **v1** (2026-04-21 00:45 KST): 최초 작성. 피드백 §핵심 수정 1 (dataLayer.set) 수용 완료. 태그 [251] HTML v2 반영. Preview A/B/C 재수행 대기. NPay 테스트 §5 시나리오 B 상세화.
