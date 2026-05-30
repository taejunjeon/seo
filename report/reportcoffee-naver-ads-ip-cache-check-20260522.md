# reportcoffee Naver Ads IP and cache check 20260522

작성 시각: 2026-05-22 02:10 KST
기준일: 2026-05-20
문서 성격: 더클린커피 Naver Ads API/IP/cache read-only 확인
담당: Codex
관련 문서: [[reportcoffee]], [[reportcoffee-slack-preview-20260522]]

## 10초 요약

Naver Ads API는 VM Cloud에서 조회된다. 따라서 IP 미등록 문제로 보기는 어렵다.

문제는 더클린커피 캐시가 비어 있고, 기존 캐시는 `site=biocom`으로만 쌓여 있다는 점이다. 같은 광고 계정 안에 더클린커피 이름의 캠페인은 보이지만 모두 PAUSED이고, 2026-04-21 - 2026-05-20 기간 spend는 0원이다.

## 확인 결과

### 1. VM Cloud endpoint — thecleancoffee

- endpoint: `/api/ads/naver/campaign-summary?site=thecleancoffee`
- 결과: HTTP 200
- configured: true
- cache status: empty_cache
- rows in window: 0
- window: 2026-04-21 - 2026-05-20

의미:

더클린커피 Naver Ads endpoint와 env는 연결되어 있다. 다만 `naver_ads_daily(site='thecleancoffee')` row가 없어 광고비는 0으로 내려온다.

### 2. VM Cloud endpoint — biocom

- endpoint: `/api/ads/naver/campaign-summary?site=biocom`
- 결과: HTTP 200
- configured: true
- cache status: ready
- rows in window: 1,110
- spend: 7,276,795원
- internal paid Naver revenue: 12,346,493원
- internal real ROAS: 1.7

의미:

현재 VM Cloud Naver Ads cache는 biocom 기준으로는 정상 동작한다.

### 3. VM Cloud Naver API dry-run — thecleancoffee label

- command mode: dry-run
- rows previewed: 1,110
- rows written: 0
- campaigns total: 37
- success: 37
- failed: 0
- all-account spend: 7,276,795원

의미:

API 조회 자체는 성공한다. 단, collector의 `--site=thecleancoffee`는 API 필터가 아니라 저장할 row label이다. 이 상태로 write하면 바이오컴 캠페인까지 더클린커피로 태깅될 수 있다.

## coffee campaign 확인

로컬 cache 기준 `campaign_name LIKE '%커피%'` 결과:

- 더클린커피 이름 캠페인: 6개
- 상태: 전부 PAUSED
- 2026-04-21 - 2026-05-20 spend: 0원

따라서 현재 확인된 범위에서는 더클린커피 Naver spend를 0원으로 보는 것이 가능하다. 하지만 자동 cache write는 campaign allowlist 없이 하면 안 된다.

## 판단

- IP/API 상태: PASS. VM Cloud에서 Naver API dry-run이 성공했다.
- biocom cache: PASS. `site=biocom`은 row와 spend가 있다.
- thecleancoffee cache: EMPTY. row가 없다.
- 더클린커피 캠페인 상태: 기존 coffee-named campaigns는 paused, spend 0.
- 위험: `--site=thecleancoffee --write`를 그대로 실행하면 account 전체 캠페인을 coffee로 저장할 수 있다.

## 다음 안전 조치

1. `naver-ads-collect`에 campaign include filter를 추가한다.
   - 예: `--campaign-name-include=더클린커피,커피`
   - 또는 `--campaign-id-allowlist=...`

2. 더클린커피 Naver spend는 당분간 아래 둘 중 하나로 표시한다.
   - 보수적: `pending — coffee campaign allowlist 필요`
   - 운영 보고용: `0원 — 현재 확인된 coffee 캠페인은 전부 PAUSED, 단 cache는 아직 없음`

3. 실제 `naver_ads_daily(site='thecleancoffee')` write는 allowlist 패치 후 별도 승인으로 진행한다.

## Guardrails

- SQLite write: 0
- Naver Ads state change: 0
- external send: 0
- raw secret logged: false
- raw identifier output: 0
