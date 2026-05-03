# Project TikTok — local delta (50줄, fork 아님)

본 파일은 TikTok 작업에서 정본 외에 기억해야 할 project-local 사실만 적는다.

작성: 2026-05-03 (TJ 결정 후)
정본 가이드라인: `harness/common/HARNESS_GUIDELINES.md`

## 1. 외부 참조

- TikTok Marketing API endpoint: `https://business-api.tiktok.com/open_api/v1.3/`
- 광고 attribution VM: `att.ainativeos.net`

## 2. 본 프로젝트 한정 ID

- TikTok pixel: `xxxxxxxxxx`
- access_token env: `TIKTOK_ACCESS_TOKEN_BIOCOM` (.env line 220~225)
- ttclid 컬럼: `ad_event.ttclid` (VM SQLite)

## 3. attribution window

- click → conversion: 7 day click attribution (TikTok 표준)
- 다른 site 와 다를 수 있음 — 정본의 fallback 표 따름

## 4. 본 sprint 의 source/window/freshness

- source: VM SQLite `att.ainativeos.net:/srv/attribution/data/db.sqlite3`
- window: 2026-04-26 ~ 2026-05-02 KST
- freshness: 1 day lag (VM cron 매일 00:30)
- confidence: 0.9 (VM cron 정상 동작 확인)

## 5. 새 lesson 등록

본 프로젝트 lesson 은 `harness/tiktok/LESSONS.md` 로 (정본 schema 기준).

(끝)
