# TheCleanCoffee BigQuery

작성 시각: 2026-04-19 09:49 KST
기준일: 2026-04-19
문서 성격: 더클린커피 GA4 BigQuery raw export 분석 메모

이 문서는 더클린커피 GA4 BigQuery 연결 상태와, raw event에서 보이는 측정 품질을 정리한다.
론 코하비의 시선으로 보면 핵심은 하나다.

**숫자를 바로 믿기 전에, 그 숫자를 만든 측정 장치가 실험과 의사결정에 쓸 만큼 안정적인지 먼저 확인해야 한다.**

---

## 10초 요약

더클린커피 BigQuery raw export는 조회 가능하다.
`events_20260407`부터 `events_20260417`까지 daily table 11개가 있고, 최신 이벤트 시각은 `2026-04-17 23:23:45 KST`다.

구매 이벤트는 좋은 편이다.
2026-04-12부터 2026-04-17까지 `purchase=123건`, `distinct transaction_id=123건`, `missing transaction_id=0건`, `missing user_pseudo_id=0건`, `missing ga_session_id=0건`이다.

다만 이벤트 단위 source는 123건 전부 비어 있다.
대신 `session_traffic_source_last_click`에는 123건 모두 유입 정보가 있다.
따라서 더클린커피의 GA4 `(not set)` 문제는 “구매 이벤트가 완전히 망가졌다”가 아니라, “어떤 source 필드를 보고 있느냐”의 문제로 먼저 봐야 한다.

---

## 현재 연결 상태

| 항목 | 값 |
|---|---|
| GA4 property ID | `326949178` |
| stream ID | `3970736456` |
| measurement ID | `G-JLSBXX7300` |
| GCP project ID | `project-dadba7dd-0229-4ff6-81c` |
| GCP project number | `269220955383` |
| BigQuery dataset | `analytics_326949178` |
| 위치 | `asia-northeast3` |
| 만든 사람 | `biocom015@gmail.com` |
| 작성일 | `2026-04-07` |
| export 방식 | Daily only |
| streaming export | OFF |
| 사용자 데이터 export | OFF |

현재 권한으로 dataset 조회, table list, query 실행이 가능하다.
즉 분석 관점에서는 BigQuery Viewer 수준의 권한이 반영된 상태로 본다.

---

## Raw Export 확인 결과

| 항목 | 결과 |
|---|---:|
| 확인된 daily table | 11개 |
| 첫 table | `events_20260407` |
| 최신 table | `events_20260417` |
| 최신 이벤트 시각 | `2026-04-17 23:23:45 KST` |
| 2026-04-12~2026-04-17 total events | 14,821 |
| 2026-04-12~2026-04-17 purchase events | 123 |
| 2026-04-12~2026-04-17 distinct transaction_id | 123 |
| 2026-04-12~2026-04-17 missing user_pseudo_id | 0 |

2026-04-17 최신 table의 이벤트 구성은 아래와 같다.

| event_name | events |
|---|---:|
| scroll | 725 |
| click | 671 |
| page_view | 540 |
| user_engagement | 264 |
| session_start | 108 |
| first_visit | 56 |
| form_start | 28 |
| form_submit | 28 |
| view_item | 23 |
| add_to_cart | 21 |
| page_view_long | 18 |
| purchase | 15 |

---

## 매출 이벤트 품질

2026-04-12부터 2026-04-17까지 구매 이벤트의 측정 품질은 아래와 같다.

| 품질 항목 | 값 |
|---|---:|
| purchase events | 123 |
| distinct transaction_id | 123 |
| missing transaction_id | 0 |
| missing user_pseudo_id | 0 |
| missing ga_session_id | 0 |
| event-level source/gclid missing | 123 |
| purchase revenue | 5,588,498 |

좋은 점은 구매 이벤트가 중복되지 않는다는 것이다.
`purchase=123`과 `distinct transaction_id=123`이 같기 때문에, 이 기간의 GA4 purchase 중복 문제는 보이지 않는다.

또 좋은 점은 고객과 세션을 잇는 키가 살아 있다는 것이다.
`user_pseudo_id`와 `ga_session_id`가 구매 이벤트에 모두 들어 있다.
이 말은 구매를 session_start, page_view, 광고 유입, footer attribution row와 다시 붙여 볼 수 있다는 뜻이다.

