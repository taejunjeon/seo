# Google ROAS Summary-First Deploy Result

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docs/report/text-report-template.md
  required_context_docs:
    - gptconfirm/gpt0525-4-roas-summary-first-candidate-audit/00-result-report.md
  lane: Yellow
  allowed_actions:
    - backend/frontend deploy for Google ROAS summary-first
    - TikTok report reference-card endpoint switch
    - read-only API smoke
    - frontend page smoke
    - pm2 restart
  forbidden_actions:
    - Meta/Google/TikTok platform event send
    - GTM publish
    - operating DB write/import
    - VM Cloud schema migration
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud backend/frontend + local repo
    window: current deploy, 2026-05-25 KST
    freshness: immediately after deploy smoke
    confidence: high
```

## 한 줄 결론

Google ROAS 화면을 "미리 계산된 요약값 먼저 보기"로 바꾸고, TikTok 화면의 Meta/Google 참고 카드가 직접 live API를 때리지 않도록 VM Cloud에 배포했다.

## 완료한 것

- Google Ads 대시보드 요약 API를 추가했다.
  - 신규 엔드포인트: `/api/google-ads/dashboard-summary`
  - 기본 전략: 첫 요청 또는 4시간 주기 precompute가 계산하고, 화면은 캐시를 먼저 읽는다.
  - 기존 live 엔드포인트 `/api/google-ads/dashboard`는 유지했다.
- Google Ads summary precompute worker를 추가했다.
  - 대상 preset: `yesterday`, `last_7d`, `last_30d`
  - 기본 주기: 4시간
  - 운영 로그: `ok=3 failed=0 next=14400s`
- Google Ads 화면 2곳을 summary-first로 전환했다.
  - `/ads/google`
  - `/ads/google-roas-report`
- TikTok 화면의 Meta/Google 참고 카드를 direct live call에서 summary endpoint로 전환했다.
  - Meta 참고 카드: `/api/ads/roas-summary`
  - Google 참고 카드: `/api/google-ads/dashboard-summary`
  - TikTok 자체 요약: 기존 `/api/ads/tiktok/roas-summary` 유지
- VM Cloud 배포와 restart를 완료했다.
  - backend build PASS
  - frontend build PASS
  - `seo-backend` online
  - `seo-frontend` online

## 숫자로 본 효과

- Google summary 첫 호출: `10.537s`, `source=live_cache_miss`
- Google summary 두 번째 호출: `0.231s`, `source=in_memory_precompute`
- Meta summary 호출: `0.098s`, `source=disk_cache_hit`
- 공개 페이지 smoke:
  - `/ads/google`: 200
  - `/ads/google-roas-report`: 200
  - `/ads/tiktok`: 200

## Source / Window / Freshness

- Source: VM Cloud backend/frontend, Google Ads API summary cache, Meta ROAS summary cache
- Window: 2026-05-25 KST deploy 시점
- Freshness: deploy 직후 API/page smoke
- Site: shared ads dashboard pages
- Confidence: high

## 하지 않은 것

- Meta/Google/TikTok에 새 이벤트나 전환값을 보내지 않았다.
- 운영DB write/import를 하지 않았다.
- GTM publish를 하지 않았다.
- schema migration을 하지 않았다.
- 커밋/푸시는 하지 않았다. 현재 작업트리에 다른 작업 산출물이 많이 남아 있어 별도 정리가 필요하다.

## 로컬/운영 확인 주소

- 로컬 Google ROAS: `http://localhost:7010/ads/google`
- 로컬 Google ROAS 보고서: `http://localhost:7010/ads/google-roas-report`
- 로컬 TikTok 보고서: `http://localhost:7010/ads/tiktok`
- VM Google ROAS: `https://biocom.ainativeos.net/ads/google`
- VM Google ROAS 보고서: `https://biocom.ainativeos.net/ads/google-roas-report`
- VM TikTok 보고서: `https://biocom.ainativeos.net/ads/tiktok`
- 참고 CAPI 보고서 로컬: `http://localhost:7010/ai-crm/capi-report`
- 참고 CAPI 보고서 VM: `https://biocom.ainativeos.net/ai-crm/capi-report`

## 남은 리스크

- Google Ads summary cache는 메모리 기반이다. pm2 restart 직후 첫 요청은 다시 live 계산이 될 수 있다.
- TikTok 화면의 TikTok 자체 요약은 이미 summary-first였지만, 다른 광고 화면에도 직접 live API 호출이 남아 있을 수 있다.
- 작업트리가 더럽다. 이번 배포와 무관한 변경 파일이 많으므로 커밋 전 scope 정리가 필요하다.

## 다음 판단

- 이 배포는 화면 안정성 관점에서 성공으로 본다.
- 다음 단계는 다른 대형 ROAS 화면도 "요약 먼저, 원본 진단은 버튼" 구조로 통일하는 것이다.
