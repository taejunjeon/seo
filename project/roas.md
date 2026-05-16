harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green read-only analysis
  allowed_actions:
    - VM Cloud API read-only
    - Meta Ads Insights read-only
    - local document write
  forbidden_actions:
    - Meta/Google/GA4/TikTok/Naver send/upload
    - 운영DB write/import
    - VM Cloud deploy/restart
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud attribution ledger + Meta Ads Insights API
    window: 2026-05-09~2026-05-15 KST
    freshness: 2026-05-16 18:19 KST
    confidence: biocom B+, thecleancoffee C+

# 최근 7일 ROAS 비교

작성 시각: 2026-05-16 18:19 KST

## 10초 요약

최근 7일 기준으로 바이오컴은 내부 ATT ROAS와 Meta가 주장하는 ROAS 차이가 크지 않다. 내부 ATT ROAS는 1.49배, Meta 주장 ROAS는 1.69배다.

더클린커피는 차이가 크다. 내부 ATT ROAS는 1.14배인데 Meta 주장 ROAS는 4.29배다. 이 차이는 더클린커피 광고가 실제로 무조건 좋다는 뜻이 아니라, 내부 campaign/UTM 매핑이 Meta가 주장하는 구매를 충분히 따라가지 못하고 있을 가능성이 크다는 뜻이다.

## 용어

- 내부 ATT ROAS: VM Cloud 유입/결제 원장 기준으로 Meta 광고 evidence가 붙은 결제완료 매출을 광고비로 나눈 값이다. 예산 판단에 더 가깝다.
- 매체 주장 ROAS: Meta Ads Manager가 자기 attribution window로 광고에 귀속했다고 주장하는 구매값을 광고비로 나눈 값이다. 참고용 비교값이다.
- 유입자: 이 문서에서는 Meta Ads Insights의 `landing_page_view`를 기본 유입자로 쓴다. VM Cloud site_landing 유입 row는 현재 site별 수집 범위가 다르므로 보조 지표로만 둔다.

## 비교표

| 사이트 | 광고비 | 매체 유입자 | 내부 ATT 결제자 | 내부 ATT 결제금액 | 내부 ATT ROAS | 매체 주장 결제자 | 매체 주장 결제금액 | 매체 주장 ROAS | 차이 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 바이오컴 | ₩28,675,457 | 24,972 | 137 | ₩42,661,724 | 1.49x | 184 | ₩48,403,247 | 1.69x | 매체가 +0.20p 높음 |
| 더클린커피 | ₩1,709,214 | 993 | 33 | ₩1,942,126 | 1.14x | 133 | ₩7,327,031 | 4.29x | 매체가 +3.15p 높음 |

## 전체 결제 흐름 참고

아래는 Meta 광고에만 귀속한 값이 아니라, VM Cloud 원장에 잡힌 사이트 전체 결제 흐름이다.

| 사이트 | 결제 시작 row | 전체 결제완료자 | 전체 결제금액 | Meta CAPI 성공 | Browser Purchase |
|---|---:|---:|---:|---:|---:|
| 바이오컴 | 1,928 | 381 | ₩102,019,941 | 368 | 0 |
| 더클린커피 | 830 | 322 | ₩20,014,792 | 320 | 0 |

해석:

- 두 사이트 모두 Server CAPI는 대부분 살아 있다. 바이오컴은 전체 결제완료 381건 중 368건, 더클린커피는 322건 중 320건이 CAPI 성공이다.
- Browser Purchase는 현재 직접 관측 0이다. 현재 예산 판단은 Server CAPI와 VM Cloud 원장을 중심으로 봐야 한다.
- 더클린커피는 VM Cloud funnel의 landing count가 0으로 잡힌다. 유입 단계 장부가 약해 ROAS 경로 설명력이 낮다.

## 사이트별 판단

### 바이오컴

현재 내부 ATT ROAS 정확도 의견: **78%**

이유:

- 좋은 점: VM Cloud 원장 freshness가 좋고, Meta CAPI 성공률이 높다. 최근 7일 전체 결제완료 381건 중 CAPI 성공 368건이다.
- 좋은 점: 내부 ATT 결제금액 ₩42,661,724와 Meta 주장 결제금액 ₩48,403,247 차이가 13.5% 수준이다.
- 불안한 점: Browser Purchase 직접 관측이 0이다.
- 불안한 점: VM Cloud 유입 row는 133으로, Meta landing_page_view 24,972와 단위가 다르다. 유입자 수는 아직 Meta 쪽을 참고해야 한다.

판단:

바이오컴 ATT ROAS 1.49x는 예산 판단에 사용할 수 있다. 다만 Meta 주장 ROAS 1.69x보다 보수적으로 보는 것이 맞다.

