# Phase 3 진행 보고서

> **Phase 3**: 실행 채널 연동 (채널톡 · 알리고)
> **최종 업데이트**: 2026-04-02
> **담당**: Claude Code (프론트/UXUI) + Codex (백엔드/설계)

---

## ★ Phase 3 실행 채널 닫기 — 실행 계획 (0402 추가)

### 왜 Phase 3가 지금 최우선인가

결제 귀속(P1-S1A)은 3사이트 모두 완성되었다. 하지만 **실행과 행동 데이터가 덜 닫혀** 있어서 첫 operational live를 할 수 없다.

| 영역 | 현재 상태 | 병목 |
|------|----------|------|
| 결제 귀속 (P1-S1A) | ✅ 완성 | - |
| ChannelTalk 사용자 데이터 | ✅ 프로필 조회 가능 | - |
| ChannelTalk 행동 데이터 | ✅ **Webhook 101건 수신 (0402)** | - |
| Aligo 알림톡 발송 | ✅ **live 1건 수신 확인 (0402)** | dormant 템플릿 주의 |
| Aligo SMS 발송 | ✅ **live 1건 수신 확인 (0402)** | - |
| 발송 정책 (contact policy) | ✅ 8규칙 구현 | **수신 동의(consent) 데이터 소스 미확인** |
| 발송 UI | 60~75% | **세그먼트 선택 + exact-match 연동 미완** |

### 실행 계획 — 3트랙 병렬 추진

---

#### 트랙 A: ChannelTalk Webhook 파이프라인 (핵심 병목)

**목표**: 채널톡에서 실시간 이벤트(CheckoutBegin, CheckoutComplete 등)를 수신하여 우리 DB에 적재

**왜 필요한가**: 채널톡 Open API에서 이벤트 데이터 조회가 불가(404). Webhook만이 유일한 방법.

**현재 상태**:
- ChannelTalk Open API 인증: ✅ 정상 (`access_key` + `access_secret`)
- `GET /open/v5/webhooks` → `{"webhooks": []}` (0건 등록)
- Webhook 수신 서버: ✅ `POST /api/channeltalk/webhook` 구현 완료 (0402)
- desk.channel.io 등록: ✅ `https://att.ainativeos.net/api/channeltalk/webhook` 등록 완료, 101건 수신 확인 (0402)

**구현 단계:**

| # | 작업 | 담당 | 예상 시간 | 의존 |
|---|------|------|----------|------|
| A-1 | `POST /api/channeltalk/webhook` 수신 엔드포인트 구현 | **Claude Code** | 2시간 | - |
| A-2 | 이벤트 저장 스키마 설계 (JSONL 또는 SQLite) | **Claude Code** | 1시간 | - |
| A-3 | Webhook 서명 검증 (X-Signature 헤더) | **Claude Code** | 30분 | A-1 |
| A-4 | Cloudflare Tunnel로 외부 URL 확보 | ✅ 이미 완료 | - | `att.ainativeos.net` |
| A-5 | desk.channel.io > 보안 및 개발 > Webhook URL 등록 | **TJ님** | 10분 | ✅ 완료 (0402) |
| A-6 | 수신 이벤트 종류 선택 (전체 체크, 공개 그룹 대화만 제외) | **TJ님** | 5분 | ✅ 완료 (0402) |
| A-7 | 테스트: biocom.kr에서 채널톡 채팅 → Webhook 수신 확인 | **TJ님** | 10분 | ✅ **101건 수신 확인 (0402)** |
| A-8 | 이벤트 대시보드 API (`GET /api/channeltalk/events`) | **Claude Code** | 1시간 | 다음 세션 |

**Webhook 수신 서버 구현 상세:**

```
POST /api/channeltalk/webhook
  → X-Signature 헤더로 서명 검증 (HMAC-SHA256, access_secret 사용)
  → 이벤트 종류별 분기:
    - event.created: 사용자 행동 이벤트 (ProductView, AddToCart, CheckoutBegin, CheckoutComplete)
    - user_chat.created: 새 대화 시작
    - user_chat.updated: 대화 상태 변경
    - message.created: 새 메시지
  → JSONL 파일에 append (logs/channeltalk-events.jsonl)
  → 향후: SQLite 또는 PostgreSQL로 승격
```

**Webhook 이벤트로 얻을 수 있는 데이터:**

