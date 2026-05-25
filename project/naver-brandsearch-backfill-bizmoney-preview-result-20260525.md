# Naver 브랜드검색 backfill apply + Bizmoney 비용 preview 결과

작성 시각: 2026-05-25 15:49 KST
기준일: 2026-05-25
문서 성격: 승인된 VM Cloud 고객 유입 장부 보정 결과 + 네이버 브랜드검색 비용 원천 preview 결과

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
    - data/!data_inventory.md
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
  required_context_docs:
    - project/biocom-naver-brandsearch-site-landing-backfill-approval-20260525.md
    - project/biocom-naver-brandsearch-cost-source-gap-20260525.md
    - report/reportcoffee-naver-ads-campaign-full-audit-20260525.md
  lane: Yellow for approved VM Cloud SQLite scoped backfill, Green for Bizmoney read-only preview
  allowed_actions:
    - VM Cloud SQLite backup
    - approved scoped site_landing_ledger update for biocom Naver brandsearch marker rows
    - post-check read-only validation
    - local read-only Naver Search Ad API Bizmoney preview
    - local script and JSON output
  forbidden_actions:
    - operating DB write
    - Naver Ads setting change
    - Naver Ads conversion send/upload
    - GA4/Meta/TikTok/Google platform send
    - GTM publish
    - backend deploy/restart
    - raw secret/order/payment/click/member output
  source_window_freshness_confidence:
    source: VM Cloud SQLite site_landing_ledger + Naver Search Ad API /billing/bizmoney/histories/exhaust + local env presence check
    window: backfill 2026-05-11..2026-05-25 KST, Bizmoney 2026-04-21..2026-05-24 KST
    freshness: 2026-05-25 15:42..15:49 KST
    confidence: 0.92 for backfill count, 0.90 for connected Naver Ads account, 0.55 for other unconfigured coffee account possibility
```

## 10초 요약

승인된 범위 안에서 biocom Naver 브랜드검색 유입 장부 오분류 350건을 보정했다. 백업을 만들고, 적용 후 잔여 오분류 0건과 정상 marker row 365건을 확인했다.

Bizmoney 비용 preview 스크립트도 추가했다. 기존 `/stats.salesAmt`가 놓치던 브랜드검색 비용은 Bizmoney 차감 원천에서 2,420,000원으로 재현됐다.

더클린커피 브랜드검색 비용 88만원 모바일 + 66만원 PC 정보는 현재 repo에 연결된 Naver Ads API 계정의 정보와 일치하지 않는다. 연결된 계정 기준 더클린커피 브랜드검색 캠페인은 PAUSED/0원이며, 더클린커피 전용 Naver Ads credential은 현재 로컬 env에 없다.

## 1. Backfill apply 결과

대상:

- DB: VM Cloud SQLite `crm.sqlite3`
- table: `site_landing_ledger`
- site: `biocom`
- window: KST 2026-05-11 00:00 이후
- 조건: Naver 브랜드검색 marker가 있으나 `channel_classified <> 'naver_brandsearch'`

결과:

| 항목 | 값 |
|---|---:|
| dry-run target rows | 350 |
| applied rows | 350 |
| remaining misclassified | 0 |
| correct marker rows | 365 |
| backup size | 382,271,488 bytes |

백업 위치:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/biocom-naver-brandsearch-backfill-20260525T0642KST
```

운영 영향:

- 주문/결제 원장 변경 0건.
- 운영DB 변경 0건.
- 광고 계정 변경 0건.
- 외부 플랫폼 전송 0건.
- backend deploy/restart 0건.

## 2. Bizmoney 비용 preview 스크립트

추가 파일:

```text
backend/scripts/naver-bizmoney-cost-preview.ts
```

실행 예:

```bash
cd backend
npx tsx scripts/naver-bizmoney-cost-preview.ts \
  --since=2026-04-21 \
  --until=2026-05-24 \
  --output=../data/project/naver-bizmoney-cost-preview-biocom-20260421-20260524.json
```

산출물:

```text
data/project/naver-bizmoney-cost-preview-biocom-20260421-20260524.json
```

## 3. Bizmoney 비용 preview 결과

source:

- Naver Search Ad API `/billing/bizmoney/histories/exhaust`

window:

- 2026-04-21..2026-05-24 KST

결과:

| 구분 | product | 비용 |
|---|---|---:|
| GFA/PMAX 등 Search Ads 외 상품 후보 | GFA + PMAX | 16,058,327원 |
| 파워링크 | NCC | 6,986,711원 |
| 쇼핑검색 | NCC | 940,431원 |
| 파워컨텐츠 | NCC | 293,458원 |
| 브랜드검색 | NCC | 2,420,000원 |
| 전체 | all | 26,698,927원 |

