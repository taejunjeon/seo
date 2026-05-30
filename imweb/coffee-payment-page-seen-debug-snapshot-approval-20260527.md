---
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
  required_context_docs:
    - imweb/code_coffee_260527.md
    - imweb/!coderule-thecleancoffee.md
    - imweb/code_coffee_payment_page_seen_napm_structured_candidate_260527.md
    - report/reportcoffee-attribution-preservation-map-20260527.md
    - report/reportcoffee-google-ads-click-id-smoke-plan-20260527.md
  lane: Green approval packet writing
  allowed_actions:
    - approval packet documentation
    - no-send/no-write plan
    - GTM Preview plan
    - rollback plan
  forbidden_actions:
    - Imweb save/publish before approval
    - GTM Production publish before approval
    - VM Cloud SQLite write before approval
    - external platform send
    - production DB write
    - Google Ads conversion upload or mutate
  source_window_freshness_confidence:
    source: "Coffee live browser smoke + VM Cloud attribution ledger read-only + imweb/code_coffee_260527.md"
    window: "2026-05-27 KST Coffee Google Ads and Naver brandsearch smoke"
    freshness: "same-day"
    confidence: 0.9
---

# 더클린커피 payment_page_seen + debug snapshot 병합 보강 승인안

작성 시각: 2026-05-27 14:19 KST
기준일: 2026-05-27
문서 성격: 더클린커피 주문서 진입 단계와 브라우저 디버그 snapshot 보강 승인 판단 문서
상태: approval packet only. 실제 Imweb 저장, GTM Production publish, VM Cloud write는 승인 전 금지.

## 10초 요약

더클린커피 Google Ads smoke 결과, Google 클릭 신호는 결제완료 VM Cloud row까지 보존된다. 문제는 서버 수신 실패가 아니라 브라우저 콘솔에서 보는 `checkout_context`와 `payment_success_context`가 비어 보여 현장 판독이 어렵다는 점이다.

따라서 보강 대상은 두 가지다.

1. `payment_page_seen`: 주문서 화면에 실제 도달했다는 내부 진단 단계.
2. debug snapshot 병합: `__thecleancoffee_click_id_context_v1`와 `_p1s1a_last_touch`의 클릭/UTM 요약값을 주문서/결제완료 디버그 snapshot에도 붙이는 작업.

추천 실행 순서는 `GTM Preview no-send` → `Imweb 부분 반영 preview-only` → `VM Cloud 제한 write canary`다. 첫 단계는 실제 사용자 전체에 반영하지 않고 Tag Assistant Preview 안에서만 검증한다.

## 지금 확인된 사실

### Google Ads smoke

Source/window/freshness/confidence: TJ님 브라우저 콘솔 + VM Cloud `/api/attribution/ledger?source=thecleancoffee_imweb` read-only, 2026-05-27 11:01 KST 전후, same-minute freshness, confidence 0.93.

확인된 것:

- `last_touch`: `google / cpc / coffee_google_smoke_0527`, `has_gclid=true`, `has_gbraid=true`.
- `coffee_click_context_local`: Google click evidence present.
- `coffee_click_context_session`: Google click evidence present.
- VM Cloud `checkout_started`: Google UTM, `gclid`, `gbraid`, `gad_source=1`, `gad_campaignid=14629255429` present.
- VM Cloud `payment_success`: 같은 Google click evidence present.

비어 보인 것:

- browser `checkout_context`: UTM/click evidence empty.
- browser `payment_success_context`: UTM/click evidence empty.

해석: Google click evidence는 결제완료까지 간다. 비어 보이는 부분은 browser debug snapshot 병합 부족이다.

### Naver 브랜드검색 smoke

Source/window/freshness/confidence: TJ님 브라우저 콘솔 + VM Cloud attribution ledger read-only, 2026-05-27 KST, same-day freshness, confidence 0.9.

확인된 것:

- `last_touch`와 Coffee click context에는 `naver_brand_search`와 landing `NaPm` evidence가 남았다.
- VM Cloud `checkout_started`와 `payment_success`에도 브랜드검색 UTM/landing evidence가 남았다.
- `NaPm`은 raw URL 문자열에는 있지만 구조화 필드는 약하다.

해석: 네이버 브랜드검색도 서버 수신 row까지 evidence는 남는다. 다만 `NaPm` 구조화와 debug snapshot 병합은 보강해야 한다.

## 승인 대상

승인 대상은 한 번에 운영 완전 반영이 아니다. 아래 단계 중 무엇을 허용할지 결정한다.

### Mode A — GTM Preview no-send 검증

추천: YES, 94%.

무엇을 바꾸는가:

