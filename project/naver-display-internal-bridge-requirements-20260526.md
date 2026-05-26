# 네이버 성과 디스플레이 내부 confirmed ROAS bridge 요구사항 preview

작성 시각: 2026-05-26 18:36 KST  
기준일: 2026-05-26  
문서 성격: Naver performance display internal confirmed ROAS bridge read-only preview

## 10초 요약

성과 디스플레이의 네이버 플랫폼 주장 ROAS는 이미 볼 수 있지만, 예산 판단용 내부 confirmed ROAS는 아직 부분 후보 단계다. 2026-05-26 21:13 KST 추가 확인으로 **더클린커피 쇼핑검색/ADVoost 랜딩은 자사몰이 아니라 네이버 스마트스토어(`https://smartstore.naver.com/lockhart`)** 로 확인됐다. 따라서 더클린커피 쇼핑검색/ADVoost는 자사몰 Imweb/VM Cloud 주문 원장으로 내부 ROAS를 만들 수 없고, 스마트스토어 주문/정산 또는 네이버 플랫폼 리포트를 별도 축으로 봐야 한다. 바이오컴은 기존 self-mall 후보 bridge를 유지하되, 더클린커피와 섞지 않는다.

## Harness Preflight

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
  required_context_docs:
    - gdn/attribution-data-source-decision-guide-20260511.md
    - data/!data_inventory.md
    - project/naver-display-april-hermes-result-20260526.md
  lane: Green
  allowed_actions:
    - read_only_vm_cloud_sqlite_query
    - read_only_operating_db_query
    - aggregate_only_json_markdown_generation
    - no_send_no_write_preview
  forbidden_actions:
    - operating_db_write
    - vm_cloud_write_or_deploy
    - naver_ads_state_change
    - platform_conversion_send
    - gtm_publish
  source_window_freshness_confidence:
    source: Hermes XLSX + VM Cloud attribution_ledger + 운영DB tb_iamweb_users + VM Cloud imweb_orders
    window: 2026-04-01~2026-04-30 KST
    freshness: generated 2026-05-26T09:36:43.688Z
    confidence: medium
```

## 실제 확인된 숫자

| site | 광고비 | 네이버 주장 전환금액 | 네이버 주장 ROAS | 내부 exact marker | 내부 exact 매출 | 내부 exact ROAS | 예산 사용 |
|---|---:|---:|---:|---:|---:|---:|---|
| biocom | 12,772,245원 | 141,972,560원 | 1111.57% | 2건 | 693,000원 | 5.43% | partial_not_budget_ready |
| thecleancoffee | 1,171,829원 | 10,046,842원 | 857.36% | 0건 | 0원 | 0% | smartstore_source_required |

## 해석

- 네이버 주장 전환금액은 플랫폼 참고값이다. 내부 confirmed ROAS 분자로 합산하지 않는다.
- 내부 exact 매출은 VM Cloud 결제완료 display marker와 주문 정본이 주문키 hash로 연결된 금액이다.
- 바이오컴은 부분 후보가 있으나 전체 성과 디스플레이 예산 판단값으로 쓰기에는 유입 식별률이 낮다.
- 더클린커피는 2026년 4월 결제완료 display marker가 없는 것이 단순 누락이 아니라, 현재 쇼핑검색/ADVoost 랜딩이 스마트스토어로 가는 구조 때문일 가능성이 높다.
- 더클린커피 쇼핑검색/ADVoost의 내부 confirmed ROAS 분자는 자사몰 Imweb 주문이 아니라 스마트스토어 주문/정산 또는 네이버 전환 리포트에서 가져와야 한다.
- 전환 추적 기간은 TJ님이 30일에서 7일로 변경했다. 빠른 커피 구매처럼 의사결정 주기가 짧은 상품에서는 7일이 예산 판단을 덜 부풀리므로 우선 추천한다. 다만 30일 값은 리타겟팅/브랜드 halo 참고값으로 별도 보관하는 편이 좋다.

## 2026-05-26 추가 전제

- 더클린커피 스마트스토어 URL: `https://smartstore.naver.com/lockhart`
- 현재 확인: 네이버 쇼핑검색과 ADVoost 쇼핑 광고는 자사몰이 아니라 스마트스토어로 연결된다.
- 의미: 자사몰 Imweb/VM Cloud 주문 원장 기준의 `naver_display` 내부 ROAS로 더클린커피 쇼핑/ADVoost를 평가하면 안 된다.
- 전환 추적 기간 변경: 30일 -> 7일.
- Codex 의견: 7일을 운영 판단 기본값으로 두고, 30일은 보조 리포트로 비교하는 방식을 추천한다. 커피/스마트스토어 구매는 검색 후 즉시 또는 며칠 내 결제가 많을 가능성이 높고, 30일은 브랜드 재방문/오가닉 수요까지 네이버가 가져갈 위험이 커진다.

