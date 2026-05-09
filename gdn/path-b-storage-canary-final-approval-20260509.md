# Path B 1h hash-only storage canary final approval packet

작성 시각: 2026-05-09 02:24 KST
요청 유형: Yellow Lane approval packet
Project: biocom Path B bridge
대상: `order_bridge_ledger` 또는 동등 hash-only order bridge 저장 원장
Mode: approval packet only / execution HOLD

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
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
    - gdn/path-b-order-bridge-canary-plan-20260508.md
    - gdn/path-b-reliability-dry-run-result-20260509.md
  lane: Yellow approval packet writing
  allowed_actions:
    - approval packet writing
    - canary guardrail definition
    - rollback and monitoring design
  forbidden_actions:
    - canary execution without explicit approval
    - backend operational storage canary
    - operational schema migration without approval
    - GTM Production publish
    - Imweb production save
    - platform send
    - conversion upload
  source_window_freshness_confidence:
    source: "Path B no-send endpoint smoke + gpt0508-7/gpt0508-8 Preview evidence + reliability dry-run input"
    window: "2026-05-08 23:23 - 2026-05-09 02:24 KST"
    freshness: "2026-05-09 02:24 KST"
    confidence: 0.87
```

## 한 줄 결론

추천은 **YES 후보: 1시간 hash-only storage canary 승인 검토**다. 단, 이 문서는 승인 패킷이고 지금 실행은 하지 않는다.

## 무엇을 승인하는가

VM Cloud backend에서 주문완료 Path B payload를 **raw 값 없이 hash-only 원장에 1시간만 저장**하는 canary를 승인할지 판단한다.

이 canary는 구매 전송이 아니다.

- Google Ads/GA4/Meta/TikTok/Naver 전송: 0건.
- conversion upload: 0건.
- raw email/phone/member_code/order/payment 저장: 0건.
- 목적: hash bridge fill rate와 ambiguous rate 확인.

## 왜 필요한가

Preview는 주문, 로그인 identity, TEST click id 세 축이 no-send 안에서 연결될 수 있음을 확인했다.

하지만 운영 기준 100%를 말하려면 실제 주문완료 트래픽에서 아래를 봐야 한다.

- order hash가 얼마나 채워지는가.
- identity hash가 얼마나 채워지는가.
- click/session hash가 얼마나 채워지는가.
- 같은 주문이 중복 저장되지 않는가.
- ambiguous 후보가 얼마나 생기는가.
- raw가 저장/로그되지 않는가.

## 승인 전제

- `data/path-b-reliability-dry-run-input-20260509.json`: PASS.
- Path B no-send endpoint smoke: PASS.
- 실제 로그인 주문완료 identity evidence: PASS.
- TEST click id controlled evidence: PASS.
- same-browser controlled preservation: PASS.
- payment-decision raw query logging은 P1 hardening으로 분리. 이 canary의 blocker가 아니다.

## Feature flags

기본값은 전부 OFF다.

```text
ORDER_BRIDGE_WRITE_ENABLED=false
ORDER_BRIDGE_WRITE_CANARY_UNTIL=
ORDER_BRIDGE_WRITE_MAX_ROWS=200
ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false
ORDER_BRIDGE_RAW_BODY_LOGGING=false
ORDER_BRIDGE_WRITE_MODE=hash_only
```

canary 승인 시에만 제한적으로 바꾸는 값:

```text
ORDER_BRIDGE_WRITE_ENABLED=true
ORDER_BRIDGE_WRITE_CANARY_UNTIL=<KST 기준 승인 시각 + 1h>
ORDER_BRIDGE_WRITE_MAX_ROWS=200
```

절대 바꾸지 않는 값:

```text
ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false
ORDER_BRIDGE_RAW_BODY_LOGGING=false
```

## Write scope

- site: `biocom`
- duration: 1시간
- max rows: 200
- endpoint scope: order bridge hash-only write path
- publish scope: 없음. 이 승인만으로 GTM Production publish는 금지.
- platform send scope: 없음.

## 저장 허용 값

- `site`
- `capture_stage`
- `order_no_hash`
- `client_id`
- `ga_session_id`
- `local_session_id_hash`
- `click_id_hash`
- `member_code_hash`
- `email_hash`
- `phone_hash`
- `identity_hash_version`
- `identity_source`
- `pay_type`
- `pg_type`
- `dedupe_key`
- `received_at`
- `expires_at`

## 저장 금지 값

- raw email
- raw phone
- raw member_code
- raw order number
- raw payment key
- raw payment id
- buyer name
- address
- value
- currency
- raw request body

## TTL 90일

권장 구현:

- `expires_at = received_at + 90 days`
- canary query와 cleanup query는 `expires_at` 기준으로 작성한다.
- canary 종료 후 즉시 삭제하지 않는다. 삭제가 필요하면 별도 cleanup 승인으로 진행한다.

## Dedupe key

권장 구성:

```text
dedupe_key = sha256(site + capture_stage + order_no_hash + click_id_hash + identity_source + identity_hash_prefix)
```

원칙:

- 같은 주문/같은 click/같은 identity는 1건으로 억제한다.
- order hash만 있고 click/identity가 없으면 별도 low-confidence bucket으로 둔다.
- dedupe 실패로 row가 과다 적재되면 즉시 stop한다.

## 1h monitoring

10분마다 확인:

- row_count
- unique_order_no_hash
- unique_email_hash
- unique_phone_hash
- unique_click_id_hash
- order_no_hash_fill_rate
- identity_hash_fill_rate
- click_id_hash_fill_rate
- duplicate_dedupe_count
- ambiguous_candidate_count
- raw_stored_count
- platform_send_count
- endpoint 5xx count
- PM2 restart count

## Success criteria

PASS:

- row_count가 1 이상이고 200 이하.
- raw_stored_count = 0.
- platform_send_count = 0.
- endpoint 5xx rate < 1%.
- PM2 restart 0.
- order_no_hash_fill_rate가 의미 있게 관측됨.
- identity/click/session fill rate가 다음 dry-run 판단에 충분함.
- duplicate는 dedupe로 억제됨.

HOLD:

- raw/platform 문제는 없지만 fill rate가 너무 낮음.
- NPay가 thanks page로 충분히 복귀하지 않음.
- click_id_hash가 낮아 session fallback 중심으로만 보임.

FAIL:

- raw 값 저장/로그 발견.
- platform send 1건 이상.
- endpoint 5xx 반복.
- PM2 restart 발생.
- row cap 초과.
- 같은 주문 중복 적재 과다.

## Rollback command

실행 시에는 값 노출 없이 flag만 OFF한다.

```bash
cd /home/biocomkr_sns/seo/repo
python3 - <<'PY'
from pathlib import Path
p = Path('.env')
text = p.read_text()
for key, value in {
    'ORDER_BRIDGE_WRITE_ENABLED': 'false',
    'ORDER_BRIDGE_WRITE_CANARY_UNTIL': '',
    'ORDER_BRIDGE_WRITE_MAX_ROWS': '0',
    'ORDER_BRIDGE_PLATFORM_SEND_ENABLED': 'false',
    'ORDER_BRIDGE_RAW_BODY_LOGGING': 'false',
}.items():
    lines = []
    found = False
    for line in text.splitlines():
        if line.startswith(key + '='):
            lines.append(f'{key}={value}')
            found = True
        else:
            lines.append(line)
    if not found:
        lines.append(f'{key}={value}')
    text = '\\n'.join(lines) + '\\n'
p.write_text(text)
PY
pm2 restart seo-backend
```

## Post-canary report

canary 후 보고서는 아래를 분리한다.

1. 수집 건강도:
   - row fill, 5xx, PM2, duplicate, raw/platform send.

2. 구매 매칭 가능성:
   - order/identity/click hash 조합별 confidence A/B/C/D.

3. confirmed purchase uplift:
   - 아직 actual send가 아니라 no-send 후보 기준으로만 표시한다.

## 승인 문구

```text
YES: Path B 1h hash-only storage canary를 승인합니다.
범위: biocom, 1시간, max 200 rows, hash-only order bridge ledger, ORDER_BRIDGE_WRITE_ENABLED=true 임시 적용.
금지: GTM Production publish, Imweb production save, raw email/phone/member_code/order/payment 저장·로그, Google Ads/GA4/Meta/TikTok/Naver 전송, Google Ads conversion upload.
```

## 현재 판정

Canary approval readiness: PASS_WITH_GUARDS.

Execution status: HOLD until TJ explicit Yellow approval.

Auditor verdict: NEEDS_HUMAN_APPROVAL_FOR_CANARY_EXECUTION
