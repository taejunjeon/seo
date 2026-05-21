작성 시각: 2026-05-21 11:36 KST
기준일: 2026-05-21
문서 성격: 바이오컴 Meta CAPI 고객 식별자 보강 canary 승인안 최종본

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - gptconfirm/gpt0521-7-emq-no-send-payload-preview/00-result-report.md
    - gptconfirm/gpt0521-2-emq-local-patch/00-result-report.md
    - gptconfirm/gpt0521-3-event-id-raw-guard-deploy/00-result-report.md
  lane: Red
  allowed_actions_after_explicit_approval:
    - enable biocom Purchase CAPI identity enrichment canary
    - send hashed ph and site-scoped external_id only for confirmed Purchase CAPI
    - monitor 24h then continue if no stop criteria
  forbidden_actions:
    - bulk backfill
    - Browser Purchase fallback
    - event_id hashing ON
    - GTM publish
    - operating DB write/import
    - raw identifier output
    - thecleancoffee identity enrichment during biocom canary
  source_window_freshness_confidence:
    source: VM Cloud SQLite + VM Cloud meta-capi-sends.jsonl no-send preview
    window: 24h and 7d
    freshness: preview generated 2026-05-21 11:18 KST
    confidence: high for canary readiness, medium for final EMQ uplift timing
```

## 10초 요약

바이오컴 Purchase CAPI에 고객 식별자 보강을 24시간 canary로 켜는 승인안을 최종화했다.

이번 canary는 실제 결제완료 Purchase에만 `ph`와 `external_id`를 추가한다. 이메일은 이번 범위에서 제외한다. event_id는 바꾸지 않는다.

문제 없으면 24시간 후에도 계속 유지한다. 문제가 있으면 먼저 원인을 조사하고, 중단이 맞는 경우에만 TJ님에게 중단 제안을 올린다.

## 최종 판정

진행 추천: 92%.

이유는 세 가지다.

1. 최근 24시간 바이오컴 confirmed 후보 40/40건에서 `ph`와 `external_id` 후보가 모두 잡힌다.
2. 현재 Purchase CAPI에는 `em/ph/external_id`가 0건이라 개선 여지가 명확하다.
3. Server CAPI Purchase는 살아 있고, failed/duplicate 문제가 preview 기준에서 보이지 않는다.

## 필수 조건

로컬 코드에 `META_CAPI_IDENTITY_ENRICHMENT_SITE_ALLOWLIST` 보강을 추가했다.

따라서 VM Cloud에 이 패치를 배포한 뒤 아래처럼 설정하면 바이오컴만 canary를 켤 수 있다.

```text
META_CAPI_ENABLE_IMWEB_PHONE_HASH=true
META_CAPI_ENABLE_MEMBER_EXTERNAL_ID=true
META_CAPI_EXTERNAL_ID_SECRET=<already-provisioned-secret>
META_CAPI_IDENTITY_ENRICHMENT_SITE_ALLOWLIST=biocom
META_CAPI_ENABLE_EVENT_ID_HASH=false
```

allowlist가 비어 있으면 기존 동작을 유지한다. allowlist에 `biocom`만 넣으면 더클린커피는 이번 canary 범위에서 제외된다.

## 하지 않은 것

- 실제 Meta CAPI 추가 고객 식별자 전송: 0
- VM Cloud env 변경: 0
- VM Cloud deploy/restart: 0
- 운영DB write/import: 0
- GTM publish: 0
- Browser Purchase 변경: 0
- raw identifier 출력: 0

## 확인하면 좋은 문서

1. [[01-canary-approval-packet]] — 실제 canary 승인 범위와 중단 기준.
2. [[02-runbook-and-monitoring]] — 켜는 순서, 24시간 관찰, 지속 조건.
3. `gptconfirm/gpt0521-7-emq-no-send-payload-preview/payload-preview.json` — raw 없이 저장된 preview 원본.
