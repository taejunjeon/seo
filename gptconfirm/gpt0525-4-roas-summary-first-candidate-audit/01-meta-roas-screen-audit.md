harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
  lane: Green
  allowed_actions:
    - local_code_read
    - readonly_http_smoke
    - documentation
  forbidden_actions:
    - vm_deploy
    - platform_send
    - production_db_write
  source_window_freshness_confidence:
    source: "frontend/src/app + backend/src/routes/ads.ts"
    window: "current local code"
    freshness: "2026-05-25 17:26 KST"
    confidence: "0.92"

# Meta ROAS 화면 Audit

## 화면별 판단

### 전환 퍼널 관제

파일: `frontend/src/app/ai-crm/conversion-funnel/page.tsx`

상태: 이미 summary-first.

근거:

- `/api/ads/roas-summary`를 사용한다.
- 화면 문구도 "기본은 어제 사전 계산값", "당일 데이터는 버튼을 눌렀을 때 4시간 단위 캐시"로 되어 있다.
- 백엔드 worker가 `ROAS_SUMMARY_PRECOMPUTE_INTERVAL_MS` 기본 4시간으로 account×preset 그룹을 미리 계산한다.

판단: 유지. 별도 전환 필요 없음.

### Meta ROAS 전체 화면

파일: `frontend/src/app/ads/roas/page.tsx`

상태: summary-first 후보.

현재 호출:

- `/api/ads/channel-comparison`
- `/api/ads/site-summary`
- `/api/ads/roas/daily`

백엔드 상태:

- `/api/ads/site-summary`는 lazy cache가 있다.
- `/api/ads/roas/daily`는 lazy cache가 있지만 cache miss 때 Meta Insights + ledger load를 직접 실행한다.
- `/api/ads/channel-comparison`은 site별 Meta summary와 ledger load를 직접 실행한다.

권장 구조:

1. 첫 화면 카드: `/api/ads/roas-summary` 사용.
2. 일별 상세 그래프: `/api/ads/roas/daily`를 유지하되 기본 자동 호출 대신 "일별 상세 보기" 버튼 뒤로 이동.
3. 채널 비교: cache/precompute 또는 summary contract로 분리.

기대 효과:

- 첫 화면 응답이 10초대 miss를 피하고 0.2~0.5초 cache hit 중심으로 바뀐다.
- Meta API rate-limit 리스크가 줄어든다.
- "광고 플랫폼 주장 ROAS"와 "내부 confirmed ROAS"를 빠르게 비교할 수 있다.

### TikTok 화면 안의 Meta benchmark

파일: `frontend/src/app/ads/tiktok/page.tsx`

상태: 즉시 개선 후보.

현재 호출:

- `/api/ads/roas?account_id=...&date_preset=...`

권장:

- `/api/ads/roas-summary?account_id=...&presets=last_7d`로 교체.

이유:

- TikTok 화면의 목적은 TikTok 자체 상태를 보는 것이다.
- Meta benchmark는 참고 카드이므로 상세 캠페인 row가 필요 없다.
- summary endpoint는 raw ledger item을 반환하지 않는다.

