# Growth Data Agent Autonomy Policy v1

작성 시각: 2026-05-02 23:12 KST
목적: Green / Yellow / Red Lane별 에이전트 자율 실행 기준
상태: 공통 하네스 기준판

## 10초 요약

문서 작성, read-only 분석, dry-run, 테스트, audit는 Green Lane이면 묻지 않고 진행한다.

VM 배포, GTM Preview, smoke window처럼 제한된 운영 접점은 Yellow Lane이다. 스프린트 단위로 한 번 승인받으면 setup부터 cleanup/report까지 자율 진행한다.

GTM Production publish, 광고 플랫폼 전환 전송, 운영DB write, destructive migration은 Red Lane이다. 항상 멈추고 TJ님 명시 승인을 요청한다.

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

예외적으로 아래 조건이 생기면 중단하고 Lane을 올린다.

| 조건 | 승격 Lane |
|---|---|
| VM/backend deploy 필요 | Yellow |
| GTM Preview 필요 | Yellow |
| max-limited live insert 필요 | Yellow |
| 실제 결제 테스트 필요 | Red |
| GTM Production publish 필요 | Red |
| 광고 플랫폼 전환 send 필요 | Red |
| 운영DB write 필요 | Red |
| `.env` 운영값 변경 필요 | Yellow 또는 Red |

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

Yellow Lane 예시:

- VM receiver 배포
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
| TJ 관리 Attribution VM | `att.ainativeos.net` 내부 SQLite | 수집/보조 attribution 원장 |
| 로컬 개발 DB | `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` | 로컬 화면/캐시/개발 검증 |

운영DB와 TJ 관리 Attribution VM을 혼용하지 않는다.
