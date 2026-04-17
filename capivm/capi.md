# Meta Purchase / CAPI 정합성 운영 계획

최종 업데이트: 2026-04-16 00:15 KST (교정 완료 ledger 기준 `/ads` POST 창 2026-04-13부터 사용) / §0 2026-04-15 / 원본 2026-04-12 21:52 KST

---

## 📅 2026-04-16 (내일) 할 일 — Phase 9 v3 후속 단계

> 2026-04-15 저녁 biocom footer 를 `biocom_footer_0415_final3.md` (Phase 9 v3 = fbq interceptor + eventId injector) 로 교체 완료. 단계 0 (`enableServerCapi=false`) 소크 진행 중. Console / Events Manager 검증 완료 (ViewContent eid 주입 확인, DietMealBox 포함 전 상품 페이지 커버, Purchase Guard v3 공존 확인). 내일 이어서 해야 할 2가지:

### ⏰ 옵션 2 — 단계 1 Test Events 탭 진입

- **목적**: Phase 9 서버 CAPI 를 Meta Events Manager 의 **테스트 이벤트** 탭으로만 전송해서 browser(aimweb + Phase 9 eid 주입) ↔ server(Phase 9 mirror) 쌍이 실제로 dedup 되는지 실증
- **작업**:
  1. Meta Events Manager → biocom pixel (`1283400029487161`) → 테스트 이벤트 탭에서 **테스트 이벤트 코드** 발급 (예: `TEST12345`)
  2. `biocom_footer_0415_final3.md` 의 `FUNNEL_CAPI_CONFIG` 2줄 수정:
     ```js
     enableServerCapi: true,       // false → true
     testEventCode: 'TEST12345',   // '' → 받은 코드
     ```
  3. aimweb admin 에서 footer 재배포 (또는 내가 `final3_stage1.md` 생성 가능)
  4. biocom 상품 페이지 3~5개 방문 (`/HealthFood/?idx=198`, `/DietMealBox/?idx=281`, `/subscription/?idx=443` 등)
  5. Events Manager 테스트 이벤트 탭에서 ViewContent 가 "브라우저 + 서버" 양쪽 수신 + `eid=ViewContent.<prod>.<session>` 일치 + dedup 표시 확인
- **기대 결과**: 각 상품 방문마다 Events Manager 테스트 탭에 1건씩 (not 2건) 뜸
- **24시간 관찰** 후 이상 없으면 `testEventCode: ''` 로 정식 운영 (단계 2) 진입

### ⏰ 옵션 3 — 미해결 병행 이슈 처리

#### 3-1. `VirtualAccountIssued` custom event Meta verify

- **증상**: 2026-04-15 가상계좌 테스트 주문 로그에 `fbevents.js:182 [Meta Pixel] - You are attempting to send an unverified event. The event was suppressed.` 가 등장. Purchase Guard v3 가 쏘는 `VirtualAccountIssued` 는 Meta 표준 이벤트가 아니라서 브라우저 fbq 1차 시도가 suppress 되고, Purchase Guard 의 image_fallback 2차 경로로 우회 전송 중
- **현재 상태**: 기능 동작에 문제 없음 (image fallback 이 Events Manager 까지 도달 확인). 단 1차 fbq 가 낭비되고 있음
- **해결**: Meta Events Manager → biocom pixel → **Custom Conversions 또는 Custom Events** 섹션에서 `VirtualAccountIssued` 를 custom event 로 **등록 + verify**. verify 완료 후 suppress 경고 사라지는지 재검증
- **참고**: coffee pixel (`1186437633687388`) 도 동일 작업 필요 (Purchase Guard 가 coffee 에서도 VirtualAccountIssued 발사)

#### 3-2. `AddPaymentInfo` aimweb mirror 검증

- **현상**: Events Manager 에 `AddPaymentInfo https://biocom.kr/HealthFood/?idx=386` 항목 존재 (aimweb plimweb agent 자동 발사). Phase 9 v3 의 MIRROR_EVENTS 에 AddPaymentInfo 포함시켰으나, 2026-04-15 테스트 세션에서는 `[funnel-capi] inject eid AddPaymentInfo ...` 로그가 찍히지 않음
- **가능성**:
  (a) aimweb 이 AddPaymentInfo 를 Phase 9 wrap 이전 시점에 발사 (wrap race)
  (b) aimweb 이 이 상품에 대해 AddPaymentInfo 를 쏘지 않음 (플러그인 조건부)
- **해결 절차**:
  1. 상품 페이지 진입 직후 Console 에 `window.fbq.__FUNNEL_CAPI_V3_WRAPPED__` 가 `true` 인지 확인 (wrap 완료 시점 체크)
  2. 네트워크 탭에서 `facebook.com/tr?id=...&ev=AddPaymentInfo&...` 요청이 언제 나가는지 timeline 확인
  3. Phase 9 wrap 이 해당 요청 **이전** 에 걸려있으면 정상 mirror 되어야 함. `inject eid` 로그 없으면 wrap race (a)
  4. 그 경우 Phase 9 v3.1 에서 wrap 을 head 로 이동 (또는 document.readystate 감지 후 즉시 wrap) 검토
- **참고**: coffee 쪽은 AddPaymentInfo 가 aimweb 기본 발사되지 않을 가능성. 커피 배포 후 재확인

### 오늘 (2026-04-15) 완료된 것

