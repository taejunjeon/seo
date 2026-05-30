# 바이오컴 UTM 관리 양식 보강안

작성 시각: 2026-05-22 18:20 KST
기준일: 2026-05-22
문서 성격: 그로스팀 요청용 UTM 관리 양식 보강안 + UTM 후보 사전 사용법
Site: biocom
Lane: Green, read-only/local artifact

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - AGENTS.md
    - docurule.md
    - meta/campaign-alias-mapping.md
    - data/meta_campaign_aliases.biocom.json
    - utm/[바이오컴] UTM 관리.xlsx
    - utm/[바이오컴] UTM 관리 - Builder (자동소문자화 기능 있음).csv
  lane: Green
  allowed_actions:
    - read_local_utm_files
    - generate_local_csv_candidates
    - write_local_decision_doc
  forbidden_actions:
    - production_db_write
    - vm_cloud_deploy
    - meta_ads_write
    - gtm_publish
    - platform_send
  source_window_freshness_confidence:
    source: "로컬 UTM XLSX/CSV + 기존 Meta alias mapping JSON"
    window: "UTM 파일 내 파싱 가능 날짜 2023-01-02~2026-06-04, 파일 수정시각 2026-05-22 17:39 KST"
    freshness: "2026-05-22 18:20 KST 로컬 read-only 변환"
    confidence: "후보 사전 구조 0.90, 캠페인 확정 매핑은 별도 Meta API/그로스팀 ID 확인 전 0.55~0.75"
```

## 10초 요약

새 UTM 관리 파일은 Meta ROAS 미매칭을 줄이는 데 도움이 된다. 다만 현재 양식에는 `campaign_id`, `adset_id`, `ad_id` 같은 숫자 ID가 없어서 이 파일만으로 A급 확정 매칭은 어렵다.

이번에 UTM 파일을 후보 사전 2개로 변환했다. 앞으로 그로스팀은 기존 UTM alias와 함께 Meta 숫자 ID, 최종 광고 URL, URL Parameters 검수 시각을 남기면 캠페인/광고세트/광고 단위 매칭 정확도가 크게 올라간다.

## 이번 산출물

| 파일 | 용도 | 행 수 |
|---|---|---:|
| `utm/biocom-utm-mapping-candidates-20260522.csv` | 원본 UTM 행 단위 후보 사전. 원장 landing path, UTM 값, 기존 매핑 상태를 같이 본다. | 1,847 |
| `utm/biocom-utm-alias-summary-20260522.csv` | alias 단위 요약 사전. `meta_biocom_songyuul07_igg`처럼 alias별로 빠르게 찾는다. | 1,754 |

## 현재 파일에서 바로 쓸 수 있는 것

1. 사람이 만든 UTM 별칭을 찾을 수 있다.
   - 예: `meta_biocom_songyuul07_igg`, `meta_iiarytoon_igg`, `inpork_biocom_igg`.
2. 랜딩 경로 표기 차이를 보정할 수 있다.
   - 예: UTM 파일에는 `/songyuul_07`, 원장에는 `/songyuul07`처럼 들어올 수 있다.
   - 후보 사전에는 `ledger_path_candidates`를 넣어 `/songyuul_07`, `/songyuul07`을 같이 찾게 했다.
3. Meta 광고가 아닌 인스타/인포크 유입을 분리할 수 있다.
   - 예: `inpork_biocom_igg`는 `instagram_profile_link_inpork`로 분류했다.
   - Meta 캠페인 ROAS에는 붙이지 않는 것이 맞다.

## 현재 양식의 한계

이 파일은 "UTM을 어떻게 만들었는지"를 보여준다. 하지만 "실제 Meta 광고 소재가 현재 어떤 URL을 쓰고 있는지"는 보장하지 않는다.

추가로 원본 파일 일부 행에는 보이지 않는 제어문자가 있었다. 후보 사전 생성 시 26개 행에서 제어문자를 제거했고, 해당 행에는 `quality_flags=control_char_cleaned`를 남겼다.

따라서 현재 양식만으로 가능한 판정은 아래 수준이다.

| 등급 | 현재 양식으로 가능한가 | 설명 |
|---|---|---|
| A급: 숫자 `campaign_id/adset_id/ad_id` 있음 | 거의 불가 | 현재 파일에는 숫자 Meta ID 컬럼이 없다. |
| B급: 고유 `campaign_alias` 있음 | 가능 | 단일 alias면 준확정 후보가 된다. Meta API URL 조인이 필요하다. |
| C급: 랜딩 URL/광고명/광고세트명 후보 | 일부 가능 | 관리메모와 랜딩 URL은 있으나 실제 광고명/세트명이 없다. |
| D급: placeholder/profile/fbclid only | 일부 가능 | 인포크, generic meta, 누락값은 격리해야 한다. |

## 그로스팀 양식에 추가해야 할 컬럼

### 필수 컬럼

| 컬럼명 | 왜 필요한가 | 입력 예시 |
|---|---|---|
| `is_paid_ad` | 광고와 인스타 프로필/인포크 유입을 분리한다. | `Y` / `N` |
| `platform` | Meta, Google, Naver 등 플랫폼을 고정한다. | `meta` |
| `account_id` | 광고 계정을 구분한다. | `act_3138805896402376` |
| `campaign_id` | 캠페인 ROAS 확정 매칭의 핵심값이다. | `120245003319500396` |
| `campaign_name` | 사람이 보는 캠페인명이다. | `meta_biocom_influencer_260506` |
| `adset_id` | 광고세트 ROAS 확정 매칭의 핵심값이다. | `120245370784880396` |
| `adset_name` | 사람이 보는 광고세트명이다. | `meta_biocom_songyuul_260512` |
| `ad_id` | 광고/소재 단위 ROAS 확정 매칭의 핵심값이다. | `120245370784900396` |
| `ad_name` | 사람이 보는 광고명이다. | `songyuul07_reels_01` |
| `meta_status` | 현재 운용 중인 광고만 분리한다. | `ACTIVE` / `PAUSED` |
| `effective_status` | 플랫폼 실제 게재 상태를 본다. | `ACTIVE` / `ADSET_PAUSED` |
| `final_landing_url` | 실제 클릭 URL을 확인한다. | `https://biocom.kr/songyuul_07?...` |
| `url_parameters` | Meta URL Parameters 필드 원문을 남긴다. | `utm_source=meta...` |
| `checked_at_kst` | 언제 확인한 값인지 남긴다. | `2026-05-22 18:20 KST` |
| `checked_by` | 누가 확인했는지 남긴다. | `growth_team_name` |

