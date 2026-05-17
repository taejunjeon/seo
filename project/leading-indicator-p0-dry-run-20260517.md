# Leading Indicator Agent P0 Dry-run

작성 시각: 2026-05-17 15:44 KST
문서 성격: P0 source inventory + aggregate cohort dry-run
Lane: Green read-only

## 10초 요약

- P0-1 source inventory는 로컬 산출물 기준으로 30%에서 65%까지 올릴 수 있다.
- P0-2 cohort는 VM Cloud aggregate 기준으로 15%에서 35%까지 올릴 수 있다.
- 체류시간/스크롤/회원가입은 아직 GA4/GTM/VM Cloud route join이 필요하다.
- 프론트엔드 개발은 Claude Code가 담당하고, Codex는 API/data contract와 dry-run 산출물을 제공한다.

## Source Matrix

| 지표 | 상태 | primary source | 1d | 7d | confidence | blocker |
|---|---|---|---:|---:|---|---|
| 유입 | available | VM Cloud site_landing_ledger | 1604 | 10720 | high |  |
| 장바구니 페이지 진입 | available | VM Cloud site_landing_ledger landing_path=/shop_cart | 6 | 29 | high_for_page_seen_medium_for_click |  |
| 결제 시작 | available | VM Cloud attribution_ledger checkout_started + payment_page_seen | 477 | 2250 | medium_high |  |
| 결제수단 선택 | source_gap | VM Cloud payment_page_seen metadata selected_payment_method | 0 | 0 | low | source_freshness_gap |
| 실제 결제완료 | available | VM Cloud attribution_ledger confirmed payment_success | 53 | 388 | medium_high |  |
| Meta CAPI 성공 | available | VM Cloud Meta CAPI send log, Pixel filtered | 53 | 376 | high_for_send_medium_for_ads_attribution |  |
| 평균 체류시간 | needs_ga4_join | GA4 BigQuery engagement_time_msec |  |  | medium_when_ga4_available | 권한 부족 또는 source join 필요 |
| 50% 스크롤 | source_exists_route_gap | GTM scrollDepth trigger exists; VM Cloud route not wired |  |  | medium_for_source_low_for_vm | route 미구현 |
| 회원가입 완료 | source_exists_route_gap | GTM GA4 sign_up tag |  |  | medium | route 미구현 |
| YouTube 콘텐츠 유입 | source_gap | UTM/referrer classification needed |  |  | low | 필터 불일치 |

## Cohort Baseline

| source | 7d landing | 7d purchase | 7d purchase rate | 7d CAPI coverage | 해석 |
|---|---:|---:|---:|---:|---|
| 전체 | 10720 | 388 | 3.62% | 96.91% | VM Cloud funnel-health aggregate 기준 baseline. |
| Meta 광고 유입 증거 | 913 | 155 | diagnostic only | source filter gap | Meta evidence가 있는 유입의 구매 전 funnel diagnostic. source별 단계는 같은 모집단 전환율이 아니므로 구매 예고 후보만 본다. |
| Google 광고 유입 증거 | 8437 | 6 | diagnostic only | source filter gap | VM Cloud funnel-health aggregate 기준 baseline. |
| Naver 유입 증거 | 353 | 44 | diagnostic only | source filter gap | VM Cloud funnel-health aggregate 기준 baseline. |
| 오가닉/추천 유입 | 6 | 103 | diagnostic only | source filter gap | 오가닉/추천 유입 diagnostic. 검색어/콘텐츠별 선행지표는 GA4/Search source join이 필요. |
| 직접 유입 | 744 | 0 | diagnostic only | source filter gap | VM Cloud funnel-health aggregate 기준 baseline. |
| UTM 있음, 채널 미분류 | 271 | 274 | diagnostic only | source filter gap | UTM은 있으나 channel rule이 닫히지 않은 bucket. naming rule 개선 후보. |
| UTM 없음 | 0 | 114 | diagnostic only | source filter gap | VM Cloud funnel-health aggregate 기준 baseline. |

## Claude Code Frontend Handoff

- route 후보: `/ai-crm/leading-indicators`
- 첫 화면 카드: 구매 전 강한 신호, Meta 구매자 vs 이탈자, scroll/dwell source gap, 회원가입 후보, YouTube/오가닉 후보, 오늘 실험 추천
- 화면은 `source`, `window`, `freshness`, `confidence`, `blocker_category`를 항상 보여준다.

## 금지선

- Meta CAPI 운영 send 0
- GTM Production publish 0
- 운영DB write/import 0
- VM Cloud deploy/restart 0
- raw identifier output 0
