# Path B no-send HMAC 제한 deploy 승인안

작성 시각: 2026-05-08 23:23 KST
대상: biocom Path B 주문-클릭 연결용 no-send HMAC endpoint
Status: ready_for_yellow_decision__no_deploy_executed
관련 문서: [[path-b-no-send-hmac-local-implementation-20260508]], [[path-b-preview-tag-draft-20260508]], [[path-b-email-phone-preview-plan-20260508]], [[guest-order-attribution-ledger-design-v2-20260508]], [[../vm/!vm]]
Do not use for: backend 운영 deploy 실행, operational schema migration, GTM Production publish, Imweb production save, platform send, raw email/phone/member_code 저장

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - ../AGENTS.md
    - CLAUDE.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/npay-recovery/AUDITOR_CHECKLIST.md
    - vm/!vm.md
    - gdn/path-b-no-send-hmac-local-implementation-20260508.md
    - gdn/path-b-preview-tag-draft-20260508.md
  lane: Green approval packet writing; Yellow required for deploy or tunnel smoke execution
  allowed_actions:
    - approval document writing
    - local code diff summary
    - local test/typecheck
    - smoke command design
  forbidden_actions:
    - backend 운영 deploy
    - operational schema migration
    - GTM Production publish
    - Imweb production save
    - 1h hash-only canary 운영 저장
    - raw email/phone/member_code 저장 또는 logging
    - Google Ads/GA4/Meta/TikTok/Naver 전송
    - Google Ads conversion upload
    - 기존 GTM tag pause/delete
  source_window_freshness_confidence:
    source: "local backend source + fixture smoke + VM runbook + existing CORS middleware"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 23:23 KST"
    confidence: 0.9
```

## 10초 결론

이 승인은 “주문과 클릭을 잇는 재료가 실제 결제완료 화면에서 보이는지” 확인하기 위한 제한된 서버 수신점 승인안이다.

추천은 **Mode A: VM Cloud에 no-send endpoint만 제한 deploy**다. 이 endpoint는 raw email/phone/order를 저장하지 않고, 서버에서 즉시 HMAC-SHA256 해시 미리보기만 만든 뒤 `would_store=false`, `would_send=false`로 응답한다.

## 쉬운 설명

Path B bridge는 결제완료 화면에서 이메일/전화/주문번호/브라우저 세션/광고 클릭 흔적을 읽어 주문과 광고 클릭을 잇는 방식이다.

지금 단계에서 하는 일은 구매 전송이 아니다. 서버가 raw 값을 저장하지 않고 해시만 만들 수 있는지, 그리고 GTM Preview 화면에서 그 결과를 안전하게 볼 수 있는지 확인하는 일이다.

## 승인 선택지

### Mode A. 제한 deploy 추천

무엇을 하는가:

- `att.ainativeos.net` backend `seo-backend`에 `POST /api/attribution/order-bridge/identity-hmac/no-send`만 반영한다.
- `ORDER_BRIDGE_IDENTITY_HASH_SECRET`을 VM Cloud secret으로 주입한다.
- 응답은 no-send/no-write 상태로 고정한다.
- GTM Production publish는 하지 않는다.

왜 필요한가:

- GTM Preview는 HTTPS 페이지에서 HTTPS endpoint로 호출해야 한다.
- 실제 결제완료 화면에서 email/phone/order/session 후보가 보이는지 확인하려면 브라우저가 접근 가능한 no-send endpoint가 필요하다.

허용 범위:

- backend source/build artifact 배포.
- PM2 `seo-backend` 1회 restart.
- synthetic payload smoke.
- GTM Preview에서 no-send endpoint 호출.

금지 범위:

- DB schema migration.
- 운영 저장 canary.
- raw email/phone/member_code/order 저장.
- raw request body logging.
- Google Ads/GA4/Meta/TikTok/Naver 전송.
- GTM Production publish.

추천/자신감: 86%.

### Mode T. 임시 HTTPS tunnel smoke 대안

무엇을 하는가:

- 로컬 backend `localhost:7020` 또는 path-limited proxy를 `cloudflared`, `ngrok`, `lt` 중 하나로 임시 HTTPS 노출한다.
- GTM Preview tag의 endpoint만 임시 URL로 바꿔 receiver 200을 확인한다.
- 테스트 후 tunnel을 종료한다.

확인된 도구:

- `cloudflared version 2026.3.0`
- `ngrok version 3.23.1`
- `lt 2.0.2`

장점:

- 운영 backend deploy 없이 browser receiver 200을 볼 수 있다.
- 빠르다.

리스크:

- 임시 tunnel URL이 외부 접근 가능하다.
- path-limited proxy와 짧은 테스트 시간, synthetic payload, no-send endpoint로 완화해야 한다.

추천/자신감: 79%.

### Mode B. 운영 저장 canary

지금은 HOLD다. Preview와 no-send smoke가 PASS한 뒤, `order_bridge_ledger` schema/TTL/rollback 승인이 별도로 필요하다.

## 최종 code diff packet

현재 로컬 code diff 기준이다. 운영 deploy는 아직 하지 않았다.

1. `backend/src/orderBridgeIdentityHmac.ts`
   - 신규 183줄.
   - email normalize: trim + lowercase.
   - phone normalize: digits only.
   - HMAC-SHA256: `ORDER_BRIDGE_IDENTITY_HASH_SECRET`.
   - response/log record에는 raw 값 없이 present boolean과 8자 hash prefix만 포함.

2. `backend/src/routes/attribution.ts`
   - `POST /api/attribution/order-bridge/identity-hmac/no-send` 추가.
   - route diff 기준 91줄 추가.
   - `ORDER_BRIDGE_IDENTITY_HMAC_BODY_LIMIT_BYTES = 16 * 1024` route-level guard 추가.
   - secret 누락 시 503 `hash_secret_missing`.
   - body 16KB 초과 시 413 `payload_too_large`.
   - success response도 `would_store=false`, `would_send=false`, `no_platform_send_verified=true`.

3. `backend/tests/order-bridge-identity-hmac.test.ts`
   - 신규/보강 165줄.
   - normalize fixture.
   - hash-only smoke.
   - safe log raw echo 0.
   - endpoint response raw echo 0.
   - oversized payload 413.
   - no platform send 0.

## secret 주입 방식

원칙:

- secret 값은 git, 문서, 터미널 출력, PM2 log에 남기지 않는다.
- secret은 최소 32바이트 이상 랜덤이어야 한다.
- 회전이 필요하면 새 secret으로 바꾸되, 기존 hash와 신규 hash의 버전을 구분해야 한다.

권장 방식:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94

sudo -n -u biocomkr_sns bash -lc '
  set -euo pipefail
  cd /home/biocomkr_sns/seo/repo/backend
  umask 077
  if ! grep -q "^ORDER_BRIDGE_IDENTITY_HASH_SECRET=" .env 2>/dev/null; then
    printf "ORDER_BRIDGE_IDENTITY_HASH_SECRET=%s\n" "$(openssl rand -hex 32)" >> .env
  fi
'
```

