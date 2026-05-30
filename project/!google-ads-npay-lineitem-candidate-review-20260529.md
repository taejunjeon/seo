harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_harness_read:
    - harness/npay-recovery/RULES.md
  required_context_docs:
    - AGENTS.md
    - vm/!vm.md
    - project/!vm-cloud-backend-deploy-lineitem-nodepath-20260529.md
  lane:
    amount_mismatch_reanalysis: Green
    google_ads_send_candidate_review: Green
    vm_node_path_recommendation: Green
  allowed_actions:
    - read-only VM Cloud SQLite query
    - read-only VM Cloud API query
    - local/remote dry-run
    - document findings
  forbidden_actions:
    - Google Ads conversion send
    - production DB write
    - GTM publish
    - VM backend deploy
    - env permanent change
  source_window_freshness_confidence:
    source:
      - VM Cloud SQLite
      - VM Cloud Google Ads dashboard API
      - operational PostgreSQL read-only via VM backend
    window:
      - recent_7d
      - 2026-05-22..2026-05-29 KST
    freshness: live API / VM SQLite at run time
    confidence: medium_high until Google Ads report aggregation catches up

# Google Ads / NPay 금액 불일치 및 전송 후보 재검토

작성일: 2026-05-29 KST

## 목표

1. 아임웹 주문의 상품 라인 구조 때문에 금액이 부풀어 보였던 문제를 사람이 이해할 수 있게 설명한다.
2. 남은 NPay 금액 불일치 row를 상품 조합 기준으로 더 분류한다.
3. 최근 7일 실제 결제완료 주문 중 Google Ads에 추가 전송할 수 있는 후보가 생겼는지 no-send로 확인한다.
4. VM Node PATH 정리 방식의 권장안을 확정한다.

## 안전 기준

이번 문서는 조사와 후보 검토만 한다. Google Ads 전송, 운영DB write, GTM publish, VM deploy는 하지 않는다.

## 2026-05-29 21:48 KST 조사 결과

### 1. “상품 3줄”의 의미

여기서 줄은 화면의 줄이 아니라 DB row다. 한 주문에 상품이 3개 들어가면 같은 주문번호가 3개의 row로 저장될 수 있다.

예시:

| order_no | product | paid_price |
| --- | --- | ---: |
| A주문 | 상품1 | 321,900 |
| A주문 | 상품2 | 321,900 |
| A주문 | 상품3 | 321,900 |

이 경우 `paid_price`가 상품별 가격이 아니라 주문 전체 결제금액인데, 예전 집계가 이를 상품별 금액처럼 더하면 321,900 * 3 = 965,700으로 부풀어 보인다. 올바른 주문 총액은 같은 주문번호 안에서는 `MAX(paid_price)` 또는 주문 단위 대표 금액 1개만 쓰고, 상품 조합 검증은 별도의 상품 단가/수량/배송비 조합으로 해야 한다.

### 2. 최근 7일 NPay 금액 불일치 재분류

Source: `https://att.ainativeos.net/api/google-ads/dashboard-summary?site=biocom&date_preset=last_7d&remote_fallback=0`

기준: 2026-05-22 ~ 2026-05-28 KST, `paid_at_fallback`, cache `2026-05-29 21:38 KST`

최근 7일 NPay 결제완료 41건 중 자동 연결되지 않은 미분류는 19건이다. 그중 `amount_not_reconciled`는 7건이다. 이전에 보던 7~9건 차이는 조회 window/basis 차이이며, 현재 보고서 API 기준 최근 7일은 7건으로 본다.

남은 7건은 단순 합산 버그가 아니라 아래 이유가 섞여 있다.

- 세트/묶음/장바구니 가능성: 975,000원 vs 버튼 클릭가 496,000원, 128,800원 vs 36,900원처럼 단일 상품 클릭 금액과 실제 결제금액이 다르다.
- 복수 수량 가능성: 117,000원 vs 39,000원처럼 `상품가 * 수량`으로 설명 가능한 후보가 있으나 같은 상품 클릭 후보가 여러 개라 1개 intent로 확정하지 않는다.
- 약한 시간/상품 증거: 일부 row는 Google click id가 있어도 bridge URL hash가 없고, 클릭-주문 시각 또는 상품명이 약해 자동 전송 후보로 올리지 않는다.

### 3. 최근 7일 Google Ads 추가 전송 후보

Source:

- `https://att.ainativeos.net/api/google-ads/confirmed-purchase/candidate-expansion?site=biocom&window=last_7d&limit=60`
- `https://att.ainativeos.net/api/google-ads/confirmed-purchase/upload-ledger-write-smoke-plan?site=biocom&window=last_7d&limit=20`

