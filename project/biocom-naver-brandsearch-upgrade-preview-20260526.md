# Biocom 브랜드검색 6건 Upgrade Preview 20260526

작성 시각: 2026-05-26 00:58 KST  
기준일: 2026-05-26  
문서 성격: read-only/no-send/no-write preview 결과보고

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
  lane: Green
  allowed_actions:
    - local_json_read
    - no_write_preview
    - documentation_update
  forbidden_actions:
    - operating_db_write
    - vm_cloud_sqlite_write
    - backend_deploy_or_restart
    - naver_ads_state_change
    - platform_conversion_send
  source_window_freshness_confidence:
    source: data/project/naver-brandsearch-order-bridge-preview-20260525.json + data/project/biocom-naver-brandsearch-unresolved-narrowing-20260526.json
    window: 2026-05-22~2026-05-25 KST
    freshness: 2026-05-26 00:58 KST local preview
    confidence: medium_high for upgrade candidate, high for no-write invariant
```

## 10초 요약

biocom 브랜드검색의 현재 보수 기준은 운영DB exact 13건만 쓰는 ROAS 16.39다. 기존 미해결 6건은 VM Cloud Imweb 주문 캐시에서 모두 주문키 exact match가 나서, 조건부 후보로 인정하면 ROAS 후보는 25.60이 된다.

Codex 추천은 `조건부 인정`이다. 운영DB를 버리자는 뜻이 아니라, 화면과 보고서에서 `보수 기준`과 `VM exact 후보 포함 기준`을 분리 표시하자는 뜻이다.

## 숫자

| 기준 | 광고비 | 매출 | 주문 bridge | ROAS | 사용 판단 |
|---|---:|---:|---:|---:|---|
| 보수 기준: 운영DB exact만 | 205,336원 | 3,364,432원 | 13건 | 16.39 | 현재 예산 보고 primary |
| 후보 기준: 운영DB exact + VM Cloud exact 6건 | 205,336원 | 5,257,616원 | 19건 | 25.60 | source 정책 승인 후 후보 |

추가 후보는 6건, 1,893,184원이다. 보수 기준 대비 매출 후보는 56.27% 늘고, ROAS는 9.21 올라간다.

## 왜 조건부 인정을 추천하는가

1. 기존 미해결 6건 모두 VM Cloud `imweb_orders`에서 주문키 exact match가 났다.
2. 6건 금액 합계가 브랜드검색 marker gap과 맞는다.
3. 운영DB exact가 0인 이유는 주문 부재가 아니라 운영DB sync/key 기준 차이일 가능성이 높다.
4. 다만 운영DB를 primary에서 제거하는 결정은 아니므로, 최종 화면에는 두 값을 분리해야 한다.

## 사용 규칙

- 현재 리포트 primary: 운영DB exact 13건 기준 ROAS 16.39.
- 후보 리포트: VM Cloud exact 6건 포함 ROAS 25.60.
- 광고 플랫폼 전환 전송: 사용 금지.
- 운영DB 수정: 금지.
- 다음 승격 조건: 운영DB sync/key gap 원인을 닫거나, `VM Cloud imweb_orders exact를 브랜드검색 주문 bridge 보조근거로 인정`하는 정책을 정본에 고정한다.

## 산출물

- JSON: `data/project/biocom-naver-brandsearch-upgrade-preview-20260526.json`
- 스크립트: `backend/scripts/biocom-naver-brandsearch-upgrade-preview.ts`

## 다음 할일

### Auto Green

1. 네이버 ROAS 화면/API에 두 기준을 같이 표시한다.
   - 담당: Codex
   - 무엇: 보수 기준과 후보 기준을 분리해서 보여준다.
   - 왜: TJ님이 예산 판단을 할 때 숫자의 강도를 구분해야 한다.
   - 성공 기준: `/ads/naver-roas` 또는 API 응답에 `current primary`와 `upgrade candidate`가 같이 표시된다.
   - 승인 필요 여부: 로컬 구현은 NO, VM 배포는 YES.

### Approval Needed

1. VM Cloud exact 6건을 내부 브랜드검색 ROAS 후보로 인정할지 결정한다.
   - 담당: TJ님
   - 무엇: 보수 기준만 볼지, 후보 기준도 보고서에 병기할지 결정한다.
   - 왜: 이 결정을 해야 25.60을 “참고 후보”가 아니라 “정책상 인정 후보”로 올릴 수 있다.
   - 성공 기준: `조건부 인정 / 보류 / 불인정` 중 하나가 정본 문서에 남는다.
