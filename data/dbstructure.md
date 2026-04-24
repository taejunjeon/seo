# 바이오컴 그룹 통합 DB 구조 · 2026-04-24 스냅샷

작성 배경: AIBIO (Recovery Lab) Supabase DB 접근 권한 확보 이후 전사 데이터 소스를 한 페이지에 정리. 통합 VIP 멤버십 전략(`coffee/coffeevip.md`)의 금액대 산정·sync 설계의 기준 문서.

---

## 1. 데이터 소스 지도 (Source of Truth)

바이오컴 그룹은 **3개 저장소 · 5개 핵심 테이블**로 운영 데이터가 분산되어 있소.

```
┌─────────────────────────────────────────────────────────────────────┐
│  [원격 PostgreSQL · DATABASE_URL]                                    │
│  ├─ tb_iamweb_users          97,407 rows (2019-09 ~ 2026-04)        │
│  │   └─ 바이오컴 아임웹 주문 원장 (6.5년, 건당 paid_price)           │
│  ├─ tb_playauto_orders      121,747 rows                             │
│  │   └─ 전 쇼핑몰 통합 PlayAuto 원장 (shop_name으로 채널 구분)       │
│  │       · 아임웹    54,841 → 바이오컴 (건기식)                       │
│  │       · 아임웹-C  41,312 → 더클린커피                              │
│  │       · 쿠팡      11,182 → 혼합 (커피 7,723 + 바이오컴 969)       │
│  │       · 스마트스토어-B 7,392 → 바이오컴 네이버                     │
│  │       · 스마트스토어 5,660 → 커피 네이버                           │
│  │       · 기타 아임웹-B/D/E, 토스 쇼핑, 바이오컴-앱                  │
│  ├─ tb_naver_orders, tb_coupang_orders  (원채널별 상세)              │
│  ├─ tb_sales_toss, tb_sales_nicepay, tb_sales_coupang,               │
│  │   tb_sales_recovery_lab (15), tb_sales_naver_vat                  │
│  ├─ ltr_cohort_cache, ltr_customer_cohort (코호트 캐시)              │
│  └─ tb_imweb_member (0 rows · 미사용 레거시)                         │
│                                                                       │
│  [AIBIO Supabase · project: aibio-center / smyqywkwxfjusvibxrqf]    │
│  ├─ customers                 1,074                                   │
│  ├─ payments                  1,018 (2022-09 ~ 2026-02 · 3.5년)     │
│  ├─ product_usage            11,092                                   │
│  ├─ marketing_leads             465                                   │
│  ├─ reservations                356                                   │
│  └─ (+ 37개 보조 테이블 — 전체는 aibio/aibiodb.md 참조)              │
│                                                                       │
│  [로컬 SQLite · backend/data/crm.sqlite3]                            │
│  ├─ imweb_members            84,545                                   │
│  │   · biocom 71,125 / thecleancoffee 13,338 / aibio 100             │
│  ├─ imweb_orders              11,338 (최근 3.5개월만)                 │
│  │   · biocom 9,401 / thecleancoffee 1,937                           │
│  ├─ imweb_order_items, imweb_issue_coupons, imweb_coupon_masters     │
│  ├─ toss_transactions, toss_settlements                               │
│  ├─ tiktok_ads_*, tiktok_pixel_events                                 │
│  ├─ crm_* (20+ 운영 테이블: 그룹·세그먼트·실험·알림)                  │
│  └─ attribution_ledger, refund_dispatch_log                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 각 저장소의 역할 · 책임 분리

| 저장소 | 역할 | 실시간성 | 주요 소비자 |
|---|---|---|---|
| **원격 PostgreSQL** | 전사 주문·매출 원장 (진실의 원천) | 시간 단위 | callprice 대시보드, Metabase, BigQuery 연동, 분석 스크립트 |
| **AIBIO Supabase** | AIBIO 센터 CRM 운영 DB | 실시간 | Recovery Lab 프론트엔드·태블릿 문진 앱 |
| **로컬 SQLite** | 바이오컴 회원 등록부·세그먼트 캐시·실험 기록 | 일 1회 sync | seo 프로젝트 대시보드 (localhost:7010) |

**원칙**: 원격 PG = 읽기 전용 참조, Supabase = AIBIO 전용, 로컬 SQLite = 운영 실행 상태 관리.

---

## 3. 통합 키 · phone 정규화

세 저장소를 단일 고객으로 묶는 조인 키는 **전화번호 정규화값** (하이픈·공백 제거 후 숫자만).

| 저장소 | 전화 컬럼 | 정규화 후 |
|---|---|---|
| PG `tb_iamweb_users` | `customer_number` | `regexp_replace(customer_number, '[- ]', '', 'g')` |
| PG `tb_playauto_orders` | `order_htel` | `regexp_replace(order_htel, '[- ]', '', 'g')` |
| Supabase `customers` | `phone` | 프론트에서 하이픈 포함 저장 · 조인 시 제거 |
| 로컬 `imweb_members` | `callnum` | `REPLACE(REPLACE(callnum, '-', ''), ' ', '')` |

한계: 가족 공유 번호·재가입으로 인한 복수 계정 존재 (로컬 `imweb_members` 기준 약 576건 중복, `coffee/member.md` §5.2 참조).

---

## 4. 과거 기간 커버리지 (중요)

| 지표 | 로컬 `imweb_orders` | 원격 `tb_iamweb_users` | 원격 `tb_playauto_orders` | Supabase `payments` |
|---|---|---|---|---|
| 시작일 | **2025-12-31** | **2019-09-20** | 전 기간 | **2022-09-03** |
| 종료일 | 2026-04-15 | 2026-04-24 | 최신 | 2026-02-21 |
| **기간** | **3.5개월** | **6.5년** | 전 기간 | **3.5년** |
| 바이오컴 주문 | 9,401 | 97,407 | 54,841 (+ 네이버 7,392) | — |
| 커피 주문 | 1,937 | — (혼합 80건만) | 41,312 (+ 네이버 5,660) | — |

**결론**: 과거 분석은 **PG `tb_iamweb_users` + `tb_playauto_orders`**가 진실의 원천. 로컬 `imweb_orders`는 "최근 3.5개월 운영 데이터"용이며 과거 커버리지 확장이 **불필요** — PG 원장에 이미 완전 백필이 존재함.

이전 `coffee/coffeevip.md` 초안에서 "바이오컴 최고 구매자 ₩2.6억"이라는 수치는 로컬 `imweb_orders` 3.5개월치에서 집계돼 실제 12개월 정합 데이터(최고 ₩1,312만)와 크게 다르므로, 전략 금액대 재산정 필수.

---

## 5. 통합 VIP 등급 실측 (2025-04-25 ~ 2026-04-24 · 직전 12개월)

PG `tb_iamweb_users` + PG `tb_playauto_orders` (아임웹-C·스마트스토어) + Supabase `payments` 3소스를 phone 기준 조인한 결과:

| 티어 (기존 설계) | 최소 금액 | 실측 고객 수 | 비고 |
|---|---|---|---|
| PRIME | ₩50,000,000+ | **0명** | 실측 최고 ₩1,312만 |
| PLATINUM | ₩15,000,000+ | **0명** | 기준 과대 |
| GOLD | ₩5,000,000+ | **23명** | 현 운영 규모의 실질 최상위 |
| SILVER | ₩2,000,000+ | **200명** | |
| INITIATE | ₩500,000+ | **2,444명** | |
| (below) | ₩0+ | 21,262명 | |

**채널 조합 매트릭스 (12개월)**:

| 조합 | 고객 수 | 비고 |
|---|---|---|
| 바이오컴 only | 23,116 | |
| 커피 only | 637 | |
| AIBIO only | 138 | |
| 바이오컴 + 커피 | 23 | |
| 바이오컴 + AIBIO | 14 | |
| 커피 + AIBIO | 0 | |
| **3채널 모두** | **1** | 자연 챔피언 — 최상위 특별 대우 후보 |

### 5.1 금액대 재조정 권장 (coffeevip.md 업데이트 대상)

실측을 반영한 5단계:

| 새 기준 | 금액 | 예상 인원 | 포지셔닝 |
|---|---|---|---|
| **PRIME** | **₩10,000,000+** | 약 10명 | 현 최상위 (₩1,312만 포함) |
| **PLATINUM** | **₩5,000,000+** | 약 25명 | 기존 GOLD 상단 |
| **GOLD** | **₩2,000,000+** | 약 200명 | 기존 SILVER 수준 |
| **SILVER** | **₩1,000,000+** | 약 700명 (추정) | 정기구매 중핵 |
| **INITIATE** | **₩300,000+** | 약 3,500명 (추정) | 통합 멤버십 입구 |

### 5.2 집계 한계

- **커피 pay_amt=0 다수**: `tb_playauto_orders`의 커피 주문은 대부분 `pay_amt=0`으로 번들 기록(결제액은 Toss 별도). 정확한 커피 매출 반영하려면 `tb_sales_toss` 조인 필요. 현재 수치는 **과소집계** 가능.
- **쿠팡·기타 채널 제외**: 커피 필터를 `shop_name in ('아임웹-C','스마트스토어')`로만 잡음. 쿠팡·기타 커피 주문은 별도 추가 필요.
- **환불 처리 차이**: `tb_iamweb_users`는 `cancellation_reason`·`return_reason` 제외, AIBIO는 음수 amount 자동 상쇄. 쇼핑몰별 환불 로직 일관화 필요.
- **기간 동기화**: AIBIO는 `payment_date` 기준 12개월, 타 채널은 각 테이블 날짜 컬럼. 타임존·경계값 미세 차이 존재.

### 5.3 Toss × PlayAuto 조인 검증 결과 (2026-04-24)

Toss 정산 데이터와 PlayAuto 주문을 조인해 정확한 커피 매출을 산출하려 시도한 결과:

**Toss 기준 커피 12개월 순매출 실측**:

| 상태 | 건수 | 총액 | 취소액 | 순 |
|---|---|---|---|---|
| DONE | 1,252 | ₩56,912,759 | ₩0 | ₩56,912,759 |
| PARTIAL_CANCELED | 3 | ₩128,615 | ₩29,897 | ₩98,718 |
| CANCELED | 35 | ₩1,558,771 | ₩1,558,771 | ₩0 |
| **순매출 합계** | **1,255** | — | — | **₩57,011,477** |

**PlayAuto pay_amt>0 기준 기존 추정**: ₩3,106,360

→ **실제 Toss 기준 대비 PlayAuto 집계는 약 5.4% 수준(≈18배 과소집계)**. `tb_playauto_orders`의 커피 `pay_amt`는 거의 0이고, 결제액은 Toss에 별도 기록됨.

### 5.4 고객별 커피 매출 산정 · 해소 완료 (2026-04-24 update)

> **`아임웹-C`**는 PlayAuto의 `shop_name` 값으로, **더클린커피 자사몰**(`thecleancoffee.com` 아임웹) 주문을 의미. 바이오컴 자사몰은 `아임웹`(단독), 쿠팡은 `쿠팡`, 네이버는 `스마트스토어-B`(바이오컴) / `스마트스토어`(커피).

데이터 소스별 phone·금액 커버리지와 매칭 키:

| 테이블 | 저장소 · 위치 | phone | 금액 | 매칭 키 |
|---|---|---|---|---|
| `tb_playauto_orders` (shop_name=`아임웹-C` · 더클린커피 자사몰) | **원격 운영 PG** (`DATABASE_URL`) | 혼합 · 89% 마스킹(`010-5***-9298`) / **11% 정상(`010-XXXX-XXXX`, 4,698건)** | 대부분 0 (번들 레코드) | `shop_ord_no` (공백 분리 2번호) |
| `tb_sales_toss` (store=`coffee`) | **원격 운영 PG** (`DATABASE_URL`) | 부재 | 정확 (total_amount, cancel_amount) | `order_id` (예: `202601018106979-P1`) |
| `tb_iamweb_users` | **원격 운영 PG** (`DATABASE_URL`) | 정상 (비마스킹) | 정상 (paid_price) | `order_number` — **단 커피 주문은 2019-09~2020-08 80건만 포함. 이후는 바이오컴 전용** |
| `imweb_orders` | **로컬 SQLite** (`backend/data/crm.sqlite3`) | 정상 | 정상 | `order_no` — 최근 3.5개월만 |
| AIBIO `customers` / `payments` | **Supabase** (project `aibio-center`) 및 로컬 SQLite (`aibio_*`, sync됨) | 정상 | 정확 | `customer_id` |

**해소 경로 3가지 검증 결과**:

| # | 경로 | 결과 |
|---|---|---|
| 1 | 아임웹 자사몰 커피 주문 API 별도 수집 → 로컬 `imweb_orders` 과거 확장 | **차선** — 아임웹 v2 API는 최신순 페이지네이션만 지원, `maxPage=500` 상한. 이미 9,401건이 3.5개월 한계선. 과거 데이터는 API 재호출로는 현실적으로 불가 |
| 2 | Toss `order_id` ↔ PlayAuto `shop_ord_no` 파싱 매칭 | ✅ **해소 완료** — `split_part(t.order_id,'-',1) = p.shop_ord_no OR split_part(p.shop_ord_no,' ',1) = split_part(t.order_id,'-',1)` 공식으로 **2,071행 · 고유 고객 842명 매칭**. Toss 총 순매출 ₩57,011,477 대비 매칭 분 ₩56,814,577 (**99.7% 커버**) |
| 3 | `tb_iamweb_users`에 커피 주문 전수 포함 여부 재확인 | ❌ **불가** — 커피 상품 포함 레코드는 **80건만 · 2019-09-22 ~ 2020-08-07 초기 기간 한정** (phone 정상이지만 표본 부족, paid_price 모두 null) |

즉 **경로 2가 최종 해법**으로 확정. 구현된 SQL은 `backend/scripts/coffee-rebuild.cjs`와 `backend/scripts/unified-tier-v2.cjs`에 반영.

### 5.5.v3 통합 등급 v3 결과 (2026-04-24 · 커피 엑셀 기반)

`backend/scripts/unified-tier-v3.cjs` 실행. 변경점: 커피 데이터 소스를 `tb_sales_toss`(불완전) → **`coffee_payments_excel × coffee_orders_excel` phone 매칭**(엑셀 기반)으로 전면 교체. 정기결제·네이버페이·이체 등 모든 결제수단 포함.

**티어 분포 (v3 · 직전 12개월)**

| 티어 | 기준 | 고객 수 | 3채널 | 2채널 | 1채널 |
|---|---|---|---|---|---|
| PRIME | ₩10M+ | **3명** | 0 | 1 | 2 |
| PLATINUM | ₩5M+ | **20명** | 0 | 1 | 19 |
| GOLD | ₩2M+ | **200명** | 1 | 16 | 183 |
| SILVER | ₩1M+ | **598명** | 0 | 13 | 585 |
| INITIATE | ₩300K+ | **6,068명** | 0 | 56 | 6,012 |
| (below) | — | 19,098명 | 0 | 47 | 19,051 |

**채널 매트릭스 v3**:

| 조합 | v2 | v3 | 변화 |
|---|---|---|---|
| 바이오컴 only | 23,116 | 22,993 | -123 |
| 커피 only | 812 | **2,721** | **+1,909 (+235%)** |
| AIBIO only | 138 | 138 | — |
| **바이오컴 + 커피** | 28 | **120** | **+92 (+328%)** |
| 바이오컴 + AIBIO | 14 | 14 | — |
| 커피 + AIBIO | 0 | 0 | — |
| 3채널 모두 | 2 | 1 | -1 (재분류) |

**커피 only 분포 (v3 · 12개월)**:
- ₩2M+: 0 / ₩1M+: 6 / ₩500K+: 43 / ₩300K+: 145 / ₩100K+: 688 / ₩50K+: 1,240

**v2 → v3 핵심 변화**:
1. v2(`tb_sales_toss`)는 더클린커피의 ~14% 매출만 잡았음 → v3로 정합성 확보
2. 커피 단독 고객 발견량 3.4배 증가
3. 바이오컴×커피 크로스 4배 증가 → 통합 멤버십 전략 2의 잠재 깊이 재확인
4. PRIME/PLATINUM 인원은 동일 (이 구간은 바이오컴 단독 영역이라 영향 없음)

**별도 트랙: 정기구독 (전략 3)**:
- `coffee_subscriber_track` 테이블 + 일 1회 sync (`scripts/sync-subscriber-tracks.cjs`)
- 첫 sync(2026-04-24): EVERGREEN 2 / MANIAC 19 / LOYALIST 145 / SUBSCRIBER 261 / NONE 129 / churn 427
- 자세한 내용: `coffee/coffeevip.md` §3.5

---

### 5.5 (v2 · 참고용 보존) 해소 이후 재집계 결과 (2026-04-24)

`backend/scripts/unified-tier-v2.cjs` 실행 결과 (직전 12개월 · 바이오컴 `tb_iamweb_users` + 커피 Toss↔PlayAuto 매칭 + AIBIO 로컬 `aibio_payments`):

**티어 분포 (재조정 기준)**

| 티어 | 기준 | 고객 수 | 3채널 | 2채널 | 1채널 |
|---|---|---|---|---|---|
| PRIME | ₩10M+ | **3명** | 0 | 1 | 2 |
| PLATINUM | ₩5M+ | **20명** | 0 | 1 | 19 |
| GOLD | ₩2M+ | **199명** | 2 | 8 | 189 |
| SILVER | ₩1M+ | **591명** | 0 | 1 | 590 |
| INITIATE | ₩300K+ | **5,924명** | 0 | 17 | 5,907 |
| (below) | — | 17,332명 | 0 | 13 | 17,319 |

**채널 매트릭스 (v2)**: 바이오컴 only 23,076 / 커피 only 812 / AIBIO only 138 / 바이오컴+커피 **28** / 바이오컴+AIBIO 13 / 커피+AIBIO 0 / **3채널 모두 2명** (v1 1명에서 증가)

v1(PlayAuto pay_amt 기반) 대비:
- 커피 고객 637 → **842** (+205명 · +32%)
- 바이오컴+커피 23 → 28
- 3채널 모두 1 → **2**
- INITIATE 등급 2,444 → **5,924** (커피 소액 구매자 대거 편입)

**주의**: 아임웹-C의 order_htel 36,606건(89%)은 여전히 마스킹 상태. 이들의 매칭은 불가하므로 커피 실제 고객 수는 842명보다 더 클 수 있음. 다만 Toss 순매출 커버리지는 99.7%에 달하므로 **금액 기준 집계는 사실상 완전**.

---

## 6. 로컬 SQLite vs PostgreSQL 이관 검토 (2026-04-24)

**질문**: 현재 로컬 `backend/data/crm.sqlite3` (better-sqlite3)를 PG 호환 DB(Postgres)로 이관할 필요가 있나?

### 6.1 현 상태 · 용량과 책임

| 저장소 | 용량 | 사용 패턴 |
|---|---|---|
| 로컬 SQLite | ~115 MB · ~30개 테이블 | 세그먼트·실험·알림톡 발송 로그 등 **운영 실행 상태** + AIBIO 캐시 |
| 원격 PG | 수 GB · ~70개 테이블 | 전사 주문 원장 · 매출 집계 · 재고 (**진실의 원천**) |

이미 **책임이 잘 분리**돼 있음 (§2 참조).

### 6.2 이관 시 장단점

**이관 찬성 (→ PG로 통일)**:
- 단일 SQL 엔진에서 3채널 통합 분석 가능 (현재는 CLI에서 2-stage 조인)
- PG 트리거·파티션·full-text 같은 고급 기능 활용
- 로컬 파일 손상 리스크 제거
- `better-sqlite3`의 `.bak_YYYYMMDD_*` 수동 백업 관습 불필요 (PG 자동 백업 체계 활용)
- pgvector 등 확장 모듈 도입 시 AI 기능 통합 용이

**이관 반대 (→ 현 구조 유지)**:
- **기존 코드베이스의 광범위한 수정 필요**: `crmLocalDb.ts`의 `better-sqlite3` 동기 API를 비동기 `pg`로 전환 · `getCrmDb().prepare().run()` → `await pool.query()` 전면 교체 · 트랜잭션 래퍼(`db.transaction()`) 재작성
- **지연(latency) 증가**: SQLite는 프로세스 내 파일 접근(수 μs), PG는 TCP 왕복(수 ms). 알림톡 발송처럼 대량 INSERT 반복 작업은 수십 배 느려질 수 있음
- **쓰기 권한 이슈**: 원격 PG는 운영팀 소유 · seo 프로젝트 쓰기가 허용될지 정책적 합의 필요. `aibio_customers` 같은 복제 테이블을 PG에 만들려면 스키마 관리 권한 협의 필수
- **로컬 개발 복잡화**: 현재 `npm install` + `npm run dev`로 즉시 개발 가능. PG 이관 시 local Postgres + 테스트 DB 시드 단계 추가
- **기능 분리 철학 훼손**: "SQLite = 실행 상태 / PG = 원장"이 명확한 구분. 혼합 시 어디 뭐가 있는지 모호해짐

### 6.3 권장안 · 하이브리드 유지 (이관 보류)

현 "SQLite(실행) + PG(원장) + Supabase(AIBIO 전용)" 3계층 구조 유지. 통합 조회가 필요한 시점엔 **쿼리 레벨 조인**(아래 §6.4 패턴)으로 해결하고, DB 자체는 분리 유지.

**단, 다음 조건이 하나라도 충족되면 이관 재검토**:
1. 로컬 SQLite 파일이 500 MB를 초과하거나 테이블 수 50개를 넘어갈 때
2. 여러 백엔드 인스턴스에서 동시에 로컬 DB를 수정해야 할 때 (현재는 단일 노드)
3. SQL 표준 밖의 기능(분석 윈도우 함수·JSON path·pg_trgm 검색)을 정기적으로 필요할 때
4. AIBIO Supabase처럼 추가 외부 DB가 2개 이상 늘어나서 "읽기 전용 복제본 통합 레이어"가 필요해질 때

### 6.4 통합 조회 권장 패턴 (이관 안 할 경우)

- PG 측 데이터는 `queryPg()` (backend/src/postgres.ts)
- 로컬 SQLite는 `getCrmDb()` (backend/src/crmLocalDb.ts)
- 통합은 Node 프로세스에서 두 소스를 **메모리 조인** (예: `backend/scripts/unified-tier-v2.cjs`)
- 결과물이 반복 사용되는 경우에만 로컬 SQLite에 `v_unified_*` 테이블/뷰로 캐시 (TTL 1일)
- 초기 sync는 `aibio_customers`/`aibio_payments`처럼 **작은 복제본**만 로컬에 두고, 바이오컴·커피는 PG에서 직접 조회 (원장 복제 금지 — 원본 크기가 크고 ETL은 외부 시스템이 이미 함)

---

## 7. 주요 테이블 스키마 요약

### 7.1 PG `tb_iamweb_users` (97,407 rows · 41 cols)

핵심 컬럼:
```
id, order_date (varchar), order_number, customer_number (phone),
product_name, option_name, final_order_amount, paid_price,
customer_email, customer_name, purchase_quantity,
cancellation_reason, return_reason,
payment_method, payment_status, payment_complete_time,
raw_data (jsonb), chart_id
```

집계 SQL (12개월 고객별 누적):
```sql
SELECT regexp_replace(customer_number, '[- ]', '', 'g') phone,
       SUM(paid_price) rev
