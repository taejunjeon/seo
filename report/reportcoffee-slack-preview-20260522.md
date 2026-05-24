# reportcoffee Slack no-send preview 20260522

작성 시각: 2026-05-22 20:35 KST
기준일: 2026-05-21
문서 성격: 더클린커피 주간·rolling 30d Slack no-send preview
담당: Codex
관련 문서: [[reportcoffee]], [[reportcoffee-okr-action-plan-20260522]], [[reportcoffee-vm-cloud-npay-weekly-actual-20260522]], [[reportcoffee-smartstore-product-sales-20260522]], [[reportcoffee-google-ads-spend-mapping-20260523]]

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
    - report/reportcoffee.md
    - report/reportcoffee-okr-action-plan-20260522.md
  lane: Green
  allowed_actions:
    - no_send_preview
    - read_only_api_aggregate
    - local_json_markdown_output
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud NPay actual + operational aggregate docs + Coupang TeamKeto ordersheets + Meta spend prior probe
    window: weekly 2026-05-15 - 2026-05-21 KST, rolling_30d 2026-04-22 - 2026-05-21 KST
    freshness: NPay and Coupang fresh through 2026-05-21, Naver API reachable but coffee cache empty/campaign paused, Google Ads checked 2026-05-23, TikTok currently not running by TJ님 confirmation
    confidence: medium_high for sales strict, medium_high for total ad spend with Meta included and Naver/Google/TikTok zero candidates
```

## 10초 요약

더클린커피 Slack 보고는 지금 no-send preview까지 가능하다.

주간 strict 매출은 16,913,442원이고 Meta 광고비는 1,952,104원이다. 그래서 현재 포함 가능한 광고비 기준 매출 대비 광고비는 11.54%다. rolling 30d strict 매출은 60,511,234원이고 Meta 광고비는 3,966,919원이라 매출 대비 광고비는 6.56%다.

이번 업데이트로 스마트스토어 줄 아래에 TOP 상품 3개를 붙였고, Google/TikTok 광고비 상태를 `pending`에서 0원 후보로 정리했다. TOP 상품은 운영DB PlayAuto(여러 판매 채널 주문을 모아 둔 운영DB 수집 원천)의 상품명, 수량, 금액을 read-only로 집계한 값이다.

## Preview 기준

strict 매출은 더클린커피로 분류 가능한 금액만 합산한다.

- 자사몰: Toss 계열 + NPay actual
- 스마트스토어: PlayAuto 스마트스토어
- 쿠팡: TeamKeto 계정 중 coffee hint 상품만 strict 합산

TeamKeto 계정 전체에는 팀키토 상품이 섞여 있어 별도 참고값으로만 둔다.

## Slack 문구 — 주간

```text
[매출·광고비 리포트] 더클린커피 주간 2026-05-15 - 2026-05-21

매출: 16,913,442원
광고비: 1,952,104원
매출 대비 광고비: 11.54%

채널별 매출
- 자사몰: 13,305,022원
  - Toss 계열: 9,611,622원
  - NPay actual: 3,693,400원
- 스마트스토어: 2,563,520원
  - TOP1 더클린 진짜 방탄커피 840ml 10개: 464,600원 / 2개
  - TOP2 초신선 콜롬비아 스페셜티: 406,710원 / 13개
  - TOP3 초신선 에티오피아 구지 사키소 G1: 398,900원 / 11개
- 쿠팡 coffee 상품: 1,044,900원
  - TeamKeto 계정 전체 참고: 1,968,100원
  - teamketo 상품 분리 참고: 923,200원

광고비
- Meta: 1,952,104원
- Naver: 0원 확인 후보
- Google: 0원 확인 후보
- TikTok: 0원 (현재 광고 미운영)

