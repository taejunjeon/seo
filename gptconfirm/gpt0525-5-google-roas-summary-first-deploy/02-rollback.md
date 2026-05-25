# Rollback

## 백업 위치

VM Cloud backup:

```text
/home/biocomkr_sns/seo/repo/_deploy-backup-google-roas-summary-first-20260525T094049Z
```

## 되돌릴 파일

- `backend/src/routes/googleAds.ts`
- `backend/src/bootstrap/startBackgroundJobs.ts`
- `frontend/src/app/ads/google/page.tsx`
- `frontend/src/app/ads/google-roas-report/page.tsx`
- `frontend/src/app/ads/tiktok/page.tsx`

## Rollback 명령

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 'sudo bash -lc "
set -euo pipefail
REPO=/home/biocomkr_sns/seo/repo
BACKUP=\$REPO/_deploy-backup-google-roas-summary-first-20260525T094049Z

cp \$BACKUP/backend/src/routes/googleAds.ts.before \$REPO/backend/src/routes/googleAds.ts
cp \$BACKUP/backend/src/bootstrap/startBackgroundJobs.ts.before \$REPO/backend/src/bootstrap/startBackgroundJobs.ts
cp \$BACKUP/frontend/src/app/ads/google/page.tsx.before \$REPO/frontend/src/app/ads/google/page.tsx
cp \$BACKUP/frontend/src/app/ads/google-roas-report/page.tsx.before \$REPO/frontend/src/app/ads/google-roas-report/page.tsx
cp \$BACKUP/frontend/src/app/ads/tiktok/page.tsx.before \$REPO/frontend/src/app/ads/tiktok/page.tsx

chown -R biocomkr_sns:biocomkr_sns \$REPO/backend/src \$REPO/frontend/src/app/ads

sudo -n -u biocomkr_sns bash -lc \"export PATH=/home/biocomkr_sns/seo/node/bin:\\\$PATH; cd /home/biocomkr_sns/seo/repo/backend && npm run build && cd /home/biocomkr_sns/seo/repo/frontend && npm run build && pm2 restart seo-backend --update-env && pm2 restart seo-frontend --update-env && pm2 save\"
"'
```

## Rollback 성공 기준

- `/ads/google` 200
- `/ads/google-roas-report` 200
- `/ads/tiktok` 200
- `seo-backend` online
- `seo-frontend` online

## Rollback이 필요한 조건

- Google Ads summary endpoint가 5xx를 반복한다.
- TikTok 화면이 Meta/Google 참고 카드 때문에 다시 장시간 로딩된다.
- pm2 restart 이후 frontend/backend build가 실패한다.
- Google Ads API rate limit 또는 backend CPU/memory 문제가 재발한다.
