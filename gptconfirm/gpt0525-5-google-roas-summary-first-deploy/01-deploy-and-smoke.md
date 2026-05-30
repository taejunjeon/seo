# Deploy And Smoke

## 배포 대상

Backend:

- `backend/src/routes/googleAds.ts`
- `backend/src/bootstrap/startBackgroundJobs.ts`

Frontend:

- `frontend/src/app/ads/google/page.tsx`
- `frontend/src/app/ads/google-roas-report/page.tsx`
- `frontend/src/app/ads/tiktok/page.tsx`

## 운영 반영 내용

### Google Ads summary API

`/api/google-ads/dashboard-summary`를 추가했다.

사람 말로 풀면, 화면이 매번 Google Ads 원본 API를 직접 두드리는 대신, 백엔드가 계산해 둔 요약 장부를 먼저 읽는다. 캐시가 없거나 강제 새로고침일 때만 실제 계산을 수행한다.

### Google Ads summary precompute

4시간마다 다음 preset을 미리 계산한다.

- `yesterday`
- `last_7d`
- `last_30d`

운영 로그:

```text
[Google Ads dashboard summary precompute] 활성화 — 240분 주기 (yesterday,last_7d,last_30d)
ok preset=yesterday source=live_force_refresh
ok preset=last_7d source=live_force_refresh
ok preset=last_30d source=live_force_refresh
tick — ok=3 failed=0 next=14400s
```

### TikTok report benchmark cards

TikTok 화면의 참고 카드가 direct live call을 하지 않도록 바꿨다.

- Meta 참고 카드: `/api/ads/roas-summary`
- Google 참고 카드: `/api/google-ads/dashboard-summary`
- TikTok 자체 카드: `/api/ads/tiktok/roas-summary`

## 원격 API smoke

### Google summary

첫 호출:

```text
status=200
elapsed=10.537s
source=google_ads_dashboard_summary
cache.source=live_cache_miss
benchmark present=true
```

두 번째 호출:

```text
status=200
elapsed=0.231s
source=google_ads_dashboard_summary
cache.cached=true
cache.source=in_memory_precompute
benchmark present=true
```

### Meta summary

```text
status=200
elapsed=0.098s
cache.cached=true
cache.source=disk_cache_hit
```

## 원격 페이지 smoke

```text
https://biocom.ainativeos.net/ads/google             200
https://biocom.ainativeos.net/ads/google-roas-report 200
https://biocom.ainativeos.net/ads/tiktok             200
```

## 로컬 검증

```text
backend npm run typecheck PASS
frontend eslint target files PASS
frontend tsc --noEmit PASS
```

Local page smoke:

```text
http://localhost:7010/ads/google             200
http://localhost:7010/ads/google-roas-report 200
http://localhost:7010/ads/tiktok             200
```

## 직접 호출 제거 확인

아래 파일에서 direct live call 문자열이 남지 않음을 확인했다.

- `frontend/src/app/ads/tiktok/page.tsx`
- `frontend/src/app/ads/google/page.tsx`
- `frontend/src/app/ads/google-roas-report/page.tsx`

확인 기준:

- `/api/google-ads/dashboard?` 없음
- `/api/ads/roas?` 없음
- summary endpoint 사용 확인
