# Local Code Patch

## Backend

### `/api/ads/tiktok/roas-summary`

새 요약 전용 endpoint를 추가했다.

- 기본 화면용 endpoint다.
- TikTok 광고 CSV/SQLite 요약과 VM Cloud ledger summary만 읽는다.
- 주문별 원본 비교값은 의도적으로 계산하지 않는다.
- 원본 비교가 필요하면 기존 `/api/ads/tiktok/roas-comparison`을 버튼으로 호출한다.

변경 파일:

- `backend/src/tiktokRoasComparison.ts`
- `backend/src/routes/ads.ts`

## Frontend

TikTok 화면의 기본 fetch를 `/api/ads/tiktok/roas-summary`로 바꿨다.

화면 동작:

1. 기본 진입 시 빠른 요약을 표시한다.
2. 주문별 차이, pending 진단, raw event sample은 숨긴다.
3. `원본 진단 불러오기` 버튼을 누르면 기존 정밀 비교 API를 호출한다.

변경 파일:

- `frontend/src/app/ads/tiktok/page.tsx`

## 검증

- `backend` typecheck PASS.
- `frontend` TikTok page lint PASS.
- 로컬 API smoke PASS.
- 로컬 브라우저 smoke PASS.

## 주의

`backend/src/routes/ads.ts`에는 이번 작업 이전부터 다른 Meta UTM 관련 미커밋 변경이 섞여 있다. 이번 작업으로 봐야 할 범위는 `buildTikTokRoasSummary` import와 `/api/ads/tiktok/roas-summary` route 추가다.