| 이벤트 | 데이터 | CRM 활용 |
|--------|--------|----------|
| `event.created` (ProductView) | userId, 상품 코드/이름 | 관심 상품 추적 |
| `event.created` (AddToCart) | userId, 장바구니 상품 | 장바구니 이탈 감지 |
| `event.created` (CheckoutBegin) | userId, 결제 시작 | checkout abandon 실험 대상 |
| `event.created` (CheckoutComplete) | userId, 주문 완료 | 구매 확인 + attribution 조인 |
| `user_chat.created` | userId, 채팅 시작 | 상담 의향 리드 |
| `message.created` | 메시지 내용/방향 | 상담 품질 분석 |

**memberHash 결정: ❌ 지금 활성화하지 않는다**

이유:
- biocom.kr의 아임웹 래퍼(`channel_plugin.js`)가 `memberId`만 전달하고 `memberHash`를 전달하지 않음
- memberHash를 활성화하면 **모든 사용자의 채팅 버튼이 사라짐** (아임웹 래퍼가 hash를 못 넘기므로)
- Webhook + userId로 이벤트 식별은 가능하므로 memberHash 없이도 CRM 파이프라인 구축 가능
- 아임웹에서 자체 호스팅 프론트엔드로 이전한 후에 활성화

---

#### 트랙 B: Aligo 첫 Live 발송 1건 (검증 닫기)

**목표**: 실제 카카오 알림톡 1건을 live로 발송하고 수신 확인

**현재 상태**:
- 백엔드 완료: `POST /api/aligo/send`, `/render-preview`, `/whitelist` ✅
- 템플릿 조회: `GET /api/aligo/templates` ✅
- 발송 정책: 8규칙 contact policy ✅
- 화이트리스트: `01039348641` (TJ님 번호 추정)
- **exact-match**: `render-preview`에서 `exactMatch: true/false` 반환 ✅
- **live 발송**: ✅ 알림톡 `TV_6586` live 수신 확인 + SMS live 수신 확인 (0402). dormant 템플릿 주의 — `aligo.md` 참조

**실행 단계:**

| # | 작업 | 담당 | 예상 시간 | 의존 |
|---|------|------|----------|------|
| B-1 | 승인된 템플릿 목록 확인 (`GET /api/aligo/templates`) | **TJ님** | 5분 | ✅ 완료 — 45개 중 활성 18개 |
| B-2 | 테스트용 템플릿 1개 선택 + 변수 확인 | **Claude Code** | 5분 | ✅ `TV_6586` 선택 (dormant=N) |
| B-3 | `render-preview`로 변수 치환 + `exactMatch: true` 확인 | **Claude Code** | 10분 | ✅ exactMatch: true |
| B-4 | dormant=Y 템플릿 실패 → 활성 템플릿 재시도 | **Claude Code** | 10분 | ✅ `TT_7532`, `TK_4562` 실패(dormant) → `TV_6586` 성공 |
| B-5 | `testMode=N`으로 **live 발송 1건** | **Claude Code** | 5분 | ✅ **알림톡 수신 확인 (0402)** |
| B-6 | SMS 엔드포인트 구현 + live 발송 | **Claude Code** | 15분 | ✅ **`POST /api/aligo/sms` 구현 + SMS 수신 확인 (0402)** |
| B-7 | `GET /api/aligo/history`에서 발송 기록 확인 | **Claude Code** | 5분 | ✅ MID 1307254245 (알림톡), 1307255797 (SMS) |

**exact-match란?**:
- 알리고 알림톡은 **승인된 템플릿**을 그대로 사용해야 함
- 템플릿 변수(`#{이름}`, `#{상품명}`)를 모두 채워야 함
- `render-preview` API가 `exactMatch: true`를 반환해야 발송 가능
- 변수가 누락되면 `exactMatch: false` + `variablesMissing` 배열 반환

**화이트리스트 운영:**
- 현재 `01039348641`만 허용
- live 발송 검증이 끝나면 화이트리스트를 확장하거나 contact policy 기반으로 전환
- **수신 동의(consent) 데이터 소스 확보 전까지 화이트리스트 유지**

---

#### 트랙 C: 수신 동의(Consent) 데이터 소스 확보

**목표**: 고객의 마케팅 수신 동의 상태를 확인할 수 있는 데이터 소스 확보

**왜 중요한가**: contact policy의 `consent_missing` 규칙이 있지만, 실제 동의 데이터가 없으면 모든 발송이 차단되거나 admin override가 필요함

**현재 상태**:
- 아임웹 회원 DB에 마케팅 동의 필드가 있는지 **미확인**
- 채널톡 Open API에는 consent 필드 없음
- 상담 DB에도 consent 컬럼 없음
- 카카오 채널 친구 추가를 간접 동의로 볼 수 있으나 별도 API 연동 필요

**확인 방법:**