주의할 점은 이벤트 단위 source가 전부 비어 있다는 것이다.
`collected_traffic_source.manual_source`, `manual_medium`, `gclid` 기준으로 보면 구매 123건은 모두 source가 없다.
이 필드만 보고 리포트를 만들면 구매 매출이 `(not set)` 또는 missing으로 보일 수 있다.

---

## 유입 분석에서 얻은 인사이트

같은 123건을 `session_traffic_source_last_click` 기준으로 보면 이야기가 달라진다.

| source / medium | channel group | purchase | revenue |
|---|---|---:|---:|
| `naver_brand_search / naver_brand_search` | Unassigned | 47 | 2,294,209 |
| `meta / paid_social` | Paid Social | 18 | 682,626 |
| `m.search.naver.com / referral` | Organic Search | 11 | 492,897 |
| `(direct) / (none)` | Direct | 9 | 307,414 |
| `google / organic` | Organic Search | 6 | 248,610 |
| `kakao / message` | Organic Social | 4 | 214,980 |

인사이트는 세 가지다.

1. 더클린커피 구매 유입은 사라진 것이 아니다.
   session last click 기준으로는 123건 모두 source 또는 channel group이 잡힌다.

2. `(not set)`으로 보이는 문제의 상당 부분은 raw event 부재가 아니라 필드 선택 문제일 수 있다.
   이벤트 단위 source는 123건 전부 비어 있지만, session last click 필드는 살아 있다.
   따라서 GA4 구매 유입을 볼 때는 `collected_traffic_source`만 보지 말고 `session_traffic_source_last_click`를 우선 확인해야 한다.

3. `Unassigned`가 많다.
   특히 `naver_brand_search` 계열이 Unassigned로 잡힌다.
   이는 매출이 알 수 없는 유입이라는 뜻이 아니라, GA4 기본 채널 그룹이 source/medium 네이밍을 표준 채널로 분류하지 못한다는 뜻에 가깝다.
   즉 다음 작업은 “유입이 없다”가 아니라 “UTM 네이밍과 채널 매핑을 고정한다”가 되어야 한다.

---

## 아임웹 유입 분석 CSV 참고

참고 파일: `/Users/vibetj/Downloads/inflow_overview_20260419_176496427249324032.csv`

이 CSV는 2026-03-20부터 2026-04-19까지의 아임웹 유입 분석 자료다.
BigQuery와 완전히 같은 집계 로직은 아니지만, UTM 표준 이름을 승인할 때 좋은 운영 증거가 된다.

아임웹 CSV에서 매출 기준 상위 UTM 채널은 아래와 같다.

| UTM 채널 | 방문 | 구매량 | 구매 금액 | 판단 |
|---|---:|---:|---:|---|
| `(none)` | 13,560 | 472 | 21,882,624 | UTM 없음. 직접/검색/자사몰 재방문이 섞여 있어 캠페인 성과로 바로 쓰면 안 됨 |
| `naver_brand_search` | 10,056 | 380 | 17,763,762 | 더클린커피 핵심 유료 검색 UTM 후보 |
| `meta` | 12,730 | 240 | 8,360,144 | Meta 유료 소셜 표준 후보 |
| `channel_talk` | 1,790 | 86 | 3,853,570 | CRM/상담 메시지 계열. 광고와 분리 필요 |
| `kakakotalk` | 1,058 | 16 | 1,235,940 | 오탈자 가능성이 높음. `kakaotalk` 또는 `kakao`로 정리 필요 |
| `naver_brand_search_new_mo` | 456 | 24 | 1,037,932 | 네이버 브랜드검색 세부 캠페인 |
| `imwebcrm_cart+1hour_coffee` | 166 | 18 | 1,006,000 | 장바구니 CRM 캠페인 |
| `ig` | 568 | 18 | 930,586 | Instagram 계열. `meta`로 합칠지 별도 organic/social로 둘지 승인 필요 |

