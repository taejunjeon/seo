# Google Ads NPay 피드백 반영 실행 계획

작성 시각: 2026-05-05 14:25 KST
대상: biocom Google Ads account `2149990943`, Google tag `AW-304339096`
문서 성격: Green Lane 개발 계획 및 read-only 실행 기록
관련 문서: [[!gdnplan]], [[google-ads-confirmed-purchase-execution-approval-20260505]], [[google-ads-campaign-signal-audit-20260505]], [[google-ads-npay-quality-deep-dive-20260505]], [[!total_past]], [[../GA4/product-engagement-summary-contract-20260505]]
현재 상태: 문서 반영, `/ads/google` 문구 개선, BigQuery read-only leakage 분석 보강, ProductEngagementSummary 로컬 no-write route 구현 및 smoke 확인 완료. Google Ads 설정 변경, conversion upload, GTM publish, 운영 DB write는 하지 않음.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
  lane: Green
  allowed_actions:
    - 문서 작성/수정
    - Google Ads API/GA4 BigQuery read-only 결과 정리
    - no-send/no-write 스크립트 보강
    - 로컬 프론트엔드 문구 개선
    - 검증 실행
  forbidden_actions:
    - Google Ads conversion action mutation
    - Google Ads conversion upload
    - Google Data Manager API ingest
    - GTM Production publish
    - backend deploy
    - operating DB write/import
    - permanent env ON
  source_window_freshness_confidence:
    google_ads_api:
      source: "Google Ads API v22 customers/2149990943"
      output: "data/google-ads-campaign-signal-audit-20260505-last14.json"
      window: "LAST_14_DAYS"
      fetched_at: "2026-05-05 11:39 KST"
      confidence: 0.94
    ga4_bigquery:
      source: "project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*"
      output:
        - "data/biocom-paid-channel-quality-20260505-last7.json"
        - "data/biocom-paid-channel-quality-20260505-last14.json"
        - "data/biocom-paid-channel-quality-20260505-last28.json"
      window: "2026-04-06~2026-05-03"
      freshness: "archive latest 2026-05-03"
      confidence: 0.86