- GTM fresh workspace에서 custom HTML Preview 태그를 만든다.
- `/shop_payment/`에서만 동작한다.
- `payment_page_seen` preview event를 `dataLayer`와 `window.__THECLEANCOFFEE_PAYMENT_PAGE_SEEN_PREVIEW_LAST__`에만 남긴다.
- 기존 live site에는 publish하지 않는다.

바꾸면 생기는 효과:

- 실제 사이트 운영 코드를 바꾸기 전에 주문서 화면에서 value/order hint/click context 병합이 가능한지 확인한다.
- Meta/GA4/Google Ads/Naver 전송은 0건이다.
- VM Cloud write도 0건이다.

안 바꾸면 남는 문제:

- `checkout_context/payment_success_context`가 비어 보여 현장 smoke 판독이 계속 헷갈린다.
- `payment_page_seen`을 실제로 붙일지 판단할 증거가 부족하다.

성공 기준:

- Tag Assistant Preview에서 `/shop_payment/` DOM Ready 이후 preview tag 1회 fired.
- `window.__THECLEANCOFFEE_PAYMENT_PAGE_SEEN_PREVIEW_LAST__`에 `utm_source`, `utm_medium`, `utm_campaign`, `has_gclid`, `has_gbraid`, `gad_campaignid`, `napm_present` 요약값이 들어간다.
- 같은 preview snapshot에 `site=thecleancoffee`, `source=thecleancoffee_gtm_preview`, `owner_surface=gtm_preview`가 들어간다.
- network panel에서 `att.ainativeos.net/api/attribution/payment-page-seen` 호출 0건.
- Meta Pixel Helper에 새 Purchase/PurchaseDecision 계열 중복 없음.

중단 기준:

- Preview만 했는데 `fbq('track', 'Purchase')`, Google Ads conversion, GA4 purchase, VM Cloud write가 발생한다.
- 주문서 UI가 깨지거나 결제 버튼 클릭이 방해된다.
- value/order hint가 2회 이상 중복 생성된다.

### Mode B — Imweb 부분 반영 preview-only

추천: 조건부 YES, 78%. Mode A PASS 후에만 권장한다.

무엇을 바꾸는가:

- Coffee footer에 `payment_page_seen` preview-only block을 부분 삽입한다.
- 기존 Block 2 `checkout_started`, Block 3 `payment_success`, Phase 9 Funnel CAPI mirror는 건드리지 않는다.
- `enableNetworkSend=false`를 유지한다.
- debug snapshot은 기존 key를 바로 덮어쓰기보다 preview key에 먼저 남긴다.

추천 preview key:

- `window.__THECLEANCOFFEE_PAYMENT_PAGE_SEEN_PREVIEW_LAST__`
- `sessionStorage.__seo_checkout_context_debug_merged_preview`
- `sessionStorage.__seo_payment_success_context_debug_merged_preview`

바꾸면 생기는 효과:

- 일반 사용자 브라우저에서도 no-send preview snapshot이 남는다.
- VM Cloud row나 광고 플랫폼 숫자는 바뀌지 않는다.
- 실제 운영 전송 전 디버깅 gap만 먼저 줄인다.

안 바꾸면 남는 문제:

- Tag Assistant Preview가 아닌 일반 브라우저 smoke에서는 여전히 `checkout_context/payment_success_context`가 비어 보일 수 있다.

성공 기준:

- live 주문서에서 `__THECLEANCOFFEE_PAYMENT_PAGE_SEEN_PREVIEW_LAST__` 1회 생성.
- live 주문완료에서 debug merged preview key에 Google/Naver evidence 요약값 present.
- VM Cloud `payment_page_seen` row 0건.
- Meta/GA4/Google Ads/Naver/TikTok 전송 증가 0건.

중단 기준:

- VM Cloud `payment_page_seen` row가 의도치 않게 생긴다.
- 기존 `checkout_started` 또는 `payment_success` row가 사라진다.
- Purchase Guard가 confirmed/unknown 분기를 다르게 판단한다.

### Mode C — VM Cloud payment_page_seen 제한 write canary

추천: 보류, 62%. Mode A와 Mode B PASS 뒤 별도 승인 권장.

무엇을 바꾸는가:

- `enableNetworkSend=true`를 제한 window에서만 켠다.
- `/api/attribution/payment-page-seen`에 주문서 도달 evidence를 5건 이하로 저장한다.

바꾸면 생기는 효과:

- VM Cloud 원장에 `payment_page_seen`이 별도 touchpoint로 남는다.
- `checkout_started=결제 시작 후보`, `payment_page_seen=실제 주문서 도달`을 분리할 수 있다.

안 바꾸면 남는 문제:

- 내부 원장은 여전히 `checkout_started`와 `payment_success` 중심이다.
- 주문서 화면 도달 여부를 별도 단계로 집계하기 어렵다.

성공 기준:

