```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - data/!data_inventory.md
  required_context_docs:
    - gptconfirm/gpt0520-5-emq-no-send-audit/00-result-report.md
    - gptconfirm/gpt0521-1-emq-payload-preview/00-result-report.md
  lane: Green
  allowed_actions:
    - local_backend_patch
    - typecheck
    - no_send_payload_design
    - documentation_update
  forbidden_actions:
    - Meta CAPI actual send
    - VM Cloud deploy/restart
    - 운영DB write/import
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: local code + VM Cloud no-send preview copy
    window: 24h / 7d preview baseline
    freshness: 2026-05-21 KST local patch
    confidence: high for code safety, medium_high for future EMQ lift estimate
```

# Meta CAPI 이벤트 매칭 품질 로컬 패치 결과

## 이번에 가능해진 것

Meta CAPI Purchase가 고객을 더 잘 맞출 수 있도록, 전송 직전에 Imweb 주문 캐시에서 고객 매칭 후보를 보강할 수 있게 했다.

기본값은 모두 OFF다. 따라서 이 패치만으로는 Meta에 추가 고객 정보가 전송되지 않는다.

## 왜 필요한가

Events Manager에서 Purchase 이벤트 매칭 품질은 6.1/10 수준이고, 권장 조치가 이메일/전화번호/Facebook 로그인 ID/외부 ID 추가다.

현재 Purchase CAPI는 `fbp`, `fbc`, IP, user agent 중심으로 살아 있지만, `ph`와 `external_id`가 0에 가까워 매칭 품질 개선 여지가 크다.

## 로컬 변경

- `backend/src/env.ts`
  - `META_CAPI_ENABLE_IMWEB_PHONE_HASH`
  - `META_CAPI_ENABLE_MEMBER_EXTERNAL_ID`
  - `META_CAPI_EXTERNAL_ID_SECRET`
- `backend/src/metaCapi.ts`
  - Meta `user_data.external_id` 지원 추가.
  - Imweb `imweb_orders` 캐시에서 주문 key exact match 후 전화번호 후보를 가져오는 로직 추가.
  - 회원 코드는 원문을 쓰지 않고 `site + member_code`를 HMAC-SHA256으로 해시하는 구조 추가.
  - send log에는 원문이나 해시값을 남기지 않고, `user_data_presence` boolean만 남긴다.

## 안전 기본값

- `META_CAPI_ENABLE_IMWEB_PHONE_HASH` 기본 OFF.
- `META_CAPI_ENABLE_MEMBER_EXTERNAL_ID` 기본 OFF.
- OFF 상태에서는 Imweb 캐시 lookup이 실행되지 않는다.
- `external_id`는 64자 hex 해시 형태가 아니면 payload에 들어가지 않는다.
- raw phone/member/order/payment/click id를 로그/문서/payload debug에 출력하지 않는다.

## 검증

- `npm run typecheck` PASS.
- `git diff --check -- backend/src/metaCapi.ts backend/src/env.ts` PASS.

## 하지 않은 것

- Meta 운영 Purchase 추가 send 안 함.
- VM Cloud 배포/restart 안 함.
- env flag ON 안 함.
- 운영DB write/import 안 함.
- GTM publish 안 함.

## 배포 의견

1. VM Cloud에는 먼저 flag OFF로 배포해도 된다.
2. 실제 고객 매칭 필드 전송은 별도 Red 승인 후, biocom 24h 제한 ON부터 권장한다.
3. full ON은 24~72시간 EMQ/Ads Manager 관찰 후 진행하는 것이 안전하다.
