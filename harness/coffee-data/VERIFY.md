# Coffee Data Verify

작성 시각: 2026-05-01 15:23 KST  
상태: v0 기준판  
목적: 더클린커피 정합성 작업 종료 전 실행할 검증 절차를 고정한다  
관련 문서: [[harness/coffee-data/README|Coffee Data Harness]], [[harness/coffee-data/RULES|Coffee Rules]], [[harness/coffee-data/AUDITOR_CHECKLIST|Coffee Auditor Checklist]]

## 10초 요약

검증은 네 가지다.

1. 문서 링크가 깨지지 않았는가.
2. 코드가 있다면 typecheck가 통과했는가.
3. no-send/no-write/no-deploy가 지켜졌는가.
4. 이번 커밋에 unrelated dirty file이 섞이지 않았는가.

## 문서 링크 검증

```bash
python3 scripts/validate_wiki_links.py \
  harness/coffee-data/README.md \
  harness/coffee-data/CONTEXT_PACK.md \
  harness/coffee-data/RULES.md \
  harness/coffee-data/VERIFY.md \
  harness/coffee-data/AUDITOR_CHECKLIST.md \
  harness/coffee-data/EVAL_LOG_SCHEMA.md \
  data/!coffeedata.md
```

## Typecheck

backend script를 수정했다면 실행한다.

```bash
cd backend
npm exec tsc -- --noEmit
```

## Diff Check

```bash
git diff --check -- \
  harness/coffee-data \
  data/!coffeedata.md \
  data/coffee-*.md \
  backend/scripts/coffee-*.ts
```

## No-send 검사

문서 언급과 실행 가능한 신규 전송 경로를 분리한다.

```bash
rg -n "mp/collect|debug/mp/collect|sendGa4|facebook|CAPI|CompletePayment|Google Ads|conversion upload|googleads|tiktok|events_api" \
  backend/scripts backend/src harness/coffee-data data/!coffeedata.md
```

보고 형식:

```text
No-send grep matched docs only: YES/NO
New executable send path added: YES/NO
Actual network send observed: YES/NO
```

PASS 기준:

1. 문서에서 금지선이나 예시로 언급된 것은 허용한다.
2. 새 실행 코드에서 GA4/Meta/TikTok/Google Ads 전송 경로가 생기면 FAIL이다.
3. 실제 네트워크 전송이 관찰되면 FAIL이다.

## No-write 검사

```bash
rg -n "UPDATE|INSERT|DELETE|CREATE TABLE|ALTER TABLE|DROP TABLE|COPY|match_status|send_candidate|dispatch_log" \
  backend/scripts backend/src harness/coffee-data data/!coffeedata.md
```

PASS 기준:

1. 문서/스키마 설명은 허용한다.
2. 운영 DB write 코드가 새로 생기면 FAIL이다.
3. Excel actual import apply 경로가 새로 생기면 FAIL이다.

## Dirty File 검사

```bash
git status --short
git diff --name-only
git diff --cached --name-only
```

PASS 기준:

1. 이번 작업 파일만 staged다.
2. TikTok/BigQuery/이미지 등 unrelated dirty file은 커밋에서 제외한다.
3. 삭제 파일이 있으면 이번 작업과 직접 관련이 있는지 확인한다.

## Report 숫자 검사

`data/!coffeedata.md`와 최신 report 숫자가 맞는지 확인한다.

| metric | 기준 report |
|---|---|
| Imweb orders | `coffee-imweb-operational-readonly-20260501.md` |
| Imweb NPay actual | `coffee-imweb-operational-readonly-20260501.md` |
| GA4 purchases | `coffee-ga4-baseline-20260501.md` |
| one-to-one assigned | `coffee-imweb-operational-readonly-20260501.md` |
| unassigned actual | `coffee-imweb-operational-readonly-20260501.md` |
| robust_absent | `coffee-npay-unassigned-ga4-guard-20260501.md` |

## Auditor Helper

수동 검사를 줄이고 싶을 때 아래 helper를 쓴다.

```bash
python3 scripts/coffee_harness_audit.py
```

주의:

- 이 스크립트는 read-only다.
- changed coffee/harness 관련 파일만 검사한다.
- unrelated dirty file은 존재할 수 있지만, staged에 섞이면 fail로 본다.
- 문서 안의 전송 금지 문구는 허용하고, executable code의 새 전송 패턴을 fail로 본다.

## Auditor Verdict 형식

최종 보고에는 아래를 붙인다.

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_harness_v0_docs | coffee_read_only | coffee_npay_matching | coffee_excel_dry_run
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
Candidate guard verified: YES/N/A
Numbers current: YES/NEEDS_CHECK
Unrelated dirty files excluded: YES
Notes:
- 실제 전송/DB write/GTM publish 없음.
```
