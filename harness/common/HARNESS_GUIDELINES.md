# Growth Data Agent Harness Guidelines v1

작성 시각: 2026-05-02 23:12 KST
목적: GA4, GTM, NPay, TikTok, Meta, Google Ads, Attribution VM, 운영DB, 광고 ROAS, 결제 원장 작업의 공통 안전 기준
상태: 공통 하네스 기준판

## 10초 요약

하네스는 컨펌을 늘리는 장치가 아니다.

하네스는 위험한 선만 막고, 안전한 작업은 에이전트가 자율적으로 끝까지 진행하게 만드는 작업장이다.

1. Green Lane은 묻지 말고 진행한다.
2. Yellow Lane은 스프린트 단위 1회 승인 후 승인 범위 안에서 끝까지 진행한다.
3. Red Lane은 반드시 TJ님 명시 승인 전 멈춘다.
4. 모든 데이터 작업은 source / window / freshness / confidence를 기록한다.
5. 작업 종료 전 Auditor verdict를 남긴다.
6. 새 예외는 Lessons에 남기고, 반복 근거가 쌓이면 Rules로 승격한다.

## 목적

이 하네스의 목적은 세 가지다.

| 목적 | 설명 |
|---|---|
| 위험한 운영 변경을 막는다 | 운영DB write, GTM Production publish, 광고 플랫폼 전환 전송, env flag 상시 ON, 자동 dispatcher 운영 전환을 승인 전 차단 |
| 안전한 작업은 자율 진행한다 | 문서 작성, read-only 분석, dry-run, 테스트 코드, monitoring script, runbook, scoped commit/push |
| 작업할수록 더 똑똑해진다 | observation -> candidate_rule -> approved_rule 흐름으로 실패와 예외를 문서화 |

## Lane Classification

모든 작업은 시작 전에 Green / Yellow / Red 중 하나로 분류한다.

| Lane | 에이전트 행동 | 예시 | 조건 |
|---|---|---|---|
| Green | 묻지 말고 진행 | 문서 작성/수정, read-only query, 로컬 dry-run, payload preview, runbook, monitoring script, test, audit, Lessons 기록, candidate_rule 제안, scoped commit/push | no-send, no-write, no-publish, no-deploy, scope 내 변경, audit PASS/PASS_WITH_NOTES |
| Yellow | 스프린트 단위 1회 승인 후 자율 진행 | VM receiver 배포, backend route 배포, controlled smoke window, env flag 임시 ON, GTM Preview workspace, max 5건 이하 smoke insert, post-deploy smoke, rollback dry-run, cleanup | 허용/금지 범위, max duration, max insert/traffic, cleanup, success/stop criteria가 문서화됨 |
| Red | 멈추고 TJ 명시 승인 요청 | GTM Production publish, env flag 상시 ON, production mode 영구 활성, 자동 dispatcher 운영 전환, GA4/Meta/TikTok/Google Ads 전환 전송, 운영DB write/import apply, destructive migration, 외부 credential 발급/교체 | 별도 승인 문서와 명시 승인 필요 |

## Green Lane Autonomy Rule

Green Lane 작업은 에이전트가 확인 요청 없이 진행한다.

에이전트가 자동 수행할 수 있는 일:

1. 관련 문서 읽기
2. 작업 계획 작성
3. 문서/코드 초안 작성
4. read-only 또는 dry-run 실행
5. typecheck/test/audit 실행
6. 실패 시 scope 안에서 최대 2회 자동 수정
7. Auditor verdict 작성
8. scope 안이면 commit/push
9. 다음 작업을 Green / Yellow / Red로 분류해 제안
10. candidate row를 생성한 sprint는 다음 승인 요청 전에 사람이 읽는 후보 검토표를 Green Lane으로 작성

Green Lane에서도 아래 상황이면 멈춘다.

