# Frontend ROAS Source Check

작성 시각: 2026-05-15 23:24 KST

## 결론

Claude frontend의 today ROAS 카드가 “Ads Manager ROAS”처럼 보이는 것은 source label 문제다.

실제 frontend 코드가 호출하는 API는 `/api/meta/insights`가 아니라 `/api/ads/roas`다. 이 API는 Meta Ads spend를 가져오지만, 주문/매출 분자는 VM Cloud 내부 attribution ledger의 Meta 귀속 주문이다.

## 확인한 코드

Frontend:

- file: `frontend/src/app/ai-crm/conversion-funnel/page.tsx`
- function: `loadMetaRoas`
- call: `${API_BASE}/api/ads/roas?account_id=...&date_preset=today`
- UI label: `Meta Ads Manager ROAS`

Backend:

- file: `backend/src/routes/ads.ts`
- route: `/api/ads/roas`
- spend source: Meta Insights campaign spend
- revenue/orders source: VM Cloud attribution ledger normalized orders
- summary fields: `attributedRevenue`, `orders`, `roas`

## Live result

`/api/ads/roas?account_id=act_3138805896402376&date_preset=today`

- spend: 3,382,987원
- attributedRevenue: 7,046,067원
- orders: 19건
- ROAS: 2.08x
- general ROAS: 2.09x / 16건
- coop ROAS: 2.01x / 3건

이 값은 Ads Manager purchase 0건과 충돌하는 것이 아니다. 서로 다른 source다.

## 프론트 수정 권장

화면 문구를 아래처럼 나눠야 한다.

1. `내부 Meta 귀속 ROAS`
   - source: VM Cloud attribution ledger + Meta spend
   - 오늘 값: 2.08x / 19건
   - 의미: 내부 기준으로 Meta 유입 evidence가 있는 실제 결제완료 매출

2. `Ads Manager 귀속 ROAS`
   - source: Meta Ads Insights API purchase/action_values
   - 오늘 값: 0건 / 0원 / ROAS 없음
   - 의미: Meta 광고 플랫폼이 자기 성과로 표시한 값

## Confidence

- source mismatch: high
- UI label bug: high
- today ROAS 값 자체: medium-high, because source is internal attribution and can change as VM Cloud receives more rows
