# Google click ID 보존률 진단

작성 시각: 2026-05-06 09:25:51 KST

## 10초 결론

운영 결제완료 주문 623건 중 Google click id(gclid/gbraid/wbraid)가 남은 주문은 5건이다.
보존률은 0.8%이며, Google Ads confirmed_purchase 연결의 핵심 병목이다.
해결 방향은 결제완료 페이지가 아니라 랜딩/체크아웃/NPay intent 시점에 Google click id를 1st-party storage와 attribution ledger에 남기는 것이다.

## 요약

| metric | value |
| --- | --- |
| total_orders | 623 |
| total_revenue | 146408773 |
| with_google_click_id | 5 |
| google_click_id_rate | 0.8 |
| missing_google_click_id | 618 |
| with_vm_or_intent_evidence | 494 |
| with_evidence_but_no_google_click_id | 489 |
| evidence_without_google_click_id_rate | 98.99 |
| gclid | 5 |
| gbraid | 2 |
| wbraid | 0 |

## 분모 분리

전체 결제완료 주문 기준 보존률과 Google 후보 주문 기준 보존률은 다르게 봐야 한다.
다만 이 리포트의 Google 후보 주문 분모는 주문까지 남은 명시적 Google evidence만 센다.
`search`, `cpc`, `sem` 같은 범용 단어는 Naver brandsearch와 섞일 수 있어 후보 조건에서 제외했다.

| metric | value |
| --- | --- |
| note | 이 분모는 주문 원장/VM evidence에 명시적 Google 증거가 남은 주문만 센다. 일반 search/cpc 같은 범용 단어는 Naver brandsearch와 섞이므로 제외했다. |
| candidate_orders | 10 |
| candidate_revenue | 1922700 |
| with_google_click_id | 5 |
| google_click_id_rate | 50 |
| missing_google_click_id | 5 |
| candidate_reason_counts | {"utm_source_google":8,"utm_campaign_google":8,"google_click_id":5} |
| limitation | Google Ads 랜딩 세션 기준 분모는 GA4 BigQuery landing-session 분석이 필요하다. 이 진단은 주문까지 남은 evidence 기준이다. |

## 결제수단별

| group | orders | revenue | with_google_click_id | google_click_id_rate | missing_google_click_id |
| --- | --- | --- | --- | --- | --- |
| homepage | 586 | 135445673 | 2 | 0.34% | 584 |
| npay | 37 | 10963100 | 3 | 8.11% | 34 |

## Evidence source별

| group | orders | revenue | with_google_click_id | google_click_id_rate | missing_google_click_id |
| --- | --- | --- | --- | --- | --- |
| biocom_imweb | 464 | 129321780 | 2 | 0.43% | 462 |
| (blank) | 129 | 7963093 | 0 | 0% | 129 |
| npay_intent_log | 30 | 9123900 | 3 | 10% | 27 |

## 해석

- Google Ads confirmed_purchase 연결의 1차 병목은 결제완료 주문에 gclid/gbraid/wbraid가 거의 남지 않는 것이다.
- 결제완료 시점에만 click id를 찾으면 PG/NPay 리다이렉션 후 이미 사라질 수 있으므로 랜딩/체크아웃 시점 저장이 필요하다.
- NPay 실제 결제완료 매출은 포함하되, NPay click/count/payment start만 있는 신호는 purchase 후보에서 제외해야 한다.
- 전체 보존률은 전체 결제완료 주문 분모다. Google 후보 주문 분모는 명시적 Google evidence가 남은 주문만 별도로 보되, 최종 분모는 BigQuery 랜딩 세션 분석과 함께 봐야 한다.

## Guardrails

```text
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES
```
