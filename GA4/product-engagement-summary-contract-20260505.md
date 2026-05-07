# ProductEngagementSummary 내부 수집 Contract

작성 시각: 2026-05-05 02:00 KST
대상: biocom 상품 상세 engagement 수집 설계
문서 성격: backend no-write contract 및 로컬 dry-run route 기록. 운영 deploy, DB write, GTM Preview는 하지 않는다.
관련 문서: [[GA4/gtm-engagement-internal-analysis-design-20260504]], [[GA4/gtm]], [[capivm/!capiplan]], [[!total_past]], [[docurule]]
Lane: Green local no-write implementation
Mode: No-send / No-write / No-deploy / No-platform-send

```yaml
harness_preflight:
  source_window_freshness_confidence:
    engagement_design:
      source: "GA4/gtm-engagement-internal-analysis-design-20260504.md"
      confidence: 0.88
    gtm_state:
      source: "GTM-W2Z6PHN live v140/v141 read-only inventory"
      confidence: 0.84
  allowed_actions:
    - payload contract documentation
    - local no-write route implementation
    - dry-run response design
    - PII rejection rule design
  forbidden_actions:
    - backend route deploy
    - production DB write
    - GTM Preview
    - GTM Production publish
    - Meta/GA4 platform event send
```

## 10초 결론

체류시간과 스크롤은 Meta 전환으로 바로 보내지 않는다.
먼저 내부 분석 장부에 `ProductEngagementSummary`라는 한 이벤트로 저장할 수 있게 contract와 로컬 no-write route를 고정한다.

이 이벤트는 매출도 아니고 전환도 아니다.
상품 상세를 얼마나 진지하게 읽었는지 보는 보조 신호다.
나중에 실제 주문과 연결해 "깊게 본 사람이 더 많이 샀는가"를 확인한 뒤에만 Meta custom event 여부를 판단한다.

2026-05-05 14:25 KST 기준 `backend/src/routes/attribution.ts`에 `POST /api/attribution/engagement-intent` 로컬 no-write route를 추가했다.
이 route는 `dryRun=true`, `wouldStore=false`로만 응답하고 DB insert나 외부 플랫폼 전송을 하지 않는다.
2026-05-05 14:38 KST 기준 로컬 smoke에서 정상 payload는 200, `value` 포함 payload는 400 reject로 확인했다.

## endpoint 초안

```text
POST /api/attribution/engagement-intent
```

v1 상태:

- no-write dry-run contract와 로컬 route를 확정한다.
- 운영 deploy는 별도 승인 전까지 하지 않는다.
- DB insert는 하지 않는다.
- Meta, GA4, Google Ads로 전송하지 않는다.

## request payload

```json
{
  "site": "biocom",
  "event_name": "ProductEngagementSummary",
  "event_id": "pes:biocom:1700000000:abc123",
  "captured_at": "2026-05-05T02:00:00+09:00",
  "page_location": "https://biocom.kr/DietMealBox/?idx=423&utm_source=meta&utm_campaign=example",
  "page_referrer": "https://www.facebook.com/",
  "product_idx": "423",
  "product_name": "optional_display_name",
  "visible_seconds": 72,
  "max_scroll_percent": 68,
  "viewport_height": 844,
  "document_height": 6200,
  "ga_client_id": "GA1.1.111111111.222222222",
  "ga_session_id": "1777913700",
  "fbp": "fb.1.1777913700.x",
  "fbc": "fb.1.1777913700.y",
  "click_ids": {
    "fbclid": "optional",
    "gclid": "optional",
    "ttclid": "optional",
    "gbraid": "optional",
    "wbraid": "optional"
  },
  "utm": {
    "source": "meta",
    "medium": "paid_social",
    "campaign": "example",
    "term": "optional",
    "content": "optional"
  },
  "debug_mode": true
}
```

## required fields

- `site`
- `event_name`
- `event_id`
- `captured_at`
- `page_location`
- `product_idx`
- `visible_seconds`
- `max_scroll_percent`
- `debug_mode`

## optional fields

- `page_referrer`
- `product_name`
- `viewport_height`
- `document_height`
- `ga_client_id`
- `ga_session_id`
- `fbp`
- `fbc`
- `click_ids`
- `utm`

## PII 및 민감정보 차단

아래 값은 받지 않는다.

- 이메일
- 전화번호
- 이름
- 주소
- 주민번호/생년월일
- 질병명, 증상, 건강 상태 직접 추정값
- 결제 카드/계좌 정보
- raw cookie 전체 문자열
- URL 전체 query 중 allowlist 밖의 값
- `value`
- `currency`

거절 원칙:

- PII 후보 필드가 있으면 `wouldStore=false`로 dry-run reject한다.
- `product_name`에 민감 질환명처럼 보이는 값이 있어도 custom_data로 외부 전송하지 않는다.
- 이 이벤트는 내부 분석용이므로 금액 필드를 받지 않는다.

