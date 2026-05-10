# Google Ads dashboard NPay actual ROAS 필드 추가 (gpt0508-36)

작성 시각: 2026-05-10 23:55:00 KST
실행 상태: backend code patch + typecheck PASS / live 응답 검증은 deploy 후
자신감: 87%

## 한 줄 결론

`/api/google-ads/dashboard` 응답에 `npayActualCorrection` 객체(10필드 + warnings)를 추가했고 typecheck PASS. 운영 VM backend는 빌드 산출물(`dist/server.js`)을 쓰므로 deploy가 별도 sprint에서 수행돼야 live 응답에 새 필드가 보이오. 본 sprint는 코드 patch까지.

## 1. 추가된 응답 필드

| 필드 | 의미 |
|---|---|
| `windowDays` | datePreset에 맞춘 7/14/30/90 |
| `npayActualConfirmedPgCount` | 운영 PG 카운트 (last_30d면 209) |
| `npayActualConfirmedPgRevenueKrw` | 양수 amount 총합 (last_30d면 ₩37,638,900) |
| `internalConfirmedRevenueCurrentKrw` | 기존 internal.summary.confirmedRevenue |
| `internalConfirmedRevenueWithNpayActualPgKrw` | + NPay actual snapshot total |
| `internalConfirmedRoasCurrent` | 보정 전 |
| `internalConfirmedRoasWithNpayActualPg` | 보정 후 |
| `npayActualWireStatus` | `wired_from_pg_snapshot` / `missing_snapshot_input` / `snapshot_zero_or_unconfigured` / `snapshot_error` |
| `googleAdsBudgetFloorNpayExactCount` | 9 (gpt0508-35 audit 기준 고정값, ledger lookup wire 후 자동 갱신) |
| `uploadCandidateCount` | **0 (invariant)** |
| `warnings` | NPay actual은 매출 풀이지 upload 후보 아님 외 안내 |

## 2. 코드 변경

| 파일 | 변경 | LOC |
|---|---|---|
| `backend/src/routes/googleAds.ts` | import + 4 helpers + dashboard 응답 추가 | +105 |

기존 `internal` 응답은 그대로 유지, 새 `npayActualCorrection`은 별도 키로 분리. platform_roas_reference도 변경 없음.

## 3. 예상 live 응답 (last_30d, deploy 후)

```json
{
  "npayActualCorrection": {
    "windowDays": 30,
    "npayActualConfirmedPgCount": 209,
    "npayActualConfirmedPgRevenueKrw": 37638900,
    "internalConfirmedRevenueCurrentKrw": 6493020,
    "internalConfirmedRevenueWithNpayActualPgKrw": 44131920,
    "internalConfirmedRoasCurrent": 0.2744,
    "internalConfirmedRoasWithNpayActualPg": 1.8647,
    "npayActualWireStatus": "wired_from_pg_snapshot",
    "googleAdsBudgetFloorNpayExactCount": 9,
    "uploadCandidateCount": 0,
    "warnings": ["..."]
  }
}
```

## 4. 검증

| 검증 | 결과 |
|---|---|
| backend typecheck (`npx tsc --noEmit`) | PASS |
| local 7020 smoke 호출 | TIMEOUT (Google Ads API 자격증명/네트워크 — local 환경 한정. code path는 deploy 후 운영 backend에서 검증) |
| send_candidate / actual_send_candidate / upload_candidate | false / false / 0 |
| 운영DB write | 0 |
| platform actual send | 0 |

## 5. deploy 상태

| 항목 | 값 |
|---|---|
| VM backend deploy 본 sprint 실행 | ❌ |
| 보류 사유 | 본 sprint 승인 범위 밖 (Yellow) |
| 다음 sprint 승인 문구 | `[승인] gpt0508-37 backend deploy: capivm/deploy-backend-rsync.sh 또는 동등 절차로 backend dist/server.js 갱신, /api/google-ads/dashboard 새 npayActualCorrection 필드 응답 확인, write/send 0 invariant 유지.` |

## 6. 다음 액션

### Claude Code가 할 일

1. (의존성: 본 sprint 산출물) frontend Data Trust Guard 카드 4개를 정적 → 동적 props로 wire — 작업 5에서 진행. 단, dashboard 응답이 deploy 안 된 상태라 frontend가 fallback 정적 텍스트로 동작해야 안전.

### TJ님이 할 일

1. (다음 sprint) Yellow 승인 후 backend deploy 실행 — 코드는 이미 commit돼 있음.
   - 추천: 진행 추천
   - 자신감: 85%
   - Lane: Yellow
   - 무엇을: `capivm/deploy-backend-rsync.sh` 또는 SSH 경로로 dist 갱신 후 pm2 restart seo-backend
   - 성공 기준: `curl https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_30d | jq .npayActualCorrection` 에 새 필드 노출
   - 실패 시 해석: pm2 logs seo-backend 에서 에러 트레이스, rollback `git checkout babf422 -- src/routes/googleAds.ts && pm2 restart`

## 7. Verdict

`PASS_BACKEND_PATCH_TYPECHECK_LIVE_VERIFICATION_PENDING_DEPLOY`

산출 JSON: `data/google-ads-dashboard-npay-actual-roas-fields-20260511.json`
