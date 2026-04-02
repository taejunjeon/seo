업로드한 4개 문서 확인했습니다. 총평부터 말하면, **방향은 좋아졌고 이번 수정으로 문서 품질이 한 단계 올라갔습니다.** 특히 `P1-S1A`를 “거의 됐다”가 아니라 **무엇이 검증됐고 무엇이 아직 안 됐는지**로 분리해 말하기 시작한 점이 가장 좋습니다. `replay/backfill`, `live / replay / smoke` 구분, `/crm` 분리 표시는 과장된 해석을 줄이는 데 큰 도움이 됩니다.  

## 10초 요약

* **좋아진 점:** P1-S1A가 훨씬 정직해졌고, Phase 0에 `lead / policy / claim / agent-readiness`를 넣은 것도 맞는 방향입니다. Phase 3도 `ChannelTalk 먼저, 알리고 나중` 순서가 현실적입니다.   
* **지금 가장 먼저 손볼 것:** 문서 버전 충돌 정리, 실제 고객 사이트 live row 연결, ChannelTalk live 기준선 닫기, 발송 hard gate 실행 코드화입니다. 이 4개가 먼저입니다.   

## 잘한 점

첫째, `P1-S1A`를 “replay는 배선 점검용, live만 원인 확정용”으로 나눈 건 아주 좋습니다. 이 구분이 없으면 smoke나 replay 수치를 live처럼 읽게 되고, 그러면 `(not set)` 해석이 바로 흔들립니다. 지금은 `replay 5`, `smoke 2`, `live 0`과 `replay 기준 toss join 5/5`가 명확히 구분돼 있습니다. 이건 실무적으로 매우 큰 개선입니다.  

둘째, `P0-S3`에서 `lead_id != customer_key`, `claim_review_status`, `agent_run_log` 계열을 설계에 넣은 건 맞습니다. 이건 보기엔 추상적인데, 나중에 에이전트가 헛소리하지 않게 만드는 바닥 공사입니다. 지금 넣는 게 맞습니다. 

셋째, `Phase 3`를 냉정하게 본 것도 좋습니다. 문서가 분명하게 말하듯이 지금은 **ChannelTalk는 거의 배선 끝**, **알리고는 아직 발송기 본체가 없다**가 사실에 가깝습니다. 이 정직함이 중요합니다. 

넷째, `Phase 2.5`를 따로 뺀 판단도 맞습니다. 지금 로드맵은 구매 이후는 강했는데, 익명 유입이 리드 자산으로 바뀌는 앞단이 비어 있었습니다. 그 빈칸을 별도 phase로 뺀 건 구조적으로 맞는 수정입니다. 

## 꼭 수정해야 하는 점

### 1) 문서 버전이 서로 충돌합니다

이건 바로 손봐야 합니다.

`Phase 1 메모(0330)`는 아직 `smoke 2건`, `join 0건`, `P1-S1A 90% / 20%` 상태를 말합니다. 반면 `codexfeedback_0331_2`와 최신 로드맵은 `replay 5건`, `live/replay/smoke 구분`, `P1-S1A 95% / 20%` 상태를 말합니다. 지금 상태로 두면 팀 안에서 누군가는 예전 숫자를 잡고 얘기하게 됩니다. **0330 문서는 archive 처리**하고, 최신 상태는 하나의 문서만 source of truth로 남겨야 합니다.   

### 2) 최신 로드맵 안에서도 우선순위와 담당이 엇갈립니다

같은 문서 안에 충돌이 있습니다.

상단 Phase 표에는 `P1-S1` 담당이 `Claude Code (로컬 SQLite)`로 적혀 있는데, 상세 `P1-S1` 설명은 `Codex` 기준으로 서술됩니다. 또 같은 문서의 `1-1 현재 기준 가장 파급력 큰 다음 액션`은 **Claude Code 상담 CRM 운영 화면**을 가장 큰 다음 액션으로 말하는데, 뒤의 `5-A-2 다음 2주 Codex 실행 순서`는 **P3-S1(ChannelTalk)**을 더 앞에 둡니다. 이건 실행 담당자에게 바로 혼선을 줍니다. **문서 안에서 owner와 next action을 하나로 통일해야 합니다.** 

### 3) “첫 라이브” 정의가 두 개입니다

이건 충돌처럼 보이지만, 사실은 목적이 다른 두 개를 하나의 말로 부르고 있어서 생긴 문제입니다.

