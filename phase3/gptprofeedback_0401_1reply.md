# GPT Pro 피드백 #1 대응 결과 (2026-04-01)

> **원본 피드백**: `phase3/gptprofeedback_0401_1.md`
> **작업자**: Claude Code + Codex
> **작업일**: 2026-04-01

---

## 최상단 요약표: 피드백 항목별 반영 결과

| # | 피드백 항목 | 반영 | 결과 | 이유 |
|---|-----------|------|------|------|
| 1 | 문서 source of truth 정리 (P3-S4 60% vs 0% 충돌) | **성공** | roadmap0327.md를 유일한 source of truth로 통일. Phase3.md도 60%로 통일 완료 | 문서 수정으로 즉시 해결 가능 |
| 2 | Messaging 탭을 발송 워크플로우로 재설계 | **성공** | 4-step 워크플로우(대상→템플릿→미리보기→발송), 2-column 레이아웃, 소스 타입(수동/후속관리/실험) 선택 | 프론트 코드 전체 재작성 |
| 3 | exact-match preview를 핵심 기능으로 승격 | **일부** | UI에 미리보기 영역 + "exact-match 검증 미구현" 표시 추가. Codex에게 `POST /api/aligo/render-preview` API 위임 (백그라운드 진행 중) | 백엔드 API가 필요하여 Codex 위임. UI 자리는 확보됨 |
| 4 | CRM 탭 URL 동기화 (MEDIUM→HIGH) | **성공** | `useState` → `useSearchParams` 기반으로 변경. `/crm?tab=messaging` 딥링크, 뒤로가기, 공유 링크 모두 동작 | Next.js useSearchParams로 즉시 구현 |
| 5 | P3-S2 실제 고객 사이트 live baseline | **확인 완료** | biocom.kr에 ChannelTalk SDK가 **이미 풀 연동**되어 있음을 확인. 아임웹 자체 래퍼가 전자상거래 이벤트 8종(SignUp~CheckoutComplete)을 추적 중 | 추가 삽입 불필요. 남은 것은 memberHash 활성화만 |
| 6 | 후속관리 탭: 추천 액션에 채널/우선순위 추가 | **일부** | ACTION_LABELS에 권장 채널(알림톡/전화 우선/채널톡) 배지 추가. 우선순위 점수/blocked reason/deadline은 미구현 | 우선순위 점수와 blocked reason은 백엔드 consultation API 확장 필요 |
| 7 | 후속관리 탭: 에러 박스 축약 | **미반영** | 에러 박스 UX 개선은 이번 턴에서 미진행 | 영향도 대비 복잡도가 낮아 후순위 |
| 8 | 실험 운영 탭: Revenue Bridge 접이식 | **성공** | `<details>/<summary>` 기반 접이식으로 변경. "개발자 진단용" 라벨 추가. 기본 접힘 상태 | HTML details 요소로 즉시 구현 |
| 9 | 실험 운영 탭: variant 이름 한글화 | **미반영** | variant 이름은 실험 생성 시 사용자가 입력하는 값이므로, 프론트에서 일괄 번역하면 오히려 혼란 | 실험 생성 폼에서 한글 이름 입력을 유도하는 방향이 맞음 |
| 10 | 실험 운영 탭: 통계적 해석 경고 배지 | **미반영** | 표본 크기 기반 유의성 판정 로직이 백엔드에 없음. 프론트 단독으로 임계값 판단 어려움 | 백엔드에 통계 검정 로직(p-value 또는 최소 표본 크기 경고) 추가 필요 |
| 11 | 실험 운영 탭: 메시지 로그 0건 경고 | **미반영** | message log 경고는 crm_message_log 테이블과 연동 필요 | 로컬 SQLite의 message_log 상태를 프론트에 노출하는 API 필요 |
| 12 | 결제 귀속 탭: 한줄 blocker headline | **성공** | 최상단에 "오늘 blocker: live payment_success 0건 → receiver 연결 필요" 빨간 배너 추가 | 조건부 렌더링으로 즉시 구현 |
| 13 | 결제 귀속 탭: 0 vs N/A 구분 | **미반영** | GA4 권한 문제와 실제 0의 구분은 백엔드 응답 구조 변경 필요 | 현재 API가 0과 unavailable을 같은 값으로 반환 |
| 14 | 결제 귀속 탭: 해석 규칙 박스 접이식 | **미반영** | 이번 턴에서 미진행 | Revenue Bridge 접이식과 합쳐서 다음 턴에 처리 가능 |
| 15 | 결제 귀속 탭: severity 중심 정렬 | **미반영** | 날짜별 비교표를 severity 기준으로 재정렬하려면 정렬 로직 + severity 판정 규칙 필요 | 다음 턴에 구현 가능하나 우선순위 낮음 |
| 16 | Messaging 탭: desktop 2-column | **성공** | 좌측(대상+템플릿) / 우측(미리보기+발송) 2-column grid 레이아웃 | MessagingTab 전체 재작성에 포함 |
| 17 | Messaging 탭: hard gate UI 표시 | **일부** | 발송 Step 4에 화이트리스트/잔여포인트/템플릿선택/연동상태 gate 배지 표시. consent/quiet hours/cooldown은 백엔드에서 이 프로젝트(SEO)에 구현되지 않음 (Revenue 프로젝트의 contact_policy_service) | SEO 백엔드에는 contact policy gate 로직 없음 |
| 18 | P1-S1A live row 1건 | **미반영** | 운영 작업. 실제 고객 사이트에 receiver 스크립트를 연결해야 함 | 코드 범위 밖 (운영/인프라) |

