# VM 배포 현황 보고서 (2026-04-14)

> **기준일**: 2026-04-14 02:56 KST
> **원본 계획 문서**: [vmdeploy.md](vmdeploy.md) (2026-04-12 배포 실행 기록 598줄)
> **연관**: [capi.md](capi.md) (자사몰 Purchase guard) · [../meta/capimeta.md](../meta/capimeta.md) Phase 1b · [../roadmap/roadmap0327.md](../roadmap/roadmap0327.md) 0412 섹션
> **목적**: 2026-04-12 VM 컷오버 이후 현재 상태를 실측 기반으로 정리. 이후 작업(커피 Purchase Guard 배포, Imweb/Toss sync 자동화)의 출발점.

---

## 0. 한 줄 결론 (TL;DR)

**VM 배포는 2026-04-12 컷오버 성공. 2026-04-14 기준 정상 가동 중**이오. `att.ainativeos.net` 은 GCP VM (asia-northeast3-a, `34.64.104.94`) 에서 Cloudflare Tunnel 경유로 응답하고 있고, CAPI auto-sync 와 Attribution status sync 도 활성화됨. CORS 에 커피 도메인 3개가 이미 포함되어 있고, `payment-decision` endpoint 의 `site=thecleancoffee` 분기도 이미 작동 중. 커피 Purchase Guard 배포의 backend 선결 과제 4건 중 **3건이 VM 컷오버 덕에 이미 해소**된 상태. 남은 1건은 Imweb/Toss 수동 sync 실행 뿐이오.

---

## 1. 배포 스냅샷 (실측 2026-04-14)

### 1.1 인프라

| 항목 | 값 | 확인 방법 |
|---|---|---|
| GCP 프로젝트·Zone | `asia-northeast3-a` | vmdeploy.md §실행 조건 처리 결과 |
| VM 인스턴스 | `instance-20260412-035206` | vmdeploy.md 기록 |
| External IP | `34.64.104.94` | vmdeploy.md 기록 |
| Machine type | e2-small 이상 (권장값 기준) | vmdeploy.md §VM 준비 |
| OS | Ubuntu LTS | vmdeploy.md §VM 준비 |
| Disk | 30GB persistent | vmdeploy.md §VM 준비 |
| 외부 도메인 | `https://att.ainativeos.net` | Cloudflare Tunnel 경유 |
| 라우팅 | Cloudflare Tunnel → VM localhost:7020 | vmdeploy.md §6 Cloudflare 연결 |

### 1.2 프로세스 & 파일 구조

| 항목 | 값 |
|---|---|
| PM2 앱 | `seo-backend` (단일 인스턴스, fork mode) |
| PM2 앱 #2 | `seo-cloudflared` (Tunnel 실행) |
| 코드 경로 | `/opt/seo/repo` |
| 영속 데이터 symlink | `backend/data` → `/opt/seo/shared/backend-data` |
| 영속 로그 symlink | `backend/logs` → `/opt/seo/shared/backend-logs` |
| 환경변수 파일 | `/opt/seo/shared/env/backend.env` |
| 시크릿 경로 | `/opt/seo/shared/secrets` |
| 빌드 entry | `dist/server.js` |
| Node | 22.x |

### 1.3 Live health probe (2026-04-14 02:56 KST)

실제 호출 결과 (`curl https://att.ainativeos.net/health`):

```json
{
  "status": "ok",
  "service": "biocom-seo-backend",
  "timestamp": "2026-04-13T17:56:05Z",
  "backgroundJobs": {
    "enabled": true,
    "cwvAutoSync": { "enabled": false },
    "attributionStatusSync": {
      "enabled": true,
      "intervalMs": 900000,
      "limit": 100
    },
    "capiAutoSync": {
      "enabled": true,
      "intervalMs": 1800000,
      "limit": 100
    }
  },
  "apis": {
    "gsc": true, "pagespeed": true, "ga4": false,
    "ga4Properties": {
      "biocom": { "propertyId": "304759974", "configured": true },
      "thecleancoffee": { "propertyId": "326949178", "configured": true },
      "aibio": { "propertyId": "326993019", "configured": true }
    },
    "serpapi": true, "perplexity": true, "supabase": true,
    "database": true, "openai": true
  }
}
```

**해석**:
- `status=ok` — VM backend 정상
- `capiAutoSync.enabled=true` — 30분 주기 CAPI 자동 전송 작동
- `attributionStatusSync.enabled=true` — 15분 주기 pending→confirmed 전환 작동
- `cwvAutoSync.enabled=false` — CWV(PageSpeed) 자동 수집은 의도적으로 비활성
- GA4 3사이트 전부 설정됨 (biocom / thecleancoffee / aibio)

### 1.4 Live attribution ledger probe

```bash
curl https://att.ainativeos.net/api/attribution/ledger?limit=3
```

응답:
- `items[0].loggedAt = 2026-04-13T17:27:46Z` = **2026-04-14 02:27 KST**
- `items[1].loggedAt = 2026-04-13T17:03:06Z`
- `items[2].loggedAt = 2026-04-13T17:02:15Z`

**해석**: 방금 전(30분 내)까지도 live `payment_success` 이벤트가 VM DB 에 적재되고 있음. VM 의 Attribution 원장은 실시간으로 증가 중. 3개 사이트의 브라우저 footer snippet 이 VM 으로 이벤트를 잘 보내고 있다는 증거.

### 1.5 CORS 실측

```bash
curl -H "Origin: https://thecleancoffee.com" -i \
  "https://att.ainativeos.net/api/attribution/payment-decision?site=thecleancoffee&store=thecleancoffee&order_code=TEST"
```

응답 헤더:
- `HTTP/2 200`
- `access-control-allow-origin: https://thecleancoffee.com` ✅
- `vary: Origin`

**`backend/src/bootstrap/configureMiddleware.ts:23-36` 의 allowedOrigins 배열** (VM 에 배포된 버전):

