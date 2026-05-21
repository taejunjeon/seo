# Meta campaign alias mapping

작성일: 2026-04-25 KST
최종 업데이트: 2026-05-21 11:50 KST

## 목적

이 문서는 바이오컴 Meta ROAS 산출에서 `utm_campaign` alias를 Meta `campaign_id`로 매핑하는 기준과 현재 재분류 제안을 기록한다.

현재 문제는 내부 원장에는 `meta_biocom_yeonddle_igg` 같은 사람이 만든 alias가 남고, Meta 광고 데이터에는 `120213362391690396` 같은 campaign ID가 남는다는 점이다. 캠페인별 Attribution ROAS를 계산하려면 `alias -> campaign_id` 매핑이 필요하다.

## 2026-05-06 그로스파트 수동 확인 반영

Source: `/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505.xlsx`
그로스파트 확인 시각: 2026-05-04 16:10 KST
반영 시각: 2026-05-06 22:45 KST
상세 문서: [[campaign-mapping-growth-confirmation-20260506]]

결론:

- `meta_biocom_kkunoping02_igg`는 campaign `120242626179290396`으로 확정했다.
- `inpork_biocom_igg`는 Meta 숫자 ID가 없어 Meta 캠페인 ROAS에서 제외한다.
- `meta_biocom_sosohantoon01_igg`, `meta_biocom_skintts1_igg`, `meta_biocom_proteinstory_igg`, `meta_biocom_iggspring`, `meta_biocom_iggacidset_2026`, `meta_biocom_mingzzinginstatoon_igg`, `meta_biocom_iggpost_igg`는 `split_required`로 둔다. 즉 Meta URL evidence는 있지만 여러 campaign 후보가 있어 주문별 adset/ad id/date/URL Parameters로 나눠야 한다.
- `split_required` alias는 캠페인 ROAS에 단일 campaign으로 자동 합산하지 않는다.

## 데이터 소스 우선순위

캠페인 매핑 판단은 아래 순서로 본다.

| 우선순위 | 증거 | 판정 강도 | 설명 |
|---:|---|---|---|
| 1 | 주문 URL의 `meta_campaign_id`, `campaign_id`, `utm_campaign={{campaign.id}}` | 매우 강함 | 주문에 실제 Meta campaign ID가 남으면 사람이 만든 alias보다 우선한다. |
| 2 | 주문 URL 또는 attribution ledger의 `utm_term={{adset.id}}` | 강함 | adset ID를 Meta evidence에서 parent campaign으로 역추적할 수 있으면 campaign-level 매핑 가능하다. |
| 3 | 광고 creative URL 또는 url_tags의 `utm_campaign=alias` | 강함 | 광고 소재 URL에 alias가 직접 들어 있으면 해당 광고의 campaign으로 매핑한다. |
| 4 | 주문 원장의 랜딩 경로가 현재 Meta creative URL에서 단일 campaign으로만 좁혀짐 | 중간+ | 예: 주문 원장 `/iiary02`와 현재 Meta creative URL의 `/iiary02`가 단일 campaign 후보이면 campaign-level 수동 매칭에 사용한다. |
| 5 | 광고명/광고세트명/인플루언서명/랜딩/상품군 일치 | 중간 | 직접 ID나 URL 증거가 없을 때 보조 증거로만 사용한다. |
| 6 | 상품군만 일치 | 약함 | IGG 상품을 샀다는 사실만으로 특정 Meta 캠페인에 귀속하면 안 된다. |

## 2026-05-18 단일 랜딩 경로 매칭 기준 추가

TJ님 승인 결정으로 `utm_campaign={{campaign.id}}`처럼 동적값이 깨진 주문이라도, 주문 원장에 남은 랜딩 경로가 현재 Meta creative URL에서 단일 campaign으로만 좁혀지면 campaign-level 수동 매칭에 반영한다.

승인 기록:

