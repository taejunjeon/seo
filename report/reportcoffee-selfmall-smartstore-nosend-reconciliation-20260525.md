# 더클린커피 자사몰 no-send 기준 전환과 스마트스토어 엑셀 대조

작성: 2026-05-25 23:43 KST  
범위: 2026-04-25 - 2026-05-01 KST  
모드: read-only, no-send, no-write

## 한 줄 결론

자사몰 no-send JSON은 기존 `Toss+NPay` 추정 합산에서 아임웹 결제/주문 기간 안의 `complete_time` 존재 주문 기준으로 연결했고, 해당 금액은 Excel 자사몰 매출 5,334,362원과 정확히 맞았다. 스마트스토어는 현재 VM Cloud 원장이나 커피 전용 네이버 직접 API로는 재현하지 못했고, 운영DB PlayAuto 기준으로 Excel보다 65,800원 / 2건 낮다.

## 자사몰 기준

이번에 쓰는 자사몰 기준은 “아임웹 결제/주문 기간 안에 들어오고 `complete_time`이 존재하는 유상 비취소 주문”이다. 여기서 `complete_time`은 결제완료가 확인된 주문이라는 필터이고, 날짜 자르기는 기존 주간 보고서와 맞추기 위해 아임웹 결제/주문 시각 기준을 사용한다.

- no-send JSON: `report/reportcoffee-sales-summary-no-send-20260501-imweb-complete-time.json`
- source basis: `imweb_paid_at_window_complete_time_present_v1`
- no-send 자사몰: 5,334,362원 / 125건
- Excel 자사몰: 5,334,362원 / 128건
- 금액 차이: 0원
- 건수 차이: -3건
- 기존 `Toss+NPay` 참고값: 5,215,298원, Excel 대비 -119,064원

중요한 해석:

- `complete_time` 날짜 자체로 2026-04-25 - 2026-05-01을 자르면 4,557,236원 / 109건이다. 이 값은 기존 Excel 기준을 재현하지 못하므로 Slack no-send의 primary로 쓰지 않는다.
- `complete_time`이 빈 주문 5건 / 183,826원은 미결제 증거가 아니다. 보고 기준에서 제외된 진단값으로만 둔다.
- 건수 125건과 Excel 128건 차이는 주문 기준/상품 행 기준/결제 행 기준 차이일 가능성이 있어 F&B팀 확인 전까지 `count pending`으로 표시한다.

## 스마트스토어 대조

Excel에는 더클린커피 네이버/스마트스토어 매출이 1,905,140원 / 55건으로 들어 있다. 현재 자동 조회로 가장 가까운 source는 운영DB `public.tb_playauto_orders`의 `shop_name='스마트스토어'`이다.

- Excel 스마트스토어: 1,905,140원 / 55건
- PlayAuto 스마트스토어: 1,839,340원 / 53 rows / 64개
- 차이: -65,800원 / -2 rows
- 차이율: -3.45%

PlayAuto 상태별 구성:

- 배송완료: 34 rows / 45개 / 1,179,540원
- 구매결정: 18 rows / 18개 / 614,800원
- 배송중: 1 row / 1개 / 45,000원

판정은 `available_via_playauto_with_excel_gap`이다. 즉, 자동 보고 후보로는 쓸 수 있지만 Excel과 완전히 같다고 말하면 안 된다. Slack no-send에는 “PlayAuto 기준, Excel 대비 65,800원 / 2건 차이 있음”이라는 경고를 붙이는 것이 맞다.

## API와 VM Cloud 확인

VM Cloud SQLite에서 스마트스토어/PlayAuto/Commerce 성격의 주문 원장 테이블을 찾았지만, 주문·매출 원장은 없고 Naver 광고 테이블만 확인됐다.

- 발견된 VM Cloud 테이블: `naver_ads_daily`, `naver_brandsearch_manual_cost_daily`
- 스마트스토어 주문/매출 원장: 발견 안 됨

운영DB에는 네이버 관련 테이블이 있지만 더클린커피 primary로 쓰기 어렵다.

- `tb_naver_orders`: 네이버 Commerce API 성격의 원본처럼 보이나, `channel`이 비어 있고 상위 상품이 바이오컴/영양제 상품이라 더클린커피 스마트스토어 primary로 부적합
- `tb_sales_naver_vat`: 2026-04-25 - 2026-05-01 window에 `sub_channel=바이오컴`, `project=영양제/검사권`만 확인되어 더클린커피 primary로 부적합
- `tb_playauto_orders`: 더클린커피 스마트스토어 상품명이 확인되므로 현재 best available source

## Track 진척률

- Track A: 82% -> 85% (+3%)
- Track B: 100% -> 100% (+0%)
- Track C: 100% -> 100% (+0%)
- Track D: 74% -> 74% (+0%)
- Track E: 100% -> 100% (+0%)
- Track F: 100% -> 100% (+0%)

## 다음 할 일

1. 스마트스토어 65,800원 / 2건 차이를 F&B팀에 확인한다.
   - 무엇을: Excel의 네이버/스마트스토어 1,905,140원 / 55건 산출 기준이 주문 기준인지, 정산 기준인지, 수동 보정 포함인지 확인한다.
   - 왜: PlayAuto 자동 집계가 1,839,340원 / 53 rows로 65,800원 낮기 때문이다.
   - 성공 기준: Excel에 포함된 2건 또는 조정금액의 source가 확인된다.

2. Slack no-send 미리보기에 selfmall source label을 바꾼다.
   - 무엇을: 자사몰 라벨을 `Imweb complete_time present 기준`으로 표시한다.
   - 왜: 더 이상 Toss+NPay 합산값이 자사몰 primary가 아니기 때문이다.
   - 성공 기준: 미리보기 JSON과 메시지 본문에서 자사몰 금액 5,334,362원이 Excel과 일치하고, legacy split은 참고값으로만 보인다.

3. 스마트스토어 API 경로는 보류하고 PlayAuto 경로를 우선 운영한다.
   - 무엇을: 네이버 직접 API/VM Cloud 주문 원장 확보 전까지 PlayAuto를 primary 후보로 둔다.
   - 왜: 현재 발견된 네이버 직접 원장은 더클린커피 상품 기준으로 분리되지 않는다.
   - 성공 기준: Slack 보고에 source warning이 남고, 숫자가 임의로 Excel에 맞춰지지 않는다.
