# Naver 브랜드검색 별도 라인 VM Cloud 배포 HOLD 결과

작성 시각: 2026-05-25 08:05 KST  
기준일: 2026-05-25  
문서 성격: VM Cloud 배포 시도 전 precheck 결과 / HOLD 보고  
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
    - project/coffee-naver-brandsearch-site-landing-gap-result-20260525.md
    - project/naver-channel-classification-dry-run-20260521.md
  lane: Yellow_HOLD_before_VM_Cloud_restart
  allowed_actions:
    - VM_Cloud_read_only_precheck
    - local_test
    - local_documentation
  forbidden_actions:
    - VM_Cloud_file_copy
    - VM_Cloud_backend_restart
    - VM_Cloud_SQLite_manual_write
    - operational_DB_write
    - GTM_publish
    - Imweb_code_edit
    - GA4_Meta_Google_TikTok_Naver_platform_send_or_upload
    - raw_identifier_output
  source_window_freshness_confidence:
    source:
      vm_cloud_health: https://att.ainativeos.net/health
      vm_cloud_readonly_script: attribution ledger + Meta CAPI send log aggregate only
      local_tests: backend site landing classifier tests
    window: 2026-05-25 07:43-08:05 KST
    freshness: same-turn
    confidence: 0.9
```

## 10초 요약

VM Cloud 배포는 실행하지 않았다. 이유는 코드 문제가 아니라 `seo-backend` 재시작이 기존 Meta CAPI 자동 동기화를 즉시 깨울 위험 때문이다.

read-only precheck에서 CAPI 자동 동기화가 켜져 있고, 미전송 후보가 aggregate 기준 507건으로 추정됐다. 최근 2시간 안에도 auto-sync 성공 5건이 있었다.

승인안의 hard gate는 "restart 직전 background sender 위험이 있으면 재시작 전 HOLD"였다. 그래서 파일 복사, build, restart를 하지 않았다.

## 실제 확인한 것

### 1. VM Cloud health

```text
status=ok
backgroundJobs.enabled=true
capiAutoSync.enabled=true
capiAutoSync.intervalMs=1800000
attributionStatusSync.enabled=true
imwebAutoSync.enabled=true
tossAutoSync.enabled=true
```

### 2. 최근 background 로그

최근 로그에서 아래가 확인됐다.

```text
CAPI auto-sync: 최근 2시간 내 성공 5건
Imweb orders sync: biocom / thecleancoffee 동작 중
```

### 3. CAPI 후보 read-only aggregate

VM Cloud에서 원장과 CAPI send log를 read-only aggregate로만 계산했다. raw 주문/결제/click/member 값은 출력하지 않았다.

```text
attribution ledger entries: 39,763
CAPI candidate rows: 3,814
successful auto-sync keys: 3,301
estimated unsent candidates: 507
recent auto-sync success in 2h: 5
unsent by source:
  biocom_imweb: 448
  thecleancoffee_imweb: 59
```

해석:

- 지금 `seo-backend`를 재시작하면 기존 CAPI auto-sync가 약 60초 뒤 다시 돈다.
- 미전송 후보가 남아 있어 실제 Meta CAPI 전송이 섞일 가능성이 높다.
- 이번 배포 승인 범위는 브랜드검색 classifier 배포이지, CAPI 전송 유발 승인이 아니다.

## 로컬 코드 상태

로컬 patch는 유지했다.

### 변경 의도

- `naver_brand_search`, `naverbrandsearch`, `brandsearch` UTM marker는 `naver_brandsearch`로 별도 분리한다.
- `powerlink`, `power-link`, 브랜드검색 marker 없는 `naverad`는 `paid_search`로 둔다.
- `paid_hint_count`에는 `naver_brandsearch`도 포함한다.
- 바이오컴 `naverbrandsearch_biocom_*`도 같은 별도 라인으로 분리한다.

### 검증

```text
site landing classifier + multi-site tests: 33/33 PASS
backend typecheck: PASS
validate_wiki_links: PASS
harness-preflight-check --strict: PASS
git diff --check: PASS
```

## 하지 않은 것

- VM Cloud 파일 복사: 0건
- VM Cloud backend build/restart: 0건
- VM Cloud SQLite 수동 write: 0건
- 운영DB write: 0건
- GTM publish: 0건
- Imweb code edit: 0건
- Meta/GA4/Google Ads/TikTok/Naver platform send/upload: 0건
- raw identifier output: 0건

## 바이오컴 브랜드검색 판단

바이오컴도 `naver_brandsearch` 별도 라인으로 처리하는 것이 맞다.

근거:

- 24시간 고객 유입 장부 top campaign에 `naverbrandsearch_biocom_MO_mainhome` 31건이 있다.
- `biocom_imweb` 주문 경로 원장 aggregate에서 `naver_brandsearch` 후보 1,275건, `payment_success` 후보 378건이 확인된다.
- 이전 정본 `project/naver-channel-classification-dry-run-20260521.md`도 브랜드검색은 일반 `paid_search`가 아니라 별도 class로 두라고 정리했다.

권장:

- 바이오컴과 더클린커피 모두 같은 공용 classifier를 쓴다.
- 브랜드검색은 광고 상품 evidence로 보되, 예산 ROAS에는 브랜드검색 광고비와 별도 join이 확인될 때만 사용한다.
- 일반 파워링크/검색광고와 섞지 않는다.

## 배포 재개 조건

아래 중 하나가 필요하다.

### 옵션 A. background sender side effect를 명시 승인

의미:

- `seo-backend` restart 후 기존 CAPI auto-sync가 실행될 수 있음을 승인한다.
- 브랜드검색 classifier 배포와 무관한 Meta CAPI 전송이 섞일 수 있다.

판단:

- 추천하지 않는다.
- 전송 side effect가 결과 해석을 흐릴 수 있다.

### 옵션 B. restart 동안 CAPI auto-sync를 임시 OFF로 두는 별도 승인

의미:

- 배포/restart 직전 `CAPI_AUTO_SYNC_ENABLED=0` 또는 background job OFF 전략을 적용한다.
- health 확인 후 classifier 배포만 먼저 닫는다.
- 이후 CAPI auto-sync 재개는 별도 승인 또는 별도 작업으로 처리한다.

판단:

- 가장 안전하다.
- 단, 운영 env 변경이므로 별도 승인 문구가 필요하다.

### 옵션 C. 배포 보류

의미:

- 로컬 patch와 승인안만 유지한다.
- 현재 VM Cloud는 그대로 둔다.

판단:

- 데이터 분류 개선은 늦어지지만 외부 전송 side effect는 피한다.

## 현재 판정

`HOLD_BEFORE_RESTART`

기술 blocker가 아니라 운영 side effect blocker다. 배포 파일 자체는 검증됐지만, restart가 기존 플랫폼 전송을 일으킬 수 있어 승인안 조건대로 중단했다.

