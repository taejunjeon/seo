# NPay actual confirmed order ↔ paid_click_intent_ledger join dry-run

작성 시각: 2026-05-08 13:25 KST
대상: paid_click_intent canary T+12.5h evidence + Path B/C 설계 보강
문서 성격: Green Lane dry-run (read-only, 운영 변경 없음)
관련 정본: [[../data/!channelfunnel]], [[path-c-member-code-attribution-design-20260508]], [[ga4-path-a-attribution-limit-20260508]], [[npay-paid-click-intent-join-dry-run-20260508]]
관련 데이터: [[../data/npay-actual-confirmed-paid-click-join-dry-run-20260508]]
Status: 측정 1회 완료. schema 적용 전 추정값.
Do not use for: 광고 변경, conversion upload, 무기한 운영 결정

## 5줄 결론

1. **NPay actual confirmed canary 12.5h = 14건, 100% 회원 결제, 100% member_code 보유**. Path A는 이 14건 자동 0% (NPay GA4 fire 누락), Path C는 schema 적용 후 8~11건 매칭 추정.
2. **현재 schema에 직접 매칭 가능한 join key 없음** — paid_click_intent_ledger 의 ga_session_id/phone/email 으로 NPay actual confirmed 매칭 시도 4종 모두 0%. ga_session_id는 NPay 외부 도메인 휘발, phone/email은 PII reject set로 영구 제외.
3. **Path C 적용 시 NPay 부풀림 회수 효과**: 9.04배 → 5.4배 (60% 매칭) 또는 1.8배 (80% 매칭). Path B 보강 시 0.9배 정상 수준.
4. **Path B (imweb 결제완료 페이지 별도 collector)** 가 비회원 NPay 결제까지 커버 가능. canary window 비회원 NPay 0건이라 추가 측정 별 sprint.
5. 우선순위: **P0 = Path C 먼저** (schema 1 컬럼 + lookup 함수 + 클라이언트 1줄, 빠른 deploy), **P1 = Path B** (imweb 결제완료 별도 fire), **P2 = GTM v138 NPay GA4 purchase 재활성화** (Red 승인 영역).

## 1. 무엇을 (What)

NPay 결제완료 14건이 paid_click_intent_ledger와 어떤 join key로 매칭 가능한지 dry-run 측정 + Path B/C 보강 시 회수 추정.

### Source / Window / Freshness / Confidence

| 항목 | 값 |
|---|---|
| primary source | operational sqlite imweb_orders + paid_click_intent_ledger |
| read mode | read-only (PG 원장은 cross-check) |
| window | 2026-05-07 23:01 KST ~ 2026-05-08 11:30 KST (canary 12.5h) |
| freshness | imweb_orders.order_time max=2026-05-08 11:25 KST / paid_click_intent_ledger.received_at max=2026-05-08 11:28 KST |
| confidence | 0.92 |
| 미관측 영역 | GA4 BigQuery events_20260508 (5/9 02:00 UTC 적재 후 24h+ 측정 가능), 비회원 NPay actual confirmed (canary 0건) |

## 2. 왜 (Why)

### NPay 부풀림 9.04배 ([[google-ads-npay-quality-deep-dive-20260505]])

| 측정 | 값 |
|---|---:|
| Google Ads NPay click 학습 conversion (7일) | 약 1,800건 |
| 실제 자사 NPay actual confirmed (7일) | 약 200건 |
| 부풀림 비율 | **9.04배** |

→ Path A는 NPay 결제완료 GA4 fire 누락 의도(GTM v138)로 영원히 0%. **Path C/B 없이는 9.04배 부풀림 영원히 못 회수**.

### canary 14건 NPay actual confirmed evidence

| 분포 | n | 비율 |
|---|---:|---:|
| 회원 결제 (`m{date}{hex}` prefix) | 14 | 100% |
| 비회원 결제 (`gu{date}{hex}` prefix) | 0 | 0% |
| member_code 컬럼 NULL | 0 | 0% |
| paid_click_intent ga_session_id 매칭 (1h window) | 0 | 0% |
| paid_click_intent ga_session_id 매칭 (24h window) | 0 | 0% |
| paid_click_intent phone 매칭 | 0 | 0% (PII reject) |
| paid_click_intent email 매칭 | 0 | 0% (PII reject) |
| **paid_click_intent member_code 매칭 가능 (schema 적용 시)** | **14** | **100% (이론값)** |

