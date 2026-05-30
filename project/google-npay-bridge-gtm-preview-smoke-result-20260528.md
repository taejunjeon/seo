# Google NPay bridge GTM Preview smoke 결과 - 2026-05-28

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_harness_read:
    - project/google-npay-button-bridge-gtm-patch-and-bi-confirmed-plan-20260528.md
    - project/google-npay-bridge-hash-hardening-20260528.md
  required_context_docs:
    - project/google-npay-button-bridge-gtm-patch-and-bi-confirmed-plan-20260528.md
  lane: Yellow
  allowed_actions:
    - GTM fresh workspace Preview
    - one NPay button-click smoke
    - Tag Assistant read-only verification
    - VM Cloud public aggregate read-only check
  forbidden_actions:
    - GTM submit/create_version/publish
    - NPay login or actual payment
    - Google Ads conversion send
    - production DB write
  source_window_freshness_confidence:
    source: GTM Tag Assistant preview + VM Cloud public dashboard-summary API
    window: smoke at 2026-05-28 11:11-11:13 KST
    freshness: live preview and live API checked immediately after smoke
    confidence: high for tag firing; medium for VM Cloud aggregate storage; row-level storage needs admin-token read check
```

## 한 줄 결론

GTM Preview workspace에서 NPay bridge 보강 태그가 상품 페이지에 설치되고, NPay 버튼 클릭 시 태그가 실행되는 것까지 확인했다. 결제, 로그인, GTM 게시, Google Ads 전송은 하지 않았다.

## 실행 범위

- GTM container: `GTM-W2Z6PHN`
- GTM workspace: `biocom-npay-bridge-preview-20260528`
- GTM workspace URL: `https://tagmanager.google.com/?hl=ko&pli=1#/container/accounts/4703003246/containers/13158774/workspaces/171`
- Preview tag: `BI - NPay Bridge Intent Capture v1 [PREVIEW ONLY]`
- Test page: 바이오컴 뉴로마스터 상품 페이지, Google 광고 클릭 URL 재사용 + `__seo_attribution_debug=1`
- Smoke time: 2026-05-28 11:11-11:13 KST

## 확인 결과

1. GTM Preview connection: PASS
   - Tag Assistant가 `biocom.kr`에 연결됨.
   - GTM-W2Z6PHN preview container로 실행됨.

2. Preview tag install: PASS
   - Site console log: `[biocom-npay-bridge-gtm] installed`
   - Tag Assistant fired tags list에서 `BI - NPay Bridge Intent Capture v1 [PREVIEW ONLY]` 1회 실행 확인.

3. NPay button click capture: PASS
   - Site console log: `[biocom-npay-bridge-gtm] npay click observed`
   - Site console log: `[biocom-npay-bridge-gtm] sent payload presence`
   - Tag Assistant event list에 `biocom_npay_bridge_intent_captured` 생성 확인.

4. Payment / login guard: PASS
   - NPay 로그인 또는 결제 완료를 진행하지 않음.
   - 실제 주문 생성 없음.

5. Publish guard: PASS
   - GTM `제출`, `버전 만들기`, `게시` 실행 없음.
   - Live version unchanged.

6. Platform-send guard: PASS
   - Google Ads 실제 구매 전환 upload 실행 없음.
   - Meta/GA4/TikTok purchase send 실행 없음.

## VM Cloud 확인

VM Cloud 공개 API로 2026-05-28 KST 당일 요약을 확인했다.

- source: `https://att.ainativeos.net/api/google-ads/dashboard-summary?date_preset=today&refresh=1`
- fetchedAt: 2026-05-28 11:13 KST
- today NPay intent count: 21
- today Google-like NPay intent count: 18
- today Google click-id intent count: 18
- today direct NPay actual confirmed bridge candidate: 0

주의:

- `/api/attribution/npay-intents` row-level 조회는 admin token이 필요했고, 현재 로컬 환경에는 해당 token이 없어 exact latest row는 확인하지 못했다.
- 따라서 서버 저장은 공개 집계 기준으로만 확인했고, “이번 클릭 row의 hash/필드가 정확히 어떤 값으로 저장됐는지”는 admin-token read check가 남아 있다.
- row-level 확인 절차는 `project/google-npay-row-level-verification-runbook-20260528.md`에 고정했다.

## 판단

Preview 태그 자체는 목적대로 동작했다.

- NPay 버튼 클릭 순간을 잡는다.
- Google click id가 들어 있는 landing URL 상태에서 실행됐다.
- VM Cloud receiver로 payload 전송을 시도한다.
- GTM production에는 아직 반영되지 않았다.

