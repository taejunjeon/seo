작성 시각: 2026-05-25 06:27 KST
기준일: 2026-05-25
문서 성격: Meta 미매칭 주문 추가 매칭 가능성 Green Lane 조사 보고

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  required_context_docs:
    - utm/[바이오컴] UTM 관리 - Builder (자동소문자화 기능 있음).csv
    - backend/data/runtime-cache/meta-utm-diagnostics-cache.json
    - project/meta-utm-approved-exclusion-vm-deploy-result-20260524.md
  lane: Green
  allowed_actions:
    - read_only_vm_cloud_sqlite_query
    - local_file_read
    - dry_run_classification_review
    - documentation
  forbidden_actions:
    - production_db_write
    - vm_cloud_write_or_deploy
    - meta_api_mutation
    - external_platform_send
  source_window_freshness_confidence:
    source: VM Cloud attribution ledger read-only + 로컬 런타임 캐시 + UTM 관리 파일
    window: 2026-05-18~2026-05-24 KST
    freshness: runtime cache source_max_timestamp 2026-05-24, API smoke checked_at 2026-05-25 06:27 KST, VM Cloud payment_success max logged_at 2026-05-24T20:31:03Z
    site: biocom
    confidence: A for VM Cloud/cache counts, B for UTM-file reclassification proposal
```

## 10초 요약

현재 Meta 미매칭 주문을 더 봤을 때, UTM 관리 파일로 새로 **캠페인 확정**할 수 있는 묶음은 없었다.

다만 UTM 관리 파일 덕분에 `topbanner_MO` 2건, 매출 680,400원은 Meta 광고 미매칭이 아니라 자사몰 회원가입 상단띠배너 유입으로 분리할 수 있다. TJ님 승인으로 `ig/link_in_bio` 3건, 매출 702,000원도 별도 소셜 보조 유입으로 분리했다.

백엔드 dry-run과 캠페인 ROAS용 미매칭 필터에 반영한 뒤, 2026-05-25 06:27 KST 로컬 7020 API 기준 Meta 미매칭은 14건 5,038,200원으로 집계됐다.

## 조사 범위

- site: `biocom`
- 기간: 2026-05-18~2026-05-24 KST
- 원장 기준: VM Cloud SQLite read-only
- 화면/캐시 기준: `backend/data/runtime-cache/meta-utm-diagnostics-cache.json`
- UTM 기준: `utm/[바이오컴] UTM 관리 - Builder (자동소문자화 기능 있음).csv`
- 외부 전송/운영DB write/VM Cloud 배포: 0건
- 로컬 백엔드 코드 반영: 완료

## 현재 미매칭 구조

2026-05-25 06:27 KST API smoke 기준 현재 Meta UTM 진단의 원본 미매칭은 21건 6,903,900원이다.

승인된 제외 규칙인 Google Ads UTM 1건 36,900원, 신규가입 쿠폰 1건 446,400원, `topbanner_MO` 2건 680,400원, `ig/link_in_bio` 3건 702,000원을 빼면 화면상 조정 후 미매칭은 14건 5,038,200원이다.

조정 후 남은 14건의 구성은 아래와 같다.

| 묶음 | 건수 | 금액 | 현재 판정 | 이번 조사 결론 |
|---|---:|---:|---|---|
| UTM/랜딩 없음, fbclid만 있음 | 13 | 4,579,200원 | 미매칭 유지 | 내부 원장 조인으로도 캠페인 복구 불가 |
| Meta macro 미치환 | 1 | 459,000원 | 미매칭 유지 | 숫자 ID/고유 alias/랜딩 없음, 캠페인 복구 불가 |

## UTM 관리 파일로 추가 확인된 것

`topbanner_MO`는 UTM 관리 파일에 존재한다.

- 관리 메모: `자사몰_회원가입_상단띠배너_MO`
- 기본 URL: `https://biocom.kr/site_join_type_choice?back_url=Lw%3D%3D`
- UTM source/medium/campaign/content: `topbanner_mo`, `topbanner_mo`, `topbanner_MO`, `topbanner_MO`
- 처리된 후보 사전 위치: `utm/biocom-utm-mapping-candidates-20260522.csv`, `utm/biocom-utm-alias-summary-20260522.csv`
- 현재 분류: `other_utm`, `C_landing_alias_candidate`

