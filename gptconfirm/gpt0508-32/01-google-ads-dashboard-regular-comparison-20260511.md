# Google Ads dashboard regular comparison - 2026-05-11

작성 시각: 2026-05-10 21:17:36 KST
Lane: Green read-only

## 5줄 요약

1. VM Cloud Google Ads dashboard route는 status, last_7d, last_30d 모두 HTTP 200이다.
2. Google Ads ROAS=광고 플랫폼이 주장하는 값은 last_7d 11.70x, last_30d 9.58x다.
3. 내부 confirmed ROAS=실제 결제완료 주문 원장 기준값은 last_7d 0.40x, last_30d 0.27x다.
4. Primary 전환=Google Ads가 입찰 학습에 쓰는 핵심 구매 신호 값의 거의 전부가 NPay click/count label이라 예산 판단값으로 바로 쓰면 안 된다.
5. upload_candidate_count는 0이며 Google Ads upload/send/conversion action 변경은 하지 않았다.

## 정기 비교 표

| window | date range KST | platform_roas_reference | internal_confirmed_roas | primary_npay_share | campaign_join_coverage | upload_candidate_count |
| --- | --- | --- | --- | --- | --- | --- |
| last_7d | 2026-05-03 - 2026-05-09 | 11.7x | 0.4x | 0.00% | 70.00% | 0 |
| last_30d | 2026-04-10 - 2026-05-09 | 9.58x | 0.27x | 0.00% | 84.00% | 0 |

## 운영자 해석

- 예산 판단에 쓸 값: 내부 confirmed ROAS와 confirmed 주문 원장 기준 매출이다.
- 참고만 볼 값: Google Ads platform ROAS와 Primary NPay label 기반 전환값이다.
- NPay 클릭, add_payment_info, count label은 구매완료가 아니다. 실제 결제완료 NPay 매출은 운영DB PAYMENT_COMPLETE 또는 관리자 confirmed source로 포함해야 한다.

## 금지선 준수

- Google Ads upload 0
- Google Ads conversion action 변경 0
- GA4/Meta/TikTok/Naver 신규 전송 0
- send_candidate=true 0
