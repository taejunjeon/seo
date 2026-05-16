# 7일 Meta 유입 코호트 표

작성 시각: 2026-05-16 01:51 KST

## 10초 요약

2026-05-09~2026-05-15 7일 동안 Meta Ads Manager는 구매 184건 / 48,403,247원을 잡았습니다.

다만 2026-05-15 단일일만 보면 내부 Meta evidence 결제완료 21건 / 7,764,567원, CAPI 성공 19건 / 7,296,567원이 있는데 Ads Manager 구매는 0건입니다.

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| site | biocom |
| Pixel | `1283400029487161` |
| 내부 원장 source | VM Cloud SQLite `attribution_ledger` |
| CAPI source | VM Cloud Meta CAPI send log |
| Ads source | Meta Ads Insights API, `offsite_conversion.fb_pixel_purchase` |
| window | 2026-05-09 00:00 KST ~ 2026-05-15 23:59 KST |
| freshness | VM Cloud checked 2026-05-16 01:42 KST, Meta Ads API checked 2026-05-16 01:51 KST |
| confidence | medium_high |

## 날짜별 코호트

용어:

- `Meta LPV`: Meta Ads Manager의 랜딩 페이지 조회. 광고 플랫폼이 본 상단 유입입니다.
- `VM Meta landing`: VM Cloud `site_landing_ledger`에서 Meta-like로 분류된 유입입니다. 2026-05-11 이후부터 신뢰도가 올라갑니다.
- `Meta checkout`: VM Cloud `attribution_ledger`에서 Meta source로 분류된 결제 시작입니다.
- `payment_page_seen`: 결제 페이지 진입 진단 이벤트입니다. 2026-05-15 v4.4 이후 본격 수집됐습니다.
- `내부 Meta confirmed`: 실제 결제완료 중 fbclid 또는 Meta/Instagram/Facebook UTM/source가 있는 주문입니다.
- `Meta evidence CAPI`: 내부 Meta confirmed 중 Meta CAPI `events_received=1`로 확인된 주문입니다.

| 날짜 | Meta LPV | VM Meta landing | Meta checkout | payment_page_seen | 내부 Meta confirmed | 내부 Meta 매출 | Meta evidence CAPI | CAPI 매출 | Ads purchase | Ads value | Spend | 내부 ATT ROAS | Ads ROAS | gap |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026-05-09 | 3,570 | n/a | 24 | 0 | 11 | 3,347,160 | 11 | 3,347,160 | 27 | 7,516,994 | 3,887,978 | 0.86x | 1.93x | -1.07p |
| 2026-05-10 | 3,873 | n/a | 51 | 0 | 25 | 6,938,806 | 25 | 6,938,806 | 37 | 9,228,620 | 4,216,534 | 1.65x | 2.19x | -0.54p |
| 2026-05-11 | 2,948 | 37 | 28 | 0 | 13 | 3,798,000 | 13 | 3,798,000 | 33 | 8,701,801 | 4,361,803 | 0.87x | 2.00x | -1.12p |
| 2026-05-12 | 3,455 | 151 | 43 | 0 | 25 | 6,904,718 | 25 | 6,904,718 | 44 | 10,238,689 | 4,866,614 | 1.42x | 2.10x | -0.68p |
| 2026-05-13 | 4,148 | 151 | 50 | 0 | 21 | 7,858,593 | 21 | 7,858,593 | 41 | 12,249,143 | 4,251,660 | 1.85x | 2.88x | -1.03p |
| 2026-05-14 | 3,656 | 205 | 44 | 0 | 17 | 5,357,380 | 11 | 3,419,380 | 2 | 468,000 | 3,587,212 | 1.49x | 0.13x | +1.36p |
| 2026-05-15 | 3,320 | 243 | 51 | 109 | 21 | 7,764,567 | 19 | 7,296,567 | 0 | 0 | 3,500,934 | 2.22x | 0.00x | +2.22p |
| **합계** | **24,970** | **787+** | **291** | **109** | **133** | **41,969,224** | **125** | **39,563,224** | **184** | **48,403,247** | **28,672,735** | **1.46x** | **1.69x** | **-0.22p** |

## 읽는 법

2026-05-09~2026-05-13에는 Ads Manager ROAS가 내부 Meta evidence ROAS보다 높습니다. 이것은 Meta가 우리 내부 evidence보다 더 넓은 클릭/노출 기여를 자기 방식으로 잡았다는 뜻입니다.

2026-05-14부터 역전됩니다. 특히 2026-05-15는 내부 결제완료와 CAPI가 있는데 Ads Manager 구매가 0입니다. 이 구간이 현재 incident의 핵심입니다.

## Caveat

- VM Cloud `site_landing_ledger`는 2026-05-11 이후 관측 신뢰가 높습니다. 2026-05-09~10의 VM Meta landing은 `n/a`로 둡니다.
- `payment_page_seen`은 Footer v4.4 이후 진단 이벤트입니다. 2026-05-15에만 유의미하게 보입니다.
- `내부 ATT ROAS`는 내부 Meta evidence 매출 / Meta spend입니다. Meta Ads Manager가 주장하는 ROAS와 합산하지 않습니다.
- raw order/payment/member/click id는 출력하지 않았습니다.
