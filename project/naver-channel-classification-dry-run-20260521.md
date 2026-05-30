# Naver 유입 분류 dry-run

작성 시각: 2026-05-21 22:39 KST
기준일: 2026-05-21
문서 성격: Naver 유입을 paid / brandsearch / shopping / organic 후보로 나누는 read-only dry-run 결과

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - docurule.md
    - data/!data_inventory.md
    - imweb/!coderule.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_read_only_select
    - dry_run_classification_design
    - local_documentation
    - local_backend_helper_patch
    - local_test_and_typecheck
  forbidden_actions:
    - backend_deploy
    - vm_cloud_write
    - operational_db_write
    - gtm_publish
    - imweb_save
    - platform_send_or_upload
  source_window_freshness_confidence:
    source: VM Cloud SQLite site_landing_ledger + attribution_ledger read-only
    window: biocom rolling 24h and rolling 7d
    freshness: 2026-05-21 22:39 KST
    confidence: medium_high
```

## 10초 요약

`NaPm` 단독은 네이버 유입 흔적이지 유료 광고 확정 증거가 아니다.

TJ님이 준 샘플 기준으로 파워링크는 `utm_source=naver`, `utm_medium=cpc`, `n_media/n_ad/n_query` 계열로 확정 paid다. 반대로 광고 표시가 없는 검색 결과는 `NaPm`이 있어도 오가닉/브랜드 검색 후보로 둬야 한다.

현재 위험은 백엔드 일부 aggregate 로직이 `NaPm`만 있어도 paid 후보로 볼 수 있다는 점이다. dry-run 기준 24시간 attribution row 59건, 7일 attribution row 355건이 기존 방식에서는 paid로 섞일 수 있다.

## 분류 기준

| Dry-run class | 사람 말 | 판단 기준 | 예산 ROAS 사용 |
|---|---|---|---|
| `naver_powerlink_paid` | 네이버 파워링크 유료 검색 | `utm_source=naver` + `utm_medium=cpc/powerlink`, 또는 `n_media/n_query/n_rank/n_ad_group/n_ad/n_match`, 또는 `NaPm tr=sa` | 사용 가능 후보. 단, 네이버 광고비 source와 campaign join 필요 |
| `naver_brandsearch` | 네이버 브랜드검색 후보 | `naverbrandsearch` 또는 `brandsearch` UTM marker | 별도 캠페인 비용과 연결될 때만 사용 |
| `naver_shopping_search_candidate` | 네이버 쇼핑검색 후보 | `shopping.naver` referrer 또는 `NaPm tr=slsl`류 shopping marker | 참고용. 쇼핑 광고비와 연결 전까지 예산 ROAS 제외 |
| `naver_organic_search_candidate` | 네이버 자연/브랜드 검색 후보 | `search.naver.com`, `m.search.naver.com`, `NaPm tr=ds`류 search marker. paid marker 없음 | 예산 ROAS 제외 |
| `naver_unknown_reference_only` | 네이버 흔적은 있으나 판단 보류 | Naver referrer/UTM/NaPm은 있으나 위 조건 불충족 | 예산 ROAS 제외 |

## 고객 유입 장부 dry-run

고객 유입 장부는 실제 랜딩 row 기준으로 본다. 기술 이름은 `site_landing_ledger`다.

### 24시간

| Dry-run class | rows | 비중 | 기존 paid_search row | 기존 organic_search row | 비고 |
|---|---:|---:|---:|---:|---|
| `naver_organic_search_candidate` | 104 | 56.83% | 3 | 97 | 대부분 오가닉 후보. paid로 보면 안 됨 |
| `naver_powerlink_paid` | 56 | 30.60% | 51 | 0 | 유료 검색 후보로 분리 가능 |
| `naver_brandsearch` | 22 | 12.02% | 0 | 14 | 브랜드검색 UTM이 self/direct로도 이어짐 |
| `naver_unknown_reference_only` | 1 | 0.55% | 0 | 1 | 판단 보류 |

### 7일

| Dry-run class | rows | 비중 | 기존 paid_search row | 기존 organic_search row | 비고 |
|---|---:|---:|---:|---:|---|
| `naver_organic_search_candidate` | 370 | 47.31% | 15 | 339 | 가장 큰 묶음 |
| `naver_powerlink_paid` | 210 | 26.85% | 200 | 0 | paid 후보 |
| `naver_brandsearch` | 156 | 19.95% | 2 | 53 | brandsearch UTM이 내부 이동에도 남음 |
| `naver_unknown_reference_only` | 40 | 5.12% | 5 | 16 | 규칙 보강 필요 |
| `naver_shopping_search_candidate` | 6 | 0.77% | 0 | 6 | 7일에는 shopping referrer 기반으로만 보임 |

## 주문 경로 장부 dry-run

주문 경로 장부는 결제 시작/결제 페이지/결제 완료 신호 기준으로 본다. 기술 이름은 `attribution_ledger`다.

### 24시간

| Dry-run class | touchpoint | rows | order key rows | payment key rows | 비고 |
|---|---|---:|---:|---:|---|
| `naver_organic_search_candidate` | `checkout_started` | 59 | 0 | 0 | 오가닉 후보가 결제 시작까지 이어짐 |
| `naver_powerlink_paid` | `payment_page_seen` | 26 | 12 | 0 | 결제 페이지 진입 |
| `naver_powerlink_paid` | `checkout_started` | 12 | 9 | 0 | 주문키 일부 존재 |
| `naver_powerlink_paid` | `payment_success` | 5 | 5 | 5 | 결제완료 후보까지 연결 |
| `naver_brandsearch` | `checkout_started` | 11 | 1 | 0 | 브랜드검색 후보 |
| `naver_brandsearch` | `payment_page_seen` | 4 | 4 | 0 | 결제 페이지 진입 |

### 7일

| Dry-run class | touchpoint | rows | order key rows | payment key rows | 비고 |
|---|---|---:|---:|---:|---|
| `naver_organic_search_candidate` | `checkout_started` | 355 | 0 | 0 | 오가닉 후보가 많음 |
| `naver_powerlink_paid` | `payment_page_seen` | 176 | 111 | 0 | paid 결제 페이지 후보 |
| `naver_powerlink_paid` | `checkout_started` | 69 | 62 | 0 | paid checkout 후보 |
| `naver_powerlink_paid` | `payment_success` | 34 | 34 | 34 | paid 결제완료 후보 |
| `naver_brandsearch` | `checkout_started` | 83 | 20 | 0 | 브랜드검색 후보 |
| `naver_brandsearch` | `payment_page_seen` | 76 | 51 | 0 | 브랜드검색 결제 페이지 후보 |
| `naver_brandsearch` | `payment_success` | 18 | 18 | 9 | 브랜드검색 결제완료 후보 |
| `naver_shopping_search_candidate` | `checkout_started` | 6 | 0 | 0 | shopping referrer 기반 |
| `naver_unknown_reference_only` | `payment_page_seen` | 36 | 20 | 0 | 보류 |
| `naver_unknown_reference_only` | `checkout_started` | 23 | 9 | 0 | 보류 |
| `naver_unknown_reference_only` | `payment_success` | 6 | 6 | 0 | 보류. paid 확정 금지 |

## 기존 분류와의 충돌

현재 백엔드 일부 집계 로직은 `NaPm`을 paid marker로 취급할 수 있다. 이 로직은 `backend/src/routes/attribution.ts`의 Naver evidence aggregate 주변에 있다.

| Window | Dry-run class | 기존 방식 추정 class | rows | 해석 |
|---|---|---|---:|---|
| 24h | `naver_organic_search_candidate` | `legacy_paid_naver` | 59 | 오가닉 후보가 paid로 섞일 수 있음 |
| 24h | `naver_powerlink_paid` | `legacy_paid_naver` | 43 | 정상 paid |
| 24h | `naver_brandsearch` | `legacy_naver_brandsearch` | 15 | 별도 분리됨 |
| 7d | `naver_organic_search_candidate` | `legacy_paid_naver` | 355 | 가장 큰 오분류 위험 |
| 7d | `naver_powerlink_paid` | `legacy_paid_naver` | 279 | 정상 paid |
| 7d | `naver_brandsearch` | `legacy_naver_brandsearch` | 177 | 별도 분리됨 |
| 7d | `naver_unknown_reference_only` | `legacy_paid_naver` | 28 | 보류 row가 paid로 섞일 수 있음 |
| 7d | `naver_shopping_search_candidate` | `legacy_paid_naver` | 6 | shopping 후보가 paid로 섞일 수 있음 |

## 해석

1. 네이버 paid와 organic은 구분 가능하다.
2. `NaPm` 단독은 paid가 아니다.
3. 파워링크 paid는 `utm_source=naver`, `utm_medium=cpc/powerlink`, `n_*`, `tr=sa` 조합으로 분리한다.
4. 브랜드검색은 UTM marker가 있어서 별도 class로 분리한다.
5. 쇼핑검색은 현재 원장에 `tr=slsl`이 그대로 보존되지 않는 경우가 있다. 7일에는 `shopping.naver` referrer 기반 6건만 잡혔다. 쇼핑검색은 예산 ROAS에 바로 넣지 말고 별도 보류 class로 둔다.

## 권장 패치

### Backend local patch 후보

1. `classifyNaverEvidence`에서 `directNapm || firstNapm`을 paid marker에서 제거한다.
2. `NaPm` 내부 `tr` 값을 읽는 helper를 추가한다.
3. `tr=sa`는 `naver_powerlink_paid`로 둔다.
4. `tr=slsl` 또는 `shopping.naver` referrer는 `naver_shopping_search_candidate`로 둔다.
5. `tr=ds` 또는 `search.naver.com/m.search.naver.com`은 `naver_organic_search_candidate`로 둔다.
6. 기존 `paid_naver`는 `naver_powerlink_paid` 또는 `naver_paid_search_candidate`로 이름을 좁힌다.

## 로컬 보강 결과

dry-run 후 Green Lane 범위에서 로컬 코드까지 보강했다. 아직 VM Cloud 배포는 하지 않았다.

### 보강 파일

1. `backend/src/routes/attribution.ts`
   - Naver evidence aggregate에 `naver_shopping_search_candidate`를 추가했다.
   - `NaPm` 단독 paid 판정을 제거했다.
   - `NaPm tr=sa`는 paid 후보, `tr=brnd`는 브랜드검색 후보, `tr=slsl`은 쇼핑검색 후보, `tr=ds/nexearch`는 오가닉 후보로 분리했다.

2. `backend/scripts/monthly-evidence-join-dry-run.ts`
   - `/api/ads/naver/campaign-summary`가 내부 ROAS 참고값을 만들 때 쓰는 evidence join 스크립트에도 같은 규칙을 반영했다.
   - 기존에는 `directNapm` 또는 `firstNapm`만 있어도 `paid_naver` 후보로 올라갈 수 있었다. 이제는 `n_*`, paid UTM, `tr=sa` 같은 유료 근거가 있어야 `paid_naver`가 된다.

3. `backend/tests/attribution.test.ts`
   - `NaPm tr=ds` 오가닉, `tr=sa` 파워링크, `tr=slsl` 쇼핑검색 후보가 서로 섞이지 않는 fixture를 추가했다.

4. `backend/src/leadingIndicators.ts`
   - 리딩 지표의 `naver_paid_or_brand` bucket에서도 `NaPm` 단독을 paid/brand로 보지 않게 했다.
   - `tr=sa`와 `tr=brnd`만 paid/brand bucket에 남기고, `tr=ds` 검색 유입은 organic bucket으로 내려가게 했다.

### 로컬 검증

| 검증 | 결과 |
|---|---|
| `cd backend && npx tsx --test tests/attribution.test.ts` | PASS, 51/51 |
| `cd backend && npm run typecheck -- --pretty false` | PASS |
| `cd backend && node spawn monthly-evidence-join-dry-run.ts --site=biocom --since=2026-05-20 --until=2026-05-21 --json` | PASS, `dryRun=true`, `write=false`, `send=false` |
| `python3 scripts/validate_wiki_links.py project/naver-channel-classification-dry-run-20260521.md imweb/!coderule.md` | PASS |
| `python3 scripts/harness-preflight-check.py --strict` | PASS |

### 운영 반영 전 확인할 것

1. `backend/src/routes/ads.ts`의 payment-success 채널 분류는 이미 `nclick_id/n_media/n_query` 또는 `utm_source=naver + paid medium` 기준이라 `NaPm` 단독 paid 문제는 확인되지 않았다.
2. `backend/src/acquisitionAnalysis.ts`는 broad channel label 용도로 `NaPm`을 Naver 검색/쇼핑 묶음으로 본다. 예산 ROAS paid 산정 경로가 아니므로 이번 패치 범위에서는 보류한다.
3. `backend/src/leadingIndicators.ts`의 `NaPm` 단독 paid/brand 분류는 로컬에서 보강 완료했다.

### 프론트/보고서 표시 후보

네이버 섹션은 다음 5개 줄로 표시한다.

1. 파워링크 paid 후보
2. 브랜드검색 후보
3. 쇼핑검색 후보
4. 오가닉 검색 후보
5. 미분류 네이버 reference

각 줄에는 `예산 ROAS 포함 여부`를 명확히 표시한다.

## 하지 않은 것

- VM Cloud write 0
- 운영DB write 0
- backend deploy 0
- GTM publish 0
- Imweb save 0
- Meta/Google/Naver/TikTok 전송 0
- raw URL/click id/order id 출력 0

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source | VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` |
| tables | `site_landing_ledger`, `attribution_ledger` |
| site | biocom |
| window | rolling 24h, rolling 7d |
| freshness | 2026-05-21 22:39 KST read-only query |
| confidence | medium_high. paid/organic 분리는 명확하나 shopping marker 보존은 추가 확인 필요 |

## Auditor verdict

PASS_WITH_NOTES.

Dry-run은 분류 기준과 오분류 위험을 확인했고, 로컬 백엔드 helper/test/evidence join 스크립트까지 보강했다. 운영 반영은 backend deploy가 필요하므로 Yellow Lane approval이 필요하다.

## 다음 할일

### Auto Green

1. `backend/src/acquisitionAnalysis.ts`의 broad Naver label이 paid/organic 보고서에 혼동을 주는지 확인한다.
2. 필요하면 acquisition summary에도 paid/brand/shopping/organic 하위 breakdown을 별도 필드로 추가한다.

### Approval Needed

1. 로컬 테스트가 통과하면 VM Cloud backend 배포 승인안을 만든다.
2. 배포 범위는 Naver evidence aggregate와 Naver campaign-summary evidence join 분류 수정으로 제한한다.

### Blocked/Parked

1. 네이버 쇼핑검색 유입을 예산 ROAS에 넣을지는 Naver Ads/Shopping spend source가 확인될 때까지 보류한다.
