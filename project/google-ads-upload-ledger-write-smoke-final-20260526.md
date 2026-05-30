작성 시각: 2026-05-26 21:53 KST
기준일: 2026-05-26
문서 성격: Google Ads 실제 구매 전송 장부 write smoke final 실행안

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
  required_context_docs:
    - project/google-ads-duplicate-send-ledger-design-20260526.md
    - project/google-ads-limited-confirmed-purchase-send-approval-draft-20260526.md
  lane: Yellow for VM Cloud SQLite ready-row write smoke, Green for this final runbook
  allowed_actions:
    - final runbook documentation
    - VM Cloud localhost no-write API verification
    - aggregate-only bottleneck analysis
    - max 2 ready-row write smoke only after TJ approval
  forbidden_actions:
    - Google Ads conversion upload
    - Google Ads primary/secondary setting mutation
    - operational DB write
    - GTM publish
    - Imweb header/footer change
    - raw order id or raw click id exposure in report
    - more than 2 live ledger insert rows
  source_window_freshness_confidence:
    source: VM Cloud localhost no-write APIs + VM Cloud localhost order diagnostics aggregate
    window: last_7d
    freshness: 2026-05-26 21:53 KST
    confidence: high for no-write plan and bottleneck count, blocked for actual write until TJ approval