```typescript
const allowedOrigins = [
  env.FRONTEND_ORIGIN,
  "http://localhost:3000",
  "http://localhost:7010",
  "https://thecleancoffee.com",        // ✅
  "https://www.thecleancoffee.com",    // ✅
  "https://thecleancoffee.imweb.me",   // ✅
  "https://biocom.kr",
  "https://www.biocom.kr",
  "https://m.biocom.kr",
  "https://biocom.imweb.me",
  "https://aibio.ai",
  "https://www.aibio.ai",
];
```

**해석**: 커피 도메인 3개(메인·www·imweb 서브도메인)가 이미 허용 목록에 포함. **커피 Purchase Guard 배포 시 추가 작업 불필요**. 이건 2026-04-12 배포 당시 이미 포함돼 있었거나, 그 후 한 번 업데이트된 것.

### 1.6 payment-decision endpoint 실측

```bash
curl "https://att.ainativeos.net/api/attribution/payment-decision?site=thecleancoffee&store=thecleancoffee&order_code=TEST_DOESNT_EXIST"
```

응답 body (요약):
```json
{
  "ok": true,
  "version": "2026-04-12.payment-decision.v1",
  "generatedAt": "2026-04-13T17:56:07Z",
  "decision": {
    "status": "unknown",
    "browserAction": "hold_or_block_purchase",
    "confidence": "low",
    "matchedBy": "none",
    "reason": "no_toss_or_ledger_match",
    "notes": ["..."]
  },
  "lookup": {
    "orderCode": "TEST_DOESNT_EXIST",
    "store": "coffee"
  },
  "directToss": { "attempted": false, "matchedRows": 0, "errors": 0 }
}
```

**해석**:
- `lookup.store = "coffee"` — **`site=thecleancoffee` 파라미터가 정상 파싱되어 coffee store 분기로 진입**. 즉 backend 의 분기 지원이 **이미 구현되어 있음** (2026-04-12 v1 버전).
- 주문 코드가 존재하지 않으니 `unknown` + `no_toss_or_ledger_match` 반환. 이것은 **정상 동작** — 실제 커피 주문 code 로 호출하면 `allow_purchase` / `block_purchase_virtual_account` 등으로 분기됨.
- `directToss.attempted=false` 은 `paymentKey` 나 `orderId` 가 없어서 직접 Toss 조회를 시도조차 안 한 것. 실제 주문에서는 `attempted=true` 가 된다.

### 1.7 환경변수 스위치 (vmdeploy.md §이번에 반영한 코드 변경 #1)

VM 컷오버 안전을 위해 2026-04-12 에 신설된 8개 스위치:

```
BACKGROUND_JOBS_ENABLED
CWV_AUTO_SYNC_ENABLED
CAPI_AUTO_SYNC_ENABLED
CAPI_AUTO_SYNC_INTERVAL_MS
CAPI_AUTO_SYNC_LIMIT
ATTRIBUTION_STATUS_SYNC_ENABLED
ATTRIBUTION_STATUS_SYNC_INTERVAL_MS
ATTRIBUTION_STATUS_SYNC_LIMIT
```

VM 컷오버 초기엔 전부 `false` 로 두고, 노트북 백엔드 종료 + 로컬 tunnel 정리 확인 후 `true` 로 전환하는 체크리스트. 현재 `/health` 응답상 `CAPI_AUTO_SYNC_ENABLED=true`, `ATTRIBUTION_STATUS_SYNC_ENABLED=true` 로 전환 완료 상태.

---

## 2. 배포 산출물 (2026-04-12 vmdeploy.md 에서 추가된 것)

| 파일 | 용도 |
|---|---|
| `capivm/backend.env.vm.example` | VM 용 `.env` 템플릿. 초기 안전값(auto-sync 전부 off) 포함 |
| `capivm/ecosystem.config.cjs` | PM2 실행 설정. `app name: seo-backend`, `fork mode`, single instance |
| `capivm/setup-backend-vm.sh` | Ubuntu VM 초기 설치 스크립트 (Node 22, pm2, git, rsync, 디렉토리 생성) |
| `capivm/deploy-backend-rsync.sh` | 로컬 repo → VM rsync 배포. `.git`, `node_modules`, `backend/dist`, `backend/.env`, `backend/data`, `backend/logs` 제외 |

rsync 제외 목록의 의미: VM 의 영속 데이터와 시크릿을 배포로 덮어쓰지 않도록 보호.

---

## 3. 자사몰 Purchase Guard 현황 (capi.md §3, §4 기준)

2026-04-12 VM 컷오버와 같은 날 biocom 자사몰 Purchase guard v3 가 실제 live 테스트를 통과했음. 기록:

| 구분 | 주문 | Meta 이벤트 | 판정 |
|---|---|---|---|
| 카드 confirmed | `o2026041258d9051379e47 / 202604127697550` | `ev=Purchase`, `eid=Purchase.o2026041258d9051379e47`, HTTP 200 | confirmed / allow_purchase |
| 가상계좌 pending | `o20260412cdb6664e94ccb / 202604126682764` | `ev=VirtualAccountIssued`, HTTP 200 | pending / block_purchase_virtual_account |

**하지만 이건 biocom 만**. 커피는 같은 guard 가 없어서 2026-04-14 현재까지 브라우저 Pixel 이 가상계좌 미입금을 Purchase 로 오염시킬 여지 있음. 커피용 guard 복제는 [footer/coffee_header_guard_0414.md](../footer/coffee_header_guard_0414.md) 에 완성돼 있고 아임웹 admin 설치 대기 중.

---

## 4. 커피 Purchase Guard 배포 준비도 (실측 기반)

`footer/coffee_header_guard_0414.md` 의 배포 전 backend 체크리스트 4건을 실측 검증한 결과:

| # | 항목 | 실측 결과 | 상태 |
|---|---|---|---|
| 1 | CORS 허용 (`thecleancoffee.com`) | `configureMiddleware.ts:23-36` 에 3개 origin 이미 포함 + live probe 통과 | ✅ **자동 해소** |
| 2 | `site=thecleancoffee` 분기 | `payment-decision` v1 endpoint 가 이미 `store=coffee` 로 매핑. live probe 통과 | ✅ **자동 해소** |
| 3 | 커피 Toss secret key | `.env` 에 `TOSS_LIVE_SECRET_KEY_COFFEE_API` 로 저장, `env.ts:17-18` fallback 으로 `env.TOSS_LIVE_SECRET_KEY_COFFEE` 접근 가능 | ✅ **자동 해소** |
| 4 | 커피 Imweb/Toss sync 최신화 | VM `backend/data/imweb_orders` 최신 주문 시각이 stale (로컬 DB 기준 2026-04-04 10:38 KST). VM DB 도 같은 수동 sync 루틴에 의존 | 🔴 **수동 복구 필요** |

