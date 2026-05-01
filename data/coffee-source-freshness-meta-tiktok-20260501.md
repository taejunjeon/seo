# 더클린커피 Meta / TikTok Source Freshness Read-only

생성 시각: 2026-05-01 KST
site: `thecleancoffee`
mode: `read_only`
window: 2026-04-24 ~ 2026-04-30 (지난 7일, KST 일자 고정)
Source:
- Meta Marketing API `https://graph.facebook.com/v19.0` (account `act_654671961007474`, `COFFEE_META_TOKEN`)
- TikTok Business API `https://business-api.tiktok.com/open_api/v1.3` (`TIKTOK_BUSINESS_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID`)

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_source_freshness_meta_tiktok
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
PII output: NONE (telephone/contacter/license/address 필드는 의도적으로 제외)
New executable send path added: NO
Actual network send observed: NO (read-only GET 만)
```

## 10초 요약

Meta `act_654671961007474` 와 TikTok advertiser `7593201373714595856` 모두 last_7d insights 응답이 정상이다. token freshness 닫혔고, ROAS read-only 비교 단계로 진입 가능.

다만 TikTok advertiser 의 description 이 `biocom.kr` 이라 더클린커피 광고비 분리가 advertiser 단위가 아니라 campaign/adgroup 단위로 일어난다는 점을 잊으면 안 된다.

## Meta Health

| 항목 | 값 |
| --- | --- |
| account_id | `act_654671961007474` |
| account name | 더클린커피 |
| account_status | 1 (active) |
| disable_reason | 0 |
| currency | KRW |
| timezone | Asia/Seoul |
| token check `/me` | OK (id `122095281926692834`, name "SEO" — system user) |
| last_7d window | 2026-04-24 ~ 2026-04-30 |
| last_7d spend | 344,728원 |
| last_7d impressions | 11,801 |
| last_7d clicks | 300 |
| API quota / latency | 단일 read 요청 < 1s (구체 quota 비측정) |

해석:
- last_7d spend 344,728원 / clicks 300 → 평균 CPC 1,149원
- account 정상, token 만료 신호 없음
- coffee 전용 spend 가 advertiser 전체 spend 와 동일 (biocom 과 ad account 분리됨)
- ROAS 비교 다음 단계는 GA4 conversion 과 매칭 (별도 phase)

## TikTok Health

| 항목 | 값 |
| --- | --- |
| advertiser_id | `7593201373714595856` |
| status | STATUS_ENABLE |
| balance | 5,270,580 (KRW) |
| currency | KRW |
| timezone | Asia/Seoul |
| owner_bc_id | `7593201346678013969` |
| description | `biocom.kr` (advertiser 단위 description) |
| create_time | 2026-01-09 (epoch 1,767,929,980) |
| token check (`advertiser/info`) | OK (response code 0) |
| last_7d window | 2026-04-24 ~ 2026-04-30 |
| last_7d spend | 3,580,556원 |
| last_7d impressions | 1,592,977 |
| last_7d clicks | 30,209 |

해석:
- token 정상, response code 0 (OK)
- TikTok 은 한 advertiser 안에서 BIOCOM + COFFEE 캠페인이 같이 있다. advertiser 단위 spend 3,580,556원 은 두 사이트 합산이다.
- coffee 전용 spend 분리는 campaign/adgroup name 기반 라벨링이 필요하다. `data/ads_csv/tiktok/processed/*.csv` 와 `tiktok-business-report-dry-run.ts` 가 이미 campaign daily breakdown 을 만들고 있다.
- coffee 광고비 ROAS 비교 시 advertiser 전체가 아니라 campaign filter 가 들어간 값으로 비교해야 한다.

## PII 보호 — 의도적으로 출력하지 않은 필드

다음 필드는 응답 받았지만 본 보고서에 포함하지 않는다. 향후 자동화 시에도 동일하게 제외한다.

| 시스템 | 필드 |
| --- | --- |
| TikTok | `contacter` (담당자 이름, 마스킹되어 있어도 제외) |
| TikTok | `cellphone_number` (마스킹된 전화번호) |
| TikTok | `address`, `license_no`, `license_url`, `license_province`, `license_city`, `promotion_center_province`, `promotion_center_city` (사업자 식별) |
| Meta | (해당 호출에서는 PII 응답 없음) |

## 다음 단계 (별도 phase)

| 단계 | 작업 |
| --- | --- |
| ROAS R1 | Meta 7d spend 344,728원 + TikTok coffee campaign 분리 spend → GA4 / Imweb actual 주문 7d 와 같은 window 비교 |
| ROAS R2 | GA4 purchase / Imweb NPay actual / 자사몰 결제완료 의 3장부 합계와 광고비 ROAS 산출 |
| ROAS R3 | GA4 만 보면 NPay synthetic 한계로 음영 발생 → Imweb actual 기준 ROAS 와 GA4 기준 ROAS 의 차이 분해 |
| ROAS R4 | TikTok advertiser 단위 spend 와 coffee campaign 단위 spend 의 비율 표 |

## 변경되는 동작

- 실제 광고비 송출, 전환 보강 전송, GTM publish 0건.
- 외부 API 호출은 read-only GET 4건만 (`/me`, `/{act}`, `/{act}/insights`, `/advertiser/info/`, `/report/integrated/get/`).
- 로컬 DB write 0건.
- coffee 데이터 하네스 `harness/coffee-data/RULES.md` 의 read-only 규칙 준수.

## 관련 문서

- [[!coffeedata#Phase3-Sprint7|!coffeedata § Phase3-Sprint7]] — Meta/TikTok/ROAS 정합성
- [[harness/coffee-data/CONTEXT_PACK|Coffee Context Pack]]
- [[coffee-imweb-operational-readonly-20260501|아임웹/운영 DB Read-only]]
- [[coffee-ga4-baseline-20260501|GA4 BigQuery 기준선]]
