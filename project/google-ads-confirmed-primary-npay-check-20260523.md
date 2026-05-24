작성 시각: 2026-05-23 12:32 KST
추가 갱신: 2026-05-23 21:50 KST
기준일: 2026-05-23
문서 성격: Google confirmed 주문 재조회 + Google Ads 구매완료 Primary 전환 분해 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_read_only_query
    - public_dashboard_api_read_only
    - conversion_action_breakdown
    - result_documentation
  forbidden_actions:
    - operating_db_write
    - vm_cloud_write_or_schema_change
    - google_ads_conversion_upload_or_send
    - google_ads_setting_change
    - gtm_publish
    - backend_deploy
    - raw_order_or_click_id_output
    - raw_npay_order_or_google_click_detail_output
  source_window_freshness_confidence:
    source:
      - VM Cloud SQLite /home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3
      - 운영DB public.tb_iamweb_users read-only
      - Google Ads dashboard API /api/google-ads/dashboard
      - 운영DB NPay actual snapshot through dashboard API
    window:
      - post patch: 2026-05-21 21:15 KST onward
      - checkpoint: 2026-05-23 10:00 KST onward
      - ads: last_7d / last_30d
    freshness:
      - VM Cloud payment_success latest logged_at: 2026-05-23T02:49:59Z
      - Google Ads dashboard fetched_at: 2026-05-23T08:35Z
      - Google Ads direct API hour segment checked_at: 2026-05-23T08:32Z
    confidence: high for aggregate counts, medium_high for NPay interpretation because order-level Google click join is not yet wired
