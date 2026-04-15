# CRM 고객 그룹 · 발송 · 고객 관리 고도화 계획서

기준일: 2026-04-12

## 0. 즉시 수정해야 할 버그

### 버그 1: A/B 실험 → 그룹 생성 시 고객 정보 누락

**원인**: `createGroupFromExperiment()`가 `crm_assignment_log.customer_key`(전화번호)만 가져오고, `imweb_members`와 조인하지 않음.
**결과**: 그룹 멤버에 이름, 고객번호, SMS 동의 여부가 모두 빈 값.
**수정**: `imweb_members` LEFT JOIN으로 name, member_code(=callnum 기반), marketing_agree_sms 가져오기.

### 버그 2: 그룹에서 발송 탭 이동 시 그룹이 안 뜸

**원인**: MessagingTab이 `groupId` URL 파라미터로 그룹 멤버를 로드하지만, A/B 실험 생성 후 이동 시 groupId 대신 첫 번째 고객 1명만 전달됨.
**수정**: 실험 생성 후 이동 시 `groupId`를 URL에 포함.

## 1. 이번 구현 범위

### Phase 1 — 즉시 (버그 수정 + 핵심 개선)

| # | 항목 | 참고 이미지 |
|---|------|----------|
| 1 | 그룹 생성 시 고객 정보(이름, 고객번호, 동의) 정상 전달 | 이미지 24 |
| 2 | 실험 생성 → 발송 이동 시 groupId 전달 | 이미지 25 |
| 3 | 그룹 멤버 체크박스 선택 → 선택된 멤버만 발송 | 이미지 26 (친구그룹 상세) |
| 4 | 그룹 상세 페이지 (기본정보 + 멤버 목록 + 체크박스 + 페이지네이션) | 이미지 26, 27 |

### Phase 2 — 이번 주 (고객 관리 기반)

| # | 항목 | 참고 이미지 |
|---|------|----------|
| 5 | 고객 목록 탭 (imweb_members 기반, 검색, 그룹 사이드바, 엑셀 다운로드) | 이미지 31 |
| 6 | 고객 행동 관리 (행동 조건 기반 그룹 자동 생성) | 이미지 32, 33, 34, 35 |
| 7 | 아임웹 쇼핑 등급 연동 (`GET /member-info/grades` — API 확인 완료, `member_grade` 컬럼 존재) | 이미지 30 |

### Phase 3 — 다음 주 (발송 고도화)

| # | 항목 | 참고 이미지 |
|---|------|----------|
| 8 | 알림톡 만들기: 타겟 그룹 선택 + 엑셀 업로드 + 쿠폰 대상 | 이미지 29, 30 |
| 9 | 캠페인 성과 퍼널 (발송→성공→유입→구매 전환율) | 이미지 28 |
| 10 | 메시지 목록 (발송 이력 상세, 필터, 페이지네이션) | 이미지 22 |

## 2. 아임웹 API 확인 결과

| 항목 | API | 상태 |
|------|-----|------|
| 쇼핑 등급 목록 | `GET /member-info/grades` | **사용 가능** |
| 회원별 등급 변경 | `PUT /member-info/members/{memberUid}/grade` | 사용 가능 |
| `member_grade` DB 컬럼 | `imweb_members.member_grade` | **이미 존재** |
| 고객 행동 관리 가이드 | `https://imweb.me/faq?mode=view&category=29&category2=47&idx=72140` | **접근 가능** |

## 2-1. Codex 플러그인 피드백 (0412)

1. **정규화 phone JOIN 신뢰성 낮음**: `imweb_members.callnum`에 유니크 제약 없고, 중복 2,879건, 매칭 실패 976건 존재. `assignment_log`에 `member_code`도 저장하는 것이 안전.
2. **부분 그룹 발송**: 선택 멤버를 URL params로 넘기지 말고 `sessionStorage` 또는 서버 임시 선택으로 보관할 것.
3. **CustomerGroupsTab 분리**: `page.tsx` 2,976줄 → `CustomerGroupsTab.tsx` 별도 파일로 추출할 것.
4. **고객 행동 관리**: 동적 SQL 대신 사전 정의 세그먼트(재구매 지연, 생일월, 등급, 구매 횟수 등) allowlist 방식 사용.

## 3. 파일 변경 예상

| 파일 | 변경 |
|------|------|
| `backend/src/crmLocalDb.ts` | `createGroupFromExperiment` 수정 (imweb_members JOIN), 고객 목록/행동 쿼리 추가 |
| `backend/src/routes/crmLocal.ts` | 고객 목록/행동 API |
| `frontend/src/app/crm/page.tsx` | 그룹 상세 개선, 체크박스 선택, 고객 목록 탭, 고객 행동 탭 |
| `frontend/src/app/crm/MessagingTab.tsx` | 그룹 선택 멤버 부분 발송 |
