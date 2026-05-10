# NPay actual attribution 3-layer split table (gpt0508-36)

작성 시각: 2026-05-10 23:50:00 KST
실행 상태: 분석 + 산출 PASS
자신감: 90%

## 한 줄 결론

NPay 결제완료 209건은 모두 **upload_blocked**(layer 3)이고, 동시에 각 row는 **internal_revenue_only**(layer 1, 약 134건)이거나 **google_ads_budget_floor_exact**(layer 2, 9건)에 속하오. 즉 209건 모두 우리 매출이지만 그중 9건만 “광고 덕인 것을 증명할 exact evidence 보유”라 광고 ROAS floor 참고용으로만 쓰고, **upload는 본 sprint도 0** 유지요.

## 사람이 보는 분리표

| layer | 의미 | 건수 | internal ROAS 분자 포함 | Google Ads 귀속 | Google Ads upload |
|---|---|---|---|---|---|
| 1. 내부 매출만 | 결제완료지만 광고 증거 없음 | 134 (prep candidates 기준) | ✅ | ❌ | ❌ |
| 2. 광고 floor 참고 | 결제완료 + gclid/gbraid/wbraid + click_view exact | **9** | ✅ | ✅ campaign_id 매칭 | ❌ (별도 Red 승인 후) |
| 3. upload 차단 | 모든 209건 — sprint 정책 invariant | **209** | layer 1 또는 2 | row별 분류 | ❌ |

## 1. 왜 3-layer로 나누는가

- **209건 전체를 “Google Ads 덕”으로 보내는 사고가 진짜 위험**이오. NPay 결제완료라는 사실과 “Google 광고가 들여보낸 손님”이라는 사실은 별개고, exact evidence 없이 합치면 NPay 클릭 오염이 광고 학습에 다시 주입되오.
- 동시에 209건이 우리 internal 매출이라는 사실은 부정할 수 없소. 내부 ROAS 분자에 합류시키는 건 운영 정확도 회복.
- 그래서 “매출 풀 합류”와 “광고 귀속”과 “upload”를 3축으로 분리하는 표가 필요.

## 2. layer별 사용 규칙

### layer 1 — internal_revenue_only

- 134건 (prep candidates 143 - exact evidence 9). PG 209 기준으로는 약 196건 추정.
- internal ROAS 분자: **포함**.
- Google Ads campaign 귀속: **금지** (UTM hint·time-window-only는 진단 라벨일 뿐).
- send/upload: 금지.

### layer 2 — google_ads_budget_floor_exact

- 9건 (prep candidates 안 9건). PG 209 기준으로는 약 13건 추정 (6.3% 비례).
- evidence 후보:
  - gclid + Google Ads click_view exact ✅ (현재 9건)
  - gbraid + click_view exact (현재 0건, 향후 추적)
  - wbraid + click_view exact (현재 0건)
  - order_bridge_ledger same-order exact (Path B canary PASS 후 누적 시작)
  - paid_click_intent_log same-order exact (channel_order_no_hash schema 추가 후)
- 사용처: **광고 캠페인 ROAS 하한 참고값 (budget floor)** — “여기까지는 안전하게 광고가 들여보낸 매출”이라는 뜻.
- upload: **여전히 금지** (별도 Red 승인 + 동의/검증 절차 필요).

### layer 3 — upload_blocked

- 209건 전체. 본 sprint 정책상 항상 차단.
- 차단 사유: Red Lane 별도 승인 부재 / 검증 절차 미완 / platform_send_count==0 invariant 유지.

## 3. PG 209 vs prep candidates 143 차이 66

- 운영 PG: `NAVERPAY_ORDER + PAYMENT_COMPLETE + cancel/return empty + amount > 0` = **209**
- ConfirmedPurchasePrep dry-run input candidates의 NPay = **143**
- 차이 **66건**은 builder block_reasons (예: `already_in_ga4`, `missing_attribution_vm_evidence`, `npay_intent_<status>`)로 candidate에서 제외된 것.
- internal ROAS 분자 계산은 **PG 209 기준이 맞소** — builder block_reasons는 send/upload 후보용 필터지 매출 합산 필터가 아니다.
- 다음 sprint patch: builder block_reasons 정규화에서 `NPay PAYMENT_COMPLETE는 internal revenue 합류는 PASS, send/upload만 block` 으로 명시.

## 4. 검증

| 검증 | 결과 |
|---|---|
| 운영 PG read-only | PASS |
| send_candidate=false invariant | 유지 |
| actual_send_candidate=false invariant | 유지 |
| upload_candidate_count==0 invariant | 유지 |
| raw email/phone/order/payment/member_code 저장 | 0 |

## 5. 다음 액션

### Claude Code가 할 일

1. (의존성: 본 산출물 + 작업 2 wire) Google Ads dashboard 응답에도 layer 1/2/3 카운트를 따로 노출 — 작업 4에서 진행.
2. (의존성: 작업 4) frontend Data Trust Guard에 “209 = 134 internal-only + 9 floor + (upload_blocked)” 한 줄 안내 추가 — 작업 5에서 진행.

### TJ님이 할 일

본 작업 자체에 추가 액션 없음.

## 6. Verdict

`SPLIT_TABLE_PASS_134_INTERNAL_ONLY_9_GOOGLE_FLOOR_209_UPLOAD_BLOCKED`

산출 JSON: `data/npay-actual-attribution-split-table-20260511.json`