| # | 작업 | 담당 | 예상 시간 |
|---|------|------|----------|
| C-1 | 아임웹 관리자 > 회원 관리 > 회원 상세에서 마케팅 동의 필드 존재 여부 확인 | **TJ님** | 5분 |
| C-2 | 운영 DB `tb_iamweb_users` 스키마에서 consent/marketing 관련 컬럼 조회 | **Claude Code** | 10분 |
| C-3 | 카카오 채널 친구 목록 API 조회 가능 여부 확인 (카카오 REST API 키 있음) | **Claude Code** | 30분 |
| C-4 | consent 데이터 소스 결정 + contact policy 연동 설계 | **Claude Code** | 1시간 |

**consent 확보 전 운영 방침:**
- 화이트리스트 + admin override로 소규모 발송
- 수신 거부 고객 리스트 수동 관리 (스프레드시트)
- consent 소스 확보 후 자동화

---

### Phase 3 닫기 조건 (Definition of Done)

| 조건 | 현재 | 목표 |
|------|------|------|
| ChannelTalk Webhook 수신 | ✅ **101건 수신 (0402)** | ✅ 달성 |
| Aligo 알림톡 live 발송 | ✅ **1건 수신 확인 (0402)** | ✅ 달성 |
| Aligo SMS live 발송 | ✅ **1건 수신 확인 (0402)** | ✅ 달성 |
| consent 데이터 소스 | ❌ 미확인 | ✅ 1개 이상 확보 |
| 발송 UI 세그먼트 선택 | ❌ 미구현 | ✅ 후속 관리 대상 → 발송 대상 연결 |
| 첫 operational live | ❌ 미진행 | ✅ 상담 완료 후 14일 미구매 고객에게 알림톡 1건 발송 |

### ★ 0402 달성 요약

| 트랙 | 목표 | 결과 |
|------|------|------|
| **A. ChannelTalk Webhook** | 이벤트 수신 1건+ | ✅ **101건** — push(채팅), upsert(고객 프로필) 포함. 실제 고객 7명 데이터 |
| **B. Aligo 알림톡** | live 수신 1건 | ✅ **TV_6586** (분석 결과 소요 일정 안내) 수신 확인. dormant=Y 템플릿 2건 실패 후 활성 템플릿으로 성공 |
| **B-2. Aligo SMS** | live 수신 1건 | ✅ **SMS 엔드포인트 신규 구현 + 발송 + 수신 확인** |
| **C. Consent 소스** | 1개 확보 | ⬜ 다음 세션 |

### 담당 분리 요약

**Claude Code (개발):**
- A-1~A-3: Webhook 수신 엔드포인트 + 서명 검증 + 이벤트 저장
- A-8: 이벤트 대시보드 API
- B-3: render-preview exact-match 검증
- B-7: 발송 기록 확인
- C-2: 운영 DB consent 컬럼 조회
- C-3: 카카오 채널 친구 API 조사
- C-4: consent 연동 설계

**TJ님 (운영/설정):**
- A-5~A-7: desk.channel.io Webhook 등록 + 이벤트 선택 + 수신 테스트
- B-1~B-2: 승인 템플릿 확인
- B-4~B-6: testMode → live 발송 → 수신 확인
- C-1: 아임웹 회원 관리에서 마케팅 동의 필드 확인

---

## 스프린트별 완성도

| Sprint | 목표 | 완성도 | 핵심 남은 것 |
|--------|------|--------|-----------|
| **P3-S1** | ChannelTalk SDK 래퍼 · identity/event 연동 규칙 | **95%** | ✅ Webhook 수신 서버 구현 + 등록 + 101건 수신 확인 (0402). 남은 것: 이벤트 대시보드 API, memberHash는 보류 |
| **P3-S2** | ChannelTalk 프론트 래퍼 | **100%** | 완료. biocom.kr에 아임웹 자체 SDK도 이미 live |
| **P3-S3** | 알리고 알림톡/SMS 백엔드 전송 wrapper · 템플릿 관리 | **100%** | ✅ 알림톡 live 1건 수신 확인 + SMS live 1건 수신 확인 (0402). dormant 템플릿 주의사항 문서화 완료 |
| **P3-S4** | 알리고 알림톡 프론트 발송 UI | **60%** | 세그먼트 선택, exact-match 연동, 스케줄링, 결과 통계 |

---

## P3-S1 상세 계획 — ChannelTalk 데이터 파이프라인

### 현재 상태

biocom.kr에 ChannelTalk SDK가 이미 풀 연동되어 있다 (아임웹 `channel_plugin.js`). 8종 이벤트(ProductView, AddToCart, CheckoutBegin, CheckoutComplete, SignUp, AddToWish, ReviewSubmit, SurveySubmit)가 채널톡 서버에 쌓이고 있다.

