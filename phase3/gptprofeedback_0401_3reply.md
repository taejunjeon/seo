# GPT Pro 피드백 #3 대응 결과 (2026-04-01)

> **원본 피드백**: `phase3/gptprofeedback_0401_3.md`
> **작업자**: Claude Code
> **최종 업데이트**: 2026-04-01

---

## 전체 요약표

피드백 #3의 3대 우선순위 + 피드백 #2 미해결 9건을 합산한 전체 현황.

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| **피드백 #3 우선순위** | | | |
| 1 | 알림톡: exact-match pass/fail | **완료** | render-preview API 호출 → PASS/FAIL 배지 |
| 2 | 알림톡: gate에 exact-match 추가 | **완료** | Step 4 gate 배지에 exact-match 항목 |
| 3 | 후속관리 → 알림톡 carry-over | **완료** | "알림톡" 버튼 → URL query로 phone/name 전달 |
| 4 | 실험: 로컬 검증 워터마크 | **완료** | 발송 0건 시 반투명 + 경고 배너 |
| 5 | 실험: 운영/결과 모드 분리 | **완료** | "운영 상태 | 실험 결과" 토글 + 운영 모드에서 결과 숨김 |
| **피드백 #2 미해결 → 해결** | | | |
| 6 | blocked reason 카드 | **완료** | contact policy 8규칙 TypeScript 이식 + 프론트 카드 |
| 7 | 최고관리자 강제 발송 | **완료** | adminOverride로 consent/claimReview 우회 |
| 8 | 실험 카드 운영 메타 | **완료** | `?meta=true` 백엔드 + 프론트 배지 (배정/전환/발송/동기화) |
| 9 | variant alias | **완료** | `variant_aliases` 컬럼 + PATCH API + 프론트 표시 |
| 10 | 표본 부족 경고 | **완료** | variant 최소 30명 미만 시 주황 배지 |
| 11 | 상단 pill 운영 용어화 | **완료** | 4개 pill 텍스트 정적 교체 |
| 12 | carry-over (탭 간 대상 전달) | **완료** | #3과 동일 |
| 13 | 탭 간 상태 전달 | **완료** | #3/#12와 동일 구조 |
| **아직 미완** | | | |
| 14 | 색 의미 단순화 | **미완** | Phase 3 기능 안정화 후 CSS 토큰 작업 |
| 15 | "오늘 할 일" 카드 나머지 3탭 | **완료** | 후속관리: "오늘 연락 대상 N명", 알림톡: "템플릿 N개, 대상 M명" |
| 16 | 운영/결과 모드 토글 UI | **완료** | "운영 상태 | 실험 결과" 2-state 토글. 운영 모드에서 결과 영역 숨김 |
| 17 | contact policy 실제 고객 데이터 연결 | **미완** | 아임웹 DB 스키마 확인 선행 필요 |

**요약**: 17개 항목 중 **완료 15개**, **미완 2개** (색 단순화 + contact policy 실데이터 연결).

---

## 반영 상세

### 1. exact-match pass/fail (알림톡 미리보기)

템플릿을 선택하면 자동으로 `POST /api/aligo/render-preview`를 호출한다.
- **PASS** (초록): "exact-match: PASS — 발송 가능"
- **FAIL** (빨강): "exact-match: FAIL — 템플릿 불일치" + 미치환 변수 목록

### 2. 발송 전 gate 배지

Step 4 gate: ✓화이트리스트 / ✓잔여포인트 / ✓템플릿선택 / ✓exact-match / ✓연동상태

### 3. 후속관리 → 알림톡 carry-over

후속관리 테이블 각 행에 보라색 "알림톡" 버튼. 클릭 시 `/crm?tab=messaging&phone=...&name=...` 전달. MessagingTab이 URL에서 읽어 수신자 자동 입력.

### 4. 실험 결과 워터마크

발송 0건일 때: 사선 무늬 주황 배너 "아래 수치는 로컬 검증 데이터입니다. 실제 발송이 0건이므로 운영 성과가 아닌 참고 수치입니다." + 결과 영역 반투명(0.5) + 클릭 비활성.

### 5. 운영/결과 모드 분리 — 완료

"운영 상태 | 실험 결과" 2-state 토글 버튼을 실험 탭 상단에 추가.
- **운영 상태 모드**(기본): 실험 카드(메타 배지), 동기화, 배정 테이블만 보임. 결과 차트/성과 표는 숨김.
- **실험 결과 모드**: 차트/성과 표 표시. 발송 0건이면 반투명 + 경고 배너 유지.

### 6. blocked reason 카드

Revenue Python 266줄 → SEO TypeScript 이식. `POST /api/contact-policy/evaluate`로 8규칙 판단. 프론트에서 자동 호출, 차단 사유 빨간 카드 표시.

