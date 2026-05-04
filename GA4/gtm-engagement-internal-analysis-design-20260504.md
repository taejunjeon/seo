# GTM Engagement 내부 분석 설계안

작성 시각: 2026-05-04 23:59 KST
기준일: 2026-05-04
대상: biocom.kr GTM 컨테이너 `GTM-W2Z6PHN`
문서 성격: 체류시간·스크롤·상품 관심 행동을 내부 분석용으로 쌓기 위한 설계안
관련 문서: [[GA4/gtm]], [[GA4/product-engagement-summary-contract-20260505]], [[capivm/!capiplan]], [[capivm/capi]], [[data/!datacheckplan]], [[docurule]]
Lane: Green documentation only
Mode: No-send / No-write / No-deploy / No-publish / No-platform-send

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  required_context_docs:
    - GA4/gtm.md
    - capivm/!capiplan.md
    - capivm/capi.md
    - data/!datacheckplan.md
  lane: Green
  allowed_actions:
    - document_design
    - read_only_gtm_inventory_summary
    - local_csv_analysis_summary
    - no_send_payload_contract_draft
  forbidden_actions:
    - GTM Preview workspace creation
    - GTM Production publish
    - Imweb header/footer edit
    - Meta CAPI send
    - GA4 Measurement Protocol send
    - backend deploy
    - production DB write
  source_window_freshness_confidence:
    gtm_live:
      source: GTM API read-only
      window: live version 140
      freshness: fresh as of 2026-05-04
      confidence: 0.90
    meta_viewcontent_csv:
      source: Meta Events Manager CSV export
      window: 2026-04-06 23:00~2026-05-04 22:00 KST
      freshness: user-provided export on 2026-05-04
      confidence: 0.86