### 더클린커피

현재 내부 ATT ROAS 정확도 의견: **58%**

이유:

- 좋은 점: 전체 결제완료 322건 중 CAPI 성공 320건으로 결제완료 신호 전송 자체는 강하다.
- 좋은 점: Imweb/VM Cloud actual source가 붙어 있어 결제금액 자체는 과거보다 훨씬 낫다.
- 불안한 점: 내부 ATT 결제자 33건인데 Meta 주장 결제자는 133건이다. 매체 주장이 내부 ATT보다 4배 많다.
- 불안한 점: 내부 ATT 결제금액 ₩1,942,126인데 Meta 주장 결제금액은 ₩7,327,031이다. 매체 주장이 3.77배 높다.
- 불안한 점: VM Cloud funnel의 landing count가 0이고, UTM 있음 기타 bucket에 결제완료 230건이 몰려 있다.

판단:

더클린커피 ATT ROAS 1.14x는 현재 “보수적 하한값”으로 보는 것이 맞다. 실제 Meta 기여가 더 높을 수 있지만, 지금 상태에서 4.29x를 예산 판단값으로 그대로 쓰기는 위험하다.

## 개선 방법

### 1. 더클린커피 UTM/campaign 매핑 보강

무엇을 하는가:

- `utm_present 기타`에 몰린 더클린커피 결제완료 230건을 campaign/adset/ad 단위로 다시 분류한다.

왜 필요한가:

- 이 bucket이 풀리지 않으면 내부 ATT ROAS가 실제보다 낮게 보일 수 있다.

성공 기준:

- 더클린커피 내부 ATT 결제자 33건이 Meta 주장 133건에 가까워지는지 확인한다.
- 단, Meta 주장값을 그대로 베끼는 것이 아니라 VM Cloud 결제완료 원장과 광고 evidence가 같이 닫힌 주문만 올린다.

### 2. Meta attribution window 분해

무엇을 하는가:

- 1d click, 7d click, 1d view를 나눠서 매체 주장 ROAS를 다시 본다.

왜 필요한가:

- Meta 주장 ROAS가 높은 이유가 클릭 구매인지, view-through 구매인지 분리해야 한다.

성공 기준:

- 더클린커피 4.29x 중 몇 배가 클릭 기반이고 몇 배가 view 기반인지 보인다.

### 3. landing source 보강

무엇을 하는가:

- 더클린커피 VM Cloud landing row가 0으로 잡히는 원인을 확인한다.

왜 필요한가:

- 유입자 → 결제 시작 → 결제완료 funnel이 끊겨 있으면 ROAS가 맞아도 운영자가 왜 맞는지 이해하기 어렵다.

성공 기준:

- 더클린커피도 Meta landing_page_view 993과 비교 가능한 VM Cloud 유입 장부가 생긴다.

### 4. Browser Purchase 관측 복구

무엇을 하는가:

- Server CAPI와 별도로 Browser Purchase가 실제로 보이는지 계속 복구한다.

왜 필요한가:

- Server CAPI가 살아 있어도 Browser Purchase가 0이면 Meta 이벤트 관리자 화면에서 사람이 보는 신호가 약해 보이고, dedup 품질 확인이 어렵다.

성공 기준:

- Browser Purchase가 실제 완료 주문에서만 보이고, CAPI와 event_id 기준으로 중복 제거된다.

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| window | 2026-05-09~2026-05-15 KST |
| 내부 ATT source | VM Cloud `/api/ads/roas-summary`, VM Cloud attribution ledger |
| funnel source | VM Cloud `/api/attribution/funnel-health?window=7d` |
| 매체 주장 source | Meta Graph API v22.0 Ads Insights, level=account, `date_preset=last_7d`, `action_report_time=conversion`, unified attribution setting |
| freshness | 2026-05-16 18:09~18:19 KST read-only 조회 |
| confidence | 바이오컴 B+, 더클린커피 C+ |

## 금지선 준수

- Meta CAPI Purchase send/backfill: 0.
- Google/GA4/TikTok/Naver send/upload: 0.
- 운영DB write/import: 0.
- VM Cloud deploy/restart: 0.
- GTM publish: 0.
- raw identifier output: 0.

## 결론

바이오컴은 내부 ATT ROAS를 예산 판단값으로 써도 된다. 현재는 Meta 주장보다 약간 보수적인 1.49x로 보는 것이 안전하다.

더클린커피는 내부 ATT ROAS를 “하한값”으로만 써야 한다. 매체 주장은 4.29x지만, 내부 매핑이 58% 수준으로만 닫혀 있어 UTM/campaign mapping을 보강한 뒤 다시 판단해야 한다.
