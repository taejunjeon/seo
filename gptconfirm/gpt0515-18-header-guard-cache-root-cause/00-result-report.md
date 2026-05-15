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
    - gptconfirm/gpt0515-16-header-guard-v31/02-header-guard-v31-code.md
    - gptconfirm/gpt0515-15/00-result-report.md
  lane: Green
  allowed_actions:
    - read_only_vm_cloud_log_analysis
    - local_code_review
    - patch_plan_documentation
    - no_send_status_check
  forbidden_actions:
    - meta_operating_purchase_send
    - unguarded_browser_purchase_fallback
    - pixel_full_reinstall
    - gtm_publish
    - vm_cloud_deploy_or_restart_without_approval
    - operational_db_write_or_import
    - raw_identifier_report_output
  source_window_freshness_confidence:
    source: VM Cloud pm2/meta CAPI logs + local Header Guard v3.1 code
    window: payment-decision recent 80 requests, Meta CAPI send log recent 6h
    freshness: 2026-05-15 15:20-15:21 KST read-only
    confidence: 87%
---

# Header Guard v3.1 Decision Cache Failure Root-Cause

작성 시각: 2026-05-15 15:21 KST
작성자: Codex
패키지: `gptconfirm/gpt0515-18-header-guard-cache-root-cause`

## 10초 요약

현재 문제는 `payment-decision` 서버가 완전히 죽은 것이 아니라, 브라우저의 Header Guard v3.1이 실패한 decision 결과를 정상 캐시처럼 2분 동안 저장할 수 있는 구조다. VM Cloud 로그에서는 같은 시간대에 200 응답과 aborted 요청이 섞여 있었고, v3.1 코드는 `decision_fetch_failed`도 일반 결과처럼 sessionStorage에 저장한다. 또 같은 결제완료 건이 `orderCode/orderNo/paymentCode` 요청과 `order_code/order_id/order_no/payment_code/payment_key` 요청으로 갈라져 서로 다른 캐시 키를 만들 수 있다.

판정:

- **C. CANCELED_REQUEST_OVERWROTE_ALLOW_CACHE 가능성 높음**
- **D. CACHE_KEY_MISMATCH_BETWEEN_PREFETCH_AND_PURCHASE 가능성 높음**
- **E. RESPONSE_SHAPE_PARSE_BUG 가능성 낮음**

## 이번에 가능해진 것

Header Guard v3.1이 왜 `allow_purchase`를 못 쓰고 `decision_fetch_failed` 캐시를 남겼는지, 서버 응답·브라우저 캐시·요청 키 3개 층으로 나눠 설명할 수 있게 됐다.

Meta CAPI는 별도 서버 경로로 살아 있다. 최근 6시간 VM Cloud Meta CAPI send log에서는 Purchase 45건이 모두 `events_received=1`이었다. 따라서 당장 더 위험한 browser Purchase fail-open보다, Header Guard v3.1.1에서 캐시 정책과 캐시 키를 고치는 것이 우선이다.

## 완료한 것

| 항목 | 결과 | 근거 | 데이터 위치 |
|---|---|---|---|
| payment-decision 서버 로그 대조 | 200 OK와 aborted가 함께 발생함 확인 | 최근 80건 중 71건 200, 9건 aborted | VM Cloud `pm2-out-0.log` |
| v3.1 캐시 코드 분석 | fetch 실패도 2분 캐시되는 구조 확인 | `writeDecisionCache`가 모든 decision payload를 동일 TTL 저장 | 로컬 Header Guard v3.1 문서 |
| 캐시 키 분석 | 같은 주문이 서로 다른 field set이면 다른 key 가능 | `paymentKey/orderId` 존재 여부가 hash source에 포함됨 | 로컬 Header Guard v3.1 문서 |
| CAPI 상태 확인 | 최근 6시간 Purchase 45건, 실패 0건 | `events_received=1` 45건 | VM Cloud `meta-capi-sends.jsonl` |
| v3.1.1 패치 방향 작성 | 캐시 키 정규화, failure cache 제한, tolerant parser 필요 | 본 패키지 03 문서 | gptconfirm |