이 자료와 BigQuery는 같은 방향을 가리킨다.
`naver_brand_search`와 `meta`는 표준 채널로 바로 고정할 수 있다.
반대로 `kakakotalk`, `ig`, `home`, `test`, `channel_talk`, `imwebcrm_*`는 운영 의도를 보고 표준명을 정해야 한다.

---

## TJ 승인 필요 항목

TJ님이 승인해야 하는 것은 BigQuery 권한이 아니다.
승인해야 하는 것은 **raw source/medium을 내부 표준 채널로 어떻게 묶을지**다.

승인할 때는 아래 4가지 중 하나를 고르면 된다.

| 결정 | 의미 | 예시 |
|---|---|---|
| 승인 | 제안된 표준명으로 앞으로 고정 | `naver_brand_search` → `paid_search_naver_brand` |
| 이름 변경 후 승인 | 방향은 맞지만 표준명을 바꿔 고정 | `kakakotalk` → `kakaotalk_message` |
| 제외 | 운영 리포트/ROAS에서 빼기 | `test` |
| 보류 | 캠페인 의도를 더 확인한 뒤 결정 | `home`, 일부 CRM UTM |

### 승인 기록

| raw source/medium | 현재 문제 | Codex 제안 표준 채널 | TJ 결정 |
|---|---|---|---|
| `naver_brand_search / naver_brand_search` | GA4 기본 채널이 Unassigned로 분류 | `paid_search_naver_brand` | 2026-04-19 승인. 아임웹 CSV 방문 10,056, 구매 380, 매출 17,763,762원으로 큰 축이고 네이버 브랜드검색 광고 성격이 명확함 |
| `naver_brand_search_* / naver_brand_search_*` | 세부 브랜드검색 캠페인이 여러 이름으로 분산 | `paid_search_naver_brand` 아래 campaign detail로 보관 | 2026-04-19 승인. 같은 브랜드검색 계열이므로 큰 채널은 하나로 묶고 세부 캠페인명은 보존 |
| `meta / paid_social` | 이미 표준에 가까움 | `paid_social_meta` | 2026-04-19 승인. source/medium이 표준에 가깝고 Meta 유료 소셜로 보는 것이 자연스러움 |
| `ig` | Instagram 축약명. paid/organic 구분이 애매함 | `paid_social_meta` 또는 `organic_social_instagram` 중 선택 | TJ 선택 필요 |
| `insta_profile_thecleancoffee` | 프로필 링크 유입. 광고비와 분리 가능성이 큼 | `organic_social_instagram_profile` | TJ 선택 필요 |
| `channel_talk` | CRM/상담 메시지 성과. 광고와 섞으면 안 됨 | `owned_crm_channel_talk` | 2026-04-19 승인. 자사 CRM/상담 메시지 계열이므로 paid 광고와 분리 |
| `imwebcrm_cart+1hour_coffee` | 장바구니 리마인드 캠페인 | `owned_crm_cart_reminder` | 2026-04-19 승인. 장바구니 리마인드 CRM 캠페인으로 명확하며 광고 ROAS와 분리 |
| `kakakotalk` | 오탈자로 보임 | `owned_crm_kakaotalk`로 교정 | TJ 확인 필요 |
| `kakao / message` | 카카오 메시지 계열 | `owned_crm_kakaotalk` | 2026-04-19 승인. paid 광고가 아니라 카카오 메시지 기반 owned CRM으로 분리 |
| `test / (not set)` | 테스트 유입 | `exclude_test` | 2026-04-19 승인. 운영 리포트와 ROAS에서 제외 |
| `(direct) / (none)` | 캠페인 아님 | `direct` | 2026-04-19 승인. 직접 유입/미식별 재방문이며 캠페인 성과로 귀속하지 않음 |
| `google / organic`, `m.search.naver.com / referral`, `daum / organic`, `bing / organic` | 자연 검색/검색 referrer | `organic_search` | 2026-04-19 승인. 검색 자연유입으로 paid 광고 성과와 분리 |
| `shopping.naver.com / referral`, `app-shopping.naver.com / referral` | 네이버 쇼핑 자연유입 | `organic_shopping` | 2026-04-19 승인. 우선 자연/referral 쇼핑으로 분리하되 paid shopping 혼입 여부는 추후 확인 |