## 필요한 bridge 작업

### P0. 더클린커피 스마트스토어 원천 분리

- 무엇: 더클린커피 쇼핑검색/ADVoost를 자사몰 `naver_display` bridge가 아니라 `smartstore_naver_ads` 계열로 별도 분리한다.
- 왜: 랜딩과 전환이 스마트스토어 안에서 끝나면 자사몰 Imweb/VM Cloud 주문 원장에 남지 않는다.
- Lane: Green
- 승인 필요: NO
- 성공 기준: 대시보드와 문서에서 더클린커피 쇼핑검색/ADVoost 광고비가 자사몰 ROAS 분모로 잘못 합산되지 않는다.

### P0. 성과 디스플레이 유입 식별자 표준화

- 무엇: 자사몰로 들어오는 ADVoost/GFA/성과 디스플레이 유입이 있는 경우만 `naver_display`로 별도 분류한다.
- 왜: 바이오컴 등 self-mall destination 캠페인은 여전히 내부 주문 bridge 후보가 될 수 있다.
- Lane: Green
- 승인 필요: NO
- 성공 기준: `naver_display`는 self-mall landing marker, `smartstore_naver_ads`는 스마트스토어 destination으로 분리된다.

### P0. 결제완료 주문키 브릿지

- 무엇: VM Cloud 결제완료 신호의 display marker를 주문 정본의 주문키 hash와 exact로 매칭한다.
- 왜: 플랫폼 전환금액이 아니라 실제 결제완료 주문만 내부 confirmed ROAS 분자로 써야 한다.
- Lane: Green
- 승인 필요: NO
- 성공 기준: site별 exact/probable/ambiguous/no_bridge가 raw 식별자 없이 산출된다.

### P1. 브라우저 유입 보존 보강

- 무엇: 성과 디스플레이 landing marker가 주문서와 결제완료까지 유지되는지 site_landing -> checkout -> payment_success를 점검한다.
- 왜: 2026년 4월 site_landing에는 display marker가 거의 없고, 결제완료 marker도 일부만 관측된다.
- Lane: Yellow
- 승인 필요: YES
- 성공 기준: VM Cloud 배포/Imweb/GTM 변경 전 승인안 기준으로 marker preservation smoke가 PASS한다.

### P2. 스마트스토어 주문/정산 source 확보

- 무엇: `smartstore.naver.com/lockhart`의 주문/정산 또는 네이버 광고 전환 리포트를 더클린커피 쇼핑검색/ADVoost ROAS 분자로 쓸 수 있는지 조사한다.
- 왜: 현재 자사몰 주문 정본으로는 스마트스토어 전환을 검증할 수 없다.
- Lane: Green 조사 / API·계정 연결은 Yellow 이상
- 승인 필요: 조사 NO, 계정/API 연결 YES
- 성공 기준: 더클린커피 스마트스토어 광고비와 같은 window의 실제 결제완료/취소반영 매출 source가 정해진다.

### P3. 대시보드 API 연결

- 무엇: 네이버 ROAS 화면에서 플랫폼 주장 ROAS와 내부 confirmed ROAS를 별도 필드로 내려준다.
- 왜: 예산 판단값과 참고값을 한 화면에서 섞지 않기 위해서다.
- Lane: Yellow
- 승인 필요: YES
- 성공 기준: API가 display.spend, display.naver_claim, display.internal_exact_bridge를 분리 응답한다.

## Source / Window / Freshness

- source: Hermes XLSX + VM Cloud attribution_ledger/site_landing_ledger + operating DB/VM Cloud order source
- window: 2026-04-01~2026-04-30 KST
- confidence: medium: cost source is complete, display marker bridge is partial and classifier is not yet first-class.
- raw identifier output: 0

## 검증

- VM Cloud SQLite: read-only
- 운영DB: read-only
- platform send: 0
- DB write: 0
- generated JSON: `data/project/naver-display-internal-bridge-requirements-20260526.json`
