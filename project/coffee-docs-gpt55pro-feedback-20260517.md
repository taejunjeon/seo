# 더클린커피 GA4/GTM 문서 GPT-5.5 Pro Web 피드백

작성 시각: 2026-05-17 KST
검토 방식: Chrome 확장으로 ChatGPT Pro 웹 세션에 두 문서 전문을 입력하고, `GPT-5.5 Pro 기준` senior growth data / attribution / GA4-GTM auditor 관점 피드백 요청
대상 문서:

- `/Users/vibetj/coding/seo/project/coffee-ga4-middle-event-gtm-preview-approval-20260517.md`
- `/Users/vibetj/coding/seo/project/coffee-channel-cohort-truth-table-20260517.md`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
  lane: Green
  allowed_actions:
    - external_ai_feedback_collection_via_chrome
    - feedback_summary_document
  forbidden_actions:
    - gtm_publish
    - platform_send_or_upload
    - operating_db_write
    - vm_cloud_schema_migration
    - raw_identifier_report_output
  source_window_freshness_confidence:
    source: ChatGPT Pro web feedback + local markdown docs
    window: docs dated 2026-05-17 KST
    freshness: live browser feedback collected 2026-05-17 KST
    confidence: medium_high
```

## 결론

외부 리뷰 verdict는 **수정 후 진행**이다.

두 문서 모두 방향은 맞다. 특히 `purchase`를 실제 매출 정본으로 쓰지 않고, VM Cloud confirmed actual order와 GA4/GTM 행동 증거를 분리한 점은 좋다는 평가를 받았다.

다만 지금 상태로 바로 운영자가 읽으면 `구매율`, `구매 금액`, `이탈자 중 GA4 purchase`를 채널 성과표처럼 과해석할 위험이 있다. GTM Preview 승인안도 Preview-only 방향은 좋지만, 실행 전 안전 preflight가 더 필요하다는 피드백이다.

## 잘 된 점

1. 실제 결제완료 정본과 행동 이벤트를 분리했다.
   - VM Cloud confirmed actual order는 실제 구매 판단.
   - GA4/GTM/광고 플랫폼은 행동 증거와 cross-check source.
   - 이 구분은 유지해야 한다.

2. GTM Preview 승인안의 기본 안전 울타리가 좋다.
   - fresh workspace 사용.
   - Preview only.
   - `purchase` 태그 변경 금지.
   - GTM Production publish 금지.
   - 외부 전환 전송, DB write, raw identifier 출력 금지.

3. Truth Table의 목적 설명이 좋다.
   - “광고 예산을 바로 바꾸는 표가 아니라, 구매 전에 어떤 행동이 매출을 예고하는지 찾는 선행지표 탐색 표”라는 설명은 적절하다.

## P0 수정 피드백

### 1. GTM Preview preflight 보강

Preview 전에 아래 항목을 추가해야 한다.

- GTM live version snapshot 갱신.
- workspace diff 확인.
- `purchase` 또는 광고 전환 태그 변경 0건 확인.
- Preview 중 Meta / Google Ads / TikTok / Naver 광고 전환 endpoint 신규 전송 0건 확인.
- VM Cloud order/payment count baseline 기록.
- raw order/payment/member/click/email/phone identifier가 dataLayer, Tag Assistant, DebugView, 보고서에 노출되지 않는지 확인.
- 테스트 경로 matrix 확정: 장바구니, 주문서, 결제수단 선택, NPay 중단 지점.

### 2. GTM Preview stop criteria 보강

아래 중 하나라도 나오면 Preview를 중단해야 한다.

- workspace diff에서 `purchase` 또는 광고 전환 태그 변경 발견.
- `add_payment_info`가 단순 페이지 로드만으로 발화.
- NPay 선택만 했는데 GA4 purchase, Google Ads conversion, Meta Purchase, Naver conversion이 같이 발화.
- 테스트 중 실제 주문번호/결제대기 주문이 생성.
- Tag Assistant 연결을 위해 Imweb header/footer 저장이 필요해짐.
- 기존 live purchase 태그와 Preview 변경사항이 섞여 원인 분리가 안 됨.
- 테스트 중 VM Cloud order/payment row 증가.
- `view_cart`, `begin_checkout`, `add_payment_info` 이벤트명 또는 parameter가 설계와 다르게 발화.

### 3. Truth Table 컬럼명 안전화

현재 컬럼명은 운영자가 채널 성과로 오해할 수 있다.

추천 변경:

- `구매율` -> `VM confirmed safe-session 구매완료율`
- `구매 금액` -> `VM confirmed revenue`
- `이탈자` -> `checkout/payment 도달 후 VM 미확정 세션`
- `이탈자 중 GA4 purchase` -> `VM 미확정이나 GA4 purchase 있음`

### 4. 예산 판단 금지 문구 강화

Truth Table 상단에 아래 취지의 문구를 추가하는 것이 좋다.

> 이 표는 광고 예산 증감, 채널 중단, 캠페인 평가에 직접 사용하지 않는다. 현재 표는 checkout/payment 근처의 행동 진단표이며, confirmed ROAS/CAC 판단표가 아니다.

### 5. `naver_other`와 `scroll90` 해석 제한

- `naver_other`는 표본 19개이고, `VM 미확정이나 GA4 purchase 있음` 비율이 높아 성과 판단 전에 연결 문제부터 봐야 한다.
- `scroll90`은 대부분 90% 이상이라 변별력이 약하다. 운영 의사결정 지표가 아니라 보조 진단 지표로 내려야 한다.

## P1 보강 피드백

1. confirmed ROAS / CAC 추가.
   - 광고 채널 판단에는 광고비가 들어가야 한다.
   - 현재 Truth Table은 행동표이지 수익성표가 아니다.

2. 신규 / 재구매 분리.
   - 더클린커피는 재방문, 기존 고객, 콘텐츠 유입이 섞일 수 있다.
   - 신규와 재구매를 섞으면 채널 판단이 왜곡된다.

3. channel x landing bucket 교차표 추가.
   - 채널 문제인지 랜딩 페이지 문제인지 분리해야 한다.

4. 결제수단별 이탈 추가.
   - NPay, 카드, 무통장, 가상계좌는 이탈 원인이 다르다.
   - `add_payment_info` Preview 이후 결제수단별 단계 표가 필요하다.

5. sample threshold 적용.
   - N < 30: 판단 금지
   - N 30-99: 참고
   - N 100 이상: 추세 판단 가능
   - N 300 이상: 운영 판단 후보

## P2 고도화 피드백

1. funnel sequence report 추가.
   - `landing -> product_view -> view_cart -> begin_checkout -> add_payment_info -> confirmed_order`

2. 채널별 path 비교.
   - 예: 유튜브는 장바구니 없이 checkout으로 가는지, 네이버는 상품 상세에서 오래 머무는지.

3. 자동 감사 리포트.
   - GA4 purchase vs VM confirmed 차이.
   - `dropped_with_ga4_purchase` 급증.
   - `direct_or_unknown` 비중 급증.
   - 중간 이벤트 0 또는 급감.
   - 외부 전환 send 발생 여부.
   - raw identifier 출력 여부.

## 운영 의사결정에 추가할 최소 필드

- `report_window`
- `channel_group_version`
- `safe_sessions`
- `confirmed_orders`
- `confirmed_revenue`
- `AOV`
- `revenue_per_safe_session`
- `new_vs_returning`
- `landing_bucket`
- `device_type`
- `payment_method_bucket`
- `ga4_join_status`
- `dropped_with_ga4_purchase_count`
- `later_confirmed_count`
- `checkout_step_coverage`
- `sample_size_flag`
- `decision_allowed_flag`

특히 `decision_allowed_flag`가 중요하다. 각 bucket을 예산 판단 가능 / 참고 / 판단 금지로 분리해야 한다.

## 외부 리뷰의 조건부 승인 문구

```text
Conditional YES: thecleancoffee GTM-5M33GC4 fresh workspace에서 view_cart/begin_checkout/add_payment_info Preview 검증은 진행한다.

단, Preview 전 live version snapshot 갱신, workspace diff 확인, purchase/광고 전환 태그 변경 0건 확인, 외부 전환 endpoint 전송 없음 확인, VM Cloud order/payment count baseline 확인을 완료해야 한다.

Truth Table은 현재 예산 판단용이 아니라 checkout/payment 행동 진단용으로만 사용한다. 특히 GA4 purchase, 구매율, 구매 금액은 VM confirmed actual order와 분리해서 해석한다.
```

## Codex 판단

외부 피드백은 타당하다.

가장 먼저 반영할 것은 두 가지다.

1. GTM Preview 승인안에 preflight/stop criteria를 보강한다.
2. Truth Table의 표현을 “성과표”가 아니라 “행동 진단표”로 안전하게 바꾼다.

실제 GTM Preview 실행은 Yellow Lane이다. 문서 보강은 Green Lane으로 즉시 진행 가능하지만, 이번 문서는 피드백 수집 목적이므로 원본 두 문서는 아직 수정하지 않았다.
