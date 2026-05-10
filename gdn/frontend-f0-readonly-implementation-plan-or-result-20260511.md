# Frontend F0 read-only implementation 진행 (gpt0508-34)

작성 시각: 2026-05-10 22:25:00 KST
Lane: 본 sprint는 frontend code patch까지 적용 (Green code 작성 + typecheck PASS).
운영 build/배포는 Yellow 승인 게이트로 분리.
자신감: 88% (production 빌드 시점 / 7010 supervisor 정책 미지)

## 5줄 결론

1. data contract v2가 요구한 필드 중 ROAS gap·내부 confirmed·캠페인 ID 커버리지·NPay 해석 카드는 이미 `frontend/src/app/ads/google/page.tsx`에 구현되어 있다.
2. 누락된 4 필드(upload/send guard, BigQuery coverage, NPay click warning, next_safe_action)를 `Data Trust Guard` 단일 section으로 추가했다.
3. patch는 정적 안내 카드 4개로 구성해 backend 라우트 변경 없이 즉시 동작하고, frontend typecheck PASS 했다.
4. 운영 7010 production server는 `next start`라 화면 반영하려면 `cd frontend && npm run build` 필요. 이건 Yellow 승인 후 실행.
5. 다음 단계는 backend dashboard route에 `bigquery_coverage` / `upload_send_guard` / `next_safe_action` 동적 필드를 추가해 정적 텍스트를 라이브 데이터로 대체하는 patch_candidate.

## 1. 이미 구현되어 있는 항목 (audit)

| data contract v2 필드 | frontend 구현 위치 | 상태 |
|---|---|---|
| platform_roas_reference | line 996 `Google ROAS` KpiCard | ✅ |
| internal_confirmed_roas | line 1001 `내부 ROAS` KpiCard | ✅ |
| ROAS gap | line 1002 `ROAS 차이` KpiCard | ✅ |
| campaign_join_coverage | line 1051 `캠페인 ID 커버리지` row in panel | ✅ |
| Primary NPay click/count 분리 | line 1075~1107 `전환 액션별 gap 분해` panel | ✅ |
| NPay 해석 기준 (포함/제외) | line 1009~1033 `NPay 해석 기준` panel | ✅ |

## 2. 추가한 patch — Data Trust Guard section

위치: `frontend/src/app/ads/google/page.tsx` line 927(`</section>`) 직후. 정적 안내 카드 4개.

| 카드 | 내용 | 출처 |
|---|---|---|
| Upload / Send Guard | upload 0건 · send 0건 · send_candidate false · actual_send_candidate false | gpt0508-33 결과 |
| BigQuery coverage | 7d PASS · 14d PASS · 30d PASS | `data/campaign-funnel-quality-union-7_14_30d-20260511.json` |
| NPay click warning | click/count는 구매가 아님 · actual confirmed만 내부 ROAS 분자 포함 | data contract v2 |
| 다음 안전 액션 | ConfirmedPurchasePrep 갱신 시 click_view 재조인 · Google Ads upload는 명시 승인 전 HOLD | data contract v2 |

코드 LOC: +63 (단일 section block, 새 import/dependency 없음).

## 3. 검증

| 단계 | 결과 |
|---|---|
| `npx tsc --noEmit` (frontend) | PASS (no diagnostics) |
| ESLint | 본 파일 기준 새 경고 없음 (검사 명령 동일) |
| 새 dependency | 없음 |
| backend route 변경 | 없음 |

## 4. 운영 반영 절차 (Yellow 승인 게이트)

7010 포트는 production `next start`라 코드 변경 후 화면 반영하려면 build가 필요하오.

```
cd /Users/vibetj/coding/seo/frontend
npm run build
```

build 실행 자체는 Yellow lane으로 분류한다. 본 sprint는 코드 patch + typecheck PASS까지만 진행하고, build/restart는 TJ 승인 후 별도 명령으로 진행한다.

승인 문구:
```
[승인] gpt0508-34 작업3 frontend F0 build 실행:
cd /Users/vibetj/coding/seo/frontend && npm run build
실행 후 supervisor가 자동 재시작. 7010에서 Data Trust Guard 카드 4개 노출 확인.
```

## 5. 다음 patch_candidate (backend dynamic wire)

| candidate | scope | 효과 |
|---|---|---|
| dashboard route에 `bigquery_coverage` 필드 추가 | `backend/src/routes/googleAds.ts` | 정적 텍스트 → 라이브 PASS/HOLD/FAIL |
| dashboard route에 `upload_send_guard` 필드 추가 | 동상 | 정적 0건 → 실제 last_24h count |
| dashboard route에 `next_safe_action` 필드 추가 | 동상 | 정적 안내 → 운영 상태 기반 동적 CTA |

본 sprint는 정적 패치까지. 동적 wire는 다음 sprint Yellow approval로 분리.

## 6. 추천 옵션과 자신감

- 추천: **patch 그대로 commit + Yellow build 승인 요청**
- 자신감: **88%**
- 미지: 7010 production supervisor의 build 후 자동 reload 안정성, gradient 색 카드 4개가 모바일 좁은 화면에서 줄바꿈 깨짐 여부.

산출 frontend 파일: `frontend/src/app/ads/google/page.tsx` (line 927 직후 Data Trust Guard section 추가)
