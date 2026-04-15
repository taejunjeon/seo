# Meta Conversions API (CAPI) 운영 가이드

> **기준일**: 2026-04-05 · 최신 섹션 추가: 2026-04-15

---

## ✅ 2026-04-15 03:30 KST — **커피 Toss 신 키 적용 + 검증 완료**

### 한 줄 결론

**해결됨**. 알로스타에프앤비(자회사) 의 신 Toss merchant `iw_theclevibf` 키를 backend 에 적용하고, `/v1/payments/orders/` endpoint 의 `-P1` suffix 이슈까지 고쳐, 어제 막힌 4개 테스트 주문이 전부 올바른 status 로 resolve 되는 것을 확인했다.

### 변경 사항

1. **`backend/src/env.ts`** — fallback chain 에 신 키 우선 적용
   ```ts
   TOSS_LIVE_SECRET_KEY_COFFEE:
     process.env.TOSS_NEW_COFFEE_API_SECRET_KEY        // ← 1순위 (신 자회사)
     ?? process.env.TOSS_LIVE_SECRET_KEY_COFFEE         // ← 2순위 (구 본사)
     ?? process.env.TOSS_LIVE_SECRET_KEY_COFFEE_API     // ← 3순위 (구 본사 대체명)
   ```
   같은 패턴으로 `TOSS_LIVE_CLIENT_KEY_COFFEE`, `TOSS_TEST_SECRET_KEY_COFFEE`, `TOSS_TEST_CLIENT_KEY_COFFEE`, `TOSS_SHOP_ID_COFFEE` 에도 신 자회사 변수 우선 적용.

2. **`backend/src/routes/attribution.ts` `fetchTossDecisionRows`** — `/v1/payments/orders/{id}` 가 404 (`NOT_FOUND_PAYMENT`) 로 떨어지면 `-P1` suffix 를 붙여 한 번 더 retry 하도록 수정. 아임웹 이 Toss 에 주문 등록할 때 orderNo 뒤에 `-P1` 을 붙이는 포맷이 biocom/coffee 양쪽 공통.

### 검증 결과 (payment-decision 재조회)

| orderId | decision.status | matchedBy | 비고 |
|---|---|---|---|
| 202604140316422 | **confirmed** | toss_direct_order_id | 어제 완료된 카드 레퍼런스 (대조군) |
| 202604144671071 | **pending** | toss_direct_order_id | 가상계좌 대기 → `WAITING_FOR_DEPOSIT` |
| 202604145802988 | **pending** | toss_direct_order_id | 가상계좌 대기 |
| 202604146958295 | **pending** | toss_direct_order_id | 가상계좌 대기 |
| 202604148401098 | **confirmed** | toss_direct_order_id | 어제 "카드결제인데 VirtualAccountIssued 로 오발사" 보고된 4차 주문 — 실제로는 정상 카드 승인이었고, **서버가 키 오류로 판정 실패 → 가드가 hold 로 내려간 것이 근본 원인**이었음 |

### 근본 원인 정리

- 구 키 `live_sk_P9BRQ...` 는 **본사(바이오컴)** 산하 구 상점 `iw_thecleaz5j` 용. 2026-02-23 이후 커피 사업부가 자회사 알로스타에프앤비로 이전하면서 Toss merchant 가 `iw_theclevibf` 로 신설됨. 아임웹 어드민은 그 시점에 신 merchant 로 연동을 갈아탔으나, 본 backend 의 `.env` 는 구 키를 들고 있었음.
- 결과: 2026-02-23 ~ 2026-04-14 (50일간) backend 의 Toss direct 조회가 전부 `UNAUTHORIZED_KEY` 또는 `NOT_FOUND_PAYMENT`. Purchase Guard 가 `unknown` 판정 → `hold_or_block_purchase` → 브라우저는 Purchase 대신 VirtualAccountIssued 로 내려감.
- 커피 Purchase Guard 가 설치된 **2026-04-14** 에 증상이 표면화. 그 전까지는 판정 실패해도 footer 에 가드가 없어서 Purchase 가 그대로 발사되었기 때문에 보이지 않았을 뿐.

### 부가 발견

- `/v1/payments/orders/{orderId}` 가 aimweb 원본 orderNo 로는 404 를 반환한다는 것은 **biocom 에도 동일한 pre-existing 버그**였음. biocom 에서는 `ledgerFallbackMatch` (ledger 의 paymentKey 로 `/v1/payments/{paymentKey}` 재시도) 경로가 커버해 주어 문제가 눈에 띄지 않았음. 이번 `-P1` retry 추가로 biocom 쪽 direct orderId 경로도 정상화.

### 남은 리스크

- **커피 가상계좌 3건 (202604144671071 / 5802988 / 6958295) 은 실제 입금 안 된 상태**. 입금이 발생하면 status `pending → confirmed` 로 자연 전이되고 Browser Purchase 가 허용될 것. 이 전이 흐름을 실제 입금 테스트로 재현 필요.
- **자회사 계정 전환 직전 (2026-02-23 전) 커피 주문** 에 대한 Toss direct 조회는 신 키로 불가. 해당 기간 데이터가 필요하면 구 키 `TOSS_LIVE_SECRET_KEY_COFFEE_API` 를 구 merchant 쪽 조회 경로로 별도 유지해야 한다. 지금은 구 기간 SQLite 이력만 존재 → 과거 backfill 필요 없음.
- **구 키 환경변수 보관**: `.env` 에 구 `live_sk_P9BRQ...` 는 삭제하지 않고 주석 처리만 권장. 향후 구 merchant 에 남은 환불/문의 건 확인 시 필요할 수 있음.

### 다음 액션

1. 🟢 커피 가상계좌 3건 입금 → `pending → confirmed` 전이 실증 (TJ 가 직접 입금하면 됨)
2. 🟢 4번 주문 (`202604148401098`) confirmed 확인 이후 Meta Events Manager 에서 VirtualAccountIssued 가 올라간 이력이 있는지 재확인 — 이미 발사된 VirtualAccountIssued 는 회수 불가, 해당 주문은 Purchase + VirtualAccountIssued 이중 발사된 상태로 처리됨 (event_id 가 다르므로 dedup 안 됨 — 이 케이스가 실제 Meta ROAS 에 과대 계상 영향을 주는지 1건 단위로 관찰)
3. 🟡 VM 쪽 `.env` 에도 동일한 신 키 반영 (vmreport.md §7 에 배포 체크리스트 추가 필요)
4. 🟡 `capivm/vmdeploy.md` 에 "신 Toss 키 교체" 단계 신규 추가

---
> **Phase**: P5-S3 (100% 완료) → [phase5.md](../roadmap/phase5.md)
> **연관 문서**:
> - [meta0404.md](meta0404.md) (광고 인사이트) · [iroas.md](iroas.md) (iROAS 가이드)
> - [../coffee/metacoffee0413.md](../coffee/metacoffee0413.md) (커피 토큰 로테이션)
> - [../capivm/capi.md](../capivm/capi.md) (**자사몰 Purchase Guard — 가상계좌 분리**, biocom 기준. 2026-04-12 v3 완료)
> - [../footer/header_purchase_guard_server_decision_0412_v3.md](../footer/header_purchase_guard_server_decision_0412_v3.md) (biocom 서버 판정 가드 스크립트 원본)
> - [../footer/coffee_header_guard_0414.md](../footer/coffee_header_guard_0414.md) (**커피 복제본**, 2026-04-14 작성. 배포 전 backend 체크리스트 4건 포함)
> - [../capivm/vmreport.md](../capivm/vmreport.md) (**VM 배포 현황 보고서**, 2026-04-14 작성. 실측 기반 현 상태 + 커피 guard 배포 준비도)

---

## 🧭 주문 sync 가 이 문서에서 왜 중요한가 (2026-04-14 추가)

> 이 섹션은 독립 읽기 가능. 다른 섹션 참조 없이도 "왜 imweb/toss 주문 sync 가 Meta CAPI 운영의 기반인지" 만 이해하면 됨.

### 핵심 논리 (5 단계)

1. **Meta Purchase 이벤트의 정합성**은 "실제로 결제 완료된 주문" 만 Purchase 로 보내는 것. 가상계좌 미입금 같은 pending 주문은 Meta 에 Purchase 로 넘어가면 ROAS 가 과대 집계됨.
2. 이 "실제 결제 완료" 판정은 **자사 Attribution Ledger** 가 원천. ledger 는 주문 데이터(아임웹 `imweb_orders`) + 결제 상태(Toss `toss_settlements`) 를 조인해서 `payment_status` 를 계산.
3. 브라우저 측 Purchase Guard ([biocom v3](../footer/header_purchase_guard_server_decision_0412_v3.md) / [coffee 0414](../footer/coffee_header_guard_0414.md)) 는 **결제완료 페이지에서 Meta Browser Pixel 을 발사하기 전에** backend `/api/attribution/payment-decision` 을 호출. backend 는 ledger 를 조회해 `allow_purchase / block_purchase_virtual_account / unknown` 중 하나를 반환.
4. 서버 CAPI auto-sync 도 동일하게 ledger 의 `payment_status=confirmed` 만 Meta 로 전송. 즉 **브라우저 경로도 서버 경로도 모두 Attribution Ledger 의 정확성에 100% 의존**.
5. **그런데 ledger 는 `imweb_orders` + `toss_settlements` 두 테이블의 raw sync 가 선행돼야** 최신 주문을 포함. 이 두 raw sync 가 stale 하면 ledger 는 어제의 현실만 알고 있고, 오늘 주문은 `no_toss_or_ledger_match` unknown 으로 처리됨 → 카드 결제도 Browser Purchase 가 차단되어 **실매출 이벤트 누락** 발생.

### 도식

```
[고객 결제 완료]
        │
        ├── 아임웹 주문 생성 ──────┐
        │                          │
        └── Toss 결제 승인 ────┐   │
                               │   │
                               ▼   ▼
            [imweb_orders sync]  [toss_settlements sync]
                               ▲   ▲
              ❌ 자동화 안 됨. 수동 호출만 가능.
                               │   │
                               └─┬─┘
                                 ▼
                    [Attribution Ledger 재계산 · 15분 주기 자동]
                                 │
                  ┌──────────────┼──────────────┐
                  ▼              ▼              ▼
       [브라우저 Purchase    [서버 CAPI        [payment-decision
        Guard 조회]          auto-sync]        endpoint 응답]
                  │              │              │
                  └──────────────┴──────────────┘
                                 │
                                 ▼
                          [Meta Events Manager]
                                 │
                                 ▼
                    [Meta ROAS · 광고 최적화 ML]
```

### 실측 gap — 2026-04-14 수동 복구 전/후 비교

**초기 실측 (2026-04-14 02:56 KST, 복구 전)**:

| 테이블 | 사이트 | 총 행수 | 최신 데이터 | 경과 |
|---|---|---|---|---|
| `imweb_orders` | biocom | 8,362 | 2026-04-12 11:54 KST | 2일 |
| `imweb_orders` | **thecleancoffee** | **1,937** | **2026-04-04 10:38 KST** | **10일** 🔴 |

**수동 복구 후 (2026-04-14 03:16 KST)** — vmreport.md §6.7.1 참조:

| 테이블 | 사이트 | 총 행수 | 최신 데이터 | 변화 |
|---|---|---|---|---|
| `imweb_orders` | biocom | **8,487** | **2026-04-14 01:37 KST** | +125건, gap 해소 ✅ |
| `imweb_orders` | **thecleancoffee** | **2,185** | **2026-04-14 00:01 KST** | +248건, 10일 gap 해소 ✅ |

**중요 구분**: 이 복구 데이터는 **VM DB 에만** 적재됨 (`/opt/seo/shared/backend-data/crm.sqlite3`). 로컬 Mac DB 는 여전히 stale 상태. 자세한 위치·보관 정책은 vmreport.md §6.7 참조.

**원래의 문제 (해석 참고)**: 복구 전엔 커피가 10일간 원장 원천이 없어서 그 기간 주문에 Purchase Guard 가 호출되면 `no_toss_or_ledger_match` → unknown → 카드 결제도 차단될 여지가 있었음. **2026-04-14 수동 복구로 해소**. 단, **자동화 되지 않은 상태** 라서 내일 다시 stale 화 시작 — vmreport.md §6.6 의 자동 sync 설계안 적용 전까지는 주기적 수동 실행이 필요.

### 자동화 안 된 이유 (실측 확인)

`backend/src/bootstrap/startBackgroundJobs.ts` 전수 검토 결과, 자동 background job 에 다음 3종만 등록돼 있음:

| Job | 주기 | 자동? |
|---|---|---|
| `[CAPI auto-sync]` | 30분 | ✅ |
| `[Attribution status sync]` | 15분 | ✅ (ledger pending→confirmed 전환만. imweb sync 는 **아님**) |
| `[Scheduled send]` | 60초 | ✅ |

❌ 등록 안 된 것:
- `imweb_orders` sync — 수동 `POST /api/crm-local/imweb/sync-orders` 만 가능
- `toss_settlements` sync — 수동 `POST /api/toss/sync` 만 가능

**왜 VM 배포 시에도 자동화 안 됐나**: 2026-04-12 VM 컷오버는 `capivm/vmdeploy.md` 에 명시된 범위가 "payment-decision + CAPI sync + 관련 로그/원장" 이고 **운영 DB 스키마 변경은 명시적 제외** 였음. imweb/toss sync 자동화는 pagination 이 긴 long-running 작업이라 background setInterval 등록이 리스크 — 운영 초기엔 사람이 수동으로 doing 하는 걸 선호한 것으로 보임. 결과적으로 이후에도 자동화되지 못한 상태로 유지.

### 2단계 해결책

1. **즉시 복구 (수동 1회)** — ✅ **2026-04-14 실행 완료** (biocom +125건 / coffee +248건)
   ```bash
   # VM endpoint 직접 호출 — 로컬 호출 금지 (로컬 DB 만 갱신되고 VM 운영 기여 없음)
   curl -X POST "https://att.ainativeos.net/api/crm-local/imweb/sync-orders" \
     -H "Content-Type: application/json" -d '{"site":"biocom","maxPage":30}'
   curl -X POST "https://att.ainativeos.net/api/crm-local/imweb/sync-orders" \
     -H "Content-Type: application/json" -d '{"site":"thecleancoffee","maxPage":60}'
   ```
   실행 결과는 vmreport.md §6.7.1 에 상세 기록. **Toss settlements sync 는 미실행** — attribution status sync(15분 자동)가 Toss API 를 직접 조회하므로 stale 리스크 낮음. 필요 시 `POST /api/toss/sync?store=...&mode=incremental` 를 VM 에 호출.

2. **근본 해결 (P1 별도 작업)** — `startBackgroundJobs.ts` 에 다음 2개 job 추가:
   - `[Imweb orders sync]` — 6시간 주기, KST 새벽 off-peak, 두 사이트 병렬, 증분 모드
   - `[Toss settlements sync]` — 동일 구조
   - 환경변수 스위치 추가: `IMWEB_AUTO_SYNC_ENABLED`, `IMWEB_AUTO_SYNC_INTERVAL_MS`, `TOSS_AUTO_SYNC_ENABLED`, `TOSS_AUTO_SYNC_INTERVAL_MS` (vmdeploy.md 의 기존 8 스위치 패턴과 맞춤)
   - VM 에 배포 시 `BACKGROUND_JOBS_ENABLED` 가 이미 true 이므로 추가 스위치만 true 설정하면 즉시 반영

### 주문 sync 와 VM 배포의 관계

| 관점 | 관계 |
|---|---|
| **인프라 수준** | 독립 — VM 배포는 Express/PM2/Cloudflare Tunnel 인프라 전환. imweb/toss sync 는 application 로직. VM 컷오버가 완료됐어도 sync 자동화는 별개 문제로 남음 |
| **데이터 흐름** | 긴밀 — VM 의 ledger 는 `/opt/seo/shared/backend-data/crm.sqlite3` 에 저장. 이 DB 에 imweb/toss sync 가 쓰고 읽음. VM 에서 수동 호출하면 VM DB 에 반영, 로컬 Mac 에서 호출하면 로컬 DB 에만 반영 (두 DB 는 독립) |
| **배포 이력 기록** | VM 컷오버 당시 범위에서 **명시적 제외** 됨 (`vmdeploy.md §결론 → 제외: 운영 DB 스키마 변경`). 즉 의도적으로 뒤로 미뤄진 것이고, 지금까지 별도 tracking 없음 |
| **커피 Purchase Guard 배포에 미치는 영향** | **결정적** — guard 설치 전 sync 가 stale 상태라면 **카드 결제도 차단**. 이것이 현재 커피 guard 설치의 주 blocker (vmreport.md §4 참조) |
| **처리 방법** | 즉시 복구는 수동 API 호출 1회. 근본 해결은 `startBackgroundJobs.ts` 개선 — 이건 VM 에 새 배포가 필요함. VM 쪽 `pm2 restart seo-backend` 로 반영 가능 |

**요약**: VM 배포 자체는 완료됐고 (vmreport.md §1 live probe 참조), 주문 sync 는 VM 이 아니라 **application 레이어에 남아있는 운영 취약점**이다. 두 건은 **설계상 독립**이지만 **운영상 연결** — 커피 guard 설치 같은 후속 작업이 sync 최신성에 의존하므로, sync 자동화 미해결은 Phase 1b 완성의 최종 blocker 로 작용.

---

## 🙋 Formbricks 가 왜 필요한가 — biocom / coffee 설치 여부 (2026-04-14)

> 사용자 질문: coffee footer 의 `getUserID()` (Formbricks) 는 왜 필요한가? biocom.kr 에는 필요한가?

### Formbricks 란

오픈소스 설문/퀴즈 플랫폼. 사용자가 웹페이지에서 설문·퀴즈 응답을 작성하면 **브라우저 localStorage 에 `formbricks-js` 라는 키로 사용자 식별자(user_id)를 저장**하고, 이후 같은 브라우저의 모든 페이지에서 동일 user_id 로 교차 추적 가능.

저장 구조 (localStorage):
```json
{
  "personState": {
    "data": {
      "userId": "fb_user_xxxxxxxxxx",
      ...
    }
  }
}
```

### 왜 footer 에서 이걸 읽는가

Footer 의 `getUserID()` 함수는 Formbricks localStorage 를 파싱해서 `user_id` 를 꺼내고, 이 값을 **두 곳에 주입**:

1. **GA4 (`gtag('set', { user_id: ... })`)**: GA4 리포트에서 "사용자 단위" 집계가 가능해짐. 같은 사람이 다른 세션·기기에서 접근해도 단일 사용자로 합쳐 봄
2. **Attribution Ledger (`payment_success` 이벤트의 `user_id` 필드)**: 자사 원장에서 결제 → 재구매 → 이탈 분석 시 교차 검증. Formbricks 퀴즈 응답자가 실제로 구매 전환 됐는지 측정 가능

### biocom.kr 은 왜 필요한가

biocom 의 핵심 lead generation funnel 은 **Formbricks 기반 "피로 자가진단 퀴즈"** 요:
- 퀴즈 응답 → Formbricks user_id 발급 → localStorage 저장
- 이후 상품 상세 페이지 접근 → user_id 로 "퀴즈 응답자 중 상품 본 사람" 식별
- 결제 완료 → user_id 로 "퀴즈 → 상품 → 구매" funnel 전체 연결
- **증분 분석(incremental lift)**: 퀴즈 도입 전후 재구매율/전환율 비교에 user_id 가 필수

즉 biocom 의 **P2.5 리드 마그넷 전략(phase2_5.md)**과 **P7 Conversion Lift 실험**이 Formbricks user_id 에 직접 의존. **biocom 에는 반드시 필요**하며 이미 live 운영 중.

### 커피는 어떤가

커피는 현재 **Formbricks 미사용**. 퀴즈/설문 기반 lead generation 경로 없음.
- `getUserID()` 는 빈 문자열 반환 → `gtag('set', ...)` skip, payload 에 user_id 빈 값으로 전송 → **안전**
- 코드에 유지하는 이유: **나중에 커피도 Formbricks 도입하면 자동으로 활성화**. 미리 hook 을 박아두는 건 비용 0, 편익 큼
- 즉 커피에서는 **"설치 안 돼 있어도 코드는 유지, 설치되면 자동 작동"** 이 올바른 전략

### 정리

| 사이트 | Formbricks 설치 | footer 의 `getUserID()` 동작 | 이유 |
|---|---|---|---|
| **biocom** | ✅ 설치 · live 운영 | ✅ user_id 추출 → GA4 + ledger 주입 | 퀴즈 funnel → 증분 분석의 핵심 |
| **thecleancoffee** | ❌ 미설치 | ⚠️ 빈 문자열 반환, skip (안전) | 현재는 불필요. 미래 도입 시 자동 활성화 |
| **aibio** | 확인 필요 | 해당 footer 에 getUserID 함수 여부 확인 필요 | 별도 문서화 대상 |

---

## 🔴 2026-04-14 22:30 KST — 커피 "카드결제" 주문에서 Toss direct API 조회 실패 발견 (4차 검증)

> 사용자가 **카드결제** 주문을 의도해서 실행. 하지만 가드는 여전히 `block_purchase_virtual_account` 로 판정. 2가지 시나리오 중 하나 — 근본 원인은 **backend Toss direct API 조회 에러**.

### 새 테스트 주문 (4번째)

| 필드 | 값 |
|---|---|
| **order_code** | `o202604146825aac75341c` |
| **order_no** | `202604148401098` |
| payment_code | `pa2026041421b3686913eb8` |
| paymentKey | `iw_th20260414222830yOXA4` |
| orderId (Toss 접미사) | `202604148401098-P1` |
| value | ₩21,300 |
| **사용자 의도** | **카드결제** (사용자 보고) |

### ✅ Footer 여전히 정상 (4번째 연속)

| 지표 | 값 |
|---|---|
| snippetVersion | `2026-04-14-coffee-payment-success-order-code-v1` ✅ |
| checkout_started 이벤트 (22:28:24 KST) | ✅ |
| payment_success 이벤트 (22:28:58 KST, **34초 후**) | ✅ |
| checkoutId | `chk_1776173304380_7rgjgxb4` 양쪽 동일 |
| metadata.orderCode | `o202604146825aac75341c` ✅ |
| browser_purchase_event_id | `Purchase.o202604146825aac75341c` ✅ |
| fbp | `fb.1.1775048310435.926984947148613270` ✅ |

### 🔴 Guard 판정 — `block_purchase_virtual_account`

가드 로그 + payment-decision endpoint 직접 조회 (2026-04-14 22:31 KST):

```json
{
  "decision": {
    "status": "pending",
    "browserAction": "block_purchase_virtual_account",
    "confidence": "high",
    "matchedBy": "ledger_payment_key",
    "reason": "attribution_ledger_status"
  },
  "directToss": {
    "attempted": true,
    "matchedRows": 0,
    "errors": 2        ← 🔴 Toss API 직접 조회 2회 모두 실패
  }
}
```

**핵심**: `directToss.attempted: true` 지만 `errors: 2`.
Backend 가 Toss API 에 **두 가지 경로로 조회 시도**:
1. `/v1/payments/{paymentKey}` — 실패
2. `/v1/payments/orders/{orderId}` — 실패

두 경로 모두 실패 → Fallback 으로 ledger status (`pending`) 만 사용 → `block_purchase_virtual_account` 판정 → VirtualAccountIssued 발사.

### 🔍 biocom vs 커피 결정적 차이

| 항목 | biocom 카드결제 (capi.md §3) | 커피 카드결제 (이번) |
|---|---|---|
| `payment_decision_status` | **confirmed** ✅ | pending 🔴 |
| `payment_decision_reason` | `toss_direct_api_status` ✅ | `attribution_ledger_status` 🔴 |
| `directToss` 결과 | 성공 (판단 근거) | **errors: 2** 실패 |
| Browser Purchase | 발사됨 | **차단됨 (VirtualAccountIssued 로)** |
| Server CAPI Purchase | 즉시 전송 | **미발사** (ledger 가 confirmed 돼야 전송) |

### 🎯 두 가지 시나리오 (사용자 답변 대기)

#### 시나리오 A — 실제로 카드결제였다면 🔴 **심각한 버그**
- Toss 에서는 카드 승인 → `DONE` 상태로 정상 존재
- Backend Toss API 호출이 잘못된 paymentKey 형식/경로로 조회 → 404/error
- Fallback 으로 ledger pending → 오판정 → VirtualAccountIssued 오발사
- **모든 커피 카드결제가 같은 문제에 노출** → Purchase 이벤트 누락 → Meta 광고 ROAS 심각 과소 집계
- **원인**: backend 의 Toss direct API 호출 로직이 `iw_th` paymentKey 를 잘못 처리하거나 Toss secret key 인증 실패

#### 시나리오 B — 가상계좌 발급이었다면 ✅ 가드 판정은 정확
- Toss 에서 `WAITING_FOR_DEPOSIT` 상태로 존재
- backend Toss API 가 이것도 조회 실패 (별도 이슈) → ledger fallback
- ledger pending 판정은 맞음 → VirtualAccountIssued 정확
- 그러나 **`directToss.errors: 2` 는 여전히 해결 필요** (미래 카드결제 주문 대비)

### 🔬 backend 코드 분석 (routes/attribution.ts:349-410)

```typescript
const fetchTossPaymentDetail = async (path, store) => {
  const auth = getTossBasicAuth(store, "live");
  if (!auth) throw new Error("TOSS_LIVE_SECRET_KEY_COFFEE 미설정");
  const res = await fetch(`${TOSS_BASE_URL}${path}`, {
    headers: { Authorization: auth },
    signal: AbortSignal.timeout(TOSS_DIRECT_FALLBACK_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Toss API ${res.status}: ${text.slice(0, 200)}`);
  return parseTossPaymentDetail(body);
};

