# 더클린커피 재구매 관리 — 구현 계획

> **기준일**: 2026-04-04
> **위치**: Phase 3 확장 (P3-S5)
> **담당**: Codex (백엔드/설계) + Claude Code (프론트/UXUI)

---

## 왜 Phase 3인가

Phase 3는 "실행 채널 연동"이고, 재구매 관리는 **"대상 선별 → consent 확인 → 발송 → 기록"** 흐름이다.
이미 Phase 3에서 알림톡/SMS/consent/contact policy가 모두 닫혔으므로, 그 위에 "재구매 미실시 고객" 세그먼트만 얹으면 된다.

---

## 현재 확보된 자산

| 자산 | 상태 | 위치 |
|------|------|------|
| 아임웹 주문 데이터 sync | ✅ 가동 중 | `POST /api/crm-local/imweb/sync-orders` → SQLite `imweb_orders` |
| 아임웹 회원 데이터 sync | ✅ 83,017명 | `imweb_members` 테이블 (site별 분리) |
| SMS 동의 상태 | ✅ 자동 조회 | `marketing_agree_sms` 필드 |
| Contact policy 평가 | ✅ 8규칙 | `POST /api/contact-policy/evaluate` |
| 알림톡 발송 | ✅ live 검증 완료 | `POST /api/aligo/send` |
| 발송 로그 | ✅ 방금 구현 | `logs/aligo-sends.jsonl` |
| Toss 결제 데이터 | ✅ API 가동 | `GET /api/toss/daily-summary` |
| 재구매 코호트 (운영 DB) | ✅ 30,546명 | `ltr_customer_cohort` (바이오컴 중심) |

### 더클린커피 전용으로 없는 것

| 없는 것 | 왜 필요한가 |
|---------|-----------|
| **커피 전용 재구매 후보 API** | `imweb_orders`에서 site=thecleancoffee, 첫 구매 후 N일 미재구매 고객 추출 |
| **세그먼트 기반 대상 목록 API** | 후보 리스트를 프론트에서 미리보기 + consent 일괄 확인 |
| **일괄 contact policy 평가** | 현재 1명씩만 평가 가능 → 후보 50명이면 50번 호출 |
| **재구매 관리 프론트 UI** | CRM `/crm?site=thecleancoffee&tab=repurchase` |

---

## 구현 계획

### Codex 담당 (백엔드/설계)

#### P3-S5-B1: 재구매 후보 추출 API

```
GET /api/crm-local/repurchase-candidates
  ?site=thecleancoffee
  &minDaysSinceLastPurchase=30    (마지막 구매 후 최소 N일)
  &maxDaysSinceLastPurchase=180   (너무 오래된 고객 제외)
  &minPurchaseCount=1             (최소 구매 횟수)
  &limit=50
```

**응답 설계:**
```json
{
  "ok": true,
  "site": "thecleancoffee",
  "count": 42,
  "items": [
    {
      "memberCode": "M123",
      "name": "김철수",
      "phone": "01012345678",
      "email": "kim@example.com",
      "totalOrders": 3,
      "totalSpent": 89000,
      "firstOrderDate": "2025-11-15",
      "lastOrderDate": "2026-02-20",
      "daysSinceLastPurchase": 43,
      "avgOrderAmount": 29667,
      "consentSms": "Y",
      "consentEmail": "Y"
    }
  ]
}
```

**구현 방식:**
- `imweb_orders` 테이블에서 site=thecleancoffee 주문을 집계
- `imweb_members` 테이블과 JOIN하여 consent 상태 포함
- 마지막 주문일 기준으로 N일 이상 미구매 고객 필터
- 최근 발송 기록(`aligo-sends.jsonl`)과 대조하여 cooldown 표시

**선행 조건:**
- `imweb_orders`에 더클린커피 주문이 sync 돼 있어야 함
- 현재 sync 상태 확인 필요 (`POST /api/crm-local/imweb/sync-orders` 실행 여부)

---

#### P3-S5-B2: 일괄 contact policy 평가 API

```
POST /api/contact-policy/evaluate-batch
  Body: {
    "channel": "aligo",
    "phones": ["01012345678", "01098765432", ...]
  }
```

**응답 설계:**
```json
{
  "ok": true,
  "total": 42,
  "eligible": 28,
  "blocked": 14,
  "results": [
    {
      "phone": "01012345678",
      "eligible": true,
      "consentSource": "imweb_members_auto",
      "blockedReasons": []
    },
    {
      "phone": "01098765432",
      "eligible": false,
      "blockedReasons": ["consent_missing", "cooldown_24h"]
    }
  ]
}
```

**구현 방식:**
- 기존 `evaluateContactPolicy()` 함수를 루프 호출
- imweb_members 일괄 조회로 consent 미리 로드 (N+1 방지)

---

#### P3-S5-B3: 재구매 알림톡 템플릿 등록

