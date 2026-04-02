# codexfeedback_0331_3 reply

기준일: 2026-04-01

## 읽는 법

이 문서는 `작업 로그와 검증 기록`을 남기는 changelog다.
최신 진행률, blocker, next action의 source of truth는 [roadmap0327.md](/Users/vibetj/coding/seo/roadmap0327.md)와 [phase3.md](/Users/vibetj/coding/seo/phase3.md)를 본다.

## 이번 턴 한 줄 결론

이번 턴은 `Phase 3 backend의 핵심 배선`을 실제 코드로 더 밀었다.
`ChannelTalk 서버 레이어 + 발송 hard gate + Aligo backend wrapper + Aligo 발송결과 조회`까지 구현했고, 지금 남은 핵심 blocker는 `실제 고객 사이트 live 삽입`과 `Aligo 템플릿 본문 exact-match`다.

## 이번 턴의 목표

1. Claude Code 담당 프론트를 제외하고 Codex가 할 수 있는 Phase 3 backend 범위를 최대한 닫는다.
2. 문서 충돌을 줄이고 source-of-truth를 다시 맞춘다.
3. 다음 사람이 바로 이어서 움직일 수 있게 blocker와 다음 행동을 분명히 적는다.

## 실제로 바뀐 것

### 1. Revenue backend에 ChannelTalk 실행 레이어를 추가했다

- 추가된 API
  - `GET /api/crm/channeltalk/sync-preview`
  - `POST /api/crm/channeltalk/sync-users`
  - `GET /api/crm/channeltalk/stale-users`
  - `POST /api/crm/channeltalk/campaign-preview`
- 추가된 실행 로직
  - `memberId = customer_key` 고정
  - `dry_run / live` 분리
  - `CHANNELTALK_LIVE_SYNC_ENABLED=false` 기본값
  - `stale user` 점검 query API
  - campaign preview 응답 shape

### 2. hard gate를 문서가 아니라 코드로 올렸다

- 새 파일:
  - `revenue/backend/app/services/crm_contact_policy_service.py`
- 실제 평가 항목:
  - `consent`
  - `claim review`
  - `quiet hours`
  - `cooldown`
  - `frequency cap`
  - `recent purchase suppression`
  - `recent consultation suppression`
  - `fallback channel`

### 3. SEO backend에 Aligo backend wrapper를 추가했다

- 새 파일:
  - `seo/backend/src/aligo.ts`
  - `seo/backend/src/routes/aligo.ts`
- 추가된 API
  - `GET /api/aligo/status`
  - `GET /api/aligo/health`
  - `GET /api/aligo/profiles`
  - `GET /api/aligo/templates`
  - `GET /api/aligo/quota`
  - `POST /api/aligo/test-send`
  - `GET /api/aligo/history`
  - `GET /api/aligo/history/:mid`
- env alias 추가
  - `ALIGO_Senderkey`
  - `ALIGO_KAKAOCHANNEL_ID`

### 4. 문서를 정리했다

- `Phase1.md`
  - source-of-truth 안내 추가
  - `live / replay / smoke` 최신 수치 반영
  - `P1-S1A 95% / 20%`로 수정
  - `P1-S1B hard gate 실행 코드 추가` 반영
- `roadmap0327.md`
  - `P1-S1 owner`를 Codex 기준으로 정리
  - `P1-S1B` hard gate 실행 코드 반영
  - `P3-S1 80%`, `P3-S3 80%`로 상향
  - `첫 operational live`와 `첫 gold-standard causal test` 용어를 분리
- `phase3.md`
  - 요약표를 최상단으로 이동
  - 스프린트별 `Codex / Claude Code` 역할을 분리
  - Aligo `IP whitelist 해소`와 `result history` 반영

### 5. 복사본 폴더를 만들었다

- 새 폴더:
  - `seo/codex/gptfile1/`
- 복사한 파일:
  - `roadmap0327.md`
  - `Phase1.md`
  - `phase3.md`
  - `codexfeedback_0331_2reply.md`

주의:
위 4개는 피드백 본문에서 직접 언급된 문서를 기준으로 복사했다.

## 실측 결과

### Revenue backend

- `python3 -m py_compile ...` 통과
- `pytest -q test_channeltalk_contract.py test_channeltalk_execution.py`
  - 결과: `7 passed`

### SEO backend

- `npm --prefix backend run typecheck` 통과
- `node --import tsx --test tests/aligo.test.ts`
  - 결과: `1 passed`

### 런타임 스모크

- `GET http://localhost:7020/health`
  - `aligo.apiKey = true`
  - `aligo.userId = true`
  - `aligo.senderKey = true`
  - `aligo.senderPhone = true`
  - `aligo.kakaoChannelId = true`
  - `aligo.ready = true`
- `GET http://localhost:7020/api/aligo/health`
  - HTTP `200`
  - provider body `code = 0`
- `GET http://localhost:7020/api/aligo/templates`
  - HTTP `200`
  - 승인 템플릿 `42개`, 반려 `3개`
- `GET http://localhost:7020/api/aligo/quota`
  - HTTP `200`
  - `ALT_CNT = 38119`
- `POST http://localhost:7020/api/aligo/test-send`
  - HTTP `200`
  - provider body `code = 0`
  - 테스트 모드 전송 요청 성공
