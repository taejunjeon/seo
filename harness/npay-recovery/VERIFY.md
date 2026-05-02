# NPay Recovery Verify

작성 시각: 2026-05-01 00:20 KST
최종 업데이트: 2026-05-02 01:15 KST
상태: v0 기준판
목적: NPay recovery 작업 후 반드시 확인할 검증 명령과 결과 기준을 고정한다
관련 문서: [[harness/npay-recovery/README|NPay Recovery Harness]], [[harness/npay-recovery/RULES|Rules]], [[harness/npay-recovery/AUDITOR_CHECKLIST|Auditor Checklist]]

## 10초 요약

검증의 목표는 "맞게 보인다"가 아니라 "금지된 일이 없었고, 숫자와 문서가 같은 기준을 보고 있다"를 확인하는 것이다.

기본 검증은 네 가지다. 변경 파일 확인, no-send 확인, no-write 확인, 문서 링크/숫자 확인.

## 공통 검증

모든 작업 후 실행한다.

```bash
git status --short
git diff --name-only
```

확인 기준:

1. 이번 작업과 무관한 파일이 staged/commit 대상에 섞이지 않았다.
2. 사용자나 다른 agent가 만든 dirty file을 되돌리지 않았다.
3. 하네스 문서 작업이면 변경 파일은 `harness/npay-recovery/*`와 관련 문서만이다.

## 문서 링크 검증

Obsidian wiki 링크가 있는 문서는 저장 전 검증한다.

```bash
python3 scripts/validate_wiki_links.py harness/npay-recovery/README.md
python3 scripts/validate_wiki_links.py harness/npay-recovery/TASK.md
python3 scripts/validate_wiki_links.py harness/npay-recovery/CONTEXT_PACK.md
python3 scripts/validate_wiki_links.py harness/npay-recovery/RULES.md
python3 scripts/validate_wiki_links.py harness/npay-recovery/VERIFY.md
python3 scripts/validate_wiki_links.py harness/npay-recovery/APPROVAL_GATES.md
python3 scripts/validate_wiki_links.py harness/npay-recovery/AUDITOR_CHECKLIST.md
python3 scripts/validate_wiki_links.py harness/npay-recovery/LESSONS.md
python3 scripts/validate_wiki_links.py harness/npay-recovery/LESSONS_TO_RULES_SCHEMA.md
python3 scripts/validate_wiki_links.py harness/npay-recovery/EVAL_LOG_SCHEMA.md
```

성공 기준:

- wiki 링크 전부 실제 문서 또는 헤딩과 매치.
- GitHub 스타일 앵커 없음.
- `<a id>` 태그 없음.

## No-send 검증

코드나 리포트 작업 후 실제 전송 호출이 없는지 확인한다.

```bash
rg -n "mp/collect|debug/mp/collect|Measurement Protocol|sendGa4|facebook|CAPI|CompletePayment|Google Ads|conversion upload|googleads|tiktok|events_api" backend naver harness
```

해석:

- 단순 문서 언급은 OK.
- 실제 전송 함수 호출, endpoint 호출, token 사용 코드가 새로 추가됐으면 승인 범위를 확인한다.
- 승인 없는 실제 전송이면 hard fail이다.

위 `rg`는 일부러 넓게 잡는 1차 검사라 false positive가 많을 수 있다. 최종 판단은 "문서 언급"과 "실행 가능한 새 전송 경로"를 분리한다.

변경된 코드 파일만 좁혀 보려면 먼저 아래로 staged/changed code file을 확인한다.

```bash
git diff --name-only -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.py'
git diff --cached --name-only -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.py'
```

그 다음 변경된 코드 파일에 한해 전송 경로를 확인한다.

```bash
git diff -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.py' | \
  rg -n "mp/collect|debug/mp/collect|sendGa4|facebook|CAPI|CompletePayment|conversion upload|googleads|events_api"
```

보고서에는 아래 3줄을 반드시 남긴다.

```text
No-send grep matched docs only: YES/NO
New executable send path added: YES/NO
Actual network send observed: YES/NO
```

판정 기준:

| 항목 | PASS |
|---|---|
| `No-send grep matched docs only` | 문서 언급만 있으면 YES |
| `New executable send path added` | 새 실행 코드가 없으면 NO |
| `Actual network send observed` | 승인 없는 실제 호출이 없으면 NO |

## Biocom Preview No-send Scan

바이오컴 wrapper/eid/NPay preview 작업은 `no-send`, `no-write`, `no-pixel-send`가 기본이다.

코드나 snippet 후보가 생긴 경우 먼저 변경 파일을 좁힌다.

```bash
git diff --name-only -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.py' '*.html'
git diff --cached --name-only -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.py' '*.html'
```

변경된 코드 또는 snippet 후보에 아래 호출이 있으면 hard fail이다.

| 금지 호출 | hard fail 기준 |
|---|---|
| `fetch` | preview가 외부 endpoint를 호출할 수 있음 |
| `navigator.sendBeacon` | unload/send 계열 전송 가능 |
| `XMLHttpRequest` | 직접 HTTP 전송 가능 |
| `gtag(` | GA4/Google Ads 전송 가능 |
| `fbq(` | Meta Pixel 전송 가능 |
| `ttq.` | TikTok Pixel 전송 가능 |

검사 예시:

```bash
git diff -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.py' '*.html' | \
  rg -n "fetch\\(|navigator\\.sendBeacon|XMLHttpRequest|gtag\\(|fbq\\(|ttq\\."
```

endpoint denylist도 send path에 있으면 hard fail이다.

