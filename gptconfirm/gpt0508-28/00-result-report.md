# gpt0508-28 result report

작성 시각: 2026-05-10 18:01 KST
Lane: Green read-only/dry-run/documentation

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
  lane: Green
  allowed_actions:
    - Google Ads API read-only refresh
    - 운영DB PAYMENT_COMPLETE 기반 read-only dry-run
    - BigQuery read-only funnel quality query
    - no-send candidate recomputation
    - approval packet writing
    - harness documentation patch
    - scoped commit/push
  forbidden_actions:
    - Google Ads confirmed_purchase upload
    - Google Ads conversion action 변경
    - GTM Production publish
    - Meta CAPI operational send
    - send_candidate=true
    - raw email/phone/member_code/order/payment 저장 또는 logging
  source_window_freshness_confidence:
    source: Google Ads API, 운영DB PAYMENT_COMPLETE dry-run, VM Cloud evidence JSON, GA4 BigQuery export
    window: Google Ads LAST_30_DAYS / 운영DB 2026-04-11~2026-05-10 KST / BigQuery 2026-05-03~2026-05-09 중심
    freshness: 2026-05-10 17:50~18:01 KST 생성
    confidence: 0.82
```

## 5줄 요약

1. Google Ads live action/campaign 값을 read-only로 재조회했고, 플랫폼 주장 ROAS는 cost 23,667,282.84원 / Conv. value 226,732,681.89원 / ROAS 9.58이다.
2. 운영DB PAYMENT_COMPLETE 기준 same-window confirmed 주문은 2,152건, NPay actual confirmed는 143건이며, complete_time/imweb_status blank는 차단 사유로 쓰지 않았다.
3. 내부 confirmed 중 Google click id가 남은 주문은 31건 / 7,611,210원뿐이라 Google Ads upload 후보는 계속 0건이다.
4. TechSol NPay action은 Secondary지만 click/intent 성격이라 confirmed purchase로 쓰지 않고, Primary `구매완료` action도 NPay count label 리스크가 높다.
5. Meta CAPI는 Test Events 승인안만 만들었고, 운영 송출/Google Ads upload/GTM publish/write는 모두 하지 않았다.

## 이번 batch 기준 진척률

- 전체 Google/NPay ROAS correction 기준: 약 74%.
- 이번 gpt0508-28 batch 기준: 100%.
- 100%까지 남은 핵심: campaign_id 결정 조인, confirmed_purchase no-send builder 통합, Google Ads Red 승인안, 실제 upload 전 7일 병행관찰 계획.
- 다음 병목: Google Ads 캠페인 ID와 내부 confirmed 주문의 결정적 연결키가 아직 부족하다.
- 사람이 이해할 수 있는 1문장 설명: Google Ads가 주장하는 구매값과 실제 결제완료 매출을 같은 기간에 놓고 비교했더니, 플랫폼 구매 신호는 아직 NPay count/click 계열에 치우쳐 있어 바로 예산 판단에 쓰면 위험하다.

## 컨펌받을 문서

1. `01-google-ads-live-action-campaign-refresh-20260510.md`
   - 추천: YES, read-only 결과 채택.
   - 이유: 실제 Google Ads live action/campaign 값을 같은 window로 다시 뽑았다.
2. `02-confirmed-purchase-same-window-no-send-20260510.md`
   - 추천: YES, no-send input 방향 채택.
   - 이유: 운영DB PAYMENT_COMPLETE를 primary source로 두고 NPay actual confirmed를 포함하되 send_candidate=false를 유지했다.
3. `03-google-ads-campaign-internal-roas-dry-run-20260510.md`
   - 추천: HOLD for budget decision.
   - 이유: campaign_id 결정 조인이 없어 캠페인별 internal ROAS는 아직 예산 판단값이 아니다.
4. `04-campaign-funnel-quality-7_14_30d-20260510.md`
   - 추천: YES_WITH_SOURCE_WARNING.
   - 이유: 7/14/30d query 결과가 동일해 window trend가 아니라 현재 BigQuery suffix coverage 경고로 봐야 한다.
5. `05-meta-funnel-capi-test-events-approval-20260510.md`
   - 추천: Yellow approval candidate.
   - 이유: Test Events only이며 운영 송출은 금지한다.
6. `06-codex-multi-agent-harness-rule-20260510.md`
   - 추천: YES.
   - 이유: 조사 병렬 / 수정 통합 / 커밋 단일 원칙이 이번 작업에서 효과적이었다.
7. `07-techsol-gads-npay-click-conversion-audit-20260510.md`
   - 추천: YES, risk note 유지.
   - 이유: TechSol action은 pause/delete가 아니라 click-only 차단 기준으로 관리한다.

## 지금 승인해도 되는 것

- ConfirmedPurchasePrep 통합 input 방향.
- Google Ads action/campaign read-only refresh 결과 채택.
- TechSol NPay click conversion을 confirmed purchase 후보에서 제외하는 기준.
- Meta CAPI Test Events approval packet 검토.
- multi-agent harness rule 문서화.

## 아직 승인하면 안 되는 것

- Google Ads confirmed_purchase upload.
- Google Ads conversion action 변경.
- TechSol tag pause/delete.
- Meta CAPI operational send.
- GTM Production publish.
- send_candidate=true 또는 actual_send_candidate=true.

## 주요 결과

### Google Ads

- 플랫폼 주장값: cost 23,667,282.84원 / Conv. value 226,732,681.89원 / ROAS 9.58.
- Primary action: `7130249515 구매완료`, `primary_npay_count_label`, HIGH risk.
- Secondary action: `7564830949 TechSol - NPAY구매 50739`, `secondary_npay_click_label`, MEDIUM risk.
- 내부 Google-click confirmed: 31건 / 7,611,210원.

### ConfirmedPurchasePrep

- 운영DB confirmed 주문: 2,152건.
- homepage confirmed: 2,009건.
- NPay actual confirmed: 143건.
- Google click id 보유: 31건.
- send_candidate: 0건.
- actual_send_candidate: 0건.

### BigQuery funnel

- paid_google sessions: 2,017.
- paid_meta sessions: 13,190.
- paid_tiktok sessions: 5,534.
- NPay click sessions: 181.
- GA4 purchase events: 148.
- 7/14/30d 결과가 동일하므로 window trend가 아니라 source coverage 경고로 둔다.

## 멀티에이전트 평가

이번에는 도움이 됐다. 특히 Google Ads env 확인, BigQuery 확장 방향, Meta Test Events 승인안, harness patch 위치를 병렬로 받으면서 조사 시간이 줄었다. 다만 실제 파일 수정, 산출물 생성, 검증, commit/push는 parent가 단일 작업트리에서 통합하는 방식이 맞다. 병렬 에이전트가 같은 파일을 수정하거나 commit하면 위험하다.

## 다음 자동 Green 작업

1. Google Ads campaign id와 내부 confirmed 주문의 deterministic mapping 후보표 작성.
2. ConfirmedPurchasePrep no-send builder에 same-window input을 공식 입력으로 연결.
3. BigQuery suffix coverage를 확인해 7/14/30d window가 실제로 다른 raw partition을 읽도록 보강.
4. Meta Test Events는 TJ님이 test_event_code를 승인/제공할 때만 smoke로 진행.

## 다음 Yellow/Red 승인 후보

- Yellow: Meta CAPI Test Events smoke.
- Yellow: Google Ads campaign mapping 검증용 read-only API 추가 범위.
- Red: Google Ads confirmed_purchase upload.
- Red: Google Ads conversion action primary/secondary 설정 변경.
- Red: TechSol tag pause/delete.

## 검증 결과

- JSON parse: PASS.
- validate_wiki_links: PASS.
- harness-preflight-check --strict: PASS.
- git diff --check: PASS.
- backend typecheck: 생략. 백엔드 코드 변경 없이 read-only script 실행 결과와 문서/데이터 산출물만 추가했다.

## 금지선 준수

- Google Ads upload 0.
- Google Ads conversion action 변경 0.
- Meta operational send 0.
- GTM Production publish 0.
- VM Cloud write/status sync 변경 0.
- raw PII/order/payment 저장/logging 0.
