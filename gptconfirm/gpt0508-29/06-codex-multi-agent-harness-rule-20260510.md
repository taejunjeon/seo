# Codex multi-agent harness rule (2026-05-10)

작성 시각: 2026-05-10 18:05 KST
Lane: Green
Mode: harness rule proposal and patch companion

## 한 줄 결론

멀티에이전트는 속도를 올리는 데 도움이 된다. 다만 같은 working tree에서 여러 에이전트가 동시에 수정·커밋하면 추적성이 깨지므로, 기본 원칙은 `조사 병렬 / 수정 통합 / 커밋 단일`이다.

## 규칙

1. read-only 조사와 proposal-only 초안은 병렬 subagent로 진행할 수 있다.
2. code 구현과 최종 문서 patch는 parent agent가 통합한다.
3. commit/push는 parent agent만 수행한다.
4. 병렬 구현이 필요하면 git worktree 또는 disjoint write set을 먼저 지정한다.
5. subagent 결과는 parent가 검토한 뒤 import한다.
6. unrelated dirty 파일은 어떤 agent도 stage/commit하지 않는다.
7. validation 없이 subagent 결과를 바로 commit하지 않는다.
8. 결과보고서마다 `조사 병렬 / 수정 통합 / 커밋 단일` 원칙을 반복 설명하지 않는다. 새 예외, 충돌 위험, worktree 분리가 필요한 경우에만 짧게 기록한다.

## 이번 gpt0508-28 적용

- Google Ads refresh 조사는 subagent가 read-only로 확인했다.
- BigQuery 7/14/30 확장 방향은 subagent가 read-only로 제안했다.
- Meta CAPI Test Events 승인안은 subagent가 read-only로 구조를 제안했다.
- harness patch 위치는 subagent가 read-only로 제안했다.
- 실제 파일 수정, 산출물 생성, 검증, 커밋은 parent agent가 단일 작업트리에서 수행한다.

## 금지

- 같은 working tree에서 여러 agent가 동시에 commit/push
- 같은 파일을 두 agent가 동시에 수정
- 병렬 agent가 운영 deploy, GTM publish, platform send 실행
- parent review 없이 subagent patch를 그대로 반영

## 성공 기준

- 조사 속도는 병렬화한다.
- 코드/문서 최종 상태는 parent가 하나로 통합한다.
- commit은 범위가 명확한 단일 책임으로 남긴다.
- unrelated dirty가 섞이지 않는다.
