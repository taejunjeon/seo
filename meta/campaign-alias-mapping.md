# Meta campaign alias mapping

작성일: 2026-04-25 KST

## 목적

이 문서는 바이오컴 Meta ROAS 산출에서 `utm_campaign` alias를 Meta `campaign_id`로 매핑하는 기준과 현재 재분류 제안을 기록한다.

현재 문제는 내부 원장에는 `meta_biocom_yeonddle_igg` 같은 사람이 만든 alias가 남고, Meta 광고 데이터에는 `120213362391690396` 같은 campaign ID가 남는다는 점이다. 캠페인별 Attribution ROAS를 계산하려면 `alias -> campaign_id` 매핑이 필요하다.

## 데이터 소스 우선순위

캠페인 매핑 판단은 아래 순서로 본다.

| 우선순위 | 증거 | 판정 강도 | 설명 |
|---:|---|---|---|
| 1 | 주문 URL의 `meta_campaign_id`, `campaign_id`, `utm_campaign={{campaign.id}}` | 매우 강함 | 주문에 실제 Meta campaign ID가 남으면 사람이 만든 alias보다 우선한다. |
| 2 | 주문 URL 또는 attribution ledger의 `utm_term={{adset.id}}` | 강함 | adset ID를 Meta evidence에서 parent campaign으로 역추적할 수 있으면 campaign-level 매핑 가능하다. |
| 3 | 광고 creative URL 또는 url_tags의 `utm_campaign=alias` | 강함 | 광고 소재 URL에 alias가 직접 들어 있으면 해당 광고의 campaign으로 매핑한다. |
| 4 | 광고명/광고세트명/인플루언서명/랜딩/상품군 일치 | 중간 | 직접 ID나 URL 증거가 없을 때 보조 증거로만 사용한다. |
| 5 | 상품군만 일치 | 약함 | IGG 상품을 샀다는 사실만으로 특정 Meta 캠페인에 귀속하면 안 된다. |

## 판정 원칙

- Meta campaign ID 또는 adset ID가 있으면 상품군 후보보다 ID 증거를 우선한다.
- 같은 alias가 여러 campaign에 걸치면 자동 확정하지 않는다. 기간, 광고비, 광고명, URL 증거를 같이 확인한다.
- `meta_` prefix가 없는 alias는 기본적으로 Meta 캠페인 매핑 대상이 아니다. `fbclid`가 있어도 campaign/adset ID가 없으면 Meta ROAS에 강제 배정하지 않는다.
- product-family 분류와 campaign attribution은 분리한다. 예를 들어 IGG 상품 주문이라도 Meta campaign 근거가 없으면 캠페인 ROAS에는 넣지 않는다.
- stale audit 파일과 현재 attribution ledger 수치가 다르면 현재 ledger + imweb_orders + imweb_order_items 조인을 우선하고, audit 파일 생성 시각을 같이 기록한다.

## 현재 기준 파일

| 파일 | 역할 | 주의점 |
|---|---|---|
| `data/meta_campaign_aliases.biocom.json` | 수동 검토 seed 및 선택 캠페인 기록 | `/ads` alias review의 주요 기준이다. |
| `data/meta_campaign_alias_audit.biocom.json` | alias별 주문/후보 audit 스냅샷 | 현재 일부 수치가 stale일 수 있다. 예: 2026-04-25 확인 기준 `cellcleanerreel`, `inpork`는 현재 원장보다 작게 잡혀 있다. |
| `meta/campaign-url-evidence.biocom.json` | Meta creative/ad URL evidence | `utm_campaign` 직접 증거와 adset -> campaign 역추적에 사용한다. |
| `backend/data/crm.sqlite3` | 로컬 attribution ledger 및 imweb 주문 캐시 | 현재 수치 확인용 primary source. 운영 DB와 다를 수 있으므로 기준 시각을 기록해야 한다. |

## 2026-04-25 재분류 제안

기준 시각: 2026-04-25 KST
Primary source: `backend/data/crm.sqlite3`의 `attribution_ledger`, `imweb_orders`, `imweb_order_items`
Cross-check source: `meta/campaign-url-evidence.biocom.json`, `data/meta_campaign_aliases.biocom.json`, `data/meta_campaign_alias_audit.biocom.json`

| alias | 제안 | 대상 | 자신감 | 현재 원장 영향 | 근거 |
|---|---|---|---:|---:|---|
| `meta_biocom_cellcleanerreel_igg` | Meta campaign 매핑 | `120213362391690396` `[바이오컴] 음식물 과민증 검사 전환캠페인(10/14~)` | 93% | 4건 / 1,060,200원 | attribution ledger의 모든 confirmed 주문에 `utm_term=120213362391830396`가 있고, 이 adset은 `campaign-url-evidence`에서 `120213362391690396` 하위로 확인된다. 랜딩도 4건 모두 `/igg_store`다. |
| `meta_biocom_cellcleanerreel_igg` | 기존 UI 후보 reject | `120215102309650396` 건강기능식품, `120242626179290396` 공동구매 | 90% | - | 현재 seed의 후보 2개는 상품명/공동구매 추정 기반 후보로 보이며, 직접 adset parent 증거보다 약하다. |
| `inpork_biocom_igg` | Meta campaign에 매핑하지 않음 | `non_meta_influencer_igg` 또는 quarantine | 88% | 7건 / 1,969,500원 | 주문 상품과 랜딩은 IGG가 맞지만 campaign/adset ID가 없다. `meta_` prefix도 없고 current seed 후보도 없다. 캠페인 ROAS에 강제 배정하면 정확도가 떨어진다. |
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
3. `inpork_biocom_igg`는 Meta campaign alias seed에 억지로 붙이지 않는다. 필요하면 별도 `non_meta_influencer_igg` bucket으로 분리한다.
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
