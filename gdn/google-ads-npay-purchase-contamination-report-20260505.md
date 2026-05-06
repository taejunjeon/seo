# Google Ads NPay/구매완료 전환 오염 리포트

작성 시각: 2026-05-05 01:45 KST
대상: biocom Google Ads account `2149990943`, Google tag `AW-304339096`
문서 성격: read-only 모니터링 결과 리포트
관련 문서: [[gdn/!gdnplan]], [[GA4/gtm]], [[GA4/gtm-aw308433248-upde-pause-result-20260505]], [[total/!total]], [[docurule]]
Lane: Green read-only documentation
Mode: No-send / No-write / No-deploy / No-platform-send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docs/report/text-report-template.md
  source_window_freshness_confidence:
    google_ads_api:
      source: "/api/google-ads/dashboard"
      windows:
        - "last_7d fetched 2026-05-05 01:28:57 KST"
        - "last_30d fetched 2026-05-05 01:38:06 KST"
      account: "2149990943 바이오컴"
      confidence: 0.93
    internal_ledger:
      source: "operational_vm_ledger via /api/google-ads/dashboard internal section"
      latest_logged_at: "2026-05-04 23:58:13 KST"
      confidence: 0.84
    gtm_state:
      source: "GTM live v141 after AW-308433248 UPDE pause"
      confidence: 0.92
  allowed_actions:
    - Google Ads API read-only query
    - local API response analysis
    - documentation
  forbidden_actions:
    - Google Ads conversion action mutation
    - conversion upload
    - GTM publish
    - backend deploy
    - external platform event send