## page_location 정제 규칙

서버가 저장하거나 preview로 반환하는 URL은 아래 구조만 허용한다.

```text
origin + pathname + allowed_query
```

허용 query:

- `idx`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `fbclid`
- `gclid`
- `ttclid`
- `gbraid`
- `wbraid`

그 외 query는 제거한다.

예시:

```text
입력: https://biocom.kr/DietMealBox/?idx=423&email=a@test.com&utm_source=meta&coupon=SECRET
저장 후보: https://biocom.kr/DietMealBox/?idx=423&utm_source=meta
```

## 중복 방지 규칙

브라우저 v1 dedupe key:

```text
engagement:{site}:{ga_session_id || local_session_id}:{product_idx}
```

규칙:

- 같은 세션, 같은 상품은 한 번만 보낸다.
- 새 GA session 또는 새 브라우저 세션이면 같은 상품도 다시 허용한다.
- v1은 `sessionStorage` 기준으로 중복을 막는다.
- 서버 write가 생기는 v2에서는 같은 key를 idempotency key로 쓴다.

## 전송 fallback

브라우저 전송 우선순위:

1. `navigator.sendBeacon`
2. 실패 시 `fetch(..., { keepalive: true })`
3. 둘 다 실패하면 저장하지 않는다.

v1에서는 재시도 queue를 만들지 않는다.
이 신호는 내부 보조 지표이므로 purchase처럼 무리해서 복구하지 않는다.

## 파생 지표

원본 이벤트는 `ProductEngagementSummary` 하나다.
아래 값은 서버나 리포트에서 계산한다.

```text
is_engaged_view = visible_seconds >= 45 && max_scroll_percent >= 50
is_deep_view    = visible_seconds >= 90 && max_scroll_percent >= 75
bounce_like     = visible_seconds < 10 && max_scroll_percent < 25
attention_score = min(100, visible_seconds_score + scroll_score)
```

초기 기준은 7~14일 수집 뒤 상품군별로 조정한다.

## dry-run response 예시

```json
{
  "ok": true,
  "dryRun": true,
  "wouldStore": false,
  "eventName": "ProductEngagementSummary",
  "dedupeKey": "engagement:biocom:1777913700:423",
  "sanitizedPageLocation": "https://biocom.kr/DietMealBox/?idx=423&utm_source=meta&utm_campaign=example",
  "derived": {
    "isEngagedView": true,
    "isDeepView": false,
    "bounceLike": false,
    "attentionScorePreview": 64
  },
  "warnings": [],
  "piiRejectedFields": [],
  "source": {
    "mode": "no_write_preview",
    "receivedAt": "2026-05-05T02:00:02+09:00"
  }
}
```

PII reject 예시:

```json
{
  "ok": false,
  "dryRun": true,
  "wouldStore": false,
  "reason": "pii_detected",
  "piiRejectedFields": ["email", "phone"],
  "warnings": ["value_currency_not_allowed_for_engagement"]
}
```

## 하지 않은 일

- backend 운영 deploy를 하지 않았다.
- production DB write를 하지 않았다.
- GTM Preview를 실행하지 않았다.
- Meta/GA4/Google Ads로 이벤트를 보내지 않았다.

## 다음 할일

1. Codex: 운영 DB/VM 주문 연결 분석 SQL 초안을 만든다. 왜: engagement가 실제 구매 확률과 관련 있는지 확인해야 Meta/Google 보조 신호 여부를 판단할 수 있다. 어떻게: `product_idx`, `ga_session_id`, `payment_success`를 조인하는 BigQuery/VM read-only 초안을 만든다. 성공 기준: 구매자/비구매자별 체류시간과 스크롤 분포가 나온다. 컨펌 필요: 운영 write는 NO, GA4 raw 권한 이슈는 YES.
2. TJ+Codex: GTM Preview 실행 승인안을 만든다. 왜: 실제 상품 페이지에서 `visible_seconds`, `max_scroll_percent`, `product_idx`가 잡히는지 봐야 한다. 어떻게: 새 workspace, Preview only, 상품 URL 3~5개, Network payload 확인, Production publish 금지를 문서화한다. 성공 기준: no-write preview payload가 생성되고 중복 발사가 없다. 컨펌 필요: YES.
3. Codex: route를 운영 배포할지 말지 승인안을 만든다. 왜: 운영 deploy는 live backend에 영향을 주는 Yellow/Red 경계 작업이다. 어떻게: 허용 범위, 금지 범위, cleanup, success criteria를 별도 승인 문서로 분리한다. 성공 기준: TJ님이 YES/NO로 결정할 수 있다. 컨펌 필요: YES.