2026-04-19에 승인된 항목은 BigQuery 진단 API의 `utm_channel_mapping` 추천 로직에도 반영했다.
따라서 `channel_talk`, `imwebcrm_cart+1hour_coffee`, `kakao / message`는 더 이상 `needs_review`가 아니라 승인된 표준 채널로 반환된다.

남은 승인 항목은 아래처럼 좁혀졌다.

1. 위 표에서 `TJ 선택 필요`, `TJ 확인 필요` 행만 본다.
2. 각 행에 대해 “광고비를 쓰는 캠페인인가, 자사 CRM/메시지인가, 자연유입인가, 테스트인가”를 결정한다.
3. 결정한 표준명을 이 문서에 적는다.
4. 그 다음 Codex가 mapping table 또는 코드 상수로 고정한다.

승인 기준은 아래처럼 잡는다.

- 광고비가 들어가는 Meta 캠페인: `paid_social_meta`
- 네이버 브랜드검색 광고: `paid_search_naver_brand`
- 카카오/채널톡/아임웹 CRM 메시지: `owned_crm_*`
- 인스타 프로필/일반 소셜 유입: `organic_social_*`
- 검색 자연유입: `organic_search`
- 쇼핑 자연유입: `organic_shopping`
- 테스트: `exclude_test`

이 승인이 끝나야 내부 ROAS 화면에서 `Unassigned`를 줄이고, 광고 성과와 CRM 성과를 분리해서 볼 수 있다.

---

## 론 코하비의 시선

코하비식으로 보면 이 데이터는 바로 ROAS 결론을 내리기 위한 데이터가 아니다.
먼저 측정 시스템이 실험에 쓸 수 있는지 보는 데이터다.

좋은 신호:
- purchase 중복이 보이지 않는다.
- transaction_id가 빠지지 않는다.
- user_pseudo_id와 ga_session_id가 빠지지 않는다.
- session last click으로 구매 유입을 복원할 수 있다.

나쁜 신호:
- 이벤트 단위 traffic source가 전부 비어 있다.
- `Unassigned` 채널이 많다.
- Daily export라서 최신 table은 하루 이상 늦을 수 있다.
- Toss 결제분은 대사가 맞았지만 Naver Pay 원장 대사는 아직 남아 있다.

따라서 현재 결론은 “더클린커피 BigQuery는 쓸 수 있다”다.
하지만 “GA4 매출을 그대로 정본으로 써도 된다”는 결론은 아니다.

Kohavi식으로는 다음 순서가 맞다.

1. 계측 장치가 같은 사건을 같은 ID로 반복해서 기록하는지 본다.
2. 중복과 누락이 없으면, 운영 원장과 대사한다.
3. 대사가 닫힌 뒤에야 캠페인 성과와 실험 효과를 말한다.
4. 관찰 데이터만으로 캠페인의 인과 효과를 단정하지 않는다.

---

## BigQuery 편집자 권한 판단

현재 단계에서는 BigQuery 편집자 권한이 필요 없다.

이유는 명확하다.
지금 해야 할 일은 raw event를 읽고, 품질을 점검하고, Toss/Imweb/attribution ledger와 대사하는 것이다.
이 작업은 조회 권한과 query 실행 권한이면 충분하다.

편집자 권한을 넓게 주면 위험이 커진다.

| 권한 | 현재 필요성 | 판단 |
|---|---|---|
| BigQuery Data Viewer | 필요 | raw event 조회에 필요 |
| BigQuery Job User | 필요 | query 실행에 필요 |
| BigQuery Data Editor | 현재 불필요 | raw dataset 수정 위험이 있음 |
| BigQuery Admin | 불필요 | 권한/데이터 변경 범위가 너무 큼 |

편집자 권한이 필요한 경우는 따로 있다.
예를 들어 분석용 mart table, materialized view, scheduled query를 BigQuery 안에 저장해야 할 때다.
그 경우에도 GA4 raw dataset에 editor를 주면 안 된다.

권장 방식은 아래다.

- `analytics_326949178` raw dataset: viewer만 부여
- 별도 `analysis` 또는 `mart` dataset: 필요한 서비스 계정에만 editor 부여
- raw table은 절대 수정하지 않음
- scheduled query는 별도 service account로 실행