- 승인자: TJ님
- 승인 시각: 2026-05-18 22:41 KST
- 승인 범위: `/iiary02`를 `meta_biocom_iiari_acid_260518` 근거로 campaign-level 매칭하고, 앞으로 같은 수준의 단일 랜딩 경로 증거는 campaign-level 매칭하는 기준
- 승인 제외: 운영 DB 쓰기, Meta 광고 설정 변경, 광고세트/광고 단위 확정 매칭

적용 기준:

- 주문 원장에 Meta 흔적이 있어야 한다. 예: `utm_source=meta`, `fbclid`, 또는 Meta placeholder.
- 결제완료/백엔드 URL은 제외하고 실제 유입 랜딩 경로만 본다.
- 현재 Meta creative URL, source URL, website URL, URL Parameters를 read-only로 조회한다.
- 같은 랜딩 경로가 여러 campaign에 걸치면 자동 매칭하지 않는다.
- 단일 campaign으로만 좁혀져도 광고세트/광고 단위 ROAS 확정은 별도 보류한다. 캠페인 매출 귀속만 허용한다.

2026-05-18 적용 사례:

- 주문 해시 `d2d7f2e4c3`, 금액 `459,000원`, 원장 랜딩 `/iiary02`
- 현재 Meta creative 단일 후보: campaign `120245003319500396` `meta_biocom_influencer_260506`
- 참고 adset/ad 후보: adset `120245700952890396` `meta_biocom_iiari_260518`, ad `120245700952900396` `meta_biocom_iiari_acid_260518`
- 결정: campaign-level 수동 매칭 yes. adset/ad-level 확정은 no.

2026-05-18 22:47 KST 구현 반영:

- 적용 위치: `backend/src/routes/ads.ts`.
- 적용 내용: 원장/문서에 `/iiary02`처럼 경로만 남아도 랜딩 경로로 인식하고, 바이오컴 `/iiary02`는 campaign `120245003319500396` `meta_biocom_influencer_260506`의 수동 검증 단일 랜딩 후보로 반영했다.
- source: VM Cloud SQLite read-only + VM Cloud live API `att.ainativeos.net`.
- window: API 검증은 `date_preset=today`, 즉 `2026-05-18~2026-05-18` KST. 기본 `/ads`의 `last_7d`는 Meta completed-day 기준이라 `2026-05-11~2026-05-17`이고, 이 주문은 아직 기본 표 window에 들어가지 않는다.
- freshness: 2026-05-18 22:43~22:47 KST 직접 재계산.
- confidence: 0.95.
- `/iiary02` Meta confirmed 주문 집계: 3건 / `1,139,400원`.
- 이 중 직접 campaign id로 이미 붙던 주문: 2건 / `680,400원`.
- 이번 랜딩 경로 수동 매칭으로 새로 붙은 주문: 1건 / `459,000원`.
- `date_preset=today` live API 결과: `(unmapped)`는 1건 / `926,250원`만 남고, target campaign `meta_biocom_influencer_260506`는 4건 / `1,814,400원`으로 계산된다.
- 남은 `(unmapped)` 1건은 `/songyuul07`이며, 현재 문서 기준 반례로 둔 케이스와 같다. 단일 Meta creative 후보가 확인되지 않았으므로 quarantine을 유지한다.

반례:

- 주문 해시 `3cd55a3732`, 원장 랜딩 `/songyuul07`
- 현재 Meta creative URL에서 `/songyuul07` 단일 후보가 확인되지 않았다.
- 결정: `fbclid`가 있어도 campaign/adset/ad 역산이 불가능하므로 quarantine 유지.

## 판정 원칙

