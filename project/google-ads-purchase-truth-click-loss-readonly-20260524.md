# Google Ads 구매완료 진짜 구매 여부와 click id 마지막 유실 지점 read-only

작성 시각: 2026-05-24 00:32 KST
문서 성격: Green Lane read-only 조사 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - docs/report/text-report-template.md
  required_context_docs:
    - imweb/!coderule.md
    - project/google-payment-success-exact-evidence-loss-readonly-20260523.md
    - project/google-ads-confirmed-primary-npay-check-20260523.md
  lane: Green
  allowed_actions:
    - Google Ads API read-only 조회
    - VM Cloud SQLite read-only SELECT
    - 로컬 문서 작성
  forbidden_actions:
    - Google Ads 전환 액션 설정 변경
    - Google Ads offline conversion upload
    - GTM 또는 Imweb 운영 코드 변경
    - VM Cloud/운영DB write
    - 배포/restart
  source_window_freshness_confidence:
    google_ads:
      source: Google Ads API via local backend
      window: last_7d, 2026-05-17..2026-05-23
      freshness: 2026-05-24 00:32 KST 조회
      confidence: high for action-level last_7d, medium for 2026-05-22..23 action split because current backend route exposes daily total but not custom action daily
    vm_cloud:
      source: VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3
      window: 2026-05-21 21:15 KST 이후
      freshness: latest payment_success 2026-05-24 00:20 KST
      confidence: high for aggregate counts