- ✅ `biocom footer coffee 라벨 오염 복구` (SQL 276건, 20:53 KST)
- ✅ `backend origin↔source 가드 배포` (2026-04-15 20:58 KST)
- ✅ `biocom footer v2 final2 배포` (source/measurementId fix + Phase 9 v2 dataLayer 구독)
- ✅ **`biocom footer v3 final3 배포`** (Phase 9 fbq interceptor 전환 — v2 의 HURDLERS 의존 + DietMealBox 커버리지 gap + aimweb fbq 와의 duplicate 문제 3개 동시 해결)
- ✅ Phase 9 v3 실측 검증: HealthFood (`idx=386`) + DietMealBox (`idx=282`) 양쪽에서 `eid=ViewContent.<prod>.<session>` 주입 + Events Manager URL 에 반영 + Purchase Guard v3 회귀 없음 + Meta Events Manager 수신 확인
- 🔄 **Coffee footer v3 작성 예정** — `thecleancoffee_footer_0415_final3.md` (live HTML 기반, pixelId `1186437633687388` / snippetVersion `2026-04-15-thecleancoffee-funnel-capi-v3` / 나머지 biocom v3 와 동일 구조)

---

## 0. 2026-04-15 추가 — GA4 purchase 이벤트 수정 검토 + 의견

> 이 섹션은 `data/datacheck0415.md` §7 "GA4 refund 미구현 상태"와 `어뷰저.md` §4-5 / §7을 심화 검토한 결과이오. 결론만 먼저: **A(BI 보정)를 즉시 구현 + C(MP refund)를 2주 내 구현, B(GTM 태그 조건)는 하지 말 것**. 아래에 근거와 공수를 정리.

### 0-1. 먼저 — 이전 설명 정정

어뷰저.md §4-5에서 "`backend/src/imwebAttributionSnippet.ts`가 GA4 `purchase` 이벤트를 쏜다"고 쓴 내용은 **부정확**하오. 코드(387줄 전체)를 재확인한 결과:

- Footer snippet이 하는 일은 **우리 백엔드 `/api/attribution/payment-success`에 POST**하는 것뿐. `gtag('event','purchase',...)` 호출은 **존재하지 않음**. `readDataLayerValue(['ga_session_id','client_id','user_pseudo_id'])`로 기존 값을 **읽기만** 할 뿐, 새 이벤트를 발화하지 않음.
- 실제 GA4 `purchase` 이벤트는 **biocom GTM container**에서 발화됨.
  - canonical: `GTM-W2Z6PHN`
  - support: `GTM-W7VXS4D8`
  - 근거: `backend/src/ga4Cutover.ts:100-104`, `backend/src/ga4RevenueOpsPlan.ts:137/180`에 명시.
- 타겟 GA4 property: `G-WJFXN5E2Q1` (biocom primary).

→ 즉 **GA4 purchase 수정 = 우리 snippet 수정이 아니라 biocom GTM 태그 수정 또는 서버측 refund 전송** 두 가지 경로.

### 0-2. 핵심 원칙 — `ga4RevenueOpsPlan.ts §refundCancelDesign`에 이미 결론 존재

이 프로젝트 안에 **공식 설계서**가 이미 있고, 결론이 명시되어 있음 (`backend/src/ga4RevenueOpsPlan.ts:268-295`):

> **가상계좌 미입금 취소는 엄밀히 말하면 "돈을 받았다가 돌려준 환불"이 아니라 "신청만 있었고 결제 완료는 없던 상태"에 가깝다. 그래서 미입금만료를 무조건 GA refund로 처리하면 광고 ROAS 상 과잉 환불처럼 보일 수 있다. 권장안은 미입금만료는 BI/DB의 cancel 보정으로 우선 처리하고, 실제 돈이 들어온 뒤 되돌린 건만 GA refund로 보내는 것이다.**

그리고 같은 문서 §virtualAccountPlan의 **A안 권장**:

> **"신청 완료를 purchase로 유지"**하고, 이후 미입금/취소/환불을 보정 이벤트나 DB 리포트로 뒤따라가는 구조. 이 구조의 장점은 **신청 시점 전환율을 잃지 않는 것**이다.

→ 이 설계가 2026-04-15 현재 운영의 공식 방향.

### 0-3. 현실적인 3가지 경로 비교

| 옵션 | 내용 | 장점 | 단점 | 공수 |
| ---- | ---- | ---- | ---- | ---- |
| **A. BI 보정** | `/ads` 대시보드가 GA4 gross를 표시하되, 그 아래에 "Imweb CANCEL 보정된 net"을 같이 표시. GA4 원본은 건드리지 않음. | 무료, GA4 훼손 없음, 어뷰저·미입금 반영 즉시, `ga4RevenueOpsPlan.ts` 공식 권장안과 완전 일치 | GA4 UI 직접 조회 / Meta Ads Manager 등 외부 조회 시엔 여전히 gross | **2~4시간** |
| **B. GTM 태그 조건 추가** | `GTM-W2Z6PHN` purchase 태그 트리거에 `pay_type != vbank OR payment_status = paid` 조건 추가. 가상계좌 신청 완료 시점엔 purchase를 쏘지 않음. | GA4 원본이 깨끗. Meta Ads Manager 등 외부도 정상. | **신청 기반 전환을 잃음**. `ga4RevenueOpsPlan.ts §virtualAccountPlan` A안이 명시적으로 하지 말라고 권장. 정상 가상계좌 입금자까지 누락. | 1~2시간 (GTM 편집 권한 필요) |
| **C. MP refund 서버 전송** | Toss 상태 전이 감지 → **실제 결제 후 취소**(CANCELED / PARTIAL_CANCELED)만 Measurement Protocol로 GA4에 refund 전송. `ga4RevenueOpsPlan.ts §refundCancelDesign` 전체 설계 구현. | 실제 환불만 정확히 반영. 가상계좌 미입금은 건드리지 않음(설계 권장). Meta Ads Manager 등 외부 도구까지 반영. | MP 72시간 backfill 제한. Toss 상태 변경을 감지하는 배치 필요. | **1~2일** (설계는 있음, 구현 0) |

### 0-4. 권장 결정