**요약**: 18개 항목 중 **성공 6개 + 확인 완료 1개**, **일부 3개**, **미반영 8개**

---

## 반영 성공 (6건) 상세

### 1. 문서 source of truth 정리
- `roadmap0327.md`: P3-S4 = 60%로 통일
- `Phase3.md`: 동일하게 60% 명시
- 충돌 해소 완료

### 2. Messaging 탭 발송 워크플로우 재설계
**파일**: `frontend/src/app/crm/MessagingTab.tsx` 전체 재작성

변경 전: 템플릿 목록이 화면 대부분 차지, single-column
변경 후:
- **4-step 워크플로우**: 대상 선택 → 템플릿 → 미리보기 → 발송
- **Step Indicator**: 진행 상태 바
- **소스 타입 선택**: 수동 테스트 / 후속 관리 대상(예정) / 실험 대상(예정)
- **2-column 레이아웃**: 좌측(대상+템플릿) / 우측(미리보기+발송)
- **템플릿 검색**: 이름/코드 기반 필터
- **Gate 상태 표시**: 화이트리스트/포인트/템플릿/연동 상태 배지
- **단계별 "다음" 버튼**: 조건 충족 시에만 활성화

### 4. CRM 탭 URL 동기화
**파일**: `frontend/src/app/crm/page.tsx`

- `useState` → `useSearchParams` + `useRouter`
- `/crm?tab=messaging` 딥링크 동작
- 탭 전환 시 `router.replace` → 뒤로가기 정상 동작
- AI CRM 포털 카드 링크를 `/crm?tab=messaging`으로 변경

### 8. Revenue Bridge 접이식
**파일**: `frontend/src/app/crm/page.tsx`

- `<details>/<summary>` 기반 접이식
- 라벨: "Revenue Bridge 상태 (개발자 진단용)"
- 기본 접힘 상태 → 클릭 시 펼침
- 새로고침 버튼은 summary 안에 유지

### 12. 결제 귀속 blocker headline
**파일**: `frontend/src/app/crm/page.tsx`

