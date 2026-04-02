According to a document from 2026-04-01, 지금 기준 핵심은 명확합니다. **Phase 3의 진짜 blocker는 UI가 아니라 `실제 고객 사이트 ChannelTalk live 삽입`과 `Aligo exact-match renderer`**입니다. 최신 문서 기준으로 ChannelTalk 쪽은 `sync-preview / sync-users / stale-users / campaign-preview`까지 올라와 있고, Aligo 쪽도 `status / templates / quota / test-send / history`까지는 올라왔지만, 실제 발송은 `메시지가 템플릿과 일치하지않음` 때문에 막혀 있습니다. 또 문서끼리도 충돌이 남아 있습니다. `Phase 3 진행 보고서`는 P3-S4를 60%로 보는데, 다른 Phase 3 메모는 아직 0% placeholder로 적고 있습니다. 이건 source of truth를 하나로 정리해야 합니다.  

핵심 판단부터 말하면, **지금 UXUI는 “보기 좋은 내부 관제실” 수준이고, 아직 “운영자가 빠르게 발송하고 실험을 굴리는 작업 도구” 수준은 아닙니다.**
특히 알림톡 발송 탭은 현재 문서 기준으로도 KPI 카드, 템플릿 목록, 화이트리스트 검증, test/live 토글, 발송 결과, 최근 이력까지는 구현됐지만, 실제 운영자가 필요한 핵심인 `대상자 세그먼트 선택`, `템플릿 변수 치환`, `결과 통계`, `배치 발송`, `UX 재설계`가 아직 남아 있습니다. 즉, 지금 화면은 **template browser + test utility**에 가깝고, **campaign workflow**는 아닙니다. 

## 제일 먼저 고쳐야 할 5가지

### 1) 문서 source of truth부터 하나로 고정

이건 사소하지 않습니다.

지금 상태는

* 최신 진행 보고서: `P3-S4 60%`
* 다른 Phase 3 메모: `P3-S4 0%`
  로 읽힙니다.
  이 상태로 가면 Claude Code, Codex, 운영팀이 서로 다른 현실을 보고 움직이게 됩니다. **TJ님 기준 source of truth는 하나만 남겨야 합니다.** 제 추천은:
* `roadmap0327.md` = 전체 우선순위
* `Phase1.md` = 측정/귀속 source of truth
* `Phase3.md(2026-04-01 진행 보고서)` = 채널 실행 source of truth
  이 3개만 살리고, 나머지 older memo는 archive 처리입니다.  

### 2) Messaging 탭을 “템플릿 목록 화면”에서 “발송 워크플로우 화면”으로 바꿔야 함

지금 스크린샷 기준으로 메시징 탭은 **템플릿이 화면 대부분을 먹고 있고**, 운영자가 실제로 먼저 결정해야 하는

* 누구에게
* 무엇을
* 지금 보낼 수 있는가
  가 앞에 오지 않습니다.

이 탭은 아래 4단계로 재설계하는 게 맞습니다.

1. **대상 선택**
   후속 관리 탭 또는 실험 탭에서 세그먼트를 넘겨받음
   예: `상담 완료 후 14일 미구매`, `checkout abandon`, `수동 테스트 번호`

2. **템플릿 선택 + exact-match 미리보기**
   실제 치환 결과, 버튼, 줄바꿈까지 provider 전송본과 동일하게 보여줘야 함

3. **발송 전 검증**
   `consent`, `claim review`, `quiet hours`, `suppression`, `쿼터`, `whitelist`를 한 번에 표시

4. **결과 확인**
   성공 수, 실패 수, 대표 실패 코드, 최근 발송 이력, 원장 연결 여부

지금 문서에서도 세그먼트 선택, 변수 치환, 결과 통계, 배치 발송이 남은 핵심이라고 적고 있으니, 이건 제 취향 문제가 아니라 실제 남은 작업 정의와도 맞습니다. 

### 3) `exact-match preview`를 UI 중심 기능으로 올려야 함

지금 Aligo의 핵심 blocker는 키나 IP가 아니라 **승인 템플릿과 실제 렌더링 불일치**입니다. 즉, 템플릿 미리보기는 “있으면 좋은 UX”가 아니라 **실패를 막는 필수 기능**입니다. 문서도 blocker를 exact-match로 규정하고 있습니다.  

그래서 UI에서 꼭 보여줘야 하는 것은:

* 승인 템플릿 원문
* 실제 치환 후 본문
* 버튼 1, 2, 3
* provider 전송 payload preview
* exact-match pass / fail

이 기능이 없으면 운영팀은 “보냈다”만 보고, 실제로는 `rslt=U`를 계속 만들게 됩니다.

