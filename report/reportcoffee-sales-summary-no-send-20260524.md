# reportcoffee sales summary no-send 20260524

작성 시각: 2026-05-24 16:49 KST
기준일: 2026-05-23
문서 성격: 더클린커피 Slack 보고용 매출·광고비 no-send 통합 집계 결과
담당: Codex
상위 문서: [[reportcoffee]], [[!report]]
관련 문서: [[reportcoffee-sales-api-readiness-20260524]], [[reportcoffee-slack-preview-20260522]], [[reportcoffee-coupang-source-readiness-20260522]], [[reportcoffee-coupang-settlement-refresh-path-20260524]], [[reportcoffee-google-ads-spend-mapping-20260523]], [[reportcoffee-naver-ads-campaign-allowlist-dry-run-20260522]]
JSON 산출물: `report/reportcoffee-sales-summary-no-send-20260524.json`
스크립트: `backend/scripts/reportcoffee-sales-summary-no-send.ts`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - report/reportcoffee.md
    - report/reportcoffee-sales-api-readiness-20260524.md
  lane: Green
  allowed_actions:
    - local_script_patch
    - read_only_vm_cloud_sqlite_aggregate
    - read_only_vm_cloud_ads_api
    - read_only_operational_db_aggregate
    - read_only_coupang_ordersheets_api
    - read_only_coupang_revenue_history_api
    - local_json_markdown_output
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud SQLite NPay via SSH aggregate + 운영DB Toss/PlayAuto + Coupang TeamKeto revenue-history/ordersheets API + VM Cloud ads site-summary
    window: weekly 2026-05-17 - 2026-05-23 KST, month_to_date 2026-05-01 - 2026-05-23 KST, rolling_30d 2026-04-24 - 2026-05-23 KST
    freshness: NPay max_order_time 2026-05-24T01:58:25Z, Toss max_approved_at 2026-05-23 20:34:00, SmartStore max_time 2026-05-22 15:45:48 weekly, Coupang revenue-history 2026-05-23까지, Meta API force live 2026-05-24 16:49 KST
    confidence: high for no-send sales/ad input, local settlement cache reconciliation still pending for current 2026-05 windows
```

## 10초 요약

더클린커피 Slack 보고에 필요한 “매출, 광고비, 매출 대비 광고비 비중”이 한 JSON에 붙었다. 여기서 JSON은 Slack으로 보내기 전 숫자를 담아 두는 입력 파일이고, no-send는 실제 Slack 발송을 하지 않았다는 뜻이다.

2026-05-17 - 2026-05-23 주간 기준 strict 매출은 15,177,390원, 포함 광고비는 2,099,737원, 매출 대비 광고비 비중은 13.83%다. 광고비는 Meta(페이스북·인스타 광고)만 실제 지출이 있고, Naver/Google/TikTok은 현재 0원 후보로 분리했다.

쿠팡 strict 매출 기준은 ordersheets(주문서 API, 주문 발생 기준)에서 revenue-history(매출내역 API, 쿠팡이 매출로 인식한 날짜 기준)로 바꿨다. 그래서 주간 쿠팡 coffee 금액은 주문서 참고값 1,015,000원이 아니라 매출인식 기준 858,400원으로 들어간다.

## 무엇이 가능해졌나

Slack 메시지를 만들기 전 입력 JSON 하나로 아래를 동시에 볼 수 있다.

- 채널별 매출: 자사몰, 스마트스토어, 쿠팡 coffee 상품.
- 제품별 매출: 스마트스토어 TOP 상품, 쿠팡 coffee TOP 상품.
- 광고비: Meta 실제 지출, Naver/Google/TikTok 0원 후보.
- 광고비 비중: `포함 광고비 / strict 매출 * 100`.
- 쿠팡 정산 대조 상태: 매출인식 기준 금액과 정산표가 같은 기간으로 비교 가능한지 여부.

## 실행 명령

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/reportcoffee-sales-summary-no-send.ts \
  --as-of=2026-05-23 \
  --npay-ssh=taejun@34.64.104.94 \
  --coupang-source=api \
  --coupang-revenue-history-source=api \
  --coupang-delay-ms=150 \
  --ad-spend-source=api \
  --ad-spend-force=1 \
  --coupang-settlement-source=local \
  --out ../report/reportcoffee-sales-summary-no-send-20260524.json
```

이 명령은 Slack을 보내지 않는다. 운영DB, VM Cloud, 쿠팡, 광고 플랫폼에 쓰기 작업도 하지 않는다.

## 결과 숫자

### 주간 2026-05-17 - 2026-05-23 KST

- strict 매출: 15,177,390원
- 포함 광고비: 2,099,737원
- 매출 대비 광고비: 13.83%
- 자사몰: 12,256,590원
  - Toss: 8,487,690원
  - NPay actual: 3,768,900원
- 스마트스토어: 2,062,400원
- 쿠팡 coffee 상품: 858,400원
- 쿠팡 coffee 정산대상 참고값: 758,317원
- 쿠팡 주문서 기준 coffee 참고값: 1,015,000원
- 쿠팡 TeamKeto 계정 전체 참고값 포함 시: 16,100,590원

