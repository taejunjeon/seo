# ROAS Gap Readiness And Imweb UX Gap

작성 시각: 2026-05-13 13:05 KST  
Lane: Green read-only readiness and UX analysis.

## ROAS recompute readiness

추가 파일:

- `backend/scripts/roas-gap-recompute-readiness.ts`
- `data/project/roas-gap-recompute-readiness-20260513.json`

실행 예:

```bash
cd backend
npx tsx scripts/roas-gap-recompute-readiness.ts --output=../data/project/roas-gap-recompute-readiness-YYYYMMDD.json
```

현재 readiness는 PASS다. 다음 sprint에서 fresh Google Ads dashboard snapshot과 fresh coffee monitor를 다시 찍으면 last_7d/last_30d ROAS gap을 바로 갱신할 수 있다.

현재 기준:

- Google Ads ROAS=광고 플랫폼이 주장하는 값.
- 내부 confirmed ROAS=실제 결제완료 주문 원장 기준값.
- coffee overlay=site/source가 다른 참고 line이며, Google Ads biocom 예산 판단값이 아니다.

Latest readiness:

- last_7d: Google Ads ROAS 10.52, 내부 biocom NPay 보정 후 ROAS 3.18, 남은 gap 7.34p.
- last_30d: Google Ads ROAS 10.27, 내부 biocom NPay 보정 후 ROAS 2.07, 남은 gap 8.20p.
- coffee overlay는 `coffee_overlay_is_budget_roas=false`.

## 다음 recompute 입력

필요한 입력:

- fresh Google Ads dashboard last_7d and last_30d read-only snapshots.
- biocom actual: 운영DB PostgreSQL `dashboard.public.tb_iamweb_users` PAYMENT_COMPLETE correction.
- coffee actual: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders` monitor.
- same-window internal confirmed revenue and ad spend.
- campaign/site spend mapping before coffee can be used for budget ROAS.

금지:

- Google Ads upload/send.
- conversion action 변경.
- campaign budget 변경.

## Imweb UX gap analysis

참고한 화면:

- `project/screenshot/스크린샷 2026-05-13 오후 12.20.10.png`: 마케팅 성과 측정 UTM.
- `project/screenshot/스크린샷 2026-05-13 오후 12.21.49.png`: 유입 경로 분석 + 참고사항 drawer.
- `project/screenshot/SCR-20260513-ldlo.png`: 유입 경로 분석 chart/table.
- `project/screenshot/SCR-20260513-lejr.png`: 기존 우리 `/total`.

아임웹에서 가져올 것:

- 기간/채널/캠페인 필터가 직관적이다.
- chart 다음 table 구조가 이해하기 쉽다.
- UTM, 유입 경로, 검색어, 상품 전환, 재구매 분석이 탭으로 분리되어 있다.
- 참고사항 drawer처럼 “왜 이 숫자를 보는지”를 보조로 둘 수 있다.

아임웹에서 그대로 가져오지 않을 것:

- 플랫폼/UTM 성과를 내부 confirmed ROAS로 착각하게 만들면 안 된다.
- source freshness, status blank, budget ROAS 제외 정책이 없다.
- actual confirmed와 platform claim 분리가 없다.

우리 화면의 차별점:

- 예산 판단에 쓸 값과 참고만 볼 값을 분리한다.
- 운영DB, VM Cloud SQLite, 로컬DB, 외부 API source를 명시한다.
- NPay click이 아니라 결제완료 actual을 분리한다.
- stale/blank/blocked를 숨기지 않고 action label로 보여준다.

우선순위:

1. Source trust / internal ROAS.
2. Channel/action recommendation.
3. Product conversion.
4. Search keyword.
5. Repeat purchase.

결론: 아임웹을 복제하지 않고, 아임웹의 필터/탭/설명 구조만 가져와 내부 정본·ROAS 판단 화면에 맞게 재해석하는 쪽이 맞다.
