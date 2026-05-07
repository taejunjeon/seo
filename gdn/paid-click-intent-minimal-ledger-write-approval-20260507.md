# minimal paid_click_intent ledger write 승인안 초안

작성 시각: 2026-05-07 00:42 KST
기준일: 2026-05-07
상태: draft approval / monitoring result pending
Owner: gdn / paid_click_intent
Depends on: [[paid-click-intent-gtm-production-publish-result-20260506]], [[paid-click-intent-post-publish-monitoring-result-template-20260507]], [[../total/!total-current]], [[../ontology/!ontology]]
Do not use for: 현재 즉시 운영 DB/ledger write 승인, Google Ads conversion upload, GA4/Meta/Google Ads 전송, Google Ads 전환 액션 변경

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Red approval draft only
  allowed_actions:
    - 승인안 초안 작성
    - 저장 필드/보관기간/마스킹 설계
    - rollback/monitoring 기준 설계
  forbidden_actions:
    - 운영 DB/ledger write 실행
    - backend 운영 deploy
    - GTM publish
    - Google Ads conversion action 변경
    - conversion upload
    - GA4/Meta/Google Ads/TikTok/Naver 전송
  source_window_freshness_confidence:
    source: "Mode B publish result + no-write receiver smoke + ontology"
    window: "2026-05-06~2026-05-07 KST"
    freshness: "24h/72h live monitoring result pending"
    confidence: 0.82
