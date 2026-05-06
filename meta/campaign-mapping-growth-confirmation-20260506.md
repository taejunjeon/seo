# Meta 캠페인 매핑 그로스파트 확인 반영

작성 시각: 2026-05-06 22:45 KST
기준일: 2026-05-06
상태: active evidence
Owner: meta / campaign mapping
Supersedes: [[campaign-alias-mapping]]의 2026-05-04 수동 확인 대기 항목 일부
Next document: split_required alias 주문별 분리 로직 설계
Do not use for: Meta 광고 캠페인 설정 변경, 광고비 변경, 플랫폼 전환 전송

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - meta/campaign-alias-mapping.md
    - meta/campaign-mapping-growth-team-guide-20260504.md
    - meta/meta-utm-setup-growth-team-guide-20260504.md
    - total/!total-current.md
  lane: Green
  allowed_actions:
    - 그로스파트 엑셀 read-only 파싱
    - campaign alias seed 업데이트
    - 문서 반영
  forbidden_actions:
    - Meta Ads 캠페인 변경
    - 광고비 변경
    - 전환 전송
    - 운영 DB/ledger write
  source_window_freshness_confidence:
    source: "/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505.xlsx"
    window: "그로스파트 확인 시각 2026-05-04 16:10 KST"
    freshness: "최신 수동 확인. 단 일부 campaign id는 현재 로컬 stale audit에 없음"
    confidence: 0.86