FROM public.tb_iamweb_users
WHERE order_date >= to_char(now() - interval '12 months', 'YYYY-MM-DD')
  AND paid_price > 0
  AND (cancellation_reason IS NULL OR TRIM(cancellation_reason) IN ('', 'nan'))
GROUP BY 1;
```

### 7.2 PG `tb_playauto_orders` (121,747 rows · 34 cols)

핵심 컬럼:
```
id, uniq, bundle_no, ord_status, shop_name, shop_ord_no,
shop_sale_name (product), shop_opt_name, sale_cnt, pay_amt,
ship_cost, carr_name, invoice_no, ship_plan_date,
order_name, order_htel (phone), to_name, to_htel,
to_addr1, to_addr2, to_zipcd
```

채널 구분은 `shop_name`:
- `아임웹` = 바이오컴 자사몰
- `아임웹-C` = 더클린커피 자사몰
- `스마트스토어-B` = 바이오컴 네이버
- `스마트스토어` = 커피 네이버
- `쿠팡` = 혼합
- 기타 `아임웹-B/D/E`, `바이오컴-앱`, `토스 쇼핑`

### 7.3 Supabase `customers` · `payments` (AIBIO)

전체 스키마 전체는 `aibio/aibiodb.md` 참조. 핵심:

```
customers:  customer_id, name, phone, customer_status (active|lead),
            membership_level (전원 'basic' · VIP 도입 시 이 컬럼 활용),
            total_revenue (현재 전원 0 · 참고용), total_visits,
            first_visit_date, last_visit_date

