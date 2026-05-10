# Codex multi-agent usage plan (2026-05-10)

작성 시각: 2026-05-10 KST
작업 성격: Green Lane 운영 방식 정리
대상: Path B / NPay / Google Ads / BigQuery / Meta / Harness 병렬 작업

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Green
  allowed_actions:
    - subagent read-only 조사
    - proposal-only 문서 작성
    - disjoint file patch
    - parent agent validation/commit
  forbidden_actions:
    - 같은 working tree에서 여러 agent 동시 commit
    - unrelated dirty 포함
    - operational deploy/write/publish/send
  source_window_freshness_confidence:
    source: current Codex session subagents + git working tree
    window: 2026-05-10 KST
    freshness: same-session
    confidence: high
```

## 5줄 결론

1. 현재 Codex 환경에서는 subagent 병렬 조사가 가능하다.
2. 같은 working tree에서 여러 agent가 동시에 commit하면 충돌 위험이 크므로 commit은 parent agent만 한다.
3. 구현 작업은 서로 다른 worktree/branch 또는 명확한 disjoint write set일 때만 병렬화한다.
4. 이번 gpt0508-27에서는 read-only/proposal 중심으로 Agent A~E를 병렬 조사하고 parent가 통합했다.
5. 다음부터는 `조사 병렬 / 수정 통합 / 커밋 단일` 운영이 가장 안전하다.

## 이번 세션에서 사용한 방식

| 역할 | 담당 | 쓰기 권한 | 결과 |
|---|---|---|---|
| Agent A | ConfirmedPurchasePrep 통합 input 방향 | 없음 | parent가 구현 |
| Agent B | Google Ads action/campaign ROAS decomposition 조사 | 없음 | snapshot fallback과 script 후보 확인 |
| Agent C | BigQuery funnel quality 조사 | 없음 | BigQuery export와 existing script 확인 |
| Agent D | Meta funnel CAPI readiness 조사 | 없음 | server ready / dedup hold 정리 |
| Agent E | Harness patch 조사 | 없음 | 최소 patch 대상 제안 |

## 추천 운영 방식

### 1. Read-only 조사

동시에 여러 subagent를 써도 된다.

- 코드/문서 위치 찾기
- 기존 script 파악
- 데이터 source inventory
- blocker 분류

주의: 같은 질문을 중복으로 던지지 않는다. parent agent는 결과를 합치고, 최종 판단만 수행한다.

### 2. 문서/설계 작성

proposal-only라면 병렬 가능하다. 단, 같은 파일을 동시에 수정하지 않는다.

권장:

- Agent B는 `gdn/google-ads-*`
- Agent C는 `gdn/channel-*`
- Agent D는 `capivm/meta-*`
- Agent E는 `harness/*` patch plan

### 3. 코드 구현

코드 구현은 원칙적으로 parent가 한다. 병렬 구현이 필요하면 worktree를 나눈다.

권장 worktree 예시:

```bash
git worktree add ../seo-worktree-pathb pathb-confirmed-input
git worktree add ../seo-worktree-gads gads-roas-decomp
```

각 worktree는 disjoint write set을 갖고, parent가 patch를 review/import한다.

### 4. Commit/push

commit/push는 parent agent만 한다.

금지:

- 여러 agent가 같은 branch에 동시 commit
- unrelated dirty 포함
- VM Cloud 배포된 dist와 로컬 source mismatch를 확인하지 않는 commit

권장:

1. `git status --short`
2. whitelist 작성
3. validation
4. scoped commit
5. push

## 현재 repo 주의점

- `tiktok/*` dirty는 이번 Path B/NPay/GDN 작업과 무관하므로 제외한다.
- gptconfirm batch는 기존 batch를 덮어쓰지 않는다.
- Growth Data 변경은 `harness-preflight-check.py --strict`를 통과해야 한다.

## 다음 병렬화 후보

1. Google Ads live API env mapping 확인
2. Campaign internal confirmed join 설계
3. NPay channel_order_no 매핑 dry-run
4. Meta Test Events smoke approval packet
5. Harness ReportAuditor rule 구현

