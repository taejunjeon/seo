# HOLD Reducer / GTM lifecycle actual patch result (2026-05-10)

작성 시각: 2026-05-10 KST
작업 성격: Green Lane 문서 patch

## 5줄 요약

1. HOLD 결과를 승인 대기로 바로 넘기지 않고 Green follow-up을 먼저 수행하라는 pointer를 common harness에 추가했다.
2. GDN 검증 문서에 HOLD Reducer 검증 항목을 추가했다.
3. 보고 템플릿의 `진행 추천 자신감` 표현을 `Codex 추천 방향 / 추천 이유 / 추천 방향에 대한 자신감`으로 바꿨다.
4. AGENTS.md에 GTM Preview/workspace 작업 시 GTM Workspace Hygiene Rule을 따르라는 포인터를 추가했다.
5. 운영 deploy, GTM publish, DB write, platform send는 하지 않았다.

## 수정 파일

- `AGENTS.md`
- `harness/common/HARNESS_GUIDELINES.md`
- `harness/common/REPORTING_TEMPLATE.md`
- `harness/gdn/VERIFY.md`

## 적용한 규칙

### HOLD Reducer

HOLD는 최종 상태가 아니다. HOLD가 나오면 원인을 분류하고, read-only 조사, dry-run, 로컬 테스트, 문서 보강, 검증 스크립트처럼 Green Lane으로 줄일 수 있는 follow-up을 먼저 수행한다.

보고서에는 아래 필드를 남긴다.

```text
hold_reason_category
auto_green_followups_done
remaining_blocker
green_work_left_for_codex
tj_action_required
next_lane
```

### 추천/자신감 표기

이제 다음 할일에는 점수만 쓰지 않고 먼저 Codex가 무엇을 추천하는지 쓴다.

```text
Codex 추천 방향: 진행 추천 / 진행 비추천 / 보류 추천
추천 이유:
추천 방향에 대한 자신감:
```

### GTM lifecycle

AGENTS.md에서 GTM Preview/workspace 작업은 common harness의 GTM Workspace Hygiene Rule을 따르도록 연결했다.

핵심:

- Default Workspace 사용 금지
- live latest 기준 fresh workspace
- workspace capacity preflight
- cleanup 전 JSON backup
- cleanup 후 live version unchanged
- submit/create_version/publish 별도 승인 전 금지

## 금지선 준수

- 운영 deploy 0
- GTM Production publish 0
- DB write 0
- platform send 0
- Google Ads conversion upload 0

