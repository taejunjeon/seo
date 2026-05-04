# Google Ads GDN ROAS Harness

작성 시각: 2026-05-03 22:25 KST
상태: v0 기준판
범위: Google Ads / GDN ROAS 정합성 작업을 위한 문서형 agent harness
관련 문서: [[gdn/!gdnplan|Google Ads ROAS 정합성 체크 및 개선 계획]], [[gdn/google-ads-internal-roas-reconciliation|Google Ads 내부 ROAS 대조 결과]], [[data/!datacheckplan|Data Check Plan]], [[harness/common/HARNESS_GUIDELINES|Growth Data Agent Harness Guidelines]], [[harness/common/AUTONOMY_POLICY|Growth Data Agent Autonomy Policy]], [[harness/common/REPORTING_TEMPLATE|Growth Data Reporting Template]], [[harness/gdn/CONTEXT_PACK|GDN Context Pack]], [[harness/gdn/RULES|GDN Rules]], [[harness/gdn/VERIFY|GDN Verify]], [[harness/gdn/APPROVAL_GATES|GDN Approval Gates]], [[harness/gdn/AUDITOR_CHECKLIST|GDN Auditor Checklist]], [[harness/gdn/EVAL_LOG_SCHEMA|GDN Eval Log Schema]], [[harness/gdn/LESSONS|GDN Lessons]]
Primary source: Google Ads API `customer_id=2149990943`, TJ 관리 Attribution VM `source=biocom_imweb`, `gdn/!gdnplan.md`
Freshness: 2026-04-25 21:55 KST result report 기준. 다음 read-only sprint에서 최신값으로 갱신 필요
Confidence: 88%

## 10초 요약

이 하네스는 Google Ads, 특히 GDN과 PMax의 ROAS를 플랫폼 숫자 그대로 믿지 않도록 막는 작업장이다.

기본값은 `read-only`, `no-send`, `no-write`, `no-publish`, `no-deploy`다. Codex는 Google Ads API, GTM read-only, 내부 attribution 원장 대조, 문서 업데이트, 승인안 작성까지는 자율 진행한다.

멈추는 지점은 Google Ads 전환 액션 변경, conversion upload, GTM Production publish, 운영 DB write, VM/backend deploy다. 이 작업들은 TJ님 명시 승인 전에는 하지 않는다.

## 목적

Google Ads의 전환값과 내부 확정매출 장부가 같은 말을 하는지 확인한다.

현재 핵심 문제는 `구매완료`라는 Primary 전환 액션이 실제 confirmed purchase가 아니라 아임웹 자동 NPay count label과 연결된 점이다. 이 상태에서는 Google Ads ROAS가 높아 보여도 자동입찰이 실제 결제 완료 주문을 학습한다고 보기 어렵다.

## 언제 쓰는가

아래 작업을 할 때 이 하네스를 먼저 읽는다.

1. Google Ads API로 전환 액션과 캠페인 성과를 다시 조회한다.
2. GDN/PMax/Search 캠페인별 플랫폼 ROAS와 내부 confirmed ROAS를 비교한다.
3. `Conv. value`, `All conv. value`, view-through conversion을 분리한다.
4. GTM/GA4/아임웹 코드에서 Google Ads 전환 label 발화 경로를 확인한다.
5. `구매완료` action `7130249515`를 Primary에서 내릴지 승인안을 만든다.
6. confirmed 주문 기반 Google Ads purchase 또는 offline conversion import를 설계한다.
7. 취소/환불을 Google Ads conversion adjustment로 보낼지 검토한다.

## 기본 금지선

| 금지 | 이유 |
|---|---|
| Google Ads conversion upload | Google Ads 전환값과 입찰 학습에 직접 영향 |
| Google Ads 전환 액션 변경 | Primary/Secondary 목표 변경은 자동입찰 학습에 영향 |
| Google Ads 캠페인 budget/status 변경 | 광고 집행과 비용에 직접 영향 |
| GTM Production publish | 사이트 전체 tracking에 영향 |
| GA4 MP / Meta CAPI / TikTok Events API 전송 | 다른 플랫폼 전환값 오염 |
| 운영 DB write/import apply | 개발팀 관리 원장 오염 |
| VM/backend deploy | 운영 endpoint 영향 |
| `.env` 운영값 변경 | 인증/전송/운영 모드 영향 |

## 허용 범위