**A + C 둘 다 하되, B는 하지 말 것.**

- **A (BI 보정)** — 이번 주 즉시 구현. `어뷰저.md §6-1` 구현에 묶어서 `purchase-confirm-stats`의 CANCEL 서브분리를 `/ads` 카드에도 반영. 효과는 **`/ads` 대시보드 오염 즉시 제거**. 이게 우리가 **지금 당장 통제할 수 있는 레이어**.
- **C (MP refund)** — 2주 내 구현. 진짜 환불(Toss CANCELED + PARTIAL_CANCELED)만 GA4에 뒤따라가는 refund 이벤트. 이러면 **GA4 UI 기반 외부 도구까지** 취소 반영됨.
- **B (GTM 태그 조건)** — 하지 말 것. 이유:
  1. `ga4RevenueOpsPlan.ts §virtualAccountPlan` A안이 명시적으로 **"신청 완료 purchase를 유지하라"**고 권장. 신청 기반 funnel 손실이 과잉 보정보다 나쁨.
  2. 가상계좌 주문 중 **일부는 실제 입금까지 감**(어뷰저가 아닌 정상 고객). 이 경우 B는 정상 매출까지 누락.
  3. 어뷰저 차단은 GA4 레이어가 아니라 **전화번호/이름 블랙리스트 레이어(`어뷰저.md §6`)**에서 해야 함. 이쪽이 정확도가 더 높음.

### 0-5. 공수 / 우선순위

| 작업 | 공수 | 우선순위 |
| ---- | ---- | -------- |
| A. `/ads` GA4 카드 옆에 "Imweb 보정 net" + CANCEL 서브분리 노출 | 2~4시간 | **P0** |
| 어뷰저 블랙리스트 Layer 2 (`어뷰저.md §6-1`) | 반나절 | **P0** |
| C. Toss cron에서 상태 전이 diff → MP refund 전송 | 1~2일 | P1 |
| 위 3개 통합 테스트 + `/ads` staleness 배지 | 반나절 | P0 후속 |

### 0-6. 전제 조건

1. **biocom GTM 편집 권한** — 옵션 B를 하지 않기로 했으니 단기엔 불필요. C도 MP는 API secret만 있으면 되므로 GTM 권한 없어도 가능.
2. **GA4 Measurement Protocol API secret** — C 옵션 필수. GA4 admin → Data Streams → Measurement Protocol API secrets에서 생성. `backend/src/env.ts`의 `GA4_MP_API_SECRET_BIOCOM` 같은 이름으로 추가 예정.
3. **Toss 상태 전이 감지 배치** — `startBackgroundJobs.ts` 내 `syncAttributionStatusFromToss`가 이미 존재하므로, 그 결과에서 `confirmed → canceled` 전환 diff를 찾아 MP refund로 쏘는 단계를 덧붙이면 됨.

### 0-7. CAPI와의 관계 — 이미 안전함 재확인

어뷰저의 가상계좌 미입금이 **Meta CAPI / Pixel에는 영향 없음** (이 문서의 본문 "현재 결론"에서 이미 확정). 근거:

- `backend/src/metaCapi.ts:260-267` — `paymentStatus === "confirmed"`만 발화.
- `backend/src/routes/attribution.ts:585-588` — `status === "pending"`이면 `browserAction: "block_purchase_virtual_account"`.
- Toss `WAITING_FOR_DEPOSIT` 주문은 영영 `confirmed`로 승격되지 않으므로 Meta에 안 감.

**잠재 리스크 1건**: 어뷰저가 실제 입금 후 즉시 환불하는 희귀 케이스. 이건 `confirmed`까지 가므로 Browser Purchase + CAPI 발화됨. 이후 Toss `CANCELED` 전이가 GA4/CAPI에 refund로 반영되지 않으면 영구 기억.

→ **§0-4의 C 옵션(MP refund)을 구현할 때, 같은 이벤트 파이프라인에서 Meta CAPI `Refund` 이벤트**(Meta Conversions API의 `event_name='Refund'` 또는 `Purchase`의 value 음수 보정)도 함께 쏘도록 설계해야 함. 현재 실측 데이터상 "입금 후 즉시 환불" 어뷰저 케이스는 매우 드물지만(상위 10건 전부 `amount=0`), 설계 구조에는 들어가 있어야 함.

### 0-8. 한 줄 결론

**A 즉시, C 2주 내, B 하지 말 것.** 이 프로젝트의 공식 설계서(`ga4RevenueOpsPlan.ts §refundCancelDesign + §virtualAccountPlan`)가 이 방향을 명시적으로 권장하고 있고, 우리 상황(가상계좌 중심 + 어뷰저 오염)에서 원본 GA4 데이터 손실 없이 가장 빠르고 가장 정확한 경로임.

### 0-9. 참조 문서

- `data/datacheck0415.md` §7 "GA4 refund 미구현 상태"
- `어뷰저.md` §4 (레이어별 영향), §7 (ROAS 왜곡 방지 체크리스트)
- `backend/src/ga4RevenueOpsPlan.ts` §virtualAccountPlan, §refundCancelDesign, §historicalBackfill
- `backend/src/metaCapi.ts:260-267` (CAPI confirmed 필터)
- `backend/src/routes/attribution.ts:585-588` (Pixel block_purchase_virtual_account)

---

## 현재 결론

자사몰 카드 결제와 자사몰 가상계좌 미입금의 핵심 정합성 작업은 1차 완료로 본다.

```text
카드 결제 confirmed:
Browser Pixel Purchase 전송 확인
event_id = Purchase.{아임웹 order_code}
서버 판정 = confirmed / allow_purchase

가상계좌 미입금 pending:
Browser Pixel Purchase 차단 확인
VirtualAccountIssued 전송 확인
서버 판정 = pending / block_purchase_virtual_account

운영 backend:
https://att.ainativeos.net -> GCP VM backend
CAPI auto-sync ON
Attribution status sync ON
노트북 backend/tunnel 의존 제거
```

