# 고객번호(member_code) 필드 조사 결과

기준일: 2026-04-11

## 1. 결론

**`memberCode`는 이미 백엔드 데이터에 존재하지만, 프론트에 표시되지 않고 있다.**

| 항목 | 현재 상태 |
|------|----------|
| 백엔드 API 응답에 포함 | **O** (`RepurchaseCandidateRow.memberCode`) |
| DB에 저장됨 | **O** (`imweb_members.member_code` — PRIMARY KEY) |
| 프론트 타입에 정의됨 | **O** (`RepurchaseCandidate.memberCode`) |
| 테이블에 표시됨 | **X** (React `key`로만 사용, 컬럼 미표시) |
| 발송 로그에 기록됨 | **X** (전화번호만 기록됨) |

즉, 테이블에 고객번호 컬럼을 추가하고, 발송 로그에 member_code를 기록하면 "보냈는지/안보냈는지" 구분이 가능하다.

## 2. 아임웹 고객번호 체계

아임웹 API는 회원 식별자를 두 가지 제공한다:

| 필드 | 설명 | 현재 저장 | 사용 |
|------|------|----------|------|
| `member_code` | 아임웹 내부 회원 코드 | `imweb_members.member_code` (PK) | 주문-회원 조인, 모든 쿼리의 기준 키 |
| `uid` (memberUid) | 아임웹 v2 API용 고유 식별자 | `imweb_members.uid` | 미사용 (저장만 됨) |

### member_code 출처
- 회원 목록 API: `GET https://api.imweb.me/v2/member/members` → 각 회원 객체의 `member_code` 필드
- 주문 API: `GET /shop/orders` → `orderer.member_code` 필드
- 두 값이 동일하므로 주문-회원 조인이 가능

### 아임웹 관리자에서 보이는 "고객번호"와의 관계
- 아임웹 관리자 > 회원 관리에서 보이는 고객 식별번호가 `member_code`와 일치한다
- 따라서 우리 대시보드에 `member_code`를 표시하면, 아임웹 관리자에서 해당 고객을 바로 찾을 수 있다

## 3. 발송 추적 현황

### 현재 발송 로그 구조

**JSONL 파일** (`backend/logs/aligo-sends.jsonl`):
```json
{
  "timestamp": "...",
  "channel": "alimtalk",
  "receiver": "01012345678",   // 전화번호만
  "recvname": "홍길동",
  "tplCode": "...",
  "testMode": true,
  "consentStatus": "...",
  "daysSinceLastPurchase": 65,
  "ok": true,
  "mid": "..."
}
```

**문제: `member_code`가 없음** → 전화번호로만 매칭 가능 (정규화 필요, 동명이인/번호변경 리스크)

### SQLite `crm_message_log` 테이블
```sql
experiment_key TEXT,
customer_key TEXT NOT NULL,  -- member_code를 넣으면 됨
channel TEXT NOT NULL,
provider_status TEXT,
template_code TEXT,
sent_at TEXT
```
이 테이블에 `customer_key = member_code`로 기록하면 발송 이력 추적이 가능하다. 현재는 A/B 실험에서만 사용되고, 일반 발송에서는 사용하지 않고 있다.

## 4. 구현 방안

### 즉시 가능 (프론트만 수정)
1. 재구매 후보 테이블에 `고객번호` 컬럼 추가 — 데이터는 이미 API에서 내려오고 있음
2. 클릭 시 아임웹 관리자 회원 상세 링크 연결 가능

### 발송 추적 연동 (백엔드 수정 필요)
1. 알림톡/SMS 발송 시 `member_code`를 함께 전달
2. `crm_message_log`에 `customer_key = member_code`로 기록
3. 재구매 후보 조회 시 `crm_message_log` LEFT JOIN → "발송됨/미발송" 상태 표시

## 5. 관련 코드 위치

| 파일 | 위치 | 설명 |
|------|------|------|
| `backend/src/crmLocalDb.ts:1501` | `RepurchaseCandidateRow` 타입 | memberCode 필드 포함 |
| `backend/src/crmLocalDb.ts:1526` | SQL 쿼리 | `o.member_code AS member_code` |
| `backend/src/crmLocalDb.ts:149` | `imweb_members` 스키마 | `member_code TEXT PRIMARY KEY` |
| `frontend/src/app/crm/page.tsx:2152` | 프론트 타입 | `memberCode: string` |
| `frontend/src/app/crm/page.tsx:2297` | 테이블 렌더링 | `key={c.memberCode}` (표시 안 함) |
| `backend/src/routes/aligo.ts:192` | 발송 로그 | receiver(전화번호)만 기록 |
| `backend/src/crmLocalDb.ts:97` | `crm_message_log` 스키마 | customer_key 필드 있음 |
