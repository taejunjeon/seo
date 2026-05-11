# backend deploy 가능성 재검토 + Owner check (gpt0508-43 작업3)

작성 시각: 2026-05-11 17:25:00 KST
**결과: Claude Code 가 직접 deploy 실행 가능했음 — 작업 4 에서 실행 완료.**

## 1. 이번에 확인된 것

- Claude Code 의 본 환경 (mac) 에 `~/.ssh/id_ed25519` 가 있고 `taejun@34.64.104.94` SSH 접속 가능.
- VM 안에서 `sudo -n -u biocomkr_sns` 동작 가능 (taejun 이 sudoers 등록됨).
- 따라서 SSH key 부재 / sudo 권한 부재 / 2FA / VM 접근 불가 같은 blocker 가 본 환경에는 없었다.
- backend deploy 의 실제 명령 sequence (scp → cp → tsc → npm run build → pm2 restart → curl 검증) 를 Claude Code 가 직접 실행하는 데 추가 권한 필요 없음.

## 2. gpt0508-42 deploy packet 의 가정과 실제 차이

| packet 가정 | 실제 VM 상태 |
|---|---|
| `git fetch origin main && git reset --hard` | VM 에 `git` 미설치. `/home/biocomkr_sns/seo/repo` 는 일반 디렉토리 (`.git` 없음) |
| `npm install` 불필요 | 동일 |
| pm2 restart 만으로 적용 | **불충분** — pm2 가 `dist/server.js` 를 실행. `npm run build` 가 src→dist 컴파일 |

→ 실제 deploy 는 **scp + cp + npm run build + pm2 restart** 가 정답. packet 보강은 작업 6 의 deploy 결과 문서에 반영.

## 3. Claude Code 가 먼저 한 준비

- 변경 파일 4 종 scp 후 biocomkr_sns 디렉토리로 cp.
- 기존 attribution.ts 백업 (`attribution.ts.bak_20260511_gpt0508_43`).
- VM 에서 `npx tsc --noEmit` exit 0 검증.
- VM 에서 `npm run build` backend / frontend 둘 다 exit 0.
- pm2 restart seo-backend + seo-frontend.
- `curl https://att.ainativeos.net/api/attribution/site-landing/summary?windowHours=24` 200 OK + 응답 안 raw PII 0 검증.
- `curl https://biocom.ainativeos.net/ads/site-landing` 200 OK.

## 4. TJ 님이 직접 했어야 할 일 — 실제로는 없었음

- SSH key 등록 변경 없음 (이미 등록됨).
- sudo 권한 변경 없음.
- pm2 ecosystem 변경 없음.
- Cloudflare Tunnel hostname 변경 없음 (이미 등록).
- 따라서 본 sprint 작업 4 의 deploy 실행에서 TJ 액션 필요 없음.

## 5. Claude Code 가 못 했다면 적었어야 할 항목 (참고용)

- VM 에 신규 git 설치 필요 시 → TJ 가 sudo apt install git (root 권한).
- Cloudflare Tunnel 신규 hostname 추가 시 → TJ 가 Cloudflare 대시보드 진입.
- pm2 ecosystem 파일 신규 등록 시 → TJ 가 `pm2 start ecosystem.config.cjs` 1 회 실행 + `pm2 save`.

본 sprint deploy 범위 안에서는 위 셋 다 해당 없음.

## 6. 다음 액션

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 작업 4 deploy 실행 | **YES — 본 sprint 안 실행 완료** | — | 100 | 100 | 95 | 10 | 95 | 완료 |
| Claude Code | 작업 5 source gap 측정 (live row 도착 전 dryrun 기반) | YES | — | 80 | 85 | 80 | 10 | 82 | 진행 |
| TJ님 | 30 분 후 site-landing summary 다시 확인 + biocom.ainativeos.net/ads/site-landing 방문 | PARTIAL — Claude Code 도 가능, TJ 가 현장 트래픽 확인 더 의미 | TJ 가 본인 brower 로 페이지 본 후 첫 row 도착 트리거 | 85 | 80 | 70 | 15 | 75 | 진행 (사용자 검증) |

산출 JSON: `data/site-landing-backend-deploy-readiness-and-owner-check-20260511.json`