`Phase 3 메모`는 첫 라이브 추천 시나리오를 **상담 완료 후 14일 미구매**로 둡니다. 이유는 식별과 연락처가 안정적이기 때문입니다. 반면 최신 로드맵은 첫 라이브 추천을 **checkout abandon holdout** 쪽에 더 두고 있습니다. 제 판단은 둘 다 맞지만 이름을 분리해야 합니다.

* **첫 operational live**: 상담 완료 후 14일 미구매
* **첫 gold-standard causal test**: checkout abandon holdout vs 6h/24h
  이렇게 나누면 충돌이 사라집니다.  

### 4) 발송 hard gate가 아직 “문서”에만 있고 “실행 코드”에 없습니다

이건 생각보다 위험합니다.

문서에는 `consent`, `claim review`, `quiet hours`, `suppression`, `channel priority`가 중요하다고 여러 번 적혀 있습니다. 그런데 최신 로드맵도 `P1-S1B`에서 claim review gate와 contact policy enforcement는 **계약만 있고 실행 로직은 아직 없다**고 적고 있고, `Phase 3 메모`도 같은 문제를 지적합니다. 이 상태에서 채널 실행이 먼저 붙으면, 운영은 돌아가는데 규정·측정·로그가 뒤처지는 구조가 됩니다. **Phase 3 실행 전에 공통 gate middleware부터 넣는 게 맞습니다.**  

### 5) Phase 2.5는 “설계는 지금”, “실운영은 한 템포 뒤”가 맞습니다

리드 마그넷 phase를 빼놓은 건 좋지만, 이걸 지금 바로 라이브로 밀면 앞단만 열리고 뒤가 안 붙습니다.

현재 문서상 `lead ledger`는 로컬에 추가됐지만 실제 적재는 아직 `0건`이고, ChannelTalk live baseline도 안 닫혔고, Aligo test mode도 아직입니다. 그래서 지금은 **P2.5-S1 장부/정책/결과 스키마까지** 하고, 진짜 트래픽을 태우는 건 `P1-S1A live row 1건`과 `ChannelTalk live event 1건` 이후가 맞습니다.  

## 제가 추천하는 실행 순서

### 지금 당장

1. **문서 source of truth 정리**

   * `Phase 1 메모(0330)`는 archive 표시
   * `로드맵 0331`를 기준 문서로 고정
   * 맨 위에 `last verified`, `owner`, `next action`, `blocked by` 4개만 넣기

2. **실제 고객 사이트 live row 연결**

   * 이게 지금 최우선 병목입니다.
   * DB write보다 먼저, 실제 repo의 checkout 시작점 / success 진입점 / server confirm 지점을 잡아야 합니다.  

3. **ChannelTalk live 기준선 1건**

   * `memberId = customer_key`
   * `product_view -> checkout_started -> order_paid` 중 최소 1건 live 확인
   * `marketing=false`인 상태면 “캠페인”과 “이벤트/식별”을 구분해서 닫기 

### 이번 주

4. **발송 hard gate 실행 코드**

   * `consent_status`
   * `claim_review_status`
   * `quiet_hours`
   * `suppression`
   * `channel priority / fallback`

5. **Aligo testMode 1건**

   * 운영 발송 말고 testMode
   * 템플릿 조회 → test send → 결과 조회 → 로그 적재
   * 여기까지 닫히면 `/crm` 발송 UI를 얹을 가치가 생깁니다. 

### 다음 배치

6. **P2.5 skeleton만 시작**

   * lead capture
   * result save
   * consent log
   * 상담 연결 CTA
   * 아직 대규모 paid 유입은 태우지 않기

## 한 줄로 정리하면

**지금은 “새 phase를 더 여는 시점”이 아니라, 이미 연 phase들의 마지막 배선을 닫는 시점입니다.**
특히 `live row`, `ChannelTalk live baseline`, `hard gate`, `Aligo testMode` 이 네 개가 먼저입니다. 그다음에야 리드 마그넷과 첫 라이브 실험이 자연스럽게 붙습니다.   

## 바로 복붙 가능한 프롬프트

### 1) Codex용 — 실제 고객 사이트 live row 삽입 패치

