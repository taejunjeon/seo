# Google Ads action/campaign ROAS decomposition (2026-05-10)

## 5줄 요약

1. 실시간 Google Ads API는 현재 read-only script env 매핑 확인이 필요해 2026-05-05 LAST_14_DAYS snapshot을 fallback으로 썼다.
2. snapshot상 Google Ads 플랫폼 주장 Conv. value는 123,495,273.53원, 내부 confirmed 현재 window 매출은 862,000원이다.
3. 두 값은 window가 달라 직접 ROAS 비교값으로 쓰지 않고, gap driver를 찾는 참고값으로만 둔다.
4. primary NPay count label snapshot value는 123,495,262.24원으로, 플랫폼 Conv. value의 대부분을 차지한다.
5. Google Ads upload, conversion action 변경, send_candidate=true는 계속 0/NO다.

## Source Availability

- google_ads_api_realtime: api_token_biocom_present_but_current_readonly_script_requires_google_ads_developer_token
- google_ads_snapshot: available_20260505_last14_fallback
- internal_confirmed: available_20260510_operational_db_primary
- comparability: warning_not_same_window

## Conversion Actions

| id | name | primary | classification | risk | reason |
| --- | --- | --- | --- | --- | --- |
| 7130249515 | 구매완료 | true | primary_npay_count_label | high | Google Ads Primary 전환=입찰 학습에 쓰는 핵심 구매 신호가 NPay click/count 계열 label에 묶여 있을 가능성 |
| 7564830949 | TechSol - NPAY구매 50739 | false | secondary_npay_click_label | medium | NPay 버튼 클릭/intent 전환으로 보이며 실제 결제완료와 분리 필요 |

## Campaign Snapshot

| campaign | channel | cost | platform value | primary NPay value | internal join |
| --- | --- | ---: | ---: | ---: | --- |
| [PM]건기식 실적최대화 | PERFORMANCE_MAX | 4,184,673.89 | 41,669,299.15 | 41,669,299.15 | not_joined_missing_campaign_click_key |
| [PM]검사권 실적최대화 | PERFORMANCE_MAX | 3,418,000.69 | 53,158,637.78 | 53,158,632.73 | not_joined_missing_campaign_click_key |
| [PM] 이벤트 | PERFORMANCE_MAX | 2,820,143.84 | 27,338,330.36 | 27,338,330.36 | not_joined_missing_campaign_click_key |
| [SA]바이오컴 검사권 | SEARCH | 693,720.89 | 1,329,006.24 | 1,329,000 | not_joined_missing_campaign_click_key |
| [PMAX] 바이오컴 검사권 캠페인 | PERFORMANCE_MAX | 3.1 | 0 | 0 | not_joined_missing_campaign_click_key |

## 이번 문서가 말하는 것 / 말하지 않는 것

- 말하는 것: Google Ads 플랫폼 주장값이 어떤 action/campaign 쪽에서 부풀 가능성이 큰지.
- 말하지 않는 것: 오늘 기준 정확한 Google Ads ROAS. 실시간 API token이 없어 same-window 값이 아니다.

## 금지선 준수

- Google Ads upload 0
- conversion action 변경 0
- platform send 0
- send_candidate=true 0