payments:   payment_id, customer_id, payment_date, amount (음수=환불),
            payment_method (card|transfer), notes, approval_number
```

환불: `amount < 0` + `notes`에 "환불"/"취소" 텍스트. 별도 status 컬럼 없음.

### 7.4 로컬 `imweb_members` (84,545 rows)

```
member_code PK, site (biocom|thecleancoffee|aibio),
callnum (phone), name, email,
marketing_agree_sms (Y|N), marketing_agree_email, third_party_agree,
member_grade (대부분 공란 · VIP 등급 저장소 후보),
join_time, last_login_time, synced_at,
birth, gender, addr_post, addr, addr_detail, point_amount
```

sync: `POST /api/crm-local/imweb/sync-members` (`backend/src/routes/crmLocal.ts:1202`)

### 7.5 로컬 `imweb_orders` (11,338 rows · 3.5개월 커버)

운영 상태 추적용 (구매 확정 / 취소 / 배송 중 등). 과거 분석에는 PG 원장 사용.

---

## 8. 데이터 흐름 · 동기화 현황

| 흐름 | 빈도 | 구현 위치 | 상태 |
|---|---|---|---|
| 아임웹 API → `imweb_members` | 수동 (일 1회 권장) | `routes/crmLocal.ts:1202` | ✅ 작동 중 (시간 3.5분) |
| 아임웹 API → `imweb_orders` | 수동 | `routes/crmLocal.ts:1330` | ⚠️ maxPage 120 제한 · 3.5개월만 |
| PlayAuto / 네이버 / 쿠팡 → PG `tb_*_orders` | 외부 시스템 (분 단위) | (seo 외부) | ✅ 운영 중 |
| BigQuery → PG (운영 원장) | ETL | (seo 외부) | ✅ |
| **AIBIO Supabase → 로컬 SQLite** (`aibio_customers`, `aibio_payments`) | 수동 (일 1회 권장) | `backend/src/aibioSync.ts` + `routes/aibio.ts` | ✅ 2026-04-24 구현 완료 (1,074+1,018 건 1.6초) |
| Toss 정산 → `toss_settlements` | 일 1회 | seo 프로젝트 | ✅ |
| 틱톡 광고 → `tiktok_ads_*` | 시간 단위 | seo 프로젝트 | ✅ |

---

## 9. 권한 · 접근 방법

### 9.1 원격 PostgreSQL (운영 DB)
- 환경변수: `DATABASE_URL` (`backend/.env`)
- 접근 방식: Node `pg` 라이브러리 · `backend/src/postgres.ts`의 `queryPg()` 헬퍼
- 읽기 권한 기본. 쓰기는 ETL 파이프라인이 담당 (seo 프로젝트에서 쓰기 금지 권장).

### 9.2 AIBIO Supabase (리커버리랩 운영 DB)
- 환경변수: `AIBIO_SUPABASE_PROJECT_ID`, `AIBIO_SUPABASE_Secret_Keys`, `AIBIO_SUPABASE_Publishable_key` (`backend/.env` 195-200행)
- 접근 방식: REST API `https://{PROJECT_ID}.supabase.co/rest/v1/{table}` · Header `apikey`, `Authorization: Bearer {secret}`
- secret key는 RLS 우회 — 서버 전용, 프론트 노출 금지
- ✅ 변수명 오타(`Pubilshable_key`) 수정 완료 (2026-04-24). `env.ts`는 fallback도 유지.

