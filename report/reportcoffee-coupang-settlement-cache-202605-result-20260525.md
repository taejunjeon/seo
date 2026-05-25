# reportcoffee coupang settlement cache 202605 result 20260525

작성 시각: 2026-05-25 06:09 KST
기준일: 2026-05-25
문서 성격: 더클린커피 쿠팡 2026-05 정산 cache 로컬 적재 결과
담당: Codex
상위 문서: [[reportcoffee]], [[!report]], [[reportcoffee-coupang-settlement-cache-202605-approval-20260525]], [[reportcoffee-coupang-settlement-refresh-path-20260524]], [[reportcoffee-sales-summary-no-send-20260524]]
JSON 산출물: `report/reportcoffee-coupang-settlement-cache-202605-result-20260525.json`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - report/reportcoffee-coupang-settlement-cache-202605-approval-20260525.md
    - report/reportcoffee-coupang-settlement-refresh-path-20260524.md
    - report/reportcoffee-sales-summary-no-send-20260524.md
  lane: Yellow approved local apply
  allowed_actions:
    - local_sqlite_backup
    - read_only_coupang_api_preview
    - local_sqlite_write_to_coupang_settlements_api
    - local_sqlite_post_verify
    - slack_no_send_json_regeneration
    - local_json_markdown_result_update
  forbidden_actions:
    - operating_db_write
    - vm_cloud_write_or_deploy
    - slack_send
    - platform_send_or_upload
    - gtm_publish
    - cron_registration
    - raw_identifier_output
  source_window_freshness_confidence:
    source: Coupang settlement-histories API + local SQLite coupang_settlements_api
    window: settlement recognition month 2026-05
    freshness: 2026-05-25 06:09 KST
    confidence: 0.90 for local cache apply result
