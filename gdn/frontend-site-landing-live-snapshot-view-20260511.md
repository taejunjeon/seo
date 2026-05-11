# frontend live snapshot view 개선 (gpt0508-44 작업4)

작성 시각: 2026-05-11 18:35:00 KST
LOC: 73 (권장 60 약간 초과, 80 한도 안)
deploy 상태: 운영 적용 완료

## 1. 이번에 가능해진 것

`biocom.ainativeos.net/ads/site-landing` 페이지에 **작은 표본 안내 배너** 추가. 표본이 50 건 미만이면 "비율 해석 보류" 노란 알림이 분포 카드 위에 노출. 50 건 이상이면 자동으로 사라짐.

## 2. 왜 필요했는지

deploy 후 30 분 시점 12 건 표본이 한 채널에 쏠려 있지 않은 4 카테고리 cover 라 시각적으로는 의미 있어 보이지만, **표본이 너무 작아서 비율 해석은 위험**. 사용자가 이 페이지를 보고 "광고가 60% 점유" 같은 결론을 미리 내지 않도록 막는 게 목적.

## 3. 변경 내용

| 항목 | 변경 |
|---|---|
| 코드 줄 수 | 68 → 73 LOC (+5) |
| 신규 표시 | 노란 배너 — "표본 N 건은 작은 표본 — 비율 해석 보류. 50 건 도달 이후 의미 있는 비율로 봅니다." |
| 표시 조건 | `summary.total < 50` 일 때만 |
| 경고 카드 대량 추가 | ❌ |
| write / send / upload button | ❌ |
| Google Ads exact 오해 표현 | ❌ |
| typecheck | PASS |

## 4. 운영 검증

| 검증 | 결과 |
|---|---|
| frontend `npm run build` on VM | PASS |
| `pm2 restart seo-frontend` | PASS |
| `https://biocom.ainativeos.net/ads/site-landing` | HTTP 200 |

## 5. 다음 액션

| Owner | Action | Claude Code 가능? | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 추천 |
|---|---|---|---:|---:|---:|---:|---|
| Claude Code | 50 건 도달 후 안내 자동 사라짐 확인 | YES — curl 또는 페이지 hit | 70 | 60 | 50 | 5 | 진행 (시간 조건) |
| TJ님 | UI 확인용 페이지 한 번 방문 | NO — TJ optional | — | — | 낮음 | 5 | optional (분포 baseline 영향 X) |
