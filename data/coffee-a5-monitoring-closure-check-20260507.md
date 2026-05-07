# Coffee A-5 monitoring closure 점검

작성 시각: 2026-05-07 02:05 KST
상태: PASS_WITH_NOTES
Owner: coffee-data / monitoring
Next document: A-6 backend 배포 승인안 또는 A-5 admin join-report 보강
Do not use for: GA4/Meta/Google Ads/TikTok/Naver 전송 승인, VM write/enforce 승인

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
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - data/!coffeedata.md
  lane: Green read-only monitoring
  allowed_actions:
    - VM cron output read-only 확인
    - local monitoring script 실행
    - A-6 ledger join dry-run 실행
  forbidden_actions:
    - VM schema/write enforce
    - GA4/Meta/Google Ads/TikTok/Naver 전송
    - GTM publish
    - 운영 DB write
  source_window_freshness_confidence:
    source: "VM cron yaml + local coffee monitoring script + A-6 public list endpoint"
    window: "2026-05-06 18:00~2026-05-07 01:51 KST"
    freshness: "VM cron latest는 20260506, 20260507 09:00 cron 전 로컬 즉시 실행 보강"
    confidence: 0.78
```

## 10초 결론

Coffee A-5 monitoring은 자동 지표 기준으로는 PASS다. `invalid_origin`, `rate_limited`, `preview_only_violation`, `pii_rejected`가 모두 0이고 `stop_required=false`다.

다만 완전 closure라고 부르기에는 아직 이르다. admin token이 없어 `join-report`가 skip됐고, public stats 기준 real row는 0으로 보인다. 반면 public list 기반 A-6 dry-run은 real row 6건, join 가능 4건을 봤다. 따라서 다음 단계는 admin join-report 또는 VM 내부 DB 기준으로 real row와 order join을 확인하는 것이다.

## 의존성 판단

이 작업은 biocom Mode B 24h/72h monitoring이나 그로스파트 campaign id 확인과 **의존성이 없다**.

그래서 바로 실행했다.

| 앞 할일 | 이 작업과 관계 | 판단 |
|---|---|---|
| 그로스파트 Meta campaign id 확인 | Meta 캠페인 ROAS용. Coffee NPay monitoring과 무관 | 독립 |
| biocom paid_click_intent 24h/72h monitoring | biocom Google click id 보존용. Coffee A-5와 site/source 다름 | 독립 |
| Coffee A-5 monitoring | 현재 작업 | 실행 완료 |

## 실행한 명령

```bash
cd backend
npx tsx scripts/coffee-npay-intent-monitoring-report.ts \
  --endpoint https://att.ainativeos.net \
  --publish-ts "2026-05-02 15:00" \
  --output ../data/coffee-npay-intent-monitoring-20260507.yaml

npx tsx scripts/coffee-a6-ledger-join-dry-run.ts \
  --endpoint https://att.ainativeos.net \
  > ../data/coffee-a6-ledger-join-dry-run-20260507.txt

ssh taejun@34.64.104.94 \
  'sudo -u biocomkr_sns cat /home/biocomkr_sns/seo/coffee-monitoring/20260506.yaml' \
  > data/coffee-monitoring-vm-20260506.yaml
```

## VM cron output vs local 즉시 실행

| 항목 | VM cron 20260506 | Local 20260507 | 해석 |
|---|---:|---:|---|
| captured_at_kst | 2026-05-06 18:00:02 | 2026-05-07 01:51:18 | 20260507 09:00 cron 전 수동 보강 |
| days_since_publish | 4 | 4 | 둘 다 day5 모드 |
| enforce_flag_active | true | true | 운영 모드 활성 |
| smoke_window_active | false | false | smoke window 닫힘 |
| real rows excluding test | 0 | 0 | public stats 기준 real row 미관측 |
| invalid_origin | 0 | 0 | PASS |
| rate_limited | 0 | 0 | PASS |
| preview_only_violation | 0 | 0 | PASS |
| is_simulation_blocked | 0 | 0 | PASS |
| pii_rejected | 0 | 0 | PASS |
| payment_button_type_null_in_confirm_to_pay | 0 | 0 | PASS |
| stop_required | false | false | 자동 stop 조건 없음 |
| verdict | closure-ready (auto-evaluated) | closure-ready (auto-evaluated) | 자동 지표 기준 PASS |

## A-6 ledger join dry-run

| 항목 | 값 |
|---|---:|
| total_items | 14 |
| test_rows | 8 |
| real_rows | 6 |
| real_with_imweb_order_code | 4 |
| real_with_imweb_order_code_and_confirm_to_pay | 4 |
| real_no_imweb_order_code | 2 |
| a6_join_eligibility_pct | 66.7% |
| a6_send_target_count | 4 |

해석:

- A-6 후보가 완전히 0은 아니다.
- 다만 샘플이 6건이라 외부 전송 설계 판단에는 아직 작다.
- test row 8건은 보고서와 전송 후보에서 제외해야 한다.
- `real_no_imweb_order_code` 2건은 deterministic join key가 없어 A-6 send 후보에서 제외한다.

## Auditor verdict

PASS_WITH_NOTES.

자동 안전 지표는 PASS다. 그러나 admin join-report가 없어 실제 confirmed order join 품질은 아직 닫히지 않았다.

## 다음 할일

1. VM cron의 20260507 09:00 KST output이 생기면 다시 가져온다.
2. admin token 또는 VM 내부 DB 기준 join-report를 확인한다.
3. real row가 충분히 쌓이면 A-6 backend 배포 승인안을 작성한다.
4. 실제 GA4 MP/Meta CAPI 전송은 별도 Red 승인 전까지 금지한다.
