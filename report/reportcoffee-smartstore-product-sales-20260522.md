# reportcoffee 스마트스토어 TOP 상품 dry-run 20260522

작성 시각: 2026-05-22 20:17 KST
기준일: 2026-05-21
문서 성격: 더클린커피 스마트스토어 상품별 매출 dry-run
담당: Codex
상위 문서: [[reportcoffee]], [[reportcoffee-product-sales-design-20260522]]
JSON 산출물: `report/reportcoffee-smartstore-product-sales-20260522.json`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - data/!data_inventory.md
    - report/reportcoffee-product-sales-design-20260522.md
  lane: Green
  allowed_actions:
    - operating_db_read_only_query
    - local_json_markdown_output
    - no_send_preview_input
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: 운영DB public.tb_playauto_orders
    window: weekly 2026-05-15 - 2026-05-21 KST, month_to_date 2026-05-01 - 2026-05-21 KST, rolling_30d 2026-04-22 - 2026-05-21 KST
    freshness: max PlayAuto time 2026-05-21 14:15:23 KST
    confidence: medium_high, 단 정산 기준 확정 전 included_with_warning
```

## 10초 요약

스마트스토어는 이제 채널 총매출 옆에 TOP 상품을 붙일 수 있다.

2026-05-15 - 2026-05-21 KST 기준 스마트스토어 매출은 61행 / 66개 / 2,563,520원이다. 1위는 “더클린 진짜 방탄커피 840ml 10개” 464,600원이고, 2위는 콜롬비아 스페셜티 406,710원, 3위는 에티오피아 구지 사키소 G1 398,900원이다.

이 값은 운영DB를 쓰지 않고 읽기만 한 dry-run이다. 고객명, 전화번호, 주문번호, 결제키, 클릭 ID는 출력하지 않았다.

## 기준

- source: 운영DB `public.tb_playauto_orders`.
- filter: `shop_name='스마트스토어'`.
- 시간 기준: `pay_time`이 있으면 `pay_time`, 비어 있으면 `ord_time`.
- 상품 기준: `shop_sale_name`을 상품명으로 묶고, `shop_opt_name`은 옵션 예시로만 둔다.
- 금액 기준: `pay_amt`.
- 수량 기준: `sale_cnt`.
- 제외 기준: `ord_status`에 취소, 반품, 환불, 교환이 들어가면 제외한다.
- 판정: 정산 기준 확정 전이므로 `included_with_warning`.

## 결과

### 주간 2026-05-15 - 2026-05-21 KST

- 포함 매출: 61행 / 66개 / 2,563,520원.
- 제외 매출: 0행 / 0원.
- 상품 bucket: 10개.
- 상태값: 배송완료 1,502,520원, 구매결정 773,800원, 배송중 287,200원.
- 상품별 합계와 채널 합계 일치: PASS.

TOP 5:

1. 더클린 진짜 방탄커피 840ml 10개: 464,600원 / 2개.
2. 초신선 콜롬비아 스페셜티: 406,710원 / 13개.
3. 초신선 에티오피아 구지 사키소 G1: 398,900원 / 11개.
4. 초신선 디카페인 파푸아뉴기니: 331,910원 / 10개.
5. 초신선 케냐AA 캉고초: 323,200원 / 8개.

### 월초-기준일 2026-05-01 - 2026-05-21 KST

- 포함 매출: 202행 / 216개 / 6,731,430원.
- 제외 매출: 1행 / 0원.
- 상품 bucket: 11개.
- 상태값: 배송완료 3,233,530원, 구매결정 3,210,700원, 배송중 287,200원, 취소완료 0원 제외.
- 상품별 합계와 채널 합계 일치: PASS.

TOP 5:

1. 초신선 콜롬비아 스페셜티: 1,942,910원 / 61개.
2. 초신선 에티오피아 구지 사키소 G1: 1,128,500원 / 35개.
3. 초신선 디카페인 파푸아뉴기니: 1,012,520원 / 33개.
4. 초신선 케냐AA 캉고초: 782,800원 / 22개.
5. 더클린 진짜 방탄커피 840ml 10개: 464,600원 / 2개.

### rolling 30d 2026-04-22 - 2026-05-21 KST

- 포함 매출: 274행 / 303개 / 9,110,570원.
- 제외 매출: 1행 / 0원.
- 상품 bucket: 11개.
- 상태값: 배송완료 4,652,670원, 구매결정 4,125,700원, 배송중 332,200원, 취소완료 0원 제외.
- 상품별 합계와 채널 합계 일치: PASS.

TOP 5:

1. 초신선 콜롬비아 스페셜티: 2,697,350원 / 87개.
2. 초신선 에티오피아 구지 사키소 G1: 1,541,500원 / 48개.
3. 초신선 디카페인 파푸아뉴기니: 1,445,920원 / 48개.
4. 초신선 케냐AA 캉고초: 1,018,400원 / 29개.
5. 초신선 드립백 커피: 684,000원 / 52개.

## 기존 보고와 다른 점

이전 Slack no-send preview의 스마트스토어 주간값은 2,297,220원이었다. 이번 dry-run은 2,563,520원이다.

차이가 나는 이유는 이번 dry-run이 2026-05-21까지 fresh한 PlayAuto row를 다시 읽었기 때문이다. 특히 2026-05-21 배송중 row가 포함됐다. 이 차이는 운영DB write나 보정 때문이 아니라 source freshness 차이다.

따라서 다음 Slack preview는 스마트스토어 값을 이번 dry-run 기준으로 갱신하는 것이 맞다.

## Guardrails

- 운영DB write: 0.
- Slack send: 0.
- VM Cloud write/deploy/restart: 0.
- platform send/upload: 0.
- GTM publish: 0.
- raw 고객 식별자 출력: 0.
- raw 주문 식별자 출력: 0.
- raw 결제 식별자 출력: 0.
- raw 클릭 식별자 출력: 0.

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 62% | 64% | +2% |
| B | 더클린커피 매출 source 확인 | 93% | 95% | +2% |
| C | 더클린커피 광고비 source 확인 | 63% | 63% | +0% |
| D | 바이오컴 리포트 source map | 23% | 23% | +0% |
| E | Slack no-send 메시지 설계 | 91% | 92% | +1% |
| F | 자동화/배포 readiness | 76% | 79% | +3% |

## 다음 할일

### Codex가 할 일

1. Slack no-send preview에 스마트스토어 TOP 상품을 붙인다.
   무엇을: 스마트스토어 채널 줄 아래 TOP 3 상품을 추가한다.
   왜: 매출 증감 원인을 상품 단위로 바로 보기 위해서다.
   어떻게: `report/reportcoffee-smartstore-product-sales-20260522.json`의 weekly, month_to_date, rolling_30d `top_products`를 읽어 메시지에 넣는다.
   의존성: 없음.
   성공 기준: Slack preview에 스마트스토어 TOP 3 상품과 금액이 보이고, Slack 실제 발송은 0건이다.
   실패 시 확인점: 상품명 너무 길어 메시지 가독성이 떨어지는지 확인한다.
   승인 필요 여부: NO, Green.
   추천 점수/자신감: 92%.

2. 쿠팡 TOP 상품과 같은 형식으로 맞춘다.
   무엇을: 스마트스토어와 쿠팡의 TOP 상품 표시 형식을 통일한다.
   왜: TJ님이 채널별로 어떤 상품이 팔렸는지 같은 눈금으로 봐야 하기 때문이다.
   어떻게: 스마트스토어는 PlayAuto, 쿠팡은 TeamKeto ordersheets API 결과를 같은 `제품명: 금액 / 수량` 형식으로 표시한다.
   의존성: 쿠팡 JSON 이미 있음.
   성공 기준: 자사몰 pending, 스마트스토어 included, 쿠팡 included candidate가 한 Slack preview 안에서 분리 표시된다.
   승인 필요 여부: NO, Green.
   추천 점수/자신감: 90%.

### TJ님이 할 일

1. 당장 할 일 없음.
   이유: 스마트스토어 TOP 상품은 Codex가 read-only로 계속 붙일 수 있다.
   TJ님 확인이 필요한 시점: Slack 실제 발송 문구와 채널을 확정할 때다.
   추천 점수/자신감: 95%.
