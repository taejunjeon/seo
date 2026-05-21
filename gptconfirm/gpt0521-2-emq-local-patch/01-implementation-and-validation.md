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
  lane: Green
  allowed_actions:
    - local_backend_patch
    - local_typecheck
    - local_diff_check
    - no_send_design
  forbidden_actions:
    - Meta CAPI actual send
    - VM Cloud deploy/restart
    - env flag ON
    - 운영DB write/import
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: local backend code + prior no-send preview aggregate
    window: 24h / 7d preview baseline
    freshness: 2026-05-21 KST
    confidence: high for local code behavior
```

# 구현/검증 상세

## 구현 범위

이번 패치는 Meta CAPI Purchase 전송 직전의 고객 매칭 재료를 보강할 수 있게 만든다.

기본값은 모두 꺼져 있으므로, 로컬 패치만으로는 추가 고객 정보가 Meta로 전송되지 않는다.

## 추가한 설정값

- `META_CAPI_ENABLE_IMWEB_PHONE_HASH`
  - Imweb 주문 캐시의 전화번호를 SHA-256 해시한 뒤 `user_data.ph` 후보로 쓰는 스위치.
  - 기본값 OFF.
- `META_CAPI_ENABLE_MEMBER_EXTERNAL_ID`
  - Imweb 회원 코드를 원문 그대로 쓰지 않고, site scope와 secret을 섞어 HMAC-SHA256으로 만든 값을 `user_data.external_id` 후보로 쓰는 스위치.
  - 기본값 OFF.
- `META_CAPI_EXTERNAL_ID_SECRET`
  - `external_id` HMAC 생성용 secret.
  - 16자 이상 필요.

## 안전 장치

- raw email/phone/member/order/payment/click id를 로그에 남기지 않는다.
- send log에는 `user_data_presence` boolean만 남긴다.
- `external_id`는 64자 hex 해시 형태만 payload에 들어간다.
- env flag가 OFF면 Imweb 주문 캐시 lookup 자체를 하지 않는다.
- HMAC secret이 없으면 member external id는 생성하지 않는다.

## 검증 결과

- Backend typecheck: PASS.
- `git diff --check` 대상 파일: PASS.
- 문서 raw identifier scan: PASS.

## 배포 판단

VM Cloud에는 flag OFF 상태로 배포해도 운영 전송 변화가 없다.

실제 `ph`/`external_id` 전송은 별도 Red 승인 후 제한적으로 켜는 것이 맞다. 권장 순서는 biocom 24시간 제한 ON, Events Manager 매칭 품질 확인, 그 다음 전체 확대다.