```

## 10초 요약

이 설계의 결론은 체류시간과 스크롤을 바로 Meta CAPI 전환으로 보내지 말고, 먼저 내부 분석용 행동 장부에 쌓자는 것이다.
현재 GTM에는 7분 체류 태그와 스크롤 트리거가 있지만, 그대로 쓰면 기준이 너무 거칠고 구매 의도와 콘텐츠 소비를 구분하기 어렵다.
따라서 v1은 `상품 상세를 충분히 읽었는가`를 내부 이벤트로 저장하고, 이 값이 실제 주문과 연결되는지 7~14일 검증한 뒤 Meta 송출 여부를 따로 판단한다.
다음 행동은 Codex가 backend payload contract와 GTM Preview 승인안을 만들고, TJ님이 Preview 진행 여부를 승인하는 것이다.

2026-05-05 보강 결론:

- 원본 이벤트는 계속 `ProductEngagementSummary` 하나만 쓴다.
- `qualified_product_view`, `scroll_75`, `engaged_view`는 Meta/GA4 원본 이벤트로 만들지 않고 서버/리포트 파생 지표로만 계산한다.
- `sendBeacon` 실패 시 `fetch(..., { keepalive: true })`를 fallback으로 둔다.
- `page_location`은 허용 query만 남긴다. URL 전체를 그대로 저장하지 않는다.
- ViewContent 표준 CAPI Test Events와 내부 engagement 수집 Preview는 별도 작업으로 분리한다.
- 아임웹 footer 적용은 실제 live footer 교체이므로, Preview/Stage라도 TJ 승인 전에는 실행하지 않는다.
- `POST /api/attribution/engagement-intent` no-write contract는 [[GA4/product-engagement-summary-contract-20260505]]에 분리했다.

## 다음 할일

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|
| 1 | [[#Phase1-Sprint1]] | 완료 | Codex | 현재 GTM engagement 구조를 기준선으로 고정한다 | 이미 있는 체류시간/스크롤 설정을 모르면 새 설계가 중복된다 | GTM live v140 read-only 결과와 Meta CSV 결과를 문서에 남긴다 | [[#Phase1-Sprint1\|이동]] | NO |
| 2 | [[#Phase1-Sprint2]] | 설계 완료 | Codex | 내부 engagement 이벤트 정의를 확정한다 | 운영자가 "오래 봄"과 "구매 의도 높음"을 구분해야 한다 | 체류시간, 가시 체류시간, 스크롤, 상품 ID, 유입 증거를 한 이벤트로 묶는다 | [[#Phase1-Sprint2\|이동]] | NO |
| 3 | [[#Phase2-Sprint3]] | 우리 기준 완료 | Codex | backend 수신 contract 초안을 만들었다 | GTM이 보낼 값과 VM/로컬이 저장할 값이 먼저 맞아야 한다 | [[GA4/product-engagement-summary-contract-20260505]]에 `POST /api/attribution/engagement-intent` no-write payload, dedupe, PII 차단, dry-run 응답을 기록했다 | [[#Phase2-Sprint3\|이동]] | NO |
| 4 | [[#Phase2-Sprint4]] | 대기 | TJ + Codex | GTM Preview 승인안을 만든 뒤 Preview에서만 검증한다 | 실제 사이트에서 태그가 잘 잡히는지 보려면 Preview가 필요하다 | 새 Workspace draft, Tag Assistant Preview, 3~5개 상품 페이지 방문으로 확인한다 | [[#Phase2-Sprint4\|이동]] | YES |
| 5 | [[#Phase3-Sprint5]] | 보류 | TJ + Codex | Meta custom event 송출 여부를 7~14일 내부 데이터 후 판단한다 | 체류시간/스크롤을 바로 Meta에 보내면 학습 신호를 오염시킬 수 있다 | 내부 engagement가 실제 주문 확률과 연결되는지 먼저 보고 Test Events custom event만 검토한다 | [[#Phase3-Sprint5\|이동]] | YES |

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | 현재 GTM engagement 기준선 | Codex | 100% / 0% | [[#Phase1-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | 내부 이벤트 정의 | Codex | 100% / 0% | [[#Phase1-Sprint2\|이동]] |
| Phase2 | [[#Phase2-Sprint3]] | backend 수신 contract | Codex | 우리 기준 완료 | [[#Phase2-Sprint3\|이동]] |
| Phase2 | [[#Phase2-Sprint4]] | GTM Preview smoke | TJ + Codex | 대기 | [[#Phase2-Sprint4\|이동]] |
| Phase3 | [[#Phase3-Sprint5]] | Meta 송출 판단 | TJ + Codex | 보류 | [[#Phase3-Sprint5\|이동]] |

## 문서 목적

이 문서는 biocom 상품 페이지에서 체류시간과 스크롤 같은 관심 행동을 어떻게 내부 분석용으로 수집하고, 어떤 기준을 통과해야 Meta CAPI 후보로 올릴지 정리한다.

## 이 작업이 하는 일

이 작업은 "사람이 상품 상세를 얼마나 진지하게 읽었는가"를 주문·결제 원장과 나중에 연결할 수 있는 보조 장부를 만드는 일이다.

예를 들어 같은 `ViewContent`라도 아래 두 행동은 의미가 다르다.

- 상품 페이지를 3초 보고 바로 나간 방문.
- 상품 페이지를 60초 이상 보고 75% 이상 스크롤한 방문.

현재 Meta와 GA4는 둘 다 `ViewContent` 또는 `view_item`처럼 보일 수 있다.
내부 engagement 장부는 이 차이를 따로 남긴다.
단, 이 값은 매출도 아니고 전환도 아니다.
초기에는 광고 플랫폼 최적화에 직접 쓰지 않는다.

## 왜 필요한가

월별 유입 채널 분석과 Meta ROAS 정합성은 결국 "어떤 유입이 구매 가능성이 높은 방문을 만들었는가"까지 봐야 한다.
구매만 보면 데이터가 늦고 적다.
클릭만 보면 품질을 모른다.
중간 행동을 내부에 쌓으면 아래 판단이 가능해진다.

- Meta 유입 방문이 실제로 상품 상세를 깊게 읽는지 본다.
- TikTok, Google, Organic 유입의 상품 관심 품질을 비교한다.
- 결제 전 이탈이 높은 상품군을 찾는다.
- 나중에 Meta custom event를 보낼 때 기준을 숫자로 검증한다.

## 현재 확인된 GTM 상태

확인 기준은 2026-05-04 GTM API read-only 결과다.
대상은 biocom GTM 컨테이너 `GTM-W2Z6PHN`, live version `140`, version name `tiktok_marketing_intent_v1_live_20260503`이다.

확인된 것은 아래다.

- live 기준 tag 58개, trigger 84개, variable 60개다.
- trigger `[18] 긴 조회 시간(page_view_long)`이 있다.
- `[18]`은 timer trigger이고 interval은 `420000ms`, 즉 7분이다.
- tag `[21] tmp_ga4 page_view_long 이벤트`가 `[18]`로 발화한다.
- `[21]`은 GA4 event `page_view_long`을 보내며 `value=100`, `currency=KRW`를 넣는다.
- trigger `[11] 트리거`가 scrollDepth trigger다.
- `[11]`의 scroll threshold는 `10,25,50,75,90`이다.
- live v140 기준 `[11]`을 firing trigger로 쓰는 tag는 없다.
- variable `[33] USER_TIME`은 현재 ISO 시각을 반환한다. 실제 체류시간 계산 변수가 아니다.

해석은 아래다.

- 체류시간 기반은 있다.
- 스크롤 기반도 일부 있다.
- 하지만 내부 분석용으로 그대로 쓰기에는 부족하다.
- 7분 체류는 너무 보수적이라 대부분의 의미 있는 상품 탐색을 놓칠 수 있다.
- 스크롤은 트리거만 있고 저장 태그가 없다.
- `value=100`, `currency=KRW`는 engagement에 돈처럼 보이는 값을 붙이는 형태라 Meta나 ROAS 판단에는 쓰면 안 된다.

## Meta CSV에서 확인된 것

TJ님이 제공한 Meta Events Manager `ViewContent` CSV는 server CAPI coverage를 보는 데 도움이 된다.
다만 개별 event_id가 없으므로 dedup 성공 여부를 판단하는 자료는 아니다.

확인 결과는 아래다.

- 파일: `/Users/vibetj/Downloads/2026. 5. 4. 오후 11_48.csv`
- window: 2026-04-06 23:00 ~ 2026-05-04 22:00 KST
- event: `ViewContent`
- 유효 row: 672개
- browser_received_count 합계: 432,795
- server_received_count 합계: 2
- server 비율: 0.000462%

해석은 아래다.

- `ViewContent` 서버 CAPI mirror는 운영상 사실상 꺼져 있다.
- Meta UI의 이벤트 범위 0% 경고와 맞다.
- 이 설계에서는 이 CSV를 "Meta CAPI를 켜야 한다"는 근거로 쓰지 않는다.
- 이 CSV는 "현재 서버 engagement 신호가 거의 없다"는 기준선으로만 쓴다.

## 설계 원칙

v1 설계 원칙은 다섯 가지다.

1. 내부 분석이 먼저다.
2. Meta, GA4, Google, TikTok으로 바로 보내지 않는다.
3. `value`와 `currency`를 engagement 이벤트에 넣지 않는다.
4. 상품 페이지 기준으로만 시작한다.
5. 한 세션에서 같은 상품의 같은 행동은 한 번만 저장한다.

이 원칙을 지키는 이유는 단순하다.
스크롤과 체류시간은 구매 의도일 수도 있지만, 그냥 읽기 행동일 수도 있다.
검증 전에는 광고 플랫폼에 학습 신호로 주면 안 된다.

## 내부 이벤트 정의

v1에서 추천하는 원본 이벤트는 하나다.

`ProductEngagementSummary`

이 이벤트는 사용자가 상품 페이지를 떠날 때 한 번 보내는 요약 이벤트다.
여러 스크롤 이벤트를 계속 보내는 방식보다 중복이 적고, 분석하기 쉽다.

필수 조건은 아래다.

- page type이 상품 상세 페이지다.
- `product_idx` 또는 상품을 식별할 수 있는 값이 있다.
- 브라우저 탭이 실제로 보이는 동안의 체류시간을 계산한다.
- 페이지를 떠날 때 `navigator.sendBeacon`으로 한 번 보낸다.
- 같은 세션, 같은 상품에서는 한 번만 보낸다.

전송 우선순위는 아래처럼 고정한다.

1. `navigator.sendBeacon(endpoint, body)`
2. sendBeacon이 false를 반환하거나 사용할 수 없으면 `fetch(endpoint, { method: "POST", body, keepalive: true })`
3. 둘 다 실패하면 저장하지 않는다.

v1에서는 브라우저 local retry queue를 만들지 않는다.
이 이벤트는 결제 확정 전환이 아니라 내부 보조 지표이므로, 무리한 재시도보다 중복과 오염을 줄이는 것이 우선이다.

중복 방지 기준은 아래처럼 고정한다.

```text
dedupe_key = engagement:{site}:{ga_session_id 또는 local_session_id}:{product_idx}
storage = sessionStorage
TTL = 동일 브라우저 세션 동안만 유지
새 GA session 또는 다음 날 재방문은 새 engagement로 허용
```

`ga_session_id`가 없으면 `local_session_id`를 생성한다.
`local_session_id`는 engagement 분석용 임시 키이며, 광고 플랫폼 전송 키가 아니다.

수집할 핵심 필드는 아래다.

| 필드 | 의미 | 필수 여부 |
|---|---|---|
| `event_name` | 항상 `ProductEngagementSummary` | 필수 |
| `site` | `biocom` | 필수 |
| `page_location` | 상품 페이지 URL | 필수 |
| `page_referrer` | 이전 페이지 | 권장 |
| `product_idx` | 아임웹 상품 ID | 필수 |
| `product_name` | 상품명 | 권장 |
| `visible_seconds` | 탭이 보이는 상태에서 머문 시간 | 필수 |
| `max_scroll_percent` | 방문 중 가장 깊게 본 스크롤 비율 | 필수 |
| `ga_client_id` | GA client id | 권장 |
| `ga_session_id` | GA session id | 권장 |
| `fbp` | Meta browser id cookie | 권장 |
| `fbc` | Meta click id cookie | 권장 |
| `utm_source` | 랜딩 UTM source | 권장 |
| `utm_medium` | 랜딩 UTM medium | 권장 |
| `utm_campaign` | 랜딩 UTM campaign | 권장 |
| `fbclid` | Meta click id query | 있으면 저장 |
| `gclid` | Google click id query | 있으면 저장 |
| `ttclid` | TikTok click id query | 있으면 저장 |
| `captured_at` | 수집 시각 | 필수 |
| `debug_mode` | preview/debug 여부 | 필수 |

금지 필드는 아래다.

- 이메일.
- 전화번호.
- 이름.
- 주소.
- 주민번호, 생년월일.
- 건강 상태를 직접 추정하는 민감한 custom data.
- `value`, `currency`.

`page_location` 저장 규칙은 아래처럼 제한한다.

- 저장 형태: `origin + pathname + allowlisted query`
- 허용 query: `fbclid`, `gclid`, `ttclid`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `idx`
- 그 외 query는 기본 제거한다.
- 이메일, 전화번호, 이름, 주소, 쿠폰코드, 내부 admin token처럼 보이는 값은 query key와 무관하게 제거한다.

## 내부 파생 지표

원본 이벤트는 하나로 두고, 분석 지표는 서버 또는 리포트에서 파생한다.

추천 파생 지표는 아래다.

- `is_engaged_view`: `visible_seconds >= 45`이고 `max_scroll_percent >= 50`이면 true.
- `is_deep_view`: `visible_seconds >= 90`이고 `max_scroll_percent >= 75`이면 true.
- `attention_score`: visible time과 scroll depth를 0~100점으로 정규화한 내부 점수.
- `bounce_like`: `visible_seconds < 10`이고 `max_scroll_percent < 25`이면 true.

원본 이벤트로 만들지 않는 이름은 아래다.

- `qualified_product_view`
- `scroll_75`
- `engaged_view`
- `deep_view`

위 값들은 서버/리포트에서 계산하는 파생 지표다.
이렇게 해야 기준을 바꿔도 원본 로그를 다시 보내거나 Meta/GA4 이벤트명을 바꾸지 않아도 된다.

초기 기준은 보수적으로 둔다.
처음부터 기준을 낮게 잡으면 이벤트가 너무 많아져 분석 가치가 떨어진다.
기준은 7~14일 데이터를 본 뒤 상품군별로 조정한다.

## GTM 구현 방향

v1은 GTM Custom HTML tag 하나로 구현하는 방향을 추천한다.
GTM native timer trigger와 scroll trigger를 여러 개 조합하는 방식보다, 하나의 태그 안에서 `visible_seconds`와 `max_scroll_percent`를 함께 계산하는 편이 중복을 줄인다.

추천 구조는 아래다.

1. 상품 상세 페이지에서만 실행한다.
2. 페이지 로드 후 URL의 `idx` 또는 DOM에서 `product_idx`를 찾는다.
3. `visibilitychange`로 실제 보이는 시간만 누적한다.
4. `scroll` 이벤트에서 최대 스크롤 비율만 저장한다.
5. `pagehide` 또는 `beforeunload`에서 요약 payload를 만든다.
6. `navigator.sendBeacon`으로 내부 endpoint에 보낸다.
7. `sessionStorage`로 같은 상품의 중복 전송을 막는다.

기존 GTM 자산 활용 판단은 아래다.

- `[18] page_view_long`: 참고 기준선으로 유지한다. v1 collector의 기준으로 쓰지는 않는다.
- `[21] tmp_ga4 page_view_long 이벤트`: 운영 변경 없이 유지한다. 다만 이 이벤트의 `value=100`은 ROAS/Meta 신호로 해석하지 않는다.
- `[11] scrollDepth trigger`: 직접 연결하기보다 v1 collector 내부 계산을 추천한다. 이유는 scroll trigger만 쓰면 체류시간과 결합하기 어렵기 때문이다.
- `[33] USER_TIME`: 수집 시각 참고로만 본다. 체류시간 계산에는 쓰지 않는다.

## GA4 Data API 체류시간 값 해석 주의

현재 `/api/ads/tiktok/traffic-quality`는 GA4 Data API로 paid traffic의 평균 세션 시간을 조회할 수 있다.
이 API의 `purchaserAverageSessionDuration`은 `eventName=purchase` 필터를 건 평균 세션 시간 근사값이다.
주문자별 원장이나 주문 직전 세션 체류시간이 아니다.

따라서 화면이나 보고서에 이 값을 보여줄 때는 아래 라벨을 붙여야 한다.

```text
GA4 Data API 근사값 - 주문자별 원장 아님.
purchase 이벤트 필터 기반 averageSessionDuration은 실제 구매 전 세션 체류시간과 다를 수 있음.
```

정확한 구매자 체류시간과 스크롤 깊이는 GA4 BigQuery raw에서 `transaction_id`, `user_pseudo_id`, `ga_session_id`, `engagement_time_msec`, `scroll` 이벤트를 주문 전 세션 기준으로 묶어야 한다.
BigQuery raw 권한이 열린 뒤 SQL 초안을 실행한다.

## 작업 분리 원칙

아래 두 작업은 이름과 승인 범위를 분리한다.

`A. Standard Funnel CAPI Test Events Smoke`

- 대상 이벤트: `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`
- 목적: Meta Test Events에서 Browser/Server가 같은 `event_id`로 들어오고 dedup이 되는지 확인한다.
- 범위: test_event_code가 있는 Test Events 전송만 허용한다.
- 금지: 운영 CAPI 송출, 운영 전환 최적화 이벤트 추가.

`B. Internal Engagement Ledger Preview`

- 대상 이벤트: `ProductEngagementSummary`
- 목적: 체류시간과 스크롤을 내부 분석용 보조 장부에 쌓는다.
- 범위: no-send/no-write contract, 이후 TJ 승인 시 GTM Preview.
- 금지: Meta/GA4/Google/TikTok 전송, `value`/`currency` 포함, 운영 DB write.

## 아임웹 footer 적용 승인 조건

아임웹 footer는 사이트 전체 live 코드에 영향을 준다.
따라서 stage smoke 용도라도 TJ 승인 없이 교체하지 않는다.

승인 문구에는 아래 조건이 들어가야 한다.

- testEventCode가 반드시 있어야 한다.
- `enableServerCapi=true`는 testEventCode가 있을 때만 허용한다.
- Meta/GA4/Google/TikTok 운영 전환 추가 송출은 금지한다.
- 테스트 상품 URL 3~5개에서만 확인한다.
- 적용 전 기존 footer 백업 파일명을 문서에 기록한다.
- 테스트 후 기존 footer로 원복한다.
- 결과 보고 전 운영 ON으로 전환하지 않는다.

## Backend 수신 contract 초안

아직 구현이 아니라 contract 초안이다.
실제 route 추가, VM 배포, live write는 다음 승인 단계에서 따로 판단한다.

추천 endpoint 이름은 아래다.

`POST /api/attribution/engagement-intent`

초기 저장 위치는 운영DB가 아니라 TJ 관리 Attribution VM 또는 로컬 개발 DB가 맞다.
운영DB는 주문 정본이며, engagement 실험 row를 직접 쓰면 안 된다.

응답은 단순해야 한다.

```json
{
  "ok": true,
  "stored": false,
  "mode": "dry_run",
  "event_id": "engagement.biocom.423.1777281391"
}
```

운영 전 첫 단계는 `stored=false` dry-run이다.
서버가 payload를 검증하고 로그만 남기면 된다.
그 다음에 TJ 관리 Attribution VM에 제한 저장을 검토한다.

## 중복 방지 규칙

event_id는 결정론적으로 만든다.
같은 세션과 같은 상품이면 같은 event_id가 나온다.

추천 형식은 아래다.

`engagement.{site}.{product_idx}.{ga_session_id_or_session_key}`

예시:

`engagement.biocom.423.1777281391`

브라우저에서는 아래 sessionStorage key로 중복을 막는다.

`engagement_sent::{site}::{product_idx}::{session_id}`

서버에서는 같은 event_id가 다시 오면 duplicate로 표시하고 200으로 응답한다.
중복을 에러로 처리하면 브라우저 재시도나 pagehide 상황에서 불필요한 오류가 생긴다.

## 채널 분석에서 쓰는 방법

engagement 이벤트는 primary channel을 직접 배정하지 않는다.

예를 들어 스크롤을 오래 했다는 이유만으로 `Meta 매출`이나 `TikTok 매출`이라고 보면 안 된다.
채널 배정은 여전히 click id, UTM, referrer, payment/order join evidence가 우선이다.
engagement는 "이 채널에서 들어온 방문이 상품을 깊게 봤는가"를 보는 보조 증거다.

월별 채널 분석에서는 아래처럼 쓴다.

- primary channel: `fbclid`, `gclid`, `ttclid`, UTM, referrer, order/payment join으로 결정한다.
- engagement: primary channel별 상품 관심 품질을 비교하는 보조 지표로 쓴다.
- revenue: 아임웹 주문, Toss 결제, NPay confirmed, refund 보정으로 만든 confirmed net revenue만 쓴다.
- platform value: 내부 매출에 합산하지 않는다.

## Meta CAPI로 보내지 않는 이유

현재 시점에서 체류시간/스크롤을 Meta CAPI 운영 custom event로 보내는 것은 추천하지 않는다.

이유는 아래다.

- 구매 의도와 단순 콘텐츠 소비가 섞일 수 있다.
- 기준을 낮게 잡으면 이벤트 수가 너무 많아져 Meta 최적화가 흐려질 수 있다.
- `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo` 표준 이벤트의 Test Events dedup도 아직 닫히지 않았다.
- Event Match Quality와 Advanced Matching 상태도 TJ님 UI 확인 전이다.
- 건강기능식품 상품군에서는 민감한 관심사를 과하게 추정하는 custom data를 피해야 한다.

따라서 순서는 아래처럼 고정한다.

1. 내부 분석용 수집 설계.
2. backend dry-run contract.
3. GTM Preview smoke.
4. 7~14일 내부 데이터와 주문 연결 검증.
5. Meta Test Events custom event 여부 판단.
6. 운영 CAPI 송출은 별도 승인.

## 권장 판단

현재 추천은 아래다.

- 내부 분석 설계 진행: 추천 88%.
- backend dry-run contract 작성: 추천 84%.
- GTM Preview workspace 승인안 작성: 추천 78%.
- GTM Preview smoke 실행: 추천 72%. TJ님 승인 필요.
- Meta Test Events custom event smoke: 추천 45%. 표준 퍼널 4개 이벤트가 먼저다.
- Meta 운영 CAPI custom event 송출: 추천 25%. 지금은 보류가 맞다.

## Phase1-Sprint1

**이름**: 현재 GTM engagement 기준선

**목표**: 새 수집을 만들기 전에 이미 있는 체류시간/스크롤 설정을 정확히 고정한다.

**완료한 것**:

- GTM live v140을 read-only로 확인했다.
- 7분 체류 trigger `[18]`과 GA4 tag `[21]`을 확인했다.
- scrollDepth trigger `[11]`이 있지만 firing tag가 없음을 확인했다.
- Meta `ViewContent` CSV에서 server count가 2건뿐임을 확인했다.

**100%까지 남은 것**:

- 현재 Sprint는 문서 기준 완료다.
- 운영 반영은 애초에 범위가 아니다.

**쉬운 설명**:

지금 GTM에는 "7분 이상 본 사람"을 GA4로 보내는 장치는 있다.
하지만 "45초 이상 보고 50% 이상 읽은 사람"처럼 상품 관심도를 실무적으로 나눌 장치는 아직 없다.

**▲ 요약표로**: [[#Phase-Sprint 요약표]]

## Phase1-Sprint2

**이름**: 내부 이벤트 정의

**목표**: 체류시간과 스크롤을 광고 플랫폼 전환이 아니라 내부 분석 신호로 정의한다.

**완료한 것**:

- 원본 이벤트를 `ProductEngagementSummary` 하나로 설계했다.
- 파생 지표를 `is_engaged_view`, `is_deep_view`, `attention_score`, `bounce_like`로 나눴다.
- `value`, `currency`, PII, 민감 정보를 금지했다.
- engagement가 primary channel을 직접 배정하지 않는다는 원칙을 정했다.

**100%까지 남은 것**:

- 실제 payload sample을 backend contract 문서에서 확정한다.
- 상품 페이지별 product_idx 추출 방식을 Preview에서 검증한다.

**쉬운 설명**:

이 Sprint는 "오래 봤다"를 돈으로 착각하지 않게 만드는 작업이다.
engagement는 매출이 아니라 관심도다.

**▲ 요약표로**: [[#Phase-Sprint 요약표]]

## Phase2-Sprint3

**이름**: backend 수신 contract

**목표**: GTM이 어떤 payload를 보내고, 서버가 어떤 기준으로 받고 버릴지 정한다.

**완료한 것**:

- [[GA4/product-engagement-summary-contract-20260505]]에 `POST /api/attribution/engagement-intent` contract를 분리했다.
- dry-run 응답 형식을 정했다.
- required/optional 필드를 나눴다.
- PII 차단 규칙을 넣었다.
- `site + session_id + product_idx` dedupe key를 넣었다.
- URL query allowlist와 `sendBeacon -> fetch keepalive` fallback을 넣었다.

**100%까지 남은 것**:

- 실제 route 구현은 아직 하지 않았다.
- Production DB write와 backend deploy는 별도 승인 전까지 하지 않는다.

**역할 구분**:

- Codex: contract 문서와 local no-send payload preview를 만든다.
- TJ님: 이 단계에서는 할 일이 없다.

**쉬운 설명**:

GTM이 아무 값이나 보내면 나중에 분석이 무너진다.
먼저 서버가 받을 값의 양식을 정해야 한다.

**▲ 요약표로**: [[#Phase-Sprint 요약표]]

## Phase2-Sprint4

**이름**: GTM Preview smoke

**목표**: 운영 게시 없이 Preview에서만 v1 collector가 상품 페이지에서 제대로 동작하는지 확인한다.

**남은 것**:

- GTM Preview 승인 문서를 만든다.
- 새 Workspace에서 Custom HTML tag 초안을 만든다.
- Production publish는 하지 않는다.
- Tag Assistant Preview에서 상품 페이지 3~5개를 방문한다.
- Console/Network에서 dry-run payload가 만들어지는지만 본다.

**역할 구분**:

- Codex: 승인 문서, tag 초안, payload 검증 기준을 만든다.
- TJ님: GTM Preview 실행 승인과 Tag Assistant 화면 확인이 필요할 수 있다.

**성공 기준**:

- 상품 페이지에서만 collector가 실행된다.
- `product_idx`, `visible_seconds`, `max_scroll_percent`, `page_location`이 채워진다.
- PII가 없다.
- Meta/GA4/Google/TikTok 전송이 없다.
- Production publish가 없다.

**▲ 요약표로**: [[#Phase-Sprint 요약표]]

## Phase3-Sprint5

**이름**: Meta 송출 판단

**목표**: 내부 engagement가 실제 구매와 연결되는지 확인한 뒤 Meta custom event 후보로 올릴지 결정한다.

**판단 기준**:

- 7~14일 내부 engagement row가 쌓인다.
- engagement row와 주문/결제 spine을 주문 전 세션 기준으로 연결한다.
- `is_engaged_view=true` 방문자의 구매율이 일반 `ViewContent` 방문자보다 의미 있게 높다.
- 이벤트 중복률이 5% 미만이다.
- product_idx 채움률이 95% 이상이다.

**보류 조건**:

- 표준 퍼널 4개 이벤트 Test Events dedup이 아직 미완료다.
- Event Match Quality UI 확인이 없다.
- 내부 데이터에서 구매율 개선이 보이지 않는다.
- 민감 정보 또는 과도한 custom data가 payload에 섞인다.

**쉬운 설명**:

Meta에 보내기 전에 먼저 우리 장부에서 "이 신호가 진짜 구매 가능성을 말해주는가"를 봐야 한다.
그 검증 없이 보내면 광고가 잘못 학습할 수 있다.

**▲ 요약표로**: [[#Phase-Sprint 요약표]]

## 운영 금지선

이번 설계에서 하지 않은 것은 아래다.

- GTM Preview workspace를 만들지 않았다.
- GTM Production publish를 하지 않았다.
- 아임웹 헤더/푸터 코드를 바꾸지 않았다.
- Meta CAPI를 보내지 않았다.
- GA4 Measurement Protocol을 보내지 않았다.
- Google Ads, TikTok 전환값을 보내지 않았다.
- 운영DB나 TJ 관리 Attribution VM에 row를 쓰지 않았다.
- backend deploy를 하지 않았다.

앞으로도 아래는 별도 승인 전 금지다.

- GTM Preview 실행.
- GTM Production publish.
- live backend receiver 배포.
- Attribution VM live write.
- Meta custom event Test Events 전송.
- Meta custom event 운영 송출.

## 확인 근거

문서 근거:

- [[GA4/gtm]]: GTM live v140 read-only 확인, 7분 체류 태그, 스크롤 trigger orphan 상태.
- [[capivm/!capiplan]]: 중간 퍼널 CAPI는 표준 이벤트 test-only가 우선이며 engagement custom event는 보류.
- [[data/!datacheckplan]]: Meta ROAS 정합성은 내부 confirmed revenue와 플랫폼 value를 분리해야 한다.

외부 UI/CSV 근거:

- Meta Events Manager `ViewContent` CSV export, 2026-04-06 23:00 ~ 2026-05-04 22:00 KST.
- browser `ViewContent` 432,795건, server `ViewContent` 2건.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

Project: GTM engagement internal analysis
Phase: Phase1 design
Lane: Green
Mode: No-send / No-write / No-deploy / No-publish / No-platform-send

No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:

- 이 문서는 설계안이며 운영 수집을 시작하지 않는다.
- 내부 분석 수집은 추천하지만, Meta CAPI custom event 운영 송출은 현재 추천하지 않는다.
- 다음 단계는 backend contract와 GTM Preview 승인안이다.

## 변경 이력

- 2026-05-04 23:59 KST: GTM live v140, Meta ViewContent CSV, CAPI 정본 문서 기준으로 신규 작성.
- 2026-05-05 02:05 KST: [[GA4/product-engagement-summary-contract-20260505]]를 분리하고 Phase2-Sprint3 backend 수신 contract를 우리 기준 완료로 갱신.