이제 이 작업의 핵심 목적은 “Meta Purchase를 실제 결제 완료 기준에 가깝게 만든다”이다. 즉, Meta ROAS 과대 원인 중 하나였던 **가상계좌 미입금 주문의 Browser Purchase 오염**은 자사몰 흐름에서 1차 차단됐다.

## 기준 스냅샷

이 문서에서 말하는 “post-server-decision-guard 이후”의 기준점은 아래 테스트가 끝난 시점부터로 잡는다.

```text
스냅샷 기록 시각: 2026-04-12 21:52 KST
운영 endpoint: https://att.ainativeos.net
origin: GCP VM backend
guard: biocom-server-payment-decision-guard v3
```

마지막 확인 주문:

| 구분 | 관측 시각 KST | 관측 시각 UTC | 주문 | Meta 이벤트 | 판정 |
| --- | --- | --- | --- | --- | --- |
| 카드 결제 confirmed | 2026-04-12 11:46:34 | 2026-04-12 02:46:34 | `o2026041258d9051379e47 / 202604127697550` | `ev=Purchase`, `eid=Purchase.o2026041258d9051379e47`, HTTP 200 | confirmed / allow_purchase |
| 가상계좌 미입금 pending | 2026-04-12 11:48:23 | 2026-04-12 02:48:23 | `o20260412cdb6664e94ccb / 202604126682764` | `ev=VirtualAccountIssued`, `eid=VirtualAccountIssued.o20260412cdb6664e94ccb`, HTTP 200 | pending / block_purchase_virtual_account |

Server CAPI 최신 확인:

| 구분 | 확인 시각 KST | 최신 CAPI 전송 시각 KST | 최신 CAPI 전송 시각 UTC | 최신 send_path | 결과 |
| --- | --- | --- | --- | --- | --- |
| `GET /api/meta/capi/log?limit=5` | 2026-04-12 21:52 | 2026-04-12 20:56:16 | 2026-04-12 11:56:16 | `auto_sync` | total 897 / success 897 / failure 0 |

운영 해석:

```text
2026-04-12 11:48 KST 이후 구간은
자사몰 카드/가상계좌 Browser Pixel 정합성 보정 이후 구간으로 분리해서 본다.
그 이전 Meta ROAS에는 가상계좌 미입금 Purchase 오염이 섞였을 가능성이 있다.
```

## ⚠️ 2026-04-15 — biocom footer "coffee 라벨" 오염 사건

본 문서의 기준 스냅샷(2026-04-12 21:52 KST) 은 **Purchase Guard v3 동작 검증** 목적이고, 그 자체는 **수정할 필요 없다**. 다만 2026-04-14 야간에 biocom footer 가 커피 라벨 버전으로 교체되면서 **attribution 원장의 `source` 컬럼이 일정 구간 오염**됐다. 이 구간은 별도로 분리해서 본다.

### 오염 창 (정본, confirmed)

```text
오염 시작 경계: 2026-04-14 21:59:35 KST  (마지막 clean biocom_imweb entry;
                                         snippetVersion=2026-04-11-checkout-started-v1)
오염 진행 구간: 2026-04-14 22:00 ~ 2026-04-15 20:17 KST
                (약 22시간, 전량 source=thecleancoffee_imweb 로 오발사)

마지막 오염 entry:  2026-04-15 20:16:52 KST
                    snippetVersion=2026-04-14-coffee-checkout-started-v1
                    landing=https://biocom.kr/shop_payment/...

클린 라벨 live 확인: 2026-04-15 20:19:14 KST
                    curl https://www.biocom.kr/ 결과에
                    source: 'biocom_imweb' x2, measurementIds: ['G-WJFXN5E2Q1'] x2,
                    snippetVersion: '2026-04-15-biocom-checkout-started-v1' x1,
                    snippetVersion: '2026-04-15-biocom-payment-success-order-code-v1' x1 확인.
                    구 "coffee" 라벨 잔존 0.

첫 클린 ledger entry: 2026-04-15 20:26:26 KST (2026-04-15T11:26:26.422Z UTC)
                     — snippetVersion=2026-04-15-biocom-checkout-started-v1
                     — landing=https://biocom.kr/shop_payment/?order_code=...
                     — 이 시각 이후 biocom_imweb source 의 ledger 기록은 완전 clean
```

### 오염 정량 (VM 원장 실측, 2026-04-15 20:55 KST 기준)

최초 샘플 200건 추정치(196건/₩10.7M)는 과소평가였음. SQL 전수 집계 결과:

| 지표 | 값 |
|---|---:|
| 오염 총 건수 | **276건** |
| ├─ checkout_started | 199 |
| └─ payment_success | 77 |
|   ├─ confirmed | 60건 / **₩19,425,804** |
|   └─ pending | 17건 / ₩0 (pending 은 amount 미기록) |
| 오염 창 안 정본 coffee 이벤트 (제외) | 16 |
| 오염 구간 | 2026-04-14 22:10 KST ~ 2026-04-15 20:16 KST (~22시간) |

### SQL 소급 복구 완료 (2026-04-15 20:53 KST)

`backend/scripts/fix-attribution-source-pollution.cjs` 로 dry-run → apply 수행:

```bash
# 백업
cp ~/seo/shared/backend-data/crm.sqlite3 ~/seo/shared/backend-data/crm.sqlite3.bak_20260415_pre_source_fix

# dry-run (276 매치 확인)
node scripts/fix-attribution-source-pollution.cjs ~/seo/shared/backend-data/crm.sqlite3 dry

# apply
node scripts/fix-attribution-source-pollution.cjs ~/seo/shared/backend-data/crm.sqlite3 apply
```