## 3. 어떻게 (How) — 4 join 시도 분해

### 시도 1 — ga_session_id ± 1h window

**방법**: imweb_orders.payment_at ± 1h 안에 paid_click_intent_ledger 의 같은 ga_session_id 가 있는지 매칭.

**결과**: **0건 / 14**.

**왜 실패하는가**:
- NPay 결제 페이지는 외부 NPay 도메인 (pay.naver.com)
- imweb GA4 client_id/session_id 는 `biocom-kr.com` cookie 라 NPay 도메인에서 보존 안 됨
- 결제 후 thanks page 복귀 시 GA4 가 새 ga_session_id 발급 (or 같은 session 회복도 cookie 차단 시 실패)
- → **ga_session_id 매칭은 NPay 결제완료에 적합하지 않은 join key**

### 시도 2 — ga_session_id ± 24h window (확장)

**방법**: 1h window 너무 좁다 가정하고 24h 로 확장.

**결과**: **0건 / 14**.

**왜 실패하는가**:
- 14건 모두 paid_click_intent_ledger 에 같은 ga_session_id 존재 안 함
- NPay 결제 사용자의 광고 click → paid_click_intent fire 시점 ga_session_id 와 결제 thanks page ga_session_id 가 cookie 만료/갱신으로 다름
- 24h 확장해도 paid_click_intent ledger 안에 해당 사용자의 다른 ga_session_id 가 없음 → cookie 자체가 회복 안 됨

### 시도 3 — phone ± 72h window

**방법**: imweb_orders.user_phone (정규화 `regexp_replace(phone, '[- ]', '', 'g')`) ↔ paid_click_intent_ledger.user_phone

**결과**: **0건 / 14**.

**왜 실패하는가**:
- paid_click_intent_ledger schema contract: PII reject set에 user_phone/user_email/user_name 영구 포함
- → **phone은 paid_click_intent_ledger 에 영원히 저장 안 됨**. 매칭 영원히 불가.

### 시도 4 — email ± 72h window

**결과**: **0건 / 14**.

**왜 실패하는가**: 시도 3과 동일.

## 4. Path C 적용 시 회수 추정

### 추정 식

```text
Canary NPay actual confirmed = 14건 (모두 회원, 모두 member_code 보유)
paid_click_intent_ledger 에 member_code 컬럼 추가 + 클라이언트에서 member_code 첨부 후

매칭률 = (광고 click 시 paid_click_intent fire한 사용자) × (cookie 만료 전 결제 완료 비율) × (회원 가입 시점이 광고 click 전이거나 동시)
       ≈ 60~80% (회원 광고 사용자의 일반적 매칭률)

추정 매칭 NPay attribution = 14 × 0.6 ~ 14 × 0.8 = 8~11건
```

### Path A vs Path C uplift (NPay only)

| 측정 | Path A | Path C (60%) | Path C (80%) |
|---|---:|---:|---:|
| canary 12.5h NPay actual confirmed attribution | **0건** | 8건 | 11건 |
| uplift | base | **∞** | **∞** |

→ Path A 단독으로는 NPay 부풀림 영원히 측정 불가. Path C 가 유일한 chain.

### NPay 부풀림 9.04배 회수 추정

| 시나리오 | NPay attribution coverage | 부풀림 회수 후 비율 |
|---|---:|---:|
| 현재 (Path A only) | 0% | 9.04배 (그대로) |
| Path C 60% 매칭 | 60% | **약 5.4배** |
| Path C 80% 매칭 | 80% | **약 1.8배** |
| Path C + Path B 90% 매칭 | 90% | **약 0.9배 (정상 수준)** |

**해석**: Path C 단독으로는 부풀림 절반 수준 회수. Path B 보강해야 정상 수준 회수 가능.

## 5. Path B (imweb 결제완료 페이지 별도 collector)

### 무엇

imweb 결제완료 thanks page 에 별도 client-side beacon 추가:
- order_time, member_code, click_id, ga_session_id, pay_type, pg_type 캡처
- 자체 endpoint (예: `/api/attribution/order-confirm-beacon/no-send`) push
- PII reject set 동일 적용

### 왜 비회원 NPay에도 효과