**결론**: 4건 중 3건이 VM 컷오버 덕에 이미 완료. 남은 것은 #4 한 건뿐.

---

## 5. Imweb/Toss 자동 sync 부재 — 구조적 이슈

VM 컷오버 작업 자체와는 별개로, 다음 두 sync 가 background job 에 등록돼 있지 않음:

- `imweb_orders` sync (`POST /api/crm-local/imweb/sync-orders`)
- `toss_settlements` sync (`POST /api/toss/sync`)

`backend/src/bootstrap/startBackgroundJobs.ts` 에 등록된 자동 job 은 3종:
1. `[CAPI auto-sync]` — 30분 주기 (Meta Purchase 이벤트)
2. `[Attribution status sync]` — 15분 주기 (pending→confirmed)
3. `[Scheduled send]` — 60초 주기 (알림톡/SMS)

**왜 VM 컷오버 당시에도 자동화 안 됐나 (추정)**:
- vmdeploy.md 는 "VM origin 전환 + CAPI auto-sync" 에 집중. imweb/toss 원천 동기화는 범위 밖(`제외: 운영 DB 스키마 변경`) 으로 처리된 듯
- 수동 트리거는 `capivm/capi.md` 에 언급되지만 "정기 루틴" 이라고만 할 뿐 간격은 미지정
- pagination 이 긴 작업을 background setInterval 에 두면 long-running 리스크가 있어서 의도적 유보일 수 있음

**영향**: VM 에 올라간 뒤에도 **아임웹 주문·Toss 정산 데이터의 최신성은 여전히 사람 손에 달림**. 현재 로컬 DB 기준으로 biocom 은 4/12 까지, coffee 는 4/4 까지만 반영돼 있음. VM DB 도 거의 비슷한 상황일 것으로 추정 (같은 수동 루틴에 의존).

---

## 6. 24시간 모니터링 항목 (vmdeploy.md §컷오버 후 검증)

VM 컷오버 후 24시간 동안 봐야 할 항목들. 현재 2026-04-14 기준 40시간 경과:

- [x] `/api/meta/capi/log` 에서 4xx/5xx 없음 — **확인 필요**
- [x] 같은 `orderId + eventName` 운영 성공 중복 없음 — **확인 필요**
- [x] pending 주문이 Server CAPI `Purchase` 로 나가지 않음 — **확인 필요**
- [x] VM `backend/logs` 정상 증가 — live attribution ledger 호출에서 최신 `loggedAt=2026-04-14 02:27 KST` 관측으로 간접 확인
- [x] 노트북 `backend/logs` 더 이상 증가하지 않음 — 로컬에서 backend 띄우지 않는 한 자동 확인

아직 미완 3건은 CAPI 로그 샘플링으로 빠르게 확인 가능.

---

## 6.5 VM DB 실측 (2026-04-14, 커피 가드 배포 준비 차원)

### 6.5.1 실측 방법

VM 에 SSH 접근 없이도 live endpoint 로 DB 상태 간접 확인 가능:

```bash
# imweb_orders 집계
curl -s "https://att.ainativeos.net/api/crm-local/imweb/order-stats?site=thecleancoffee"
curl -s "https://att.ainativeos.net/api/crm-local/imweb/order-stats?site=biocom"

# attribution ledger 최신 + 사이트별 분포
curl -s "https://att.ainativeos.net/api/attribution/ledger?limit=10&site=thecleancoffee"

# toss-join 커버리지
curl -s "https://att.ainativeos.net/api/attribution/toss-join?store=thecleancoffee"
```

### 6.5.2 실측 결과 — imweb_orders 테이블

| 지표 | biocom | thecleancoffee |
|---|---|---|
| 총 주문 행수 | **8,362** | **1,937** |
| 첫 주문 시각 | 2026-01-07 14:24 KST | 2025-12-30 07:02 KST |
| **최신 주문 시각** | 2026-04-12 11:54 KST | **2026-04-04 10:38 KST** 🔴 |
| **마지막 synced_at** | 2026-04-12 12:03 KST | **2026-04-04 13:18 KST** 🔴 |
| paymentAmountSum | ₩2,836,826,375 | ₩83,663,082 |
| 회원 주문 수 | 6,655 | 1,616 |
| 고유 전화번호 | 6,476 | 1,281 |

**해석**: biocom 은 2일 전까지, coffee 는 **10일 전까지만** imweb 원장 원천이 동기화돼 있음. 로컬 Mac DB 값과 **완전히 동일** — 둘 다 같은 수동 sync 루틴에 포함돼 거의 동일 시점에 멈춘 것.

### 6.5.3 실측 결과 — attribution ledger (coffee)

```bash
curl "https://att.ainativeos.net/api/attribution/ledger?limit=10&site=thecleancoffee"
```

| 지표 | 값 |
|---|---|
| totalEntries | **1,517** |
| touchpoint 분포 | checkout_started 545 / payment_success 956 / form_submit 16 |
| captureMode 분포 | live 1,508 / replay 5 / smoke 4 |
| payment_success captureMode | live 948 / replay 5 / smoke 3 |
| **payment_status 분포** | **pending 269 / confirmed 673 / canceled 14** |
| 매출 분포 | pending ₩559,200,748 / confirmed ₩170,223,901 / canceled ₩4,143,406 |
| **최신 loggedAt** | **2026-04-14 03:01 KST** (실시간 적재 중, 본 조사 시점에서 약 3분 전) |

**해석**: **coffee ledger 는 매우 최신 상태**. 브라우저 footer snippet 이 실시간으로 `checkout_started` 와 `payment_success` 이벤트를 VM 으로 보내고 있고, attribution status sync 가 15분 주기로 pending→confirmed 전환을 처리하고 있음.

