# Frontend Data Trust Guard NPay actual 동적 wire (gpt0508-36)

작성 시각: 2026-05-11 00:01:00 KST
실행 상태: code patch + frontend typecheck PASS + production build PASS
자신감: 90% (live dashboard 응답이 deploy 후에야 카드 노출, 그전에는 안전 fallback)

## 한 줄 결론

`/ads/google` 페이지의 Data Trust Guard 정적 카드 4개 아래에, **dashboard 응답에 `npayActualCorrection.npayActualWireStatus === "wired_from_pg_snapshot"`이 들어올 때만 노출되는 NPay actual 보정 카드 4개**를 동적으로 wire 했소. backend deploy 전에는 fallback으로 자동 숨김(빈 화면)이라 안전하오. typecheck PASS + 빌드 PASS, write/send/upload 버튼은 추가하지 않았소.

## 1. 새 동적 카드 4개

dashboard 응답이 `wired_from_pg_snapshot` 상태로 들어올 때만 노출:

| 카드 | 표시 |
|---|---|
| 운영 PG NPay 결제완료 | `{count}건 / ₩{revenue}` |
| 현재 internal ROAS | `{internalConfirmedRoasCurrent}x` (NPay 합류 전) |
| NPay 합류 후 internal ROAS | `{internalConfirmedRoasWithNpayActualPg}x` (분자 +NPay revenue) |
| Google Ads 광고 floor (exact evidence) | `{googleAdsBudgetFloorNpayExactCount}건 / upload 후보 0` |

상단 안내 한 줄: “NPay actual은 internal 매출 풀에 합류시키는 보정값이오. exact evidence 없는 row는 Google Ads 덕으로 보지 않으며, upload 후보는 항상 0이오.”

## 2. 안전성

| 항목 | 보장 |
|---|---|
| backend deploy 전 dashboard 응답에 `npayActualCorrection`이 없을 때 | 카드 자동 숨김 (조건부 렌더) |
| `npayActualWireStatus`가 `wired_from_pg_snapshot`이 아닐 때(`missing_snapshot_input` / `snapshot_zero_or_unconfigured` / `snapshot_error`) | 카드 자동 숨김 |
| write/send/upload 버튼 | 추가 0 |
| dashboard read-only API만 호출 | 동일 (변경 없음) |
| platform send | 0 |

## 3. 코드 변경

| 파일 | 변경 | LOC |
|---|---|---|
| `frontend/src/app/ads/google/page.tsx` | 타입 `GoogleAdsNpayActualCorrection` 추가 + dashboard response 타입 확장 + 조건부 렌더 카드 4개 | +85 |

## 4. 검증

| 검증 | 결과 | 명령 |
|---|---|---|
| frontend typecheck | PASS | `npx tsc --noEmit` |
| frontend production build | PASS | `npm run build` (Next.js 16 / Turbopack) |
| `/ads/google` 라우트 prerender | PASS (정적 산출물 갱신) | build 출력 트리 |
| backend code 변경 | 0 (작업 4와 분리) | — |
| 외부 dependency 추가 | 0 | — |
| platform send | 0 | — |
| write/upload 버튼 추가 | 0 | — |

## 5. 운영 7010 반영 절차 (TJ 액션)

build 산출물은 로컬 `frontend/.next`에 갱신됐고, **운영 7010 반영은 별도 deploy 필요**(VM 안의 frontend는 SSH/rsync로 갱신).

```bash
# 로컬 → VM rsync (vm/!vm.md 4.1 절차)
cd /Users/vibetj/coding/seo/frontend
tar czf - --exclude=node_modules --exclude=.next --exclude=.DS_Store . \
  | ssh taejun@34.64.104.94 "rm -rf /tmp/seo-frontend-new && mkdir -p /tmp/seo-frontend-new && tar xzf - -C /tmp/seo-frontend-new"
# VM에서 build + restart
ssh taejun@34.64.104.94 "sudo -u biocomkr_sns bash -lc '
  cd /home/biocomkr_sns/seo/repo/frontend
  npm ci --no-audit --no-fund
  npm run build
  pm2 restart seo-frontend
'"
```

본 sprint는 deploy 안 함. Yellow 승인 후 별도 진행.

## 6. 다음 액션

### Claude Code가 할 일

1. (의존성: 작업 4 backend deploy + 작업 5 frontend deploy) live `/ads/google` 페이지에서 NPay 보정 카드 4개 노출 확인 read-only.
   - 추천: 진행 추천 / 자신감 88%
   - Lane: Green

### TJ님이 할 일

1. (Yellow 승인) backend 먼저 deploy → frontend deploy 순서로 진행.
   - 추천: 진행 추천 / 자신감 85%
   - Lane: Yellow
   - 어디에서: VM SSH (vm/!vm.md 절차)
   - 성공 기준: `curl https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_30d | jq .npayActualCorrection` 응답 확인 + 7010 화면에서 "NPay actual 보정" 섹션 노출
   - 실패 시 해석: backend pm2 logs / frontend build error → rollback `git checkout babf422 -- backend/src/routes/googleAds.ts && pm2 restart`

## 7. Verdict

`PASS_FRONTEND_TYPECHECK_BUILD_DEPLOY_PENDING_TJ_YELLOW`
