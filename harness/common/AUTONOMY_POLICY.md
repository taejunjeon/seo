# Growth Data Agent Autonomy Policy v1.1

작성 시각: 2026-05-02 23:12 KST
최근 업데이트: 2026-05-10 18:05 KST
목적: Green / Yellow / Red Lane별 에이전트 자율 실행 기준
상태: 공통 하네스 기준판

## 10초 요약

문서 작성, read-only 분석, dry-run, 테스트, audit는 Green Lane이면 묻지 않고 진행한다.

VM Cloud 배포, GTM Preview, smoke window처럼 제한된 운영 접점은 Yellow Lane이다. 스프린트 단위로 한 번 승인받으면 setup부터 cleanup/report까지 자율 진행한다.

GTM Production publish, 광고 플랫폼 전환 전송, 운영DB write, destructive migration은 Red Lane이다. 항상 멈추고 TJ님 명시 승인을 요청한다.

중요:

이미 승인된 Yellow Lane을 다시 `TJ님 다음 할 일`로 돌리지 않는다.
승인 범위 안에서 실행을 시도하고, 성공/실패/접근 blocker를 결과로 보고한다.

## Green Lane

Green Lane은 자동 진행한다.

| 허용 | 조건 |
|---|---|
| 문서 작성/수정 | scope 안, 근거 링크 포함 |
| read-only query | source/window/freshness/confidence 기록 |
| 로컬 dry-run | no-write, no-send |
| payload preview | 실제 send 없음 |
| runbook/approval 문서 작성 | 실행 자체는 하지 않음 |
| monitoring script 작성 | 운영 배포 없음 |
| 테스트 코드 작성/실행 | 운영 데이터 write 없음 |
| typecheck/test/audit 실행 | 안전한 로컬/읽기 작업 |
| Lessons 기록 | observation/candidate_rule 중심 |
| scoped commit/push | audit PASS/PASS_WITH_NOTES, 범위 내 변경 |

Green Lane에서 묻지 않는다.

## Multi-Agent Worktree Rule

멀티에이전트 병렬화는 read-only 조사와 proposal-only 문서 초안까지 Green Lane으로 허용한다.

코드 구현은 parent agent가 통합 수행한다. 병렬 구현이 필요한 경우에만 별도 worktree/branch 또는 명확한 disjoint write set을 사용하고, parent agent가 patch를 review/import한다.

commit/push는 parent agent만 수행한다.

결과보고서에는 이 원칙을 매번 길게 반복하지 않는다. 새 예외, 충돌 위험, worktree 분리 필요, subagent 결과 불일치가 있을 때만 짧게 기록한다.

금지:

- 같은 working tree에서 여러 agent가 동시에 commit/push
- unrelated dirty 포함
- write set이 겹치는 병렬 구현
- validation 없이 subagent 결과를 직접 commit

예외적으로 아래 조건이 생기면 중단하고 Lane을 올린다.

| 조건 | 승격 Lane |
|---|---|
| VM Cloud/backend deploy 필요 | Yellow |
| GTM Preview 필요 | Yellow |
| max-limited live insert 필요 | Yellow |
| 실제 결제 테스트 필요 | Red |
| GTM Production publish 필요 | Red |
| 광고 플랫폼 전환 send 필요 | Red |
| 운영DB write 필요 | Red |
| `.env` 운영값 변경 필요 | Yellow 또는 Red |

## HOLD Reducer Rule

HOLD는 최종 보고 상태가 아니다. 원인을 줄여야 하는 중간 상태다.

결과가 HOLD이면 에이전트는 바로 TJ님 승인 대기로 넘기지 않고 아래를 먼저 수행한다.

1. HOLD 원인을 taxonomy로 분류한다.
2. 실행 가능한 Green follow-up을 식별한다.
3. read-only 조사, dry-run, 문서 보강, 로컬 테스트, 검증 스크립트 실행은 TJ님 확인 없이 자동 수행한다.
4. 자동 수행한 follow-up과 남은 blocker를 결과보고서에 분리한다.
5. 남은 작업이 Yellow/Red/권한/사업 판단일 때만 TJ님에게 넘긴다.

HOLD 원인 taxonomy는 아래를 기본으로 쓴다.

| hold_reason_category | 의미 | 자동 Green follow-up 예 |
|---|---|---|
| `missing_click_bridge` | 주문 row와 광고 click id가 결정적으로 연결되지 않음 | ledger join dry-run, click storage/source audit, same-browser preservation 설계 |
| `missing_identity_bridge` | email/member/phone/session 등 identity key가 없음 | source inventory, no-send HMAC smoke 설계 |
| `ambiguous_candidates` | 후보가 2건 이상이거나 time-window-only 후보가 과다 | confidence rule 보강, ambiguous/do_not_send 분류 |
| `workspace_capacity` | GTM workspace 생성 quota 또는 stale workspace 충돌 | workspace list, backup/cleanup plan, live version unchanged 확인 |
| `blocked_access` | UI/2FA/API 권한으로 agent가 직접 접근 불가 | read-only fallback, TJ님 필요 화면/캡처 최소화 |
| `blocked_data` | primary source가 없거나 조회 불가 | fallback source 확인, freshness/confidence 기록 |
| `time_waiting` | 24h/72h 등 시간 도달 전 | 현재까지 가능한 capture health와 예약 runbook 작성 |
| `approval_required` | 남은 작업이 Yellow/Red | 승인안 final packet 작성 |
| `source_freshness_gap` | source window가 낡음 | read-only refresh, stale 표시 |
| `verification_gap` | 검증 명령/fixture/auditor 누락 | validation 실행, raw/log/platform grep |