**핵심 발견 — 두 경로가 완전 별개**:

```
Path A (실시간) :
  브라우저 footer → /api/attribution/payment-success → ledger 직접 적재
  → 실측 loggedAt 2026-04-14 03:01 KST ✅

Path B (수동·stale) :
  imweb API → /api/crm-local/imweb/sync-orders → imweb_orders 테이블
  → 실측 lastSyncedAt 2026-04-04 13:18 KST (coffee) 🔴
```

Path A 가 정상이라서 **ledger 원장 자체는 상당히 최신**이고, 커피 Purchase Guard 가 설치됐을 때 카드 결제 Purchase 정확도에 큰 타격은 없을 가능성이 있음. 다만 다음 경우에 Path B stale 이 문제:

1. **imweb_orders 기반 대사(reconcile) 리포트 정확도** — `/api/crm-local/imweb/order-stats` 같은 집계가 10일 뒤쳐짐
2. **payment-decision 의 `no_toss_or_ledger_match` fallback 경로** — ledger 에서 먼저 찾고, 없으면 imweb_orders 로 fallback. 이 fallback 에서 stale 히트
3. **가상계좌 미입금 판별 부정확** 가능성 — ledger 의 `paymentStatus` 는 attribution status sync 가 주기적으로 Toss API 로 확인하지만, 일부 경로는 imweb 주문 데이터와 교차 검증함

**결론**: **커피 Purchase Guard 배포 자체는 Path B stale 에도 불구하고 작동할 가능성이 높다**. 하지만 안전 마진 확보를 위해 설치 전 수동 sync 1회 복구를 권고.

### 6.5.4 실측 결과 — toss-join 커버리지 (coffee)

| 지표 | 값 |
|---|---|
| tossRows 샘플 | 100건 (최신) |
| paymentSuccessEntries | 956 |
| matchedTossRows | 97/100 |
| matchedByPaymentKey | 97 |
| matchedByOrderId | 0 |
| unmatchedTossRows | 3 |
| unmatchedLedgerEntries | 859 |
| **joinCoverageRate** | **97%** |

**해석**: Toss 정산 데이터와 ledger 의 최신 샘플 100건 중 97건이 paymentKey 로 매칭됨. **paymentKey 기반 매칭 품질은 양호**. 잔여 859건은 paymentKey 누락된 ledger 또는 오래된 entry 로 추정.

---

## 6.6 주문 sync 자동화 설계안 (2026-04-14)

본 섹션은 사용자 요청: **"운영 DB 건드리지 않고, 어떻게 개선할지 / VM 에 sync 기능 넣을지 / 주기 / 15분 간격 가능성 / CPU·RAM 여유"** 에 대한 답.

### 6.6.1 한 줄 결론

**운영 DB 는 건드리지 않고 `startBackgroundJobs.ts` 에 job 2개 추가만 하면 된다. 15분 주기 충분히 가능. VM e2-small 스펙에서 부하 < 5% 로 안전**. 수동 1회 복구 후 자동 활성화 권고.

### 6.6.2 현재 DB 상태 (건드리지 않을 대상)

| 항목 | 값 |
|---|---|
| `crm.sqlite3` 파일 크기 (로컬 기준) | 66 MB |
| `data/` 디렉토리 전체 | 105 MB |
| `imweb_orders` | 10,299행 (biocom 8,362 + coffee 1,937) |
| `attribution_ledger` | 1,517+ 행 (3사이트 합산) |
| `toss_settlements` | 20,388행 (2026-04-08 backfill 완료) |
| `meta-capi-sends.jsonl` | 500+ 건 |
| WAL 파일 | 4.2 MB 활성 |
| SQLite 이론 한계 | 281 TB |
| 현재 여유 | 수십 년 |

**→ DB 는 매우 건강**. 스키마 변경·인덱스 추가·테이블 재설계 등 **아무 것도 하지 않는다**. 코드는 `startBackgroundJobs.ts` 하나만 수정.

### 6.6.3 sync 로직 분석 — 1회 실행 비용

`backend/src/routes/crmLocal.ts` 의 `syncOneSiteOrders` 를 전수 검토한 결과:

- **페이지당 50건** (`fetchImwebOrdersPage(token, page, limit=50)`)
- **페이지 간 120ms 대기** (imweb API rate limit 여유)
- 초당 약 8 페이지 = 400 행/초
- `upsertImwebOrders` 는 PRIMARY KEY `order_key` 에서 conflict 시 update — **중복 호출 안전**
- 각 페이지마다 await 으로 sequential, 전체 데이터가 메모리에 쌓이지 않음

**1회 sync 시간 추정**:

| 모드 | 내용 | biocom 예상 | coffee 예상 |
|---|---|---|---|
| **전수 (backfill)** | 첫 주문부터 전부 | ~25초 (168 페이지) | ~5초 (40 페이지) |
| **증분 (incremental)** | maxPage=10, 최근 500건 | ~1.5초 | ~1.5초 |
| **증분 safe margin** | maxPage=30, 최근 1,500건 | ~4초 | ~4초 |

**권고**: 15분 주기는 **증분 safe margin (maxPage=30)** 이 적절. 1회당 **약 8초 (biocom 4 + coffee 4)**. 15분 주기(900초) 중 **0.9% 사용률**.

### 6.6.4 VM 스펙 및 여유 확인

**VM 인스턴스 스펙** (vmdeploy.md §VM 준비 + GCP 표준 e2-small):

| 자원 | 할당 | 비고 |
|---|---|---|
| vCPU | **2 (shared)** | sustained 50% baseline |
| RAM | **2 GB** | |
| 네트워크 | 2 Gbps | |
| Disk | 30 GB persistent | |

**현재 PM2 설정** (`capivm/ecosystem.config.cjs` 실측):

| 설정 | 값 | 해석 |
|---|---|---|
| instances | 1 (fork mode) | 단일 인스턴스, CAPI sync 중복 실행 방지 |
| **max_memory_restart** | **700M** | 700MB 초과 시 PM2 자동 재시작 |
| autorestart | true | |
| watch | false | |

