# Coffee GTM HURDLES to AGENTSOS Rename Approval

작성 시각: 2026-05-18 04:55 KST
기준일: 2026-05-18
문서 성격: GTM 태그 이름 정리 승인안
site: thecleancoffee
lane: Red for GTM Production publish, Green for this document

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/RULES.md
  required_context_docs:
    - GA4/gtm-thecleancoffee.md
    - project/coffee-agentsos-begin-checkout-custom-html-20260518.md
  lane: Red for GTM Production publish, Green for approval packet
  allowed_actions:
    - approval document
    - read-only GA4/GTM review
    - GTM Preview checklist
  forbidden_actions:
    - GTM Production publish without explicit TJ approval
    - Meta CAPI send
    - GA4 Measurement Protocol send
    - VM Cloud deploy
    - 운영DB write
    - raw identifier output
  source_window_freshness_confidence:
    source: GTM Preview + GA4 Realtime API
    window: 2026-05-18 KST preview/realtime
    freshness: fresh
    confidence: high
```

## 10초 요약

현재 `begin_checkout`는 GA4 Realtime에 들어오고 있다. 문제는 기능이 아니라 이름이다.
`AGENTSOS - [begin_checkout] 주문서작성`은 주문서작성 신호를 dataLayer에 만드는 태그이고, `HURDLES - [이벤트전송] 주문서작성`은 그 신호를 GA4로 보내는 태그다.
이번 승인안은 측정 로직을 바꾸지 않고, 헷갈리는 `HURDLES` 이름만 `AGENTSOS`로 정리하는 것이다.

## 바꾸는 것

아래 1개 태그만 이름을 바꾼다.

- 변경 전: `HURDLES - [이벤트전송] 주문서작성`
- 변경 후: `AGENTSOS - [GA4 이벤트전송] begin_checkout`

## 바꾸지 않는 것

- custom event: `begin_checkout` 유지
- GA4 measurement ID: `G-JLSBXX7300` 유지
- 기존 trigger 유지
- 기존 GA4 event name 유지
- 기존 변수 유지
- `AGENTSOS - [begin_checkout] 주문서작성` Custom HTML 유지
- Purchase, payment_success, CAPI, Google Ads 전환 설정 변경 없음

## 왜 필요한가

현재 GTM Preview에서는 두 태그가 같이 보인다.

1. `AGENTSOS - [begin_checkout] 주문서작성`: 주문서 화면에서 `begin_checkout` dataLayer 신호를 만든다.
2. `HURDLES - [이벤트전송] 주문서작성`: 그 신호를 GA4 이벤트로 보낸다.

둘 다 Fired 되는 것은 중복이 아니다. 하지만 이름이 다르면 운영자가 "둘 중 하나를 지워도 되나"로 오해할 수 있다. 이름을 맞추면 역할이 명확해진다.

## 적용 전 Preview 체크

1. GTM fresh workspace를 만든다.
2. 태그 이름만 변경한다.
3. thecleancoffee 상품 상세에서 `구매하기`를 누른다.
4. Tag Assistant 좌측 이벤트 목록에 `begin_checkout`이 생기는지 확인한다.
5. 실행 태그에서 아래 2개가 각각 1회인지 확인한다.
   - `AGENTSOS - [begin_checkout] 주문서작성`
   - `AGENTSOS - [GA4 이벤트전송] begin_checkout`
6. GA4 Realtime에서 `begin_checkout` count가 증가하는지 확인한다.

## 성공 기준

- `begin_checkout` dataLayer 신호 1회 생성.
- GA4 이벤트 전송 태그 1회 Fired.
- GA4 Realtime에서 `begin_checkout` 수신.
- `purchase` 발화 0.
- Meta CAPI send 0.
- 운영DB write 0.
- raw identifier output 0.

## 실패 조건

- `begin_checkout`이 2회 이상 중복 전송된다.
- GA4 Realtime에서 `begin_checkout`이 사라진다.
- Purchase 또는 결제완료 이벤트가 같이 발화된다.
- 다른 HURDLERS 태그까지 실수로 변경된다.

## 롤백

문제가 있으면 이름만 되돌린다.

- 변경 후: `AGENTSOS - [GA4 이벤트전송] begin_checkout`
- 롤백: `HURDLES - [이벤트전송] 주문서작성`

이름만 바꾸는 작업이므로 데이터 로직 롤백은 필요 없다.

## 승인 요청 문구

```text
[승인] 더클린커피 GTM 태그명 정리 진행.
범위: `HURDLES - [이벤트전송] 주문서작성` 이름만 `AGENTSOS - [GA4 이벤트전송] begin_checkout`으로 변경.
금지: trigger/event/variable/measurement ID 변경, Purchase/CAPI/운영DB/VM Cloud 변경, 다른 태그 rename.
Preview PASS 후 Production publish 가능.
```
