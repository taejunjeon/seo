# CampaignMappingAgent v0 계약

작성 시각: 2026-05-07 14:45 KST
상태: active design
Owner: agent / meta / campaign mapping
Supersedes: none
Next document: campaign mapping agent dry-run result
Do not use for: Meta Ads Manager 설정 변경, 광고 예산/캠페인 상태 변경

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - agent/aios-agent-runner-contract-20260507.md
    - meta/campaign-mapping-split-required-dry-run-20260507.md
    - otherpart/!otherpart.md
  lane: Green campaign mapping dry-run design
  allowed_actions:
    - Growth CSV/Excel read-only parse
    - dry-run bucket 분류
    - 외부 확인 질문 축약
  forbidden_actions:
    - Meta Ads Manager 설정 변경
    - 광고 예산/캠페인 변경
    - 플랫폼 전송
  source_window_freshness_confidence:
    source: "backend/scripts/meta-split-required-dry-run.ts + Growth manual file"
    window: "2026-05-07 KST"
    freshness: "manual input dependent"
    confidence: 0.84
```

## 10초 결론

CampaignMappingAgent는 캠페인 맵핑을 자동 확정하는 agent가 아니다.

이 agent는 Growth CSV/Excel과 로컬 seed를 비교해 `확정 가능`, `주문별 분리 필요`, `사람 확인 필요`, `Meta ROAS 제외`를 나누는 read-only agent다. Meta Ads Manager 설정은 바꾸지 않는다.

## 재사용 script

```text
backend/scripts/meta-split-required-dry-run.ts
```

## 입력

| 입력 | 기본값 | 의미 |
|---|---|---|
| `--workbook` | Downloads의 campaign mapping template | Growth 수동 확인 파일 |
| `--alias-seed` | `data/meta_campaign_aliases.biocom.json` | 로컬 alias seed |
| `--audit` | `data/meta_campaign_alias_audit.biocom.json` | 기존 audit 결과 |

## 출력 bucket

| bucket | 의미 | 처리 |
|---|---|---|
| `mapped_manual` | 사람이 확정했고 campaign id가 1개 | seed 반영 후보 |
| `split_required_order_level_needed` | 복수 campaign 또는 주문별 증거 필요 | campaign ROAS에 바로 붙이지 않음 |
| `excluded_from_meta_roas` | Meta 캠페인 ROAS 분자에서 제외 | 상품/전체 매출 참고만 가능 |
| `precision_loss_review` | Excel campaign id 손상 가능성 | Ads Manager 원본 id 재확인 |
| `quarantine_pending` | 근거 부족 | 보류 |

## 권장 명령

```bash
cd backend
npx tsx scripts/meta-split-required-dry-run.ts \
  --workbook "/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505 (1).csv"
```

주의: 현재 script는 `xlsx.readFile` 기반이라 CSV 입력 호환을 확인해야 한다. CSV에서 실패하면 v0 구현에서 CSV parser fallback을 추가한다.

## 성공 기준

1. Growth 파일 row가 모두 읽힌다.
2. dry-run bucket이 5개 중 하나로 분리된다.
3. split_required 매출이 따로 합산된다.
4. 사람이 확인할 질문이 `otherpart/!otherpart.md`에 1~3개로 축약된다.
5. Meta campaign ROAS 분자를 실제로 바꾸지 않는다.

## 금지선

- Meta Ads Manager 설정 변경 금지.
- 광고 예산 변경 금지.
- campaign id 강제 배정 금지.

## 다음 구현 작업

1. CSV fallback parser를 추가할지 검토한다.
2. `otherpart/!otherpart.md` 자동 업데이트 후보 규칙을 만든다.
3. `precision_loss_review`가 있으면 Growth 확인 질문으로만 남긴다.

