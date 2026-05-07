# backend errorHandler payload hardening 운영 deploy 승인안

작성 시각: 2026-05-07 21:42 KST
대상: 운영 VM `seo-backend` (`att.ainativeos.net`) 의 `backend/src/middleware/errorHandler.ts`
문서 성격: Yellow Lane 운영 backend deploy 승인안 (코드 1파일)
관련 문서: [[paid-click-intent-502-transient-evidence-20260507]], [[paid-click-intent-pm2-restart-correlation-20260508]], [[../vm/!vm]], [[google-ads-vm-ledger-source-recovery-backend-deploy-result-20260507]]
Status: needs_human_approval (TJ YES/NO 회신 후 본 agent 즉시 deploy)
Do not use for: PM2 config 변경, max_memory_restart 변경, 운영 DB write, GTM publish, GA4/Meta/Google Ads/TikTok/Naver 전송, conversion upload, 광고 변경

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - vm/!vm.md
    - total/!total-current.md
    - gdn/!gdnplan.md
    - gdn/paid-click-intent-pm2-restart-correlation-20260508.md
  lane: Yellow for execution / Green for approval draft
  allowed_actions_now:
    - 승인 문서 작성
    - 로컬 typecheck/test
    - read-only diff 검토
  allowed_actions_after_approval:
    - 운영 VM 백업 (현재 dist/middleware/errorHandler.js)
    - 1파일 deploy (backend/src/middleware/errorHandler.ts) + build
    - PM2 restart (1회)
    - post-deploy smoke (oversized 413/400 응답 확인)
    - 실패 시 rollback (백업 파일 원복 + PM2 restart)
  forbidden_actions_until_explicit_separate_approval:
    - 다른 파일 변경
    - PM2 config 변경
    - max_memory_restart 변경
    - 운영 DB write
    - 광고 플랫폼 전송
    - GTM publish
  source_window_freshness_confidence:
    source: "backend/src/middleware/errorHandler.ts patch + 운영 backend log evidence"
    window: "2026-05-07 21:20 KST oversized 500 evidence + 21:42 KST patch"
    freshness: "본 sprint 내 직접 patch / typecheck pass"
    confidence: 0.92
```

## 5줄 결론

1. body-parser `PayloadTooLargeError`(100KB 초과)가 `errorHandler.ts`에서 인식되지 않아 generic 500으로 응답되는 backend bug 확인 (운영 log 12:20:21~12:20:26 5건).
2. 본 sprint에서 errorHandler에 `isBodyParserError` 가드 추가 — `entity.too.large` 등 body-parser 계열 에러를 status code 그대로 (대개 413) JSON 응답.
3. 변경 1파일, +14줄/-1줄. 다른 route·middleware 영향 없음. typecheck PASS.
4. rollback 단순 (백업 파일 원복 + PM2 restart). PM2 restart는 30초 주기로 어차피 발생하므로 추가 영향 없음.
5. 승인 즉시 본 agent가 deploy 후 oversized smoke로 413/400 응답 검증.

## 1. 변경 내용 요약

### before (현재 운영)

```typescript
// backend/src/middleware/errorHandler.ts (요약)
const message = err instanceof Error ? err.message : "Unknown error";
if (message.startsWith("CORS blocked:")) { ... return; }
console.error("[errorHandler] Unhandled error:", err);  // ← PayloadTooLarge 여기서 unhandled로 분류
if (isCircuitOpenError(err)) { ... return; }
res.status(500).json({ error: "internal_error", message });  // ← 500 응답
```

### after (본 patch)

```typescript
type BodyParserError = Error & { type?: string; status?: number; statusCode?: number };

const isBodyParserError = (err: unknown): err is BodyParserError => {
  if (!(err instanceof Error)) return false;
  const candidate = err as BodyParserError;
  if (typeof candidate.type === "string" && candidate.type.startsWith("entity.")) return true;
  const status = candidate.status ?? candidate.statusCode;
  return typeof status === "number" && status >= 400 && status < 500;
};

