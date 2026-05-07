# AI OS Agent 구현 계획 정본

작성 시각: 2026-05-07 14:25 KST
최신 업데이트: 2026-05-07 20:50 KST
기준일: 2026-05-07
상태: active canonical
Owner: agent / aios
Supersedes: none
Next document: paid_click_intent 24h/72h 모니터링 결과 또는 Google tag gateway POC 후속
Do not use for: 무승인 운영 배포, 플랫폼 전송, 운영 DB write, GTM publish, 광고 예산/캠페인 변경

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - agent/!aiosagent.md
    - total/!total-current.md
    - data/!coffeedata.md
    - harness/!harness.md
  lane: Green agent 설계 + no-send/no-write automation plan
  allowed_actions:
    - agent 역할 설계
    - 기존 read-only/dry-run script 실행 계획 작성
    - 결과 JSON/YAML/Markdown 산출물 계약 작성
    - 승인 큐와 stale 문서 audit 설계
  forbidden_actions:
    - 운영 DB write 자동화
    - platform send 자동화
    - GTM publish 자동화
    - 광고 예산/캠페인 변경 자동화
    - 운영 backend deploy 자동화
  source_window_freshness_confidence:
    source: "agent/!aiosagent.md + total/!total-current.md + data/!coffeedata.md + 현재 scripts"
    window: "2026-05-07 KST"
    freshness: "현재 repo 기준 구현 가능한 agent만 추림"
    confidence: 0.88