## 하지 않은 것

| 항목 | 하지 않은 이유 |
|---|---|
| Meta 운영 Purchase 추가 전송 | 이번 범위는 read-only root-cause. 전송은 Red 승인 필요 |
| VM Cloud 배포/restart | 이번 범위는 원인 분석과 패치 초안. 배포는 Yellow 승인 필요 |
| 아임웹 Header 재저장 | v3.1.1 코드 확정 전 운영 코드 변경 금지 |
| GTM publish | 범위 밖이며 승인 전 금지 |
| 운영DB write/import | 범위 밖이며 승인 전 금지 |
| raw order/payment/member/click id 출력 | 보고서/대화/git 출력 금지 원칙 준수 |

## 검증 결과

| 검증 | 결과 | 근거 |
|---|---|---|
| VM Cloud read-only log query | PASS | SSH read-only, raw id 출력 없이 aggregate만 기록 |
| Header Guard v3.1 code review | PASS | 캐시/파서/키 생성 함수 확인 |
| Meta CAPI send status aggregate | PASS | 최근 6시간 Purchase 45건, `events_received=1` 45건 |
| raw id report scan | 마지막 검증에서 수행 | 보고서에는 safe_ref만 사용 |
| external send/upload | 0 | 이번 작업에서 실행하지 않음 |
| VM Cloud deploy/restart | 0 | 이번 작업에서 실행하지 않음 |

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source | VM Cloud `pm2-out-0.log`, VM Cloud `meta-capi-sends.jsonl`, 로컬 Header Guard v3.1 문서 |
| window | payment-decision 최근 80건, Meta CAPI recent 6h |
| freshness | 2026-05-15 15:20-15:21 KST |
| site | biocom |
| confidence | root-cause 87%, exact response body 여부 72%, CAPI aggregate 95% |

## 남은 리스크

1. 서버 로그에는 payment-decision response body가 남지 않아, 특정 200 OK가 실제로 `allow_purchase`였는지는 로그만으로 100% 확정할 수 없다.
2. 브라우저 sessionStorage cache key는 실제 브라우저에서 생성된 raw context에 의존한다. v3.1.1 적용 전에는 완료 페이지에서 같은 증상이 반복될 수 있다.
3. Meta CAPI send log는 최근 row에 `safe_ref`가 남지 않아 `safe_1fe5aa80`과 CAPI send를 텍스트로 1:1 매칭하지 못했다. 다만 전체 autoSync는 정상 전송 중이다.

## 확인하면 좋은 문서

1. [01-payment-decision-response-vs-cache.md](01-payment-decision-response-vs-cache.md)
   왜 200 OK가 있었는데도 브라우저 캐시는 실패로 남았는지 보는 문서다.
2. [02-cache-key-analysis.md](02-cache-key-analysis.md)
   같은 결제완료 건이 서로 다른 cache key로 갈라질 수 있는 이유를 정리했다.
3. [03-header-guard-v31-1-patch-plan.md](03-header-guard-v31-1-patch-plan.md)
   v3.1.1에서 실제로 바꿔야 하는 캐시 정책과 코드 초안이다.

## 다음 할일

### Codex가 할 일