// errorHandler 안에서 CORS 블록 다음에 추가:
if (isBodyParserError(err)) {
  const candidate = err as BodyParserError;
  const status = candidate.status ?? candidate.statusCode ?? 400;
  const errorCode = candidate.type ?? "bad_request";
  res.status(status).json({ ok: false, error: errorCode, message });
  return;
}
```

## 2. 영향 범위 분석

| 영역 | 영향 | 근거 |
|---|---|---|
| paid-click-intent receiver | 120KB+ payload → 500 대신 413 응답 (정상화) | 본 evidence 직접 확인 |
| 다른 POST routes (npay-intent, attribution checkout 등) | body-parser limit 초과 시 동일하게 413 응답 (이전: 500) | 동일 errorHandler 공유 |
| 정상 4xx route handler | 영향 없음 (route handler가 자체 res.status 설정 시 errorHandler 미호출) | express middleware chain 분석 |
| CORS 블록 | 변경 없음 (early return) | patch 위치 분석 |
| Circuit breaker 503 | 변경 없음 (이후 분기) | patch 위치 분석 |
| 일반 500 internal_error | 변경 없음 (body-parser 외 모든 unknown error는 그대로 500) | isBodyParserError가 false면 fallthrough |

→ regression 위험 매우 낮음. body-parser 에러가 잘못 분류될 경우(false positive)는 status 4xx 응답이라 user-facing 영향 작음.

## 3. 검증 (deploy 전)

| 검증 | 결과 |
|---|---|
| `npm --prefix backend run typecheck` | PASS |
| 변경 file count | 1 (backend/src/middleware/errorHandler.ts) |
| `git diff --check` | PASS |
| 다른 route 테스트 회귀 | 없음 (변경 없음) |

## 4. deploy 절차 (승인 시)

```bash
# 1. taejun 경유 SSH
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94

# 2. 운영 source 백업
sudo -u biocomkr_sns bash -lc '
  cp /home/biocomkr_sns/seo/repo/backend/dist/middleware/errorHandler.js \
     /home/biocomkr_sns/seo/shared/deploy-backups/$(date +%Y%m%d-%H%M%S)_errorhandler-pre-payload-hardening.js.bak
'

# 3. 본 agent 로컬에서 scp로 1파일 전송 (또는 git pull → build)
# 옵션 A (git pull → build):
sudo -u biocomkr_sns bash -lc '
  export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
  cd /home/biocomkr_sns/seo/repo
  git fetch origin main
  git checkout origin/main -- backend/src/middleware/errorHandler.ts
  cd backend && npm run build
'

# 4. PM2 restart
sudo -u biocomkr_sns bash -lc '
  export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
  pm2 restart seo-backend --update-env
  pm2 save
'

# 5. post-deploy smoke
curl -X POST -H "Content-Type: application/json" \
  -d "$(printf '{\"google_click_id\":\"TEST\",\"intent\":\"checkout\",\"blob\":\"%s\"}' "$(printf 'x%.0s' {1..120000})")" \
  https://att.ainativeos.net/api/attribution/paid-click-intent/no-send
# 기대: HTTP 413 응답 (이전: 500)
```

## 5. rollback 절차

```bash
sudo -u biocomkr_sns bash -lc '
  cp /home/biocomkr_sns/seo/shared/deploy-backups/{TIMESTAMP}_errorhandler-pre-payload-hardening.js.bak \
     /home/biocomkr_sns/seo/repo/backend/dist/middleware/errorHandler.js
  pm2 restart seo-backend --update-env
'
```

PM2 restart는 30초 주기로 어차피 발생하므로 rollback 1회 추가 영향 사실상 없음.

## 6. 본 patch가 해결하는 것 / 해결하지 않는 것

| 항목 | 본 patch 해결? |
|---|---|
| oversized payload 500 → 413 | YES |
| body-parser 계열 SyntaxError 500 → 400 | YES (부수 효과) |
| **PM2 30초 주기 restart** | **NO** (별건, [[paid-click-intent-pm2-restart-correlation-20260508]] 참조) |
| **502 burst** | **NO** (PM2 restart 원인이 본질) |
| heap usage 94.7% | NO (별건) |
| Event Loop p95 1.8s | NO (별건) |

→ 본 patch는 **정확성 개선 + 향후 evidence 수집 정확도 개선**이 목적. 502/restart 본질은 별도 sprint.

## 7. 자신감과 리스크

| 항목 | 자신감 | 리스크 |
|---|---:|---|
| typecheck pass | 100% | - |
| 변경 영향 범위 분석 | 92% | unknown route handler가 의도적으로 500 응답하던 케이스 발견 시 회귀 가능 (확률 낮음) |
| rollback 단순성 | 95% | dist 파일 원복만 하면 됨 |
| post-deploy smoke 통과 가능성 | 90% | 본 sprint backend log에서 PayloadTooLargeError type=entity.too.large 확인됨 |
| **종합** | **92%** | - |

## 8. 승인 요청

TJ님께 다음 한 줄 회신 부탁드립니다:

- **YES**: backend errorHandler payload hardening deploy 승인 → 본 agent 즉시 절차 4 실행
- **NO**: 보류, 추가 검증 필요 사유 안내

승인 시 본 agent가 다음 순서로 진행합니다:
1. 운영 VM SSH (taejun → biocomkr_sns)
2. 운영 dist 백업
3. git pull → build (1 파일)
4. PM2 restart
5. oversized 120KB smoke로 413 응답 검증
6. 결과 보고서 작성
7. commit/push

Auditor verdict: NEEDS_HUMAN_APPROVAL