- Meta campaign ID 또는 adset ID가 있으면 상품군 후보보다 ID 증거를 우선한다.
- 같은 alias가 여러 campaign에 걸치면 자동 확정하지 않는다. 기간, 광고비, 광고명, URL 증거를 같이 확인한다.
- `meta_` prefix가 없는 alias는 기본적으로 Meta 캠페인 매핑 대상이 아니다. `fbclid`가 있어도 campaign/adset ID가 없으면 Meta ROAS에 강제 배정하지 않는다.
- 단일 랜딩 경로 후보는 campaign-level 매칭에만 사용한다. 광고세트/광고 단위 확정은 `utm_term`, `utm_content`, `meta_adset_id`, `meta_ad_id` 같은 ID가 남았을 때만 한다.
- product-family 분류와 campaign attribution은 분리한다. 예를 들어 IGG 상품 주문이라도 Meta campaign 근거가 없으면 캠페인 ROAS에는 넣지 않는다.
- stale audit 파일과 현재 attribution ledger 수치가 다르면 현재 ledger + imweb_orders + imweb_order_items 조인을 우선하고, audit 파일 생성 시각을 같이 기록한다.

## 2026-05-21 그로스팀 추가 회신 반영

작성 시각: 2026-05-21 11:25 KST
문서 성격: 그로스팀 회신 기반 수동 landing path/adset 매핑 및 non-meta UTM 제외 사유 보강

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
  required_context_docs:
    - meta/campaign-alias-mapping.md
    - data/meta_campaign_aliases.biocom.json
    - backend/src/routes/ads.ts
  lane: Green
  allowed_actions:
    - local_code_update
    - local_doc_update
    - read_only_meta_api
    - read_only_vm_cloud_ledger
    - safe_mode_backend_smoke
  forbidden_actions:
    - production_db_write
    - meta_ads_write
    - platform_send
    - deploy
    - gtm_publish
  source_window_freshness_confidence:
    source: "Meta Ads Insights API spend + VM Cloud attribution ledger read-only + 그로스팀 회신"
    window: "2026-05-14~2026-05-20 KST, today=2026-05-21 KST"
    freshness: "2026-05-21 12:08 KST VM Cloud 배포 후 live smoke"
    confidence: "A for day-split ROAS, manual mapping campaign-level 0.92"
```

### 10초 요약

그로스팀 회신으로 `/nanabebe05`, `/hangzassi01`은 campaign/adset-level까지 수동 매핑한다.

반대로 `inpork_biocom_igg`는 Meta 광고 캠페인이 아니라 인스타그램 프로필 링크의 인포크 기능 유입을 구분하기 위한 UTM이다. 따라서 Meta 캠페인 ROAS에는 계속 붙이지 않고, 별도 non-meta influencer/profile-link 유입으로 분리한다.

### 반영할 수동 매핑

| landing path | campaign id | campaign name | adset id | adset name | confidence |
|---|---|---|---|---|---|
| `/nanabebe05` | `120245003319500396` | `meta_biocom_influencer_260506` | `120245143376260396` | `수동 검증: 광고세트명 미제공` | `manual_verified_growth_team_landing_path_20260521` |
| `/hangzassi01` | `120242626179290396` | `공동구매 인플루언서 파트너 광고 모음_3 (260323)` | `120242626179270396` | `수동 검증: 광고세트명 미제공` | `manual_verified_growth_team_landing_path_20260521` |

적용 기준:

- campaign/adset 숫자 ID를 그로스팀이 직접 제공했으므로 campaign-level 매칭은 확정한다.
- adset-level 참고는 가능하다.
- ad ID는 아직 없으므로 광고 단위 확정 매칭은 보류한다.
- 적용 위치는 `backend/src/routes/ads.ts`의 수동 검증 landing path map이다.

### `inpork_biocom_igg` 판정 보강

그로스팀 회신:

```text
campaign inpork_biocom_igg
term —
content inpork_biocom_igg
source inpork_biocom_igg
landing /igg_store
광고가 아닌 인스타그램 프로필링크 인포크 기능을 통한 유입을 구분하기 위한 UTM입니다.
```

판정:

- Meta 광고 캠페인 아님.
- Meta 숫자 campaign/adset/ad ID 없음.
- `/igg_store` 상품군 매출 분석에는 포함 가능.
- Meta 캠페인별 ROAS에는 배정하지 않음.
- 내부 채널 분류는 `non_meta_influencer_igg` 또는 `instagram_profile_link_inpork` bucket으로 분리한다.

반영 위치:

- `data/meta_campaign_aliases.biocom.json`의 `inpork_biocom_igg` entry에 제외 사유를 갱신했다.
- `selected_campaign_id`는 계속 `null`이다.

### Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source | TJ님이 전달한 그로스팀 회신 |
| window | 2026-05-21 KST 회신 기준 |
| freshness | 2026-05-21 11:25 KST 반영 |
| site | biocom |
| confidence | `/nanabebe05`, `/hangzassi01` campaign-level 0.92 / adset-level 0.85 / ad-level 보류 |

### 2026-05-21 안전 모드 ROAS 재계산 결과

실행 조건:

- 백엔드: `BACKGROUND_JOBS_ENABLED=0 npm run dev`
- API: `/api/ads/roas?account_id=act_3138805896402376&date_preset=last_7d&ledger_source=operational_vm&force=true`
- 수정: 운영 VM 원장을 기간 전체로 한 번에 읽으면 500행 제한에 걸리므로, ROAS 로딩 경로를 날짜별 분할 조회로 전환했다.
- 검증 시각: 2026-05-21 12:08 KST
- 배포: VM Cloud `seo-backend`에 `backend/src/routes/ads.ts`, `backend/dist/routes/ads.js`, `data/meta_campaign_aliases.biocom.json` 3개 파일만 반영하고 PM2 restart 1회 실행했다.
- 링크: `https://att.ainativeos.net/api/ads/roas?account_id=act_3138805896402376&date_preset=last_7d&ledger_source=operational_vm&force=true`

