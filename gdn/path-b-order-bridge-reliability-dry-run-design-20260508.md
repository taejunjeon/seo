# Path B order_bridge reliability dry-run 설계

작성 시각: 2026-05-08 23:23 KST
대상: biocom Path B 주문-클릭 연결 신뢰도 평가
Status: design_ready__execution_waits_for_preview_or_hash_rows
관련 문서: [[path-b-limited-deploy-approval-20260508]], [[path-b-gtm-preview-final-checklist-20260508]], [[guest-order-attribution-ledger-design-v2-20260508]], [[path-c-attribution-rule-v2-20260508]], [[canary-effect-meaningful-dry-run-20260508]]
Do not use for: 운영 저장 canary 실행, schema migration, platform send, Google Ads conversion upload

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - ../AGENTS.md
    - CLAUDE.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/npay-recovery/AUDITOR_CHECKLIST.md
    - gdn/canary-effect-meaningful-dry-run-20260508.md
    - gdn/guest-order-attribution-ledger-design-v2-20260508.md
  lane: Green reliability dry-run design
  allowed_actions:
    - dry-run design
    - metric definition
    - confidence rule definition
    - local markdown artifact creation
  forbidden_actions:
    - backend 운영 deploy
    - operational schema migration
    - 1h hash-only canary 운영 저장
    - raw email/phone/member_code/order 저장 또는 logging
    - Google Ads/GA4/Meta/TikTok/Naver 전송
    - Google Ads conversion upload
  source_window_freshness_confidence:
    source: "current paid_click_intent deterministic bridge gap + Path B local endpoint fixture + schema v2 design"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 23:23 KST"
    confidence: 0.87