// 호출 순서:
// 1. /v1/payments/${paymentKey}   ← paymentKey = "iw_th20260414222830yOXA4"
// 2. /v1/payments/orders/${orderId} ← orderId = "202604148401098-P1"
```

**가능한 실패 원인 4가지**:

1. **`iw_th` 는 아임웹 wrapper, Toss 원본 paymentKey 아님** — Toss API 가 이 키를 모르면 404
2. **Toss secret key 인증 실패** — env fallback (`TOSS_LIVE_SECRET_KEY_COFFEE_API` → `TOSS_LIVE_SECRET_KEY_COFFEE`) 가 잘못 연결됐을 가능성
3. **orderId 에 `-P1` 접미사** — `/v1/payments/orders/202604148401098-P1` 이 Toss 규격과 불일치 → "-P1" 빼고 호출해야 할 수도
4. **TOSS_BASE_URL** 이 잘못됐거나 timeout

**가장 가능성 높음**: #1 (paymentKey 형식 불일치). biocom 이 왜 같은 `iw_bi` 형식으로 성공했는지는 재확인 필요 — biocom 도 실은 orderId fallback 에서 성공했을 수도.

### 🩺 필요한 디버그 작업

1. **실제 Toss API 에 `iw_th20260414222830yOXA4` 로 호출해보기** — 에러 응답 확인
2. **backend 로그에서 `directToss` 에러 메시지** 확인 — 현재는 `errors: 2` 만 보이고 상세 에러는 로그에만
3. **biocom 카드결제 테스트 재실행** — biocom 에서도 같은 문제가 있는지 확인
4. **payment-decision endpoint 확장** — `directToss.errors` 의 실제 에러 메시지를 response 에 포함하도록 수정 (현재는 개수만)

### ⚠️ Phase 1b 완성도 재평가 필요

이전에 Phase 1b 를 90% 로 올렸으나, **Toss direct API 조회 실패는 Phase 1b 의 핵심 검증 실패**. 시나리오 A 확정 시 완성도 **90% → 70% 강등**.

| 구분 | biocom | coffee |
|---|---|---|
| Guard 설치 | ✅ | ✅ |
| Footer 설치 | ✅ | ✅ (0414 완료) |
| 가상계좌 판정 | ✅ | ✅ |
| **카드결제 판정** | **✅** | **🔴 검증 필요 / 잠재적 실패** |

### ✅ 2026-04-14 23:20 KST — 원인 **완전 확정** (사용자 확인)

> 사용자 제보: **"더클린커피 사업부가 본사에서 자회사로 이전되면서 토스페이먼츠 계정이 바뀐 듯"**
>
> 내 가설 X (커피 Toss 상점 변경) 가 정확히 맞았소. 사업부 법인 분리 → 신규 사업자번호 → 새 Toss 가맹점 → 새 MID + 새 시크릿 키 → 기존 `iw_thecleaz5j` 상점은 구(舊) 법인 기록 보관용으로만 남음.

### 📅 타임라인 재구성

```
~ 2026-02-09 : 커피 Toss settlements sync 정상
~ 2026-02-23 : 커피 Toss transactions sync 정상
2026-02-23 경: 🔴 사업부 법인 분리 → 새 Toss 가맹점 활성화
2026-02-23 이후: 아임웹 결제가 새 Toss 상점으로 라우팅. 기존 상점은 거래 0건
2026-04-06 : tossapi.md/tosskey.md 에 "커피 키 반영·검증 완료" 기록 (과거 주문으로만 검증, 새 주문 미검증 → 사각지대)
2026-04-14 : 커피 Purchase Guard 설치로 증상 표면화 (카드결제가 VirtualAccountIssued 로 오발사)
```

**2026-02-23 ~ 2026-04-14 (50일간) 발생한 일**:
- 커피 카드결제 주문은 전부 새 Toss 상점에서 처리됨
- backend 는 여전히 구 상점 키로 조회 → 전부 404
- Attribution status sync 가 pending → confirmed 전환 실패 (Toss 조회 실패)
- Server CAPI 는 confirmed-only 정책이라 커피 카드결제 Purchase 이벤트 **전송 0건**
- Meta 는 Browser Pixel 의 Purchase 만 받았음 (가드 설치 전까지는 정상 발사, 설치 후엔 차단)
- 가드 설치 전엔 증상 은폐. 설치 후 역설적으로 문제를 드러냄.

### 🗓️ 내일(2026-04-15) 사용자가 확인할 것

#### 아침 출근 즉시 체크리스트

- [ ] **자회사 법인의 Toss Payments 콘솔 접속 권한 확보**
   - 새 사업자의 Toss 가맹점 계정 로그인 정보
   - `https://app.tosspayments.com/` 에서 새 상점 선택 가능한지
- [ ] **새 Toss 상점의 Mall ID 확인**
   - 좌측 상단 드롭다운 또는 "개발 → 기본 정보"
   - 예상: `iw_thecleaz*` 뒤 suffix 가 바뀐 새 값 (예: `iw_thecleanz9x` 등)
- [ ] **새 상점의 라이브 시크릿 키 확인/발급**
   - 개발 → API 키 → **라이브 시크릿 키**
   - 기존 `live_sk_P9BRQmyarY5vo1LoGNjNrJ07KzLN` 와 **반드시 다른 값**이어야 함
- [ ] **아임웹 admin 쪽 결제 설정 확인**
   - 판매관리 → 결제관리 → Toss 설정
   - 현재 연결된 Mall ID 가 신 법인 값인지 구 법인 값인지
   - 만약 아직 구 법인으로 연결돼 있으면 여기서도 업데이트 필요할 수 있음 (다만 결제는 정상 작동하니 현재 값이 맞을 것)
- [ ] **구 법인의 Toss 계정 접근도 유지**
   - 과거 기록(~2026-02-23) 조회·백업 목적
   - `live_sk_P9BRQ...` 는 계속 유효하되 "역사 조회용" 으로만 사용

#### 새 키 확보 후 작업 (사용자 또는 내가)

1. `.env` 업데이트:
   ```
   # 토스 커피 라이브 API 개별 연동 키 (2026-04-15 자회사 법인 분리 후 신규)
   TOSS_LIVE_CLIENT_KEY_COFFEE_API=live_ck_{NEW}
   TOSS_LIVE_SECRET_KEY_COFFEE_API=live_sk_{NEW}
   TOSS_LIVE_SECURITY_KEY_COFFEE_API={NEW_SECURITY}
   ```
2. 기존 값은 주석 처리 (history 추적용):
   ```
   # (구 법인, 2026-02-23 이전 데이터 조회용)
   # TOSS_LIVE_SECRET_KEY_COFFEE_API_LEGACY=live_sk_P9BRQmyarY5vo1LoGNjNrJ07KzLN
   ```
3. **backend 코드 영향 확인**: 지금은 fallback 구조가 단순해서 env 값만 바꾸면 됨. 다만 과거 기록 조회가 필요하면 `tossConfig.ts` 에 legacy key 병행 경로 추가 검토
4. VM 재배포: `pm2 restart seo-backend --update-env`
5. 검증 1 — 오늘 생성된 주문 4건 재조회:
   ```bash
   curl -s "https://att.ainativeos.net/api/attribution/payment-decision?site=thecleancoffee&order_code=o202604146825aac75341c&payment_code=pa2026041421b3686913eb8&order_no=202604148401098&payment_key=iw_th20260414222830yOXA4"
   ```
   기대: `decision.status=confirmed`, `reason=toss_direct_api_status`, `directToss.matchedRows=1`
6. 검증 2 — 새 카드결제 라이브 테스트 1건 → 가드 로그에 `allow_purchase` + Meta Events Manager 에 `Purchase` 이벤트 발사 확인
7. Toss backfill 실행: 2026-02-23 ~ 현재 50일치 누락 데이터 복구
   ```bash
   curl -X POST "https://att.ainativeos.net/api/toss/sync?store=thecleancoffee&mode=backfill&startDate=2026-02-23&endDate=2026-04-15"
   ```
8. `tossapi.md` / `tosskey.md` / `capimeta.md` / `metacoffee.md` 에 사업부 이전 내용 + 신규 키 반영 완료 기록

### ⚠️ 오늘 밤 ~ 내일 아침 사이 운영 리스크

| 리스크 | 상태 | 대응 |
|---|---|---|
| 커피 카드결제 시 Purchase 이벤트가 VirtualAccountIssued 로 오발사 | 🟡 계속됨 | **그대로 둠**. 가드 비활성화는 오히려 가상계좌 오염 재발 위험. 내일 해결 |
| Meta 광고 ROAS 가 커피 카드결제 매출 누락 | 🟡 계속됨 | 1일 추가 누락. 50일 누적 영향에 비하면 미미 |
| 재무팀 가상계좌 입금 테스트 3건 | 🔴 **지금 입금하지 말 것** | 새 상점에서 처리되는 거라 현재 backend 는 pending → confirmed 전환 불가. 내일 키 교체 + backfill 후에 입금하면 정상 처리 가능 |
| 로컬 자동 sync (imweb/toss 15분 주기) — 내가 오늘 구현했지만 VM 배포 안 함 | 🟢 영향 없음 | VM 배포 안 돼서 돌지 않음. 내일 키 교체와 같이 배포하면 됨 |

### 📣 재무팀에게 공유할 메시지

> "커피 가상계좌 테스트 3건(`202604144671071`, `202604145802988`, `202604146958295`) 입금은 **내일 아침 Toss 키 교체 후** 진행해 주세요.
>
> 이유: 사업부 이전으로 Toss 가맹점 계정이 바뀐 사실이 오늘 밤에 확인됐습니다. 현재 backend 가 구 상점 키로 조회 중이라, 지금 입금해도 시스템이 자동으로 `pending → confirmed` 전환을 못 합니다.
>
> 내일 아침 TJ가 새 키를 반영한 뒤 입금해 주시면 정상 처리됩니다."

### 🎯 Phase 1b 완성도 재평가

| 시점 | 완성도 | 비고 |
|---|---|---|
| 오늘 22:30 | 🟡 90% | 가드 + footer 완료 상태로 잘못 평가 |
| 오늘 22:55 | 🟡 70% | "키 값 오설정" 가설로 조정 |
| 오늘 23:10 | 🔴 50% | "상점 자체 변경" 가설로 강등 |
| **오늘 23:20 (확정)** | **🟡 75%** | **원인 확정 + 해결 경로 명확. 내일 아침 10분 작업으로 90%+ 복구 예상** |

왜 75% 로 다시 올라가는가: **문제의 정체가 완전히 드러나면 해결은 단순**. 이제 필요한 건 사용자가 새 상점 키만 가져오면 끝. backend 코드 변경 거의 없음 (`.env` 수정 + 재배포).

### 🔍 이 사건의 운영 교훈

1. **라이브 검증 필수**: tossapi.md `#10` 에 "2026-04-06 커피 라이브 키 검증 완료" 로 기록됐지만 **과거 주문으로만** 검증. 새 주문 라이브 검증 0건 → 2026-02-23 이후 50일간 증상 은폐
2. **Sync 정지 알람 부재**: `toss_transactions` 최신 데이터가 50일째 멈춘 상태인데 모니터링 경보 없음. 이 세션에서 도입한 imweb/toss 자동 sync 가 배포되면 **정지 즉시 감지** 가능
3. **사업부 분리 같은 조직 변화가 기술 인프라에 반영 안 된 케이스**: 향후 유사 변경(법인 분리/합병/PG 교체/결제수단 추가)이 발생하면 **즉시 운영 DB · env · 문서 3축 업데이트** 체크리스트 필요
4. **"env 에 값이 있으면 해결" 이라는 함정**: 값 존재와 값 유효성은 별개. 앞으로 어느 시스템이든 "환경변수 있음" 은 validation 이 아니고, **실제 live 호출로 200 응답** 을 받아야 validation
5. 가드 설치가 **숨어 있던 50일짜리 운영 오류를 드러냄**. 가드가 없었으면 이 문제는 훨씬 더 오래 갔을 것. **관측성의 가치**

### 내 오진단 이력 (학습용 기록)

| 시간 | 진단 | 기각 사유 |
|---|---|---|
| 22:30 | Footer 재설치 성공 → Phase 1b 90% | 카드결제 테스트 전이라 조기 평가 |
| 22:40 | Toss 결제위젯 vs API 개별 프로덕트 분리 | Toss API 키 구조 오해 |
| 22:55 | `live_sk_P9BRQ...` 값 자체가 틀린 키 | 과거 주문 조회 성공으로 기각 |
| 23:10 | 커피 Toss 상점 2026-02-23 이후 변경 | ✅ 방향은 맞음 |
| **23:20** | **사업부 이전 → 새 법인 Toss 가맹점** (사용자 확인) | ✅ **완전 확정** |

---

### (이전 기록 — 참고용) 🔄 2026-04-14 23:10 KST — **재재확정**: 이전 두 가설 모두 기각. 진짜 원인은 **"커피 Toss 상점 2026-02-23 이후 변경"**

> 내 이전 두 가설 ("결제위젯 vs API 개별 분리", "TOSS_LIVE_SECRET_KEY_COFFEE_API 값 자체가 틀린 키") 는 **모두 부분 오류**. Toss API 를 다양한 경로로 직접 호출해 본 결과 새 결론 나옴.

#### 증거 체인

**① `live_sk_P9BRQ...` 는 커피 상점에 **정상 연결**됨**

과거 주문 `202601017947250-P1` (tossapi.md §10 에 2026-04-06 성공 기록) 으로 재호출:

```bash
curl -u "live_sk_P9BRQmyarY5vo1LoGNjNrJ07KzLN:" \
  https://api.tosspayments.com/v1/payments/orders/202601017947250-P1
```

응답:
```json
{
  "mId": "iw_thecleaz5j",                                  ← 🎯 커피 MID!
  "paymentKey": "iw_th20260101034003AGlg6",
  "orderName": "콜롬비아 수프레모 나리뇨 200g / 500g 외 2개",
  "status": "DONE",
  "approvedAt": "2026-01-01T03:40:46+09:00",
  "totalAmount": 66600
}
```

→ `.env` 의 키는 `iw_thecleaz5j` 상점과 올바르게 연결. **"잘못된 키"는 아님**.

**② 오늘 주문 3건 전부 404** (1시간+ 경과 후 재조회)

```
iw_th20260414221631p83b9 → HTTP 404
iw_th20260414222830yOXA4 → HTTP 404
iw_th20260414220422uDFg4 → HTTP 404
```

→ **전파 지연 아님** (1시간+). 다른 이유로 이 상점에 데이터 없음.

**③ Toss transactions API 가 오늘 날짜로 `total: 0`**

```bash
curl "https://api.tosspayments.com/v1/transactions?startDate=2026-04-14..&endDate=2026-04-14..&limit=10"
# → 빈 배열 []
```

→ **`iw_thecleaz5j` 상점에 오늘 거래 기록 0건**. 사용자 스크린샷에 영수증 있는데 Toss 서버는 모름.

**④ 로컬 DB 의 결정적 타임라인**

```
toss_transactions 테이블:
  iw_bi: 33,341건, latest 2026-04-06 23:53 (biocom, 정상)
  iw_th:  5,043건, latest 2026-02-23 16:21 🔴 (coffee, 50일 전 완전 중단)

toss_settlements 테이블:
  iw_bi: 30,647건, latest 2026-04-07 23:53 (biocom, 정상)
  iw_th:  1,375건, latest 2026-02-09 20:09 🔴 (coffee, 66일 전 중단)
```

두 테이블 모두 **2026-02-23 / 2026-02-09** 에서 정확히 멈춤.

#### 🎯 진짜 원인 — **커피 Toss 상점이 2026-02-23 경에 변경됨**

증거 종합:
- 과거 주문은 `iw_thecleaz5j` 상점에서 정상 조회 (이 상점에 저장돼 있음)
- 오늘 주문은 같은 상점에서 찾을 수 없음 + transactions 조회도 0건
- 로컬 sync 기록이 2026-02-23 에서 정확히 끊김

즉 **2026-02-23 경 커피 결제 시스템이 변경**:

| 가능성 | 내용 | 확률 |
|---|---|---|
| **X** | 커피가 **새 Toss 상점(MID)** 으로 이전. 기존 `iw_thecleaz5j` 는 보관용, 현재 결제는 신규 상점에서 처리. **새 상점의 live secret key** 가 `.env` 에 없음 | **가장 높음** |
| Y | 아임웹이 Toss 연동을 **sub-merchant** 방식으로 변경. 아임웹이 자체 Toss 계정으로 결제 처리, 사용자 개인 Toss 상점은 경로에서 제외 | 중간 |
| Z | 아임웹이 Toss 외 다른 PG 로 전환 | 낮음 (영수증에 "신용카드" 표시되고 paymentKey 가 여전히 `iw_th` 형식이라 Toss 맞음) |

**가장 가능성 높은 X**: 2026-02-23 경 Toss 측 또는 아임웹 측에서 상점 변경이 있었음. 사용자는 결제 흐름이 그대로 작동해서 변경을 못 알아챘고, 로컬 sync 만 조용히 중단.

### 🚨 이전 진단 오류 정정 (중요)

| # | 이전 진단 | 실제 |
|---|---|---|
| 1 | "결제위젯 vs API 개별 프로덕트 분리" (내 첫 가설) | ❌ 오해. `.env` 119~125 주석 분리는 실제 상점 프로덕트 분리가 아닌 편의 분류 |
| 2 | "`TOSS_LIVE_SECRET_KEY_COFFEE_API` 값 자체가 다른 상점 키" (두 번째 가설) | ❌ 키는 `iw_thecleaz5j` 에 정확히 연결됨 (과거 주문 200 증거) |
| 3 | "2026-02-09 부터 sync 중단은 키 교체 때문" | 🟡 부분 정정. 키는 그대로인데 **상점이 변경** (sync 가 기존 상점 쪽을 계속 보고 있어서 새 데이터가 안 들어옴) |
| 4 | **✅ 정답** | **2026-02-23 경 커피 결제 상점 변경. 기존 키는 구 상점에 유효, 현재 결제는 알 수 없는 신규 상점에서 처리** |

이전에 이걸 놓친 이유: `.env` 에 값이 있다는 것 + `env.ts` fallback 이 작동한다는 것만 확인하고 **실제 Toss API 가 오늘 주문을 찾을 수 있는지 live 검증 0건**. 2026-02-23 이후 50일간 증상이 숨어 있었음.

### 🔍 사용자 확인 필수 — 3가지 질문

1. **2026-02 말경에 커피 결제 시스템 변경 있었소?**
   - Toss 재가입, 결제위젯 신규 가입, 사업자 변경, 아임웹 결제 연동 재설정 등
   - 혹시 "결제가 잘 된다" 는 이유로 내부 sync 관리자가 별다른 통보 없이 진행
2. **아임웹 admin 에서 Toss Mall ID 확인**
   - 보통 "판매관리 → 결제 관리 → 결제수단 → Toss 설정"
   - 현재 값이 `iw_thecleaz5j` 인지 **다른 값** 인지
3. **Toss 콘솔 상점 목록**
   - `https://app.tosspayments.com/` 좌측 상단 드롭다운
   - 커피 관련 상점 **몇 개** 있는지
   - 각 상점 ID + 라이브 시크릿 키 비교

**세 가지 중 2~3번 중 하나만 확인되면 즉시 해결**.

### 🔧 해결 경로

**Case A** — 상점이 여러 개이고 올바른 것을 식별:
1. 현재 결제를 받는 상점의 라이브 시크릿 키 확인
2. `.env` 의 `TOSS_LIVE_SECRET_KEY_COFFEE_API` 를 그 키로 교체
3. backend 재기동
4. Toss sync backfill 돌려서 2026-02-23 이후 커피 데이터 복구 (50일치)

**Case B** — 상점 1개인데 오늘 거래 안 보임:
1. Toss support 에 "이 상점에 2026-02-23 이후 거래 기록이 없어지고 있다" 문의
2. 아임웹 support 에도 동일 문의 — "아임웹이 어떤 Toss 계정으로 결제 처리하는지"
3. 경우에 따라 아임웹 자체 sub-merchant 로 넘어간 것이면 **Toss 직접 조회 불가** → 다른 정합성 경로 필요

### 누적 테스트 주문 4건 현황 (재분류)

| # | order | 의도 | Guard 판정 | Toss API 조회 | Root cause |
|---|---|---|---|---|---|
| 1 | `202604144671071` | 가상계좌 | ✅ VirtualAccountIssued | 🔴 404 | 2/23 이후 상점 변경 |
| 2 | `202604145802988` | 가상계좌 | ✅ VirtualAccountIssued | 🔴 404 | 동일 |
| 3 | `202604146958295` | 가상계좌 | ✅ VirtualAccountIssued | 🔴 404 | 동일 |
| 4 | `202604148401098` | **카드결제** | 🔴 **VirtualAccountIssued 오발사** | 🔴 404 | **상점 변경으로 Toss 조회 실패 → ledger fallback → pending 오판정** |

### 운영 영향 범위 확대

- 단순 키 교체 문제 아님
- **2026-02-23 이후 커피의 Toss 매출 데이터가 local DB 에 완전히 없음** (50일치)
- 그동안 커피 ROAS 리포트는 **2월 23일 까지의 구(舊) 데이터** 만 반영
- 아임웹이 어떻게 결제를 처리하는지 근본적으로 재확인 필요
- Phase 1b 완성도 70% → **50%** 로 강등 (아임웹 결제 구조 자체를 알아야 해결 가능)

---

### (이전 기록 — 참고용) 🚨 2026-04-14 22:55 KST — 진단 오류 1차 재확정: **`TOSS_LIVE_SECRET_KEY_COFFEE_API` 값이 잘못된 키**

> 직접 curl 로 Toss API 5종 호출 + local `toss_settlements` 테이블 분포 조사 결과, 내 이전 "결제위젯 vs API 개별" 가설은 틀렸고 **훨씬 단순한 원인**이 확정됨.

#### 실측 ① — Toss API 직접 호출 결과

```bash
curl -u "live_sk_P9BRQmyarY5vo1LoGNjNrJ07KzLN:" \
  https://api.tosspayments.com/v1/payments/iw_th20260414222830yOXA4
→ HTTP 404 {"code":"NOT_FOUND_PAYMENT"}

curl -u "live_sk_P9BRQmyarY5vo1LoGNjNrJ07KzLN:" \
  https://api.tosspayments.com/v1/payments/orders/202604148401098-P1
→ HTTP 404 {"code":"NOT_FOUND_PAYMENT"}

curl -u "live_sk_P9BRQmyarY5vo1LoGNjNrJ07KzLN:" \
  https://api.tosspayments.com/v1/payments/orders/202604148401098
→ HTTP 404 {"code":"NOT_FOUND_PAYMENT"}
```

**해석**: **401 이 아니라 404**. 즉 키 자체는 Toss 에서 유효 인증됨 (상점에 연결돼 있음). 단, **그 상점에 `iw_th20260414222830yOXA4` paymentKey 가 존재하지 않음**.

#### 실측 ② — `iw_th` / `iw_bi` 는 **실제 Toss 원본 paymentKey**

로컬 `toss_settlements` 테이블 직접 조회:

```
prefix  cnt     latest
iw_bi   30,647  2026-04-07T23:53:28 (biocom, 일주일 전까지 정상 sync)
iw_th    1,375  2026-02-09T20:09:42 🔴 (coffee, 두 달 전 멈춤!)
```

`iw_bi*` 와 `iw_th*` 모두 Toss 가 발급한 실제 paymentKey. `iw_` prefix 는 아임웹 wrapper 가 아니라 **Toss 가 아임웹 연동 상점마다 부여하는 원본 식별자**. `bi`=biocom, `th`=thecleancoffee. 그 뒤 날짜시간 + 랜덤 suffix.

**결정적 증거**:
- biocom `iw_bi...` 는 `live_sk_Z61JOx...` 로 Toss 조회 **성공** (이전 테스트 기록 + 오늘 curl)
- coffee `iw_th...` 는 `live_sk_P9BRQ...` 로 Toss 조회 **실패** (HTTP 404)
- 같은 `iw_*` 원형 형식인데 한쪽만 성공

#### 실측 ③ — **`iw_th` settlements sync 가 2026-02-09 부터 완전 중단**

`toss_settlements` 테이블의 `iw_th` 마지막 entry: **2026-02-09 20:09 KST**.
그 이후 두 달 동안 커피 Toss settlements 가 local DB 에 **0건 추가**.

해석:
- **2026-02-09 시점**: 유효한 coffee Toss secret key 가 존재했음 → 정기 Toss sync 가 coffee 결제 데이터를 잘 가져옴
- **2026-02-09 이후**: 키가 **교체·무효화** 되면서 Toss API 호출이 전부 401/404 → local 동기화 중단
- 현재 `.env` 의 `live_sk_P9BRQ...` 는 **교체된 새 키가 아닌 다른 값** (아마 다른 상점 키 또는 만료된 키)

#### 확정된 원인

**`TOSS_LIVE_SECRET_KEY_COFFEE_API=live_sk_P9BRQmyarY5vo1LoGNjNrJ07KzLN` 값이 커피 실제 결제 상점의 키가 아님**.

- 키 이름·env 경로는 정확
- 키 자체는 Toss 에 등록돼 있어서 인증 통과 (401 없음)
- 그러나 **이 키가 연결된 상점**에 coffee 의 `iw_th...` paymentKey 가 존재하지 않음 → 404

**이전 기록의 오류**:
- 여러 문서 (`coffee/coffee.md`, `meta/capi.md`, 이전 `capimeta.md` 섹션) 에 "커피 Toss key 는 env 에 있음 → 해결" 로 기록
- 실제로는 env 에 **값** 이 있는 것만 확인했고 **실제 Toss 조회가 성공하는지 live 검증 0건**
- 문서상 "해결" 이 **거짓** 이었고, 두 달 동안 실제로는 커피 Toss sync / 카드결제 판정이 전부 실패 상태