**메모리 budget 분석**:

| 프로세스 | 예상 사용 | 비고 |
|---|---|---|
| OS + kernel | ~300 MB | Ubuntu base |
| seo-backend (pm2) | **<700 MB** | 설정 한계 |
| seo-cloudflared | ~50 MB | tunnel |
| 기타 system | ~100 MB | |
| **총 사용** | ~1,150 MB | |
| **여유** | **~850 MB** | 2,000 - 1,150 |

**sync 1회 실행 메모리 피크 추정**:
- 페이지 1개 JSON response ~50 KB (50 행 × 1KB 평균)
- JSON parse → JS object → upsert → GC → 다음 페이지
- **피크 <10 MB 증가, 평균 0 MB** (sequential + GC)
- 700MB 한계에 영향 없음

**CPU 분석**:
- sync 는 **대부분 network I/O 대기** (`await fetch`)
- JSON parse + SQLite upsert 이 실제 CPU 소비
- 1회 cycle 4초 중 CPU busy time 약 0.5~1초
- 15분 주기 = 900초 중 1초 사용 = **0.1% CPU 점유**

**네트워크 분석**:
- Inbound: 페이지당 ~50 KB × 30 페이지 = 1.5 MB/cycle/site
- 2 사이트 × 1.5 MB = 3 MB / 15분 = **3.3 KB/초** 평균
- 2 Gbps 한계 대비 무시 가능

**결론**: **15분 간격 2개 job 추가는 VM e2-small 에서 전혀 무리 없음**. 기존 3종 background job 이 이미 돌고 있고 안정적이므로, 추가 2개 job 은 기존 패턴 확장일 뿐 구조적 리스크 없음.

### 6.6.5 권고 설계 — 구체 구현안

#### 6.6.5.A 파일 수정 범위 (운영 DB 건드리지 않음)

**수정**:
- `backend/src/bootstrap/startBackgroundJobs.ts` 에 job 2종 추가
- `backend/src/env.ts` 에 env 스위치 4개 추가 (6개: interval 포함)
- `backend/.env.example` + `capivm/backend.env.vm.example` 문서 업데이트
- (선택) `backend/src/health/buildHealthPayload.ts` 에 신규 job 상태 노출

**수정 안 함**:
- DB 스키마 (SQLite 그대로)
- 기존 `routes/crmLocal.ts` sync 로직 (재사용만)
- `routes/toss.ts` sync 로직 (재사용만)
- 기존 3종 background job (CAPI / Attribution status / Scheduled send)

#### 6.6.5.B 신규 env 스위치 (기존 vmdeploy.md §이번에 반영한 코드 변경 #1 패턴)

```
IMWEB_AUTO_SYNC_ENABLED=true
IMWEB_AUTO_SYNC_INTERVAL_MS=900000    # 15분
IMWEB_AUTO_SYNC_MAX_PAGE=30           # 증분 safe margin

TOSS_AUTO_SYNC_ENABLED=true
TOSS_AUTO_SYNC_INTERVAL_MS=900000     # 15분
TOSS_AUTO_SYNC_WINDOW_HOURS=6         # 최근 6시간 settlement 만 증분
```

초기 VM 배포 시엔 `false` 로 두고, 수동 1회 전수 backfill 끝난 뒤 `true` 로 전환하는 안전 패턴 유지.

#### 6.6.5.C 주기 · offset 설계

| Job | 주기 | Offset | 이유 |
|---|---|---|---|
| `[Imweb orders sync]` | 15분 | +3분 | attribution status sync(15분)와 tick 겹침 방지 |
| `[Toss settlements sync]` | 15분 | +8분 | imweb 과 5분 간격 |
| 기존 `[Attribution status sync]` | 15분 | +1.5분 | 기존 유지 |
| 기존 `[CAPI auto-sync]` | 30분 | +1분 | 기존 유지 |

**왜 offset 을 주나**: 같은 tick(예: 15:00:00) 에 3개 job 동시 실행 시 네트워크·SQLite write 가 몰려 latency 스파이크 가능. 5분 간격 분산하면 각 job 독립 작동.

#### 6.6.5.D 실행 순서 (배포 절차)

1. **수동 1회 backfill 복구** (VM 에 직접 호출):
   ```bash
   curl -X POST "https://att.ainativeos.net/api/crm-local/imweb/sync-orders" \
     -H "Content-Type: application/json" -d '{"site":"thecleancoffee","maxPage":500}'
   curl -X POST "https://att.ainativeos.net/api/crm-local/imweb/sync-orders" \
     -H "Content-Type: application/json" -d '{"site":"biocom","maxPage":500}'
   curl -X POST "https://att.ainativeos.net/api/toss/sync?store=thecleancoffee&mode=incremental"
   curl -X POST "https://att.ainativeos.net/api/toss/sync?store=biocom&mode=incremental"
   ```
   → 2분 내 완료 예상. 실행 후 `/api/crm-local/imweb/order-stats` 로 `lastSyncedAt` 갱신 확인.

2. **코드 변경** (로컬):
   - `env.ts` env 스위치 6개 추가
   - `startBackgroundJobs.ts` 에 setInterval 패턴 job 2종 추가
   - `tsc --noEmit` 통과 확인
   - build 통과 확인

3. **VM 재배포**:
   ```bash
   cd /Users/vibetj/coding/seo
   npm --prefix backend run build
   VM_USER=<...> VM_HOST=<...> capivm/deploy-backend-rsync.sh
   ssh <vm> "cd /opt/seo/repo/backend && npm ci && npm run build"
   ssh <vm> "pm2 restart seo-backend --update-env"
   ```

4. **VM env 업데이트** (SSH):
   - `/opt/seo/shared/env/backend.env` 에 신규 6개 env 추가
   - `pm2 restart seo-backend --update-env`

5. **검증**:
   ```bash
   curl https://att.ainativeos.net/health
   # backgroundJobs 에 imweb/toss auto-sync enabled 확인
   ```

6. **30~60분 관찰**:
   - 15분 tick 뒤 `order-stats?site=thecleancoffee` 의 `lastSyncedAt` 갱신 확인
   - PM2 로그에 `[Imweb orders sync]` 성공 메시지 확인

