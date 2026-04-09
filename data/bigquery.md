• 문서 반영은 끝났소. data/datacheck0406.md, roadmap/roadmap0327.md, roadmap/phase1.md까지 맞춰 두었고, 새 Phase 문서는 만들지
  않고 기존 phase1.md에 정합성 체크 루틴을 녹였소.

  빅쿼리는 “지금 분석을 시작”보다 “지금부터 raw 데이터를 쌓아두기”가 목적이니, 아래 순서로 준비하면 되오.

  핵심 판단

  1. 지금 바로 해야 할 것은 GA4 -> BigQuery export를 켜는 일이오.
  2. 다만 “히스토리를 쌓아두자”가 목적이면 BigQuery sandbox는 권하지 않소.
     이유: sandbox는 테이블이 60일 뒤 자동 만료되고 streaming도 안 되오.
  3. 따라서 실무 권장은 billing 연결된 BigQuery 프로젝트 하나를 만들고, 여기에 3개 GA4 property를 모두 연결하는 것이오.

  이 프로젝트 기준 권장 구조

  1. GCP 프로젝트를 1개 정하시오.
     추천 이름(추론): seo-ga4-prod 또는 seo-warehouse-prod
     운영 목적이면 프로젝트를 쪼개지 말고 하나로 가는 편이 낫소.
  2. 지역은 처음에 한번만 정하시오.
     BigQuery dataset location은 생성 후 못 바꾸오.
     실무 추천(추론): 한국 운영이면 asia-northeast3 (Seoul) 하나로 통일하시오.
  3. raw dataset은 GA4가 자동 생성하오.
     이름은 analytics_<property_id> 형식이오.
  4. 별도로 수동 dataset 하나를 만드시오.
     이름 예시: seo_marts
     이건 나중에 GA4 + Toss + attribution ledger 조인용 view/table을 두는 곳이오.

  GA4에서 실제로 누를 것

  1. Google Cloud Console에서 프로젝트를 만들고 BigQuery API를 켜시오.
  2. GA4 Admin으로 가시오.
  3. 각 property에서 Product Links -> BigQuery Links -> Link로 들어가시오.
  4. BigQuery 프로젝트를 선택하시오.
  5. location을 고르시오.
  6. export할 data stream을 고르시오.
  7. export 방식은 우선 Daily만 켜시오.
     지금 목적은 히스토리 적재라서 이걸로 충분하오.
  8. Streaming은 당장 꼭 필요할 때만 추가하시오.
     비용이 붙고, 새 사용자/새 세션 attribution 데이터는 streaming에서 불완전할 수 있소.
  9. 연결 후 24시간 안에 첫 데이터가 들어오기 시작하오.

  어떤 property를 켜야 하느냐
  현재 코드상 사이트 매핑은 backend/src/ga4.ts에 이미 잡혀 있소.

  - biocom -> GA4_BIOCOM_PROPERTY_ID
  - thecleancoffee -> GA4_COFFEE_PROPERTY_ID
  - aibio -> GA4_AIBIOCOM_PROPERTY_ID

  즉, 최종적으로는 3개 property를 다 켜야 하오.
  다만 커피 property 접근 권한이 아직 없으면 biocom, aibio부터 먼저 켜고 coffee는 권한 확보 즉시 추가하면 되오.

  권한 준비

  1. GA4 쪽에서는 해당 property Editor 이상 권한이 필요하오.
  2. GCP 쪽에서는 BigQuery 프로젝트 Owner 권한이 필요하오.
  3. 연결이 되면 Google이 firebase-measurement@system.gserviceaccount.com 계정을 만들고, 이 계정이 BigQuery에 써야 하오.
  4. 연결 뒤에는 그 서비스 계정이 프로젝트에 있고, dataset에 쓸 수 있는지 확인하시오.

  미리 꼭 정해둘 운영 규칙

  1. raw export dataset은 손대지 말고 그대로 두시오.
  2. 사람이 직접 쿼리할 것은 seo_marts 같은 별도 dataset에 view/table로 만드시오.
  3. 3개 property 모두 같은 region으로 두시오.
     region이 다르면 나중에 cross-query가 귀찮아지오.
  4. BigQuery 예산 알림을 걸어두시오.
     예: 월 1만원, 3만원, 5만원 알림.
  5. 디버그/스모크 이벤트를 분리하시오.
     지금은 raw를 최대한 남기되, 나중에 export volume이 커지면 staging/debug event만 제외하시오.
     purchase, begin_checkout, page_view를 너무 일찍 빼면 나중에 후회하오.

  이 프로젝트에서 특히 중요한 점
  BigQuery를 켠다고 바로 귀속 문제가 해결되진 않소. 지금 병목은 raw data 부재보다 공통 join key 부족이오.
  그래서 export와 함께 아래를 계속 챙겨야 하오.

  1. payment_success payload에 orderId, paymentKey를 계속 남기시오.
  2. 가능하면 웹 이벤트에 user_pseudo_id, ga_session_id 계열도 같이 남기시오.
  3. 나중에 warehouse에서 GA4 purchase와 attribution_ledger를 붙이려면 최소 site, event_date, transaction_id/orderId,
     paymentKey, user_pseudo_id 중 일부가 필요하오.

  첫날 검증용 쿼리
  첫 데이터가 들어온 뒤에는 아래 두 개만 먼저 돌리면 되오.

  SELECT
    COUNT(*) AS events,
    COUNTIF(event_name = 'purchase') AS purchase_events
  FROM `YOUR_PROJECT.analytics_PROPERTY_ID.events_*`
  WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 1 DAY));

  SELECT
    COUNTIF(event_name = 'purchase') AS purchase_events,
    COUNT(DISTINCT (
      SELECT ep.value.string_value
      FROM UNNEST(event_params) ep
      WHERE ep.key = 'transaction_id'
    )) AS distinct_transaction_ids,
    COUNTIF(user_pseudo_id IS NULL) AS missing_user_pseudo_id,
    COUNTIF(collected_traffic_source.manual_source IS NULL) AS missing_manual_source
  FROM `YOUR_PROJECT.analytics_PROPERTY_ID.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '20260401' AND '20260406';

  이 두 개로

  - export가 실제로 들어오는지
  - purchase가 쌓이는지
    바로 알 수 있소.

  제가 권하는 실제 실행 순서

  1. billing 연결된 GCP 프로젝트 1개 생성
  2. BigQuery API 활성화
  3. biocom property BigQuery link
  4. aibio property BigQuery link
  5. coffee property는 접근 권한 확보 즉시 link
  6. seo_marts dataset 생성
  7. 예산 알림 생성
  8. 첫 export 확인 후 제가 ga4_purchase_base, ga4_not_set_daily, ga4_toss_reconcile용 SQL 초안까지 바로 잡겠소

  출처:

  - GA4 BigQuery export 설정: https://support.google.com/analytics/answer/9823238?hl=en
  - GA4 BigQuery export 동작/제한: https://support.google.com/analytics/answer/9358801?hl=en
  - GA4 BigQuery export schema: https://support.google.com/analytics/answer/7029846?hl=en
  - BigQuery dataset 생성/지역 제한: https://cloud.google.com/bigquery/docs/datasets
  - BigQuery sandbox 제한: https://docs.cloud.google.com/bigquery/docs/sandbox

  원하시면 다음 턴에서 바로 TJ님이 콘솔에서 그대로 따라할 10분짜리 체크리스트 형식으로 더 짧고 실행형으로 줄여드리겠소.