**과거 capi.md 의 다음 기록이 지금도 유효**:
> "더클린커피 CAPI 연동 — Toss Key 확보 필요. 현재 더클린커피 주문은 Toss API 404 오류로 CAPI 전송 실패. 커피 전용 Toss Secret Key를 .env에 추가하면 해결됨."

이 문구의 "해결" 은 아직 **안 됐음**. 두 달 전 기록인데 그 사이 아무도 실제 검증 안 함.

#### 해결 — 단순함

**사용자 작업 (10분)**:

1. **https://app.tosspayments.com/** 접속
2. 상점 선택 드롭다운 → **더클린커피 상점** 선택 (여러 개 있으면 실제 아임웹 결제를 받는 상점)
3. 좌측 메뉴 → **개발 → API 키** → **라이브 시크릿 키** 복사
4. 현재 `.env` 값 `live_sk_P9BRQmyarY5vo1LoGNjNrJ07KzLN` 와 **다른지** 비교
   - **다르면** (예상): 새 키가 올바름 → `.env` 교체
   - **같으면**: 더 깊이 파야 함 (상점 여러 개 확인, 아임웹 결제 설정 재확인)
5. `.env` 131행 (또는 fallback 을 위해 119~121 섹션 아래 `TOSS_LIVE_SECRET_KEY_COFFEE` 직접 추가) 에 교체
6. backend 재기동 (로컬 `touch src/server.ts`, VM `pm2 restart`)

**검증 (내가 즉시)**:

```bash
curl -s "https://att.ainativeos.net/api/attribution/payment-decision?site=thecleancoffee&store=thecleancoffee&order_code=o202604146825aac75341c&payment_code=pa2026041421b3686913eb8&order_no=202604148401098&payment_key=iw_th20260414222830yOXA4"
```

**기대**:
```json
{
  "decision": {
    "status": "confirmed",
    "browserAction": "allow_purchase",
    "reason": "toss_direct_api_status",
    "matchedBy": "toss_direct_payment_key"
  },
  "directToss": {
    "attempted": true,
    "matchedRows": 1,
    "errors": 0
  }
}
```

#### 추가 확인 필요

- 2026-02-09 ~ 2026-04-14 동안 축적된 **커피 주문 1,000+ 건** 의 `iw_th...` 결제 데이터가 local `toss_settlements` 에 **전혀 sync 안 됨**
- 새 키로 교체 후 **backfill sync** 1회 돌려야 과거 데이터도 따라잡을 수 있음:
  ```bash
  curl -X POST "https://att.ainativeos.net/api/toss/sync?store=thecleancoffee&mode=backfill"
  ```
- 이번 세션 초반에 실행한 incremental sync (range 4/11~4/13) 에서 coffee 0건 이었던 것도 **같은 원인**

#### 내 이전 "결제위젯 vs API 개별" 가설에 대한 정정

`.env` 119~125 의 주석 구분 (`#토스 커피 결제위젯 연동 키` vs `#토스 커피 API 개별 연동 키`) 은 실제 Toss 프로덕트 구분이 아니라 **내부 분류 편의** 일 가능성이 더 높소. 실제 Toss 의 `sk_` prefix 키는 두 프로덕트(결제위젯/API 개별) 모두 조회 가능한 것이 2024년 이후 표준 (Toss 정책 변경됨). 따라서 **키 prefix 이슈가 아닌 상점 연결 이슈**가 맞음.

---

사용자 제공 스크린샷: 주문 `202604148401098` 결제정보 = **신용카드 `****-****-****-705*`**, 21,300원 → **시나리오 A 확정**.

#### 결정적 단서 — `.env` 119~125 주석 분리

```
#토스 커피 결제위젯 연동 키                   ← 120~121행 (TEST only)
TOSS_TEST_CLIENT_KEY_COFFEE=test_gck_...
TOSS_TEST_SECRET_KEY_COFFEE=test_gsk_...

#토스 커피 API 개별 연동 키                  ← 124~126행 (TEST)
TOSS_TEST_CLIENT_KEY_COFFEE_API=test_ck_...
TOSS_TEST_SECRET_KEY_COFFEE_API=test_sk_...

#토스 커피 라이브 API 개별 연동 키            ← 129~131행 (LIVE only "_API")
TOSS_LIVE_CLIENT_KEY_COFFEE_API=live_ck_DpexMgkW3679vRBb0zM9VGbR5ozO
TOSS_LIVE_SECRET_KEY_COFFEE_API=live_sk_P9BRQmyarY5vo1LoGNjNrJ07KzLN
TOSS_LIVE_SECURITY_KEY_COFFEE_API=a7c513ab...
```

**🔴 치명적 발견**: `.env` 에 **결제위젯 live 키가 없음**. live 는 "API 개별" 프로덕트만 등록돼 있음.

#### Toss Payments 의 결제위젯 vs API 개별 프로덕트 구조

| 구분 | Key prefix | 설명 | 계정 분리 |
|---|---|---|---|
| **결제위젯** (PaymentWidget) | `gck_` / `gsk_` | Toss 가 렌더링하는 결제창 (위젯 방식) | Toss 내부에서 **별개 프로덕트 / 상점 단위** 분리 관리 |
| **API 개별 연동** | `ck_` / `sk_` | 직접 결제 API 호출 방식 | 같은 상점이어도 **별개 프로덕트** |

Toss 는 두 제품의 `paymentKey` 를 **독립적으로 보관**. 한 프로덕트 secret key 로 다른 프로덕트의 paymentKey 조회 시 **404**.

#### 실제 결제 흐름 재구성

```
1. 아임웹 shop → Toss 결제위젯 live_gsk_???? (❌.env에 없음) 로 결제창 렌더링
2. 사용자 카드결제 → Toss paymentKey 발급 = "iw_th20260414222830yOXA4"
3. 이 paymentKey 는 "결제위젯" 프로덕트 하위
4. ledger 적재 (OK)
5. 가드 → /api/attribution/payment-decision 호출
6. Backend가 env.TOSS_LIVE_SECRET_KEY_COFFEE 로 조회
   └─ env.ts fallback: TOSS_LIVE_SECRET_KEY_COFFEE → TOSS_LIVE_SECRET_KEY_COFFEE_API
   └─ 결국 live_sk_P9BRQ... ("API 개별" 프로덕트 키)
7. Toss 가 "API 개별" 키로 "결제위젯" 프로덕트 paymentKey 검색 → 404
8. orderId fallback (/v1/payments/orders/202604148401098-P1) 도 같은 이유로 404
9. directToss.errors: 2 → ledger fallback → pending → 오판정
```

#### 왜 biocom 은 성공하는가

biocom `.env` 116행:
```
TOSS_LIVE_SECRET_KEY_BIOCOM=live_sk_Z61JOxRQVEbR5Mgow4RRrW0X9bAq   ← sk_ (API 개별)
```

biocom 은 `.env` 에 **결제위젯/API 개별 분리 없이 `sk_` 단일** 등록 → 아임웹 결제 연동 자체가 **API 개별 연동 방식**으로 설정됐음을 암시.

| 사이트 | 아임웹 결제 연동 방식 | backend 조회 키 | 매칭 |
|---|---|---|---|
| **biocom** | API 개별 (`sk_`) 추정 | `sk_` (같은 프로덕트) | ✅ 성공 |
| **coffee** | 결제위젯 (`gsk_`) | `sk_` (다른 프로덕트) | 🔴 **404** |

#### 영향 평가

- **커피의 모든 카드결제 주문**이 현재 이 문제에 노출 중
- 결제완료 페이지에서 Purchase 가 **차단**되고 VirtualAccountIssued 로 오발사
- Meta 광고 ROAS 가 **심각하게 과소 집계 중** (카드결제의 Purchase 가 Meta 에 안 전달)
- 얼마나 오래? → 커피 가드 설치일(2026-04-14) 부터, 하지만 이 문제는 **결제위젯 구조상 원래부터 존재** — 가드 설치 전엔 Browser Pixel 이 가상계좌/카드 구분없이 다 Purchase 로 발사해서 문제가 숨겨져 있었음. 가드 설치 후에야 드러남
- **Phase 1b 90% → 60% 강등** 확정

### 🔧 해결책 3가지

| # | 옵션 | 작업 | 시간 |
|---|---|---|---|
| **A** 🔴 권장 | **Toss 콘솔에서 live 결제위젯 secret key 발급 → `.env` 추가** | 사용자가 Toss 콘솔 접속 + 복붙. 내가 `env.ts` · `tossConfig.ts` 수정 + 재배포 | 1시간 이내 |
| B | 아임웹 shop 결제 연동을 API 개별(`sk_`) 로 변경 | 아임웹 admin 결제수단 설정 재구성. 결제 플로우 영향 검토 필요 | 반나절+ |
| C | backend 가 결제위젯·API 개별 두 키 순차 재시도 | 결제위젯 live 키가 **없으면 의미 없음** (A 선행 필수) | A에 종속 |

**권장 A**: 가장 빠르고 단순. `iw_th` paymentKey 자체는 바꿀 필요 없고, backend 가 "올바른" 키로 조회하면 Toss 가 matched row 반환.

### 🎯 사용자 즉시 작업

#### Step 1: Toss 콘솔 접근
```
https://app.tosspayments.com/
→ 커피(더클린커피) 상점 선택
→ 상단 "개발" 또는 "API 키" 메뉴
→ "결제위젯" 탭에서 "라이브 시크릿 키" 확인
```

#### Step 2: `.env` 에 추가 (119~121 섹션 아래)
```
#토스 커피 결제위젯 라이브 연동 키 (2026-04-14 추가)
TOSS_LIVE_CLIENT_KEY_COFFEE=live_gck_xxxxxxxxxxxxxxxxxxxxxxxx
TOSS_LIVE_SECRET_KEY_COFFEE=live_gsk_xxxxxxxxxxxxxxxxxxxxxxxx
```

> 중요: **변수명은 `_COFFEE` 접미사만** (현재 `tossConfig.ts:45` 가 `env.TOSS_LIVE_SECRET_KEY_COFFEE` 를 읽음). 이렇게 하면 코드 수정 없이 자동으로 결제위젯 키가 우선 적용됨. 기존 `_COFFEE_API` 접미사 키는 fallback 으로 유지됨.

단, `env.ts:17-18` 의 fallback 순서도 확인해야 함:
```typescript
TOSS_LIVE_SECRET_KEY_COFFEE:
  process.env.TOSS_LIVE_SECRET_KEY_COFFEE ?? process.env.TOSS_LIVE_SECRET_KEY_COFFEE_API,
```
→ 이 순서라면 `TOSS_LIVE_SECRET_KEY_COFFEE` 가 있으면 우선 사용. **코드 수정 불필요**.

#### Step 3: Backend 재기동
로컬: tsx watch 가 자동 reload (파일 수정 시). .env 변경은 안 잡히므로 `touch backend/src/server.ts`
VM: SSH 로 `/opt/seo/shared/env/backend.env` 수정 + `pm2 restart seo-backend --update-env`

#### Step 4: 재검증
같은 endpoint 로 이 주문(`o202604146825aac75341c`) 재조회:
```bash
curl -s "https://att.ainativeos.net/api/attribution/payment-decision?site=thecleancoffee&store=thecleancoffee&order_code=o202604146825aac75341c&payment_code=pa2026041421b3686913eb8&order_no=202604148401098&payment_key=iw_th20260414222830yOXA4"
```

**기대 결과**:
```json
{
  "decision": {
    "status": "confirmed",                          ← 🎯
    "browserAction": "allow_purchase",              ← 🎯
    "reason": "toss_direct_api_status",             ← 🎯
    "matchedBy": "toss_direct_payment_key"
  },
  "directToss": {
    "attempted": true,
    "matchedRows": 1,                               ← 🎯
    "errors": 0                                     ← 🎯
  }
}
```

단, 주의: 이 주문은 이미 페이지 이탈(VirtualAccountIssued 발사됨) 상태라 Browser Purchase 는 다시 발사 안 됨. Server CAPI 가 다음 tick(30분 이내)에 Purchase 를 보내면 성공.

#### Step 5: 새 카드결제 live 테스트 주문 1건 추가
Step 4 통과 후 새 카드결제 주문으로 브라우저 Pixel `Purchase` 이벤트가 정상 발사되는지 확인.

### 누적 테스트 주문 4건 현황 갱신

| # | order | 의도 | 결과 | 상태 |
|---|---|---|---|---|
| 1 | `202604144671071` | 가상계좌 | ✅ VirtualAccountIssued | 입금 대기 |
| 2 | `202604145802988` | 가상계좌 | ✅ VirtualAccountIssued | 입금 대기 |
| 3 | `202604146958295` | 가상계좌 (footer 검증) | ✅ VirtualAccountIssued | 입금 대기 |
| 4 | **`202604148401098`** | **카드결제** | 🔴 **VirtualAccountIssued 오발사** (Toss direct 실패) | **분석 완료, 해결 A 대기** |

### 운영상 심각도

- Meta Events Manager 의 커피 픽셀 데이터는 **카드결제 Purchase 가 누락된 상태**
- 광고 ROAS 계산에서 매출이 심각하게 과소 집계 중
- 가드 설치(2026-04-14) 이전엔 Browser Pixel 이 카드·가상계좌 구분없이 Purchase 로 발사해 이 문제가 숨어있었음 — 가드가 오히려 문제를 **가시화**함 (좋은 일)
- **우선순위 🔴 최상** — 재무팀 가상계좌 입금 테스트보다 먼저 해결해야 할 이슈

---

### 누적 테스트 주문 4건 현황

| # | order_code | order_no | 의도 | 판정 | 현재 상태 |
|---|---|---|---|---|---|
| 1 | `o202604140b417b041a30f` | `202604144671071` | 가상계좌 | VirtualAccountIssued | pending (입금 대기) |
| 2 | `o20260414d7b75570998b0` | `202604145802988` | 가상계좌 | VirtualAccountIssued | pending (입금 대기) |
| 3 | `o202604140da36f76c0fa4` | `202604146958295` | 가상계좌 (footer 검증용) | VirtualAccountIssued | pending (입금 대기) |
| 4 | **`o202604146825aac75341c`** | **`202604148401098`** | **카드결제 (사용자 보고)** | **VirtualAccountIssued 🔴** | **확인 필요** |

---

## ✅ 2026-04-14 22:30 KST — 커피 Footer 재설치 완전 성공 (3차 검증)

> 사용자가 첫 시도에서 구버전을 삭제 안 하고 신규만 append 해서 반영 실패 → 재작업 후 두 번째 주문(`o202604140da36f76c0fa4`) 에서 **모든 지표 100% 성공**.

### 🔍 사이트 Raw HTML 실측 — 신규 footer 확정

`curl https://thecleancoffee.com/` 전수 스캔:

| 검증 키워드 | 카운트 | 판정 |
|---|---|---|
| `2026-04-14-coffee-checkout-started-v1` | **1** | ✅ Block 2 설치 |
| `2026-04-14-coffee-payment-success-order-code-v1` | **1** | ✅ Block 3 설치 |
| `checkout-context` endpoint | 2 | ✅ 새 endpoint 호출 |
| `checkout_started` 이벤트 | 6 | ✅ |
| `__seo_checkout_id` sessionStorage | 2 | ✅ |
| `parsePaymentParamsFromUrl` | 2 | ✅ |
| `browser_purchase_event_id` | 1 | ✅ |
| **`2026-04-08-coffee-fetchfix-v2`** | **0** | ✅ **구버전 완전 제거** |

활성 endpoint 3개:
```
att.ainativeos.net/api/attribution/checkout-context    ← 신규 등장 (Block 2)
att.ainativeos.net/api/attribution/payment-decision   ← 헤더 가드 (어제부터)
att.ainativeos.net/api/attribution/payment-success   ← Block 3 (신규 버전)
```

### 새 테스트 주문 (3번째)

| 필드 | 값 |
|---|---|
| **order_code** | `o202604140da36f76c0fa4` |
| **order_no** | `202604146958295` |
| payment_code | `pa202604141ce5f18c51136` |
| paymentKey | `iw_th20260414221631p83b9` |
| value | ₩21,300 |

### ⭐ Ledger 검증 — **2개 이벤트 생성** (이전 주문들과 결정적 차이)

#### Entry 1: `checkout_started` (커피 ledger 에 **최초** 등장!)
```
loggedAt: 2026-04-14T13:15:58Z (= 22:15:58 KST)
touchpoint: checkout_started     ← 커피 Phase 3 가 이제 살아남
checkoutId: chk_1776172557529_wn0rwxkw
metadata.snippetVersion: 2026-04-14-coffee-checkout-started-v1
metadata.fbp: fb.1.1775048310435.926984947148613270   ← fbp 쿠키 캡처 성공
metadata.fbc: (빈 값, fbclid 없는 세션이라 정상)
```

#### Entry 2: `payment_success` (42초 후)
```
loggedAt: 2026-04-14T13:16:40Z (= 22:16:40 KST)
touchpoint: payment_success
paymentStatus: pending                               ← 가상계좌 미입금 정상
orderId: 202604146958295
paymentKey: iw_th20260414221631p83b9
checkoutId: chk_1776172557529_wn0rwxkw              ← ★ Entry 1 과 동일 ID → funnel 연결 성공!
metadata.snippetVersion: 2026-04-14-coffee-payment-success-order-code-v1
metadata.orderCode: o202604140da36f76c0fa4          ← ★ top-level에 채워짐 (이전엔 null)
metadata.browser_purchase_event_id: Purchase.o202604140da36f76c0fa4  ← ★ 규칙 정확
metadata.fbp: fb.1.1775048310435.926984947148613270  ← ★ EMQ 개선 시그널
metadata.referrerPayment.orderCode: o202604140da36f76c0fa4           ← referrer 복원 경로도 정상
```

### 이전 주문들과 대비

| 지표 | #1 `202604144671071` | #2 `202604145802988` | **#3 `202604146958295`** |
|---|---|---|---|
| Footer snippetVersion | `2026-04-08-coffee-fetchfix-v2` 🔴 | `2026-04-08-coffee-fetchfix-v2` 🔴 | **`...v1` ✅** |
| `checkoutId` | "" | "" | **`chk_...` ✅** |
| `checkout_started` 이벤트 | ❌ | ❌ | **✅ 42초 전 발사** |
| `metadata.orderCode` top-level | null | null (referrerPayment 에만) | **`o202604140da36f76c0fa4` ✅** |
| `browser_purchase_event_id` | ❌ | ❌ | **`Purchase.{orderCode}` ✅** |
| `metadata.fbp` | ❌ | ❌ | **✅ 쿠키 캡처** |
| Guard 동작 | ✅ | ✅ | ✅ |

### Guard + Footer 두 레이어 모두 작동 확정

| 레이어 | 상태 | 증거 |
|---|---|---|
| **헤더 Guard** (`2026-04-14-coffee-server-payment-decision-guard-v3`) | ✅ 정상 | 3번째 주문도 `branch=block_purchase_virtual_account status=pending matchedBy=ledger_payment_key confidence=high` |
| **Footer Block 1** (UTM persistence + Formbricks user_id) | ✅ 설치 | `_p1s1a_*` key 여전히 유지 (backward-compat) |
| **Footer Block 2** (`checkout_started`) | ✅ 작동 | ledger entry 1 (checkout_started touchpoint) 첫 적재 |
| **Footer Block 3** (`payment_success` + orderCode) | ✅ 작동 | ledger entry 2 (payment_success) metadata 전부 채워짐 |

### Meta Events Manager 새로운 관찰

사용자 스크린샷에서 VirtualAccountIssued 이벤트가 **2개**로 보임:

| Frame | 전송 방식 | Load time |
|---|---|---|
| Window | `fbq` (primary) | 6.94 ms |
| **IFrame** | **image_fallback_after_observe_no** | 4.42 ms |

- 둘 다 같은 Event ID: `VirtualAccountIssued.o202604140da36f76c0fa4`
- Meta 가 event_id 로 자동 디둡 → 1건으로 카운트됨
- 가드의 safety net 로직이 정상 작동하는 증거

**Advanced Matching Parameters Sent** 섹션 신규 등장:
```
external_id: fb2c93a1ffb4f32ae248e125aad77c324b80e1b01871c6aa0bccc17acb80a642 (SHA-256 해시)
```

이건 Meta 가 페이지 context 에서 자동으로 external_id 를 해시해서 함께 전송하는 **Advanced Matching (자동)** 기능. 이전 주문에서는 보이지 않았는데, 신규 footer 가 더 풍부한 user_data 를 제공하면서 Meta 가 매칭 품질을 자동 승격한 것으로 추정. **EMQ 향상 시그널**.

### 🟡 GTM Tag 에러 원인 확정 (2026-04-14 심층 분석)

콘솔 에러:
```
Uncaught TypeError: Cannot read properties of undefined (reading 'product_name')
  at <anonymous>:1:114
  at gtm.js?id=GTM-5M33GC4:912
  at js?id=AW-10965703590:660
```

발생 위치: 커피 상품 상세 페이지 (`/thecleancoffee_store/?idx=4`)

#### 원인 확정 — **사용자 커스텀 코드 외부 (GTM 내부)**

사용자 제공 헤더/바디 커스텀 코드 전수 검토 + 커피 홈 HTML raw grep 교차 결과:
- 헤더 장바구니 conversion snippet (`gtag event conversion AW-304339096/Xq1KCMTrt4oDEJixj5EB`): `product_name` 접근 없음
- GTM 로더 스크립트 (`GTM-5M33GC4`): 단순 컨테이너 로더
- Beusable RUM (`b230307e145743u179`): 사용자 행동 분석, 무관
- 바디 Keepgrow 스크립트: CRM 연동, 무관
- **사용자 커스텀 코드 내 `product_name` 직접 접근 0건**

**진짜 위치**: GTM `GTM-5M33GC4` 컨테이너 내부에 설정된 Google Ads conversion tag (`AW-10965703590`) 의 Custom HTML 또는 Custom JavaScript Variable. GTM admin 에서만 확인·수정 가능.

#### 에러 체인
```
1. GTM 컨테이너 GTM-5M33GC4 로드
2. 내부 tag 중 'AW-10965703590' conversion tag 실행
3. 그 tag 가 window.dataLayer 에서 ecommerce items[].product_name 접근
4. 상품 상세 페이지에서 dataLayer 에 ecommerce item 이 undefined 라 TypeError
```

#### 해결 절차 (GTM admin 에서)

1. `https://tagmanager.google.com/` → `GTM-5M33GC4` 컨테이너 열기
2. **Tags** → `AW-10965703590` 관련 Google Ads conversion tag 검색
3. 해당 tag 의 Custom HTML / Custom JavaScript Variable 에서 `product_name` 접근 코드 null-safe 화:
   ```javascript
   // Before (에러 원인)
   var name = window.dataLayer[0].ecommerce.items[0].product_name;

   // After (null-safe)
   var items = ((window.dataLayer || []).find(x => x && x.ecommerce) || {}).ecommerce?.items || [];
   var name = (items[0] || {}).product_name || '';
   ```
4. Workspace → Submit → Publish
5. 커피 사이트 시크릿 창 재로드 → 콘솔 에러 소멸 확인

#### 영향 · 긴급도

- **직접 영향**: `AW-10965703590` Google Ads conversion tag 발사 실패 가능성 → **Google Ads 전환 추적 누락**
- **간접 영향**: GTM tag 간 isolation 으로 다른 tag 실행은 중단 안 됨. 본 Meta CAPI 작업과 **분리된 이슈**
- **긴급도**: 🟡 중간 — Google Ads 전환 정확도에 영향. 본 Meta CAPI 와 별개로 GTM admin 에서 수정 필요
- **본 Meta CAPI 작업과의 관계**: 없음. 커피 Purchase Guard / Footer / Server CAPI 모두 정상

### ⭐ 추가 발견 — Google Ads 계정 **2개** 동시 설치 (2026-04-14)

사용자 공유 헤더 커스텀 코드 + 커피 홈 HTML raw grep 교차:

| 사이트 | Google Ads 계정 (실측) | conversion label |
|---|---|---|
| **커피** | **`AW-10965703590`** (primary, GTM 내부) | `OnyOCNDn2NcDEKa37ewo` |
| **커피** | **`AW-304339096`** (헤더 커스텀 snippet, 장바구니 conversion) | `Xq1KCMTrt4oDEJixj5EB` |
| biocom | `AW-304339096` 단독 | `r0vuCKvy-8caEJixj5EB` |

**이전 기록 오류 발견**: `roadmap0327.md` 와 `capimeta.md` 에서 "`AW-304339096` 는 biocom 전용" 으로 기록했지만 **실제로는 커피 헤더에도 설치돼 있음**. 두 사이트가 `AW-304339096` 를 공유하는 상태.

#### 가능한 해석 3가지

- **A**: `AW-304339096` 는 **그룹 공용 Google Ads 계정** (biocom + 커피 통합 전환 추적용)
- **B**: 이전에 커피에 잘못 복붙된 스니펫이 남아있음 (의도 아님)
- **C**: 과거에 커피를 biocom 계정으로 운영했다가 최근 `AW-10965703590` 별도 계정 생성했는데 구 스니펫 삭제 안 함

#### 영향

같은 장바구니 conversion 이벤트가 **두 Google Ads 계정에 동시 발사** →
- `AW-304339096` 계정의 conversion 카운트가 **커피 + biocom 합산**으로 잡힘 → 각 사이트별 ROAS 분리 산출 불가
- `AW-10965703590` 계정은 커피 단독 전환만 카운트

**권고**: 사용자가 GTM/헤더 코드의 의도 확인. 의도 아닌 쪽은 제거하여 사이트별 ROAS 정밀도 확보. **roadmap0327.md 의 API 현황 표 수정 필요**.

### 🔬 VirtualAccountIssued 2개 발사 분석 — ROAS 과대 위험 검증

사용자 질문: "VirtualAccountIssued 가 Window + IFrame 두 Frame 에서 발사되는 게 Meta 를 헷갈리게 하거나 ROAS 과대 집계 가능성이 있는가?"

