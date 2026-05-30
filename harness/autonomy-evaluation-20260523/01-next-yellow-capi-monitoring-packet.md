작성 시각: 2026-05-23 23:08 KST
기준일: 2026-05-23
문서 성격: 다음 실제 Yellow 작업 적용 패킷

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
    - capivm/!capiplan.md
    - project/!indicatoragent.md
  lane: Yellow
  allowed_actions_after_approval:
    - pre_snapshot
    - file_backup
    - scoped_vm_cloud_or_frontend_deploy
    - build_or_typecheck
    - restart_or_reload_if_needed
    - api_smoke
    - local_browser_smoke
    - rollback_ready
    - final_report
  forbidden_actions_even_after_yellow_approval:
    - meta_google_tiktok_naver_conversion_send_or_upload
    - production_db_write
    - vm_cloud_schema_migration
    - gtm_production_publish
    - imweb_header_footer_body_save
    - permanent_env_on
    - actual_payment_test
    - raw_identifier_output
  source_window_freshness_confidence:
    source: local_repo_docs_and_current_yellow_lane_policy
    window: next SEO Growth Data Yellow work after 2026-05-23
    freshness: 2026-05-23 23:08 KST
    confidence: 0.88
```

# 다음 실제 Yellow 작업 패킷

## 사람 말 요약

다음 Yellow 작업은 **CAPI 안정화 감시와 선행지표/보고서 화면을 운영에 반영하는 되돌릴 수 있는 배포**로 잡는다.

여기서 CAPI는 Meta에 구매 신호를 보내는 서버 통로다. 선행지표는 구매 전에 어떤 행동이 매출을 예고하는지 보는 분석 화면이다.

이 작업은 운영 화면이나 VM Cloud 서비스에 반영될 수 있으므로 Green이 아니다. 다만 외부 전환 전송, 운영DB write, GTM publish, Imweb 저장을 하지 않으면 Yellow로 관리할 수 있다.

## 왜 이 작업이 다음 Yellow 후보인가

1. Purchase CAPI 자체는 회복됐고, 지금 중요한 것은 **누락 큐와 이벤트 매칭 품질이 계속 정상인지 매일 확인하는 것**이다.
2. 선행지표 에이전트는 로컬/문서 단계에서 끝나면 사업 의사결정에 못 쓰고, 운영 화면/API로 읽혀야 한다.
3. 이 둘은 운영 반영이 필요하지만 rollback이 가능하다.

## 작업 범위

### 대상 서비스

- VM Cloud backend 또는 frontend 중 다음 요청에서 명시된 대상.
- 로컬 SEO frontend `7010` 화면.
- 필요 시 Slack daily monitoring cron. 단, Slack 실제 발송은 테스트 채널/승인된 채널과 빈도가 고정되어야 한다.

### 바꾸는 파일 예시

실제 Yellow 요청이 들어오면 아래 중 필요한 파일만 좁게 고른다.

- `backend/src/...`
- `frontend/src/app/ai-crm/...`
- `scripts/meta-capi-daily-missing-queue-monitor.sh`
- `scripts/leading-indicators-restart-alert.sh`
- `harness/autonomy-evaluation-20260523/...`

### 실행할 수 있는 명령

- `npm run build`
- `npm run lint` 또는 대상 파일 ESLint
- `curl http://127.0.0.1:<port>/<path>`
- VM Cloud health check
- pm2 restart 또는 reload. 단, 승인된 서비스만.

### 실행하지 않을 일

- Meta CAPI 실제 전송 또는 backfill.
- Google Ads, GA4, TikTok, Naver 전환 업로드.
- 운영DB write/import.
- GTM Production publish.
- Imweb 저장.
- raw 식별자 출력.

## 사전 스냅샷과 백업

실제 Yellow 배포 전에는 반드시 아래를 채운다.

```text
pre-snapshot:
- git status:
- target service status:
- health endpoint:
- current response sample:

backup:
- backup path:
- files copied:
- restore command:
```

## 적용 순서

1. 대상 파일과 성공 기준을 이 패킷에 좁게 채운다.
2. pre-snapshot을 남긴다.
3. 파일 백업을 만든다.
4. 코드 또는 설정을 반영한다.
5. build/typecheck를 실행한다.
6. 필요한 서비스만 restart/reload한다.
7. API smoke와 화면 smoke를 한다.
8. rollback 명령을 실제로 실행하지는 않되, 실행 가능한 상태로 보고서에 남긴다.
9. source/window/freshness/confidence를 붙여 결과를 보고한다.

## 성공 기준

실제 작업별 숫자는 달라질 수 있지만 최소 기준은 아래다.

- health check 200.
- 대상 URL 또는 API 200.
- 화면 문구가 업데이트되거나 API 필드가 응답에 포함된다.
- 외부 전환 send/upload 0.
- 운영DB write 0.
- GTM publish 0.
- Imweb save 0.
- raw identifier output 0.
- rollback path가 명시된다.

## 실패 기준과 rollback

아래 중 하나면 rollback 또는 중단한다.

- health check 실패.
- build/typecheck 실패.
- API 500 지속.
- 응답 시간이 기존 대비 과도하게 증가.
- 승인 범위 밖 파일 변경 필요.
- 외부 전송/운영DB write/GTM publish/Imweb 저장이 필요해짐.

rollback은 실제 작업 때 아래 형식으로 고정한다.

```text
rollback:
- command:
- expected result:
- post-rollback smoke:
```

## 승인 문구

실제 Yellow 작업을 실행할 때 TJ님이 승인할 문구는 아래처럼 좁게 쓴다.

```text
[승인] SEO Growth Data <작업명> Yellow Lane 진행.
범위: <대상 파일/서비스/cron>만.
허용: backup, build/typecheck, restart/reload, API smoke, 화면 smoke, rollback 준비.
금지: 외부 전환 send/upload, 운영DB write, GTM publish, Imweb 저장, raw id 출력.
성공 기준: health 200, 대상 URL/API 200, 외부 send/write/publish 0, rollback path 기록.
```

## 현재 상태

이 문서는 실제 Yellow 작업에 템플릿을 적용한 **준비 패킷**이다.

아직 실행한 운영 배포, restart, cron 변경, 외부 전송은 없다.
