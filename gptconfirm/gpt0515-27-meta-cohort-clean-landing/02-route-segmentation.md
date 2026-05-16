# Meta route segmentation

작성 시각: 2026-05-16 01:51 KST

## 10초 요약

7일 내부 Meta evidence 결제완료는 133건 / 41,969,224원입니다.

가장 큰 라우트는 `/igg_store`, `shop_payment_complete`, `songyuul07`, `nanabebe05`입니다. 즉 Meta 유입이 특정 상품/콘텐츠형 랜딩과 결제완료 URL로 나뉘어 들어옵니다.

## 기준

이 문서의 `Meta evidence strict`는 아래 중 하나가 있는 결제완료 주문입니다.

- fbclid present
- utm_source/medium/campaign/content에 Meta/Facebook/Instagram 계열 표식
- metadata source에 Meta 표식

fbc만 있는 주문은 별도 진단 신호로 보고, 예산 판단용 Meta evidence에는 자동 포함하지 않았습니다. fbc는 유용하지만 오래 남을 수 있어 단독 Meta 매출 확정으로 쓰면 과대평가 위험이 있습니다.

## Route bucket

| Landing bucket | 주문 | 매출 | 해석 |
|---|---:|---:|---|
| `/igg_store` | 47 | 14,683,511원 | IGG 상품/콘텐츠 랜딩 중심입니다. Meta evidence 매출의 35.0%입니다. |
| `/shop_payment_complete` | 21 | 7,764,567원 | 2026-05-15 완료 URL 관측이 여기에 잡혔습니다. |
| `/songyuul07` | 22 | 6,522,600원 | 특정 캠페인/파트너형 랜딩 후보입니다. |
| `/nanabebe05` | 15 | 4,433,200원 | 특정 캠페인/파트너형 랜딩 후보입니다. |
| `/shop_payment` | 10 | 3,168,680원 | 결제 페이지 진입 흔적입니다. Purchase 후보가 아니라 여정 evidence로만 봅니다. |
| `/shop_view` | 6 | 2,312,206원 | 상품 상세/상점 뷰 계열입니다. |
| 기타 | 12 | 3,084,460원 | 소량 분산 랜딩입니다. |

## Campaign / UTM bucket

| UTM campaign bucket | 주문 | 매출 | 해석 |
|---|---:|---:|---|
| 숫자형 campaign UTM bucket | 40 | 12,356,500원 | Meta 캠페인 ID 또는 동적 매크로가 들어온 것으로 보입니다. 사람이 읽는 이름으로 정규화가 필요합니다. |
| `meta_biocom_yeonddle_igg` | 22 | 7,466,143원 | 이름형 UTM이 잘 남은 캠페인입니다. |
| missing campaign | 15 | 6,179,210원 | fbclid 또는 source evidence는 있으나 campaign 값이 비어 있습니다. |
| `meta_biocom_sikdanstory_igg` | 7 | 2,241,500원 | 이름형 UTM이 남은 캠페인입니다. |
| `meta_biocom_igevsiggblog_igg` | 7 | 2,172,508원 | 이름형 UTM이 남은 캠페인입니다. |
| 기타 | 42 | 11,553,363원 | 캠페인/콘텐츠 bucket이 분산돼 있습니다. |

## Evidence type

| Evidence | 주문 | 매출 | 예산 판단 |
|---|---:|---:|---|
| fbclid 또는 Meta click evidence | 124 | 38,727,424원 | 강한 후보입니다. |
| Meta UTM/source만 있음 | 9 | 3,241,800원 | 후보지만 캠페인 정규화가 필요합니다. |
| fbc only | 별도 진단 | 별도 진단 | 예산 판단용 확정 매출로 자동 포함하지 않습니다. |

## 결제수단 분해

현재 VM Cloud `attribution_ledger`의 이 7일 Meta evidence row에서는 결제수단 필드가 안정적으로 남지 않습니다. payment method aggregate는 `unknown`으로 두는 것이 맞습니다.

다음 개선은 결제완료 payload 또는 confirmed bridge에서 `card / npay / virtual_account / bank_transfer`를 안전한 enum으로 남기는 것입니다. 이 값은 raw payment key와 다르게 안전한 집계 필드입니다.

## 원인 분기

1. **CAPI coverage high + Ads attribution low**
   - 내부 Meta evidence 133건 중 CAPI 성공은 125건입니다.
   - 2026-05-15는 19건 CAPI 성공인데 Ads purchase는 0입니다.
   - restriction/Ads attribution/당일 지연 후보가 클릭 캡처 문제보다 우선입니다.

2. **Meta evidence checkout low**
   - 해당 없음에 가깝습니다. Meta checkout은 7일 291건이고 2026-05-15에도 51건입니다.

3. **Meta confirmed rate low**
   - 광고/랜딩 품질 문제는 별도 분석 대상입니다. 하지만 이번 incident의 1순위는 아닙니다.

4. **ATT ROAS normal + Ads ROAS zero**
   - 2026-05-15가 여기에 해당합니다. 내부 ATT ROAS 2.22x, Ads ROAS 0.00x입니다.

## 다음 보강 포인트

- campaign/adset/ad ID는 UTM 매크로를 사람이 읽는 이름과 같이 저장해야 합니다.
- `payment_method`는 결제완료 bridge에서 안전 enum으로 남겨야 합니다.
- `/shop_payment`는 구매완료가 아니라 payment_page_seen으로 유지해야 합니다.
