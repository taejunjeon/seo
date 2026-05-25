# 더클린커피 Naver 브랜드검색 별도 라인 VM Cloud 배포 승인안

작성 시각: 2026-05-25 07:43 KST  
기준일: 2026-05-25  
문서 성격: Yellow Lane VM Cloud 배포 승인안 / 실제 배포 전 의사결정 문서  
Site: thecleancoffee

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
    - docurule.md
    - project/coffee-naver-brandsearch-vbank-smoke-result-20260525.md
    - project/coffee-naver-brandsearch-site-landing-gap-result-20260525.md
    - project/coffee-virtual-account-event-name-improvement-design-20260525.md
  lane: Green_for_approval_packet__Yellow_for_actual_VM_Cloud_deploy
  allowed_actions:
    - documentation
    - deploy_approval_packet_design
    - local_validation_reference
  forbidden_actions:
    - VM_Cloud_deploy_or_restart_without_TJ_approval
    - VM_Cloud_SQLite_manual_write_or_backfill
    - operational_DB_write
    - GTM_publish
    - Imweb_code_edit
    - GA4_Meta_Google_TikTok_Naver_platform_send_or_upload
    - raw_identifier_output
  source_window_freshness_confidence:
    source:
      primary: local_repo_code_and_tests
      cross_check: VM_Cloud_public_attribution_API_observation
      browser_cross_check: TJ님 Chrome smoke observation
    window: 2026-05-25 06:15-07:43 KST
    freshness: same-turn local code and same-day smoke evidence
    confidence: 0.89
