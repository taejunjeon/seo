# gpt0515-27 Meta cohort route analysis + clean landing experiment

작성 시각: 2026-05-16 01:51 KST

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
  required_context_docs:
    - gptconfirm/gpt0515-25-ads-manager-attribution-gap
    - gptconfirm/gpt0515-26-meta-data-source-restriction-impact
  lane: Green read-only
  allowed_actions:
    - VM Cloud SQLite read-only aggregate query
    - VM Cloud Meta CAPI send log read-only aggregate query
    - Meta Ads Insights read-only query
    - gptconfirm report writing
  forbidden_actions:
    - Meta send/backfill
    - VM Cloud deploy/restart
    - GTM publish
    - operational DB write/import
    - new ad account creation
    - second Pixel insertion
    - raw order/payment/member/click id output
  source_window_freshness_confidence:
    source: VM Cloud attribution_ledger + VM Cloud Meta CAPI send log + Meta Ads Insights API
    window: 2026-05-09..2026-05-15 KST
    freshness: queried 2026-05-16 01:42..01:51 KST
    confidence: medium_high
```

## 판정

**META_CAPI_COVERAGE_HEALTHY + ADS_ATTRIBUTION_20260515_ZERO_ANOMALY + CLEAN_LANDING_EXPERIMENT_RECOMMENDED + NEW_ACCOUNT_SECOND_PIXEL_HOLD**

이번에 가능해진 것은 “Meta가 구매 신호를 못 받는가”와 “Meta가 받았지만 Ads Manager에 귀속하지 않는가”를 분리해서 보는 것입니다.

7일 합계로 보면 Meta Ads Manager는 구매를 잡고 있습니다. 2026-05-09~2026-05-15 기준 Ads Manager 구매는 184건 / 48,403,247원, Ads Manager ROAS는 1.69x입니다. 즉 완전 단절은 아닙니다.

문제는 2026-05-15 단일일입니다. 같은 날 내부 원장 기준 Meta evidence 결제완료는 21건 / 7,764,567원이고, 그중 CAPI 성공은 19건 / 7,296,567원입니다. 그런데 Ads Manager `offsite_conversion.fb_pixel_purchase`는 0건 / 0원입니다.

현재 원인 우선순위는 `당일 Ads attribution 지연 또는 제한`이 1순위입니다. 클릭 캡처 자체가 무너졌다는 증거는 약합니다.

## 핵심 숫자

Source/window: VM Cloud SQLite + VM Cloud Meta CAPI send log + Meta Ads Insights API, site=biocom, Pixel `1283400029487161`, 2026-05-09~2026-05-15 KST.

| 기준 | 주문/구매 | 매출 | 비용 | ROAS | 해석 |
|---|---:|---:|---:|---:|---|
| 내부 전체 confirmed | 371건 | 97,398,368원 | 28,672,735원 | 3.40x | Meta 유입만이 아니라 전체 결제완료입니다. 예산 판단용 Meta ROAS로 쓰면 과대입니다. |
| 내부 Meta evidence strict | 133건 | 41,969,224원 | 28,672,735원 | 1.46x | fbclid 또는 Meta/Instagram/Facebook UTM/source가 있는 결제완료입니다. |
| 내부 Meta evidence strict + CAPI 성공 | 125건 | 39,563,224원 | 28,672,735원 | 1.38x | 내부 Meta evidence 중 서버 CAPI까지 성공한 라인입니다. |
| Ads Manager attributed purchase | 184건 | 48,403,247원 | 28,672,735원 | 1.69x | Meta가 자기 광고 기여로 리포팅한 값입니다. |

## 7일 원인 후보 재정렬

1. **2026-05-15 당일 Ads attribution 지연/제한**
   - 2026-05-15 내부 Meta evidence 결제완료는 21건 / 7,764,567원입니다.
   - 그중 19건 / 7,296,567원은 CAPI 성공입니다.
   - 같은 날 Ads Manager 구매는 0건 / 0원입니다.

2. **건강/웰빙 데이터 소스 제한 영향**
   - Events Manager의 데이터 공유 제한 경고와 맞물립니다.
   - 단, 최근 7일 Ads Manager 구매가 184건 존재하므로 전체 차단은 아닙니다.

3. **브라우저 Purchase 0**
   - 위험 신호지만 현재는 보조 문제입니다.
   - Server CAPI가 결제완료를 보내고 있고, 7일 전체 CAPI coverage가 높습니다.

4. **클릭 캡처 문제**
   - 7일 내부 Meta strict evidence 133건, Meta source checkout 410건이 있어 “클릭이 거의 안 잡힌다”는 쪽은 현재 낮은 우선순위입니다.

## clean landing 실험 추천

추천합니다. 다만 새 광고 계정이나 두 번째 Pixel이 아니라, 기존 Pixel/기존 계정에서 **10~20% 예산만 3~7일 canary**로 진행하는 방식이 맞습니다.

실험 목적은 Meta 제한을 우회하는 것이 아니라, Meta 유입 경로를 명확히 하고 건강/웰빙 민감 신호를 줄인 랜딩이 Ads attribution gap을 줄이는지 보는 것입니다.

## 하지 않은 것

- Meta send/backfill 0
- VM Cloud deploy/restart 0
- GTM publish 0
- 운영DB write/import 0
- 새 광고 계정 생성 0
- 두 번째 Pixel 삽입 0
- raw order/payment/member/click id 출력 0
- Telegram 실제 전송 0

## 확인하면 좋은 문서

1. [01-seven-day-meta-cohort.md](./01-seven-day-meta-cohort.md)
   7일 날짜별로 내부 결제완료, CAPI, Ads Manager 구매가 어디서 갈라졌는지 봅니다.
2. [03-att-roas-vs-ads-roas-gap.md](./03-att-roas-vs-ads-roas-gap.md)
   내부 Meta evidence ROAS와 Ads Manager ROAS의 차이를 예산 판단 관점으로 정리했습니다.
3. [04-clean-landing-experiment.md](./04-clean-landing-experiment.md)
   Claude Code나 TJ님이 바로 실험 설계를 넘겨받을 수 있는 clean landing canary 규격입니다.

## 다음 할일

### TJ님이 할 일

1. **Meta Ads Manager에서 2026-05-15 구매가 뒤늦게 붙었는지 한 번 더 봅니다.**
   - 왜: 현재 가장 큰 분기점은 당일 지연인지, 데이터 제한/귀속 문제인지입니다.
   - 어디서: Meta Ads Manager > 날짜를 `2026. 5. 15` 단일일로 선택 > 열에 `구매`, `구매 전환값`, `구매 ROAS` 추가.
   - 성공 기준: 구매가 0에서 증가하면 lag가 1순위로 확정됩니다.
   - 실패 시 해석: 계속 0이면 건강/웰빙 제한 또는 Ads attribution 연결 문제로 격상합니다.
   - Codex가 대신 못 하는 이유: API read-only는 확인했지만 UI 필터/제한 경고와 화면 상태는 계정 화면에서 교차확인이 필요합니다.
   - 승인 필요 여부: 없음.
   - 의존성: 12~24시간 경과 후 재확인이 더 정확합니다.
   - 추천 점수/자신감: 94%.

2. **clean landing canary를 진행할지 결정합니다.**
   - 왜: 지금은 새 계정/새 Pixel보다 기존 계정 안에서 민감 신호를 줄인 랜딩으로 attribution gap을 줄일 수 있는지 먼저 보는 것이 안전합니다.
   - 어떻게: [04-clean-landing-experiment.md](./04-clean-landing-experiment.md)의 `실험 실행 조건`을 기준으로 기존 캠페인 일부 예산 10~20%만 3~7일 분리합니다.
   - 성공 기준: clean landing에서 내부 Meta evidence ROAS와 Ads Manager ROAS gap이 기존 랜딩보다 줄어듭니다.
   - 실패 시 해석: gap이 그대로면 랜딩 민감도보다 데이터 소스 제한/Ads attribution 자체 이슈 가능성이 커집니다.
   - Codex가 대신 못 하는 이유: 실제 광고 예산/랜딩 전환은 Meta UI와 사업 판단이 필요합니다.
   - 승인 필요 여부: Yellow/Red 성격. 실제 광고 URL/예산 변경은 TJ님 승인 필요.
   - 의존성: Claude Code가 랜딩/프론트 초안을 만들 수 있음.
   - 추천 점수/자신감: 86%.

### Codex가 할 일

1. **프론트 데이터 라벨을 `내부 Meta evidence ROAS`와 `Ads Manager ROAS`로 분리하는 handoff를 유지합니다.**
   - 왜: 내부 confirmed 기준과 광고 플랫폼 주장값을 한 카드에 섞으면 의사결정이 틀어집니다.
   - 어떻게: gpt0515-22/23 data contract와 이번 03 문서를 기준으로 Claude Code용 API 필드 설명을 보강합니다.
   - 성공 기준: 화면에서 예산 판단용 값과 참고용 값이 분리되어 보입니다.
   - 실패 시 해석: Ads Manager 0과 내부 2.x ROAS가 계속 충돌해 보입니다.
   - 승인 필요 여부: 설계는 Green, 배포는 Yellow.
   - 의존성: 없음.
   - 추천 점수/자신감: 91%.

2. **2026-05-16 오전 이후 같은 쿼리로 2026-05-15 Ads purchase 재조회합니다.**
   - 왜: 현재 결론이 lag인지 제한인지 닫히려면 동일 기준 재조회가 필요합니다.
   - 어떻게: Meta Graph Insights read-only, `time_range={since:2026-05-15, until:2026-05-15}`, action key `offsite_conversion.fb_pixel_purchase`.
   - 성공 기준: purchase/value가 생기면 lag로 판정합니다.
   - 실패 시 해석: 계속 0이면 clean landing + 데이터 최소화 + Meta UI 제한 확인을 P0로 올립니다.
   - 승인 필요 여부: 없음. Green read-only.
   - 의존성: 시간 경과.
   - 추천 점수/자신감: 95%.

## Telegram 5줄 초안

실제 전송하지 않았습니다. 기본 알림 생략 원칙에 따라 초안만 남깁니다.

```text
gpt0515-27 판정: CAPI는 정상, 2026-05-15 Ads purchase 0만 이상치입니다.
7일 Ads Manager는 184건/4,840만원을 잡고 있어 완전 단절은 아닙니다.
내부 Meta strict ROAS는 1.46x, Ads Manager ROAS는 1.69x입니다.
2026-05-15는 내부 Meta 21건/776만원인데 Ads는 0이라 지연/제한 후보입니다.
새 계정/두 번째 Pixel은 보류, clean landing 10~20% canary를 추천합니다.
```
