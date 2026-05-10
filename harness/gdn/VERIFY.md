# GDN Verify

작성 시각: 2026-05-03 22:25 KST
상태: v0 기준판
목적: Google Ads/GDN ROAS 정합성 작업 후 실행할 검증 절차를 고정한다
관련 문서: [[harness/gdn/README|GDN Harness]], [[harness/gdn/RULES|GDN Rules]], [[harness/gdn/AUDITOR_CHECKLIST|GDN Auditor Checklist]]

## 10초 요약

검증 목표는 네 가지다.

1. 금지된 전송/변경이 없었는가.
2. 문서 링크와 숫자가 같은 source/window를 보고 있는가.
3. Google Ads 플랫폼 값과 내부 confirmed 값이 분리되어 있는가.
4. unrelated dirty file이 작업 범위에 섞이지 않았는가.

## 공통 검증

모든 작업 후 실행한다.

```bash
git status --short
git diff --name-only
```

확인 기준:

1. 이번 작업과 무관한 파일이 staged/commit 대상에 섞이지 않았다.
2. 사용자나 다른 agent의 dirty file을 되돌리지 않았다.
3. 하네스 문서 작업이면 변경 파일은 `harness/gdn/*`와 `gdn/!gdnplan.md` 등 직접 관련 문서만이다.

## 문서 링크 검증

Obsidian wiki 링크가 있는 문서는 저장 전 검증한다.

```bash
python3 scripts/validate_wiki_links.py \
  harness/gdn/README.md \
  harness/gdn/CONTEXT_PACK.md \
  harness/gdn/RULES.md \
  harness/gdn/VERIFY.md \
  harness/gdn/APPROVAL_GATES.md \
  harness/gdn/AUDITOR_CHECKLIST.md \
  harness/gdn/EVAL_LOG_SCHEMA.md \
  harness/gdn/LESSONS.md \
  gdn/!gdnplan.md
```

성공 기준:

- wiki 링크가 실제 문서 또는 헤딩과 매치한다.
- GitHub 스타일 앵커를 새로 만들지 않는다.
- `<a id>` 태그를 새로 만들지 않는다.

## No-send 검사

Google Ads, GA4, Meta, TikTok 전송 경로가 새로 생기지 않았는지 확인한다.

```bash
git diff -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.py' '*.html' | \
  rg -n "conversion upload|ConversionUploadService|ConversionAdjustmentUploadService|googleAds:mutate|mp/collect|debug/mp/collect|facebook|CAPI|CompletePayment|events_api|gtag\\(|fbq\\(|ttq\\."
```

보고 형식:

```text
No-send grep matched docs only: YES/NO
New executable send path added: YES/NO
Actual network send observed: YES/NO
```

PASS 기준:

| 항목 | PASS |
|---|---|
| `No-send grep matched docs only` | 문서 언급만 있으면 YES |
| `New executable send path added` | 새 실행 코드가 없으면 NO |
| `Actual network send observed` | 승인 없는 실제 호출이 없으면 NO |

## No-write 검사

운영 DB write, Google Ads mutate, GTM publish, env 변경이 없는지 확인한다.

```bash
git diff -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.py' '*.html' '*.md' | \
  rg -n "UPDATE|INSERT|DELETE|ALTER TABLE|DROP TABLE|googleAds:mutate|customers/.+:mutate|conversionActions:mutate|publish|quick_preview|\\.env|PRODUCTION_MODE|ENFORCE_LIVE"
```

해석:

- 문서에서 금지선으로 언급된 것은 OK.
- 실행 가능한 write/mutate/publish/deploy 코드가 새로 추가되면 승인 범위를 확인한다.
- 승인 없는 운영 write 또는 Google Ads mutate는 hard fail이다.

## Google Ads Read-only 검증

Google Ads read-only 재조회가 가능한 경우 아래 endpoint 또는 script를 사용한다.

```bash
curl "http://localhost:7020/api/google-ads/dashboard?date_preset=last_30d"
```

또는 backend route가 아닌 script를 만들었다면 `mode=read_only` 또는 `dry_run`이 명시되어야 한다.