```

## 10초 요약

이 배포는 더클린커피 네이버 브랜드검색 유입을 고객 유입 장부에서 `자사 내부 유입`이나 일반 `유료검색`에 섞지 않고, `naver_brandsearch`라는 별도 라인으로 보이게 하는 작업이다.

추가 확인 결과 이 classifier는 더클린커피 전용이 아니라 바이오컴에도 같이 적용되는 공용 코드다. 따라서 같은 patch가 배포되면 바이오컴의 `naverbrandsearch_biocom_*` 유입도 `paid_search`가 아니라 `naver_brandsearch` 별도 라인으로 분리된다.

실제 효과는 앞으로 들어오는 브랜드검색 유입이 `/api/attribution/site-landing/summary`와 관련 리포트에서 별도 분류로 쌓이는 것이다. 과거 row를 다시 쓰는 backfill은 이번 승인에 포함하지 않는다.

주의할 점은 VM Cloud backend 재시작이 필요할 수 있고, 재시작 후 기존 background job이 자동으로 깨어날 수 있다는 점이다. 그래서 배포 직전 background sender precheck를 강제하고, 즉시 전송 위험이 있으면 재시작 전 HOLD한다.

## 1. 사람 말 요약

### 무엇을 바꾸는가

더클린커피 네이버 브랜드검색 유입을 고객 유입 장부에서 별도 줄로 분류한다.

기술적으로는 `utm_source=naver_brand_search` 또는 비슷한 브랜드검색 marker가 들어온 경우, 기존처럼 자사 referrer 때문에 `self_internal`로 떨어지지 않게 한다. 일반 파워링크 계열은 계속 `paid_search`로 둔다.

### 왜 바꾸는가

브랜드검색은 광고 상품으로 볼 수 있지만, 이미 브랜드를 알고 검색한 수요도 섞인다. 일반 유료검색과 합치면 예산 판단에서 증분성을 과대평가할 수 있다.

그래서 `광고 상품 evidence`는 인정하되, 일반 검색 광고와 한 줄로 합치지 않는 것이 맞다.

### 바뀌면 TJ님이 체감하는 효과

더클린커피 네이버 브랜드검색 유입이 고객 유입 장부 요약에서 별도 라인으로 보인다. 이후 가상계좌 주문, 결제 시작, 결제 완료와 연결할 때 `브랜드검색 영향`과 `일반 유료검색 영향`을 분리해서 볼 수 있다.

바이오컴도 같은 원칙을 적용한다. `naverbrandsearch_biocom_MO_mainhome`, `naverbrandsearch_biocom_PC_mainhome`처럼 브랜드검색임이 명확한 UTM은 일반 `paid_search`와 분리한다.

### 안 바꾸면 남는 문제

주문 단계 원장에는 네이버 브랜드검색 evidence가 남아도, 첫 유입 요약에서는 자사 내부 유입처럼 보일 수 있다. 그러면 Naver 브랜드검색 테스트 결과를 예산 판단에 쓰기 어렵다.

## 2. 작업 범위

### 대상 서비스

- VM Cloud backend: `seo-backend`
- 접속 도메인: `att.ainativeos.net`
- 변경 목적: 고객 유입 장부 분류 로직만 변경

### 바꾸는 파일

- `backend/src/siteLandingChannelClassifier.ts`
- `backend/src/siteLandingLedger.ts`
- `backend/tests/site-landing-channel-classifier.test.ts`
- `backend/tests/site-landing-multi-site.test.ts`

### 바꾸지 않는 것

- 과거 고객 유입 장부 row 재분류/backfill: 하지 않음
- VM Cloud SQLite 수동 write: 하지 않음
- 운영DB write: 하지 않음
- GTM publish: 하지 않음
- Imweb header/footer/body 코드 수정: 하지 않음
- Meta/GA4/Google Ads/TikTok/Naver 실제 전송 또는 upload: 하지 않음
- Google Ads/Naver Ads 광고 설정 변경: 하지 않음
- raw 주문번호, 결제키, click id, 회원정보 출력: 하지 않음

## 2A. 바이오컴 브랜드검색 영향

### 현재 관측

Source: VM Cloud public API  
Window: site landing rolling 24h/7d, attribution ledger source=`biocom_imweb` 누적 aggregate  
Freshness: 2026-05-25 07:43-08:00 KST  
Confidence: medium-high

- 바이오컴 24시간 고객 유입 장부 top campaign에 `naverbrandsearch_biocom_MO_mainhome` 31건이 보인다.
- 바이오컴 7일 고객 유입 장부에는 Naver referrer/source가 큰 묶음으로 존재한다.
- 주문 경로 원장 aggregate에서 `biocom_imweb` 기준 `naver_brandsearch` 후보는 1,275건이다.
- 이 중 `payment_success`까지 간 후보는 378건이다.

### 권장 판단

바이오컴도 더클린커피와 같은 분류 원칙을 적용한다.

- `naverbrandsearch_biocom_*`는 `naver_brandsearch`로 별도 분리한다.
- 파워링크/일반 네이버 유료검색은 `paid_search`로 둔다.
- `search.naver.com` 또는 `NaPm` 단독은 organic/reference 후보로 둔다.
- 예산 ROAS에는 브랜드검색 광고비와 별도 join이 확인될 때만 사용한다.

이유는 더클린커피와 같다. 브랜드검색은 광고 상품일 수 있지만, 이미 브랜드를 알고 들어온 수요가 섞여 있어 일반 검색 광고와 합치면 증분성을 과대평가할 수 있다.

## 3. 사전 스냅샷과 백업

### 배포 전 확인

배포 직전 VM Cloud에서 아래를 확인한다.

```bash
curl -sS http://localhost:7020/health | jq '{status, timestamp, backgroundJobs}'
curl -sS 'http://localhost:7020/api/attribution/site-landing/summary?site=thecleancoffee&windowHours=24' | jq '{ok, site, windowHours, channel_distribution}'
pm2 describe seo-backend
git rev-parse --short HEAD
git status --short
```

### background sender hard precheck

이 배포 자체는 외부 플랫폼 전송을 새로 만들지 않는다. 하지만 VM Cloud backend를 재시작하면 기존 background job이 다시 예약된다.

특히 코드 기준으로 아래 job은 재시작 뒤 지연 실행될 수 있다.

- `CAPI_AUTO_SYNC_ENABLED`: 재시작 후 약 60초 뒤 Meta CAPI 자동 동기화 가능
- `ATTRIBUTION_STATUS_SYNC_ENABLED`: 약 90초 뒤 결제 상태 동기화 가능
- `IMWEB_AUTO_SYNC_ENABLED`: 약 180초 뒤 Imweb 주문 동기화 가능
- `TOSS_AUTO_SYNC_ENABLED`: 약 480초 뒤 Toss 정산 동기화 가능
- `TIKTOK_ADS_AUTO_SYNC_ENABLED`: 약 600초 뒤 TikTok 광고 데이터 동기화 가능
- `SCHEDULED_SEND_ENABLED`: 약 10초 뒤 예약 발송 poll 가능

배포 직전 아래를 확인한다.

```bash
curl -sS http://localhost:7020/health | jq '.backgroundJobs'
grep -E '^(BACKGROUND_JOBS_ENABLED|CAPI_AUTO_SYNC_ENABLED|ATTRIBUTION_STATUS_SYNC_ENABLED|IMWEB_AUTO_SYNC_ENABLED|TOSS_AUTO_SYNC_ENABLED|TIKTOK_ADS_AUTO_SYNC_ENABLED|SCHEDULED_SEND_ENABLED)=' backend/.env || true
tail -n 250 ~/.pm2/logs/seo-backend-out.log | grep -E 'CAPI auto-sync|Attribution status sync|Imweb orders sync|Toss settlements sync|TikTok daily sync|Scheduled send' || true
```

HOLD 조건:

- 재시작 후 즉시 외부 전송이 발생할 가능성을 배제할 수 없고, TJ님 승인 범위에 그 side effect가 포함되지 않았을 때
- `SCHEDULED_SEND_ENABLED`가 켜져 있고 due 발송 후보가 있는지 확인할 수 없을 때
- 배포 직전 로그에서 CAPI/TikTok/예약발송이 진행 중일 때

HOLD가 걸리면 코드 복사와 재시작을 하지 않고, precheck 결과만 보고한다.

### 백업 경로

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/coffee-naver-brandsearch-classifier-20260525T0743KST
```