브랜드검색 비용은 2026-05-21 KST 차감 row 2건으로 2,420,000원이 확인됐다.

주의:

- 이 값은 차감일 기준 비용이다.
- ROAS 보고에 바로 쓰려면 차감일 몰아넣기와 기간 배분 중 하나를 정해야 한다.
- 내부 confirmed ROAS에서는 비용만 이 원천을 쓰고, 매출은 결제완료 원장을 써야 한다.
- 네이버가 주장하는 전환 매출과 내부 결제완료 매출은 합산하지 않는다.

## 4. 더클린커피 88만원 모바일 + 66만원 PC 대조

TJ님이 준 값:

- 모바일: 880,000원
- PC: 660,000원
- 합계: 1,540,000원

현재 repo에서 확인한 값:

| 확인 원천 | 결과 |
|---|---|
| 연결된 Naver Ads API 계정 | 더클린커피 이름 후보 캠페인들은 PAUSED/0원 |
| 더클린커피 브랜드검색 후보 | `브랜드검색03_더클린커피`, PAUSED |
| 더클린커피 전용 Naver Ads env | `COFFEE_NAVER_ADS_*` 미설정 |
| Bizmoney brandsearch 비용 | 2,420,000원, 연결 계정의 브랜드검색 전체 차감 비용 |

판정:

현재 Codex가 접근 가능한 정보와는 같지 않다. 88만원 + 66만원은 아래 중 하나일 가능성이 높다.

1. 현재 repo에 연결되지 않은 더클린커피 별도 Naver Ads customer 계정의 브랜드검색 상품 가격.
2. Naver Ads UI의 상품 견적/계약 화면 값이며, API 계정의 현재 비용 차감 내역과는 다른 단계의 값.
3. VAT 제외 금액일 가능성. 만약 VAT 별도라면 실제 차감 예상액은 1,694,000원이다. 그래도 현재 연결 계정의 브랜드검색 차감액 2,420,000원과는 다르다.

따라서 더클린커피 비용을 확정하려면 `COFFEE_NAVER_ADS_*` read-only credential을 별도로 연결하거나, Naver Ads UI에서 더클린커피 브랜드검색 계약/청구 화면의 customer/account 정보를 확인해야 한다.

## 5. 검증

| 검증 | 결과 |
|---|---|
| backfill dry-run count | 350 rows PASS |
| DB backup | PASS |
| backfill apply rows | 350 rows PASS |
| post-check remaining misclassified | 0 rows PASS |
| post-check correct marker rows | 365 rows PASS |
| Bizmoney preview script 실행 | PASS |
| TypeScript script isolated compile | PASS |
| script help smoke | PASS |

## 6. 다음 할일

### Auto Green

1. Bizmoney 비용 cache write 승인안 작성
   - 무엇: `naver_bizmoney_cost_daily` 테이블 생성/upsert 승인안을 만든다.
   - 왜: 브랜드검색 비용을 ROAS summary에서 안정적으로 읽기 위해 필요하다.
   - 의존성: 비용 배분 방식 결정.

2. 더클린커피 Naver Ads account scope 확인 문서 업데이트
   - 무엇: 현재 연결 계정과 TJ님 UI 값의 불일치를 `reportcoffee` Naver 섹션에 반영한다.
   - 왜: 더클린커피 Naver 비용을 0원 또는 154만원으로 잘못 확정하지 않기 위해 필요하다.
   - 의존성: 없음.

### Approval Needed

1. 브랜드검색 비용 cache write
   - 무엇: 승인 후 VM Cloud SQLite에 Bizmoney 비용 cache를 적재한다.
   - 왜: 브랜드검색 비용 join을 화면/API에서 계산하려면 cache가 필요하다.
   - 승인 필요: YES, VM Cloud SQLite schema/write.

2. 더클린커피 전용 Naver Ads credential 연결
   - 무엇: `COFFEE_NAVER_ADS_*` read-only credential을 env에 추가한다.
   - 왜: TJ님이 보는 88만원/66만원 계정이 현재 API 계정과 다른지 확정하기 위해 필요하다.
   - 승인 필요: YES, credential/env.

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
Backfill apply: PASS
Bizmoney preview: PASS
No operating DB write: YES
No platform send/upload: YES
No Naver Ads state change: YES
Remaining blocker: brandsearch cost allocation policy + coffee account scope mismatch
```