### 7. 최고관리자 강제 발송

`adminOverride=true` 시 consent/claimReview 차단을 warn으로 변경 → eligible=true. 야간/쿨다운/빈도/구매 규칙은 admin이어도 우회 불가.

### 8. 실험 카드 운영 메타

`?meta=true`로 실험별 배정/전환/메시지/마지막동기화 집계. 프론트 카드에 파란(배정)/초록(전환)/빨강(발송0)/회색(동기화) 배지 표시. 로컬 SQLite만, 운영 DB 미접근.

### 9. variant alias

`variant_aliases` TEXT 컬럼(JSON) + `PATCH .../aliases` API. 프론트 성과 테이블과 차트에서 variant_key 옆에 보라색 alias 표시. 로컬 SQLite만, 운영 DB 미접근.

### 10. 표본 부족 경고

variant별 배정 최솟값 30명 미만 시: **"표본 부족 (variant 최소 N명) — 의사결정을 위한 수치 보완 권장"** 주황 배지. 발송 0건 워터마크와 별도로 동작.

### 11. 상단 pill 운영 용어화

| 이전 (개발자 용어) | 이후 (운영 용어) |
|-----------------|---------------|
| 상담 액션은 즉시 실행 | 후속 관리 대상에게 바로 연락 가능 |
| 실험 데이터는 로컬 SQLite 우선 | 실험 결과는 로컬 검증 모드 (실발송 전) |
| Revenue bridge는 참고용 | 결제 귀속 진단은 live 연결 후 확정 |
| PG 귀속은 live receiver row가 핵심 | 알림톡 발송은 화이트리스트 대상만 |

---

## 수신 동의 상태 — 현재 확인 불가

| 데이터 소스 | 수신 동의 정보 | 상태 |
|-----------|-------------|------|
| 아임웹 회원 DB (`tb_iamweb_users`) | **확인 필요** — 마케팅 동의 필드 존재 여부 스키마 확인 필요 | 첫 번째 확인 대상 |
| 채널톡 사용자 프로필 | **없음** — consent 필드 없음 | 불가 |
| 상담 DB | **없음** — 수신 동의 컬럼 없음 | 불가 |
| 알리고 | **없음** — 발신자 책임 | 불가 |
| 카카오 채널 | **간접 가능** — 친구 추가 = 수신 동의. 별도 API 필요 | 추후 |

수신 동의 데이터 확보 전까지는 화이트리스트 + 최고관리자 강제 발송으로 운영.

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `backend/src/contactPolicy.ts` | **신규**: 발송 정책 8규칙 + adminOverride |
| `backend/src/routes/channeltalk.ts` | contact-policy contract/evaluate 추가 |
| `backend/src/crmLocalDb.ts` | variant_aliases 컬럼, listExperimentsWithMeta, updateVariantAliases |
| `backend/src/routes/crmLocal.ts` | ?meta=true 집계, PATCH .../aliases |
| `frontend/src/app/crm/MessagingTab.tsx` | render-preview, exact-match gate, carry-over, contact policy, blocked reason, adminOverride |
| `frontend/src/app/crm/page.tsx` | setTab extra, 알림톡 버튼, 실험 반투명+워터마크, 카드 메타 배지, variant alias, 표본 경고, pill 교체 |
| `frontend/src/hooks/useCrmLocalData.ts` | ?meta=true 호출, 메타/alias 타입 |

---

## 아직 미완 — 왜, 어떻게 할 것인지

### 14. 색 의미 단순화

**왜**: 민트/보라/파랑/초록이 동시에 나와서 시각적 의미가 흐리다. 기능 개발이 계속 진행 중이라 CSS를 지금 바꾸면 merge 충돌이 잦다.
**어떻게**: Phase 3 기능 안정화(P3-S4 80%+) 후 디자인 토큰 확정 → 인라인 색상을 CSS 변수로 일괄 교체. 반나절 작업. roadmap0327.md에 추후 작업으로 기재됨.

### 17. contact policy 실제 고객 데이터 연결

**왜**: 현재 blocked reason이 기본값(consent=unknown)으로 평가되어 모든 고객이 차단으로 나온다. 실제 고객 정보(마지막 구매일, 마지막 상담일, 최근 메시지 수)를 넣어야 의미 있는 결과가 나온다.
**어떻게**:
1. 아임웹 DB(`tb_iamweb_users`) 스키마에서 마케팅 동의 필드 확인 (TJ가 확인)
2. `GET /api/consultation/candidates`의 고객 데이터를 contact policy evaluate에 전달하는 백엔드 연결
3. 수신 동의 데이터가 없는 동안은 최고관리자 강제 발송으로 운영
