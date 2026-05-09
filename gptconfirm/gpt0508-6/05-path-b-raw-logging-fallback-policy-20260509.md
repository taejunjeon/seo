# Path B raw logging fallback policy

작성 시각: 2026-05-09 01:25 KST
대상: Path B Preview / HMAC bridge troubleshooting
상태: policy_ready
Lane: Green policy / Yellow exception if raw logging requested
Mode: raw logging 기본 금지

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
  lane: Green policy
  allowed_actions:
    - policy writing
    - troubleshooting order definition
    - raw logging exception boundary definition
  forbidden_actions:
    - operating raw logging without explicit approval
    - PM2/nginx raw request body logging
    - raw email/phone/member_code/order storage
    - platform send
  source_window_freshness_confidence:
    source: "Path B HMAC endpoint smoke + TJ fallback preference"
    window: "2026-05-09 01:17-01:25 KST"
    freshness: "2026-05-09 01:25 KST"
    confidence: 0.9
```

## 10초 결론

기본 목표는 raw logging 0이다.
Preview가 막혀도 운영 PM2/nginx에 raw email을 남기는 방식은 마지막 수단이다.
정말 필요하면 local/tunnel 또는 10분 이하 운영 예외로 분리하고, 삭제/검증/report까지 묶어야 한다.

## 기본 원칙

1. raw email/phone/member_code/order는 운영 저장하지 않는다.
2. raw request body를 파일, PM2 log, nginx log, DB에 남기지 않는다.
3. response에는 hash present boolean과 hash prefix만 허용한다.
4. browser DevTools에서 request payload를 사람이 일회성으로 보는 것은 저장이 아니지만, 캡처/문서에는 raw를 남기지 않는다.

## troubleshooting 우선순위

### 1순위 - response boolean/hash prefix

가장 안전하다.

확인할 값:

- `email_hash_present`
- `phone_hash_present`
- `order_no_hash_present`
- `client_session_present`
- `click_id_hash_present`
- `identity_source`
- `no_raw_echo_verified`
- `no_platform_send_verified`

### 2순위 - browser DevTools 수동 확인

Network request payload를 사람이 화면에서만 확인한다.
복사, 저장, 캡처, 문서화는 하지 않는다.
문서에는 raw 값이 아니라 아래처럼만 쓴다.

```text
HURDLERS user_id source present: YES
raw value copied/stored: NO
```

### 3순위 - local/tunnel 1회 raw logging

운영 PM2가 아니라 local backend 또는 임시 tunnel에서만 1회 허용 후보로 둔다.

조건:

- synthetic value 또는 테스트 계정만 사용.
- raw log file은 테스트 직후 삭제.
- 삭제 후 grep 0 확인.
- report에 raw 값은 쓰지 않는다.

### 4순위 - 운영 raw logging 예외

기본 금지다.
TJ님이 별도 명시 승인할 때만 가능하다.

최소 조건:

- duration 10분 이하.
- test order/session 1건 이하.
- raw logging 대상 endpoint 1개로 제한.
- PM2/nginx log path 명시.
- test 직후 log file 삭제 또는 truncate.
- 삭제 후 raw pattern count 0 검증.
- 결과보고에 시작/종료 시각, 로그 삭제/검증 결과 기록.
- platform send 0 유지.

## 운영 raw logging이 필요한 경우의 승인 문구 예시

```text
YES: Path B HURDLERS user_id Preview 장애 분리를 위해 운영 no-send endpoint raw request logging을 10분 이하, 테스트 1건, endpoint 1개로만 임시 허용합니다.
금지: 저장 canary, platform send, GTM publish, 기존 태그 pause/delete.
필수: 테스트 직후 PM2/nginx raw log 삭제 또는 truncate, raw pattern count 0 검증, 결과보고.
```

## Hard Fail

- raw email이 운영 로그에 남았는데 삭제/검증이 없다.
- raw request body가 DB 또는 파일에 저장됐다.
- raw 값을 문서나 gptconfirm에 복사했다.
- 운영 raw logging이 10분을 넘었다.
- platform send가 발생했다.

## 현재 판단

2026-05-09 01:22 KST 기준 운영 raw logging은 필요 없다.
controlled Preview에서 `email_hash_present=true`, response raw echo 0, PM2 raw pattern match 0을 확인했기 때문이다.

Auditor verdict: POLICY_READY_RAW_LOGGING_FALLBACK
