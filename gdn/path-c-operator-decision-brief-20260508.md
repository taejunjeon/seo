# Path C 운영자용 결정 브리프

작성 시각: 2026-05-08 17:45 KST
최종 업데이트: 2026-05-08 18:45 KST
대상: paid_click_intent canary 24h, Path C wrapper Preview, backend deploy 판단
문서 성격: 운영자가 바로 읽는 요약 보고서
관련 문서: [[canary-capture-health-24h-20260508]], [[canary-effect-meaningful-dry-run-20260508]], [[path-c-member-code-wrapper-preview-approval-20260508]], [[path-c-backend-deploy-approval-v2-20260508]], [[path-c-attribution-rule-v2-20260508]]
Status: active decision brief
Do not use for: 운영 deploy, Production publish, actual send, conversion upload

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - total/!total-current.md
    - data/!channelfunnel.md
    - harness/gdn/README.md
    - harness/gdn/RULES.md
  lane: Green report rewrite + Preview approval tracking
  allowed_actions:
    - operator-friendly report writing
    - GTM Preview preparation
    - read-only audit
  forbidden_actions:
    - backend deploy
    - schema migration
    - GTM/Imweb Production publish
    - platform send
  source_window_freshness_confidence:
    source: "canary-effect dry-run 18.4h + TJ wrapper Preview YES feedback"
    window: "2026-05-07 23:01~2026-05-08 17:23 KST"
    freshness: "operator brief generated 2026-05-08 17:45 KST"
    confidence: 0.93
```

## 5줄 요약

1. 지금 본 것은 **click id 수집기가 운영에서 잘 쌓이는지**다. 18.4h 기준 ledger 709건, landing/checkout/NPay intent가 모두 들어왔다.
2. 지금 알 수 있는 것은 **수집 파이프가 대체로 정상**이라는 점이다. 5xx/PM2/PII는 24h에 다시 본다.
3. 아직 알 수 없는 것은 **구매 매칭이 얼마나 좋아졌는지**다. 주문과 click을 1:1로 잇는 결정적 연결키가 아직 없다.
4. 지금 승인된 것은 **wrapper Preview only**다. 실제 게시가 아니라 회원 코드가 페이지에 있는지만 확인한다.
5. 지금 승인하면 안 되는 것은 backend deploy, Production publish, actual send, Google Ads upload다.

## 용어 번역

| 내부 용어 | 사람 말 |
|---|---|
| capture health | 수집기가 잘 작동하는지 보는 건강검진 |
| effect/uplift | 구매 매칭 개선 효과 |
| deterministic bridge | 주문과 클릭을 1:1로 이어주는 결정적 연결키 |
| Path A | GA4 세션을 거쳐 구매를 찾는 좁은 경로 |
| Path C | `member_code_hash`로 주문과 광고 클릭을 직접 연결하는 경로 |
| send_candidate=0 | 실제 전송 후보를 만들지 않았다는 안전장치. 지금은 정상 |

## 이번 문서가 말하는 것

- `paid_click_intent_ledger`가 계속 쌓이는지.
- `landing`, `checkout_start`, `npay_intent` 단계가 모두 들어오는지.
- debug/test/preview row가 차단되는지.
- 개인정보/주문/결제/금액 정보가 저장되지 않는지.
- no platform send가 0인지.

## 이번 문서가 말하지 않는 것

- Google Ads ROAS gap이 줄었는지.
- 구매 매칭이 늘었는지.
- NPay actual confirmed attribution이 좋아졌는지.
- confirmed_purchase upload 후보가 충분한지.

이 네 가지는 `member_code_hash` bridge가 생긴 뒤에만 판단한다.

## 결정표

| 결정 | 현재 판단 | 이유 |
|---|---|---|
| 24h 수집 건강검진 | 자동 진행 | read-only, 승인 불필요 |
| wrapper Preview | YES | Production publish가 아니고 source 확인이 필요 |
| attribution rule v2 | 방향 승인 | last eligible paid click 기준이 과대귀속을 막음 |
| backend deploy | HOLD | 최종 diff, secret, TTL/cleanup, raw logging proof 필요 |
| actual send/upload | NO | 후보 검증 전 |

## 숫자 해석

### ledger 709건

광고 클릭 ID와 세션 증거가 운영 수집기에 709번 들어왔다는 뜻이다. 구매가 709건이라는 뜻이 아니다.

### 주문 52건

운영 PG에서 같은 window에 실제 결제완료 positive 주문 52건을 새로 뽑았다는 뜻이다. 이 주문들이 Google Ads 후보라는 뜻은 아니다.

### prior click 후보 median 329

주문 하나에 붙일 수 있는 과거 click 후보가 중간값으로 329개라는 뜻이다. 지금 이 상태로 주문과 click을 붙이면 거의 임의 배정이 된다. 그래서 uplift 계산을 하지 않는 것이 맞다.

### send_candidate=0

실제 GA4/Google Ads/Meta 등에 보낼 후보를 만들지 않았다는 뜻이다. 지금 단계에서는 정상이고 필요한 안전장치다.

## 다음 행동

1. Codex는 2026-05-08 23:01 KST 이후 24h 수집 건강검진을 자동 실행한다.
2. TJ님 승인에 따라 wrapper Preview만 준비/진행한다. 첫 단계는 raw member_code를 보내지 않는 placeholder hash 방식이며, 운영 ledger write를 피하기 위해 `TEST_` click id만 쓴다.
3. backend deploy는 HOLD다. final code diff, HMAC secret, TTL cleanup, raw logging proof, smoke script가 붙은 뒤 다시 판단한다.
4. actual send와 Google Ads upload는 계속 금지다.