### 4) CRM 탭 URL 동기화는 `MEDIUM`이 아니라 사실상 `HIGH`

문서에는 탭 URL 동기화를 MEDIUM으로 뒀는데, 제 생각엔 이건 더 올려야 합니다. 이유는 간단합니다.

* `/crm?tab=messaging` 딥링크가 안 되면 운영팀 handoff가 불편
* QA와 캡처가 불편
* 특정 blocker 탭을 바로 공유 못 함
* AI CRM 포털 카드 링크도 어색해짐

지금처럼 `/crm`이 허브라면, 탭 상태를 URL과 동기화하지 않는 건 생각보다 큰 비용입니다. 이건 기능 추가가 아니라 **운영 속도 개선**입니다. 문서에도 직접 URL 접근 불가, 뒤로가기 비작동, 공유 링크 불가, Playwright 캡처 어려움이 적혀 있습니다. 

### 5) Phase 3 UI보다 먼저 닫아야 하는 건 `P3-S2 live baseline`

아무리 메시징 UI를 예쁘게 만들어도, 실제 고객 사이트에서 ChannelTalk 이벤트가 live로 안 찍히면 운영 판단이 흔들립니다. 최신 문서도 P3-S1과 P3-S2의 가장 큰 blocker를 **실제 고객 사이트 live 삽입**으로 보고 있습니다.  

그리고 더 크게는, **P1-S1A live row가 여전히 0인 상태**라면 Phase 3에서 실제 발송 실험을 돌려도 해석 신뢰도가 떨어집니다. 지금 로드맵도 `live / replay / smoke` 중 live만 비어 있다고 명시하고 있고, 실제 고객 사이트 receiver 연결이 아직 최우선이라고 적고 있습니다.  

---

## 화면별 UXUI 피드백

### A. 후속 관리 탭

이 탭은 지금 **“분석 화면”과 “실행 화면”이 섞여 있습니다.**

좋은 점:

* KPI 카드 구조는 깔끔함
* `상담 완료 -> 미구매`, `부재/변경 -> 재연락` 분기가 직관적
* 테이블 정보량은 충분함

하지만 핵심 문제는 3가지입니다.

첫째, **행동 우선순위가 안 보입니다.**
지금 테이블은 이름, 연락처, 상담사, 검사유형, 상담일, 상태, 주문, 추천 액션이 있는데,
운영자가 가장 먼저 봐야 하는 건 사실

* 오늘 꼭 연락해야 하는가
* 어떤 채널이 맞는가
* 왜 이 사람이 지금 대상인가
  입니다.

그래서 아래 컬럼이 더 중요합니다.

* `우선순위 점수`
* `권장 채널`
* `blocked reason`
* `최근 접촉일`
* `다음 액션 deadline`

둘째, **추천 액션이 너무 일반적입니다.**
지금은 거의 다 `구매 유도`처럼 보이는데, 이건 액션이 아니라 라벨입니다.
실제 운영용이면

* `전화 우선`
* `알림톡 가능`
* `채널톡 가능`
* `보류: quiet hours`
* `보류: 최근 구매`
  처럼 나와야 합니다.

셋째, **아래 API 500 오류 박스가 너무 크고 무기력합니다.**
`상담사별 요약`, `주문 매칭 현황`이 에러일 때, 지금은 빨간 박스만 큽니다. 운영자 입장에서는 의미 없는 큰 빈칸입니다.
이건 이렇게 바꾸는 게 낫습니다.

* 축약형 오류 배너
* `다시 시도`
* `원시 오류 보기`
* `이 섹션 숨기기`
* 나머지 액션 리스트는 계속 사용 가능

즉, 이 탭은 **“대상 리스트”가 아니라 “오늘 액션 큐”**처럼 보여야 합니다.

### B. 실험 운영 탭

이 화면은 현재 가장 많이 닫혀 있습니다.
문서상으로도 실험 생성, 전환 동기화, KPI 표, variant 비교 차트가 이미 동작하고 있다고 정리돼 있습니다. 

좋은 점:

* 실험 카드 3개 구조는 직관적
* KPI 카드와 variant 성과 표가 한 화면에 있음
* 최근 배정 테이블도 유용

하지만 운영자가 판단하기엔 아직 4개가 부족합니다.

첫째, **variant 이름이 사람 언어가 아닙니다.**
`t2h_24h`, `t3w_3d` 같은 이름은 개발자에겐 괜찮지만 운영자에겐 느립니다.
`2시간 후 / 24시간`, `3주 후 / 3일` 식으로 사람 말로 같이 보여줘야 합니다.

둘째, **통계적 해석 경고가 부족합니다.**
현재 차트만 보면 uplift처럼 읽힐 수 있습니다.
`표본 부족`, `판정 대기`, `유의성 없음`, `초기 관찰치` 같은 배지가 꼭 있어야 합니다.

