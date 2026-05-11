# site_landing fan-out backend deploy approval packet (gpt0508-42 작업6)

작성 시각: 2026-05-11 16:20:00 KST
Lane: Yellow (deploy)
**TJ 명시 승인 필요. Claude Code 본 sprint 안에 deploy 실행하지 않음.**

## 1. 사람이 이해하는 작업 설명

- **무엇을 했는가**: 작업 1~4 의 backend handler fan-out wire + summary API + frontend minimal view 가 production VM 에 반영되도록 deploy 명령 sequence / pre/post snapshot / 30분 smoke / rollback / failure condition / expected row delta / raw send/upload 0 검증 / Claude Code 가능 여부 / TJ 필요 화면 까지 packet 화.
- **왜 했는가**: helper + endpoint + fixture 가 모두 PASS 한 후 production 에서 실제 분포를 측정하지 않으면 site_landing 의 효과를 검증할 수 없음. backend deploy 가 다음 sprint 의 측정 baseline.
- **어떻게 했는가**: VM 운영 정본 `vm/!vm.md` 의 ssh + pm2 명령 구조 그대로 사용. backend 는 git pull → pm2 restart, frontend 는 (필요 시) npm run build. 의존성 변경 0 — npm install 불필요.
- **결과가 무엇인가**: 본 sprint 안에서는 packet 만 완성. 실 deploy 는 TJ 가 Mac terminal 에서 ssh 명령 실행하거나, Claude Code 가 1 회용 key forwarding 받으면 가능.
- **목표에 어떤 영향을 줬는가**: Track G 84% → 86% (deploy 경로 명확). Track F 95% → 95% 유지.
- **남은 병목은 무엇인가**: TJ SSH 키 사용 권한 + sudo biocomkr_sns 권한. Claude Code 가 직접 ssh 명령 실행은 본 환경의 보안 검토 후에만 가능.

## 2. deploy 대상 파일

| 파일 | 변경 |
|---|---|
| backend/src/siteLandingLedger.ts | 작업 2 신규 + 작업 3 derived 필드 추가 |
| backend/src/siteLandingChannelClassifier.ts | 작업 5 신규 (이전 sprint) |
| backend/src/siteLandingFanout.ts | 작업 1 신규 |
| backend/src/routes/attribution.ts | 작업 1 fan-out 4 곳 + 작업 3 summary endpoint + 작업 5 의 site-landing receiver |
| frontend/src/app/ads/site-landing/page.tsx | 작업 4 신규 |

## 3. pre-snapshot

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "cd /home/biocomkr_sns/seo/repo && git rev-parse HEAD"'

curl -s 'https://att.ainativeos.net/api/attribution/site-landing/summary?windowHours=24' > /tmp/pre-summary.json
# 404 예상 (endpoint 미배포)
```

## 4. deploy sequence

```bash
# 1. git pull
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "cd /home/biocomkr_sns/seo/repo && git fetch origin main && git reset --hard origin/main"'

# 2. dependency 변경 0 → npm install skip

# 3. backend pm2 restart
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; cd /home/biocomkr_sns/seo/repo/backend && pm2 restart seo-backend --update-env && pm2 save"'

# 4. frontend build (supervisor 자동 재시작 안 하면)
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; cd /home/biocomkr_sns/seo/repo/frontend && npm run build"'
```

## 5. post-snapshot

```bash
curl -sS 'https://att.ainativeos.net/api/attribution/site-landing/summary?windowHours=24' > /tmp/post-summary.json
# 200 OK / ok:true 예상
diff -u /tmp/pre-summary.json /tmp/post-summary.json

# pm2 상태
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "cd /home/biocomkr_sns/seo/repo/backend && pm2 describe seo-backend --no-color | sed -n 1,35p"'

# DB 확인
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "sqlite3 /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 \"SELECT count(*), max(landed_at) FROM site_landing_ledger;\""'
```

## 6. 30분 smoke

- 30분 후 summary curl 재실행
- `total > 0` 확인 (실 트래픽이 marketing-intent / checkout / payment-success / paid-click-intent 한 번이라도 호출했다면)
- `raw_click_mode_count == 0` 확인 (hash only 정책)
- `external_send_count == 0`, `upload_candidate_count == 0` 확인

## 7. rollback

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "cd /home/biocomkr_sns/seo/repo && git reset --hard <PRE_SNAPSHOT_HEAD> && cd backend && pm2 restart seo-backend --update-env && pm2 save"'
```

## 8. failure conditions

- summary curl 가 500 또는 timeout
- `pm2 describe` 가 errored / stopped
- site_landing_ledger SELECT 실패
- smoke 30분 후 row delta 0 인데 fan-out 호출 로그 있음 → 정합성 오류 → rollback

## 9. expected row delta (24h)

low 50 / high 500 — biocom payment-success + checkout + paid-click-intent 빈도 추정.

## 10. raw / send / upload 0 검증

- post-summary 의 `derived.external_send_count == 0`
- post-summary 의 `derived.upload_candidate_count == 0`
- pm2 log seo-backend 에서 `external send` / `platform send` 로그 0건

## 11. Claude Code 가능 여부

| 항목 | Claude Code 가능? | 설명 |
|---|---|---|
| deploy 명령 sequence 작성 | YES | 본 packet |
| rollback 명령 작성 | YES | 본 packet |
| post-snapshot summary curl 명령 작성 | YES | 본 packet |
| expected row delta 추정 | YES | 본 packet §9 |
| raw send/upload 0 검증 명령 작성 | YES | 본 packet §10 |
| VM SSH 접속 + pm2 restart 실행 | NO | TJ Mac 의 `~/.ssh/id_ed25519` 키가 Claude Code 환경에서 자동 사용 불가 |
| sudo biocomkr_sns 실행 | NO | 권한이 TJ 환경에만 등록 |
| 실시간 production pm2 log 추적 | NO | VM 안 pm2 로그가 TJ ssh session 안에서만 가능 |
| 1 회용 key forwarding 후 deploy 실행 (대체 경로) | PARTIAL | TJ 가 ssh agent 또는 1 회용 key forwarding 활성화하면 Claude Code 가 명령 실행 가능. 보안 검토 필요 |

## 12. 다음 액션

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| TJ님 | ssh 명령 본 packet 그대로 실행 + 30분 smoke 확인 | NO — 인증키 + sudo 권한 | Claude Code 환경에 SSH 키 없음. 1 회용 forwarding 보안 검토 필요 | 90 | 90 | 95 | 30 | 80 | 진행 (본 packet 그대로) |
| Claude Code | TJ deploy 완료 후 production 의 summary curl 결과 분석 | YES — curl 결과 받으면 분석 | — | 85 | 90 | 80 | 10 | 88 | 진행 (TJ deploy 후) |
| Claude Code | rollback 명령 + 검증 명령 packet 안에서 추가 정밀화 | YES | — | 70 | 70 | 60 | 15 | 65 | 보류 (현재 packet 충분) |

산출 JSON: `data/site-landing-fanout-backend-deploy-approval-20260511.json`
