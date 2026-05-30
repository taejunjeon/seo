작성 시각: 2026-05-25 23:44 KST
기준일: 2026-05-25
문서 성격: Meta 원본 랜딩 bridge 프론트/백엔드 로컬 반영 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - frontrule.md
    - data/!data_inventory.md
  lane: Green
  allowed_actions:
    - local_backend_patch
    - local_frontend_patch
    - api_smoke
    - frontend_playwright_smoke
    - documentation
  forbidden_actions:
    - vm_cloud_deploy_or_restart
    - vm_cloud_sqlite_write
    - operating_db_write
    - meta_ads_mutation
    - offline_event_set_save
    - platform_send
    - gtm_publish
  source_window_freshness_confidence:
    source: local backend API + local frontend + VM Cloud read-only bridge artifact
    window: 2026-05-18~2026-05-26 UTC bridge artifact
    site: biocom
    freshness: 2026-05-25 23:44 KST local smoke
    confidence: high for local UI/API patch, medium_high for bridge business interpretation
```

## 10초 요약

`/ads/meta-utm` 보고서에 원본 랜딩 bridge 패널을 붙였다. 이제 고객 유입 장부에는 `/iiary02`가 0건으로 보여도, 결제/체크아웃 원장 안의 원본 랜딩 URL 기준으로는 148건이 복구된다는 점을 화면에서 바로 볼 수 있다.

이 반영은 로컬/API 표시용 초안이다. ROAS 산식, VM Cloud 원장, Meta 광고 설정은 바꾸지 않았다.

## 무엇이 가능해졌나

백엔드 `GET /api/ads/meta-utm-diagnostics` 응답에 `originalLandingBridge` 필드가 붙는다.

프론트 `/ads/meta-utm` 화면에는 `원본 랜딩 bridge` 패널이 추가됐다.

패널은 아래를 보여준다.

- 고객 유입 장부 exact path row: 0건
- 원본 랜딩 bridge row: 148건
- 숫자 ID A급 row: 132건
- 템플릿 문구 D급 row: 16건
- 내부 결제완료 매출: 54건 / ₩19,636,820
- D급 결제완료: 6건 / ₩1,894,000

## 변경 파일

- `backend/src/routes/ads.ts`
  - `originalLandingBridge` 로컬 draft loader 추가
  - `/api/ads/meta-utm-diagnostics` 응답에 read-only bridge 요약 추가

- `frontend/src/app/ads/meta-utm/page.tsx`
  - `OriginalLandingBridgePanel` 추가
  - API 타입에 `originalLandingBridge` 추가
  - 반응형 CSS 추가

- `project/meta-url-parameter-substitution-analysis-20260525.md`
  - URL 매개변수 숫자 치환 실패 가능 원인과 오프라인 이벤트 세트 의견 정리

## 검증 결과

```text
npm run typecheck                         PASS
npm run lint -- src/app/ads/meta-utm/page.tsx
  PASS with existing warning: next/no-img-element

python3 scripts/validate_wiki_links.py ... PASS
python3 scripts/harness-preflight-check.py --strict PASS

GET /api/ads/meta-utm-diagnostics
  originalLandingBridge.status = loaded
  targetPath = /iiary02
  bridgeRows = 148
  numericRows = 132
  templateRows = 16
  confirmedRevenue = 19636820

Playwright local smoke
  /ads/meta-utm panel visible = true
  screenshot = data/project/meta-utm-original-landing-bridge-panel-20260525.png
```

## 하지 않은 것

- VM Cloud 배포/재기동 안 함
- VM Cloud SQLite write 안 함
- 운영DB write 안 함
- Meta 광고 설정 변경 안 함
- 오프라인 이벤트 데이터 세트 저장 안 함
- ROAS 산식에 bridge 자동 반영 안 함

## 다음 판단

원본 랜딩 bridge는 지금 화면 보조 증거로는 충분하다. 다만 D급 16건을 특정 광고로 자동 배정하는 근거는 아니다.

운영 반영은 두 단계로 나누는 것이 안전하다.

1. Green: 화면/API에서 read-only bridge를 계속 보여준다.
2. Yellow: TJ님 승인 후 VM Cloud에 같은 API/UI 패치를 배포한다.
3. Red 또는 별도 승인: 원장 schema 변경, 원본 랜딩 backfill, Meta 광고 설정 저장, 오프라인 이벤트 세트 변경.

## Auditor verdict

PASS_WITH_NOTES.

로컬 코드와 문서만 변경했다. 외부 전송, 광고 플랫폼 저장, DB write, 배포는 수행하지 않았다.