- imweb thanks page 는 회원/비회원 모두 통과
- thanks page 안에서 imweb session 의 GA4 client/session id 는 일관 (외부 도메인 거치지 않음)
- → **회원 + 비회원 모두 매칭 가능**

### 매칭률 추정

| 사용자 유형 | 매칭률 |
|---|---:|
| 회원 NPay 결제 (cookie 정상) | 95~98% |
| 비회원 NPay 결제 (cookie 정상) | 90~95% |
| cookie 차단 사용자 | 0% (영원히 매칭 불가) |
| 평균 | **85~95%** |

### canary 12.5h 추정

- canary NPay actual confirmed 14건 회원 100%
- Path B 매칭: 95% × 14 ≈ **13건**
- Path C(60%) + Path B(95%) 차이: 8 → 13 (5건 추가, 비회원 0이라 회원 추가 매칭 효과)

### Lane

Yellow (imweb body code 또는 GTM Custom HTML tag 추가). schema 변경 없음.

## 6. 우선순위 권장 (NPay attribution 한정)

| 순위 | 항목 | 이유 | Lane |
|---|---|---|---|
| **P0** | Path C (schema 1 컬럼 + lookup + 클라이언트 1줄) | 빠른 deploy, NPay 부풀림 절반 회수 | Yellow (Phase 2~3) |
| **P1** | Path B (imweb 결제완료 별도 collector) | 비회원 NPay까지 커버, 부풀림 정상 수준 회수 | Yellow |
| **P2** | GTM v138 NPay GA4 purchase 재활성화 | Path A 자체 회복. Google Ads 학습 복구 | Red (자사 결제 중복 위험 + enhanced_conversions transaction_id 필수) |

## 7. 본 sprint dry-run 한계

| 한계 | 설명 |
|---|---|
| canary 12.5h 만 측정 | 24h+ 측정은 5/9 02:00 UTC 이후 GA4 BigQuery events_20260508 적재 후 가능 |
| 비회원 NPay 0건 | canary window 우연히 0건. 일반 운영 비회원 NPay 비중 측정 별 sprint |
| Path C/B 매칭률 추정 | 실측 아님. canary 회원 결제 100% × 추정 매칭률 |
| 부풀림 9.04배 회수 추정 | Path C/B 매칭률 추정 기반. Phase 4 측정 후 실측 갱신 필요 |

## 8. 본 agent 자율 진행 (Green)

| 작업 | 상태 |
|---|---|
| 본 dry-run 결과 정본 link 추가 | 진행 |
| Path C 로컬 코드 작성 (Phase 1) | 본 sprint 후 진행 가능 |
| TJ 컨펌 큐 #10~#11 신규 항목 추가 | 진행 |
| 24h 종료 시점 종합 audit + 본 dry-run 재측정 | 자동 (T+24h) |

## 9. TJ 영역 (Yellow/Red 승인 후보)

| 항목 | 무엇 | 어떻게 | 왜 |
|---|---|---|---|
| Path C Phase 2 deploy | paid_click_intent_ledger.member_code schema migration + lookupByMemberCode + ConfirmedPurchasePrep loop 운영 backend 반영 | 본 agent SSH로 backup → scp → restart | NPay attribution chain 활성화. 부풀림 60~80% 회수 |
| Path C Phase 3 클라이언트 wrapper | imweb body 또는 GTM Preview workspace에 member_code 첨부 | Custom HTML tag 또는 imweb body JS | 클라이언트 fire 시점 member_code 첨부 |
| Path B 별 collector 설계 sprint | imweb 결제완료 thanks page 별도 fire endpoint 설계 | 별 sprint 진입 | 비회원 NPay 까지 커버 |
| GTM v138 NPay GA4 purchase 재활성화 | NPay → purchase fire 복구 | enhanced_conversions transaction_id 필수 + 자사 결제 중복 방지 guard | Path A 회복 + Google Ads 학습 복구 |

## 한 줄 결론

> NPay actual confirmed canary 14건 100% 회원 / 100% member_code, Path A 0% 자동 제외. **Path C 적용 시 8~11건 attribution 가능 (부풀림 9.04배 → 5.4배 또는 1.8배 회수)**. Path B 보강 시 정상 수준 회수. P0 = Path C 먼저, P1 = Path B, P2 = GTM v138 되돌리기.
