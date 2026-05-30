harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
  lane: Green
  allowed_actions:
    - documentation
    - approval_packet_design
  forbidden_actions:
    - vm_deploy
    - platform_send
    - production_db_write
  source_window_freshness_confidence:
    source: "audit synthesis"
    window: "2026-05-25"
    freshness: "2026-05-25 17:26 KST"
    confidence: "0.91"

# 다음 액션

## 1. Google Ads summary endpoint 설계/로컬 구현

무엇을: `/api/google-ads/dashboard-summary`를 추가한다.

왜: Google ROAS 화면은 첫 진입에 Google Ads API와 내부 대조 작업을 한 번에 수행해서 화면이 무겁다.

어떻게: 기존 `/api/google-ads/dashboard`가 만드는 큰 응답에서 첫 화면에 필요한 숫자만 추출하고, precompute/disk cache를 붙인다.

성공 기준:

- cache hit 응답 500ms 이하.
- raw campaign row는 기본 응답에서 제외.
- 기존 상세 dashboard는 버튼 뒤에서 유지.

추천 점수: 94%.

## 2. TikTok 화면의 Meta/Google benchmark direct call 제거

무엇을: TikTok 화면 안의 참고용 Meta/Google ROAS 카드를 summary endpoint로 바꾼다.

왜: TikTok 화면을 summary-first로 바꿨지만, 내부 참고 카드가 여전히 Meta/Google live endpoint를 직접 호출한다.

어떻게:

- Meta: `/api/ads/roas` → `/api/ads/roas-summary`
- Google: `/api/google-ads/dashboard` → 신규 `/api/google-ads/dashboard-summary` 또는 임시 요약 cache

성공 기준:

- TikTok 화면 첫 로딩에서 raw ledger/direct Google Ads dashboard 호출 0.
- benchmark 카드의 숫자 의미 유지.

추천 점수: 92%.

## 3. Meta ROAS 전체 화면 첫 화면 단순화

무엇을: `/ads/roas` 첫 화면을 `/api/ads/roas-summary` 중심으로 바꾼다.

왜: Meta는 이미 summary endpoint가 있으므로 상세 daily/channel 호출을 첫 화면에서 모두 실행할 필요가 작다.

어떻게:

- 요약 카드 먼저 표시.
- 일별/채널 상세는 접기 또는 버튼 뒤로 이동.

성공 기준:

- 첫 화면 필수 호출 수 감소.
- cache hit 응답 중심.
- 상세 분석 기능은 보존.

추천 점수: 86%.

