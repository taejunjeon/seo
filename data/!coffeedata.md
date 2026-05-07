# 더클린커피 데이터 정합성 현재 정본

작성 시각: 2026-05-07 01:52 KST
최신 업데이트: 2026-05-07 14:58 KST
기준일: 2026-05-07
상태: active canonical
Owner: coffee-data / attribution
Supersedes: [[!coffeedata_old|기존 chronological 정본]]
Next document: A-5 cron schedule correction 또는 A-5 closure result
Do not use for: GA4/Meta/Google Ads/TikTok/Naver 실제 전송 승인, VM schema/write enforce 승인, GTM publish 승인

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
    - harness/coffee-data/AUDITOR_CHECKLIST.md
  lane: Green read-only 정본 재작성 + monitoring dry-run
  allowed_actions:
    - 기존 문서 old 처리
    - 실제 개발 순서 기준 정본 재작성
    - coffee monitoring read-only 실행
    - A-6 ledger join dry-run 실행
  forbidden_actions:
    - Coffee GA4 Measurement Protocol send
    - Meta CAPI send
    - TikTok/Google/Naver platform send
    - 운영 DB/ledger write
    - VM schema migration/enforce
    - GTM publish
  source_window_freshness_confidence:
    source: "기존 !coffeedata_old + coffee monitoring script + A-6 ledger join dry-run"
    window: "2026-04-23~2026-05-07 KST"
    freshness: "A-4 live 이후 day5 read-only monitoring. 운영 ledger row는 아직 적음"
    confidence: 0.87
