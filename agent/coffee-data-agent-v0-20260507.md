# CoffeeDataAgent v0 계약

작성 시각: 2026-05-07 14:45 KST
상태: active design
Owner: agent / coffee-data
Supersedes: none
Next document: Coffee A-5/A-6 monitoring agent result
Do not use for: Coffee GA4 MP 전송, Meta CAPI 전송, VM schema/write enforce, GTM publish

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - agent/aios-agent-runner-contract-20260507.md
    - data/!coffeedata.md
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
  lane: Green read-only monitoring agent design
  allowed_actions:
    - Coffee monitoring read-only 실행 계획
    - A-6 ledger join dry-run 실행 계획
    - 결과 문서 업데이트 후보 작성
  forbidden_actions:
    - Coffee GA4 Measurement Protocol send
    - Meta CAPI send
    - TikTok/Google/Naver platform send
    - 운영 DB/ledger write
    - VM schema/write enforce
    - GTM publish
  source_window_freshness_confidence:
    source: "data/!coffeedata.md + coffee monitoring/A-6 scripts"
    window: "2026-05-07 KST"
    freshness: "A-5 monitoring in progress"
    confidence: 0.87
```

## 10초 결론

CoffeeDataAgent는 더클린커피 NPay 정합성 실험의 반복 관측 agent다.

이 agent는 A-5 monitoring과 A-6 ledger join dry-run을 묶어서 “지금 외부 전송 dry-run으로 넘어갈 수 있는가”를 알려준다. 실제 GA4/Meta 전송은 하지 않는다.

## 재사용 script

```text
backend/scripts/coffee-npay-intent-monitoring-report.ts
backend/scripts/coffee-a6-ledger-join-dry-run.ts
backend/scripts/coffee-imweb-operational-readonly.ts
```

## 실행 순서

1. A-5 monitoring stats를 조회한다.
2. admin token이 있으면 join-report를 조회한다. 없으면 `join_report_skipped`로 표시한다.
3. ledger list를 기준으로 test row와 real row를 분리한다.
4. A-6 join dry-run으로 `imweb_order_code`가 있는 confirmed intent 후보를 계산한다.
5. 결과를 `ready`, `wait`, `blocked`로 분류한다.

## 권장 명령

```bash
cd backend
npx tsx scripts/coffee-npay-intent-monitoring-report.ts \
  --endpoint https://att.ainativeos.net \
  --publish-ts "2026-05-02 15:00" \
  --output ../data/coffee-npay-intent-monitoring-YYYYMMDD.yaml

npx tsx scripts/coffee-a6-ledger-join-dry-run.ts \
  --endpoint https://att.ainativeos.net \
  > ../data/coffee-a6-ledger-join-dry-run-YYYYMMDD.txt
```

## 출력

| 산출물 | 의미 |
|---|---|
| `data/coffee-npay-intent-monitoring-YYYYMMDD.yaml` | A-5 monitoring 결과 |
| `data/coffee-a6-ledger-join-dry-run-YYYYMMDD.txt` | A-6 deterministic join 가능성 |
| `data/!coffeedata.md` 업데이트 후보 | 정본 반영 제안 |

## 판정 기준

| 판정 | 조건 | 의미 |
|---|---|---|
| `ready` | stop_required=false, reject 0, real row 충분, join 가능 후보 존재 | A-6 no-send 승인안 작성 가능 |
| `wait` | 오류는 없지만 real row가 적거나 cron 산출물 대기 | 자연 traffic 또는 다음 cron 대기 |
| `blocked` | reject, PII, invalid origin, schema 문제, endpoint 오류 | A-6 진행 전 수정 필요 |

## 금지선

- GA4 MP purchase 전송 금지.
- Meta CAPI 전송 금지.
- VM schema migration/write enforce 금지.
- GTM publish 금지.

## 다음 구현 작업

1. monitoring 결과와 A-6 dry-run 결과를 하나의 Markdown으로 합치는 wrapper를 만든다.
2. `data/!coffeedata.md`의 다음 할일/Completed Ledger 업데이트 후보를 자동 생성한다.
3. A-5 closure PASS 전에는 A-6 backend deploy 승인안으로 넘어가지 않는다.

