
# Google Ads dashboard route local fix approval packet - 2026-05-10

작성 시각: 2026-05-10 19:34:00 KST
Lane: Green approval packet only

## 한 줄 결론
VM Cloud dashboard `last_30d` 502를 줄이려면 dashboard route가 VM 내부 SQLite 원장을 우선 읽도록 제한 배포하는 것을 추천한다.

## 변경 파일
- backend/src/env.ts
- backend/src/routes/googleAds.ts

## 변경 내용
- 새 env: `GOOGLE_ADS_DASHBOARD_LEDGER_MODE`
- 허용값: `remote_first`, `local_first`, `local_only`
- 기본값: `remote_first`
- 추천 VM 값: `local_first`

## 왜 필요한가
현재 VM `/status`는 200이고 `last_7d` dashboard도 200이지만 `last_30d`는 약 40초 프록시 timeout 근처에서 502가 난다. 로컬 `local_first` smoke는 last_7d/last_30d 모두 약 1.2초 200이다.

## 배포 승인 범위
- VM backend limited deploy.
- env 1개 추가: `GOOGLE_ADS_DASHBOARD_LEDGER_MODE=local_first`.
- PM2 restart 1회.
- read-only smoke만 수행.

## rollback
- env를 제거하거나 `GOOGLE_ADS_DASHBOARD_LEDGER_MODE=remote_first`로 되돌린다.
- PM2 restart 1회.
- `/api/google-ads/status` 200 확인.

## smoke
1. `/api/google-ads/status` 200.
2. `/api/google-ads/dashboard?date_preset=last_7d` 200.
3. `/api/google-ads/dashboard?date_preset=last_30d` 200.
4. response에 `send_candidate=true` 없음.
5. platform send 0.
6. raw PII/order/payment 로그 증가 0.

## 아직 하지 않는다
- VM backend deploy/restart.
- Google Ads upload.
- conversion action 변경.
- frontend 구현 착수.