```

## 10초 결론

이번 피드백의 핵심은 `NPay가 나쁘다`가 아니라 `NPay 클릭/count를 구매완료로 학습시키면 위험하다`로 표현과 설계를 고치는 것이다.

NPay 실제 결제완료 주문은 내부 매출이고 새 Google Ads `BI confirmed_purchase` 후보에도 포함해야 한다.
반대로 NPay 클릭, NPay 결제 시작, `add_payment_info`만 있는 행은 구매로 보내면 안 된다.

2026-05-05 14:25 KST 기준 `/ads/google` 문구는 이 기준으로 고쳤고, GA4 BigQuery read-only 분석에는 `결제 시작은 있었지만 GA4 purchase가 없는 세션`, `NPay 클릭은 있었지만 GA4 NPay형 purchase가 없는 세션` 버킷을 추가했다.
다만 GA4 BigQuery만으로는 `NPay 실제 결제완료 주문`을 확정할 수 없으므로, 다음 단계는 운영 DB + TJ 관리 Attribution VM + GA4 BigQuery 주문 단위 no-send 조인이다.

## 피드백별 검토와 진행 계획

| 순서 | 피드백 | 판단 | 이번에 진행한 것 | 다음 진행 |
|---:|---|---|---|---|
| 1 | `NPay가 나쁘다`처럼 쓰지 말 것 | 맞다. 결제수단 문제가 아니라 구매 신호 기준 문제다 | `/ads/google`에 `NPay 결제수단 자체가 문제가 아니다` 설명 카드를 추가했다 | 모든 Google Ads 문서에서 `NPay 제거` 대신 `NPay click/count 제외`로 표현한다 |
| 2 | NPay 실제 결제완료는 구매에 포함할 것 | 맞다. NPay confirmed order는 내부 매출이다 | [[google-ads-confirmed-purchase-execution-approval-20260505]]에 포함 기준을 명시했다 | 운영 source no-send dry-run에서 NPay confirmed order를 포함한다 |
| 3 | NPay 클릭/결제 시작은 구매에서 제외할 것 | 맞다. 이 신호는 purchase가 아니라 intent 또는 checkout이다 | `/ads/google`과 실행 승인안에 제외 기준을 명시했다 | Google Ads confirmed_purchase 후보 생성 시 `block_reason=npay_click_or_payment_start_only`를 추가한다 |
| 4 | 자사몰 구매가 없다고 단정하지 말 것 | 맞다. Google 유입의 자사몰 purchase는 적지만 0이 아니다 | BigQuery last7에서 Google Ads homepage purchase `4건 / 336,917원`, last28에서 `88건 / 22,146,204원`을 재확인했다 | `shop_payment_complete` transaction_id와 내부 confirmed order를 주문 단위로 조인한다 |
| 5 | Google ROAS와 내부 ROAS 차이 원인을 분해할 것 | 맞다. 가장 큰 원인은 Primary `구매완료` NPay count label이다 | 캠페인별 신호 감사와 gap 분해 문서를 유지했다 | 운영 source no-send dry-run에서 click id 보존률과 campaign block_reason을 같이 낸다 |
| 6 | Google confirmed purchase 경로로 gap을 줄일 수 있는지 검토 | 가능하다. 단 완전 일치가 아니라 해석 가능한 차이만 남기는 것이 목표다 | Data Manager API 1순위, Google Ads API fallback 실행 승인안을 분리했다 | Red Lane 승인 전까지 no-send payload만 만든다 |
| 7 | Google vs Meta 결제 전 퍼널을 비교할 것 | 진행 가능하다 | BigQuery 스크립트에 leakage 버킷을 추가하고 7/14/28일 산출물을 갱신했다 | 운영 order join 후 `GA4 purchase는 있는데 내부 주문 미매칭` 버킷을 추가한다 |
| 8 | 체류시간/스크롤은 Meta/Google 전환으로 바로 보내지 말 것 | 맞다. 먼저 내부 분석 장부가 안전하다 | [[../GA4/product-engagement-summary-contract-20260505]] 기준으로 no-write route `POST /api/attribution/engagement-intent`를 로컬 구현했다 | curl smoke와 GTM Preview 승인안 작성이 다음이다 |

## BigQuery read-only leakage 분석 결과

source: GA4 BigQuery archive `analytics_304759974_hurdlers_backfill.events_*`
freshness: archive latest `2026-05-03`
mode: read-only SELECT
주의: 이 표의 NPay 관련 값은 GA4 이벤트 기준이다. 실제 NPay 결제완료 여부는 운영 DB/아임웹 주문 조인이 필요하다.

### 최근 7일

window: `2026-04-27~2026-05-03`

| 유입 | 세션 | 평균 체류 | 90% 스크롤 | 일반 결제 시작 | 결제 시작 후 GA4 purchase 없음 | NPay 클릭 | NPay 클릭 후 GA4 NPay형 purchase 없음 | 홈페이지 purchase |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Google Ads | 6,879 | 36.41초 | 1,744 / 25.35% | 136 / 1.98% | 132 / 97.06% | 577 / 8.39% | 577 / 100% | 4건 / 336,917원 |
| Meta | 23,544 | 14.67초 | 3,049 / 12.95% | 337 / 1.43% | 139 / 41.25% | 26 / 0.11% | 25 / 96.15% | 199건 / 60,799,430원 |

해석:

- Google Ads 유입은 체류와 깊은 스크롤이 약하지 않다.
- 하지만 일반 결제 시작 후 GA4 purchase로 닫히지 않는 비율이 매우 높다.
- NPay 클릭은 Meta보다 훨씬 많지만, GA4 안에서는 실제 NPay purchase로 확인되지 않는다.
- 이 값만으로 `NPay 실제 구매가 없다`고 단정하면 안 된다. 운영 DB confirmed NPay 주문과 붙여야 한다.

### 최근 14일

window: `2026-04-20~2026-05-03`

| 유입 | 세션 | 일반 결제 시작 | 결제 시작 후 GA4 purchase 없음 | NPay 클릭 | NPay 클릭 후 GA4 NPay형 purchase 없음 | 홈페이지 purchase |
|---|---:|---:|---:|---:|---:|---:|
| Google Ads | 15,558 | 235 / 1.51% | 222 / 94.47% | 946 / 6.08% | 774 / 81.82% | 23건 / 6,666,427원 |
| Meta | 51,958 | 640 / 1.23% | 254 / 39.69% | 54 / 0.10% | 41 / 75.93% | 497건 / 171,053,014원 |

### archive 가용 28일

window: `2026-04-06~2026-05-03`

| 유입 | 세션 | 일반 결제 시작 | 결제 시작 후 GA4 purchase 없음 | NPay 클릭 | NPay 클릭 후 GA4 NPay형 purchase 없음 | 홈페이지 purchase |
|---|---:|---:|---:|---:|---:|---:|
| Google Ads | 32,373 | 418 / 1.29% | 370 / 88.52% | 1,434 / 4.43% | 1,262 / 88.01% | 88건 / 22,146,204원 |
| Meta | 120,097 | 1,288 / 1.07% | 505 / 39.21% | 97 / 0.08% | 84 / 86.60% | 1,194건 / 423,214,066원 |

## 개발 반영 사항

### 1. BigQuery read-only 스크립트 보강

파일: `backend/scripts/biocom-paid-channel-quality-readonly.ts`

추가한 것:

- `leakage` 결과 섹션
- `begin_checkout_without_ga4_purchase_sessions`
- `npay_click_without_ga4_npay_purchase_sessions`
- `view_item_only_no_checkout_sessions`
- `add_to_cart_without_checkout_sessions`
- `deep_scroll_no_commerce_sessions`

산출물:

- `data/biocom-paid-channel-quality-20260505-last7.json`
- `data/biocom-paid-channel-quality-20260505-last14.json`
- `data/biocom-paid-channel-quality-20260505-last28.json`

한계:

- 이 스크립트는 GA4 BigQuery만 본다.
- `NPay 실제 결제완료`, `내부 confirmed order 미매칭`은 운영 DB/Attribution VM 조인이 있어야 확정된다.

### 2. `/ads/google` 문구 개선

파일: `frontend/src/app/ads/google/page.tsx`

바꾼 것:

- `Google ROAS` 카드에 `platform_reference · 예산 판단 금지` 문구 추가
- `NPay 해석 기준` 설명 카드 추가
- `NPay 제거 후 잔차`를 `클릭/count 제외 후 잔차`로 변경
- `Primary NPay 전환값`을 `Primary NPay click/count`로 변경
- `Google Ads vs 내부 confirmed`를 `Google Ads platform_reference vs 내부 confirmed`로 변경

의도:

운영자가 화면을 봤을 때 `NPay를 막아야 한다`가 아니라 `NPay 실제 결제완료만 구매로 학습시켜야 한다`로 이해하게 한다.

## 다음 설계

### Phase A. 운영 source 기준 no-send dry-run 확장

목표:
Google Ads에 보낼 수 있는 실제 결제완료 주문 후보를 운영 source 기준으로 만든다.

포함:

- 홈페이지 구매하기 결제완료
- NPay 실제 결제완료 주문

제외:

- NPay 클릭
- NPay 결제 시작
- `add_payment_info`만 있는 row
- 취소/환불 반영 전 기준이 불명확한 row
- `gclid/gbraid/wbraid` 없는 row는 upload 후보에서 제외하고 block_reason으로 기록

필수 output:

```json
{
  "order_id": "...",
  "payment_key": "...",
  "payment_method": "homepage|npay|card|virtual_account",
  "payment_status": "confirmed|pending|canceled|refunded",
  "conversion_time": "...",
  "value": 0,
  "currency": "KRW",
  "gclid": null,
  "gbraid": null,
  "wbraid": null,
  "would_be_eligible_after_approval": false,
  "send_candidate": false,
  "block_reasons": ["approval_required", "missing_google_click_id"]
}
```

성공 기준:

- `confirmed_homepage`, `confirmed_npay`, `excluded_npay_click`, `excluded_payment_start`, `missing_google_click_id`, `duplicate_order`가 분리된다.
- 모든 후보의 `send_candidate=false`가 유지된다.
- 실제 Google Ads upload는 발생하지 않는다.

### Phase B. 자사몰 구매하기 전환 누락 검증

목표:
Google 유입에서 자사몰 구매가 적은 이유가 실제 구매 부족인지, 전환/클릭 ID 연결 누락인지 분리한다.

방법:

1. GA4 BigQuery의 `shop_payment_complete` purchase `transaction_id`를 뽑는다.
2. 운영 DB/Attribution VM confirmed order와 주문번호 기준으로 조인한다.
3. `purchase 있음 + 내부 order 없음`, `내부 order 있음 + GA4 purchase 없음`, `Google click id 있음/없음`을 분리한다.
4. 캠페인 ID, UTM, `gclid/gbraid/wbraid` 누락 사유를 `block_reason`으로 기록한다.

성공 기준:

- Google 유입 자사몰 purchase의 내부 confirmed 매칭률이 나온다.
- 구매 누락인지 attribution 누락인지 구분된다.

### Phase C. ProductEngagementSummary no-write route

목표:
체류시간과 스크롤 깊이를 광고 플랫폼 전환으로 보내지 않고 내부 분석 장부 후보로만 받는다.

방법:

- 로컬 backend에 `POST /api/attribution/engagement-intent` no-write route를 만들었다.
- `visible_seconds`, `max_scroll_percent`, `product_idx`, `ga_session_id`, `gclid/fbclid/utm`만 받는다.
- PII, `value`, `currency`, 건강 상태 추정값은 reject한다.
- 응답은 `dry_run=true`, `would_store=false`로 고정한다.

성공 기준:

- 로컬 typecheck 통과
- PII rejection curl smoke 통과
- 운영 DB write 없음
- Meta/Google/GA4 전송 없음

2026-05-05 14:38 KST 로컬 smoke 결과:

- 정상 payload: HTTP 200, `dryRun=true`, `wouldStore=false`, `dedupeKey=engagement:biocom:1777913700:423`
- URL 정제: `email`, `coupon` query 제거 후 `https://biocom.kr/DietMealBox/?idx=423&utm_source=meta`
- 금액 payload: HTTP 400, `reason=pii_or_value_detected`, `piiRejectedFields=["value"]`

## 금지한 것

이번 범위에서는 아래 작업을 하지 않았다.

- Google Ads conversion action 생성/수정
- Google Ads conversion upload
- Google Data Manager API ingest
- GTM Production publish
- backend 운영 deploy
- 운영 DB write/import
- 실제 고객 브라우저에 새 태그 적용

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

Lane: Green
Mode: read-only / no-send / no-write / no-deploy / no-publish
No-send verified: YES. grep hits are docs/regex/read-only classification only.
No-write verified: YES. grep hits are docs/env read-only key load only.
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:

- BigQuery leakage 분석은 GA4 이벤트 기준이라 실제 NPay confirmed order로 해석하면 안 된다.
- Google Ads confirmed purchase 실행은 Red Lane이며, TJ님 명시 승인 전까지 계속 중지한다.