따라서 이 2건은 Meta 유료 캠페인에 매출을 붙일 대상이 아니다. `fbclid`가 있어도, 결제 직전 UTM이 자사몰 내부 배너이면 Meta 캠페인 ROAS의 미매칭 주문으로 남기지 않는 것이 맞다.

## 내부 원장 흔적으로 확인한 것

`fbclid only` 빈 UTM 주문 묶음은 결제 성공 행에 GA 세션과 클라이언트 흔적이 있었다. 그러나 같은 세션의 `site_landing_ledger`를 결제 전 7일 범위로 붙여도 최신/이전 랜딩 모두 UTM이 비어 있었고, referrer도 self-domain이었다.

즉 이 묶음은 내부 원장에 남은 정보만으로는 캠페인, 광고세트, 광고 소재까지 복구할 수 없다. 현재 기준으로는 D급 quarantine이 맞다.

`paid_click_intent_ledger`와의 세션/클라이언트 조인도 결과가 없었다. 따라서 별도 click-intent 원장에도 이 13건을 살릴 단서가 없었다.

추가로 같은 주문키에 묶인 `checkout_started`, `payment_page_seen`, `payment_success` 전체를 다시 확인했다. 남은 주문들은 결제 시작부터 결제완료까지 모두 `/shop_payment` 계열 페이지였고, referrer는 self-domain이었다. 즉 고객이 이미 결제 페이지 안에 들어온 뒤의 Meta click cookie 흔적은 남았지만, 어떤 광고 캠페인에서 들어왔는지 알려주는 UTM/랜딩/숫자 ID는 남지 않았다.

`marketing_intent`를 같은 GA 세션/클라이언트 기준으로 7일 전까지 붙이는 조회도 결과가 없었다. 따라서 더 앞단의 마케팅 랜딩 신호가 누락됐거나, 현재 원장 보존 범위에 들어오지 않은 것으로 봐야 한다.

Meta CAPI 전송 로그도 확인했다. 이 로그는 Purchase가 Meta로 전송됐는지, event_id나 event_source_url이 무엇인지는 볼 수 있지만 campaign/adset/ad ID를 담는 구조가 아니어서 캠페인 매칭 근거로는 쓸 수 없다.

`ig/link_in_bio` 묶음은 결제 행과 랜딩 원장 모두 `utm_source=ig`, `utm_medium=social`, `utm_content=link_in_bio` 형태였다. 캠페인/세트/소재 숫자 ID는 없었다. TJ님 승인에 따라 유료 광고 캠페인 매출이 아니라 별도 소셜 보조 유입으로 분리했다.

`{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}` macro 미치환 묶음은 내부 랜딩 원장에서도 동일한 placeholder만 반복됐다. 숫자 ID나 고유 alias가 없어 캠페인 매핑은 불가하다.

## 적용하면 바뀌는 숫자

### 반영 후 확인된 것

로컬 백엔드 규칙 반영 후 7020 API에서 아래처럼 확인됐다.

- 원본 Meta 미매칭 후보: 21건 6,903,900원
- 제외된 비캠페인 유입: 7건 1,865,700원
- 반영 후 Meta 미매칭: 14건 5,038,200원
- 캠페인 ROAS용 `(unmapped)` 행: 14건 5,038,200원

이 변경은 캠페인 매출을 새 캠페인에 붙이는 것이 아니다. Meta 미매칭에 잘못 섞인 자사몰 내부 배너와 소셜 보조 유입을 제거하는 것이다.

## 결론

이번 조사에서 가능한 추가 처리는 두 종류다.

1. `topbanner_MO` 2건 680,400원은 UTM 파일 근거로 Meta 미매칭에서 제외했다.
2. `ig/link_in_bio` 3건 702,000원은 캠페인 매핑이 아니라 profile/link-in-bio 별도 소셜 보조 유입으로 제외했다.

