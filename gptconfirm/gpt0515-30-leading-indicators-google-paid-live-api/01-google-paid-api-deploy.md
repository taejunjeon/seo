# google_paid 운영 API 배포 결과

## 변경한 것

`backend/src/leadingIndicators.ts`에 `google_paid` 채널을 추가했다.

채널 판정은 아래 신호를 본다.

- `gclid`
- `gbraid`
- `wbraid`
- `gad_source`
- `utm_source=google/adwords/googleads` + `utm_medium=cpc/paid/ppc/sem/display`
- metadata 또는 landing/referrer 안의 `google_ads`, `googleads`, `google paid`, `google cpc`

## 배포

VM Cloud backend에 `backend/src/leadingIndicators.ts`만 반영했다.

```text
remote repo: /home/biocomkr_sns/seo/repo
backup: /home/biocomkr_sns/seo/repo/.deploy-backups/leading-indicators-google-paid-20260520132126/leadingIndicators.ts.before
service: seo-backend
restart: pm2 restart seo-backend --update-env
status: online
```

## 검증

로컬:

```text
npm --prefix backend run typecheck: PASS
npm --prefix backend run build: PASS
```

VM Cloud:

```text
npm run build: PASS
pm2 seo-backend: online
```

API smoke:

```text
GET /api/attribution/leading-indicators?site=biocom&window=7d&channel=google_paid&dimension=buyer_vs_leaver
HTTP 200
safe_sessions=119
confirmed_buyer_sessions=7
checkout_non_buyer_sessions=98
pending_payment_success_sessions=14
```

```text
GET /api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=google_paid&dimension=buyer_vs_leaver
HTTP 200
safe_sessions=0
```

## 주의

`/api/health`는 현재 backend에 없는 route라 404가 난다. 이번 배포의 health 판단은 실제 운영 API smoke와 PM2 online 상태로 했다.

`LEADING_INDICATORS_PRECOMPUTE_ENABLED`는 현재 OFF다. 따라서 google_paid API는 live fallback으로 정상 응답하지만, 사전 계산 cache hit는 아직 아니다.

## 롤백

필요하면 VM Cloud에서 백업 파일을 되돌리고 backend build/restart 한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 'sudo bash -lc "
cp /home/biocomkr_sns/seo/repo/.deploy-backups/leading-indicators-google-paid-20260520132126/leadingIndicators.ts.before /home/biocomkr_sns/seo/repo/backend/src/leadingIndicators.ts
chown biocomkr_sns:biocomkr_sns /home/biocomkr_sns/seo/repo/backend/src/leadingIndicators.ts
sudo -u biocomkr_sns bash -lc \"export PATH=/home/biocomkr_sns/seo/node/bin:\$PATH; cd /home/biocomkr_sns/seo/repo/backend && npm run build && pm2 restart seo-backend --update-env\"
"'
```