셋째, **Revenue Bridge blocker가 너무 앞에 나옵니다.**
현재 저 카드들은 운영자보다는 개발자 진단용입니다.
이걸 메인 화면 하단 접이식 “개발자 진단”으로 내리는 게 맞습니다.

넷째, **메시지 로그 0건이 더 중요하게 보여야 합니다.**
실험은 있는데 `message log 0`이면 아직 실행이 안 된 실험이라는 뜻일 수 있습니다. 이건 상단에 경고로 올려야 합니다.

### C. 결제 귀속 탭

이건 방향이 좋습니다.
특히 **`live / replay / smoke` 분리**는 정말 잘한 판단입니다. 최신 문서도 이 구분과 replay 5건, live 0건을 핵심 해석 포인트로 잡고 있습니다. 

다만 UX는 더 날카롭게 만들 수 있습니다.

첫째, **카드가 많아도 첫 문장이 약합니다.**
이 탭은 분석 화면이 아니라 **개발 handoff 화면**입니다.
맨 위에 크게 한 줄이 있어야 합니다.

예:

* `오늘 blocker: live payment_success 0건 → 실제 고객 사이트 receiver 연결 필요`
* `replay 5/5는 닫힘, live만 비어 있음`

둘째, **0과 unavailable을 구분해야 합니다.**
GA4 `(not set)` 매출이 실제 0인지, 권한/연결 문제인지 구분 안 되면 잘못 읽힙니다.
이건 회색 `N/A`와 숫자 `0`를 디자인적으로 분리해야 합니다.

셋째, **해석 규칙 박스는 접을 수 있어도 됩니다.**
현재는 설명이 길고, 매번 볼 필요는 없습니다. 툴팁이나 accordion으로 축약해도 됩니다.

넷째, **날짜표는 severity 중심 정렬이 더 낫습니다.**
지금은 날짜 순서인데, 운영자는 날짜보다

* live 비어 있음
* replay만 있음
* toss 승인 높음
  이런 위험 순서로 먼저 보고 싶습니다.

### D. 알림톡 발송 탭

이 탭이 제일 중요합니다.
그리고 아직 제일 덜 닫혔습니다.

스크린샷을 보면 지금 상태는 **긴 템플릿 목록 + 기본 KPI + 이력 테이블** 중심입니다.
문서상 구현 항목과도 일치합니다. 

문제는, 이 구조로는 운영자가 빠르게 발송 판단을 못 합니다.

제가 보는 핵심 문제는 5개입니다.

첫째, **대상자보다 템플릿이 먼저 보입니다.**
운영자는 먼저 “누구에게 보내는가”를 정합니다.
지금은 “어떤 템플릿이 있는가”가 먼저라서 흐름이 반대입니다.

둘째, **preview가 약합니다.**
지금 blocker가 exact-match인데, preview가 약하면 운영자는 실패를 UI에서 못 막습니다.

셋째, **desktop 레이아웃이 약합니다.**
다른 탭은 wide desktop인데, 메시징은 single-column 느낌이 강합니다.
이 탭은 데스크톱 기준으로 최소 **2열**이 되어야 합니다.

* 좌측: 세그먼트/수신자
* 우측: 템플릿/렌더링 미리보기/발송

넷째, **발송 이력은 많지만 판단 연결이 약합니다.**
이력이 중요하긴 한데, 지금은 “그래서 무엇을 수정해야 하나”로 이어지지 않습니다.

* 실패 사유 상위 3개
* exact-match fail count
* blocked by policy count
* 발송 성공 후 delivery rate
  이렇게 요약돼야 합니다.

다섯째, **hard gate 이유가 UI에 드러나야 합니다.**
문서상 backend에는 `consent`, `claim review`, `quiet hours`, `cooldown`, `suppression`, `fallback`이 이미 코드로 올라와 있습니다. 그런데 운영자 UI가 이걸 안 보여주면, 결국 사람은 “왜 안 보내지?”를 다시 묻게 됩니다. 

---

## 제가 추천하는 P3-S4 최종 UX 구조

이 탭은 아래 4-step이 가장 맞습니다.

### Step 1. 대상 선택

* `후속 관리 탭에서 가져오기`
* `실험 대상 가져오기`
* `수동 테스트 번호`
* 예상 발송 가능 수 / blocked 수 표시

### Step 2. 템플릿 선택

* 검색
* 카테고리
* 승인 상태
* 변수 개수
* 버튼 개수
* last updated

### Step 3. exact-match preview

* 승인 원문
* 실제 치환 후 본문
* 버튼
* provider payload
* `pass / fail`