즉 지금은 편집자가 아니라 “읽기 전용 분석 루틴”을 먼저 완성해야 한다.

---

## 뷰어 권한으로 가능한 다음 작업

뷰어 권한이 생기면서 바로 가능한 작업은 아래다.

1. Daily export 최신성 감시
   - 매일 `events_YYYYMMDD` table 생성 여부를 확인한다.
   - 최신 이벤트 시각이 36시간을 넘기면 warn, 72시간을 넘기면 stale로 본다.

2. purchase 중복/누락 감시
   - `purchase_events`와 `distinct transaction_id`를 매일 비교한다.
   - 차이가 생기면 중복 purchase sender 또는 transaction_id 누락을 의심한다.

3. GA4 `(not set)` 원인 분해
   - `collected_traffic_source` 기준 missing과 `session_traffic_source_last_click` 기준 missing을 분리한다.
   - 더클린커피는 현재 event-level source는 비어 있지만 session last click은 살아 있다.
   - 따라서 리포트 필드 선택 오류와 실제 유입 손실을 나눌 수 있다.

4. UTM/채널 매핑 정리
   - `naver_brand_search` 계열이 `Unassigned`로 떨어지는 문제를 정리한다.
   - source/medium 표준표를 만들고, 내부 ROAS에서는 표준 channel로 재분류한다.

5. GA4 purchase와 Toss confirmed 매출 대사
   - 2026-04-19에 BigQuery `transaction_id`와 Toss `order_id` 기반 1차 대사를 완료했다.
   - Toss confirmed 매칭분은 GA4 gross와 Toss gross/net이 일치한다.
   - 다음은 Naver Pay 원장과 GA4 `NPAY - ...` 주문을 별도로 대사한다.

6. 실험 전 A/A 점검
   - 쿠폰, 가격, CRM 실험 전에 기존 데이터로 A/A 수준의 안정성을 본다.
   - 요일별 purchase, sessions, revenue variance를 계산한다.
   - 실험 최소 기간과 필요한 표본 수를 현실적으로 잡는다.

7. 대시보드 데이터 기준 시각 배지
   - `/ads`, `/crm`, `/onboarding`에서 “GA4 BigQuery 기준 최신 table”을 표시한다.
   - 운영자는 숫자가 최신인지 먼저 보고, 그 다음 매출과 ROAS를 본다.

---

## GA4 purchase ↔ Toss confirmed 매출 대사

2026-04-19에 읽기 전용 스크립트를 추가했다.

```bash
cd backend
npx tsx scripts/reconcile-coffee-ga4-toss.ts --startSuffix=20260412 --endSuffix=20260417
```

대사 기준:
- GA4: `analytics_326949178.events_*`의 `purchase` event, `transaction_id`, `ecommerce.purchase_revenue`
- Toss: `tb_sales_toss.store='coffee'`
- 조인키: GA4 `transaction_id` = Toss `regexp_replace(order_id, '-P[0-9]+$', '')`
- Toss confirmed: `DONE`, `PARTIAL_CANCELED`
- Toss net: `total_amount - cancel_amount`

2026-04-12부터 2026-04-17까지 결과는 아래와 같다.

| 지표 | 값 |
|---|---:|
| GA4 purchase transactions | 123 |
| GA4 purchase gross | 5,588,498 |
| GA4 Naver Pay transactions | 65 |
| GA4 Naver Pay gross | 2,630,700 |
| GA4 Toss 후보 transactions | 58 |
| GA4 Toss 후보 gross | 2,957,798 |
| Toss confirmed transactions in window | 52 |
| Toss confirmed gross in window | 2,748,519 |
| Toss confirmed net in window | 2,748,519 |
| GA4 ↔ Toss confirmed matched transactions | 51 |
| Toss 후보 대비 matched rate | 87.93% |
| matched GA4 gross | 2,702,219 |
| matched Toss confirmed gross | 2,702,219 |
| matched Toss confirmed net | 2,702,219 |
| matched gross diff | 0 |
| matched net diff | 0 |
| gross mismatch transactions | 0 |
| net mismatch transactions | 0 |
| GA4 only transactions | 70 |
| GA4 only Naver Pay transactions | 65 |
| GA4 only non-Naver Pay transactions | 5 |
| Toss row exists but not confirmed | 2 |
| Toss confirmed only transactions | 1 |

