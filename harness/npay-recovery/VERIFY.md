# NPay Recovery Verify

작성 시각: 2026-05-01 00:20 KST  
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
Phase: read_only | dispatcher_dry_run | approval_draft | limited_send | post_send_verification
No-send verified: YES/NO
No-write verified: YES/NO
Candidate guard verified: YES/NO
Numbers current: YES/NO
Unrelated dirty files excluded: YES/NO
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