### 강력 추천 컬럼

| 컬럼명 | 왜 필요한가 | 입력 예시 |
|---|---|---|
| `campaign_alias` | 숫자 ID가 깨졌을 때 B급 후보로 쓴다. | `meta_biocom_songyuul07_igg` |
| `adset_alias` | 숫자 ID가 없을 때 광고세트 후보를 좁힌다. | `songyuul07_reels` |
| `ad_alias` | 소재 단위 후보를 좁힌다. | `reels_01` |
| `landing_path_normalized` | `/songyuul_07`과 `/songyuul07`을 같은 후보로 묶는다. | `/songyuul07` |
| `product_family` | IGG, 종대사, 영중검 등 상품군을 분리한다. | `igg` |
| `source_type` | 광고/인포크/CRM/공동구매/브랜드검색을 분리한다. | `paid_meta_ad` |
| `proof_type` | 증거 출처를 남긴다. | `ads_manager_url_parameters` |
| `proof_url_or_note` | 캡처/내보내기 파일/확인 메모를 남긴다. | `Ads Manager export 2026-05-22` |

## 권장 UTM 규칙

### Meta 유료 광고

Meta 유료 광고는 숫자 ID와 사람이 읽는 alias를 같이 남기는 방식이 가장 안전하다.

권장 URL Parameters:

```text
utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}&campaign_alias=meta_biocom_songyuul07_igg&adset_alias=meta_biocom_songyuul_260512&ad_alias=songyuul07_reels_01
```

이 방식의 의미:

- `utm_campaign={{campaign.id}}`: 캠페인 숫자 ID. A급 매칭에 쓴다.
- `utm_term={{adset.id}}`: 광고세트 숫자 ID. 광고세트 매칭에 쓴다.
- `utm_content={{ad.id}}`: 광고 숫자 ID. 소재 매칭에 쓴다.
- `campaign_alias`: 숫자 ID가 비거나 placeholder로 들어올 때 B급 후보로 쓴다.

