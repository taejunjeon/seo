# paid_click_intent production receiver 배포 승인안

작성 시각: 2026-05-06 17:10 KST
대상: `att.ainativeos.net` backend
문서 성격: Red Lane backend 운영 deploy + 조건부 GTM publish 승인 문서.
Status: Mode B conditionally approved by TJ. 실행은 SSH publickey blocker로 보류.
Supersedes: 없음
Depends on:
- [[paid-click-intent-production-receiver-post-smoke-20260506]]
- [[paid-click-intent-gtm-production-publish-approval-20260506]]
Do not use for: Google Ads conversion action 생성/변경, conversion upload, GA4/Meta/Google Ads 전송, 운영 DB/ledger write
GTM Production publish는 아래 `승인 모드 B`가 명시 승인된 경우에만 포함한다.

## 10초 결론

`paid_click_intent v1`을 receiver까지 포함해 운영 게시하려면 `att.ainativeos.net`에 아래 route가 먼저 있어야 한다.

```text
POST /api/attribution/paid-click-intent/no-send
```

현재 local backend에는 route가 있고 no-write/no-send로 동작한다.
하지만 production `att.ainativeos.net` TEST POST smoke 결과는 `404 Route not found`다.

따라서 receiver-enabled GTM publish를 하려면 backend 운영 deploy 승인이 필요하다.

2026-05-06 현재 TJ님은 모드 B를 조건부 YES로 승인했다.
다만 Codex 실행 환경에서 `biocomkr_sns@34.64.104.94` SSH 접속이 `Permission denied (publickey)`로 막혀 있어 실제 route deploy와 GTM publish는 아직 실행하지 못했다.

## 승인 모드

이 문서는 두 가지 승인 모드를 구분한다.

### 모드 A. receiver route deploy only

아래만 승인한다.

- `att.ainativeos.net` backend에 `POST /api/attribution/paid-click-intent/no-send` route 배포.
- 배포 후 TEST POST smoke와 negative smoke.

포함하지 않는다.

- GTM Production publish.
- 24h/72h live 모니터링.

### 모드 B. chained approval

아래를 한 번에 승인한다.

- receiver route 배포.
- TEST POST smoke와 negative smoke.
- smoke 통과 시 receiver-enabled GTM Production publish.
- publish 후 24h/72h 모니터링.

Codex 추천은 모드 B다.
이유는 production route POST 404만 해결한 뒤 다시 멈추면, Google click id가 실제 브라우저/checkout/NPay intent에서 살아남는지 확인이 늦어지기 때문이다.
단, 모드 B도 Google Ads/GA4/Meta/TikTok/Naver 전송과 운영 DB/ledger write는 허용하지 않는다.

## TJ님 승인 문구

모드 B로 승인한다면 아래 문구로 승인한다.

```text
YES: att.ainativeos.net backend에 paid_click_intent no-write receiver route 배포를 승인합니다.

범위:
- POST /api/attribution/paid-click-intent/no-send route만 운영 반영
- 목적은 Google click id 보존 payload validation과 no-send preview 응답
- response는 would_send=false, no_platform_send_verified=true, no_write_verified=true 유지

금지:
- DB/ledger write
- GA4/Meta/Google Ads/TikTok/Naver 전송
- Google Ads conversion action 생성/변경
- conversion upload
- confirmed purchase dispatcher 운영 전송
- unrelated backend 변경

조건:
- 배포 전 local typecheck/smoke 통과
- route diff whitelist는 paid_click_intent no-send route와 필요한 최소 middleware만 허용
- DB migration, env/secret 변경, background sender/job 활성화 없음
- request body size limit을 명시적으로 작게 적용
- raw payload logging 금지 또는 click id/landing_url/client/session 값 마스킹
- 배포 후 TEST_GCLID 1건 POST smoke에서 200 ok=true 확인
- negative smoke에서 click id 없음, value/currency, order/payment field, PII, oversized body가 안전하게 차단되는지 확인
- test_click_id=true, live_candidate_after_approval=false 확인
- PII/value/order field reject 확인
- 문제 발생 시 route rollback 또는 이전 backend version rollback

연속 진행 조건:
- 위 TEST POST smoke가 통과하면 receiver-enabled GTM publish와 24h/72h 모니터링까지 추가 확인 없이 진행 가능
- 단, 이 연속 진행은 TJ님이 이 문구 전체를 승인했을 때만 적용한다
```

## 배포 범위

포함:

- `POST /api/attribution/paid-click-intent/no-send`
- PII/secret/order/value field reject.
- TEST/DEBUG/PREVIEW click id live candidate 차단.
- `guard` 객체와 snake_case/camelCase 호환 응답.
- `https://biocom.kr`, `https://www.biocom.kr`, `https://m.biocom.kr` 중심의 Origin 허용.
- request body size limit. 권장값은 `16kb` 이하.
- admin/login/internal/404 page payload는 reject 또는 ignore.

제외:

- `confirmed_purchase` dispatcher.
- Google Ads upload.
- GA4/Meta 전송.
- production DB insert/update.
- Attribution VM write.
- smoke 통과 전 GTM publish.
- DB migration.
- env/secret 변경.
- background job/send dispatcher 활성화.

## no-write 정의

이 승인안에서 `no-write receiver`는 아래만 의미한다.