### 월초-기준일 2026-05-01 - 2026-05-23 KST

- strict 매출: 55,877,766원
- 포함 광고비: 4,440,225원
- 매출 대비 광고비: 7.95%
- 자사몰: 45,433,436원
  - Toss: 31,611,736원
  - NPay actual: 13,821,700원
- 스마트스토어: 7,052,430원
- 쿠팡 coffee 상품: 3,391,900원
- 쿠팡 coffee 정산대상 참고값: 2,996,443원
- 쿠팡 주문서 기준 coffee 참고값: 3,211,400원
- 쿠팡 TeamKeto 계정 전체 참고값 포함 시: 57,875,466원

### rolling 30d 2026-04-24 - 2026-05-23 KST

- strict 매출: 63,494,729원
- 포함 광고비: 4,784,969원
- 매출 대비 광고비: 7.54%
- 자사몰: 49,890,559원
  - Toss: 33,967,059원
  - NPay actual: 15,923,500원
- 스마트스토어: 8,884,570원
- 쿠팡 coffee 상품: 4,719,600원
- 쿠팡 coffee 정산대상 참고값: 4,169,355원
- 쿠팡 주문서 기준 coffee 참고값: 4,435,800원
- 쿠팡 TeamKeto 계정 전체 참고값 포함 시: 65,851,629원

## 광고비 해석

- Meta: included. 주간 2,099,737원, 월초-기준일 4,440,225원, rolling 30d 4,784,969원.
- Naver: 0원 후보. 더클린커피 후보 캠페인 6개는 2026-04-22 - 2026-05-21 기준 광고비 0원/클릭 0회로 확인됐다. 단, 실제 캐시 저장 전까지 warning을 유지한다.
- Google: 0원 후보. 더클린커피 비용 row는 0개지만, Google 클릭 ID 3건 유입 warning은 별도 유지한다.
- TikTok: 0원. TJ님 확인 기준 현재 광고 미운영이다.
- 플랫폼 구매값: Meta가 주장하는 구매값은 참고값이고 내부 매출에는 더하지 않는다.

## 제품 TOP

### 스마트스토어 주간 TOP3

1. 에티오피아 구지 사키소 G1: 459,800원 / 12개
2. 콜롬비아 스페셜티: 427,700원 / 13개
3. 디카페인 파푸아뉴기니: 317,100원 / 9개

### 쿠팡 주간 coffee TOP3

1. 콜롬비아 스페셜티: 369,800원 / 12개
2. 케냐 AA 스페셜티: 199,500원 / 5개
3. 파푸아뉴기니 유기농 디카페인: 106,600원 / 4개

## 쿠팡 주문서 금액과 정산표 대조

현재 결론은 `current_window_not_reconciled`다. 뜻은 “쿠팡 매출인식 기준 금액은 최신으로 읽었지만, 로컬 정산 cache가 아직 같은 기간까지 올라오지 않아 직접 맞춰 볼 수 없다”는 것이다.

- revenue-history 주간 coffee saleAmount: 858,400원
- revenue-history 주간 coffee settlementAmount: 758,317원
- ordersheets 주간 coffee 참고값: 1,015,000원
- ordersheets 주간 TeamKeto 계정 전체 참고값: 1,798,700원
- 로컬 쿠팡 정산표 최신 인식 종료일: 2026-04-19
- 로컬 쿠팡 정산표 최신 월: 2026-04, total_sale 10,829,400원, final_amount 3,633,565원
- 운영DB `tb_sales_coupang` 최신 월: 2026-04
- 2026-05 주간/월간 매출인식 기준 금액과 로컬 정산표의 직접 차이율: 계산 불가

정산표와 주문서는 같은 숫자를 보장하지 않는다. 주문서는 판매 발생 기준이고, revenue-history는 매출인식일 기준이며, 정산표는 정산·수수료·환불·기간 인식이 반영된 source다. 그래서 Slack에는 쿠팡을 `included_revenue_history_with_ordersheets_reference`로 표시하는 것이 맞다.

## Source / Window / Freshness

- NPay source: VM Cloud SQLite `imweb_orders`, SSH read-only aggregate.
- NPay freshness: max_order_time 2026-05-24T01:58:25.000Z, max_synced_at 2026-05-24 04:00:42.
- Toss source: 운영DB `public.tb_sales_toss`, `store='coffee'`, `SUM(total_amount - cancel_amount)`.
- Toss weekly freshness: max_approved_at 2026-05-23 20:34:00.
- SmartStore source: 운영DB `public.tb_playauto_orders`, `shop_name='스마트스토어'`.
- SmartStore weekly freshness: max_time 2026-05-22 15:45:48.
- Coupang source: TeamKeto revenue-history API read-only aggregate, ordersheets API reference.
- Coupang revenue-history freshness: weekly 1 page / 39 rows, month_to_date 3 pages / 121 rows, rolling_30d 4 pages / 164 rows.
- Coupang ordersheets reference freshness: weekly 42 calls, month_to_date 138 calls, rolling_30d 180 calls, error_count 0.
- Ad spend source: VM Cloud `/api/ads/site-summary` read-only force live. 같은 custom range가 cache로 섞이지 않도록 응답 start/end date를 검증한다.