### 9.3 로컬 SQLite (seo 프로젝트 실행 상태)
- 파일: `backend/data/crm.sqlite3` (약 115MB)
- 접근: `backend/src/crmLocalDb.ts` · `better-sqlite3` (동기 API)
- 백업: `.bak_YYYYMMDD_*` 파일 주기적 생성
- 이관 검토: §6 (현 시점 하이브리드 유지 권장)

### 9.4 쿠팡 Wing Open API (외부)
- 환경변수: `COUPANG_BIOCOM_*`, `COUPANG_TEAMKETO_*` (`backend/.env` 233-240행)
- 접근 방식: HMAC-SHA256 서명 · `backend/src/coupangClient.ts`
- 상태: 서명 알고리즘 검증 완료 · **Wing 관리자에서 서버 IP 허용 등록 필요** (403 FORBIDDEN 차단 중)
- 상세: `coupang/coupangapi.md`

### 9.5 GitHub 레포 (AIBIO 코드)
- `BiocomKR/aibio-frontend` · `BiocomKR/aibio-backend`
- 현재 로컬 `gh` 계정(`taejunjeon`)은 조직 멤버십 없음 → 초대 수락 필요

---

## 10. 다음 작업 후보

1. ✅ **AIBIO → 로컬 SQLite sync 구현** (2026-04-24 완료)
   - `aibio_customers`, `aibio_payments` 테이블 추가
   - `POST /api/aibio/sync-customers`, `/sync-payments`, `/sync-all` 라우트