**핵심 단서**: backend `filterLedgerEntries` / `buildLedgerSummary` 는 `metadata_json.source` 에서 읽기 때문에, 단순히 top-level `source` 컬럼만 UPDATE 하면 API 가 여전히 오염된 값으로 리턴. 스크립트는 `source` 컬럼 + `metadata_json.source` 둘 다 `json_set` 으로 교체.

복구 후 소스별 분포 (API 확인):

| source | before | after | delta |
|---|---:|---:|---:|
| `biocom_imweb` | 1,661 | **1,938** | +277 (+1 는 신규 라이브 트래픽) |
| `thecleancoffee_imweb` | 408 | **132** | -276 |
| `aibio_imweb` | 20 | 20 | — |

> `thecleancoffee_imweb` 132 건은 **오염 구간 이전** 의 진짜 coffee 이벤트들. 추가로 오염 창 안 16건도 여전히 coffee 로 남아있음 (landing 이 coffee 도메인이라 정상 coffee 이벤트로 보존).

### 재발 방지 — backend origin ↔ source 정합성 가드 (2026-04-15 20:58 KST 배포)

`backend/src/routes/attribution.ts` 의 3개 POST 핸들러 (`/api/attribution/form-submit`, `/checkout-context`, `/payment-success`) 에 `enforceOriginSourceMatch(req, body, touchpoint)` 신규 함수 삽입. 동작:

- origin 화이트리스트 매핑:
  ```
  https://biocom.kr / www.biocom.kr / biocom.imweb.me  → biocom_imweb
  https://thecleancoffee.com / www / imweb.me           → thecleancoffee_imweb
  https://aibio.ai / www                                 → aibio_imweb
  ```
- 브라우저가 보낸 `body.source` 가 origin 기반 예상값과 다르면 **자동 보정** (body.source + body.metadata.source 동시 덮어쓰기)
- `source` 미설정 시에도 origin 기반으로 자동 채움
- 매 보정마다 `console.warn('[attribution-origin-guard] source 불일치 자동 보정: touchpoint=X origin=Y received=Z → W')` 로그
- 화이트리스트에 없는 origin (curl test, localhost, cron 등) 은 그대로 통과

검증 (2026-04-15 20:58 KST):
```bash
curl -X POST https://att.ainativeos.net/api/attribution/checkout-context \
  -H 'Origin: https://biocom.kr' \
  -d '{"source":"thecleancoffee_imweb","checkoutId":"test-guard-1",...}'
# → response.entry.metadata.source = "biocom_imweb" ✅
# → pm2 error log: [attribution-origin-guard] source 불일치 자동 보정 ... ✅
```

이 가드가 설치된 시점부터는 **footer 라벨이 또 오염되더라도 backend 에서 자동 교정**되므로 ledger 에 새로운 오염 entry 가 쌓이지 않는다.

### 가상계좌 주문이 오염 창을 걸쳐 있을 때 — 판정 규칙

**질문**: vbank 주문이 **오염 전에 생성**됐고, **입금은 오염 후에 들어왔다면** 해당 주문은 오염된 주문으로 봐야 하는가?

**확정 답**: **"주문 생성 시점에 footer 가 찍은 `source` 라벨" 이 유일한 판정 기준**이다. Toss 입금 시점은 무관.

이유 (footer 동작 해부):

```text
1) /shop_order 또는 /shop_payment 에서 checkout_started 이벤트 fire
   → source 라벨 = 그 시점 footer config 값
   → ledger 에 1 row 기록

2) vbank 발급 완료 → /shop_payment_complete 페이지 자동 이동
   → payment_success 이벤트 fire (브라우저 동일 세션)
   → source 라벨 = 그 시점 footer config 값 (1 번과 동일)
   → ledger 에 1 row 기록 (paymentStatus=pending)

3) 고객이 실제 입금 → Toss 서버 webhook/polling
   → backend attribution_status_sync 가 paymentStatus 를 pending → confirmed 업데이트
   → source 컬럼은 건드리지 않음

따라서 source 는 (1)/(2) 에서 고정되고, (3) 입금 확정은 source 를 바꾸지 않는다.
```

판정표:

| 케이스 | 주문 생성 시각 | 입금 확정 시각 | ledger.source | 판정 |
|---|---|---|---|---|
| A | **오염 전** (≤ 2026-04-14 21:59:35 KST) | 오염 전 | `biocom_imweb` | 🟢 clean |
| B | **오염 전** | 오염 중 | `biocom_imweb` | 🟢 clean (source 는 생성 시점 고정) |
| C | **오염 전** | 오염 후 (≥ 2026-04-15 20:17 KST) | `biocom_imweb` | 🟢 clean |
| D | **오염 중** (2026-04-14 22:00 ~ 2026-04-15 20:17 KST) | 오염 중 | `thecleancoffee_imweb` | 🔴 polluted |
| E | **오염 중** | 오염 후 | `thecleancoffee_imweb` | 🔴 **polluted** (←질문에 해당하는 경우) |
| F | **오염 후** (≥ 2026-04-15 20:17 KST) | — | `biocom_imweb` | 🟢 clean |

**질문의 정반대 케이스** (오염 전 생성 + 오염 후 입금, 케이스 C) 는 **clean 으로 유지** 됨 — source 가 이미 정상 값으로 고정되어 있어 입금 시점이 오염 창을 지나가도 아무 영향 없음.

**질문 자체가 가리키는 케이스** (오염 중 생성 + 오염 후 입금, 케이스 E) 는 **polluted**. footer 가 오염 창 안에서 fire 됐기 때문에 source 는 이미 `thecleancoffee_imweb` 로 박혔고, 이후 입금이 fix 후에 들어와도 ledger 에 새로운 row 가 추가되지 않고 **기존 row 의 paymentStatus 만 pending → confirmed** 로 바뀔 뿐이다. source 는 손대지 않는다.

