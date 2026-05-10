# gpt0508-27 result report

작성 시각: 2026-05-10 KST
작업 성격: Green Lane read-only/dry-run/document patch/package
목적: Google/NPay ROAS 과대계상 원인을 내부 confirmed purchase 기준으로 분해하고, 다음 Red/Yellow 판단 전 no-send 입력을 정리한다.

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/VERIFY.md
    - harness/npay-recovery/README.md
  lane: Green
  allowed_actions:
    - read-only query
    - local dry-run
    - document patch
    - gptconfirm packaging
    - validation
  forbidden_actions:
    - Google Ads/GA4/Meta/TikTok/Naver actual send
    - Google Ads conversion upload
    - GTM Production publish
    - VM Cloud write
    - 운영DB write
    - raw email/phone/member_code/order/payment 저장 또는 logging
  source_window_freshness_confidence:
    source: 운영DB dry-run JSON + VM Cloud evidence JSON + GA4 BigQuery current export + Google Ads fallback snapshot
    window: 2026-05-07 ~ 2026-05-10 KST
    freshness: mixed, 문서별 표기
    confidence: medium_high
```

## 5줄 요약

1. 실제 결제완료 주문만 Google Ads에 알려주는 새 후보 입력(ConfirmedPurchasePrep integrated input)을 no-send로 만들었다.
2. NPay actual confirmed 1건과 홈페이지 confirmed 3건은 포함됐지만, Google click id가 없어 Google Ads upload 후보는 0건이다.
3. Google Ads 플랫폼 주장값은 fallback snapshot 기준 대부분 `구매완료` primary NPay count label에서 발생해 과대계상 의심이 크다.
4. BigQuery 퍼널 품질은 Google/Meta/TikTok/Organic별로 분리했으며, NPay click/add_payment_info는 구매완료가 아니라는 기준을 닫았다.
5. HOLD Reducer와 GTM workspace lifecycle 규칙을 실제 하네스 문서에 patch했다.

## 진척률

- Google/NPay ROAS correction 전체 기준: 약 74%
- 이번 batch 기준: 100%
- ConfirmedPurchasePrep no-send 후보 입력 기준: 약 80%
- Google Ads upload readiness 기준: 0%, 별도 Red 승인 전 계속 금지

사람 말로 한 문장:

> 이제 "어떤 주문을 실제 결제완료로 볼지"는 내부 기준으로 잡혔고, 남은 핵심은 Google Ads가 과대 주장하는 전환 액션을 실제 결제완료 후보와 같은 기간으로 다시 맞춰 보는 것이다.

## 이번 batch 산출물

### 1. ConfirmedPurchasePrep 통합 input

- source: `gdn/confirmed-purchase-integrated-input-dry-run-20260510.md`
- JSON: `data/confirmed-purchase-integrated-input-20260510.json`
- 결과:
  - integrated candidate: 4
  - homepage confirmed: 3
  - NPay actual confirmed: 1
  - Google click id 보유: 0
  - send_candidate: 0
  - actual_send_candidate: 0

판단:

NPay actual confirmed는 포함 후보가 될 수 있다. 단, Google click id가 없고 승인 전이므로 Google Ads upload 후보는 0이다.

### 2. Google Ads action/campaign ROAS decomposition

- source: `gdn/google-ads-action-campaign-roas-decomposition-20260510.md`
- JSON: `data/google-ads-action-campaign-roas-decomposition-20260510.json`
- realtime API: current read-only script env mapping 확인 필요
- fallback: 2026-05-05 LAST_14_DAYS snapshot

결과:

- Google Ads platform Conv. value snapshot: 123,495,273.53 KRW
- internal confirmed current window revenue: 862,000 KRW
- primary NPay count label snapshot value: 123,495,262.24 KRW
- action risk:
  - `구매완료`: primary NPay count label 의심, high
  - `TechSol - NPAY구매`: secondary NPay click label 의심, medium

판단:

이 값은 window가 달라 직접 ROAS 비교값으로 쓰지 않는다. 그러나 Google Ads platform value의 대부분이 NPay count/click 계열 label에 묶였을 가능성이 높아 다음 P0는 live Google Ads action-level read-only refresh다.

### 3. BigQuery channel/campaign funnel quality

- source: `gdn/channel-campaign-funnel-quality-20260510.md`
- JSON: `data/channel-campaign-funnel-quality-20260510.json`
- window: 2026-05-07 ~ 2026-05-09

결과:

- total sessions: 25,640
- paid_google sessions: 2,017
- paid_meta sessions: 13,190
- paid_tiktok sessions: 5,534
- NPay click sessions: 181
- GA4 purchase events: 148

판단:

GA4 BigQuery는 funnel quality와 platform event 관측에는 유용하지만, 실제 NPay 결제완료 primary source는 아니다. 실제 결제완료 판단은 운영DB PAYMENT_COMPLETE/admin confirmed가 우선이다.

### 4. NPay click vs actual purchase closure

- source: `naver/npay-click-vs-actual-purchase-closure-20260510.md`

닫은 기준:

- NPay click/count/add_payment_info는 purchase가 아니다.
- actual confirmed는 운영DB PAYMENT_COMPLETE 또는 관리자 confirmed source 기준이다.
- complete_time blank / imweb_status blank는 단독 미결제 판단 근거가 아니다.
- TechSol NPay click conversion은 별도 Google Ads risk다.

### 5. Meta funnel CAPI readiness

- source: `capivm/meta-funnel-capi-readiness-20260510.md`

판단:

서버 endpoint와 이벤트 whitelist는 준비도가 높다. 하지만 browser/server dedup과 Meta Test Events 수신 검증이 끝나지 않았으므로 운영 ON은 금지다. 우선순위는 P1 readiness다.

### 6. Harness patch

- source: `gptconfirm/gpt0508-27/07-harness-patch-result-20260510.md`

수정:

- `AGENTS.md`
- `harness/common/HARNESS_GUIDELINES.md`
- `harness/common/REPORTING_TEMPLATE.md`
- `harness/gdn/VERIFY.md`

핵심:

HOLD가 나오면 승인 대기로 넘기기 전에 Green follow-up을 먼저 수행한다. 다음 할일은 이제 `Codex 추천 방향 / 추천 이유 / 추천 방향에 대한 자신감` 순서로 쓴다.

## 지금 승인해도 되는 것

- Google Ads action-level read-only live refresh
- ConfirmedPurchasePrep same-window no-send 후보 재계산
- campaign/click key mapping dry-run
- TechSol NPay click conversion read-only inventory
- Meta Test Events approval packet 작성

## 아직 승인하면 안 되는 것

- Google Ads confirmed_purchase upload
- Google Ads conversion action 변경
- GTM Production publish
- Meta CAPI operational send
- NPay click/count를 purchase로 승격
- `send_candidate=true`
- raw email/phone/member_code/order/payment 저장 또는 logging

## HOLD Reducer

- hold_reason_category: source_freshness_gap, missing_live_google_ads_action_refresh, missing_campaign_click_join
- auto_green_followups_done:
  - ConfirmedPurchasePrep 통합 input 생성
  - Google Ads fallback snapshot decomposition
  - BigQuery funnel quality read-only query
  - NPay closure 문서 작성
  - Harness actual patch
- remaining_blocker:
  - Google Ads live action/campaign read-only script env mapping
  - internal confirmed revenue와 Google Ads metrics same-window 조인
  - conversion action primary/secondary UI 확인
- next_lane: Green for read-only refresh, Red for upload/action changes

## 금지선 준수

- 운영DB write: 0
- VM Cloud write: 0
- GTM Production publish: 0
- platform send: 0
- Google Ads conversion upload: 0
- raw PII/order/payment 저장: 0

## 다음 자동 Green

1. Google Ads live action/campaign read-only refresh를 같은 window로 재실행한다.
2. ConfirmedPurchasePrep integrated input과 Google Ads campaign/action 값을 같은 날짜 범위로 맞춰 gap을 재계산한다.
3. TechSol NPay click conversion action이 Primary/Secondary 어디에 있는지 read-only inventory를 보강한다.
4. NPay channel_order_no와 운영DB order_number 매핑 dry-run을 고도화한다.

## 다음 Yellow/Red 후보

- Yellow: Meta Test Events smoke, test_event_code 기반 각 event 1건 이하
- Red: Google Ads conversion action 변경, confirmed_purchase upload, GTM Production publish