- live payment_success가 0이면: 빨간 배너 "오늘 blocker: live 0건 → receiver 연결 필요"
- live가 1건 이상이면: 초록 배너 "live N건 수집 중 (replay M건)"

### 16. Messaging 2-column desktop
- `display: grid; gridTemplateColumns: 1fr 1fr` 적용
- 좌측: 대상 선택 + 템플릿 리스트
- 우측: 미리보기 + 발송 컨트롤

---

## 일부 반영 (3건) 상세

### 3. exact-match preview
- **UI**: 미리보기 영역에 "exact-match 검증: 미구현" 노란 배너 표시. 향후 API 연동 시 pass/fail 표시로 교체
- **백엔드**: Codex에게 `POST /api/aligo/render-preview` API 위임 (백그라운드 진행 중)
- **남은 것**: API 완성 후 프론트 연동

### 6. 후속관리 탭 채널 배지
- **구현**: ACTION_LABELS에 `channel` 필드 추가 (구매유도=알림톡, 재연락=전화 우선, 후속확인=채널톡)
- **남은 것**: 우선순위 점수, blocked reason, deadline 컬럼은 백엔드 API 확장 필요

### 17. hard gate UI
- **구현**: 발송 Step 4에 4가지 gate 배지 (화이트리스트/포인트/템플릿/연동)
- **남은 것**: consent/quiet hours/cooldown/suppression은 Revenue 프로젝트의 contact_policy_service에만 있고, SEO 백엔드에는 없음

---

## [추가 확인] ChannelTalk SDK live 상태 — 이미 풀 연동되어 있음

GPT 피드백에서 "P3-S2 live baseline이 최우선"이라고 했는데, 확인 결과 **biocom.kr에 ChannelTalk SDK가 이미 완전히 live 연동되어 있다**.

### 확인된 연동 상태

| 항목 | 상태 | 상세 |
|------|------|------|
| SDK 스크립트 | **설치됨** | `cdn.channel.io/plugin/ch-plugin-web.js` (아임웹 내장) |
| Plugin Key | **설정됨** | `0b565f40-174d-4598-a002-640d84699db5` |
| Boot | **동작 중** | `language: "ko"`, `updateUserProfile: true` |
| 채널 ID | **129149** | 채널명: 바이오컴 |
| Open API 연결 | **정상** | accessKey + accessSecret 확보, probe 성공 |
| Member Hash | **미활성** | 아직 사용 안 함 (익명 boot) |

### 이미 추적 중인 이벤트 (아임웹 래퍼 `channel_plugin.js`)

| 이벤트 | 트리거 시점 | 데이터 |
|--------|-----------|--------|
| `SignUp` | 회원가입 완료 | — |
| `SurveySubmit` | 입력폼 응답 | — |
| `ProductView` | 상품 상세 페이지 | `{ id }` |
| `AddToCart` | 장바구니 추가 | `{ id, currency, itemCount, itemPrice }` |
| `AddToWish` | 위시리스트 추가 | — |
| `ReviewSubmit` | 리뷰 작성 완료 | — |
| `CheckoutBegin` | 주문서 작성 진입 | `{ order_no }` |
| `CheckoutComplete` | 결제 완료 | `{ totalPrice, currency, totalQuantity, products[] }` |

### 사용자 프로필 자동 업데이트

아임웹의 `channel_plugin.js`가 boot 시 `/ajax/get_user_profile.cm`으로 사용자 프로필을 가져와 ChannelTalk에 동기화한다. 장바구니 추가 시 `cartCount`, `cartAmount`를 실시간 업데이트하고, 주문 완료 시 주문 데이터도 갱신한다.

### 결론

- **P3-S2 "실제 고객 사이트 live 삽입"은 이미 완료된 상태**. GPT 피드백에서 우려한 blocker가 실제로는 존재하지 않는다.
- SDK 래퍼가 아임웹 자체적으로 전자상거래 이벤트를 모두 추적하고 있으므로, 우리가 별도로 SDK를 삽입할 필요가 없다.
- **남은 것은 Member Hash 활성화** (memberId 기반 식별) — 현재는 익명 boot이므로, 로그인 사용자를 CRM customer_key와 연결하려면 memberHash를 활성화해야 한다.