### 소급 복구 — 케이스 D/E 는 reclassify 로 복원 가능

다행히 ledger 의 `landing` / `referrer` 컬럼에 `https://biocom.kr/...` 이 그대로 박혀 있어서 SQL UPDATE 로 일괄 재분류 가능:

```sql
-- dry-run
SELECT COUNT(*), MIN(logged_at), MAX(logged_at)
FROM attribution_ledger
WHERE source = 'thecleancoffee_imweb'
  AND (landing LIKE 'https://biocom.kr%'
    OR landing LIKE 'https://www.biocom.kr%'
    OR referrer LIKE 'https://biocom.kr%'
    OR referrer LIKE 'https://www.biocom.kr%')
  AND logged_at >= '2026-04-14T12:59:35.000Z'  -- 마지막 clean + 1초
  AND logged_at <= '2026-04-15T11:16:52.279Z'; -- 마지막 오염 + 0초
-- 기대: 200~300건+ (biocomcodemanual.md 샘플 196건 기준, 실제는 더 많을 수 있음)

-- 실행 (TJ 승인 후)
BEGIN;
UPDATE attribution_ledger
SET source = 'biocom_imweb'
WHERE source = 'thecleancoffee_imweb'
  AND (landing LIKE 'https://biocom.kr%'
    OR landing LIKE 'https://www.biocom.kr%'
    OR referrer LIKE 'https://biocom.kr%'
    OR referrer LIKE 'https://www.biocom.kr%')
  AND logged_at >= '2026-04-14T12:59:35.000Z'
  AND logged_at <= '2026-04-15T11:16:52.279Z';
COMMIT;
```

- metadata_json 내부의 `source` / `snippetVersion` 필드는 **감사 추적 보존용으로 유지** (덮어쓰지 말 것)
- UPDATE 는 VM 의 `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3` 에서 실행. 실행 전 반드시 WAL 체크포인트 + 파일 백업
- 실행 후 `GET /api/attribution/ledger?source=thecleancoffee_imweb` 결과가 "pre-2026-04-14 정상 coffee + 2026-04-15 20:17 이후 신규 coffee" 만 남는지 확인

### 기준 스냅샷 사용 지침 (업데이트)

| 분석 목적 | 권장 구간 |
|---|---|
| post-server-decision-guard v3 동작 검증 (원래 목적) | `2026-04-12 21:52 ~ 2026-04-14 21:59 KST` (48시간 clean) 또는 `2026-04-15 20:17 KST 이후` (fix 후 clean) |
| biocom vs coffee store 단위 매출 분해 | 오염 창 `2026-04-14 22:00 ~ 2026-04-15 20:17 KST` 제외, 또는 위 SQL 복구 실행 후 전구간 사용 |
| Meta ROAS vs Attribution ROAS 대조 | **복구 완료된 VM ledger/API 기준은 2026-04-13부터 사용 가능**. raw DB dump, 외부 export, 복구 전 캐시만 볼 때는 오염 창 제외 |
| 신규 기준 스냅샷 "post-source-label-fix" | 운영 모니터링용 별도 앵커. `/ads`의 바이오컴 ROAS 수렴 카드는 SQL 교정된 VM ledger 를 쓰므로 원래 post-CAPI full-day 시작일인 `2026-04-13 KST`부터 비교 |

---

## 왜 필요한가

기존 문제는 단순했다.

```text
Meta Browser Pixel:
주문완료 페이지에 도착하면 가상계좌 미입금도 Purchase로 볼 수 있음

우리 Attribution ROAS:
confirmed 주문, 즉 카드 승인 또는 가상계좌 입금 확인이 끝난 주문만 매출로 봄
```

그래서 가상계좌 미입금이 Browser Purchase로 잡히면 Meta ROAS는 높아지고, 내부 Attribution ROAS와 차이가 커진다. 이 차이는 attribution window 차이와 별개로 “이벤트 정의가 다름”에서 생기는 구조적 문제다.

## 현재 적용된 방향

주문완료 페이지에서 브라우저가 결제 상태를 추측하지 않는다. 서버에 묻고, 서버가 결제 상태를 판정한다.

```text
주문완료 URL의 order_no / order_code / payment_code / paymentKey
-> https://att.ainativeos.net/api/attribution/payment-decision 조회
-> 서버가 Toss API + 로컬 Attribution 원장 기준으로 결제 상태 판정
-> confirmed면 Browser Purchase 허용
-> pending 가상계좌면 Purchase 차단 후 VirtualAccountIssued 전송
-> canceled/unknown이면 Purchase 차단 또는 보수 이벤트로 분리
```

현재 `att.ainativeos.net`는 VM에서 동작한다. 노트북이 잠자기 모드여도 endpoint와 CAPI auto-sync는 계속 돈다.

## 완료된 것

### 1. 서버 endpoint 안정화

완료:

```text
GET https://att.ainativeos.net/api/attribution/payment-decision
```

확인값:

```text
order_no=202604126682764
order_code=o20260412cdb6664e94ccb
decision.status=pending
decision.browserAction=block_purchase_virtual_account
matchedBy=toss_direct_order_id
```

운영 health:

```text
https://att.ainativeos.net/health
status=ok
backgroundJobs.capiAutoSync.enabled=true
backgroundJobs.attributionStatusSync.enabled=true
backgroundJobs.cwvAutoSync.enabled=false
```

### 2. VM active origin 전환

완료:

```text
VM: instance-20260412-035206
Zone: asia-northeast3-a
External IP: 34.64.104.94
Process: PM2 seo-backend + seo-cloudflared
Tunnel: att.ainativeos.net -> VM localhost:7020
```