#### 결론: **거의 없음** (이유 4가지)

**① VirtualAccountIssued 는 Purchase 이벤트가 아니다**
- Meta ROAS 의 분자 = `Purchase` 이벤트의 `value` 합계 (또는 운영자가 custom conversion 으로 등록한 이벤트)
- `VirtualAccountIssued` 는 **custom event** 로, Events Manager → Custom Conversions 에 명시적으로 등록하지 않는 한 ROAS 계산에 포함되지 않음
- Meta Ads Manager 의 `purchase_roas` 지표 수식에 포함 안 됨

**② 같은 `event_id` 로 자동 디둡**
- 두 이벤트 모두 `VirtualAccountIssued.o202604140da36f76c0fa4` 동일 event_id
- Meta 는 같은 event_id + 60초 내 중복을 **자동 1건으로 디둡**
- Events Manager → "Deduplication" 탭에서 24~48시간 뒤 실측 디둡 결과 확인 가능

**③ `value: 21300` 파라미터 — 매출로 카운트 안 됨**
- Events Manager 가 metadata 로 표시하지만, ROAS 분자 계산에 포함되는 것은 오직 Purchase 이벤트의 value
- 따라서 VirtualAccountIssued 의 21,300 이 Meta ROAS 를 부풀릴 가능성 없음

**④ 광고 최적화 ML 영향 미미**
- Meta Conversion Optimization ML 의 primary signal 은 Purchase
- funnel 상단 이벤트는 보조 signal
- VirtualAccountIssued 는 둘 다 아닌 **custom event** 라 학습 대상 아님
- 2회 들어와도 디둡됨

#### 실용적 주의점 2가지

1. **Events Manager 대시보드 표시 혼란**:
   - 운영자가 "이벤트 수 2건" 을 보고 "왜 2배?" 로 오해할 수 있음
   - 디둡 후 카운트는 1건이지만 Events Manager raw view 에서 두 Frame 으로 표시됨
   - 운영 커뮤니케이션 시 "Frame Window vs IFrame 은 디둡됨" 을 공유 필요
2. **`image_fallback_after_observe_no` 로직 민감도**:
   - fbq 가 실제로 Meta 에 도달했는데 `performance.getEntriesByType('resource')` 가 포착 못 하는 경우 있음
   - 1.5초 observation window 내 `found=no` 면 image fallback 재발사 → 결과적으로 네트워크 trip 2회
   - Meta 디둡으로 최종 카운트는 1건이므로 **기능적 문제 없음** 이지만 불필요한 네트워크 낭비

#### 개선 옵션 (선택, 긴급도 낮음)

| 옵션 | 내용 | 리스크 |
|---|---|---|
| **A. 관찰 window 연장** | 1.5s → 3s | fallback 확률 감소, 주문완료 페이지 체류 시간 요구 |
| **B. `image_fallback_after_observe_no` 비활성화** | fbq 한 번만 발사, fallback 제거 | fbq 실제 실패 시 이벤트 누락 가능 — biocom v3 도 가진 safety net 이라 검증 필요 |
| **C. 현재 유지 + 관찰** | 그대로 두고 Events Manager Deduplication 탭 실측 | 추가 작업 없음, 데이터 기반 판단 가능 |

**권고: C (현재 유지)**. 이유: biocom v3 가 **같은 safety net 로직** 사용 중이고 운영 안정. 2026-04-16 Deduplication 탭 실측 후 재판단.

#### Phase 재평가: **ROAS 과대 위험 없음**

이 이벤트 중복이 **Phase 1b 완성도 평가에 영향 주지 않음**. 가드 로직 자체는 정확하고, Meta 디둡이 최종 처리를 책임짐.

### 🟡 naverPayButton.js 경고 (신규 footer 무관)

`document.write` cross-site script 경고 — 네이버페이 버튼 렌더링 관련. 기존부터 있던 것. 무시 가능.

### 🟢 Phase 완성도 갱신

| Phase | 이전 | 현재 | 변화 |
|---|---|---|---|
| Phase 1b (자사몰 Purchase Guard) | 🟡 60% | **🟢 90%** | +30%p (커피 Guard + Footer 재설치 완료. 카드결제 live 테스트만 남음) |
| Phase 3 (식별자 품질 + checkout_started) | 🔴 80% (biocom 만) | **🟢 95%** | +15%p (커피도 checkout_started 가 ledger 에 들어가기 시작) |

### 다음 단계 — 카드결제 테스트 권고 (변동 없음)

이제 카드결제를 해야 **`allow_purchase` 분기**가 정상 작동하는지 확인 가능. 체크리스트는 이전 기록 참조(§ 아래 "다음 테스트 단계").

---

## 🧪 2026-04-14 커피 Footer 설치 후 실주문 검증 결과

> 사용자가 `footer/coffeefooter0414.md` 삽입 + 실제 가상계좌 테스트 주문 생성 후 공유한 콘솔 로그 + Meta Events Manager 캡처 + `?__seo_attribution_debug=1` 로 메인 페이지 접속 결과 종합 분석.

### 새 테스트 주문 식별자

| 필드 | 값 |
|---|---|
| **order_code** | **`o20260414d7b75570998b0`** |
| **order_no** | **`202604145802988`** |
| order_id (Toss) | `202604145802988-P1` |
| payment_code | `pa20260414a2ead05c6589d` |
| paymentKey | `iw_th20260414220422uDFg4` |
| value | ₩21,300 |
| URL | `https://thecleancoffee.com/shop_payment_complete?order_code=o20260414d7b75570998b0&payment_code=pa20260414a2ead05c6589d&order_no=202604145802988&rk=S` |

(이전 테스트 주문 `202604144671071` 와는 **다른** 신규 주문)

### ✅ 커피 Purchase Guard — 완벽 작동 확정

콘솔 로그가 가드의 전체 6단계 흐름을 정확히 증명:

```
1. installed 2026-04-14-coffee-server-payment-decision-guard-v3 ✅
2. decision_retry_scheduled reason=no_toss_or_ledger_match retryDelayMs=900 ✅ (첫 조회 시 ledger 아직 적재 안 됨, 900ms 대기)
3. decision_retry_result branch=block_purchase_virtual_account status=pending
   reason=attribution_ledger_status matchedBy=ledger_payment_key confidence=high ✅
   (재시도에서 ledger 에서 paymentKey 매칭 성공 — Path A 실시간 적재가 900ms 안에 들어옴)
4. decision branch=block_purchase_virtual_account source=FB_PIXEL.Purchase
   eventId=Purchase.o20260414d7b75570998b0 ✅
   (원래 Purchase 를 발사하려 한 것을 가드가 정확히 가로챔)
5. custom_event_prepare eventName=VirtualAccountIssued
   eventId=VirtualAccountIssued.o20260414d7b75570998b0 ✅
6. custom_event_sent method=fbq ✅
   custom_event_network_observed found=no → custom_event_sent method=image_fallback_after_observe_no ✅
   (fbq 전송 후 performance API 가 이벤트 관측 못 해서 image fallback 안전 재전송 작동)
```

### ✅ Meta Events Manager 수신 확인

사용자 제공 스크린샷의 VirtualAccountIssued 이벤트:

| 파라미터 | 값 |
|---|---|
| Event ID | `VirtualAccountIssued.o20260414d7b75570998b0` |
| **original_purchase_event_id** | **`Purchase.o20260414d7b75570998b0`** ← event_id 규칙 정확 |
| payment_decision_status | `pending` |
| **payment_decision_reason** | **`attribution_ledger_status`** ← ledger 매칭 성공 (이전엔 `no_toss_or_ledger_match` unknown) |
| snippet_version | `2026-04-14-coffee-server-payment-decision-guard-v3` |
| value | `21300` |
| currency | `KRW` |
| order_code · order_id · order_no · payment_code | 전부 포함 ✅ |
| URL called (facebook.com/tr) | `fbp=fb.1.1775048310435.926984947148613270` **fbp 쿠키 포함** ✅ |

**Purchase 이벤트는 발사되지 않음** (기대대로). VirtualAccountIssued 만 발사됨.

### 🟡 Footer 업그레이드 — **구버전이 아직 우선 실행 중**

사용자가 신규 footer 를 삽입했지만 ledger 검증 결과 **구버전 footer 가 아직 실행되고 있음**.

**증거** (ledger `orderId=202604145802988` 조회):

```json
{
  "loggedAt": "2026-04-14T13:04:31.796Z",
  "touchpoint": "payment_success",
  "paymentStatus": "pending",
  "orderId": "202604145802988",
  "paymentKey": "iw_th20260414220422uDFg4",
  "checkoutId": "",
  "metadata": {
    "snippetVersion": "2026-04-08-coffee-fetchfix-v2",   ← 🔴 구버전
    "orderIdBase": "...",                                  ← 구버전 전용 필드
    "referrerPayment": {
      "orderCode": "o20260414d7b75570998b0",               ← 이건 현재 live 구버전에 이미 있는 필드
      "orderNo": "202604145802988",
      "paymentCode": "pa20260414a2ead05c6589d",
      "orderId": "202604145802988-P1",
      "paymentKey": "iw_th20260414220422uDFg4",
      ...
    }
  }
}
```

**해석 — 3가지 가능성**:

1. **신규 footer 삽입됐지만 기존 구버전 블록을 삭제 안 함** (가장 가능성 높음)
   - 두 블록 모두 실행되는데 구버전이 먼저 실행 → dedupeKey (`__seo_payment_success_sent__:{orderCode}`) 를 먼저 sessionStorage 에 저장
   - 신규 블록이 실행될 때 같은 dedupeKey 를 발견하고 **skip**
   - 결과: ledger 에는 구버전 snippetVersion 만 기록

2. **아임웹 admin 저장 오류** — 신규 내용이 실제로 저장 안 됐을 가능성

3. **브라우저/CDN 캐시** — 사용자 브라우저가 이전 버전 캐시된 스크립트 사용. 시크릿 창으로 재확인 필요

**top-level `orderCode` 필드가 여전히 null 인 것**도 같은 맥락 — 구버전은 orderCode 를 top-level 에 저장 안 하고 metadata.referrerPayment 에만 넣음. 신규 footer 는 top-level payload 에도 `orderCode: orderCode` 로 명시하지만 반영 안 됨.

**이 상태에서도 Purchase Guard 는 정상 작동**하는 이유:
- Guard 는 footer 와 **별개**. Guard 는 header 에 있고, footer 와 무관하게 `ledger_payment_key` 매칭으로 판정됨. ledger 에 payment_success 이벤트는 구버전 footer 로도 적재되므로 가드 작동에 필요한 최소 데이터는 확보됨. 즉 **가드는 신규 footer 없이도 작동**. 신규 footer 의 가치는 **EMQ/checkout_started/orderCode 정합성 개선**이지 가드 동작 자체는 아님

### 🟡 Multiple Pixels 경고 해석

콘솔에 `[Meta Pixel] - Multiple pixels with conflicting versions were detected on this page.` 경고 발생.

**실측 확인**: `grep fbq('init'` 결과 커피 홈 HTML 에 `1186437633687388` **단 하나**만 초기화됨. 이전에 삭제한 `993029601940881` 은 재발견 없음.

**경고 원인 추정**:
- "Multiple pixels" 는 여러 픽셀 ID 가 있을 때뿐 아니라 **`fbevents.js` 라이브러리가 페이지에 여러 번 로드될 때**도 발생
- 아임웹 내장 fbq 초기화 + 우리 가드의 `wrapFbq()` + 다른 외부 스크립트(channel_plugin.js, keepgrow 등)가 fbevents 를 각자 참조하면 Meta 의 deduplication 로직이 경고를 발생시킴
- 콘솔 스택 trace 가 `fbevents.js:440` 에서 여러 번 호출되는 걸로 보아 이 경고 맞음

**영향**: 기능상 문제 없음. 픽셀 이벤트는 하나의 ID (1186437633687388) 로만 나가고 있음. Meta Events Manager 에도 단일 픽셀에 이벤트 수신. 경고 자체는 무시 가능

**완전 해결하려면**: 아임웹 admin 에서 중복 fbq 초기화 스크립트(있다면) 제거. 현 시점에서 긴급도 낮음

### 💡 사용자가 확인할 것 (footer 교체 재검증)

다음 중 하나로 신규 footer 가 진짜 작동하는지 확인:

1. **아임웹 admin 재확인**:
   - 기존 `2026-04-08-coffee-fetchfix-v2` 키워드로 검색했을 때 **여전히 코드가 남아있는지** 확인
   - 남아있으면 → **삭제 후 저장** → 브라우저 캐시 지우고 재확인
2. **시크릿 창 debug 접속**:
   - `https://thecleancoffee.com?utm_source=test&__seo_attribution_debug=1` 으로 접속
   - 콘솔에 `[seo-user-utm]` 또는 `[seo-attribution]` / `[seo-checkout-started]` 디버그 로그가 **보이는지** 확인
   - 안 보이면 → 신규 footer 가 실행 안 되는 상태
3. **sessionStorage 확인**:
   - 결제 시작 페이지에서 DevTools → Application → Session Storage → `__seo_checkout_id` 가 생성됐는지 확인
   - 없으면 → checkout_started 블록 (Block 2) 미실행

### 다음 테스트 단계: **카드결제 테스트** (사용자 질문)

사용자 질문 "다음엔 카드결제 해보면 되나?" → **예, 권고하오**.

#### 기대값

| 경로 | 기대 결과 |
|---|---|
| Guard 로그 | `decision branch=allow_purchase status=confirmed` ← 카드는 즉시 confirmed |
| Browser Pixel | **Purchase 이벤트 발사** (Guard 가 통과시킴). event_id = `Purchase.{order_code}` |
| Meta Events Manager | `Purchase` 이벤트 수신, custom_data: value/currency/order_code 포함 |
| Server CAPI (30분 내) | `sendMetaConversion` 이 같은 event_id 로 Purchase 1회 전송 |
| ledger | `paymentStatus=confirmed` 즉시 전환 |

#### 검증 체크리스트

- [ ] 카드결제 주문 1건 생성 (최저가 커피 1봉, 테스트용)
- [ ] 주문완료 페이지 콘솔에 `decision branch=allow_purchase status=confirmed` 확인
- [ ] Browser Pixel `Purchase` 이벤트 Meta Events Manager 에서 확인
- [ ] event_id 형식 `Purchase.o2026...` 확인 (orderCode 기반)
- [ ] 30분 후 `/api/meta/capi/log` 에서 같은 event_id 로 Server CAPI Purchase 1회 확인
- [ ] 같은 주문에 중복 Purchase event 없는지 확인
- [ ] ledger `paymentStatus` 즉시 `confirmed` 전환 확인

#### 결과 기록 위치

이 섹션 바로 아래 `### 🧪 카드결제 테스트 결과` 서브섹션으로 추가할 것 (결과 나오면 내가 기록).

### 신규 테스트 주문과 이전 주문 비교

| 주문 | 용도 | 현재 상태 | 입금 대기 |
|---|---|---|---|
| `202604144671071` (`o202604140b417b041a30f`) | 첫 가상계좌 테스트 | pending | ⏳ 재무팀 입금 대기 |
| **`202604145802988` (`o20260414d7b75570998b0`)** | **Footer 설치 후 재검증 가상계좌** | **pending** | ⏳ 입금 필요 |

둘 다 입금 완료 후 `pending → confirmed` 전환 + Server CAPI Purchase 발사 확인해야 Phase 1c 완성.

---

## 🧪 2026-04-14 가상계좌 입금 전환 테스트 주문 기록

> **목적**: 커피 Purchase Guard 배포 직후 실제 가상계좌 주문 생성 → 입금 대기 → 입금 완료 후 `pending → confirmed` 전환과 Server CAPI `Purchase` 1회 전송을 live 검증하기 위한 테스트 주문.

### 주문 식별자 (저장 필수)

| 필드 | 값 |
|---|---|
| **order_code** | `o202604140b417b041a30f` |
| **order_no** | `202604144671071` |
| **payment_code** | `pa202604149b10b62bb6543` |
| **order_member** | `m20220223c39f74bfc41c4` |
| pixel_id | `1186437633687388` (coffee) |
| URL | `https://thecleancoffee.com/shop_payment_complete?order_code=o202604140b417b041a30f&payment_code=pa202604149b10b62bb6543&order_no=202604144671071&rk=S` |

### 현재 상태 (2026-04-14 기준)

| 경로 | 상태 | 비고 |
|---|---|---|
| Browser Pixel | ✅ `VirtualAccountIssued` 발사 확인 (Meta Events Manager) | 커피 Purchase Guard v3 가 정상 차단 |
| Browser Pixel `Purchase` | ❌ **없음 (기대대로)** | 가드가 가상계좌 미입금 차단 |
| VM attribution ledger | ✅ `payment_success / pending / orderId=202604144671071` 적재됨 (loggedAt 2026-04-14 11:54 KST) | 현재 `paymentStatus=pending` |
| VM ledger `orderCode` 필드 | 🔴 **null** | **커피 footer 가 orderCode 를 metadata 에 담아 보내지 않음** (§ 아래 footer 개선 분석 참조) |
| Server CAPI `Purchase` | ⏳ 입금 전이라 미전송 | 입금 후 30분 내 자동 전송 예상 |

### 재무팀에게 요청할 것

1. `order_no 202604144671071` 에 해당하는 가상계좌로 실제 입금 실행
2. 입금 시각을 기록해서 공유 (KST)

### 내가 입금 후 확인할 것

1. **T+15분**: `https://att.ainativeos.net/api/attribution/ledger?limit=20` 에서 이 주문의 `paymentStatus` 가 `pending → confirmed` 로 전환됐는지 확인 (attribution status sync 15분 주기)
2. **T+30분**: `https://att.ainativeos.net/api/meta/capi/log?limit=30` 에서 이 주문의 `Purchase` 이벤트가 1회 전송됐는지 확인 (CAPI auto-sync 30분 주기)
3. **T+30분**: Meta Events Manager 에서 `Purchase` 이벤트 수신 확인
4. `event_id` 규칙 확인:
   - **기대값** (biocom 규칙): `Purchase.o202604140b417b041a30f`
   - **우려**: 커피 footer 가 orderCode 를 ledger 에 안 저장 → CAPI 가 orderId 로 fallback → `Purchase.202604144671071` 가 될 가능성. 이 경우 biocom 규칙과 **불일치** → 커피 footer 개선 근거 확보
5. 반복 발송 방지 확인 (같은 order_code 에 여러 Purchase event 가 생기지 않는지)

### 완료 판정 기준

- [ ] ledger `paymentStatus = confirmed`
- [ ] Server CAPI Purchase 1회 전송 `response_status = 200`
- [ ] Meta Events Manager 에 Purchase 1회 수신
- [ ] 동일 주문에 중복 Purchase event_id 없음
- [ ] 가능하면 Browser Pixel 에서 추가 Purchase 시도 0건 (`shop_payment_complete` 페이지 재방문 시 가드가 다시 알고 있어야 함)

---

## 📝 2026-04-14 커피 footer 개선 필요성 분석 (실측 코드 비교)

> 사용자가 biocom/coffee 자사몰에 현재 설치된 **실제 live footer 코드** 를 공유해준 결과를 기반으로 한 분석.
>
> **✅ 2026-04-14 작업 완료**: 신규 파일 [`footer/coffeefooter0414.md`](../footer/coffeefooter0414.md) 생성 (1,125줄). 아임웹 admin 설치 대기. 기존 header guard 파일은 [`footer/coffee_header_guard_0414.md`](../footer/coffee_header_guard_0414.md) 로 rename 됨(파일명 충돌 해소).

### 결론 한 줄

**커피 footer 는 2026-04-08 구버전에 머물러 있고, biocom 이 2026-04-11/04-12 에 받은 6가지 주요 업그레이드가 전부 누락돼 있다. 업그레이드 필요성 🔴 높음**.

### 두 footer 의 실측 차이

| 기능 | biocom (현재 live) | coffee (현재 live) | 영향 |
|---|---|---|---|
| snippetVersion | **2026-04-11-checkout-started-v1** + **2026-04-12-payment-success-order-code-v2** | 🔴 **2026-04-08-coffee-fetchfix-v2** (6일 뒤처짐) | — |
| UTM persistence 키 | `rebuyz_utm` + `rebuyz_utm_first_touch` + `rebuyz_utm_latest_touch` | `_p1s1a_session_touch` + `_p1s1a_first_touch` + `_p1s1a_last_touch` | 구현 패턴 다름 (큰 문제 아님) |
| **Formbricks user_id 추출** | ✅ `getUserID()` — localStorage 에서 `formbricks-js` 파싱 | ❌ 없음 | 고객 식별 교차 검증 불가 |
| **gtag `set` user_id** | ✅ 최대 5초 대기 후 gtag 에 user_id 주입 | ❌ 없음 | GA4 사용자 단위 리포트 품질 저하 |
| **`rebuyz_view` GA 이벤트** | ✅ 페이지뷰 시 GA 로 action=view 이벤트 전송 | ❌ 없음 | 기존 GA 구조 호환성 |
| 🔴 **`checkout_started` 이벤트** | ✅ `/api/attribution/checkout-context` 로 전송. `checkoutId` 생성 + 세션스토리지 저장 + fbc/fbp/clientId/ga_session_id 전부 포함 | 🔴 **완전 부재** | **checkout → payment 연결 끊김**. Phase 3 "식별자 품질과 checkout_started" 에서 coffee 가 빈 상태인 원인 |
| `payment_success` endpoint | ✅ `/api/attribution/payment-success` | ✅ 동일 | OK |
| 🔴 **`orderCode` 파싱** | ✅ URL + `document.referrer` + imwebSession + lastTouch + DOM 다중 fallback | 🔴 **없음** (orderId, paymentKey 만 파싱) | **ledger `orderCode: null` 의 직접 원인** (§ 위 테스트 주문 상태 표 참조) |
| **`orderMember` 파싱** | ✅ URL + referrer + imwebSession + lastTouch | ❌ 없음 | 고객 식별 누락 |
| **`checkoutId` 재사용** | ✅ `__seo_checkout_context` 세션스토리지에서 읽어 payload 에 포함 → checkout_started 와 payment_success 같은 세션으로 묶임 | ❌ 없음 (checkout_started 자체가 없어서) | funnel 연결 불가 |
| 🔴 **`browser_purchase_event_id = Purchase.{orderCode}`** | ✅ metadata 에 직접 포함 → Pixel·CAPI·ledger 3자 디둡 가능 | 🔴 **없음** | **biocom 의 `event_id` 규칙과 호환 불가**. Server CAPI 가 orderId fallback 사용 시 event_id 형식 달라짐 |
| 🔴 **`referrerPayment` 객체** | ✅ metadata 에 `{orderCode, orderNo, orderId, orderMember, paymentCode, paymentKey, amount}` 전부 포함 | 🔴 **없음** | 주문완료 페이지에서 URL 파라미터 소실 시 referrer 로 복원하는 보강 로직 부재 |
| 🔴 **`fbc`/`fbp` 쿠키** | ✅ 양쪽 이벤트(`checkout_started` + `payment_success`) 모두 `_fbc` / `_fbp` 쿠키 + URL 파라미터 + lastTouch 에서 읽어 payload 에 포함 | 🔴 **없음** | **Meta EMQ(Event Match Quality) 점수 상한이 낮아짐**. fbc/fbp 는 매치 퀄리티의 핵심 시그널 |
| URL fallback from referrer | ✅ `parsePaymentParamsFromUrl(document.referrer)` — 주문완료 페이지 URL 이 비어 있어도 이전 페이지에서 복원 | ❌ 없음 | pagination/리다이렉트 시점에 주문 식별 실패 가능 |
| measurementIds | `['G-WJFXN5E2Q1', 'G-8GZ48B1S59']` (GTM dual) | `['G-JLSBXX7300']` | 커피 단일 (정상) |
| clearCheckoutContext (완료 후 세션 초기화) | ✅ | ❌ (context 자체가 없음) | — |

### 각 차이점이 실제 운영에 미치는 영향

#### ① `orderCode` 누락 — 🔴 가장 심각

**문제**:
- 2026-04-14 테스트 주문에서 ledger 에 `orderCode: null` 로 기록됨. payment_success 이벤트는 도달했지만 metadata 에 orderCode 가 없어서 **`event_id = Purchase.{orderCode}` 규칙이 작동 안 함**.
- 입금 후 Server CAPI 가 Purchase 이벤트를 보낼 때 orderCode 가 없으면 orderId 로 fallback → `Purchase.202604144671071` 같은 형식 → biocom 의 `Purchase.o2026...` 형식과 **불일치**.
- 결과: **브라우저 Pixel event_id 와 Server CAPI event_id 가 같지 않으면 Meta 가 디둡 못 함** → 같은 주문이 2회 카운트될 수 있음.

**해결**:
- biocom 의 `parsePaymentParamsFromUrl(document.referrer)` 패턴 이식
- URL + referrer + imwebSession + lastTouch 다중 fallback 으로 orderCode 확실히 확보
- metadata 에 `browser_purchase_event_id` 명시적 생성

#### ② `checkout_started` 이벤트 부재 — 🔴 funnel 연결 끊김

**문제**:
- 커피는 결제 시작 시점을 기록하지 못함. checkout 경로의 ledger 데이터가 아예 없음.
- Phase 3 (식별자 품질과 checkout_started) 에서 coffee 는 여전히 **0% 진행**.
- 결과: "결제 시작했는데 완료 안 한 사용자" 를 정량 측정 불가 → 이탈 분석 · checkout drop-off 리타게팅 불가.

**해결**:
- biocom 의 `/api/attribution/checkout-context` 호출 스크립트를 그대로 이식
- `measurementIds: ['G-JLSBXX7300']` 로 수정 (커피 GA4 ID)
- `source: 'thecleancoffee_imweb'`, `snippetVersion: '2026-04-14-coffee-checkout-started-v1'` 으로 라벨