- canary window 안에서 `payment_page_seen` row 1~5건만 생성.
- row에는 raw click id, raw NaPm, raw payment key, email, phone을 저장하지 않는다.
- `send_candidate=false` 또는 equivalent no-platform-send 상태가 유지된다.
- 기존 `checkout_started/payment_success` row 수신은 유지된다.

중단 기준:

- 5건 초과 live insert.
- raw PII 또는 raw click token이 row/debug log에 저장된다.
- 외부 플랫폼 전송이 발생한다.

## 권장 승인 범위

Codex 추천은 Mode A만 지금 승인이다.

이유:

- 문제의 핵심은 먼저 판독 gap을 줄이는 것이다.
- Mode A는 GTM Preview 안에서만 동작하므로 운영 사용자 영향이 없다.
- Mode B는 no-send라도 사이트 전체 사용자에게 script가 들어가므로 별도 판단이 필요하다.
- Mode C는 VM Cloud SQLite write가 생기므로 Mode A/B 결과 없이 바로 진행할 이유가 약하다.

## 승인 문구

### 추천 승인 문구 — Mode A

```text
승인합니다. 더클린커피 GTM-5M33GC4 fresh workspace에서 payment_page_seen + debug snapshot 병합 no-send Preview 태그를 생성하고 Tag Assistant Preview smoke까지 진행하세요.

허용 범위:
- /shop_payment/ 전용 custom HTML Preview 태그 생성
- dataLayer/window/sessionStorage preview snapshot 생성
- 기존 checkout_started/payment_success/Meta InitiateCheckout과 충돌 여부 확인
- Preview 결과 문서화와 cleanup

금지:
- GTM Production publish
- Imweb save/publish
- VM Cloud write
- Meta/GA4/Google Ads/Naver/TikTok 전송
- Google Ads conversion upload/mutate
- 운영DB write
```

### 보류 권장 문구 — Mode B/C

Mode A가 PASS한 뒤 아래를 별도 판단한다.

```text
Mode A Preview 결과를 확인한 뒤, 더클린커피 Imweb footer preview-only 부분 반영 또는 VM Cloud payment_page_seen 제한 write canary를 별도 승인합니다.
```

## 실행 전 체크리스트

Codex가 확인할 것:

1. GTM live latest version과 Default Workspace 변경 0 확인.
2. fresh workspace 생성. Default Workspace 직접 수정 금지.
3. workspace capacity preflight.
4. 기존 `AGENTSOS - [begin_checkout] 주문서작성`, Coffee NPay Intent, Google Ads/GA4 tags와 trigger 충돌 확인.
5. 태그 이름에 `codex_coffee_payment_page_seen_debug_snapshot_nosend_preview_YYYYMMDD` 형식 사용.
6. Preview tag 안에 `fbq`, `gtag`, `fetch`, `sendBeacon`, image pixel 생성이 없는지 grep.
7. Preview snapshot에 `source=thecleancoffee_gtm_preview`, `owner_surface=gtm_preview`가 들어가는지 확인.
8. Preview 종료 후 workspace backup 또는 cleanup 결과 기록.

TJ님이 확인할 화면:

1. Tag Assistant Preview 연결 화면.
2. `/shop_payment/` 주문서 화면.
3. Chrome Console에서 preview snapshot.
4. Network 탭에서 `payment-page-seen` 호출 0건.

## smoke 절차

### Google smoke

1. Tag Assistant Preview URL로 진입한다.
2. Google synthetic URL로 landing한다.
3. 상품 상세에서 구매하기를 눌러 `/shop_payment/`로 간다.
4. Console에서 아래 key를 확인한다.

```js
window.__THECLEANCOFFEE_PAYMENT_PAGE_SEEN_PREVIEW_LAST__
JSON.parse(sessionStorage.getItem('__seo_checkout_context_debug_merged_preview') || '{}')
```

성공 기준:

- `utm_source=google`, `utm_medium=cpc`, `has_gclid=true` 또는 `has_gbraid=true`.
- `gad_campaignid=14629255429`.
- `noSend=true`, `noPixelRequest=true`, `noVmWrite=true`.

### Naver 브랜드검색 smoke

1. 네이버 브랜드검색 또는 UTM 재현 URL로 landing한다.
2. 상품 상세에서 구매하기를 눌러 `/shop_payment/`로 간다.
3. 같은 preview key를 확인한다.

성공 기준:

- `utm_source=naver_brand_search` 또는 `utm_medium=naver_brand_search`.
- `napm_present=true` 또는 landing `NaPm` evidence present.
- raw `NaPm`, raw `ci`, raw `hk`는 저장하지 않는다.

## rollback

Mode A rollback:

- Preview workspace tag를 삭제하거나 workspace를 abandon한다.
- Production live version은 변경하지 않았으므로 live rollback 불필요.

Mode B rollback:

