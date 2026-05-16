# gpt0515-25 Ads Manager attribution gap result

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
  required_context_docs:
    - gptconfirm/gpt0515-24-today-meta-attribution-truth-table
  lane: Green read-only
  allowed_actions:
    - Meta Ads read-only insights query
    - VM Cloud SQLite read-only copy/query
    - VM Cloud Meta CAPI log read-only query
    - gptconfirm report writing
  forbidden_actions:
    - Meta send/backfill
    - VM Cloud deploy/restart
    - operational DB write/import
    - GTM publish
    - new ad account or second Pixel insertion
    - raw identifier output
  source_window_freshness_confidence:
    source: Meta Graph API + VM Cloud attribution_ledger + VM Cloud meta-capi-sends.jsonl
    window: 2026-05-15 KST
    freshness: queried at 2026-05-16 00:16 KST
    confidence: medium_high
```

## 판정

**A. ADS_MANAGER_LAG_LIKELY + E. META_STRONG_CAPI_OK_ADS_ATTRIBUTION_ZERO + F. INSUFFICIENT_API_DUE_RATE_LIMIT**

오늘 바로 닫은 것은 세 가지입니다.

1. **CAPI 수신 자체는 살아 있습니다.** 2026-05-15 KST 현재 재조회 기준 바이오컴 Pixel `1283400029487161`에 Purchase CAPI 58건이 전송됐고 58건 모두 `events_received=1`입니다.
2. **Ads Manager 원본 action에는 2026-05-15 구매 계열 key가 없습니다.** account/campaign/adset level, unified/1d_click/7d_click/1d_view 모두 `purchase`, `offsite_conversion.fb_pixel_purchase`, `omni_purchase`, `web_purchase` 계열이 0입니다.
3. **프론트 ROAS 2.01x/19건은 Ads Manager 구매가 아니라 내부 귀속 ROAS입니다.** `/api/ads/roas?account_id=act_3138805896402376&date_preset=yesterday`가 VM Cloud ledger 주문 19건 / 7,046,067원을 Meta spend와 맞춰 계산한 값입니다.

## 핵심 숫자

Source/window: VM Cloud SQLite + VM Cloud CAPI log, 2026-05-15 KST, queried 2026-05-16 00:13-00:16 KST.

- VM Cloud confirmed purchase: 62건 / 17,754,197원
- Meta strong evidence confirmed: 24건 / 9,157,467원
- Meta strong 중 CAPI sent success: 22건 / 8,689,467원
- CAPI Purchase success: 58건 / 16,963,197원
- CAPI failed: 0건
- duplicate event_id: 0건
- strict missing queue: 4건 / 791,000원, 전부 `backfill_ready`

TJ님이 준 직전 기준값인 confirmed 61건, CAPI 56건과 다른 이유는 재조회 시점에 2026-05-15 KST row가 추가로 반영됐기 때문입니다. 결론은 바뀌지 않습니다.

## 질문 답

최근 24시간 CAPI Purchase 중 “Meta 유입이라고 강하게 말할 수 없는 전송”은 현재 재조회 기준 **36/58건, 62.1%**입니다.

이 수치는 “잘못 보냈다”는 뜻이 아닙니다. Server CAPI는 실제 결제완료를 Meta에 보내고, Meta가 자기 광고 클릭/노출과 매칭해서 귀속 여부를 판단하는 구조입니다. 다만 내부 Meta ROAS를 계산할 때는 58건 전체를 Meta 매출로 잡으면 과대평가됩니다. 내부 예산 판단에는 strong Meta evidence 22건 또는 Ads Manager attributed purchase를 별도 라인으로 써야 합니다.

## 오늘 Ads Manager purchase 0 원인 후보

가장 가능성이 높은 순서입니다.

1. **same-day Ads Manager attribution lag**: CAPI는 들어갔지만 Ads Manager 구매 action 반영이 아직 안 된 상태입니다. 최근 7일은 purchase 184건 / value 48,403,247원이 잡혀 있어 완전 단절은 아닙니다.
2. **Meta strong CAPI는 들어갔지만 Ads attribution이 아직 0**: strong evidence 24건 중 22건이 CAPI success인데 Ads raw purchase key가 0입니다. 12-24시간 뒤에도 0이면 lag보다 attribution connection 문제로 격상해야 합니다.
3. **action key mismatch는 현재 증거 약함**: 원본 action에는 `offsite_conversion.custom.988739515903328`이 6,410건 보이지만, purchase 계열 key나 purchase_roas는 없습니다. 이 custom key는 value 규모가 ViewContent 계열과 유사해 “구매가 다른 이름으로 들어갔다”고 단정할 수 없습니다.
4. **campaign optimization 문제는 주원인 아님**: campaign health API 기준 활성/주요 캠페인은 Pixel `1283400029487161`, custom_event_type `PURCHASE`, optimization `VALUE` 중심입니다. 단 direct adset listing은 Meta rate limit으로 완전 재조회하지 못했습니다.

## 하지 않은 것

- Meta CAPI backfill/send 0
- VM Cloud deploy/restart 0
- 운영DB write/import 0
- GTM publish 0
- 새 광고 계정 생성 0
- 두 번째 Pixel 삽입 0
- raw order/payment/member/click id 출력 0
- Telegram 5줄 요약 전송 완료

## 확인하면 좋은 문서

1. [01-ads-action-raw-breakdown.md](./01-ads-action-raw-breakdown.md)
   왜 Ads Manager purchase가 0으로 보이는지 원본 action key 기준으로 확인할 수 있습니다.
2. [02-today-meta-strong-truth-table.md](./02-today-meta-strong-truth-table.md)
   오늘 Meta evidence가 강한 실제 결제완료 24건이 CAPI로 갔는지 safe_ref 단위로 볼 수 있습니다.
3. [04-missing-queue-action.md](./04-missing-queue-action.md)
   아직 CAPI 전송이 안 된 4건을 backfill 후보로 볼지 판단할 수 있습니다.

## 다음 할일

### TJ님이 할 일

1. **Ads Manager에서 2026-05-15 날짜를 내일 오전 한 번 더 확인합니다.**
   왜: 현재는 CAPI가 들어갔는데 Ads raw purchase가 0입니다. same-day lag인지 attribution 문제인지 12-24시간 재확인이 필요합니다.
   어떻게: Meta Ads Manager > Columns에 `Purchase`, `Purchase conversion value`, `Purchase ROAS`를 넣고 날짜를 `2026. 5. 15` 단일일로 선택합니다. 가능하면 campaign level과 adset level 둘 다 봅니다.
   성공 기준: purchase가 0에서 증가하면 lag로 판정합니다.
   실패 시 해석: 계속 0이면 Ads attribution connection broken 후보로 격상합니다.
   Codex가 대신 못 하는 이유: API read-only는 이미 확인했지만 UI 지연/필터 상태는 계정 화면에서 교차확인이 필요합니다.
   승인 필요 여부: 없음.
   추천 점수/자신감: 95%.

2. **backfill_ready 4건을 보낼지 승인하지 말지 결정합니다.**
   왜: confirmed purchase인데 CAPI success log가 없는 4건 / 791,000원이 남아 있습니다.
   어떻게: 이 패키지의 `04-missing-queue-action.md`를 보고 `[승인] gpt0515-25 backfill_ready 4건만 Meta CAPI Purchase backfill 전송`처럼 승인하거나 보류합니다.
   성공 기준: 승인 시 4건만 전송되고 events_received=4, duplicate=0입니다.
   실패 시 해석: 승인 전에는 아무 전송도 하지 않습니다.
   Codex가 대신 못 하는 이유: Meta 운영 전송은 Red Lane이라 TJ님 승인 없이는 실행 금지입니다.
   승인 필요 여부: Red 승인 필요.
   추천 점수/자신감: 72%.

### Codex가 할 일

1. **내일 Ads raw purchase 재조회 자동 체크 문서를 이어서 작성합니다.**
   왜: 오늘 원인 후보를 lag vs connection broken으로 닫으려면 같은 API를 같은 조건으로 다시 조회해야 합니다.
   어떻게: Meta Graph API `act_3138805896402376/insights`, `time_range={2026-05-15}`, level account/campaign/adset, purchase key raw dump를 반복합니다.
   성공 기준: purchase 계열 key가 생기면 lag 확정, 계속 0이면 connection broken 승인안 작성입니다.
   실패 시 확인점: Meta API rate limit이면 Ads Manager UI 확인으로 대체합니다.
   승인 필요 여부: Green read-only라 없음.
   의존성: 12-24시간 경과 필요.
   추천 점수/자신감: 93%.

2. **프론트 라벨을 `Ads Manager ROAS`와 `내부 Meta evidence ROAS`로 분리하는 Claude Code handoff를 만듭니다.**
   왜: 현재 2.01x/19건이 Ads Manager 구매처럼 오해될 수 있습니다.
   어떻게: data contract에 `source=internal_ledger_attribution`, `source=ads_manager_action`, `budget_roas_included`를 분리하도록 설계합니다.
   성공 기준: 화면에서 `광고 플랫폼이 주장한 구매`와 `내부 원장 기준 Meta evidence 구매`가 분리됩니다.
   실패 시 확인점: 같은 숫자를 다른 이름으로 중복 표시하지 않는지 QA합니다.
   승인 필요 여부: 설계는 Green, 배포는 Yellow.
   의존성: 없음.
   추천 점수/자신감: 90%.