결론:
- **Toss confirmed로 매칭된 51건은 GA4 gross와 Toss gross/net이 정확히 일치한다.**
- 따라서 Toss 결제분의 `transaction_id`와 금액 계측은 신뢰 가능한 상태다.
- 전체 GA4 gross가 Toss confirmed보다 큰 가장 큰 이유는 `NPAY - ...` 형식의 네이버페이 주문 65건, 2,630,700원이 Toss 테이블에 없기 때문이다.
- 이 차이는 GA4 오류라기보다 결제 수단 원장이 다른 문제다. Naver Pay 원장과 별도 대사가 필요하다.
- GA4 숫자형 주문 중 Toss에 없는 5건, 92,334원은 추가 확인 대상이다.
- GA4에는 있으나 Toss 상태가 `CANCELED`라 confirmed에서 제외된 주문이 2건 있다.
- Toss confirmed에는 있으나 같은 GA4 window에 없는 주문이 1건 있다. 날짜 경계, 이벤트 누락, 주문 완료 페이지 미발화 여부를 확인해야 한다.

현재 기준으로 광고/CRM 성과 리포트에서 안전한 매출 기준은 아래다.

1. Toss 결제분: GA4 `transaction_id`와 Toss confirmed/net 대사값을 신뢰 가능.
2. Naver Pay 결제분: GA4 purchase에는 잡히지만 Toss 원장에는 없으므로 Naver Pay 원장 대사가 닫히기 전까지 별도 표시.
3. 취소 주문: GA4 purchase에 남아 있을 수 있으므로 confirmed/net 매출에서는 Toss status 기준으로 제외.

---

## 구현된 진단 엔드포인트

2026-04-19 기준 아래 API로 진단 쿼리를 3개 묶음으로 분리했다.

```bash
GET /api/ga4/coffee-bigquery/diagnostics
GET /api/ga4/coffee-bigquery/diagnostics?startSuffix=20260412&endSuffix=20260417
```

응답은 아래 3개 블록으로 나뉜다.

| 블록 | 목적 |
|---|---|
| `purchase_quality` | purchase 중복, transaction_id 누락, user/session 키 누락 확인 |
| `source_quality` | event-level source 누락과 session last click 복원 가능성 확인 |
| `utm_channel_mapping` | raw source/medium을 내부 표준 채널로 묶기 위한 승인 후보 |

`/ads` 상단에는 `GET /api/source-freshness` 결과를 연결했다.
이 배지는 Toss 운영 DB, PlayAuto 운영 DB, 더클린커피 GA4 BigQuery의 기준 시각과 fresh/warn/stale 상태를 보여준다.

---

## 다음 액션

1. [TJ] 위 [[#TJ 승인 필요 항목]] 표에서 `ig`, `insta_profile_thecleancoffee`, `kakakotalk`, `home` 계열의 표준 채널을 결정한다.
2. [Codex] Naver Pay 원장과 GA4 `NPAY - ...` transaction_id 65건을 대사한다.
3. [Codex] GA4 only non-Naver Pay 5건과 Toss confirmed only 1건의 주문 상태를 Imweb/PlayAuto 기준으로 확인한다.
4. [Codex] `source_quality` 결과를 `/ads` 또는 `/tracking-integrity`에 원인별 카드로 표시한다.
5. [Codex] 7일 단위 A/A 안정성 점검으로 쿠폰/가격/CRM 실험 최소 기간을 계산한다.

---

## 현재 결론

더클린커피 BigQuery는 이제 분석 가능한 상태다.
뷰어 권한만으로도 당장 필요한 진단은 충분히 가능하다.

편집자 권한은 아직 필요 없다.
먼저 read-only로 측정 품질, 유입 필드 기준, purchase 대사를 닫아야 한다.
편집자 권한은 분석용 mart를 BigQuery 안에 만들 때, raw dataset이 아닌 별도 dataset에만 제한적으로 주는 것이 맞다.