**그러나**: 이벤트 데이터는 채널톡 Open API로 직접 조회할 수 없다 (404). 사용자 프로필만 간접 수집 가능하다 (`GET /open/v5/users/{id}`).

`GET /api/channeltalk/users-summary` API를 구현하여 **대화가 있는 사용자의 프로필(이름, 전화번호, UTM)** 은 대시보드에서 조회 가능해졌다. 하지만 이벤트 데이터(ProductView 몇 건, AddToCart 몇 건 등)는 여전히 가져올 수 없다.

### Open API로 할 수 있는 것 / 없는 것

| 데이터 | 조회 가능 여부 | 방법 |
|--------|-------------|------|
| 사용자 프로필 (이름, 전화번호, UTM) | **가능** | `GET /open/v5/users/{userId}` |
| 대화 목록 + 사용자 | **가능** | `GET /open/v5/user-chats` (페이지네이션) |
| 매니저(상담사) 목록 | **가능** | `GET /open/v5/managers` — 5명 확인됨 |
| 봇 목록 | **가능** | `GET /open/v5/bots` — 3개 확인됨 |
| Webhook 목록/등록 | **가능** | `GET/POST /open/v5/webhooks` |
| **이벤트 데이터 (ProductView 등)** | **불가** | Open API에 이벤트 조회 엔드포인트 없음 (404) |
| **사용자 전체 목록 export** | **불가** | bulk list API 없음 |
| **통계/분석 데이터** | **불가** | analytics 엔드포인트 없음 |

### 이벤트 데이터를 가져오려면 — Webhook 수신 서버 ✅ 완료 (0402)

채널톡 이벤트를 우리 시스템에서 활용하는 유일한 방법은 **Webhook**이다.

**구현 완료:**

| 단계 | 작업 | 담당 | 상태 |
|------|------|------|------|
| 1 | `POST /api/channeltalk/webhook` 수신 엔드포인트 구현 | Claude Code | ✅ 완료 (0402) |
| 2 | Webhook 이벤트를 JSONL에 적재 (`logs/channeltalk-webhooks.jsonl`) | Claude Code | ✅ 완료 |
| 3 | 서버를 외부에서 접근 가능한 URL로 노출 | Cloudflare Named Tunnel | ✅ `att.ainativeos.net` 고정 |
| 4 | desk.channel.io 웹훅 등록 + 이벤트 선택 | TJ | ✅ 완료 — 유저챗/광고수신/연락처/삭제 전체 등록 |
| 5 | 수신 로그 조회 API | Claude Code | ✅ `GET /api/channeltalk/webhooks` |
| 6 | 수신된 이벤트 데이터를 대시보드에 표시 | Claude Code (프론트) | ⬜ 다음 작업 |

**Webhook 등록 정보:**
- `name`: `CRM Attribution Webhook`
- `url`: `https://att.ainativeos.net/api/channeltalk/webhook`
- `token`: `CHANNELTALK_WEBHOOK_TOKEN` (.env에 저장)
- 이벤트: 유저챗 대화, 유저챗 열릴 때, 광고 수신 설정 변경(리드+회원), 연락처 변경(리드+회원), 삭제(리드+회원)

**수신 실적 (0402):**
- 총 101건 수신
- `push` (채팅 메시지): ~93건
- `upsert` (고객 프로필 생성/업데이트): 6건 — 실제 고객 7명 데이터 포착
- 수신 고객: 고승업, 이은주, 이예진, 김영선, 김다솜, 김지은, 김효미

### 이벤트 데이터가 들어오면 무엇이 달라지는가 (사용자 페르소나별)

**대표(TJ):**
- "tiktok에서 온 고객이 상품을 몇 개 보고 이탈하는가?"를 GA4가 아닌 **개인 단위**로 추적할 수 있다. GA4는 익명 집계인데, 채널톡 이벤트는 사용자 ID가 붙어 있어서 "이 고객이 상품 3개를 보고 장바구니에 1개 담고 결제를 시작했다가 이탈했다"는 개인 타임라인을 볼 수 있다.
- "결제 시작 후 이탈한 고객이 하루에 몇 명인가?"를 실시간 숫자로 볼 수 있다. 지금은 GA4의 `begin_checkout` eventCount로만 추정하지만, Webhook이 들어오면 건별로 정확히 세고, 이탈한 사람이 누구인지까지 안다.

