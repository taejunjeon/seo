# 04. Next actions

## 우선순위

### 1. `/total` CAPI site/pixel filter patch

- Owner: Codex
- Lane: Green local patch, Yellow VM Cloud deploy
- 추천 점수: 92%
- 이유: 바이오컴 화면에 더클린커피 Pixel CAPI가 섞여 가장 큰 착시를 만든다.
- 구현: site별 Pixel map을 적용한다.
  - biocom → `1283400029487161`
  - thecleancoffee → `1186437633687388`
- 성공 기준:
  - 바이오컴 최근 7일 CAPI success가 651이 아니라 target Pixel 353 근처로 표시.
  - 더클린커피 화면에는 coffee Pixel만 표시.
  - UTM Breakdown CAPI success가 `utm_present 기타`에 몰리지 않음.
- 실패 시 확인:
  - CAPI log `ledger_entry.source` 누락.
  - source site와 pixel ID mapping 충돌.
  - old Pixel 또는 historical send log가 섞였는지 확인.

### 2. confirmed-but-CAPI-missing 12건 분류

- Owner: Codex
- Lane: Green read-only, Red if actual backfill
- 추천 점수: 88%
- 이유: CAPI는 살아 있지만 이 큐가 실제면 일부 결제완료가 Meta에 늦게 도착한다.
- 구현:
  - safe_ref 기준으로 payment_key/Toss/Imweb confirmed/value/cancel/duplicate를 재검증.
  - `backfill_ready`, `no_send_guard`, `legacy_missing_payment_key`, `duplicate_or_already_sent`로 분류.
- 성공 기준:
  - 12건이 모두 send 가능/불가/추가 확인으로 나뉜다.
- 실패 시 확인:
  - payment_key 없는 row는 Imweb/Toss direct fallback 없이는 Red send 금지.

### 3. Ads Manager today lag monitor

- Owner: Codex + TJ님
- Lane: Green read-only
- 추천 점수: 78%
- 이유: 오늘 Ads purchase가 0이라 반영 지연인지 실제 attribution 문제인지 분리해야 한다.
- 구현:
  - Codex: Meta Ads Insights API를 12-24시간 뒤 다시 read-only 조회.
  - TJ님: Ads Manager UI에서 오늘/어제/최근 7일 purchase/value/ROAS 확인.
- 성공 기준:
  - 2026-05-15 구매가 다음날 Ads Manager에 반영된다.
- 실패 시 확인:
  - attribution window, action_report_time, dataset/pixel filter, campaign optimization event.

### 4. Campaign/adset optimization event 재조회

- Owner: Codex, 필요 시 TJ님 UI 확인
- Lane: Green read-only
- 추천 점수: 70%
- 이유: API rate limit 때문에 이번 턴에서 campaign/adset Purchase 최적화 여부를 닫지 못했다.
- 구현:
  - Meta API rate limit 해소 후 `/api/meta/campaigns/health` 재조회.
  - 실패하면 TJ님이 Ads Manager > 광고 세트 > 최적화 이벤트 화면을 확인.
- 성공 기준:
  - 활성 광고세트의 optimization event가 Purchase인지 확인.
- 실패 시 확인:
  - Meta API code 80004 rate limit, permission, selected account.

## 하지 말 것

- 새 광고 계정 생성: 지금은 신호 분산 위험이 더 크다.
- 두 번째 Pixel 삽입: 현재 CAPI/Ads attribution이 부분적으로 연결되어 있으므로 중복·분산 위험이 크다.
- 대량 backfill: missing queue를 분류하기 전에는 금지.
- Browser Purchase fail-open: CAPI가 살아 있으므로 지금은 필요 없다.

## Telegram 5줄 요약

```text
Meta CAPI는 바이오컴 Pixel 기준 최근 24h 52/52, 7d 353/353 성공입니다.
Ads Manager 최근 7d는 구매 219건/5,812만원으로 attribution은 완전 단절이 아닙니다.
오늘 Ads 구매 0은 우선 UI/API 반영 지연으로 보고 12-24h 재확인합니다.
/total CAPI 651은 더클린커피 Pixel 298건이 섞인 표시 버그입니다.
다음은 site/pixel filter patch와 missing queue 12건 분류입니다.
```
