---
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  required_context_docs:
    - gptconfirm/gpt0515-18-header-guard-cache-root-cause/00-result-report.md
    - gptconfirm/gpt0515-16-header-guard-v31/02-header-guard-v31-code.md
  lane: Green
  allowed_actions:
    - code_draft_documentation
    - local_syntax_check
    - no_send_no_deploy_validation
  forbidden_actions:
    - meta_operating_purchase_send
    - browser_purchase_unguarded_fallback
    - pixel_full_reinstall
    - block4_change
    - gtm_publish
    - vm_cloud_deploy_or_restart
    - operational_db_write_or_import
    - raw_identifier_report_output
  source_window_freshness_confidence:
    source: local Header Guard v3.1 code + gpt0515-18 root-cause
    window: code-only sprint
    freshness: 2026-05-15 15:40 KST
    confidence: 91%
---

# Header Guard v3.1.1 Code Result

작성 시각: 2026-05-15 15:40 KST
작성자: Codex
패키지: `gptconfirm/gpt0515-19-header-guard-v31-1-code`

## 10초 요약

아임웹 `<헤더 코드 상단>`에서 기존 `server-payment-decision-guard-v3-1` 스크립트 한 덩어리만 교체할 v3.1.1 전체 코드를 만들었다. 이번 코드는 실패한 decision fetch를 2분 캐시에 남기지 않고, 같은 결제완료 건이 snake_case/camelCase 요청으로 갈려도 같은 safe cache key를 쓰게 한다. Footer, Block 4, GTM, VM Cloud 코드는 건드리지 않았다.

판정: **HEADER_GUARD_V31_1_CODE_READY**

## 아임웹에서 교체할 범위

교체 대상:

- 아임웹 `헤더 코드 상단`
- 기존 주석 또는 설정에 `server-payment-decision-guard-v3-1`가 있는 `<script>...</script>` 한 덩어리
- `decisionEndpoint: 'https://att.ainativeos.net/api/attribution/payment-decision'`가 있는 Header Guard 블록

건드리지 말 것:

- Footer Block 1/2/3/4
- Block 4 v0.4 image beacon fallback
- Meta FBE/아임웹 자산 연결
- GTM
- NPay intent beacon

## 코드 위치

전체 붙여넣기 코드는 여기 있다.

- [02-header-guard-v31-1-code.md](02-header-guard-v31-1-code.md)

## v3.1 대비 핵심 변경

1. `decision_fetch_failed`는 더 이상 2분 캐시에 저장하지 않는다.
2. 기존 `allow_purchase` cache가 있으면 fetch failure/unknown이 덮어쓰지 못한다.
3. 같은 결제건이면 `orderCode/orderNo/paymentCode`와 `order_code/order_id/order_no/payment_code/payment_key`가 같은 cache key를 쓰도록 canonical key를 만든다.
4. `body.decision.browserAction`뿐 아니라 `body.browserAction`, `body.result.browserAction`, `body.data.browserAction`, `browser_action` 변형도 읽는다.
5. 미입금/가상계좌/unknown fail-open 금지는 유지한다.

## 하지 않은 것

| 항목 | 결과 |
|---|---|
| Meta 운영 Purchase 추가 전송 | 0 |
| Browser Purchase unguarded fallback | 0 |
| Pixel 전체 재삽입 | 0 |
| Block 4 수정 | 0 |
| GTM publish | 0 |
| VM Cloud deploy/restart | 0 |
| 운영DB write/import | 0 |
| raw identifier report/chat/telegram/git 출력 | 0 |

## 적용 후 테스트

1. 완료 페이지에서 `sessionStorage` cache를 확인한다.
   - 성공: `decision.browserAction=allow_purchase`
   - 실패 캐시 방지 성공: `decision_fetch_failed`가 2분 TTL cache로 남지 않음
2. Chrome Network에서 `payment-decision`을 확인한다.
   - 성공: 200 OK
   - 실패 시: canceled/timeout이면 cache에 실패가 장기 저장되지 않아야 함
3. Meta Pixel Helper 또는 Network에서 `facebook.com/tr?ev=Purchase`를 확인한다.
   - 성공: 실제 결제완료에서 Purchase 1회
   - 실패: 미입금/가상계좌에서 Purchase가 뜨면 즉시 원복
4. 미입금/가상계좌 테스트는 Purchase 0이어야 한다.

## 확인하면 좋은 문서

1. [02-header-guard-v31-1-code.md](02-header-guard-v31-1-code.md)
   실제 아임웹에 붙일 전체 코드다.
2. [01-diff-summary.md](01-diff-summary.md)
   v3.1과 v3.1.1 차이만 빠르게 볼 수 있다.
3. [03-test-checklist.md](03-test-checklist.md)
   적용 후 TJ님이 브라우저에서 확인할 절차다.

## 다음 할일

### Codex가 할 일

1. 적용 후 캡처/Network 결과 판독
- Codex 추천: 진행 추천
- 추천 이유: TJ님이 아임웹에 v3.1.1을 적용한 뒤, cache와 Network 결과를 읽어 실제 복구 여부를 판정해야 한다.
- 추천 방향에 대한 자신감: 88%
- Lane: Green read-only 판독
- 의존성: TJ님이 아임웹 Header에 v3.1.1 적용 후 테스트 결과를 제공해야 함
- 무엇을 하는가: `sessionStorage`, Network `payment-decision`, `facebook.com/tr?ev=Purchase` 결과를 보고 allow/cache/failure 분기를 판정한다.
- 왜 하는가: 실제 결제완료 Purchase가 1회만 살아났는지 확인하기 위해서다.
- 어떻게 하는가: TJ님이 붙여주는 콘솔/Network 결과를 raw id 없이 해석한다.
- 성공 기준: confirmed 결제완료에서 Purchase 1회, 미입금/가상계좌 Purchase 0회.
- 실패 시 해석/대응: allow인데 Purchase가 안 나가면 wrapper chain 문제, decision이 unknown이면 서버 match 문제로 분리한다.
- 승인 필요: NO.

### TJ님이 할 일

1. 아임웹 Header Guard v3.1.1 적용
- Codex 추천: 조건부 진행
- 추천 이유: 현재 Browser Purchase 복구 병목은 v3.1 캐시 오염과 cache key split이다. v3.1.1은 그 병목을 직접 줄인다.
- 추천 방향에 대한 자신감: 87%
- Lane: Yellow
- 의존성: 본 패키지의 02 코드 사용
- 무엇을 하는가: 아임웹 `헤더 코드 상단`에서 기존 Header Guard v3.1 `<script>` 한 덩어리만 v3.1.1 코드로 교체한다.
- 왜 하는가: 결제완료 페이지에서 `allow_purchase`를 못 받아 Browser Purchase가 막히는 일을 줄이기 위해서다.
- 어떻게 하는가: [02-header-guard-v31-1-code.md](02-header-guard-v31-1-code.md)의 `<script>...</script>` 전체를 복사해 기존 Header Guard 블록과 교체한다.
- 어디에서 확인하나: 아임웹 관리자 헤더 코드 화면, Chrome DevTools Network, Meta Pixel Helper.
- 성공 기준: 실제 결제완료에서 Purchase 1회, 미입금/가상계좌에서 Purchase 0회.
- 실패 시 해석/대응: `decision_fetch_failed`가 다시 cache에 남으면 Network response와 sessionStorage cache를 캡처한다.
- Codex가 대신 못 하는 이유: 아임웹 운영 화면 저장은 TJ님 계정/외부 UI 권한 작업이다.
- 승인 필요: YES, 운영 사이트 Header 코드 변경.
