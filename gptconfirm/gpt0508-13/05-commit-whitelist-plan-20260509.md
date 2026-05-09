# Commit whitelist plan for Path B gpt0508-13

작성 시각: 2026-05-09 18:34 KST
Status: PREPARED_NO_COMMIT

## 한 줄 결론

커밋은 아직 하지 않았다. unrelated dirty가 많아서 Path B code/test와 Path B docs/data를 whitelist 기반으로 나눠 커밋해야 한다.

## Commit 1 후보: Path B code/test/runtime

포함 후보:

- `backend/src/orderBridgeIdentityHmac.ts`
- `backend/src/orderBridgeLedger.ts`
- `backend/src/routes/attribution.ts`
- `backend/tests/order-bridge-identity-hmac.test.ts`
- `backend/scripts/path-b-gtm-controlled-traffic-preview.ts`

조건:

- `npm --prefix backend run typecheck` PASS.
- `node --import tsx --test tests/order-bridge-identity-hmac.test.ts` PASS.
- `git diff --check` PASS.

커밋 메시지 후보:

```text
backend: add path b hash-only order bridge
```

## Commit 2 후보: Path B docs/data/gptconfirm

포함 후보:

- `data/path-b-limited-storage-deploy-result-20260509.json`
- `data/path-b-gtm-preview-controlled-traffic-result-20260509.json`
- `gdn/path-b-gtm-preview-controlled-traffic-result-20260509.md`
- `gdn/path-b-scorecard-gpt0508-13-20260509.md`
- `gdn/path-b-storage-canary-main-approval-v2-20260509.md`
- `gptconfirm/gpt0508-12/`
- `gptconfirm/gpt0508-13/`

커밋 메시지 후보:

```text
docs: package path b deploy and preview evidence
```

## Optional terminology/doc commit

아래 파일은 Path B와 직접 관련은 있지만, 별도 commit으로 빼는 편이 안전하다.

- `AGENTS.md`
- `docs/report/text-report-template.md`

커밋 메시지 후보:

```text
docs: normalize vm cloud terminology
```

## 제외해야 할 unrelated dirty

이번 whitelist에 넣지 않는다.

- `backend/src/bootstrap/configureMiddleware.ts`
- `data/!channelfunnel.md`
- `data/!coffeedata.md`
- `data/!datacheckplan.md`
- `data/npay-actual-confirmed-paid-click-join-dry-run-20260508.json`
- `data/path-c-member-code-dry-run-20260508.json`
- `docurule.md`
- `gdn/path-c-*`
- `gdn/npay-*`
- `gdn/ga4-*`
- `naverapi.md`
- `tiktok/fetchresult.md`
- `total/!total-current.md`
- `agent/report-auditor-agent-*`
- `tiktok/monitoring/*`

## 아직 커밋하지 않은 이유

GTM Preview controlled traffic이 fresh workspace blocker로 끝났기 때문에, 커밋 전 TJ님이 workspace cleanup/reuse 방향을 먼저 판단하는 것이 낫다.

Auditor verdict: PASS_COMMIT_WHITELIST_PREPARED_NO_COMMIT