- scope 밖 파일 변경 필요
- `.env` 변경 필요
- backend deploy 필요
- GTM publish 필요
- 운영DB write 필요
- 광고 플랫폼 전송 필요
- 사용자 결제 테스트 필요

## Yellow Lane Sprint Rule

Yellow Lane은 스프린트 단위로 한 번 승인받는다.

승인 후에는 중간 확인 없이 아래까지 끝낸다.

1. setup
2. test
3. cleanup
4. verification
5. report
6. audit
7. 승인 범위 안의 commit/push

Yellow 승인 문서에는 반드시 아래가 있어야 한다.

| 항목 | 설명 |
|---|---|
| sprint 이름 | 어떤 묶음을 승인하는지 |
| 허용 작업 | 승인 후 해도 되는 일 |
| 금지 작업 | 승인 후에도 하면 안 되는 일 |
| max duration | 임시 window/flag가 얼마나 열릴 수 있는지 |
| max inserts 또는 max traffic | live insert/traffic 영향 상한 |
| cleanup 조건 | env/window/token OFF 복귀 조건 |
| success criteria | 성공으로 볼 기준 |
| stop criteria | 즉시 중단할 조건 |
| final report format | 완료 보고 형식 |

## Red Lane Stop Rule

아래 작업은 반드시 멈추고 TJ님 명시 승인을 요청한다.

| Red Lane 작업 | 이유 |
|---|---|
| GTM Production publish | 사이트 전체 tracking에 영향 |
| env flag 상시 ON | 운영 mode 고착 위험 |
| production mode 영구 활성 | rollback 전까지 계속 영향 |
| 자동 dispatcher 운영 전환 | 자동 전송/처리 위험 |
| GA4 Measurement Protocol purchase 전송 | GA4 전환값 변경 |
| Meta CAPI Purchase 전송 | Meta 전환값 변경 |
| TikTok Events API 전송 | TikTok 전환값 변경 |
| Google Ads conversion upload | Google Ads 전환값 변경 |
| 운영DB write/import apply | 개발팀 관리 원장 변경 |
| destructive migration | 데이터 손상 위험 |
| 실제 결제 테스트 | 비용/주문/고객 영향 |
| 외부 credential 발급/교체 | 계정/권한 영향 |
| 5건 초과 live insert | smoke 범위 초과 |
| 사이트 전체 사용자에게 영향을 주는 script publish | 운영 사용자 영향 |

## Preflight Questions

작업 시작 전 아래 질문에 답한다.

| 질문 | 답변 기준 |
|---|---|
| site는 무엇인가 | biocom / thecleancoffee / aibio / 공통 |
| 어떤 시스템을 건드리는가 | GA4 / GTM / NPay / TikTok / Meta / Google Ads / Attribution VM / 운영DB / Imweb / Toss / Excel / local DB |
| Lane은 무엇인가 | Green / Yellow / Red |
| 허용된 것은 무엇인가 | 구체적 작업 범위 |
| 금지된 것은 무엇인가 | send/write/publish/deploy 여부 |
| source/window/freshness/confidence가 명확한가 | 모든 숫자와 판단에 기록 |
| live tracking layer를 확인했는가 | GTM, funnel-capi, purchase guard, wrapper, session/eid key |
| 운영 변경이 있는가 | 있으면 Yellow 또는 Red |
| 광고 플랫폼 전송이 있는가 | 있으면 Red |
| 종료 전 검증은 무엇인가 | test, typecheck, smoke, audit, 문서 링크 검증 |

## Required Context Documents

공통으로 먼저 읽는다.

- `AGENTS.md`
- `CLAUDE.md`
- `harness/common/HARNESS_GUIDELINES.md`
- `harness/common/AUTONOMY_POLICY.md`
- `harness/common/REPORTING_TEMPLATE.md`

프로젝트별 하네스가 있으면 추가로 읽는다.