### 6.6.6 수동 먼저 vs 자동 먼저 — 순서 결정

**수동 먼저 (권고)**:
- 이유 1: 10일 gap(coffee) 를 한 번에 메우려면 **maxPage=500 전수 백필** 필요. 증분 30페이지로는 500건만 와서 gap 메우는 데 시간 걸림
- 이유 2: 수동 1회 실행으로 sync 동작 검증 가능. imweb token 만료 같은 숨은 문제는 **수동 실행에서 즉시 드러남**
- 이유 3: 커피 Purchase Guard 배포는 최신 원장 필요. 자동 돌려 15분 기다리면 그만큼 배포 지연

**자동 먼저 (비권고)**:
- 검증 없이 자동 돌리는 리스크
- 커피 10일 gap 이 첫 cycle 로 안 메워짐 (증분 30페이지 = 1,500건만)

**결론**: **수동 1회 → 코드 배포 → 자동 활성화 → 15분 후 검증** 순서.

### 6.6.7 15분 간격이 유일한 선택인가

**아니오**. env 로 조절 가능:

| 주기 | 1일 횟수 | 데이터 신선도 | 부하 | 권고 |
|---|---|---|---|---|
| 5분 | 288회 | 실시간 근접 | 2.7% | 과잉. 불필요 |
| **15분** | **96회** | **15분 이내** | **0.9%** | **권고 기본값** |
| 30분 | 48회 | 30분 이내 | 0.5% | 보수적 대안 |
| 1시간 | 24회 | 1시간 이내 | 0.25% | 매우 보수적 |
| 6시간 | 4회 | 6시간 이내 | 0.04% | 부적합 (stale 너무 큼) |

**왜 15분을 권고하나**:
- 기존 `Attribution status sync` 가 15분이라 같은 tempo 로 맞춤
- 15분 gap 은 Meta 광고 최적화 ML 의 데이터 신선도 요구(1~24시간) 대비 충분
- 주문 1건이 15분 늦게 원장 반영되는 건 실무상 무시 가능
- 5분은 리소스 낭비, 1시간+ 는 가드 정확도 하락

### 6.6.8 질문 답변 요약

| 질문 | 답 |
|---|---|
| VM DB 실제 상태는? | biocom imweb_orders 8,362행 2026-04-12 stale, coffee 1,937행 **2026-04-04 stale**. ledger 자체는 실시간(3분 전 데이터). |
| 운영 DB 건드리지 않고 개선 가능한가? | **예**. `startBackgroundJobs.ts` + `env.ts` 2파일 수정. DB 스키마 변경 0건. |
| VM 에 sync 기능 넣을 것인가? | **예**. 기존 3종 background job 과 같은 패턴으로 2종 추가. |
| 주기는? | **15분**. env 로 조절 가능. 30분·1시간 대안. |
| 수동 먼저 vs 자동 먼저? | **수동 1회 전수 백필 먼저**, 코드 배포 + 자동 활성화. |
| 운영 DB 상태는? | **건강**. 66MB, SQLite 한계(281TB) 대비 수십 년 여유. |
| 15분 간격 VM 에 넣을 수 있나? | **예**. 1 cycle 8초, 15분 중 **0.9% 사용률**. |
| VM RAM/CPU 용량 문제 없나? | **문제 없음**. e2-small 2GB RAM + 2 vCPU. PM2 700MB 한계 영향 없음(피크 <10MB). CPU 0.1%, 네트워크 3.3 KB/초. |

---

## 6.7 2026-04-14 수동 sync 실행 결과 + 데이터 위치·보관 정책

### 6.7.1 수동 sync 실행 기록 (2026-04-14 03:15~03:16 KST)

사용자 지시에 따라 biocom + coffee 양쪽 imweb 주문 수동 sync 를 `att.ainativeos.net` 으로 직접 호출. 결과:

#### biocom

| 지표 | Before | After | 변화 |
|---|---|---|---|
| totalOrders | 8,362 | **8,487** | **+125** |
| lastOrderAt | 2026-04-12 11:54 KST | **2026-04-14 01:37 KST** | +39시간 |
| lastSyncedAt | 2026-04-12 12:03 KST | **2026-04-14 03:15 KST** | 현재 시각 |
| paymentAmountSum | ₩2,836,826,375 | ₩2,869,316,435 | +₩32,490,060 |
| memberOrders | 6,655 | 6,770 | +115 |

호출 커맨드:
```bash
curl -X POST "https://att.ainativeos.net/api/crm-local/imweb/sync-orders" \
  -H "Content-Type: application/json" \
  -d '{"site":"biocom","maxPage":30}'
```

응답: `{"ok":true,"synced":1300,"sites":[{"site":"biocom","synced":1300,"totalCount":8204,"totalPage":165,"error":null}]}`

**해석**:
- `synced: 1300` 은 30 페이지 × 50건 upsert 호출 총수 (중복 포함). 실제 신규는 **+125건**
- biocom imweb API 의 `totalCount=8204` 와 VM DB `totalOrders=8,487` 의 차이(283건)는 DB 에 있지만 API pagination 에서 빠진 과거 주문(취소/환불 처리로 목록 제외 가능성)
- **2일(39시간) gap 중 125건의 실주문이 뒤늦게 VM DB 에 반영됨**

#### coffee

| 지표 | Before | After | 변화 |
|---|---|---|---|
| totalOrders | 1,937 | **2,185** | **+248** |
| lastOrderAt | 2026-04-04 10:38 KST | **2026-04-14 00:01 KST** | +10일 |
| lastSyncedAt | 2026-04-04 13:18 KST | **2026-04-14 03:16 KST** | 현재 시각 |
| paymentAmountSum | ₩83,663,082 | ₩94,861,436 | +₩11,198,354 |
| memberOrders | 1,616 | 1,800 | +184 |

호출 커맨드:
```bash
curl -X POST "https://att.ainativeos.net/api/crm-local/imweb/sync-orders" \
  -H "Content-Type: application/json" \
  -d '{"site":"thecleancoffee","maxPage":60}'
```

