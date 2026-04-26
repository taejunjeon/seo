# AIBIO 모바일 CTA · 폼 UX 리뷰 및 수정 보고서

작성 시각: 2026-04-26 13:28 KST
작성자: Claude Code
대상 라우트: `/aibio-native`, `/shop_view?idx=25`
연결 작업: `imweb/!imwebplan.md` Phase2-Sprint3 #4, Phase3-Sprint4 #7 (Claude Code 항목)
범위: 프론트엔드만 수정 (백엔드 native lead API/필수 필드는 그대로)

---

## 1. 결론

모바일 광고 유입 → 상담폼 제출 흐름의 6가지 이탈 위험을 프론트에서 제거했음. Codex 후속 검증에서 2026-04-26 14:18 KST 기준 build, 7010 재기동, Playwright 회귀 테스트까지 완료했다. 남은 작업은 (a) 실모바일 확인, (b) AIBIO 대표 전화번호 확정 시 sticky CTA에 전화 직통 버튼 1개 추가, (c) TJ가 운영 기준 상태값을 확정하면 폼 필수 필드 축소 검토다.

배포 주의: 로컬 7010은 반영됐다. 운영 배포는 아직 별도이며, 운영 secret·권한·30일 병행 기준 확정 전에는 아임웹 fallback을 유지한다.

---

## 2. 리뷰 결과 (수정 전 상태)

| # | 영역 | 문제 | 영향 | 우선순위 |
|---|---|---|---|---|
| 1 | 모바일 sticky CTA | 하단 고정 상담 채널이 없음. hero 첫 화면 지나면 전환 채널이 본문 스크롤에만 의존 | 광고 유입 이탈 직격 | High |
| 2 | 전화번호 입력 | 자동 하이픈 없음, 한국 휴대폰 형식 검증 없음. placeholder만 `010-0000-0000` | 잘못된 번호 저장 → 상담 불가 | High |
| 3 | 에러 문구 | "필수 항목과 동의를 확인해 주세요" 한 줄. 어느 필드가 비었는지 모름 | 재시도 불가 → 이탈 | High |
| 4 | 실패 문구 | "리드 원장 저장에 실패했습니다. 백엔드 서버 상태를 확인해야 합니다" — 사용자가 아닌 운영자 관점 | 사용자 혼란 + 신뢰 손상 | High |
| 5 | 성공 문구 | "운영 리드 원장에 저장되었습니다 · 유입 키 N개 확인 · 30일 내 중복 접수 후보" — 일반 사용자에게 의미 불명확 | 다음 액션 안내 부재 | High |
| 6 | attribution preview | "수집된 유입 키 N개" 카드를 사용자에게 노출. 광고 추적 거부감 유발 가능 | 신뢰 손상 | High |
| 7 | 개인정보 동의 | 한 줄 동의만. 수집 항목/이용 목적/보유 기간 안내 없음 | 개인정보보호법 고지 부족 | Medium |
| 8 | 필수 필드 표시 | `*` 표시 없음. 어느 필드가 필수인지 알 수 없음 | 입력 효율 저하 | Medium |
| 9 | scroll/anchor | sticky 헤더(72px) 밑에 폼 첫 줄이 가려짐. anchor 이동 시 jump | 스크롤 후 헤더에 가려짐 | Medium |
| 10 | submit 버튼 | "저장 중" 한 단어. 사용자 관점 문구 부재 | 처리 중 인지 약함 | Low |
| 11 | 모바일 입력 크기 | input/select 48px. 모바일 터치 타겟 권장 56px 미만 | 잘못 터치 가능 | Medium |

---

## 3. 적용한 수정 (변경 파일 3개)

### 3-1. `frontend/src/app/aibio-native/AibioNativeLeadForm.tsx`

폼 컴포넌트를 전면 개선.