단, 이미 머신러닝이 안정된 광고의 랜딩 URL을 무리하게 바꾸는 것은 권장하지 않는다. 기존 운용 소재는 먼저 Meta API read-only 조회와 현재 UTM alias 사전으로 매칭하고, 신규 소재/수정이 필요한 소재부터 이 규칙을 적용하는 편이 낫다.

### 인스타 프로필/인포크 링크

Meta 광고가 아닌 인스타 프로필/인포크 링크는 Meta ROAS에 붙이면 안 된다.

권장값:

```text
utm_source=inpork_biocom_igg&utm_medium=profile_link&utm_campaign=inpork_biocom_igg&utm_content=inpork_biocom_igg
```

또는 표준화한다면:

```text
utm_source=instagram&utm_medium=profile_link&utm_campaign=inpork_biocom_igg&utm_content=igg_store
```

중요한 점은 `is_paid_ad=N`, `source_type=instagram_profile_link_inpork`를 같이 남기는 것이다. 그래야 Meta 광고 캠페인 ROAS에서 제외할 수 있다.

## 이번 후보 사전의 해석 기준

| 후보 사전 등급 | 의미 | 다음 처리 |
|---|---|---|
| `A_numeric_id` | UTM 안에 숫자 Meta ID가 있다. | 바로 확정 매핑 가능 |
| `B_existing_manual_verified` | 기존 수동 매핑 원장에 campaign ID가 있다. | 현재 로직에 반영 가능 |
| `B_split_required_existing` | 기존 원장에서 분리 필요로 표시됐다. | 날짜/adset/ad ID로 재확인 |
| `B_alias_candidate_needs_meta_api_join` | 고유 Meta alias 후보가 있다. | Meta API 광고 URL과 조인 |
| `C_meta_generic_needs_join` | `source=meta`, `campaign=meta`처럼 너무 일반적이다. | content/landing/ad name으로 보조 확인 |
| `C_landing_alias_candidate` | 랜딩과 alias는 있으나 광고 여부가 불명확하다. | 그로스팀 확인 또는 플랫폼 API 조인 |
| `D_exclude_meta_roas` | 인포크/프로필 링크처럼 Meta 광고가 아니다. | Meta ROAS 제외, 별도 채널 분리 |
| `D_incomplete_or_unusable` | 필수값 누락/URL 오류가 있다. | 수동 보정 전 격리 |

## 현재 주요 케이스

### `/songyuul07`

UTM 파일에는 `/songyuul_07`로 있고 alias는 `meta_biocom_songyuul07_igg`다.

원장에는 `/songyuul07`처럼 들어올 수 있으므로 후보 사전의 `ledger_path_candidates`에서 둘 다 찾도록 했다. 이 값은 캠페인 후보를 좁히는 데 도움 된다. 다만 광고세트/광고 확정은 `adset_id`, `ad_id`가 있어야 한다.

### `/iiary02`

UTM 파일에는 `/iiary02`가 아니라 `/i_iary2`, alias `meta_iiarytoon_igg`가 있다.

이 값은 이아리 관련 Meta UTM 후보가 있었다는 참고 근거다. 하지만 이미 승인된 `/iiary02 -> meta_biocom_iiari_acid_260518` 캠페인 매핑과는 alias가 다르므로 이 파일만으로 대체 확정하면 안 된다.

### `inpork_biocom_igg`

UTM 파일에도 `인포크링크_바이오컴_음과검`으로 존재한다.

그로스팀 회신과 일치한다. 이 값은 Meta 광고가 아니라 인스타그램 프로필/인포크 유입이다. Meta 캠페인 ROAS에는 제외하고, 별도 `instagram_profile_link_inpork` 채널로 분리한다.

## 그로스팀에 요청할 문안

아래 내용을 그대로 전달하면 된다.

