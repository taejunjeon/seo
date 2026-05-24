# Meta UTM 비Meta 오분류 제외 VM Cloud 배포 결과

작성 시각: 2026-05-24 12:28 KST
기준일: 2026-05-24
문서 성격: Yellow deploy result

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - vm/!vm.md
    - capivm/vmdeploy.md
  lane: Yellow deploy approved by TJ님 in chat
  allowed_actions:
    - VM Cloud target file backup
    - deploy scoped backend/frontend Meta UTM files
    - deploy UTM B-grade proposal dictionary files
    - remote typecheck/build
    - pm2 restart seo-backend and seo-frontend
    - public read-only smoke
  forbidden_actions:
    - Meta CAPI manual send/backfill
    - GA4 Measurement Protocol send
    - Google Ads/TikTok/Naver/Meta account mutation
    - GTM submit/create_version/publish
    - Imweb header/footer save
    - operating DB write/import
    - VM Cloud SQLite schema/data write
  source_window_freshness_confidence:
    source: VM Cloud backend + Meta Ads Insights API + VM Cloud attribution ledger + local UTM proposal files
    window: Meta UTM diagnostics last_7d, 2026-05-17 ~ 2026-05-23 KST
    freshness: 2026-05-24 12:27 KST live_cache_miss post-check
    confidence: high for deployment and API smoke, medium-high for remaining REVIEW bucket interpretation
```

## 10초 요약

승인된 "비Meta 오분류 YES만 제외" 원칙을 VM Cloud 외부 보고서에 반영했다.
이제 `att.ainativeos.net` API와 `biocom.ainativeos.net` 프론트 보고서에서 Meta 미맵핑은 기존 18건/5,764,500원 기준을 보여주면서, 승인 제외 2건/483,300원을 뺀 16건/5,281,200원을 현재 집계값으로 쓴다.
B급 제안 사전 192개는 자동 확정이 아니라 후보 사전으로만 노출한다.

## 배포 범위

- Backend: `backend/src/routes/ads.ts`
- Frontend: `frontend/src/app/ads/meta-utm/page.tsx`
- UTM files:
  - `utm/biocom-meta-bgrade-alias-proposal-dictionary-20260523.csv`
  - `utm/biocom-meta-bgrade-alias-proposal-summary-20260523.json`
  - `utm/meta-utm-nonmeta-exclusion-dry-run-20260523.csv`
  - `utm/meta-utm-nonmeta-exclusion-dry-run-summary-20260523.json`

전체 repo rsync는 하지 않았다.
로컬 작업트리에 다른 변경이 많아서, 이번 승인 범위 파일만 VM Cloud에 파일 단위로 반영했다.

## 백업

VM Cloud backup path:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/meta-utm-approved-exclusion-20260524-122131
```

핵심 파일 sha256:

```text
before backend/src/routes/ads.ts: 8a8ff2fa915493b93b84d2140faf520fde5dbf3db21dc5b84d25b2ef77f1b2c2
after  backend/src/routes/ads.ts: a9719bf84c26534e723cc3e77c8d65df31ddb3de4677bbcc8503868722381343

before frontend/src/app/ads/meta-utm/page.tsx: 4af4d69d55f1aa0414c70fd5c89d2d0afdabda234247fb62796de2179c5e68d6
after  frontend/src/app/ads/meta-utm/page.tsx: 31d8a60a841c45939cd4c2248ca8d4c6808ba7eaf399e293b3d871427342ddb9
```

## 검증 결과

- VM Cloud backend typecheck: PASS
- VM Cloud backend build: PASS
- VM Cloud frontend build: PASS
- `pm2 restart seo-backend --update-env`: PASS, restart count 4317 -> 4318
- `pm2 restart seo-frontend --update-env`: PASS, restart count 70 -> 71
- `pm2 save`: PASS
- `https://att.ainativeos.net/health`: HTTP 200
- `https://att.ainativeos.net/api/ads/meta-utm-diagnostics?account_id=act_3138805896402376&date_preset=last_7d`: HTTP 200, `live_cache_miss`
- `https://biocom.ainativeos.net/ads/meta-utm?account_id=act_3138805896402376&date_preset=last_7d`: HTTP 200
- Playwright desktop/mobile smoke: PASS
  - "비Meta 오분류 제외 적용 현황" 표시
  - "B급 제안 사전" 표시
  - B급 192개 표시
  - 이전 title "비Meta 오분류 제외 dry-run" 미표시
  - console error 0
  - failed API request 0
  - horizontal overflow 0

## 배포 후 숫자

Source: VM Cloud backend live cache miss + VM Cloud attribution ledger + Meta Ads Insights API
Window: 2026-05-17 ~ 2026-05-23 KST
Freshness: 2026-05-24 12:27 KST
Confidence: A for source availability, medium-high for remaining REVIEW interpretation

- 기존 Meta 미맵핑 후보: 18건 / 5,764,500원
- 승인 제외 적용: 2건 / 483,300원
- REVIEW 보류: 4건 / 936,000원
- 계속 미맵핑 보류: 12건 / 4,345,200원
- 제외 적용 후 미맵핑: 16건 / 5,281,200원
- B급 제안 사전: 192개

## 하지 않은 것