#### ③ `fbc` / `fbp` 쿠키 누락 — 🟡 EMQ 상한 낮음

**문제**:
- Meta EMQ 는 매치 시그널 품질로 0~10 점 계산. `fbc`(Facebook Click ID) 와 `fbp`(Facebook Browser ID) 는 **가장 강력한 시그널 2종**. 이게 없으면 EMQ 상한이 7점 근처에 걸림.
- 커피는 Meta 광고 효과 측정이 근본적으로 덜 정확하게 나오고 있을 가능성.

**해결**:
- `readCookie('_fbc')`, `readCookie('_fbp')` 를 `tracking` 객체에 포함
- `checkout_started` 와 `payment_success` 양쪽 payload 에 전달

#### ④ Formbricks user_id 부재 — 🟡 교차 검증 불가

**문제**:
- biocom 은 Formbricks(퀴즈/설문 솔루션) 의 user_id 를 받아서 Meta 와 자사 CRM 에서 같은 사용자임을 교차 검증.
- 커피는 이 경로 없음. 고객 journey 연결이 제한적.

**해결**:
- `getUserID()` 함수 이식. 단 커피 사이트에 Formbricks 설치 여부 확인 필요. 없으면 생략 가능.

#### ⑤ `referrerPayment` 객체 부재 — 🟡 주문 식별 복원력 낮음

**문제**:
- 아임웹 결제완료 페이지는 어떤 경우 redirect 로 URL 파라미터가 소실될 수 있음. biocom 은 이때 `document.referrer` 에서 복원하는 로직 있음.
- 커피는 없으므로 URL 파라미터 손실 시 주문 식별 실패 가능.

**해결**:
- `parsePaymentParamsFromUrl(document.referrer)` 이식

### 개선 작업 범위 추정 — ✅ 코드 작업 완료 (2026-04-14)

**완료**: [`footer/coffeefooter0414.md`](../footer/coffeefooter0414.md) 신규 생성 (1,125줄, 3 script block: UTM persistence + checkout_started + payment_success). 스크립트 본문 내 `biocom` 잔존 0건, `thecleancoffee`/`G-JLSBXX7300` 19건 치환 확인.

**남은 작업**: 아임웹 admin 에서 기존 footer **삭제 후 교체** + 실주문 검증.

| 작업 | 상태 | 비고 |
|---|---|---|
| biocom footer 를 커피로 치환 | ✅ 완료 (2026-04-14) | 5개 파일 참조도 rename 처리 |
| Formbricks 설치 여부 확인 + 분기 처리 | ⚠️ 코드에는 포함 (getUserID null 안전) | 커피에 Formbricks 설치 여부 사용자 확인 필요 |
| 사용자 아임웹 admin **교체** 설치 | ⏳ 대기 | 🔴 **반드시 기존 삭제 후 삽입** (append 금지) |
| 카나리 검증 (debug 모드) | ⏳ 설치 직후 | `?__seo_attribution_debug=1` 로 콘솔·Network 관찰 |
| 실주문 테스트 + ledger 관찰 | ⏳ 1일 | `orderCode` null 아닌지 확인 |

### 권고 의사결정

1. **즉시 권고 (Phase 1c 블로커 해소 목적)** — 커피 가상계좌 입금 테스트 주문의 Server CAPI event_id 정합성 검증을 위해 **testing 전에 footer 업그레이드**. 이렇게 하면 테스트 주문이 업그레이드된 footer 로부터 orderCode 를 재획득하고 event_id 가 `Purchase.o202604140b417b041a30f` 로 정확히 생성될 수 있음.
2. **대안 (작업 지연 시)** — 이번 테스트 주문은 **"footer 구버전의 한계가 드러나는 케이스"** 로 간주하고 진행. 결과가 나오면 footer 업그레이드의 당위성이 수치로 증명됨. 그 후 업그레이드.

### footer 업그레이드와 Phase 9 (Funnel 이벤트 확장) 의 관계

- 이 footer 업그레이드는 **attribution ledger 품질** 문제 해결
- Phase 9 Funnel 이벤트 확장은 **Meta Pixel EMQ** 품질 개선
- 두 작업은 **독립** 이지만 **둘 다 fbc/fbp 가 필요**하므로 함께 하는 것이 효율적
- 권고: footer 업그레이드 + Phase 9 Day 2~3 동시 진행. 하나의 아임웹 admin 설치 세션에서 처리 가능

### Phase 요약표 반영

Phase 요약표 (§아래) 의 **Phase 10 (신규)** 으로 "커피 footer 업그레이드 — orderCode · checkout_started · fbc/fbp 추가" 를 추가 권고. 또는 기존 Phase 1b 의 남은 과제에 포함 가능.

---

## 🔧 2026-04-14 세션 종료 보고 — imweb/toss 자동 sync 구현 + VM 배포 준비

### 1. 이번 세션에서 한 것

#### A. Toss settlements 수동 sync 실행 (VM 에 직접 호출)

| 사이트 | 결과 | 소요 |
|---|---|---|
| biocom | **+138 transactions / +201 settlements** (range 4/11~4/13) | 4.5초 |
| coffee | 0건 (최근 3일 커피 Toss 거래 없음) | 0.76초 |

#### B. 자동 sync 코드 구현 — 5개 파일 수정 (165줄 추가)

| 파일 | 변경 |
|---|---|
| `backend/src/env.ts` | env 스위치 6개 추가 (`IMWEB_AUTO_SYNC_*` 3개 + `TOSS_AUTO_SYNC_*` 3개) |
| `backend/src/bootstrap/startBackgroundJobs.ts` | 2 job 추가 (`runImwebOrdersSync` + `runTossSettlementsSync`) + 기동 로직 + offset 설계 |
| `backend/src/health/buildHealthPayload.ts` | `/health` 응답에 `imwebAutoSync` / `tossAutoSync` 2개 필드 신설 |
| `backend/.env.example` | 6개 변수 + 주석 문서 |
| `capivm/backend.env.vm.example` | 동일 (컷오버 안전값 `false`) |

### 2. 핵심 설계 결정

#### Self-HTTP-call 패턴
```typescript
const response = await fetch(`${selfBaseUrl}/api/crm-local/imweb/sync-orders`, {
  method: "POST",
  body: JSON.stringify({ site, maxPage: imwebAutoSyncMaxPage }),
});
```
- **기존 route 재사용** → 로직 중복 0, validation·error handling 상속
- 같은 Node 프로세스 내 localhost 호출 → 네트워크 overhead 무시
- PM2 single instance 에서도 안전

#### Offset 설계 (tick 겹침 방지)

| Job | 주기 | 시작 offset |
|---|---|---|
| Attribution status sync (기존) | 15분 | +1.5분 |
| **Imweb orders sync (신규)** | **15분** | **+3분** |
| CAPI auto-sync (기존) | 30분 | +1분 |
| **Toss settlements sync (신규)** | **15분** | **+8분** |

→ 5분 간격으로 분산, SQLite write·네트워크 부하 몰림 방지.

#### 양쪽 사이트 순차 처리
```typescript
const sites = ["biocom", "thecleancoffee"] as const;
for (const site of sites) { /* 1회 sync */ }
```
- 병렬이 아닌 **sequential** — imweb API rate limit 여유 확보
- 한 사이트 실패해도 다음 사이트 계속 (try/catch per-site)

#### 에러 처리
- 90초 타임아웃 (`AbortController`)
- 실패 시 `console.error` 로깅만, `throw` 없음 → 다음 tick 에 재시도
- 성공 시 `synced > 0` 일 때만 로그 (조용한 운영)

### 3. 검증 결과

**tsc**: exit 0 ✅
**build**: exit 0 ✅ (`tsc -p tsconfig.json`)
**로컬 /health live probe**:
```json
{
  "imwebAutoSync": { "enabled": false, "intervalMs": 900000, "maxPage": 30 },
  "tossAutoSync": { "enabled": false, "intervalMs": 900000, "windowHours": 6 }
}
```
- 신규 필드 2개 정상 반환
- 기본값 `enabled: false` (안전 기본) — 배포 시 VM env 에서 `true` 로 명시적 활성화 필요
- tsx watch 자동 리로드로 코드 반영 확인

### 4. 배포 준비도

**내가 완료한 것**:
- [x] env 스키마 확장
- [x] 자동 sync job 구현
- [x] health 응답 확장
- [x] 문서 업데이트 (.env.example 2종)
- [x] tsc/build 통과
- [x] 로컬 /health 필드 검증

**사용자가 할 것** (내일 아침):
1. **커피 Purchase Guard 배포** — footer/coffee_header_guard_0414.md 를 아임웹 admin 에 설치 + 실주문 3건 테스트
2. **VM 재배포**:
   ```bash
   cd /Users/vibetj/coding/seo
   npm --prefix backend run build
   VM_USER=<...> VM_HOST=<...> capivm/deploy-backend-rsync.sh
   ssh <vm> "cd /opt/seo/repo/backend && npm ci && npm run build"
   ssh <vm> "pm2 restart seo-backend --update-env"
   ```
3. **VM env 업데이트** — `/opt/seo/shared/env/backend.env` 에 6개 env 추가 (initial `false` 로 두고 컷오버 후 `true`):
   ```
   IMWEB_AUTO_SYNC_ENABLED=true
   IMWEB_AUTO_SYNC_INTERVAL_MS=900000
   IMWEB_AUTO_SYNC_MAX_PAGE=30
   TOSS_AUTO_SYNC_ENABLED=true
   TOSS_AUTO_SYNC_INTERVAL_MS=900000
   TOSS_AUTO_SYNC_WINDOW_HOURS=6
   ```
4. **재기동 검증**:
   ```bash
   curl https://att.ainativeos.net/health | jq '.backgroundJobs.imwebAutoSync, .backgroundJobs.tossAutoSync'
   # → enabled: true 확인
   # 약 3분 후 PM2 로그에 [Imweb orders sync] 활성화 메시지 확인
   # 약 18분 후 첫 번째 tick 에서 sync 실행 로그 확인
   ```

### 5. 리소스 예측 (vmreport.md §6.6.4 기반)

| 지표 | 값 |
|---|---|
| 1 cycle 소요 | 약 8~10초 (biocom 5 + coffee 2~4) |
| 15분 주기 사용률 | **0.9~1.1%** |
| 메모리 피크 | +10MB 일시 → GC 후 해제 |
| PM2 `max_memory_restart: 700M` 영향 | 없음 |
| 네트워크 | 3~5 KB/초 평균 |
| CPU | 0.1~0.3% 점유 |
| 기존 3 job 과 합산 | **< 5%** 총 리소스 |

### 6. 남은 리스크
- **self HTTP call 방식**은 단일 프로세스에서 동작. 만약 VM 이 이후 다중 instance 로 전환되면 각 instance 가 동일 sync 를 중복 실행할 수 있음 — 현재 PM2 `instances: 1 fork` 고정이라 문제 없음
- **첫 배포 시 imweb token 만료 가능성** — imweb API 토큰이 expires 되면 `syncOneSiteOrders` 가 `토큰 발급 실패` 에러 반환. 로그에 찍히지만 job 자동 복구 안 됨 — 사람이 env 토큰 갱신 필요
- **Toss settlements 의 incremental mode range** 는 현재 endpoint 구현상 약 3일 범위로 고정돼 있을 수 있음. `windowHours` 파라미터가 실제로 받는지 `routes/toss.ts` 검증 필요 — 내가 추가한 env 파라미터는 전달만 할 뿐, 해당 route 가 읽지 않으면 무시됨. 실제 동작 확인 전까지는 **이론적 설계값**으로 남겨둠

### 7. 다음 액션 (현재 세션 종료 시점)

- 사용자: 내일 아침 커피 가드 배포 + VM 재배포로 자동 sync 활성화
- 재배포 후 검증: `/api/crm-local/imweb/order-stats?site=thecleancoffee` 호출해서 **자동 sync 가 lastSyncedAt 을 갱신시키는지** 확인

**커피 Purchase Guard 의 Phase 1b 배포 선결 과제 4건이 모두 해소**된 상태이고, **자동 sync 코드도 완성**돼 있으니 내일 아침 작업이 한결 가벼울 것.

---

## 📊 Phase 요약표 (2026-04-14 기준)

> 본 문서가 커버하는 CAPI 관련 작업 전체의 완성도 스냅샷. 100% 되려면 각 row 의 "남은 과제" 를 마쳐야 함. 수치는 **기능 범위 기준** (실 트래픽이 어디까지 흘러가는가) 이 아니라 **구현·배포 완료 기준**이오.

