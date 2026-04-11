# 고객 그룹 관리 + 대량 발송 시스템 계획서

기준일: 2026-04-11

## 1. 현재 문제

1. A/B 실험 생성 후 **대상 그룹 전체에 발송**하는 흐름이 없다 — 수신자 1명만 선택 가능
2. 화이트리스트가 1명(테스트번호)뿐 — 실험 대상자를 화이트리스트에 추가하는 기능 없음
3. 발송 이력 관리 화면 없음

## 2. 카카오톡 비즈메시지 참고 화면 (스크린샷)

| 화면 | 파일 | 핵심 기능 |
|------|------|---------|
| 메시지 타겟 설정 | `kakao-step2-target.png` | 전체/그룹타겟/인구통계 선택, 예상 발송 대상 수 |
| 친구그룹 타겟팅 | `kakao-group-targeting.png` | 그룹 선택/제외 드롭다운 |
| 친구그룹 목록 | `kakao-group-list.png` | 그룹명, 친구수/등록수, 상태, 선택 삭제 |
| 신규그룹 만들기 | `kakao-group-create.png` | 그룹명, 설명, 등록수단(고객파일/직접입력/업로드) |
| 고객파일 목록 | `kakao-customer-file.png` | 파일 ID, 파일명, 친구수/등록수, 상태 |
| 메시지 목록 | `kakao-message-list.png` | 메시지 유형, 내용, 발송수, 상태, 필터 |

## 3. 구현 범위

### Phase 1 — 이번 구현 (고객 그룹 + 그룹 발송 + 메시지 이력)

#### 3-1. 고객 그룹 관리

**DB 스키마** (`crm_customer_groups` + `crm_customer_group_members`):
```sql
crm_customer_groups (
  group_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  member_count INTEGER DEFAULT 0,
  registered_count INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
)

crm_customer_group_members (
  group_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  member_code TEXT,
  added_at TEXT,
  UNIQUE(group_id, phone)
)
```

**API**:
- `GET /api/crm-local/groups` — 그룹 목록
- `POST /api/crm-local/groups` — 그룹 생성 (이름, 설명)
- `DELETE /api/crm-local/groups/:id` — 그룹 삭제
- `GET /api/crm-local/groups/:id/members` — 그룹 멤버 목록
- `POST /api/crm-local/groups/:id/members` — 멤버 추가 (전화번호 배열)
- `POST /api/crm-local/groups/:id/members/from-experiment` — A/B 실험 그룹에서 가져오기
- `DELETE /api/crm-local/groups/:id/members` — 멤버 제거

**프론트엔드**: CRM 허브에 "고객 그룹" 탭 추가
- 그룹 목록 테이블 (카카오 친구그룹 목록과 동일한 형태)
- 신규 그룹 만들기 모달 (그룹명, 설명, 전화번호 직접 입력)
- A/B 실험에서 자동 그룹 생성 (실험 생성 시 각 variant를 그룹으로 자동 등록)

#### 3-2. 그룹 기반 대량 발송

**현재 문제**: MessagingTab이 단건 발송만 지원
**해결**: Step 1에 "대상 선택" 방식 추가

대상 선택 방식:
- 수동 입력 (기존 — 1명)
- **그룹 선택** (신규 — 그룹 멤버 전체)

그룹 선택 시:
- 그룹 드롭다운 표시 (멤버 수 포함)
- "총 예상 발송 대상: N명" 표시
- Step 4에서 배치 발송 실행 (순차 발송 + 진행 표시)

**배치 발송 백엔드**:
- `POST /api/aligo/batch-send` — 그룹 기반 배치 발송
  - 입력: groupId, tplCode (알림톡) 또는 message (SMS), channel
  - 처리: 그룹 멤버 순회 → 건별 발송 → 결과 집계
  - throttle: 건당 300ms
  - 응답: { total, success, failed, results[] }

#### 3-3. 메시지 이력

**프론트엔드**: CRM 허브에 "메시지 이력" 서브탭 또는 섹션 추가
- 기존 `aligo-sends.jsonl` + `crm_message_log` 데이터 표시
- 컬럼: 발송일시, 채널, 수신자, 고객번호, 상태, 메시지 내용 요약
- 필터: 채널, 날짜, 상태

**API**:
- `GET /api/crm-local/message-log` — 메시지 이력 조회 (페이지네이션)

## 4. A/B 실험 → 그룹 자동 연동 흐름

```
1. A/B 실험 생성 (동의 vs 미동의)
2. 자동으로 두 그룹 생성:
   - "실험-{key}-동의고객" (273명)
   - "실험-{key}-미동의고객" (593명)
3. 실험 생성 완료 → "메시지 작성으로 이동"
4. 대상 선택에서 해당 그룹 자동 선택
5. 메시지 작성 → 미리보기 → 배치 발송
```

## 5. 파일 변경 예상

| 파일 | 변경 |
|------|------|
| `backend/src/crmLocalDb.ts` | 그룹 테이블 스키마 + CRUD 함수 |
| `backend/src/routes/crmLocal.ts` | 그룹 API 6개 엔드포인트 |
| `backend/src/routes/aligo.ts` | 배치 발송 API |
| `frontend/src/app/crm/page.tsx` | 고객 그룹 탭 UI |
| `frontend/src/app/crm/MessagingTab.tsx` | 그룹 선택 + 배치 발송 UI |

## 6. 구현 순서

1. DB 스키마 + 그룹 CRUD API
2. A/B 실험 생성 시 자동 그룹 생성
3. 프론트엔드 고객 그룹 탭
4. MessagingTab 그룹 선택 모드
5. 배치 발송 API + UI
6. 메시지 이력 조회
