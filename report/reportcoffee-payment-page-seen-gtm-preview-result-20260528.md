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
    - imweb/coffee-payment-page-seen-debug-snapshot-approval-20260527.md
    - imweb/coffee-payment-page-seen-debug-snapshot-gtm-preview-tag-20260527.md
    - report/reportcoffee-attribution-preservation-map-20260527.md
    - frontend/src/app/coffee/attribution-preservation/page.tsx
  lane: Yellow approved GTM Preview cleanup + Green documentation
  allowed_actions:
    - GTM Preview workspace backup and cleanup
    - no-send Preview result documentation
    - frontend report update
    - validation and audit
  forbidden_actions:
    - GTM Production publish
    - Imweb save or publish
    - VM Cloud SQLite write
    - 운영DB write
    - Meta GA4 Google Ads Naver TikTok platform send
    - Google Ads conversion upload or mutate
  source_window_freshness_confidence:
    source: "TJ님 Tag Assistant/Meta Pixel Helper/Chrome console observations + GTM API cleanup result JSON"
    window: "2026-05-28 KST Coffee payment_page_seen GTM Preview smoke"
    freshness: "same-day"
    confidence: 0.92
---

# 더클린커피 payment_page_seen GTM Preview 결과와 운영 판단

작성 시각: 2026-05-28 21:00 KST
기준일: 2026-05-28
문서 성격: 더클린커피 결제하기 페이지 진입 신호 Preview 결과보고 및 운영 반영 판단
상태: Preview 완료, workspace cleanup 완료, 운영 publish/write/send 없음.

## 10초 요약

더클린커피 결제하기 페이지에서는 `begin_checkout`과 `payment_page_seen` Preview가 같은 화면에서 모두 보일 수 있다. 그러나 두 신호는 같은 전환으로 운영하면 안 된다. `begin_checkout`은 GA4 퍼널과 광고 플랫폼 해석에 가까운 결제 시작 이벤트이고, `payment_page_seen`은 주문서 화면에 실제 도달했는지 확인하는 내부 디버그 신호다.

발화 수가 과거에 달랐던 이유는 같은 이벤트를 다르게 센 것이 아니라, 발화 조건과 저장 위치가 달랐기 때문이다. 운영 반영 판단은 `begin_checkout` 유지, `payment_page_seen`은 no-send 내부 진단 또는 추후 VM Cloud 제한 canary 후보로 분리하는 것이다.

## 사람 기준 페이지별 결론

### 상품상세 페이지

사람이 보는 페이지: 상품 상세 화면. 예: `/thecleancoffee/?idx=...`

결론:

- `begin_checkout`은 상품 옵션 선택 또는 구매 CTA 흐름에서 이미 발생할 수 있다.
- `payment_page_seen`은 발생하지 않는 것이 맞다.
- 이유: `payment_page_seen` 후보는 주문서 화면 도달 여부를 보려는 신호라서 상품상세 페이지에서는 아직 너무 이르다.

### 결제하기 페이지

사람이 보는 페이지: 주문서/결제하기 화면. 예: `/shop_payment/`

결론:

- `begin_checkout`과 `payment_page_seen` Preview가 같은 페이지에서 모두 보일 수 있다.
- TJ님 console 관측 기준으로 `begin_checkout`이 먼저 보였고, 바로 다음 dataLayer event로 `coffee_payment_page_seen_debug_snapshot_preview`가 보였다.
- 둘을 같은 운영 전환으로 쓰면 결제 시작 숫자가 중복 계산될 수 있다.

## 실제 관측값

Source/window/freshness/confidence: TJ님 Tag Assistant와 Chrome console, 2026-05-28 KST Preview 세션, same-day freshness, confidence 0.92.

관측 요약:

- `begin_checkout`: 결제하기 페이지에서 발생, `ecommerce`/`agentsos_ga4`/`hurdlers_ga4` 값 present, 주문금액 value present.
- `coffee_payment_page_seen_debug_snapshot_preview`: 결제하기 페이지에서 발생, no-send/no-write Preview payload present.
- network 기준 `payment-page-seen` 운영 endpoint 호출 0건.
- `checkout-context` 호출은 기존 checkout_started 경로로 1건 관측.
- `facebook pixel` 운영 추가 호출 0건.

해석:

- `begin_checkout`은 이미 운영 중인 결제 시작 신호다.
- `payment_page_seen` Preview는 운영 전송이 아니라, 결제하기 페이지 도달과 브라우저 debug snapshot 병합 가능성을 확인하는 내부 신호다.

## 발화 숫자가 달랐던 이유

1. 발화 조건이 다르다.
   - `begin_checkout`은 결제 시작 이벤트다. value/items 파싱, 주문서 작성 event, 기존 dedupe 조건에 영향을 받는다.
   - `payment_page_seen`은 주문서 화면 도달 신호다. 주문서 페이지에 들어온 사실만 봐도 Preview를 만들 수 있다.

2. 집계 위치가 다르다.
   - `begin_checkout`은 GA4/dataLayer/Tag Assistant에서 먼저 보이는 퍼널 이벤트다.
   - `payment_page_seen`은 VM Cloud row로 쓰지 않는 한 브라우저 debug snapshot 또는 Preview dataLayer에서만 보인다.