- 더클린커피용 정보성 알림톡 템플릿 1개 설계
- 예시: "#{고객명}님, 지난번 주문하신 커피가 맛있으셨나요? 새로운 원두가 입고되었습니다."
- 카카오 검수 요청 (`POST /api/aligo/template/request-review`)

---

### Claude Code 담당 (프론트/UXUI)

#### P3-S5-F1: 재구매 관리 탭 UI

현재 `tab=repurchase`에 "준비 중" 표시 → 아래 구조로 교체:

```
┌──────────────────────────────────────────────────┐
│  재구매 관리                                       │
│  첫 구매 후 재구매하지 않은 고객을 찾아 관리한다         │
│                                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ 재구매 후보   │ │ 발송 가능    │ │ 평균 미구매   │ │
│  │ 42명        │ │ 28명        │ │ 47일         │ │
│  │ 30~180일 조건 │ │ consent ✅  │ │ 마지막 구매후  │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ │
│                                                    │
│  ┌─ 필터 ────────────────────────────────────────┐ │
│  │ 미구매 기간: [30일 ▼] ~ [180일 ▼]  최소 구매: [1 ▼] │ │
│  └────────────────────────────────────────────────┘ │
│                                                    │
│  ┌─ 후보 테이블 ─────────────────────────────────┐ │
│  │ ☑ 고객명  │ 연락처    │ 구매횟수 │ 마지막구매 │ 미구매일 │ 동의 │ │
│  │ ☑ 김철수  │ 010-1234 │ 3건    │ 02-20   │ 43일  │ ✅  │ │
│  │ ☑ 이영희  │ 010-5678 │ 1건    │ 01-15   │ 79일  │ ✅  │ │
│  │ ☐ 박민수  │ 010-9012 │ 2건    │ 03-01   │ 34일  │ ❌  │ │
│  └────────────────────────────────────────────────┘ │
│                                                    │
│  [선택한 28명에게 알림톡 발송 →]                       │
│   ↓ 클릭하면 알림톡 탭으로 이동 (대상자 전달)            │
│                                                    │
└──────────────────────────────────────────────────┘
```

**구현 내용:**
1. `GET /api/crm-local/repurchase-candidates?site=thecleancoffee` 호출
2. KPI 카드 3개: 재구매 후보 수, 발송 가능 수, 평균 미구매일
3. 필터 컨트롤: 미구매 기간 범위, 최소 구매 횟수
4. 후보 테이블: 체크박스 선택, consent 상태 배지
5. "선택 대상에게 알림톡 발송" 버튼 → 알림톡 탭으로 이동 (선택된 대상 전달)

#### P3-S5-F2: 알림톡 탭 일괄 발송 연결

- 재구매 탭에서 선택한 대상 → MessagingTab에 `source=repurchase`로 전달
- 현재 MessagingTab의 "후속 관리 대상" 드롭다운(`followup` 예정 표시) → `repurchase` 소스 추가
- 선택된 대상 목록 미리보기 + 일괄 발송 (1명씩 루프 또는 향후 batch API)

---

## 실행 순서

```
1단계: 데이터 확보 (Codex)
├── imweb_orders 더클린커피 sync 확인/실행
├── P3-S5-B1: 재구매 후보 API 구현
└── P3-S5-B2: 일괄 policy 평가 API 구현

2단계: 프론트 UI (Claude Code)
├── P3-S5-F1: 재구매 관리 탭 UI (후보 테이블 + 필터 + KPI)
└── P3-S5-F2: 알림톡 탭 연결

3단계: 운영 준비 (Codex + TJ)
├── P3-S5-B3: 더클린커피용 알림톡 템플릿 등록 + 카카오 검수
└── 첫 발송 테스트 (화이트리스트 → 소규모 → 확대)
```

---

## 의존 관계

```
imweb_orders sync ──→ P3-S5-B1 (후보 API) ──→ P3-S5-F1 (프론트)
                                                    ↓
imweb_members ──→ P3-S5-B2 (batch policy) ──→ P3-S5-F2 (발송 연결)
                                                    ↓
                  P3-S5-B3 (템플릿 등록) ──→ 첫 운영 발송
```

---

## roadmap 반영 제안

`roadmap/phase3.md` 스프린트 테이블에 추가:

| Sprint | 목표 | 담당 | 완료 |
|--------|------|------|------|
| **P3-S5** | 더클린커피 재구매 관리 — 후보 추출 + 일괄 평가 + 프론트 UI | Codex(B) + Claude Code(F) | 0% |

---

## 완료 기준

- [ ] `GET /api/crm-local/repurchase-candidates?site=thecleancoffee` 가 후보 목록 반환
- [ ] `POST /api/contact-policy/evaluate-batch`가 일괄 consent/policy 평가 반환
- [ ] `/crm?site=thecleancoffee&tab=repurchase`에서 후보 테이블이 실데이터로 표시
- [ ] 후보 선택 → 알림톡 탭으로 대상 전달이 동작
- [ ] 더클린커피용 알림톡 템플릿 1개 카카오 승인