**상담 팀장:**
- "상담 후 고객이 실제로 상품을 봤는가, 장바구니에 담았는가?"를 확인할 수 있다. 지금은 상담 → 주문 매칭만 가능하지만, 이벤트가 들어오면 상담 → ProductView → AddToCart → CheckoutBegin → 구매 전체 여정을 상담사별로 추적할 수 있다.
- 상담 후 3일 내 ProductView가 0이면 "상담이 구매 의향을 만들지 못했다"는 신호로 읽을 수 있다.

**운영팀:**
- "결제를 시작했다가 멈춘 고객"을 실시간 리스트로 볼 수 있다. 지금은 이 리스트가 없어서 누구에게 후속 연락해야 하는지 모른다. Webhook이 들어오면 CheckoutBegin 후 N분 내 CheckoutComplete가 없는 고객을 자동으로 "후속 관리 대상"에 올릴 수 있다.
- 장바구니에 담고 떠난 고객에게 알림톡을 보낼 타이밍을 정확히 잡을 수 있다 (AddToCart 시각 기준).

**마케터:**
- UTM 소스별로 "상품을 보긴 하는데 장바구니까지 안 가는 채널"과 "장바구니까지는 가는데 결제에서 이탈하는 채널"을 구분할 수 있다. 지금은 GA4의 세션 단위 집계로만 보지만, 채널톡 이벤트는 사용자 단위이므로 더 정확한 퍼널을 만들 수 있다.
- CRM 실험에서 "이 메시지를 받은 그룹이 ProductView를 더 많이 했는가?"를 측정할 수 있다. 알림톡 발송 → 실제 행동 변화를 이벤트 단위로 추적하는 것이다.

**요약**: 지금은 "몇 명이 샀다/안 샀다"만 아는 상태. Webhook이 연결되면 "누가, 언제, 어디까지 갔다가, 왜 멈췄는가"를 개인 단위로 알 수 있다.

---

### memberHash 활성화 — 지금 켜면 안 된다

#### desk.channel.io 보안 설정 경고 (2026-04-01 스크린샷 확인)

"고객 정보 암호화" 토글 시 채널톡이 다음 경고를 표시한다:

> **"켜고나면 고객 정보 암호화(멤버 해시) 작업이 되어있지 않은 고객에게는 채널톡 버튼이 노출되지 않습니다. 개발 작업을 완료하신 후에 설정해주세요."**

#### Claude Code 의견

**지금 켜면 안 된다.** 이유:

1. biocom.kr의 채널톡은 아임웹(`channel_plugin.js`)이 `pluginKey`만으로 boot하고 있다. `memberId`도 `memberHash`도 전달하지 않는다.
2. "고객 정보 암호화"를 켜는 순간, SDK가 모든 boot에서 `memberHash`를 검증한다.
3. 아임웹 래퍼는 `memberHash`를 전달하지 않으므로, **모든 페이지에서 채널톡 버튼이 사라진다**.
4. 비로그인 방문자(익명)도, 로그인 회원도 모두 채팅 불가가 된다.
5. 아임웹 래퍼(`channel_plugin.js`)는 우리가 수정할 수 없는 플랫폼 코드다.

**결론**: memberHash 없이도 CRM 파이프라인의 핵심 목표(전화번호 매칭, webhook 이벤트 수신, 실험 운영)는 달성 가능하므로 지금은 **비활성 상태를 유지**한다.

#### Codex 의견

**지금 켜지 말 것. memberHash 없이 CRM 파이프라인을 먼저 구축할 것.**

- memberHash의 역할은 **사칭 방지**(spoofing prevention)다. 다른 사람의 `memberId`를 넣어 채팅 이력을 탈취하는 것을 막는 보안 레이어일 뿐, 식별 자체와는 별개다.
- CRM 파이프라인 목표별로 memberHash 없이 가능한지:

| CRM 목표 | memberHash 없이 가능 | 방법 |
|---------|-------------------|------|
| 전화번호로 상담 DB 매칭 | **가능** | webhook user profile의 phone 필드 |
| webhook 이벤트에서 유저 식별 | **가능** | webhook은 ChannelTalk 내부 userId를 항상 포함 |
| 식별된 고객 대상 CRM 실험 | **가능** | memberId 전달만으로 식별 가능, memberHash는 보안 레이어 |

- **memberHash가 필요해지는 시점**: 우리 시스템이 ChannelTalk memberId를 이용해 고객별 개인화 메시지를 자동 발송하기 시작할 때. 단순 조회/매칭에서는 보안상 필수가 아님.
- **활성화 가능한 시점**: imweb을 벗어나 자체 프론트에서 ChannelTalk SDK를 직접 boot하는 구조로 전환한 후.

