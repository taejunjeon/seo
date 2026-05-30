harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
  required_context_docs:
    - gptconfirm/gpt0525-3-tiktok-summary-first-local-patch/00-result-report.md
  lane: Green
  allowed_actions:
    - local_code_read
    - route_audit
    - frontend_fetch_audit
    - readonly_http_smoke
    - documentation
  forbidden_actions:
    - vm_deploy
    - production_db_write
    - platform_send
    - gtm_publish
    - secret_output
  source_window_freshness_confidence:
    source: "local repository + readonly HTTP smoke"
    window: "2026-05-25 KST current code"
    freshness: "2026-05-25 17:26 KST"
    confidence: "0.91"

# ROAS Summary-First Candidate Audit

## 이번에 가능해진 것

Meta/Google ROAS 화면 중 어떤 화면이 이미 "요약 먼저 읽기(summary-first)" 구조인지, 어떤 화면이 아직 "원본 장부/광고 API 직접 조회" 구조인지 분리했다.

summary-first는 화면을 열자마자 무거운 원본 장부나 광고 API를 직접 긁지 않고, 백엔드가 미리 계산해 둔 작은 요약값을 먼저 보여주는 방식이다. 사용자는 빠르게 숫자를 보고, 상세 진단은 별도 버튼으로 들어간다.

## 핵심 결론

1. 전환 퍼널 화면의 Meta ROAS 카드는 이미 `/api/ads/roas-summary`를 사용한다.
2. Meta 전체 ROAS 화면(`/ads/roas`)은 일부 summary-first 보강 후보지만, 이미 `site-summary`와 `daily` 쪽에 lazy cache가 있다.
3. Google Ads ROAS 화면(`/ads/google`, `/ads/google-roas-report`)은 강한 summary-first 후보이다. 현재 첫 진입에서 `/api/google-ads/dashboard`가 Google Ads API 5개 쿼리와 내부 매출 대조를 같이 실행한다.
4. TikTok 화면은 TikTok 자체는 summary-first로 바뀌었지만, 벤치마크 카드에서 Meta `/api/ads/roas`와 Google `/api/google-ads/dashboard`를 직접 호출하는 잔여 구간이 있다.

## 확인한 화면 주소

- 로컬 CAPI 프론트엔드 보고서: http://localhost:7010/ai-crm/capi-report
- VM CAPI 프론트엔드 보고서: https://biocom.ainativeos.net/ai-crm/capi-report
- 로컬 Meta ROAS 화면: http://localhost:7010/ads/roas
- VM Meta ROAS 화면: https://biocom.ainativeos.net/ads/roas
- 로컬 Google ROAS 보고서: http://localhost:7010/ads/google-roas-report
- VM Google ROAS 보고서: https://biocom.ainativeos.net/ads/google-roas-report
- 로컬 전환 퍼널 관제: http://localhost:7010/ai-crm/conversion-funnel
- VM 전환 퍼널 관제: https://biocom.ainativeos.net/ai-crm/conversion-funnel

## Read-only smoke

- 로컬 CAPI 보고서: HTTP 200, 0.108초
- VM CAPI 보고서: HTTP 200, 0.352초
- VM `/api/ads/roas-summary` 첫 호출: HTTP 200, 10.923초, `source=live_cache_miss`
- VM `/api/ads/roas-summary` 두 번째 호출: HTTP 200, 0.183초, cache hit

해석: Meta ROAS summary endpoint는 캐시가 있으면 충분히 빠르다. 첫 miss가 길 수 있으므로 precompute 대상 조합이 화면 호출 조합과 일치하는지 유지해야 한다.

## 우선순위

1. Google Ads ROAS summary-first 전환: 추천 94%.
   - 이유: 현재 첫 화면이 Google Ads API와 내부 대조 계산을 바로 실행한다.
2. TikTok 화면의 Meta/Google 벤치마크 카드를 summary endpoint로 교체: 추천 92%.
   - 이유: TikTok 자체는 개선됐지만 화면 안에 남은 직접 호출이 있다.
3. Meta `/ads/roas` 첫 화면을 `/api/ads/roas-summary` 중심으로 가볍게 바꾸고, `/daily`는 상세 버튼 뒤로 이동: 추천 86%.
   - 이유: Meta는 이미 캐시가 있으나 첫 화면에서 여러 endpoint를 동시에 부른다.

## 하지 않은 것

- VM Cloud 배포 없음.
- Meta/Google/TikTok 외부 전송 없음.
- 운영DB write 없음.
- GTM publish 없음.
- 기존 dirty worktree 정리 없음.