로컬 노트북의 `backend:7020`, `cloudflared`, `ngrok` 프로세스는 종료 확인됐다. 따라서 현재 CAPI sync가 노트북과 VM에서 동시에 도는 상태는 아니다.

상세 배포 문서:

- [vmdeploy.md](/Users/vibetj/coding/seo/capivm/vmdeploy.md)

### 3. 자사몰 카드 결제 확인

최종 확인 주문:

```text
order_code=o2026041258d9051379e47
order_no=202604127697550
payment_code=pa2026041212316cefc7e1c
```

확인값:

```text
Meta request: ev=Purchase
Status: 200 OK
event_id: Purchase.o2026041258d9051379e47
value: 39000
currency: KRW
payment_decision_status: confirmed
payment_decision_reason: toss_direct_api_status
```

판정:

```text
카드 confirmed 주문은 Browser Purchase가 정상 발화한다.
```

### 4. 자사몰 가상계좌 미입금 확인

최종 확인 주문:

```text
order_code=o20260412cdb6664e94ccb
order_no=202604126682764
payment_code=pa20260412ae31f94d1edab
```

확인값:

```text
Meta request: ev=VirtualAccountIssued
Status: 200 OK
event_id: VirtualAccountIssued.o20260412cdb6664e94ccb
value: 35000
currency: KRW
payment_decision_status: pending
payment_decision_reason: toss_direct_api_status
original_purchase_event_id: Purchase.o20260412cdb6664e94ccb
```

판정:

```text
가상계좌 미입금 주문은 Browser Purchase로 잡히지 않고 VirtualAccountIssued로 내려간다.
```

### 5. Server CAPI 정책

현재 원칙:

```text
confirmed 주문만 Server CAPI Purchase 전송
pending 가상계좌는 Server CAPI Purchase 전송 제외
Purchase event_id = Purchase.{아임웹 order_code} 우선
```

최신 CAPI log endpoint:

```text
GET https://att.ainativeos.net/api/meta/capi/log?limit=5
```

최근 확인값:

```text
total=897
success=897
failure=0
latest send_path=auto_sync
latest timestamp=2026-04-12T11:56:16.685Z
latest timestamp KST=2026-04-12 20:56:16
```

## 아직 남은 것

### 1. 가상계좌 입금 후 confirmed 전환 테스트

아직 확인하지 않은 중요한 케이스가 있다.

```text
가상계좌 발급 직후:
pending
Browser Purchase 없음
VirtualAccountIssued 있음

실제 입금 후:
confirmed로 전환되어야 함
Server CAPI Purchase가 1회 전송되어야 함
Browser Purchase는 추가로 만들 수 없으므로 서버 CAPI가 정식 Purchase 역할을 해야 함
```

필요한 이유:

```text
지금까지는 "미입금 가상계좌가 Meta Purchase를 오염시키지 않는지"를 검증했다.
하지만 실제 입금 완료 후에는 정식 매출이므로 Attribution confirmed와 Server CAPI Purchase에 반영되어야 한다.
이 전환이 안 되면 Meta ROAS는 과대가 아니라 과소로 흔들릴 수 있다.
```

검증 대상 주문:

```text
order_code=o20260412cdb6664e94ccb
order_no=202604126682764
payment_code=pa20260412ae31f94d1edab
order_id=202604126682764-P1
현재 상태=pending / VirtualAccountIssued 확인 완료
```

검증 순서:

```text
1. TJ님이 해당 가상계좌 주문을 실제 입금 처리한다.
2. Toss 또는 아임웹에서 결제 상태가 DONE/paid/confirmed로 바뀌는지 확인한다.
3. backend의 attribution status sync가 원장을 pending에서 confirmed로 바꾸는지 확인한다.
4. CAPI auto-sync가 해당 주문을 Server Purchase로 1회 보내는지 확인한다.
5. event_id는 Purchase.o20260412cdb6664e94ccb 형태인지 확인한다.
6. 같은 주문에 서로 다른 Purchase event_id가 생기지 않는지 확인한다.
```

완료 기준:

```text
Attribution status=confirmed
Server CAPI ev=Purchase
event_id=Purchase.o20260412cdb6664e94ccb
send_path=auto_sync
response_status=200
중복 event_id 위험 없음
```

이 테스트는 TJ님이 실제 입금을 해야 시작할 수 있다. 입금 전까지는 제가 로그만 봐도 confirmed 전환을 만들 수 없다.

### 2. 네이버페이

네이버페이는 이번 자사몰 Browser Pixel guard와 별개 문제다.

테스트 결과:

```text
네이버페이 주문번호: 2026041289545040
최종 URL: https://orders.pay.naver.com/order/result/mall/2026041289545040
Pixel Helper: No Pixels found on this page
Network ev=Purchase: 없음
```

판정:

```text
네이버페이는 Browser Pixel로 해결하지 않는다.
결제 완료 후 biocom.kr 주문완료 페이지로 돌아오지 않으면 우리 헤더/푸터 코드가 실행되지 않는다.
따라서 네이버페이는 Server CAPI confirmed-only 경로로 별도 처리해야 한다.
```

다음에 할 일:

```text
1. 아임웹 주문 API 또는 로컬 주문 캐시에서 네이버페이 주문이 confirmed로 잡히는지 확인
2. 네이버페이 주문의 안정 키를 정함
3. CAPI auto-sync 대상에 네이버페이 confirmed 주문 포함
4. 가능하면 아임웹/네이버페이 설정에서 결제 완료 후 biocom.kr returnUrl 지원 여부 확인
```

지금 바로 할 필요는 낮다. 네이버페이 비중과 확인 가능한 주문 상태를 먼저 봐야 한다.