결과:

| 기준 | 주문 | 매출 | 광고비 | ROAS | 해석 |
|---|---:|---:|---:|---:|---|
| 캠페인 매핑 확정 Meta | 141 | `47,950,698원` | `24,435,089원` | `1.96` | 예산 판단에 우선 사용할 값 |
| Meta evidence 전체 bucket | 155 | `53,478,298원` | `24,435,089원` | `2.19` | `(unmapped)` 14건 포함 참고값 |
| `(unmapped)` quarantine | 14 | `5,527,600원` | `0원` | `null` | 캠페인 예산 판단에서 제외 |

주요 캠페인:

| campaign id | campaign name | 주문 | 매출 | 광고비 | ROAS | 비고 |
|---|---|---:|---:|---:|---:|---|
| `120245003319500396` | `meta_biocom_influencer_260506` | 64 | `23,778,550원` | `2,153,549원` | `11.04` | `/iiary02`, `/songyuul07`, 기타 숫자 ID/수동 랜딩 매칭 포함 |
| `120242626179290396` | `공동구매 인플루언서 파트너 광고 모음_3 (260323)` | 12 | `3,292,900원` | `2,515,020원` | `1.31` | 공동구매 bucket |

추가 확인:

- `today`(`2026-05-21`) 기준은 2건 / `691,400원` / 광고비 `1,788,882원` / ROAS `0.39`다. 아직 당일 주문이 적어 새 수동 매핑 효과 판단에는 부적합하다.
- `/nanabebe05`, `/hangzassi01` 자체 landing path 주문은 `2026-05-14~2026-05-20` window에서 0건이었다.
- `inpork_biocom_igg`는 광고가 아닌 인스타그램 프로필 링크/인포크 유입으로 재확인했으므로 Meta 캠페인 ROAS에서 제외한다.
- `(unmapped)` 샘플에는 blank UTM, `ig/link_in_bio`, `googleads_biocom_PM_metadream`처럼 paid Meta 캠페인으로 단정하면 안 되는 값이 섞여 있다. 따라서 총합 ROAS 2.19보다 캠페인 매핑 확정 ROAS 1.96을 예산 판단용으로 우선한다.

