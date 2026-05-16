# 다음 행동

작성 시각: 2026-05-16 02:30 KST

## 지금 닫은 판단

2026-05-15의 내부 ATT ROAS 2.22x는 Meta 유입 evidence 기반이다. 전체 매출 기준이 아니다.

하지만 최신 VM Cloud refresh 기준으로는 같은 날짜의 Meta 후보 매출이 더 커져 보인다. 프론트에서는 `snapshot 기준`과 `latest refresh 기준`을 혼동하지 않도록 source/window/freshness를 보여줘야 한다.

## Claude Code 프론트 구현 handoff

프론트에서 필요한 화면은 아래 4개 카드와 2개 drilldown이다.

1. `Meta 유입 후보 매출`
   - source: VM Cloud `attribution_ledger`
   - unit: confirmed purchase / KRW
   - caveat: Ads Manager 귀속값 아님
2. `Meta CAPI 전송 성공`
   - source: VM Cloud `meta-capi-sends.jsonl`
   - unit: events_received=1
   - caveat: Meta 수신 성공이지 광고 귀속 성공은 아님
3. `Ads Manager 귀속 구매`
   - source: Meta Ads Insights
   - unit: offsite_conversion.fb_pixel_purchase
   - caveat: same-day lag 또는 데이터 공유 제한 영향 가능
4. `랜딩 후보별 성과`
   - source: VM Cloud original landing candidate
   - unit: landing bucket / checkout / confirmed / CAPI
   - caveat: `/shop_payment`는 실제 광고 랜딩이 아니라 원래 랜딩 보존 실패 bucket일 수 있음

Drilldown:

- `랜딩 bucket별`: `/igg_store`, `/songyuul07`, `/hwajung01`, `/shop_view`, `/shop_payment`.
- `광고 구조별`: campaign → adset → ad. 현재 UTM에서는 `utm_content`가 ad, `utm_term`이 adset인 점을 반영해야 한다.

## Auto Green

1. **/total 또는 funnel-health API contract에 route drilldown 필드 추가**
   - 무엇을: `meta_route_drilldown`에 landing bucket, confirmed purchase, CAPI success, Ads attributed purchase를 넣는다.
   - 왜: 대표가 “Meta 구매가 어디서 왔는지” 랜딩/리뷰/광고세트 단위로 봐야 한다.
   - 어떻게: VM Cloud `attribution_ledger` + CAPI log + Meta Ads Insights read-only 집계를 API에 붙인다.
   - 누가: Claude Code 또는 Codex.
   - 성공 기준: 2026-05-15 biocom 조회 시 `/igg_store`, `/songyuul07`, `/hwajung01`이 별도 bucket으로 보인다.
   - 실패 시 확인점: original landing 후보가 없는 row가 `/shop_payment`로 과다 분류되는지 확인한다.
   - 승인 필요 여부: NO, local/backend contract 설계와 dry-run은 Green.
   - 추천 점수/자신감: 92%.
   - 의존성: 없음.

2. **Meta UTM 정규화 mapper 추가**
   - 무엇을: 숫자형 `utm_campaign/content/term`을 Meta campaign/ad/adset 이름으로 변환한다.
   - 왜: 숫자 ID만 있으면 어느 광고세트가 성과를 냈는지 사람이 판단하기 어렵다.
   - 어떻게: Meta Graph API read-only 매핑 캐시를 만들고, `utm_content=ad`, `utm_term=adset` 규칙을 적용한다.
   - 누가: Codex 또는 Claude Code.
   - 성공 기준: `120245003319500396`이 `meta_biocom_influencer_260506`으로 표시된다.
   - 실패 시 확인점: Graph API 권한/rate limit 또는 삭제된 객체 여부.
   - 승인 필요 여부: NO, read-only cache/dry-run은 Green.
   - 추천 점수/자신감: 88%.
   - 의존성: Meta API token read-only 접근.

## Approval Needed

1. **Meta 광고 URL template 표준화**
   - 무엇을: Meta 광고 destination URL의 UTM template을 ID 중심으로 표준화한다.
   - 왜: `{{campaign.id}}` literal, missing campaign, 이름형 UTM이 섞이면 Ads Manager와 내부 원장이 계속 어긋난다.
   - 어떻게: Ads Manager에서 1개 캠페인 또는 1개 광고세트 canary로 URL을 먼저 바꾼다.
   - 누가: TJ님이 Meta Ads Manager에서 변경하거나, 권한이 주어지면 Codex가 화면 기준 안내만 가능하다.
   - 성공 기준: 새 클릭이 VM Cloud에 `utm_campaign=<campaign_id>`, `utm_content=<ad_id>`, `utm_term=<adset_id>`로 들어온다.
   - 실패 시 확인점: Meta macro syntax, redirect query stripping, 아임웹 URL 보존 여부.
   - 승인 필요 여부: YES, 광고 플랫폼 설정 변경.
   - 추천 점수/자신감: 86%.
   - 의존성: 어느 캠페인/광고세트를 canary로 쓸지 TJ님 사업 판단 필요.

2. **리뷰 랜딩 clean experiment**
   - 무엇을: `/songyuul07`, `/hwajung01`, `/igg_store` 계열 중 1개를 clean landing 실험 후보로 잡는다.
   - 왜: 건강/웰빙 제한과 Ads attribution 0 문제를 줄이려면 민감 신호가 적고 UTM이 깨끗한 랜딩을 따로 비교해야 한다.
   - 어떻게: 기존 캠페인 예산 10-20%만 3-7일 분리해 ATT ROAS와 Ads ROAS를 동시에 비교한다.
   - 누가: TJ님 승인 후 Claude Code/Codex가 측정 contract와 모니터링 문서 작성.
   - 성공 기준: clean landing bucket의 internal Meta confirmed, CAPI success, Ads attributed purchase가 기존 랜딩과 분리되어 보인다.
   - 실패 시 확인점: Ads Manager same-day lag, 데이터 공유 제한, browser Purchase 0 영향.
   - 승인 필요 여부: YES, 광고 운영 변경.
   - 추천 점수/자신감: 82%.
   - 의존성: UTM 표준화 canary가 먼저 되면 측정 신뢰가 올라간다.
