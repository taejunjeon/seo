# 02. Ads Manager ROAS reconciliation

## 사람이 이해하는 결론

Meta Ads Manager는 최근 7일 기준 구매와 구매값을 반환한다. 따라서 Ads attribution이 완전히 끊긴 상태는 아니다. 문제는 “오늘” 지표가 아직 0으로 보인다는 점이다. CAPI가 오늘도 정상 전송 중이므로, 우선 UI/API 반영 지연으로 보고 12-24시간 모니터링한다.

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source | Meta Ads Insights API read-only |
| account | `act_3138805896402376` |
| checked_at | 2026-05-15 17:00 KST 전후 |
| action_report_time | conversion |
| attribution setting | unified attribution setting |
| confidence | medium |

## Account summary

| window | impressions | clicks | spend | purchases | purchase value | ROAS | cost / purchase |
|---|---:|---:|---:|---:|---:|---:|---:|
| 오늘 | 97,056 | 2,911 | 2,258,963원 | 0 | 0원 | 0 | N/A |
| 최근 7일 | 1,422,855 | 38,356 | 28,956,747원 | 219 | 58,123,707원 | 약 2.01 | 약 132,223원 |

계산:
- 최근 7일 ROAS = 58,123,707 / 28,956,747 = 약 2.01.
- 최근 7일 cost per purchase = 28,956,747 / 219 = 약 132,223원.

## CAPI와 Ads purchase가 왜 1:1이 아닌가

CAPI Purchase는 “Meta에 구매 이벤트를 보냈다”는 서버 이벤트다. Ads Manager purchase는 “Meta가 광고 노출/클릭에 귀속시킨 구매”다.

따라서 아래는 정상적으로 다를 수 있다.

- CAPI 성공: 바이오컴 Pixel 최근 7일 353건.
- Ads attributed purchase: 최근 7일 219건.

이 차이는 다음 이유가 섞인다.

1. Meta 광고 클릭/노출과 매칭되지 않은 구매는 Ads purchase에 안 들어간다.
2. fbc/fbclid가 없는 CAPI는 match는 되더라도 광고 귀속 신뢰도가 낮아질 수 있다.
3. Ads Manager는 attribution window와 action report time 기준으로 날짜가 달라질 수 있다.
4. 당일 데이터는 지연 보정이 흔하다.

## Campaign/adset detail 상태

campaign/adset 단위 detail과 optimization event 확인은 이번 턴에서 완료하지 못했다.

- `/api/meta/insights` account summary는 성공.
- campaign/adset rows는 빈 배열로 반환.
- `/api/meta/campaigns/health`는 Meta rate limit으로 502를 반환했다.
- 원문 분류: Meta API `code=80004`, `error_subcode=2446079`, “too many calls to this ad-account”.

따라서 “캠페인/광고세트가 Purchase 최적화인지”는 이번 문서에서 확정하지 않는다. UI 확인 또는 rate limit 해소 후 재조회가 필요하다.

## 판정

- `C. ADS_ATTRIBUTION_NOT_CONNECTING`: 전체적으로는 NO. 최근 7일 Ads purchase/value가 존재한다.
- `A. CAPI_SIGNAL_HEALTHY_ADS_UI_DELAY`: YES. 오늘 purchase 0은 UI/API 반영 지연 가능성이 높다.
- 단, 2026-05-16에도 2026-05-15 구매가 계속 0이면 `C`로 승격한다.