```text
목표:
실제 고객 사이트 repo에서 checkout-context / payment-success live row를 만들 수 있는 최소 patch를 설계하고 구현한다.

해야 할 일:
1. repo 전체에서 아래 4개 삽입 포인트를 찾는다.
   - begin_checkout 발화 지점
   - PG 결제 요청 지점
   - success URL 페이지 또는 client success handler
   - server-side payment confirm / webhook / approval handler
2. 각 삽입 포인트마다 파일경로, 함수명, 근거를 정리한다.
3. 아래 receiver를 실제로 호출하는 patch diff를 만든다.
   - POST /api/attribution/checkout-context
   - POST /api/attribution/payment-success
4. feature flag를 넣는다.
   - ATTRIBUTION_LIVE_ENABLED
5. payload 최소 필드를 보장한다.
   - checkout-context: checkoutId, customerKey, landing, referrer, gaSessionId, utm*, gclid/fbclid/ttclid
   - payment-success: orderId, paymentKey, approvedAt, checkoutId, customerKey, landing, referrer, gaSessionId, utm*, gclid/fbclid/ttclid
6. idempotency / retry / non-blocking error handling을 넣는다.
7. acceptance criteria를 작성한다.
   - main ledger에서 live payment_success > 0
   - paymentKey 또는 orderId 기준 toss join 성공
   - /api/crm-phase1/ops timeline에 live row 표시
   - GA4 DebugView에서 같은 결제의 begin_checkout -> purchase 확인

출력 형식:
- 삽입 포인트 목록
- patch diff
- env 목록
- QA checklist
- rollback plan

주의:
- live / replay / smoke 의미를 절대 섞지 말 것
- "(not set)=PG 리다이렉트"는 확정 문구로 쓰지 말 것
```

### 2) Codex용 — ChannelTalk 서버 레이어 마감

```text
목표:
P3-S1을 40%에서 80% 수준까지 끌어올린다.

구현 범위:
1. GET /api/crm/channeltalk/sync-preview
2. POST /api/crm/channeltalk/sync-users
   - dry_run / live 모드 분리
3. GET /api/crm/channeltalk/stale-users
4. POST /api/crm/channeltalk/campaign-preview

반드시 포함할 것:
- memberId = customer_key 규칙 고정
- memberHash optional 처리
- 누락 필드, 실패 사유, 중복 수, 샘플 오류 반환
- crm_message_log 또는 동등 로그 적재 구조
- page name / event name 계약을 API 응답에도 노출

검증 기준:
- 샘플 고객 10명 dry_run 결과 확인
- stale 사용자 목록 반환
- profile-preview / sync-preview / sync-users 응답 shape 일관성
- health/status와 충돌 없는지 확인
```

### 3) Claude Code용 — `/crm` 발송 UI

```text
목표:
/ crm 의 messaging 탭을 실제 운영 흐름에 맞게 구현한다.

UI 범위:
1. 대상자 미리보기
   - 세그먼트 선택
   - 발송 가능 여부
   - 제외 사유(consent, suppression, quiet hours, claim review)
2. 템플릿 선택
   - 승인 템플릿만 노출
   - 변수 치환 미리보기
3. test send
   - 1건 테스트를 먼저 강제
4. 결과 확인
   - 성공 수 / 실패 수 / 대표 실패 코드 / 최근 로그
5. 채널 선택
   - ChannelTalk / Aligo
   - 준비 안 된 채널은 disabled + 이유 표시

UX 원칙:
- test send 이전에는 실발송 버튼 비활성화
- 준비 안 된 env는 카드 상단에 명확히 표시
- 운영자가 "왜 지금 못 보내는지" 한 번에 알 수 있게 만들 것

출력:
- page.tsx 수정안
- 필요한 hook / type / component 제안
- empty / loading / error / not-ready 상태 정의
```

## 추가로 요청드리고 싶은 자료

이건 있으면 바로 patch 수준으로 좁힐 수 있습니다.

**Q1.** 실제 고객 사이트 repo에서 아래 4개 파일 경로만 주실 수 있나요?

* begin_checkout 발화 파일
* purchase 발화 파일
* PG success 페이지 또는 success handler 파일
* server-side payment confirm / webhook 파일

**Q2.** ChannelTalk는 현재 **이벤트 수집만 먼저 닫을지**, 아니면 **Campaign/marketing까지 바로 켤지** 결정 가능한가요? `memberHash secret` 존재 여부와 `marketing on/off`만 알려주시면 됩니다. 비밀값 자체는 필요 없습니다. 

**Q3.** Aligo는 승인 템플릿 1개라도 있나요? 있다면 **템플릿 코드와 변수 이름 목록만** 주시면 됩니다. 비밀키는 필요 없습니다. 그러면 `/crm` 발송 UI까지 훨씬 정확하게 설계할 수 있습니다. 

원하시면 다음 답변에서 제가 **문서 통합본 목차**까지 바로 짜드리겠습니다.