- `GET http://localhost:7020/api/aligo/history?startDate=2026-03-31&endDate=2026-04-01`
  - HTTP `200`
  - 최근 발송 내역 조회 성공
  - provider는 현재 `limit` 파라미터를 무시하고 `50 rows/page`로 응답하는 것으로 보임
- `GET http://localhost:7020/api/aligo/history/1306113822`
  - HTTP `200`
  - 실제 발송 1건의 상세 결과 조회 성공
  - 최종 결과 `rslt = U`
  - 사유: `메시지가 템플릿과 일치하지않음`

## 무엇이 증명됐는가

1. ChannelTalk는 이제 `문서 계약`이 아니라 `실행 가능한 backend contract`까지 올라왔다.
2. hard gate는 더 이상 메모가 아니라 코드로 평가할 수 있다.
3. Aligo는 더 이상 `키가 없어서 못 붙는 단계`도, `IP가 막혀서 못 붙는 단계`도 아니다.
4. 현재 Aligo blocker는 자격증명이 아니라 `승인 템플릿 본문 exact-match`라는 것이 실제 발송 결과 조회로 드러났다.
5. `Phase1.md`, `roadmap0327.md`, `phase3.md`의 충돌이 줄었다.

## 아직 증명되지 않은 것

1. ChannelTalk live 이벤트 1건
   - 이유: 실제 고객 사이트에 `boot / updateUser / track`가 아직 live 삽입되지 않았다.
2. ChannelTalk campaign 실발송
   - 이유: `marketing=false`라 campaign send는 아직 blocked다.
3. Aligo live delivered 1건 성공
   - 이유: 발송 요청은 받아들여졌지만 실제 결과 조회에서 `rslt=U`, `메시지가 템플릿과 일치하지않음`이 확인됐다.
4. Revenue backend 실데이터 smoke
   - 이유: 이 workspace의 `revenue/backend`에는 현재 local env가 없어 read-only DB 실측을 바로 붙이지 못했다.

## 이 결과가 프로젝트에 주는 도움

1. Phase 3은 이제 `채널 준비 여부`를 말로 설명하는 단계가 아니라, API로 readiness와 blocker를 바로 보여주는 단계가 됐다.
2. Claude Code는 이제 추상 문서가 아니라 실제 backend contract를 기준으로 `/crm` 발송 UI와 고객 사이트 삽입을 진행할 수 있다.
3. 운영팀은 Aligo에서 무엇이 부족한지 막연히 찾지 않고, 이제 `정확한 템플릿 렌더링`과 `버튼/변수 일치`를 닫아야 한다는 걸 알 수 있다.
4. Phase 7 실험으로 넘어가기 전에 `발송 가능 여부`를 코드로 막을 수 있어, 나중에 정책 사고를 줄일 수 있다.

## 다음 행동

### 지금 바로 해야 하는 것

1. 실제 고객 사이트에 ChannelTalk `boot / updateUser / track`를 넣어 live 이벤트 1건을 만든다.
2. 승인된 Aligo 템플릿 코드 1개를 기준으로 본문/버튼을 exact-match로 렌더링한다.
3. `history/:mid` 결과를 send log와 함께 저장하는 최소 원장을 만든다.

### 이번 주에 이어서 할 것

1. ChannelTalk `marketing=true` 전환 가능 여부 확인
2. Aligo `template list -> quota -> testMode send -> history detail` 순서로 실검증
3. `/crm` 발송 탭에서 disabled/not-ready 상태부터 UI 명세 확정

### 그다음 주요 사항

1. `P1-S1A live row`를 실제 고객 사이트에서 붙이는 일
   - 이유: `(not set)` 원인 확정과 checkout abandon causal test의 신뢰가 이 위에 달려 있다.
2. `P3-S2` live 삽입 완료
   - 이유: 지금 backend는 준비됐고, 실제 event가 들어와야 Phase 3이 진짜 닫힌다.
3. `P3-S3` live delivered 1건 성공
   - 이유: 지금은 요청 접수까지만 확인됐고, 실제 전달 성공까지 닫혀야 `/crm` 발송 UI를 운영용으로 여는 게 안전하다.
4. `Phase 1 message log`와 `Phase 3 send log` 연결
   - 이유: 나중에 메시지 발송과 실제 매출을 같은 실험 원장으로 읽어야 한다.

## 2026-04-01 추가 업데이트

### 새로 붙인 것

- `GET /api/aligo/history`
- `GET /api/aligo/history/:mid`

### 오늘 실측으로 확인한 것

1. Aligo 서버 IP whitelist는 닫혔다.
2. `templates / quota / testMode send / history list / history detail`이 모두 실제 provider 응답으로 닫혔다.
3. 방금 TJ님 요청으로 보낸 실제 1건은 `mid=1306113822`로 history에서 추적됐다.
4. 다만 최종 delivery result는 `rslt=U`였고, 이유는 `메시지가 템플릿과 일치하지않음`이었다.

### 해석

- `발송 요청 성공`과 `최종 전달 성공`은 다른 단계다.
- 지금은 `request accepted`까지는 닫혔고, `delivered`는 아직 아니다.
- 따라서 `P3-S3`의 다음 정확한 과제는 `템플릿 변수/본문/버튼 exact-match renderer`다.

## 참고

- `gptfile1` 복사본은 현재 최신 문서 상태를 기준으로 만들었다.
- 이번 턴은 Codex 범위만 진행했다. 프론트 실제 페이지 삽입과 `/crm` 발송 UI는 Claude Code 영역으로 남겼다.