```

## 10초 결론

더클린커피 데이터 정합성은 “네이버 API를 기다리는 프로젝트”가 아니다.

정본 순서는 `주문·결제 장부 확정 → GA4 BigQuery guard → NPay intent 미래키 수집 → A-6 외부 전송 dry-run → 플랫폼 전송 승인`이다. 현재는 A-4 NPay intent live publish 이후 A-5 monitoring 구간이며, 2026-05-07 01:51 KST read-only 기준 real intent row는 아직 적지만 A-6 join 후보가 4건 생겼다. 2026-05-07 09:01 KST 확인 결과 VM cron은 UTC 기준 `0 9 * * *`라 실제 실행 시각이 KST 18:00이다.

Phase2 Coffee NPay 과거 매칭은 TJ님 YES로 100% 종결됐다. 과거 purchase 자동 복구 전송은 열지 않고, `분석 완료 / 전송 금지 / 미래 intent 장부로 이관`으로 닫는다. 컨펌 근거는 [[confirm0507-1]]이다.

실제 전송은 여전히 0건이다. Coffee GA4/Meta/Google/TikTok/Naver로 purchase를 보내려면 A-5 closure, A-6 backend dry-run, 중복 guard, TJ님 Red 승인까지 필요하다.

## Phase-Sprint 요약표

실제 개발 순서 기준이다. 기존 chronological history는 [[!coffeedata_old]]에 남긴다.

| Priority | Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|---|
| P0 | Phase0 | [[#Phase0-Sprint0]] | 정본 재정렬 | Codex | 100% / 100% | [[#Phase0-Sprint0\|이동]] |
| P0 | Phase1 | [[#Phase1-Sprint1]] | 주문·결제 기준선 | Codex | 90% / 80% | [[#Phase1-Sprint1\|이동]] |
| P0 | Phase2 | [[#Phase2-Sprint2]] | GA4/NPay 과거분 guard | Codex + TJ | 100% / 100%, 종결 | [[#Phase2-Sprint2\|이동]] |
| P0 | Phase3 | [[#Phase3-Sprint3]] | NPay intent 미래키 수집 | TJ + Codex | 88% / 68% | [[#Phase3-Sprint3\|이동]] |
| P1 | Phase4 | [[#Phase4-Sprint4]] | A-6 외부 전송 dry-run | Codex | 45% / 0% | [[#Phase4-Sprint4\|이동]] |
| P2 | Phase5 | [[#Phase5-Sprint5]] | Coffee ROAS 화면·루틴 | Claude Code + Codex | 20% / 0% | [[#Phase5-Sprint5\|이동]] |

## 다음 할일

이 표에는 아직 완료되지 않은 실제 작업만 둔다. 이미 실행한 A-5 closure 점검, A-6 1차 dry-run, 정본 재작성은 [[#Completed Ledger]]에만 남긴다.

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 의존성 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | [[#Phase3-Sprint3]] | cron 시간대 결정 필요 | TJ + Codex | Coffee monitoring cron을 KST 09:00에 맞출지, 현재처럼 KST 18:00 실행을 둘지 결정한다 | 문서 주석은 KST 09:00인데 실제 crontab은 UTC 09:00이라 오늘 09:00 산출물이 생기지 않았다 | 선택 A: 오늘은 KST 18:00 산출물을 기다린다. 선택 B: crontab을 `0 0 * * *`로 바꿔 KST 09:00에 맞춘다 | 독립. Growth/Meta/biocom 작업과 무관. 단, crontab 수정은 VM 운영 설정 변경이라 TJ 승인 필요 | [[#Phase3-Sprint3]] | crontab 수정은 YES, 기다리기는 NO |
| 2 | [[#Phase3-Sprint3]] | 18:00 cron 대기 | Codex | 2026-05-07 KST 18:00 이후 VM cron 결과로 A-5 closure를 최종 재판정한다 | 02:05 점검은 자동 지표 PASS였지만 admin join-report가 없어 완전 closure가 아니다 | VM의 `/home/biocomkr_sns/seo/coffee-monitoring/20260507.yaml`과 `cron.log`를 read-only로 가져와 local 결과와 비교한다 | 시간 의존. 현재 crontab 기준 KST 18:00 산출물 필요. 1번에서 crontab을 고치면 다음 실행 시각이 바뀐다 | [[#Phase3-Sprint3]] / [[coffee-a5-monitoring-closure-check-20260507]] | NO, read-only |
| 3 | [[#Phase4-Sprint4]] | 2번 이후 재실행 | Codex | A-6 ledger join 후보를 최신 cron 이후 다시 계산한다 | 실제 전송 후보는 `imweb_order_code`가 있는 confirmed intent만 남겨야 한다 | `coffee-a6-ledger-join-dry-run.ts`를 재실행하고 real row, join 가능 row, send target row를 비교한다 | 부분 의존. 2번 최신 cron 이후 실행하면 가장 정확하다. 단순 dry-run 자체는 독립 실행 가능 | [[#Phase4-Sprint4]] / [[coffee-a6-external-platform-send-design-20260502]] | NO, read-only |
| 4 | [[#Phase4-Sprint4]] | 2번 PASS 후 승인안 작성 | Codex | A-6 backend no-send 배포 승인안을 작성한다 | VM route를 올려야 GA4 MP 후보를 실제 전송 없이 검증할 수 있다 | A-5 closure PASS와 A-6 dry-run 결과를 근거로 route diff, schema, rollback, negative smoke를 승인안으로 만든다 | 선행필수. 2번 A-5 closure PASS가 있어야 승인안의 근거가 닫힌다 | [[#Phase4-Sprint4]] | 문서 작성은 NO, 실제 VM deploy는 YES |

## 현재 기준 숫자

| 항목 | 값 | 기준 |
|---|---:|---|
| GA4 BigQuery property | `analytics_326949178` | Coffee |
| 최근 7일 GA4 purchase | 108건 / 4,454,524원 | 2026-04-23~2026-04-29 KST 기존 기준선 |
| 최근 7일 Imweb API 전체 주문 | 113건 / 4,699,767원 | 2026-04-23~2026-04-29 KST 기존 기준선 |
| 최근 7일 Imweb NPay actual order | 60건 / 2,462,300원 | `type=npay` |
| GA4 NPay형 purchase | 58건 / 2,359,300원 | synthetic transaction_id |
| NPay actual vs GA4 NPay형 차이 | 2건 / 103,000원 | 과거분 자동 복구 금지 |
| GA4 robust guard | 36/36 absent | 실제 주문번호가 GA4 event에 없음 |
| one-to-one NPay matching | assigned 42건, unassigned actual 18건, unassigned GA4 16건 | 보수 기준 배정 결과 |
| unassigned actual historical labels | `expected_synthetic_gap` 8 / `stop_historical_recovery` 6 / `manual_review_only` 3 / `needs_naver_api_crosscheck` 1 | 18건 자동 전송 금지 라벨 |
| LTV combined eligible | 12,731건 / 476,696,364원 | 2024/2025 Excel LTV dry-run 감사 기준 |
| 2025 mismatch breakdown total | 11,018/397 | 2025 결제 mismatch dry-run 감사 기준 |
| Naver API 직접 효용 | 6/47 ≈ 13% | 과거 synthetic gap 한계 |
| 2026-05-07 A-5 monitoring real rows | 0건 | VM cron/local public stats 기준 |
| 2026-05-07 A-6 ledger real rows | 6건 | public list 기준 |
| 2026-05-07 A-6 join 가능 후보 | 4건 | real + confirm_to_pay + imweb_order_code |

감사용 원문 숫자:

```text
60건, 2,462,300원
58건, 2,359,300원
assigned 42건, unassigned actual 18건, unassigned GA4 16건
`expected_synthetic_gap` 8 / `stop_historical_recovery` 6 / `manual_review_only` 3 / `needs_naver_api_crosscheck` 1
12,731건 / 476,696,364원
11,018/397
```

## Active Action Board

| Priority | Status | Phase/Sprint | 작업 | 왜 하는가 | 다음 액션 | 담당 | 승인 필요 | Source |
|---|---|---|---|---|---|---|---|---|
| P0 | schedule_decision | Phase3-Sprint3 | A-5 cron schedule mismatch | KST 09:00 기대와 UTC 09:00 crontab이 어긋났다 | TJ 결정: 현재 KST 18:00 유지 또는 crontab KST 09:00 보정 | TJ + Codex | YES if change | 이 문서 |
| P0 | waiting_for_18kst_cron | Phase3-Sprint3 | A-5 monitoring closure final | live publish 후 자연 traffic에서 안전성과 capture 품질을 확인해야 한다 | 2026-05-07 18:00 KST VM cron output 수집 후 최종 closure 판정 | Codex | NO | [[coffee-a4-monitoring-report-template-20260502]] |
| P0/P1 | pending_latest_window | Phase4-Sprint4 | A-6 ledger join 재측정 | 외부 전송 전 deterministic join 가능한 후보만 남겨야 한다 | 18:00 cron 이후 `coffee-a6-ledger-join-dry-run.ts` 재실행 | Codex | NO | [[coffee-a6-external-platform-send-design-20260502]] |
| P1 | blocked_by_A5_closure | Phase4-Sprint4 | A-6 backend 배포 승인안 | skeleton route를 VM에 올려야 no-send 후보 검증이 가능하다 | A-5 closure PASS 후 승인안 작성 | TJ + Codex | YES, future | [[coffee-a6-external-platform-send-design-20260502]] |
| P2 | parked | Phase4-Sprint4 | GA4 MP enforce | GA4 숫자를 바꾸는 Red Lane | dry-run 50건, 중복 guard, 72h window 확인 후 별도 승인 | TJ + Codex | YES, future | [[coffee-a6-external-platform-send-design-20260502]] |
| P2 | parked | Phase5-Sprint5 | Coffee ROAS 화면 | 수치 의미가 안정된 뒤 UI가 필요하다 | A-5/A-6 상태 반영 후 Claude Code handoff | Claude Code + Codex | NO | 이 문서 |

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-05-01 KST | GA4 BigQuery 기준선 | purchase 108건, transaction_id 108건, revenue 4,454,524원 |
| 2026-05-01 KST | Imweb API read-only 기준선 | 전체 주문 113건, NPay actual 60건, card 49건, virtual 4건 |
| 2026-05-01 KST | GA4 NPay robust guard | actual order key 36/36 GA4 absent. synthetic transaction_id 한계 확정 |
| 2026-05-02 KST | NPay intent dispatcher v2.1 live publish | A-4 live. A-5 monitoring 시작 |
| 2026-05-02 KST | Coffee monitoring cron 등록 | VM daily KST 09:00 output 구조 준비 |
| 2026-05-02 KST | A-6 외부 전송 design/skeleton | GA4 MP 우선, Meta CAPI 후속. 실제 send 0건 |
| 2026-05-07 01:51 KST | A-5 monitoring read-only 실행 | public stats 기준 reject 0, stop_required=false, admin join-report는 token 미지정으로 skip |
| 2026-05-07 01:51 KST | A-6 ledger join dry-run 실행 | total 14, test 8, real 6, join 가능 후보 4, A-6 eligibility 66.7% |
| 2026-05-07 01:52 KST | 기존 문서 old 처리 | [[!coffeedata_old]]로 이동하고 이 문서를 실제 개발 순서 정본으로 생성 |
| 2026-05-07 02:05 KST | A-5 monitoring closure 점검 | VM cron 20260506과 local 20260507 비교. 자동 지표 PASS, admin join-report 미확인 |
| 2026-05-07 09:01 KST | A-5 cron schedule 확인 | `20260507.yaml` 미생성. VM은 UTC, crontab `0 9 * * *`라 실제 실행은 KST 18:00 |
| 2026-05-07 12:28 KST | Phase2 종결안 작성 | [[coffee-npay-historical-matching-closure-20260507]] 작성. 과거 자동 복구 전송 금지 + future intent/A-6 이관 추천 |
| 2026-05-07 14:58 KST | Phase2 종결 승인 반영 | [[confirm0507-1]] YES. Coffee NPay 과거 매칭은 자동 복구 전송 없이 종결, future intent/A-6로 이관 |

## Parked / Later

| 항목 | 보류 이유 | 재개 조건 |
|---|---|---|
| Coffee GA4 MP 실제 전송 | GA4 purchase 숫자를 바꾸는 Red Lane | A-6 dry-run 50건 PASS + already_in_ga4 guard PASS + TJ 승인 |
| Coffee Meta CAPI 전송 | Meta 전환값을 바꾸는 Red Lane | GA4 MP path 안정 후 Meta event_id/dedup 설계 |
| Naver API production 연동 | 직접 효용이 과거 47건 중 6건 수준 | 호스팅사 입점 가맹점 production 발급 가능성 확인 후 |
| Coffee ROAS 광고비 증액/감액 판단 | source freshness와 channel assignment가 먼저 | internal confirmed vs platform_reference 분리 완료 후 |

## Phase0-Sprint0

**이름**: 정본 재정렬

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 오래된 chronological 문서를 보존하면서, 실제 개발 순서에 맞는 새 정본을 만드는 것이다.

완료한 것:

- 기존 문서를 [[!coffeedata_old]]로 이동했다.
- 이 문서를 active canonical로 만들었다.
- Phase 번호를 실제 개발 순서에 맞게 재정렬했다.

남은 것:

- 없다.

## Phase1-Sprint1

**이름**: 주문·결제 기준선

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 Coffee 매출의 primary source를 정하는 것이다. 광고 플랫폼 값이 아니라 Imweb actual order, 결제수단, 취소/환불, BigQuery guard를 분리해야 한다.

완료한 것:

- Imweb API로 2026-04-23~2026-04-29 전체 주문 113건 / 4,699,767원을 확인했다.
- NPay actual order 60건 / 2,462,300원을 확인했다.
- card 49건 / 2,112,582원, virtual 4건 / 124,885원을 분리했다.
- 2024/2025 Excel dry-run으로 장기 LTV 분석 가능성을 확인했다.

100%까지 남은 것:

- 최신 window 기준 재실행 자동화.
- 취소/환불 net revenue rule을 `/total` ontology와 맞추기.

## Phase2-Sprint2

**이름**: GA4/NPay 과거분 guard

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 과거 GA4 NPay형 purchase가 실제 NPay 결제완료인지, synthetic event인지 구분하는 것이다.

완료한 것:

- GA4 NPay형 purchase 58건 / 2,359,300원과 Imweb NPay actual 60건 / 2,462,300원을 비교했다.
- 차이 2건 / 103,000원을 확인했다.
- GA4 event_params에서 actual order key 36개를 robust search했지만 36/36 absent였다.
- 결론: 과거분 자동 전송 복구는 금지. 미래분 intent key가 본질 해법.

100%까지 남은 것:

- 없다. TJ님 YES로 `100% / 100%` 종결됐다.
- 과거 자동 복구 전송은 금지한다.
- Naver API는 Phase2 종결 조건이 아니라 선택 보강으로 Parked 처리한다.

## Phase3-Sprint3

**이름**: NPay intent 미래키 수집

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 NPay 클릭과 실제 결제완료를 미래 데이터에서 deterministic key로 연결하는 것이다.

완료한 것:

- dispatcher v2.1 design, preview, backend guard, mobile/PC 검증을 거쳤다.
- 2026-05-02 A-4 live publish가 완료됐다.
- monitoring script와 cron 구조가 만들어졌다.
- 2026-05-07 01:51 KST read-only monitoring을 실행했다.

현재 관측:

- public stats 기준 `enforce_flag_active=true`, `smoke_window_active=false`.
- reject counter는 invalid_origin/rate_limited/preview_only/pii 모두 0.
- admin token이 없어 join-report는 skip됐다.
- public stats만 보면 real row가 0이지만, public list 기반 A-6 dry-run은 real 6건을 봤다. 이 차이는 API endpoint와 token 범위 차이로 해석한다.
- VM cron 20260506과 local 20260507 즉시 실행 모두 `stop_required=false`, `verdict=closure-ready (auto-evaluated)`다. 상세는 [[coffee-a5-monitoring-closure-check-20260507]].
- VM crontab 주석은 `매일 KST 09:00`이지만 실제 VM 시간대는 UTC이고 crontab은 `0 9 * * *`다. 따라서 현재 설정은 매일 KST 18:00 실행이다.

100%까지 남은 것:

- 2026-05-07 KST 18:00 cron output과 admin join-report 기준 closure 판단.
- 필요 시 crontab을 `0 0 * * *`로 바꿔 KST 09:00 실행으로 보정. 이 작업은 VM 운영 설정 변경이므로 TJ 승인 후 진행한다.
- real row 기준 imweb_order_code capture rate 확인.
- 문제가 없으면 A-6 backend 배포 승인안으로 이동.

## Phase4-Sprint4

**이름**: A-6 외부 전송 dry-run

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 Coffee NPay actual confirmed order 중 GA4/Meta에 보낼 후보를 no-send로 만들고, 중복과 오탐을 막는 것이다.

현재 read-only 결과:

```text
captured_at: 2026-05-07 01:51 KST
total_items: 14
test_rows: 8
real_rows: 6
real_with_imweb_order_code: 4
real_with_imweb_order_code_and_confirm_to_pay: 4
real_no_imweb_order_code: 2
a6_join_eligibility_pct: 66.7
a6_send_target_count: 4
```

해석:

- 운영 row가 일부 들어오기 시작했다.
- 하지만 샘플은 아직 작다.
- A-6 실제 전송이 아니라 backend no-send 배포와 dry-run 검증이 다음 단계다.

100%까지 남은 것:

- A-5 closure PASS.
- VM backend skeleton 배포 승인.
- no-send dry-run 50건.
- `already_in_ga4`, `outside_backdate_window`, `manual/test/canceled/refunded` guard.
- TJ님 Red 승인 전까지 실제 전송 0건 유지.

## Phase5-Sprint5

**이름**: Coffee ROAS 화면·루틴

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표는 Coffee에서도 biocom `/total`과 같은 원칙으로 내부 confirmed 매출과 platform reference를 분리하는 것이다.

화면에 들어갈 핵심:

- Coffee internal confirmed revenue.
- GA4 synthetic NPay purchase count/value.
- Imweb NPay actual order count/value.
- A-5 intent capture health.
- A-6 no-send 후보 수.
- platform send 상태 0건.
- Red approval 대기 여부.

100%까지 남은 것:

- A-5/A-6 source가 안정된 뒤 Claude Code handoff.
- 화면에서는 `NPay click`과 `NPay actual confirmed order`를 반드시 분리한다.

## Source / Window / Freshness / Confidence

| 영역 | Source | Window | Freshness | Confidence |
|---|---|---|---|---:|
| GA4 baseline | [[coffee-ga4-baseline-20260501]] | 2026-04-23~2026-04-29 | BigQuery 접근 가능 | 0.90 |
| Imweb actual order | [[coffee-imweb-operational-readonly-20260501]] | 2026-04-23~2026-04-29 | Imweb API read-only 기준 | 0.89 |
| GA4 robust guard | [[coffee-npay-unassigned-ga4-guard-20260501]] | 2026-04-23~2026-04-29 | 과거 synthetic 한계 확인 | 0.91 |
| A-5 monitoring immediate | `data/coffee-npay-intent-monitoring-20260507.yaml` | 2026-05-07 01:51 KST | admin join-report 없음. public stats만 | 0.72 |
| A-5 monitoring closure check | [[coffee-a5-monitoring-closure-check-20260507]] | 2026-05-06~2026-05-07 | 자동 지표 PASS, join-report 미확인 | 0.78 |
| A-6 ledger dry-run | `data/coffee-a6-ledger-join-dry-run-20260507.txt` | 2026-05-07 01:51 KST | public list 기준 최신 | 0.78 |

## 다음 판단

현재 Codex가 승인 없이 더 할 수 있는 것은 read-only monitoring 재실행, A-6 dry-run 재실행, 문서 업데이트다.

승인이 필요한 것은 VM backend 배포, schema ensure, GA4 MP/Meta CAPI 실제 전송, GTM publish다.