백업 대상:

- `backend/src/siteLandingChannelClassifier.ts`
- `backend/src/siteLandingLedger.ts`
- `backend/tests/site-landing-channel-classifier.test.ts`
- `backend/tests/site-landing-multi-site.test.ts`

## 4. 적용 순서

### 1단계. VM Cloud 파일 백업

```bash
cd /home/biocomkr_sns/seo/repo
mkdir -p .deploy-backups/coffee-naver-brandsearch-classifier-20260525T0743KST/backend/src
mkdir -p .deploy-backups/coffee-naver-brandsearch-classifier-20260525T0743KST/backend/tests
cp backend/src/siteLandingChannelClassifier.ts .deploy-backups/coffee-naver-brandsearch-classifier-20260525T0743KST/backend/src/
cp backend/src/siteLandingLedger.ts .deploy-backups/coffee-naver-brandsearch-classifier-20260525T0743KST/backend/src/
cp backend/tests/site-landing-channel-classifier.test.ts .deploy-backups/coffee-naver-brandsearch-classifier-20260525T0743KST/backend/tests/
cp backend/tests/site-landing-multi-site.test.ts .deploy-backups/coffee-naver-brandsearch-classifier-20260525T0743KST/backend/tests/
```

### 2단계. 코드 반영

로컬에서 검증된 4개 파일만 VM Cloud의 같은 경로로 반영한다. 다른 파일은 건드리지 않는다.

### 3단계. VM Cloud 내 검증

```bash
cd /home/biocomkr_sns/seo/repo/backend
npm run typecheck
npx tsx --test tests/site-landing-channel-classifier.test.ts tests/site-landing-multi-site.test.ts
npx tsx -e 'const mod = await import("./src/siteLandingChannelClassifier.ts"); const result = mod.classifySiteLandingChannel({ site: "thecleancoffee", referrerHost: "thecleancoffee.com", referrerFullUrl: "https://thecleancoffee.com/thecleancoffee/?idx=75", utm: { source: "naver_brand_search", medium: "naver_brand_search", campaign: "", content: "home_pc", term: "" } }); if (result.channel !== "naver_brandsearch") { throw new Error(JSON.stringify(result)); } console.log(JSON.stringify({ ok: true, channel: result.channel, reason: result.reason }));'
```

성공 기준:

- typecheck PASS
- 관련 테스트 PASS
- classifier one-off 결과가 `channel=naver_brandsearch`

### 4단계. restart 직전 sender precheck

3단계가 통과해도 바로 재시작하지 않는다. 아래를 한 번 더 확인한다.

```bash
curl -sS http://localhost:7020/health | jq '.backgroundJobs'
tail -n 250 ~/.pm2/logs/seo-backend-out.log | grep -E 'CAPI auto-sync|Attribution status sync|Imweb orders sync|Toss settlements sync|TikTok daily sync|Scheduled send' || true
```

HOLD 조건이 있으면 여기서 중단한다.

### 5단계. backend restart

```bash
pm2 restart seo-backend --update-env
pm2 save
```

### 6단계. post-smoke

```bash
curl -sS http://localhost:7020/health | jq '{status, timestamp, backgroundJobs}'
curl -sS 'http://localhost:7020/api/attribution/site-landing/summary?site=thecleancoffee&windowHours=24' | jq '{ok, site, windowHours, channel_distribution}'
```

주의:

- 24시간 summary에 `naver_brandsearch`가 즉시 보이지 않아도 실패가 아닐 수 있다.
- 이번 배포는 과거 row를 다시 쓰지 않는다.
- 확정 성공은 이후 새 브랜드검색 유입이 들어온 뒤 별도 라인으로 쌓이는지 확인해야 닫힌다.

## 5. 성공 기준

### API 기준

- `/health` 200
- `/api/attribution/site-landing/summary?site=thecleancoffee&windowHours=24` 200

### 코드 기준

- VM Cloud에서 classifier one-off 결과가 `naver_brandsearch`
- `paid_search`와 `naver_brandsearch`가 별도 채널로 유지
- `paid_hint_count`에는 `naver_brandsearch`도 포함

### 테스트 기준

- `npm run typecheck` PASS
- `npx tsx --test tests/site-landing-channel-classifier.test.ts tests/site-landing-multi-site.test.ts` PASS

