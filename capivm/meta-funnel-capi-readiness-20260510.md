# Meta funnel CAPI readiness update (2026-05-10)

작성 시각: 2026-05-10 KST
작업 성격: Green Lane read-only readiness update
대상: biocom Meta funnel CAPI 후보 이벤트

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Green
  allowed_actions:
    - 코드/문서 read-only 점검
    - readiness 문서화
    - Test Events 실행 계획 작성
  forbidden_actions:
    - Meta CAPI operational send
    - Meta Test Events 호출
    - GTM Production publish
    - Imweb production save
    - Pixel/token/env 변경
  source_window_freshness_confidence:
    source: capivm/meta-funnel-capi-readiness-20260508.md + backend route inventory
    window: 2026-05-08 ~ 2026-05-10
    freshness: 2일 이내 문서/코드 근거
    confidence: medium_high
```

## 5줄 결론

1. Meta funnel CAPI는 서버 endpoint와 이벤트 whitelist 기준으로 준비도는 높다.
2. ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo는 server-side 후보로 설계 가능하다.
3. 아직 browser/server dedup과 Meta Test Events 수신 검증은 끝나지 않았다.
4. 운영 ON은 금지이며, 다음 단계는 Test Events code 기반 smoke 승인안이다.
5. Google/NPay ROAS correction의 P0는 Google Ads/ConfirmedPurchasePrep이고, Meta CAPI는 P1 readiness로 둔다.

## 현재 준비 상태

| 항목 | 상태 | 해석 |
|---|---|---|
| endpoint | READY | `POST /api/meta/capi/track` 경로가 문서상 확인됨 |
| allowed events | READY | ViewContent / AddToCart / InitiateCheckout / AddPaymentInfo / Lead / Search |
| event_id required | READY | dedup 설계를 위해 필수 |
| test_event_code support | READY | Meta Test Events smoke 가능 |
| Purchase CAPI | LIVE_EXISTING | 기존 Purchase CAPI는 운영 송출 이력이 있음 |
| funnel client wiring | HOLD | biocom GTM/Imweb 쪽 client 호출이 아직 없음 |
| browser/server dedup | HOLD | 동일 event_id로 Test Events 확인 전 |
| operational send | NO | 별도 승인 전 금지 |

## 이벤트별 readiness

| event | 현재 의미 | 필요한 확인 |
|---|---|---|
| ViewContent | 상품/콘텐츠 조회 서버 mirror 후보 | client event_id 생성 위치 |
| AddToCart | 장바구니 추가 서버 mirror 후보 | item/value payload 안정성 |
| InitiateCheckout | checkout 시작 서버 mirror 후보 | checkout trigger scope |
| AddPaymentInfo | 결제 정보 입력/결제 시작 후보 | NPay click과 actual purchase 혼동 금지 |

AddPaymentInfo는 구매완료가 아니다. 특히 NPay에서는 버튼 클릭/결제 시작과 실제 결제완료가 분리되므로 Meta funnel CAPI에서도 purchase로 승격하지 않는다.

## 운영 ON 금지선

아래는 별도 승인 전 금지다.

- Meta CAPI production event send
- GTM Production publish
- Imweb body/footer production save
- Pixel ID 변경
- Conversions API token 변경
- Purchase event 중복 생성
- AddPaymentInfo를 Purchase처럼 쓰는 것

## 다음 승인 후보

Meta를 진행한다면 다음 승인 후보는 운영 ON이 아니라 Test Events smoke다.

범위:

- Meta Events Manager에서 test_event_code 1개 발급
- ViewContent / AddToCart / InitiateCheckout / AddPaymentInfo 각 1건 이하
- `test_event_code` 포함
- 운영 production count 증가 0건 확인
- browser/server 동일 event_id dedup 확인

## P1로 둔 이유

현재 Google/NPay ROAS 과대계상 문제의 핵심은 Google Ads에 어떤 구매 신호가 들어가는지, 그리고 내부 confirmed purchase와 얼마나 다른지다. Meta funnel CAPI는 퍼널 품질 개선에는 중요하지만 Google Ads confirmed_purchase upload 전제 조건은 아니다.

따라서 우선순위:

1. P0: ConfirmedPurchasePrep 통합 input과 Google Ads action/campaign decomposition
2. P1: Meta funnel CAPI Test Events smoke
3. P2: Meta operational wiring canary

