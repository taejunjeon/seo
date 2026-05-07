# Frontend baseline audit — 2026-05-08 KST

작성 시각: 2026-05-08 01:35 KST
작성자: 본 agent (Claude Code)
대상: 운영 frontend / API 응답 baseline (UI 수정 전 기록용)
관련 문서: [[../total/total-frontend-current-design-20260507]], [[../gdn/channel-funnel-quality-meta-google-organic-20260508]]
Status: 1차 audit (API JSON 캡처). 화면 캡처 (Playwright)는 별 sprint.
Do not use for: 운영 배포, GTM publish, 광고 변경, frontend 운영 deploy

## 5줄 결론

1. 본 sprint는 **API JSON baseline + audit 문서**까지. Playwright fullPage screenshot은 별 sprint (frontend dev server 7010 미가동, frontend npm run start 시간 비용 큼).
2. **`/api/ads/site-summary` (last_7d) 정상 응답**: Meta 광고 기준 biocom roas 1.62x / metaPurchaseRoas 3.2x (gap 1.58p), thecleancoffee 0.41x / 3.73x (gap 3.32p), aibio 0/0.
3. **`/api/google-ads/dashboard` 모든 date_preset 500** — 운영 VM `GOOGLE_ADS_DEVELOPER_TOKEN` 미설정 (직전 보고와 일치, TJ 컨펌 #2 영역).
4. **`/api/total/monthly-channel-summary` 404** — frontend 디자인 doc(`total-frontend-current-design-20260507`)에서 가정한 endpoint가 backend에 없음. 디자인 → 구현 step gap.
5. 운영 frontend 가동 endpoint 미확인 (cloudflared tunnel은 backend 7020만 매핑). frontend 화면 baseline 캡처는 운영 VM SSH로 frontend 포트 확인 후 별 sprint.

## 1. 캡처한 API JSON 목록

| endpoint | status | size | note |
|---|---|---:|---|
| `/api/ads/site-summary` | 200 | 2,782 bytes | Meta 광고 기준 site summary, last_7d default |
| `/api/google-ads/dashboard?date_preset=last_30d` | **500** | 67 bytes | `Google Ads developer token is not configured` |
| `/api/google-ads/dashboard?date_preset=last_7d` | **500** | 67 bytes | 동일 원인 |
| `/api/google-ads/status` | **500** | 67 bytes | 동일 원인 |
| `/api/total/monthly-channel-summary` | **404** | 49 bytes | route 미정의 |
| `/api/google-ads/diagnostics` | 404 | - | route 미정의 |
| `/api/total` | 404 | - | route prefix 미정의 |
| `/api/ads` | 404 | - | route prefix 미정의 |
| `/api/agents` | 404 | - | route prefix 미정의 |
| `/api/attribution/ledger` | 200 | (read) | 동작 |
| `/api/attribution/acquisition-summary` | 200 | (read) | 동작 |
| `/api/attribution/caller-coverage` | 200 | (read) | 동작 |

산출물 위치: `frontend/screenshots/20260508/api-*.json`

## 2. `/api/ads/site-summary` 핵심 (Meta 광고 기준 last_7d)

```text
window: 2026-05-01 ~ 2026-05-07
mode  : ads_manager_parity
attribution: useUnifiedAttributionSetting=true
guidance: "운영 메인은 Attribution confirmed ROAS, Meta purchase ROAS는 platform reference로만 해석"

[biocom]
  impressions      : 1,378,646
  clicks           :    30,842
  spend            : ₩28,228,850
  purchase_value   : ₩90,316,509  (Meta가 광고에 귀속한 conversion value)
  revenue          : ₩45,793,282  (Attribution confirmed revenue)
  confirmedRoas    : 1.62x
  officialRoas     : 1.24x
  metaPurchaseRoas : 3.2x         (platform reference)
  roasGap          : -0.38
  potentialRoas    : 1.62x
  bestCaseCeilingRoas: 3.92x

[thecleancoffee]
  spend            : ₩357,169
  confirmedRoas    : 0.41x
  metaPurchaseRoas : 3.73x
  roasGap          : -0.11

[aibio]
  spend            : ₩853,875
  purchases        : 0
  confirmedRoas    : 0
  leads            : 16  ← lead 형태 conversion만

[total]
  spend            : ₩29,439,894
  revenue          : ₩45,938,642
  confirmedRoas    : 1.56x
  metaPurchaseRoas : 3.11x
  roasGap          : -0.37
```

## 3. Meta vs Google 광고 ROAS gap 비교 (본 sprint 새 evidence)

| 측정 | Meta last_7d | Google last_30d |
|---|---:|---:|
| Spend | ₩28~29M (last_7d biocom) | ₩25M (last_30d biocom) |
| Platform 주장 ROAS | 3.2x (`metaPurchaseRoas`) | 8.72x (`Google Ads Conv. value`) |
| Internal confirmed ROAS | **1.62x** | **0.28x** |
| Gap | **1.58p** (Meta 약 2배 차이) | **8.44p** (Google 약 31배 차이) |
| 주요 원인 | useUnifiedAttributionSetting (cross-device, view-through) | NPay click/count Primary 오염 99.99% |

→ **Meta는 정합성 양호 (2배 gap은 attribution window 차이로 설명 가능)**, **Google은 NPay 오염으로 31배 gap**. 본 [[../gdn/channel-funnel-quality-meta-google-organic-20260508]] 분석과 일치.

## 4. 화면에서 오해 위험 있는 문구 (audit)

API 응답에 있는 텍스트 기준 (실제 frontend 화면 검증은 별 sprint):

| 위치 | 표현 | 위험 |
|---|---|---|
| `meta_reference.numeratorDefinition` | "Meta ROAS 분자는 PG confirmed revenue가 아니라 Meta가 광고에 귀속한 conversion value임" | **양호 명시** — 실제 결제 매출 아님을 명시. 이대로 화면에 노출되면 운영자 혼동 줄어듦 |
| `meta_reference.comparisonGuidance` | "운영 메인은 Attribution confirmed ROAS, Meta purchase ROAS는 platform reference로만 해석" | **양호 명시** — 정합성 우선 원칙 노출 |
| `metaPurchaseRoas` 필드명 | "Meta 광고 기준 ROAS" | 다소 모호. 화면에서 `metaPurchaseRoas` 가 큰 글자로 보이고 `confirmedRoas` 가 작게 보이면 오해 위험 |
| `bestCaseCeilingRoas` | "최대 가능 ROAS" | 잠재 매출 가정 — 화면에서 강조하면 사업 의사결정 왜곡 가능 |
| `potentialRevenue` | confirmedRevenue + pendingRevenue + ... | pending 비중 큰 site에서 misleading |

→ 화면에서 **`metaPurchaseRoas` (platform reference)** 와 **`confirmedRoas` (internal)** 를 색상/배지로 분리해서 보여주면 좋음. 이미 design doc `total-frontend-current-design-20260507` 가 이 분리를 권고.

## 5. backend route 부재 — design vs implementation gap

| 디자인 doc 가정 | backend 실제 |
|---|---|
| `/api/total/monthly-channel-summary?site=biocom&month=2026-04&mode=dry_run` | **404** (route 미구현) |
| `/api/total/...` 계열 | 모두 404 |
| `/api/ads/site-summary` | 200 (구현됨) |
| `/api/google-ads/dashboard` | 500 (token 영향) |

→ **`total-frontend-current-design-20260507` 의 /total UI 구현은 backend route 부재로 별 sprint 필요**. 본 sprint에서는 audit만.

## 6. 화면 캡처 부재 사유 + 다음 sprint 계획

본 sprint 화면 캡처 미진행 이유:
- frontend dev 7010 미가동 (`curl http://localhost:7010 → 000`)
- frontend production server 운영 VM 별도 expose 미확인 (cloudflared tunnel은 backend 7020만)
- Playwright 설치는 됨 (`frontend/node_modules/.bin/playwright`), 실행 가능

다음 sprint 화면 캡처 절차 (별 sprint 진입 시):
1. 운영 VM 또는 local에서 `npm --prefix frontend run start` 또는 `npm run dev` 시작
2. Playwright config 작성
3. /ads, /ads/google, /total, agent 결과 화면 desktop+mobile fullPage 캡처
4. console/network error 기록
5. 캡처 결과를 `frontend/screenshots/20260508/*.png` 로 저장

## 7. 좋은 점 (audit)

- API 응답 자체가 attribution confirmed vs platform reference 를 분리 명시 (`numeratorDefinition`, `comparisonGuidance` 텍스트)
- 운영 attribution_ledger 는 정상 fresh (last_mod 14:52 UTC, totalRows 29,463)
- Meta CAPI Purchase 운영 송출 정상 (3,359 lines, 최근 200건 200 OK)
- BigQuery raw 적재 정상 (events_20260506 70,294 rows)

## 8. 오해 위험이 있는 문구 (요약)

- `metaPurchaseRoas` 가 `confirmedRoas` 보다 화면 위쪽에 있으면 운영자가 platform reference 를 정합성으로 오해할 수 있음.
- `bestCaseCeilingRoas` 같은 잠재 ROAS 지표는 화면에서 강조하면 사업 판단 왜곡 위험.
- `purchases` (Meta 광고 conversions) 와 `orders` (Attribution confirmed orders) 가 같은 카드에 같이 보이면 혼동.

## 9. 다음 UI 개선 후보

| 후보 | 우선순위 | 비고 |
|---|---|---|
| `/total` 화면 (디자인 doc 기반) | P3 (별 sprint) | backend `/api/total/monthly-channel-summary` 구현이 선행 |
| Meta vs internal ROAS 분리 카드 | P2 | 이미 design doc 에 있음. 구현 단계 |
| Google ROAS gap 분해 카드 | P2 | NPay 오염 / click id 유실 / NPay 결제 fire 누락 3종 분리 |
| canary status 카드 (paid_click_intent ledger 누적) | P2 | row_count, dedupe ratio, 5xx 비율 |
| ProductEngagementSummary 결과 카드 | P3 | POC 진행 후 |

## 10. 확인 (no-action)

- 운영 backend deploy: **하지 않았습니다**.
- 운영 DB write: **하지 않았습니다**.
- 광고 플랫폼 전송: **하지 않았습니다**.
- GTM publish: **하지 않았습니다**.

## 한 줄 결론

> API baseline 캡처 완료 (5개 endpoint 응답). Meta ROAS gap 1.58p (작음, 양호) vs Google 8.44p (큼, NPay 오염). frontend route 일부 미구현 (디자인 doc 가정 routes 404). Playwright fullPage 화면 캡처는 frontend 가동 후 별 sprint.
