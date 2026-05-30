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
    - vm_cloud_backend_frontend_deploy_restart_after_user_approval
    - live_api_postcheck
  forbidden_actions:
    - meta_google_tiktok_platform_send
    - gtm_publish
    - operating_db_write_import
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud deploy logs + live API curl + live frontend HEAD
    window: 2026-05-25 KST
    freshness: 2026-05-25 17:08 KST
    confidence: 0.92
---

# VM Deploy Result

## 무엇이 가능해졌나

TikTok 광고 성과 화면이 운영에서도 기본 로딩 때 원본 이벤트 row를 직접 많이 가져오지 않는다. 먼저 `/api/ads/tiktok/roas-summary` 요약 결과를 읽고, 원본 비교는 사용자가 진단 버튼을 눌렀을 때만 실행한다.

## 배포 범위

- backend:
  - `backend/src/tiktokRoasComparison.ts`
  - `backend/src/routes/ads.ts`는 TikTok summary route만 최소 삽입
  - `backend/src/routes/attribution.ts`는 TikTok pixel events summary guard만 최소 삽입
- frontend:
  - `frontend/src/app/ads/tiktok/page.tsx`

## 백업

- `/home/biocomkr_sns/seo/repo/backend/_deploy-backup-20260525-165715-tiktok-summary-first`

## 검증 결과

- backend `npm run typecheck`: PASS
- backend `npm run build`: PASS
- frontend `npm run lint -- src/app/ads/tiktok/page.tsx`: PASS
- frontend `npm run build`: PASS
- `seo-backend`: online after restart
- `seo-frontend`: online after restart
- `https://att.ainativeos.net/api/attribution/tiktok-pixel-events?summaryOnly=true&limit=10000`:
  - HTTP 200
  - items 0
  - `guard.summaryOnly=true`
  - `summary.totalEvents=1000`
- `https://att.ainativeos.net/api/ads/tiktok/roas-summary`:
  - HTTP 200
  - `ok=true`
  - `mode=summary_first`
  - raw entries returned false
- `https://biocom.ainativeos.net/ads/tiktok`: HTTP 200

## 하지 않은 것

- TikTok Events API 전송 없음
- Meta/Google/TikTok 외부 플랫폼 send 없음
- 운영DB write/import 없음
- GTM publish 없음
- raw identifier 출력 없음

## 다음 액션

1. 실제 화면에서 기본 로딩이 빨라졌는지 확인한다.
   - 기준: TikTok 화면 첫 진입에서 요약 카드가 먼저 뜨고, 원본 진단 버튼을 누르기 전까지 heavy raw 비교가 실행되지 않는다.
2. 24시간 동안 backend CPU/memory와 TikTok endpoint 호출량을 관찰한다.
   - 기준: `/api/attribution/tiktok-pixel-events?limit=10000` 같은 원본 대량 호출이 기본 화면에서 반복되지 않는다.
3. Meta/Google ROAS 화면도 같은 패턴이 필요한지 호출 로그 기준으로 확정한다.
   - 기준: 반복되는 대형 raw endpoint가 확인될 때만 summary-first 전환 후보로 올린다.
