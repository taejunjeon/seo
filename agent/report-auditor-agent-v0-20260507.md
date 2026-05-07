# ReportAuditorAgent v0 계약

작성 시각: 2026-05-07 20:50 KST
상태: active design
Owner: agent / report-audit
Supersedes: none
Next document: ReportAuditor v1 (source freshness report 추가)
Do not use for: 운영 배포, 운영 DB write, 플랫폼 전송, GTM publish, 광고 예산/캠페인 변경

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - agent/aios-agent-runner-contract-20260507.md
    - agent/!aiosagentplan.md
    - total/!total-current.md
  lane: Green read-only document audit agent
  allowed_actions:
    - validate_wiki_links 실행
    - harness-preflight-check --strict 실행
    - git diff --check 실행
    - 정본/승인 문서 stale endpoint/용어 drift scan
    - 결과 JSON/Markdown 생성
  forbidden_actions:
    - 문서 자동 수정/리라이트
    - 운영 DB write
    - 플랫폼 전송
    - GTM publish
    - backend 운영 deploy
  source_window_freshness_confidence:
    source: "정본 markdown + harness validators + git diff"
    window: "2026-05-07 KST"
    freshness: "agent 실행 시점 latest read-only"
    confidence: 0.87
```

## 10초 결론

ReportAuditorAgent는 정본·승인·결과 문서가 늘어날 때 발생하는 stale 링크, harness drift, endpoint 용어 혼동을 자동 검사한다. 문서를 자동 수정하지는 않고 후보만 보고한다.

## 재사용 script

```text
scripts/validate_wiki_links.py
scripts/harness-preflight-check.py --strict
git diff --check
rg -n "<endpoint patterns>" <target docs>
```

## 실행 순서

1. audit 대상 문서 목록을 결정한다 (`--targets` 인자 또는 default).
2. validate_wiki_links를 호출해 wiki 링크 매치 여부를 확인한다.
3. harness-preflight-check --strict로 fork/preflight 위반을 확인한다.
4. git diff --check로 whitespace/conflict marker를 확인한다.
5. stale endpoint scan: `paid_click_intent/no-send`, `confirmed_purchase/no-send`, `conversion upload`, `googleAds:mutate`, `GTM Production publish`, `operating DB write`, `운영 DB write` 7종 검색.
6. drift candidate filter: yaml 리스트 항목, `Red Lane`/`parked_red`/`보류`/`future Red`/`access log lines` 키워드 라인은 false positive로 제외.
7. 4개 child run이 모두 pass고 drift candidate 0이면 status=`pass`. drift candidate 있으면 `warn`. 한 개라도 실패하면 `failed`.

## 권장 명령

```bash
npm --prefix backend run agent:report-auditor

# 특정 대상만 audit
npm --prefix backend run agent:report-auditor -- --targets=agent/!aiosagentplan.md,gdn/!gdnplan.md
```

## 출력

| 산출물 | 의미 |
|---|---|
| `data/report-auditor-agent-YYYYMMDDHHMM.json` | 기계가 읽는 결과. 4개 child run + drift candidates |
| `agent/report-auditor-agent-YYYYMMDDHHMM.md` | 사람이 읽는 결과 |

## 판정 기준

| 판정 | 조건 | 의미 |
|---|---|---|
| `pass` | 4 child pass + drift candidate 0 | 다음 sprint 진입 가능 |
| `warn` | 4 child pass + drift candidate 있음 | 사람 읽고 false positive면 filter 보강, 진짜 drift면 문서 수정 |
| `failed` | child 중 1개라도 fail | 해당 validator 먼저 수정 |

## 금지선

- 문서 자동 수정 금지.
- 운영 DB write 금지.
- 플랫폼 전송 금지.
- GTM publish 금지.
- backend 운영 deploy 금지.

## 다음 구현 작업

1. v1: source freshness report — 각 정본 문서의 최신 source ts와 cron lag을 함께 출력한다.
2. v1: drift candidate를 `endpoint_drift` / `term_drift` / `approval_status_drift`로 자동 분류한다.
3. v1: stale-endpoint-scan에 `--include-context` 옵션을 추가해 사람이 즉시 판단 가능한 근거 라인 출력.
