---
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - frontrule.md
  required_context_docs:
    - AGENTS.md
  lane: Yellow
  allowed_actions:
    - local_backend_frontend_code_patch
    - read_only_audit
    - local_typecheck_lint_api_smoke_browser_smoke
    - vm_cloud_backend_frontend_deploy_restart_after_user_approval
    - live_api_postcheck
    - documentation
  forbidden_actions:
    - meta_google_tiktok_platform_send
    - gtm_publish
    - operating_db_write_import
    - raw_identifier_output
  source_window_freshness_confidence:
    source: local code inspection + local API smoke + browser smoke + VM Cloud deploy/post-check
    window: 2026-05-25 KST
    freshness: deployed 2026-05-25 17:08 KST
    confidence: 0.92
---

# TikTok Summary-First Local Patch Result

## 이번에 가능해진 것

TikTok 광고 성과 화면은 이제 기본 로딩 때 원본 주문 장부를 크게 읽지 않는다. 먼저 빠른 요약 결과를 보여주고, 주문별 원본 진단은 사용자가 `원본 진단 불러오기` 버튼을 눌렀을 때만 실행한다.

쉽게 말하면, 화면이 열릴 때마다 계산서 박스 전체를 들고 오던 구조를 멈추고, 첫 화면은 계산된 합계표만 보는 구조로 바꿨다.

## 왜 중요한가

`/api/attribution/ledger` hard guard가 들어간 뒤에는 원본 row를 많이 요구하는 화면이 두 가지 문제를 만든다.

- 서버 부하: 화면 하나가 VM Cloud 원장을 크게 읽으면 메모리와 CPU가 뛴다.
- 숫자 왜곡: hard guard가 row 수를 줄이면 화면이 일부 row만 보고 ROAS를 계산할 수 있다.

이번 구조는 이 둘을 줄인다. 기본 화면은 요약만 읽고, 정밀 진단이 필요한 순간에만 무거운 원본 비교를 수행한다.

## 실제 확인 결과

### VM Cloud live post-check

- VM Cloud backup:
  - `/home/biocomkr_sns/seo/repo/backend/_deploy-backup-20260525-165715-tiktok-summary-first`
- VM Cloud build/restart:
  - backend `npm run typecheck` PASS
  - backend `npm run build` PASS
  - frontend `npm run lint -- src/app/ads/tiktok/page.tsx` PASS
  - frontend `npm run build` PASS
  - `seo-backend` restart: online, restart count 14
  - `seo-frontend` restart: online, restart count 8
- Live API: `https://att.ainativeos.net/api/attribution/tiktok-pixel-events?summaryOnly=true&limit=10000`
  - HTTP 200
  - `items=0`
  - `guard.summaryOnly=true`
  - `summary.totalEvents=1000`
  - `effectiveItemLimit=0`
- Live API: `https://att.ainativeos.net/api/ads/tiktok/roas-summary`
  - HTTP 200
  - `ok=true`
  - `mode=summary_first`
  - `importedRows=0`
  - `matchedRows=5`
  - raw entries returned: false
- Live frontend: `https://biocom.ainativeos.net/ads/tiktok`
  - HTTP 200

### Local pre-deploy checks

- 로컬 API: `/api/ads/tiktok/roas-summary`
  - `ok=true`
  - `mode=summary_first`
  - 원본 ledger row 반환 0
  - TikTok 원본 이벤트 endpoint가 운영 VM Cloud에는 아직 summary guard 미배포라 기본 화면에서 원본 이벤트 요약을 생략하는 경고 표시
- 로컬 API: `/api/attribution/tiktok-pixel-events?summaryOnly=true&limit=10000`
  - HTTP 200
  - `items=0`
  - `guard.summaryOnly=true`
  - `summary.totalEvents=2`
- 로컬 화면: `http://localhost:7010/ads/tiktok`
  - 기본 화면에 summary mode 표시
  - `원본 진단 불러오기` 버튼 표시
  - 브라우저 smoke에서 화면 오류 없음

## 아직 안 된 것

- TikTok Events API 전송은 하지 않았다.
- Meta/Google ROAS 화면 전체를 한 번에 바꾸지는 않았다. 호출 후보를 감사하고 전환 범위를 정리했다.
- TikTok raw 진단 버튼 자체는 남겨뒀다. 기본 화면은 요약 우선이지만, 사용자가 명시적으로 누르면 원본 비교 진단을 실행한다.

## Auditor Verdict

PASS.

로컬 구현, VM Cloud 배포, 운영 API post-check를 통과했다. 외부 전송, 운영DB write, GTM publish, raw identifier output은 하지 않았다.
