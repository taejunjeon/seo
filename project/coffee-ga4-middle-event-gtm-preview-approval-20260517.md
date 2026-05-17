# 더클린커피 GA4 중간 이벤트 GTM Preview 승인안

작성 시각: 2026-05-17 17:46 KST
기준일: 2026-05-17
문서 성격: Yellow GTM Preview 승인안
대상 사이트: thecleancoffee

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/RULES.md
    - project/coffee-ga4-middle-event-enhancement-design-20260517.md
    - GA4/gtm.md
  lane: Yellow Preview only
  allowed_actions:
    - fresh_gtm_workspace_preview
    - tag_assistant_preview
    - ga4_debugview_observation
  forbidden_actions:
    - gtm_submit_create_version_publish
    - purchase_tag_change
    - meta_google_tiktok_naver_send_or_upload
    - operating_db_write
    - imweb_header_footer_save
    - raw_identifier_report_output
  source_window_freshness_confidence:
    source: local GTM inventory docs + GA4 middle-event design + safe bridge dry-run
    window: latest 7d behavior gap
    freshness: design 2026-05-17, coffee live tracking inventory stale since 2026-05-01
    confidence: medium_high
```

## 10초 요약

더클린커피는 GA4에서 `purchase`는 보이지만 구매 전 중간 단계인 `begin_checkout`과 `add_payment_info`가 비어 있거나 약하다.
다만 2026-05-17 TJ님 GTM UI 확인으로 더클린커피 컨테이너에 이미 `HURDLERS - [데이터레이어] 네이버페이구매 (장바구니)`와 `GA4 page_view_long 이벤트`가 있는 것이 확인됐다.
따라서 방향은 “새 태그를 바로 만들기”가 아니라, 기존 태그가 실제로 발화되는지와 GA4 이벤트명으로 무엇이 남는지를 먼저 확인하는 것이다.
이 승인안은 운영 게시가 아니다.
GTM fresh workspace에서 Preview만 열고, `purchase` 태그는 절대 건드리지 않는다.

## 2026-05-17 TJ님 GTM UI 발견 반영

이번 캡처로 아래 기존 태그가 확인됐다.

- `HURDLERS - [데이터레이어] 네이버페이구매 (장바구니)`: 장바구니 화면에서 네이버페이 구매 의도 또는 선택 상품 정보를 dataLayer로 만드는 맞춤 HTML 태그로 보인다. 이 신호는 `NPay 장바구니/구매 의도` evidence이지, 실제 결제완료가 아니다.
- `GA4 page_view_long 이벤트`: `page_view_long`이라는 GA4 이벤트를 보내는 태그다. 오래 머문 사람을 보는 선행지표로 쓸 수 있다. 단, `value=100`, `currency=KRW`는 매출로 해석하지 않는다.

정정:

- 이전 문서의 “중간 이벤트가 비어 있다”는 말은 GA4 BigQuery에서 표준 ecommerce 이벤트명인 `begin_checkout/add_payment_info`가 비어 있다는 뜻이었다.
- “GTM에 관련 태그가 없다”는 뜻이 아니며, 최신 GTM UI 태그 인벤토리는 stale 상태였다.
- 따라서 Preview 목표는 신규 생성이 아니라 기존 태그의 실제 발화, event name, 파라미터, 중복 여부를 확인하는 것이다.

## 승인 문구

```text
Preview only YES: thecleancoffee GTM-5M33GC4 fresh workspace에서 기존 page_view_long, HURDLERS 네이버페이 장바구니 태그, view_cart/begin_checkout/add_payment_info 매핑을 GTM Preview로 검증.
Production publish, purchase 변경, 외부 전환 전송, DB write, Imweb header/footer 저장은 금지.
```

## 무엇을 확인하는가

### 기존 `page_view_long`

사람이 페이지에 오래 머물렀는지 보는 이벤트다.
구매가 아니고 매출도 아니다.

성공 기준:

- 긴 조회 시간 트리거에서 `page_view_long`이 1회 발화
- GA4 measurement ID가 더클린커피 속성으로 맞음
- `value=100`이 매출로 표시되거나 purchase revenue로 합산되지 않음
- `purchase` 미발화

### 기존 HURDLERS 네이버페이 장바구니 태그

장바구니 화면에서 네이버페이 구매 의도나 선택 상품을 dataLayer로 만드는 신호다.
실제 NPay 결제완료가 아니다.

성공 기준:

- 장바구니 화면 또는 네이버페이 관련 클릭에서만 발화
- dataLayer event name과 GA4 event name을 확인
- `purchase`로 발화하지 않음
- NPay 클릭/의도와 실제 결제완료를 분리해 볼 수 있음

### view_cart

사람이 장바구니 화면에 들어갔는지 보는 이벤트다.
구매가 아니다.

성공 기준:

- `/shop_cart` 또는 장바구니 화면 진입 시 1회 발화
- 가능하면 `items`, `currency=KRW`, 장바구니 기준 `value` 확인
- `purchase` 미발화

### begin_checkout

사람이 결제 흐름을 시작했는지 보는 이벤트다.
구매가 아니다.

성공 기준:

- `/shop_payment/` 또는 주문서/결제 시작 화면에서 1회 발화
- 장바구니 보기만으로 발화되면 실패
- `purchase` 미발화

### add_payment_info

사람이 결제수단을 선택했는지 보는 이벤트다.
구매가 아니다.
단순 페이지 로드가 아니라 결제수단 선택/확인 흔적이 있어야 한다.

성공 기준:

- 결제수단 선택 후 1회 발화
- `payment_type`은 `card`, `npay`, `virtual_account`, `bank_transfer`, `unknown` 같은 제한 enum
- NPay는 실제 승인/결제 완료 전 중단
- `purchase` 미발화

## TJ님이 실제로 누를 화면

1. Google Tag Manager 접속
2. 계정 `바이오컴(최종)`에서 컨테이너 `GTM-5M33GC4` 선택
3. Default Workspace를 쓰지 않고 live latest 기준 fresh workspace 생성
4. workspace 이름 예시: `codex_coffee_ga4_middle_events_preview_20260517`
5. `Preview` 버튼만 클릭
6. Tag Assistant에 `https://thecleancoffee.com` 입력
7. 장바구니 보기, 결제 시작, 결제수단 선택까지만 테스트
8. `Submit`, `Create version`, `Publish`는 누르지 않음