```

## 10초 결론

이 dry-run은 구매 전송 효과를 계산하는 도구가 아니다. Path B로 주문과 클릭이 얼마나 안정적으로 이어질 수 있는지 보는 신뢰도 검사다.

현재는 아직 live `order_bridge_ledger` row가 없어서 실행형 dry-run은 HOLD다. 대신 어떤 입력이 생기면 어떤 숫자로 PASS/HOLD/FAIL을 판단할지 설계를 닫았다.

## 왜 필요한가

현재 canary effect 비교가 안 되는 이유는 주문과 클릭을 1:1로 잇는 결정적 연결키가 없기 때문이다.

Path B는 그 연결키를 만들려는 시도다. 하지만 email/phone/order/session hash가 생긴다고 바로 Google Ads에 구매를 보내면 안 된다. 먼저 hash-only 원장이 실제 주문에서 얼마나 잘 채워지는지, 그리고 클릭 후보가 과하게 붙지 않는지 dry-run으로 봐야 한다.

## 입력 데이터

### 현재 바로 쓸 수 있는 입력

- Path B local fixture response.
- GTM Preview evidence.
- `paid_click_intent_ledger` capture health row.
- 운영 PG 또는 Imweb 주문 read-only count.

이 입력만으로는 confirmed purchase uplift를 계산하지 않는다.

### Preview PASS 이후 쓸 입력

- no-send endpoint response evidence.
- Tag Assistant event evidence.
- Network raw echo 0 evidence.

이 입력으로는 field availability만 계산한다.

### 1h hash-only canary 이후 쓸 입력

- `order_bridge_ledger` hash-only rows.
- `paid_click_intent_ledger` rows.
- confirmed order rows.
- no-send candidate-prep output.

이 입력이 생겨야 주문별 reliability dry-run이 가능하다.

## 핵심 지표

수집 건강도:

- `bridge_row_count`
- `unique_order_no_hash`
- `email_hash_fill_rate`
- `phone_hash_fill_rate`
- `order_no_hash_fill_rate`
- `client_id_fill_rate`
- `ga_session_id_fill_rate`
- `local_session_hash_fill_rate`
- `click_id_hash_fill_rate`
- `raw_stored_count`
- `platform_send_count`
- `endpoint_5xx_rate`

주문-클릭 연결 신뢰도:

- `orders_with_bridge_key`
- `orders_with_click_candidate_1d`
- `orders_with_click_candidate_7d`
- `orders_with_click_candidate_30d`
- `ambiguous_order_count`
- `median_prior_click_candidates`
- `p90_prior_click_candidates`
- `last_eligible_click_count`
- `identity_only_match_count`
- `session_click_match_count`
- `order_no_direct_match_count`

해석:

- prior click 후보 median이 수백 개면 FAIL/HOLD다.
- order_no_hash + session/click이 함께 있으면 신뢰도가 올라간다.
- email/phone hash만 있고 click/session이 없으면 identity-only assist로 둔다.

## 매칭 규칙

1. `paid_at` 이후 click은 제외한다.
2. `paid_at` 이전 click만 후보로 본다.
3. lookback은 1일, 7일, 30일을 분리한다.
4. 가장 최근 eligible paid click을 primary 후보로 둔다.
5. 이전 click은 assist 후보로 둔다.
6. 후보가 2개 이상이면 ambiguous flag를 유지한다.
7. NPay 클릭/결제시작은 구매완료로 승격하지 않는다.
8. raw email/phone/order/member_code는 입력으로만 transient 가능하고 출력에는 남기지 않는다.

## confidence 등급

### A

- order_no_hash present.
- client_id 또는 ga_session_id present.
- click_id_hash present.
- 1일 lookback에서 last eligible paid click 1개.
- raw/platform guard 0.

### B

- order_no_hash present.
- identity hash present.
- session/click 후보가 7일 lookback에서 1개 또는 low ambiguity.

### C

- identity hash는 present.
- order_no_hash 또는 session/click 중 하나가 부족.
- 후보가 여러 개라 assist 판단만 가능.

### D

- bridge key 부족.
- prior click 후보가 과다.
- NPay no-thanks-page 또는 주문 화면 evidence 부족.

A/B는 다음 no-send candidate-prep 후보가 될 수 있다. C/D는 전송 후보가 아니다.

## PASS/HOLD/FAIL

PASS:

- raw_stored_count = 0.
- platform_send_count = 0.
- order_no_hash_fill_rate가 의미 있게 확보됨.
- client/session/click 후보가 함께 확보됨.
- ambiguous_order_count가 낮거나 원인 분리가 가능함.
- A/B confidence 후보를 사람이 검토할 수 있음.

HOLD:

- raw/platform 문제는 없지만 order_no/session/click fill이 낮음.
- NPay가 결제완료 화면으로 복귀하지 않아 홈페이지 결제만 확인됨.
- identity-only 후보가 많아 구매 매칭 개선 효과를 말할 수 없음.

FAIL:

- raw 값 저장 또는 logging 발견.
- platform send 1건 이상.
- order별 prior click 후보가 다시 수백 개로 튐.
- dedupe 실패로 같은 주문/identity가 과다 적재됨.

## 실행 설계

미래 script 후보:

```bash
npx tsx backend/scripts/order-bridge-reliability-dry-run.ts \
  --start=2026-05-08 \
  --end=2026-05-09 \
  --site=biocom \
  --bridge-source=vm-sqlite-readonly \
  --paid-click-source=vm-sqlite-readonly \
  --orders-source=operational-pg-readonly \
  --output=data/path-b-order-bridge-reliability-dry-run-20260509.json \
  --markdown-output=gdn/path-b-order-bridge-reliability-dry-run-20260509.md
```

필수 출력:

- JSON raw data에는 hash와 counters만 포함.
- Markdown은 raw hash도 prefix만 표시.
- `send_candidate=false`.
- `confirmed_purchase_uplift=HOLD` unless deterministic bridge quality PASS.

## 100%까지 남은 단계

1. 제한 deploy 또는 tunnel smoke.
   - 목표 진척률: 60%.
   - 성공 기준: endpoint 200/413/CORS/raw log 0.

2. GTM Preview final 실행.
   - 목표 진척률: 70%.
   - 성공 기준: 결제완료 화면에서 hash present 후보 확인.

3. reliability dry-run 입력 확보.
   - 목표 진척률: 80%.
   - 성공 기준: Preview evidence 또는 hash-only rows로 field fill 판단 가능.

4. 1h hash-only canary 승인/실행.
   - 목표 진척률: 90%.
   - 성공 기준: raw 0, platform send 0, order/session/click fill 측정.

5. confirmed purchase no-send 후보 생성.
   - 목표 진척률: 100%.
   - 성공 기준: A/B confidence 후보를 전송 없이 사람이 검토 가능.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES
Lane: Green design, Yellow required for data-producing execution
Mode: no-send / no-write / no-deploy / no-publish / no-platform-send
Current executable reliability: HOLD, bridge rows not available yet
Recommendation: 제한 deploy 또는 tunnel smoke 후 Preview evidence부터 수집
Confidence: 87%