#### 결론

| 옵션 | 판단 |
|------|------|
| **지금 활성화** | **금지** — 채팅 버튼 즉시 소실, 고객 문의 불가, 매출 영향 |
| **준비 후 활성화** | imweb에서 벗어난 후에만 가능 |
| **건너뛰기** | **현재 최선** — webhook + 전화번호 매칭 + Open API로 CRM 목표 달성 가능 |

### P3-S1 남은 작업 요약

| 항목 | 완성도 | 다음 액션 |
|------|--------|---------|
| Open API 연동 (사용자 프로필) | **✅ 완료** | `GET /api/channeltalk/users-summary` 구현됨 |
| Webhook 수신 서버 | **✅ 완료 (0402)** | `POST /api/channeltalk/webhook` → JSONL 적재. 101건 수신 확인 |
| desk.channel.io 웹훅 등록 | **✅ 완료 (0402)** | URL: `https://att.ainativeos.net/api/channeltalk/webhook`. 유저챗 대화/열릴 때/광고수신설정/연락처변경/삭제 전체 등록 |
| Webhook 로그 조회 | **✅ 완료 (0402)** | `GET /api/channeltalk/webhooks` → 최근 50건 조회 |
| 이벤트 대시보드 API | **미구현** | webhook 데이터 집계/요약 API 필요 |
| memberHash 활성화 | **보류** | 금지 — 아임웹 래퍼가 hash 미전달, 활성화 시 채팅 버튼 소실 |
| Revenue 백엔드 sync/stale/campaign API | **✅ 완료** | Codex가 이전 턴에 구현 |
| 발송 정책(contact policy) 이식 | **✅ 완료** | Revenue Python → SEO TypeScript. 8가지 규칙 |
| 최고관리자 강제 발송 | **✅ 완료** | adminOverride=true 시 consent/claimReview 우회 가능 |

---

## 발송 정책(contact policy) — 구현 완료

Revenue의 `crm_contact_policy_service.py`(266줄)를 SEO 백엔드에 TypeScript로 이식 완료.

### 8가지 판단 규칙

| 규칙 | 코드 | 최고관리자 우회 가능 |
|------|------|----------------|
| 수신 동의 미확인 | `consent_missing` | **가능** — adminOverride 시 warn으로 변경, eligible=true |
| 문구 검토 미완료 | `claim_review_missing` | **가능** — adminOverride 시 warn으로 변경 |
| 야간시간 (21~08시 KST) | `quiet_hours` | **불가** — 안전 규칙 |
| 동일 채널 24시간 쿨다운 | `cooldown_active` | **불가** |
| 7일 빈도 제한 (알리고 2건/채널톡 3건) | `frequency_cap_7d` | **불가** |
| 최근 구매 후 7일 suppression | `recent_purchase_suppression` | **불가** |
| 최근 상담 후 2일 suppression | `recent_consultation_suppression` | **불가** |
| 전화번호 없음 (알리고) | `missing_phone` | **불가** |

### 수신 동의 상태 — 현재 확인할 수 있는 데이터 소스가 없다

| 데이터 소스 | 수신 동의 정보 | 상태 |
|-----------|-------------|------|
| 아임웹 회원 DB (`tb_iamweb_users`) | **확인 필요** — 마케팅 동의 필드 존재 여부 스키마 확인 필요 | 첫 번째 확인 대상 |
| 채널톡 사용자 프로필 | **없음** — Open API 응답에 consent 필드 없음 | 불가 |
| 상담 DB (`tb_consultation_records`) | **없음** — 수신 동의 컬럼 없음 | 불가 |
| 알리고 | **없음** — 수신 동의를 관리하지 않음 (발신자 책임) | 불가 |
| 카카오 채널 | **간접 가능** — 친구 추가 = 알림톡 수신 동의 간주. 별도 API 연동 필요 | 추후 |

**현실적 운영 방안**: 수신 동의 데이터 소스가 확보되기 전까지는, 화이트리스트 대상자 + 최고관리자 강제 발송으로 테스트한다. 아임웹 회원 DB에 마케팅 동의 필드가 있는지 확인하는 것이 가장 먼저 할 일이다.

---

## 채널톡 관리자 화면 구분

| URL | 용도 | 주요 기능 |
|-----|------|----------|
| **`app.channel.io`** | **고객용 채팅 위젯 앱**. 홈/대화/설정 3탭만 존재. 관리 기능 없음 | 문의하기, 대화 이력, 알림 설정 |
| **`desk.channel.io`** | **운영자용 관리자 대시보드**. 상담/마케팅/통계/연동/설정 전체 관리 | 아래 상세 |

