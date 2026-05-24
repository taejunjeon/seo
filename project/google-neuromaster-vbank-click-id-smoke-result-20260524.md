# Google 뉴로마스터 가상계좌 주문 click id smoke 결과

작성 시각: 2026-05-24 12:32 KST
문서 성격: Green Lane read-only smoke 결과
대상 주문: `202605245546619`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - imweb/!coderule.md
    - project/google-ads-paid-confirmed-test-runbook-20260524.md
  lane: Green
  allowed_actions:
    - VM Cloud public API read-only 조회
    - attribution ledger read-only 조회
    - Google Ads API read-only 조회
    - 결과 문서화
  forbidden_actions:
    - Google Ads conversion upload
    - Google Ads 전환 설정 변경
    - GTM publish
    - Imweb save
    - 운영DB 또는 VM Cloud write
  source_window_freshness_confidence:
    attribution_ledger:
      source: "/api/attribution/ledger"
      window: "2026-05-24 12:20~12:31 KST"
      freshness: "2026-05-24 12:31 KST 조회"
      confidence: "높음. order_no exact match"
    payment_decision:
      source: "/api/attribution/payment-decision"
      freshness: "2026-05-24 12:28 KST 조회"
      confidence: "높음. order_code/payment_code/order_no exact match"
    google_ads_campaign_roas:
      source: "/api/google-ads/dashboard?date_preset=last_1d"
      freshness: "2026-05-24 12:29 KST 조회"
      confidence: "높음. Google Ads API 기반, 단 플랫폼 주장 ROAS"
```

## 한 줄 결론

가상계좌 주문은 매출로 세면 안 되지만, click id 보존 smoke로는 성공이다. 주문번호 `202605245546619`은 `checkout_started`, `payment_page_seen`, `payment_success pending`까지 Google click evidence가 남았다.

## 입력 정보

TJ님 테스트:

- Google 검색어: `뉴로마스터`
- Google 광고 클릭 시각: 2026-05-24 12:22 KST
- 광고 랜딩 path: `/supplements/?idx=198`
- 실제 제품 상세 path: `/all_supplements/?idx=198`
- 완료 URL path: `/shop_payment_complete`
- 주문번호: `202605245546619`
- 결제상태: 가상계좌 주문 생성, 미입금 pending
- 금액: 35,000원

## 광고 최종 URL 이슈

광고 랜딩은 제품 상세가 아니라 `/supplements/?idx=198`였다. TJ님이 직접 `/all_supplements/?idx=198`로 이동해 상품을 찾았다.

이건 전환율과 추적 안정성 모두에 불리하다. 팀에 아래 수정 요청이 필요하다.

- 현재: `/supplements/?idx=198`
- 기대: `/all_supplements/?idx=198`
- 유지할 것: UTM, 자동 태깅 gclid/gbraid, gad_campaignid

## click id 보존 결과

Source: `/api/attribution/ledger`
Window: 2026-05-24 12:20~12:31 KST

| 단계 | 시각(KST) | 상태 | Google click id 보존 |
| --- | --- | --- | --- |
| payment_page_seen | 12:27:40 | 결제페이지 진입 | 있음 |
| checkout_started | 12:27:40 | 결제 시작 | 있음 |
| payment_success | 12:27:53 | pending | 있음 |

세부 판정:

| 필드 | 값 |
| --- | --- |
| top-level gclid | 있음 |
| top-level gbraid | 없음 |
| top-level wbraid | 없음 |
| metadata google_click_id_present | true |
| metadata google_click_id_type | gclid |
| metadata google_click_id_source | checkout_context_v4_4_3 |
| metadata has_gclid | true |
| metadata has_gbraid | true |
| metadata has_wbraid | false |
| checkout context version | `2026-05-21-biocom-checkout-started-click-id-v4-3` |
| click context version | `2026-05-21-biocom-click-id-bootstrap-v1-1` |

주의:

- 이 주문은 pending이다. 내부 매출, Google Ads upload 후보, confirmed ROAS 분자로 쓰면 안 된다.
- smoke 의미는 “Google click id가 결제완료 페이지의 pending row까지 살아남았다”로 제한한다.

## payment-decision 결과

Source: `/api/attribution/payment-decision`

| 항목 | 값 |
| --- | --- |
| status | pending |
| browserAction | block_purchase_virtual_account |
| confidence | high |
| matchedBy | ledger_order_id |
| reason | fast_ledger_pending_status |

해석:

- 서버가 이 주문을 confirmed Purchase로 허용하지 않았다.
- 가상계좌 미입금 주문을 Meta/구매 이벤트로 잘못 올리는 경로는 차단됐다.

## Google Ads 캠페인별 ROAS API 가능 여부

가능하다. 현재 API가 캠페인별 Google Ads 주장 ROAS를 이미 반환한다.

Endpoint:

```text
GET /api/google-ads/dashboard?date_preset=last_1d&campaign_limit=200&conversion_action_limit=50
```

봐야 할 필드:

- `campaigns[].cost`
- `campaigns[].conversions`
- `campaigns[].conversionValue`
- `campaigns[].roas`
- `conversionActionSegments.campaignRows[]`에서 `conversionActionName="구매완료"` 필터

2026-05-23 KST 기준 Google Ads 주장 캠페인별 ROAS:

| 캠페인 | 광고비 | Google Ads 주장 구매 | Google Ads 주장 구매액 | Google Ads 주장 ROAS |
| --- | ---: | ---: | ---: | ---: |
| `[PM]검사권 실적최대화` | 96,574원 | 6 | 2,834,000원 | 29.35 |
| `[PM]건기식 실적최대화` | 90,588원 | 15 | 1,216,200원 | 13.43 |
| `[PMAX] 바이오컴 검사권 (2)` | 181,631원 | 0 | 0원 | 0 |
| `[SA]바이오컴 검사권` | 29,285원 | 0 | 0원 | 0 |

주의:

이 값은 Google Ads가 주장하는 ROAS다. 내부 실제 결제완료 ROAS와 다르다. 특히 `구매완료` action 자체가 NPay/count 계열 신호로 의심되므로 예산 판단 화면에서는 반드시 `Google Ads 주장 ROAS`라고 표시해야 한다.

## 다음 행동

1. 뉴로마스터 광고 최종 URL 수정 요청
   - 담당: 팀
   - 성공 기준: Google 광고 클릭 후 `/all_supplements/?idx=198`로 바로 들어온다.

2. NPay/가상계좌 pending smoke는 성공으로 기록
   - 담당: Codex
   - 성공 기준: confirmed ROAS에는 넣지 않고 click id 보존 smoke로만 유지한다.

3. 다음 실제 paid confirmed 테스트는 카드 또는 실제 NPay 결제로 별도 진행
   - 담당: TJ님 + Codex
   - 성공 기준: confirmed 주문 row에 Google click id가 직접 남는지 확인한다.