```

## 10초 요약

2026-05-23 10:00 KST 이후 새 결제완료 신호는 들어왔지만 Google click/UTM/gad_campaignid 증거가 있는 confirmed 주문은 0건이다.
Google Ads의 `구매완료` Primary 전환은 실제 NPay 구매를 일부 포함할 수 있으나, Google Ads 주장 금액 전체를 내부 confirmed 매출로 보면 안 된다.
최신 last_7d Google Ads 주장 전환가치는 37,556,865원, ROAS는 9.60이다.
NPay matcher를 재실행하니 같은 7일 window에서 NPay 실제 결제완료 주문 25건 중 19건은 intent와 strong match, 그중 13건은 A급 strong match다.
보강 이후 window에서도 NPay 실제 결제완료 1건/496,000원이 A급 strong match로 잡힌다.
A급 strong match 13건의 Imweb 주문번호와 NPay channel order no 26개 ID를 GA4 robust guard로 조회한 결과, GA4 present 0개 / robust_absent 26개다.

## 1. Google confirmed 주문 재조회

기준:
- 보강 기준점: 2026-05-21 21:15 KST.
- 10시 checkpoint: 2026-05-23 10:00 KST.
- source: VM Cloud SQLite `attribution_ledger`.
- 개인정보/식별자 처리: raw order number, order_code, payment_code, gclid, gbraid, wbraid는 출력하지 않음.

### 결과

| 기준 | 전체 payment_success | confirmed | Google 증거 있는 주문 | Google confirmed | Google pending | click id 보존 |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05-21 21:15 KST 이후 | 129 | 122 | 1 | 0 | 1 | 1 |
| 2026-05-23 10:00 KST 이후 | 14 | 13 | 0 | 0 | 0 | 0 |

해석:
- 10:00 KST 이후 confirmed 주문은 13건 새로 들어왔다.
- 그중 Google 증거가 있는 confirmed 주문은 0건이다.
- 보강 이후 Google 증거가 있는 주문은 1건이며, 미입금 가상계좌 pending이고 click id는 보존됐다.
- 따라서 현재 상태는 `Google confirmed 표본 없음`이다. 보강 실패라고 단정하지 않는다.

## 2. Google Ads 구매완료 Primary 전환 분해

용어:
- Primary 전환: Google Ads가 입찰 학습에 쓰는 핵심 전환 신호.
- Secondary 전환: 입찰에는 쓰지 않고 관찰 지표로 보는 보조 전환.
- 내부 confirmed ROAS: 실제 결제완료 주문 원장 기준 ROAS.
- Google Ads ROAS: 광고 플랫폼이 자체 전환 태그/모델로 주장하는 ROAS.

### last_7d

주의: 이 절은 2026-05-23 12:32 KST snapshot이다. 17:35 KST 최신 dashboard 수치는 5.2에 별도 기록했다.

| 항목 | Google Ads 주장값 | 내부 confirmed 기준 | 내부 confirmed + NPay 실제 결제 보정 |
|---|---:|---:|---:|
| 비용 | 3,911,183원 | 3,911,183원 | 3,911,183원 |
| 전환/주문 | 262.87 | 5 | 5 + NPay 32 |
| 전환가치/매출 | 37,425,495원 | 1,006,827원 | 6,529,827원 |
| ROAS | 9.57 | 0.26 | 1.67 |

전환 액션:

| 전환 액션 | 속성 | 전환수 | 전환가치 | 해석 |
|---|---|---:|---:|---|
| 구매완료 | Primary / PURCHASE / MANY_PER_CLICK / known NPay label | 260.88 | 37,425,493원 | 입찰 핵심값의 거의 전부다. 실제 NPay 구매를 포함할 수 있으나 내부 confirmed와 1:1 검증된 값은 아니다. |
| TechSol - NPAY구매 50739 | Secondary / PURCHASE / known NPay label | 0 | 0원 | Conv. value에는 안 들어가지만 All conv. value에는 35,942,443원이 잡힌다. |
| sign_up | Primary / SIGNUP | 2 | 2원 | 구매가 아닌 전환이 Primary에 섞여 있다. |
| 장바구니에 추가 | Primary / ADD_TO_CART | 0 | 0원 | 매출값은 없지만 Primary 설정 여부는 확인 필요하다. |

NPay 비교:
- Google `구매완료` 전환가치: 37,425,493원.
- 내부 NPay 실제 결제완료 보정 매출: 5,523,000원.
- Google `구매완료` 전환가치가 내부 NPay actual보다 6.78배 크다.
- Google `구매완료` 전환수 260.88건은 내부 NPay actual 32건보다 8.15배 크다.

### last_30d

| 항목 | Google Ads 주장값 | 내부 confirmed 기준 | 내부 confirmed + NPay 실제 결제 보정 |
|---|---:|---:|---:|
| 비용 | 19,620,103원 | 19,620,103원 | 19,620,103원 |
| 전환/주문 | 2,122.76 | 20 | 20 + NPay 224 |
| 전환가치/매출 | 219,155,643원 | 4,116,027원 | 42,042,927원 |
| ROAS | 11.17 | 0.21 | 2.14 |

NPay 비교:
- Google `구매완료` 전환가치: 219,155,622원.
- 내부 NPay 실제 결제완료 보정 매출: 37,926,900원.
- Google `구매완료` 전환가치가 내부 NPay actual보다 5.78배 크다.
- Google `구매완료` 전환수 2,102.34건은 내부 NPay actual 224건보다 9.39배 크다.

## 3. NPay 전환 해석

TJ님 질문에 대한 답:

`구글애즈 네이버페이 전환도 실제 구매가 일어난 것일 수 있다`는 말은 맞다.
NPay 전환 자체를 가짜로 보면 안 된다.

다만 현재 예산 판단에는 아래처럼 분리해야 한다.

1. 실제 NPay 결제완료는 내부 매출에 포함해야 한다.
2. NPay 클릭, 결제 시작, 결제완료를 구분해야 한다.
3. Google Ads가 잡은 NPay `구매완료` 전체를 내부 confirmed 매출로 그대로 쓰면 안 된다.
4. 이유는 Google Ads `구매완료` 전환가치가 내부 NPay 실제 결제완료 매출보다 5.78~6.78배 크기 때문이다.
5. Google Ads가 실제 구매 일부를 맞게 잡았더라도, order-level exact bridge가 없으면 어떤 주문이 Google 클릭에서 온 실제 결제완료인지 검증할 수 없다.

## 4. 현재 판정

- Google confirmed 주문 재조회: HOLD.
- HOLD 원인: `time_waiting` + `missing_click_bridge`.
- Google Ads `구매완료` Primary 실제 구매 여부: 부분 YES.
- Google Ads `구매완료` Primary를 내부 confirmed purchase로 동일시 가능 여부: NO.
- Google Ads upload candidate: 0.
- 운영DB write / Google Ads send / 전환 설정 변경: 0.

## 5. 2026-05-23 17:35 KST 추가 dry-run

목적:
- NPay 실제 결제완료 주문과 Google 클릭 증거를 order-level로 붙일 수 있는지 read-only로 확인.
- 2026-05-21 21:15 KST 아임웹 헤더/푸터 보강 이후 Google Ads가 주장하는 ROAS를 별도 확인.
- Google Ads 주장 ROAS의 기준이 되는 주문 세부 내역을 API로 뽑을 수 있는지 확인.

실행 범위:
- 운영DB `tb_iamweb_users` read-only.
- VM Cloud SQLite `attribution_ledger`, `npay_intent_log` read-only.
- Google Ads API read-only.
- 외부 전환 전송, DB write, 설정 변경 없음.
- raw order number, order_code, payment_code, gclid, gbraid, wbraid 출력 없음.

### 5.1 NPay 실제 결제완료 order-level bridge dry-run

집계 기준:
- `last_7d_dashboard`: 2026-05-16~2026-05-22 KST.
- `post_patch`: 2026-05-21 21:15 KST 이후.
- `after_2026_05_23_10kst`: 2026-05-23 10:00 KST 이후.

결과:

| window | NPay 실제 결제완료 주문 | NPay 실제 결제완료 매출 | exact evidence rows | Google click rows | Google click 매출 | evidence rate |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05-16~2026-05-22 KST | 25 | 5,073,900원 | 0 | 0 | 0원 | 0% |
| 2026-05-21 21:15 KST 이후 | 1 | 496,000원 | 0 | 0 | 0원 | 0% |
| 2026-05-23 10:00 KST 이후 | 0 | 0원 | 0 | 0 | 0원 | - |

해석:
- NPay 실제 결제완료 주문은 있다.
- 하지만 현재 VM Cloud evidence에서는 NPay 실제 결제완료 주문과 Google click id가 exact order-level로 붙는 건 0건이다.
- `npay_intent_log`의 exact `matched_order_no` evidence도 0건이라, NPay intent → 실제 주문번호 bridge가 아직 운영 기준으로 살아있다고 보기 어렵다.
- 따라서 `NPay가 실제 구매가 아니다`가 아니라, `실제 NPay 구매를 Google 클릭 주문으로 증명하는 order-level bridge가 없다`가 현재 정확한 판정이다.

### 5.2 Google Ads 주장 ROAS: 7d와 보강 이후

최신 public dashboard 조회:
- fetched_at: 2026-05-23T08:35:54Z.
- date_preset: `last_7d`.
- 기준일 범위: 2026-05-16~2026-05-22 KST.

| 기준 | 비용 | Google Ads 전환수 | Google Ads 전환가치 | Google Ads ROAS |
|---|---:|---:|---:|---:|
| last_7d 최신 dashboard | 3,911,183원 | 264.87 | 37,556,865원 | 9.60 |
| 2026-05-21~2026-05-23 전체 날짜 | 1,232,589원 | 83.61 | 14,089,203원 | 11.43 |
| 2026-05-21 21시 이후 근사 | 920,136원 | 56.61 | 11,110,503원 | 12.07 |
| 2026-05-22~2026-05-23 날짜 기준 | 839,829원 | 52.61 | 10,402,703원 | 12.39 |
| 2026-05-22 첫 full day | 542,105원 | 35.61 | 6,645,303원 | 12.26 |
| 2026-05-23 당일 partial | 약 298,168원 | 17.00 | 3,757,400원 | 12.60 |

주의:
- Google Ads API의 `segments.hour`는 시간 단위라 2026-05-21 21:15 KST 이후를 분 단위로 정확히 자르지 못한다.
- 그래서 `2026-05-21 21시 이후 근사`는 21:00~21:14까지 일부 pre-patch 시간을 포함한다.
- 가장 보수적인 보강 이후 Google 주장값은 `2026-05-22 첫 full day 이후`로 보는 것이 낫다.

### 5.3 Google 주장 ROAS의 주문 세부 내역 추출 가능성

판정:
- Google Ads API에서 캠페인/전환액션/날짜/시간별 성과 집계는 뽑을 수 있다.
- 하지만 Google Ads가 주장하는 ROAS를 구성한 개별 주문 row 목록은 일반 보고 API에서 직접 뽑는 구조가 아니다.
- Google 문서상 전환 보고는 conversion action 또는 campaign/ad group/keyword 같은 리소스의 conversion metric 조회 중심이다.
- `order_id`는 주로 전환 보정/조정에서 기존 전환을 식별하는 키로 쓰는 것이며, 이 키를 우리 원장에 함께 보존해야 나중에 order-level 검증이 가능하다.

근거:
- Google Ads API Conversion reporting: https://developers.google.com/google-ads/api/docs/conversions/reporting
- Google Ads API Reporting overview: https://developers.google.com/google-ads/api/docs/reporting/overview
- Google Ads API Conversion adjustments/order_id: https://developers.google.com/google-ads/api/docs/conversions/upload-adjustments

실무 결론:
- Google Ads 화면의 ROAS 기준 주문 세부 내역을 Google에서 그대로 내려받는 방식은 기대하기 어렵다.
- 우리가 통제 가능한 정답은 `내부 confirmed order ledger + click id/order_id 보존 + offline/import ledger`다.
- 따라서 앞으로 Google Ads에 실제 결제완료만 알려주는 observed conversion을 만들려면, Google Ads가 보정에 쓸 `order_id`와 내부 주문번호를 우리 원장에 먼저 정확히 남겨야 한다.

### 5.4 NPay bridge 코드 경로 Green audit

확인한 코드:
- `backend/src/routes/attribution.ts`: `POST /api/attribution/npay-intent`는 `npay_intent_log`에 intent를 저장한다.
- `backend/src/npayIntentLog.ts`: `matched_order_no`, `matched_order_amount`, `matched_payment_method`, `matched_at`, `match_confidence`, `match_reason` 컬럼이 있다.
- `backend/src/routes/googleAds.ts`: Google Ads dashboard는 `npay_intent_log.matched_order_no`가 채워진 row만 exact evidence로 본다.

해석:
- 저장 테이블과 exact join 컬럼은 이미 설계되어 있다.
- 현재 병목은 `NPay intent 저장 자체가 최신 live에서 얼마나 들어오는지`와 `matched_order_no를 채우는 matcher가 운영 루프로 돌고 있는지`다.
- 오늘 첫 dry-run에서 exact evidence가 0건이었던 이유는 `npay_intent_log.matched_order_no` 영구 컬럼 기준만 봤기 때문이다.
- read-only matcher를 재실행하면 운영DB 주문과 intent 사이의 임시 match 후보는 나온다.
- 따라서 현재 병목은 `영구 컬럼이 비어 있음`과 `GA4 존재 여부 guard가 unknown`인 상태다.

### 5.5 NPay intent → 실제 주문번호 matcher 재실행 결과

실행:
- VM Cloud에서 `scripts/npay-roas-dry-run.ts`를 read-only로 실행.
- SQLite source: `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3`.
- 운영DB source: `public.tb_iamweb_users`.
- 출력: aggregate only. raw 주문번호/click id는 보고서에 남기지 않음.
- 전송/write/deploy: 0.

#### 보강 이후 window

기준:
- 2026-05-21 21:15 KST ~ 2026-05-23 23:59:59 KST.

| 항목 | 값 |
|---|---:|
| live NPay intent | 68 |
| NPay 실제 결제완료 주문 | 1 |
| strong match | 1 |
| A급 strong match | 1 |
| strong match 금액 | 496,000원 |
| ambiguous | 0 |
| purchase without intent | 0 |
| clicked no purchase | 42 |
| intent pending | 25 |
| dispatcher dry-run candidate | 0 |
| GA4 lookup unknown | 1 |

해석:
- 보강 이후 NPay 실제 결제완료 1건은 intent와 A급으로 붙는다.
- 즉 `NPay actual ↔ click intent bridge` 자체는 동작 가능하다.
- 다만 GA4 robust guard가 아직 unknown이라 실제 전송 후보는 0건으로 막힌다.

#### 7일 window

기준:
- 2026-05-16 00:00 KST ~ 2026-05-23 23:59:59 KST.

| 항목 | 값 |
|---|---:|
| live NPay intent | 340 |
| NPay 실제 결제완료 주문 | 25 |
| strong match | 19 |
| A급 strong match | 13 |
| B급 strong match | 6 |
| ambiguous | 6 |
| purchase without intent | 0 |
| strong match 금액 | 3,556,100원 |
| A급 strong match 금액 | 1,956,900원 |
| clicked no purchase | 296 |
| intent pending | 25 |
| dispatcher dry-run candidate | 0 |
| GA4 lookup unknown | 25 |

clicked no purchase 상위:
- 혈당관리엔 당당케어: 86건.
- 바이오밸런스 90정: 69건.
- 종합 호르몬균형 분석: 52건.
- 종합 대사기능&음식물 과민증 검사 Set: 21건.
- 메타드림 식물성 멜라토닌 함유: 19건.

클릭 evidence:
- clicked no purchase 중 `gclid+fbp` 조합이 247건, 83.45%.
- 따라서 Google 클릭은 많이 들어오고, NPay 구매까지 일부 이어진다.
- 병목은 `click intent → confirmed purchase` 임시 matcher 결과를 영구 exact evidence나 GA4/Google Ads observed conversion 후보로 승격하는 guard 단계다.

#### GA4 robust guard

실행:
- 대상: 7일 window의 A급 strong match 13건.
- 조회 ID: Imweb 주문번호 + NPay channel order no, 총 26개 ID.
- source dataset: `hurdlers-naver-pay.analytics_304759974`.
- window: `20260516~20260523`.
- 조회 범위: `ecommerce.transaction_id`, `event_params.transaction_id`, event_params 전체 값, `events_*`, `events_intraday_*`.
- 전송/write/deploy: 0.

결과:

| 항목 | 값 |
|---|---:|
| 조회 ID | 26 |
| GA4 present | 0 |
| GA4 robust_absent | 26 |
| event_name match | 0 |

해석:
- A급 strong match 13건은 GA4에 이미 purchase로 들어간 흔적이 없다.
- 따라서 GA4 중복 guard는 통과한다.
- 아직 Google Ads upload/send 후보는 아니다. Google Ads 전환 action 생성, upload 승인, exact evidence 영구화가 모두 남아 있다.

하네스 준수 메모:
- 이 matcher 재실행은 Green Lane이었다.
- TJ님 지적대로 이전 응답에서 다음 할 일로 넘기지 말고 바로 실행했어야 했다.
- 공통 하네스 세팅은 이미 `Green Lane 자율 실행` 원칙을 담고 있으므로 세팅 부재보다는 Codex 준수 미흡이다.
- 개선 기준: HOLD가 나오면 `승인 대기`로 넘기기 전, read-only matcher/guard/dry-run을 먼저 끝낸 뒤 남은 Red/권한/사업판단만 TJ님에게 넘긴다.

## 6. 다음 판단 기준

1. Google 증거가 있는 confirmed 주문이 3건 이상 생기면 click id 보존률을 다시 산출한다.
2. Google Ads `구매완료` Primary를 유지할지 결정하기 전, 실제 NPay confirmed 주문과 Google click evidence를 order-level로 연결하는 bridge가 필요하다.
3. GA4 robust guard까지 닫힌 A급 후보 13건은 exact evidence 영구 반영 설계 대상으로 올린다.
4. Google Ads에는 실제 결제완료 주문만 알려주는 새 observed conversion을 먼저 만들고, 충분히 맞는지 본 뒤 Primary 전환 여부를 판단해야 한다.

## 7. 2026-05-23 22:05 KST 후속 설계 및 화면 존재 확인

추가로 확인한 것:
- Google ROAS 정합성 프론트엔드 보고서 페이지는 존재한다.
- 경로는 `/ads/google-roas-report`이고, 로컬 URL은 `http://localhost:7010/ads/google-roas-report`다.
- 구현 파일은 `frontend/src/app/ads/google-roas-report/page.tsx`다.
- 홈/AI CRM 카드에서도 `frontend/src/app/page.tsx`를 통해 연결되어 있다.
- 정적 `.html` 파일이 아니라 Next.js report page가 브라우저에 HTML로 렌더링되는 구조다.

추가 문서:
- `project/google-roas-npay-exact-evidence-design-20260523.md`: NPay matcher 결과를 영구 exact evidence로 반영하는 설계안.
- `harness/gdn/GREEN_FOLLOWUP_CHECKLIST.md`: HOLD 이후 Codex가 먼저 끝내야 하는 Green follow-up 체크리스트.

설계 결론:
- A급 strong match 13건은 바로 Google Ads에 보내는 후보가 아니다.
- 먼저 VM Cloud에 append-only exact evidence snapshot으로 영구화하는 것이 안전하다.
- 기존 `npay_intent_log.matched_order_no`를 바로 업데이트하기보다, matcher version, window, GA4 guard status, block reason을 함께 남기는 별도 snapshot을 권장한다.
- 이 snapshot write/schema 변경은 승인 전 실행하지 않는다.
