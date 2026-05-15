# gpt0515-10 Meta Funnel Fallback v0.3.1 Result

작성 시각: 2026-05-15 10:27 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
  lane:
    code_draft: Green
    imweb_footer_save: Yellow approval required
    meta_purchase_send: Red approval required
  allowed_actions:
    - document draft
    - code draft
    - no-send verification
  forbidden_actions:
    - Meta 운영 Purchase send
    - Purchase browser fallback
    - PageView/ViewContent modification
    - Imweb footer save without TJ approval
    - GTM publish
    - 운영DB write/import
    - VM Cloud schema migration
    - raw identifier output
  source_window_freshness_confidence:
    source: "TJ님 관측: native_seen InitiateCheckout but facebook.com/tr ev=InitiateCheckout network_count=0 + gpt0515-7 Block 4 v0.1 draft"
    window: "2026-05-15 KST"
    freshness: "2026-05-15 10:27 KST"
    site: "biocom"
    confidence: "high for code path; live effect requires browser Network smoke"
```

## 10초 요약

Block 4 v0.3.1 초안을 만들었다.
이번 버전은 `fbq` 호출 감지만으로 fallback을 건너뛰지 않는다.
실제 `facebook.com/tr` 네트워크 요청에 `ev=InitiateCheckout`, `ev=AddToCart`, `ev=AddPaymentInfo`가 없을 때만 fallback을 보낸다.

## 이번에 가능해진 것

브라우저가 “이벤트를 호출한 것처럼 보였지만 Meta로 실제 요청은 안 나간 상황”을 보완할 수 있다.
이전 v0.2는 `observedNative`를 skip 기준으로 써서, 네트워크 요청이 0건이어도 fallback이 막힐 수 있었다.
v0.3.1은 `observedNative`를 참고 기록으로만 남기고, `performance.getEntriesByType('resource')`의 실제 Meta 요청 수를 기준으로 판단한다.

## 완료한 것

- `gptconfirm/gpt0515-10/01-block4-v0-3-1-code.md` 작성.
- `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`만 fallback 대상 유지.
- `Purchase`, `PageView`, `ViewContent`는 코드 경로에서 차단.
- `sessionStorage` dedupe 유지.
- `observedNative`는 `__biocom_meta_native_seen_v031`에 참고 기록으로만 저장.
- fallback 판단 로그는 `__biocom_meta_funnel_fallback_v031`에 저장.

## 하지 않은 것

- 아임웹 Footer 저장 안 함.
- Meta 운영 Purchase 전송 안 함.
- Pixel 전체 직접 삽입 안 함.
- GTM publish 안 함.
- 운영DB write/import 안 함.
- VM Cloud deploy/restart 안 함.

## 검증 결과

- Block 4 코드 블록 JavaScript syntax PASS.
- manifest JSON parse PASS.
- validate_wiki_links PASS.
- harness-preflight-check --strict PASS.
- git diff --check PASS.
- raw order/payment/click/member/email/phone pattern scan PASS.
- 실제 브라우저 Network smoke는 TJ님이 아임웹 Footer에 적용한 뒤 가능하다.

## 현재 판단

추천: 조건부 진행.

이유는 명확하다.
현재 병목은 native call 감지와 실제 네트워크 전송이 어긋나는 것이다.
v0.3.1은 실제 `facebook.com/tr` 요청이 없을 때만 보완하므로 v0.2보다 안전하다.

## 확인하면 좋은 문서

1. `gptconfirm/gpt0515-10/01-block4-v0-3-1-code.md` — 아임웹 Footer에 추가할 Block 4 v0.3.1 전체 코드.

## 다음 할 일

### TJ님

1. 아임웹 Footer에 Block 4 v0.3.1 적용 여부를 승인한다.
   - 목적: Meta에서 빠진 `InitiateCheckout`, `AddToCart`, `AddPaymentInfo`를 복구한다.
   - 방법: 기존 Header/Block 1/Block 2/Block 3은 유지하고 Block 4만 추가한다.
   - 성공 기준: Network에서 `facebook.com/tr`의 `ev=InitiateCheckout`, `ev=AddPaymentInfo`, `ev=AddToCart`가 보인다.
   - 실패 기준: `ev=Purchase`가 Block 4 때문에 생기거나, 중복 이벤트가 과도하게 늘어난다.
   - 추천 점수: 90%.

### Codex

1. TJ님이 적용하면 브라우저 Network 체크리스트를 기준으로 결과를 판정한다.
   - 목적: 실제 Meta 요청이 나갔는지 확인한다.
   - 방법: Network 필터 `facebook.com/tr`, sessionStorage 로그, Meta Events Manager를 같이 본다.
   - 성공 기준: `network_count=0`이던 이벤트가 fallback 후 1 이상으로 바뀐다.
   - 승인 필요 여부: read-only 확인은 불필요. 추가 아임웹 수정은 별도 승인 필요.
   - 추천 점수: 92%.
