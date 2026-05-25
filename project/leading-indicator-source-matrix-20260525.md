# Leading Indicator Source Matrix

작성 시각: 2026-05-25 21:44 KST
기준일: 2026-05-25
문서 성격: 선행지표 에이전트 source/window/freshness/confidence 기준표
Lane: Green documentation
운영 영향: 운영DB 변경 없음 / VM Cloud 배포 없음 / 외부 플랫폼 전송 없음 / 자동 예산 조정 없음

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - harness/leading-indicator/README.md
    - harness/leading-indicator/TOOL_REGISTRY.md
    - harness/leading-indicator/EVAL_SUITE.md
    - harness/leading-indicator/RUN_PACKET_SCHEMA.md
    - ontology/leading-indicator-ontology-extension-20260525.md
    - project/leading-indicator-mini-digital-twin-plan-20260525.md
  required_context_docs:
    - project/leading-indicator-p0-dry-run-20260517.md
    - data/project/leading-indicator-p0-dry-run-20260517.json
    - project/leading-indicators-ga4-behavior-live-api-design-20260524.md
  lane: Green
  allowed_actions:
    - documentation_update
    - sample_run_packet_write_local
    - source_matrix_design
  forbidden_actions:
    - operating_db_write
    - vm_cloud_deploy_or_restart
    - gtm_publish
    - platform_send_or_upload
    - raw_identifier_output
    - auto_budget_change
  source_window_freshness_confidence:
    source: existing design docs + 2026-05-17 P0 dry-run aggregate snapshot
    window: source rules as of 2026-05-25; sample counts from 2026-05-17 rolling 7d snapshot
    freshness: design current at 2026-05-25 21:44 KST; sample counts are historical and not for live decisions
    confidence: high for source priority rules, medium for sample numbers because they are historical dry-run snapshot
