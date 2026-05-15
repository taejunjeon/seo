# Backend Guard Deploy Packet

작성 시각: 2026-05-15 03:31 KST

## 목적

VM Cloud backend가 결제 진행 페이지(`/shop_payment/`)를 구매완료로 오해하지 않게 만든다. 이 배포는 Meta 운영 Purchase를 보내는 작업이 아니라, 잘못된 구매 후보를 서버에서 막는 안전장치 배포다.

## 배포 대상

로컬에서 검증된 파일:

- `backend/src/attribution.ts`
- `backend/src/attributionLedgerDb.ts`
- `backend/src/routes/attribution.ts`
- `backend/src/siteLandingFanout.ts`
- `backend/src/metaCapi.ts`

테스트 파일:

- `backend/tests/attribution.test.ts`

## pre-snapshot

실행 전 저장할 항목:

1. VM Cloud health:
   - `https://att.ainativeos.net/api/health`
2. 최근 v4.4.2 aggregate:
   - VM Cloud SQLite `attribution_ledger`
   - window: `logged_at >= 2026-05-14T15:00:00.000Z`
   - fields: total rows, semantic payment_page_seen, semantic payment_success, purchase candidate true, request path distribution
3. 기존 summary/API smoke:
   - `/api/attribution/ledger/naver-evidence-aggregate`
   - `/api/attribution/site-landing/summary?site=biocom&windowHours=24`
4. pm2 status.
5. deployed commit/file checksum.

## backup

VM Cloud에서 deploy 전 백업:

```bash
BACKUP=/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0515-7-meta-funnel-guard-$(date +%Y%m%dT%H%M%SKST)
mkdir -p "$BACKUP/backend/src" "$BACKUP/backend/tests"
cp backend/src/attribution.ts "$BACKUP/backend/src/"
cp backend/src/attributionLedgerDb.ts "$BACKUP/backend/src/"
cp backend/src/routes/attribution.ts "$BACKUP/backend/src/routes.attribution.ts"
cp backend/src/siteLandingFanout.ts "$BACKUP/backend/src/"
cp backend/src/metaCapi.ts "$BACKUP/backend/src/"
cp backend/tests/attribution.test.ts "$BACKUP/backend/tests/" || true
```

## deploy 순서

1. 로컬 파일 5개를 VM Cloud repo에 복사.
2. VM Cloud backend에서 typecheck/build.
3. `seo-backend` restart.
4. health check.
5. post-snapshot.

실행 전제: TJ님 Yellow 승인 필요.

## post-snapshot

확인 항목:

1. `/api/health` 200.
2. `/api/attribution/payment-page-seen` test payload 201.
3. `/api/attribution/payment-success`에 `/shop_payment/` payload를 보냈을 때 202 downgrade.
4. 기존 `checkout_started` payload 201.
5. 기존 `payment_success` completion URL payload는 201 또는 기존 정상 응답.
6. VM Cloud SQLite aggregate:
   - `/shop_payment/` payment_success 신규 0.
   - `payment_page_seen` 직접 집계 가능.
   - purchase candidate true 0 for payment_page_seen.
7. Meta Purchase send 0.
8. 운영DB write/import 0.

## rollback

실패 조건:

- API 5xx.
- 기존 checkout-context/payment-success 정상 payload regression.
- `/shop_payment/`가 여전히 payment_success로 저장됨.
- payment_page_seen이 purchase candidate로 남음.
- raw identifier response leak.
- Meta send 발생.

rollback:

```bash
cp "$BACKUP/backend/src/attribution.ts" backend/src/attribution.ts
cp "$BACKUP/backend/src/attributionLedgerDb.ts" backend/src/attributionLedgerDb.ts
cp "$BACKUP/backend/src/routes.attribution.ts" backend/src/routes/attribution.ts
cp "$BACKUP/backend/src/siteLandingFanout.ts" backend/src/siteLandingFanout.ts
cp "$BACKUP/backend/src/metaCapi.ts" backend/src/metaCapi.ts
npm run typecheck
npm run build
pm2 restart seo-backend
```

rollback 후 다시 health, summary, attribution route를 확인한다.

## 성공 기준

- `payment_page_seen` endpoint가 201.
- `/shop_payment/`가 payment_success로 저장되지 않음.
- completion URL payment_success는 유지.
- Meta 운영 Purchase send 0.
- API 200 유지.
