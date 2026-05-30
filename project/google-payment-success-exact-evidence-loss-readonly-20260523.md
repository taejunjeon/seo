# Google payment_success exact evidence 유실 지점 재조사

작성 시각: 2026-05-23 23:28 KST
최종 재조회/정정: 2026-05-23 23:31 KST
기준일: 2026-05-23
문서 성격: Green Lane read-only 진단 결과

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - data/!data_inventory.md
    - imweb/!coderule.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_readonly
    - local_code_readonly
    - aggregate_diagnostics
    - documentation
  forbidden_actions:
    - google_ads_conversion_upload
    - meta_or_ga4_or_tiktok_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - gtm_publish
    - raw_order_or_click_id_output
  source_window_freshness_confidence:
    source: VM Cloud SQLite read-only + local backend code
    window: "2026-05-21 21:15 KST 이후, 보조 click ledger는 2026-05-16 이후"
    freshness: "2026-05-23 23:31 KST 조회"
    confidence: "high for VM Cloud aggregate counts, medium_high for root-cause classification"
```

## 10초 요약

`payment_success`는 “결제완료 신호”다. 이 row에 Google click id가 직접 남아야 Google Ads에 실제 결제완료 주문을 안전하게 다시 연결할 수 있다.

재조사 결론은 두 갈래다. TJ님이 직접 진행한 Google 광고 테스트 주문들은 결제완료 row까지 click id가 보존됐다. 반면 2026-05-21 21:15 KST 이후 자연 발생한 confirmed 결제완료 111건은 payment_success row 자체에 직접 click id가 0건이었다.

유실 지점은 “테스트 흐름의 저장 실패”가 아니라, 실제 confirmed row에 대해 `payment_success` payload와 현재 health 계산이 유입/유료클릭 장부의 세션 evidence를 결제완료 row로 승격하지 않는 지점이다. 특히 1건은 같은 GA 세션에서 결제 1.3분 전 `gclid`가 VM Cloud 유입/유료클릭 장부에 있었지만, dashboard health 계산에는 포함되지 않았다. 단, 이 1건도 client id까지 엄격히 일치하지는 않아 Google Ads upload 후보가 아니라 내부 진단용 bridge 후보로만 봐야 한다.

## 확인한 숫자

Source: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` read-only
Site: biocom
Window: 2026-05-21 21:15 KST 이후
Freshness: 2026-05-23 23:31 KST

| 구간 | rows | 직접 Google click evidence | gclid | gbraid | wbraid | gad_campaignid |
|---|---:|---:|---:|---:|---:|---:|
| checkout_started live | 296 | 25 | 25 | 4 | 0 | 1 |
| payment_page_seen live | 838 | 67 | 67 | 8 | 0 | 2 |
| payment_success confirmed live | 111 | 0 | 0 | 0 | 0 | 0 |
| payment_success pending live | 4 | 0 | 0 | 0 | 0 | 0 |
| payment_success canceled live | 2 | 1 | 1 | 1 | 0 | 0 |

해석:

- 결제 시작과 결제 페이지 단계에는 Google click id가 들어온다.
- 확정 결제 row 111건은 `google_click_id_present=false`, `google_click_id_type=none`, `click_id_restore_source=none`이다.
- 111건 중 109건은 checkout context 버전이 있으므로 결제 흐름 저장 자체가 완전히 빠진 것은 아니다. 다만 그 context 안에 click id가 없었다.

## TJ님 Google 광고 테스트 주문 확인

Raw order id와 click id 원문은 출력하지 않았다. TJ님이 대화에서 제공한 Google 광고 테스트 주문 5건은 익명 라벨로만 확인했다.

결과:

- `TJ_google_test_1~3`: 구버전 checkout context 기준이지만 `payment_page_seen`, `checkout_started`, `payment_success canceled` 모두 Google click evidence가 있었다.
- `TJ_google_test_4~5`: 2026-05-21 v4.4.3 보강 이후 기준이며 `payment_page_seen`, `checkout_started`, `payment_success canceled` 모두 Google click evidence가 있었다.
- v4.4.3 이후 테스트 2건은 `restoreSource=checkout_context_v4_4_3`, `checkoutContextVersion=2026-05-21-biocom-checkout-started-click-id-v4-3`, `clickContextVersion=2026-05-21-biocom-click-id-bootstrap-v1-1`로 확인됐다.

해석:

- 아임웹 헤더/푸터 v4.4.3 계열이 “Google 광고 클릭 → 결제완료 페이지”에서 무조건 click id를 잃는 상태는 아니다.
- 다만 이 테스트 주문들은 이후 결제 정본에서는 canceled로 분류됐다. Google Ads upload 후보나 내부 confirmed ROAS 분자로 쓰면 안 된다.

## 실제 유실 지점

### 1. payment_success row 자체에는 직접 click id가 없다

확정 결제 111건은 직접 `gclid/gbraid/wbraid`가 0건이다. metadata 안에도 실제 값은 없고, `has_gclid=false`, `has_gbraid=false`, `has_wbraid=false` 상태다.

즉 현재 health 카드가 `payment_success confirmed` row만 보면 0%가 나온다.

### 2. 같은 GA 세션의 유입/유료클릭 장부에는 연결 가능한 후보가 1건 있다

보조 click ledger window: 2026-05-16 이후

- site_landing Google click rows: 8,952
- paid_click_intent Google click rows: 9,326
- confirmed 111건 중 결제 24시간 이내 같은 GA 세션 prior click 후보: 1건
- strict client id까지 같이 일치하는 후보: 0건
- 결제 이후 click으로 보이는 invalid same-client 후보: 1건. 이 row는 confirmed 주문 근거로 쓰면 안 된다.

