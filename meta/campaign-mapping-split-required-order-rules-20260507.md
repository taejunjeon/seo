# Meta split_required 주문별 분리 규칙

작성 시각: 2026-05-07 00:42 KST
기준일: 2026-05-07
상태: active design
Owner: meta / campaign mapping
Supersedes: 없음
Depends on: [[campaign-mapping-growth-confirmation-20260506]], [[../total/!total-current]]
Do not use for: Meta 광고 캠페인 설정 변경, 광고비 변경, 플랫폼 전환 전송, 운영 DB/ledger write

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - meta/campaign-mapping-growth-confirmation-20260506.md
    - meta/campaign-alias-mapping.md
    - total/!total-current.md
  lane: Green
  allowed_actions:
    - read-only assignment rule design
    - local seed/output schema design
    - campaign mapping 문서화
  forbidden_actions:
    - Meta Ads campaign 변경
    - 광고비 변경
    - platform conversion 전송
    - 운영 DB/ledger write
  source_window_freshness_confidence:
    source: "그로스파트 엑셀 + data/meta_campaign_aliases.biocom.json + 기존 Meta URL evidence"
    window: "2026-05-04~2026-05-07 KST"
    freshness: "수동 확인 최신. 일부 candidate campaign id는 local audit missing"
    confidence: 0.86