주의
- NPay status blank 4건 / 141,600원은 미결제 단정이 아니라 freshness warning입니다.
- 스마트스토어는 PlayAuto fresh dry-run으로 갱신했습니다. 정산 기준 확정 전이라 included_with_warning입니다.
- 쿠팡은 TeamKeto 계정에 coffee/teamketo 상품이 섞여 있어 strict 매출과 계정 전체 참고값을 분리했습니다.
- Naver Ads는 VM Cloud API dry-run이 성공했지만, 더클린커피 이름 캠페인은 현재 PAUSED/spend 0입니다.
- Google Ads는 API 조회가 되며, 최근 7일 비용이 있는 캠페인은 바이오컴 계열입니다. 더클린커피 이름 캠페인 비용 row는 없고, 방문 원장에는 Google 클릭 ID 3건만 소량 확인됐습니다.
- TikTok은 현재 광고 미운영 기준으로 0원 표시합니다.
- Meta 플랫폼 주장 구매값은 내부 매출에 더하지 않았습니다.
```

## Slack 문구 — rolling 30d

```text
[매출·광고비 리포트] 더클린커피 rolling 30d 2026-04-22 - 2026-05-21

매출: 60,511,234원
광고비: 3,966,919원
매출 대비 광고비: 6.56%

채널별 매출
- 자사몰: 46,982,864원
  - Toss 계열: 31,444,064원
  - NPay actual: 15,538,800원
- 스마트스토어: 9,110,570원
  - TOP1 초신선 콜롬비아 스페셜티: 2,697,350원 / 87개
  - TOP2 초신선 에티오피아 구지 사키소 G1: 1,541,500원 / 48개
  - TOP3 초신선 디카페인 파푸아뉴기니: 1,445,920원 / 48개
- 쿠팡 coffee 상품: 4,417,800원
  - TeamKeto 계정 전체 참고: 7,264,500원
  - teamketo 상품 분리 참고: 2,846,700원

광고비
- Meta: 3,966,919원
- Naver: 0원 확인 후보
- Google: 0원 확인 후보
- TikTok: 0원 (현재 광고 미운영)

주의
- Naver Ads는 IP/API 조회가 되며, 더클린커피 이름 캠페인은 현재 PAUSED/spend 0입니다. 다만 coffee cache write 전에는 campaign allowlist가 필요합니다.
- Google Ads는 최근 30일 비용이 있는 캠페인이 바이오컴 계열로만 반환되어 더클린커피 spend는 0원 후보입니다. 단, 방문 원장에는 Google 클릭 ID 3건이 있어 유입 참고 warning은 유지합니다.
- TikTok은 현재 광고 미운영 기준으로 0원 표시합니다.
- 스마트스토어 TOP 상품은 PlayAuto 상품명 기준이며, 고객/주문/결제 식별자는 출력하지 않았습니다.
- TeamKeto 계정 전체 매출을 더클린커피 strict 매출로 자동 합산하지 않습니다.
- Slack 실제 발송은 하지 않았습니다.
```

## Source / Window / Freshness

- weekly window: 2026-05-15 - 2026-05-21 KST
- rolling 30d window: 2026-04-22 - 2026-05-21 KST
- NPay source: VM Cloud SQLite `imweb_orders`, max order_time 2026-05-21T13:21:38.000Z
- Coupang source: TeamKeto ordersheets API, weekly 42 calls error 0, rolling 30d 180 calls error 0
- SmartStore source: 운영DB `tb_playauto_orders shop_name='스마트스토어'`, fresh product dry-run max PlayAuto time 2026-05-21 14:15:23 KST
- Meta source: VM Cloud `/api/ads/site-summary`, prior aggregate
- Naver: API reachable, coffee campaign spend 0 candidate, cache write needs campaign allowlist
- Google: 0원 후보, Google 클릭 ID 3건 소량 evidence warning
- TikTok: 현재 광고 미운영 0원

## Guardrails

- Slack send: 0
- 운영DB write: 0
- VM Cloud write/deploy/restart: 0
- platform send/upload: 0
- GTM publish: 0
- raw identifier output: 0

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 68% | 69% | +1% |
| B | 더클린커피 매출 source 확인 | 96% | 96% | +0% |
| C | 더클린커피 광고비 source 확인 | 68% | 74% | +6% |
| D | 바이오컴 리포트 source map | 35% | 35% | +0% |
| E | Slack no-send 메시지 설계 | 95% | 96% | +1% |
| F | 자동화/배포 readiness | 85% | 86% | +1% |
