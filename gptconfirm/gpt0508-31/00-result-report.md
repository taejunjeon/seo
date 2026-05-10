# gpt0508-31 result report

작성 시각: 2026-05-10 20:32:38 KST
Lane: Yellow approved VM limited deploy + Green read-only/dry-run/docs

## 한 줄 결론
VM Google Ads dashboard `last_30d` 502는 `local_first` 제한 배포로 200 회복했고, BigQuery archive+daily union도 7/14/30일 coverage PASS라서 프론트엔드 F0가 읽을 데이터 계약이 한 단계 안정화됐다.

## Track 진척률

- Track A. ConfirmedPurchasePrep 통합 input: 89% -> 90% (+1%)
- Track B. Google Ads campaign_id 조인/ROAS 분해: 68% -> 73% (+5%)
- Track C. BigQuery campaign funnel quality: 66% -> 76% (+10%)
- Track D/KR6. Meta funnel CAPI Test Events readiness: 70% -> 70% (+0%)
- Track E. Harness/multi-agent/HOLD Reducer: 87% -> 87% (+0%)
- Track F. Frontend/Data Trust Dashboard: 42% -> 46% (+4%)

## 5줄 요약

1. VM dashboard route는 `GOOGLE_ADS_DASHBOARD_LEDGER_MODE=local_first` 반영 후 status/last_7d/last_30d 모두 200이다.
2. Google Ads ROAS=광고 플랫폼이 주장하는 값과 내부 confirmed ROAS=실제 결제완료 원장 기준값을 같은 VM API에서 분리해 볼 수 있게 됐다.
3. BigQuery는 archive 백필과 신규 daily export를 합치면 7/14/30일이 실제 다른 날짜를 읽는다. daily-only 3일 coverage warning의 원인을 줄였다.
4. ConfirmedPurchasePrep 반복 입력은 최근 30일 confirmed 2,152건, NPay actual 143건, send/upload 후보 0건을 유지한다.
5. 캠페인별 internal ROAS는 exact click id 31건만 하한 샘플로 쓰고, missing 2,121건은 time-window-only로 억지 attribution하지 않는다.

## 지금 승인해도 되는 것

- VM dashboard last_7d/last_30d read-only 정기 비교. 이미 local_first 배포와 smoke가 PASS했다.
- BigQuery archive+daily union 기반 7/14/30일 funnel quality 재계산. read-only다.
- ConfirmedPurchasePrep no-send 반복 실행. send_candidate=false와 upload_candidate_count=0을 고정한다.
- frontend F0 data contract 유지/검토. 구현은 아직 HOLD다.

## 아직 승인하면 안 되는 것

- Google Ads confirmed_purchase upload
- Google Ads conversion action 변경
- Meta CAPI Test Events 실제 호출, test_event_code 제공 전
- GTM Production publish
- frontend 구현 착수
- send_candidate=true / actual_send_candidate=true

## 검증 결과

- VM `/api/google-ads/status`: 200
- VM `/api/google-ads/dashboard?date_preset=last_7d`: 200
- VM `/api/google-ads/dashboard?date_preset=last_30d`: 200
- BigQuery archive+daily union: PASS, last_7d/14d/30d suffix coverage PASS
- ConfirmedPurchasePrep repeatable no-send: upload_candidate_count=0, send_candidate=false
- raw email/phone/order/payment log delta: 0
- platform send: 0
- 추가 검증 명령 결과는 최종 검증 후 대화 보고에 반영한다.

## 다음 자동 Green 작업

- dashboard route last_7d/last_30d 정기 비교 결과를 같은 JSON shape로 저장한다.
- BigQuery union 결과를 campaign/channel funnel quality 표로 확장한다.
- campaign_id missing 2,121건을 exact evidence 중심으로 줄일 방법을 계속 조사한다.

## 다음 Yellow/Red 승인 후보

- frontend 구현 착수는 Claude Code로 진행하되, F0 contract가 더 굳은 뒤 별도 승인한다.
- Google Ads upload/conversion action 변경은 Red Lane으로 계속 HOLD다.

## 사람이 이해할 수 있는 1문장 설명
광고 플랫폼이 주장하는 매출 숫자와 실제 결제완료 원장 기준 숫자를 같은 기간으로 빠르게 비교할 수 있게 됐지만, 아직 Google Ads에 새 구매 신호를 보내지는 않는다.

## 금지선 준수

- 운영DB write 0
- Google Ads/GA4/Meta/TikTok/Naver 신규 전송 0
- Google Ads upload 0
- GTM Production publish 0
- raw email/phone/member_code/order/payment 저장 또는 logging 0