```

## 10초 요약

이 작업은 Google Ads에 보내기 전에, 같은 실제 구매 주문을 두 번 보내지 않도록 VM Cloud에 작은 전송 장부를 만드는 smoke다.

승인 후에도 Google Ads로는 아무것도 보내지 않는다. 후보 최대 2건만 `ready` 상태로 장부에 써 보고, 같은 후보를 다시 넣으면 중복으로 막히는지 확인한다.

현재 실제 구매 전용 Google 주 전환 준비도는 88%다. 이 write smoke가 통과하면 92%로 올리고, 그 다음 최대 2건 제한 전송이 Google Ads에서 수신 확인되면 95%로 본다.

## 지금 목표와 진척율

- 최종 목표: Google Ads가 `NPay 버튼 클릭/결제진입`이 아니라 `실제 결제완료 주문`을 핵심 구매 신호로 학습하게 만든다.
- 현재 준비도: 88%.
- 이 문서 실행안 완료 상태: 100%.
- 다음 기준점: VM Cloud 장부 write smoke 통과 시 92%.
- 그 다음 기준점: Google Ads 제한 전송 2건 수신 확인 시 95%.
- 주 전환 승격 타이밍: 제한 전송 2건이 Google Ads 화면/API에서 정상 수신되고 중복이 없음을 확인한 직후. 오래 기다리지 않고 24시간 안에 승격 판단한다.

## 승인 후 실제로 일어나는 일

TJ님이 승인하면 Codex는 VM Cloud SQLite에 아래 범위만 수행한다.

1. `google_ads_confirmed_purchase_upload_ledger` 테이블을 만든다.
2. 중복 방지 unique index를 만든다.
3. 최근 7일 private preview를 다시 계산한다.
4. `ready_exact_gclid` 후보 최대 2건만 `status='ready'`로 쓴다.
5. 같은 후보를 다시 넣는 replay를 실행해 2건 모두 중복 차단되는지 확인한다.
6. 결과를 aggregate로만 보고한다.

## 승인 후에도 절대 하지 않는 일

- Google Ads 전송 0건.
- Google Ads 전환 액션 설정 변경 0건.
- Google Ads Primary/Secondary 변경 0건.
- 운영DB write 0건.
- GTM publish 0건.
- Imweb 코드 변경 0건.
- raw 주문번호 출력 0건.
- raw gclid/gbraid/wbraid 출력 0건.
- 후보 2건 초과 insert 0건.

## 실행 전 live no-write 확인값

source: VM Cloud localhost API
window: last_7d
freshness: 2026-05-26 21:52 KST
confidence: high

- write smoke plan ready: true
- planned ready rows: 2
- duplicate rows blocked in plan: 0
- replay rows blocked: 2
- ledger write count: 0
- Google Ads send count: 0
- raw order/click id in response: false
- source freshness: fresh
- 최신 운영DB 결제완료 시각: 2026-05-26 17:01:14 KST

## 성공 기준

아래가 모두 맞아야 성공이다.

1. 장부 테이블이 VM Cloud SQLite에 생성된다.
2. unique index가 생성된다.
3. `ready` row가 정확히 2건 이하로 생성된다.
4. 생성된 `ready` row의 `dedupe_key_hash`가 모두 다르다.
5. 같은 후보를 다시 넣으면 새 row를 만들지 않고 모두 `duplicate_blocked`로 처리한다.
6. Google Ads 전송은 0건이다.
7. 운영DB write는 0건이다.
8. raw 주문번호와 raw click id는 응답, 문서, 로그 요약에 나오지 않는다.
9. smoke 결과 문서에 source/window/freshness/confidence가 남는다.

## 즉시 중단 기준

아래 중 하나라도 나오면 중단한다.

1. 후보가 2건을 초과해 insert되려 한다.
2. 후보 안에서 중복 key 충돌이 난다.
3. row 쓰기 전에 Google Ads 전송이 필요해진다.
4. raw 주문번호나 raw click id가 stdout/report에 출력된다.
5. 테이블 또는 index 생성이 실패한다.
6. replay가 중복을 막지 못한다.
7. 운영DB write가 필요해진다.
8. Google Ads API credential 또는 전환 액션 설정 변경이 필요해진다.

## 롤백 기준

이 smoke는 Google Ads 전송을 하지 않기 때문에 rollback은 VM Cloud SQLite 장부 row만 대상으로 한다.

1. 테이블을 새로 만들었고 실제 전송 row가 0건이면 테이블 drop 또는 smoke row delete 중 더 안전한 쪽을 택한다.
2. 이미 테이블이 있으면 이번 smoke에서 만든 `status='ready'` row만 삭제한다.
3. 삭제 기준은 `site='biocom'`, `conversion_action_name='BI confirmed_purchase_offline'`, smoke 실행 시간 window, `status='ready'`다.
4. `sent`, `accepted`, `failed`, `reversed` row는 이 smoke에서 만들지 않는다. 만약 존재하면 절대 삭제하지 않는다.

## 승인 문구

TJ님이 실행을 원하면 아래 문장으로 승인하면 된다.

> VM Cloud에 Google Ads 실제 구매 전송 장부 테이블을 만들고, Google Ads 전송 없이 후보 최대 2건을 ready row로만 쓰는 write smoke를 승인한다.

이 승인은 Google Ads 전송 승인이 아니다. Google Ads 전송은 별도 Red Lane 승인 문구가 필요하다.

## write smoke 이후 바로 할 일

1. 장부 write smoke가 통과하면 실제 구매 전용 Google 주 전환 준비도를 92%로 올린다.
2. `BI confirmed_purchase_offline` 전환에 최대 2건만 제한 전송할지 별도 승인안을 final로 올린다.
3. 제한 전송이 Google Ads에서 수신되면 24시간 안에 주 전환 승격 판단으로 넘어간다.

## 후보율 0.4% 병목 분해

source: VM Cloud localhost order diagnostics aggregate
window: last_7d
freshness: 2026-05-26 21:53 KST
confidence: high for aggregate counts, raw row not exposed

최근 7일 실제 결제완료 주문은 458건, 매출은 109,080,402원이다. 이 중 Google Ads에 바로 보낼 수 있는 주문은 2건, 270,900원이다.

막힌 주문은 세 부류다.

1. 내부 결제완료 bridge는 있으나 Google click id가 없는 주문: 345건, 99,800,828원.
   - 의미: 실제 구매와 내부 결제완료 기록은 붙었지만, Google에 보낼 gclid/gbraid/wbraid가 없다.
   - 다음 병목: 결제완료 payload가 Google click id를 더 잘 복원하도록 보강해야 한다.
2. 내부 bridge도 없는 실제 구매: 109건, 8,523,674원.
   - homepage 87건, NPay 22건.
   - 의미: 실제 구매는 맞지만, VM Cloud 결제완료/intent evidence와 주문이 직접 붙지 않는다.
   - 다음 병목: 주문번호 bridge와 NPay 외부 주문번호 연결을 더 넓힌다.
3. Google click id가 여러 종류 섞인 보류 후보: 2건, 485,000원.
   - 의미: gclid/gbraid/wbraid 중 어떤 하나를 써야 하는지 자동 결정하면 위험하다.
   - 다음 병목: one-of click id 선택 규칙을 별도 설계한다.

결론은 단순하다. 구매는 충분히 있지만, Google Ads에 보내도 되는 직접 click id가 붙은 구매가 너무 적다. 그래서 지금은 2건으로 빨리 주 전환 통로를 시작하고, 동시에 결제완료 단계의 click id 보존률을 올려야 한다.

## 주 전환 승격 타이밍

`Primary 전환`은 Google Ads가 입찰 학습에 쓰는 핵심 구매 신호다. 지금 `NPay 버튼 클릭/결제진입`은 보조 신호로 내려갔기 때문에, 실제 구매 전용 신호를 너무 늦게 올리면 Google Ads는 한동안 좋은 학습 신호를 거의 못 받는다.

권장 타이밍은 아래다.

1. 오늘: VM Cloud 장부 write smoke 승인/실행.
2. 오늘 또는 다음 영업일 오전: 최대 2건 제한 전송 승인/실행.
3. 전송 후 24시간 안: Google Ads 화면/API에서 `BI confirmed_purchase_offline` 수신 건수와 금액 확인.
4. 수신이 맞고 중복이 없으면: `BI confirmed_purchase_offline`을 Primary 전환 후보로 승격한다.

오래 기다릴 필요는 없다. 전송 후보가 2건뿐이라 학습량은 작지만, 잘못된 NPay 버튼 클릭 신호를 Primary로 두는 것보다 실제 결제완료 신호를 작게라도 시작하는 편이 낫다.

## Auditor verdict

- 문서 작성: PASS.
- live no-write API 확인: PASS.
- 후보율 병목 aggregate 재분해: PASS.
- Google Ads 전송: NOT RUN.
- VM Cloud write: NOT RUN.
- 운영DB write: NOT RUN.
- raw 주문번호/click id 노출: NOT RUN / report 0건.

