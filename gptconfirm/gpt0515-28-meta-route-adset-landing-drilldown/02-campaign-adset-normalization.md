# Meta UTM campaign/adset/ad 정규화

작성 시각: 2026-05-16 02:30 KST

## 결론

현재 UTM에는 숫자형 bucket이 많이 남아 있지만, Meta Graph API read-only로 상당수는 실제 이름까지 매핑됐다. 중요한 구조는 아래다.

- `utm_campaign` 숫자형 값은 대체로 Meta campaign ID다.
- `utm_content` 숫자형 값은 대체로 Meta ad ID다.
- `utm_term` 숫자형 값은 대체로 Meta adset ID다.
- 따라서 프론트/백엔드 contract에서 `campaign/ad/adset` 순서를 다시 정규화해야 한다.

## campaign bucket 매핑

| UTM campaign bucket | Meta 객체 | 이름 | 2026-05-15 confirmed | revenue | 주요 landing |
|---|---|---|---:|---:|---|
| `120245003319500396` | campaign | `meta_biocom_influencer_260506` | 7 | 2,792,900원 | `/shop_payment`, `/hwajung01`, `/songyuul07` |
| `120242626179290396` | campaign | `공동구매 인플루언서 파트너 광고 모음_3 (260323)` | 3 | 702,000원 | `/songyuul07` |
| `120235591897270396` | campaign | `[바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020)` | 1 | 245,000원 | `/igg_store` |
| `120244876670640396` | campaign | `meta_biocom_acid_260504` | 1 | 245,000원 | `/shop_view` |
| `meta_biocom_yeonddle_igg` | manual UTM | 이름형 UTM, Graph ID 아님 | 2 | 490,000원 | `/igg_store` |
| `meta_biocom_igevsiggblog_igg` | manual UTM | 이름형 UTM, Graph ID 아님 | 1 | 484,500원 | `/igg_store` |
| `{{campaign.id}}` | broken template | 동적 매크로 미치환 | 2 | 704,000원 | `/songyuul07`, `/hwajung01` |
| `(missing)` | missing | campaign 값 없음 | 2 | 1,809,000원 | `/shop_view`, `/shop_payment` |

## UTM content 숫자형은 ad로 보인다

| UTM content bucket | Meta 객체 | 이름 | 상위 campaign | 상위 adset |
|---|---|---|---|---|
| `120245372097540396` | ad | `meta_biocom_songyuul_post2_260512` | `meta_biocom_influencer_260506` | `meta_biocom_songyuul_260512` |
| `120245498758690396` | ad | `meta_biocom_igg_hwajung_260514` | `meta_biocom_influencer_260506` | `meta_biocom_hwajung_260514` |
| `120243537994940396` | ad | `[송율x음과검4] 04.08-04.15` | `공동구매 인플루언서 파트너 광고 모음_3 (260323)` | `인플루언서 공동구매 파트너 광고` |
| `120243835822660396` | ad | `[송율x바이오컴5] 04.08-04.15` | `공동구매 인플루언서 파트너 광고 모음_3 (260323)` | `인플루언서 공동구매 파트너 광고` |
| `120245054381320396` | ad | `meta_biocom_acid_musclestory2_260507` | `meta_biocom_acid_260504` | `meta_biocom_acid_image_muscle_260507` |
| `120245391104050396` | ad | `meta_biocom_igg_yeonddle_reel_honeymoon_260512` | `[바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020)` | `음식물과민증검사_관심타겟_어드밴티지+` |

## UTM term 숫자형은 adset으로 보인다

| UTM term bucket | Meta 객체 | 이름 |
|---|---|---|
| `120245370784880396` | adset | `meta_biocom_songyuul_260512` |
| `120245498758680396` | adset | `meta_biocom_hwajung_260514` |
| `120242626179270396` | adset | `인플루언서 공동구매 파트너 광고` |
| `120235591897230396` | adset | `음식물과민증검사_관심타겟_어드밴티지+` |
| `120245053918020396` | adset | `meta_biocom_acid_image_muscle_260507` |
| `120238538162980396` | adset | `리셋데이` |

## 문제 bucket

| bucket | 문제 | 영향 | 정리 방향 |
|---|---|---|---|
| `{{campaign.id}}` / `{{ad.id}}` | Meta 동적 매크로가 실제 ID로 치환되지 않고 문자 그대로 들어옴 | 캠페인/광고세트 대조가 깨짐 | 해당 광고 URL template 수정 |
| `(missing)` | UTM campaign/ad 정보 없음 | Ads Manager와 내부 원장 연결이 약해짐 | destination URL 표준화 |
| 이름형 UTM | 사람이 읽기는 쉽지만 Graph API object join은 안 됨 | 자동 매핑 어려움 | 이름형은 유지하더라도 `campaign_id/adset_id/ad_id` 별도 보존 권장 |

## 권장 표준

Meta destination URL은 최소 아래 형태를 권장한다.

```text
utm_source=meta
utm_medium=paid_social
utm_campaign={{campaign.id}}
utm_content={{ad.id}}
utm_term={{adset.id}}
```

프론트 표시는 Graph API 매핑으로 사람이 읽는 이름을 붙인다. URL에는 이름보다 ID를 우선 보존해야 Ads Manager와 내부 원장을 안정적으로 맞출 수 있다.
