
# Google Ads dashboard route 502 diagnosis - 2026-05-10

작성 시각: 2026-05-10 19:34:00 KST
Lane: Green read-only VM curl / local code patch / no deploy

## 결론
VM Cloud Google Ads 인증은 정상이다. `/api/google-ads/status`는 200이고 `last_7d` dashboard도 200으로 회복됐지만, `last_30d` dashboard는 약 39.5초 후 502로 끊긴다. 원인은 토큰 전체 실패가 아니라 dashboard route가 프록시 timeout 경계까지 느려지는 문제로 보는 것이 맞다.

## 관측값
| 경로 | 결과 | 시간 | 해석 |
|---|---:|---:|---|
| VM `/api/google-ads/status` | 200 | 1.17s | Google Ads API 인증과 customer access 정상 |
| VM `/api/google-ads/dashboard?date_preset=last_7d` | 200 | 26.23s | 느리지만 응답 가능 |
| VM `/api/google-ads/dashboard?date_preset=last_30d` | 502 | 39.47s | proxy timeout 경계에서 실패 |
| 로컬 `local_first` last_7d | 200 | 1.19s | local SQLite 우선 조회 시 빠름 |
| 로컬 `local_first` last_30d | 200 | 1.20s | local SQLite 우선 조회 시 timeout 해소 |

## 원인 분리
- 인증 실패 아님: status endpoint가 200이고 customer `2149990943` 조회가 된다.
- Google Ads API 전체 실패 아님: 같은 route가 로컬에서 200으로 응답한다.
- 가장 가능성 높은 원인: dashboard route가 VM에서 공개 HTTPS attribution ledger endpoint를 다시 호출하면서 30일 window에서 느려지고, 프록시 timeout에 걸린다.
- confidence: 90%.

## 로컬 코드 패치
- `backend/src/env.ts`: `GOOGLE_ADS_DASHBOARD_LEDGER_MODE` 추가.
- `backend/src/routes/googleAds.ts`: `remote_first` 기본값 유지, `local_first`/`local_only`일 때 같은 프로세스의 SQLite ledger를 먼저 읽도록 분기.
- 기존 동작은 기본 `remote_first`라서 배포 전 현재 경로는 바뀌지 않는다.

## 승인 패킷
추천 VM 설정은 `GOOGLE_ADS_DASHBOARD_LEDGER_MODE=local_first`다.

승인이 필요한 실행:
1. VM backend 코드 반영.
2. VM env에 `GOOGLE_ADS_DASHBOARD_LEDGER_MODE=local_first` 추가.
3. PM2 restart 1회.
4. smoke: status 200, dashboard last_7d 200, dashboard last_30d 200, platform send 0.

## 금지선
- VM deploy/restart는 이번 batch에서 하지 않았다.
- Google Ads upload/conversion action 변경 없음.
- platform send 0.
- raw email/phone/member_code/order/payment 저장/logging 0.