HOLD 보고서에는 반드시 아래 필드를 둔다.

- `hold_reason`
- `hold_reason_category`
- `auto_green_followups_available`
- `auto_green_followups_done`
- `remaining_blocker`
- `next_lane`
- `tj_action_required`
- `codex_next_green_action`

## Yellow Lane

Yellow Lane은 스프린트 단위 1회 승인 후 자율 진행한다.

승인 문서 필수 항목:

| 항목 | 설명 |
|---|---|
| sprint 이름 | 승인 범위를 식별 |
| 허용 작업 | 승인 후 자율 진행 가능한 작업 |
| 금지 작업 | 승인 후에도 하면 안 되는 작업 |
| max duration | smoke window/env flag 시간 상한 |
| max inserts 또는 max traffic | live 영향 상한 |
| cleanup 조건 | OFF 복귀, token 제거, window 종료 |
| success criteria | 성공 판단 기준 |
| stop criteria | 중단 조건 |
| final report format | 완료 보고 형식 |

승인 후 에이전트는 아래를 중간 확인 없이 끝낸다.

1. setup
2. 실행
3. smoke/validation
4. cleanup
5. cleanup 검증
6. audit
7. 완료 보고
8. 승인 범위 내 commit/push

### Approved Yellow Continuation Rule

이미 승인된 Yellow Lane은 `승인 대기`가 아니다.
에이전트는 승인 범위 안에서 바로 실행해야 한다.

예:

| 승인 문구 | 에이전트 행동 |
|---|---|
| `Preview only YES` | fresh workspace에서 Preview를 실행하고 결과를 보고한다 |
| `test-only smoke YES` | test code로만 smoke를 실행하고 platform 운영 전송은 하지 않는다 |
| `controlled smoke window YES` | 승인된 시간/건수 안에서 smoke, cleanup, 검증, 결과보고까지 끝낸다 |

다시 멈춰야 하는 경우:

- 허용 범위 밖 작업이 필요하다.
- Production publish, Submit, platform send, 운영DB write, 운영 deploy가 필요하다.
- max duration/max inserts/max traffic을 초과한다.
- stop criteria 또는 Hard Fail이 발생한다.
- GTM UI, Google Ads UI, Meta UI, 2FA, 계정 권한처럼 Codex가 직접 접근할 수 없는 blocker가 있다.

접근 blocker가 있으면 아래를 한 번에 보고한다.

1. 어떤 화면/단계에서 막혔는가.
2. TJ님이 해야 할 정확한 클릭/캡처/확인값은 무엇인가.
3. Codex가 계속 진행 가능한 대체 작업은 무엇인가.
4. 다음에 필요한 승인안이 있다면 무엇인가.

Yellow Lane 예시:

- VM Cloud receiver 배포
- backend route 배포
- controlled smoke window
- env flag 임시 ON
- GTM Preview workspace
- max 5건 이하 smoke insert
- 실제 브라우저 preview 검증
- post-deploy smoke
- rollback dry-run

## Red Lane

Red Lane은 TJ님 명시 승인 전 절대 실행하지 않는다.

| Red 작업 | 멈추는 이유 |
|---|---|
| GTM Production publish | 전체 사용자 tracking 영향 |
| env flag 상시 ON | 운영 mode 고착 |
| production mode 영구 활성 | 장기 영향 |
| 자동 dispatcher 운영 전환 | 자동 전송 위험 |
| GA4 Measurement Protocol purchase 전송 | GA4 전환값 변경 |
| Meta CAPI Purchase 전송 | Meta 전환값 변경 |
| TikTok Events API 전송 | TikTok 전환값 변경 |
| Google Ads conversion upload | Google Ads 전환값 변경 |
| 운영DB write/import apply | 개발팀 관리 원장 변경 |
| destructive migration | 데이터 손상 위험 |
| 실제 결제 테스트 | 비용/주문/고객 영향 |
| 외부 credential 발급/교체 | 계정/권한 영향 |
| 5건 초과 live insert | smoke 범위 초과 |

Red Lane 승인 요청은 별도 문서로 만든다.

승인 문서 작성 자체는 Green Lane이다. 승인 없이 작성한다. 승인이 필요한 것은 문서에 적힌 실행이다.

## No-Send / No-Write 기본값

기본값은 항상 아래다.

| 항목 | 기본값 |
|---|---|
| no-send | YES |
| no-write | YES |
| no-deploy | YES |
| no-publish | YES |
| no-platform-send | YES |

이 중 하나라도 `NO`가 되면 Green Lane이 아니다.

## DB 위치 표기

모든 보고에는 DB 위치를 명시한다.

| 이름 | 위치 | 의미 |
|---|---|---|
| 운영DB | 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users` | 실제 주문 상태 검산 |
| VM Cloud | TJ님 개발·관리 Cloudflare 기반 수집/보조 원장 환경. 대표 도메인은 `att.ainativeos.net`, 내부 원장은 SQLite | 수집/보조 attribution 원장 |
| 로컬 | 이 맥북 PC. 대표 로컬 DB는 `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` | 로컬 화면/캐시/개발 검증 |

운영DB와 VM Cloud를 혼용하지 않는다.
