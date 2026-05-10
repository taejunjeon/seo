# ConfirmedPurchasePrep campaign_id blocker breakdown (gpt0508-33)

작성 시각: 2026-05-10 21:45:30 KST
Lane: Green read-only / 로컬 산출물

## 5줄 결론

1. 내부 confirmed 2,152건 중 31건만 campaign_id로 이어졌고 missing 2,121건의 사유를 결제수단·click 증거·UTM 유무 기준으로 6개 카테고리로 분류했다.
2. 가장 큰 blocker는 `홈페이지 결제 + click 부재 + UTM only` 1,054건과 `홈페이지 결제 + click 부재 + UTM 없음` 933건이다.
3. NPay actual 결제는 134건이고 그 중 click 증거 보유 0건, UTM only 27건, UTM 없음 107건.
4. UTM hint는 사람이 볼 단서로만 두고 budget·upload 후보로 승격하지 않는다. google 채널을 명시한 UTM은 missing 안에 0건.
5. upload_candidate_count 0 유지. 다음 Green 액션은 ConfirmedPurchasePrep 입력 갱신 시 동일 분류표를 다시 만들어 추세 추적이다.

## 1. 분류 기준

| 축 | 값 |
|---|---|
| campaign_id 매칭 여부 | matched / missing |
| google click_id 보유 (gclid/gbraid/wbraid) | true / false |
| 결제수단 | homepage / npay |
| UTM campaign 보유 | true / false |
| Path B exact bridge | present / absent |

## 2. blocker 분류 표

| ID | 카테고리 | 건수 | missing 비율 | click_id | campaign matched | budget 사용 | 다음 Green 액션 |
|---|---|---|---|---|---|---|---|
| A | click id present + campaign_id matched | 31 | n/a | true | true | OK | floor sample 유지 |
| B | click id present + click_view not found | 0 | 0.0% | true | false | 금지 | 다음 호출 시 재확인 |
| C | NPay confirmed + click 부재 + UTM only | 27 | 1.27% | false | false | 금지 | NPay funnel-capi click bridge 누적 필요 |
| D | NPay confirmed + click 부재 + UTM 없음 | 107 | 5.04% | false | false | 금지 | watch only |
| E | 홈페이지 confirmed + click 부재 + UTM only | 1,054 | 49.70% | false | false | 금지 | UTM은 사람이 볼 단서만 |
| F | 홈페이지 confirmed + click 부재 + UTM 없음 | 933 | 43.99% | false | false | 금지 | watch only |
| G | Path B bridge present + payment not confirmed | 0 | 0.0% | true | false | 금지 | virtual account 입금 완료 시 재검토 |

총: matched 31 + missing 2,121 = 2,152.

## 3. 결제수단 × UTM 교차표 (missing 2,121건)

| | UTM 보유 | UTM 없음 | 합계 |
|---|---|---|---|
| 홈페이지 | 1,054 | 933 | 1,987 |
| NPay | 27 | 107 | 134 |
| 합계 | 1,081 | 1,040 | 2,121 |

## 4. missing 안의 UTM hint top 15 (diagnostic only — budget/upload 사용 금지)

| utm_campaign | count | use_for_budget |
|---|---|---|
| (empty) | 1,040 | false |
| naverbrandsearch_biocom_MO_mainhome | 157 | false |
| 1 | 81 | false |
| meta_biocom_yeonddle_igg | 76 | false |
| meta_biocom_songyuul08 | 62 | false |
| topbanner_MO | 59 | false |
| meta_biocom_sosohantoon01_igg | 58 | false |
| meta_biocom_kkunoping02_igg | 45 | false |
| meta_biocom_skincare_igg | 44 | false |
| meta_biocom_kangman03_igg | 39 | false |
| newmember_coupon | 29 | false |
| naverbrandsearch_biocom_PC_mainhome | 28 | false |
| meta_story_kangman2_igg | 21 | false |
| meta_biocom_sikdanstory_igg | 19 | false |
| meta_biocom_igevsiggblog_igg | 18 | false |

google 채널을 명시한 UTM은 0건. naverbrandsearch는 Naver Search Ads 채널이라 google 후보가 아님.

## 5. 결과 요약

| 항목 | 값 |
|---|---|
| 총 confirmed 주문 | 2,152 |
| campaign_id matched | 31 |
| campaign_id missing | 2,121 |
| budget-usable category | A 만 (31건) |
| diagnostic-only categories | B/C/D/E/F/G |
| upload_candidate_count | 0 |
| send_candidate | false |
| actual_send_candidate | false |
| budget_decision | `HOLD_except_category_A_floor` |

## 6. 금지 재확인

- send_candidate=false, actual_send_candidate=false, upload_candidate_count=0.
- UTM hint를 budget ROAS 또는 upload 후보로 승격 금지.
- NPay click/count/add_payment_info를 purchase로 승격 금지.
- time-window-only attribution을 예산 판단에 사용 금지.
- raw email/phone/member_code/order/payment 저장/로깅 없음.

## 7. Verdict

`HOLD_BUT_BLOCKER_CATEGORIES_HUMAN_READABLE`

산출 JSON: `data/confirmed-purchase-campaign-id-blocker-breakdown-20260511.json`
