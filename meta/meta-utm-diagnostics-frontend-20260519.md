작성 시각: 2026-05-19 01:34 KST
기준일: 2026-05-19
문서 성격: Meta UTM 진단 화면 구현 결과와 배포 전 판단 메모

```yaml
harness_preflight:
  common_harness_read: harness/common/HARNESS_GUIDELINES.md, harness/common/AUTONOMY_POLICY.md, harness/common/REPORTING_TEMPLATE.md # 2026-05-19 01:14 KST
  project_harness_read: CLAUDE.md, AGENTS.md, frontrule.md, docurule.md
  required_context_docs:
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green
  allowed_actions:
    - read-only Meta Ads API 조회
    - read-only VM Cloud attribution ledger 조회
    - 로컬 백엔드 API 구현
    - 로컬 프론트엔드 화면 구현
    - 로컬 lint/build/API/browser smoke
  forbidden_actions:
    - GTM Production publish
    - permanent env flag ON
    - platform conversion send
    - production DB write
    - VM Cloud deploy/restart
    - frontend production deploy
  source_window_freshness_confidence:
    source: Meta Ads Insights API + VM Cloud attribution ledger
    window: 2026-05-12 ~ 2026-05-18 KST (date_preset=last_7d)
    freshness: API live/cache 응답, VM Cloud source_confidence B
    confidence: 0.82
```

## 10초 요약

Meta 광고 관리자처럼 캠페인, 광고 세트, 광고를 나눠 보고 각 행의 UTM 준비 상태를 판단하는 로컬 화면을 만들었다.

화면은 `/ads/meta-utm`에 있다. Section A는 UTM과 Meta ID가 모두 준비된 항목이다. Section B는 보완 전까지 내부 ROAS를 신뢰하기 어려운 항목이다.

2026-05-19 01:27 KST 기준 바이오컴 최근 7일은 Section A가 0행, Section B가 캠페인 11행, 광고세트 31행, 광고 92행이다. 이는 화면 문제가 아니라 현재 Meta creative evidence에서 `utm_source`, `utm_medium`, campaign/adset/ad id가 충분히 확인되지 않는다는 뜻이다.

운영 반영은 아직 하지 않았다. 배포하려면 백엔드 새 API와 프론트 새 route를 함께 배포해야 한다.

## 무엇이 가능해졌나

- 운영자가 Meta 광고 관리자와 비슷한 표에서 현재 운용 중인 캠페인, 광고 세트, 광고를 계층별로 볼 수 있다.
- 각 계층에서 `게재`, `캠페인 ID`, `예산`, `ROAS(att)`, `지출금액`, `구매(수)`, `도달`, `CPM`, `CPC(전체)`, `구매당 비용`을 볼 수 있다.
- 광고 행에는 작은 썸네일, 광고 ID, 광고세트 ID, 캠페인 ID를 같이 표시한다.
- UTM이 부족한 이유를 행 안에 사람이 읽는 문장으로 표시한다.

## 구현 위치

- 백엔드: `backend/src/routes/ads.ts`
  - 새 API: `GET /api/ads/meta-utm-diagnostics`
  - 읽는 데이터: Meta campaigns/adsets/ads/insights, VM Cloud attribution ledger
  - 쓰기 작업: 없음
- 프론트엔드: `frontend/src/app/ads/meta-utm/page.tsx`
  - 새 화면: `/ads/meta-utm`
- 기존 ROAS 화면 링크: `frontend/src/app/ads/page.tsx`
  - `/ads`의 캠페인 매핑 안내 카드에 `Meta UTM 진단 열기` 링크 추가

## 현재 관측값

- source: Meta Ads Insights API + VM Cloud attribution ledger
- window: 2026-05-12 ~ 2026-05-18 KST
- site: biocom
- account_id: `act_3138805896402376`
- freshness: 2026-05-19 01:27 KST 응답 캐시
- confidence: B

| 계층 | Section A | Section B | 지출 | Meta 구매 |
|---|---:|---:|---:|---:|
| 캠페인 | 0행 | 11행 | ₩26,821,048 | 87 |
| 광고 세트 | 0행 | 31행 | ₩26,821,048 | 87 |
| 광고 | 0행 | 92행 | ₩26,821,048 | 86 |

## 한계

- Meta 광고 관리자에 보이는 정확한 `머신러닝 진행 중` 문구는 API에서 그대로 내려오지 않는다. 현재는 `effective_status`와 `learning_stage_info`로 근사한다.
- 광고세트/광고 단위 ATT ROAS는 주문 원장에 adset id 또는 ad id가 남은 경우만 정확히 계산한다.
- 현재 일부 creative는 `url_tags`가 있더라도 `utm_source` 또는 `utm_medium`이 빠진 상태로 보인다. 이 경우 Section B로 둔다.
- Section A가 0행인 것은 UTM 기준이 엄격해서다. 운영자가 실제 Meta URL parameter를 보강하면 Section A로 이동한다.

## 검증

- `npm run typecheck` in `backend`: 통과
- `npm run lint -- src/app/ads/meta-utm/page.tsx src/app/ads/page.tsx` in `frontend`: 통과, 기존/썸네일 warning만 있음
- `npm run build` in `frontend`: 통과, `/ads/meta-utm` static route 생성 확인
- `python3 scripts/harness-preflight-check.py --strict`: 통과
- API smoke: `GET /api/ads/meta-utm-diagnostics?account_id=act_3138805896402376&date_preset=last_7d`: `ok=true`
- Browser smoke: 임시 7011에서 캠페인/광고 탭, Section A/B, 광고 썸네일, 광고 ID/광고세트 ID 표시 확인

## 다음 할일

### Auto Green

1. 배포 전 최종 diff를 한 번 더 확인한다.
   - 담당: Codex
   - 성공 기준: 새 API, 새 화면, 기존 `/ads` 링크 외 불필요한 변경 없음

### Approval Needed

1. VM Cloud 백엔드와 프론트 운영 배포를 승인한다.
   - 담당: TJ님 승인, Codex 실행
   - 이유: `/ads/meta-utm`는 새 백엔드 API를 필요로 하므로 프론트만 배포하면 운영에서 화면이 정상 동작하지 않는다.
   - 성공 기준: `https://biocom.ainativeos.net/ads/meta-utm`에서 Section A/B와 광고 썸네일이 표시되고 `/api/ads/meta-utm-diagnostics`가 `ok=true`를 반환한다.

### Blocked/Parked

1. Meta 광고 URL parameter 실제 보강은 아직 실행하지 않는다.
   - Lane: Red 또는 Yellow로 별도 승인 필요
   - 이유: 광고 플랫폼 설정 변경은 운영 광고에 영향을 준다.
