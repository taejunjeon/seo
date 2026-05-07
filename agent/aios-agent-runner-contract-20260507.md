# AI OS Agent 공통 실행 계약

작성 시각: 2026-05-07 14:45 KST
상태: active contract
Owner: agent / aios
Supersedes: none
Next document: [[paid-click-intent-monitor-agent-v0-20260507]] 또는 [[coffee-data-agent-v0-20260507]]
Do not use for: 운영 배포 자동화, 플랫폼 전송 자동화, 운영 DB write 자동화, GTM publish 자동화

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - agent/!aiosagentplan.md
    - agent/!aiosagent.md
    - total/!total-current.md
  lane: Green agent contract
  allowed_actions:
    - 공통 실행 계약 작성
    - no-send/no-write guard 정의
    - 결과 파일 schema 정의
  forbidden_actions:
    - 운영 DB write
    - platform send
    - GTM publish
    - backend 운영 deploy
    - 광고 예산/캠페인 변경
  source_window_freshness_confidence:
    source: "agent/!aiosagentplan.md + 현재 repo scripts"
    window: "2026-05-07 KST"
    freshness: "Green 설계 문서 기준"
    confidence: 0.88
```

## 10초 결론

AI OS Agent v0는 “자동 실행자”가 아니라 **안전한 관측자와 정리자**다.

공통 계약의 목적은 각 agent가 같은 입력, 같은 출력, 같은 금지선, 같은 실패 분류를 쓰게 만드는 것이다. 이 계약을 먼저 고정해야 `PaidClickIntentMonitorAgent`, `CoffeeDataAgent`, `CampaignMappingAgent`, `ApprovalQueueAgent`를 안전하게 구현할 수 있다.

## 공통 실행 원칙

1. Green Lane은 자동 실행 가능하다.
2. Yellow Lane은 이미 승인된 범위 안에서만 실행한다.
3. Red Lane은 실행하지 않고 승인 문서와 체크리스트까지만 만든다.
4. 모든 agent는 Markdown과 JSON/YAML을 함께 남긴다.
5. 모든 숫자는 `source`, `window`, `freshness`, `confidence`를 같이 남긴다.
6. secret, token, 구매자 개인정보, raw payload는 문서와 로그에 남기지 않는다.

## 공통 입력

모든 agent는 아래 입력을 받을 수 있어야 한다.

| 필드 | 의미 | 예시 |
|---|---|---|
| `agent_name` | 실행 agent 이름 | `CoffeeDataAgent` |
| `run_mode` | 실행 모드 | `read_only`, `dry_run`, `monitoring`, `approval_index` |
| `window` | 분석 기간 | `2026-05-07 KST`, `last_24h` |
| `source_docs` | 근거 문서 | `data/!coffeedata.md` |
| `input_paths` | 입력 파일 | CSV, JSON, YAML, Markdown |
| `output_dir` | 출력 위치 | `data/`, `gdn/`, `agent/` |
| `allow_write` | write 허용 여부 | 기본 `false` |
| `allow_send` | 외부 전송 허용 여부 | 기본 `false` |
| `allow_deploy` | 배포 허용 여부 | 기본 `false` |

## 공통 출력

모든 agent는 최소한 아래 필드를 JSON/YAML에 남긴다.

```json
{
  "agent_name": "CoffeeDataAgent",
  "run_id": "coffee-data-agent-20260507-1445",
  "generated_at_kst": "2026-05-07 14:45:00 KST",
  "lane": "Green",
  "run_mode": "read_only",
  "source": "coffee monitoring endpoint + A-6 dry-run",
  "window": "2026-05-07 KST",
  "freshness": "latest available read-only",
  "confidence": 0.88,
  "would_write": false,
  "would_send": false,
  "would_deploy": false,
  "no_write_verified": true,
  "no_send_verified": true,
  "no_deploy_verified": true,
  "status": "pass",
  "blocked_reasons": [],
  "next_actions": []
}
```

## 상태 값

| 상태 | 의미 |
|---|---|
| `pass` | 실행과 검증이 통과 |
| `warn` | 결과는 나왔지만 freshness, 표본 수, 권한 부족 등 주의 필요 |
| `blocked` | 필요한 source, 권한, 승인, endpoint가 없어 다음 단계 불가 |
| `failed` | 실행 오류. 원인 분해 필요 |
| `skipped` | 의도적으로 실행하지 않음 |

## 실패 분류

| 분류 | 뜻 | 다음 행동 |
|---|---|---|
| `permission` | 계정/권한 부족 | TJ님 외부 권한 확인 또는 token 제공 |
| `credential` | 키/토큰 형식 불일치 | API 종류 재분류, credential 교체 |
| `source_stale` | 원본 데이터가 오래됨 | 최신 source 재수집 또는 판단 보류 |
| `api_error` | endpoint 오류 | status/body/trace id 기준 원인 확인 |
| `schema_mismatch` | 응답 필드가 기대와 다름 | parser/schema 업데이트 |
| `approval_required` | Red/Yellow 승인 필요 | 승인 문서 생성 |
| `empty_window` | 기간 내 데이터 없음 | 기간 확장 또는 자연 traffic 대기 |
| `network` | DNS/CORS/timeout 문제 | network smoke 또는 대체 endpoint 확인 |

## 파일명 규칙

| 산출물 | 규칙 |
|---|---|
| JSON | `data/{agent-slug}-{YYYYMMDD-HHMM}.json` |
| YAML | `data/{agent-slug}-{YYYYMMDD}.yaml` |
| 결과 문서 | `{project}/{agent-slug}-result-{YYYYMMDD}.md` |
| 승인 문서 | `confirm/confirm{MMDD}-{N}.md` |
| agent audit | `agent/{agent-slug}-audit-{YYYYMMDD}.md` |

## 공통 검증

문서만 변경한 경우:

```bash
python3 scripts/validate_wiki_links.py <문서경로>
python3 scripts/harness-preflight-check.py --strict
git diff --check -- <문서경로>
```

코드나 script wrapper가 생긴 경우:

```bash
npm --prefix backend run typecheck
git diff --check
```

프로젝트별 smoke는 각 agent 계약 문서에 따로 둔다.

## Red Lane 처리

Agent가 Red Lane을 발견하면 실행하지 않는다. 대신 아래만 한다.

1. 승인 문서 생성.
2. 변경 범위와 rollback 기준 작성.
3. smoke/negative smoke 목록 작성.
4. TJ님 승인 필요 여부를 `confirm/!confirm.md`에 반영.

Red Lane 예시:

- GTM Production publish
- 운영 backend deploy
- 운영 DB/ledger write
- Google Ads conversion action 생성/변경
- conversion upload
- GA4/Meta/Google Ads/TikTok/Naver 실제 전송
- 광고 예산/캠페인 상태 변경

## 다음 할일

1. [[paid-click-intent-monitor-agent-v0-20260507]]를 이 계약에 맞춰 정리한다.
2. [[coffee-data-agent-v0-20260507]]를 이 계약에 맞춰 정리한다.
3. 실제 wrapper script 구현은 문서 계약 검증 후 진행한다.

