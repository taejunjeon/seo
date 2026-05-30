# reportcoffee dry-run 20260521

작성 시각: 2026-05-22 00:05 KST
기준 데이터 조회: 2026-05-21 23:57-23:59 KST
문서 성격: 더클린커피 주간/월간 매출액·광고비 비중 no-send dry-run
상위 문서: [[!report]], [[reportcoffee]]

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Green
  allowed_actions:
    - read_only_vm_cloud_api
    - read_only_operational_db_aggregate
    - local_report_artifact
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud public APIs + 운영DB aggregate SELECT
    window: 2026-05-15 - 2026-05-21, 2026-04-22 - 2026-05-21
    freshness: 2026-05-21 23:57-23:59 KST
    confidence: medium for dry-run, not final automated report
```

## 사람 말 결론

더클린커피 주간/월간 Slack 보고의 첫 dry-run은 만들 수 있다. 다만 지금 숫자는 “현재 안전하게 자동 산출 가능한 매출” 기준이다. 쿠팡 매출액과 일부 자사몰 결제수단 중복 제거, 네이버/구글/틱톡 광고비는 아직 빠져 있다.

정식 보고 전 가장 중요한 정정은 스마트스토어 source다. 운영DB `tb_naver_orders`는 금액은 나오지만 TOP 상품명이 바이오컴 제품이라 더클린커피 스마트스토어 매출 정본으로 쓰면 안 된다. 대신 `tb_playauto_orders shop_name='스마트스토어'`는 상품명이 더클린커피로 확인돼 이번 dry-run의 스마트스토어 후보로 사용했다.

## 주간 dry-run

기준: 2026-05-15 - 2026-05-21 KST

### 매출

| 구분 | 금액 | source | 상태 |
|---|---:|---|---|
| 자사몰 | 10,570,811원 | VM Cloud `siteConfirmedRevenue` | included with warning |
| 스마트스토어 | 2,297,220원 | 운영DB `tb_playauto_orders` | included with warning |
| 쿠팡 | 미확정 | PlayAuto 상품/수량만 확인 | source pending |
| 포함 매출 합계 | 12,868,031원 | 자사몰 + 스마트스토어 | dry-run total |

### 광고비

| 구분 | 금액 | source | 상태 |
|---|---:|---|---|
| Meta | 1,952,104원 | VM Cloud `/api/ads/site-summary?date_preset=last_7d` | included |
| Naver | 미확정 | `naver_ads_daily` 없음 | pending |
| Google | 미확정 | coffee campaign mapping 필요 | pending |
| TikTok | 미확정 | coffee campaign mapping 필요 | pending |

### 광고비 비중

```text
1,952,104 / 12,868,031 * 100 = 15.17%
```

주간 기준 광고비 비중은 현재 포함 가능한 source만 놓고 15.17%다. 쿠팡과 NPay 주간 세부 금액이 닫히면 분모가 커질 수 있어 이 값은 보수적으로 높게 보일 수 있다.

## 월간 dry-run

기준: 2026-04-22 - 2026-05-21 KST

### 매출

| 구분 | 금액 | source | 상태 |
|---|---:|---|---|
| 자사몰 | 32,661,233원 | VM Cloud `siteConfirmedRevenue` | included with warning |
| 스마트스토어 | 8,844,270원 | 운영DB `tb_playauto_orders` | included with warning |
| 쿠팡 | 미확정 | PlayAuto 상품/수량만 확인, 금액 0 | source pending |
| 포함 매출 합계 | 41,505,503원 | 자사몰 + 스마트스토어 | dry-run total |

### 광고비

| 구분 | 금액 | source | 상태 |
|---|---:|---|---|
| Meta | 3,966,919원 | VM Cloud `/api/ads/site-summary?date_preset=last_30d` | included |
| Naver | 미확정 | `naver_ads_daily` 없음 | pending |
| Google | 미확정 | coffee campaign mapping 필요 | pending |
| TikTok | 미확정 | coffee campaign mapping 필요 | pending |

### 광고비 비중

```text
3,966,919 / 41,505,503 * 100 = 9.56%
```

월간 기준 광고비 비중은 현재 포함 가능한 source만 놓고 9.56%다.

## 제품별 매출 힌트

### 자사몰

source: 운영DB `tb_sales_toss store='coffee'` cross-check. 자사몰 전체 정본으로 합산하지 않고, 제품 힌트로만 본다.

주간 TOP:

1. 더클린 진짜 방탄커피 곰팡이독소 ZERO 유기농 스페셜티: 6,474,632원
2. 더클린 진짜 방탄커피 곰팡이독소 ZERO 유기농 스페셜티 외 1개: 334,135원
3. 콜롬비아 스페셜티 200g / 500g: 277,799원

월간 TOP:

1. 더클린 진짜 방탄커피 곰팡이독소 ZERO 유기농 스페셜티: 18,137,834원
2. 콜롬비아 스페셜티 200g / 500g: 1,453,999원
3. 더클린 진짜 방탄커피 7스틱: 926,605원

### 스마트스토어

source: 운영DB `tb_playauto_orders shop_name='스마트스토어'`.

주간 TOP:

1. 더클린 진짜 방탄커피 840ml 10개: 464,600원
2. 초신선 콜롬비아 스페셜티: 369,810원
3. 초신선 에티오피아 구지 사키소 G1: 315,100원

월간 TOP:

1. 초신선 콜롬비아 스페셜티: 2,660,450원
2. 초신선 에티오피아 구지 사키소 G1: 1,457,700원
3. 초신선 디카페인 파푸아뉴기니: 1,406,020원

### 쿠팡

PlayAuto에서 더클린커피 쿠팡 상품명과 수량은 보인다. 하지만 `pay_amt=0`이라 매출액 보고에는 아직 넣지 않는다.

- 주간: 30행 / 31개, max date 2026-05-20
- 월간: 166행 / 174개, max date 2026-05-20

## source gap

자사몰은 다음 값들이 서로 다른 역할이다.

- VM Cloud `siteConfirmedRevenue` 30d: 32,661,233원. 이번 dry-run의 자사몰 primary 후보.
- VM Cloud NPay actual 30d: 15,538,800원. NPay 결제수단 진단값.
- 운영DB Toss `store=coffee` 30d: 31,444,064원. 카드/가상계좌 계열 cross-check.

NPay와 Toss를 단순 합산하면 46,982,864원이고, 스마트스토어까지 더하면 55,827,134원이다. 이때 Meta만 기준 광고비 비중은 7.11%까지 내려간다. 하지만 dedupe rule이 닫히기 전에는 정식 보고값으로 쓰지 않는다.

## 주요 유입경로

VM Cloud `/api/acquisition/channel-analysis?site=thecleancoffee`는 이번 dry-run에서 HOLD다. 이유는 더클린커피 요청 결과 상위 source에 바이오컴 캠페인명이 섞여 있었기 때문이다.

따라서 첫 Slack 보고에는 유입경로를 다음처럼 표시한다.

```text
주요 유입경로: HOLD
이유: acquisition source에 site/campaign 혼입 가능성 있음. 매출·광고비 리포트 v0.1에서는 포함하지 않음.
```

## Slack no-send 초안

```text
[더클린커피 매출·광고비 dry-run] 주간 2026-05-15 - 2026-05-21