유효 후보 1건의 패턴:

- 결제완료 row: 2026-05-23 10:43 KST 근처
- 같은 GA 세션의 site_landing/paid_click_intent row: 결제 1.3분 전
- click id type: `gclid`
- capture stage: `checkout_start`, `npay_intent`, `landing`
- landing path: `/HealthFood/`

해석:

- 최소 1건은 `payment_success` row 자체에는 click id가 없지만, 같은 GA 세션의 VM Cloud 유입/유료클릭 장부에는 결제 직전 `gclid`가 있었다.
- 이 1건은 현재 dashboard의 `Google click id 보존률` 계산에서 누락된다.
- 다만 client id 엄격 일치가 아니므로, 화면에서는 `upload 후보`가 아니라 `prior-session bridge 후보`로 분리해야 한다.

### 3. 현재 health 계산은 site_landing / paid_click_intent 세션 bridge를 보지 않는다

현재 코드의 주문 기준 click id health는 아래 두 source만 본다.

- `payment_success confirmed` row 자체의 `gclid/metadata/landing/referrer`
- `npay_intent_log.matched_order_no`

반면 이번에 유효 후보가 나온 source는 다음 둘이다.

- `site_landing_ledger`의 `ga_session_id/client_id`
- `paid_click_intent_ledger`의 `ga_session_id/client_id`

따라서 결제완료 row에 직접 click id가 없더라도 같은 세션에서 결제 직전 Google click이 확인되는 주문이 현재 0% 카드에 묻힌다.

## 코드상 원인 메모

- `backend/src/routes/googleAds.ts`의 click id health 계산은 confirmed 주문을 `payment_success` row와 `npay_intent_log`로만 붙인다.
- `site_landing_ledger`와 `paid_click_intent_ledger`의 `ga_session_id/client_id` 기반 prior-click bridge는 아직 health에 없다.
- `backend/src/siteLandingFanout.ts`는 `gbraid/wbraid`를 `payment_success` fanout에서 직접 click id로 고르지 않는다. 단, 이번 confirmed 111건의 본체는 `gbraid/wbraid`만 빠진 문제가 아니라 `gclid`도 직접 0건인 문제다.
- `payment_success` firstTouch enrichment는 `checkout_started` 또는 `marketing_intent` existing ledger만 후보로 본다. `site_landing_ledger`와 `paid_click_intent_ledger`는 firstTouch 후보가 아니다.

## 결론

현재 상태를 “보강이 안 됐다”고 보는 것은 반만 맞다.

Google 광고 테스트 흐름은 결제완료 row까지 click id 보존이 된다. 하지만 자연 발생 confirmed 주문 대부분은 Google click evidence가 없고, 최소 1건의 결제 직전 세션 click evidence도 현재 health 계산이 줍지 못한다.

따라서 다음 보강은 새 태그부터 다시 의심하기보다, `payment_success confirmed`를 `site_landing_ledger`와 `paid_click_intent_ledger`의 prior session click으로 read-only matching하는 것이다.

## 다음 할일

### Auto Green

1. `payment_success confirmed`용 session bridge matcher를 read-only로 구현한다.
   - 무엇: 운영DB 주문 row를 VM Cloud `payment_success confirmed`, `site_landing_ledger`, `paid_click_intent_ledger`와 `ga_session_id/client_id`로 연결한다.
   - 왜: 결제완료 row에 직접 click id가 없어도 같은 세션에서 결제 직전 click이 있으면 내부 판단용 evidence로 살릴 수 있다.
   - 어떻게: payment timestamp보다 이전 click만 허용하고, 결제 후 click은 제외한다. 동일 GA 세션 다중 click은 closest prior click 1건만 선택한다. client id까지 일치하면 `strict`, GA 세션만 일치하면 `diagnostic`으로 분리한다.
   - 성공 기준: 2026-05-21 21:15 KST 이후 confirmed 111건 중 direct 0건과 prior-session evidence 1건이 분리 표시된다.
   - 승인: 불필요. read-only / no-write.

2. `/ads/google-roas-report`에는 direct 보존률과 prior-session bridge 후보를 분리해 표시한다.
   - 무엇: `직접 보존`, `세션 bridge 후보`, `upload 불가/검토 필요`를 따로 보여준다.
   - 왜: 0%가 “아무 evidence 없음”인지 “payment_success 직접 보존만 없음”인지 헷갈리지 않게 한다.
   - 성공 기준: 카드에 direct 0/111, valid prior-session 1/111이 함께 보인다.
   - 승인: 로컬 프론트/백엔드 구현은 불필요, VM Cloud 배포는 Yellow 승인 필요.

### Approval Needed

1. read-only matcher를 VM Cloud backend에 배포한다.
   - 무엇: API 응답에 session bridge health를 추가한다.
   - 왜: 로컬 보고서가 아니라 운영 화면에서 실제 기준 수치를 보려면 VM Cloud backend 배포가 필요하다.
   - 성공 기준: `https://biocom.ainativeos.net/ads/google-roas-report` 또는 로컬 프록시 화면에서 direct와 prior-session이 분리된다.
   - 승인: 필요. VM Cloud backend deploy.

### Blocked/Parked

1. Google Ads upload는 계속 보류한다.
   - 이유: prior-session 1건은 내부 진단용으로는 강하지만, Google Ads upload 후보로 바로 쓰려면 duplicate guard, click id 원문/해시 정책, conversion time, consent/전송 승인까지 별도 Red Lane이 필요하다.
   - 현재 상태: upload candidate 0 유지.
