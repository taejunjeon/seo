# Naver 브랜드검색 별도 라인 VM Cloud 배포 결과

작성 시각: 2026-05-25 10:07 KST  
기준일: 2026-05-25  
문서 성격: VM Cloud 배포 결과 / CAPI auto-sync 임시 OFF 포함  
Site: thecleancoffee, biocom

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/RULES.md
    - harness/yellow-lane-deploy-packet-template-20260523.md
  required_context_docs:
    - project/coffee-naver-brandsearch-vm-deploy-approval-20260525.md
    - project/coffee-naver-brandsearch-vm-deploy-hold-result-20260525.md
    - project/naver-channel-classification-dry-run-20260521.md
  lane: Yellow_completed_with_CAPI_auto_sync_paused
  allowed_actions:
    - VM_Cloud_file_backup
    - VM_Cloud_backend_code_deploy
    - temporary_CAPI_auto_sync_OFF
    - backend_typecheck_test_build
    - seo_backend_restart
    - read_only_post_smoke
  forbidden_actions:
    - VM_Cloud_SQLite_manual_write
    - operational_DB_write
    - GTM_publish
    - Imweb_code_edit
    - GA4_Meta_Google_TikTok_Naver_platform_send_or_upload
    - raw_identifier_output
  source_window_freshness_confidence:
    source:
      deploy_target: VM Cloud /home/biocomkr_sns/seo/repo/backend
      health: https://att.ainativeos.net/health
      validation: VM-local typecheck/test/build + public API smoke
    window: 2026-05-25 10:00-10:06 KST
    freshness: same-turn
    confidence: 0.92
```

## 10초 요약

VM Cloud 배포를 완료했다. 더클린커피와 바이오컴의 Naver 브랜드검색 UTM marker는 앞으로 `paid_search`가 아니라 `naver_brandsearch` 별도 라인으로 분류된다.

배포 중 Meta CAPI 자동 전송이 섞이지 않도록 `CAPI_AUTO_SYNC_ENABLED=0`을 VM Cloud `.env`에 적용하고 재시작했다. 현재 CAPI auto-sync는 꺼져 있다.

이번 배포는 과거 row를 재분류하지 않는다. 기존 summary에 `naver_brandsearch`가 즉시 보이지 않는 것은 정상이며, 새 유입부터 반영된다.

## 배포한 것

### 코드

- `backend/src/siteLandingChannelClassifier.ts`
- `backend/src/siteLandingLedger.ts`
- `backend/tests/site-landing-channel-classifier.test.ts`
- `backend/tests/site-landing-multi-site.test.ts`

### VM Cloud 환경

`backend/.env`의 모든 `CAPI_AUTO_SYNC_ENABLED` 라인을 `0`으로 변경했다. 중복 선언이 있어 두 줄 모두 OFF로 맞췄다.

이유:

- `seo-backend` restart 후 기존 Meta CAPI auto-sync가 60초 뒤 전송을 실행할 수 있었다.
- 배포 목적은 Naver 브랜드검색 classifier 반영이므로, Meta 실제 전송과 섞이면 안 됐다.

## 백업

VM Cloud 백업 경로:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/coffee-naver-brandsearch-classifier-20260525T100001KST
```

백업 포함:

- 배포 전 4개 코드/테스트 파일
- 배포 전 `backend/.env`

## VM 내 검증

### 코드 검증

```text
npm run typecheck: PASS
npx tsx --test tests/site-landing-channel-classifier.test.ts tests/site-landing-multi-site.test.ts: 33/33 PASS
npm run build: PASS
```

### classifier one-off

VM source와 build된 dist 모두 확인했다.

```text
thecleancoffee naver_brand_search -> naver_brandsearch
biocom naverbrandsearch_biocom_mo_mainhome -> naver_brandsearch
```

### restart / health

```text
seo-backend restart: PASS
https://att.ainativeos.net/health: status=ok
capiAutoSync.enabled=false
```

재시작 60초 이후 확인:

```text
capiAutoSync.enabled=false
최근 CAPI 로그: disabled by CAPI_AUTO_SYNC_ENABLED=0
재시작 이후 CAPI auto-sync 전송 로그 없음
```

### summary API

```text
GET /api/attribution/site-landing/summary?site=thecleancoffee&windowHours=24: ok=true
GET /api/attribution/site-landing/summary?site=biocom&windowHours=24: ok=true
```

주의:

- 이 summary는 기존 row의 저장된 `channel_classified`를 읽는다.
- 이번 배포는 과거 row backfill이 아니므로 기존 24h summary가 바로 `naver_brandsearch`로 바뀌지 않아도 실패가 아니다.
- 새 유입부터 분류가 반영된다.

## 하지 않은 것

- VM Cloud SQLite 수동 write: 0건
- 운영DB write: 0건
- GTM publish: 0건
- Imweb code edit: 0건
- Meta/GA4/Google Ads/TikTok/Naver platform send/upload: 0건
- 과거 row reclassify/backfill: 0건
- raw identifier output: 0건

## 현재 운영 영향

### 좋아진 것

- 새 더클린커피 브랜드검색 유입은 `naver_brandsearch`로 별도 분류된다.
- 새 바이오컴 브랜드검색 유입도 `naver_brandsearch`로 별도 분류된다.
- `paid_hint_count`에는 브랜드검색도 포함되지만, `channel_distribution`에서는 일반 `paid_search`와 분리된다.

### 남은 영향

- Meta CAPI auto-sync는 현재 꺼져 있다.
- 즉, 자동 운영 CAPI 전송은 일시 중단 상태다.
- 수동 API send를 실행한 것은 아니며, 재개하려면 별도 승인 후 env 복구와 restart가 필요하다.

## 다음 판단

1. Naver 브랜드검색 분류는 이 상태가 맞다.
   - 브랜드검색은 광고 상품 evidence지만 일반 paid search와 섞으면 증분성을 과대평가할 수 있다.
   - 더클린커피와 바이오컴 모두 동일 기준이 맞다.

2. CAPI auto-sync 재개는 별도 작업으로 분리해야 한다.
   - 재개하면 남아 있는 후보가 자동 전송될 수 있다.
   - 재개 전 후보 수와 source별 분포를 다시 read-only로 보고, 실제 전송 재개 여부를 결정하는 편이 안전하다.

## rollback 요약

rollback이 필요하면 아래 순서다.

1. 백업 경로에서 4개 코드/테스트 파일과 `backend/.env`를 복원한다.
2. `npm run typecheck`, 관련 테스트, `npm run build`를 실행한다.
3. `pm2 restart seo-backend --update-env`를 실행한다.
4. `/health`를 확인한다.

주의: rollback으로 `.env`까지 복원하면 CAPI auto-sync도 다시 켜질 수 있다. rollback 전 CAPI 재개를 허용할지 먼저 결정해야 한다.

## 현재 판정

`DEPLOYED_WITH_CAPI_AUTO_SYNC_PAUSED`

classifier 배포는 완료됐다. 외부 플랫폼 전송은 배포 중 발생하지 않도록 CAPI auto-sync를 꺼둔 상태다.