기준: 2026-05-22 ~ 2026-05-28 KST, `payment_complete_time`, fetched `2026-05-29 21:48 KST`

최근 7일 실제 결제완료 주문 539건, 매출 125,678,280원을 검사했다.

전송 후보처럼 보이는 직접 gclid 후보 4건은 모두 이미 장부에 있거나 기존 실패 row로 막혀 있다.

- 234,000원: 이미 sent
- 240,000원: 이미 sent
- 35,000원(2026-05-26): 이미 sent
- 35,000원(2026-05-28): 이미 sent
- 293,206원: failed row. Google 응답상 click-through window 초과로 재전송 대상 아님

따라서 현재 no-send 기준 신규 Google Ads 전송 후보는 0건이다.

NPay bridge A급 + 직접 Google click id 후보는 2건 / 74,000원이지만, 이는 영구 bridge 장부 write와 중복/환불 guard 검증 전까지 Google Ads 전송 후보로 세지 않는다.

### 4. VM Node PATH 정리 의견

A안: 배포/cron/runbook에서 필요한 명령마다 명시적으로 Node PATH를 붙인다.

- 예: `export PATH=/home/biocomkr_sns/seo/node/bin:$PATH`
- 장점: 범위가 좁고, 운영 서버 전체 환경을 건드리지 않는다.
- 단점: 새 스크립트가 생길 때 PATH prefix를 빠뜨릴 수 있다.
- 추천도: 80%

B안: `/home/biocomkr_sns/seo/bin/with-node-path` 같은 wrapper를 만들고 모든 배포/cron 스크립트가 이 wrapper를 통과하게 한다.

- 장점: 장기적으로 실수를 줄인다.
- 단점: wrapper 자체도 운영 파일 변경이고, 기존 cron/deploy entrypoint 교체 검증이 필요하다.
- 추천도: 65%

현재 권장: A안을 먼저 유지한다. 전역 PATH나 `/usr/local/bin` symlink는 운영 서버의 다른 프로세스에 영향을 줄 수 있어 비추천한다.

## 2026-05-29 22:26 KST Green Lane 보강

### 무엇을 보강했나

`amount_not_reconciled`를 더 이상 “금액 안 맞음” 한 덩어리로만 보여주지 않도록 백엔드 dry-run row에 아래 분류를 추가했다.

- `quantity`: 같은 상품을 여러 개 산 것으로 보이는 수량형 차이
- `cart_multi_item`: 한 주문번호 안에 여러 상품 row가 있는 장바구니/복수상품 차이
- `set_or_bundle`: 세트, 묶음, 패키지, 구독, 금액 배수로 보이는 구성상품 차이
- `coupon_shipping`: 배송비, 쿠폰, 포인트, 할인 차이
- `insufficient_item_data`: 상품가/주문금액/상품명/버튼 클릭 후보가 부족한 정보부족
- `unknown`: 위 규칙으로도 설명이 부족한 미분류 금액차

### 코드 반영 위치

- `backend/src/npayRoasDryRun.ts`
  - `NpayRoasDryRunAmountMismatchCategory`
  - `buildAmountMismatchDiagnosis`
  - rematch 후보 row와 unresolved row에 `amountMismatchCategory`, `amountMismatchLabel`, `amountMismatchPlain`, `amountMismatchSignals` 추가
- `frontend/src/app/ads/google-roas-report/page.tsx`
  - 자동 연결 불충분 주문 상세 표에 금액 불일치 세부 분류 표시

### 검증

- `python3 scripts/harness-preflight-check.py --strict`: 통과
- `cd backend && npm run typecheck`: 통과
- `cd backend && npm run build`: 통과
- `cd frontend && npx eslint src/app/ads/google-roas-report/page.tsx`: 통과
- `cd frontend && npm run lint`: 실패. 이번 수정 파일 문제가 아니라 기존 다른 페이지의 React hooks / unescaped entity 오류 때문이다.

### 현재 한계

로컬 dry-run은 로컬 SQLite와 운영 PostgreSQL을 읽기 때문에 VM Cloud 최신 NPay intent 원장과 완전히 같지 않다. 로컬 실행에서는 최근 7~8일 `amount_not_reconciled` row가 0건으로 재현되었고, 대부분 `purchase_without_intent`로 나타났다. VM Cloud API의 7건을 새 분류로 보려면 이번 백엔드 변경을 VM Cloud에 배포해야 한다.

### 운영 반영 전 안전 판단

이번 변경은 Google Ads 전송, GTM publish, 운영DB write를 하지 않는다. 다만 VM Cloud live API와 운영 보고서에 새 분류를 보이게 하려면 VM Cloud backend deploy가 필요하므로, 배포는 Red/Yellow 경계 작업으로 TJ님 승인 후 진행한다.
