# Project Coffee — Autonomy Policy (project-local redirect)

본 파일은 정본의 redirect 이다. 본 정본 위치: `harness/common/AUTONOMY_POLICY.md`.

## Project-local 차이

본 Coffee 프로젝트만의 차이는 다음과 같다.

- smoke window `max_inserts ≤ 5` (정본은 site-별 정책으로 위임)
- intent ledger 의 `intent_uuid LIKE 'smoke_%'` 식별

전체 lane 정의 (Green / Yellow / Red), 승인 요건, 보고 형식은 정본을 따른다.