`desk.channel.io` 사이드바 메뉴 (스크린샷 기준):

| 메뉴 | 하위 | 데이터 활용 관련성 |
|------|------|----------------|
| 상담 | — | 대화 목록, 상담 배정 |
| 미트 | — | 미팅/통화 |
| 연동 | — | 외부 서비스 연동 |
| 리소스 | — | 봇, 자동 응답 |
| 채널엑스 | — | — |
| **보안 및 개발** | **보안** | 고객 정보 암호화(memberHash), 활동 로그 다운로드 |
| | **API** | accessKey/accessSecret 생성/관리 |
| | **웹훅** | Webhook URL 등록, 수신 이벤트 선택 |
| | 스니펫 | 커스텀 코드 삽입 |
| | 모바일 SDK 푸시 | 모바일 푸시 설정 |
| | 앱 만들기 | 채널톡 앱 개발 |
| | 개발자 문서 | developers.channel.io 링크 |

---

## 채널톡 이벤트 — 수집 현황과 활용 현실

### 수집 현황

아임웹 래퍼(`channel_plugin.js`)가 매 이벤트 발생 시 `window.ChannelIO("track", ...)` 을 호출하여 채널톡 서버에 데이터를 보내고 있다.

| 데이터 | 쌓이는 곳 | 우리 대시보드에서 조회 | 상태 |
|--------|----------|---------------------|------|
| ProductView, AddToCart 등 이벤트 | 채널톡 서버 | **불가** — Open API에 이벤트 조회 엔드포인트 없음 | 쌓이는 중, 미활용 |
| 사용자 프로필 (이름, 전화번호, UTM) | 채널톡 서버 | **조회 가능** — `GET /api/channeltalk/users-summary` 구현 완료 | **연동됨** |
| 신규 방문자 회원가입률 | 채널톡(SignUp) + GA4(newUsers) | **불가** — 양쪽 조합 필요, SignUp count를 API로 가져올 수 없음 | 수동 비교만 가능 |

### 파이프라인 구축 결과

`GET /api/channeltalk/users-summary`를 구현하여 **대화가 있는 사용자의 프로필**은 대시보드에서 조회 가능해졌다. 실제 호출 결과 (closed chats 100건 기준):
- 사용자 85명 (member 53, lead 32)
- 전화번호 있음 69명 (81%)
- UTM 소스 상위: naver(8), naverbrandsearch_mo(6), naverbrandsearch_pc(5), meta_skincare(3)

**한계**: 이벤트 데이터(ProductView 몇 건, AddToCart 몇 건)는 Open API로 가져올 수 없다. ~~이벤트를 실시간으로 받으려면 Webhook 수신 서버가 필요하며, 이를 위해 desk.channel.io에서 URL을 등록해야 한다.~~ → **✅ Webhook 수신 서버 구현 + 등록 완료 (0402).** 다만 현재 수신 중인 이벤트는 채팅(push)과 프로필(upsert)이며, e-commerce 이벤트(ProductView, AddToCart 등)는 Webhook 범위 밖이다. 이벤트 수는 desk.channel.io 대시보드에서만 확인 가능.

### 전환율 향상 시나리오 — 구체적 행동

| 시나리오 | 구체적 행동 | 어디서 하는가 | 코드 변경 |
|---------|-----------|------------|---------|
| 결제 이탈자에게 실시간 메시지 | `desk.channel.io`에서 마케팅 캠페인 생성. 트리거: `CheckoutBegin` 이벤트 발생 후 10분 내 `CheckoutComplete` 이벤트 미발생. 메시지: "결제 도중 문제가 있으셨나요? 도움이 필요하시면 말씀해 주세요" | desk.channel.io > 마케팅 (좌측 사이드바) | **없음** |
| 장바구니 이탈 리마인더 | 위와 동일 방법. 트리거: `AddToCart` 후 2시간 내 `CheckoutBegin` 미발생 | desk.channel.io > 마케팅 | **없음** |
| 상품 조회 후 상담 유도 | 트리거: `ProductView` + 페이지 체류 3분+ + `AddToCart` 미발생. 메시지: "이 상품에 대해 궁금한 점이 있으신가요?" | desk.channel.io > 마케팅 | **없음** |

**참고**: 위 시나리오를 실행하려면 `desk.channel.io`의 마케팅 메뉴에서 "캠페인 만들기"가 가능해야 한다. 현재 구독 플랜에서 이 기능이 활성화되어 있는지 확인 필요.

---

## P3-S4 현재 구현 (60%)

