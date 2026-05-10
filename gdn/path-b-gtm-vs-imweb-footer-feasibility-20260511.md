# Path B endpoint 호출 wiring — GTM vs imweb footer 비교 검토

작성 시각: 2026-05-11 00:35:00 KST
Lane: Green 검토 / 코드/배포 0
자신감: 88%
정정 산출물 종속: `gdn/path-b-canary-verdict-correction-20260511.md` (PATH_B_ENDPOINT_NOT_CALLED_BY_CHECKOUT_FLOW)

## 한 줄 결론

**GTM Custom HTML tag로 결제완료 trigger를 잡아 Path B no-send endpoint를 호출하는 게 가능**하오. imweb footer 직접 수정보다 Preview/version 관리가 안전하고 rollback 1회 클릭이라 우선 추천 — 다만 더 안전한 R2(backend payment-success 핸들러 자동 ledger 기록)가 가능하면 GTM도 안 건드리는 게 가장 깔끔하오.

## 평가 축

### 1. GTM Custom HTML 가능성

| 항목 | 값 |
|---|---|
| biocom GTM 컨테이너 | `GTM-W2Z6PHN` (imweb marketing 탭에서 자동 주입 — `capivm/!capiplan.md:70` 명시) |
| 결제완료 trigger 후보 | (a) URL match: `/order/order_complete` 또는 imweb 주문완료 페이지 패턴 / (b) dataLayer event: imweb이 자동 push하는 `purchase` 또는 footer funnel-capi v3가 push하는 dataLayer push / (c) form submit / (d) Custom Event |
| Tag 액션 | `fetch('https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send', { method:'POST', body: JSON.stringify({ ... hash-only material ... }) })` |
| identity material 출처 | dataLayer 또는 imweb global 변수에서 order_no / channel_order_no / email / phone — hash 변환은 backend가 받은 후 `buildOrderBridgeIdentityHmacMaterial`에서 처리(현재 endpoint가 raw input을 받아 hash-only 응답으로 변환하는 구조) |
| Preview 모드 가능 | YES — fresh workspace에서 발사 횟수/응답 직접 확인 |
| Production publish | Red Lane (별도 승인 필요, GTM workspace hygiene 규칙 적용) |
| Rollback | GTM workspace에서 이전 버전으로 복귀 1클릭 |

가능성 verdict: **YES** — 기술적으로 충분히 가능. Preview까지 Yellow, Publish는 Red.

### 2. imweb footer/header 직접 수정 가능성

| 항목 | 값 |
|---|---|
| 위치 | `footer/biocomimwebcode.md` (Line 19, 1066 — 이미 `payment_success` Block 3가 backend 호출 중) |
| 호출 추가 지점 | 기존 `payment_success` 블록(line 1619~) 안에 한 줄 추가 — `Promise.all([... existing payment-success POST..., orderBridgeNoSendPOST])` |
| 위험 | imweb footer 변경은 모든 페이지에서 즉시 동작. Preview 단계 없음. |
| Rollback | imweb 어드민에서 이전 footer 버전 복구 (스크립트 파일 또는 백업 코드). 즉시 가능하나 운영 traffic에 직접 영향 후. |

가능성 verdict: **YES — 기술적으로 가능하나 Preview 단계가 없어 GTM보다 위험**.

### 3. backend-only 해법 (R2)

| 항목 | 값 |
|---|---|
| 위치 | `backend/src/routes/attribution.ts` `payment-success` 핸들러 |
| 변경 내용 | payment-success가 받은 input(order_no/email/phone)을 `buildOrderBridgeIdentityHmacMaterial`로 hash 변환 후 `recordOrderBridgeLedger` 호출. write_flag_on=true 윈도우에서만 동작. |
| 위험 | backend deploy 필요 (Yellow). frontend (imweb/GTM) 변경 0. |
| Rollback | git revert + pm2 restart |
| Preview/Test | local fixture로 발사 시뮬레이션 가능 |