남은 핵심은 “전송 시도”가 아니라 “row-level로 어떤 필드가 저장됐는지”를 확인하는 것이다. 특히 `npay_bridge_url_hash`, `npay_bridge_host`, `gclid/gbraid/wbraid presence`, `source=gtm_npay_bridge_v1`를 확인해야 production publish 판단이 가능하다.

## Auditor verdict

PASS_WITH_NOTES

- PASS: Preview tag firing and NPay click capture observed.
- NOTE: Exact VM Cloud row-level verification blocked by missing read token in local environment.
- NOTE: Current Preview-only safety is workspace draft isolation. The tag runtime itself is not debug-query gated, so production publish before final guard review is prohibited.

---

## v1.1 Preview 적용 결과 - 2026-05-28 12:49-12:57 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_harness_read:
    - harness/npay-recovery/RULES.md
    - project/google-npay-bridge-url-capture-v11-20260528.md
  required_context_docs:
    - project/google-npay-bridge-url-capture-v11-20260528.md
  lane: Yellow
  allowed_actions:
    - GTM Preview workspace edit
    - GTM quick_preview compile
    - no-click Playwright install smoke
    - VM Cloud row-level read-only check
  forbidden_actions:
    - GTM submit/create_version/publish
    - NPay login or actual payment
    - Google Ads conversion send
    - production DB write
  source_window_freshness_confidence:
    source: GTM API + Playwright preview-route smoke + VM Cloud row-level read-only API
    window: 2026-05-28 12:49-12:57 KST
    freshness: live immediately after GTM workspace change
    confidence: high for Preview install; pending for button-click bridge URL row until TJ manual click smoke
