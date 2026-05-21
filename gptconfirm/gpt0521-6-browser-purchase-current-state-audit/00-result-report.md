# Browser Purchase Current State Audit

작성 시각: 2026-05-21 KST
문서 성격: Green Lane read-only audit. Meta send, GTM publish, Imweb Header/Footer 변경, VM deploy/restart, 운영DB write 없음.

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
  required_context_docs:
    - gptconfirm/gpt0521-4-browser-safe-event-id-design/00-result-report.md
    - gptconfirm/gpt0521-5-browser-capi-eventid-audit/01-read-only-audit.md
  lane: Green
  allowed_actions:
    - read_only_code_inspection
    - read_only_capi_log_aggregate
    - local_documentation
  forbidden_actions:
    - meta_send
    - browser_purchase_live_fire
    - gtm_publish
    - imweb_header_footer_save
    - vm_deploy_restart
    - operating_db_write
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud /api/meta/capi/log aggregate + local repo + prior gptconfirm docs
    window: recent_operational since_days=7 limit=500
    freshness: checked_2026-05-21
    confidence: high_for_server_capi_medium_for_browser_purchase_until_network_sample
```

## 이번에 가능해진 것

Browser Purchase와 Server CAPI Purchase를 분리해서 설명하고, 현재 운영 구매 신호가 무엇으로 살아 있는지 확인했다.

- Server CAPI Purchase는 현재 살아 있다.
- 최근 operational Purchase 500건 read-only 집계에서 success 500, failed 0, duplicate eventID 0이다.
- Browser Purchase는 VM Cloud 로그만으로는 존재 여부와 eventID를 확정할 수 없다.
- Browser Purchase를 운영에 섞으려면 Test Events 또는 Network 샘플에서 Browser eventID와 CAPI event_id가 같은지 먼저 확인해야 한다.

## 10초 요약

현재 구매 신호의 운영 주 경로는 Server CAPI다. Browser Purchase는 운영 기본값으로 의존하지 않는 보조/검증 과제다. CAPI-only는 현재 안정적이고, Browser+CAPI 혼합은 같은 eventID dedup 샘플이 확인되기 전까지 보류가 맞다.

## 신뢰도

- Server CAPI가 구매 신호를 보내고 있다는 판단: 96%.
- Browser Purchase가 현재 운영 주 경로가 아니라는 판단: 82%.
- Browser Purchase가 완전히 0인지 여부: 60%. 브라우저 신호는 VM 로그에 직접 남지 않으므로 Network/Test Events 확인이 필요하다.
- Browser eventID와 CAPI event_id가 같은지 여부: 55%. 아직 직접 샘플이 없다.

## 실제 결제 테스트 필요 여부

현재 운영 복구 확인만 목적이면 TJ님과 새 실제 결제 테스트는 필요 없다. Server CAPI가 이미 success 500/500으로 확인된다.

다만 Browser Purchase 존재 여부와 eventID dedup까지 확정하려면 controlled sample 1건이 필요하다. 이 테스트는 운영 회복을 위한 필수 작업이 아니라, Browser+CAPI 혼합 전환을 검증하기 위한 선택 작업이다.

권장: 지금은 새 결제 테스트를 하지 않고 CAPI-only를 유지한다. 다음 자연 테스트 주문이나 test-only 완료 페이지가 준비될 때 Browser Purchase Network 샘플을 1회만 확인한다.

## 하지 않은 것

- Meta 운영 Purchase 추가 send 없음.
- Browser Purchase 강제 발화 없음.
- GTM publish 없음.
- Imweb Header/Footer 저장 없음.
- VM deploy/restart 없음.
- 운영DB write 없음.
- raw order/payment/member/click id 출력 없음.