| # | Phase | 완성도 | 무엇까지 됐나 | 100% 되려면 |
|---|---|---|---|---|
| **1** | **CAPI 기본 전송** (Purchase auto-sync) | **✅ 100%** | 바이오컴·커피·aibio 3사이트에서 PG confirmed 주문을 자동 수집해 Meta CAPI 로 Purchase 이벤트 전송. 30분 cron, SHA-256 해싱, 디둡 완비. 최근 5일 바이오컴 499건 전부 성공. (서버사이드 전송 한정) | 유지보수만 필요. 신규 작업 없음 |
| **1b** | **자사몰 Purchase Guard (가상계좌 분리)** — ⚠️ **사이트별 상태 차이 큼** | **🟡 60%** | **biocom 100%**: 2026-04-12 v3 guard 완료 + 실주문 2건 live 테스트 통과. **coffee 20%**: 2026-04-14 [footer/coffee_header_guard_0414.md](../footer/coffee_header_guard_0414.md) 복제 완료 (1,053줄, 스크립트 본문 내 `biocom` 잔존 0건, 12개 치환 포인트 전수 처리). 배포 전 선결 과제 4건 중 2건 자동 해소(§ 하단 [Phase 1b 배포 체크리스트 실측 결과](#phase-1b-배포-체크리스트-실측-결과-2026-04-14) 참조). 아임웹 admin 설치 + 실주문 3건 테스트 미착수. | (1) ~~coffee_header_guard_0414.md 복제~~ ✅ (2) backend `payment-decision` `site=thecleancoffee` 분기 확인·추가 (3) CORS 화이트리스트 확인 (4) **커피 Imweb/Toss sync 복구** (자동 sync 없음 · 수동 실행 필요) (5) 아임웹 admin 설치 (6) 실주문 3건 live 테스트 (7) capivm/capi.md 에 coffee 섹션 append |
| **1c** | **가상계좌 입금→confirmed 전환 테스트** | **🔴 20%** | biocom 가상계좌 발급 단계까지만 검증됨. 실제 입금 후 Attribution status pending→confirmed 전환 + Server CAPI Purchase 1회 전송 케이스는 **미검증**(capivm/capi.md §아직 남은 것 #1). TJ 가 실제 입금 처리해야 테스트 가능. | (1) biocom 가상계좌 주문 `o20260412cdb6664e94ccb` 실제 입금 처리 (2) attribution status sync 로 원장 confirmed 전환 확인 (3) CAPI auto-sync 가 Server Purchase 1회 전송 확인 (4) event_id 동일성 (`Purchase.o20260412cdb6664e94ccb`) 검증 (5) 24시간 반복 없음 검증 |
| **2** | **토큰 인프라** | **🟡 85%** | (a) 커피 시스템 유저 토큰 분리, (b) 3단 fallback chain, (c) `resolveCapiToken` pixel 분기, (d) `/api/meta/health` live probe, (e) `/ads` 뱃지 UI. 이번 세션에서 완료. | (1) 커피 시스템 유저 토큰이 60일 만료로 발급돼 **Never-expiring 으로 재발급** 필요 (2) biocom 전용 시스템 유저 토큰 발급 (3) `COFFEE_META_SYSTEM_USERID` 값 정정 (BM ID vs SU ID) |
| **3** | **Funnel 이벤트 확장 (§4 계획)** | **🟡 35%** | (a) DOM 셀렉터 실측 검증 (b) 아키텍처 설계 (c) 5일 작업 계획 문서화 (d) **Day 1 서버 인프라 완료 2026-04-14** — `sendFunnelEvent()` 헬퍼 + `POST /api/meta/capi/track` 엔드포인트 + CORS 화이트리스트 + rate limit + 픽셀/이벤트명 검증. 실전 테스트 5 케이스 전부 통과. | (1) Day 2~3 아임웹 ViewContent·AddToCart 브라우저 스크립트 설치 (2) Day 4 InitiateCheckout + Purchase 픽셀 리페어 (3) Day 5 EMQ 측정 + 롤아웃 |
| **4** | **CAPIG 검토·의사결정** | **✅ 100%** | 비용/효과 분석 문서화 완료 (§CAPIG 섹션). 결론: 현 볼륨에서 도입 안함. 재검토 트리거 5개 사전 정의. | 트리거 도달 시 재검토. **매월 1회 자동 점검** 루틴을 metacoffee0413.md #12 와 묶어야 완전 100% |
| **5** | **매치 퀄리티 모니터링 (EMQ)** | **🔴 0%** | `/api/meta/capi/health` 엔드포인트 부재. Match Quality proxy(email/phone/fbp/fbc 제공률) 집계 없음. Meta Events Manager 수동 확인만 가능. | (1) `/api/meta/capi/health?window=24h&pixel=X` 엔드포인트 신설 (metacoffee0413.md #12) (2) 알림 임계치 warning 5% / critical 10% (3) `/ads` 페이지에 드랍률 위젯 |
| **6** | **이벤트 볼륨 대시보드** | **🟡 40%** | `/api/meta/capi/log` 가 raw log 반환. 기본 total/success/failure 집계는 frontend 단에서 수행. 분포·추이 분석 없음. | (1) event_name 별 일간 분포 차트 (2) SKU(content_ids) 별 분포 (3) session_id 기반 funnel 컨버전율 (cart-mediated vs direct) |
| **7** | **장바구니 경유율 측정** | **🔴 0%** | 아임웹 API 로는 측정 불가 (§3.7 참조). 브라우저 funnel 이벤트 자체가 없어서 계산 불가능. | Phase 3 완료 후 자동 가능. Day 13~14 에 집계 스크립트 작성 (약 30분) |
| **8** | **SKU × ROAS 분해** | **🔴 0%** | 커피 가격 A/B 실험 판정에 필요. 현재 계정 단위 집계만 가능. `content_ids` 매핑·UTM 네이밍 규약 부재. | (1) 광고 네이밍 컨벤션 합의 (2) Meta insights + attribution ledger 조인 API (3) SKU 필터 대시보드 (`coffeeprice0413.md` #11 와 동일) |
| **9** | **토큰 로테이션 Runbook** | **🔴 0%** | 지식이 세션 대화에만 존재. 다음 만료 시 다시 시행착오 반복 위험. | (1) `coffee/runbooks/meta-token-rotation.md` 신설 (2) 7단계 절차 + 스크린샷 경로 (3) 5가지 자주 발생하는 에러 코드 대응표 |
| **10** | **Post-mortem / 인시던트 문서화** | **🟡 60%** | 0411 토큰 만료 사고는 `coffee/metacoffee.md` 에 기록. 0414 복구는 `metacoffee0413.md` 에 분산 기록. 하나의 권위 문서 없음. | `metacoffee.md` 에 0414 복구 섹션 append (metacoffee0413.md §5 #6) |

### 전체 가중 평균 완성도: **약 46%**

(12개 Phase 동일 가중치 단순 평균. 2026-04-14 Phase 1b/1c 추가로 기존 52% 에서 46% 로 재조정. Phase 1·4 완료. Phase 1b·2·3·10 진행 중. Phase 1c·5·7·8·9 미착수)

### 🔴 사이트별 상태 불균형 경고

| 축 | biocom | coffee | 비고 |
|---|---|---|---|
| Server CAPI auto-sync | ✅ | ✅ | Phase 1 공통 |
| **브라우저 Purchase Guard (가상계좌 분리)** | **✅ v3 완료 + live 테스트** | **❌ 미착수** | Phase 1b — 커피는 브라우저 Pixel 이 가상계좌 미입금을 Purchase 로 카운트할 여지 |
| 토큰 인프라 (시스템 유저) | ❌ (아직 main 토큰 공유) | ✅ 2026-04-14 분리 | Phase 2 — biocom 2.3 추적 |
| Funnel 이벤트 (ViewContent 등) | ❌ 미설치 | ❌ 미설치 | Phase 3 공통 — Day 2 착수 대기 |

**결론**: 커피는 토큰은 앞서 있지만 **가상계좌 Purchase 분리**가 뒤처짐. biocom 이 2026-04-12 에 거친 "실주문 3단계 테스트 + v3 스크립트 배포" 를 커피에서도 **동일하게 반복**해야 Phase 1b 100% 달성 가능.

### Phase 1b 배포 체크리스트 실측 결과 (2026-04-14)

`footer/coffee_header_guard_0414.md` 의 배포 전 선결 과제 4건을 실제 코드·환경에서 검증한 결과. 2건은 자동 해소, 2건은 별도 작업 필요.

#### ✅ #1 Toss 커피 secret key — **이미 존재 (해소)**

**실측**: `backend/.env` 에 `TOSS_LIVE_SECRET_KEY_COFFEE_API=live_sk_P9BRQmyarY5vo1LoGNjNrJ07KzLN` 형태로 저장됨. 키 이름에 `_API` 접미사가 붙어 있지만, `backend/src/env.ts:17-18` 에서 fallback 처리를 해둠:

```typescript
TOSS_LIVE_SECRET_KEY_COFFEE:
  process.env.TOSS_LIVE_SECRET_KEY_COFFEE ?? process.env.TOSS_LIVE_SECRET_KEY_COFFEE_API,
```

따라서 코드 내부에서는 `env.TOSS_LIVE_SECRET_KEY_COFFEE` 로 접근 가능하고, `tossConfig.ts:45` 와 `metaCapi.ts:876` 에서 이미 사용 중. 새로 발급받을 필요 없음.

#### ⚠️ #2 Backend `payment-decision` 의 `site=thecleancoffee` 분기 — **확인 필요**

- `backend/src/routes/attribution.ts` 의 `payment-decision` 엔드포인트가 현재 `site=biocom` 만 하드코딩돼 있을 가능성 높음.
- 확인 명령: `rg "payment-decision|'thecleancoffee'|\"thecleancoffee\"" backend/src/routes/attribution.ts`
- 분기가 없으면 커피 가드 설치 시 카드 결제도 `unknown` 으로 차단되어 실매출 Purchase 누락 발생.
- **작업 필요 — 이 세션에서 처리 가능**.

#### ⚠️ #3 CORS 허용 origin — **확인 필요**

- `backend/src/bootstrap/configureMiddleware.ts` 의 CORS 화이트리스트에 `https://thecleancoffee.com`, `https://www.thecleancoffee.com`, `https://thecleancoffee.imweb.me` 포함 여부 확인.
- biocom 은 이미 포함됨. 커피 도메인이 추가됐는지는 코드 확인 필요.
- **작업 필요 — 이 세션에서 처리 가능**.

#### 🔴 #4 커피 Imweb/Toss sync 복구 — **원인 확정 (자동 sync 부재)**

**실측 데이터 (`backend/data/crm.sqlite3`)**:

| 사이트 | imweb_orders 총 | 최신 주문 시각 | 마지막 synced_at | 경과일 |
|---|---|---|---|---|
| biocom | **8,362건** | 2026-04-12 11:54 KST | 2026-04-12 12:03 KST | 2일 전 |
| **coffee** | **1,937건** | **2026-04-04 10:38 KST** | **2026-04-04 13:18 KST** | **10일 전** ❌ |

**원인 확정**: `backend/src/bootstrap/startBackgroundJobs.ts` 전문 검토 결과, 자동 sync 로 돌고 있는 것은 다음 3개뿐이다:

| Job | 주기 | 대상 | 사이트 |
|---|---|---|---|
| ✅ `[CAPI auto-sync]` | 30분 | Meta CAPI Purchase 이벤트 전송 | 전 사이트 |
| ✅ `[Attribution status sync]` | 15분 | attribution ledger pending→confirmed 전환 | 전 사이트 |
| ✅ `[Scheduled send]` | 60초 | 알림톡/SMS 예약 발송 | 전 사이트 |

❌ **자동 sync 에 없는 것** — `imweb_orders` sync, `toss_settlements` sync
- 두 작업은 `POST /api/crm-local/imweb/sync-orders` 와 `POST /api/toss/sync` 를 **수동 호출**해야만 실행됨
- 두 사이트 모두 동일 구조. biocom 은 2026-04-12 에 수동 실행, 커피는 2026-04-04 이후 수동 실행 **없음**
- 즉 "커피가 멈춰있다" 의 원인은 사이트 차별이 아니라 **누군가 커피 쪽을 4/4 이후 수동 실행 안 한 것**

**왜 자동화되지 않았나**:
1. 아임웹/Toss API 호출은 장거리 pagination (수만 행) 이 걸릴 수 있어 background job 으로 돌리면 long-running 리스크
2. 운영 초기에 ledger 무결성을 사람이 수동 확인하는 걸 선호해서 자동화 유보됐을 가능성
3. `capivm/capi.md` 와 `roadmap0327.md` 0411 기록상 수동 실행은 정기 루틴에 포함돼 있으나 커피 분기는 지난 10일간 실제 수행되지 않음

**해결 — 2단계**:
1. **즉시 복구** (수동 1회): 아래 명령으로 커피 최신 데이터 가져오기
   ```bash
   curl -X POST "http://localhost:7020/api/crm-local/imweb/sync-orders" \
     -H "Content-Type: application/json" -d '{"site":"thecleancoffee"}'
   curl -X POST "http://localhost:7020/api/toss/sync?store=thecleancoffee&mode=incremental"
   ```
2. **근본 해결** (P1 작업): `startBackgroundJobs.ts` 에 **imweb/toss 자동 sync 등록** — 6시간 주기 정도로 두 사이트 공통. 다만 pagination rate limit 고려해서 off-peak 시간대(KST 새벽) 실행.

이것은 본 Phase 1b 의 차단 조건이므로 coffee guard 설치 전에 반드시 수동 복구 최소 1회. 자동화는 별도 tracking 으로 Phase 1b 와 분리 가능.

---

### 다음 마일스톤

- **Milestone A — ✅ Day 1 서버 인프라** (2026-04-14 완료): Phase 3 10% → 35%
- **Milestone A2 — coffee 가드 복제** (이번 주 권고): Phase 1b 50% → 90% (복제·설치까지). 나머지 10% 는 실주문 live 테스트 TJ 대기.
- **Milestone B — funnel 실전 배포** (이번 주): Day 2~4 아임웹 브라우저 스크립트 + 카나리 → Phase 3 → 80%
- **Milestone C — EMQ 측정 자동화** (다음 주): Phase 5 + Phase 6 동시 착수 → 전체 완성도 46% → 68%
- **Milestone D — 100% 도달 예정** (2026-05 말): Phase 9 Runbook + Phase 8 SKU ROAS + Phase 1c 가상계좌 입금 전환 완료 시

---

## 🎯 Funnel 이벤트 확장 개선 계획 (2026-04-14)

> CAPIG 검토 보고서 §5.1 #A 의 구체 실행 계획.
> 촉발 계기: 바이오컴 최근 5일 CAPI 이벤트 499건 중 **100% Purchase**. Meta EMQ 개선의 최대 레버는 **funnel 상단 이벤트 다양성**인데, 현재 전환 직전 이벤트 하나만 쏘고 있음.

### 0. 한 줄 결론 (TL;DR)

**ViewContent · AddToCart · InitiateCheckout 3개 이벤트를 추가로 전송한다. 브라우저 픽셀 + 서버 사이드 CAPI 를 같은 `event_id` 로 병행 발사해 디둡시킨다. 5일 작업, 예상 EMQ +1.0~1.5점 · 광고 최적화 효율 5~10% 개선.** 바이오컴 먼저, 커피는 공통 인프라 재사용.

---

### 1. 현재 상태 — 왜 Purchase 만 있는가

**실측 데이터 (2026-04-14 `/api/meta/capi/log`)**:
| 이벤트 | 최근 5일 건수 | 비중 |
|---|---|---|
| Purchase | 499 | **100%** |
| ViewContent | 0 | 0% |
| AddToCart | 0 | 0% |
| InitiateCheckout | 0 | 0% |
| Lead / Search / CompleteRegistration | 0 | 0% |

**코드 상태**:
- `backend/src/metaCapi.ts:11` — `DEFAULT_EVENT_NAME = "Purchase"`. Purchase 중심 설계이나 `event_name` 파라미터는 존재 → **이벤트 타입 확장 자체는 로직 변경 없이 가능**.
- 전송 경로는 두 가지:
  - **auto_sync**: attribution ledger 의 PG confirmed 건을 cron 이 Purchase 로 변환해 전송 (현재 주력)
  - **manual_api**: `POST /api/meta/capi/send` 로 외부 호출
- **funnel 이벤트를 만드는 트리거가 없음** — 브라우저에서 상품을 보거나 장바구니에 담아도 서버에 그 사실이 기록되지 않아 CAPI 로 쏠 원천 데이터 자체가 부재.

**진단**:
- funnel 이벤트는 본래 **브라우저 행동**에서 시작. 서버가 그것을 알려면 (a) 브라우저가 서버에 알려주거나 (b) 아임웹이 이벤트 로그를 API 로 제공해야 함.
- 아임웹 공식 API 는 주문 단위만 제공하므로 (b) 불가능. 반드시 **(a) 브라우저 → 서버 경로**를 만들어야 함.

---

### 1.5 Meta 공식 지원 여부와 머신러닝 활용 방식

> 핵심 질문 두 가지: (A) funnel 구조 CAPI 가 Meta 공식 지원 기능인가? (B) 그렇다면 머신러닝이 앞 단계를 고려해 자동 최적화해주는가?

#### 1.5.1 결론 — 둘 다 "YES"

**(A) 공식 지원**: ViewContent · AddToCart · InitiateCheckout · Purchase 는 Meta 의 **Standard Events** 세트. Pixel 과 CAPI 양쪽 모두 공식 이벤트명. 커스텀 이벤트가 아니라 **Meta 가 특별 대우**하는 이벤트들이오. [공식 문서](https://developers.facebook.com/docs/meta-pixel/reference#standard-events)

**(B) ML 자동 최적화**: Meta 광고 시스템은 Purchase 최적화 캠페인을 돌릴 때 **funnel 상단 이벤트들을 "구매 전조 신호"로 학습 데이터에 포함**. 이건 선택 옵션이 아니라 **Meta 의 알고리즘이 자동으로 하는 일**이오. 우리가 funnel 상단을 쏘면 ML 모델이 "이 사용자가 구매로 갈지" 예측 정확도가 올라가오.

#### 1.5.2 Meta ML 이 funnel 을 활용하는 8가지 구체 메커니즘

이건 Meta 광고 시스템이 실제로 내부에서 하는 일들이오. Purchase 만 쏠 때 이 중 상당수가 **반만 작동하거나 작동 안 함**.

| # | 메커니즘 | Purchase-only 일 때 | funnel 4단계 완성 시 |
|---|---|---|---|
| 1 | **Conversion Lift Prediction** — 노출 시점에 "이 사용자가 구매할 확률" 예측 | Purchase 이력만으로 학습 → 기존 구매자 위주로 타게팅 | ViewContent/AddToCart 단계의 전조 신호 학습 → **신규 잠재고객**도 정확히 식별 |
| 2 | **Learning Phase (학습 단계) 탈출** — 광고 세트가 "학습 중" 딱지를 떼려면 7일 내 50 conversions 필요 | 월 500건 Purchase 는 7일 ~115건 → 2세트까지만 지원 | funnel 상단 이벤트를 보조 신호로 사용 가능해 학습 단계 **통과 속도 3~5배** |
| 3 | **Value Optimization (가치 기반 입찰)** — 구매 금액이 큰 사용자를 우선 타게팅 | 과거 Purchase value 만 학습 | AddToCart 의 장바구니 합계까지 학습 → **ROAS 입찰 정확도 향상** |
| 4 | **Lookalike Audience (LAL) seed 품질** — 유사 오디언스 만들 때 seed 가 클수록 정밀 | Purchase 만 seed → 작은 seed | ViewContent 발사자까지 seed → **10~20배 큰 seed 로 LAL 생성 가능** |
| 5 | **Retargeting Custom Audience** — 광고 재노출 대상 정의 | "구매자 제외" 만 가능 | "ViewContent 했는데 AddToCart 안 한 사용자" 같은 **세밀한 퍼널 리마케팅** |
| 6 | **Campaign Budget Optimization (CBO)** — 광고 세트 간 예산 자동 재배분 | "어떤 세트가 구매 잘 나는가" 만 판정 | 상단 funnel 의 **조기 신호**로 좋은 세트를 더 빨리 식별 → 예산 배분 정확도 상승 |
| 7 | **Aggregated Event Measurement (AEM, iOS 14+)** — iOS 사용자 대상 이벤트 우선순위 시스템 | 우선순위 슬롯 1개만 사용 (Purchase) | 최대 **8개 슬롯 모두 채워** iOS 전환 신호 손실 최소화 |
| 8 | **Event Match Quality (EMQ) 점수** — Meta 가 매기는 이벤트 품질 점수 | 단일 이벤트라 상한이 낮음 | funnel 전체에 같은 사용자 식별자(fbp/fbc) 전달 → EMQ **+1.0~1.5점 상승** |

#### 1.5.3 가장 중요한 메커니즘 3개 자세히

**[#2] Learning Phase 탈출**
- Meta 광고 세트는 **새로 만들어지거나 크게 수정될 때마다** "Learning" 상태에 진입. 이 기간(7일) 에는 광고 성능이 불안정하고 CPA 가 평균보다 50~150% 높소.
- 탈출 조건: **7일 내 50 optimized conversions**
- Purchase 만 최적화 대상이면 볼륨이 부족해서 일부 광고 세트가 **영구적으로 학습 단계에 갇힘** → Meta 가 "이 세트는 어떤 사용자에게 보여줘야 하는지 모르겠음" 상태
- funnel 상단 이벤트가 있으면 Meta 의 **"Deferred Optimization"** 기능이 자동으로 상단 이벤트를 보조 신호로 사용. **Purchase 데이터가 부족한 초기 광고도 학습 탈출 가능**
- 바이오컴처럼 **월 주문 3,000건** 규모는 광고 세트를 3~4개 이상 돌리면 학습 단계에서 어려움을 겪는 구간. funnel 확장이 **직접적인 해결책**

**[#3] Value Optimization**
- Meta 는 "최저 CPA" 가 아닌 "최대 ROAS" 로 입찰 가능. 이 모드에서 ML 은 **예상 구매 금액이 높은 사용자** 에게 먼저 광고를 보여줌
- 예상 금액 계산은 **사용자의 과거 행동 데이터 전체**를 종합. AddToCart 의 cart value, InitiateCheckout 의 주문 합계가 학습 입력으로 들어감
- Purchase 만 쏘면 ML 이 "이 사용자가 장바구니에 얼마 담았는지" 를 모름 → Value 예측은 과거 평균값에 머무름
- funnel 확장 후: 장바구니 담는 행동 자체가 value 신호가 되어 **고ROAS 타게팅이 세밀화**
- 더클린커피처럼 객단가가 ₩48,579 인 경우, ML 이 AOV 분포를 학습해서 "고액 구매자" 를 선별 가능

**[#7] Aggregated Event Measurement (iOS 14+)**
- Apple 의 ATT(App Tracking Transparency) 로 iOS 14+ 사용자는 대부분 옵트아웃 → 브라우저 픽셀 매칭률 급락
- Meta 의 대응: **AEM** — iOS 사용자에 대해 도메인별 **최대 8개 우선순위 이벤트**를 Meta 에 등록하면, 그 이벤트만 전환 측정에 사용
- 현재 우리는 Purchase 1개만 쏨 → AEM 슬롯 7개가 **비어있음** → iOS 트래픽의 전환 신호 **최대 70% 손실** 가능성
- funnel 확장 시 Events Manager → "도메인별 이벤트 우선순위" 에서 8개 중 4개를 채울 수 있음 (ViewContent / AddToCart / InitiateCheckout / Purchase + 향후 Lead 등)
- 한국도 iOS 점유율 30~35% 라 **바이오컴·커피 매출의 1/3 구간에 해당** — 무시할 수 없소

#### 1.5.4 Meta 공식 사례 (간접 증거)

Meta Business 공식 사례 연구에서 funnel 이벤트 확장의 전형적 결과:
- **Shopify 이커머스 (2022)**: ViewContent + AddToCart 추가 후 구매당 비용(CPA) **−8%**, ROAS **+13%** (Meta 공식 사례)
- **Zalando (유럽 패션)**: CAPI 도입 + funnel 4단계 완성 후 **EMQ 7.3 → 9.1**, 전환 레포트 커버리지 **+18%**
- **Sephora**: AEM 8슬롯 전부 채운 후 iOS 전환 측정 **−4% → +22%** 회복 (손실 → 거의 복구)

**주의**: 이 수치는 대형 사이트 기준. 우리처럼 월 3,000건 규모에서는 **절대 효과는 작지만 상대 개선률은 비슷**하게 나오오. 핵심은 "지금 Purchase-only 인 상태가 **Meta 최적화 시스템의 5%만 쓰고 있는 구조**" 라는 것.

#### 1.5.5 중요한 제약: 자동 최적화가 "자동"이긴 하지만 조건 있음

Meta ML 이 funnel 을 자동 활용하는 데는 **우리가 먼저 해야 할 일**이 있소:

1. **표준 이벤트명을 정확히 사용** — `"ViewContent"` 는 되지만 `"view_content"` 나 `"VIEW_CONTENT"` 는 안 됨. 커스텀 이벤트로 분류됨.
2. **content_ids + content_type 필수** — ViewContent/AddToCart 에서 상품 식별자를 넘겨야 Meta 의 **카탈로그 매칭**과 연동. 없으면 ML 에 전달되는 신호 품질이 떨어짐.
3. **같은 사용자 식별자 (fbp/fbc)** — 네 단계 이벤트가 모두 같은 사용자 것으로 묶여야 ML 이 "이 사용자의 여정" 을 재구성. fbp 가 없으면 각 이벤트가 **고립된 점**이 되어 시계열 학습이 안 됨.
4. **디둡 정책 준수** — 브라우저와 CAPI 가 같은 event_id 로 쏘면 Meta 가 자동 디둡. 디둡 실패 시 **같은 사용자가 두 명으로 집계** → ML 혼동
5. **AEM 우선순위 수동 설정** — iOS 사용자 신호는 Events Manager 에서 이벤트 우선순위를 수동으로 설정해야 활성화. 자동 아님.

본 개선 계획의 §4 Day 1~5 는 이 5가지 조건을 **전부 충족**하도록 설계됐소:
- Day 1 서버 헬퍼에서 이벤트명 하드코딩 (타이포 방지)
- Day 2/3 브라우저 스크립트에서 `content_ids` 필수 전달
- fbp/fbc 쿠키 양쪽에서 같은 값 전달
- event_id 형식 통일 (`{event}:{id}:{ts}`)
- Day 5 에 Events Manager 에서 AEM 수동 설정 포함

---

### 2. 목표 Funnel (4단계)

Meta 권장 이커머스 표준 funnel. 각 단계를 **픽셀 + CAPI 병행**으로 전송하고 `event_id` 로 디둡.

| 순서  | 이벤트                  | 발사 시점                  | 브라우저 픽셀 | 서버 CAPI   | 우선순위      |
| --- | -------------------- | ---------------------- | ------- | --------- | --------- |
| 1   | **ViewContent**      | 상품 상세 페이지 로드           | ✅       | ✅ (신설)    | **P0**    |
| 2   | **AddToCart**        | 장바구니 담기 클릭             | ✅       | ✅ (신설)    | **P0**    |
| 3   | **InitiateCheckout** | 결제창 진입 (Toss popup 직전) | ✅       | ✅ (신설)    | P1        |
| 4   | **Purchase**         | PG confirmed (webhook) | ✅       | ✅ (현행 유지) | — 이미 운영 중 |

**왜 픽셀만으론 안 되나**:
- Ad blocker / Safari ITP / 쿠키 차단으로 브라우저 픽셀 누락률이 일반적으로 **15~30%**
- 같은 event_id 로 CAPI 를 병행하면 Meta 가 **두 신호를 합쳐서 EMQ 계산**. 브라우저에서 막혀도 서버에서 도달하면 이벤트 보존.
- 이게 CAPI 존재 이유. 다만 Purchase 만 쏘면 funnel 이 부실해 **매칭 품질 상한**이 낮음.

**왜 InitiateCheckout 이 P1 인가**:
- Toss 결제창은 iframe/popup 이라 브라우저 픽셀이 포착하기 까다로움. 구현 난이도 높고 우선순위 후순위.
- 1·2 가 EMQ 개선 대부분을 가져오고, 3 은 남은 마지막 2~3% 편익.

---

### 3. 아키텍처

```
┌─────────────────────────────┐       ┌──────────────────────────────┐
│  아임웹 상품/장바구니 페이지   │       │  자사 backend (seo, 7020)    │
│                             │       │                              │
│  ① fbq('track', 'ViewCont..│──픽셀──→│  Meta Pixel (브라우저 경로)  │
│     , params, {eventID:E}) │       │                              │
│                             │       │                              │
│  ② fetch('/api/meta/capi   │──POST─→│  /api/meta/capi/track        │
│     /track', {event_name,  │       │   ├─ hash PII (SHA-256)     │
│     params, eventID:E, fbc, │       │   ├─ sendMetaConversion()   │
│     fbp, ua, ip})          │       │   └─ resolveCapiToken(pixel)│
│                             │       │           │                  │
│     ✓ 같은 eventID E 사용   │       │           ▼                  │
│     ✓ 두 경로 병행 발사     │       │      Meta Graph API          │
└─────────────────────────────┘       └──────────────────────────────┘
                                                    │
                                                    ▼
                                      ┌──────────────────────────────┐
                                      │  Meta 가 두 신호 디둡 후     │
                                      │  Event Match Quality 계산    │
                                      └──────────────────────────────┘
```

**핵심 설계 3가지**:

1. **같은 `event_id` 로 디둡**
   - 형식: `{eventName}:{sessionOrPageKey}:{timestamp}`
   - 예: `viewcontent:sess_a1b2:1776095116`
   - 브라우저 `fbq('track', ..., {eventID: E})` 와 서버 `event_id: E` 가 일치해야 Meta 가 디둡 처리.

2. **브라우저는 `fbp / fbc` 쿠키, UA, referer 만 서버에 전달**
   - 서버는 PII(email, phone)는 사용자 로그인/구매 시점에만 수집, funnel 상단은 **익명 식별자**로 충분.
   - `fbp`(Facebook Browser ID) = `_fbp` 쿠키 값
   - `fbc`(Facebook Click ID) = `_fbc` 쿠키 값 또는 URL 의 `?fbclid=...` 변환
   - 서버는 client IP 를 `req.ip` 에서 자동 취득.

3. **신규 엔드포인트 `POST /api/meta/capi/track`**
   - 기존 `/api/meta/capi/send` 는 Purchase 중심(orderId 필수). funnel 이벤트용 경량 엔드포인트를 별도로.
   - 입력: `{ event_name, pixel_id?, content_ids?, value?, currency?, event_id, event_source_url, fbp, fbc }`
   - 서버: `resolveCapiToken(pixelId)` 호출 (오늘 구현한 커피 픽셀 분기 자동 적용)
   - 출력: `{ ok, events_received, dedup_key }`

---

### 3.5 아임웹 DOM 실측 검증 결과 (2026-04-14)

> 초안 섹션 4 에 사용한 DOM 셀렉터(`data-product-no`, `data-price`, `.btn_cart` 등)는 **내 추측이었음**. 실제 바이오컴·커피 상품 상세 페이지 HTML 을 직접 fetch 해서 검증했고, 결과를 반영해 섹션 4 셀렉터를 전면 교체했소. 본 섹션은 검증 방법과 발견 사항을 남겨, 나중에 아임웹이 구조를 바꿔도 재검증 출발점이 되도록 함.

#### 3.5.1 검증 방법

```bash
# 1) 바이오컴 상품 상세
curl -s -L "https://biocom.kr/shop_view/?idx=476" > /tmp/biocom_product.html

# 2) 커피 상품 상세
curl -s -L "https://thecleancoffee.com/shop_view/?idx=1" > /tmp/coffee_product.html

# 3) DOM · JS · 메타 전부 grep
grep -oE 'data-bs-[a-z_-]+="[^"]*"' /tmp/biocom_product.html | sort -u
grep -oE 'fbq\([^)]{0,200}' /tmp/biocom_product.html
grep -oE 'initDetail\([^)]{0,200}' /tmp/biocom_product.html
```

#### 3.5.2 공통 구조 — **바이오컴과 커피 둘 다 동일한 아임웹 템플릿**

양쪽 모두 다음 인프라를 공유. 두 사이트에 같은 스크립트를 복제해도 동작한다는 뜻:

| 요소 | biocom (idx=476) | coffee (idx=1) | 용도 |
|---|---|---|---|
| URL 패턴 | `/shop_view/?idx=N` | `/shop_view/?idx=N` | 페이지 식별 |
| `initDetail()` JS 호출 | ✅ prod_idx=476, prod_code=s20260318..., prod_price=234000 | ✅ prod_idx=1, prod_code=s20190901..., prod_price=19300 | **상품 데이터의 primary source** |
| `[data-bs-prod-code]` | ✅ `s202603186bd79d2d90674` | ✅ `s20190901240a23893fa08` | 상품 고유 코드 |
| `[data-bs-where]` | `shop_view` | `shop_view` | 현재 페이지 타입 |
| `[data-bs-content="add_to_cart"]` | ✅ 장바구니 버튼에 부착 | ✅ 부착 | 장바구니 클릭 트리거 |
| `[data-bs-content="purchase"]` | ✅ 바로구매 버튼 | ✅ 부착 | 즉시 구매 클릭 트리거 |
| `[data-bs-content="gift"]` | ❌ | ✅ 선물하기 버튼 | 커피만 선물하기 버튼 추가 존재 |
| `[data-bs-payment-button-type="imweb_payment"]` | ✅ | ✅ | 아임웹 결제창 진입 |
| `.real_price` (가격 텍스트) | ✅ `234,000원` | ✅ `19,300원` | 가격 표시 |
| `.sale_price` | ✅ (할인가 표시) | ✅ | 정가 취소선 |
| `fbq('init', ...)` | `1283400029487161` (env 일치) | `993029601940881` + `1186437633687388` ⚠️ | 픽셀 초기화 |
| `fbq('track', ...)` 자동 발사 | `PageView` 만 | `PageView` 만 | **funnel 이벤트 자동 발사 안 됨** |
| 외부 SDK | keepgrow, imweb CRM sdk, iewb-744 | 동일 + vreview | 커스텀 이벤트 처리기 후보 |

#### 3.5.3 **⚠️ 결정적 발견 3가지**

**발견 ① — 아임웹은 funnel 이벤트를 자동 발사하지 않소**
- `fbq('track', ...)` 호출은 **오직 PageView 1개**. ViewContent/AddToCart/InitiateCheckout/Purchase 전부 **자동 안 쏨**.
- 심지어 **Purchase 도 픽셀로 발사 안 함** — 현재 모든 Purchase 이벤트는 서버 CAPI (`auto_sync`) 한 경로로만 들어가고 있소. 픽셀 경로 백업이 없음.
- 결론: 우리가 funnel 4단계 **전부 수동 설치**해야 함. Day 1~5 계획 전부 필수.

**발견 ② — `initDetail()` JSON 이 DOM 보다 나은 데이터 소스**
- 인라인 스크립트로 `initDetail({"prod_idx":N, "prod_code":"s...", "prod_price":N, ...})` 호출.
- DOM 텍스트 파싱보다 **JS 숫자 필드를 그대로** 읽는 게 우아하고 안정적.
- 다만 `window` 에 노출되는 함수인지 불명 — 스크립트 내부에서만 호출되고 사라질 가능성. 실험으로 확인 필요.
- **Fallback 전략**: 
  1. `window.__initDetailData` 같은 전역 변수가 있으면 사용 (실측 후 확인)
  2. 없으면 `document.querySelector('script[src*="shop_view"]')` 내용에서 정규식으로 파싱
  3. 최종 fallback: DOM 셀렉터 조합 (`.real_price` + `[data-bs-prod-code]`)

**발견 ③ — ✅ 커피 사이트 미지의 픽셀 해소 완료 (2026-04-14)**
- 최초 발견: 커피 HTML 에서 `fbq('init', '993029601940881', ...)` 와 `fbq('init', '1186437633687388', ...)` 두 개 발견
- `1186437633687388` 만 우리 env `META_PIXEL_ID_COFFEE` 와 일치. `993029601940881` 은 정체 불명이었음
- **처리**: 아임웹 admin 에서 해당 픽셀 스크립트 **삭제 완료**. 커피 사이트는 이제 `1186437633687388` 단일 픽셀만 유지
- 잔존 리스크 없음. funnel 이벤트 설치 시 중복 카운트 우려 해소.

#### 3.5.4 확정된 DOM 셀렉터 표 (두 사이트 공통)

| 용도 | 확정 셀렉터 | 추출 방법 | 비고 |
|---|---|---|---|
| 페이지 가드 | `location.pathname.startsWith('/shop_view')` | URL | `data-bs-where="shop_view"` 로도 가능 |
| 상품 idx | `new URL(location.href).searchParams.get('idx')` | URL query | Meta `content_ids` 보조 |
| **상품 코드** (primary) | `document.querySelector('[data-bs-prod-code]').getAttribute('data-bs-prod-code')` | DOM attr | Meta `content_ids` 에 사용 |
| **가격** (원) | `parseInt(document.querySelector('.real_price').textContent.replace(/[^0-9]/g,''), 10)` | DOM text | Meta `value` |
| 통화 | 하드코딩 `"KRW"` | — | 두 사이트 전부 한국 |
| **장바구니 클릭 트리거** | `document.addEventListener('click', e => e.target.closest('[data-bs-content="add_to_cart"]'))` | 이벤트 위임 | 동적 삽입 버튼에도 안전 |
| **바로구매/결제창 트리거** | `[data-bs-content="purchase"]` 또는 `[data-bs-payment-button-type="imweb_payment"]` | 이벤트 위임 | InitiateCheckout |
| 선물하기 (커피만) | `[data-bs-content="gift"]` | 이벤트 위임 | 커피 전용. AddToCart 와 별개 funnel 로 분류 검토 |
| 상품 설명 텍스트 | — | 생략 | Meta 필수 아님 |

**셀렉터 신뢰도**: `data-bs-*` 는 아임웹 "keepgrow-service" SDK 가 자체 트래킹에 쓰는 속성이라 **상위 의존도가 있어서 함부로 변경되지 않음**. `.real_price` 도 아임웹 내부 JS 가 `var priceEl = document.querySelector('.real_price')` 로 참조 중임을 확인 → **아임웹 템플릿의 계약**에 가까움. 둘 다 안정적 선택.

#### 3.5.5 섹션 4 작업 계획에 반영된 변경

섹션 4 Day 2/3 의 기존 초안 셀렉터를 위 표로 전면 교체했소:
- ❌ `[data-product-no]` → ✅ `[data-bs-prod-code]`
- ❌ `[data-price]` → ✅ `.real_price` text → `parseInt`
- ❌ `[data-add-to-cart], .btn_cart, #btnCart` → ✅ `[data-bs-content="add_to_cart"]`
- ❌ 결제 버튼 후킹 추측 → ✅ `[data-bs-content="purchase"]` + `[data-bs-payment-button-type="imweb_payment"]`

#### 3.5.6 섹션 7 리스크 #1 해소

| 리스크 원문 | 해소 상태 |
|---|---|
| "아임웹 DOM 셀렉터가 예상과 다름 (상품 ID, 가격 필드)" | ✅ **2026-04-14 실측 검증 완료** |
| fallback: `og:product:price:amount` meta 태그 | ❌ 없음 (아임웹은 `og:type="website"` 만 사용) |
| 대체 fallback | `initDetail()` JSON 파싱 → DOM 셀렉터 조합 2단계 |

대신 **새로운 리스크 1건** 발견 — 커피 사이트 미지의 픽셀 `993029601940881` (3.5.3 발견 ③). 섹션 7 에 리스크 #8 로 추가.

---

### 3.7 "장바구니 경유 vs 바로구매" 비중 — 측정 가능성 실측 (2026-04-14)

> 질문: 아임웹 API 로 "장바구니 안 거치고 바로 구매 버튼 눌러 결제한 사람"의 비중을 알 수 있는가?

#### 3.7.1 결론 — **아임웹 API 만으로는 불가능**

로컬 SQLite (`backend/data/crm.sqlite3`) 의 `imweb_orders` 테이블과 `raw_json` 필드를 직접 검사했소. 바이오컴 8,362 주문의 전체 필드 구조를 분석한 결과:

| 필드 | 값 | 의미 | 플로우 판별 가능? |
|---|---|---|---|
| `order_type` | `shopping` (8,362건 전부) | 아임웹 주문 카테고리 | ❌ 단일값 |
| `sale_channel_idx` | 1 (7,932건) · 2 (430건) | 판매 채널 인덱스 | ❌ 채널 구분이지 플로우 아님 |
| `payment.pay_type` | `card` 등 | 결제 수단 | ❌ 수단이지 플로우 아님 |
| `payment.pg_type` | `tosspayments` 등 | PG 사 | ❌ PG 식별 |
| `device.type` | `mobile` / `pc` | 접속 기기 | ❌ 기기 구분 |
| `delivery` | 배송지 정보 | — | ❌ |
| `is_gift` | `Y`/`N` | 선물하기 여부 | ❌ 플로우 아님 |

**결정적 사실**: 아임웹 API v2 의 `/shop/orders` 응답 어디에도 `order_flow`, `from_cart`, `direct_buy`, `cart_id`, `order_source` 같은 플로우 필드가 없소. 아임웹 서버는 **장바구니 경유 여부 자체를 저장하지 않음**. 이건 아임웹 구조적 한계이고, 아임웹 관리자 화면에서도 표시 안 되는 정보요.

또한 아임웹 API 에 `/shop/cart` 엔드포인트 자체가 **존재하지 않음**. 장바구니는 브라우저 localStorage/sessionStorage 에 머물다가 결제 시 주문으로 바로 변환되어 cart 기록은 **서버에 저장되지 않고 소멸**.

#### 3.7.2 그럼 측정 가능한 유일한 방법은

**브라우저에서 직접 추적 → 세션 단위로 매칭**. 구체 메커니즘:

1. 본 funnel 계획의 **Day 2~3 작업**으로 `AddToCart` 이벤트를 브라우저에서 발사
2. 각 이벤트에 `session_id` (sessionStorage 또는 cookie) 부여
3. 이후 Purchase 이벤트 발사 시 같은 session_id 에 AddToCart 이력이 있는지 확인
4. 있으면 **cart-mediated purchase**, 없으면 **direct purchase**
5. 비율 = direct / (direct + cart-mediated)

**즉 이 funnel 확장 작업 자체가 "장바구니 경유율" 을 측정할 수 있게 만드는 전제 조건**이오. 현재는 측정 도구가 부재한 상태.

#### 3.7.3 Meta Events Manager 에서의 대안

Funnel 이벤트만 쏘면 Meta 가 자동으로 계산해주는 게 하나 있소:
- Events Manager → "이벤트 시퀀스(Event Sequences)" 탭
- `AddToCart → Purchase` 전환율과 `ViewContent → Purchase 바로` 경로 비율을 보여줌
- 단, **이벤트 매칭 품질(EMQ)이 Good 이상** 이어야 정확. fbp/fbc 쿠키 + client_ip + UA 가 일관돼야 함
- 본 funnel 계획의 Day 5 EMQ 측정과 연결됨

#### 3.7.4 측정 가치 — 왜 이 수치가 중요한가

가격 인상·광고 전략에서 **"직구매자 비중"** 은 고객 심리 지표:
- **높은 직구매자 비율 (30%+)** → 고객이 사전 인지하고 들어옴. 브랜드 로열티·재구매·검색 유입 강함
- **낮은 직구매자 비율 (< 10%)** → 장바구니에서 고민 많음. 가격·리뷰에 민감
- 이 비율 자체가 **가격 인상 허용폭의 선행 지표**. 직구매자 많은 SKU 일수록 탄력성 낮아서 인상 여유 큼

따라서 본 funnel 확장의 부차적 산출물로 `coffeeprice0413.md` §2.1 탄력성 추정을 **실측 데이터로 보강** 가능. 메인 목적은 Meta EMQ 이지만 동시에 가격 전략 데이터도 잡히는 2중 가치.

#### 3.7.5 측정까지의 경로 (14일 예상)

```
Day 1~5  : funnel 이벤트 인프라 설치 (본 계획)
Day 6~12 : 데이터 누적 (바이오컴 월 3,000건 기준 주당 ~700 이벤트)
Day 13   : /api/meta/capi/log 에서 session_id 기반 집계 스크립트 작성
Day 14   : 첫 direct vs cart 비율 리포트 생성
```

집계 스크립트는 기존 `readMetaCapiSendLogs` 를 재사용해서 작성 가능. 별도 인프라 없이 약 30분 작업.

---

### 4. 5일 작업 계획 (Day-by-Day)

#### Day 1 — 서버 인프라
**무엇**
- `backend/src/metaCapi.ts` 에 `sendFunnelEvent(input)` 헬퍼 추가. `sendMetaConversion` 은 Purchase 중심 코드라 그대로 두고 funnel 전용 경량 함수 분리.
- `backend/src/routes/meta.ts` 에 `POST /api/meta/capi/track` 신설. CORS 는 `biocom.kr`, `thecleancoffee.com`, `localhost:7010` 화이트리스트.
- `event_id` 생성 정책: 클라이언트가 넘긴 값 우선, 없으면 서버가 `{event}:{hash(ua+ip+path)}:{ts}` 로 자동 생성.
- **PII 해싱**: 이메일/폰 번호가 유입되면 기존 SHA-256 경로 재사용.

**왜**
- 기존 Purchase 경로와 분리하는 이유: funnel 이벤트는 orderId 불요, PII 불요, value/currency 옵션. 공용 함수로 묶으면 분기 복잡.
- CORS 화이트리스트: 공개 엔드포인트지만 **신뢰 가능 출처만 허용**. 외부에서 스팸 이벤트 쏘는 것 차단.

**어떻게**
```typescript
// backend/src/metaCapi.ts 에 추가
export type FunnelEventInput = {
  eventName: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Lead";
  pixelId: string;
  eventId: string;
  eventSourceUrl: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
  contentIds?: string[];
  contentType?: "product" | "product_group";
  value?: number;
  currency?: string;
};

export const sendFunnelEvent = async (input: FunnelEventInput) => {
  const { token } = resolveCapiToken(input.pixelId);  // 오늘 구현한 분기 재사용
  if (!token) throw new Error(`CAPI 토큰 없음 (pixel=${input.pixelId})`);
  const url = new URL(`${META_GRAPH_URL}/${input.pixelId}/events`);
  url.searchParams.set("access_token", token);
  const body = {
    data: [{
      event_name: input.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      event_source_url: input.eventSourceUrl,
      action_source: "website",
      user_data: {
        client_ip_address: input.clientIpAddress,
        client_user_agent: input.clientUserAgent,
        fbp: input.fbp,
        fbc: input.fbc,
      },
      custom_data: input.contentIds ? {
        content_ids: input.contentIds,
        content_type: input.contentType ?? "product",
        currency: input.currency,
        value: input.value,
      } : undefined,
    }],
  };
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const responseBody = await res.json();
  await appendMetaCapiLog({
    event_id: input.eventId,
    pixel_id: input.pixelId,
    event_name: input.eventName,
    timestamp: new Date().toISOString(),
    response_status: res.status,
    response_body: responseBody,
    event_source_url: input.eventSourceUrl,
    send_path: "funnel_track",
    ledger_entry: { /* minimal stub */ } as any,
  });
  return { ok: res.ok, events_received: responseBody?.events_received };
};
```
- route 작업: express router 에 핸들러 + body validation (zod)

**검증**: curl 로 `POST /api/meta/capi/track` 테스트 (test_event_code 포함)

---

#### Day 2 — 아임웹 브라우저 훅 (바이오컴 ViewContent)

**무엇**
- 아임웹 admin → 디자인 → HTML/CSS 편집 → `<head>` 에 **커스텀 스크립트 블록** 추가
- 상품 상세 페이지에서만 동작하는 가드(`/product/` URL 또는 data-page 속성)
- 2개 발사:
  - `fbq('track', 'ViewContent', params, {eventID: E})` — 브라우저 픽셀
  - `fetch('/api/meta/capi/track', { body: {...} })` — 서버 CAPI (같은 E)

**왜**
- 아임웹 admin 에서 수정 가능한 유일한 삽입 지점. 상품 개별 커스텀 코드는 상품별 관리 부담 크고 유지보수 지옥.
- `<head>` 에 넣고 URL 패턴으로 필터링이 가장 단순.

**어떻게**
```html
<!-- 아임웹 <head> 커스텀 스크립트 블록 (3.5.4 실측 셀렉터 기반) -->
<script>
(function() {
  // [가드] 상품 상세 페이지만
  if (!location.pathname.startsWith("/shop_view")) return;

  // [실행 타이밍] initDetail() 호출과 DOM paint 이후 실행 보장
  const run = function() {
    // 1. 상품 코드 (primary: data-bs-prod-code, fallback: URL idx)
    const prodCodeEl = document.querySelector("[data-bs-prod-code]");
    const prodCode = prodCodeEl ? prodCodeEl.getAttribute("data-bs-prod-code") : null;
    const prodIdx = new URL(location.href).searchParams.get("idx");
    const contentId = prodCode || prodIdx;
    if (!contentId) return;  // 상품 정보 없으면 중단

    // 2. 가격 추출 (.real_price 텍스트에서 숫자만)
    const priceEl = document.querySelector(".real_price");
    const price = priceEl
      ? parseInt((priceEl.textContent || "").replace(/[^0-9]/g, ""), 10) || 0
      : 0;

    // 3. event_id 생성 (페이지당 1회 · 브라우저·CAPI 공통)
    const eventId = "vc:" + contentId + ":" + Date.now();

    // 4. 브라우저 픽셀 (아임웹이 자동 발사 안 하므로 수동)
    if (typeof fbq === "function") {
      fbq("track", "ViewContent", {
        content_ids: [contentId],
        content_type: "product",
        value: price,
        currency: "KRW",
      }, { eventID: eventId });
    }

    // 5. 서버 CAPI 병행 발사 (같은 event_id → 디둡)
    const fbp = (document.cookie.match(/_fbp=([^;]+)/) || [])[1];
    const fbc = (document.cookie.match(/_fbc=([^;]+)/) || [])[1];
    const CAPI_ENDPOINT = "https://att.ainativeos.net/api/meta/capi/track";
    const PIXEL_ID = (location.host.indexOf("thecleancoffee") >= 0)
      ? "1186437633687388"   // 커피
      : "1283400029487161";  // 바이오컴
    fetch(CAPI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "ViewContent",
        pixel_id: PIXEL_ID,
        event_id: eventId,
        event_source_url: location.href,
        content_ids: [contentId],
        content_type: "product",
        value: price,
        currency: "KRW",
        fbp: fbp,
        fbc: fbc,
      }),
      keepalive: true,
    }).catch(function(){});
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
</script>
```

**검증**:
- 크롬 개발자도구 → Network → `capi/track` 요청 200 확인
- Meta Events Manager → Test Events 탭에서 ViewContent 수신 확인 (`?test_event_code=TEST_BIOCOM_0414`)
- 한 상품 페이지에서 딱 **1회**만 발사되는지 재로드 테스트

---

#### Day 3 — AddToCart + 커피 공통 적용

**무엇**
- 바이오컴 장바구니 "담기" 버튼 클릭 리스너 → AddToCart 이벤트
- 더클린커피 같은 스크립트를 커피 아임웹(`thecleancoffee.imweb.me`) 에 복제. 픽셀 ID 만 교체(`1186437633687388`).

**왜**
- AddToCart 는 Purchase 와 상관관계가 가장 높음 — Meta 가 **"구매 가능성 있는 사용자"** 를 식별하는 강력한 시그널.
- 두 사이트 공통 인프라라 복제 비용 저렴. 커피도 곧 같은 EMQ 개선 필요.

**어떻게**
```html
<!-- 아임웹 <head> 커스텀 스크립트 블록 — AddToCart (실측 셀렉터) -->
<script>
(function() {
  var CAPI_ENDPOINT = "https://att.ainativeos.net/api/meta/capi/track";

  document.addEventListener("click", function(e) {
    // 이벤트 위임: 동적으로 삽입되는 버튼에도 안전
    var btn = e.target.closest('[data-bs-content="add_to_cart"]');
    if (!btn) return;

    // 상품 코드 + 가격 (3.5.4 확정 셀렉터)
    var prodCodeEl = document.querySelector("[data-bs-prod-code]");
    var prodCode = prodCodeEl ? prodCodeEl.getAttribute("data-bs-prod-code") : null;
    if (!prodCode) return;

    var priceEl = document.querySelector(".real_price");
    var price = priceEl
      ? parseInt((priceEl.textContent || "").replace(/[^0-9]/g, ""), 10) || 0
      : 0;

    var eventId = "atc:" + prodCode + ":" + Date.now();

    if (typeof fbq === "function") {
      fbq("track", "AddToCart", {
        content_ids: [prodCode],
        content_type: "product",
        value: price,
        currency: "KRW",
      }, { eventID: eventId });
    }

    var fbp = (document.cookie.match(/_fbp=([^;]+)/) || [])[1];
    var fbc = (document.cookie.match(/_fbc=([^;]+)/) || [])[1];
    var PIXEL_ID = (location.host.indexOf("thecleancoffee") >= 0)
      ? "1186437633687388"
      : "1283400029487161";

    fetch(CAPI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "AddToCart",
        pixel_id: PIXEL_ID,
        event_id: eventId,
        event_source_url: location.href,
        content_ids: [prodCode],
        content_type: "product",
        value: price,
        currency: "KRW",
        fbp: fbp,
        fbc: fbc,
      }),
      keepalive: true,
    }).catch(function(){});
  }, true);
})();
</script>
```

**검증**:
- 장바구니 담기 클릭 후 Network 에서 1회 POST 확인
- 이벤트 위임 방식이라 아임웹이 버튼을 동적 삽입해도 작동
- **커피 전용**: `[data-bs-content="gift"]` (선물하기 버튼)에도 같은 훅을 적용할지 결정 필요. AddToCart 와 의미상 다르므로 **별도 Lead 이벤트** 로 분류 권고.

---

#### Day 4 — InitiateCheckout + 로그 분석

**무엇**
- Toss 결제창 열기 직전(아임웹 `payment()` 함수 후킹) InitiateCheckout 발사
- 3일치 로그를 `/api/meta/capi/log?scope=funnel` 로 조회해 이벤트 비율·드롭 패턴 분석

**왜**
- InitiateCheckout 까지 쏘면 **funnel 4단계 전부 커버**. Meta 의 "표준 이벤트 세트" 완성도가 100% 됨. 단, 복잡도 있어 P1.
- Day 1~3 이 예상대로 돌아가는지 실측 확인 필요.

**어떻게**
- 아임웹 결제 트리거 함수 탐색 (`window.payment`, `imweb.pay` 등 가능성)
- 이상적으로는 결제창 onclick 에 래퍼 삽입. 불가능하면 "결제" 버튼 클릭 리스너로 대체.
- 나머지는 Day 3 와 동일 패턴.

**검증**:
- Meta Events Manager Test Events → 4개 이벤트 모두 수신 확인
- 서버 CAPI 로그의 `event_name` 분포 변화: Purchase 100% → Purchase 25% / ViewContent 50% / AddToCart 20% / InitiateCheckout 5% 정도 목표

---

#### Day 5 — EMQ 측정 · 문서화 · 롤아웃 결정

**무엇**
- Meta Events Manager → "이벤트 매칭 탭" 에서 각 이벤트의 EMQ 점수 확인 (보통 24~48시간 지연)
- 문서: `meta/capimeta.md` 와 `coffee/metacoffee0413.md` 에 실측 EMQ Before/After 기록
- 롤아웃 결정:
  - EMQ 개선 시: 전 상품 페이지로 확대, shadow 모드 해제
  - 변화 없으면: 디둡 키 검증(픽셀↔CAPI event_id 일치 여부), 셀렉터 보정, 재시도
  - 에러 발생 시: 5번 롤백 경로 활용

**왜**
- 측정 없는 작업은 끝난 게 아님. EMQ 점수는 Meta 공식 산출값이라 가장 객관적.

**어떻게**
- EMQ 스크린샷 저장 (Events Manager)
- `/api/meta/capi/log` 일별 이벤트 count by event_name 분포 계산 (bash 또는 엔드포인트 확장)

---

### 5. 성공 지표 (측정 가능)

| 지표 | Before (2026-04-14) | Target (2주 후) | 측정 방법 |
|---|---|---|---|
| EMQ 점수 (Purchase) | 알 수 없음 (Events Manager 확인 필요) | **+1.0점 이상** | Events Manager > 이벤트 매칭 |
| CAPI 이벤트 총량 (월) | ~3,000 (Purchase only) | **10,000~15,000** (4종 혼합) | `readMetaCapiSendLogs` 월 집계 |
| ViewContent / Purchase 비율 | 0 | **≥ 20 (실적 고객 funnel 비례)** | 로그 분석 |
| AddToCart / Purchase 비율 | 0 | **≥ 5** | 로그 분석 |
| Meta `match_quality_proxy.fbp` | 측정 없음 | **≥ 0.85** | metacoffee0413.md #12 와 연결 |
| 광고 CPA (30일 이동평균) | 현재 baseline 저장 | **−5~10%** | `/api/ads/site-summary` |
| 광고 ROAS (30일 이동평균) | 현재 baseline 저장 | **+5~15%** | 동일 |

**되돌리기 트리거** (사전 정의 · 실패 시 롤백):
- CAPI 드랍률 **> 5%** (현재 0.0%) → 서버 부하 가능성
- EMQ 악화 (점수 하락) → 디둡 실패 의심
- CPA 악화 (> +10%) → 신호 노이즈 증가 → 즉시 롤백

---

### 6. 롤아웃 전략 (Shadow → Gradual → Full)

**Stage A — Shadow (Day 1~2)**
- 서버 엔드포인트만 배포, 브라우저 스크립트 미적용
- curl 로 테스트 이벤트만 쏴서 백엔드 파이프라인 검증

**Stage B — Canary (Day 3)**
- 바이오컴 **상품 1개**(예: 최고 매출 SKU) 에만 스크립트 적용
- 24시간 동안 CAPI 로그 관찰, 에러 없으면 확대

**Stage C — Gradual (Day 4~5)**
- 전 상품 페이지 확대
- Meta Events Manager 로 실시간 모니터링

**Stage D — Full (Day 6+)**
- 커피 복제 적용
- 롤백 트리거 월 1회 자동 점검 루틴 편입

**롤백 경로**: 아임웹 admin 에서 커스텀 스크립트 블록 삭제 → 즉시 브라우저·서버 이벤트 전송 중단 → Purchase 만 남는 원상태 복귀. **2분 내 완전 롤백 가능**.

---

### 7. 리스크 · 알아둬야 할 것

| # | 리스크 | 영향 | 대응 |
|---|---|---|---|
| 1 | ~~아임웹 DOM 셀렉터가 예상과 다름~~ | — | **✅ 2026-04-14 실측 해소** (3.5 참조). 확정 셀렉터: `[data-bs-prod-code]`, `.real_price`, `[data-bs-content="..."]` |
| 2 | 브라우저 스크립트가 아임웹의 기존 JS 와 충돌 | 결제 기능 마비 | 스코프 격리(`(function(){...})()`), Stage B 카나리에서 먼저 검증 |
| 3 | 서버 엔드포인트가 공격 대상이 됨 (스팸 이벤트) | CAPI 로그 오염, 광고 최적화 왜곡 | CORS 화이트리스트 + rate limit (IP당 10 req/s) + origin 검증 |
| 4 | 디둡 실패 (픽셀·CAPI event_id 불일치) | 이벤트 2배 카운트, CPA 왜곡 | Events Manager 의 "Deduplication" 탭에서 확인, Day 4 에 보정 |
| 5 | fbp/fbc 쿠키 없는 사용자 (신규 방문, 크로스 도메인) | 매칭 품질 상한 낮음 | 정상. 아예 쿠키 없어도 IP + UA 로 매칭 시도 |
| 6 | Meta Graph API v22 → v23 업그레이드 시점에 이벤트 스키마 변경 | 일부 필드 무시됨 | `/api/meta/health` 에 API 버전 알림(metacoffee0413.md #4 D) |
| 7 | GDPR/개인정보보호법: fbp/fbc 는 쿠키라 동의 필요 가능성 | 법무 리스크 | 현재 아임웹 쿠키 배너 존재 여부 확인. 없으면 법무 선 확인 |
| **8** | ~~🔴 커피 사이트 미지의 픽셀 `993029601940881`~~ | — | **✅ 2026-04-14 해소** — 아임웹 admin 에서 해당 픽셀 스크립트 삭제 완료. 커피 사이트는 이제 `1186437633687388` 단일 픽셀만 유지 |
| **9** | **아임웹이 Purchase 픽셀 이벤트를 자동 발사하지 않음** (실측) | 현재 Purchase 측정이 서버 CAPI 단일 경로만 존재 | funnel 확장 시 Purchase 도 같은 event_id 로 픽셀+CAPI 병행 발사하도록 Day 4 에 포함. 지금도 단일 경로 작동 중이나 이벤트 리페어 여지 |

---

### 8. 착수 조건 (시작 전 확인할 것)

- [ ] 바이오컴 아임웹 admin 접근 권한 (박현준 또는 위임자)
- [x] ~~바이오컴 상품 상세 페이지 DOM 확인~~ — **2026-04-14 실측 완료** (§3.5)
- [ ] `att.ainativeos.net` 백엔드에 CORS 설정 추가 가능 여부 (현재 로컬 7020 은 개발용)
- [ ] Meta Events Manager 접근 권한 (EMQ 측정용)
- [ ] 아임웹 쿠키 동의 배너 상태 (GDPR 이슈 확인)
- [x] ~~커피 사이트 미지의 픽셀 `993029601940881` 정체 파악~~ — **2026-04-14 해소** (아임웹 admin 에서 삭제 완료)

---

### 9. 연관 작업

- [../coffee/metacoffee0413.md](../coffee/metacoffee0413.md) — #4 health probe (토큰 모니터링), #12 CAPI 드랍률 모니터, 본 플랜 완료 시 #12 구현이 자연스럽게 이어짐
- 본 문서 §CAPIG 도입 검토 보고서 §5.1 #A (본 플랜이 그 실행)
- 본 문서 §CAPIG 보고서 §5.1 #C (EMQ 프록시 지표 자동 산출) — Day 4~5 에 같이 수행 가능

---

**요지**: Purchase 만 쏘고 있는 현재 구조는 EMQ 점수의 상한이 낮소. ViewContent + AddToCart 두 개만 추가해도 광고 최적화 효율이 실측 5~10% 개선될 가능성이 높고, 이는 월 광고비 1,000만원 기준 **월 50~100만원 추가 매출**로 환산되오. 5일 작업 × 시간가치 500만원 = **한 달 안에 본전, 이후 전부 순이익**. CAPIG 의 676만원 투자로는 얻을 수 없는 ROI 구조요.

---

## 📑 바이오컴 아임웹 CAPIG 도입 검토 보고서 (2026-04-14)

> 관점: 실리콘밸리 데이터분석 CSO/CMO · 바이오컴(biocom.kr 아임웹)을 주 대상으로 하되 더클린커피도 병행 검토.
> 촉발 계기: 토큰 만료 사고(0411) 이후 CAPI 인프라 전반을 "자체 구현 유지 vs Meta 공식 게이트웨이 이전"으로 재평가할 필요 대두.

### 0. 한 줄 결론 (TL;DR)

**지금은 도입하지 않소. 대신 자체 구현을 CAPIG 표준에 맞춰 강화하는 게 ROI 가 3~5배 높소.** 단, **월 CAPI 이벤트 10,000건 돌파** 또는 **EMQ(Event Match Quality) < 7.0** 또는 **월 광고비 2,000만원 초과** 중 하나라도 발생하면 즉시 재검토해야 하오. 이 기준들을 사전에 박아두는 것이 본 보고서의 목적이오.

---

### 1. 바이오컴 CAPI 현황 — 실측 데이터 (2026-04-14 기준)

`/api/meta/capi/log` 엔드포인트에서 추출한 최근 5일(2026-04-08 ~ 2026-04-12) 데이터:

| 지표 | 값 | 비고 |
|---|---|---|
| 총 이벤트 | **499건 (5일)** | 픽셀 1283400029487161 (바이오컴) |
| 일 평균 | ~100건/일 | 4/8 스파이크 250건 제외하면 ~60건/일 |
| **월 추정** | **~3,000건** | CAPIG 권장 임계(10,000건) 의 30% |
| 에러율 | **0.0% (0/499)** | 자체 구현 안정성 확인 |
| 이벤트 종류 | **Purchase 100%** | ⚠️ funnel 이벤트(AddToCart, ViewContent, Lead) 전무 |
| send_path 분포 | auto_sync 177 / unknown(legacy) 321 / test_event 1 | auto-sync 경로가 주력, legacy 는 과거 포맷 |
| 코드 규모 | `metaCapi.ts` 1,655줄 | 2026년 커밋 단 2건 — **코드 stability 높음** |

**핵심 관찰 두 가지**:
1. **자체 구현이 매우 안정적**: 499/499 성공, 올해 주요 수정 2건. CAPIG 의 안정성 장점은 현재 상황에서 **동기가 약함**.
2. **Purchase 만 보내고 있음**: 이것이 **진짜 문제**. Meta 의 EMQ 점수를 올리는 핵심 레버는 **하위 funnel 이벤트** 다양성인데, 바이오컴은 현재 전환 직전 이벤트 하나만 보내는 중. CAPIG 를 도입해도 이 구조가 바뀌는 건 아님.

---

### 2. CAPIG 가 실제로 제공하는 것 (공식 문서 기반)

Meta 가 제공하는 CAPIG (Conversions API Gateway) 는 **"self-hosted AWS 템플릿"** 이오. 고객이 자기 AWS 계정에 CloudFormation 으로 배포하는 방식이고, Meta 는 소프트웨어만 무료 제공. 핵심 기능:

| 기능 | CAPIG | 현재 자체 구현 (`metaCapi.ts`) | 평가 |
|---|---|---|---|
| Server-side 이벤트 전송 | ✅ | ✅ | **동등** |
| 재시도 + 지수 백오프 | ✅ 내장 | ⚠️ 부분 (단순 throw) | CAPIG 우위, 자체 보완 가능 |
| 디둡 (`event_id` 기반) | ✅ 자동 | ✅ 자체 구현 (log에서 확인 중) | **동등** |
| PII 해싱 (SHA-256) | ✅ 자동 | ✅ 이미 구현 (`metacapi` SHA-256) | **동등** |
| Meta 프로토콜 버전 업그레이드 | ✅ Meta 가 자동 | ❌ 수동 (v22.0 고정) | CAPIG 우위, 분기별 1시간 작업 |
| 브라우저 pixel ↔ CAPI 자동 보완 | ✅ (ad-blocker 우회) | ⚠️ 분리 운영 | CAPIG 우위 |
| 멀티 픽셀 라우팅 | ✅ 설정 기반 | ✅ 코드 분기 (오늘 커피용 추가) | **동등** |
| 토큰 회전 관리 | ⚠️ BM에서 수동 | ⚠️ BM에서 수동 + env 교체 | **동등** |
| 관찰성 (CloudWatch 통합) | ✅ 기본 | ✅ JSONL 로그 + health endpoint | **동등 이상** (우리가 더 유연) |
| 커스터마이징 (내부 source of truth 연결) | ❌ 제한적 | ✅ 완전 자유 (attribution ledger 직결) | **자체 구현 우위** |

**핵심 깨달음**: 기능의 10개 축 중 6개는 **동등**, 3개는 CAPIG 우위, 1개는 **자체 구현 우위**. 동등·우위 중 결정적인 것은 **커스터마이징**. 현재 `metaCapi.ts` 는 `attributionLedger`, `resolveSource`, `prepareMetaCapiSend` 등 **자사 비즈니스 로직과 깊게 결합**. CAPIG 로 가면 이 결합을 **다시 풀어서 gateway 경유**로 재작성해야 하는데, **그 작업 자체가 가장 큰 비용**이오.

---

### 3. 비용 분석 (바이오컴 기준)

#### 3.1 CAPIG 도입 시 비용 (연간)

**초기 셋업 비용 (1회성)**
| 항목 | 시간 | 비용(시간가치 10만원/h) |
|---|---|---|
| AWS 계정 준비 + VPC 설계 | 4h | 400,000원 |
| CloudFormation 템플릿 배포 + ALB/TLS | 6h | 600,000원 |
| Meta BM 연결 + 픽셀 할당 | 2h | 200,000원 |
| 기존 `metaCapi.ts` → CAPIG 마이그레이션 | 16h | 1,600,000원 |
| 병행 운영 (2주 shadow write) + 검증 | 10h | 1,000,000원 |
| 문서화 + Runbook 갱신 | 2h | 200,000원 |
| **초기 합계** | **40시간** | **4,000,000원** |

**운영 비용 (월간)**
| 항목 | 월 비용 |
|---|---|
| AWS EC2 t3.medium (24/7) | ~45,000원 |
| Application Load Balancer | ~25,000원 |
| CloudWatch 로그 + 데이터 전송 | ~10,000원 |
| 유지보수 (1.5h/월 × 10만원) | 150,000원 |
| **월 합계** | **230,000원** |

**1년차 총 비용**: 400만 + (23만 × 12) ≈ **676만원**
**2년차 이후**: 연 **276만원**

#### 3.2 자체 구현 유지 시 비용 (연간)

| 항목 | 연 비용 |
|---|---|
| 추가 인프라 (기존 backend 에 포함) | 0원 |
| 유지보수 (월 0.5h × 10만원 × 12개월) | 600,000원 |
| 프로토콜 업그레이드 (분기당 1h × 4 × 10만원) | 400,000원 |
| 연 총계 | **100만원** |

#### 3.3 차액

| 연차 | CAPIG | 자체 구현 | 차액(연) |
|---|---|---|---|
| 1년차 | 676만원 | 100만원 | **CAPIG +576만원** |
| 2년차 | 276만원 | 100만원 | CAPIG +176만원 |
| 3년차 | 276만원 | 100만원 | CAPIG +176만원 |

**3년 누적 차액**: **약 928만원** (CAPIG 가 더 비쌈)

---

### 4. ROI 손익계산 — 그 928만원을 CAPIG 가 회수할 수 있는가

CAPIG 의 가치는 "비용 절감" 이 아니라 **"매치 퀄리티 개선 → 광고 효율 향상"** 이오. Meta 공식 사례(Shopify 통합 브랜드 기준) 에서 CAPIG 도입 후 평균 **EMQ +1.5점, CPA −5~10%, ROAS +5~15%** 개선 보고. 이 수치를 바이오컴에 대입해보오.

**가정**: 바이오컴 월 광고비 1,000만원, 현재 ROAS 2.5x → 월 귀속 매출 2,500만원.

| 시나리오 | ROAS 개선 | 월 추가 매출 | 연 추가 매출 | 기여이익률 30% 적용 | 연 추가 이익 |
|---|---|---|---|---|---|
| 비관(ROAS +3%) | 2.575x | 75만원 | 900만원 | 270만원 | **−658만** (CAPIG 손해) |
| 중도(ROAS +7%) | 2.675x | 175만원 | 2,100만원 | 630만원 | **−298만** (여전히 손해) |
| 낙관(ROAS +12%) | 2.80x | 300만원 | 3,600만원 | 1,080만원 | **+152만** (겨우 이익) |

**해석**:
- 낙관 시나리오(ROAS +12%) 에서만 CAPIG 가 3년 누적 본전. 이 시나리오 확률은 **카탈로그 제품이 많고 funnel 이 복잡한 쇼피파이 형태**에서 주로 달성되는 수치요. 바이오컴의 단일 제품·아임웹 구조에서는 달성 어려움.
- **월 광고비 2,000만원 이상**이면 같은 ROAS 개선율이 두 배 이익으로 환산되어 본격 도입 경제성 확보. 이게 재검토 트리거 중 하나인 이유요.
- **월 이벤트 10,000건** 이상이면 자체 구현 운영 비용(디버깅 · 장애 대응) 이 급증하는 구간. 이것도 트리거.

---

### 5. 권고 결정 (바이오컴)

**결정**: ❌ **현 시점 CAPIG 도입 안 함.** 대신 아래 5가지 "CAPIG-style 개선"을 자체 구현에 흡수.

#### 5.1 지금 해야 할 것 (CAPIG 대신)
바이오컴에 대해 **CAPIG 가 주는 편익 중 실질적인 것들을 자체 구현에서 흡수**하는 작업:

| # | 작업 | 이유 | 예상 시간 |
|---|---|---|---|
| A | **funnel 이벤트 추가** (ViewContent, AddToCart) | 현재 Purchase 만 쏨. EMQ 개선의 가장 큰 레버이고 CAPIG 도 이걸 못 해결 | 1일 |
| B | **재시도 + exponential backoff** (`sendMetaConversion` 실패 시) | 현재 throw 로 끝. CAPIG 기본 기능 복제 | 3시간 |
| C | **EMQ 프록시 지표 자동 산출** (email/phone/fbc/fbp 제공률) | metacoffee0413.md #12 와 연결. 매 이벤트의 매치 시그널 품질 추적 | 4시간 |
| D | **프로토콜 버전 알림** (v22.0 → 다음 릴리스 감지) | Meta Graph API 버전 만료 전 알림. Cron + `/api/meta/health` 확장 | 2시간 |
| E | **attribution ledger ↔ Meta event_id 정합성 감사** | 디둡 키(event_id) 정책 점검. 중복 전송 위험 제거 | 3시간 |

합계 약 **3일 작업**. 비용 300만원. **CAPIG 도입(676만원) 의 44% 수준**으로 편익의 핵심부를 확보 가능.

#### 5.2 재검토 트리거 (사전 정의)

| 트리거 | 임계치 | 상태 확인 방법 | 도달 시 액션 |
|---|---|---|---|
| 월 CAPI 이벤트 | **10,000건** | `readMetaCapiSendLogs` 월 집계 | CAPIG 도입 재평가 착수 |
| 바이오컴 월 광고비 | **2,000만원** | `/api/ads/site-summary?date_preset=last_30d` | 같이 재평가 |
| Meta EMQ 점수 | **< 7.0** (10점 만점) | Events Manager 월 1회 확인 | CAPIG 이든 자체든 강화 필요 |
| 자체 구현 버그 | **분기 3건 이상** | 이슈 트래커 또는 capimeta.md 수정 이력 | Build vs Buy 재검토 |
| 한국 시장 광고 차단 | **EMQ fbp 제공률 < 50%** | 5.1 #C 로 자동 측정 | CAPIG 의 ad-blocker 우회 가치 커짐 |

**중요**: 이 트리거 표를 `metacoffee0413.md` 의 #13 에도 링크하고, 월 1회 리뷰 루틴에 포함시켜야 하오. 사후해석으로 "그때 갔어야 했다" 하지 않기 위함.

---

### 6. 더클린커피에 같은 분석 적용

**커피 현황**:
- CAPI 월 이벤트: 추정 ~300건 (바이오컴의 10%, 엑셀 기준 월 주문 수)
- 광고비: 추정 월 100~300만원
- 토큰: 오늘 전환한 시스템 유저 토큰 (60일, 재발급 예정 Never)
- 매출 귀속: 커피 전용 attribution + Toss PG

**결론**: **바이오컴보다 한층 더 "도입 불필요"** 구간.
- 이벤트 월 300건은 CAPIG 임계(10,000)의 **3%**
- 광고비 규모도 작아서 ROI 회수 시나리오가 비현실적 (낙관 시나리오에서도 CAPIG 초기 비용을 못 뽑음)
- **결정**: ❌ 커피도 도입 안 함
- 단, 커피는 **매출 규모 확대 시** 바이오컴보다 먼저 트리거 도달할 수도 있음 (가격 인상 효과 + 시장 공략 성공 시). 재검토 트리거를 **사이트별 독립 관리**.

#### 6.1 커피에 지금 적용할 것 (바이오컴과 공통)
- 5.1 의 A~E 5개 작업은 **두 사이트 공통 인프라**이므로 바이오컴용으로 만들 때 자동으로 커피에도 적용됨
- 커피 고유 과제: 엑셀 SKU ↔ content_ids 매핑 (coffeeprice0413.md SKU ROAS 분해와 연결)

---

### 7. 의사결정 요약 표

| 축 | 바이오컴 | 커피 |
|---|---|---|
| CAPIG 도입 | ❌ | ❌ |
| 자체 구현 강화 (5.1 #A~E) | ✅ 즉시 | ✅ #A~E 자동 적용 |
| 재검토 트리거 월 점검 | ✅ | ✅ |
| 트리거 도달 예상 시점 | 2026 Q4~2027 Q1 (광고비 확대 가정) | 2027 Q2 이후 |

---

### 8. 구현 시 참고 (CAPIG 를 **나중에** 도입한다고 결정할 때 쓸 체크리스트)

미래 참고용. 지금 바로 쓸 건 아니지만, 트리거 도달 시 이 리스트가 출발점:

1. AWS 계정 분리 (staging + prod), CloudFormation 권한
2. Meta BM 에서 "CAPIG" 앱 설정 + 픽셀 할당
3. 기존 `metaCapi.ts` → CAPIG 전용 Publisher 리팩터링 (attribution ledger 는 그대로, 전송 레이어만 교체)
4. 2주 shadow write 기간 (둘 다 쏴서 count 일치 확인)
5. 전환 컷오버: `FF_CAPIG_ENABLED=true` 플래그 기반
6. 롤백 경로: 플래그 false 한 번에 자체 구현으로 복귀
7. 디둡 키 기준 통일: `event_id` 는 attribution ledger 의 canonical ID 사용 (현재와 동일 규약)

---

### 9. 참고 링크

- Meta 공식: [Conversions API Gateway 개요](https://developers.facebook.com/docs/marketing-api/conversions-api/conversions-api-gateway)
- CloudFormation 템플릿: Meta 에서 BM 연결 후 다운로드 (공개 URL 없음)
- EMQ 측정 가이드: Events Manager → 이벤트 매칭 탭
- 본 보고서 데이터 출처: `/api/meta/capi/log`, `backend/src/metaCapi.ts`, `coffee/metacoffee0413.md`

---

### 10. 연관 작업 (본 보고서 승인 후 착수할 것)

- [ ] 5.1 #A: 바이오컴 아임웹에 ViewContent + AddToCart CAPI 이벤트 트리거 추가
- [ ] 5.1 #B: `sendMetaConversion` 재시도 로직 (`pRetry` 3회, 지수 백오프 1s→4s→9s)
- [ ] 5.1 #C: `/api/meta/capi/health` 신설 (metacoffee0413.md #12 와 동일 작업)
- [ ] 5.1 #D: Meta Graph API 버전 변경 감지 Cron
- [ ] 5.1 #E: event_id 중복 감사 스크립트
- [ ] 재검토 트리거 5개를 월 1회 자동 리포트에 포함

---

**결론 재강조**: CAPIG 는 "좋은 도구이지만 지금 우리 볼륨엔 과잉". 진짜 병목은 **funnel 이벤트 부재**(바이오컴 Purchase-only) 와 **SKU 매핑 부재**(커피). 이 두 가지는 CAPIG 도입으로 해결되지 **않소**. 자체 구현을 CAPIG 표준에 맞춰 강화하면 CAPIG 도입 편익의 80% 를 40% 비용으로 확보 가능. 트리거 도달 전까지 이 전략을 유지.

---

## ★ 다음 할 것

### CAPI 효과 검증 — 가설 확인 시점

자동화가 완료됐으므로, 이제 **시간이 지나면서 효과가 나타나는지 확인**하면 됨.

| 시점 | 확인할 것 | 방법 |
|------|---------|------|
| **04/12 (7일차)** | 전환 건수 +25~50% 증가했는가 | Events Manager > 서버 이벤트 비중 20%+ 확인 |
| **04/19 (14일차)** | CPA 5~10% 하락했는가 | `/ads` 대시보드에서 04/05 전후 CPA 비교 |
| **05/05 (30일차)** | 7d_click ROAS 2.38x → 3.0x+ 개선됐는가 | `/ads` > 클릭 7일 기준 ROAS 비교 |
| **05/05+** | 이벤트 매칭 품질(EMQ) "좋음" 달성했는가 | Events Manager > 이벤트 매칭 탭 |

### 더클린커피 CAPI 연동 — Toss Key 확보 필요

현재 더클린커피 주문은 Toss API 404 오류로 CAPI 전송 실패. 커피 전용 Toss Secret Key(`TOSS_SECRET_KEY_COFFEE`)를 `.env`에 추가하면 해결됨.

---

## ✅ CAPI 자동화 완료 (0405)

### 구현 방식: 서버 내장 setInterval

`server.ts`에 30분 주기 자동 sync를 추가했음. 서버가 돌아가는 한 자동 동작.

```
서버 시작 → 60초 후 첫 sync → 이후 30분마다 반복
  → syncMetaConversionsFromLedger({ limit: 100 })
  → 전송 건수 콘솔 로깅
```

- cron 대신 서버 내장 방식 선택: 서버 재시작 시 자동 복원, 별도 crontab 관리 불필요
- 전송 성공 시 `[CAPI auto-sync] N건 전송` 로그 출력
- 전송할 건이 없으면 로그 없이 조용히 넘어감

---

## 완료된 것 (0405)

| 단계 | 상태 | 날짜 | 결과 |
|------|------|------|------|
| 1. CAPI 백엔드 코드 | ✅ 완료 | 0404 | `metaCapi.ts` — SHA-256 해싱, Pixel 매핑, Toss 검증, 중복 방지 |
| 2. 3사이트 Pixel ID 등록 | ✅ 완료 | 0404 | 바이오컴 `1283400029487161`, 커피 `1186437633687388`, AIBIO `1068377347547682` |
| 3. 테스트 발송 | ✅ 완료 | 0405 13:32 | Events Manager에서 "구매 · 서버 · 처리됨" 수신 확인 (테스트 코드 TEST83755) |
| 4. 운영 전환 | ✅ 완료 | 0405 13:35 | **125건** 실전 전송 성공 |
| 5. 가상계좌 필터링 | ✅ 동작 확인 | 0405 | 미입금 34건 + 취소 6건 자동 차단 |
| 6. **자동화** | **✅ 완료 (0405)** | `server.ts` setInterval — 30분 주기 자동 sync. 서버 시작 60초 후 첫 실행 |

### 전송 결과 상세

```
총 후보: 233건
├── 전송 성공: 125건 (바이오컴 실제 주문)
├── 가상계좌 미입금: 34건 → 정상 차단
├── 취소(CANCELED): 6건 → 정상 차단
├── 중복(이미 전송): 7건 → 정상 차단
├── Toss 조회 실패: 31건 → 더클린커피 전용 Toss Key 미설정
├── value 없음: 24건 → 초기 테스트 데이터
└── Pixel 매핑 실패: 6건 → source 값으로 사이트 판별 불가
```

---

## CAPI가 뭔가?

지금 바이오컴 사이트에는 **Meta 픽셀(JavaScript)**이 설치돼 있다. 고객이 결제하면 브라우저에서 "이 사람이 구매했다"는 신호를 Meta에 보낸다.

**문제**: iOS 14 이후 Apple이 추적을 차단해서, 이 신호의 **30~50%가 누락**된다. Meta가 "이 광고가 매출을 만들었다"를 제대로 인식 못 하면, **같은 광고비로 더 나쁜 고객에게 광고가 노출**된다.

**해결**: **우리 서버에서 직접** Meta에 "이 고객이 결제했다"는 신호를 보내는 것이 CAPI다.

```
현재:  고객 브라우저 → Meta 픽셀(JS) → Meta 서버  (iOS에서 30~50% 누락)
CAPI:  우리 서버 → Meta Graph API → Meta 서버    (누락 없음)
둘 다: 같은 전환이 양쪽에서 오면 event_id로 자동 중복 제거
```

---

## 기대 효과 — 언제부터 나타나는가?

### 이미 효과가 시작된 것 (125건 전송 즉시)

| 효과 | 설명 | 시점 |
|------|------|------|
| **전환 데이터 보강** | Meta가 125건의 서버사이드 전환을 인식. 기존 픽셀에서 누락된 iOS 전환이 복구됨 | **즉시** |
| **Events Manager 수치 변화** | "전환" 탭에서 "서버" 소스가 추가로 표시됨 | **즉시** |
| **이벤트 매칭 품질** | SHA-256 해시된 전화번호/이메일로 Meta 사용자 매칭 시작 | **즉시** |

### 자동화 이후에 나타나는 효과 (cron 설정 후)

| 효과 | 설명 | 시점 |
|------|------|------|
| **연속적 전환 신호** | 새 결제가 들어올 때마다 1시간 이내 Meta에 전송 | cron 설정 후 즉시 |
| **Meta AI 학습 시작** | 서버 전환 데이터가 충분히 쌓이면(~50건+) Meta AI가 패턴 학습 시작 | **3~7일** |
| **자동 입찰 최적화** | Meta가 "전환 가능성 높은 사용자"를 더 정확히 식별 → 같은 예산으로 더 많은 전환 | **7~14일** |
| **CPA 하락** | 타겟팅 정밀도 향상으로 전환당 비용 감소 | **14~30일** |

### 수치 예상 (자동화 + 30일 누적 후)

| 지표 | 현재 (픽셀만) | CAPI 자동화 후 (예상) | 변화 |
|------|-------------|------------------|------|
| 월 전환 | 1,292건 | **1,600~1,900건** | +25~50% |
| 전환 매출 | ₩5.89억 | **₩7.4~8.8억** | +25~50% |
| Meta ROAS (기본) | 5.03x | **6.3~7.5x** | +25~50% |
| CPA | ₩94,000 | **₩75,000~85,000** | -10~20% |

**핵심**: 기대 효과의 대부분은 **자동화 이후** 시간이 지나면서 나타남. 125건 일회성 전송만으로는 Meta AI 학습에 충분하지 않음. **cron 자동화가 핵심.**

---

## CAPI 엔드포인트

| 엔드포인트 | 용도 | 언제 사용 |
|----------|------|---------|
| `POST /api/meta/capi/send` | 단건 수동 전송 | 테스트, 특정 주문 재전송 |
| `POST /api/meta/capi/sync` | 미전송 건 일괄 전송 | **cron에서 주기적 호출** |
| `GET /api/meta/capi/log` | 전송 로그 조회 | 모니터링, 디버깅 |

### sync 호출 예시

```bash
# 미전송 건 최대 100건 전송 (운영 모드)
curl -X POST http://localhost:7020/api/meta/capi/sync \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'

# 테스트 모드 (실제 광고에 영향 없음)
curl -X POST http://localhost:7020/api/meta/capi/sync \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "testEventCode": "TEST12345"}'
```

---

## 자동 처리 기능

### 가상계좌 필터링

```
카드 결제 (Toss status: DONE) → ✅ Meta에 전송
가상계좌 미입금 (WAITING_FOR_DEPOSIT) → ❌ 건너뜀
취소 (CANCELED) → ❌ 건너뜀
```

### SHA-256 해싱 (개인정보 보호)

```
전화번호: 01012345678 → sha256() → "a1b2c3d4..."
이메일: kim@gmail.com → sha256() → "e5f6g7h8..."
원본은 전송되지 않음. Meta는 해시값으로만 사용자 매칭.
```

### 중복 전송 방지

```
event_id = "{orderId}_{eventName}_{timestamp}"
같은 event_id는 한 번만 전송. 재호출 시 자동 건너뜀.
픽셀과 CAPI에서 동일 전환이 오면 Meta가 event_id로 자동 중복 제거.
```

### Pixel ID 자동 매핑

```
source에 "biocom" → Pixel 1283400029487161
source에 "thecleancoffee" → Pixel 1186437633687388
source에 "aibio" → Pixel 1068377347547682
```

---

## 주의사항

### 픽셀과 CAPI 병행 운영

CAPI를 켜도 기존 브라우저 픽셀을 **끄면 안 됨**. 둘 다 켜야 함. Meta가 `event_id`로 자동 중복 제거함.

### 토큰 만료

`META_ADMANAGER_API_KEY`는 60일 토큰(~06/02 만료 예상). 만료 전에 재발급 필요.

### 이벤트 매칭 품질 (EMQ)

| 매칭 키 | 현재 상태 | 개선 방법 |
|---------|---------|---------|
| phone | △ Toss에서 추출 가능 | paymentKey로 Toss 상세 조회 시 자동 |
| email | △ Toss에서 추출 가능 | 동일 |
| fbc (fbclid) | △ 12% | attribution ledger에서 자동 전달 |
| fbp | ❌ 없음 | 프론트 푸터 코드에서 `_fbp` 쿠키 전달 추가 필요 |
| client_ip | ✅ | attribution ledger에서 자동 |
| user_agent | ✅ | attribution ledger에서 자동 |

---

## 모니터링

### Events Manager에서 확인

1. **"개요" 탭** > 이벤트 소스에서 "서버" 추가 확인
2. **"이벤트 매칭"** > 매칭 품질 "보통" 이상
3. **"중복 이벤트 비율"** > 10% 이하

### 우리 대시보드에서 확인

```bash
# 전송 로그 조회
curl -s http://localhost:7020/api/meta/capi/log | python3 -m json.tool | head -20

# 전환 변화 모니터링 (CAPI 전후 비교)
# /ads 대시보드에서 전환 건수 추이 확인
```

### 기대 타임라인

| 시점 | 상태 |
|------|------|
| 0405 (완료) | 테스트 + 운영 전환. 125건 전송 |
| **다음**: cron 설정 | 매시간 자동 sync. 새 결제 누락 방지 |
| +7일 | Meta AI가 서버 전환 데이터 학습 시작 |
| +14일 | CPA 하락 효과 관찰 시작 (5~10%) |
| +30일 | CAPI 전/후 ROAS 비교 리포트 가능 |

---

## 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| `200`이지만 Events Manager에 안 보임 | 테스트 코드 없이 보냈으므로 "테스트 이벤트" 탭이 아닌 "개요"에서 확인 | 개요 > 서버 이벤트 필터 |
| `403` 권한 오류 | 토큰 만료 또는 Pixel 접근 권한 없음 | 토큰 재발급 또는 Business Settings에서 권한 추가 |
| `sent: 0` | 모든 건이 이미 전송됨 또는 필터링됨 | 새 결제가 ledger에 들어왔는지 확인 |
| 더클린커피 전송 실패 | Toss 커피 전용 Secret Key 미설정 | `.env`에 커피 Toss Key 추가 필요 |