### 완성된 부분
- 4-step 워크플로우 (대상 선택 → 템플릿 → 미리보기 → 발송)
- 2-column 데스크톱 레이아웃
- 소스 타입 선택 (수동 테스트 / 후속관리 대상 / 실험 대상)
- 승인 템플릿 목록 + 검색 + 선택
- 수신자 입력 + 화이트리스트 검증 (`01039348641`만 허용)
- 테스트/실제 발송 모드 토글
- 발송 전 gate 상태 배지 (화이트리스트/포인트/템플릿/연동)
- 발송 결과 표시 + 최근 이력 테이블
- exact-match preview 영역 확보 (API 연동 대기)

### 남은 40%

| 항목 | 설명 | 우선순위 |
|------|------|----------|
| 대상자 세그먼트 선택 | 후속 관리 탭 candidates와 연동 | HIGH |
| 템플릿 변수 치환 + 미리보기 | `render-preview` API 프론트 연동 | HIGH |
| 발송 스케줄링 | 예약 발송 (senddate) | MEDIUM |
| 발송 결과 통계 | 성공률, 실패 사유, 전환 추적 | MEDIUM |
| 배치 발송 | receiver_1~500 지원 | MEDIUM |
| 타사 CRM UXUI 벤치마크 | Braze/Sendbird/NHN Cloud 참조 | HIGH |
| 사용자 피드백 기반 UX 재설계 | 운영팀 실사용 피드백 | HIGH |

---

## CRM 탭 URL 동기화 — 구현 완료

`useState` → `useSearchParams` + `useRouter` 기반으로 변경 완료.

```
/crm                → 기본(후속 관리)
/crm?tab=messaging  → 알림톡 발송
/crm?tab=experiments → 실험 운영
/crm?tab=attribution → 결제 귀속
```

---

## 채널톡 Open API v5 실제 테스트 결과 (2026-04-01)

**공식 API 레퍼런스**: `https://api-doc.channel.io/` (SPA, 서버사이드 렌더링 안 됨)

| 엔드포인트 | 메서드 | 동작 | 반환 |
|-----------|--------|------|------|
| `/open/v5/channel` | GET | **O** | 채널 정보 |
| `/open/v5/managers` | GET | **O** | 매니저 5명 |
| `/open/v5/bots` | GET | **O** | 봇 3개 |
| `/open/v5/user-chats` | GET | **O** | 대화 목록 (closed 100건+, 페이지네이션) |
| `/open/v5/user-chats/{id}` | GET | **O** | 대화 상세 |
| `/open/v5/users/{id}` | GET | **O** | 사용자 상세 (이름, 전화번호, UTM) |
| `/open/v5/webhooks` | GET | **O** | 등록된 webhook 0건 |
| `/open/v5/webhooks` | POST | **O** | webhook 등록 가능 (name, url, scopes 필수) |
| `/open/v5/events` | GET | **404** | 이벤트 조회 불가 |
| `/open/v5/user-events` | GET | **404** | 불가 |
| `/open/v5/analytics` | GET | **404** | 불가 |
| `/open/v5/contacts` | GET | **404** | 불가 |
| `/open/v5/segments` | GET | **404** | 불가 |

---

## 스크린샷 (`phase3/` 폴더)

| 파일 | 내용 |
|------|------|
| `capture_crm-overview.png` | AI CRM 포털 메인 (카드 6장) |
| `capture_crm-followup.png` | CRM 후속 관리 탭 |
| `capture_crm-messaging.png` | CRM 알림톡 발송 탭 |
| `capture_crm-experiments.png` | CRM 실험 운영 탭 |
| `capture_crm-attribution.png` | CRM 결제 귀속 탭 |
| `capture_solution.png` | 솔루션 소개 페이지 |

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/aligo.ts` | Codex: `sendAligo()` + `renderAligoPreview()` 함수 추가 |
| `backend/src/routes/aligo.ts` | Codex: `/send`, `/whitelist`, `/render-preview` 추가 |
| `backend/src/routes/channeltalk.ts` | `GET /api/channeltalk/users-summary` 추가 |
| `frontend/src/app/crm/MessagingTab.tsx` | 알림톡 발송 UI — 4-step 워크플로우, 2-column (60%) |
| `frontend/src/app/crm/page.tsx` | useSearchParams 탭 URL 동기화, Revenue Bridge 접이식, blocker headline, 채널 배지 |
| `frontend/src/app/solution/page.tsx` | 솔루션 소개 + CRM 채널 비교 |
| `frontend/src/constants/pageData.ts` | 대메뉴 "CRM" → "AI CRM" |
| `frontend/src/app/page.tsx` | AI CRM 포털 카드 6장 |
