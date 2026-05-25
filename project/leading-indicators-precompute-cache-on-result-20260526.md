작성 시각: 2026-05-26 01:13 KST
기준일: 2026-05-26
문서 성격: VM Cloud 배포 결과 보고

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  required_context_docs:
    - project/leading-indicators-precompute-cache-on-plan-20260526.md
  lane: Yellow
  allowed_actions:
    - VM Cloud backend deploy/restart
    - VM Cloud frontend deploy/restart
    - precompute cache ON
    - read-only API smoke
  forbidden_actions:
    - Meta/Google/TikTok/Naver platform send
    - GTM publish
    - Imweb code change
    - operating DB write/import
    - DB schema migration
  source_window_freshness_confidence:
    source: VM Cloud leading-indicators API + GA4 snapshot JSON + VM Cloud PM2 logs
    window: leading indicators 7d smoke 중심
    freshness: 2026-05-26 01:13 KST
    confidence: high
```

## 10초 요약

선행지표 에이전트 화면의 느린 조회를 줄이기 위해 VM Cloud에서 주요 조합을 미리 계산하도록 켰다.
운영 화면은 이제 `in_memory_precompute` 캐시를 읽고, 바이오컴/더클린커피 주요 7일 지표가 캐시 응답으로 내려온다.
페이지 롱 뷰 기준은 2분을 기본으로 정했다. 3분은 더클린커피 Meta에서 구분력이 약했고, 7분은 강한 관심 보조 신호로만 둔다.

## 무엇이 바뀌었나

- VM Cloud backend에 선행지표 사전 계산을 켰다.
  - 30분마다 site × window × channel × dimension 주요 조합을 미리 계산한다.
  - 첫 tick 결과는 `ok=44 failed=0 generation_ms=16052`다.
- VM Cloud frontend 문구를 바꿨다.
  - 화면에서 2분 기준을 기본으로 설명한다.
  - 7분은 `보조 기준`으로 설명한다.
- 2분/3분/7분 중 운영 기준을 정리했다.
  - 기본: 2분 이상 머문 방문.
  - 보조: 7분 이상 머문 강한 관심 방문.
  - 제외: 3분 기준은 당장 운영 기준에서 제외.

## 왜 2분을 기본으로 골랐나

2분은 구매자와 비결제자의 차이를 잘 보여주면서도 표본을 너무 많이 잃지 않는다.
바이오컴 Meta에서는 2분 기준이 3분보다 구매자 커버리지가 좋고, 더클린커피 Meta에서는 3분 기준의 구매자/비결제자 차이가 거의 없었다.

쉽게 말하면 2분은 “관심이 생긴 방문”을 잡는 기준이고, 7분은 “매우 깊게 본 방문”을 잡는 기준이다.
3분은 두 기준 사이에서 추가 의사결정 가치가 약했다.

## 운영 반영 결과

- 배포 대상
  - backend/src/leadingIndicators.ts
  - backend/scripts/ga4-vm-row-level-safe-bridge-dry-run.ts
  - frontend/src/app/ai-crm/leading-indicators/page.tsx
  - frontend/src/app/ai-crm/leading-indicators/page.module.css
  - frontend/src/app/ai-crm/leading-indicators/dry-run.ts
  - data/project GA4 snapshot JSON 4개
- 백업 경로
  - `/home/biocomkr_sns/seo/repo/_deploy-backup-leading-indicators-precompute-20260525T155510Z`
- VM Cloud 환경값
  - `LEADING_INDICATORS_PRECOMPUTE_ENABLED=1`
  - `LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000`
- PM2 상태
  - `seo-backend`: online, restart count 20, memory 약 520MB, CPU 약 0.2%
  - `seo-frontend`: online, restart count 13, memory 약 166MB, CPU 약 0.2%

## API 확인 결과

- `biocom / 7d / meta / buyer_vs_leaver`
  - cached: true
  - source: in_memory_precompute
  - generation_ms: 235
  - safe_sessions: 428
  - GA4 joined: 418
- `thecleancoffee / 7d / meta / buyer_vs_leaver`
  - cached: true
  - source: in_memory_precompute
  - generation_ms: 49
  - safe_sessions: 126
  - GA4 joined: 126
- 추가 확인한 7일 조합
  - biocom google_paid/youtube/organic: cached true
  - thecleancoffee google_paid/youtube/organic: cached true
  - biocom all channel: cached true
  - thecleancoffee all channel: cached true

## 검증

- 로컬 frontend ESLint: PASS
- 로컬 backend build: PASS
- VM backend build: PASS
- VM frontend build: PASS
- Harness preflight strict: PASS
- git diff check: PASS
- VM frontend smoke: `https://biocom.ainativeos.net/ai-crm/leading-indicators` 200, 약 0.30초
- 운영 페이지 HTML 문구 확인
  - `기본은 2분`: present
  - `7분 보조`: present

## 하지 않은 것

- Meta/Google/TikTok/Naver 전송 없음.
- GTM publish 없음.
- Imweb header/footer 수정 없음.
- 운영DB write/import 없음.
- DB schema migration 없음.
- 커밋/푸시 없음.

## 남은 리스크

- 첫 precompute는 성공했지만, 다음 1-2회 tick에서 메모리와 restart count를 한 번 더 봐야 한다.
- 더클린커피 google_paid 표본은 7일 기준 4세션이라 아직 선행지표 판단에 약하다.
- `organic` 일부 조합은 GA4 behavior snapshot이 없는 구간이 있어 화면에서는 신뢰도 설명이 필요하다.

## 다음 행동

1. 2026-05-26 01:30 KST 이후 다음 tick 확인
   - `ok=44 failed=0` 유지 여부를 본다.
   - backend memory가 1GB 이하에서 안정적인지 본다.
2. 2분 기준 Top 5 선행지표 점수화
   - 2분 이상 체류, 7분 이상 체류, scroll90, begin_checkout, add_payment_info 등을 같은 점수표로 비교한다.
3. 더클린커피 행동 공백 보강
   - google_paid 표본 부족과 organic GA4 snapshot missing을 분리한다.