성공 기준:

1. `customer_id`가 `2149990943` 또는 명시 입력값이다.
2. `conversion_action` 목록이 포함된다.
3. `segments.conversion_action`별 metrics가 포함된다.
4. `Conv. value`와 `All conv. value`가 분리된다.
5. fetchedAt, date range, timezone, confidence가 기록된다.

## Internal ROAS 검증

내부 원장을 조회했다면 결과에 아래가 있어야 한다.

| 항목 | 필수 |
|---|---|
| source | TJ 관리 Attribution VM 또는 명시 fallback |
| window | KST start/end |
| latestLoggedAt | 있음 |
| confirmed/pending/canceled | 분리 |
| Google evidence tier | high/medium/low/unknown |
| campaign id coverage | 있음 |

로컬 개발 DB만 사용한 경우 `confidence=low` 또는 `fallback`으로 표기한다.

## HOLD Reducer 검증

결과가 HOLD이면 승인 대기로 넘기기 전에 Green follow-up을 수행했는지 확인한다.

| 항목 | PASS 기준 |
|---|---|
| hold_reason_category | missing_click_bridge / ambiguous_candidates / blocked_access 등 원인 category가 있음 |
| auto_green_followups_done | read-only 재조회, dry-run, source audit, fixture, 문서 보강 중 수행한 항목이 있음 |
| remaining_blocker | 남은 blocker가 Yellow / Red / 권한 / 데이터 부족 / 시간 대기 중 무엇인지 명시됨 |
| TJ님 할 일 | Green Lane으로 가능한 일이 TJ님 할 일로 넘어가지 않음 |
| next_lane | 다음 액션이 Green / Yellow / Red 중 어디인지 명확함 |

보고 형식:

```text
HOLD reducer:
- hold_reason_category:
- auto_green_followups_done:
- remaining_blocker:
- green_work_left_for_codex:
- tj_action_required:
- next_lane:
```

## GTM / Tracking 검증

tracking 경로 판단이 있으면 아래를 확인한다.

```bash
rg -n "r0vuCKvy-8caEJixj5EB|3yjICOXRmJccEJixj5EB|AW-304339096" gtmaudit footer GA4 gdn
```

성공 기준:

1. 최신 live GTM version 또는 snapshot 시각을 기록한다.
2. snapshot이 7일 이상 stale이면 tracking 결론을 내리지 않는다.
3. label이 어떤 tag/trigger/footer code에서 나오는지 구분한다.

## GTM Workspace Lifecycle 검증

GTM Preview, GTM workspace, Tag Assistant 작업이 있으면 아래를 확인한다.

| 항목 | PASS 기준 |
|---|---|
| Default Workspace | 사용하지 않음 |
| fresh workspace | live latest 기준으로 새 workspace 생성 |
| capacity preflight | Preview 전 workspace count와 충돌 가능성 확인 |
| old workspace cleanup | cleanup 전 JSON backup 존재 |
| live version | cleanup 후 live version unchanged |
| submit/create_version/publish | 승인 전 0회 |
| VM Cloud write flag | fresh workspace 확보 전 ON 아님 |
| Preview 해석 | Production publish 승인으로 해석하지 않음 |

보고 형식:

```text
GTM workspace lifecycle:
- default_workspace_used: YES/NO
- fresh_workspace_created: YES/NO
- workspace_capacity_preflight: PASS/HOLD/FAIL
- backup_before_cleanup: YES/NO/N/A
- live_version_unchanged: YES/NO
- submit_create_version_publish_count: 0
- vm_cloud_write_flag_on_after_workspace_ready: YES/NO/N/A
```

## Auditor Verdict 형식

```text
Auditor verdict: PASS | PASS_WITH_NOTES | FAIL_BLOCKED | NEEDS_HUMAN_APPROVAL
Project: gdn
Phase:
Lane:
Mode:
No-send verified:
No-write verified:
No-deploy verified:
No-publish verified:
No-platform-send verified:
Source / window / freshness:
Changed files:
Validation:
Next actions:
```