## 2026-05-19 `/songyuul07`·`/hwajung01` 수동 검증 반영

작성 시각: 2026-05-19 18:10 KST
문서 성격: Ads Manager 회신 기반 수동 landing path 매핑 기록

### 10초 요약

Meta API가 내려준 creative URL에서는 `/songyuul07`, `/hwajung01`을 찾지 못했다. 계정 전체 ads/adcreatives read-only 검색에서도 두 문자열은 0건이었다.

다만 TJ님이 Ads Manager에서 실제 매핑값을 회신했으므로, 두 경로는 `manual_verified_ads_manager_landing_path_20260519` 근거로 campaign/adset 매핑에 반영한다.

### Meta API read-only 확인

| 확인 범위 | row 수 | `songyuul07` | `hwajung01` | 비고 |
|---|---:|---:|---:|---|
| account ads `/act_...2376/ads` | 1,004 | 0 | 0 | creative 포함 문자열 전수 검색 |
| account adcreatives reduced fields | 2,300 | 0 | 0 | `id,name,url_tags,link_url,object_url,instagram_permalink_url` |
| songyuul adset ads | 7 | 0 | 0 | Instagram permalink만 확인 |
| hwajung adset ads | 2 | 0 | 0 | Instagram permalink만 확인 |

확인 결과:

- 해당 adset의 `creative.link_url`, `creative.object_url`, `object_story_spec`, `asset_feed_spec`에는 `biocom.kr` URL이 없었다.
- `instagram_permalink_url`은 `https://www.instagram.com/p/...` 형태였고, URL path 안에 `songyuul07` 또는 `hwajung01`은 없었다.
- `url_tags`에는 `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}` 매크로가 남아 있었다.

따라서 이번 반영은 `Meta API 자동 URL 증거`가 아니라 `Ads Manager 수동 검증 증거`다.

### 반영할 수동 매핑

| landing path | campaign id | campaign name | adset id | adset name | confidence |
|---|---|---|---|---|---|
| `/songyuul07` | `120245003319500396` | `meta_biocom_influencer_260506` | `120245370784880396` | `meta_biocom_songyuul_260512` | `manual_verified_ads_manager_landing_path_20260519` |
| `/hwajung01` | `120245003319500396` | `meta_biocom_influencer_260506` | `120245498758680396` | `meta_biocom_hwajung_260514` | `manual_verified_ads_manager_landing_path_20260519` |

### 랜딩 경로 값의 출처

`/songyuul07`, `/hwajung01`은 Meta API에서 온 값이 아니다.

내부 원장 주문을 정규화할 때 아래 후보에서 landing path를 뽑는다.

1. attribution ledger의 `landing`
2. attribution ledger의 `referrer`
3. metadata의 `imweb_landing_url`
4. metadata의 `checkout_started_landing`
5. metadata의 `checkoutUrl`
6. metadata의 `initial_referrer`
7. metadata의 `original_referrer`

즉 이번 path는 고객이 실제 사이트에서 결제까지 이어진 흐름에 남은 first-party landing evidence다. 광고 쪽 ID와 바로 연결되지 않았기 때문에, Ads Manager 수동 확인 전까지는 quarantine이 맞았다.

## 현재 기준 파일

| 파일 | 역할 | 주의점 |
|---|---|---|
| `data/meta_campaign_aliases.biocom.json` | 수동 검토 seed 및 선택 캠페인 기록 | `/ads` alias review의 주요 기준이다. |
| `data/meta_campaign_alias_audit.biocom.json` | alias별 주문/후보 audit 스냅샷 | 현재 일부 수치가 stale일 수 있다. 예: 2026-04-25 확인 기준 `cellcleanerreel`, `inpork`는 현재 원장보다 작게 잡혀 있다. |
| `meta/campaign-url-evidence.biocom.json` | Meta creative/ad URL evidence | `utm_campaign` 직접 증거와 adset -> campaign 역추적에 사용한다. |
| `backend/data/crm.sqlite3` | 로컬 attribution ledger 및 imweb 주문 캐시 | 현재 수치 확인용 primary source. 운영 DB와 다를 수 있으므로 기준 시각을 기록해야 한다. |

