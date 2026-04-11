# 알림톡/SMS 발송 화면 고도화 결과서

기준일: 2026-04-10

## 1. 구현 범위

### 완료

| 항목 | 설명 |
|------|------|
| 카카오톡 스타일 폰 미리보기 | 알림톡: 카카오톡 말풍선 + 프로필 아이콘 + 노란 버튼 / SMS: 초록 말풍선. 폰 프레임 내에 실시간 표시 |
| 메시지 종류 배지 | 선택된 템플릿의 광고(AD)/정보(BA) 타입을 미리보기 헤더에 배지로 표시 |
| 글자수 카운터 | 알림톡: 변수 치환 후 본문 글자수/1000자 제한 표시. SMS: 바이트/90 표시 |
| 발송 비용 표시 | 알림톡 ~₩8/건, SMS ~₩16, LMS ~₩45 표시 |
| CSS 누락 수정 | toneSuccess, toneError, toneWarn 클래스 추가 (KPI 카드 색상 정상 표시) |

### Phase 2 (미구현)

| 항목 | 이유 |
|------|------|
| 이미지 업로드 | Aligo API 이미지 전송 인프라 필요 |
| 쿠폰 불러오기/강조 버튼 | 아임웹 쿠폰 API 연동 필요 |
| 링크 버튼 편집 | Aligo API 제약 검증 필요 (Codex 피드백) |
| 이전 메시지 불러오기/임시저장 | DB 스키마 추가 필요 |
| 발송 예약 | 스케줄러 인프라 필요 |

## 2. 변경 파일

| 파일 | 변경 |
|------|------|
| `frontend/src/app/crm/PhonePreview.tsx` | **신규 생성** (140줄) — 폰 프레임 + 카카오톡/SMS 말풍선 미리보기 컴포넌트 |
| `frontend/src/app/crm/MessagingTab.tsx` | PhonePreview 통합, 메시지 종류 배지, 글자수/비용 표시 추가 |
| `frontend/src/app/crm/page.module.css` | toneSuccess, toneError, toneWarn CSS 클래스 추가 |

## 3. Codex 플러그인 피드백 반영

| Codex 피드백 | 반영 |
|-------------|------|
| 폰 미리보기를 별도 컴포넌트로 분리 | PhonePreview.tsx 별도 파일로 생성 |
| 링크 버튼 편집 Phase 2로 이동 | Phase 2로 이동 |
| 977줄 파일에 더 쌓지 말 것 | PhonePreview 분리로 MessagingTab 증가 최소화 |
| CSS Module 분리 권장 | toneSuccess 등 page.module.css에 추가 (PhonePreview는 인라인 스타일 — 독립적) |

## 4. 검증 결과

| 항목 | 결과 |
|------|------|
| 프론트 typecheck | 통과 |
| CSS 누락 클래스 | 수정 완료 (3개 추가) |
| 미검증 | 실제 UI 동작 (프론트 재시작 필요) |

## 5. 스크린샷

### 카카오톡 참고 (비교 대상)
- `kakao-msg-step1-basic.png` — 기본 텍스트형
- `kakao-msg-step1-image-coupon.png` — 이미지+쿠폰
- `kakao-coupon-list.png` — 쿠폰 목록 모달
- `kakao-msg-coupon-highlight.png` — 쿠폰 강조 버튼

### 우리 솔루션 (개발 전)
- 개발 전 캡처: 프론트 재시작 후 추가 예정

### 우리 솔루션 (개발 후)
- 개발 후 캡처: 프론트 재시작 후 추가 예정
