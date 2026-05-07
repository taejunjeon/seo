# ApprovalQueueAgent v0 계약

작성 시각: 2026-05-07 14:45 KST
상태: active design
Owner: agent / approval
Supersedes: none
Next document: confirm/!confirm update rule
Do not use for: 승인 없는 Red Lane 실행

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
    - confirm/!confirm.md
    - total/!total-current.md
  lane: Green approval queue design
  allowed_actions:
    - 승인 문서 index 작성
    - open/closed/future approval 분리
    - 대화 보고용 승인 요약 작성
  forbidden_actions:
    - 승인 없이 운영 deploy
    - 승인 없이 platform send
    - 승인 없이 DB/ledger write
    - 승인 없이 GTM publish
  source_window_freshness_confidence:
    source: "confirm/*.md + total/!total-current.md + gdn/*approval*.md"
    window: "2026-05-07 KST"
    freshness: "approval docs change frequently"
    confidence: 0.82
```

## 10초 결론

ApprovalQueueAgent는 TJ님이 지금 봐야 할 결정을 줄이는 agent다.

이 agent는 승인 문서를 실행하지 않는다. 대신 현재 열려 있는 승인, 이미 닫힌 승인, 나중에 필요할 승인을 분리해서 `confirm/!confirm.md`에 정리한다.

## 입력

| 입력 | 의미 |
|---|---|
| `confirm/!confirm.md` | 현재 승인 큐 index |
| `confirm/confirm*.md` | 개별 승인 문서 |
| `gdn/*approval*.md` | GDN/Google Ads 관련 승인안 |
| `total/!total-current.md` | 전체 프로젝트 Active Board |

## 승인 상태 분류

| 상태 | 의미 | 처리 |
|---|---|---|
| `open` | 지금 TJ님 결정 필요 | 대화 보고에 최대 1~3개만 표시 |
| `approved` | 승인 완료, 실행/문서 반영 필요 | Completed 또는 Active 실행으로 이동 |
| `closed` | 결정 완료, 더 볼 필요 없음 | Completed Ledger로 이동 |
| `future` | 조건 충족 후 필요 | Parked/Future로 유지 |
| `superseded` | 최신 문서로 대체 | 링크만 남기고 숨김 |

## 승인 요청 필수 정보

승인 문서는 아래를 반드시 포함해야 한다.

1. 무엇을 승인하는가.
2. 왜 필요한가.
3. 어느 화면, API, DB, script, 설정이 바뀌는가.
4. 바꾸면 생기는 효과.
5. 안 바꾸면 남는 문제.
6. 성공 기준.
7. 실패 시 rollback 또는 다음 확인점.
8. Codex가 대신 못 하는 이유.
9. 금지되는 것.

## 출력

- `confirm/!confirm.md`
- 필요 시 `confirmMMDD-N.md`
- 대화 보고용 승인 요약

## 현재 2026-05-07 판정 규칙

Coffee NPay historical matching closure가 TJ님 YES로 확인되면:

- `confirm0507-1`은 `approved/closed`로 바꾼다.
- `confirm/!confirm.md`에서 open approval count를 0으로 표시한다.
- `data/!coffeedata.md` Phase2 다음 할일을 제거한다.

Mode B, Google Ads 전환 변경, conversion upload, GA4/Meta/Google Ads 전송은:

- 현재 `future Red approval`로 둔다.
- Agent가 자동 실행하지 않는다.

## 다음 구현 작업

1. confirm 문서의 `상태:` 라인을 파싱하는 규칙을 만든다.
2. `approval_pending`, `confirmation pending`, `approved`, `closed`, `future` 키워드를 분류한다.
3. 대화 출력은 문서 링크 3개 이하로 제한한다.