### 3. 24시간 운영 모니터링

자사몰 카드/가상계좌 단건 테스트는 통과했다. 다음은 반복 테스트가 아니라 실제 운영 로그 확인이다.

볼 것:

```text
1. 가상계좌 pending이 Server CAPI Purchase로 나가지 않는지
2. Browser Purchase가 confirmed 주문 위주로 남는지
3. VirtualAccountIssued가 필요 이상으로 많이 쌓이지 않는지
4. payment-decision unknown 비율이 높은지
5. CAPI failure가 없는지
6. 같은 order_code에 서로 다른 Purchase event_id가 생기지 않는지
```

### 4. ROAS 비교 구간 분리

2026-04-12 guard + VM 컷오버 이후 구간은 이전 구간과 분리해서 봐야 한다.

```text
pre-guard:
가상계좌 미입금 Browser Purchase 오염 가능
노트북/tunnel 운영 의존 가능

post-server-decision-guard:
자사몰 confirmed/pending 분리
VM active origin
CAPI/Attribution 자동 sync 안정화
```

앞으로 Meta ROAS와 Attribution ROAS의 차이를 다시 볼 때는 최소 24시간, 가능하면 7일을 `post-server-decision-guard` 구간으로 따로 잘라 본다.

## TJ님이 지금 할 일

지금 당장 필수로 해야 할 일은 하나만 있다.

하면 좋은 일은 아래 정도다.

```text
1. 위 가상계좌 테스트 주문을 실제 입금 처리
2. 입금 완료 시각을 기록
3. 아임웹 헤더 상단 코드가 현재 서버형 guard 최신본인지 유지
4. 추가 테스트 주문 남발하지 않기
5. 네이버페이 설정 화면에서 결제 완료 후 returnUrl/복귀 URL 설정이 있는지만 나중에 확인
6. VM 비용/인스턴스가 계속 켜져 있어도 되는지 운영 관점에서 승인
```

현재 단계에서 TJ님이 직접 할 가능성이 큰 작업은 가상계좌 입금 처리다. 이건 실제 결제 상태 전환이 필요한 테스트라서 로컬 코드만으로 대체할 수 없다.

## 내가 다음에 할 일

우선순위는 아래다.

```text
1. 가상계좌 입금 후 해당 주문이 confirmed로 전환되는지 확인
2. 전환 후 Server CAPI Purchase가 1회 전송되는지 확인
3. 24시간 운영 로그 기준으로 post-guard CAPI/Purchase 정합성 리포트 생성
4. unknown decision 비율 확인
5. 네이버페이 주문이 local imweb_orders / Attribution ledger / CAPI 후보에 어떻게 잡히는지 분석
6. data/roasphase.md에 post-server-decision-guard 구간을 반영
7. 필요하면 /ads 또는 내부 진단 화면에 decision unknown / VirtualAccountIssued 지표 추가
8. `VirtualAccountIssued` custom event 의 fbq 관측 실패 → image fallback 중복 노출 정책 결정
   - biocom/coffee footer 의 Purchase Guard 코드는 동일하고, Phase 9 mirror 는 `VirtualAccountIssued` 를 mirror 하지 않음
   - 커피에서 보인 2개 프레임(Window fbq + IFrame image fallback)은 같은 `event_id` 를 쓰는 guard fallback 경로이며, ROAS 오염 원인은 아님
   - biocom 에서 1회처럼 보인 것은 해당 세션의 `observePixelNetwork` 가 Meta pixel request 를 관측했기 때문. biocom 도 관측 실패 시 같은 fallback 경로로 갈 수 있음
   - 후속 판단: Events Manager 최종 dedup/count 를 확인한 뒤, custom event 에 한해 (a) 현행 유지+문서화, (b) observe window 연장, (c) fbq 호출 성공 후 fallback 비활성 중 하나를 공통 패치로 선택
```

## 지금 하지 않을 것

- 가상계좌 테스트 주문 반복 생성
- 카드 테스트 주문 반복 생성
- 네이버페이를 Browser Pixel로 억지 해결
- Meta Events Manager UI에 오래 매달리기
- 운영 DB 스키마 변경
- 운영 DB 직접 수정
- `meta/metareport.md` 추가 수정
- VM backend를 Next.js로 전환

## 완료 기준

Meta Purchase 1차 정합성은 아래 기준으로 완료 처리한다.

```text
자사몰 가상계좌 미입금:
Browser Purchase 없음
VirtualAccountIssued 있음

자사몰 카드 결제:
Browser Purchase 있음
event_id = Purchase.{order_code}

Server CAPI:
confirmed만 Purchase
event_id = Purchase.{order_code}

가상계좌 입금 완료:
pending -> confirmed 전환 확인
Server CAPI Purchase 1회 전송 확인
event_id = Purchase.{order_code}

인프라:
att.ainativeos.net이 VM backend로 응답
노트북/tunnel 의존 없음
```

네이버페이는 별도 Phase로 둔다. 네이버페이가 완료되지 않았다고 해서 자사몰 카드/가상계좌 Purchase guard 완료를 미완료로 되돌리지는 않는다.

## 관련 파일

- [VM 배포 결과](/Users/vibetj/coding/seo/capivm/vmdeploy.md)
- [네이버페이 검토](/Users/vibetj/coding/seo/capivm/naverpay.md)
- [서버형 Guard v3](/Users/vibetj/coding/seo/footer/header_purchase_guard_server_decision_0412_v3.md)
- [CAPI 3차 결과](/Users/vibetj/coding/seo/capivm/capi3reply.md)
- [CAPI 4차 결과](/Users/vibetj/coding/seo/capivm/capi4reply.md)
- [ROAS Phase](/Users/vibetj/coding/seo/data/roasphase.md)
