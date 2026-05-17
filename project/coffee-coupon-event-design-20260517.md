# 더클린커피 쿠폰 이벤트 설계안

작성 시각: 2026-05-17 20:38 KST
대상 사이트: 더클린커피 (`thecleancoffee.com`)
문서 성격: Green Lane 설계안. GTM Publish, VM Cloud 배포, Meta CAPI 전송은 하지 않았다.

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
  required_context_docs:
    - AGENTS.md
    - docurule.md
    - GA4/gtm-thecleancoffee.md
    - GA4/gtm-preview-only-checklist.md
    - data/project/gtm-ga4-full-inventory-20260517.json
  lane: Green
  allowed_actions:
    - read_only_inventory
    - local_design_doc
    - dry_run_contract
  forbidden_actions:
    - gtm_publish
    - gtm_create_version
    - vm_cloud_deploy
    - platform_send
    - operational_db_write
  source_window_freshness_confidence:
    site: thecleancoffee
    gtm_container: GTM-5M33GC4
    ga4_property: analytics_326949178
    ga4_export_window: 2026-04-07..2026-05-16
    freshness: latest_ga4_export_2026-05-16
    confidence: high_for_inventory_medium_for_runtime_until_preview
```

## 10초 요약

쿠폰받기는 현재 더클린커피 GTM/GA4에 명시 이벤트로 없다. Meta Pixel Helper에 보이는 `SubscribedButtonClick`은 Meta/FBE 자동 감지에 가까워 내부 퍼널 정본으로 쓰기 어렵다. 쿠폰받기는 구매완료가 아니라 “구매 전 관심 신호”로 별도 이벤트를 만들고, VM Cloud에는 선행지표로 저장하는 것이 맞다.

## 현재 확인된 사실

- 더클린커피 GTM live tag/trigger 이름과 HTML 코드에서 `쿠폰`, `coupon`, `subscribe`, `subscribed`, `lead`, `button` 전용 태그는 확인되지 않았다.
- 더클린커피 GA4 BigQuery export 기간(`2026-04-07..2026-05-16`)에서 쿠폰 계열 event_name은 확인되지 않았다.
- TJ님 Preview 화면에서는 쿠폰받기 후 GTM Summary에 쿠폰 전용 Fired 태그가 보이지 않았다.
- Meta Pixel Helper에는 `SubscribedButtonClick`이 보였지만, 이 값은 Meta 자동 감지 이벤트로 보이며 GA4/VM Cloud 원장과 직접 연결되지 않는다.

## 무엇을 하는가

더클린커피 상품 상세의 `쿠폰받기` 행동을 “쿠폰 수령/클릭 선행지표”로 새로 정의한다. 이 이벤트는 구매완료, 결제수단 선택, 장바구니 담기와 분리한다.

추천 이벤트 이름:

- 내부/VM Cloud: `coupon_download`
- GA4: `coupon_download` 우선, GA4 프로모션 리포트까지 필요하면 `select_promotion` 보조 검토
- Meta: 즉시 Purchase로 보내지 않는다. 7일 이상 구매 연관성이 보이면 custom event 또는 Lead 후보로 별도 승인 검토

## 왜 필요한가

쿠폰받기는 가격 민감도와 구매 의도를 보여주는 행동이다. 매출이라는 후행지표만 보면 “왜 샀는지/왜 안 샀는지”가 늦게 보인다. 쿠폰받기를 선행지표로 잡으면 다음 질문에 답할 수 있다.

- 쿠폰을 받은 사람은 실제로 장바구니나 결제 시작까지 더 많이 가는가?
- 쿠폰을 받았는데 구매하지 않은 사람은 어느 단계에서 이탈하는가?
- Meta/네이버/오가닉 유입별로 쿠폰 반응률이 다른가?
- 할인 혜택이 실제 매출에 도움이 되는가, 아니면 원래 살 사람에게만 할인해 주는가?

## 어떻게 작동해야 하는가

사용자가 상품 상세에서 쿠폰받기 버튼을 누르면, 브라우저는 아래 순서로 기록한다.

1. GTM 또는 사이트 코드가 쿠폰 버튼 클릭을 감지한다.
2. GA4에는 `coupon_download` 이벤트를 보낸다.
3. VM Cloud에는 `touchpoint=coupon_download` 선행지표를 저장한다.
4. 동일 세션·동일 상품·동일 쿠폰은 1회만 센다.
5. 이 이벤트는 Meta Purchase 후보가 될 수 없다.

## 이벤트 데이터 계약 초안

VM Cloud에 저장할 최소 필드:

```json
{
  "site": "thecleancoffee",
  "source": "thecleancoffee_gtm_or_site",
  "touchpoint": "coupon_download",
  "event_name": "coupon_download",
  "client_observed_at": "browser_time",
  "page_type": "product_detail",
  "product_id_present": true,
  "coupon_value_present": true,
  "ga_join_key_present": true,
  "utm_present": true,
  "fbp_fbc_present": true,
  "is_purchase_candidate": false,
  "budget_roas_included": false
}
```

GA4 권장 파라미터:

- `coupon_context`: product_detail
- `coupon_button_text`: 값은 raw text 대신 bucket 처리
- `product_id`: 상품 식별자가 공개 상품 ID일 때만 허용
- `coupon_value_present`: true/false
- `currency`: KRW
- `value`: 쿠폰 금액을 직접 매출처럼 쓰지 않는다. 필요하면 할인액 참고값으로만 사용

## 개발 계획

1. [Codex] Preview 전용으로 버튼 선택자와 현재 dataLayer 변화를 확인한다.
   무엇: 쿠폰받기 클릭 시 기존 GTM/Imweb이 어떤 click event를 만드는지 본다.
   왜: 새 태그를 만들기 전에 이미 활용 가능한 click selector나 dataLayer가 있는지 확인하기 위해서다.
   어떻게: GTM Preview에서 쿠폰 클릭 직후 Fired/Not Fired, Variables, Data Layer 탭을 확인한다.
   산출물: 쿠폰 버튼 selector 후보와 이벤트명 후보.
   검증: 쿠폰 클릭 1회에만 안정적으로 잡히는 신호가 있어야 한다.
   의존성: GTM Preview 승인 또는 TJ님 화면 캡처.

2. [Codex] VM Cloud 선행지표 수신 endpoint 또는 기존 유입 원장 확장 설계를 확정한다.
   무엇: `coupon_download`을 화면 퍼널에서 읽을 수 있는 형태로 저장한다.
   왜: GA4만으로는 주문 원장과 안전하게 연결하기 어렵기 때문이다.
   어떻게: 기존 `site_landing_ledger`/`attribution_ledger` contract와 충돌하지 않게 `leading_indicator` 또는 `marketing_intent` 계열로 둔다.
   산출물: backend contract + fixture + no-send guard.
   검증: coupon row가 purchase candidate 0, raw id output 0, site=thecleancoffee로 분리된다.
   의존성: Green 로컬 설계 가능, VM Cloud 배포는 Yellow 승인 필요.

3. [Claude Code] 프론트엔드 퍼널에 “쿠폰받기” 단계를 추가한다.
   무엇: `view_item → coupon_download → add_to_cart → begin_checkout → add_payment_info → purchase` 흐름으로 보이게 한다.
   왜: 운영자가 쿠폰이 구매 전 행동인지 화면에서 바로 이해해야 한다.
   어떻게: API field가 나오면 conversion funnel 페이지에 단계 카드와 원인 패널을 추가한다.
   산출물: 프론트 화면.
   검증: site=biocom/thecleancoffee가 분리되고, 쿠폰은 예산 판단 매출로 합산되지 않는다.
   의존성: backend/API contract 선행.

4. [TJ] 실제 GTM Publish 여부를 승인한다.
   무엇: Preview에서 안정성이 확인된 쿠폰 이벤트를 live GTM에 반영할지 결정한다.
   왜: GTM Production Publish는 실제 운영 사이트 태그를 바꾸는 Red Lane이기 때문이다.
   어떻게: Tag Manager > 더클린커피 container > 새 workspace > Preview PASS 후 Submit/Publish.
   산출물: live coupon event.
   검증: GA4 DebugView/BigQuery/VM Cloud에서 `coupon_download`가 1회씩 적재된다.
   의존성: Preview PASS 선행.

## 100% 조건

- 쿠폰받기 클릭 1회가 `coupon_download` 1회로만 기록된다.
- 상품 상세 진입만으로 쿠폰 이벤트가 발생하지 않는다.
- 쿠폰 이벤트는 purchase/add_payment_info/begin_checkout으로 오분류되지 않는다.
- VM Cloud와 GA4에서 site=thecleancoffee로 분리된다.
- raw order/payment/member/click id 출력 0.
- Meta/Google/GA4 외부 전송 정책은 승인 전 변경 0.

## 승인선

- Green: 현재 문서 설계, read-only inventory, dry-run contract.
- Yellow: VM Cloud endpoint/화면 배포, Preview-only 검증.
- Red: GTM Production Publish, Meta custom event/Lead 전송을 광고 학습에 사용하는 변경.
