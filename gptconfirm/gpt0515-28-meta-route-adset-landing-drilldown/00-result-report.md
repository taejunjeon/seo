# 2026-05-15 Meta 유입 ROAS와 랜딩/광고세트 분해

작성 시각: 2026-05-16 02:30 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
  required_context_docs:
    - gptconfirm/gpt0515-27-meta-cohort-clean-landing/01-seven-day-meta-cohort.md
    - gptconfirm/gpt0515-27-meta-cohort-clean-landing/03-att-roas-vs-ads-roas-gap.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only aggregate
    - VM Cloud Meta CAPI send log read-only aggregate
    - Meta Ads Insights read-only query
    - gptconfirm documentation
  forbidden_actions:
    - Meta send/backfill
    - VM Cloud deploy/restart
    - 운영DB write/import
    - GTM publish
    - raw order/payment/member/click id output
  source_window_freshness_confidence:
    source: VM Cloud attribution_ledger + VM Cloud meta-capi-sends.jsonl + Meta Graph API read-only
    window: 2026-05-15 00:00-23:59 KST
    freshness: 2026-05-16 02:27-02:30 KST
    confidence: medium_high
```

## 10초 요약

2026-05-15의 `내부 ATT ROAS 2.22x`는 전체 매출 기준이 아니라 Meta 유입 evidence가 있는 실제 결제완료 매출만 Meta spend로 나눈 값이다. 즉, “Meta 유입만 기반인가?”라는 질문에는 **맞다**고 답할 수 있다.

다만 이 값은 gpt0515-27 작성 시점의 frozen snapshot이다. 2026-05-16 02:30 KST에 VM Cloud를 다시 읽으면 late confirmed/CAPI row가 더 붙어 같은 날짜의 최신 Meta 후보 매출은 더 커져 보인다. 예산 화면에는 반드시 `snapshot 기준값`과 `latest refresh 기준값`을 분리해야 한다.

## 확인한 것

- `2.22x` 계산 기준을 재확인했다.
  - gpt0515-27 frozen snapshot: 내부 Meta evidence 결제완료 21건 / 7,764,567원, Meta spend 3,500,934원, 내부 ATT ROAS 2.22x.
  - 의미: Meta 광고/소셜 유입 evidence가 있는 실제 결제완료만 포함한다. 전체 바이오컴 매출이나 전체 CAPI 성공 매출이 아니다.
- 2026-05-15 최신 VM Cloud read-only refresh로 랜딩 후보를 다시 분해했다.
  - 최신 Meta 후보 결제완료: 24건 / 8,514,567원.
  - 최신 Meta 후보 중 CAPI 성공: 21건 / 7,801,567원.
  - Ads Manager attributed purchase: 0건 / 0원.
- 숫자형 UTM bucket을 Meta Graph API로 이름 매핑했다.
  - 핵심 캠페인: `meta_biocom_influencer_260506`, `공동구매 인플루언서 파트너 광고 모음_3 (260323)`, `meta_biocom_acid_260504`.
  - UTM 구조상 `utm_content` 숫자는 실제로 ad, `utm_term` 숫자는 adset인 케이스가 많다.

## 핵심 해석

2026-05-15에는 내부 원장에서 Meta 후보 구매와 CAPI 성공은 보인다. 하지만 Meta Ads Manager의 같은 날짜 purchase-family action key는 0이다. 따라서 문제는 “Meta 유입 구매가 아예 없다”가 아니라, “내부 evidence/CAPI와 Ads attribution 사이가 당일 기준으로 끊겨 보인다”에 가깝다.

리뷰/인플루언서 랜딩 후보는 `/igg_store`, `/songyuul07`, `/hwajung01` 세 축이 가장 중요하다. 최신 refresh 기준으로 이 세 bucket만 합치면 14건 / 4,524,500원이고, CAPI 성공은 12건 / 4,045,500원이다.

## 하지 않은 것

- Meta 운영 Purchase 전송 또는 backfill: 하지 않음.
- VM Cloud 배포/restart: 하지 않음.
- 운영DB write/import: 하지 않음.
- GTM publish: 하지 않음.
- raw order/payment/member/click id 출력: 하지 않음.

## 검증 결과

- VM Cloud SQLite `attribution_ledger` read-only aggregate PASS.
- VM Cloud `meta-capi-sends.jsonl` read-only aggregate PASS.
- Meta Graph API read-only campaign/adset/ad mapping PASS.
- Meta Ads Insights 2026-05-15 read-only 확인: purchase-family action 0, spend 3,500,951원.
- 문서 raw identifier scan PASS: 주문번호/결제키/클릭 ID/회원키 출력 없음.

## 현재 영향

코드, 서버, 외부 플랫폼 설정을 바꾸지 않았다. 이번 작업은 분석 문서만 추가한 Green Lane이다.

## 남은 리스크

- gpt0515-27의 2.22x는 당시 snapshot이고, 최신 VM Cloud refresh와 숫자가 다르다. 프론트에서는 기준 시각과 refresh 여부를 같이 보여줘야 한다.
- Ads Manager는 랜딩 bucket별 attributed purchase를 직접 주지 않는다. 랜딩별 Ads purchase는 2026-05-15에 전체 Ads purchase가 0이라 모두 0으로만 말할 수 있다.
- `{{campaign.id}}` 같은 template literal이 일부 남아 있어 UTM 표준화가 필요하다.

## 확인하면 좋은 문서

1. `01-landing-bucket-drilldown.md`
   왜 봐야 하나: Meta 유입 구매가 어느 랜딩 후보에서 왔는지 바로 볼 수 있다.
2. `02-campaign-adset-normalization.md`
   왜 봐야 하나: 숫자형 UTM bucket을 실제 Meta 캠페인/광고/광고세트 이름으로 바꾼 결과다.
3. `03-next-actions.md`
   왜 봐야 하나: Claude Code 프론트 구현과 Meta UTM 정리에서 무엇을 해야 하는지 정리했다.