```

### 한 줄 결론

GTM Preview workspace `171` 안에 NPay bridge v1.1 태그를 적용했고, 기존 v1 Preview 태그는 중복 저장 방지를 위해 workspace 안에서만 일시중지했다. Production publish는 하지 않았고 live version은 `145` 그대로다.

### 적용 내용

- Workspace: `biocom-npay-bridge-preview-20260528` (`workspace_id=171`)
- 기존 v1 tag: `BI - NPay Bridge Intent Capture v1 [PREVIEW ONLY]` (`tag_id=308`)
  - Preview workspace 안에서만 `paused=true` 처리
- 신규 v1.1 tag: `codex_npay_bridge_v11_custom_html_preview_20260528T034958Z` (`tag_id=311`)
- 신규 trigger: `codex_npay_bridge_v11_all_pages_preview_20260528T034958Z` (`trigger_id=310`)
- Source snippet: `imweb/biocom-npay-bridge-gtm-v1-1-preview.js`

### 검증 결과

1. GTM API 적용: PASS
   - quick_preview `compiler_error=null`
   - preview environment present: `environment_id=309`

2. Production guard: PASS
   - `Submit`, `Create version`, `Publish` 호출 없음
   - published live version 재조회 결과: `145 (paid_click_intent_v3_stale_click_id_guard_20260521)`

3. 설치 smoke: PASS
   - Playwright로 상품 페이지 `/shop_view/?idx=198`에 Preview 컨테이너를 강제 로드
   - `window.__BIOCOM_NPAY_BRIDGE_GTM_VERSION__ = 2026-05-28-biocom-npay-bridge-gtm-v1-1`
   - console marker는 v1.1만 출력됨
   - NPay 버튼 클릭은 수행하지 않음

4. VM Cloud row-level 사전조회: PASS_WITH_NOTES
   - `source=gtm_npay_bridge_v1_1`, 최근 180분 row: 0건
   - 클릭 smoke 전이므로 0건이 정상
   - 다음 검증은 TJ님이 Preview 연결 상태에서 NPay 버튼을 1회 클릭한 뒤 row-level 조회

### 산출물

- 적용 결과 JSON: `data/npay-bridge-v11-gtm-preview-apply-20260528T034958Z.json`
- 설치 smoke JSON: `data/npay-bridge-v11-gtm-preview-install-smoke-20260528T035655Z.json`
- dry-run JSON:
  - `data/npay-bridge-v11-gtm-preview-dry-run-20260528T034724Z.json`
  - `data/npay-bridge-v11-gtm-preview-dry-run-20260528T034908Z.json`

### 다음 smoke 기준

TJ님이 GTM Preview 연결 상태에서 NPay 버튼을 1회 클릭하면, Codex는 아래를 row-level로 확인한다.

- `source=gtm_npay_bridge_v1_1`
- `has_google_click_id=true`
- `has_npay_bridge_url_hash=true`
- `npay_bridge_host`가 `orders.pay.naver.com` 또는 `nid.naver.com`
- Google Ads / Meta / GA4 / TikTok 전환 전송 없음

### Auditor verdict

PASS_WITH_NOTES

- PASS: v1.1 Preview tag applied and installed.
- PASS: old v1 Preview tag paused to avoid duplicate row.
- PASS: live GTM version unchanged.
- NOTE: bridge URL capture itself requires an actual NPay button click smoke.

---

## 운영 게시 반영 - 2026-05-28 13:46 KST

TJ님이 `GTM Production publish 승인: BI NPay Bridge v1.1 운영 게시 YES`를 명시 승인했다.

게시 전 workspace를 정리했다.

- Preview 전용 old v1 tag `308` 삭제
- v1.1 trigger `310` 이름을 `BI - NPay Bridge Intent Capture v1.1 - All Pages`로 정리
- 최종 게시 변경은 v1.1 태그 1개와 트리거 1개로 제한

게시 결과:

- previous live version: `145 (paid_click_intent_v3_stale_click_id_guard_20260521)`
- new live version: `146 (BI NPay Bridge v1.1 production 20260528T044617Z)`
- live tag: `BI - NPay Bridge Intent Capture v1.1`
- live trigger: `BI - NPay Bridge Intent Capture v1.1 - All Pages`

게시 후 no-click smoke:

- 운영 상품 페이지에서 v1.1 production-ready 태그 로드 확인
- NPay 버튼 클릭 없음
- Google Ads conversion request 없음
- VM Cloud receiver write 없음
- 결제/로그인 없음

산출물:

- `data/npay-bridge-v11-gtm-production-prepublish-cleanup-20260528T044517Z.json`
- `data/npay-bridge-v11-gtm-production-publish-20260528T044617Z.json`
- `data/npay-bridge-v11-production-no-click-smoke-20260528T044717Z.json`

남은 확인:

- live row-level 저장 확인은 NPay 버튼 클릭이 있어야 한다.
- 기존 Google Ads NPay 보조 전환 태그가 버튼 클릭 때 같이 발화할 수 있으므로, 자동 클릭 smoke는 이번 publish 보고에서는 실행하지 않았다.

Auditor verdict: PUBLISHED_WITH_NO_CLICK_SMOKE_PASS

---

## 운영 게시 후 버튼 클릭 row-level 확인 - 2026-05-28 14:56 KST

TJ님이 운영 게시 후 NPay 버튼 클릭 smoke를 1회 진행했다.

- Biocom 진입 시각: 2026-05-28 14:56 KST
- NPay 주문결제 진입 시각: 2026-05-28 14:56 KST
- NPay 진입 URL: 원문은 보고서에 저장하지 않음. VM Cloud에는 host/hash/path hash만 저장됨.
- Row-level check output: `data/npay-bridge-v11-live-button-smoke-20260528T055824Z.json`

확인 결과:

| 항목 | 결과 |
|---|---|
| source | `gtm_npay_bridge_v1_1` |
| latest row captured_at | `2026-05-28 14:56:24 KST` |
| product_idx | `198` |
| product_price | `35000` |
| Google click id present | yes |
| gclid present | yes |
| gbraid/wbraid present | no/no |
| NPay bridge URL hash present | yes |
| NPay bridge path hash present | yes |
| NPay bridge host | `pay.naver.com` |
| button selector present | yes |
| duplicate_count | 1 |
| environment | `preview` |
| debug_mode | true |

해석:

- 버튼 클릭 시점에 Google click id와 NPay bridge URL evidence가 같은 row에 저장됐다.
- 즉 `Google 광고 클릭 -> 상품 페이지 -> NPay 버튼 클릭/주문결제 진입` 구간의 유실 병목은 v1.1 보강 후 해소된 것으로 본다.
- 다만 이번 row는 `environment=preview`, `debug_mode=true`로 저장됐다. 테스트 URL 또는 브라우저에 GTM preview/debug marker가 남아 있었을 가능성이 높다.
- 같은 30분 window 안에 `environment=live`이면서 Google click id와 NPay bridge hash가 같이 있는 row도 확인됐다. 따라서 운영 live 경로도 동작 중이다.

30분 window 요약:

| 지표 | 값 |
|---|---:|
| rows_returned | 5 |
| rows_with_google_click_id | 2 |
| rows_with_gclid | 2 |
| rows_with_gbraid | 1 |
| rows_with_wbraid | 0 |
| rows_with_npay_bridge_url_hash | 4 |
| rows_with_npay_bridge_path_hash | 4 |
| environment live/preview | 4 / 1 |

남은 보강:

1. `npay_bridge_host + path pattern` 기반으로 `login_required`, `checkout_opened`, `bridge_opened`, `result_opened` 같은 stage label을 추가한다.
2. 실제 NPay 결제완료 주문과 조인되면 `completed`, 일정 시간 안에 조인되지 않으면 `entered_not_completed` 또는 `login_gate_exit_candidate`로 분리한다.
3. 운영 live만 깨끗하게 보려면 debug/preview marker가 없는 URL로 버튼 클릭 smoke를 1회 더 진행한다.

Auditor verdict: PASS_WITH_NOTES

- PASS: row-level 저장 확인.
- PASS: Google click id + NPay bridge hash 동시 저장 확인.
- NOTE: latest TJ smoke row는 preview/debug marker 포함 상태라 clean live smoke는 별도 1회 권장.

---

## v1.1 버튼 클릭 smoke 1차 결과와 보강 - 2026-05-28 13:13-13:20 KST

### 한 줄 결론

13:13 KST NPay 버튼 클릭 row는 `source=gtm_npay_bridge_v1_1`로 저장됐고 Google click id도 남았다. 다만 NPay 외부 결제 URL hash는 비어 있었다. 그래서 Preview 태그에 `bridge_update` 보강을 추가해, 버튼 클릭 row가 먼저 저장된 뒤 bridge URL이 늦게 잡혀도 같은 intent row를 보강할 수 있게 했다.

### 1차 smoke 관측

- 테스트 진입: `/shop_view/?idx=198`
- 클릭 시각: 2026-05-28 13:13 KST
- NPay 이동 host: `orders.pay.naver.com`
- row-level 조회 시각: 2026-05-28 13:15 KST

결과:

- `source=gtm_npay_bridge_v1_1`: 1건
- `environment=preview`: 1건
- `has_google_click_id=true`: 1건
- `has_gclid=true`: 1건
- `has_npay_bridge_url_hash=false`: 1건
- `product_idx=198`
- `product_price=35000`

동시에 기존 live tag `gtm_118`도 같은 클릭을 1건 저장했다. 이 live row 역시 Google click id는 있었지만 bridge URL hash는 없었다.

### 해석

이번 1차 smoke는 아래를 확인했다.

1. Google click id 보존은 된다.
2. NPay 버튼 클릭 이벤트도 잡힌다.
3. 그러나 외부 결제 URL은 아직 자동으로 못 잡는다.

따라서 실제 결제까지 진행해도, 현재 상태에서는 “Google 유입 NPay 버튼 클릭”과 “NPay 결제완료 주문”을 직접 연결하는 핵심 bridge URL 증거가 부족하다.

### 보강 내용

Preview tag `311`의 HTML을 업데이트했다.

- version: `2026-05-28-biocom-npay-bridge-gtm-v1-1-bridge-update`
- 늦게 잡힌 bridge URL을 같은 intent row에 보강하는 `bridge_update` payload 추가
- 클릭 직후 DOM/form/link/iframe 반복 스캔 추가
- `location.assign`, `location.replace`, programmatic element click wrapper 추가
- 기존 v1 Preview tag `308`은 계속 paused

검증:

- `node --check imweb/biocom-npay-bridge-gtm-v1-1-preview.js`: PASS
- `python3 scripts/harness-preflight-check.py --strict`: PASS
- GTM quick_preview compiler error: 없음
- Playwright install smoke: PASS
- live version: `145` unchanged

### 다음 재-smoke 성공 기준

같은 Preview workspace에서 다시 NPay 버튼만 클릭한다.

- `source=gtm_npay_bridge_v1_1`
- `has_google_click_id=true`
- `has_npay_bridge_url_hash=true`
- `npay_bridge_host=orders.pay.naver.com` 또는 `nid.naver.com`
- 결제/로그인/Google Ads send 없음

---

## v1.1 bridge-update 재-smoke 결과 - 2026-05-28 13:21-13:24 KST

### 한 줄 결론

13:22 KST NPay 버튼 재클릭 후 `source=gtm_npay_bridge_v1_1` row에 Google click id와 NPay 외부 bridge URL hash가 함께 저장됐다. 즉 Preview 기준으로는 “Google 광고 클릭 → 상품 페이지 → NPay 버튼 클릭 → NPay 외부 결제창 이동”을 같은 intent row로 묶는 핵심 증거가 잡혔다.

### 재-smoke 관측

- 클릭 시각: 2026-05-28 13:22 KST
- row-level 조회 시각: 2026-05-28 13:24 KST
- 조회 API: `https://att.ainativeos.net/api/attribution/npay-intents`
- 조회 source: `gtm_npay_bridge_v1_1`
- 조회 window: 최근 45분

