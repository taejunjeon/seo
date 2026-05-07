# biocom GTM Tag Coverage Ignore 후보 정리

작성 시각: 2026-05-05 01:50 KST
대상: Google Tag Coverage export `tag-coverage-GTM-W2Z6PHN.csv`
문서 성격: Tag Coverage 품질 경고 정리안. UI ignore는 선택이며 아직 실행하지 않는다.
관련 문서: [[GA4/gtm]], [[GA4/gtm-container-quality-gateway-diagnosis-20260505]], [[!total_past]], [[docurule]]
Lane: Green read-only documentation
Mode: No-write / No-publish / No-platform-send

```yaml
harness_preflight:
  source_window_freshness_confidence:
    tag_coverage_csv:
      source: "/Users/vibetj/Downloads/tag-coverage-GTM-W2Z6PHN.csv"
      parsed_at: "2026-05-05 01:50 KST"
      encoding: "utf-8-sig"
      confidence: 0.90
    public_fetch:
      source: "previous public HTML fetch summary in gtm-container-quality diagnosis"
      confidence: 0.84
  allowed_actions:
    - CSV read-only parse
    - candidate classification
    - documentation
  forbidden_actions:
    - Google Tag Coverage UI ignore
    - GTM publish
    - Google tag gateway setup
    - Imweb code edit
```

## 10초 결론

CSV 기준 고객 매출 퍼널과 광고 랜딩의 GTM 누락은 확인되지 않았다.
`Landing page=Yes` 48개는 모두 tagged다.
남은 `Not tagged + Ignored=No` 27개는 admin, login, 404, Imweb system endpoint, 이미 태그가 보이는 false positive 성격이다.

따라서 지금 해야 할 코드/GTM 수정은 없다.
Tag Coverage UI에서 ignore 처리하면 경고 노이즈는 줄일 수 있지만, ROAS 정합성 blocker는 아니다.

## CSV 요약

| 항목 | 값 |
|---|---:|
| 전체 URL row | 737 |
| Tagged | 573 |
| Not tagged | 93 |
| No recent data | 71 |
| Ignored=Yes | 68 |
| Ignored=No | 669 |
| Landing page=Yes | 48 |
| Landing page=Yes 중 Not tagged | 0 |
| 확인 대상 Not tagged + Ignored=No | 27 |

## 판단 기준

수정 대상은 고객이 실제로 매출을 만드는 경로에서 태그가 빠진 경우다.

수정 High priority:

- 홈
- 상품 상세
- 광고 랜딩
- 장바구니
- 주문서
- 결제 시작
- 결제 완료

ignore 후보:

- admin
- login/logout
- 404
- 쿠폰/관리자/통계 내부 페이지
- Imweb system endpoint
- 외부 또는 과거 도메인
- 이미 현재 HTML에는 태그가 있는 Tag Coverage 지연/false positive

## 27개 후보 분류

### UI ignore 후보

아래 URL은 고객 매출 퍼널이 아니라 admin, login, logout, 내부 관리, 404, Imweb system endpoint 성격이다.
Tag Coverage UI에서 ignore 처리해도 ROAS 정합성에는 영향이 없을 가능성이 높다.

- `biocom.imweb.me/admin/`
- `biocom.imweb.me/backpg/login.cm`
- `biocom.kr/%EC%97%90%EC%84%9C`
- `biocom.kr/1498095193/`
- `biocom.kr/5ive__stars`
- `biocom.kr/_/bo-analytics-marketing-performance/`
- `biocom.kr/admin/booking/order_cal`
- `biocom.kr/admin/config/domain`
- `biocom.kr/admin/config/localize`
- `biocom.kr/admin/config/membership`
- `biocom.kr/admin/member/kakao_friend/send`
- `biocom.kr/admin/promotion/coupon`
- `biocom.kr/admin/promotion/coupon/c2026033100c6aea9cb8e6`
- `biocom.kr/admin/promotion/coupon/c20260429d0034d0e5a9c9`
- `biocom.kr/admin/shopping/answers/`
- `biocom.kr/admin/shopping/restock_notification`
- `biocom.kr/admin/stat/product_performance`
- `biocom.kr/backpg/payment/oms/OMS_guest_login.cm`
- `biocom.kr/dialog/join.cm`
- `biocom.kr/employeeshop/`
- `biocom.kr/logout.cm`
- `biocom.kr/yeonddle`
- `www.biocom.kr/backpg/payment/oms/OMS_guest_login.cm`
- `www.biocom.kr/event/`

### 확인만 필요한 false positive 후보

아래 URL은 이전 public fetch 기준 GTM/GA4/AW-304339096가 확인됐다.
즉 코드 수정 대상이 아니라 Tag Coverage 지연 또는 redirect/URL 변형으로 본다.
UI ignore 전에 Tag Assistant로 한 번만 확인하면 된다.

- `biocom.kr/arang-self-prai`
- `biocom.kr/arang-self-text`
- `www.biocom.kr/site_join_pattern_choice`

## UI ignore를 꼭 해야 하는가

필수는 아니다.
지금 목적은 ROAS 정합성 blocker를 닫는 것이고, CSV 기준 고객 퍼널 누락은 없다.

UI ignore를 하면 좋은 점:

- Google Tag Coverage 경고 숫자가 줄어든다.
- 운영자가 admin/404 노이즈를 덜 보게 된다.

UI ignore를 나중으로 미뤄도 되는 이유:

- 광고 랜딩 48개는 모두 tagged다.
- 홈/상품/장바구니/결제완료 대표 URL도 태그가 있다.
- ignore는 실제 측정 품질 개선이 아니라 경고 노이즈 정리다.

## 하지 않은 일

- Google Tag Coverage UI에서 ignore 처리하지 않았다.
- GTM workspace를 저장하지 않았다.
- GTM Preview/Publish를 실행하지 않았다.
- Google tag gateway를 설정하지 않았다.

## 다음 할일

1. Codex: 이 문서를 [[GA4/gtm-container-quality-gateway-diagnosis-20260505]]와 [[!total_past]]에 연결한다. 왜: Tag Coverage 경고가 ROAS blocker가 아님을 정본 문서에서 바로 확인하게 하기 위해서다. 어떻게: 관련 문서와 다음 할일에 링크를 추가한다. 성공 기준: 운영자가 `태그 누락` 경고를 보고도 코드 수정 필요 여부를 판단할 수 있다. 컨펌 필요: NO.
2. TJ: 원하면 Google Tag Coverage UI에서 ignore 처리한다. 왜: 경고 노이즈를 줄일 수 있다. 어떻게: 위 `UI ignore 후보`만 선택하고, false positive 후보 3개는 Tag Assistant 확인 후 판단한다. 성공 기준: 고객 퍼널 URL은 ignore하지 않는다. 컨펌 필요: YES.
3. Codex: 다음 CSV export가 생기면 같은 기준으로 diff를 본다. 왜: 새 광고 랜딩이 untagged로 들어오면 실제 blocker가 될 수 있다. 어떻게: `Landing page=Yes AND Tag status!=Tagged`만 먼저 본다. 성공 기준: 광고 랜딩 누락 0 유지. 컨펌 필요: NO.