```

## 10초 결론

그로스파트가 작성한 엑셀을 반영했다. 핵심은 `Meta 캠페인에 확정해서 붙일 것`, `여러 campaign으로 나눠야 할 것`, `Meta 캠페인 ROAS에 붙이면 안 되는 것`을 분리하는 것이다.

이번 반영으로 `meta_biocom_kkunoping02_igg` 1건은 campaign `120242626179290396`으로 확정했다. 반대로 `inpork_biocom_igg`는 Meta 숫자 ID가 없으므로 Meta 캠페인 ROAS에서 제외했다.

나머지 7개 alias는 `split_required`로 바꿨다. 이것은 “Meta 광고 증거가 있다”는 뜻이지만, campaign이 하나로 확정되지 않았으므로 주문별 adset/ad id/date/URL Parameters로 나눠야 한다는 뜻이다.

## 반영한 파일

| 파일 | 변경 |
|---|---|
| `data/meta_campaign_aliases.biocom.json` | `확정`, `분리`, `제외` 결과를 seed에 반영 |
| [[campaign-alias-mapping]] | 현재 문서에 이 결과 링크와 요약 추가 |
| [[../total/!total-current]] | 현재 정본 Active Action Board와 Meta 매핑 최신 결론에 반영 |

## 판정 기준

| 최종 결정 | 의미 | 캠페인 ROAS 반영 |
|---|---|---|
| 확정 | campaign id가 하나로 충분히 확인됨 | YES |
| 분리 | Meta URL evidence는 있지만 여러 campaign 후보가 있어 주문별로 나눠야 함 | 자동 합산 NO |
| 제외 | Meta campaign/adset/ad id가 없거나 non-meta 유입으로 판단 | NO |
| 보류 | 증거 부족 | NO |

중요 원칙:

- 상품군이 IGG라는 이유만으로 Meta campaign에 붙이지 않는다.
- `fbclid`만 있는 주문은 Meta 클릭 흔적은 있지만 campaign/adset/ad id가 없으면 quarantine이다.
- `inpork_biocom_igg`는 IGG 상품군 매출일 수 있지만 Meta campaign ROAS가 아니다.
- `split_required`는 “버리는 값”이 아니다. 다음 단계에서 adset/ad id/date 기준으로 나눌 대상이다.

## 그로스파트 엑셀 반영 결과

| 확인 대상 | 최종 결정 | seed status | 대상 campaign id | 반영 판단 |
|---|---|---|---|---|
| `fbclid only (/sosohantoon01, /kangman03, /shop_view/?idx=503)` | 확정으로 기재됐으나 alias seed 대상 아님 | seed 미생성 | `120242626179290000` | 엑셀 숫자 ID가 현재 audit에 없고 alias key가 아니므로 문서 근거로만 보관. 주문별 ID 증거가 생기면 처리 |
| `meta_biocom_sosohantoon01_igg` | 분리 | `split_required` | `120242626179290396`, `120237452088280396` | URL Parameters 증거는 있으나 여러 campaign 후보 |
| `meta_biocom_kkunoping02_igg` | 확정 | `manual_verified` | `120242626179290396` | URL Parameters에 alias 존재. seed에 신규 확정 추가 |
| `meta_biocom_skintts1_igg` | 분리 | `split_required` | `120244759209860396`, `120213362391690396`, `120235591897270396` | 소재 분리 실험이 있어 alias-only 자동 확정 금지 |
| `inpork_biocom_igg` | 제외 | `rejected_all_candidates` | 없음 | Meta 숫자 ID 없음. non-meta influencer 또는 quarantine 유지 |
| `meta_biocom_proteinstory_igg` | 분리 | `split_required` | `120235591897270396`, `120213362391690396`, `120236373509560396` | 기존 공동구매 단일 확정 해제 |
| `meta_biocom_iggspring` | 분리 | `split_required` | `120213362391690396`, `120235591897270396` | 전환캠페인과 어드밴티지+ 양쪽 후보 |
| `meta_biocom_iggacidset_2026` | 분리 | `split_required` | `120237452088280396`, `120235591897270396` | 엑셀의 `120237452088280000`은 숫자형 절삭으로 보고 기존 seed/audit ID `120237452088280396`으로 보정 |
| `meta_biocom_mingzzinginstatoon_igg` | 분리 | `split_required` | `120235591897270396`, `120235640158940396`, `120240314792490396` | 단일 공동구매 확정 해제 |
| `meta_biocom_iggpost_igg` | 분리 | `split_required` | `120213362391690396`, `120235591897270396` | Meta URL 증거가 있으면 분리, 게시글/외부 링크만 있으면 제외 또는 보류 |

## seed 적용 효과

### 캠페인 ROAS에 바로 반영되는 것

- `meta_biocom_kkunoping02_igg`
  - campaign: `120242626179290396`
  - 의미: 그로스파트가 URL Parameters 근거로 campaign을 확정했으므로 내부 alias 매출을 해당 campaign에 붙일 수 있다.

### 캠페인 ROAS 자동 반영을 중지한 것

- `meta_biocom_proteinstory_igg`
- `meta_biocom_iggspring`
- `meta_biocom_iggacidset_2026`
- `meta_biocom_mingzzinginstatoon_igg`
- `meta_biocom_iggpost_igg`

이 alias들은 이전 seed에서 일부 `manual_verified`나 자동 확정 상태였지만, 그로스파트 확인 결과 여러 campaign 후보가 있다. 따라서 campaign-level ROAS에 단일 campaign으로 강제 합산하지 않는다.

### 제외한 것

- `inpork_biocom_igg`
  - 이유: Meta 숫자 ID 없음.
  - 처리: 상품군/인플루언서 분석에는 남길 수 있지만, Meta campaign attribution에는 넣지 않는다.

## 남은 리스크

1. 일부 campaign id가 현재 로컬 audit에 없다.
   - 예: `120244759209860396`, `120236373509560396`, `120235640158940396`, `120240314792490396`.
   - 해석: 그로스파트 Ads Manager 근거가 더 최신일 수 있다. 다음 최신 Meta API export에서 검산한다.

2. 엑셀의 `120237452088280000`, `120242626179290000`는 숫자형 절삭 가능성이 있다.
   - `120237452088280000`은 기존 seed/audit에 있는 `120237452088280396`으로 보정했다.
   - `120242626179290000`은 alias row가 아니므로 seed에는 넣지 않았다.

3. `split_required`는 아직 주문별 분리 로직이 아니다.
   - 현재 단계는 잘못된 단일 campaign 확정을 막는 안전 조치다.
   - 다음 단계에서 `utm_term`, `utm_content`, adset/ad id, 날짜 window를 사용해 실제 주문을 나눠야 한다.

## 다음 할일

1. **Codex: split_required 주문별 분리 로직 설계**
   - 무엇을: `split_required` alias 주문을 adset id, ad id, 날짜, URL Parameters로 campaign에 나눈다.
   - 왜: alias를 단일 campaign으로 붙이면 ROAS가 왜곡된다.
   - 어떻게: attribution ledger의 `utm_term`, `utm_content`, `meta_adset_id`, `meta_ad_id`, campaign URL evidence를 우선한다. 없으면 quarantine 유지.
   - 성공 기준: ID 증거가 있는 주문만 campaign ROAS에 들어가고, alias-only 주문은 별도 검토로 남는다.
   - 승인 필요: NO, read-only/로컬 로직.
   - 추천/자신감: 88%.

2. **TJ님 또는 그로스파트: audit missing campaign id 재확인**
   - 무엇을: `120244759209860396`, `120236373509560396`, `120235640158940396`, `120240314792490396`가 Ads Manager에서 실제 campaign인지 확인한다.
   - 왜: 로컬 stale audit에 없으므로 Codex가 이름과 status를 완전히 검증하지 못했다.
   - 어떻게: Ads Manager에서 campaign id 검색 또는 최신 export 제공.
   - 성공 기준: 각 ID의 campaign name/status가 확인된다.
   - Codex가 대신 못 하는 이유: 현재 로컬 audit/API snapshot에는 해당 ID가 없다. 계정 UI 최신 export가 필요하다.
   - 추천/자신감: 72%.
