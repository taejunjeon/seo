# Google NPay bridge hash 보강 설계 기록 - 2026-05-28

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - project/google-npay-order-bridge-design-20260525.md
    - project/google-ads-npay-button-click-smoke-runbook-20260526.md
    - project/google-ads-npay-value-reduction-and-candidate-rate-plan-20260527.md
    - project/google-npay-final-source-summary-vm-deploy-result-20260527.md
  lane: Green for local code/report/docs; Yellow for VM Cloud deploy; Red for Google Ads send/auto-dispatch
  allowed_actions:
    - read-only source inspection
    - local backend/frontend code changes
    - no-send/no-write report field additions
    - typecheck
    - decision documentation
  forbidden_actions:
    - Google Ads conversion send without explicit Red approval
    - VM Cloud deploy without explicit Yellow approval
    - production DB write/import
    - raw order id or raw click id exposure in report output
  source_window_freshness_confidence:
    source: VM Cloud live API + local repository code
    window: 2026-05-20 to 2026-05-27 KST
    freshness: latest read-only live API observation in current sprint
    confidence: medium-high for aggregate counts; low for rows without bridge URL hash until deploy/snippet capture
```

## 한 줄 결론

NPay 버튼 클릭 시점의 Google click id 보존은 이미 확인됐다. 지금 병목은 버튼 클릭과 네이버 외부 결제완료 주문을 안정적으로 이어 붙이는 bridge 증거가 부족한 것이다.

## A급 bridge와 Google Ads 전송 후보의 차이

`A급 bridge`는 내부 판단이다.

- 의미: NPay 결제완료 주문이 특정 NPay 버튼 클릭에서 이어진 것으로 볼 근거가 강하다.
- 근거 예시: 결제완료보다 먼저 찍힌 버튼 클릭, 주문 생성 시각과 버튼 클릭 시각의 근접성, 금액/상품 일치, 다른 후보와의 score gap.
- 용도: 내부 ROAS 분석, 출처 복구, 수동 검토 축소.

`Google Ads 전송 후보`는 외부 전송 판단이다.

- 의미: Google Ads에 실제 구매로 다시 보내도 되는 주문이다.
- 최소 조건: 실제 결제완료, 취소/환불 아님, 금액 일치, 중복 전송 방지 key, 그리고 `gclid`, `gbraid`, `wbraid` 중 하나의 Google click id.
- 용도: Google Ads 실제 구매 전용 Primary 전환 학습.

따라서 `A급 bridge`가 많아도 Google click id가 없으면 Google Ads 전송 후보는 0건일 수 있다. 쉽게 말하면, “이 주문이 어떤 NPay 버튼에서 왔는지”는 알지만 “Google에 이 광고 클릭에서 온 주문이라고 증명할 ticket number”가 없는 상태다.

## 이번 로컬 구현

### 1. NPay 외부 결제창 URL hash 수신 준비

백엔드 `npay_intent_log`가 다음 값을 받을 수 있게 했다.

- `npay_bridge_url_hash`
- `npay_bridge_host`
- `npay_bridge_path_hash`
- `npay_bridge_observed_at`

원문 URL은 저장하지 않는다. 허용된 NPay/Naver host만 hash로 저장한다.

### 2. no-write 분석 API 확장

NPay bridge 검토 summary에 다음 준비도 지표를 추가했다.

- 전체 NPay intent 중 bridge URL hash 보유 건수
- Google 흔적이 있는 NPay intent 중 bridge URL hash 보유 건수
- A급 bridge 중 bridge URL hash 보유 건수
- A급 bridge + bridge URL hash + Google click id 동시 보유 건수

### 3. 로컬 보고서 카드 추가

로컬 Google ROAS 보고서에 아래 구분을 추가했다.

- `NPay bridge URL hash 저장`
- `Google 흔적 + bridge hash`
- `A급 bridge + hash`
- `A급 + hash + Google click id`

마지막 값이 실제 구매 전용 Google Ads 전송 후보를 넓히는 핵심 선행 지표다.

## 현재 관측 숫자

기준: VM Cloud live API, 2026-05-20 ~ 2026-05-27 KST.

- NPay 버튼 클릭 intent: 308건
- Google 흔적이 있는 NPay 버튼 클릭: 234건
- Google click id가 보존된 NPay 버튼 클릭: 231건
- 실제 NPay 결제완료 주문: 28건
- 내부 strong bridge 후보: 21건
- A급 bridge: 15건
- B급 bridge: 6건
- Google Ads 전송 후보: 0건

해석: 버튼 클릭 단계의 Google click id 보존은 좋은 편이다. 하지만 결제완료 주문에 Google Ads 전송용 click id를 안전하게 붙이는 마지막 연결고리가 아직 부족하다.

## 왜 추가 결제 테스트보다 이 보강이 먼저인가

NPay 버튼 클릭 smoke는 이미 목적을 달성했다.

- 버튼 클릭 시점에 Google click id가 저장되는지 확인했다.
- 기존 Google Ads 구매완료가 실제 구매가 아니라 NPay 진입/버튼 신호에 가까운 것도 확인했다.

다음 테스트의 목적은 달라야 한다.

- NPay 외부 bridge URL hash가 저장되는지
- 결제완료 주문과 버튼 intent가 자동으로 A급 bridge로 붙는지
- 그 주문에 Google click id를 Google Ads 전송 후보로 승격할 수 있는지

따라서 다음 실결제 테스트는 VM Cloud 배포와 Imweb/GTM 저장 패치 이후에 하는 것이 맞다.

## 남은 구현 단계

1. Imweb footer 또는 GTM에서 NPay 버튼 클릭 직후 외부 bridge URL을 잡아 `npay_bridge_url`로 전송한다.
2. VM Cloud에 이번 백엔드 변경을 배포해 hash 컬럼을 실제 원장에 생성한다.
3. NPay 결제완료 주문번호와 intent를 영구 bridge 장부에 쓰기 전 no-write 후보표로 24시간 관찰한다.
4. 실제 결제완료 + click id + 금액/취소/중복 guard 통과 주문만 Google Ads 전송 후보로 올린다.
5. 자동 전송은 별도 Red approval 후 켠다.
