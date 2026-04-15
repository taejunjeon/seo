# Revenue CRM/실험 로드맵

기준일: 2026-03-27 (최종 업데이트: 2026-04-14 #34 — 커피 Purchase Guard v3 + Footer tracking v1 실전 통과 + Google Ads 계정 **3종 공존** 실측 발견 (`AW-10965703590` 커피 primary · `AW-304339096` biocom+커피 장바구니 **공유** · `AW-10976547519` AIBIO))

> 이 문서는 **Phase별 요약**만 담는다. 각 Phase의 상세 내역은 개별 문서를 참조.
>
> 원본 전체 로드맵: `roadmap0327_full_backup_0403.md` (2,480줄)
>
> Meta ROAS / Attribution ROAS 정합성 판단은 [data/roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md)를 현재 source로 본다. 앞으로 Meta ROAS headline은 `1d_click` 기준으로 읽고, Meta default는 Ads Manager parity 참고값으로만 둔다. 자사몰 Purchase/CAPI 정합성 작업은 [capivm/capi.md](/Users/vibetj/coding/seo/capivm/capi.md), VM active origin 배포 상태는 [capivm/vmdeploy.md](/Users/vibetj/coding/seo/capivm/vmdeploy.md), 프론트엔드의 로컬↔VM 백엔드 전환 검토는 [capivm/vm최신화.md](/Users/vibetj/coding/seo/capivm/vm최신화.md)를 source로 본다. 리인벤팅 W7 제거 검증은 [data/redelete.md](/Users/vibetj/coding/seo/data/redelete.md)를 source로 본다.

---

## 전체 Phase 진행 현황

| Phase | 제목 | 완료 | 상세 문서 | 핵심 산출물 |
|-------|------|------|----------|-----------|
| **P0** | 구조 고정 · 데이터 계약 | **100%** | [phase0.md](phase0.md) | customer_key, 이벤트 명세, ontology |
| **P1** | CRM 실험 원장 MVP | **100%/90%** | [phase1.md](phase1.md) | 실험 장부, status-aware attribution ledger, live row + UTM |
| **P1.5** | AIBIO 광고 최적화 | **90%/진행중** | [../aibio/aibio.md](../aibio/aibio.md) | GTM 정리, Meta/Google/당근 광고 계획, 50명 유입 목표 |
| **P2** | 상담 원장 · 상담사 가치 | **100%** | [phase2.md](phase2.md) | callprice API 10개, /callprice 대시보드 |
| **P2.5** | 프리-구매 리드 마그넷 | **10%** | [phase2_5.md](phase2_5.md) | 진단형 퀴즈 설계 |
| **P3** | 실행 채널 연동 | **85%** | [phase3.md](phase3.md) | S1~S3 완료, S4 발송 UI 75%, **S5 커피 재구매 관리 80%**, **S6 SMS 발송 70%**. 아임웹 캠페인 분석 완료 → SMS fallback 기회 확인 |
| **P4** | 재구매 코호트 · 북극성 | **95%** | [phase4.md](phase4.md) | 90일 재구매 순매출 ₩45M, /cohort 대시보드 |
| **P5** | Meta 광고 데이터 연동 | **100%** | [phase5.md](phase5.md) | ✅ S1 백엔드 + S2 대시보드 + **S3 CAPI 운영 전환 완료 (0405)**. 125건 실전 전송 성공 |
| **★ P5.5** | **ROAS/iROAS 모니터링 대시보드** | **100% + 정합성 검증 진행** | [phase5_5.md](phase5_5.md) | ✅ S1 ROAS 백엔드 + S2 대시보드 + **S3 iROAS 엔진** 완료. 운영 판단은 [roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md)의 Meta/Attribution 정합성 체크 기준을 따른다 |
| **P6** | 카카오 CRM 실행 레이어 | **0%** | [phase6.md](phase6.md) | 카카오 고객파일, 발송 로그 |
| **P7** | 1차 증분 실험 라이브 | **0%** | [phase7.md](phase7.md) | iROAS 첫 산출, checkout abandon 실험 |
| **P8** | UX 정성 데이터 · 도구 판단 | **0%** | [phase8.md](phase8.md) | Hotjar/BigQuery 도입 판단 |
| **P9** | AI Agent 고도화 | **0%** | [phase9.md](phase9.md) | 제1원칙 CSO, 피드백 루프, Evolve |

---

## 우선순위 실행 순서 (0405 업데이트)

```
✅ 완료 (0404~0405)
├── P5 전체 완료: S1 백엔드 + S2 대시보드 + S3 CAPI 운영 전환 (125건)
├── P5.5 전체 완료: S1 ROAS 백엔드 + S2 /ads/roas 대시보드 + S3 iROAS 엔진
├── P3-S5 커피 재구매 관리: 후보 1,049명, 프론트 UI 가동
├── P3-S6 SMS 발송: 채널 토글 + 080 수신거부 + fallback
└── GA4 3사이트 연동 + 생일 필드 sync + 아임웹 캠페인 분석

현재 진행 중 (이번 주)
├── ⚡ **최우선 (0414 추가)**: 더클린커피 자사몰 Purchase Guard 복제 — biocom v3 완료, 커피 미적용 갭 확인됨 (`footer/` 에 coffee 파일 0건, 전 변수 `BIOCOM_*` 하드코딩). 브라우저 Pixel 이 커피 가상계좌 미입금 주문을 Purchase 로 오염시킬 리스크 그대로. 복제+설치+실주문 3건 테스트(카드/가상계좌 미입금/입금 후 confirmed) 필요. 상세: [meta/capimeta.md](../meta/capimeta.md) Phase 1b + [capivm/capi.md](/Users/vibetj/coding/seo/capivm/capi.md)
├── ⚡ **최우선 (0414 추가)**: 커피 Funnel 이벤트 확장 — Day 1 서버 인프라(`sendFunnelEvent` + `POST /api/meta/capi/track`) 완료. Day 2~5 아임웹 브라우저 훅(ViewContent/AddToCart/InitiateCheckout) 배포 대기. 현재 fbq 가 `PageView` 만 발사해 Meta EMQ 상한이 낮음. 상세: [meta/capimeta.md](../meta/capimeta.md) Phase 3
├── ✅ 최우선 운영 기준 고정: `WAITING_FOR_DEPOSIT` 등 가상계좌 미입금 주문은 `pending`으로만 남기고 `confirmedRevenue`/메인 ROAS에서는 제외
├── ✅ CAPI 자동화 완료 (30분 주기 서버 내장 sync)
├── ✅ status-aware attribution ledger 완료 (SQLite + `payment_status` + Toss sync route)
├── ✅ biocom fetch-fix caller live 검증 (`orderId 202604081311774`, `snippetVersion 2026-04-08-fetchfix`, `ga_session_id 1775652461`)
├── ✅ biocom Imweb local sync 실실행 (`imweb_orders` latest 5,750건)
├── ✅ Toss settlement backfill 실실행 (latest local `toss_settlements` 20,388건)
├── ✅ biocom reconcile age bucket 분해 (`0-1일 45.77% / 31일+ 76.71%`)
├── ✅ `/api/toss/sync` completion signal 추가 (`runId / pagesRead / rowsAdded / done`)
├── ✅ `/ads` 메인 ROAS를 attribution 기준으로 정렬 (`/ads/roas`와 primary source 통일)
├── ✅ public backend 최신 dedupe 정책 배포 (`caller-coverage` public `200`, AIBIO 10분 이내 재제출 적재 확인)
├── ✅ AIBIO form-submit v5 live 검증 (`2026-04-08 23:22:56 / 23:23:26 KST` 연속 제출 모두 `201`)
├── ✅ thecleancoffee payment_success fetch-fix v2 live 검증 (`orderId 202604080749309`, `snippetVersion 2026-04-08-coffee-fetchfix-v2`, all-three `1건`)
├── ✅ biocom 리인벤팅 W7 제거 검증 완료 (`GTM-W7VXS4D8` 호출과 `Cannot read properties of null (reading 'includes')` 오류 사라짐)
├── ✅ CAPI/Attribution backend VM active origin 전환 완료 (`att.ainativeos.net -> GCP VM localhost:7020`, 노트북 backend/tunnel 의존 제거)
├── ✅ 자사몰 카드/가상계좌 Purchase guard 1차 완료 (카드 confirmed는 `Purchase`, 가상계좌 pending은 `VirtualAccountIssued`)
├── 네이버페이 Purchase 정합성은 별도 Phase로 분리 (결제 완료 후 `orders.pay.naver.com`에 머물러 Browser Pixel이 실행되지 않음)
├── GA4 `(not set)` 원인 좁히기: BigQuery raw export + hourly compare + caller coverage 일일 루틴 고정
├── P3 마감: 첫 operational live (세그먼트 선택 → 알림톡/SMS 발송 → 전환 추적)
├── 더클린커피 ROAS 비교 준비: coffee Meta token 재발급 + Imweb/Toss local sync 최신화 + pending status sync 후 coffee KPI 재산출
├── 일일 데이터 정합성 체크 루틴 고정 (`ledger` / `sync-status` / `toss-join` / `crm-phase1` / `roasphase`)
├── CAPI 효과 검증: 04/12 전환 증가, 04/19 CPA 하락 확인
└── Meta Conversion Lift 실험 시작 (iROAS 정밀 측정)

다음 배치 (이번 달)
├── P7: 첫 증분 실험 라이브 (체크아웃 이탈 holdout 실험)
├── P4 마감: 월별 코호트 히트맵
├── P2.5: 리드 마그넷 "3분 피로 자가진단" 설계
└── 아임웹 쿠폰 API 연동 (재구매 쿠폰 발급 자동화)

중기 (다음 달)
├── P6: 카카오 CRM
├── P8: BigQuery/Hotjar 판단
└── 캠페인별 재구매율/상담연결률 산출 (UTM 커버리지 개선 후)

장기
└── P9: AI Agent 고도화 — Unify → Hypothesize → Uncover → Evolve
```

### 0404 아임웹 CRM 캠페인 분석 요약

더클린커피 아임웹 "카카오 메시지 자동화"에서 **장바구니 이탈 1시간 리마인드** 캠페인이 실행 중이다.
구매 전환율 25%는 업계 상위이나, **발송 성공률 50%가 병목**(카카오 채널 미구독).
우리 솔루션의 SMS fallback으로 실패분을 복구하면 매출 ~2배 가능.
상세: [phase3.md > 더클린커피 아임웹 CRM 캠페인 현황 분석](phase3.md)

## 0406 데이터 정합성 체크 반영

`data/datacheck0406.md`와 `gptfeedback_0406_2reply.md` 기준으로, P1 운영 판단 숫자는 이제 아래 순서로 읽는다.

1. `GET /api/attribution/ledger`
   - source-of-truth for `payment_status`, `confirmedRevenue`, `pendingRevenue`, `canceledRevenue`
2. `POST /api/attribution/sync-status/toss?dryRun=true`
   - pending row가 Toss 상태와 실제로 닫히는지 preview 확인
3. `GET /api/attribution/toss-join`
   - paymentKey/orderId 기준 조인율 확인
4. `GET /api/crm-phase1/ops`
   - CRM 화면용 요약, GA4 `(not set)` 비교, next action 확인

현재 0406 로컬 기준 핵심 수치:

- attribution ledger `344건`
- `payment_success 342건`
- capture mode: `live 335 / replay 5 / smoke 4`
- payment status: `pending 276 / confirmed 65 / canceled 1`
- status별 금액: `confirmed ₩13,465,104 / pending ₩584,216,825 / canceled ₩78,088`

이 루틴은 `P1 숫자를 믿어도 되는가`를 매일 확인하는 최소 check로 본다.

## 0411 ROAS 정합성 체크 반영

[data/roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md) 기준으로, 이제 Meta ROAS headline은 `1d_click`로 읽는다. Meta default는 Ads Manager parity 참고값이고, 운영 판단은 `Attribution confirmed`, `confirmed+pending`, `Meta 1d_click`, `Meta attribution window별 ROAS`, `site-wide ceiling`, `CAPI/Pixel 중복 위험`을 같이 읽는다.

현재 biocom 최근 7일(2026-04-04 - 2026-04-10) 운영 판단값:

- Attribution confirmed ROAS: `1.05x`
- Attribution confirmed+pending ROAS: `1.07x`
- Meta `1d_click` purchase ROAS: `3.11x`
- Meta default purchase ROAS: `4.80x` (보조 참고값)
- Meta purchases `525건`이 내부 site confirmed orders `381건`보다 많아, window 차이뿐 아니라 Purchase 이벤트 중복/정의 차이를 주문 단위로 확인해야 한다

더클린커피는 아직 같은 품질로 비교하면 안 된다.

- coffee Meta token은 설정되어 있지만 Meta가 만료 토큰으로 거절한다
- `thecleancoffee_imweb` live `payment_success` 81건이 전부 `pending`이고 confirmed가 0건이다
- coffee Imweb local cache 최신 주문은 2026-04-04 10:38 KST, Toss coffee local transaction 최신은 2026-02-23 16:21 KST라 최신 ROAS 비교력이 낮다
- 따라서 순서는 `coffee Meta token 재발급 -> coffee Imweb/Toss sync 최신화 -> pending status sync -> biocom과 같은 window별 ROAS 비교`가 맞다

## 0412 CAPI/Purchase guard 및 VM 컷오버 반영

[capivm/capi.md](/Users/vibetj/coding/seo/capivm/capi.md)와 [capivm/vmdeploy.md](/Users/vibetj/coding/seo/capivm/vmdeploy.md) 기준으로, `att.ainativeos.net` backend는 노트북 터널이 아니라 GCP VM에서 동작한다.

현재 운영 상태:

- VM: `instance-20260412-035206`, `asia-northeast3-a`, external IP `34.64.104.94`
- PM2: `seo-backend` online, `seo-cloudflared` online
- Health: `CAPI_AUTO_SYNC_ENABLED=true`, `ATTRIBUTION_STATUS_SYNC_ENABLED=true`, `CWV_AUTO_SYNC_ENABLED=false`
- 로컬 노트북 `backend:7020`, `cloudflared`, `ngrok` 프로세스 종료 확인

자사몰 Purchase guard 1차 검증:

- 카드 confirmed 주문 `o2026041258d9051379e47 / 202604127697550`: `ev=Purchase`, `eid=Purchase.o2026041258d9051379e47`, HTTP 200 확인
- 가상계좌 pending 주문 `o20260412cdb6664e94ccb / 202604126682764`: `ev=VirtualAccountIssued`, `payment_decision_status=pending`, Browser `Purchase` 없음 확인
- 서버 CAPI는 confirmed 주문만 `Purchase`로 보내고, event_id는 `Purchase.{아임웹 order_code}`를 우선 사용한다

네이버페이:

- 주문 `2026041289545040`은 결제 완료 후 `orders.pay.naver.com/order/result/mall/...`에 머물러 우리 헤더/푸터와 Pixel이 실행되지 않았다
- 네이버페이는 Browser Pixel이 아니라 아임웹 주문 API/로컬 주문 캐시/Server CAPI confirmed-only 경로로 별도 처리한다

다음 운영 판단:

- 추가 테스트 주문을 반복하기보다, 24시간 이상 post-server-decision-guard 운영 로그를 보고 `pending -> Purchase` 누락 여부, `VirtualAccountIssued` 수, `payment-decision unknown` 비율, CAPI failure를 확인한다
- `/ads` 페이지의 CAPI 스냅샷 이후 Meta vs Attribution ROAS 격차 카드를 **매일 아침** 확인한다. D+3 (2026-04-16), D+7 (2026-04-20), D+14 (2026-04-27) 판정 체크포인트는 카드 안에 직접 박혀 있다
- 프론트엔드(`/ads`·`/crm`)를 VM 백엔드(`att.ainativeos.net`)로 언제·어떻게 전환할지는 [capivm/vm최신화.md](/Users/vibetj/coding/seo/capivm/vm최신화.md)를 참조한다. 현재는 시나리오 D(로컬 + CAPI 카드만 VM 직결) 상태이며, D+3 초기 신호 확인 후 시나리오 C(백엔드 VM 배포 + 프론트 전체 전환)로 옮길 예정

### 🔴 2026-04-14 갭 발견: 커피 자사몰 Purchase Guard 미적용

위 0412 v3 guard 는 **biocom 에만 적용**된 것을 2026-04-14 재검토에서 확인. `footer/` 디렉토리 전수 스캔 결과:

- `footer/header_purchase_guard_server_decision_0412_v3.md` (927줄): `BIOCOM_SERVER_PAYMENT_DECISION_GUARD`, `site=biocom`, `store=biocom` **전 변수 하드코딩**
- `footer/` 내 coffee 관련 파일 **0건**
- 커피 상품 페이지 실측(2026-04-14): `fbq('track', 'PageView')` 만 발사, 결제완료 페이지 브라우저 가드 없음 → **가상계좌 미입금 주문이 Browser Purchase 로 카운트될 여지**

즉 2026-04-12 biocom 완료 스냅샷은 **"자사몰 Purchase 1차 정합성 완료 — biocom 한정"** 으로 재해석해야 한다. 커피도 동일하게 만들기 전까지 `meta/capimeta.md` Phase 1b 는 50% 상태(biocom 100% + coffee 0% 평균).

필요한 작업(최우선):
1. `footer/header_purchase_guard_server_decision_coffee_0414.md` 신설 — biocom v3 복제 + `BIOCOM_`→`THECLEANCOFFEE_`, `site=biocom`→`site=thecleancoffee` 치환
2. `/api/attribution/payment-decision` CORS 에 `https://thecleancoffee.com` 허용 확인·추가
3. 아임웹 admin → 커피 결제완료 페이지 header 에 coffee 가드 설치
4. 실주문 3건 라이브 테스트 (카드 / 가상계좌 미입금 / 입금 후 confirmed)
5. `capivm/capi.md` 에 coffee 섹션 append

상세: [meta/capimeta.md Phase 1b](../meta/capimeta.md)

---

## 0414 광고 플랫폼별 CAPI & ROAS 정합성 확장 계획

**배경**: 현재 ROAS 정합성 체크(0411 섹션 + [roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md))는 **Meta 에만** 적용된다. Google Ads 와 TikTok 의 서버사이드 전환 업로드·정합성 체크는 **로드맵 어디에도 없음**. 실측 조사 결과:

### 현재 상태 (2026-04-14 기준)

| 플랫폼 | 브라우저 전환 신호 | 서버사이드 전환 업로드 | 광고비 API | ROAS 정합성 체크 |
|---|---|---|---|---|
| **Meta** | ✅ fbq 설치, funnel 이벤트는 Purchase 만 (0414 확장 중) | ✅ `metaCapi.ts` auto_sync (30분 cron), **오늘 `sendFunnelEvent` 추가** | ✅ `routes/ads.ts` 조회 | ✅ [roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md) |
| **Google Ads** | ⚠️ **계정 3종 공존 실측** — `AW-10965703590` 커피 primary (conversion label `OnyOCNDn2NcDEKa37ewo`, GTM 내부), `AW-304339096` **biocom + 커피 공유** (장바구니 conversion, biocom label `r0vuCKvy-8caEJixj5EB` / 커피 label `Xq1KCMTrt4oDEJixj5EB`), `AW-10976547519` AIBIO. **Enhanced Conversions 미적용** | ❌ **0%** — Offline Conversion Import(OCI) 구현 없음 | ❌ API 미연동 (계정 ID 만 기록) | ❌ 없음 |
| **TikTok** | ❌ TikTok Pixel 설치 여부 미확인 (GA4 source 파싱에만 "tiktok" 언급) | ❌ **0%** — TikTok Events API (v1.3) 미연동 | ❌ API 미연동 | ❌ 없음 |

### 🔴 Google Ads 계정 공유 이슈 — 선결 과제 (2026-04-14 실측 발견)

서버사이드 Enhanced Conversions / OCI 도입 **전에** 해결해야 할 구조적 문제:

**실측 발견 (2026-04-14, 커피 footer 재설치 검증 과정에서)**:
- 커피 홈 HTML raw grep 결과 `AW-10965703590` (primary) + **`AW-304339096`** (장바구니 conversion) 두 계정 발견
- biocom 홈 HTML 에는 `AW-304339096` 단독
- **즉 `AW-304339096` 이 biocom + 커피 두 사이트 공유**. 이전 기록(0414 #33) 의 "biocom 전용" 은 사실과 다름

**현재 영향**:
- `AW-304339096` 계정의 conversion 카운트 · 전환 value 가 **커피 + biocom 합산**으로 잡힘
- Google Ads Ads Manager 에서 사이트별 ROAS 분리 불가능
- 커피의 실제 장바구니 전환 기여가 biocom 캠페인에 얹히거나 반대 방향 (campaign attribution 에 따라)

**가능한 해석** (사용자 확인 필요):
- **A**: `AW-304339096` 이 **그룹 공용 통합 계정** 으로 의도적 설계
- **B**: 커피에 잘못 복붙된 레거시 스니펫 (의도 아님)
- **C**: 과거 커피를 biocom 계정으로 운영했다가 `AW-10965703590` 분리 후 구 스니펫 삭제 안 함

**권고 선결 작업**:
1. 사용자에게 `AW-304339096` 공유 의도 확인
2. **의도 아니면** — 커피 헤더에서 장바구니 conversion snippet 삭제 → 커피는 `AW-10965703590` 단독 운영
3. **의도 맞으면** — roadmap/capimeta 문서에 "공용 계정" 으로 명시 + 사이트별 분리가 필요할 경우 GCLID 기반 수동 분류 로직 필요
4. 이 결정이 나야 Enhanced Conversions / OCI 도입 시 어느 계정에 어떤 전환을 귀속시킬지 결정 가능

이 이슈는 **Google Ads 서버사이드 작업의 선결 블로커**. 해결 없이 Enhanced Conversions 를 추가하면 커피 장바구니 conversion 이 biocom 계정으로도 귀속되어 두 계정 모두 과대 집계.

### Google Ads 서버사이드 전환 — 무엇이 필요한가

Meta CAPI 에 해당하는 Google Ads 의 서버사이드 경로는 두 가지:

1. **Enhanced Conversions for Web (브라우저 보완)**
   - 브라우저 gtag 전환 이벤트에 이메일/전화번호 해시 필드 추가
   - 구현: `footer/` 현재 gtag 설치 블록에 `gtag('set', 'user_data', { email_address: sha256(email), phone_number: sha256(phone) })` 추가
   - 효과: Meta 의 "브라우저 픽셀 + PII 해싱" 과 유사. iOS ITP 차단 보완

2. **Offline Conversion Import (OCI) — Meta CAPI 에 가장 가까움**
   - 서버에서 `gclid` + conversion_action_id + conversion_value + conversion_time 을 Google Ads API 로 업로드
   - 구현: `backend/src/googleAdsOci.ts` 신설 → `POST /v18/customers/{id}/conversions:uploadClickConversions`
   - 필요: Google Ads API developer token + OAuth refresh token + customer_id
   - Toss confirmed 주문 → `metadata.gclid` 추출 → 업로드

3. **Consent Mode v2** — GDPR/한국 개인정보보호법 대응. 사용자 쿠키 동의 상태를 Google 에 전달. 현재 아임웹 쿠키 배너 상태 미확인.

### TikTok Events API — 무엇이 필요한가

- 엔드포인트: `POST https://business-api.tiktok.com/open_api/v1.3/event/track/`
- 헤더: `Access-Token: {access_token}`
- 구조: Meta CAPI 와 거의 동일 — `event`, `event_id`, `user_data { email/phone/external_id hashed }`, `properties { content_ids, value, currency }`
- **선행 조건**: 현재 TikTok 광고 집행 여부 확인 필요. GA4 source 에만 언급이 있어 유입은 있으나 Ads Manager 계정·픽셀 ID·access token 미확보
- TikTok 은 iOS 14 ATT 영향이 Meta 보다 큼 — 서버 CAPI 의 가치가 상대적으로 더 큼

### 도입 우선순위 판단

| # | 작업 | 선행 조건 | 시급도 | 예상 공수 |
|---|---|---|---|---|
| 1 | Google Ads Enhanced Conversions 추가 (biocom gtag) | 기존 `footer/` 의 gtag 블록에 user_data 필드 추가 | 🟡 중 | 0.5일 |
| 2 | Google Ads OCI 연동 검토 | Google Ads API 계정 + developer token + OAuth refresh token 획득 | 🟡 중 | 3일 (API 인증 세팅이 긴 편) |
| 3 | TikTok 광고 집행 여부 확인 | 박현준/AIBIO 마케팅 담당자에게 현재 TikTok Ads Manager 계정 존재 여부 질의 | 🔴 고 (정보 자체가 없음) | 0.5일 |
| 4 | TikTok Events API 연동 | 위 3번 확인 후 계정·픽셀·토큰 확보 | 🔴 고 (ATT 영향 큼) | 2일 |
| 5 | 광고 플랫폼 통합 ROAS 정합성 표 (`roasphase.md` 확장) | Meta + Google + TikTok 세 채널의 `광고비 × confirmed 매출 × 전환 건수` 를 동일 기준으로 비교 | 🟡 중 | 1일 |
| 6 | 통합 ROAS 대시보드 (`/ads/roas` 확장) | 위 1~5 후 | 🔵 저 | 1일 |

### ROAS 정합성 체크 기준 (신규 확장)

`roasphase.md` 에 아래 축을 추가하는 것을 권고:

```
Meta:
- Attribution confirmed ROAS (메인)
- Meta 1d_click purchase ROAS (플랫폼 참고값)
- Meta default purchase ROAS (보조)

Google Ads:
- Attribution confirmed ROAS (매출을 Attribution ledger 기준으로 통일)
- Google Ads purchase_value_per_cost (gclid 매칭된 confirmed 매출 ÷ spend)
- 차이율 = |Meta 식 - Google 식| / min(Meta, Google)
- Enhanced Conversions 적용 여부 표시

TikTok:
- Attribution confirmed ROAS (유입 + 매출 매칭)
- TikTok Ads Manager ROAS
- 차이율
- TikTok Events API 적용 여부 표시

통합:
- 채널별 '자사 Attribution 기준 ROAS' 를 단일 기준으로 나열
- 각 플랫폼의 '자체 리포트 ROAS' 와의 차이를 매일 확인
- 차이율 30% 초과 시 해당 채널 이벤트 정의·매칭 품질 재점검
```

### 도입 불필요 판단 트리거

광고 플랫폼마다 서버사이드 CAPI 도입이 항상 이득은 아니다. 다음 조건이면 **도입 연기**:
- 해당 플랫폼 월 광고비 < 100만원
- 해당 플랫폼 월 전환 건수 < 30건 (학습 단계 이득 없음)
- 해당 플랫폼 자체 리포트 ROAS 와 Attribution confirmed ROAS 의 **차이가 20% 이하**면 이미 충분히 측정 중

### 다음 액션

1. **사용자 확인 필요**: 현재 TikTok 광고 집행 여부 (AIBIO·biocom·커피 중 어느 것이라도)
2. **내가 할 수 있는 것**: Google Ads Enhanced Conversions 의 snippet 초안을 `footer/google_enhanced_conversions_0414.md` 로 작성 (gtag user_data 블록 + SHA-256 해싱 예시)
3. **이번 주 가장 빠른 성과**: 위 2번. biocom footer 에 기존 gtag 가 이미 있으므로 1시간 내 배포 가능

## 0408 운영 검증 반영

`data/datacheck0406.md`와 `gptfeedback_0408_1reply.md` 기준으로, 이번 턴에는 "문서상 계획"이 아니라 실제 실행 결과를 아래처럼 확보했다.

1. `GET /api/attribution/caller-coverage`
   - baseline은 `payment_success 452건`, `ga_session_id / client_id / user_pseudo_id` all-three `0%`에서 시작했다
   - 현재 local/public 최신 기준 `payment_success 560건`, all-three coverage `8건 (1.43%)`, biocom 단독 기준 `491건 중 7건 (1.43%)`, thecleancoffee 단독 기준 `62건 중 1건 (1.61%)`까지 올라왔다
   - public `https://att.ainativeos.net/api/attribution/caller-coverage`도 이제 `200`으로 열려 있고, 최신 backend dedupe 정책이 실제 운영 프로세스에 반영됐다
2. `POST /api/crm-local/imweb/sync-orders` (`site=biocom`)
   - latest local `imweb_orders 5,750건`, `firstOrderAt 2026-01-27`, `lastOrderAt 2026-04-07`
   - biocom도 이제 coffee처럼 `Imweb ↔ Toss` reconcile 숫자를 바로 볼 수 있고, age bucket으로 최근 지연과 오래된 누락을 분리해서 읽을 수 있다
3. `POST /api/toss/sync?store=biocom&mode=backfill`
   - latest local `toss_settlements 20,388건`, `totalPayout ₩4,720,106,642`
   - 정산 원장은 크게 확장됐고, `/api/toss/sync` 응답에는 `runId / startedAt / finishedAt / pagesRead / rowsAdded / done` completion signal이 추가됐다. 다만 장거리 backfill의 완료 응답/최종 coverage 산출은 아직 별도 점검이 필요하다
4. `GA4 property access`
   - `304759974 (biocom)`, `326949178 (coffee)`, `326993019 (aibio)` 3개 property Data API access를 모두 확인
   - coffee viewer 추가는 실제 조회 가능 상태로 검증됐다
5. `live footer / console check`
   - `biocom.kr`는 fetch-fix caller가 실제 homepage HTML에 반영됐고, latest live `payment_success 491건`, `ga_session_id 11건`, `client_id/user_pseudo_id 7건`, all-three `7건`까지 확인됐다
   - `thecleancoffee.com`는 `snippetVersion=2026-04-08-coffee-fetchfix-v2` 기준 실제 가상계좌 주문 `202604080749309`가 `2026-04-08 23:53:44 KST`에 `pending`으로 적재됐고, `ga_session_id / client_id / user_pseudo_id` 3종이 모두 들어온 첫 live row를 확인했다
   - `aibio.ai`는 쇼핑몰 purchase가 아니라 `form_submit`을 표준 원장으로 보고, `snippetVersion=2026-04-08-formfetchfix-v5` 기준 live `6건`, `2026-04-08 23:22:56 / 23:23:26 KST` 30초 간격 재제출 모두 `201` 저장을 확인했다
   - 같은 payment_complete 페이지에서 `gtm.js?id=GTM-W7VXS4D8 ... includes` 오류가 관찰됐고, public 컨테이너 파싱 기준 culprit은 리인벤팅 W7 `tag_id 44` `Custom HTML`의 `c.includes("RETOUS_")`로 좁혀졌다
   - 2026-04-11 기준 리인벤팅 CRM 협업 종료에 따라 W7 코드는 제거됐고, live HTML/Headless Chrome 검증에서 `GTM-W7VXS4D8` 호출과 기존 `Cannot read properties of null (reading 'includes')` 오류가 사라졌다
6. `payment_status / GA4 (not set) 운영 해석`
   - attribution ledger는 이미 `pending / confirmed / canceled`를 분리해서 읽을 수 있고, `WAITING_FOR_DEPOSIT` 같은 가상계좌 미입금 주문은 `pending`으로 남는다
   - 다만 최신 주문은 바로 `confirmed`가 되지 않는다. 예를 들어 coffee `202604080749309`는 현재 `pending`이고, `POST /api/attribution/sync-status/toss?dryRun=true&limit=5` 시점에는 아직 `unmatched`였다
   - 따라서 `GA4 (not set)` 문제도 이제 "결제완료 caller가 전혀 식별자를 못 보낸다" 단계는 지났다. 실마리는 보였고, 다음은 `BigQuery raw export + hourly compare + caller coverage + 새 푸터 이후 live row`로 historical row와 최신 계측 품질을 분리해 읽는 것이다

---

## ★ Phase 5.5 — ROAS/iROAS 모니터링 대시보드 (신규)

> **왜 상위 우선순위인가**: Meta API 장기토큰(60일)이 확보되었고, AIBIO는 이미 월 ₩148만 집행 중인데 전환율이 0.006%다. 광고비가 매일 나가고 있으므로, ROAS를 보지 않으면 돈을 태우고 있는지 투자하고 있는지 알 수 없다.

| Sprint | 목표 | 담당 | 완료 | 선행 |
|--------|------|------|------|------|
| P5.5-S1 | Meta 광고 성과 API 백엔드 (`routes/ads.ts`) | Codex | **100%** | ✅ ROAS/채널비교/사이트요약 4개 API |
| P5.5-S2 | ROAS 모니터링 대시보드 프론트 (`/ads/roas`) | Claude Code | **100%** | ✅ 채널비교+사이트ROAS+일별추이+파이차트 |
| P5.5-S3 | iROAS 계산 엔진 + 프론트 | Codex + Claude Code | **100%** | ✅ 4 API + 프론트 iROAS 섹션. 증분 매출 ₩9.1M |

**P5.5-S1 스펙:**
- `GET /api/meta/accounts` — 광고 계정 목록 (7개)
- `GET /api/meta/campaigns?account_id=...` — 캠페인 목록
- `GET /api/meta/insights?account_id=...&date_preset=last_30d` — 성과 데이터 (노출/클릭/비용/CPC/CPM/전환)
- `GET /api/meta/insights/daily?account_id=...` — 일별 추이

**P5.5-S2 대시보드 스펙:**
- 사이트별 탭 (바이오컴 / 더클린커피 / AIBIO)
- 캠페인별 KPI 카드 (노출, 클릭, 비용, CPC, CPM, ROAS)
- 일별 비용/클릭 추이 차트
- 전환 퍼널 (노출 → 클릭 → 랜딩뷰 → 전환)
- **ROAS = 매출 / 광고비** (Toss 매출 + attribution 데이터 조인)

**P5.5-S3 iROAS 스펙 (P7 이후):**
- iROAS = (treatment 매출 - control 매출) / 광고비
- Meta 광고로 유입된 고객 → attribution 원장에서 추적 → 증분 매출 계산
- 채널별 비교: Meta vs Google vs 당근 vs 자연유입

**현재 확보된 데이터:**
| 계정 | 현재 상태 | 비고 |
|------|---------|------|
| AIBIO 리커버리랩 | Meta API 조회 가능 | 기존 30일 실측 노출/클릭/비용은 별도 AIBIO 문서 기준으로 본다 |
| 바이오컴 | 최근 7일 spend/ROAS 조회 가능 | 상세 수치는 [roasphase.md](/Users/vibetj/coding/seo/data/roasphase.md) 기준 |
| 더클린커피 | Meta API 비교 보류 | coffee token 만료 + confirmed 0건 + local order/PG cache stale 복구 후 비교 |

---

## 지표 체계

| 구분 | 지표 | 현재 상태 |
|------|------|-----------|
| 회사 북극성 | 90일 재구매 순이익 | 임시: 환불 반영 순매출 ₩45M |
| 팀 OMTM | Incremental Gross Profit | callprice 1차 근사치 |
| **실행 지표 1** | **iROAS (증분 광고수익률)** | **P5.5 + P7에서 구현 예정** |
| 실행 지표 2 | unsubscribe/complaint rate | 채널톡/알리고에서 추출 |
| 실행 지표 3 | identity match rate | 41.7% (callprice 기준) |
| 진단 지표 | 재구매 코호트 M+1/2/3 | /cohort 대시보드 가동 중 |

---

## Growth OS 프레임워크

```
STEP 01 — Unify (데이터 통합)         → Phase 0~2 ✅
STEP 02 — Hypothesize (가설 수립)     → Phase 9 (AI Agent)
STEP 03 — Uncover (실행 및 증분 검증)  → Phase 7 + P5.5
STEP 04 — Evolve (AI 피드백 루프 진화) → Phase 9

= 선형적 성장이 아닌, 기하급수적 성장을 위한 AI 네이티브 조직의 OS
```

---

## API/인프라 현황

| 서비스 | 상태 | 비고 |
|--------|------|------|
| Toss Payments | ✅ 연동 완료 | 바이오컴 + 더클린커피 MID 분기, 거래/정산/결제 상세 |
| Meta Marketing API | ⚠️ 사이트별 상태 분리 필요 | biocom은 메인 토큰 6/9 만료, 커피는 시스템 유저 토큰 6/12 만료(0414 분리 완료). AIBIO 조회 가능 |
| **Meta CAPI (서버 전송)** | ✅ 바이오컴·커피 분기 완료 (0414) | `metaCapi.ts` `resolveCapiToken(pixelId)` 픽셀별 토큰 라우팅. Funnel 이벤트용 `sendFunnelEvent` 신설. Purchase guard 는 biocom 만 완료·coffee 미적용 ([capimeta.md](../meta/capimeta.md) Phase 1b) |
| **Google Ads API** | ⚠️ 계정 3종 공존 · API 미연동 | **`AW-10965703590`** (커피 primary, GTM-5M33GC4 내부, conversion label `OnyOCNDn2NcDEKa37ewo`) · **`AW-304339096`** (🔴 **biocom + 커피 공유 계정**, 장바구니 conversion, biocom label `r0vuCKvy-8caEJixj5EB` / 커피 label `Xq1KCMTrt4oDEJixj5EB`) · **`AW-10976547519`** (AIBIO). Insights/Reports API 미연동. 2026-04-14 실측으로 `AW-304339096` 공유 발견 — 사이트별 ROAS 분리 산출 불가 상태 |
| **Google Ads Enhanced Conversions** | ❌ 미적용 | 브라우저 gtag 에 user_data(email/phone hash) 필드 추가 필요. 0414 로드맵 편입 |
| **Google Ads OCI (Offline Conversion Import)** | ❌ 미적용 | 서버에서 `gclid` + conversion value 업로드. Meta CAPI 에 가장 가까운 경로. 0414 로드맵 편입 |
| **TikTok Ads Manager** | ❓ 집행 여부 미확인 | GA4 source 에 tiktok 유입 언급만 있음. Ads Manager 계정·픽셀·토큰 미확보 |
| **TikTok Events API (v1.3)** | ❌ 미적용 | `business-api.tiktok.com/open_api/v1.3/event/track/`. iOS ATT 영향 Meta 보다 큼 → CAPI 가치 높음. 위 미확인 선결 조건 |
| 아임웹 API | ✅ 3사이트 연동 | 회원 83,017명 consent 동기화 |
| 알리고 | ✅ 알림톡 + SMS | live 발송 확인, 템플릿 생성/검수 API |
| ChannelTalk | ✅ Webhook 수신 중 | 101건 수신, 실시간 이벤트 적재 |
| Cloudflare Tunnel | ✅ VM active origin | att.ainativeos.net -> GCP VM localhost:7020 |
| GA4 | ✅ 연동 | 3사이트 측정 ID 확인 |
| 카카오 | ✅ REST/Admin 키 | 채널 친구 API는 제한적 |
| 당근 | ❌ API 없음 | 수동 관리 |

---

## 3사이트 체계

| | 바이오컴 | 더클린커피 | AIBIO |
|---|---------|----------|-------|
| 결제/폼 추적 | ✅ fetch-fix live + Toss 검증 | ✅ payment_success fetch-fix v2 live + all-three 첫 row 확인 | ✅ form_submit v5 live + 10분 이내 재제출 적재 |
| 회원 sync | ✅ 69,681명 | ✅ 13,236명 | ✅ 100명 |
| SMS 동의 | 47.5% | (사이트별 미분리) | |
| Meta 광고 | ✅ 조회 가능, ROAS 정합성 검증 중 | ✅ 시스템 유저 토큰 분리(0414), 60일 만료 → Never 재발급 대기 | ✅ 조회 가능, 별도 AIBIO 문서 기준 |
| **Meta CAPI funnel 이벤트** | ❌ Day 2 대기 (ViewContent/AddToCart 미설치) | ❌ Day 2 대기 + 미지의 픽셀 삭제됨(0414) | ❌ |
| **Purchase Guard (가상계좌 분리)** | ✅ **v3 완료 + 실주문 테스트 통과 (0412)** | ❌ **0% — 복제 필요 (0414 최우선)** | N/A (쇼핑몰 아님) |
| Google Ads 광고 | 🟡 `AW-304339096` gtag 설치 (Enhanced Conversions 미적용, **커피와 공유 계정**) | 🟡 **실측**: `AW-10965703590` primary (GTM 내부) + `AW-304339096` 장바구니 conversion (biocom 공유). Enhanced Conversions 미적용 | 🟡 `AW-10976547519` + AIBIO 문서 기준 |
| Cloudflare | ✅ att.ainativeos.net (공유) |

---

## 참고 문서

- 원본 전체 로드맵: `roadmap0327_full_backup_0403.md`
- API 연동 현황: `api.md`
- 알리고 템플릿 관리: `aligo.md`, `crm/crmreport.md`
- 커피 원가 분석: `coffee/gptprocoffee.md`
- 아임웹 회원 consent: `imweb/memberagree.md`
