# 다음 액션과 rollback

작성 시각: 2026-05-14 03:00 KST

## 현재 판정

VM Cloud backend 반영은 PASS다. 네이버 evidence aggregate는 `/total` backend response에 포함된다. public frontend `/total` route는 아직 404라서 사용자 화면 노출은 별도 작업이다.

Naver Ads URL canary는 API로 직접 실행하지 않았다. 공식 update 필드가 landing URL을 지원하지 않아 UI 수동 canary가 안전하다.

## Rollback

문제 조건:

- summary API 또는 `/total` API 5xx 지속.
- 네이버 후보가 budget ROAS에 자동 포함됨.
- raw order/payment/click/member/email/phone 값 노출.
- VM Cloud schema migration 발생.
- 외부 platform send/upload 발생.

rollback command:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes taejun@34.64.104.94
sudo -n -u biocomkr_sns bash -lc '
  export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
  cd /home/biocomkr_sns/seo/repo
  BACKUP=/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0514-4-20260513T173652Z
  cp "$BACKUP/backend/src/routes/attribution.ts" backend/src/routes/attribution.ts
  cp "$BACKUP/backend/src/routes/total.ts" backend/src/routes/total.ts
  cp "$BACKUP/backend/src/sourceFreshness.ts" backend/src/sourceFreshness.ts
  rm -f backend/scripts/monthly-spine-dry-run.ts
  rm -f backend/scripts/monthly-evidence-join-dry-run.ts
  rm -f backend/src/naverAdsLocalDb.ts
  cd backend
  npm run typecheck
  npm run build
  pm2 restart seo-backend --update-env
'
```

rollback 후 확인:

```bash
curl -sS 'https://att.ainativeos.net/health'
curl -sS 'https://att.ainativeos.net/api/total/monthly-channel-summary?site=biocom&month=2026-05'
```

## 다음 할일 — Codex

1. 운영 프론트 `/total` route 반영 승인안 작성 또는 deploy 준비
- 왜: backend에는 네이버 aggregate가 있으나 public frontend가 404라 TJ님이 화면에서 볼 수 없다.
- 어떻게: frontend build, route availability, `/total` page smoke, rollback plan을 묶는다.
- 성공 기준: `https://biocom.ainativeos.net/total` 200, 네이버 후보 4개 class 표시, budget ROAS 제외 문구 표시.
- 승인 필요: YES, frontend 운영 deploy.
- 추천 점수/자신감: 88%.

2. canary 관찰 query 준비
- 왜: TJ님이 UI에서 1개 광고그룹 URL을 바꾼 뒤 실제로 UTM이 남는지 24~72시간 확인해야 한다.
- 어떻게: VM Cloud `site_landing_ledger`, `attribution_ledger`, `/api/attribution/ledger/naver-evidence-aggregate` read-only query를 시간 window 기준으로 묶는다.
- 성공 기준: 새 UTM landing이 잡히고 checkout/payment_success first touch가 이어진다.
- 승인 필요: NO, Green read-only.
- 추천 점수/자신감: 92%.

## 다음 할일 — TJ님

1. Naver Ads UI에서 1개 광고그룹 URL canary 적용 여부 결정
- 왜: Search Ad API가 landing URL update를 안전하게 지원하지 않아 UI 수동 적용이 필요하다.
- 어디서: 네이버 검색광고 관리자 화면에서 `바이오컴_파워링크_영양중금속검사 / 01_메인키워드_PC` 광고그룹 소재 URL.
- 어떻게: 기존 PC/MO URL을 먼저 백업하고, 기존 query를 유지한 상태로 표준 UTM 5개를 추가한다.
- 성공 기준: 24~72시간 안에 VM Cloud landing/checkout/payment evidence가 paid_naver 후보로 잡힌다.
- 실패 시: 기존 URL로 원복하고 query string 제거/redirect 소실 여부를 확인한다.
- Codex가 대신 못 하는 이유: 외부 광고 플랫폼 UI 로그인/권한과 실제 광고 URL 변경은 계정 소유자 확인이 필요하다.
- 승인 필요: 이미 조건부 승인됨. 실제 UI 클릭은 TJ님 또는 계정 권한 보유자가 수행.
- 추천 점수/자신감: 78%.
