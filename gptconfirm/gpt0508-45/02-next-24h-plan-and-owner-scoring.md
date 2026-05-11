# 02 24시간 대기 동안 할 일 분석 + Owner 점수표 (gpt0508-45)

작성 시각: 2026-05-11 18:30:00 KST
대기 endpoint: 2026-05-12 18 KST (24h 후) snapshot 재실행

## 1. 24시간 동안 Claude Code 가 미리 할 수 있는 것

24h 후 snapshot 만 기다리는 게 아니라, 그 사이 가치 있게 진행 가능한 8 후보를 점수 기반으로 정리. **상위 3 후보는 자동 진행 추천**, 그 외는 보류.

| # | Action | Claude Code 가능? | 데이터 충분 | 타이밍 | 영향도 | 위험도 (↓) | 종합 | 추천 |
|---|---|---|---:|---:|---:|---:|---:|---|
| 1 | site_landing ↔ 운영DB tb_iamweb_users 매출 join 시도 (L2 ladder) | YES — read-only 운영DB query + 로컬DB read | 85 | 90 | 95 | 15 | **88** | **진행** |
| 2 | frontend 페이지에 site=biocom/thecleancoffee 토글 추가 (60 LOC 안) | YES — frontend 코드 + deploy 직접 가능 | 90 | 90 | 75 | 10 | **84** | **진행** |
| 3 | utm_source/medium null 또는 utm_campaign=source=medium 동일 row audit (fan-out 파싱 버그 의심) | YES — read-only audit | 80 | 85 | 80 | 10 | **80** | **진행** |
| 4 | 더클린커피 paid_social 12 건 + organic 3 건 의 매출 join 가능성 별도 보고 | YES | 75 | 75 | 70 | 15 | 70 | 조건부 (1번 후속) |
| 5 | site_landing summary API 에 site 별 매출 join 결과 derived 필드 추가 | YES — backend code | 70 | 60 | 75 | 25 | 65 | 보류 (1번 결과 보고) |
| 6 | snapshot cron 등록 approval packet | YES (packet 까지) | 70 | 60 | 60 | 15 | 62 | 보류 (24h verdict 후) |
| 7 | thecleancoffee.imweb.me 정확한 도메인 확인 + SELF_DOMAINS 업데이트 | PARTIAL — DNS lookup 가능, 운영 imweb 페이지 확인 필요 | 50 | 50 | 40 | 10 | 45 | 보류 (필요 시) |
| 8 | Google Ads click_view 30d snapshot prep table fetch 시도 | NO — TJ credentials | 30 | 30 | 70 | 30 | 40 | TJ 대기 |

## 2. 자동 진행 3 후보 — 자세히

### #1 site_landing ↔ 운영DB 매출 join
- **목적**: L2 attribution ladder 의 핵심 — 광고 유입 → 결제 매출 연결.
- **방법**: site_landing 의 sessionKey (`ga_session_id`, `client_id`) 또는 fan-out 의 `order_no_hash` (payment_success entry 의 metadata 안) 로 운영DB `tb_iamweb_users` 조회. read-only.
- **가설**: paid_search 68 row + paid_social 13 row 중 일부가 실제 결제로 이어졌을 가능성. join_rate 측정 가능.
- **산출**: `data/site-landing-revenue-join-attempt-20260512-{site}.json`

### #2 frontend site 토글
- **목적**: 한 페이지에서 biocom / thecleancoffee 분포 둘 다 볼 수 있음.
- **방법**: 기존 73 LOC 페이지에 site 토글 버튼 1 개 + state 1 개 추가 (예상 +5 LOC).
- **deploy**: frontend npm run build + pm2 restart 직접 가능.

### #3 fan-out 파싱 audit
- **목적**: utm_campaign_top10 에서 `source = medium = campaign` 동일 값 row 가 일부 — fan-out 의 AttributionLedgerEntry 파싱 단계에서 utm_* 가 같은 값으로 채워지는 버그 의심.
- **방법**: read-only — 운영 SQLite 의 row 들을 source/medium/campaign 별로 group by 해서 패턴 발견. 코드 audit + 수정안 작성. 실제 수정은 다음 sprint.
- **산출**: `gdn/site-landing-fanout-utm-parse-audit-20260512.md`

## 3. 그 외 후보 — 보류 사유

- #4: #1 의 결과가 의미 있을 때 별도 보고 (조건부).
- #5: backend code 변경 + deploy 가 필요. 본 sprint 정정 deploy 직후라 안정화 우선.
- #6: 24h verdict 정정 후 cron 등록 패턴이 명확해질 때 packet.
- #7: thecleancoffee.imweb.me 도메인이 실제로 안 쓰이면 fix 가치 낮음.
- #8: TJ 의 Google Ads credentials 필요. 1차 목표 안정화 후 별도 sprint.

## 4. 24h 후 (2026-05-12 18 KST 안팎) Claude Code 가 자동 진행할 것

1. snapshot script `--site=biocom` + `--site=thecleancoffee` 둘 다 실행.
2. 양 site verdict 정정 (PROVISIONAL → 확정).
3. 결과 비교 — 24h 분포가 본 sprint 시점 분포와 어떻게 달라졌는지.
4. 50+ 표본 도달 site 의 paid_search 채널 보고.

## 5. TJ 님 액션 (대기 / optional)

| Action | 사유 | Claude Code 못 하는 부분 |
|---|---|---|
| GTM Container Preview | 본 정정 후 GTM_PARKED 확정 — **대기 필요 없음**, packet archive 가능 | (해당 없음) |
| Google Ads click_view CSV / API credentials | 1차 목표 안정화 후 2차 | OAuth2 credentials 발급 |
| site UI 한 번 확인 | optional | 본인 브라우저 시각 확인 |

본 정정 결과 GTM_PARKED 가 확정됐으므로 TJ 의 GTM Container 액션은 **현재 시점 trigger 없음**. archive 가능.

## 6. 다음 액션 (24h 안)

| Owner | Action | Claude Code 가능? | 종합 추천 | 추천 |
|---|---|---|---:|---|
| Claude Code | #1 매출 join 시도 | YES | 88 | 진행 |
| Claude Code | #2 frontend site 토글 | YES | 84 | 진행 |
| Claude Code | #3 utm 파싱 audit | YES | 80 | 진행 |
| Claude Code | 24h 시점 snapshot 재실행 + verdict 정정 | YES | 86 | 진행 (시간 조건) |