```

## 10초 요약

쿠팡 2026-05 정산표가 로컬 cache에 들어갔다.

이번 작업은 더클린커피 매출 총액을 바꾼 것이 아니다. 쿠팡 정산 대조용 장부를 2026-04에서 2026-05로 최신화한 것이다. Slack no-send JSON도 다시 만들었고, 이제 2026-05 정산 cache를 읽어 `comparison_available_with_warning` 상태로 비교한다.

주의할 점은 그대로다. 쿠팡 strict 매출은 `revenue-history` 기준이다. 쉬운 말로는 “쿠팡이 매출로 인정한 상품별 금액”이다. 이번에 넣은 `settlement-histories`는 지급내역이다. 쉬운 말로는 “쿠팡이 언제 얼마를 정산 지급할 예정인지 보는 표”다. 두 숫자는 직접 같은 값이 아니다.

## 실제로 한 일

1. 로컬 DB 백업을 만들었다.
2. 적용 직전 쿠팡 API preview를 다시 확인했다.
3. `backend/scripts/coupang-backfill-settlements.cjs 2026-05 2026-05`를 실행했다.
4. 로컬 SQLite `coupang_settlements_api`에 2026-05 정산표 8건을 적재했다.
5. SQLite WAL journal을 flush했다. WAL은 SQLite가 변경분을 임시로 담는 파일이다. flush 후 main DB hash가 바뀌고 WAL 파일은 0B가 됐다.
6. Slack no-send JSON을 다시 생성했다.

## 결과 숫자

source: 쿠팡 정산 API + 로컬 SQLite
window: 2026-05 정산월
freshness: 2026-05-25 06:09 KST
confidence: 90%

| 구분 | row | totalSale | finalAmount | 매출인식 범위 | 정산일 최대 | 중복 |
|---|---:|---:|---:|---|---|---:|
| biocom | 4 | 1,019,400원 | 256,524원 | 2026-05-01 - 2026-05-17 | 2026-07-01 | 0 |
| TeamKeto | 4 | 7,222,000원 | 2,289,310원 | 2026-05-01 - 2026-05-17 | 2026-07-01 | 0 |
| 합계 | 8 | 8,241,400원 | 2,545,834원 | 2026-05-01 - 2026-05-17 | 2026-07-01 | 0 |

TeamKeto의 2026-05 cache 최신성:

- latest month: 2026-05.
- rows: 4.
- totalSale: 7,222,000원.
- finalAmount: 2,289,310원.
- max recognition date: 2026-05-17.
- max settlement date: 2026-07-01.

## Slack no-send JSON 영향

재생성 파일: `report/reportcoffee-sales-summary-no-send-20260524.json`

바뀐 점:

- 정산 cache 상태: `ok_local_read_only`.
- weekly: `comparison_available_with_warning`.
- month_to_date: `comparison_available_with_warning`.
- rolling_30d: `comparison_available_with_warning`.

바뀌지 않은 원칙:

- 쿠팡 strict 매출은 계속 `revenue-history coffee_hint saleAmount`다.
- 주문서 API는 주문 발생 참고값이다.
- 정산표는 지급/입금 대조값이다.
- TeamKeto 계정 전체 정산표와 더클린커피 coffee-only 매출은 직접 같은 숫자가 아니다.

## 검증 결과

- 백업 생성: PASS.
- 적용 직전 API preview: PASS, 승인안 예상값과 같음.
- local apply: PASS, API 호출 2회 / 적재 8행.
- post-verify: PASS, 2026-05 rows 8 / distinct settlement_id 8 / duplicate 0.
- SQLite WAL checkpoint: PASS, WAL 0B.
- Slack no-send JSON regeneration: PASS.
- 운영DB write: 0.
- VM Cloud write/deploy/restart: 0.
- Slack send: 0.
- platform send/upload: 0.
- GTM publish: 0.
- cron 등록: 0.

## 백업과 롤백

백업 파일:

```text
/Users/vibetj/coding/seo/backend/data/backups/crm.sqlite3.before-coupang-settlements-202605-20260525T060826.bak
```

rollback이 필요하면 main DB를 백업으로 되돌리고 WAL/SHM 파일을 정리한 뒤 2026-05 row가 0건으로 돌아가는지 확인한다.

```bash
cp /Users/vibetj/coding/seo/backend/data/backups/crm.sqlite3.before-coupang-settlements-202605-20260525T060826.bak /Users/vibetj/coding/seo/backend/data/crm.sqlite3
rm -f /Users/vibetj/coding/seo/backend/data/crm.sqlite3-wal /Users/vibetj/coding/seo/backend/data/crm.sqlite3-shm
sqlite3 -readonly /Users/vibetj/coding/seo/backend/data/crm.sqlite3 "SELECT COUNT(*) FROM coupang_settlements_api WHERE recognition_year_month='2026-05';"
```

주의: rollback은 지금 필요하지 않다. 위 명령은 실패 상황 대비용이다.

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 75% | 76% | +1% |
| B | 더클린커피 매출 source 확인 | 100% | 100% | +0% |
| C | 더클린커피 광고비 source 확인 | 82% | 82% | +0% |
| D | 바이오컴 리포트 source map | 36% | 36% | +0% |
| E | Slack no-send 메시지 설계 | 99% | 99% | +0% |
| F | 자동화/배포 readiness | 97% | 98% | +1% |

## 다음 할일

### Codex가 할 일

1. 쿠팡 정산 대조 문구를 Slack preview에 더 쉽게 붙인다.
   - 무엇을 하는지: “쿠팡 매출”과 “쿠팡 정산표”가 왜 다른지 한 줄 설명을 메시지에 넣는다.
   - 왜 하는지: TeamKeto 계정 전체 정산표와 coffee-only 매출이 달라 보여도 오류로 오해하지 않게 하기 위해서다.
   - 어떻게 하는지: `report/reportcoffee-sales-summary-no-send-20260524.json`의 `coupang_settlement_comparison` 값을 Slack preview Markdown에 반영한다.
   - 성공 기준: Slack preview에서 쿠팡 매출 기준과 정산 대조 기준이 분리되어 보인다.
   - 실패 시 다음 확인점: TeamKeto 계정 안의 coffee/teamketo 상품 분류 rule을 다시 본다.
   - 승인 필요 여부: NO for no-send 문서/JSON, YES for 실제 Slack send.
   - 의존성: 없음.
   - 추천 점수/자신감: 88%.

### TJ님이 할 일

1. 지금 당장 추가로 할 일은 없다.
   - 무엇을 하는지: 다음 Slack 실제 발송 승인 전 preview 문구만 확인하면 된다.
   - 왜 하는지: 이번 적재는 로컬 cache 최신화라 운영 화면이나 외부 계정에서 누를 것이 없다.
   - 성공 기준: 쿠팡 숫자 설명이 이해되면 다음 단계로 Slack preview 문구 보강을 진행한다.
   - 승인 필요 여부: NO.
   - 의존성: Codex의 no-send preview 문구 보강.
   - 추천 점수/자신감: 80%.