- Meta CAPI manual send/backfill: 0
- GA4 Measurement Protocol send: 0
- Google Ads/TikTok/Naver/Meta account mutation: 0
- GTM submit/create_version/publish: 0
- Imweb header/footer save: 0
- 운영DB write/import: 0
- VM Cloud SQLite schema/data write: 0

주의: VM Cloud의 기존 운영 background job은 `capiAutoSync`, `attributionStatusSync`, `imwebAutoSync`, `tossAutoSync`가 enabled 상태다.
이번 작업에서 수동 전송을 실행하지는 않았지만, backend restart 자체는 기존 운영 자동작업이 살아 있는 프로세스를 재기동한다.
실제 배포 후 로그에서 기존 `CAPI auto-sync`가 2026-05-24 12:28 KST에 2건 전송, 98건 skip, 실패 0으로 실행된 것을 확인했다.
따라서 "수동 platform send는 0"이지만, "배포 재시작 이후 기존 자동작업 platform send는 2건"으로 분리해서 기록한다.

## 롤백

문제가 생기면 아래 순서로 원복한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94

sudo -n -u biocomkr_sns bash -lc '
set -euo pipefail
export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
REPO=/home/biocomkr_sns/seo/repo
BACKUP=$REPO/.deploy-backups/meta-utm-approved-exclusion-20260524-122131
cp $BACKUP/backend/src/routes/ads.ts.before $REPO/backend/src/routes/ads.ts
cp $BACKUP/frontend/src/app/ads/meta-utm/page.tsx.before $REPO/frontend/src/app/ads/meta-utm/page.tsx
cd $REPO/backend
npm run build
cd $REPO/frontend
npm run build
cd $REPO
pm2 restart seo-backend --update-env
pm2 restart seo-frontend --update-env
pm2 save
'
```

## 남은 리스크

- REVIEW 4건/936,000원은 자동 제외하지 않았다. IG 프로필 링크, link-in-bio, fbclid only 가능성이 있어 raw 원장 확인이 필요하다.
- B급 192개는 후보 사전이다. 그로스팀 URL/숫자 ID 확인 없이 자동 확정하면 오매칭 리스크가 있다.
- Meta API rate limit은 다시 발생할 수 있다. 이번 post-check는 `live_cache_miss`로 성공했지만, 이후에는 disk/in-memory cache가 응답할 수 있다.

## 후속 프론트 문구 수정

작성 시각: 2026-05-24 12:43 KST

TJ님 확인으로 `/songyuul07`, `/hwajung01`이 백엔드/API에는 반영되어 있지만 프론트 상단 안내 카드에는 예전 미반영 문구가 남아 있음을 확인했다.
데이터 매핑 자체는 이미 Section A ready에 반영되어 있었고, 후속 작업은 프론트 설명 문구 정정만 수행했다.

- `/songyuul07`: `120245003319500396` 캠페인, `120245370784880396` 광고세트 수동 확정 문구로 수정
- `/hwajung01`: `120245003319500396` 캠페인, `120245498758680396` 광고세트 수동 확정 문구 추가
- VM Cloud frontend build: PASS
- `pm2 restart seo-frontend --update-env`: PASS
- 백업 경로: `/home/biocomkr_sns/seo/repo/.deploy-backups/meta-utm-priority-copy-fix-20260524-123843`
- 외부 프론트 Playwright smoke: PASS
  - `/songyuul07` 문구: 23건, 8,790,450원, ROAS 34.21배 표시
  - `/hwajung01` 문구: 3건, 975,000원, ROAS 17.60배 표시
  - 이전 `/songyuul07` 미반영 문구 미표시

주의: 프론트만 재시작하려 했으나, VM 자체가 2026-05-24 12:36 KST에 재부팅된 상태로 확인됐다.
배포 후 health와 Meta UTM API는 정상이며, `seo-backend`, `seo-frontend`, `seo-cloudflared`는 모두 online이다.

## 다음 할일

### Codex가 할 일

1. REVIEW 4건을 raw 원장 기준으로 한 번 더 분류한다.
   - Lane: Green
   - 성공 기준: REVIEW 4건이 `제외`, `보류`, `캠페인 매칭 후보` 중 하나로 설명된다.
   - 승인 필요: NO, read-only 조사다.

2. B급 192개 중 매출 영향 큰 상위 후보부터 그로스팀 확인 큐로 정렬한다.
   - Lane: Green
   - 성공 기준: 그로스팀이 실제 URL/숫자 ID를 채워야 하는 우선순위가 생긴다.
   - 승인 필요: NO, 문서/CSV 정리다.

### TJ님이 할 일

1. 외부 보고서에서 숫자가 의사결정 화면으로 충분한지 확인한다.
   - 확인 URL: `https://biocom.ainativeos.net/ads/meta-utm?account_id=act_3138805896402376&date_preset=last_7d`
   - 성공 기준: "비Meta 오분류 제외 적용 현황"과 B급 제안 사전 192개가 보인다.
   - 실패 시 확인점: 브라우저 캐시 새로고침, Cloudflare cache, frontend PM2 상태.
   - Codex가 대신 못 하는 이유: TJ님이 실제 의사결정 화면으로 보기 편한지 판단해야 한다.