| 범위 | 허용 |
|---|---|
| 문서 | `gdn/*.md`, `harness/gdn/*.md` 작성/수정 |
| read-only query | Google Ads API 조회, GTM read-only 조회, GA4 Data API 조회, Attribution VM read-only 조회 |
| dry-run | offline conversion payload preview, conversion adjustment preview, campaign mapping dry-run |
| 코드 | read-only report script, parser, dashboard read-only UI, auditor helper |
| 검증 | typecheck, lint, wiki link validation, no-send/no-write grep |
| 승인안 | TJ님이 YES/NO로 결정할 수 있는 Yellow/Red Lane 승인 문서 작성 |

## Phase Map

| Phase | 이름 | 목표 | 완료 조건 |
|---|---|---|---|
| Phase0 | Source inventory | Google Ads, GTM, GA4, 내부 원장 기준을 고정 | source/window/freshness/confidence 표 완성 |
| Phase1 | Conversion action audit | 전환 액션, label, primary 여부, value source를 분해 | NPay label / true purchase / helper action 분류 |
| Phase2 | ROAS reconciliation | 플랫폼 ROAS와 내부 confirmed ROAS를 캠페인/액션별 비교 | GDN/PMax/Search 분리, gap driver 표 완성 |
| Phase3 | Tracking path audit | GTM/GA4/아임웹 전환 발화 경로를 read-only로 확인 | stale snapshot 해소, live label 경로 확인 |
| Phase4 | Remediation approval | Primary 전환 교체와 confirmed purchase 경로 승인안 작성 | YES/NO 가능한 승인 문서 |
| Phase5 | Post-change monitoring | 승인된 변경 후 7~14일 학습/성과를 관찰 | daily monitor, rollback/hold 기준 |

## v0 Files

| 파일 | 용도 |
|---|---|
| [[harness/gdn/README|README.md]] | 하네스 목적, 금지선, 사용법 |
| [[harness/gdn/CONTEXT_PACK|CONTEXT_PACK.md]] | 읽어야 할 문서, source, 최신 숫자 |
| [[harness/gdn/RULES|RULES.md]] | ROAS, 전환 액션, label, view-through, send 차단 규칙 |
| [[harness/gdn/VERIFY|VERIFY.md]] | 검증 명령과 no-send/no-write 확인 |
| [[harness/gdn/APPROVAL_GATES|APPROVAL_GATES.md]] | Google Ads/GTM/전송 승인 게이트 |
| [[harness/gdn/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST.md]] | 종료 전 hard/soft fail 체크 |
| [[harness/gdn/EVAL_LOG_SCHEMA|EVAL_LOG_SCHEMA.md]] | run log와 평가 로그 schema |
| [[harness/gdn/LESSONS|LESSONS.md]] | 반복 예외와 candidate rule |

## 현재 기준 숫자

2026-04-25 21:55 KST 기준 result report의 숫자다. 다음 Green Lane read-only sprint에서 최신값으로 갱신한다.

| 항목 | 값 |
|---|---:|
| Google Ads 광고비 | 25,610,287원 |
| Google Ads `Conv. value` | 129,954,697원 |
| Google Ads `All conv. value` | 214,724,902원 |
| Google Ads platform ROAS | 5.07x |
| 내부 confirmed 매출 | 7,582,720원 |
| 내부 confirmed ROAS | 0.30x |
| Primary NPay label 전환값 | 129,954,631원 |
| Secondary NPay label All conv. value | 81,758,081원 |

## 작업 순서

1. [[harness/gdn/CONTEXT_PACK|CONTEXT_PACK]]에서 source/window/freshness를 확인한다.
2. [[harness/gdn/RULES|RULES]]에서 ROAS와 전환 액션 분류 기준을 확인한다.
3. tracking/GTM 작업이면 최신 live tracking inventory와 GTM live version을 확인한다.
4. read-only query 또는 dry-run을 실행한다.
5. 결과를 `gdn/*.md` 또는 `data/google-ads-*.md` 형태로 저장한다.
6. [[harness/gdn/VERIFY|VERIFY]]를 실행한다.
7. [[harness/gdn/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST]]로 verdict를 낸다.
8. 새 예외는 [[harness/gdn/LESSONS|LESSONS]]에 남긴다.
9. `gdn/!gdnplan.md`의 다음 할 일과 freshness를 갱신한다.

## 현재 판단

GDN 하네스는 Green Lane 자동화 효과가 크다.

Google Ads API와 내부 attribution 원장은 read-only로 충분히 비교할 수 있다. 반면 실제 전환 액션 변경과 Google Ads conversion upload는 Red Lane이다. 따라서 이 하네스의 첫 목적은 실행 자동화가 아니라, 잘못된 전환 신호를 안전하게 식별하고 승인 가능한 조치안으로 좁히는 것이다.