주의:

- `cat .env`, `grep ORDER_BRIDGE_IDENTITY_HASH_SECRET .env`처럼 값을 출력하지 않는다.
- 확인은 값이 아니라 key 존재 여부만 본다.

```bash
sudo -n -u biocomkr_sns bash -lc '
  cd /home/biocomkr_sns/seo/repo/backend
  grep -q "^ORDER_BRIDGE_IDENTITY_HASH_SECRET=" .env && echo "secret_key_present"
'
```

## CORS / origin guard

현재 backend 공통 middleware `backend/src/bootstrap/configureMiddleware.ts`는 아래 biocom origin을 allowlist에 포함한다.

- `https://biocom.kr`
- `https://www.biocom.kr`
- `https://m.biocom.kr`
- `https://biocom.imweb.me`

승인 후 smoke 기준:

- allowed origin의 OPTIONS preflight는 통과해야 한다.
- disallowed origin은 `origin_not_allowed` 또는 CORS blocked로 차단되어야 한다.
- GTM Preview tag는 `credentials: "omit"`로 호출한다.

## body size guard

Path B no-send endpoint는 route-level 16KB 제한을 둔다.

성공 기준:

- 정상 synthetic payload: 200.
- 17KB 이상 payload: 413 `payload_too_large`.
- 100KB 초과 payload: global parser 단계에서도 413이어야 한다.

## raw logging guard

서버 원칙:

- request body를 로그에 남기지 않는다.
- route handler는 raw email/phone/order를 `console.log` 하지 않는다.
- pino-http 기본 request log는 body를 포함하지 않는다.
- response에는 raw 값 없이 present boolean과 hash prefix만 포함한다.

검증 기준:

- response JSON에 synthetic raw email/phone/order/session/click 값이 없다.
- PM2 log tail에 synthetic raw 값이 없다.
- `raw_payload_stored=false`, `raw_logging_enabled=false`가 response preview에 있다.

## post-deploy smoke 명령

