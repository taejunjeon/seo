# Email-like value bridge 위험 검토

작성 시각: 2026-05-08 20:17 KST
대상: biocom Path C fallback / email-like attribution bridge
Status: raw_email_bridge_no__hashed_fallback_yellow_only
Do not use for: raw email 저장, raw email logging, GTM Production publish, backend deploy, platform send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
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
    - gdn/path-c-wrapper-preview-result-20260508.md
    - gdn/path-c-member-code-source-discovery-20260508.md
  lane: Green read-only/design review
  allowed_actions:
    - GTM API read-only variable/tag inventory
    - local docs/code read-only inspection
    - local markdown/json artifact creation
  forbidden_actions:
    - GTM Production publish
    - GTM tag pause/delete
    - raw email storage
    - raw member_code storage
    - raw order/payment/value storage
    - GA4/Meta/Google Ads/TikTok/Naver send
    - Google Ads conversion upload
  source_window_freshness_confidence:
    source: "GTM Default Workspace read-only inventory + TJ Tag Assistant 200/201/203 evidence + Path C source discovery + local backend code/docs"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 20:17 KST"
    confidence: 0.88
```

## 10초 결론

이메일처럼 보이는 값은 주문 원장과 연결하기 쉬워 보이지만, 운영 attribution bridge로 바로 쓰면 안 된다.

현재 GTM에는 이메일/전화/user_id 계열 변수가 있고, TJ님 수동 확인에서도 이메일형 `user_id` 값이 보였다. 하지만 이 값은 회원코드가 아니라 개인정보 또는 개인정보에 준하는 식별자다. 따라서 **raw email bridge는 NO**, **HMAC email_hash bridge는 별도 개인정보/Yellow 승인 후보**로만 남긴다.

## 이번 문서가 말하는 것

- 현재 GTM 변수/태그 중 email-like 값을 읽는 후보가 무엇인지.
- raw email을 쓰면 왜 위험한지.
- raw 저장 없이 HMAC email_hash로만 쓴다면 어떤 조건이 필요한지.
- 지금 Path C 기본 방향을 email로 바꾸지 않는 이유.

## 이번 문서가 말하지 않는 것

- email_hash bridge를 실제 승인했다는 뜻이 아니다.
- GTM 태그를 publish하거나 pause/delete했다는 뜻이 아니다.
- 이메일을 Google Ads, GA4, Meta, TikTok, Naver로 보냈다는 뜻이 아니다.

## Read-only inventory 요약

근거 파일: `data/path-bridge-fallback-inventory-20260508.json`

| 항목 | 값 |
|---|---:|
| GTM 변수 총수 | 60 |
| GTM 태그 총수 | 59 |
| 관련 후보 항목 | 71 |
| raw PII 금지 분류 | 15 |
| email-like 변수/태그 | 5 |
| phone-like 변수/태그 | 2 |
| user_id email-like 태그 | 8 |
| Path C member_code 후보지만 현재 empty | 9 |

주요 후보:

| 이름 | 종류 | 읽는 위치/의미 | 판정 |
|---|---|---|---|
| `HURDLERS - [맞춤 JS] user_id` | GTM 변수 | `.email-info` | Path C 사용 금지. raw email-like |
| `email_buy` | GTM 변수 | 주문자 이메일 입력 후보 | raw 사용 금지. 값이 있어도 별도 승인 전 사용 금지 |
| `email_reg` | GTM 변수 | 회원가입 이메일 입력 후보 | raw 사용 금지 |
| `UPDE_buy_em_pn` | GTM 변수 | email/phone 기반 user-provided data 후보 | 기존 태그 영향 관찰만. Path C bridge 금지 |
| `UPDE_reg_em_pn` | GTM 변수 | email/phone 기반 user-provided data 후보 | 기존 태그 영향 관찰만. Path C bridge 금지 |
| `User_id` | GTM 태그 | user_id 이벤트 전송 | raw email-like 의심. bridge로 재사용 금지 |

## 판단

### 1. raw email bridge는 NO

raw email은 주문 원장과 쉽게 붙을 수 있지만, 그 쉬움이 곧 리스크다.

- 개인을 직접 식별할 수 있다.
- 브라우저 변수, network payload, 서버 access log, 에러 로그에 남으면 회수가 어렵다.
- attribution 원장이 회원/고객 식별 원장처럼 변한다.
- 목적 제한, 동의, 보관기간, 접근권한 설명이 필요해진다.

따라서 지금 단계에서 raw email을 click intent ledger, order bridge ledger, debug log, markdown/JSON report에 저장하지 않는다.

### 2. email_hash/HMAC bridge는 가능성만 있다

email_hash를 쓰려면 단순 SHA-256이 아니라 **서버 비밀키 기반 HMAC-SHA256**이 기본 후보여야 한다.

```text
email_hmac = HMAC-SHA256(normalized_email, server_secret)
```

단, 이것도 바로 Green이 아니다.

- browser에 HMAC secret을 둘 수 없다.
- 서버 HMAC을 하려면 raw email이 일시적으로 서버에 도달하므로 request body logging 금지 증명이 필요하다.
- hash도 내부 주문/회원 데이터와 결합하면 개인 식별 가능성이 있으므로 pseudonymous identifier로 다뤄야 한다.
- 동의/목적/보관/삭제/권한 기준이 별도 승인 패킷에 있어야 한다.

### 3. Path C 기본 방향은 유지하되 현재 HOLD

Path C는 회원 주문의 `member_code_hash`를 쓰는 회원 bridge다. 현재 브라우저/GTM에서 usable member_code source가 보이지 않으므로 Production publish는 HOLD다.

email-like value는 Path C의 대체 기본값이 아니다. 필요하면 `Path C-email fallback`이 아니라 `email_hmac bridge`라는 별도 Yellow 후보로 분리한다.

## 승인 후보로 올릴 때 필요한 조건

email_hmac bridge를 나중에 검토한다면 승인안에는 아래가 필요하다.

1. 목적: confirmed purchase attribution 후보 생성으로 제한.
2. 저장: `email_hmac`만 저장. raw email 저장 금지.
3. 전송: GA4/Meta/Google Ads/Naver/TikTok 전송 없음.
4. 로그: request body, error log, debug log에 raw email 0건.
5. 비밀키: repo/.env.example/문서에 실제 secret 저장 금지.
6. 보관: TTL 90일.
7. 삭제: TTL cleanup job 또는 `expires_at` 기반 삭제 계획.
8. smoke: raw email 포함 payload reject 테스트.
9. rollback: tag pause 또는 endpoint flag off.

## 결론

현재 결론은 보수적으로 고정한다.

```text
raw email bridge: NO
email_hash/HMAC bridge: possible, Yellow/privacy approval only
Path C member_code_hash: 유지, browser source 없어서 HOLD
Path B order-level bridge: 우선 설계
GTM cleanup: read-only inventory만, pause/delete 없음
```

## 다음 할일

1. email_hash는 바로 진행하지 않는다. 먼저 Path B order-confirm bridge를 설계한다.
2. email_hash가 꼭 필요해지는 경우에만 별도 Yellow 승인 문서를 만든다.
3. 그 승인 전까지 `HURDLERS user_id`, `email_buy`, `email_reg`, `UPDE_*`는 attribution bridge source로 쓰지 않는다.