## 2026-05-04 운영 VM 최신 window 재분류 결과

기준 시각: 2026-05-04 11:30 KST
Primary source: 운영 VM attribution ledger read-only
Window: 2026-04-27~2026-05-03 KST inclusive
API: `/api/ads/roas?account_id=act_3138805896402376&date_preset=last_7d`

현재 matcher는 `campaign id`, `adset id`, `ad id`를 상품명/랜딩 추정보다 우선한다.
주문에 `utm_campaign={{campaign.id}}`, `utm_term={{adset.id}}`, `utm_content={{ad.id}}`, `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`가 남으면 해당 숫자 ID로 campaign을 찾는다.
`campaign_alias`는 `utm_campaign`이 비어 있을 때 보조 alias로만 쓴다.

검증된 API 수치:

```text
ledger_source: operational_vm
source_confidence: A
Meta spend: 28,559,014원
Attribution confirmed revenue: 55,743,545원
Attribution confirmed ROAS: 1.95x
Attribution confirmed orders: 185건
unmapped confirmed revenue: 10,879,100원 / 33건
adset_mapping_error: null
ad_mapping_error: null
alias_mapping_error: null
```

이번 결론:

| 후보 | 현재 결정 | 캠페인 반영 | 이유 |
|---|---|---|---|
| `meta_biocom_sosohantoon01_igg` with adset id | parent campaign 자동 반영 | yes | `utm_term` 또는 adset id가 있으면 parent campaign으로 안전하게 역추적 가능하다. |
| `meta_biocom_sosohantoon01_igg` alias-only | 수동 확인 필요 | no | id 없이 alias만 남은 후보가 있다. read-only 후보 기준 약 12건 / 3,933,000원으로 규모가 커서 Ads Manager 확인이 필요하다. |
| `meta_biocom_kkunoping02_igg` | 수동 확인 필요 | no | 현재 seed, 2026-04-11 URL evidence, live Ads API 검색에서 campaign 증거가 확인되지 않았다. |
| `meta_biocom_skintts1_igg` with adset id | id 기준 자동 반영 | yes | `utm_term=120244759212190396`는 campaign `120244759209860396`으로 붙인다. |
| `meta_biocom_skintts1_igg` alias-only | 수동 확인 필요 | no | 같은 alias가 여러 campaign에 걸칠 수 있어 alias 단독으로 확정하면 위험하다. |
| `fbclid only` | quarantine | no | Meta 클릭 흔적은 있지만 어느 campaign인지 알 수 없다. landing/상품군만 보고 붙이지 않는다. |
| `inpork_biocom_igg` | non-meta influencer/profile-link 유입 | no | 2026-05-21 그로스팀 확인 기준, 광고가 아니라 인스타그램 프로필 링크의 인포크 기능 유입 구분용 UTM이다. |

다음 액션은 그로스 파트장의 Ads Manager export다.
필수 컬럼은 `campaign id`, `campaign name`, `adset id`, `adset name`, `ad id`, `ad name`, `Website URL`, `URL Parameters`, `spend`, `purchase`, `purchase conversion value`다.

## 2026-04-25 재분류 제안

기준 시각: 2026-04-25 KST
Primary source: `backend/data/crm.sqlite3`의 `attribution_ledger`, `imweb_orders`, `imweb_order_items`
Cross-check source: `meta/campaign-url-evidence.biocom.json`, `data/meta_campaign_aliases.biocom.json`, `data/meta_campaign_alias_audit.biocom.json`