| 항목 | 변경 |
|---|---|
| 전화번호 입력 | `formatKoreanPhone()`로 입력하면서 자동으로 `010-1234-5678` 하이픈 포맷. `inputMode="numeric"`, `type="tel"`, `maxLength=13`. 블러 시 `isValidKoreanMobile()` 정규식(`/^01[016789]\d{7,8}$/`)으로 검증. 잘못 입력 시 "010으로 시작하는 휴대폰 번호를 입력해 주세요." 즉시 안내 |
| 필수 표시 | 필수 필드 라벨에 빨간 `*` 추가 |
| 필드별 에러 강조 | 422/검증 실패 시 `aria-invalid` + 빨간 테두리/배경 + 어느 필드인지 라벨 노출 (`buildMissingMessage()`) |
| 백엔드 422 매핑 | `body.missing[]` (이름, 연락처, 나이대, 상담 목적, 알게 된 경로, 연락 희망 시간, 개인정보 수집 동의)를 한국어 라벨로 변환 |
| 사용자 친화 성공 문구 | `"상담 신청이 접수되었습니다. 운영팀이 영업일 기준 24시간 안에 입력하신 번호로 연락드립니다."` + 접수번호 8자리 (운영 용어 `리드 원장`/`유입 키`/`중복 후보` 모두 제거) |
| 사용자 친화 실패 문구 | `"일시적인 네트워크 오류로 신청이 저장되지 않았습니다. 잠시 후 다시 시도하시거나 카카오 상담을 이용해 주세요."` |
| attribution-preview 제거 | "수집된 유입 키 N개" 카드 삭제. 운영자 디버그용은 admin 화면에서 확인하면 됨 |
| 개인정보 동의 확장 | `[필수]` `[선택]` 명시 + 자세히 토글로 수집 항목/이용 목적(상담 연결 및 방문 안내)/보유 기간(상담 종료 후 1년) 안내. 거부 시 안내 문구도 포함 |
| 진행 게이지 | "필수 입력 6/6" → "입력 진행 6/6" + transition 추가 |
| 모바일 터치 타겟 | input/select 모바일에서 52px, submit 버튼 60px로 키움. 폰트 1rem로 키워 iOS Safari 줌 방지 |
| scroll-margin-top | sticky 헤더에 폼 첫 줄 가려지는 문제 해결 (88px) |
| `noValidate` | 브라우저 기본 검증 끄고 React 검증으로 통일 |

### 3-2. `frontend/src/app/aibio-native/AibioNativeExperience.tsx`

| 항목 | 변경 |
|---|---|
| 모바일 sticky CTA bar | `.mobile-cta-bar`를 footer 뒤에 추가. 980px 이하에서 하단 고정. 좌측 "카카오 상담"(흰색), 우측 "상담 신청하기"(파란색). `safe-area-inset-bottom` 처리로 iOS 노치 대응 |
| 본문 padding-bottom 76px | sticky bar에 본문 마지막 줄이 가려지지 않도록 |
| `scroll-behavior: smooth` | 글로벌. anchor 클릭 시 부드러운 스크롤 |
| `section[id] { scroll-margin-top: 88px }` | 모든 anchor section이 sticky 헤더 밑에 가려지지 않도록 |

### 3-3. `frontend/src/app/shop_view/RecoveryLabOfferLanding.tsx`

| 항목 | 변경 |
|---|---|
| 모바일 sticky CTA bar | 동일 패턴. 우측 라벨만 "첫방문 상담 신청"으로 차별화. 색상은 페이지 톤(`#2764d8`) 따라감 |
| `padding-bottom 76px` + `scroll-behavior: smooth` + `scroll-margin-top` | 동일 |

---