```

## 한 줄 결론

Google Ads가 `구매완료`라고 세는 숫자는 현재 내부 원장의 실제 Google-click 결제완료와 맞지 않는다. 5월 21일 밤 보강 이후 Google 클릭은 유입 장부에 잘 남지만, 자연 발생한 실제 결제완료 주문 114건 중 Google click id가 직접 붙은 주문은 0건이다.

## 기준 시점

Biocom Imweb의 Google click id/checkout/payment tracking 기준점은 2026-05-21 21:15 KST로 보는 것이 맞다.

- 실제 코드 marker 기준:
  - `2026-05-21-biocom-click-id-bootstrap-v1-1`
  - `2026-05-21-biocom-checkout-started-click-id-v4-3`
  - `2026-05-21-biocom-payment-split-v4-4-3`
  - `2026-05-21-biocom-funnel-capi-v4-4-4`
  - `2026-05-21-biocom-meta-funnel-fallback-block4-v0-5`
- 이후 문서/프론트 보고서 수정은 있었지만, Biocom Imweb Google 추적 기준점은 5월 21일 밤으로 잡는 것이 맞다.

## Google Ads가 구매라고 세는 값

Source: Google Ads API `/api/google-ads/dashboard?date_preset=last_7d`
Window: 2026-05-17..2026-05-23
Freshness: 2026-05-24 00:32 KST 조회

최근 7일 Google Ads의 Primary 구매값은 거의 전부 `구매완료` 전환 액션에서 나온다.

| 항목 | 값 |
| --- | ---: |
| Google Ads cost | 3,512,658원 |
| Google Ads conversions | 230.45 |
| Google Ads conversion value | 35,268,162원 |
| Google Ads ROAS | 10.04 |
| `구매완료` conversions | 228.45 |
| `구매완료` conversion value | 35,268,160원 |
| `구매완료`가 Primary value에서 차지하는 비중 | 거의 100% |

해석:

- 이름은 `구매완료`지만, 이 액션의 `send_to` label은 기존 진단 기준의 NPay 계열 자동 웹페이지 전환 label이다.
- Google Ads 화면에서 예산 학습에 쓰는 핵심 구매 신호가 실제 내부 결제완료 원장과 직접 연결된 상태라고 보기 어렵다.
- `TechSol - NPAY구매 50739`는 Secondary라 Primary value에는 안 들어가지만 All conv. value에는 35,356,092원이 잡힌다. 이 값은 예산 판단 기준값으로 쓰면 안 된다.

## 5월 22~23일 보강 후 깨끗한 일 단위 비교

Google Ads API의 현재 대시보드 route는 action별 custom day split을 직접 노출하지 않는다. 그래서 아래는 Google Ads daily Primary 전체값이다. 다만 최근 7일 action breakdown에서 Primary value 거의 전부가 `구매완료`라서 실제 해석은 `구매완료`와 거의 같다.

| 날짜 | Google Ads Primary conversions | Google Ads Primary value | 내부 confirmed 주문 | 내부 confirmed 매출 | 내부 confirmed 중 direct Google evidence |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-05-22 | 35.61 | 6,645,303원 | 61 | 17,494,111원 | 0 |
| 2026-05-23 | 21.00 | 4,050,200원 | 43 | 13,616,062원 | 0 |

해석:

- Google Ads는 5월 22~23일에도 Google 쪽 구매값을 주장한다.
- 하지만 VM Cloud 실제 결제완료 원장에서는 같은 기간 confirmed 주문에 직접 Google click id가 0건이다.
- 따라서 지금 문제는 “구글 광고 주문이 많다/적다”보다 먼저, Google이 `구매완료`로 세는 신호가 우리 내부 confirmed 주문과 같은 물건인지 확인해야 하는 상태다.

## 마지막 유실 지점

Source: VM Cloud SQLite read-only
Window: 2026-05-21 21:15 KST 이후
Freshness: latest payment_success 2026-05-24 00:20 KST

### 전체 단계별 집계

| 단계 | rows | Google click evidence |
| --- | ---: | ---: |
| site_landing_ledger | 3,686 | 2,877 |
| paid_click_intent_ledger | 2,950 | 2,950 |
| checkout_started | 301 | 25 |
| payment_page_seen | 852 | 67 |
| payment_success pending | 5 | 0 |
| payment_success canceled | 2 | 1 |
| payment_success confirmed | 114 | 0 |

### confirmed 주문 114건을 같은 checkout/session으로 다시 묶은 결과

| 확인 방식 | confirmed 주문 중 해당 row 수 | 그 안에서 Google evidence |
| --- | ---: | ---: |
| 같은 checkoutId의 checkout_started 존재 | 112 | 0 |
| 같은 checkoutId의 payment_page_seen 존재 | 112 | 0 |
| 같은 GA session + client id의 site_landing 존재 | 111 | 0 |
| 같은 GA session + client id의 paid_click_intent 존재 | 0 | 0 |
| 같은 GA session만 완화해서 site_landing/paid_click_intent 확인 | 111 | 1 |

해석:

- 자연 발생 confirmed 114건은 결제완료 row에서만 갑자기 Google click id를 잃은 것이 아니다.
- 같은 checkoutId로 한 단계 앞의 checkout/payment page를 찾아도 Google click evidence가 0건이다.
- 같은 GA session + client id로 랜딩까지 strict하게 붙여도 Google click evidence가 0건이다.
- 같은 GA session만 완화하면 1건이 나오지만 client id가 맞지 않아 Google Ads upload 후보가 아니다. 내부 진단용 힌트일 뿐이다.

## 결론

1. 2026-05-21 밤 이후 Google 클릭 수집 자체는 정상이다.
   - 유입 장부에서 Google click id 2,877건.
   - 유료 클릭 의도 장부에서 Google click id 2,950건.

2. 자연 발생한 confirmed 주문은 Google 클릭 주문으로 직접 연결되지 않았다.
   - confirmed 114건 direct evidence 0건.
   - 같은 checkoutId 앞단계도 0건.
   - strict same GA session + client id도 0건.

3. Google Ads의 `구매완료` 전환은 내부 confirmed 주문과 같은 기준이라고 보기 어렵다.
   - 최근 7일 Google Ads `구매완료` value 35,268,160원.
   - 같은 기간 내부 Google click confirmed evidence는 여전히 0에 가깝다.
   - 가장 유력한 해석은 Google Ads가 실제 결제완료보다 넓은 NPay/웹페이지 전환 신호를 `구매완료`로 보고 있다는 것이다.

4. 지금 Google Ads offline upload 후보는 계속 0건이 맞다.
   - 직접 gclid/gbraid/wbraid가 붙은 confirmed 주문이 없다.
   - same-session 힌트만으로 Google에 전환을 보내면 false positive 위험이 크다.

## 다음 확인 순서

1. Google Ads `구매완료` 액션의 실제 발화 조건을 Google Ads/GTM/Imweb 화면에서 확인한다.
   - 확인할 화면: Google Ads 전환 액션 `구매완료`.
   - 확인할 것: URL 조건, tag label, counting, value source, Primary 사용 여부.
   - 목적: Google이 “구매완료”라고 부르는 이벤트가 실제 결제완료 URL인지, NPay/결제 페이지/버튼 클릭까지 섞는지 닫는다.

2. 내부 대시보드에 아래 3개 숫자를 분리해서 보여준다.
   - Google Ads 주장 구매값.
   - 내부 실제 결제완료 매출.
   - 내부 실제 결제완료 중 Google click id 직접 증거가 있는 매출.
   - 목적: 예산 판단에 쓸 숫자와 참고만 볼 숫자가 섞이지 않게 한다.

3. confirmed 주문으로 가는 Google-click 여정은 새 테스트 주문으로 다시 한 번만 검증한다.
   - 이미 테스트 주문에서는 pending/canceled에 Google evidence가 붙은 적이 있다.
   - 다음 테스트는 실제 paid confirmed까지 닫히는 주문이 필요하다.
   - 목적: “자연 confirmed가 실제로 Google 주문이 아니었던 것인지”와 “paid confirmed 경로에서만 코드가 빠지는지”를 분리한다.
