# Biocom 브랜드검색 미해결 6건 추가 분해 20260526

작성 시각: 2026-05-26 00:40 KST  
기준일: 2026-05-26  
문서 성격: read-only/no-send/no-write 결과보고

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
    - read_only_vm_cloud_sqlite_query
    - read_only_operating_db_query
    - local_script_output
    - documentation_update
  forbidden_actions:
    - operating_db_write
    - vm_cloud_sqlite_write
    - backend_deploy_or_restart
    - platform_send_or_upload
    - naver_ads_state_change
  source_window_freshness_confidence:
    source: VM Cloud attribution_ledger + VM Cloud imweb_orders + 운영DB public.tb_iamweb_users
    window: 2026-05-22~2026-05-25 KST
    freshness: 2026-05-26 00:40 KST 재조회
    confidence: medium_high for narrowing, medium for budget upgrade until order-source policy is approved
```

## 10초 요약

기존에 운영DB 기준으로 미해결이던 biocom 브랜드검색 6건은 VM Cloud의 Imweb 주문 캐시에서는 6건 모두 주문키 exact match가 났다. 따라서 문제는 `주문이 없음`이 아니라 `운영DB 주문키/동기화 기준과 VM Cloud 주문 캐시 기준 차이`로 좁혀졌다.

예산 판단에는 아직 6건을 바로 더하지 않는다. 다만 다음 preview에서 `VM Cloud imweb_orders exact 보조근거`를 인정할지 정책을 정하면, 기존 exact 13건에 6건을 upgrade 후보로 올릴 수 있다.

## 확인 결과

- 기존 브랜드검색 marker: 19건
- 기존 운영DB exact: 13건
- 기존 운영DB 기준 미해결: 6건
- 이번 추가 분해 결과: 6건 모두 `vm_cloud_order_exact_operating_db_key_gap`
- 운영DB 확장 window 주문 후보: 405건
- VM Cloud Imweb 주문 후보: 720건
- 기존 보수 기준: 매출 3,364,432원 / 비용 205,336원 / ROAS 16.39
- VM Cloud exact 6건 포함 upgrade 후보: 매출 5,257,616원 / 비용 205,336원 / ROAS 25.60

## 의미

기존 `no_bridge`, `ambiguous`, `probable` 판정은 운영DB 하나만 주문 정본 cross-check로 썼을 때의 결과였다. 이번에는 VM Cloud `imweb_orders`도 같은 주문키 후보로 비교했다.

그 결과 미해결 6건은 모두 VM Cloud 주문 캐시에 정확히 걸렸다. 즉 결제완료 marker 자체가 허공에 떠 있는 것이 아니라, 운영DB 쪽에서 해당 주문키를 같은 방식으로 찾지 못하는 상황이다.

## 현재 예산 판단 기준

- 보수 기준: 기존 운영DB exact 13건만 내부 confirmed ROAS에 사용한다.
- upgrade 후보: VM Cloud exact 6건은 주문 source 정책 승인 후 별도 preview로 승격 검토한다.
- upgrade 후보를 포함하면 ROAS는 16.39에서 25.60으로 올라간다. 아직 최종 예산 판단값은 아니다.
- 금지: 이번 결과만으로 운영DB나 광고 플랫폼 값을 수정하지 않는다.

## 산출물

- JSON: `data/project/biocom-naver-brandsearch-unresolved-narrowing-20260526.json`
- 스크립트: `backend/scripts/biocom-naver-brandsearch-unresolved-narrowing.ts`

## 다음 할일

### Auto Green

1. biocom 브랜드검색 6건 upgrade preview 작성
   - 담당: Codex
   - 무엇: 기존 exact 13건 + VM Cloud exact 6건을 분리 표시하는 no-write preview를 만든다.
   - 왜: 예산 판단값에 더할 수 있는 후보인지 숫자로 봐야 한다.
   - 성공 기준: 기존 보수 ROAS와 upgrade 후보 포함 ROAS가 같은 window로 분리된다.
   - 승인 필요 여부: NO, read-only/no-write.

### Approval Needed

1. 주문 source 정책 결정
   - 담당: TJ님 판단, Codex 문서화
   - 무엇: biocom 브랜드검색 주문 bridge에서 운영DB만 primary로 쓸지, VM Cloud imweb_orders exact를 cross-check upgrade 근거로 인정할지 정한다.
   - 왜: 정본 정책 없이 6건을 예산 판단값에 더하면 나중에 숫자 기준이 흔들린다.
   - 성공 기준: `운영DB exact`, `VM Cloud exact 보조근거`, `ambiguous 제외` 규칙이 문서에 고정된다.