## Guardrails

- Slack send: 0
- 운영DB write: 0
- VM Cloud write/deploy/restart: 0
- platform send/upload: 0
- GTM publish: 0
- raw customer/order/payment/member/click identifier output: 0
- NPay click promoted to purchase: 0

## 아직 안 된 것

1. Slack 실제 발송은 하지 않았다.
   - 이유: 외부 채널 전송은 승인 전 금지다.

2. 로컬 정산 cache와 2026-05 직접 대조는 아직 안 됐다.
   - 이유: 로컬 정산 cache 최신 인식 종료일이 2026-04-19다.
   - 영향: revenue-history 기준 매출은 볼 수 있지만, 로컬 cache 기반 정산 확정액과의 차이는 cache 최신화 후 확정한다.

3. Naver 광고비 0원 후보는 아직 내부 캐시에 쓰지 않았다.
   - 이유: 저장은 write 성격이라 별도 승인 전 금지다.
   - 영향: Slack no-send에는 0원 후보로 표시 가능하지만, 자동 API 캐시값은 아직 아니다.

## 다음 할일

### Codex가 할 일

1. Slack no-send 메시지에 쿠팡 매출 기준 전환을 반영한다.
   - 무엇을: 이번 JSON에서 주간/월초/rolling 30d 숫자를 읽어 Slack 문장 미리보기를 만든다.
   - 왜: 실제 발송 전에 TJ님이 “받게 될 메시지”를 그대로 검수해야 한다.
   - 어떻게: `report/reportcoffee-sales-summary-no-send-20260524.json`을 입력으로 쓰고, send 없이 Markdown/JSON preview만 만든다.
   - 의존성: 이번 JSON 생성 완료.
   - 성공 기준: 매출, 광고비, 광고비 비중, 쿠팡 revenue-history 기준과 ordersheets 참고값이 한 메시지에 들어간다.
   - 승인 필요 여부: NO for no-send preview.
   - 실패 시 다음 확인점: JSON window 누락, 광고비 source warning, 쿠팡 정산 freshness.
   - 추천 점수/자신감: 94%.

2. 로컬 정산 cache 최신화 승인안을 만든다.
   - 무엇을: `settlement-histories` 2026-05 값을 로컬 SQLite에 적재하기 전 백업·dry-run·검증 순서를 문서화한다.
   - 왜: API에서는 2026-05 지급내역이 보이지만, 로컬 dashboard cache는 아직 2026-04-19까지만 있기 때문이다.
   - 어떻게: `backend/scripts/coupang-backfill-settlements.cjs 2026-05 2026-05` 실행 전 backup/check/apply/verify packet을 만든다.
   - 의존성: 로컬 DB write 승인.
   - 성공 기준: 승인 후 2026-05 settlement rows 4건이 로컬 cache에 들어가고 JSON 정산 대조가 cache 기준으로도 가능해진다.
   - 승인 필요 여부: YES for local DB apply.
   - 실패 시 다음 확인점: 쿠팡 API 권한, SQLite lock, settlement_id 중복.
   - 추천 점수/자신감: 84%.

### TJ님이 할 일

1. 실제 Slack 발송 전 메시지 형식을 승인한다.
   - 무엇을: 다음 단계에서 만들어질 Slack no-send preview 문구를 보고 “이 형식으로 매일/매주 받아도 되는지” 승인한다.
   - 왜: Slack send는 외부 채널에 메시지를 남기는 작업이라 승인선이 필요하다.
   - 어떻게: `growth-signal-bot` 채널에 들어갈 문구와 발송 시간을 확인한다.
   - 의존성: Codex가 no-send preview를 만든 뒤 가능.
   - 성공 기준: 채널, 주기, 문구가 승인된다.
   - 승인 필요 여부: YES for actual Slack send.
   - 실패 시 다음 확인점: 문구 길이, 숫자 표시 방식, warning 문구.
   - 추천 점수/자신감: 90%.

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 73% | 74% | +1% |
| B | 더클린커피 매출 source 확인 | 100% | 100% | +0% |
| C | 더클린커피 광고비 source 확인 | 82% | 82% | +0% |
| D | 바이오컴 리포트 source map | 36% | 36% | +0% |
| E | Slack no-send 메시지 설계 | 98% | 99% | +1% |
| F | 자동화/배포 readiness | 95% | 96% | +1% |

## Auditor verdict

판정: `PASS_WITH_NOTES`

매출 JSON 옆에 광고비 input과 매출 대비 광고비 비중이 붙었다. 쿠팡 strict 매출 기준도 revenue-history 매출인식 기준으로 전환됐다. 로컬 정산 cache만 2026-05 최신화가 남았다.