1. Header Guard v3.1.1 코드 초안 작성
- Codex 추천: 진행 추천
- 추천 이유: 실패 캐시가 allow cache를 덮는 구조를 먼저 막아야 결제완료 Browser Purchase가 안정화된다.
- 추천 방향에 대한 자신감: 92%
- Lane: Green
- 의존성: 이번 root-cause 문서 완료 후 바로 가능
- 무엇을 하는가: v3.1에 canonical cache key, failure no-cache, tolerant parser를 surgical patch로 반영한 코드 블록을 작성한다.
- 왜 하는가: 같은 주문의 decision 결과가 서로 다른 키로 갈라지거나 실패 캐시로 막히는 문제를 줄이기 위해서다.
- 어떻게 하는가: `gptconfirm/gpt0515-18-header-guard-cache-root-cause/03-header-guard-v31-1-patch-plan.md`의 pseudo-code를 실제 아임웹 Header 교체 블록으로 만든다.
- 어디에서 확인하나: 새 gptconfirm 패키지 또는 후속 `gpt0515-19` 문서.
- 성공 기준: 실패 fetch는 2분 캐시되지 않고, cached allow_purchase가 있으면 즉시 Purchase 통과한다.
- 실패 시 해석/대응: 코드가 기존 wrapper를 깨면 적용 보류하고 v3.1 hotfix 유지.
- 승인 필요: NO, 코드 초안 작성만 Green.

2. v3.1.1 적용 승인안 작성
- Codex 추천: 진행 추천
- 추천 이유: 아임웹 Header 저장은 운영 사이트 스크립트 변경이므로 TJ님이 누르는 작업과 성공 기준을 명확히 해야 한다.
- 추천 방향에 대한 자신감: 89%
- Lane: Green 문서 작성, 적용은 Yellow/Red 성격의 외부 화면 작업
- 의존성: v3.1.1 코드 초안 필요
- 무엇을 하는가: 적용 위치, 교체 범위, 테스트 순서, 실패 시 원복 기준을 승인안으로 쓴다.
- 왜 하는가: 급하게 고치되 Pixel 중복이나 Purchase fail-open을 만들지 않기 위해서다.
- 어떻게 하는가: 아임웹 `<헤더 코드 상단>`의 `server-payment-decision-guard-v3-1` 블록만 교체하는 절차로 제한한다.
- 성공 기준: 결제완료 페이지에서 `decision_cache_hit allow_purchase` 또는 fresh allow response가 보이고, `ev=Purchase`가 1회만 발생한다.
- 실패 시 해석/대응: payment-decision이 allow인데도 브라우저 Purchase가 안 나가면 wrapper chain 문제를 별도 조사한다.
- 승인 필요: 코드 적용은 TJ님 외부 화면 작업 필요.

### TJ님이 할 일

1. v3.1.1 코드가 나오면 아임웹 Header 교체 승인/적용
- Codex 추천: 조건부 진행
- 추천 이유: 현재 v3.1은 실패 캐시 오염 가능성이 확인됐고, 결제완료 Purchase 복구에 직접 영향이 있다.
- 추천 방향에 대한 자신감: 88%
- Lane: Yellow
- 의존성: Codex가 v3.1.1 전체 코드와 테스트 체크리스트를 먼저 제공해야 함
- 무엇을 하는가: 아임웹 관리자에서 기존 Header Guard v3.1 블록만 v3.1.1로 교체한다.
- 왜 하는가: 실제 결제완료 Browser Purchase가 `decision_fetch_failed` 캐시에 막히는 일을 줄이기 위해서다.
- 어떻게 하는가: Codex가 제공하는 전체 코드 블록을 그대로 교체하고 저장한다. Block 4와 Footer는 건드리지 않는다.
- 어디에서 확인하나: 아임웹 헤더 코드 편집 화면, Chrome Network, Meta Pixel Helper.
- 성공 기준: 완료 페이지에서 `payment-decision`이 200이고 `ev=Purchase`가 1회 보이며, 미입금/가상계좌는 Purchase가 뜨지 않는다.
- 실패 시 해석/대응: `decision_fetch_failed`가 다시 뜨면 cache key 로그와 payment-decision 응답 body를 캡처한다.
- Codex가 대신 못 하는 이유: 아임웹 운영 화면 저장 권한과 실제 사이트 스크립트 적용은 TJ님 외부 계정 작업이다.
- 승인 필요: YES, 운영 사이트 Header 코드 변경.