아래 명령은 승인 후 실행한다. synthetic 값만 사용한다.

```bash
curl -fsS https://att.ainativeos.net/health
```

```bash
curl -i -X OPTIONS \
  'https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send' \
  -H 'Origin: https://biocom.kr' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type'
```

```bash
curl -sS -X POST \
  'https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send' \
  -H 'Origin: https://biocom.kr' \
  -H 'Content-Type: application/json' \
  --data '{"site":"biocom","capture_stage":"order_confirm_preview","email":"Buyer.PathB+Smoke@Example.Invalid","phone":"+82 10 1234 5678","order_no":"ORDER-PATHB-RAW-20260508","client_id":"349382661.1770783461","ga_session_id":"1778235134","local_session_id":"local-session-raw-pathb","click_id":"TEST_GCLID_PATHB_PREVIEW_20260508","preview_mode":true}' \
  | tee /tmp/pathb_identity_hmac_smoke.json
```

```bash
rg -n 'Buyer.PathB|buyer.pathb|\\+82 10|ORDER-PATHB|local-session-raw-pathb|TEST_GCLID_PATHB' /tmp/pathb_identity_hmac_smoke.json
# expected: no matches
```

```bash
python3 - <<'PY' | curl -sS -X POST \
  'https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send' \
  -H 'Origin: https://biocom.kr' \
  -H 'Content-Type: application/json' \
  --data-binary @- | tee /tmp/pathb_identity_hmac_oversize.json
import json
print(json.dumps({
  "site": "biocom",
  "email": "Buyer.PathB+Smoke@Example.Invalid",
  "phone": "+82 10 1234 5678",
  "extra_note": "x" * (17 * 1024)
}))
PY
```

oversize expected:

- HTTP 413.
- `error=payload_too_large`.
- raw echo 0.

PM2/log check:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc '\''export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; pm2 logs seo-backend --lines 120 --nostream --no-color'\''' \
  | rg -n 'Buyer.PathB|buyer.pathb|ORDER-PATHB|local-session-raw-pathb|TEST_GCLID_PATHB' || true
```

expected:

- raw value match 0건.

## Success Criteria

- `/health` 200.
- no-send HMAC endpoint 200.
- response `would_store=false`.
- response `would_send=false`.
- response `no_platform_send_verified=true`.
- response raw echo 0.
- oversized 413.
- PM2 raw logging 0.
- GTM Preview에서 endpoint POST 200.
- Google Ads/GA4/Meta/TikTok/Naver 신규 전송 0.

## Hard Fail

- response/log/storage에 raw email/phone/member_code/order가 보인다.
- `would_store=true`가 나온다.
- `would_send=true`가 나온다.
- Google Ads/GA4/Meta/TikTok/Naver request가 새로 발생한다.
- PM2 restart가 반복되거나 `/health`가 불안정하다.
- GTM Submit/Publish가 필요해진다.

## Rollback

1. 배포 전 백업한 파일을 원복한다.
2. `ORDER_BRIDGE_IDENTITY_HASH_SECRET` 값은 노출하지 말고 유지 또는 제거 여부를 별도 판단한다.
3. PM2를 재시작한다.
4. `/health` 200과 기존 `paid-click-intent/no-send` smoke를 확인한다.
5. GTM Preview workspace는 discard한다.

## 승인 문구

권장 승인 문구:

```text
YES: Path B no-send HMAC endpoint 제한 deploy + smoke를 승인합니다.
범위: att.ainativeos.net backend에 /api/attribution/order-bridge/identity-hmac/no-send만 반영, ORDER_BRIDGE_IDENTITY_HASH_SECRET 주입, PM2 restart 1회, synthetic post-deploy smoke, GTM Preview only 확인.
금지: DB schema migration, 운영 저장 canary, GTM Production publish, Imweb production save, raw email/phone/member_code/order 저장·logging, Google Ads/GA4/Meta/TikTok/Naver 전송, conversion upload.
```

보류 문구:

```text
HOLD: 제한 deploy는 보류하고 Mode T 임시 HTTPS tunnel smoke만 먼저 검토합니다.
```

## Auditor verdict

Auditor verdict: NEEDS_HUMAN_APPROVAL
Lane: Yellow for deploy or tunnel execution
Mode: no-send / no-write / no-platform-send
No-send verified: YES, local fixture 기준
No-write verified: YES, local fixture 기준
No-deploy verified: YES, 문서 작성 시점
No-publish verified: YES
No-platform-send verified: YES
Recommendation: Mode A 제한 deploy 승인 후보
Confidence: 90%