- `harness/{project}/README.md`
- `harness/{project}/CONTEXT_PACK.md`
- `harness/{project}/RULES.md`
- `harness/{project}/VERIFY.md`
- `harness/{project}/AUDITOR_CHECKLIST.md`
- `harness/{project}/LESSONS.md`

tracking/GTM 작업이면 추가로 확인한다.

- `LIVE_TAG_INVENTORY.md`
- 최신 live tracking inventory snapshot
- GTM live version
- Imweb header/footer 정본
- existing wrapper 조사 결과

광고/전환 전송 작업이면 추가로 확인한다.

- platform-specific approval doc
- payload preview
- duplicate guard
- rollback plan
- post-send verification query

## Live Tracking Inventory Rule

tracking, wrapper, GTM, NPay, TikTok, Meta, GA4, funnel-capi 작업 전에는 live tracking inventory를 확인한다.

필수 확인:

1. live console markers
2. GTM live version
3. Imweb header/footer custom code
4. existing wrappers: `fbq`, `gtag`, `ttq`, `SITE_SHOP_DETAIL.confirmOrderWithCartItems`, `window.confirmOrderWithCartItems`
5. existing session/eid keys
6. server send enabled/disabled
7. observed events
8. NPay / checkout / purchase path
9. current pixel IDs
10. active guards

Hard Fail:

- tracking 작업인데 live inventory가 없거나 7일 이상 stale
- existing wrapper 확인 없이 새 wrapper 설계
- existing session/eid 확인 없이 새 session key 설계

## Publish Scope Rule

GTM 또는 live script publish 전에는 기능 단위로 필요한 태그가 모두 포함됐는지 확인한다.

필수 질문:

1. 이 publish는 어떤 user action을 capture하는가?
2. capture payload를 누가 만든다?
3. payload를 누가 forward한다?
4. backend receiver는 살아 있는가?
5. 저장 후 조회 가능한가?
6. rollback은 몇 분 안에 가능한가?
7. publish 범위에 빠진 tag는 없는가?

누락 발견 시:

- Production publish 중단
- lesson 등록
- publish decision 문서 갱신

## Success Criteria

| Lane | 성공 기준 |
|---|---|
| Green | audit PASS/PASS_WITH_NOTES, no-send/no-write/no-publish/no-deploy, scope 내 변경, report 작성 |
| Yellow | 승인된 max 범위 내 실행, smoke 성공, cleanup 완료, env/window/token OFF 복귀, monitoring 정상, report + audit 완료 |
| Red | 별도 승인 문서, rollback 확인, post-action verification, stop condition 명시 |

## Stop Conditions

즉시 중단:

- PII 저장
- 잘못된 site 저장
- platform send 발생
- GTM Production publish가 승인 없이 발생
- env flag 상시 ON이 승인 없이 발생
- 운영DB write 발생
- endpoint 5xx
- invalid payload 급증
- direct/general traffic이 intent로 저장
- strict confirmed 오염

## Lessons-to-Rules

하네스는 작업할수록 좋아져야 한다.

| 단계 | 의미 | 예시 |
|---|---|---|
| observation | 단일 사례 관찰 | dispatcher만 publish되면 snippet이 없어 buffer가 생기지 않는다 |
| candidate_rule | 다음에도 적용 가능성이 있는 규칙 | dispatcher와 snippet installer는 publish scope에 함께 포함해야 한다 |
| approved_rule | 반복 근거가 있고 audit 통과 | RULES.md에 반영 |
| deprecated_rule | 더 이상 맞지 않는 규칙 | 삭제하지 말고 이유와 대체 규칙을 기록 |

규칙 승격 원칙:

- 전송 후보를 좁히는 규칙은 빠르게 적용 가능
- 전송 후보를 넓히는 규칙은 TJ님 승인 필요
- 광고 플랫폼 전송 관련 규칙은 evidence 3~5건 이상 권장

## Auditor Verdict

작업 종료 전 반드시 `harness/common/REPORTING_TEMPLATE.md`의 Auditor verdict 형식으로 보고한다.
