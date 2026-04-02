# ChannelTalk SDK v1 프론트엔드 연동 — 완료 보고

작업일: 2026-03-27
작업자: Claude Code

---

## 1. 읽은 파일 및 현재 제약 요약

### 읽은 파일
- `roadmap0327.md` — Revenue CRM 로드맵, ChannelTalk v1 실행 레이어 우선 전략
- `api.md` — ChannelTalk API 키 상태 확인, Plugin Key 기반 SDK boot 가능 확인
- `gptprofeedback_0327_3.md` — 채널톡은 "미니 Braze" 역할, 내부 DB가 측정 원장
- `backend/src/channeltalk.ts` — 백엔드 ChannelTalk 인증/해시/probe 이미 완료
- `frontend/src/app/layout.tsx` — Root Layout (Server Component)
- `frontend/src/app/page.tsx` — 단일 페이지 탭 기반 SPA (8개 탭)
- ChannelTalk 공식 SDK 문서 (boot, setPage, track, updateUser API 확인)

### 현재 제약
- `CHANNELTALK_PLUGIN_KEY` 필요 (채널 설정 > 버튼 설치 및 설정에서 확인)
- Member Hash는 **비활성 상태** (`enableMemberHash=false`)
- Member Hash를 지금 켜면 memberId/memberHash 없는 고객에게 버튼 미노출 위험
- 따라서 **Plugin Key 기반 anonymous boot만** 수행

---

## 2. 수정/생성 파일 및 변경 내용

### 새로 생성한 파일

#### `frontend/src/lib/channeltalk.ts`
- ChannelTalk SDK 래퍼 모듈
- 포함 함수:
  - `boot(options)` — Plugin Key 기반 SDK 초기화, memberId/memberHash 확장 포인트 포함
  - `shutdown()` — SDK 종료 및 버튼 제거
  - `setPage(page)` — 현재 페이지 설정 (SPA route/탭 전환 시)
  - `track(eventName, properties?)` — 커스텀 이벤트 트래킹 래퍼
  - `updateUser(data, callback?)` — 사용자 프로필 업데이트 래퍼
  - `showMessenger()` / `hideMessenger()` — 메신저 표시/숨기기
  - `isBooted()` — boot 상태 확인
  - `resolvePageName(pathname)` — pathname → 페이지명 변환
  - `resolveTabPageName(tabLabel)` — 탭 라벨(한글) → 페이지명 변환
- 중복 boot 방지 (`booted` 플래그)
- SDK 로드 실패 시 모든 함수가 조용히 실패 (앱 동작에 영향 없음)
- `window.ChannelIO` 타입 선언 포함

#### `frontend/src/components/common/ChannelTalkProvider.tsx`
- 클라이언트 전용 컴포넌트 (`"use client"`)
- `NEXT_PUBLIC_CHANNELTALK_PLUGIN_KEY` env에서 Plugin Key 읽기
- 마운트 시 한 번 boot, 언마운트 시 shutdown
- `usePathname()` 기반 route 변경 시 자동 setPage 호출
- Plugin Key 없으면 아무것도 하지 않음 (안전)
- 렌더링 출력 없음 (`return null`) — 기존 UI에 영향 0

### 수정한 파일

#### `frontend/src/app/layout.tsx`
- `ChannelTalkProvider` import 추가
- `<body>` 안에 `<ChannelTalkProvider />` 삽입 (children 앞)
- 기존 레이아웃/스타일/폰트 로직 변경 없음

#### `frontend/src/app/page.tsx`
- `setPage`, `resolveTabPageName` import 추가
- `activeTab` 변경 시 ChannelTalk `setPage` 호출하는 `useEffect` 추가
- 기존 로직 변경 없음

#### `frontend/.env.local.example`
- `NEXT_PUBLIC_CHANNELTALK_PLUGIN_KEY` 변수 추가 (설명 주석 포함)

#### `frontend/.env.local`
- `NEXT_PUBLIC_CHANNELTALK_PLUGIN_KEY=` 추가 (빈 값 — 사용자가 채워야 함)

---

## 3. 탭/페이지 매핑 테이블

| 탭 라벨 (한글) | ChannelTalk page name |
|---|---|
| 오버뷰 | `overview` |
| 칼럼 분석 | `column_analysis` |
| 키워드 분석 | `keyword_analysis` |
| AI 분석 보고서 | `ai_report` |
| Core Web Vitals | `core_web_vitals` |
| 사용자 행동 | `user_behavior` |
| 페이지 진단 | `diagnosis` |
| 솔루션 소개 | `solution_intro` |

pathname `/` → `home`

---

## 4. track 이벤트 인터페이스 (준비 완료, 아직 미호출)

추후 아래 형태로 호출 가능:

```typescript
import { track } from "@/lib/channeltalk";

// 상품 조회
track("product_view", { productId: "abc", category: "skincare" });

// 장바구니 추가
track("add_to_cart", { productId: "abc", price: 35000 });

// 체크아웃 시작
track("checkout_started");

// 체크아웃 완료
track("checkout_completed", { orderId: "ord_123", amount: 70000 });
```

---

## 5. 향후 Member Hash 연동 포인트

`boot()` 함수에 memberId/memberHash 파라미터가 이미 준비되어 있음:

```typescript
// 향후 연동 시:
boot({
  pluginKey: "...",
  memberId: customerKey,        // 내부 customer_key
  memberHash: hashFromBackend,  // 백엔드 /api/channeltalk/hash 엔드포인트에서 받기
});
```

`ChannelTalkProvider.tsx`에서 boot 옵션만 확장하면 됨.
**절대 Member Hash를 필수로 가정하지 않음** — hash가 없으면 anonymous boot.

---

## 6. 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | ✅ 새 파일 에러/워닝 0 (기존 파일에 이전부터 있던 warning 15개, error 2개는 이번 작업과 무관) |
| `npm run build` | ✅ 성공 — Compiled successfully, static pages generated |
| 타입 체크 | ✅ 빌드 시 TypeScript 통과 |
| Plugin Key 없을 때 | ✅ boot 건너뜀, 앱 정상 동작 (console.warn만 출력) |
| SDK 로드 실패 시 | ✅ try/catch로 감싸, 앱 정상 동작 |
| 기존 UI 영향 | ✅ 없음 — Provider는 null 렌더, 기존 레이아웃/스타일 변경 없음 |
| 실제 버튼 노출 | ⚠️ 미확인 — `NEXT_PUBLIC_CHANNELTALK_PLUGIN_KEY`에 실제 키를 넣어야 확인 가능 |

---

## 7. 남은 리스크

1. **Plugin Key 미입력** — 현재 `.env.local`에 빈 값. 채널 설정에서 Plugin Key를 확인하여 입력해야 실제 버튼이 뜸.
2. **Marketing add-on** — Campaign/자동 발송을 쓰려면 채널톡 Marketing add-on 활성화 필요.
3. **Member Hash 활성화 시점** — 프론트/백엔드에 memberId/memberHash 배포가 완료된 후에만 채널 설정에서 활성화해야 함. 지금 켜면 버튼 미노출 위험.

---

## 8. 다음 액션

TJ님이 추가로 해야 할 것:

```
NEXT_PUBLIC_CHANNELTALK_PLUGIN_KEY=여기에_실제_Plugin_Key_입력
```

`frontend/.env.local` 파일에 채널톡 Plugin Key를 넣고 프론트엔드를 재시작하면 채널톡 버튼이 노출됨.

Plugin Key 확인 경로: **채널 설정 > 일반 설정 > 버튼 설치 및 설정 > 채널톡 버튼 설치**