2. ✅ **커피 Toss 정산 조인** (2026-04-24 완료) — `backend/scripts/coffee-rebuild.cjs`, `unified-tier-v2.cjs`
3. ✅ **`coffeevip.md` 금액대 재조정** (2026-04-24 완료) — PRIME ₩10M / PLATINUM ₩5M / GOLD ₩2M / SILVER ₩1M / INITIATE ₩300K
4. ✅ **`.env` 변수명 오타 수정 + env.ts zod 스키마 확장** (AIBIO + 쿠팡 모두 완료)
5. **쿠팡 IP 허용 등록 + 실사용 sync 구현** — Wing 관리자에서 IP 해제 후 `coupangSync.ts` 구현 (진행 전)
6. **통합 뷰 영속화** — 현재는 `unified-tier-v2.cjs` 스크립트로 수동 실행. 주기 cron 및 결과 테이블 캐시 도입 검토
7. **aibio-backend 레포 clone 권한 획득** → Prisma schema로 정확한 FK·enum 확인
8. **아임웹-C `order_htel` 마스킹 89% 해소** 은 현재 경로 없음. 아임웹 자사몰 (thecleancoffee) 별도 회원 DB 확보 또는 Toss 결제자 정보 API 연계 검토

---

## 11. 참고 문서

- `aibio/aibiodb.md` — AIBIO Supabase 스키마 전체 덤프 (43 테이블)
- `aibio/aibio_revenue_reconciliation.md` — 대시보드 vs DB 매출 정합성 (B)
- `aibio/aibio_sync_design.md` — 로컬 sync 구현 설계 (C · 구현 완료 반영)
- `coffee/coffeevip.md` — 통합 VIP 멤버십 전략 (금액대 실측 반영)
- `coffee/member.md` — 더클린커피 회원수 정합성 리포트
- `coupang/coupangapi.md` — 쿠팡 Wing Open API 가이드
- `backend/scripts/unified-tier-v2.cjs` — 3채널 통합 등급 산정 실행 스크립트
- `backend/scripts/coffee-rebuild.cjs` — 커피 고객별 매출 재집계 (Toss↔PlayAuto)
