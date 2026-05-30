# ROAS Summary-First Screen Audit

작성 시각: 2026-05-25 21:21 KST  
기준일: 2026-05-25  
문서 성격: ROAS 화면 안정성 점검 결과 보고

```yaml
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
    - gptconfirm/gpt0525-5-google-roas-summary-first-deploy/00-result-report.md
  lane: Green
  allowed_actions:
    - frontend source read-only audit
    - local page smoke
    - result documentation
  forbidden_actions:
    - Meta/Google/TikTok platform event send
    - GTM publish
    - operating DB write/import
    - VM Cloud deploy/restart
    - VM Cloud schema migration
    - raw identifier output
  source_window_freshness_confidence:
    source: local repo grep + local frontend smoke
    window: current source tree, 2026-05-25 KST
    freshness: checked at 2026-05-25 21:21 KST
    confidence: high
```

## 10초 요약

대형 ROAS 화면 중 Google, TikTok, 전환퍼널은 "미리 계산한 요약값 먼저 보기"로 정리됐다. 아직 `/ads`, `/ads/roas`, `/biocom-ltv-cac`는 화면을 열자마자 큰 원본성 ROAS API를 호출한다. 다음 파급력 큰 작업은 이 3개 화면을 요약 우선 구조로 바꾸는 것이다.

## 왜 중요한가

ROAS 화면은 광고비, 매출, 캠페인 성과를 한 번에 계산한다. 사용자가 화면을 열 때마다 원본 장부와 광고 API를 직접 계산하면 서버가 느려지고, 여러 창이 동시에 열릴 때 장애처럼 보일 수 있다.

그래서 앞으로 원칙은 단순하다.

- 기본 화면: 미리 계산된 요약값을 500ms 안팎으로 보여준다.
- 자세한 진단: 사용자가 버튼을 눌렀을 때만 원본 계산을 실행한다.
- 운영 판단: 요약값에는 source/window/freshness를 붙여 "언제 기준 숫자인지"를 보여준다.

## 완료한 것

- 프론트엔드 소스에서 ROAS 관련 큰 API 호출을 다시 점검했다.
- 요약 우선 구조가 이미 적용된 화면과 아직 원본 호출이 남은 화면을 분리했다.
- 로컬 프론트엔드 주요 보고서 주소가 살아 있는지 smoke로 확인했다.
- 이번 점검 결과와 OKR/액션플랜을 문서화했다.

## 화면별 판정

### 요약 우선 구조가 적용된 화면

- `/ai-crm/conversion-funnel`
  - Meta ROAS는 `/api/ads/roas-summary`를 사용한다.
  - 강제 새로고침 버튼과 cooldown이 있다.
- `/ads/tiktok`
  - TikTok 자체 ROAS는 `/api/ads/tiktok/roas-summary`를 사용한다.
  - Meta/Google 참고 카드도 summary endpoint로 바뀌었다.
  - 원본 진단은 버튼으로만 실행된다.
- `/ads/google`
  - Google 대시보드는 `/api/google-ads/dashboard-summary`를 먼저 읽는다.
  - 보조 내부 ROAS 계산은 남아 있지만 raw ledger hammer로 보지는 않는다.
- `/ads/google-roas-report`
  - Google 보고서도 `/api/google-ads/dashboard-summary`를 먼저 읽는다.
- `/ads/meta-utm`
  - 기간 요약은 `/api/ads/roas-summary`를 사용한다.
  - UTM 진단성 API는 화면 목적상 별도다.

### 아직 바꿔야 하는 화면

- `/ads`
  - legacy 광고 overview 화면이다.
  - 화면 진입 시 Meta insights, daily ROAS, site-summary, campaign ROAS, campaign LTV API를 한 번에 호출한다.
  - 영향도가 가장 크므로 1순위다.
- `/biocom-ltv-cac`
  - 바이오컴 LTV/CAC 화면이다.
  - site-summary, ROAS, campaign LTV를 화면 진입 시 직접 호출한다.
  - 보고서형 페이지라 summary bundle로 바꾸는 것이 맞다.
- `/ads/roas`
  - Meta ROAS 전용 화면이다.
  - site-summary와 daily ROAS를 live로 호출한다.
  - 요약 카드와 일별 차트 캐시를 분리해야 한다.

## 로컬 smoke 결과

- `http://localhost:7010/ads/google`: 200
- `http://localhost:7010/ads/tiktok`: 200
- `http://localhost:7010/ai-crm/capi-report`: 200
- `http://localhost:7010/ai-crm/autonomy-report`: 200

## 프론트엔드 보고서 주소

- CAPI 개발 보고서 로컬: `http://localhost:7010/ai-crm/capi-report`
- CAPI 개발 보고서 VM Cloud: `https://biocom.ainativeos.net/ai-crm/capi-report`
- 하네스 자율성 보고서 로컬: `http://localhost:7010/ai-crm/autonomy-report`
- 하네스 자율성 보고서 VM Cloud: `https://biocom.ainativeos.net/ai-crm/autonomy-report`
- Google ROAS 로컬: `http://localhost:7010/ads/google`
- Google ROAS VM Cloud: `https://biocom.ainativeos.net/ads/google`
- TikTok ROAS 로컬: `http://localhost:7010/ads/tiktok`
- TikTok ROAS VM Cloud: `https://biocom.ainativeos.net/ads/tiktok`

## 하지 않은 것

- 운영DB write/import는 하지 않았다.
- VM Cloud deploy/restart는 하지 않았다.
- Meta/Google/TikTok에 이벤트나 전환값을 보내지 않았다.
- GTM publish는 하지 않았다.
- raw order/payment/click/member id를 출력하지 않았다.
- legacy ROAS 화면 코드는 이번 점검에서 수정하지 않았다.

## 현재 영향

이번 작업은 read-only 점검과 문서화다. 운영 화면, 서버, 광고 플랫폼에는 영향이 없다.

## 남은 리스크

- `/ads`가 여전히 많이 쓰이는 화면이면, 사용자가 열 때마다 큰 API 호출이 발생한다.
- `/biocom-ltv-cac`와 `/ads/roas`도 같은 사용자가 반복 조회하면 backend 부하 원인이 될 수 있다.
- Google/TikTok 화면은 개선됐지만, 내부 보조 ROAS 호출은 추후 모니터링 대상이다.

## 확인하면 좋은 문서

1. `gptconfirm/gpt0525-6-roas-summary-first-screen-audit/01-screen-audit.md`  
   왜 봐야 하는지: 어떤 화면이 이미 안전하고, 어떤 화면을 다음에 바꿔야 하는지 바로 볼 수 있다.

2. `gptconfirm/gpt0525-6-roas-summary-first-screen-audit/02-okr-action-plan.md`  
   왜 봐야 하는지: 이 프로젝트의 OKR과 다음 개발 순서가 사업 목표 기준으로 정리돼 있다.

3. `gptconfirm/gpt0525-5-google-roas-summary-first-deploy/00-result-report.md`  
   왜 봐야 하는지: 직전 Google/TikTok summary-first 배포가 실제로 무엇을 바꿨는지 확인할 수 있다.

## 다음 판단

이 프로젝트는 계속 추진하는 것이 맞다. 다만 새 기능을 늘리기보다, 남은 legacy ROAS 화면 3개를 "요약 먼저, 원본 진단은 버튼" 구조로 통일하는 것이 먼저다.