## 중단 기준

- Preview 중 `purchase`가 새로 발화됨
- `view_cart`, `begin_checkout`, `add_payment_info`가 반복 발화됨
- Default Workspace에서 작업하려는 상황 발생
- GTM submit/create_version/publish가 필요해짐
- 실제 결제나 실제 주문이 필요해짐
- Meta CAPI, Google Ads, TikTok, Naver 전송이 관측됨
- GTM/GA4 권한 또는 2FA로 접근 불가

## 왜 지금 Preview가 필요한가

더클린커피 safe bridge 기준으로 구매자/이탈자 비교는 이미 가능하다.
하지만 GA4의 `begin_checkout`과 `add_payment_info`가 현재 0에 가까워서 결제 직전 이탈 원인을 GA4만으로 볼 수 없다.
또한 TJ님 캡처 기준 기존 GTM 태그가 이미 있으므로, Preview를 통과하면 “이미 있는 태그를 그대로 쓸지, 표준 이벤트명으로 매핑만 보강할지, 정말 새 태그가 필요한지”가 분명해진다.

## 100% 조건

- fresh workspace 사용
- Tag Assistant 연결 성공
- 기존 `page_view_long`과 HURDLERS 네이버페이 장바구니 태그 발화 여부 확인
- `view_cart/begin_checkout/add_payment_info`가 기존 태그로 이미 만들어지는지 확인
- `purchase` 추가 발화 0
- GTM publish 0
- 외부 전환 전송 0
- 운영DB/VM Cloud write 0
- raw identifier output 0

## Codex 판단

Preview-only는 진행할 가치가 있다.
이유는 새 태그 생성보다 기존 태그 재사용이 더 안전하기 때문이다.
coffee live tracking inventory가 2026-05-01 기준으로 stale이라, Preview 전 컨테이너 live version과 현재 태그 상태를 read-only로 갱신해야 한다.

Codex의 이전 판단 보정:

- 최신 더클린커피 GTM UI 태그 존재를 직접 확인하지 못한 상태에서 BigQuery event gap 중심으로 설계했다.
- TJ님 캡처로 기존 태그 존재가 확인됐으므로, 신규 보강보다 existing tag inventory refresh와 GA4 event name mapping 검증을 우선한다.