```text
그로스팀 확인 요청드립니다.

현재 UTM 관리 파일은 캠페인 alias와 랜딩 URL 확인에는 도움이 되지만, Meta ROAS를 캠페인/광고세트/광고 단위로 확정하려면 숫자 ID가 추가로 필요합니다.

앞으로 Meta 유료 광고 행에는 아래 값을 같이 채워주세요.

1. is_paid_ad: Y/N
2. platform: meta
3. account_id
4. campaign_id / campaign_name
5. adset_id / adset_name
6. ad_id / ad_name
7. meta_status / effective_status
8. final_landing_url
9. url_parameters 원문
10. campaign_alias / adset_alias / ad_alias
11. checked_at_kst / checked_by

특히 URL Parameters는 가능하면 아래처럼 숫자 ID와 alias를 같이 넣어주세요.

utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}&campaign_alias=사람이읽는별칭&adset_alias=세트별칭&ad_alias=광고별칭

단, 이미 머신러닝이 안정된 기존 소재는 랜딩 URL을 바로 바꾸기보다 먼저 현재 URL/URL Parameters를 내보내기 또는 캡처로 확인해 주세요. 신규 소재 또는 수정이 필요한 소재부터 위 규칙을 적용하는 방식이 안전합니다.

인스타 프로필/인포크 링크는 is_paid_ad=N, source_type=instagram_profile_link_inpork로 표시해 주세요. 이 유입은 Meta 광고 캠페인 ROAS에서 제외하고 별도 채널로 보겠습니다.
```

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source | 로컬 `utm/[바이오컴] UTM 관리.xlsx`, `utm/[바이오컴] UTM 관리 - Builder (자동소문자화 기능 있음).csv`, `data/meta_campaign_aliases.biocom.json` |
| window | UTM 파일 내 파싱 가능 날짜 `2023-01-02~2026-06-04` |
| freshness | 파일 수정시각 `2026-05-22 17:39 KST`, 변환 시각 `2026-05-22 18:20 KST` |
| site | biocom |
| confidence | 후보 사전 0.90, campaign 확정 매핑은 Meta API/그로스팀 ID 확인 전 0.55~0.75 |

## 하지 않은 것

| 항목 | 상태 |
|---|---|
| 운영DB write | 하지 않음 |
| VM Cloud deploy/restart | 하지 않음 |
| Meta 광고 설정 변경 | 하지 않음 |
| GTM publish | 하지 않음 |
| 외부 플랫폼 전송 | 하지 않음 |

## 다음 할일

### Auto Green

1. Codex가 후보 사전을 Meta API 광고 URL export와 조인한다.
   - 무엇: `primary_alias_key`, `landing_path_canonical`, `ledger_path_candidates`를 Meta ads/adcreatives URL과 read-only로 맞춘다.
   - 왜: B급 alias 후보를 실제 campaign/adset/ad 후보로 승격하기 위해서다.
   - 산출물: alias별 `campaign_id/adset_id/ad_id` 후보표.
   - 성공 기준: 단일 후보, 다중 후보, 제외 후보가 분리된다.
   - 의존성: Meta API read-only 접근 가능해야 한다.

2. Codex가 기존 미매칭 주문을 새 후보 사전으로 다시 등급화한다.
   - 무엇: `(unmapped)` 주문의 landing path/UTM alias를 새 후보 사전과 조인한다.
   - 왜: `/songyuul07`, `/iiary02`, 인포크류를 같은 기준으로 재분류하기 위해서다.
   - 산출물: 주문별 A/B/C/D 등급표.
   - 성공 기준: Meta ROAS에 붙일 후보와 제외할 후보가 분리된다.
   - 의존성: VM Cloud 원장 read-only 조회.

### Approval Needed

1. 그로스팀이 양식 컬럼 추가를 승인한다.
   - 무엇: 기존 UTM 관리 양식에 숫자 ID와 검수 컬럼을 추가한다.
   - 왜: 앞으로 수동 확인 왕복을 줄이기 위해서다.
   - 성공 기준: 신규 Meta 광고 행마다 `campaign_id/adset_id/ad_id`와 `final_landing_url`이 채워진다.
   - 의존성: 그로스팀 운영 파일 수정 권한.

### Blocked/Parked

1. 기존 운용 중인 광고의 URL 일괄 변경은 보류한다.
   - 이유: 랜딩 URL 변경은 광고 학습/검수/게재 안정성에 영향을 줄 수 있다.
   - 대안: 먼저 read-only 조인과 수동 ID 확인으로 매칭하고, 신규/수정 소재부터 새 UTM 규칙을 적용한다.