```

## 10초 결론

`split_required` alias는 Meta campaign ROAS에 바로 넣으면 안 된다. 이 값은 `Meta 증거는 있으나 campaign이 하나로 닫히지 않은 주문 묶음`이다.

분리 규칙의 핵심은 단순하다.

> **주문별 ad id, adset id, campaign id, URL Parameters, 날짜 window 증거가 있는 주문만 campaign에 붙인다. alias만 있는 주문은 campaign ROAS에 넣지 않고 quarantine으로 둔다.**

이 문서는 구현 전 설계다. 실제 운영 DB write, Meta 전송, 광고 설정 변경은 없다.

## 다음 할일

| 순서 | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 컨펌 필요 |
|---:|---|---|---|---|---|---|
| 1 | 진행 가능 | Codex | split assignment dry-run script 설계 | 주문별로 어떤 campaign에 붙일 수 있는지 미리 봐야 한다 | `meta_split_assignment_v1` 출력 스키마를 기준으로 로컬 read-only 산출 | NO |
| 2 | 진행 가능 | Codex | audit missing campaign id 목록을 별도 표로 유지 | 최신 Ads Manager에는 있는데 로컬 audit에는 없을 수 있다 | `audit_missing_campaign_id` block_reason으로 분리 | NO |
| 3 | TJ/그로스 판단 | TJ님 또는 그로스파트 | audit missing campaign id 최신 export 제공 여부 결정 | campaign name/status가 없으면 확정 assignment가 약해진다 | Ads Manager campaign id 검색 또는 최신 export 제공 | 선택 |

## 대상 alias

| alias | 후보 campaign id | 현재 처리 |
|---|---|---|
| `meta_biocom_sosohantoon01_igg` | `120242626179290396`, `120237452088280396` | split_required |
| `meta_biocom_skintts1_igg` | `120244759209860396`, `120213362391690396`, `120235591897270396` | split_required |
| `meta_biocom_proteinstory_igg` | `120235591897270396`, `120213362391690396`, `120236373509560396` | split_required |
| `meta_biocom_iggspring` | `120213362391690396`, `120235591897270396` | split_required |
| `meta_biocom_iggacidset_2026` | `120237452088280396`, `120235591897270396` | split_required |
| `meta_biocom_mingzzinginstatoon_igg` | `120235591897270396`, `120235640158940396`, `120240314792490396` | split_required |
| `meta_biocom_iggpost_igg` | `120213362391690396`, `120235591897270396` | split_required |

## 절대 원칙

1. 상품군이 IGG라는 이유만으로 Meta campaign에 붙이지 않는다.
2. `fbclid`만 있는 주문은 Meta 클릭 증거가 있을 수 있지만 campaign-level ROAS 증거로는 부족하다.
3. alias가 같은 여러 campaign 후보에 동시에 존재하면 `alias-only`는 확정 근거가 아니다.
4. `audit missing` campaign id는 최신 export가 오기 전까지 campaign name/status를 확정하지 않는다.
5. 분리 실패 주문은 버리지 않는다. `unknown_quarantine` 또는 `meta_split_unresolved`로 보관한다.

## 주문별 assignment 우선순위

| 우선순위 | 증거 | 처리 | confidence |
|---:|---|---|---|
| 1 | 주문 payload 또는 attribution ledger에 `meta_campaign_id`가 있고 후보 목록과 일치 | 해당 campaign 확정 | A |
| 2 | `meta_ad_id` 또는 `utm_content`가 Meta URL evidence의 ad id와 직접 일치 | ad가 속한 campaign 확정 | A |
| 3 | `meta_adset_id` 또는 `utm_term`이 Meta URL evidence의 adset id와 직접 일치 | adset이 속한 campaign 확정 | A/B |
| 4 | `utm_campaign` alias + landing URL + 주문일이 특정 candidate campaign active window와 단일 일치 | 해당 campaign 임시 확정 | B |
| 5 | `utm_campaign` alias + 후보 campaign 다수 + id/date 단서 없음 | `meta_split_unresolved` | C/D |
| 6 | `fbclid`만 있음 | `meta_click_evidence_campaign_unknown` | C |
| 7 | Meta 숫자 ID 없음 또는 non-meta source | Meta campaign ROAS 제외 | D |

## block_reason taxonomy

| block_reason | 의미 |
|---|---|
| `alias_only_multiple_campaign_candidates` | alias는 있으나 여러 campaign 후보가 있어 단일 campaign 불가 |
| `missing_meta_campaign_id` | 주문에 campaign id가 없음 |
| `missing_meta_adset_or_ad_id` | 주문에 adset/ad id가 없음 |
| `audit_missing_campaign_id` | 그로스파트 후보 ID가 로컬 audit에 없음 |
| `fbclid_only_campaign_unknown` | fbclid는 있으나 campaign 증거 없음 |
| `date_window_ambiguous` | 주문일이 여러 campaign window와 겹침 |
| `non_meta_or_influencer_only` | 상품/인플루언서 맥락은 있으나 Meta 캠페인 증거 없음 |
| `quarantine_until_export_refresh` | 최신 Meta export 전까지 보류 |

## 출력 스키마 초안

```json
{
  "assignment_version": "meta_split_assignment_v1",
  "site": "biocom",
  "order_number": "string",
  "alias_key": "meta_biocom_proteinstory_igg",
  "order_paid_at": "2026-04-30T12:00:00+09:00",
  "confirmed_revenue": 250000,
  "selected_campaign_id": "120235591897270396",
  "selected_campaign_name": "[바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020)",
  "assignment_status": "assigned|quarantine|excluded",
  "assignment_method": "campaign_id|ad_id|adset_id|date_window|alias_only_quarantine|fbclid_only_quarantine",
  "evidence_confidence": "A|B|C|D",
  "block_reason": null,
  "source_docs": [
    "campaign-mapping-growth-confirmation-20260506",
    "campaign-mapping-split-required-order-rules-20260507"
  ]
}
```

## 구현 전 dry-run 기준

dry-run은 아래 4개 묶음을 반드시 나눠 출력한다.

| 묶음 | 의미 | ROAS 반영 |
|---|---|---|
| `assigned_by_id_evidence` | campaign/adset/ad id가 주문별로 확인됨 | YES |
| `assigned_by_date_window` | alias + 날짜 window가 단일 후보로 닫힘 | 조건부 YES |
| `meta_split_unresolved` | alias만 있고 후보가 다수임 | NO |
| `excluded_non_meta` | Meta campaign 증거 없음 | NO |

성공 기준:

- `split_required` 전체 매출을 단일 campaign에 강제 배정하지 않는다.
- `assigned_by_id_evidence`와 `assigned_by_date_window`만 campaign ROAS에 들어간다.
- `meta_split_unresolved`는 Action Queue에 남긴다.
- dry-run 합계는 전체 split_required 매출과 일치한다.

## 개발자 메모

초기 구현은 read-only script로 충분하다.

추천 출력 파일:

```text
data/meta_split_assignment_v1.biocom.20260507.json
```

추천 리포트:

```text
meta/campaign-mapping-split-required-dry-run-YYYYMMDD.md
```

이후 `/ads/campaign-mapping` 화면에는 `확정`, `분리 완료`, `분리 불가`, `제외` 네 상태만 노출한다.

