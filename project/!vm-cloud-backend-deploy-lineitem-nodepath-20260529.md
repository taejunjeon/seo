# VM Cloud Backend 배포 / NPay 금액 재분류 / Node PATH 정리안 - 2026-05-29

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
  required_context_docs:
    - AGENTS.md
    - vm/!vm.md
  lane:
    vm_backend_deploy: Yellow Lane - TJ님 승인 완료
    line_item_reclass: Green Lane - read-only/dry-run/logic correction
    node_path_runbook: Green Lane - documentation/runbook
  allowed_actions:
    - scoped VM Cloud backend file deploy
    - backend typecheck/build
    - pm2 restart seo-backend
    - read-only smoke/API checks
    - runbook/document update
  forbidden_actions:
    - Google Ads conversion send
    - GTM Production publish
    - production DB write/import
    - external platform setting change
  source_window_freshness_confidence:
    source: local backend tests + VM Cloud backend smoke + operational PostgreSQL read-only + VM Cloud SQLite read-only
    window: 2026-05-27 ~ 2026-05-29 KST 중심
    freshness: 배포 직후 smoke 기준으로 갱신
    confidence: high for code/test, medium for live attribution counts until post-deploy API recheck
```

## 목적

Google Ads ROAS 갭을 줄이려면 실제 결제완료 주문과 광고 클릭 증거를 더 정확히 이어야 한다. 이번 작업의 목적은 세 가지다.

1. VM Cloud backend에 승인된 최신 수집/분석 로직을 반영한다.
2. NPay 주문에서 상품 줄이 여러 개인 경우 금액이 틀린 것처럼 보이던 케이스를 자동 재분류한다.
3. VM에서 Node 실행 경로가 빠져 개발·배포 명령이 흔들리는 문제를 runbook으로 고정한다.

## 기대효과

- NPay 버튼 클릭과 실제 결제완료 주문을 연결할 때, 장바구니/수량/배송비 때문에 금액이 안 맞는 것처럼 보이는 false mismatch를 줄인다.
- Google Ads에 보낼 수 있는 실제 구매 후보를 더 안정적으로 선별한다.
- 테스트용 click id가 운영 원장에 섞이는 위험을 낮춘다.
- VM 배포·dry-run·진단 명령에서 `node: command not found` 류의 실패를 줄인다.

## NPay 금액 재분류 의도

아임웹 운영DB의 주문 row는 상품이 여러 줄일 때 `total_price`, `paid_price`가 줄마다 반복 저장되는 경우가 있다. 예를 들어 실제 결제금액이 321,900원인 주문이 상품 3줄이면, 기존 집계는 321,900원을 3번 더해 965,700원처럼 보일 수 있다.

이번 수정은 상품별 `item_price * quantity`를 우선 합산하고, 그 값이 없을 때만 주문 전체 금액을 사용한다. 즉 "사용자가 실제로 결제한 금액"과 "상품 줄을 조합한 금액"을 같은 기준으로 맞춘다.

## VM Node PATH 정리안

현재 VM Cloud backend의 Node.js는 일반 시스템 PATH가 아니라 아래 경로에 있다.

```bash
/home/biocomkr_sns/seo/node/bin/node
```

따라서 SSH 비로그인 셸이나 `sudo -u biocomkr_sns bash -lc` 환경에서는 `node`, `npm`, `pm2`를 바로 못 찾을 수 있다.

### 운영 기준

배포·smoke·cron 명령은 항상 아래 PATH prefix를 붙인다.

```bash
export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
```

### 단기 권장

모든 runbook과 자동화 명령에 위 PATH prefix를 명시한다. 가장 안전하고 즉시 효과가 있다.

### 중기 권장

`/home/biocomkr_sns/seo/bin/with-node-path` 같은 wrapper를 만들고, 배포 스크립트가 이 wrapper를 쓰게 한다.

### 장기 권장

PM2 ecosystem/env, cron env, 배포 스크립트 env를 한 번에 정리한다. 단, 운영 명령 환경이 바뀌므로 먼저 단기 방식으로 충분히 smoke한 뒤 진행한다.

## 검증 기준

- 로컬 `npm --prefix backend run typecheck` 통과
- 로컬 `npx tsx --test tests/google-click-id-sanitizer.test.ts tests/npay-roas-dry-run.test.ts` 통과
- VM backend build 통과
- `seo-backend` PM2 restart 후 online
- `https://att.ainativeos.net/health` 정상
- Google Ads/NPay 보고 API read-only smoke 정상