- Imweb 반영 전 백업 문서의 footer로 되돌린다.
- `2026-05-27-coffee-payment-page-seen-preview-v1` 블록만 제거한다.
- 기존 Block 1/2/3/Phase 9를 건드리지 않는다.

Mode C rollback:

- `enableNetworkSend=false`로 되돌린다.
- VM Cloud receiver/ledger row는 삭제하지 않고 canary row로 표기한다.
- canary row가 예산 판단 로직에 들어가지 않도록 `captureMode=preview/canary`, `send_candidate=false`를 확인한다.

## 하지 않는 것

- Purchase 이벤트를 새로 만들지 않는다.
- `PurchaseDecisionUnknown`을 Purchase로 바꾸지 않는다.
- `checkout_started`를 삭제하거나 대체하지 않는다.
- `payment_success` payload의 금액/주문 판단 기준을 바꾸지 않는다.
- Google Ads conversion upload를 하지 않는다.
- Meta CAPI `enableServerCapi=true`를 켜지 않는다.
- raw order/payment/member/email/phone/click token을 문서나 로그에 남기지 않는다.

## Auditor verdict

Verdict: PASS_WITH_NOTES.

이 승인안은 운영 전송이나 운영 write를 바로 허용하지 않는다. Mode A Preview는 진행 추천 94%다. Mode B Imweb preview-only는 Mode A 결과를 본 뒤 추천 78%다. Mode C VM Cloud 제한 write canary는 별도 승인 전까지 보류 추천 62%다.

현재 가장 중요한 판단은 `Google click evidence가 서버에는 남는데 브라우저 debug snapshot이 비어 보이는 gap을 어떻게 줄일지`다. 이 gap은 예산 ROAS를 직접 바꾸는 문제가 아니라 smoke 판독 신뢰를 올리는 문제다.

## Mode A Preview 결과 — 2026-05-28

Mode A GTM Preview는 완료했다. 결과 문서는 `report/reportcoffee-payment-page-seen-gtm-preview-result-20260528.md`에 남겼다.

핵심 결론:

- 결제하기 페이지에서는 `begin_checkout`과 `payment_page_seen` Preview가 같은 화면에서 모두 보일 수 있다.
- 두 신호는 중복 전환으로 운영하면 안 된다.
- `begin_checkout`은 결제 시작 퍼널 이벤트로 유지한다.
- `payment_page_seen`은 no-send 내부 진단 신호 또는 추후 VM Cloud 제한 canary 후보로 분리한다.

cleanup:

- 대상 workspace: `codex_coffee_payment_page_seen_nosend_preview_20260528T035440Z`.
- dry-run: `PASS_DRY_RUN_BACKUP_READY`.
- execute cleanup: `PASS_PREVIEW_WORKSPACE_CLEANED`.
- live version: `24` 유지.
- Default Workspace after cleanup: change 0, conflict 0.
- GTM Production publish, VM Cloud write, 외부 플랫폼 전송: 0건.

근거 파일:

- `data/project/coffee-payment-page-seen-gtm-preview-workspace34-cleanup-20260528T115949Z.json`
- `data/project/coffee-payment-page-seen-gtm-preview-workspace34-cleanup-latest.json`

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

1. Mode A용 GTM Preview 태그 초안을 작성한다.
   - 무엇: `payment_page_seen + debug snapshot merged preview` custom HTML 후보를 GTM에 붙일 수 있는 형태로 만든다.
   - 왜: 승인 후 바로 Preview smoke를 실행하기 위해서다.
   - 어떻게: 기존 후보 문서의 `payment_page_seen` block에서 network send를 제거하고 preview key만 쓰게 축약한다.
   - 산출물: GTM custom HTML 후보 문서.
   - 검증: `fetch`, `sendBeacon`, `fbq`, `gtag`, image pixel call 0건 grep.
   - 의존성: 없음.

### Approval Needed

1. Mode A GTM Preview 실행 승인
   - 무엇: 위 승인 문구로 Mode A만 승인한다.
   - 왜: GTM UI workspace 생성/Preview는 tracking 작업이므로 승인 범위를 남겨야 한다.
   - 어떻게: 이 문서의 `추천 승인 문구 — Mode A`를 대화창에 보낸다.
   - Codex가 대신 못 하는 이유: GTM Preview workspace 작업은 사용자 승인 범위가 필요한 Yellow 작업이다.
   - 성공 기준: 승인 문구가 명확히 남고, Codex가 Preview 생성/검증/cleanup까지 진행한다.

### Blocked/Parked

1. Imweb 실제 저장
   - 보류 이유: 사이트 전체 사용자에게 script가 들어간다.
   - 재개 조건: Mode A Preview PASS.

2. VM Cloud `payment_page_seen` 실제 write
   - 보류 이유: VM Cloud SQLite row가 생성된다.
   - 재개 조건: Mode A/B PASS 후 5건 이하 canary 승인.
