# 01 구현 + 검증 (gpt0508-43)

작성 시각: 2026-05-11 17:50:00 KST
범위: 작업 1 (gpt0508-42 readable rewrite) + 작업 3 (deploy readiness 검토) + 작업 4 (deploy 실제 실행) 통합

## 1. 이번 sprint 가 실제로 한 일

| # | 작업 | 결과 |
|---|---|---|
| 1 | gpt0508-42 결과를 사람 말 5 필드로 다시 적음 | `gdn/gpt0508-42-readable-report-rewrite-20260511.md` |
| 3 | deploy 가능성 검토 — Claude Code 가 직접 SSH 가능 확인 | `gdn/site-landing-backend-deploy-readiness-and-owner-check-20260511.md` |
| 4 | backend + frontend 실 deploy 실행 | `gdn/site-landing-deploy-b-result-or-approval-20260511.md` |

## 2. deploy 실제 명령 sequence (요청 충족)

```bash
# 1. backend 변경 파일 scp
scp -i ~/.ssh/id_ed25519 \
  backend/src/{siteLandingLedger,siteLandingChannelClassifier,siteLandingFanout}.ts \
  backend/src/routes/attribution.ts \
  taejun@34.64.104.94:/tmp/seo-deploy-43/

# 2. VM cp + 백업
ssh -i ~/.ssh/id_ed25519 taejun@34.64.104.94 'chmod 755 /tmp/seo-deploy-43; \
  sudo -n -u biocomkr_sns bash -lc "
    cp /home/biocomkr_sns/seo/repo/backend/src/routes/attribution.ts \
       /home/biocomkr_sns/seo/repo/backend/src/routes/attribution.ts.bak_20260511_gpt0508_43
    cp /tmp/seo-deploy-43/{siteLandingLedger,siteLandingChannelClassifier,siteLandingFanout}.ts \
       /home/biocomkr_sns/seo/repo/backend/src/
    cp /tmp/seo-deploy-43/attribution.ts \
       /home/biocomkr_sns/seo/repo/backend/src/routes/attribution.ts
  "'

# 3. backend build + restart
ssh -i ~/.ssh/id_ed25519 taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc "export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH; \
    cd /home/biocomkr_sns/seo/repo/backend && \
    npx tsc --noEmit && npm run build && pm2 restart seo-backend --update-env && pm2 save"'

# 4. frontend 페이지 + build + restart
scp -i ~/.ssh/id_ed25519 frontend/src/app/ads/site-landing/page.tsx \
  taejun@34.64.104.94:/tmp/seo-deploy-43/frontend-site-landing-page.tsx
ssh -i ~/.ssh/id_ed25519 taejun@34.64.104.94 'sudo -n -u biocomkr_sns bash -lc "
  mkdir -p /home/biocomkr_sns/seo/repo/frontend/src/app/ads/site-landing
  cp /tmp/seo-deploy-43/frontend-site-landing-page.tsx \
     /home/biocomkr_sns/seo/repo/frontend/src/app/ads/site-landing/page.tsx
  export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH
  cd /home/biocomkr_sns/seo/repo/frontend && npm run build && pm2 restart seo-frontend --update-env && pm2 save
"'
```

## 3. 검증 결과

| 검증 | 결과 |
|---|---|
| backend npx tsc --noEmit on VM | exit 0 |
| backend npm run build on VM | exit 0 |
| frontend npm run build on VM | exit 0 |
| pm2 list 상태 | seo-backend / seo-frontend / seo-cloudflared 모두 online |
| `GET https://att.ainativeos.net/api/attribution/site-landing/summary?windowHours=24` | HTTP 200, `ok:true`, `total:0`, `mode=read_only_no_send` |
| `GET https://biocom.ainativeos.net/ads/site-landing` | HTTP 200 |
| `GET https://coffeevip.ainativeos.net/ads/site-landing` | HTTP 200 |
| 응답 raw email/phone/jumin/카드 정규식 | 0 hit |
| `site_landing_ledger` 테이블 존재 | 아직 X (첫 fan-out 호출 시 자동 생성) |
| pre-deploy backup | `attribution.ts.bak_20260511_gpt0508_43` 보관 |

## 4. 금지선 준수 (상세표는 본 문서에만)

| invariant | 결과 |
|---|---|
| send_candidate / actual_send_candidate / upload_candidate | false / false / 0 |
| GA4 / Meta / TikTok / Naver 운영 전송 | 0 |
| Google Ads confirmed_purchase upload | 0 |
| Google Ads conversion action 변경 | 0 |
| GTM Production publish | 0 |
| imweb footer / header 직접 수정 | 0 |
| 운영DB write | 0 |
| raw email/phone/order_no/payment/member_code 저장 또는 logging | 0 (응답 regex scan 통과) |
| raw click_id storage_mode | hash only (production 적용) |
| NPay click → actual purchase 승격 | 0 |
| time-window-only 단독 캠페인 budget 판단 | 0 |
| ORDER_BRIDGE_RAW_BODY_LOGGING / PLATFORM_SEND_ENABLED | false / false |
| Telegram 발송 | 0 (TJ standing skip — 00 §8 한 문단으로 통합) |

## 5. rollback (실제로는 필요 없었음)

```bash
ssh -i ~/.ssh/id_ed25519 taejun@34.64.104.94 'sudo -n -u biocomkr_sns bash -lc "
  cp /home/biocomkr_sns/seo/repo/backend/src/routes/attribution.ts.bak_20260511_gpt0508_43 \
     /home/biocomkr_sns/seo/repo/backend/src/routes/attribution.ts
  rm /home/biocomkr_sns/seo/repo/backend/src/siteLanding*.ts
  export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH
  cd /home/biocomkr_sns/seo/repo/backend && npm run build && pm2 restart seo-backend --update-env && pm2 save
"'
```
