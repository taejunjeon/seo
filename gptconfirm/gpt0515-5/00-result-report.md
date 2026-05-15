# gpt0515-5 Footer v4.4.1 Live Read-Only Postcheck

작성 시각: 2026-05-15 02:14 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: "Green read-only postcheck"
  allowed_actions:
    - live HTML curl read-only check
    - VM Cloud attribution ledger read-only aggregate
    - safe aggregate report
  forbidden_actions:
    - browser execution smoke that creates live rows
    - Meta operational Purchase send
    - Imweb save
    - GTM publish
    - backend deploy/restart
    - 운영DB write/import
    - raw identifier report/chat/telegram/git output
  source_window_freshness_confidence:
    source: "biocom.kr HTML curl + VM Cloud attribution_ledger read-only aggregate"
    window: "2026-05-15 02:00~02:11 KST 중심"
    freshness: "2026-05-15 02:14 KST"
    site: "biocom"
    confidence: 0.94
```

## 10초 요약

판정: `V4_4_1_LIVE_CODE_CONFIRMED` + `PAYMENT_PAGE_SEEN_RECEIVING` + `PAYMENT_SUCCESS_ARTIFACT_STOPPED_AFTER_SWITCH`.

v4.4.1 footer code가 live HTML에 반영됐다. VM Cloud에서도 새 snippet `2026-05-15-biocom-payment-page-seen-v4-4-1`이 8건 수신됐고, 8건 모두 `metadata.semantic_touchpoint=payment_page_seen`이다. 같은 snippet이 `/api/attribution/payment-success`로 들어간 row는 0건이다.

## 실제 확인

### live HTML

`https://biocom.kr/` HTML에서 아래 문자열을 확인했다.

- `2026-05-15-biocom-payment-split-v4-4-1`
- `payment_page_seen`
- `metadata.semantic_touchpoint`
- `paymentPageEndpoint: https://att.ainativeos.net/api/attribution/checkout-context`
- `paymentSuccessEndpoint: https://att.ainativeos.net/api/attribution/payment-success`

브라우저 실행 smoke는 하지 않았다. 브라우저로 `/shop_payment/`를 열면 새 VM Cloud row를 만들 수 있기 때문이다.

### VM Cloud attribution ledger

Read-only aggregate 기준:

- v4.3 old payment_success snippet: 96건.
- v4.3 latest logged_at: 2026-05-15 02:02 KST.
- v4.4.1 payment_page_seen snippet: 8건.
- v4.4.1 first logged_at: 2026-05-15 02:08 KST.
- v4.4.1 latest logged_at: 2026-05-15 02:10 KST.
- v4.4.1 rows by touchpoint: `checkout_started` 8건.
- v4.4.1 rows by semantic: `payment_page_seen` 8건.
- v4.4.1 rows by request path: `/api/attribution/checkout-context` 8건.
- v4.4.1 rows in `/api/attribution/payment-success`: 0건.
- v4.4.1 purchase candidate true: 0건.

해석: 현재 backend가 `checkout-context`를 `checkout_started`로 저장하는 한계는 남아 있지만, `semantic_touchpoint=payment_page_seen`으로 의미 구분은 살아 있다.

## data enrichment 확인

v4.4.1 8건 기준:

- `semantic_touchpoint=payment_page_seen`: 8건.
- `meta_purchase_candidate=true`: 0건.
- `is_purchase_candidate=true`: 0건.
- `completion_url=true`: 0건.
- selected payment method present: 6건.
- NPay button seen true: 8건.
- NPay clicked true: 2건.
- scroll metric present: 8건.
- dwell/time_on_page metric present: 8건.
- Google click id present: 1건.
- Meta cookie evidence present: 8건.

주의: NPay button seen/clicked는 결제완료가 아니다. actual NPay 매출은 운영DB/Imweb/NPay actual path로 닫아야 한다.

## 아직 남은 것

1. backend 정식 endpoint 또는 touchpoint 확장.
2. `/api/attribution/payment-success` downgrade/reject guard.
3. value guard patch.
4. Browser Purchase test-only.
5. confirmed bridge backfill은 별도 Red 승인 전 금지.

## 금지선 준수

- Meta 운영 Purchase send: 0.
- browser execution smoke: 0.
- Imweb save: 0 by Codex.
- GTM publish: 0.
- backend deploy/restart: 0.
- 운영DB write/import: 0.
- raw identifier output: 0.

## 다음 할일

### Codex가 할 일

1. VM Cloud backend endpoint/guard patch 초안.
- 추천: 진행 추천.
- 자신감: 93%.
- Lane: Green local patch, VM Cloud deploy는 Yellow.
- 무엇을 하는가: `payment_page_seen`을 별도 endpoint/touchpoint로 받고, `/shop_payment/`가 `payment-success`로 들어오면 reject/downgrade한다.
- 왜 하는가: 현재는 metadata로만 의미를 구분하고 있어, 화면/쿼리에서 `checkout_started`와 섞일 수 있다.
- 성공 기준: v4.4.1 row가 `payment_page_seen`으로 직접 집계되고, `/shop_payment/` `payment_success` row는 0.
- 승인 필요: 로컬 patch NO, VM Cloud deploy YES.
- 의존성: 독립 실행 가능.

2. value guard patch/fixture.
- 추천: 진행 추천.
- 자신감: 90%.
- Lane: Green local patch, VM Cloud deploy/Meta send는 승인 필요.
- 무엇을 하는가: Meta Purchase 후보 앞에서 source total, 0원, 취소/환불, duplicate, payment_page_seen을 no-send로 막는다.
- 왜 하는가: artifact는 멈췄지만 금액 오염은 별도 guard가 있어야 막힌다.
- 성공 기준: mismatch/0원/취소/중복/payment_page_seen 전부 no-send.
- 승인 필요: 로컬 patch NO, VM Cloud deploy YES, Meta send Red.
- 의존성: endpoint patch와 병렬 가능.

### TJ님이 할 일

1. Meta UI Test Events에서 browser event 확인.
- 추천: 진행 추천.
- 자신감: 75%.
- Lane: Green UI 확인, Purchase 발화는 금지.
- 무엇을 하는가: PageView/ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo가 browser에서 보이는지 확인한다.
- 왜 하는가: 이번 v4.4.1은 Meta Purchase를 살리는 코드가 아니라 artifact를 멈추는 코드이므로, browser Pixel health는 별도로 봐야 한다.
- 어떻게 하는가: Meta Events Manager > Pixel `1283400029487161` > Test Events에서 `facebook.com/tr` network와 이벤트 목록을 본다.
- 성공 기준: Purchase 없이 non-purchase browser events가 최근 수신된다.
- 실패 시 확인점: FBE 연결, browser blocker, AddPaymentInfo 지원 여부.
- Codex가 대신 못 하는 이유: Meta UI 실시간 이벤트 화면은 계정/브라우저 세션 접근이 필요하다.
- 승인 필요: NO. 단 Purchase test-only는 별도 승인 필요.
