작성 시각: 2026-05-23 22:50 KST
기준일: 2026-05-23
문서 성격: Yellow Lane 배포 패킷 템플릿 / 운영 반영 승인안 작성 기준

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/standing-authorization-map-20260523.md
  required_context_docs:
    - AGENTS.md
    - docurule.md
    - frontrule.md
  lane: Green
  allowed_actions:
    - documentation
    - approval_packet_template_design
    - local_validation
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
    window: standing policy as of 2026-05-23
    freshness: 2026-05-23 22:50 KST
    confidence: 0.92
```

# Yellow Lane 배포 패킷 템플릿

## 10초 요약

Yellow Lane 배포 패킷은 **되돌릴 수 있는 운영 반영을 승인 1번으로 끝까지 진행하기 위한 양식**이다.

모든 프로젝트를 똑같이 만들자는 뜻이 아니다. 공통으로 빠지면 위험한 절차인 백업, 빌드, 재시작, 확인, rollback을 고정하고, 실제 성공 기준은 프로젝트마다 다르게 채우는 방식이다.

이 템플릿 자체는 문서 작업이므로 Green Lane이다. 이 템플릿을 실제 VM Cloud 배포, 프론트 운영 배포, cron ON에 적용하는 순간은 Yellow Lane이며, 명시 승인 후 진행한다.

## 이 템플릿이 필요한 이유

TJ님이 매번 확인해야 했던 질문은 대부분 아래 5개였다.

1. 무엇을 바꾸는가.
2. 바꾸면 무엇이 좋아지는가.
3. 실패하면 어떻게 되돌리는가.
4. 성공 여부를 어떤 숫자나 화면으로 확인하는가.
5. 외부 플랫폼 전송이나 운영DB write가 섞였는가.

Yellow 패킷은 이 질문을 배포 전에 한 장으로 닫는다. 그래서 승인 이후에는 Codex가 중간 확인 없이 backup, 적용, restart, smoke, rollback 준비, 보고까지 이어갈 수 있다.

## 언제 쓰는가

아래 조건을 모두 만족하면 이 템플릿을 쓴다.

- 운영에 반영된다.
- 실패해도 rollback이 가능하다.
- 작업 범위가 파일, 서비스, 환경변수, cron 중 좁은 범위로 고정된다.
- 외부 광고 플랫폼 전송, GTM Production publish, Imweb 저장, 운영DB write가 없다.
- 성공 기준을 API 상태, 화면 문구, 로그, 숫자 중 하나 이상으로 확인할 수 있다.

예시:

- VM Cloud backend route 배포와 `seo-backend` restart.
- 프론트엔드 화면 운영 반영.
- Slack daily monitoring cron 설치.
- controlled smoke를 위한 제한적 env flag ON.

## 언제 쓰면 안 되는가

아래 중 하나라도 포함되면 Yellow가 아니라 Red 또는 HOLD다.

- Meta, Google, TikTok, Naver에 실제 전환을 보낸다.
- GTM Production publish를 한다.
- Imweb header, footer, body 코드를 저장한다.
- 운영DB write, import, schema migration이 있다.
- actual payment test가 필요하다.
- raw order, payment, member, click id 원문을 보고서나 Slack에 출력해야 한다.
- rollback 명령이나 성공 기준이 없다.

## Yellow 패킷 작성 양식

아래 블록을 그대로 복사해 프로젝트별 값만 채운다.

```text
[승인 요청] <프로젝트명> <작업명> Yellow Lane 진행

1. 사람 말 요약
- 무엇을 바꾸는가:
- 왜 바꾸는가:
- 바뀌면 TJ님이 체감하는 효과:
- 안 바꾸면 남는 문제:

2. 작업 범위
- 대상 서비스:
- 바꾸는 파일:
- 실행할 명령:
- 실행하지 않을 일:

3. 사전 스냅샷과 백업
- 현재 상태 확인:
- 백업 경로:
- 백업 확인 방법:

4. 적용 순서
- 코드/파일 반영:
- build/typecheck:
- restart 또는 reload:
- health check:

5. 성공 기준
- API 기준:
- 화면 기준:
- 로그 기준:
- 숫자 기준:
- 외부 send/write/publish 여부:

6. 실패 기준과 rollback
- rollback을 시작할 조건:
- rollback 명령:
- rollback 후 확인:

7. 보고 방식
- source:
- window:
- freshness:
- confidence:
- 남은 리스크:
- 다음 행동:
```

## 프로젝트별 성공 기준 예시

### CAPI backend 배포

사람 말 요약:

> 실제 결제완료 주문만 Meta Purchase 후보로 남기는 서버 로직을 운영 서버에 반영한다.

성공 기준:

- `/api/health` 200.
- confirmed Purchase 후보 수가 줄거나 늘어난 이유가 설명 가능하다.
- duplicate event_id 0.
- payment_page_seen이 Purchase 후보로 들어가지 않는다.
- Meta 실제 send는 이번 배포에 포함하지 않으면 0이다.

### 프론트엔드 보고서 배포

사람 말 요약:

> 운영자가 숫자를 보고 바로 판단할 수 있게 설명 문구와 카드 구조를 바꾼다.

성공 기준:

- 대상 URL 200.
- 첫 화면에서 “무엇을 봐야 하는지”가 보인다.
- 어려운 용어는 괄호로 풀이된다.
- API 요청이 무한 반복되지 않는다.
- 외부 플랫폼 전송 0.

### Slack daily monitoring cron

사람 말 요약:

> 매일 아침 confirmed Purchase 누락 큐와 전날 ROAS 상태를 Slack으로 알려준다.

성공 기준:

- 지정 채널에 테스트 메시지 1건만 도착한다.
- cron 로그에 성공 기록이 남는다.
- secret이 git, 보고서, Slack 본문에 출력되지 않는다.
- 실패해도 서비스 재시작 루프를 만들지 않는다.

### Leading indicators API

사람 말 요약:

> 구매자와 결제 중단자의 행동 차이를 매일 계산해 프론트에서 빠르게 읽게 한다.

성공 기준:

- 응답은 aggregate-only다. 개별 주문/회원/클릭 원문이 없다.
- confirmed_buyer, checkout_non_buyer, ga4_purchase_conflict, pending_payment_success가 분리된다.
- cache hit 500ms 이하를 목표로 한다.
- VM Cloud write 또는 외부 send 0.

## 승인 문구 예시

좁게 승인한다.

```text
[승인] <프로젝트명> <작업명> Yellow Lane 진행.
범위: <파일/서비스/cron>만.
허용: backup, build/typecheck, restart, API smoke, rollback 준비.
금지: 외부 전환 send, 운영DB write, GTM publish, Imweb 저장, raw id 출력.
성공 기준: <숫자/API/화면 기준>.
```

## 사용 전 체크리스트

- [ ] 사람 말 요약이 있다.
- [ ] 바꾸는 파일과 서비스가 고정됐다.
- [ ] 실행하지 않을 일이 명시됐다.
- [ ] backup path가 있다.
- [ ] build/typecheck 또는 대체 검증이 있다.
- [ ] health check URL 또는 화면 확인 기준이 있다.
- [ ] rollback 명령이 있다.
- [ ] 외부 send/write/publish 0 여부를 보고할 수 있다.
- [ ] raw identifier 출력 0을 지킬 수 있다.

## 사용 후 보고 양식

```text
한 줄 결론:

완료한 것:
-

하지 않은 것:
-

검증 결과:
-

현재 영향/서버·커밋 상태:
-

남은 리스크:
-

다음 할일:
-
```