### 금지선 기준

- 수동 VM Cloud SQLite write 0건
- 운영DB write 0건
- GTM publish 0건
- Imweb 코드 저장 0건
- Meta/GA4/Google Ads/TikTok/Naver send/upload 0건
- raw identifier output 0건
- background sender가 의도치 않게 실행될 위험이 있으면 restart 전 HOLD

## 6. 실패 기준과 rollback

### rollback 시작 조건

- typecheck 실패
- 관련 테스트 실패
- classifier one-off가 `naver_brandsearch`를 반환하지 않음
- `/health` 실패
- PM2 restart loop
- summary API 5xx
- background sender 위험이 배포 승인 범위를 넘음
- raw 식별자 출력 위험이 확인됨

### rollback 명령

```bash
cd /home/biocomkr_sns/seo/repo
cp .deploy-backups/coffee-naver-brandsearch-classifier-20260525T0743KST/backend/src/siteLandingChannelClassifier.ts backend/src/siteLandingChannelClassifier.ts
cp .deploy-backups/coffee-naver-brandsearch-classifier-20260525T0743KST/backend/src/siteLandingLedger.ts backend/src/siteLandingLedger.ts
cp .deploy-backups/coffee-naver-brandsearch-classifier-20260525T0743KST/backend/tests/site-landing-channel-classifier.test.ts backend/tests/site-landing-channel-classifier.test.ts
cp .deploy-backups/coffee-naver-brandsearch-classifier-20260525T0743KST/backend/tests/site-landing-multi-site.test.ts backend/tests/site-landing-multi-site.test.ts
cd backend
npm run typecheck
npx tsx --test tests/site-landing-channel-classifier.test.ts tests/site-landing-multi-site.test.ts
pm2 restart seo-backend --update-env
curl -sS http://localhost:7020/health | jq '{status, timestamp}'
```

주의: rollback도 backend restart를 포함하므로 같은 background sender precheck를 먼저 적용한다.

## 7. 승인 요청 문구

TJ님이 승인하려면 아래 범위로 승인하면 된다.

```text
승인합니다. 더클린커피 Naver 브랜드검색 별도 라인 classifier VM Cloud 배포를 진행하세요.

범위:
- backend/src/siteLandingChannelClassifier.ts
- backend/src/siteLandingLedger.ts
- backend/tests/site-landing-channel-classifier.test.ts
- backend/tests/site-landing-multi-site.test.ts
- VM Cloud 파일 백업, typecheck, 관련 테스트, classifier one-off, seo-backend restart, health/summary smoke

허용:
- 앞으로 들어오는 더클린커피 Naver 브랜드검색 유입을 naver_brandsearch 별도 라인으로 분류
- 배포 전 backup
- VM Cloud backend restart
- 배포 후 read-only API smoke

금지:
- 과거 row reclassify/backfill
- VM Cloud SQLite 수동 write
- 운영DB write
- GTM publish
- Imweb 코드 저장
- Meta/GA4/Google Ads/TikTok/Naver 실제 전송 또는 upload
- 광고 플랫폼 설정 변경
- raw 주문/결제/회원/click id 출력

조건:
- restart 직전 background sender precheck를 수행하고, 즉시 전송 위험이 있으면 restart 전 HOLD 보고
- 성공 기준은 health 200, summary API 200, VM Cloud classifier one-off naver_brandsearch, no manual send/write/publish
```

## 8. 배포 후 후속 확인

### 바로 확인 가능한 것

- backend health 200
- summary API 200
- classifier one-off `naver_brandsearch`
- background sender side effect 유무

### 새 유입 이후 확인 가능한 것

- 네이버 브랜드검색 랜딩 후 결제 흐름을 한 번 더 만들었을 때 `channel_distribution.naver_brandsearch`가 새 window에 나타나는지
- 가상계좌 미입금이면 주문 단계 원장에서는 `pending`으로 남고, confirmed 매출로 세지 않는지

### 이번 배포에 포함하지 않는 backlog

- Purchase Guard v3.2: 가상계좌 미입금 `PurchaseDecisionUnknown`을 더 늦게 보내고 `VirtualAccountIssued`로 더 잘 낮추는 브라우저 진단 품질 개선
- 과거 Naver 브랜드검색 row reclassify: 별도 dry-run, backup, apply 승인 필요
- Naver 브랜드검색 예산 효과 분석: 충분한 새 데이터가 들어온 뒤 별도 read-only 분석

## 9. 현재 판정

승인안 판정: `READY_WITH_BACKGROUND_SENDER_GUARD`

현재 로컬 검증은 통과했다. 다만 실제 VM Cloud 배포는 backend restart를 포함하므로, restart 전 background sender precheck를 hard gate로 둬야 한다.