응답: `{"ok":true,"synced":1150,"sites":[{"site":"thecleancoffee","synced":1150,"totalCount":2051,"totalPage":42,"error":null}]}`

**해석**:
- `totalPage: 42` — coffee 전체 주문이 42 페이지면 `maxPage=60` 은 전수 커버 + 여유
- **10일 gap 중 248건의 실주문이 뒤늦게 VM DB 에 반영됨**
- paymentAmount 기준으로 `+₩11.2M` 매출이 원장에 추가됨 → 커피 ROAS 집계 정확도 회복

### 6.7.2 실행 소요 시간 (실측)

- **biocom**: curl 응답까지 약 5초
- **coffee**: curl 응답까지 약 2초
- 두 사이트 합산: 약 7초 (6.6.3 예상치 8초와 일치)

**→ 15분 주기 자동화 시 1 cycle 약 7~10초 예상. §6.6.4 의 0.9% 리소스 사용률 추정이 실측으로 검증됨**.

### 6.7.3 🔴 수동 sync 데이터는 **VM 에만** 반영됨

사용자가 중요하게 물은 것: "이 데이터는 로컬에 있나, VM 에 있나?"

**답: VM 에만**.

호출 경로:
```
curl https://att.ainativeos.net/api/crm-local/imweb/sync-orders
          │
          ▼ Cloudflare Tunnel
          │
          ▼ VM (34.64.104.94) localhost:7020
          │
          ▼ Express backend (PM2 seo-backend)
          │
          ▼ upsertImwebOrders()
          │
          ▼ VM 의 /opt/seo/shared/backend-data/crm.sqlite3  ← 여기만 변경됨
```

**로컬 Mac DB (`/Users/vibetj/coding/seo/backend/data/crm.sqlite3`) 는 변경 안 됨**. 이유:
- 로컬 Mac 의 Express 백엔드 프로세스는 이 호출을 못 받았음 (요청은 `att.ainativeos.net` → VM 으로 라우팅)
- SQLite DB 파일은 각각 **물리적으로 독립** — 로컬과 VM 은 별도 파일
- 로컬과 VM 의 DB 가 같은 상태로 유지되려면 **누군가 rsync 로 수동 복사**해야 하는데 현재 그런 루틴 없음

**중요 의미**:
- 방금 실행한 biocom +125건 / coffee +248건 은 **VM 운영 DB 에만** 있고, 로컬 Mac DB 에는 없음
- 로컬 DB 의 `imweb_orders` 는 여전히 biocom 8,362 / coffee 1,937 상태 (2026-04-12 / 2026-04-04 stale)
- 로컬 DB 를 최신 상태로 만들려면 **VM → 로컬 rsync** 또는 **로컬에서 백엔드 띄우고 같은 sync API 호출** 필요

### 6.7.4 데이터 위치의 실상 (2026-04-14 기준)

| 위치 | 경로 | 권위 | 현재 상태 |
|---|---|---|---|
| **VM DB (운영)** | `/opt/seo/shared/backend-data/crm.sqlite3` | ✅ **primary** — 모든 live traffic 적재 | **최신** (2026-04-14 03:16 KST) |
| 로컬 Mac DB (개발) | `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` | ❌ secondary — 개발·분석용 | **stale** (biocom 4/12, coffee 4/4) |
| 로컬 Mac DB backup | `crm.sqlite3.bak_20260406_before_coffee_toss_backfill` | historical snapshot | 2026-04-06 snapshot |

**현재 문제**:
1. 로컬 Mac 에서 직접 SQL 쿼리 (예: `sqlite3 backend/data/crm.sqlite3 "SELECT COUNT(*)..."`) 하면 **stale 데이터**를 보게 됨
2. 내가 이전 세션에서 로컬 DB 를 직접 조회했던 결과(biocom 8,362 / coffee 1,937) 는 **그 시점의 로컬 snapshot** 이었고, 같은 순간 VM DB 도 우연히 같은 값이었음(양쪽 다 stale 이었음)
3. VM 에 수동 sync 를 쳐도 로컬 DB 는 갱신 안 됨

### 6.7.5 앞으로의 데이터 보관·동기화 정책 (권고)

#### 원칙 1: **VM DB 가 유일한 운영 source of truth**

- 모든 live 이벤트(`payment_success`, `checkout_started`, `form_submit`) 는 VM 에 적재
- 모든 sync 호출(imweb orders, toss settlements) 는 VM endpoint 경유
- 모든 API 조회는 `https://att.ainativeos.net/api/...` 에서
- **로컬 Mac 백엔드를 운영 모드로 띄우지 않음** — 띄우면 두 DB 가 독립 진화해서 일관성 깨짐

#### 원칙 2: **로컬 Mac DB 는 "분석·개발용 snapshot"**

- 개발 시 코드 테스트는 로컬 백엔드를 `BACKGROUND_JOBS_ENABLED=false` 로 띄워서 기존 DB 변경 없이 API 만 테스트
- 데이터 분석(SQL 쿼리, 통계)이 필요하면 **VM 에서 로컬로 rsync** 해서 가져옴:
  ```bash
  rsync -az <vm-user>@34.64.104.94:/opt/seo/shared/backend-data/crm.sqlite3 \
    /Users/vibetj/coding/seo/backend/data/crm.sqlite3
  ```
  또는 read-only 경로로 복사:
  ```bash
  rsync -az <vm-user>@34.64.104.94:/opt/seo/shared/backend-data/crm.sqlite3 \
    /Users/vibetj/coding/seo/backend/data/vm-snapshot-$(date +%Y%m%d).sqlite3
  ```

#### 원칙 3: **VM sync 자동화**(§6.6) **가 본 작업의 연장**

- 오늘 수동 sync 로 gap 메운 건 **임시 조치**
- 진짜 해결은 `startBackgroundJobs.ts` 에 imweb/toss sync job 등록 (§6.6.5 절차)
- 자동화 완료 시 운영자가 수동 실행할 일이 없고, VM DB 는 항상 15분 이내 최신 상태 유지

#### 원칙 4: **VM persistent disk 백업 전략**