3. 재방문과 새로고침 영향이 다르다.
   - 주문서 페이지 새로고침, 로그인 후 복귀, 결제수단 선택 후 뒤로가기 같은 행동은 `payment_page_seen` 쪽을 더 많이 만들 수 있다.
   - 반대로 value/order hint가 없으면 `begin_checkout`이나 Meta InitiateCheckout 계열은 막힐 수 있다.

4. Biocom과 Coffee의 설치 위치가 달랐다.
   - Biocom은 Imweb 코드 블록에서 결제 페이지 fallback이 이미 강하게 작동했다.
   - Coffee는 이번에 GTM Preview로만 확인했으며, 운영 footer에 `payment_page_seen` durable write는 아직 없다.

5. 같은 이름의 "결제 시작"처럼 보여도 목적이 다르다.
   - `begin_checkout`: 광고/분석 퍼널에 쓰는 결제 시작 이벤트.
   - `payment_page_seen`: 주문서 화면을 실제로 봤다는 내부 증거.

## 운영 반영 판단

### 하지 말아야 할 것

- `begin_checkout`과 `payment_page_seen`을 둘 다 Meta/GA4/Google Ads 전환으로 보내지 않는다.
- `payment_page_seen`을 Purchase나 결제완료로 해석하지 않는다.
- payment_page_seen Preview 성공을 GTM Production publish 승인으로 해석하지 않는다.

### 지금 유지할 것

- `begin_checkout`은 계속 결제 시작 퍼널 이벤트로 유지한다.
- 기존 checkout_started 서버 수신점은 계속 결제 시작 후보와 유입 보존용으로 쓴다.
- `payment_success`와 Purchase Guard는 결제완료/구매 확정 판단용으로 유지한다.

### 다음에 검토할 것

- `payment_page_seen`은 운영 전환이 아니라 내부 진단 신호로만 검토한다.
- 실제로 필요하면 VM Cloud에 5건 이하 canary로만 제한 write를 별도 승인한다.
- 여러 날의 `begin_checkout` 대비 `payment_page_seen` 차이가 계속 크면, 주문서 페이지 진입은 됐지만 checkout_started가 빠지는 케이스를 분해한다.

## GTM Preview workspace cleanup 결과

Source/window/freshness/confidence: GTM API cleanup script, 2026-05-28 20:59 KST, same-minute freshness, confidence 0.98.

- 대상 container: 더클린커피 `GTM-5M33GC4`.
- cleanup 대상 workspace: `codex_coffee_payment_page_seen_nosend_preview_20260528T035440Z`.
- dry-run: `PASS_DRY_RUN_BACKUP_READY`.
- execute cleanup: `PASS_PREVIEW_WORKSPACE_CLEANED`.
- live version: `24` 유지.
- target workspace after cleanup: absent.
- Default Workspace after cleanup: change 0, conflict 0.
- GTM submit/create version/publish: 0건.
- 외부 플랫폼 전송: 0건.
- VM Cloud write: 0건.

근거 파일:

- `data/project/coffee-payment-page-seen-gtm-preview-workspace34-cleanup-20260528T115949Z.json`
- `data/project/coffee-payment-page-seen-gtm-preview-workspace34-cleanup-latest.json`

## 결론

운영 관점에서 두 신호가 동시에 보이는 것은 오류가 아니다. 문제는 둘을 같은 전환으로 해석하는 것이다. 현재 판단은 `begin_checkout`은 퍼널 이벤트로 유지하고, `payment_page_seen`은 주문서 도달 여부를 확인하는 no-send 내부 진단 신호로 보관하는 쪽이 맞다.

## 다음 할일

### Auto Green

1. 여러 테스트 세션에서 두 신호의 차이를 read-only로 계속 관찰한다.
   - 무엇: Tag Assistant와 console helper로 `begin_checkout`과 `payment_page_seen` Preview의 발생 순서와 누락 케이스를 모은다.
   - 왜: 운영 write 없이도 두 신호가 같은지 다른지 충분히 판정할 수 있다.
   - 어떻게: 상품상세 → 주문서 → 결제완료 흐름에서 dataLayer와 network count만 기록한다.
   - 산출물: Coffee 유입 보존 리포트의 smoke observation 업데이트.
   - 검증: raw 주문번호/결제키/클릭 토큰 출력 0건.
   - 의존성: TJ님 실제 브라우저 테스트 또는 Codex가 접근 가능한 Preview 세션.

### Approval Needed

1. VM Cloud `payment_page_seen` 제한 canary write.
   - 무엇: 주문서 화면 도달 신호를 VM Cloud에 5건 이하로만 저장한다.
   - 왜: 브라우저 debug snapshot이 아니라 원장 기준으로 주문서 도달 수를 확인하기 위해서다.
   - 어떻게: 별도 승인 문서에서 max row 5건, rollback, no-platform-send 조건을 고정한다.
   - 승인 필요 여부: YES, Yellow. VM Cloud SQLite write가 생긴다.
   - 성공 기준: `payment_page_seen` row 1~5건, 외부 플랫폼 전송 0건, 기존 checkout_started/payment_success 유지.
   - 실패 시 해석: row가 과다 생성되면 dedupe/trigger 조건을 좁혀야 한다.

### Blocked/Parked

1. GTM Production publish.
   - 보류 이유: 이번 작업은 Preview 검증과 cleanup까지이며, Production publish는 별도 Red 승인 영역이다.
   - 재개 조건: `payment_page_seen`을 실제 운영 사용자에게 적용할 사업상 필요가 명확해지고 별도 승인 문서가 준비될 때.