### Step 4. test → send → result

* test send 강제
* quota 확인
* 결과 summary
* 최근 이력
* Phase 1/7 원장 연결 링크

이렇게 바꾸면 운영자는 “누구 / 무엇 / 보낼 수 있나 / 결과가 어땠나”를 한 흐름으로 봅니다.

---

## Phase 3 관점의 우선순위

제가 추천하는 순서는 이겁니다.

### 1순위

**P3-S2 실제 고객 사이트 live baseline**

* `boot / updateUser / track` 최소 1건
* `memberId = customer_key` live 확인

### 2순위

**P3-S3 exact-match renderer + send log 적재**

* `rslt=Y` 1건
* 실패 사유를 UI에 바로 보여주기

### 3순위

**P3-S4 운영용 발송 워크플로우화**

* 세그먼트
* preview
* test
* 결과

### 4순위

**P1-S1A live row 1건**

* 이게 닫혀야 checkout abandon causal test도 흔들리지 않음 

즉, **UI만 더 만드는 것보다 live baseline과 exact-match를 먼저 닫는 게 맞습니다.**

---

## 딱 잘라서 말하는 핵심 개선 필요 사항

1. **문서 충돌 정리**
   P3-S4 60% vs 0%부터 정리

2. **Messaging 탭 재설계**
   템플릿 목록 중심 → 발송 워크플로우 중심

3. **exact-match preview를 핵심 기능으로 승격**
   이건 nice-to-have가 아니라 blocker 제거 기능

4. **Follow-up 탭을 액션 큐화**
   generic `구매 유도` 대신 `채널/우선순위/보류 사유`

5. **Experiment 탭은 운영 화면과 개발자 진단 분리**
   Revenue bridge blocker는 접이식으로

6. **Attribution 탭은 한 줄 blocker headline 추가**
   `오늘 해야 할 행동`을 맨 위에

7. **탭 URL 동기화 우선순위 상향**
   Medium보다 High에 가까움

---

## 바로 쓸 수 있는 프롬프트 2개

### Claude Code용 — MessagingTab 재설계

```text
목표:
현재 MessagingTab을 '템플릿 브라우저'가 아니라 '운영용 발송 워크플로우'로 바꾼다.

핵심 원칙:
- 운영자가 먼저 결정하는 것은 "누구에게 보낼지"다.
- exact-match preview가 없으면 live send를 열지 않는다.
- hard gate blocked reason을 숨기지 말고 UI에 먼저 보여준다.
- desktop 기준 2-column layout으로 바꾼다.

필수 구성:
1. Step 1 대상 선택
   - 후속 관리 탭 candidates 연동
   - 실험 대상 연동
   - 수동 테스트 번호
   - eligible / blocked count 표시
2. Step 2 템플릿 선택
   - 검색, 카테고리, 승인 상태, 변수 수, 버튼 수
3. Step 3 preview
   - 승인 템플릿 원문
   - 실제 치환 결과
   - 버튼 preview
   - provider payload preview
   - exact-match pass/fail
4. Step 4 발송
   - test send 강제
   - live send는 exact-match pass일 때만
   - quota / whitelist / quiet hours / consent 표시
5. 결과
   - 성공 수 / 실패 수 / 대표 실패 사유 / 최근 발송 이력

추가 요구:
- /crm?tab=messaging deep link 지원
- 뒤로가기/공유 링크 동작
- disabled/not-ready 상태를 별도 카드로 분리
```

### Codex용 — Aligo exact-match preview API

```text
목표:
P3-S3의 실제 blocker인 exact-match mismatch를 UI에서 사전에 검증할 수 있는 preview API를 만든다.

필수 endpoint:
- POST /api/aligo/render-preview
- 입력:
  - templateCode
  - variables
  - buttons
  - mode: test | live
- 출력:
  - approvedTemplateRaw
  - renderedBody
  - renderedButtons
  - normalizedPayload
  - exactMatch: true/false
  - mismatchReasons[]
  - providerReady: true/false

추가 요구:
- history/:mid 응답과 연결 가능한 message log schema 정의
- crm_message_log 적재 shape 제안
- blocked reason:
  - consent
  - claim review
  - quiet hours
  - cooldown
  - suppression
  - fallback
  를 함께 반환

완료 기준:
- UI에서 send 전에 exactMatch 여부를 판단할 수 있다
- rslt=U 원인을 send 전 preview에서 먼저 잡을 수 있다
```

원하시면 다음 답변에서 제가 **`후속 관리`, `실험 운영`, `결제 귀속`, `알림톡 발송` 4개 탭별로 바로 개발 티켓 수준의 체크리스트**로 쪼개드리겠습니다.
