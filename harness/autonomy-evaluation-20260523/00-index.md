작성 시각: 2026-05-23 23:08 KST
기준일: 2026-05-23
문서 성격: Standing Authorization Map 실제 적용 평가 폴더

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/standing-authorization-map-20260523.md
    - harness/yellow-lane-deploy-packet-template-20260523.md
  required_context_docs:
    - AGENTS.md
    - docurule.md
    - frontrule.md
  lane: Green
  allowed_actions:
    - documentation
    - evaluation_folder_setup
    - yellow_packet_application_design
    - no_send_no_write_status_tracking
  forbidden_actions:
    - backend_deploy_or_restart
    - frontend_production_deploy
    - production_db_write
    - vm_cloud_db_write
    - gtm_publish
    - imweb_header_footer_save
    - platform_conversion_send_or_upload
    - permanent_env_on
    - raw_identifier_output
  source_window_freshness_confidence:
    source: local_repo_harness_docs_and_current_project_rules
    window: standing policy application setup as of 2026-05-23
    freshness: 2026-05-23 23:08 KST
    confidence: 0.91
```

# Autonomy Evaluation Folder

## 10초 요약

이 폴더는 **Standing Authorization Map이 실제로 컨펌을 줄이고, 위험한 작업은 멈추게 만들었는지**를 하루이틀 뒤 평가하기 위한 한 곳이다.

이 창뿐 아니라 SEO 프로젝트를 진행하는 다른 Codex/Claude Code 창도, 같은 기준으로 이 폴더에 로그를 남기면 된다.

중요한 한계도 있다. Codex가 다른 대화창의 내용을 자동으로 읽을 수는 없다. 대신 다른 창이 남긴 파일, 커밋, 보고서, 하네스 로그, 배포 패킷을 이 폴더에 복사하거나 링크하면 한 번에 평가할 수 있다.

## 이 폴더가 답해야 하는 질문

1. Green Lane 작업이 실제로 중간 컨펌 없이 끝났는가.
2. Yellow Lane 작업은 승인 1번 후 backup, apply, smoke, rollback 준비, report까지 닫혔는가.
3. Red Lane 작업은 승인 없이 실행되지 않았는가.
4. HOLD가 생겼을 때 `승인 부족`으로 뭉개지 않고 원인이 분류됐는가.
5. 다른 창에서 같은 프로젝트를 진행해도 같은 기준을 썼는가.

## 현재 들어 있는 파일

- `01-next-yellow-capi-monitoring-packet.md`: 다음 실제 Yellow 작업에 Yellow 템플릿을 적용한 승인 패킷.
- `02-standing-map-applied-work-log.md`: 이 요청에 Standing Authorization Map을 실제 적용한 로그.
- `03-day1-evaluation-template.md`: 24시간 뒤 평가용 템플릿.
- `04-day2-evaluation-template.md`: 48시간 뒤 평가용 템플릿.
- `window-note-template.md`: 다른 창이 남길 짧은 작업 메모 양식.

## 다른 창에서 메모를 남기는 방법

다른 창이 SEO 프로젝트 작업을 진행했다면 아래 형식으로 파일을 만든다.

```text
harness/autonomy-evaluation-20260523/window-note-YYYYMMDD-HHMM-<short-topic>.md
```

필수로 적을 내용:

- 작업명
- Lane: Green / Yellow / Red / HOLD
- 실제로 한 일
- 멈춘 일
- 검증
- 남은 리스크
- 다음 행동

raw order/payment/member/click id는 이 폴더에도 출력하지 않는다.

## 24시간 뒤 평가 기준

- Green Lane 자동 진행률: 목표 80% 이상.
- Yellow 재승인 요청 감소: 같은 승인 범위 안에서 중복 승인 요청 0건.
- Red 무승인 실행: 0건.
- HOLD 원인 분류율: 목표 90% 이상.
- 결과 보고에 `source/window/freshness/confidence` 누락: 0건.

## 48시간 뒤 평가 기준

- 같은 질문이 반복된 지점 3개 이하.
- Yellow 패킷을 실제 1개 이상 적용.
- 적용한 Yellow 패킷의 post-check와 rollback 준비 기록 존재.
- 프론트 보고서 또는 정본 문서에 “무엇을/왜/어떻게/다음 행동”이 표시됨.
- 신규 rule로 승격할 candidate 1개 이상 식별.

## 현재 판정

- Lane: Green.
- 운영 영향: 0.
- 외부 전송: 0.
- VM Cloud write/deploy/restart: 0.
- GTM/Imweb 변경: 0.
- 평가 준비 상태: ready.
