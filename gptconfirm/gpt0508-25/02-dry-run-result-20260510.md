# ConfirmedPurchasePrep input — canary window builder

작성 시각: 2026-05-10 13:24:42 KST

## 5줄 결론

1. candidate=5 (homepage=2 / npay_actual=3) / excluded=3 — read-only 운영 sqlite imweb_orders 매개.
2. Path A 매칭=0 (vm_evidence 미사용, 본 builder 범위 외).
3. Path C 매칭=2 (member_code 매개), uplift=2.
4. 차단 분포: missing_member_code=0 / missing_paid_click_intent=2 / outside_window=0 / after_paid_at=1 / ambiguous=1 / already_in_ga4=0.
5. send_candidate=0. 외부 플랫폼 전송 / 운영 DB write / GTM·Imweb wrapper 변경 모두 0건.

## 요약

| metric | value |
| --- | --- |
| candidate_count | 5 |
| excluded_order_count | 3 |
| homepage_count | 2 |
| npay_actual_count | 3 |
| with_member_code | 5 |
| path_a_match_count | 0 |
| path_c_match_count | 2 |
| path_c_uplift | 2 |
| missing_member_code | 0 |
| missing_paid_click_intent | 2 |
| outside_window | 0 |
| after_paid_at | 1 |
| ambiguous | 1 |
| already_in_ga4 | 0 |
| member_code_column_absent | 0 |
| send_candidate | 0 |

## Guardrails

```text
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES
Operational schema migration: NOT TRIGGERED (read-only)
GTM/Imweb wrapper change: NONE
Raw member_code in output: NONE (sha256 prefix only)
```

## 다음 판단

- Path C 효과를 측정하려면 paid_click_intent_ledger.member_code 컬럼이 운영 sqlite 에 존재해야 한다 (P1 Yellow 영역).
- 본 builder 출력은 ConfirmedPurchasePrep candidate-prep script 의 input 으로 사용된다.
- send_candidate=0 은 read-only 단계이므로 Google Ads / Meta / GA4 전송은 항상 막힌다.
