---
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
  required_context_docs:
    - data/!data_inventory.md
  lane: Green
  allowed_actions:
    - code_read
    - endpoint_audit
    - design_doc
    - no_send_preview
  forbidden_actions:
    - platform_send
    - vm_deploy_restart
    - production_db_write
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: local repo static code audit
    window: current working tree
    freshness: 2026-05-25 KST
    confidence: high
---

# TikTok/ROAS Aggregate 전환 감사 결과

## 이번에 가능해진 것

`TikTok/ROAS 화면`은 Meta ROAS와 Google ROAS 전체 화면이 아니라, `/ads/tiktok`의 TikTok 광고 성과 화면이다. 이 화면 안에서 Meta/Google ROAS를 비교 기준으로 같이 불러오기 때문에 이름이 혼동될 수 있다.

이번 감사로 확인한 핵심 병목은 `/api/ads/tiktok/roas-comparison`이다. 이 API는 화면이 열릴 때 VM Cloud 원장 전체에 가까운 row를 가져와 TikTok 성과를 다시 계산한다. TikTok 광고가 현재 운영 우선순위가 아닌 상태라면, 기본 화면은 무거운 원본 조회 대신 “요약 결과”만 읽고, 정밀 진단은 버튼으로 수동 실행하는 구조가 맞다.

## 왜 중요한가

대시보드가 필요한 것은 `광고비`, `주문 수`, `매출`, `ROAS`, `누락/주의 신호` 같은 요약 숫자다. 그런데 현재 일부 경로는 계산을 위해 원본 장부를 크게 불러온다. 쉽게 말하면, 화면이 “오늘 매출 합계”만 보려고 계산서 박스 전체를 매번 들고 오는 구조다.

요약 결과 조회로 바꾸면:

- 화면 응답이 빨라진다.
- VM Cloud 메모리와 CPU 사용이 줄어든다.
- `/api/attribution/ledger` hard guard 때문에 일부 row만 받아 숫자가 줄어드는 위험이 줄어든다.
- TikTok 광고가 꺼진 기간에는 불필요한 원본 재계산을 막을 수 있다.

## 실제 숫자/검증

- 코드상 TikTok 화면: `frontend/src/app/ads/tiktok/page.tsx`
- TikTok 주 API: `/api/ads/tiktok/roas-comparison`
- TikTok 주 API 내부 대형 조회:
  - `/api/attribution/ledger?source=...&limit=10000`
  - `/api/attribution/tiktok-pixel-events?limit=10000`
- Meta 비교값: `/api/ads/roas`
- Google 비교값: `/api/google-ads/dashboard`

이번 작업은 코드 정적 감사이며, 운영 API 호출 부하 테스트나 VM 로그 재집계는 하지 않았다.

## 아직 안 된 것

- TikTok 요약 전용 endpoint 구현은 아직 하지 않았다.
- `/api/attribution/tiktok-pixel-events` hard guard는 아직 설계 단계다.
- TikTok 화면을 summary-first 구조로 바꾸는 프론트엔드 변경은 아직 하지 않았다.
- 운영 VM 배포/restart는 하지 않았다.

## 결론

TikTok 광고가 현재 꺼져 있다면 `/ads/tiktok`은 기본 로딩에서 원본 장부를 크게 읽지 않아야 한다. 기본 화면은 요약 cache를 읽고, “정밀 진단” 버튼을 눌렀을 때만 기존 `roas-comparison`을 실행하는 방식이 가장 안전하다.