결과:

- `source=gtm_npay_bridge_v1_1`: 2건
- `rows_with_google_click_id`: 2건
- `rows_with_gclid`: 2건
- `rows_with_npay_bridge_url_hash`: 1건
- 최신 row captured_at: 2026-05-28 13:21:51 KST
- 최신 row product_idx: `198`
- 최신 row product_price: `35000`
- 최신 row `has_google_click_id=true`
- 최신 row `has_npay_bridge_url_hash=true`
- 최신 row `has_npay_bridge_path_hash=true`
- 최신 row `npay_bridge_host=pay.naver.com`
- 최신 row `duplicate_count=1`

주의:

- TJ님이 최종으로 본 URL은 `orders.pay.naver.com` 계열이었고, 저장 row의 bridge host는 `pay.naver.com`이었다. 이는 버튼 클릭 직후 중간 bridge URL을 먼저 잡은 뒤 Naver가 checkout URL로 redirect한 흐름으로 해석된다.
- 원문 NPay URL은 저장/보고하지 않고 hash와 host/path hash만 확인했다.
- 같은 시각 기존 live `gtm_118` row는 Google click id는 저장하지만 bridge URL hash는 저장하지 않는다. 따라서 이번 개선 효과는 v1.1 Preview 태그에서 확인된 것이다.

