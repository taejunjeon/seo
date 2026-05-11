# 액션 1 — 매출 join 시도 결과 (gpt0508-45 follow-up)

작성 시각: 2026-05-11 19:00 KST
실행 mode: read-only (운영DB read + 로컬 SQLite read)
**결론: 현 schema 로 매출 join 0건 매칭** — 다음 sprint 의 schema 확장 필요.

## 1. 이번에 가능해진 것

광고 유입 (paid_search 68 / paid_social 12 등) 이 실제 결제 매출로 이어졌는지 확인하려고 **3 가지 join 경로를 시도**했고, 모두 0건 매칭이 나오는 정확한 이유가 밝혀졌다.

## 2. 왜 필요했는지

L2 attribution ladder 의 핵심 — 단순히 광고 유입을 잡는 것 (L1) 만으로는 광고비 정합성 판단 불가. 매출과 연결돼야 ROI 측정 가능.

## 3. 어떻게 작동하는지 (비개발자용)

3 가지 매칭 방법을 모두 시도:

1. **세션 키 기반 매칭** — 사이트 방문 세션 ID 가 결제 신호 장부 (order_bridge_ledger) 에 같은 값으로 있는지.
2. **광고 클릭 ID 매칭** — 광고 클릭 ID 의 단방향 해시 값으로 매칭.
3. **주문 코드 URL 추출** — 결제 페이지 URL 안 `order_code=o2026...` 를 꺼내 단방향 해시 변환 후 운영DB 주문번호와 매칭.

## 4. 실제로 확인된 결과 (모두 0건 매칭)

| 방법 | 비교 row | 매칭 | 실패 이유 |
|---|---:|---:|---|
| 세션 키 매칭 | 116 + 10 | 0 | 두 장부의 시간대가 다름. 결제 신호 장부 (order_bridge_ledger) 마지막 row 는 deploy 전 (canary 시점), 유입 장부 (site_landing_ledger) 는 deploy 후만. fan-out 으로 새 row 가 결제 신호 장부에는 안 들어가고 있음. |
| 광고 클릭 ID 매칭 | 92 + 1 | 0 | 동일 |
| 주문 코드 매칭 | 30 unique × 2,676 운영DB 풀 | 0 | **결정적 이유**: 운영DB 주문번호 (`202605117572683`, 15자리 숫자) 와 imweb URL 주문 코드 (`o202605117efbbbeb34166`, 1자 prefix + 8자리 날짜 + 13자리 hex) **는 완전히 다른 식별자 체계**. 운영DB raw_data JSON 안에도 order_code 가 없음. |

## 5. 진정한 매출 join 경로 (다음 sprint 후보)

| # | 방법 | 작업량 |
|---|---|---|
| A | site_landing 에 `order_no_hash` 컬럼 추가 + payment-success fan-out 시 운영DB order_number HMAC 변환 후 저장 | Schema migration + fan-out 수정 |
| B | 운영DB 의 다른 테이블 (예: tb_iamweb_orders, tb_imweb_payment_log) 에서 order_code ↔ order_number 매핑 존재 확인 | read-only audit 1회 |
| C | backend AttributionLedgerEntry 의 `orderId` 가 fan-out 시점에 site_landing 에 같이 저장되도록 schema 확장 | A 와 거의 동일 |

**권고: B 먼저 (1 query 로 가능) → 매핑 발견 시 A 또는 C 채택.**

## 6. 아직 안 된 것

- 운영DB 의 imweb_orders / playauto_orders 등 다른 테이블 audit (B 경로).
- site_landing schema 의 order_no_hash 컬럼 추가 (A/C 경로).

## 7. 다음 액션

| Owner | Action | Claude Code 가능? | 데이터 충분 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 운영DB 다른 테이블 audit (B 경로) — order_code ↔ order_number 매핑 존재 검색 | YES — read-only 단발 query | 80 | 90 | 90 | 5 | **87** | **진행 (즉시 또는 다음 sprint)** |
| Claude Code | site_landing.order_no_hash 컬럼 추가 schema migration + fan-out 수정 | YES — code + deploy 가능 | 75 | 70 | 95 | 25 | 75 | 보류 (B 결과 본 후 결정) |

산출 JSON: `data/site-landing-revenue-join-attempt-20260511.json`