| alias | 제안 | 대상 | 자신감 | 현재 원장 영향 | 근거 |
|---|---|---|---:|---:|---|
| `meta_biocom_cellcleanerreel_igg` | Meta campaign 매핑 | `120213362391690396` `[바이오컴] 음식물 과민증 검사 전환캠페인(10/14~)` | 93% | 4건 / 1,060,200원 | attribution ledger의 모든 confirmed 주문에 `utm_term=120213362391830396`가 있고, 이 adset은 `campaign-url-evidence`에서 `120213362391690396` 하위로 확인된다. 랜딩도 4건 모두 `/igg_store`다. |
| `meta_biocom_cellcleanerreel_igg` | 기존 UI 후보 reject | `120215102309650396` 건강기능식품, `120242626179290396` 공동구매 | 90% | - | 현재 seed의 후보 2개는 상품명/공동구매 추정 기반 후보로 보이며, 직접 adset parent 증거보다 약하다. |
| `inpork_biocom_igg` | Meta campaign에 매핑하지 않음 | `non_meta_influencer_igg` 또는 `instagram_profile_link_inpork` | 95% | 7건 / 1,969,500원 | 2026-05-21 그로스팀 확인 기준, 광고가 아니라 인스타그램 프로필 링크의 인포크 기능 유입 구분용 UTM이다. 캠페인 ROAS에 강제 배정하면 광고 성과가 부풀려진다. |
| `inpork_biocom_igg` | product-family만 분류 | IGG / 음식물 과민증 | 97% | 7건 / 1,969,500원 | 7건 모두 `/igg_store` 랜딩이고 주문 상품도 음식물 과민증 분석이다. 다만 이는 상품군 분류이지 Meta campaign attribution이 아니다. |

## 확인된 원장 수치

```text
utm_campaign                     utm_term            confirmed_orders  confirmed_amount  first_seen_utc            last_seen_utc
-------------------------------  ------------------  ----------------  ----------------  ------------------------  ------------------------
inpork_biocom_igg                (empty)             7                 1969500           2026-04-04T00:09:37.633Z  2026-04-11T20:25:52.902Z
meta_biocom_cellcleanerreel_igg  120213362391830396  4                 1060200           2026-04-02T22:30:51.005Z  2026-04-11T01:42:10.047Z
```

`data/meta_campaign_alias_audit.biocom.json`에는 두 alias가 각각 1건 / 245,000원으로 잡혀 있다. 따라서 이 audit 파일은 현재 로컬 원장 기준으로 stale하게 봐야 한다.

## 구현 제안

1. `meta_biocom_cellcleanerreel_igg`는 seed에서 `manual_verified`로 올리고 `selected_campaign_id=120213362391690396`를 기록한다.
2. `cellcleanerreel`의 기존 후보 `120215102309650396`, `120242626179290396`는 rejected 후보로 남긴다.
3. `inpork_biocom_igg`는 Meta campaign alias seed에 억지로 붙이지 않는다. 2026-05-21 회신 기준 별도 `non_meta_influencer_igg` 또는 `instagram_profile_link_inpork` bucket으로 분리한다.
4. `/ads` 화면의 alias review 후보 생성 로직은 `utm_term` adset parent campaign을 후보 생성에 반영해야 한다. 현재처럼 상품군/캠페인명 추정 후보만 보이면 정답 캠페인이 누락될 수 있다.
5. 반영 후에는 해당 기간으로 `/api/ads/roas`를 다시 계산해 `(unmapped)` 감소, 캠페인별 attributed revenue 증가, 총액 중복 여부를 검증한다.

## 장기 개선

광고 URL에는 사람이 만든 alias와 Meta 실제 ID를 동시에 남기는 방식이 가장 안전하다.

```text
utm_source=meta
utm_medium=paid_social
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
campaign_alias=meta_biocom_yeonddle_igg
meta_campaign_id={{campaign.id}}
meta_adset_id={{adset.id}}
meta_ad_id={{ad.id}}
```

이렇게 되면 campaign-level 매핑은 수동 yes/no가 아니라 ID direct match로 끝난다. 사람이 만든 alias는 인플루언서/소재/랜딩 분석용 보조 필드로만 사용하면 된다.
