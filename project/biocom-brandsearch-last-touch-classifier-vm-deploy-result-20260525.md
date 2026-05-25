# 바이오컴 브랜드검색 last-touch classifier VM Cloud 배포 결과

작성 시각: 2026-05-25 14:48 KST  
기준일: 2026-05-25  
문서 성격: 승인 후 VM Cloud 배포 결과  
Site: biocom, thecleancoffee

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
  required_context_docs:
    - project/okr-naver-brandsearch-roas-capi-progress-20260525.md
    - project/coffee-naver-brandsearch-vm-deploy-result-20260525.md
  lane: Yellow_approved_VM_Cloud_deploy
  allowed_actions:
    - VM_Cloud_source_backup
    - VM_Cloud_classifier_patch_copy
    - VM_Cloud_typecheck
    - VM_Cloud_targeted_tests
    - VM_Cloud_build
    - seo_backend_restart
    - health_check
    - read_only_classifier_smoke
    - CAPI_log_read_only_monitor
  forbidden_actions:
    - VM_Cloud_SQLite_manual_write
    - operational_DB_write
    - GTM_publish
    - Imweb_code_edit
    - manual_CAPI_send
    - ad_platform_setting_change
    - raw_identifier_output
  source_window_freshness_confidence:
    source:
      - VM Cloud backend source/dist
      - VM Cloud health
      - VM Cloud Meta CAPI log API
      - local and VM targeted tests
    window: 2026-05-25 14:41-14:48 KST
    freshness: same-turn
    confidence: 0.94
```

## 10초 요약

VM Cloud에 브랜드검색 last-touch 분류 보강을 배포했다.

이제 현재 랜딩 payload에 `naverbrandsearch` 계열 UTM이 명시돼 있으면, 이전 touch에서 남은 Google click id hash 때문에 `paid_search/google.com`으로 오염되지 않는다. 반대로 현재 Google paid click이고 Naver 브랜드검색 marker가 없으면 계속 `paid_search/google.com`으로 분류된다.

배포 후 health, VM 내부 테스트, build, dist one-off smoke, CAPI 후속 모니터링을 확인했다.

## 배포한 것

### 변경 파일

- `backend/src/siteLandingChannelClassifier.ts`
- `backend/tests/site-landing-channel-classifier.test.ts`

### 정책

플랫폼 우선순위가 아니라 마지막 유입 신호 우선순위다.

- 현재 랜딩 UTM에 Naver 브랜드검색 marker가 있으면 `naver_brandsearch`.
- 현재 Google paid click이고 Naver 브랜드검색 marker가 없으면 `paid_search`.
- 이전 touch에서 보존된 Google click id는 현재 Naver 브랜드검색 UTM을 덮어쓰지 않는다.
- Naver 브랜드검색 뒤 이탈 후 Google 광고로 다시 들어오면 Google paid가 마지막 유입이므로 `paid_search`가 맞다.

## 백업

VM Cloud 백업 경로:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/biocom-brandsearch-last-touch-classifier-20260525T1442KST
```

백업 대상:

- `backend/src/siteLandingChannelClassifier.ts`
- `backend/tests/site-landing-channel-classifier.test.ts`
- `backend/dist/siteLandingChannelClassifier.js`

## 검증 결과

### 로컬 사전 검증

```text
npx tsx --test tests/site-landing-channel-classifier.test.ts tests/site-landing-multi-site.test.ts
PASS: 35/35
```

### VM Cloud 내부 검증

```text
npm run typecheck
PASS

npx tsx --test tests/site-landing-channel-classifier.test.ts tests/site-landing-multi-site.test.ts
PASS: 35/35

npm run build
PASS
```

### backend restart

```text
pm2 restart seo-backend --update-env
pm2 save
```

결과:

- `seo-backend`: online
- restart count: 12 → 13
- unstable restarts: 0
- script path: `/home/biocomkr_sns/seo/repo/backend/dist/server.js`

### post-smoke

Health:

```text
status=ok
capiAutoSync.enabled=true
capiAutoSync.intervalMs=1800000
capiAutoSync.limit=100
```

Dist classifier one-off:

```text
brandsearch + preserved gclid => naver_brandsearch
current Google paid click => paid_search / google.com
Naver powerlink => paid_search / naver
```

### CAPI 후속 모니터링

재시작 후 약 75초 뒤 CAPI log API를 read-only로 확인했다.

```text
최근 24시간 total=76
success=76
failure=0
duplicateEventIds=0
duplicateOrderEventKeys=0
manual=0
test=0
```

## 하지 않은 것

- VM Cloud SQLite 수동 write: 0건
- 운영DB write: 0건
- GTM publish: 0건
- Imweb 코드 변경: 0건
- 수동 Meta CAPI send: 0건
- 광고 플랫폼 설정 변경: 0건
- raw identifier 출력: 0건

## 현재 판정

`DEPLOYED_AND_VERIFIED`

신규 유입부터 last-touch 분류 보강이 적용된다. 기존에 잘못 분류된 과거 row는 이번 배포에서 수동 수정하지 않았다.

## 다음 할일

### Auto Green

1. 신규 바이오컴 브랜드검색 smoke 확인
   - 무엇: TJ님이 새 브랜드검색 유입을 만들거나 자연 유입이 들어온 뒤 `naver_brandsearch` 신규 row를 확인한다.
   - 왜: 이번 배포는 과거 row를 고치지 않고 신규 row부터 적용된다.
   - 성공 기준: `naverbrandsearch_biocom_pc_*` 계열 신규 row가 `naver_brandsearch`로 저장된다.

2. Naver 브랜드검색 비용 join 설계
   - 무엇: 브랜드검색 광고비와 `naver_brandsearch` 유입/결제완료 주문을 same-window로 연결한다.
   - 왜: 브랜드검색은 광고상품이지만 브랜드 오가닉 수요를 포함하므로 일반 paid search와 섞으면 ROAS가 과대평가될 수 있다.
   - 성공 기준: 브랜드검색 광고비, 유입, 결제완료 주문이 별도 라인으로 조회된다.

### Approval Needed

1. 과거 row backfill
   - 무엇: 이미 `paid_search/google.com`으로 잘못 들어간 브랜드검색 row를 재분류할지 결정한다.
   - 왜: 과거 리포트 window를 바로 정정하려면 수동 원장 write가 필요하다.
   - 승인 이유: VM Cloud SQLite write가 들어간다.

