# frontend site_landing minimal view (gpt0508-42 작업4)

작성 시각: 2026-05-11 16:00:00 KST
경로: `/ads/site-landing`
LOC: **68 / 80 권장 한도 안**

## 1. 사람이 이해하는 작업 설명

- **무엇을 했는가**: 새 frontend 페이지 `/ads/site-landing` 추가. 작업 3 의 `/api/attribution/site-landing/summary` 를 호출해 총 row / 채널 분포 / source top10 / sessionKey joinable / TTL 만료 / raw mode count / external_send_count=0 / upload_candidate_count=0 만 read-only 로 표시. 윈도우 24/72/168 시간 토글 1 개.
- **왜 했는가**: 작업 3 summary API 가 어떤 데이터를 반환하는지 사람이 빠르게 확인할 단순 화면 필요. campaign_id exact 같은 2차 목표를 강조하지 않고 "campaign_id exact 는 2차 목표" 한 줄만 안내.
- **어떻게 했는가**: 새 파일 1 개 (68 LOC). useState + fetch 만으로 구현, 외부 라이브러리 추가 0, 기존 페이지 수정 0. write/send/upload 버튼 없음.
- **결과가 무엇인가**: typecheck PASS. 80 LOC 권장 한도 안. 본 페이지만으로 site_landing 상태 한 눈에 파악 가능.
- **목표에 어떤 영향을 줬는가**: Track D Dashboard Decision View 85% → 87% (UI 까지 검증 완료). Track G 80% → 82%.
- **남은 병목은 무엇인가**: production 에서 의미 있는 분포를 보려면 작업 6 deploy 가 진행되어야 함. frontend `npm run build` 는 본 sprint 에서 시도하지 않음 (production 7010 supervisor 가 deploy 시점에 build) — 본 sprint 의 검증은 typecheck 까지.

## 2. 표시 항목 (write/send/upload 0)

| 카드 | 표시 |
|---|---|
| 총 row 카드 | total / source_evidence_present_rate / joinable sessionKey / TTL 24h 만료 / raw click mode |
| 채널 분포 카드 | paid / organic / direct / referral / unknown |
| source breakdown top10 | top10 host or utm_source |
| invariants 한 줄 | external_send_count / upload_candidate_count (둘 다 0) |

write / send / upload / publish 버튼 0. 경고 카드 0. Google Ads exact 로 오해되는 표현 0. "campaign_id exact 는 2차 목표" 한 줄로 명시.

## 3. 검증

| 검증 | 결과 |
|---|---|
| frontend typecheck | PASS (exit 0) |
| LOC 한도 | 68 (80 권장 안) |
| 기존 페이지 수정 | 0 |
| 새 외부 dependency | 0 |
| write/send/upload button | 0 |

## 4. 다음 액션

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 본 페이지를 `next build` 결과에 포함되도록 deploy packet 에 명시 | YES — build 명령 packet 에 반영 | — | 90 | 90 | 80 | 10 | 88 | 진행 |
| TJ님 | production 7010 supervisor 가 build 자동 재시작 확인 | PARTIAL — Claude Code 가 build 명령은 작성하지만 supervisor 재시작 확인은 TJ 환경 필요 | supervisor 로그 / `pm2 list` 가 TJ 환경에만 있음 | 80 | 70 | 80 | 25 | 70 | 조건부 진행 (작업 6 deploy 시점) |