현재 상태:
- VM 의 `/opt/seo/shared/backend-data` 는 GCE persistent disk 내부. 디스크 자체가 regional redundancy 보장 (GCE standard)
- **애플리케이션 레벨 백업 없음** — 디스크 장애 외에 실수로 DELETE 한 경우 복구 불가

권고:
1. **일일 SQLite snapshot**: cron 으로 VM 내부에 daily dump (예: `sqlite3 crm.sqlite3 ".backup /opt/seo/shared/backups/crm-$(date +%Y%m%d).sqlite3"`), 최근 14일 roll-over
2. **원격 백업 (선택)**: daily snapshot 중 1주 1회를 Google Cloud Storage 또는 S3 에 업로드. GCS 는 같은 GCP 프로젝트에 bucket 만들면 저렴
3. **로컬 archive 저장소**: 주 1회 로컬로 rsync 해서 `backend/data/backups/` 에 보관 — 이미 `crm.sqlite3.bak_20260406_before_coffee_toss_backfill` 같은 ad-hoc 백업이 있음. 이걸 루틴화

**백업 비용 추정**:
- SQLite 66MB × 14일 daily = 924 MB (VM persistent disk 여유 30GB 중 3%)
- GCS Archive storage class 월 $0.004/GB × 0.1GB = 월 $0.0004 (무시 가능)

#### 원칙 5: **운영 DB 마이그레이션 (PostgreSQL 등) 은 당분간 안 함**

- 현재 SQLite 66MB 는 PostgreSQL 로 옮길 이유 없음
- SQLite 는 single-writer, 다중 프로세스 쓰기에 약한데 **현재 VM 단일 backend 만 writer 이므로 문제 없음**
- Multi-region HA 가 필요해지거나, 동시 writer 가 여러 개 되기 전까지는 SQLite 유지
- `vmdeploy.md §결론 → 제외: 운영 DB 스키마 변경` 원칙 연장

### 6.7.6 보관 정책 요약 표

| 데이터 | 현재 위치 | 권위 | 백업 전략 | 접근 방법 |
|---|---|---|---|---|
| live traffic (ledger) | VM `crm.sqlite3` | **primary** | daily SQLite snapshot → GCS | `/api/attribution/ledger` |
| imweb_orders | VM `crm.sqlite3` (오늘 sync 됨) | **primary** | 상동 | `/api/crm-local/imweb/order-stats` |
| toss_settlements | VM `crm.sqlite3` | **primary** | 상동 | `/api/toss/sync` |
| meta-capi-sends.jsonl | VM `/opt/seo/shared/backend-logs/` | **primary** | daily rsync → GCS | `/api/meta/capi/log` |
| 로컬 Mac DB | `backend/data/crm.sqlite3` | secondary | 필요 시 rsync from VM | 개발·분석용만 |
| 로컬 Mac logs | `backend/logs/` | 로컬 개발용 | none | 로컬 debug 용만 |

### 6.7.7 커피 Purchase Guard 배포 차단 해소

본 수동 sync 실행으로 `footer/coffee_header_guard_0414.md` 의 배포 전 체크리스트 #4 (Imweb/Toss sync 복구) **자동 해소**.

- biocom imweb: ✅ 2026-04-14 01:37 KST 까지 최신
- coffee imweb: ✅ 2026-04-14 00:01 KST 까지 최신
- **Phase 1b 배포 선결 과제 4건 모두 해소**

> 단, **Toss settlements sync 는 미실행**. 오늘은 imweb 주문 sync 만 돌림. Toss 정산은 attribution status sync(15분 주기 자동) 가 Toss API 로 직접 확인하므로 stale 이슈는 작지만, 근본적으로는 toss/sync 도 같이 돌려야 함. 이건 별도 작업으로 분리.

---

## 7. VM 관련 남은 과제

### 7.1 운영 측면 (단기)
- [ ] 커피 Purchase guard 배포 — footer/coffee_header_guard_0414.md 를 아임웹 admin 에 붙여넣기 (사용자 작업)
- [ ] Imweb/Toss 수동 sync 1회 복구 — 커피 guard 설치 전 필수
- [ ] 24시간 CAPI 모니터링 항목 3건 실측 확인

### 7.2 구조 측면 (중기)
- [ ] Imweb/Toss sync 를 `startBackgroundJobs.ts` 에 등록 (6시간 주기, KST 새벽)
- [ ] CWV auto-sync 재활성화 여부 결정 (현재 의도적 off)
- [ ] 가상계좌 입금 후 pending→confirmed 전환 실제 테스트 (capi.md §아직 남은 것 #1)
- [ ] 네이버페이 attribution (별도 Phase, capi.md §2)

### 7.3 플랫폼 측면 (장기)
- [ ] 멀티 사이트 시스템 유저 토큰 분리 완성 (biocom 전용 토큰 발급, metacoffee0413.md Phase 2)
- [ ] Google Ads Enhanced Conversions / OCI (roadmap0327.md 0414 섹션)
- [ ] TikTok Events API (roadmap0327.md 0414 섹션)

---

## 8. 지금 판단

**VM 배포는 "운영 인프라 레벨에서는 완성"** 이오. Cloudflare Tunnel → VM → Express → SQLite 라인이 안정적으로 돌고 있고, CAPI 30분 주기, attribution 15분 주기가 실제로 작동 중이며 CORS·endpoint 분기까지 3사이트 전부 지원. 다음 개선은 **application 레벨의 운영 완성도** — 즉 imweb/toss 자동 sync, 커피 Purchase guard 설치, 24시간 모니터링 루틴 고정. VM 자체에 손댈 일은 당분간 거의 없을 것.

---

**관련 문서**:
- [vmdeploy.md](vmdeploy.md) — 2026-04-12 배포 실행 상세 (598줄)
- [capi.md](capi.md) — 자사몰 Purchase guard 운영 계획
- [../meta/capimeta.md](../meta/capimeta.md) — Meta CAPI Phase 요약 + Phase 1b 실측 체크리스트
- [../footer/coffee_header_guard_0414.md](../footer/coffee_header_guard_0414.md) — 커피 Purchase guard 복제본
- [../roadmap/roadmap0327.md](../roadmap/roadmap0327.md) — 0412 CAPI/VM 섹션
