# GTM workspace hygiene rule proposal

작성 시각: 2026-05-09 18:53 KST
Status: PROPOSED_AND_APPLIED_TO_COMMON_HARNESS

## 한 줄 결론

GTM Preview 작업은 fresh workspace capacity를 먼저 확인하고, Preview 종료 후 old workspace를 정리해야 한다. Production publish 승인이 아닌 Preview 성공을 운영 반영으로 해석하면 안 된다.

## 새 규칙

1. Default Workspace 사용 금지.
2. 새 GTM 작업은 live latest 기준 fresh workspace에서 시작.
3. Preview 시작 전 workspace capacity preflight 수행.
4. old Preview workspace TTL/cleanup policy 적용.
5. fresh workspace 생성 성공 전 VM Cloud write flag ON 금지.
6. workspace cleanup 전 JSON backup 필수.
7. cleanup 후 live version unchanged 확인.
8. reuse는 fresh create 실패 시 fallback만 허용.
9. Preview 성공은 Production publish 승인이 아니다.

## 적용 이유

이번 gpt0508-13에서 GTM API가 workspace create에 `429 RESOURCE_EXHAUSTED`를 반환했다. 원인은 Path B 코드가 아니라 old Preview workspace가 남아 fresh workspace 생성 capacity를 막은 것이다.

## 적용 위치

- `harness/common/HARNESS_GUIDELINES.md`

Auditor verdict: PASS_RULE_PROPOSAL