| endpoint denylist | 이유 |
|---|---|
| `/api/attribution/npay-intent` | 기존 live NPay intent DB write 가능 |
| `/checkout-context` | checkout attribution write 가능 |
| `/payment-success` | payment success attribution write 가능 |
| `/payment-decision` | Purchase Guard decision path 영향 가능 |
| `/tiktok-pixel-event` | TikTok Guard event log write 가능 |

검사 예시:

```bash
git diff -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.py' '*.html' | \
  rg -n "/api/attribution/npay-intent|/checkout-context|/payment-success|/payment-decision|/tiktok-pixel-event"
```

문서-only 작업에서는 위 문자열이 문서에 설명으로 등장할 수 있다. 최종 판정은 아래처럼 분리한다.

```text
Biocom preview no-send scan executed: YES/NO
Docs-only mentions: YES/NO
New executable send path added: YES/NO
Endpoint denylist found in executable send path: YES/NO
```

PASS 기준:

| 항목 | PASS |
|---|---|
| `Docs-only mentions` | 문서 설명이면 YES |
| `New executable send path added` | 새 실행 코드가 없으면 NO |
| `Endpoint denylist found in executable send path` | send path에 없으면 NO |

## No-write 검증

운영 DB write나 match_status 변경이 없는지 확인한다.

```bash
rg -n "UPDATE|INSERT|DELETE|match_status|send_candidate|dispatch_log|npay_recovery_ga4_purchase" backend naver harness
```

해석:

- dry-run preview나 문서 예시는 OK.
- 운영 DB에 쓰는 코드가 추가됐으면 승인 범위를 확인한다.
- 승인 없는 운영 DB write는 hard fail이다.

## Dry-run 검증

NPay dry-run을 실행할 때는 실제 전송 없이 report만 만든다.

예시:

```bash
cd backend
NPAY_INTENT_DB_PATH=/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3 \
npm exec tsx scripts/npay-roas-dry-run.ts -- \
  --start=2026-04-27T09:10:00.000Z \
  --end=2026-05-04T09:10:00.000Z \
  --format=markdown
```

성공 기준:

1. matched/ambiguous/purchase_without_intent/clicked_no_purchase가 분리된다.
2. A급/B급 기준이 [[harness/npay-recovery/RULES|RULES]]와 일치한다.
3. `already_in_ga4=unknown/present`는 전송 후보가 아니다.
4. `send_candidate`와 `block_reason`이 모두 나온다.
5. 실제 전송은 없다.

## BigQuery Guard 검증

order_number와 channel_order_no를 둘 다 조회한다.

필수 확인 범위:

- `ecommerce.transaction_id`
- `event_params.transaction_id`
- event_params 전체 value
- string/int/double/float value
- `events_*`
- 가능하면 `events_intraday_*`

성공 기준:

1. 둘 중 하나라도 있으면 `already_in_ga4=present`.
2. 둘 다 robust 범위에서 없으면 `robust_absent`.
3. 조회 권한이나 table freshness가 부족하면 `unknown`.

biocom read-only guard 자동 실행:

```bash
cd backend
npm exec tsx scripts/npay-ga4-robust-guard.ts -- \
  --ids-file=/tmp/biocom-npay-lookup-ids.txt \
  --start-suffix=YYYYMMDD \
  --end-suffix=YYYYMMDD \
  --output=/tmp/biocom-npay-ga4-robust-guard.json
```

이 스크립트는 GA4/Google Ads/Meta/TikTok 전송을 하지 않는다. BigQuery `jobs.query`만 사용하며, 권한이 없으면 `ok=false`, `unknown=<id count>`로 종료한다.

## 더클린커피 Read-only 검증

더클린커피 작업은 먼저 freshness를 확인한다.

```bash
cd backend
npm exec tsx scripts/check-source-freshness.ts -- --json
```

성공 기준:

| source | 기준 |
|---|---|
| `ga4_bigquery_thecleancoffee` | latest daily table age 48h 이하 |
| local Imweb/Toss | stale이면 primary 사용 금지 |
| operational Postgres | watch 상태면 source/freshness 명시 |

더클린커피 BigQuery 기준:

- project: `project-dadba7dd-0229-4ff6-81c`
- dataset: `analytics_326949178`
- site: `thecleancoffee`

## Auditor 검증

작업 종료 전 [[harness/npay-recovery/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST]]를 적용한다.

보고 형식:

```text
Auditor verdict: PASS | PASS_WITH_NOTES | FAIL_BLOCKED | NEEDS_HUMAN_APPROVAL
Phase: harness_v0_docs | read_only | dispatcher_dry_run | approval_draft | limited_send | post_send_verification
No-send verified: YES/NO
No-write verified: YES/NO
No-deploy verified: YES/NO
Candidate guard verified: YES/NO
Numbers current: YES/NO
Unrelated dirty files excluded: YES/NO
No-send grep matched docs only: YES/NO
New executable send path added: YES/NO
Actual network send observed: YES/NO
Notes:
- ...
```

## v0 완료 기준

하네스 v0 문서 작업은 아래를 만족하면 완료다.

1. `TASK.md`, `CONTEXT_PACK.md`, `RULES.md`, `VERIFY.md`, `APPROVAL_GATES.md`, `EVAL_LOG_SCHEMA.md`, `LESSONS.md`가 있다.
2. README가 위 파일들을 연결한다.
3. Auditor checklist가 NPay와 더클린커피 확장 체크를 포함한다.
4. wiki link 검증이 통과한다.
5. 이번 변경에 운영 전송, DB write, 배포가 없다.
