# Peak canary click material rate 측정 계획 (gpt0508-40 작업6)

작성 시각: 2026-05-11 13:50:00 KST
실행 상태: 측정 script + 계획 ready, **실측은 TJ controlled traffic 시점 보류**
자신감: 95% (script 동작), 50% (실측 신호 — TJ traffic 양에 따라)

## 5줄 결론

1. 정점 트래픽 window 에서 R2 ledger 의 3 지표 (`click_id_hash_present_rate` / `ga_session_present_rate` / `category_distribution`) 측정 script 신설.
2. 측정 window 후보: KST 2026-05-11 11~12 / 19~20 두 슬롯 — TJ controlled traffic (1~2회 광고 클릭 + 결제 시도 (취소 OK)) 와 같은 window 안에 진행.
3. script 자체는 read-only 로 ATT_LEDGER_FETCH_URL endpoint 호출 + enricher + injector 통합. operational DB write 0.
4. 다음 액션 threshold: `click_id_hash_present_rate >= 0.50` → wire route + GTM ramp 단계 검토 / `0.10~0.50` → payment-success body 캡처 보강 + funnel-capi v3 보완 / `< 0.10` → 광고 클릭→checkout reconciliation 재검증.
5. **본 sprint 안에서 실측 자체는 실행하지 않음** — TJ traffic 합의 후 별도 시점에 실행.

## 1. script 사용

```bash
ORDER_BRIDGE_IDENTITY_HASH_SECRET=$secret \
ATT_LEDGER_FETCH_URL=https://att.ainativeos.net/api/attribution/order-bridge-ledger/recent \
npx tsx backend/scripts/peak-canary-click-material-rate-20260511.ts --window-hours=1 \
  > data/peak-canary-click-material-rate-result-20260511-HHMM.json
```

## 2. 측정 window 후보

| window (KST) | TJ action | 측정 시점 |
|---|---|---|
| 2026-05-11 11:00~12:00 | 광고 클릭 1~2회 + 결제 시도 (취소 OK) | window 종료 후 30~60분 |
| 2026-05-11 19:00~20:00 | 광고 클릭 1~2회 + 결제 시도 (취소 OK) | window 종료 후 30~60분 |

## 3. 다음 액션 threshold

| `click_id_hash_present_rate` | 다음 sprint 결정 |
|---|---|
| ≥ 0.50 | **go** — wire route + GTM ramp 단계 검토 |
| 0.10 ~ 0.50 | **investigate** — payment-success body 캡처 보강 + funnel-capi v3 보완 |
| < 0.10 | **block** — 광고 클릭 → checkout 흐름 reconciliation 재검증 |

## 4. invariants

| invariant | 결과 |
|---|---|
| send_candidate / actual_send_candidate / upload_candidate | false / false / 0 |
| operational DB write | 0 |
| external API call | ATT_LEDGER_FETCH_URL read-only 한 번 + (optional) operational DB SELECT |
| raw_pii_logged_in_output | false |

## 5. 보류 사유

작업 6 의 신호는 TJ controlled traffic 이 들어와야 의미 있음. canary 기간 자연 organic 트래픽만으로는 5/9 Tag Assistant 와 유사하게 click 0건 row 가 다시 채워질 가능성이 높음 (audit 결과 sprint canary 9 row 모두 paid_intent 0 match).

따라서 **본 sprint 안에서는 measurement plan 까지만 완성**, 실제 실행은 작업 7 결과 보고 시 TJ 합의 후 별도 시점에 진행.

## 6. 다음 액션

### Claude Code가 할 일

- 작업 7: 작업 1~6 종합한 next action decision 문서 작성.
- TJ 합의 후 peak canary 실행 시점에 본 script 실행 + 결과 저장.

### TJ님이 할 일

- 측정 window 슬롯 (11~12 또는 19~20) 선택 + 광고 클릭/결제 시도 1~2회 협조.

## 7. Verdict

`MEASUREMENT_PLAN_READY_LIVE_AWAITS_TJ_TRAFFIC_APPROVAL`

산출 JSON: `data/peak-canary-click-material-rate-plan-20260511.json`
