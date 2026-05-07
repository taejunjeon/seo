# ConfirmedPurchasePrepAgent v0 계약

작성 시각: 2026-05-07 20:50 KST
상태: active design
Owner: agent / confirmed-purchase-prep
Supersedes: none
Next document: ConfirmedPurchasePrep v1 (24h/72h paid_click_intent PASS 후 재실행 결과)
Do not use for: Google Ads conversion action 생성/변경, conversion upload, GA4/Meta/Google Ads/TikTok/Naver 실제 전송, 운영 DB write, 광고 예산/캠페인 변경

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
    - gdn/!gdnplan.md
    - total/!total-current.md
    - gdn/google-ads-confirmed-purchase-execution-approval-20260505.md
  lane: Green no-send candidate prep agent
  allowed_actions:
    - 운영 결제완료 후보 추출 (no-send)
    - block reason 분류
    - already_in_ga4 / missing_click_id / canceled / refunded / test guard 분리
    - payload preview 생성
    - 결과 JSON/Markdown 생성
  forbidden_actions:
    - Google Ads conversion action 생성/변경
    - Google Ads conversion upload
    - GA4/Meta/Google Ads/TikTok/Naver 실제 전송
    - 운영 DB write
    - 광고 예산/캠페인 변경
    - 개인정보/동의 범위에 영향 주는 변경
  source_window_freshness_confidence:
    source: "data/bi-confirmed-purchase-operational-dry-run-20260505.json (운영 결제완료 dry-run)"
    window: "2026-05-05 KST 운영 결제완료"
    freshness: "agent 실행 시점 latest read-only"
    confidence: 0.86
```

## 10초 결론

ConfirmedPurchasePrepAgent는 실제 결제완료 주문 중 Google Ads/GA4/Meta에 보낼 수 있는 후보를 **no-send**로만 만든다. 실제 전송은 별도 Red 승인 전 금지다.

홈페이지 결제완료와 NPay 실제 결제완료만 후보로 받고, NPay click/count/payment start는 차단한다.

## 재사용 script

```text
backend/scripts/google-ads-confirmed-purchase-candidate-prep.ts
```

## 실행 순서

1. 입력 JSON (`data/bi-confirmed-purchase-operational-dry-run-YYYYMMDD.json`)을 읽는다.
2. 결제수단별 분류: homepage / npay.
3. include_reason 분류: `homepage_confirmed_order` / `npay_confirmed_order`.
4. block reason 분류: `read_only_phase`, `approval_required`, `google_ads_conversion_action_not_created`, `conversion_upload_not_approved`, `missing_google_click_id`, `already_in_ga4`, `missing_attribution_vm_evidence`, `npay_intent_*`, `order_has_return_reason`, `canceled_order` 11종.
5. `with_google_click_id` (gclid/gbraid/wbraid) 카운트 산출.
6. `after_approval_structurally_eligible`과 `send_candidate` 산출. 본 단계에서는 `send_candidate=0` 유지가 정상.
7. payload preview를 Markdown으로 생성.
8. agent runner는 `send_candidate != 0`이면 status=`failed` (가드 위반).

## 권장 명령

```bash
npm --prefix backend run agent:confirmed-purchase-prep

# 다른 입력 파일 사용
npm --prefix backend run agent:confirmed-purchase-prep -- \
  --input=/path/to/bi-confirmed-purchase-operational-dry-run-YYYYMMDD.json
```

## 출력

| 산출물 | 의미 |
|---|---|
| `data/google-ads-confirmed-purchase-candidate-prep-YYYYMMDD.json` | 기계가 읽는 prep 결과 |
| `gdn/google-ads-confirmed-purchase-candidate-prep-YYYYMMDD.md` | 사람이 읽는 prep 결과 |

## 판정 기준

| 판정 | 조건 | 의미 |
|---|---|---|
| `pass` | child run pass, send_candidate=0 | no-send 후보 prep 정상. block reason을 그대로 승인안의 선행 근거로 사용 |
| `warn` | child run pass, JSON parse 실패 | 입력 파일 schema 또는 script 변경 의심 |
| `failed` | child run fail 또는 send_candidate>0 | guard 위반. 실제 전송 위험 → 즉시 점검 |

## 금지선

- Google Ads conversion action 생성/변경 금지.
- Google Ads conversion upload 금지.
- GA4/Meta/Google Ads/TikTok/Naver 실제 전송 금지.
- 운영 DB write 금지.
- 광고 예산/캠페인 변경 금지.
- 개인정보/동의 범위에 영향 주는 변경 금지.

## 다음 구현 작업

1. paid_click_intent 24h/72h PASS 이후 재실행해 `missing_google_click_id` 변화만 본다.
2. v1: 운영 attribution VM ledger와 cross-check해서 `missing_attribution_vm_evidence` 카운트가 줄어드는지 확인.
3. v1: `block_reason_counts`를 trend로 누적해 일별 변화 출력.
