작성 시각: 2026-05-23 15:35 KST
기준일: 2026-05-23
문서 성격: Standing Authorization Map / Codex 상시 실행 권한 지도

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/0522.md
    - harness/autonomy-first-harness-opinion-20260521.md
  required_context_docs:
    - AGENTS.md
    - docurule.md
    - frontrule.md
  lane: Green
  allowed_actions:
    - documentation
    - authorization_policy_mapping
    - approval_packet_design
    - local_validation
  forbidden_actions:
    - production_db_write
    - vm_cloud_db_write
    - backend_deploy_or_restart
    - gtm_publish
    - imweb_header_footer_save
    - platform_conversion_send_or_upload
    - destructive_git_or_file_operation
  source_window_freshness_confidence:
    source: local_repo_harness_docs_and_current_project_rules
    window: standing policy as of 2026-05-23
    freshness: 2026-05-23 15:35 KST
    confidence: 0.93
```

# Standing Authorization Map

## 10초 요약

이 문서는 Codex가 **묻지 않고 바로 해도 되는 일**, **한 번 승인받으면 끝까지 진행해도 되는 일**, **반드시 TJ님 앞에서 멈춰야 하는 일**을 고정한다.

핵심은 간단하다.

- **Green Lane**: 돈, 외부 플랫폼, 운영 DB, 운영 배포를 건드리지 않는 일은 Codex가 바로 진행한다.
- **Yellow Lane**: 되돌릴 수 있는 운영 반영은 승인 1번으로 backup, apply, smoke, rollback 준비, 보고까지 끝낸다.
- **Red Lane**: 광고 플랫폼 전송, GTM 운영 publish, 운영 DB write, 실제 결제 테스트처럼 되돌리기 어렵거나 돈/계정/고객 데이터에 영향을 주는 일은 반드시 멈춘다.

## 왜 필요한가

지금까지 CAPI, GA4, GTM, ROAS, 선행지표 작업은 속도보다 “컨펌이 필요한지 아닌지”를 매번 다시 판단하느라 느려졌다.

이 문서의 목적은 컨펌을 없애는 것이 아니다. **위험하지 않은 작업은 컨펌 없이 빨리 끝내고, 진짜 위험한 작업만 TJ님이 보게 만드는 것**이다.

## 성공 기준

- Codex가 Green Lane 작업을 승인 대기 없이 끝까지 진행한다.
- Yellow Lane은 승인 1번으로 배포, 검증, rollback 준비, 보고까지 닫는다.
- Red Lane은 실행 전 반드시 멈추고, 승인 요청에는 화면/설정/효과/안 바꾸면 남는 문제/성공 기준/rollback을 포함한다.
- raw order/payment/member/click id는 대화, 보고서, git, Slack에 출력하지 않는다.
- HOLD가 생기면 바로 승인 대기로 넘기지 않고 원인을 먼저 분류한다.

## Lane 정의

### Green Lane

**뜻**: 실제 운영 상태를 바꾸지 않고, 외부 플랫폼에 전송하지 않으며, 데이터는 읽기 전용으로만 보는 작업이다.

Codex는 Green Lane을 묻지 않고 진행한다. 중간에 막혀도 먼저 원인을 분류하고, 가능한 read-only 조사나 dry-run을 계속한다.

예시:

- 문서 작성, 문서 최신화, runbook 작성.
- VM Cloud, 운영 DB, 로컬 DB, GA4 BigQuery, Meta/Google API read-only 조회.
- 로그 확인, API read-only smoke.
- dry-run, no-send preview, no-write simulation.
- 로컬 코드 수정, 로컬 테스트, typecheck, build.
- 프론트 로컬 화면 확인.
- 승인안 작성.
- scoped commit 준비와 사용자가 요청한 범위의 commit/push.

### Yellow Lane

**뜻**: 운영에 반영되지만 되돌릴 수 있고, 범위가 제한된 작업이다.

Yellow는 “승인 1번”으로 진행한다. 승인 후에는 Codex가 backup, apply, restart, smoke, rollback 준비, cleanup, report까지 이어서 닫는다.

예시:

- VM Cloud backend/frontend 배포와 restart.
- 제한된 env flag ON/OFF.
- 2시간 또는 24시간 controlled smoke.
- Slack daily monitoring cron 설치.
- GTM Preview workspace 수정 또는 테스트. 단, Production publish는 Red.
- 운영 프론트 화면 배포. 단, 외부 플랫폼 전송을 켜지 않는 경우.

### Red Lane

**뜻**: 돈, 광고 플랫폼, 고객 데이터, 운영 DB, 실제 결제, 되돌리기 어려운 설정에 직접 영향을 주는 작업이다.

Red는 명시 승인 전 실행하지 않는다. 단, 승인안 작성, read-only 검증, no-send preview는 Green으로 계속 진행한다.

예시:

- Meta/Google/Naver/TikTok 실제 전환 send, upload, backfill.
- GTM Production publish.
- Imweb header/footer/body 저장.
- 운영 DB write/import/schema migration.
- permanent env ON.
- 실제 결제 테스트.
- 대량 자동 dispatcher.
- 새 광고 계정 생성, 두 번째 Pixel 운영 삽입.
- raw identifier 원문 조회가 필요한 secure evidence 작업.

## Standing Authorization Table

| 작업 영역 | Codex 기본 권한 | Lane | 멈추는 기준 |
|---|---:|---|---|
| 문서/로드맵/보고서 | 바로 작성·수정 가능 | Green | 운영 실행을 지시하는 문구가 실제 자동 실행으로 연결될 때 |
| read-only 데이터 조회 | 바로 진행 가능 | Green | raw id 출력이 필요하거나 권한/2FA가 막힐 때 |
| no-send preview | 바로 진행 가능 | Green | 실제 플랫폼 send로 바뀔 때 |
| 로컬 코드/테스트 | 바로 진행 가능 | Green | 운영 배포가 필요해질 때 |
| 로컬 DB write | 백업+dry-run 후 제한적으로 가능 | Green | 운영 DB나 외부 플랫폼과 sync/write가 연결될 때 |
| scoped commit/push | 사용자가 정리/커밋을 요청한 경우 가능 | Green | unrelated destructive cleanup이 필요할 때 |
| VM Cloud 배포/restart | 승인 1번 후 진행 가능 | Yellow | schema migration, external send, permanent env ON이 포함될 때 |
| 프론트 운영 배포 | 승인 1번 후 진행 가능 | Yellow | 광고 플랫폼 전송/운영 설정 변경이 포함될 때 |
| Slack webhook/cron 알림 | 승인 1번 후 진행 가능 | Yellow | secret 노출, 과도한 알림, 운영 write가 포함될 때 |
| GTM Preview workspace | 승인 1번 후 진행 가능 | Yellow | Production publish 단계로 넘어갈 때 |
| Meta/Google 실제 전환 전송 | 멈춤 | Red | TJ님 명시 승인 전 실행 금지 |
| GTM Production publish | 멈춤 | Red | TJ님 명시 승인 전 실행 금지 |
| Imweb header/footer 저장 | 멈춤 | Red | TJ님 명시 승인 전 실행 금지 |
| 운영 DB write/import/schema | 멈춤 | Red | TJ님 명시 승인 전 실행 금지 |
| actual payment test | 멈춤 | Red | TJ님 명시 승인 전 실행 금지 |

## Codex가 묻지 않고 해야 하는 일

아래는 질문하지 말고 진행한다.

1. **근거 찾기**
   - 로컬 문서, 코드, 로그, read-only DB/API에서 근거를 찾는다.
   - 데이터가 없으면 “없다”고 단정하지 않고 source, sync 지연, 필터 불일치, 권한 부족을 분리한다.

2. **dry-run으로 좁히기**
   - 실제 send/write 전에 후보 수, 제외 사유, 예상 payload, 중복 위험을 no-send로 계산한다.
   - 결과는 safe_ref, count, rate, amount bucket 위주로 보고한다.

3. **로컬 패치**
   - 운영 반영 전 로컬 코드와 테스트는 진행한다.
   - 배포가 필요해지면 Yellow 승인안으로 넘긴다.

4. **문서 최신화**
   - capivm, report, project 문서가 오래되면 최신 source/window/freshness/confidence를 붙여 갱신한다.
   - 사람이 이해하기 어려운 기술어는 괄호로 풀이한다.

5. **HOLD 원인 분류**
   - HOLD를 최종 답으로 쓰지 않는다.
   - 접근 권한, 계정/2FA, 데이터 부족, source_freshness_gap, verification_gap, missing_bridge, 기술 실패, 사업 판단 필요 중 하나로 분류한다.

## Codex가 반드시 멈춰야 하는 일

아래는 사전 승인 없이 실행하지 않는다.

1. 광고 플랫폼에 실제 전환을 보내는 일.
2. 운영 DB에 쓰는 일.
3. GTM Production publish.
4. Imweb header/footer/body 저장.
5. permanent env ON.
6. 실제 결제 테스트.
7. raw identifier 원문을 보고서/대화/git/Slack에 출력해야 하는 일.
8. rollback이 불명확한 운영 변경.

## Yellow 승인 패킷 표준

Yellow 작업은 아래 항목을 갖추면 승인 1번으로 끝까지 진행한다.

실제 승인안은 `harness/yellow-lane-deploy-packet-template-20260523.md`를 기본 양식으로 사용한다. 이 양식은 모든 프로젝트를 같은 방식으로 만들기 위한 문서가 아니라, 백업, 검증, rollback, 금지선처럼 빠지면 위험한 공통 안전 절차를 고정하기 위한 문서다.

```text
[승인] <작업명> Yellow 진행