```text
브라우저 payload를 받아 validation preview 응답을 반환한다.
DB, Attribution VM ledger, SQLite, Postgres, Google Ads, GA4, Meta, TikTok, Naver에는 insert/update/send하지 않는다.
```

따라서 이 단계는 주문 원장 fill-rate를 직접 개선하지 않는다.
목적은 live traffic에서 `paid_click_intent` payload가 안전하게 들어오는지 확인하는 것이다.

24h/72h 모니터링의 receiver count와 2xx rate는 아래 중 하나로만 본다.

- access log의 status/path/origin 수준 집계.
- body를 저장하지 않는 observability counter.
- TEST POST smoke 결과.

금지:

- raw request body logging.
- raw `gclid/gbraid/wbraid` 장기 보관.
- raw `landing_url` 전체 query 로깅.
- `client_id`, `ga_session_id`, `local_session_id` raw 로그 장기 보관.

로그가 필요하면 아래처럼 마스킹/집계한다.

```text
click_id_present=true/false
click_id_type=gclid|gbraid|wbraid
landing_path=/...
query_allowlisted=true/false
status=2xx|4xx|5xx
block_reason_count
```

실제 `paid_click_intent` ledger row를 저장하는 단계는 이 승인에 포함되지 않는다.
그 단계는 `minimal paid_click_intent ledger write 승인안`으로 따로 만든다.

## 성공 기준

배포 직후:

- `OPTIONS` preflight 204.
- `POST` TEST payload 200.
- 응답에 아래가 포함된다.

```json
{
  "ok": true,
  "dry_run": true,
  "would_store": false,
  "would_send": false,
  "no_write_verified": true,
  "no_platform_send_verified": true,
  "preview": {
    "has_google_click_id": true,
    "test_click_id": true,
    "live_candidate_after_approval": false
  }
}
```

negative smoke:

| 케이스 | 기대 결과 |
|---|---|
| click id 없음 | `has_google_click_id=false`, `send_candidate=false`, 외부 전송 0 |
| `value` 또는 `currency` 포함 | 400 reject 또는 `invalid_value_field` 계열 차단 |
| `order_number`, `payment_key`, `paid_at` 포함 | 400 reject 또는 order/payment field 차단 |
| email/phone/name/address 등 PII 포함 | 400 reject 또는 `pii_detected` 차단 |
| `TEST_`, `DEBUG_`, `PREVIEW_` click id | 200 preview 가능, `live_candidate_after_approval=false` |
| oversized body | 413 또는 안전한 reject |

실패 기준:

- POST 404.
- POST 5xx.
- PII/value/order field를 받아버림.
- `would_send=true`.
- `would_store=true`.
- test click id가 live candidate로 통과.
- raw payload가 access/application log에 남음.
- request body size 제한 없이 운영 route가 열림.
- DB/ledger row가 생성됨.

## 왜 필요한가

GTM Preview와 임시 HTTPS tunnel에서는 receiver까지 통과했다.
하지만 production receiver는 현재 POST 404다.

이 상태로 GTM tag가 receiver 호출을 포함해 운영 게시되면 브라우저에서 receiver 요청이 실패한다.
그러면 24h/72h 모니터링의 핵심인 receiver 2xx rate, payload fill-rate, block_reason 분포를 볼 수 없다.

단, no-write receiver의 모니터링은 `payload가 안전하게 들어오는지`를 보는 것이다.
주문 원장/Attribution VM의 실제 click id fill-rate 개선은 minimal ledger write가 승인된 뒤에 판단한다.

## 배포 후 다음 단계

모드 A 승인인 경우:

1. production receiver TEST POST smoke 재실행.
2. negative smoke 실행.
3. 결과 문서 작성.
4. GTM publish는 별도 승인 전까지 보류.

모드 B 승인인 경우:

1. production receiver TEST POST smoke 재실행.
2. negative smoke 실행.
3. smoke 통과 시 `paid_click_intent v1` receiver-enabled GTM publish.
4. 24h/72h 모니터링.
5. confirmed_purchase no-send dry-run 재실행.
6. 결과가 좋으면 minimal `paid_click_intent` ledger write 승인안 작성.

## 대안

backend deploy를 지금 승인하지 않는다면 storage-only GTM publish를 검토할 수 있다.
다만 storage-only는 서버 receiver 2xx와 payload fill-rate를 볼 수 없고, 이후 Attribution VM/order ledger 연결 검증으로 넘어가기 어렵기 때문에 추천도는 낮다.

Codex 추천:

- receiver route 배포 승인 후 receiver-enabled GTM publish.
- 추천도 82%.

## 금지 유지

아래는 이 승인으로도 허용되지 않는다.

- smoke 실패 또는 receiver 미배포 상태의 GTM Production publish.
- Google Ads conversion action 생성/변경.
- conversion upload.
- GA4/Meta/Google Ads/TikTok/Naver 전송.
- 운영 DB/ledger write.
- 광고 예산/캠페인 상태 변경.

## 현재 blocker

```text
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes biocomkr_sns@34.64.104.94
-> Permission denied (publickey)
```

이 blocker는 승인 부족이 아니라 접근 권한 문제다.
SSH 접근이 복구되면 모드 B 승인 범위 안에서 아래 순서까지 추가 확인 없이 진행한다.

1. backend route deploy.
2. TEST/negative POST smoke.
3. smoke 통과 시 receiver-enabled GTM Production publish.
4. 24h/72h monitoring.