반대로, `fbclid only` 13건 4,579,200원과 macro 미치환 1건 459,000원은 내부 원장 흔적으로 더 매칭할 수 없었다. 이 14건 5,038,200원은 실제 광고 URL, 숫자 campaign/adset/ad ID, 또는 더 앞단에서 저장된 클릭 ID가 필요하다.

내부 원장만으로 더 나눌 수 있는 현재 등급은 아래와 같다.

| 묶음 | 건수 | 금액 | 등급 | 이유 |
|---|---:|---:|---|---|
| fbclid/fbc/fbp 있음, UTM/랜딩 광고 ID 없음 | 13 | 4,579,200원 | D급 | Meta 클릭 cookie는 있으나 캠페인 증거가 없음 |
| Meta macro placeholder 그대로 남음 | 1 | 459,000원 | D급 | `{{campaign.id}}` 등이 치환되지 않아 숫자 ID가 없음 |

캠페인 매핑으로 승격하려면 내부 원장 밖의 보강 근거가 필요하다. 우선순위는 Meta Ads API의 광고별 실제 URL, 그로스팀 Ads Manager export, 또는 앞으로 `paid_click_intent` 수집에 campaign/adset/ad ID를 함께 저장하는 방식이다.

## 다음 할일

### Auto Green

1. `topbanner_MO`를 Meta 미매칭 제외 dry-run 규칙에 추가한다.
   - 담당: Codex
   - 상태: 완료
   - 왜 하는가: 자사몰 내부 배너 매출이 Meta 미매칭으로 남아 ROAS 판단을 흐리는 것을 줄인다.
   - 어떻게 하는가: 백엔드 분류 함수에 `topbanner_mo`/`topbanner_MO` 전용 제외 규칙을 추가하고 로컬 smoke로 제외 합계에 2건 680,400원이 들어가는지 확인했다.
   - 승인 필요 여부: Green. 코드 패치와 로컬 검증은 승인 불필요, VM Cloud 반영은 별도 승인 필요.
   - 성공 기준: meta-utm diagnostics dry-run bucket에 `exclude_from_meta_internal_site_banner_by_utm_file` 계열이 생기고 2건 680,400원이 제외 합계에 들어간다.

2. `ig/link_in_bio`를 별도 소셜 보조 유입으로 승인 제외한다.
   - 담당: Codex
   - 상태: 완료
   - 왜 하는가: 유료 Meta 캠페인 ROAS에는 붙일 수 없지만 profile/link-in-bio 유입은 별도 보조 지표로 보아야 하기 때문이다.
   - 어떻게 하는가: 백엔드 분류 함수에 `exclude_from_meta_ig_profile_link_by_approval` 규칙을 추가하고 캠페인 ROAS용 미매칭 필터에서도 제외했다.
   - 승인 필요 여부: TJ님 승인 완료, 로컬 반영 완료, VM Cloud 반영은 별도 승인 필요.
   - 성공 기준: meta-utm diagnostics dry-run bucket에 3건 702,000원이 YES 제외로 들어간다.

### Approval Needed

1. VM Cloud 반영 여부를 결정한다.
   - 담당: TJ님
   - 왜 하는가: 현재 로컬 7020에는 반영됐지만, `att.ainativeos.net` 프론트/API에 반영하려면 VM Cloud 배포/재시작이 필요하다.
   - 어떻게 하는가: TJ님이 “VM Cloud 반영해”라고 승인하면 Codex가 배포 후 `/api/ads/meta-utm-diagnostics`와 `/api/ads/roas`를 smoke 한다.
   - 성공 기준: VM Cloud에서도 Meta 미매칭이 14건 5,038,200원으로 보인다.

### Blocked/Parked

1. `fbclid only` 12건과 macro 미치환 1건의 캠페인 매핑은 보류한다.
   - 이유: 내부 원장에 캠페인/세트/소재를 복구할 숫자 ID, 고유 alias, 랜딩 경로가 없다.
   - 다시 열 조건: 그로스팀 실제 광고 URL, Ads Manager export, Meta API의 광고별 landing URL, 또는 앞으로의 클릭 수집 개선으로 숫자 ID가 들어올 때.