범위:
- 바꾸는 파일/서비스:
- 허용되는 명령:
- 허용되지 않는 일:

사전 백업:
- backup path:
- pre-snapshot:

실행:
- build/typecheck:
- deploy/restart:
- health check:

성공 기준:
- API/status:
- 화면/로그:
- 데이터 숫자:

rollback:
- rollback command/path:
- rollback 기준:

보고:
- source/window/freshness/confidence:
- 외부 send/write/publish 여부:
```

## Red 승인 패킷 표준

Red 작업은 승인 문구를 좁게 쓴다. “전체 허용”이 아니라 대상과 최대 횟수를 고정한다.

예시:

```text
[Red 승인] biocom confirmed Purchase safe_ref N건만 Meta CAPI backfill 전송.
조건: confirmed, value guard pass, duplicate 0, canceled/refunded 0, 다른 row send 0.
raw id 출력 금지.
```

## 프로젝트별 기본 분류

### CAPI / Meta Purchase

- confirmed Purchase 누락 큐 집계: Green.
- 이벤트 매칭 품질 audit: Green.
- no-send payload preview: Green.
- VM Cloud CAPI gate 패치 로컬 구현: Green.
- VM Cloud 배포/restart: Yellow.
- Meta CAPI 실제 send/backfill: Red.
- Browser Purchase 운영 fallback: Red.

### 중간 전환 CAPI

- Meta 표준 이벤트와 비표준 이벤트 분류: Green.
- InitiateCheckout/AddPaymentInfo 후보 no-send preview: Green.
- Browser Pixel과 서버 CAPI 중복 위험 audit: Green.
- 서버 CAPI test-only 전송: Yellow 또는 Red. 운영 이벤트와 섞이면 Red.
- 운영 ON: Red.

### 선행지표 에이전트

- buyer/leaver cohort dry-run: Green.
- GA4 BigQuery read-only join: Green.
- 로컬 endpoint skeleton: Green.
- VM Cloud endpoint 배포: Yellow.
- raw-id Plan B secure evidence 조회: Red.

### GTM / Imweb

- GTM 문서화와 Preview 체크리스트: Green.
- GTM Preview workspace 테스트: Yellow.
- GTM Production publish: Red.
- Imweb 교체 코드 초안 작성: Green.
- Imweb 실제 저장: Red.

### ROAS / 광고비

- Meta/Google Ads read-only spend/ROAS 조회: Green.
- 플랫폼 주장 ROAS와 내부 confirmed ROAS 비교: Green.
- 대시보드 로컬/운영 프론트 패치: Green 또는 Yellow.
- 광고 예산/캠페인 변경: Red.

## Slack 알림 기준

Slack 알림은 “보고서 대체”가 아니라 “사람이 바로 조치해야 할 때만 울리는 경보”로 쓴다.

보내도 되는 알림:

- confirmed Purchase 누락 큐가 임계값을 넘음.
- CAPI failed 또는 duplicate 발생.
- 이벤트 매칭 품질 canary가 악화됨.
- ROAS source freshness가 끊김.
- precompute cron 실패.

보내지 말아야 하는 알림:

- 단순 작업 완료.
- 변경 파일 없음.
- 조사 중간 로그.
- raw identifier가 포함될 수 있는 내용.

Slack webhook 설치와 cron 전환은 Yellow다. 실제 전환 send나 운영 DB write와 연결되면 Red다.

## raw identifier 정책

아래 값은 보고서, 대화, Slack, git에 원문 출력하지 않는다.

- order_code, order_no, payment_code, payment_key.
- member id, phone, email.
- gclid, gbraid, wbraid, fbclid, fbc/fbp 원문.
- transaction_id 원문.
- GA4 user_pseudo_id, client_id, ga_session_id 원문.

대신 아래 방식으로 보고한다.

- safe_ref.
- hash prefix.
- present/absent.
- count/rate/amount bucket.
- source/window/freshness/confidence.

## HOLD 처리 기준

HOLD가 나오면 아래 순서로 처리한다.

1. 무엇이 막혔는지 분류한다.
2. Codex가 대신 할 수 있는 read-only/dry-run/로컬 테스트를 먼저 수행한다.
3. 그래도 남는 것만 TJ님에게 넘긴다.

분류:

- 접근 권한.
- 계정/2FA.
- 브라우저/CORS.
- 데이터 부족.
- source_freshness_gap.
- verification_gap.
- missing_bridge.
- 기술 실패.
- 사업 판단 필요.
- Red 승인 필요.

## 현재 적용 상태

- 이 문서는 Green Lane 문서 작업이다.
- 운영 DB write 없음.
- VM Cloud write 없음.
- backend deploy/restart 없음.
- GTM publish 없음.
- Imweb 저장 없음.
- Meta/Google/TikTok/Naver send 없음.
- Slack send 없음.

## 실제 적용 기록 — 2026-05-23 23:08 KST

Standing Authorization Map을 다음 실제 작업에 바로 쓰도록 한 번 적용했다.

적용한 것:

- 다음 실제 Yellow 후보를 `CAPI 안정화 감시 + 선행지표/보고서 운영 반영`으로 좁혔다.
- Yellow 승인 패킷에 범위, 허용 명령, 금지선, 사전 백업, 적용 순서, 성공 기준, rollback 기준을 채웠다.
- 이 창과 SEO 프로젝트의 다른 창이 24시간/48시간 뒤 같은 기준으로 평가받을 수 있도록 평가 폴더를 만들었다.
- 다른 창이 남길 작업 메모 양식을 만들었다.

생성 위치:

- 평가 폴더: `harness/autonomy-evaluation-20260523/`
- 다음 Yellow 적용 패킷: `harness/autonomy-evaluation-20260523/01-next-yellow-capi-monitoring-packet.md`
- 다른 창 기록 양식: `harness/autonomy-evaluation-20260523/window-note-template.md`

이번 적용의 Lane:

- Lane: Green.
- 운영 영향: 0.
- 외부 전송: 0.
- VM Cloud deploy/restart/write: 0.
- GTM/Imweb 변경: 0.
- raw identifier output: 0.

하루이틀 뒤 평가 기준:

- 24시간 뒤: `harness/autonomy-evaluation-20260523/03-day1-evaluation-template.md`.
- 48시간 뒤: `harness/autonomy-evaluation-20260523/04-day2-evaluation-template.md`.

## 다음 업데이트 기준

이 문서는 아래 상황에서 갱신한다.

1. 같은 승인 질문이 3번 이상 반복될 때.
2. Green으로 처리해도 될 일이 Yellow/Red로 과도하게 묶였을 때.
3. Yellow 승인 후에도 중간 컨펌이 반복될 때.
4. Red Lane을 더 좁히거나 넓혀야 하는 사고/실험 결과가 생겼을 때.
5. 새로운 외부 플랫폼 또는 운영 DB write 경로가 생겼을 때.
