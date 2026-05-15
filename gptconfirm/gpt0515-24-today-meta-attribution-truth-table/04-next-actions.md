# Next Actions

작성 시각: 2026-05-15 23:24 KST

## Codex가 할 일

1. 2026-05-16 오전 Ads Manager yesterday 재조회

왜 하는가: 오늘 CAPI는 Meta에 들어갔지만 Ads Manager today는 0이다. 다음날 `yesterday`로 바뀌어도 0이면 단순 지연이 아니라 귀속 연결 문제일 가능성이 커진다.

어떻게 하는가:

```bash
curl -sS 'https://att.ainativeos.net/api/meta/insights?account_id=act_3138805896402376&date_preset=yesterday&level=account'
```

성공 기준:

- 2026-05-15 purchase/value가 0보다 커진다.

실패 시 해석:

- `TODAY_CAPI_HEALTHY_ADS_ATTRIBUTION_BROKEN`으로 올리고, CAPI match quality와 campaign optimization event를 다시 본다.

승인 필요: 없음, Green read-only.

추천 점수/자신감: 95%.

의존성: 2026-05-16 오전까지 시간 경과 필요.

## Claude frontend가 할 일

1. ROAS 카드 source label 분리

왜 하는가: 현재 화면은 `/api/ads/roas` 내부 귀속 ROAS를 Ads Manager ROAS처럼 보이게 할 수 있다.

어떻게 하는가:

- `내부 Meta 귀속 ROAS`: `/api/ads/roas`
- `Ads Manager 귀속 ROAS`: `/api/meta/insights`
- 두 카드에 source/unit/window를 표시한다.

성공 기준:

- today 2.08x/19건은 내부 ROAS로 표시된다.
- Ads Manager today 0건은 플랫폼 귀속값으로 별도 표시된다.
- 두 값을 합산하거나 같은 값처럼 보이지 않는다.

승인 필요: 프론트 배포 시 TJ님 승인 필요.

추천 점수/자신감: 92%.

의존성: 없음. 백엔드 API는 이미 live.

## TJ님이 할 일

1. Meta Ads Manager UI에서 2026-05-16 오전에 2026-05-15 구매가 올라왔는지 한 번만 확인

왜 하는가: API 기준은 0이지만, UI 반영이나 필터가 다를 수 있다.

어디에서 확인하는가:

- Meta Ads Manager
- 바이오컴 계정
- 날짜: 2026-05-15
- 열: 구매, 구매 전환값, 구매 ROAS

성공 기준:

- 2026-05-15 구매가 0보다 크다.

실패 시 다음 확인점:

- Pixel/Dataset, attribution setting, conversion event set, campaign optimization event를 재확인한다.

Codex가 대신 못 하는 이유:

- Meta UI 접근과 계정 세션/2FA는 브라우저 권한 영역이다. Codex는 API로 read-only 재조회는 가능하다.

승인 필요: 외부 화면 확인만 필요. 설정 변경 승인 아님.

추천 점수/자신감: 85%.

의존성: 2026-05-16 오전까지 시간 경과 필요.