포함 매출: 12,868,031원
포함 광고비: 1,952,104원
매출 대비 광고비: 15.17%

채널별 매출:
- 자사몰: 10,570,811원
- 스마트스토어: 2,297,220원
- 쿠팡: source pending

광고비:
- Meta: 1,952,104원
- Naver/Google/TikTok: pending

주의:
- 쿠팡 매출액은 아직 미포함
- NPay 주간 세부 금액은 API 확장 또는 VM SQLite 직접 집계 필요
- 실제 Slack 발송 0건
```

```text
[더클린커피 매출·광고비 dry-run] 월간 2026-04-22 - 2026-05-21

포함 매출: 41,505,503원
포함 광고비: 3,966,919원
매출 대비 광고비: 9.56%

채널별 매출:
- 자사몰: 32,661,233원
- 스마트스토어: 8,844,270원
- 쿠팡: source pending

광고비:
- Meta: 3,966,919원
- Naver/Google/TikTok: pending

주의:
- 자사몰 NPay actual 30d 15,538,800원과 Toss 30d 31,444,064원은 dedupe rule 확정 전 별도 진단값
- 실제 Slack 발송 0건
```

## 다음 할일

1. Codex가 자사몰 dedupe rule을 잡는다.
   무엇을: VM Cloud `siteConfirmedRevenue`, NPay actual, Toss `store=coffee`의 관계를 주문 단위 또는 결제수단 단위로 정리한다.
   왜: 자사몰 매출을 과소/중복 없이 Slack에 내보내야 하기 때문이다.
   성공 기준: 자사몰 주간/월간 매출이 결제수단별로 분해되고, 합계 rule이 한 줄로 설명된다.
   승인 필요: 없음, read-only.
   추천 점수/자신감: 86%.

2. Codex가 쿠팡 매출 source를 찾는다.
   무엇을: 더클린커피 쿠팡 vendor/source, `tb_sales_coupang.project`, PlayAuto 쿠팡 상품명 매핑을 read-only로 대조한다.
   왜: 현재 쿠팡은 수량만 있고 금액이 없어 총매출 분모가 빠진다.
   성공 기준: 쿠팡 weekly/monthly amount를 included로 넣거나, 월간 정산만 가능하다고 명시한다.
   승인 필요: 없음, read-only.
   추천 점수/자신감: 78%.

3. Codex가 Slack no-send preview v0.2를 만든다.
   무엇을: 위 숫자를 사람이 받을 Slack 메시지 2개로 다듬고 source warning을 짧게 만든다.
   왜: 실제 발송 전 TJ님이 문구와 채널을 확인해야 하기 때문이다.
   성공 기준: raw 식별자 없이 30초 안에 읽히는 주간/월간 메시지.
   승인 필요: 실제 발송 전에는 필요 없음. 발송은 별도 승인 필요.
   추천 점수/자신감: 88%.
