# Browser Purchase Safe Event ID Design

작성 시각: 2026-05-21 KST
문서 성격: Green Lane 설계 문서. 실제 Meta 전송, GTM publish, VM Cloud 배포, 운영DB write 없음.
기준 코드: 로컬 `backend/src/metaCapi.ts`, `backend/src/routes/attribution.ts`, Header Guard v3.1.1 문서.

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  required_context_docs:
    - gptconfirm/gpt0521-3-event-id-raw-guard-deploy/01-event-id-dedup-review.md
    - gptconfirm/gpt0515-19-header-guard-v31-1-code/02-header-guard-v31-1-code.md
  lane: Green
  allowed_actions:
    - read_only_code_inspection
    - local_design_doc
    - approval_packet
  forbidden_actions:
    - meta_send
    - browser_purchase_live_fire
    - gtm_publish
    - vm_deploy_restart
    - operating_db_write
    - env_flag_on
  source_window_freshness_confidence:
    source: local repo + latest deploy docs
    window: current code as of 2026-05-21
    freshness: fresh_after_event_id_raw_guard_deploy
    confidence: high_for_contract_design_medium_until_test_events_smoke
```

## 10초 요약

Browser Purchase는 브라우저가 직접 eventID를 만들면 안 된다. 앞으로는 VM Cloud `payment-decision`이 confirmed 구매에 대해서만 서버 safe event_id를 내려주고, Header Guard가 `allow_purchase + dedup_ready`일 때만 그 값을 `fbq(..., { eventID })`에 넣어야 한다.

핵심은 3개다.

1. 서버가 event_id의 주인이 된다.
2. 브라우저는 서버가 준 safe 값만 소비한다.
3. CAPI event_id hash ON과 Header Guard v3.1.2 적용이 같은 cutover 묶음이어야 한다.

## 왜 중요한가

Meta dedup은 Browser Pixel의 `eventID`와 Server CAPI의 `event_id`가 같을 때만 같은 구매로 묶인다. 서버만 safe hash로 바꾸고 브라우저가 기존 raw 기반 eventID를 쓰면 같은 주문이 두 개의 구매처럼 보일 수 있다. 반대로 브라우저만 safe 값을 쓰고 서버 CAPI가 legacy raw event_id를 쓰면 dedup이 깨진다.

따라서 Browser Purchase 복구는 단순히 `fbq('track', 'Purchase')`를 다시 켜는 문제가 아니다. 서버가 만든 같은 safe event_id를 브라우저가 받아 쓰는 구조가 먼저 필요하다.

## 현재 코드 관측

- 서버 CAPI event_id 생성 함수: `backend/src/metaCapi.ts`의 `buildMetaCapiEventId`.
- event_id hash flag: `META_CAPI_ENABLE_EVENT_ID_HASH`.
- 현재 VM Cloud 배포 후 flag 상태: OFF.
- `payment-decision` endpoint: `backend/src/routes/attribution.ts`의 `/api/attribution/payment-decision`.
- Header Guard v3.1.1: `allow_purchase`면 기존 Purchase를 통과시키지만, 서버 safe event_id를 decision response에서 받아 쓰는 기능은 없음.

## 결론

바로 운영 Browser Purchase를 켜면 안 된다. 먼저 `payment-decision` 응답에 서버 safe event_id contract를 추가하고, Header Guard v3.1.2가 그 값을 읽어 `allow_purchase`에서만 사용하게 해야 한다. 실제 운영 cutover는 `META_CAPI_ENABLE_EVENT_ID_HASH=true`와 Header v3.1.2 적용을 같은 배포 묶음으로 승인해야 안전하다.

## 판정

- `BROWSER_SAFE_EVENT_ID_DESIGN_READY`: 준비됨.
- `HEADER_GUARD_V312_REQUIRED`: 필요.
- `CAPI_EVENT_ID_HASH_CUTOVER_REQUIRED`: 필요.
- `LIVE_BROWSER_PURCHASE_SEND_NOT_APPROVED`: 현재 금지.

## 하지 않은 것

- Meta 운영 Purchase 추가 send 없음.
- Browser Purchase test/live 발화 없음.
- VM Cloud deploy/restart 없음.
- GTM publish 없음.
- Imweb Header/Footer 저장 없음.
- 운영DB write 없음.
- raw order/payment/member/click id 출력 없음.