```

## 10초 결론

이 문서는 **승인안 초안**이다. 지금 바로 저장을 열자는 문서가 아니다.

현재 `paid_click_intent v1`은 no-write receiver 단계다. 즉 브라우저와 receiver가 안전하게 동작하는지 확인할 수 있지만, 주문 원장과 Attribution VM에 실제 click id row를 남기지는 않는다.

24h/72h 모니터링이 안정적이면 다음 단계는 `minimal paid_click_intent ledger write`다. 목적은 Google click id를 랜딩 시점에 최소 범위로 저장해, 이후 홈페이지 결제완료와 NPay 실제 결제완료 주문 후보에 연결하는 것이다.

## TJ님이 나중에 승인할 내용

승인 대상은 아래 하나다.

> `gclid/gbraid/wbraid`와 최소 attribution 필드를 제한된 기간 동안 저장해, confirmed_purchase no-send dry-run에서 Google click id 누락을 줄일 수 있는지 검증한다.

승인하지 않는 것:

- Google Ads conversion upload.
- Google Ads 전환 액션 생성/변경.
- 기존 `구매완료` Primary 변경.
- GA4/Meta/Google Ads/TikTok/Naver purchase 전송.
- confirmed purchase dispatcher 운영 전송.
- 광고 예산/캠페인 변경.

## 왜 필요한가

현재 구조:

```text
Google Ads landing -> browser storage -> no-write receiver 200
```

하지만 no-write라서 아래 연결은 아직 닫히지 않는다.

```text
paid_click_intent -> checkout/NPay intent -> PaymentCompleteOrder -> ConfirmedPurchaseCandidate
```

따라서 no-write 단계만으로는 `missing_google_click_id`가 주문 원장에서 실제로 줄었다고 판단하기 어렵다.

## 저장 모드 옵션

| 모드 | 저장 내용 | 장점 | 한계 | 추천 |
|---|---|---|---|---|
| L0 no-write | 아무 row도 저장하지 않음 | 가장 안전 | 주문 연결 개선 불가 | 현재 상태 |
| L1 counter-only | path/status/origin/boolean 집계만 저장 | 개인정보 리스크 낮음 | Google Ads upload용 click id 복구 불가 | 모니터링 보조 |
| L2 minimal ledger | click id 원문 또는 암호화 저장 + session/order join key | confirmed purchase 후보 연결 가능 | 보관/접근 통제 필요 | 추천 후보 |

추천은 L2다. 단, raw request body logging은 계속 금지하고, 저장 필드는 allowlist로 제한한다.

## 저장 허용 필드

| 필드 | 저장 여부 | 이유 |
|---|---|---|
| `site` | YES | site routing |
| `captured_at` | YES | attribution window |
| `platform_hint` | YES | Google/Meta/TikTok 구분 |
| `click_id_type` | YES | `gclid`, `gbraid`, `wbraid` 중 무엇인지 |
| `gclid/gbraid/wbraid` | YES, 제한 저장 | Google Ads offline conversion 매칭에 원문 필요 |
| `click_id_hash` | YES | 중복/검색용 보조 |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | YES | campaign evidence |
| `landing_path` | YES | query 제거한 path |
| `allowed_query_snapshot` | YES, allowlist만 | `gclid/gbraid/wbraid`, UTM만 |
| `referrer_host` | YES | full referrer 대신 host 중심 |
| `client_id`, `ga_session_id`, `local_session_id` | YES | GA4/session join |
| `user_agent_hash` | optional | dedupe 보조 |
| `ip_hash` | optional | bot/dedupe 보조. raw IP 금지 |
| `created_at`, `expires_at` | YES | 보관기간 관리 |

## 저장 금지 필드

- raw request body.
- raw full URL query 전체.
- 이름.
- 이메일.
- 전화번호.
- 주소.
- 카드/계좌/결제 정보.
- order_number.
- payment_key.
- channel_order_no.
- paid_at.
- value.
- currency.
- raw cookie.
- access token.
- 건강 상태나 질병 추정값.

중요:

`paid_click_intent`는 구매 후보가 아니다. 결제금액과 주문번호를 받기 시작하면 `confirmed_purchase`와 섞인다.

## 보관기간 제안

| 데이터 | 보관기간 | 이유 |
|---|---:|---|
| raw Google click id | 90일 | Google Ads attribution/import window 검토용 |
| click_id_hash | 180일 | 중복/품질 비교 |
| aggregated counters | 1년 | 품질 추세 |
| TEST/DEBUG/PREVIEW click id row | 7일 이하 | smoke 검증용. live candidate 금지 |

보관기간은 TJ님 승인 전까지 확정하지 않는다.

## 중복 방지

dedupe key:

```text
paid_click_intent:{site}:{click_id_type}:{click_id_hash}:{local_session_id || ga_session_id}:{landing_path}
```

동일 session/click id/path는 반복 저장하지 않는다.

저장 상태:

```text
received
rejected
expired
matched_to_checkout
matched_to_payment_complete_candidate
```

## 승인 전 체크리스트

| 항목 | 상태 | 기준 |
|---|---|---|
| 24h monitoring | 대기 | receiver 2xx 안정, JS error 없음 |
| 72h monitoring | 대기 | 결제/NPay 흐름 이상 없음 |
| 외부 전송 0건 | 대기 | GA4/Meta/Google Ads/TikTok/Naver 전송 없음 |
| raw logging 금지 | 필요 | raw body/full URL query 장기 로그 없음 |
| 저장 필드 allowlist | 필요 | 위 허용 필드만 |
| PII reject | 필요 | email/phone/name/address reject |
| order/payment field reject | 필요 | order_number/payment_key/value/currency reject |
| rollback | 필요 | feature flag 또는 route write disable |
| **PM2 restart 빈도 5분 이상 완화** | **선행 blocker** | 30초 주기 → 5분 이상. ledger write 중 in-flight transaction interrupt 방지. evidence: [[paid-click-intent-pm2-restart-correlation-20260508]] |
| **backend heap baseline 안정화** | **선행 blocker** | startup 1분 후 heap 사용률 70% 미만. 현재 12s uptime에서 94.7%. evidence: 동일 |
| **errorHandler payload hardening deploy** | **선행 권고** | oversized payload 500 → 413/400 정상화. ledger write 진입 후 에러 분류 정확도 위해 선행 권고. 승인안: [[backend-errorhandler-payload-hardening-approval-20260508]] |
| **5xx 비율 1% 미만** | **선행 blocker** | 현재 bounded probe 4.5%. ledger write 진입 시 6.7% × write 부하 추가 위험 |

## 선행 blocker 상세 (2026-05-07 PM2 correlation evidence 기반)

본 승인안은 receiver 안전성을 가정하고 작성됐으나, 2026-05-07 21:33~21:46 KST 직접 조사 결과 운영 receiver는 다음 issue를 가지고 있다.

| issue | 측정값 | 영향 | source |
|---|---|---|---|
| PM2 30초 주기 restart | 최근 30분 50회 (실측) | 1~2초 unavailable window × 30초 주기 = 시간의 4.5~6.7% 502 위험 | [[paid-click-intent-pm2-restart-correlation-20260508]] |
| heap usage 94.7% at 12s uptime | 783MB / 827MB max | startup baseline 자체가 max_memory_restart 700M 임계값 초과 | 동일 |
| 일평균 5xx 추정 | 약 65분/일 | 사용자 receiver POST 손실 가능성 | [[paid-click-intent-bounded-probe-result-20260507]] |
| oversized payload 500 (413 아님) | 100KB 초과 시 generic 500 | error 분류 정확도 저하 | [[backend-errorhandler-payload-hardening-approval-20260508]] |

→ minimal ledger write 진입 전 위 4 blocker가 해소되어야 한다. 특히 PM2 restart 빈도 완화는 in-flight ledger write transaction이 SIGINT로 끊겨 데이터 정합성이 깨지는 것을 막기 위한 필수 조건이다.

## 승인 문구 초안

아래 문구는 24h/72h 모니터링 PASS 이후에만 사용한다.

```text
YES: paid_click_intent minimal ledger write를 승인합니다.

범위:
- site=biocom
- Google click id(gclid/gbraid/wbraid)와 UTM/session/path 최소 필드만 저장
- raw request body, PII, order/payment/value/currency 저장 금지
- 보관기간 90일 기준, TEST/DEBUG/PREVIEW는 7일 이하
- GA4/Meta/Google Ads/TikTok/Naver 전송 금지
- Google Ads conversion action 생성/변경 금지
- conversion upload 금지

성공 기준:
- confirmed_purchase no-send dry-run에서 missing_google_click_id가 감소하는지 확인
- 결제/NPay 흐름 이상 없음
- 외부 플랫폼 전송 0건 유지

문제 발생 시:
- write flag disable
- 신규 write 중단
- 필요 시 minimal ledger row 삭제/만료 처리
```

## 승인 후 첫 작업

승인되면 바로 실제 전송이 아니라 아래 순서로 간다.

1. backend write flag를 `paid_click_intent_write_enabled=false` 기본값으로 추가.
2. staging/local에서 write-enabled smoke.
3. 운영에 deploy하되 flag off.
4. flag on 전 최종 smoke.
5. 24h 제한 write.
6. confirmed_purchase no-send dry-run 재실행.
7. Google Ads confirmed_purchase 실행안은 별도 Red Lane으로 유지.

