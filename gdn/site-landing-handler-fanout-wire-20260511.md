# site_landing handler fan-out wire (gpt0508-42 작업1)

작성 시각: 2026-05-11 15:30:00 KST
Lane: Green code (no deploy)

## 1. 사람이 이해하는 작업 설명

- **무엇을 했는가**: site_landing_ledger 가 실제 아임웹 유입 신호를 받도록 기존 backend handler (marketing-intent / checkout-context / payment-success / paid-click-intent no-send 분기) 4 곳에서 `recordSiteLanding` fan-out 호출을 추가. helper 모듈 `siteLandingFanout.ts` 신설 + fixture 8 건.
- **왜 했는가**: gpt0508-41 에서 site_landing_ledger schema + receiver + classifier 까지 만들었으나 **production trigger 가 없어서 ledger 가 비어 있던 상태**. 본 sprint 에서 가장 빠른 trigger 경로 (기존 attribution endpoint 4 곳) 를 wire 해 실 트래픽이 들어오기 시작하면 site_landing 이 채워지도록 함.
- **어떻게 했는가**: 새 helper `fanOutEntryToSiteLanding` 와 `fanOutPaidClickIntentPreviewToSiteLanding` 두 함수. raw click_id 는 sha256 으로 hash 변환 (storage_mode='hash'). landing URL 없으면 skip. record 실패는 throw 하지 않고 outcome 객체로 반환해 handler 본 흐름을 차단하지 않음. fixture 는 PII pattern scan 포함 8 케이스 — 모두 PASS.
- **결과가 무엇인가**: 4 handler 모두에서 site_landing_ledger 가 자동 채워질 수 있는 상태. backend deploy 후 실 트래픽이 들어오면 organic / paid / direct / referral 분포가 처음으로 자체 DB 에 쌓이기 시작. invariants (send/upload/external/GTM/footer/운영DB write 0) 모두 유지.
- **목표에 어떤 영향을 줬는가**: Track G Site Landing 62% → 78% (production wire 완비, deploy 만 남음). Track B Imweb Source Capture 62% → 75% (handler audit 완료, 자동 capture 가능). Track C builder quality 89% → 92% (cross_reference 와 site_landing 두 source 가 같은 sessionKey 로 join 가능 기반).
- **남은 병목은 무엇인가**: deploy 가 아직 안 됨 — 본 sprint 의 작업 6 deploy approval packet 으로 분리. 실측 분포는 deploy + 24h smoke 후 측정 가능.

## 2. helper 시그니처

```ts
fanOutEntryToSiteLanding(
  entry: AttributionLedgerEntry,
  sourceTag: "marketing_intent" | "payment_success" | "checkout_started"
): FanoutOutcome
```
- 입력: 기존 AttributionLedgerEntry (landing / referrer / utm* / gclid / fbclid / ttclid / gaSessionId / metadata.clientId)
- 출력: `{ ok, source, deduped, landing_id_prefix }` 또는 `{ ok:false, skipped, reason }`

```ts
fanOutPaidClickIntentPreviewToSiteLanding({
  capturedAt, landingUrl, referrer, utm, clickIds, sessionKey
}): FanoutOutcome
```

## 3. 변경 파일 + LOC

| 파일 | 종류 | LOC |
|---|---|---|
| backend/src/siteLandingFanout.ts | 신규 helper | 191 |
| backend/src/routes/attribution.ts | edit (4 call) | +25 |
| backend/tests/site-landing-fanout.test.ts | 신규 fixture | 156 |

## 4. fixture 8/8 PASS (219ms)

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | marketing_intent UTM paid → paid_social channel | PASS |
| 2 | gclid raw 입력 → sha256 hash 64 char 저장, raw 비교 ≠ | PASS |
| 3 | landing 없으면 skipped 사유 명시 | PASS |
| 4 | naver search referrer → organic_search | PASS |
| 5 | payment_success mirror | PASS |
| 6 | paid_click_intent preview gclid → hash + paid_search | PASS |
| 7 | paid_click_intent 모든 click 없음 → instagram referrer organic_social | PASS |
| 8 | DB row 전체 PII pattern scan (email/phone/jumin) 0 hit | PASS |

전체 typecheck `npx tsc --noEmit` exit 0.

## 5. 금지선 준수

| invariant | 결과 |
|---|---|
| send / actual_send / upload_candidate | false / false / 0 |
| external platform send | 0 |
| GTM Production publish | 0 |
| imweb footer / header 직접 수정 | 0 |
| 운영DB write | 0 |
| raw click_id 저장 mode | hash only (raw 모드 사용 안 함) |
| raw email/phone/order_no/payment/member_code logged or stored | 0 (regex scan 통과) |
| fan-out 실패 시 handler 본 흐름 차단 | NO (best-effort try/catch) |

## 6. 다음 액션

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 작업 2: handler 별 evidence gap audit | YES | — | 90 | 95 | 80 | 10 | 90 | 진행 |
| Claude Code | 작업 3: summary API 추가 | YES | — | 85 | 90 | 75 | 15 | 85 | 진행 |
| TJ님 | 작업 6 deploy approval | PARTIAL — Claude Code 가 packet 작성, deploy 명령은 SSH 키 + VM 접속 권한 필요 | VM `34.64.104.94` taejun 계정 + biocomkr_sns sudo 권한 + pm2 restart 권한이 TJ 환경에만 있음 | 85 | 80 | 95 | 25 | 80 | 조건부 진행 (작업 6 packet 검토 후) |

산출 JSON: `data/site-landing-handler-fanout-wire-20260511.json`