```

## 10초 결론

AI OS Agent는 외부 플랫폼을 마음대로 바꾸는 자동 실행자가 아니다.

지금 구현할 1차 agent는 **read-only 관측, dry-run 진단, 승인 큐 정리, 결과 문서 작성, 실패 지점 분해를 자동화하는 운영 보조 시스템**이다. 이 단계만으로도 TJ님이 매번 같은 로그와 문서를 직접 뒤지는 시간을 줄이고, Codex가 Green Lane 작업을 더 자율적으로 밀 수 있다.

현재 v0 구현은 `aios-agent-runner.ts`와 npm script로 완료됐다. `PaidClickIntentMonitorAgent`, `CoffeeDataAgent`, `CampaignMappingAgent`, `ApprovalQueueAgent`, `ReportAuditorAgent`, `ConfirmedPurchasePrepAgent` 6개 모두 Green Lane으로 실제 실행했고, 결과 JSON/Markdown을 생성했다. 본 sprint(2026-05-07 20:13~20:50 KST)에서는 ReportAuditor와 ConfirmedPurchasePrep을 runner에 연결하고, ApprovalQueue parser의 stale approval(open 1, unknown 2) false positive를 제거했다.

## Phase-Sprint 요약표

실제 구현 순서 기준이다.

| Priority | Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|---|
| P0 | Phase0 | [[#Phase0-Sprint0]] | Agent 공통 계약 | Codex | 100% / 100% | [[#Phase0-Sprint0\|이동]] |
| P0 | Phase1 | [[#Phase1-Sprint1]] | Paid click intent 관측 agent | Codex | 100% / 100% | [[#Phase1-Sprint1\|이동]] |
| P0 | Phase2 | [[#Phase2-Sprint2]] | Coffee 데이터 관측 agent | Codex | 100% / 100% | [[#Phase2-Sprint2\|이동]] |
| P1 | Phase3 | [[#Phase3-Sprint3]] | 캠페인 맵핑 agent | Codex | 100% / 100% | [[#Phase3-Sprint3\|이동]] |
| P1 | Phase4 | [[#Phase4-Sprint4]] | 승인 큐 agent | Codex | 100% / 100% | [[#Phase4-Sprint4\|이동]] |
| P2 | Phase5 | [[#Phase5-Sprint5]] | source freshness / report audit agent | Codex | 100% / 100% | [[#Phase5-Sprint5\|이동]] |
| P2 | Phase6 | [[#Phase6-Sprint6]] | confirmed purchase 준비 agent | Codex | 100% / 100% | [[#Phase6-Sprint6\|이동]] |

## 다음 할일

이 표에는 아직 완료되지 않은 실제 작업만 둔다. agent 아이디어 설명은 각 Sprint 상세에 있고, 다음 할일은 구현·검증·문서화가 필요한 작업만 남긴다.

|  순서 | Phase/Sprint        | 상태                | 담당    | 할 일                                                 | 왜 하는가                                                                    | 어떻게 하는가                                                                                                     | 의존성                                           | 상세                                              | 컨펌 필요 |
| --: | ------------------- | ----------------- | ----- | --------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | ----- |
|   1 | [[#Phase1-Sprint1]] | scheduled 재실행 대기  | Codex | PaidClickIntentMonitorAgent를 24h/72h window에서 재실행한다 | immediate smoke는 통과했지만, 운영 publish/수집 이후 24h/72h 상태를 봐야 실제 안정성을 판단할 수 있다 | `npm --prefix backend run agent:paid-click-intent -- --window=24h`처럼 window를 바꿔 실행하고 결과를 비교한다               | 시간 의존. 2026-05-08 00:02 KST 이후 24h, 2026-05-10 00:02 KST 이후 72h | [[paid-click-intent-monitor-agent-v0-20260507]] | NO    |
|   2 | [[#Phase2-Sprint2]] | 18:00 cron 이후 재실행 | Codex | CoffeeDataAgent를 KST 18:00 cron 이후 재실행한다            | Coffee A-5/A-6 최신 cron 산출물로 closure와 A-6 후보를 다시 판정해야 한다                  | `npm --prefix backend run agent:coffee-data`를 재실행하고 `data/!coffeedata.md`와 A-6 dry-run 결과를 갱신한다             | 시간 의존. 현재 crontab 기준 KST 18:00 산출물 이후 가장 정확하다 | [[coffee-data-agent-v0-20260507]]               | NO    |
|   3 | [[#Phase6-Sprint6]] | scheduled 재실행 대기  | Codex | ConfirmedPurchasePrepAgent를 paid_click_intent 24h/72h PASS 후 재실행 | click id 보존률이 개선됐는지 missing_google_click_id 변화로 확인 | `npm --prefix backend run agent:confirmed-purchase-prep`을 재실행 | 1번 PASS 의존 | [[#Phase6-Sprint6]] | NO |
|   4 | 신규 | POC 조사 완료 / 활성화 보류 | TJ + Codex | Google tag gateway 활성화 옵션 결정 (Imweb native / Cloudflare 도입 / 자체 custom) | Google 측정 신호 회복 후보. 단 본 프로젝트 핵심 정합성 병목은 직접 해결하지 않음 | [[../GA4/google-tag-gateway-poc-approval-20260507]] §6 결정 사항 표 따라 옵션 확정 후 활성화 승인 | P0 paid_click_intent 24h/72h PASS 후 | [[../GA4/google-tag-gateway-poc-approval-20260507]] | YES, 활성화 시 |

## 구현 원칙

1. Green Lane은 agent가 자동 실행해도 된다.
2. Yellow Lane은 이미 승인된 범위만 실행한다.
3. Red Lane은 승인 문서와 실행 전 체크리스트까지만 만든다.
4. 모든 agent는 결과를 사람이 읽는 Markdown과 기계가 읽는 JSON/YAML로 남긴다.
5. 모든 숫자는 `source`, `window`, `freshness`, `confidence`를 같이 기록한다.
6. agent가 실패하면 “안 됨”이 아니라 `권한`, `데이터`, `API`, `CORS`, `schema`, `stale source`, `승인 필요` 중 어디서 막혔는지 분류한다.
7. agent는 원문 secret, access token, 구매자 개인정보, 원장 raw payload를 문서나 로그에 남기지 않는다.

## Active Action Board

| Priority | Status | Phase/Sprint | 작업 | 왜 하는가 | 다음 액션 | 담당 | 승인 필요 | Source |
|---|---|---|---|---|---|---|---|---|
| P0 | completed | Phase0-Sprint0 | Agent 공통 계약 | 각 agent가 같은 출력/금지선/실패 분류를 써야 한다 | 완료. 다음은 wrapper 구현 | Codex | NO | [[aios-agent-runner-contract-20260507]] |
| P0 | completed | Phase1-Sprint1 | PaidClickIntentMonitorAgent v0 | Mode B 이후 24h/72h 결과를 자동 수집해야 한다 | v0 구현/실행 완료. 다음은 24h/72h window 재실행 | Codex | NO | [[paid-click-intent-monitor-agent-v0-20260507]] |
| P0 | completed | Phase2-Sprint2 | CoffeeDataAgent v0 | Coffee A-5/A-6 상태를 반복 점검해야 한다 | v0 구현/실행 완료. 다음은 KST 18:00 cron 이후 재실행 | Codex | NO | [[coffee-data-agent-v0-20260507]] |
| P1 | completed | Phase4-Sprint4 | ApprovalQueueAgent v0 | TJ님 승인 부담을 줄여야 한다 | v0 구현/실행 완료. 현재 open approval 0건 | Codex | NO | [[approval-queue-agent-v0-20260507]] |
| P1 | completed | Phase3-Sprint3 | CampaignMappingAgent v0 | Growth CSV 확인 질문을 자동 축약해야 한다 | v0 구현/실행 완료. split_required 6건 분리 | Codex | NO | [[campaign-mapping-agent-v0-20260507]] |
| P1 | completed | Phase5-Sprint5 | ReportAuditorAgent v0 | agent 산출물 증가로 stale 링크와 endpoint 혼동을 막아야 한다 | v0 구현/실행 완료. drift false positive filter 보강 | Codex | NO | [[report-auditor-agent-v0-20260507]] |
| P1 | completed | Phase6-Sprint6 | ConfirmedPurchasePrepAgent v0 | confirmed purchase 후보와 block reason을 표준화해야 한다 | v0 구현/실행 완료. 운영 결제완료 623건 prep, send_candidate 0 유지 | Codex | NO | [[confirmed-purchase-prep-agent-v0-20260507]] |

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-05-07 01:52 KST | 1차 agent 후보 정리 | SourceFreshness, PaidClickIntentMonitor, CampaignMapping, ConfirmedPurchasePrep, ApprovalQueue, ReportAuditor, CoffeeData 후보를 분리했다 |
| 2026-05-07 01:52 KST | 재사용 가능 script 조사 | paid click intent, campaign mapping, confirmed purchase prep, coffee monitoring/A-6 dry-run script 후보를 확인했다 |
| 2026-05-07 14:25 KST | docurule 기반 정본 재작성 | 실제 구현 순서, 다음 할일, 역할 구분, 보류 항목을 분리했다 |
| 2026-05-07 14:58 KST | Agent v0 계약 5개 작성 | runner, paid click intent monitor, coffee data, approval queue, campaign mapping 계약 문서를 작성했다 |
| 2026-05-07 15:20 KST | Agent runner v0 구현 | `backend/scripts/aios-agent-runner.ts`와 `npm run agent:*` 명령을 추가했다 |
| 2026-05-07 15:41 KST | Agent output schema 보강 | 운영 write와 로컬 산출물 생성을 `would_operational_write=false`, `writes_local_artifacts=true`로 분리했다 |
| 2026-05-07 15:41 KST | PaidClickIntentMonitorAgent 실행 | 7개 smoke pass, 실패 0, no-write/no-platform-send violation 0 |
| 2026-05-07 15:41 KST | CoffeeDataAgent 실행 | A-5 `closure-ready`, A-6 real row 6건, join 가능 후보 4건 유지. 숫자 필드는 number로 출력 |
| 2026-05-07 15:41 KST | CampaignMappingAgent 실행 | Growth CSV 기준 split_required 6건, precision_loss_review 2건, mapped_manual 1건, excluded 1건 분리. 그로스파트 질문 3개 생성 |
| 2026-05-07 15:41 KST | ApprovalQueueAgent 실행 | scanned files 10개, open approval 0건, future Red approval 5건과 재개 조건 분리 |
| 2026-05-07 20:13 KST | ReportAuditorAgent v0 구현/실행 | runner에 audit wrapper 연결. validate_wiki_links/harness-preflight/git diff/stale endpoint scan 4종 child run |
| 2026-05-07 20:13 KST | ConfirmedPurchasePrepAgent v0 runner 연결/실행 | 운영 결제완료 623건 (homepage 586, NPay 37) prep. 623 read_only_phase, 618 missing_google_click_id, send_candidate 0 |
| 2026-05-07 20:36 KST | ApprovalQueue parser 보강 | open 1 (VM ledger source recovery deploy)·unknown 2 (gtm-preview, receiver-access) 모두 closed로 재분류. closed 6, future 5, open 0, unknown 0 |
| 2026-05-07 20:36 KST | ReportAuditor drift filter 보강 | yaml 리스트 항목/Red Lane 분류표/access log 통계 false positive 6건 모두 제거. ReportAuditorAgent status pass |
| 2026-05-07 20:45 KST | Google tag gateway POC 조사 및 승인안 작성 | biocom·coffee 모두 AWS CloudFront 위(Imweb 자사몰) 확인. Cloudflare wizard 즉시 적용 불가. 활성화 옵션 A/B/C 분리 |
| 2026-05-07 21:19~21:20 KST | PaidClickIntent receiver 502 transient 실증 (30 calls) | missing_click_id 3/5 502 burst (3초 폭, 직전·직후 정상). 21:05 monitoring 502도 같은 burst 패턴으로 추정. backend persistent regression 없음 |
| 2026-05-07 21:22 KST | 3개 agent sanity rerun (정본 변경 후) | ReportAuditor pass / drift 0, ApprovalQueue closed 6 future 5 open 0, CampaignMapping pass / 질문 3개 유지 |
| 2026-05-07 21:33~21:46 KST | 운영 VM SSH read-only 직접 조사 + 502 burst correlation confirmed | seo-backend PM2 30초 주기 restart, heap 94.7% at 12s uptime, 본 agent bounded probe 110 calls 5건 502 (4.5%) 모두 PM2 restart 1~2초 window 매칭. confirmed_pm2_restart_burst. minimal ledger write 4가지 선행 blocker 추가 |
| 2026-05-07 21:42 KST | backend errorHandler payload hardening 로컬 patch | PayloadTooLargeError를 status code(413/400) 그대로 응답하도록 가드 추가. typecheck PASS. 운영 deploy 별도 승인안 작성 |

## Parked / Later

| 항목 | 보류 이유 | 재개 조건 |
|---|---|---|
| agent가 Red Lane을 직접 실행 | 운영 DB write, 플랫폼 전송, GTM publish는 사람 승인 전 자동화하면 위험하다 | TJ님 승인 후에도 실행 runner는 별도 gate와 rollback을 갖춘 뒤 검토 |
| Telegram/Slack 자동 알림 | 프로젝트별로 알림 피로도가 다르다 | TJ님이 해당 프로젝트에서 “알림 보내”라고 명시하거나 알림 정책이 정해질 때 |
| 광고 예산/캠페인 변경 agent | 돈과 플랫폼 학습에 직접 영향이 있다 | read-only recommendation agent가 충분히 안정된 뒤 별도 Red 승인 |
| 운영 backend deploy agent | 배포 실패 시 서비스 영향이 있다 | deployment runbook, rollback, health smoke가 프로젝트별로 고정된 뒤 |

## Phase0-Sprint0

**이름**: Agent 공통 계약

[[#Phase-Sprint 요약표|▲ 요약표로]]

### 목표

모든 agent가 같은 방식으로 실행되고, 같은 방식으로 결과를 남기게 만든다.

### 쉬운 설명

지금은 Codex가 스크립트와 문서를 직접 찾아서 실행한다. Agent 공통 계약은 이 과정을 “정해진 입력을 넣으면 정해진 결과 문서와 JSON이 나오는 형태”로 고정하는 작업이다.

### 역할 구분

- TJ: 실행 주기와 알림 기본값만 결정한다. 지금 단계에서는 필수 승인 없음.
- Codex: runner contract, 출력 schema, 실패 분류, 금지선 문서를 만든다.
- Claude Code: 해당 없음. 추후 agent 결과를 화면화할 때 참여한다.

### 완료한 것

- agent 후보와 우선순위를 정했다.
- Red Lane 직접 실행 금지 원칙을 정했다.
- `agent/aios-agent-runner-contract-20260507.md`를 작성했다.
- 공통 출력 필드와 실패 분류를 1차 확정했다.

### 100%까지 남은 것

- 없다. 공통 계약은 v0 기준 완료했다.
- 실제 CLI skeleton은 Phase0 후속 설계로 두고, 먼저 P0 agent wrapper를 구현한다.

## Phase1-Sprint1

**이름**: Paid click intent 관측 agent

[[#Phase-Sprint 요약표|▲ 요약표로]]

### 목표

biocom Google click id 보존 실험에서 서버 수신점과 payload 안전성을 자동 관측한다.

### 쉬운 설명

Google 광고에서 들어온 사용자의 `gclid/gbraid/wbraid`가 랜딩 페이지에서 저장되고, checkout/NPay intent까지 살아남는지 매일 확인하는 agent다. 구매 전송은 하지 않는다.

### 역할 구분

- TJ: Mode B 같은 운영 publish/deploy 승인만 담당한다.
- Codex: monitoring script 실행, 결과 문서 작성, 실패 위치 분류를 자동화한다.
- Claude Code: `/total` 또는 `/ads/google` 화면에 monitoring 결과를 보여줄 때 참여한다.

### 현재 재사용 가능 script

- `backend/scripts/paid-click-intent-monitoring-collect.ts`

### 산출물

- `data/paid-click-intent-monitoring-YYYYMMDD-HHMM.json`
- `gdn/paid-click-intent-post-publish-monitoring-result-YYYYMMDD.md`

### 금지선

- `would_store=true` 금지.
- GA4/Meta/Google Ads 전송 금지.
- 운영 DB/ledger write 금지.
- GTM publish 자동 실행 금지.

### 100%까지 남은 것

- v0 기준 완료했다.
- 다음 운영 작업은 24h/72h window 재실행이다.
- 실패 분류는 현재 child run과 block reason 기준으로 동작한다. 더 세밀한 `receiver`, `CORS`, `payload validation`, `GTM`, `storage`, `approval_required` 구분은 ReportAuditorAgent 또는 v1 고도화에서 확장한다.

## Phase2-Sprint2

**이름**: Coffee 데이터 관측 agent

[[#Phase-Sprint 요약표|▲ 요약표로]]

### 목표

더클린커피 NPay intent, GA4 BigQuery, Imweb API, A-6 dry-run 상태를 주기적으로 정리한다.

### 쉬운 설명

Coffee는 NPay/GA4 정합성을 실험하기 좋은 검증장이다. 이 agent는 A-5 monitoring과 A-6 join dry-run을 묶어서 “지금 외부 전송 dry-run으로 넘어갈 수 있는가”를 자동으로 알려준다.

### 역할 구분

- TJ: cron 시간 변경, VM 배포, 실제 GA4/Meta 전송 승인만 담당한다.
- Codex: read-only monitoring과 dry-run 실행, `data/!coffeedata.md` 업데이트 후보 작성.
- Claude Code: Coffee ROAS 화면이 필요할 때 UI 구현.

### 현재 재사용 가능 script

- `backend/scripts/coffee-npay-intent-monitoring-report.ts`
- `backend/scripts/coffee-a6-ledger-join-dry-run.ts`
- `backend/scripts/coffee-imweb-operational-readonly.ts`

### 산출물

- `data/coffee-npay-intent-monitoring-YYYYMMDD.yaml`
- `data/coffee-a6-ledger-join-dry-run-YYYYMMDD.txt`
- `data/!coffeedata.md` 업데이트 후보

### 금지선

- Coffee GA4 MP send 금지.
- Meta CAPI send 금지.
- VM schema/write enforce 금지.
- GTM publish 금지.

### 100%까지 남은 것

- v0 기준 완료했다.
- 다음 운영 작업은 KST 18:00 cron 산출물 이후 재실행이다.
- v1에서는 A-6 진입 가능 여부를 `ready / wait / blocked`로 더 명확히 출력한다.

## Phase3-Sprint3

**이름**: 캠페인 맵핑 agent

[[#Phase-Sprint 요약표|▲ 요약표로]]

### 목표

그로스파트 CSV/Excel과 로컬 seed를 비교해 Meta campaign mapping 상태를 자동 분류한다.

### 쉬운 설명

사람이 캠페인 맵핑 파일을 주면 agent가 “확정 가능한 것”, “쪼개야 하는 것”, “사람에게 다시 물어봐야 하는 것”을 나눈다. Meta Ads Manager 설정은 바꾸지 않는다.

### 역할 구분

- TJ: 그로스파트에 확인 요청할 질문이 있으면 전달한다.
- Codex: CSV/Excel 파싱, dry-run, `otherpart/!otherpart.md` 질문 축약.
- Claude Code: 캠페인 맵핑 화면이 필요할 때 UI 구현.

### 현재 재사용 가능 script

- `backend/scripts/meta-split-required-dry-run.ts`

### 산출물

- `data/meta-split-required-dry-run-YYYYMMDD.json`
- `meta/campaign-mapping-split-required-dry-run-YYYYMMDD.md`
- `otherpart/!otherpart.md`

### 금지선

- Meta Ads Manager 설정 변경 금지.
- 캠페인 예산/상태 변경 금지.

### 100%까지 남은 것

- v0 기준 완료했다.
- CSV/Excel path 인자 실행이 가능하고, 이번 Growth CSV도 처리했다.
- v1에서는 `otherpart/!otherpart.md` 자동 갱신과 질문 1~3개 축약을 추가한다.

## Phase4-Sprint4

**이름**: 승인 큐 agent

[[#Phase-Sprint 요약표|▲ 요약표로]]

### 목표

TJ님이 지금 승인해야 하는 것과 나중에 승인할 것을 분리한다.

### 쉬운 설명

승인 문서가 많아지면 “그래서 지금 내가 뭘 눌러야 하지?”가 흐려진다. 이 agent는 현재 열려 있는 승인 항목을 1~3개로 줄이고, 나머지는 대기/보류로 분리한다.

### 역할 구분

- TJ: Red/Yellow 승인 여부를 결정한다.
- Codex: 승인 문서 index, 중복 승인 제거, 최신 승인 문구 정리.
- Claude Code: 승인 큐 화면이 필요할 때 UI 구현.

### 입력

- `total/!total-current.md`
- `confirm/!confirm.md`
- `confirm/confirm*.md`
- `gdn/*approval*.md`

### 산출물

- `confirm/!confirm.md`
- 필요 시 `confirmMMDD-N.md`

### 금지선

- 승인 없이 Red 실행 금지.

### 100%까지 남은 것

- v0 기준 완료했다.
- open/future/closed 분리는 동작한다.
- v1에서는 false positive를 줄이기 위해 승인 문서 status keyword와 superseded 규칙을 더 엄격히 한다.

## Phase5-Sprint5

**이름**: source freshness / report audit agent

[[#Phase-Sprint 요약표|▲ 요약표로]]

### 목표

문서 링크, harness preflight, source freshness, endpoint 용어 혼동을 자동 검사한다.

### 쉬운 설명

ROAS 프로젝트는 문서가 많고 source가 많다. 이 agent는 stale 링크, stale source, `paid-click-intent/no-send`와 `confirmed-purchase/no-send` 혼동 같은 문제를 자동으로 잡는다.

### 역할 구분

- TJ: 별도 역할 없음.
- Codex: audit script 실행과 수정 후보 작성.
- Claude Code: 보고서 UI가 필요할 때 참여.

### 현재 재사용 가능 script

- `scripts/validate_wiki_links.py`
- `scripts/harness-preflight-check.py --strict`
- `git diff --check`

### 산출물

- `agent/report-audit-YYYYMMDD.md`
- `data/source-freshness-latest.json`

### 100%까지 남은 것

- v0 기준 완료했다.
- audit 대상은 `agent/!aiosagentplan.md`, `total/!total-current.md`, `GA4/gtm.md`, `gdn/!gdnplan.md`, `gdn/google-ads-vm-ledger-source-recovery-backend-deploy-result-20260507.md` 5개로 시작했다. `--targets` 인자로 변경 가능.
- 검색어는 `paid_click_intent/no-send`·`confirmed_purchase/no-send`·`conversion upload`·`googleAds:mutate`·`operating DB write`·`운영 DB write`·`GTM Production publish` 7종.
- false positive 필터로 yaml 리스트 항목, `Red Lane`/`parked_red`/`보류`/`future Red`/`access log lines` 키워드를 제외한다.
- v1에서는 source freshness report (각 문서 최신 source ts와 cron lag) 추가가 후속 작업이다.

## Phase6-Sprint6

**이름**: confirmed purchase 준비 agent

[[#Phase-Sprint 요약표|▲ 요약표로]]

### 목표

실제 결제완료 주문 중 Google Ads/GA4/Meta에 보낼 수 있는 confirmed purchase 후보를 no-send로 만든다.

### 쉬운 설명

이 agent는 플랫폼에 구매를 보내는 agent가 아니다. 홈페이지 결제완료와 NPay 실제 결제완료만 후보로 남기고, NPay click/count/payment start는 제외하는 no-send 준비 agent다.

### 역할 구분

- TJ: 실제 Google Ads/GA4/Meta 전송 승인만 담당한다.
- Codex: no-send 후보 생성, block reason 분리, 승인안 작성.
- Claude Code: 후보 현황 화면이 필요할 때 참여.

### 현재 재사용 가능 script

- `backend/scripts/google-ads-confirmed-purchase-candidate-prep.ts`

### 산출물

- `data/google-ads-confirmed-purchase-candidate-prep-YYYYMMDD.json`
- `gdn/google-ads-confirmed-purchase-candidate-prep-YYYYMMDD.md`

### 금지선

- Google Ads conversion upload 금지.
- Google Ads conversion action 변경 금지.
- GA4/Meta/Google Ads 전송 금지.

### 100%까지 남은 것

- v0 기준 완료했다.
- homepage 결제완료와 NPay 실제 결제완료만 후보에 남기는 guard 동작 확인. 운영 결제완료 623건 (homepage 586, NPay 37) 처리, send_candidate 0 유지.
- block reason 분리 동작: `read_only_phase`, `approval_required`, `google_ads_conversion_action_not_created`, `conversion_upload_not_approved`, `missing_google_click_id`, `already_in_ga4`, `missing_attribution_vm_evidence`, `npay_intent_*`, `order_has_return_reason`, `canceled_order` 11종.
- `send_candidate=0`이 0인 이유는 `read_only_phase`/`approval_required`/`conversion_action_not_created`/`upload_not_approved`가 모든 후보에 동시 적용되기 때문이다. agent가 이 4개를 항상 같이 출력해 사람이 즉시 파악 가능.
- 다음 운영 작업은 paid_click_intent 24h/72h PASS 후 재실행해 missing_google_click_id 변화만 본다.

## 남은 설계 질문

1. agent 실행 기본값을 `npm script`, `cron`, `launchd`, 수동 Codex 명령 중 어디에 둘지 결정해야 한다.
2. agent 결과를 Telegram/Slack으로 보낼지, 문서만 남길지 프로젝트별 기본값이 필요하다.
3. Red Lane 승인 문서를 agent가 자동 생성해도 되는지, 생성 후 TJ님에게 어떻게 노출할지 정해야 한다.

현재 추천은 `npm script + 문서 생성까지 자동`, `알림은 명시 요청 시`, `Red 실행은 승인 전 금지`다.