### 해석

1차 smoke에서는 “클릭 ID 보존”만 확인됐고, 2차 smoke에서는 “클릭 ID + NPay bridge URL hash 동시 보존”까지 확인됐다. 실제 NPay 결제완료 주문과 버튼 클릭 intent를 자동으로 붙일 때 필요한 연결고리가 생긴 것이다.

아직 Production publish는 하지 않았기 때문에, 실사용자 트래픽에는 반영되지 않았다. 운영 반영 전에는 Preview 전용 `environment` 표기를 production용으로 정리하고, GTM publish 승인안을 별도로 확정해야 한다.

### Auditor verdict

PASS_WITH_NOTES

- PASS: Preview v1.1 bridge-update row에서 Google click id와 NPay bridge URL hash가 함께 저장됐다.
- PASS: 결제/로그인/Google Ads send/GTM publish 없음.
- NOTE: Production publish 전에는 `environment` 값이 운영 row에서 `live`로 남도록 태그 값을 정리해야 한다.
- NOTE: 실제 결제완료 주문과의 최종 연결은 Production publish 이후 자연 주문 또는 별도 결제 테스트에서 확인해야 한다.

---

## 운영 게시 직전 정리 결과 - 2026-05-28 13:30-13:35 KST

### 한 줄 결론

Preview에서 성공한 v1.1 bridge-update 태그를 운영 게시 직전 후보로 정리했다. 운영 트래픽에서는 `environment=live`, GTM Preview에서는 `environment=gtm_preview`, 디버그 쿼리에서는 `environment=debug`로 남도록 수정했다.

### 정리 내용

- source file: `imweb/biocom-npay-bridge-gtm-v1-1-preview.js`
- version: `2026-05-28-biocom-npay-bridge-gtm-v1-1-production-ready`
- GTM tag id: `311`
- GTM tag name: `BI - NPay Bridge Intent Capture v1.1`
- 기존 v1 Preview tag id `308`: `paused=true` 유지
- live version: `145 (paid_click_intent_v3_stale_click_id_guard_20260521)` 유지

### 검증 결과

- `node --check imweb/biocom-npay-bridge-gtm-v1-1-preview.js`: PASS
- `python3 scripts/harness-preflight-check.py --strict`: PASS
- GTM quick_preview compiler error: 없음
- Playwright install smoke: PASS
- loaded version: `2026-05-28-biocom-npay-bridge-gtm-v1-1-production-ready`
- GTM `Submit`, `Create version`, `Publish`: 실행 안 함

### 승인안

운영 게시 승인안은 아래 문서로 분리했다.

- `project/google-npay-bridge-gtm-production-publish-approval-20260528.md`

Auditor verdict: READY_FOR_RED_APPROVAL