### 채널톡 관리자에서 확인 가능한 것

채널톡 관리자(`app.channel.io`) 접속은 브라우저 인증이 필요하므로 CLI에서 직접 접근은 불가하다. 하지만 Open API를 통해 확인한 결과:

- 채널 ID `129149`, 채널명 `바이오컴` — 정상
- accessKey + accessSecret 인증 — 정상
- memberHash — 채널 설정에서 비활성 상태 (`memberHashEnabledOnChannel: false`)

관리자 화면(`app.channel.io`)에서 직접 확인할 수 있는 것:
- **유저 목록**: 방문자/회원 프로필, 마지막 방문, 이벤트 이력
- **이벤트 로그**: ProductView, AddToCart, CheckoutComplete 등 실제 수집된 이벤트
- **캠페인**: 인앱 메시지, 푸시, 이메일 캠페인 설정 및 성과
- **설정 > 보안**: Member Hash 활성화 옵션

---

## 미반영 (8건으로 축소) 이유 요약

| 항목                  | 이유                      | 해결 방법                             |
| ------------------- | ----------------------- | --------------------------------- |
| variant 이름 한글화      | 사용자 입력값이므로 프론트 번역 부적절   | 실험 생성 시 한글 이름 입력 유도               |
| 통계 경고 배지            | 백엔드에 통계 검정 로직 없음        | 백엔드 API에 표본 크기 경고 추가              |
| 메시지 로그 경고           | message_log 상태 API 없음   | 로컬 SQLite stats에 message count 포함 |
| 0 vs N/A 구분         | API 응답 구조 변경 필요         | 백엔드에서 unavailable과 0을 구분하여 반환     |
| 해석 규칙 접이식           | 낮은 우선순위                 | 다음 턴에 details/summary로 처리         |
| severity 정렬         | severity 판정 규칙 정의 필요    | 다음 턴에 구현 가능                       |
| 에러 박스 축약            | 낮은 우선순위                 | 다음 턴에 축약형 배너로 교체                  |
| P1-S1A live row     | 운영 작업 (고객 사이트 receiver) | 실제 사이트에 스크립트 연결                   |

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/app/crm/page.tsx` | useSearchParams 탭 URL 동기화, Revenue Bridge 접이식, 결제 귀속 blocker headline, 후속관리 채널 배지, MessagingTab import |
| `frontend/src/app/crm/MessagingTab.tsx` | **전체 재작성** — 4-step 워크플로우, 2-column, gate 배지, 템플릿 검색 |
| `frontend/src/app/page.tsx` | 알림톡 발송 카드 링크 `/crm?tab=messaging` |
| `backend/src/aligo.ts` | Codex: `renderAligoPreview()` 함수 추가 (진행 중) |
| `backend/src/routes/aligo.ts` | Codex: `POST /api/aligo/render-preview` 추가 (진행 중) |

---

## 다음 할 일 (우선순위순)

### 1순위 — 운영 (코드 아님)
- [ ] biocom.kr에 ChannelTalk SDK live 삽입
- [ ] 실제 고객 사이트에 payment_success receiver 연결

### 2순위 — 백엔드
- [ ] exact-match preview API 완성 후 프론트 연동
- [ ] consultation API에 우선순위 점수 / blocked reason 추가
- [ ] 통계 검정 로직 (최소 표본 경고) 추가

### 3순위 — 프론트
- [ ] exact-match preview API 연동 → pass/fail 표시
- [ ] 후속관리 → 알림톡 발송 세그먼트 연동
- [ ] 에러 박스 축약형 + 재시도 버튼
- [ ] 해석 규칙 접이식