```

## 10초 요약

이 문서는 선행지표 에이전트가 숫자를 볼 때 "무엇을 먼저 믿고, 무엇으로 교차 확인하고, 무엇은 절대 구매로 세면 안 되는지"를 정한다.

핵심 원칙은 3개다.

1. 방문/행동은 VM Cloud와 GA4 BigQuery를 역할별로 나눠 본다.
2. 주문/매출은 실제 결제완료 원장을 우선한다.
3. 광고 플랫폼이 주장하는 전환값은 참고값이지 내부 매출 정본이 아니다.

미니 디지털 트윈은 사람이 슬라이더를 직접 만지는 방식으로 시작하지 않는다.
에이전트가 이 source matrix를 보고 최근 기준선에서 가능한 시나리오 몇 개를 자동 제안한다.

## 쉬운 결론

선행지표 에이전트는 숫자를 만들기 전에 먼저 아래 질문에 답해야 한다.

- 이 숫자는 방문, 행동, 결제완료, 광고비 중 무엇인가?
- 이 숫자의 정본 source는 어디인가?
- 같은 기간과 같은 사이트 기준인가?
- 최신성이 부족하면 어떤 fallback을 쓸 수 있는가?
- 이 숫자를 매출 판단에 써도 되는가, 아니면 참고만 해야 하는가?

## source 등급

| 등급 | 쉬운 뜻 | 사용 방식 |
|---|---|---|
| Primary | 해당 질문에서 가장 먼저 믿는 source | 보고서 핵심 숫자로 사용 |
| Cross-check | primary가 맞는지 확인하는 보조 source | 차이가 크면 HOLD |
| Fallback | primary가 없을 때 임시로 보는 source | 반드시 주의 문구와 함께 사용 |
| Forbidden proxy | 그럴듯해 보여도 해당 질문의 답으로 쓰면 안 되는 값 | 계산에서 제외 |

## 질문별 source matrix

### 1. 방문자와 유입 시작점

| 항목 | 값 |
|---|---|
| 사람이 묻는 질문 | 사이트에 들어온 사람이 얼마나 있고, 어떤 유입에서 시작했는가 |
| Primary | VM Cloud `site_landing_ledger` 집계 |
| Cross-check | GA4 BigQuery session/source/medium 집계 |
| Fallback | VM Cloud `attribution_ledger.marketing_intent` diagnostic |
| Forbidden proxy | Meta/Google/Naver 클릭 수를 방문자 수처럼 직접 사용 |
| 기본 window | 최근 7일, 최근 28일 |
| freshness 기준 | VM Cloud live/precompute 기준 시각을 표시 |
| confidence | high when VM Cloud aggregate is fresh, medium when only platform clicks exist |
| HOLD 조건 | site 구분이 없거나, `all_sites` 합산만 있거나, source freshness가 없음 |

왜 이렇게 정했는가:
광고 플랫폼 클릭 수는 광고가 주장하는 클릭이다.
실제 사이트 방문과 1:1이 아니다.
따라서 방문자 기준선은 우리 first-party landing row를 우선한다.

### 2. 채널/광고 유입 증거

| 항목 | 값 |
|---|---|
| 사람이 묻는 질문 | 이 방문이 Meta, Google, Naver, YouTube, organic 중 어디에서 왔는가 |
| Primary | VM Cloud `site_landing_ledger` + UTM/referrer/click evidence 집계 |
| Cross-check | GA4 BigQuery `collected_traffic_source`, source/medium/campaign |
| Fallback | 광고 CSV/API campaign spend와 naming inventory |
| Forbidden proxy | UTM 없음 주문을 임의로 특정 광고 채널에 배정 |
| 기본 window | 최근 7일, 최근 28일 |
| freshness 기준 | landing evidence 집계 시각 + GA4 latest daily table |
| confidence | medium_high when first-party evidence and GA4 direction match |
| HOLD 조건 | 같은 session/order에 후보 채널이 2개 이상이고 결정 규칙이 없음 |

왜 이렇게 정했는가:
채널은 매출을 어디에 붙일지 결정하는 증거다.
클릭, 방문, 주문 연결 증거를 분리해야 광고비 판단이 안전해진다.

### 3. 콘텐츠 몰입 행동

| 항목 | 값 |
|---|---|
| 사람이 묻는 질문 | 구매자는 이탈자보다 콘텐츠를 더 오래 읽고 더 깊게 보는가 |
| Primary | GA4 BigQuery engagement, scroll, page_view_long, view_item 집계 |
| Cross-check | VM Cloud attribution metadata visible_seconds/scroll snapshot |
| Fallback | GTM export에서 scroll/page_view tag 존재 여부 |
| Forbidden proxy | VM 원장 순간 snapshot을 전체 체류시간처럼 단독 사용 |
| 기본 window | 최근 7일, 최근 28일 |
| freshness 기준 | GA4 latest daily table + precompute freshness |
| confidence | medium_high after safe session join, medium when GA4 join rate is low |
| HOLD 조건 | GA4 join rate가 낮거나, VM snapshot과 GA4 behavior source가 섞임 |

왜 이렇게 정했는가:
콘텐츠 판단은 방문 전체 행동 로그가 필요하다.
VM Cloud 원장 metadata는 전환 row가 들어온 순간의 현장 메모라서 결제 감시는 좋지만 체류시간 정본으로 쓰기엔 부족하다.

### 4. 장바구니 의도

| 항목 | 값 |
|---|---|
| 사람이 묻는 질문 | 장바구니나 바로구매 행동이 실제 구매를 예고하는가 |
| Primary | GA4 BigQuery add_to_cart, view_cart, begin_checkout 전 단계 행동 |
| Cross-check | VM Cloud `site_landing_ledger` 장바구니/결제 경로 관측 |
| Fallback | Browser pixel AddToCart observation |
| Forbidden proxy | ViewContent나 상품조회만 장바구니 의도로 승격 |
| 기본 window | 최근 7일, 최근 28일 |
| freshness 기준 | GA4 daily table 또는 VM precompute 기준 시각 |
| confidence | medium_high when buyer/non-buyer cohort sizes are >= 30 |
| HOLD 조건 | 구매자와 비결제자 양쪽에서 비슷하게 높아 단독 추천이 어려움 |

왜 이렇게 정했는가:
장바구니는 강한 신호일 수 있지만, 이탈자도 많이 한다.
따라서 단독 주문 예측값이 아니라 결제 시작/결제완료와 함께 본다.

### 5. 결제 시작과 결제수단 선택

| 항목 | 값 |
|---|---|
| 사람이 묻는 질문 | 결제 페이지까지 온 사람이 어디에서 멈추는가 |
| Primary | VM Cloud `attribution_ledger` checkout_started + payment_page_seen |
| Cross-check | GA4 BigQuery begin_checkout + add_payment_info |
| Fallback | browser InitiateCheckout/AddPaymentInfo observation |
| Forbidden proxy | 결제 시작, NPay 클릭, add_payment_info를 구매완료로 계산 |
| 기본 window | 최근 7일, 최근 28일 |
| freshness 기준 | VM Cloud live/precompute + GA4 latest daily table |
| confidence | medium_high for checkout start, medium/low for payment method until route closes |
| HOLD 조건 | add_payment_info가 0인데 실제 수집 누락인지 행동 부재인지 분리 안 됨 |

왜 이렇게 정했는가:
결제 시작은 구매 의도가 강한 행동이지만 구매완료가 아니다.
특히 NPay 클릭을 구매로 세면 내부 매출과 광고 성과가 부풀 수 있다.

### 6. 실제 결제완료 주문과 매출

| 항목 | 값 |
|---|---|
| 사람이 묻는 질문 | 실제 돈이 들어온 주문과 매출은 몇 건/얼마인가 |
| Primary | 사이트별 실제 결제완료 원장. biocom은 VM Cloud confirmed payment_success + 운영DB/Toss/Imweb cross-check, thecleancoffee는 VM Cloud imweb_orders + Imweb/NPay source guard |
| Cross-check | 운영DB `PAYMENT_COMPLETE`, Toss direct, Imweb direct, GA4 purchase conflict guard |
| Fallback | fresh VM Cloud `imweb_orders` cache with warning |
| Forbidden proxy | GA4 purchase, Meta purchase, Google Ads conversion, NPay click/count를 내부 매출로 사용 |
| 기본 window | 최근 7일, 최근 28일 |
| freshness 기준 | 결제 source별 sync 시각과 status sync lag |
| confidence | high when confirmed source and cross-check match, medium when partial cache only |
| HOLD 조건 | 결제수단별 완료 시점이 섞이거나, 취소/반품 제외 기준이 없음 |

왜 이렇게 정했는가:
선행지표가 실제 매출로 이어졌는지 보려면 후행 정답은 실제 결제완료 원장이어야 한다.
광고 플랫폼 전환값은 학습/참고용이지 내부 매출 정본이 아니다.

### 7. 광고비

| 항목 | 값 |
|---|---|
| 사람이 묻는 질문 | 같은 기간에 얼마를 써서 이 결과가 나왔는가 |
| Primary | 플랫폼 API/CSV spend. Google Ads, Meta, Naver, TikTok을 site/channel/window 기준으로 분리 |
| Cross-check | 수동 계약/청구서/brand search manual cost docs when available |
| Fallback | campaign naming inventory + downloaded CSV snapshot |
| Forbidden proxy | ROAS 계산을 위해 임의 광고비를 채워 넣기 |
| 기본 window | 최근 7일, 최근 28일 |
| freshness 기준 | API/CSV 생성 시각과 데이터 기간 |
| confidence | high when platform API source and local snapshot match |
| HOLD 조건 | spend window와 주문/방문 window가 다름 |

왜 이렇게 정했는가:
광고비는 시뮬레이션과 ROAS의 분모다.
분모가 틀리면 시나리오가 그럴듯해 보여도 의사결정이 틀어진다.

### 8. 플랫폼 전송/학습 상태

| 항목 | 값 |
|---|---|
| 사람이 묻는 질문 | 실제 구매 신호가 Meta/Google 같은 플랫폼 학습으로 전달됐는가 |
| Primary | VM Cloud CAPI/send log, site별 Pixel/계정 필터 |
| Cross-check | Meta Events Manager, Google Ads UI/API conversion status |
| Fallback | Ads Manager attributed purchase, delayed diagnostic |
| Forbidden proxy | 플랫폼 UI 전환값을 내부 결제완료 주문 수로 사용 |
| 기본 window | 최근 24시간, 최근 7일 |
| freshness 기준 | send log 기준 시각 + 플랫폼 UI 지연 가능성 표시 |
| confidence | high for send attempt, medium for platform attribution |
| HOLD 조건 | all_sites 합산만 있고 site별 필터가 없음 |

왜 이렇게 정했는가:
전송 상태는 광고 학습 품질 점검용이다.
매출 정본이나 구매자 행동 정본으로 쓰면 안 된다.

## 미니 디지털 트윈 source mapping

미니 디지털 트윈은 사람이 수동으로 값을 바꾸는 판이 아니다.
에이전트가 아래 source를 읽고 자동으로 3-5개 시나리오를 제안한다.

| 시뮬레이션 입력 | Primary | Cross-check | 없으면 어떻게 하나 |
|---|---|---|---|
| 기준 방문자 수 | VM Cloud `site_landing_ledger` 최근 7일/28일 | GA4 session | 없으면 시뮬레이션 HOLD |
| 기준 결제완료 주문 수 | 실제 결제완료 원장 | GA4 purchase conflict guard | 없으면 시뮬레이션 HOLD |
| 기준 매출 | 실제 결제완료 매출 | Toss/Imweb/운영DB cross-check | 없으면 매출/ROAS 출력만 HOLD, 주문 수 시나리오는 가능 |
| 기준 객단가 | 기준 매출 / 기준 주문 수 | 상품군별 주문 원장 | 매출 source 없으면 HOLD |
| 기준 광고비 | 플랫폼 API/CSV spend | 계약/청구/수동 cost docs | 없으면 ROAS 출력만 HOLD |
| 행동 개선 후보 | GA4 behavior + VM funnel | GTM export/source inventory | 없으면 일반 시나리오만 제안 |

## AI가 자동으로 제안할 시나리오

에이전트는 매번 같은 슬라이더를 보여주는 대신, source freshness와 행동 차이를 보고 아래 중 3-5개를 고른다.

### 1. 현재 유지 기준선

- 무엇: 최근 7일 또는 28일 흐름이 그대로 이어진다고 본다.
- 왜: 다른 시나리오의 기준점이 필요하다.
- 계산: 현재 방문자 수, 전환율, 객단가, 광고비를 그대로 사용한다.
- 표시: "현재 흐름이 유지되면 예상 주문/매출은 이 정도"라고 쓴다.

### 2. 콘텐츠 몰입 개선

- 무엇: 구매자와 이탈자의 체류시간/스크롤 차이가 클 때 제안한다.
- 왜: 콘텐츠를 더 읽게 만들면 결제 시작 전환이 좋아질 가능성이 있기 때문이다.
- 계산: 방문자 수는 유지하고 전환율만 보수적으로 올린다.
- 금지: 체류시간이 길다는 이유만으로 광고비 증액을 제안하지 않는다.

### 3. 결제 이탈 개선

- 무엇: 결제 시작은 많은데 결제완료가 낮을 때 제안한다.
- 왜: 랜딩보다 결제 UX가 병목일 수 있기 때문이다.
- 계산: 결제 시작 대비 결제완료율을 1%p, 3%p, 5%p 개선한 주문 수 범위를 보여준다.
- 금지: add_payment_info나 NPay 클릭을 구매완료로 세지 않는다.

### 4. 트래픽 확대 전 점검

- 무엇: 광고비나 방문자 수를 늘렸을 때 전환율이 유지되는지 보는 보수 시나리오다.
- 왜: 예산을 늘리면 방문자는 늘 수 있지만 유입 품질이 떨어질 수 있기 때문이다.
- 계산: 방문자 수는 늘리고 전환율은 소폭 낮춘 down-case도 같이 표시한다.
- 금지: 자동 예산 조정이나 플랫폼 전송을 하지 않는다.

### 5. 나쁜 경우 방어선

- 무엇: 방문자 수가 같아도 전환율/객단가가 하락하는 경우를 보여준다.
- 왜: 좋은 그림만 보면 의사결정이 과감해져 위험하다.
- 계산: 전환율과 객단가를 보수적으로 낮춰 손실 범위를 보여준다.
- 금지: 단일 숫자를 확정 예측처럼 쓰지 않는다.

## sample 값 해석 주의

2026-05-17 P0 dry-run snapshot에는 biocom 7일 유입 10,720건, 결제완료 388건이 있다.
이 숫자는 새 실행 기록의 모양을 보여주는 샘플에는 쓸 수 있지만, 2026-05-25 현재 운영 판단에는 stale이다.

따라서 새 실행 기록에서는 아래처럼 표시해야 한다.

- source: VM Cloud funnel-health cached aggregate + local docs
- window: 2026-05-17 기준 rolling 7d snapshot
- freshness: historical_sample_only
- confidence: schema validation에는 medium_high, 현재 의사결정에는 low

## 금지선

- 운영DB write/import 금지
- VM Cloud deploy/restart 금지
- GTM Preview/Production publish 금지
- GA4/Meta/Google Ads/TikTok/Naver send/upload 금지
- raw customer/order/payment/ad-click identifier 출력 금지
- 미니 디지털 트윈 결과로 자동 예산 조정 금지
- 플랫폼 주장 ROAS와 내부 confirmed ROAS 합산 금지

## 다음 Green 작업

1. 이 matrix를 기준으로 실제 read-only dry-run을 다시 실행한다.
2. 매출과 광고비 source가 닫히면 AI 시나리오의 매출/ROAS 출력을 활성화한다.
3. source freshness가 stale이면 시나리오는 HOLD로 남기고 최신 조회 작업을 먼저 실행한다.

