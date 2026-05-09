# Path B click storage source audit

작성 시각: 2026-05-10 00:11 KST

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  lane: Green read-only code and GTM draft audit
  allowed_actions:
    - local source read
    - VM Cloud read-only result interpretation
    - no-send diagnosis document
  forbidden_actions:
    - GTM Production publish
    - VM Cloud write
    - Google Ads/GA4/Meta/TikTok/Naver send
    - raw email/phone/member_code/order/payment storage or logging
    - existing GTM tag pause/delete
  source_window_freshness_confidence:
    source: local backend scripts and VM Cloud canary/join dry-run evidence
    window: code snapshot 2026-05-10 KST, canary rows from 2026-05-09 KST
    site: biocom
    freshness: same-session
    confidence: high for source mapping, medium for browser preservation cause
```

## 한 줄 결론

Path B tag와 paid_click_intent tag의 storage key 이름은 큰 틀에서 맞습니다. 다만 canary 주문 2건은 실제 paid-click-originated 세션이 아니어서 `bi_paid_click_intent_v1`에 연결 가능한 click evidence가 없었던 것으로 보입니다.

## Path B 주문완료 tag가 읽는 click source

로컬 스크립트 기준 Path B 주문완료 tag는 다음 후보를 읽습니다.

- URL query:
  - `gclid`
  - `gbraid`
  - `wbraid`
  - `ttclid`
  - `nclick_id`
- dataLayer last value:
  - `gclid`
  - `gbraid`
  - `wbraid`
  - `ttclid`
  - `nclick_id`
- browser storage:
  - `bi_paid_click_intent_v1`
  - `__bs_imweb`
  - `__pathb_order_bridge_preview`

Google Ads confirmed_purchase 목적의 primary click source는 `gclid`, `gbraid`, `wbraid`입니다. `ttclid`, `nclick_id`는 다른 매체 분석 후보이며 Google Ads upload 후보로 승격하면 안 됩니다.

## paid_click_intent tag가 저장하는 source

paid_click_intent tag는 다음 조건에서 `bi_paid_click_intent_v1`에 evidence를 씁니다.

- URL query에 `gclid`, `gbraid`, `wbraid`가 있음.
- 또는 Google paid UTM이 있음.

저장 후보에는 다음 값이 포함됩니다.

- Google click id 후보.
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`.
- `client_id`.
- `ga_session_id`.
- `local_session_id`.
- landing/current/referrer URL.

그리고 no-send receiver는 Google click id가 없으면 send 단계로 진행하지 않도록 설계되어 있습니다.

## mismatch 판정

### storage key mismatch

현재 증거로는 `storage key mismatch`가 주원인이라고 보기 어렵습니다.

- Path B는 `bi_paid_click_intent_v1`을 읽습니다.
- paid_click_intent도 `bi_paid_click_intent_v1`을 씁니다.
- 이름 자체는 맞습니다.

### source absence 또는 session preservation 미검증

현재 증거로 가장 가능성이 높은 원인은 `source absence` 또는 `same-browser preservation 미검증`입니다.

- 1시간 canary row 2건 모두 order/email/client/session은 PASS입니다.
- row 2건 모두 click hash는 없습니다.
- join dry-run에서 같은 client/session/local session의 paid_click_intent row는 0건입니다.
- 같은 시간대에 paid_click_intent 전체 후보는 많지만, time-window-only 후보는 과다해서 쓸 수 없습니다.

즉 현재 2건은 실제 Google paid-click-originated 주문이라기보다 직접 주문완료 URL, Tag Assistant Preview, 또는 일반 세션 주문완료로 보는 편이 안전합니다.

## 주문완료 페이지에서 발생 가능한 원인

1. 실제 paid click 없이 주문완료에 진입했다.
2. 상품상세 또는 랜딩에서 `bi_paid_click_intent_v1`이 생성되지 않았다.
3. 생성됐지만 checkout/order complete까지 같은 browser storage가 이어지지 않았다.
4. Tag Assistant Preview가 landing/session/referrer를 바꾸면서 실제 유입 흐름과 달라졌다.
5. NPay/외부 결제 복귀 과정에서 storage context가 끊겼다.

## 다음 확인점

### P0 Green

- TEST click id same-browser preservation Preview를 다시 설계한다.
- 시작점은 주문완료 URL 직접 진입이 아니라 상품상세 URL이어야 한다.
- 예: 상품상세 URL에 `gclid=TEST_GCLID_PATHB_FLOW_20260510`를 붙여 진입한다.
- 상품상세 단계에서 `bi_paid_click_intent_v1` 생성 여부를 확인한다.
- 같은 browser에서 checkout/order complete까지 이동했을 때 Path B tag가 storage click id를 읽는지 확인한다.
- no-send 또는 Preview 기준으로만 진행한다.

### Yellow 후보

- 실제 광고 클릭에서 출발한 controlled order test.
- 단, Google Ads/GA4/Meta/TikTok/Naver 전송은 계속 금지하고, actual upload 후보도 0으로 유지한다.

## 결론

현재 click bridge HOLD 원인은 Path B 저장 인프라 실패가 아니라 click source가 주문 row와 이어지지 않은 것입니다. direct time-window join은 과대귀속 위험이 크므로 금지하고, 다음은 same-browser preservation을 검증해야 합니다.
