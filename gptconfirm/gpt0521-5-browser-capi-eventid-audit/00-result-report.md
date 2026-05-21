harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - frontrule.md
  required_context_docs:
    - gptconfirm/gpt0521-4-browser-safe-event-id-design/00-result-report.md
    - data/!data_inventory.md
  lane: Green
  allowed_actions:
    - read_only_live_api_audit
    - local_log_aggregate_audit
    - frontend_report_copy_update
    - documentation
  forbidden_actions:
    - Meta send/backfill
    - GTM publish
    - VM deploy/restart
    - 운영DB write/import
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud CAPI log API + local aggregate log + repository code/docs
    window: recent_operational 7d for VM Cloud, local full log as historical cross-check
    freshness: 2026-05-21 KST read-only
    confidence: high for Server CAPI duplicate state, medium for Browser eventID match

# Browser vs CAPI eventID read-only audit

## 이번에 가능해진 것

Server CAPI Purchase는 최근 7일 기준 중복 없이 안정적으로 전송되고 있음을 확인했다.

다만 Browser Purchase는 브라우저가 Meta로 직접 보내는 신호라 VM Cloud 로그만으로 eventID를 볼 수 없다. 따라서 현재 단계에서는 `CAPI-only`를 운영 기본값으로 유지하고, `Browser Purchase + CAPI` 혼합은 같은 eventID 샘플을 Meta Events Manager 또는 브라우저 Network에서 확인한 뒤 test-only로만 검증하는 것이 맞다.

## 10초 요약

- VM Cloud CAPI log 최근 7일: Purchase 503건, success 503건, failure 0건.
- eventID unique 503건, duplicate eventID 0건, duplicate group 0건.
- 최근 표본 500건 eventID 형태는 모두 `Purchase.` 계열이다.
- Browser Purchase eventID는 VM Cloud read-only만으로 확정 불가다.
- 프론트엔드 CAPI 개발 보고서에 `CAPI-only`, `Browser+CAPI`, `Browser-only` 비교표를 추가했다.

## 판정

`CAPI_ONLY_RECOMMENDED_NOW`

`BROWSER_CAPI_MIX_REQUIRES_TEST_ONLY_EVENT_ID_MATCH`

`BROWSER_EVENT_ID_READ_ONLY_VERIFICATION_GAP`

## 운영 결론

현재 운영에서는 CAPI-only가 가장 안전하다.

이유는 서버 CAPI가 confirmed Purchase를 안정적으로 보내고 있고 duplicate가 0이기 때문이다. Browser Purchase를 섞으면 Meta UI 확인성은 좋아질 수 있지만, eventID가 다를 때 같은 구매가 두 번 잡힐 위험이 생긴다.

Browser+CAPI 혼합은 다음 조건이 닫힐 때만 진행한다.

1. 완료 페이지에서 Browser Purchase가 실제로 발화된다.
2. Browser Purchase eventID와 Server CAPI eventID가 같은 값임을 샘플로 확인한다.
3. same order one eventID 원칙과 dedup guard가 유지된다.
4. test-only 또는 preview-only로 먼저 확인한다.

## 변경한 화면

- `frontend/src/app/ai-crm/capi-report/page.tsx`

추가된 섹션:

- `Browser Purchase와 Server CAPI를 섞어 쓸지`
- read-only audit 결과 카드
- 중복 제거 쉬운 설명
- CAPI-only / Browser+CAPI / Browser-only 비교표

## 하지 않은 것

- Meta 운영 Purchase 추가 전송 없음.
- Browser Purchase fallback 운영 적용 없음.
- GTM publish 없음.
- VM Cloud deploy/restart 없음.
- 운영DB write/import 없음.
- raw order/payment/member/click id 출력 없음.