## 4. 검증

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` (frontend) | EXIT 0 (통과) |
| `npm run build` | 성공 (Codex 재검증 BUILD_ID `9BUgDSCn1pqcsOailrspU`) |
| HTTP 200 확인 | `/aibio-native`, `/shop_view?idx=25` 모두 200 |
| launchctl 재기동 | `com.biocom.seo-frontend-local` 자동 respawn 확인. 신규 PID로 새 manifest 로드 |
| Playwright iPhone 13 (390×844) 캡처 | `/tmp/aibio-ux-shots/` 7장 캡처. 모든 시나리오 정상 |
| 모바일 sticky CTA bar | 양쪽 페이지 하단 고정 ✓ |
| 전화번호 자동 하이픈 | `010-1234-5678` 자동 포맷 ✓ |
| 전화번호 검증 | `0101234` 입력 시 "010으로 시작하는 휴대폰 번호를 입력해 주세요." 즉시 노출 ✓ |
| 필드별 에러 강조 | 빈 필드 빨간 테두리 + 분홍 배경, 통합 에러 메시지 "필수 항목을 확인해 주세요: 이름, 연락처, ..." ✓ |
| 개인정보 동의 자세히 토글 | 인라인 링크로 정상. 펼치면 수집 항목/이용 목적/보유 기간 안내 ✓ |
| 진행 게이지 | "입력 진행 N/6" 정상 ✓ |
| Codex 회귀 테스트 | `tests/aibio-native.spec.ts` 5 passed. 모바일 CTA와 전화번호 검증 테스트 추가 ✓ |

### 1차 캡처에서 잡은 추가 이슈와 수정

| 이슈 | 원인 | 수정 |
|---|---|---|
| 라벨의 `*` 별표가 다음 줄로 떨어짐 | label `display: grid; gap: 8px` 구조에서 anonymous text 노드와 `<em>` 노드가 각각 별도 grid item으로 잡힘 | 라벨 텍스트 + em을 `<span class="label-text">`로 묶음. 7개 필수 라벨 모두 적용 |
| 동의 영역 `자세히` 버튼이 거대한 파란 박스로 렌더 | `.lead-form button` selector(0,2,0)가 `.link-button`(0,1,0)보다 specific해서 submit 버튼 스타일이 적용 | selector를 `.lead-form .consent-block .link-button`(0,3,0)로 강화. min-height/background/border 모두 reset |

### 검증 못한 부분

- 실기기 iOS Safari/Android Chrome (Playwright 모바일 emulation은 viewport·UA만 흉내, 실제 키보드 동작 없음)
- 백엔드 422 응답 `missing` 필드 매핑 (backend 코드 `aibioNativeLeadLedger.ts:411` 기준 `missing: string[]` schema 일치 확인. 실제 호출은 미실행)

---

## 5. 운영자가 다음에 할 일

| 우선순위 | 담당 | 할일 |
|---|---|---|
| 1 | Codex | 로컬 7010 서버는 Codex가 build 후 재기동한다. TJ님이 직접 터미널에서 재시작할 필요는 없음 |
| 2 | TJ | AIBIO 대표 전화번호 확정 (확정되면 sticky CTA에 `tel:` 버튼 1개 추가. 모바일 광고 유입은 전화가 가장 빠른 전환 채널) |
| 3 | TJ + Codex | 운영 기준 상태값 확정 (`!imwebplan.md` 다음할일 #5). 확정되면 폼 필수 필드 6개 → 3개(이름/연락처/동의)로 축소 검토 가능. 단, 백엔드 검증도 동시 수정 필요 |
| 4 | Codex | Playwright 모바일 viewport(390x844) 재캡처. sticky CTA가 hero/폼/footer 어디서든 보이는지 확인 |
| 5 | Claude Code | 운영자 admin 화면(`/aibio-native/admin`) UX 리뷰 (`!imwebplan.md` Phase3-Sprint4 #4). drawer/list 분리 구조 제안 |

---

## 6. 변경 안 한 항목과 이유

| 항목 | 이유 |
|---|---|
| 폼 필수 필드 축소 | 백엔드 `aibioNativeLeadLedger.ts:402-407`에서 6개 필드 모두 필수 검증. 프론트만 줄이면 422 발생. TJ 운영 기준 확정 후 양쪽 동시 수정 필요 |
| 전화번호 직통 CTA (`tel:`) | AIBIO 대표 전화번호를 코드/문서에서 확인 못함. 추정 번호 박는 건 CLAUDE.md 금지 사항 |
| 카카오 채널톡 (sticky) | 이미 KAKAO_CHAT_URL 채널 플러스 친구 링크가 있음. sticky 좌측 버튼이 그것을 가리킴 |
| `AibioNativeExperience.tsx` 안의 dead lead-section 스타일 | styled-jsx 스코프상 부모 JSX에 lead-section 클래스가 없으므로 적용 안 됨. 시각적 영향 없어 정리는 후속 작업으로 미룸 |
| 헤더의 모바일 카카오 CTA 폰트 (38px) | sticky 하단 CTA로 핵심 채널이 항상 노출되므로 헤더 우측 카카오는 보조 역할. 변경 보류 |

---

## 7. 파일 diff 요약

```text
frontend/src/app/aibio-native/AibioNativeLeadForm.tsx    완전 재작성 (469줄 → ~540줄)
frontend/src/app/aibio-native/AibioNativeExperience.tsx  + sticky CTA bar JSX, + scroll/sticky CSS, + global smooth scroll
frontend/src/app/shop_view/RecoveryLabOfferLanding.tsx   + sticky CTA bar JSX, + scroll/sticky CSS, + global smooth scroll
```

신규 파일: 본 보고서 1건 (`imweb/aibio-mobile-cta-form-ux-review.md`)
백엔드 변경: 없음