가능성 verdict: **YES — 가장 안전. frontend 흐름 변경 0**.

## 비교 표

| 축 | GTM | imweb footer | backend R2 |
|---|---|---|---|
| 변경 범위 | GTM 컨테이너 1 tag | imweb footer 코드 1 줄 | backend route 1 핸들러 |
| Preview 가능 | YES | NO | YES (fixture) |
| Rollback 시간 | 1 클릭 (GTM) | imweb 어드민 복구 | git revert + pm2 restart |
| 운영 traffic 직접 영향 | publish 후 발사 | 즉시 | deploy 후 |
| 승인 게이트 | Yellow Preview / Red Publish | Yellow imweb footer 변경 | Yellow backend deploy |
| 누가 작업 가능 | TJ (GTM UI) + Claude Code (Preview 안 옵션안) | TJ (imweb 어드민) | Claude Code 단독 (코드 patch + fixture) |
| 같은 효과 (ledger 누적) | YES | YES | YES |
| 안전성 | 중상 | 중 | 상 |

## 권장 우선순위

1. **R2 backend 자동 분기 (가장 안전, 추천)**
   - Claude Code가 코드 patch + fixture까지 단독 작성 가능
   - imweb/GTM 어디도 변경 없음
   - 자신감: 84%
   - Lane: Green code → Yellow deploy

2. **GTM Custom HTML (R2가 막힐 때)**
   - Preview에서 발사 검증 후 Publish는 Red 승인
   - imweb footer 안 건드림
   - 자신감: 80%
   - Lane: Yellow Preview → Red Publish

3. **imweb footer 직접 수정 (마지막 수단)**
   - Preview 단계 없음 / 운영 즉시 영향
   - 자신감: 70%
   - Lane: Yellow

## 사용자 명령에 대한 답

> "Imweb footer나 헤더 코드 대신, gtm 해결 가능한지 먼저 검토. 안되는 경우만 헤더 코드나 푸터 코드로 진행"

**GTM 해결 가능 — verdict: YES**. 다만 **R2(backend 자동 분기)가 가능하면 GTM도 안 건드리는 게 더 깔끔**. 의사결정 순서 추천:

1. R2를 먼저 시도 (Claude Code 단독 가능)
2. R2가 어떤 이유로 부적합하면 GTM Custom HTML로 진입
3. GTM도 막히면 그제야 imweb footer/header 진입

## 의문점 (다음 sprint 검증 필요)

- imweb이 결제완료 시점에 dataLayer push를 하는지 (확인 필요 — `dataLayer.push({event: 'purchase', ...})` 패턴 / 기존 footer funnel-capi v3 코드에서 확인)
- GTM 컨테이너 안에 이미 imweb purchase trigger가 있는지 (없으면 신규 trigger 생성 필요)
- backend payment-success 핸들러가 받는 input에 hash 변환에 충분한 identity material이 있는지 (`buildOrderBridgeIdentityHmacMaterial` 입력 키와 비교 audit 필요)

## 다음 액션

### Claude Code가 할 일 (다음 sprint 첫 작업)

1. backend payment-success 핸들러 input audit + R2 코드 patch + fixture
   - 추천: 진행 추천 / 자신감 84%
   - Lane: Green code (deploy는 별도 Yellow)
   - 의존성: 본 검토 산출물

2. (R2가 막힐 때) GTM Custom HTML tag 설계 문서 + Preview 승인안
   - 추천: 조건부 진행 / 자신감 80%
   - Lane: Yellow proposed
   - 의존성: R2 audit 후 fallback 결정

### TJ님이 할 일

- 본 검토 자체에 추가 액션 없음. R2 결정 시점에 backend deploy 1회 / R2 부적합 시 GTM Preview 1회 / 둘 다 막힐 때만 imweb footer.

## Verdict

`GTM_FEASIBLE_BUT_BACKEND_R2_PREFERRED`
