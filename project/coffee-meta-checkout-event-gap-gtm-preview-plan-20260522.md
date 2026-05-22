# 더클린커피 결제 단계 Meta 이벤트 공백과 GTM Preview 설계안

작성 시각: 2026-05-22 00:43 KST
기준일: 2026-05-22
문서 성격: 더클린커피 결제 페이지 Meta 이벤트 공백 진단 및 no-send GTM Preview 설계안
Lane: Green design / Yellow needed for GTM Preview execution / Red needed for Production publish

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/RULES.md
  required_context_docs:
    - project/coffee-imweb-live-smoke-result-20260522.md
    - project/coffee-imweb-full-paste-candidate-20260522.md
    - imweb/code_backup_coffee0522.md
  lane: Green
  allowed_actions:
    - read_only_diagnosis
    - no_send_preview_design
    - approval_packet_draft
  forbidden_actions:
    - GTM Production publish
    - Meta browser event production send
    - Meta CAPI enable
    - actual checkout or purchase
    - Imweb code save
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: TJ님 Pixel Helper observation + Codex no-send checkout reproduction
    window: 2026-05-22 00:39-00:43 KST
    freshness: immediately after Coffee Imweb full code replacement
    confidence: 0.86
```

## 10초 요약

Google 클릭 ID 저장은 실제 Chrome에서도 성공했다. 남은 문제는 결제 페이지에서 Meta `InitiateCheckout` 또는 `AddPaymentInfo`가 자동으로 뜨지 않는 것이다.

현재 Phase 9 코드는 Meta 이벤트를 새로 만들지 않는다. Imweb/aimweb이 이미 쏜 이벤트에 eventID를 붙이는 구조다. 따라서 결제 페이지에서 원래 이벤트가 없으면 Pixel Helper에도 보이지 않는다.

다음 단계는 GTM Preview에서 먼저 no-send 후보를 설계하는 것이다. Production publish와 실제 Meta 전송은 별도 승인 전에는 하지 않는다.

## 관측 결과

1. 상품 상세 페이지
   - Pixel Helper에서 `ViewContent`가 보인다.
   - Phase 9 wrapper가 설치되어 있어 eventID 주입 대상이다.
   - TJ님 실제 Chrome 확인 eventID: `ViewContent.75.mpfnp27y1z4ud1`

2. 결제 페이지
   - Pixel Helper에서 결제 단계 이벤트가 보이지 않는다.
   - Codex no-send 재현에서도 Meta `fbq('track', ...)` 호출은 `PageView`만 관측됐다.
   - 다만 자체 `checkout_started` payload는 만들어진다. 이것은 Meta Pixel Helper에 보이는 이벤트가 아니라 `att.ainativeos.net` attribution endpoint로 보내는 자체 신호다.

## 바이오컴과의 차이

바이오컴 결제 단계 이벤트는 GTM이 주체라고 보기 어렵다.

현재 바이오컴 정본 문서와 코드 기준으로는 아임웹/FBE browser pixel이 이미 쏘는 `fbq('track', ...)` 호출이 주체다. footer Phase 9는 그 호출을 가로채 eventID를 주입하고, server CAPI mirror 후보를 준비한다.

근거:

- `imweb/!code_headerfooter_biocom.md`의 Phase 9 주석은 dataLayer 구독과 자체 `fbq` 발사 방식을 폐기하고, aimweb이 이미 쏘는 `fbq` 호출을 가로채는 방식으로 전환했다고 적고 있다.
- 같은 주석은 `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`를 aimweb plimweb agent가 이미 발사 중이라고 기록한다.
- `imweb/!coderule.md`는 Phase 9가 기존 `fbq('track', ...)` 호출을 감싸는 wrapper라고 정의한다.
- 바이오컴 Block 4는 `fbq` wrapper chain이 실제 `facebook.com/tr` 요청을 만들지 못할 때만 쓰는 Meta browser image-beacon fallback이다. 이것도 GTM이 아니라 footer 보강 경로다.

따라서 Coffee에서 결제 페이지 이벤트가 안 보이는 현재 상태는 "GTM 설정이 빠졌다" 하나로 단정하면 안 된다. Coffee에는 Biocom처럼 결제 단계 Meta browser 이벤트를 실제로 만들거나 fallback하는 Block4가 없다. Coffee Phase 9는 이미 존재하는 `fbq` 이벤트에 eventID를 붙이는 역할이므로, `/shop_payment/`에서 원래 `InitiateCheckout` 또는 `AddPaymentInfo`가 없으면 새 이벤트가 나타나지 않는다.

## 설계 방향

1. 먼저 no-send Preview tag를 만든다.
   - 목적: 어떤 조건이면 결제 단계 이벤트를 만들 수 있는지 확인한다.
   - 동작: Meta로 보내지 않고 `console.info` 또는 `dataLayer` debug event만 남긴다.
   - 후보 조건: URL path가 `/shop_payment/`이고 `order_code` 또는 `order_no`가 존재하며, `/shop_payment_complete`가 아니다.
   - dedupe key: `coffee_meta_checkout_preview::{order_code || order_no || location.pathname}`

2. 그다음 Preview에서 실제 event payload 모양만 확인한다.
   - 이벤트 후보 A: `InitiateCheckout`
   - 이벤트 후보 B: `AddPaymentInfo`
   - 보수적 판단: `/shop_payment/` 진입만으로는 `InitiateCheckout`이 더 자연스럽다. `AddPaymentInfo`는 결제수단 선택 또는 결제 버튼 직전 조건을 추가로 잡을 수 있을 때 더 정확하다.

3. 운영 반영은 별도 Red 승인으로 분리한다.
   - Meta browser event production send는 외부 플랫폼 전환값에 영향을 준다.
   - GTM Production publish도 사이트 전체 추적에 영향을 준다.

## Preview 성공 기준

- fresh GTM workspace에서만 실행한다.
- Default Workspace는 쓰지 않는다.
- Production publish는 하지 않는다.
- `/shop_payment/`에서 Preview debug event가 1회만 생긴다.
- `/shop_payment_complete` 또는 일반 상품 페이지에서는 생기지 않는다.
- `order_code`, `order_no`, `gclid`, `gbraid`, `gad_campaignid`, `checkoutId` 중 저장 가능한 값이 payload preview에 들어간다.

## 다음 액션

1. Codex가 GTM Preview no-send 태그/트리거 후보를 구체화한다.
2. TJ님은 GTM Preview 실행을 승인할지 결정한다.
3. Preview가 통과하면 실제 Meta browser event 운영 전송 승인안을 별도로 만든다.