```

## 10초 결론

Google Ads의 `구매완료` 전환은 이름만 보면 정상 구매처럼 보이지만, 현재 API 기준으로는 NPay 계열 label이 primary 전환값 거의 전부를 만들고 있다.
따라서 Google Ads 화면의 ROAS는 내부 confirmed 매출 ROAS로 보면 안 된다.

최근 7일 기준 Google Ads는 `Conv. value 66,464,812원`, ROAS `15.33x`를 주장하지만, 같은 응답의 내부 운영 attribution ledger confirmed 매출은 `1,078,500원`, 내부 ROAS는 `0.25x`다.
차이의 핵심은 primary 전환 액션 `구매완료`가 `AW-304339096/r0vuCKvy-8caEJixj5EB` NPay label로 잡혀 있다는 점이다.

2026-05-05 02:27 KST 재조회에서는 `/api/google-ads/dashboard`의 internal section이 운영 VM attribution ledger 조회에 실패하고 `local_attribution_ledger`로 fallback됐다.
이 fallback 원장은 `latestLoggedAt=2026-04-12 13:13 KST`라서 최근 7일 내부 confirmed 매출 판단에 쓰면 안 된다.
따라서 최신 예산 판단은 [[google-ads-npay-quality-deep-dive-20260505]]의 Google Ads API/GA4 raw 비교와 별도 운영 원장 freshness 확인을 함께 봐야 한다.

즉 지금 문제는 "Google Ads가 매출을 잘 만들었는가"가 아니라 "Google Ads가 학습하는 구매 신호가 실제 confirmed 매출과 같은가"다.
현재 답은 아니다.

## 쉬운 설명

광고 관리자 화면은 `구매완료`라고 적힌 스탬프를 매출로 세고 있다.
그런데 그 스탬프가 실제 통장 입금이 아니라 NPay 자동/legacy 경로에서 많이 찍히고 있다.
그래서 광고 화면의 ROAS가 높아 보여도 내부 주문 장부와 맞지 않는다.

## 핵심 숫자

### 최근 7일

기간: Google Ads API `last_7d`, fetched `2026-05-05 01:28:57 KST`

| 항목 | 값 |
|---|---:|
| Google Ads cost | 4,335,480.61원 |
| Google Ads Conv. value | 66,464,812.82원 |
| Google Ads ROAS | 15.33x |
| Google Ads All conv. value | 123,370,164.77원 |
| 내부 confirmed orders | 3건 |
| 내부 confirmed revenue | 1,078,500원 |
| 내부 confirmed ROAS | 0.25x |
| Google Conv. value - 내부 confirmed revenue | 65,386,312.82원 |

### 최근 30일

기간: Google Ads API `last_30d`, fetched `2026-05-05 01:38:06 KST`

| 항목 | 값 |
|---|---:|
| Google Ads cost | 25,618,073.93원 |
| Google Ads Conv. value | 219,229,209.50원 |
| Google Ads ROAS | 8.56x |
| Google Ads All conv. value | 391,497,494.39원 |
| 내부 confirmed orders | 14건 |
| 내부 confirmed revenue | 3,704,210원 |
| 내부 confirmed ROAS | 0.14x |
| Google Conv. value - 내부 confirmed revenue | 215,524,999.50원 |

## 전환 액션별 판정

### Primary `구매완료`

- conversionAction: `7130249515`
- name: `구매완료`
- status: `ENABLED`
- category: `PURCHASE`
- primaryForGoal: `true`
- send_to: `AW-304339096/r0vuCKvy-8caEJixj5EB`
- 최근 7일 conversion value: `66,464,810.58원`
- 최근 30일 conversion value: `219,229,153.15원`
- 판정: `primary_known_npay`
- risk flags: `known_npay_label`, `primary_bid_signal_is_npay`

이 액션 하나가 Google Ads의 primary purchase value 거의 전부를 만든다.
Google Ads 자동입찰이 이 값을 purchase 학습 신호로 사용하고 있을 가능성이 높다.

### Secondary `TechSol - NPAY구매 50739`

- conversionAction: `7564830949`
- name: `TechSol - NPAY구매 50739`
- status: `ENABLED`
- category: `PURCHASE`
- primaryForGoal: `false`
- send_to: `AW-304339096/3yjICOXRmJccEJixj5EB`
- 최근 7일 all conversion value: `56,653,432.72원`
- 최근 30일 all conversion value: `169,609,088.38원`
- 판정: `secondary_known_npay`
- risk flags: `known_npay_label`, `all_conversions_only_value`

이 액션은 primary bid signal은 아니지만, `All conv. value`를 크게 부풀린다.
보고서에서 all conversion 기준 ROAS를 보면 오염이 더 커진다.

### Non-revenue primary `sign_up`

- conversionAction: `995043268`
- name: `[G4] biocom.kr (web) sign_up`
- category: `SIGNUP`
- primaryForGoal: `true`
- 최근 7일 conversion value: `2.24원`
- 최근 30일 conversion value: `56.35원`
- 판정: `non_revenue_action`
- risk flags: `non_revenue_primary_value`

금액 영향은 작지만, primaryForGoal이 true이므로 자동입찰 목표 구성에서 목적을 다시 확인해야 한다.

## 현재 결론

1. Google Ads platform ROAS는 내부 confirmed ROAS와 직접 비교하면 안 된다.
2. `구매완료` primary 액션은 confirmed purchase 정본이 아니라 NPay 계열 오염 가능성이 높은 학습 신호다.
3. `TechSol - NPAY구매 50739`는 all conversion value를 크게 키우는 secondary NPay 신호다.
4. `AW-308433248` UPDE legacy 태그 pause는 별도 이슈이며, 이번 Google Ads ROAS gap의 핵심은 현재 운영 계정 `AW-304339096` 내부 전환 액션 구성이다.
5. 바로 mutation하면 자동입찰 학습이 흔들릴 수 있으므로, 변경은 승인 문서와 롤백 계획이 있어야 한다.

## 권장 정리안

### 지금 바로 적용할 운영 판단

- Google Ads 화면의 `Conv. value`, `ROAS`, `All conv. value`를 예산 증액 근거로 쓰지 않는다.
- 예산 판단은 내부 confirmed revenue와 source freshness가 붙은 `/total` 또는 `/ads` 내부 원장 기준으로 한다.
- Google Ads 값은 `platform_reference`로만 남긴다.

### 다음 변경 후보

변경은 아직 실행하지 않는다.
아래 항목은 별도 승인 전까지 문서 후보로만 둔다.

1. `구매완료` primary 여부 재검토.
2. `TechSol - NPAY구매 50739` all conversion 보고서 노출 방식 재검토.
3. 내부 confirmed order 기반 Google Ads Offline Conversion Import 또는 별도 정본 purchase 전환 설계.
4. NPay confirmed 주문과 Google Ads NPay label의 주문 단위 대조.
5. Google Ads API 모니터링 카드에 `primary_known_npay_share`, `internal_confirmed_roas`, `platform_minus_internal` 표시.

## 하지 않은 일

- Google Ads 전환 액션을 바꾸지 않았다.
- Google Ads conversion upload를 하지 않았다.
- GTM publish를 하지 않았다.
- Meta/GA4/Google Ads로 이벤트를 보내지 않았다.
- 운영 DB write를 하지 않았다.

## 다음 할일

1. Codex: Google Ads API 모니터링 결과를 `/total` 문서의 `platform_reference` 위험 항목에 반영한다. 왜: 월별 채널 매출에서 플랫폼 주장값과 내부 confirmed 매출을 분리하기 위해서다. 어떻게: 이 문서를 [[total/!total]] 관련 문서와 Phase3-Sprint5에 링크한다. 성공 기준: Google Ads ROAS가 내부 매출로 오해되지 않는다. 컨펌 필요: NO.
2. TJ+Codex: `구매완료` primary 전환 액션을 변경할지 승인안을 따로 만든다. 왜: 자동입찰 학습에 직접 영향이 있다. 어떻게: 변경 전 7/30일 지표, affected campaigns, rollback 조건, 정본 purchase 대안이 있는지 확인한다. 성공 기준: 변경해도 학습 신호와 보고서 의미가 명확하다. 컨펌 필요: YES.
3. Codex: NPay confirmed 주문과 Google Ads NPay label을 주문 단위로 대조하는 read-only 설계를 만든다. 왜: label이 실제 confirmed NPay 주문과 얼마나 맞는지 알아야 한다. 어떻게: 운영 NPay intent source, Imweb order, Google Ads conversion action stats를 조인할 키를 문서화한다. 성공 기준: matched/unmatched/ambiguous 분포가 나온다. 컨펌 필요: 자료 접근 시 YES.
