# Phase 3 메모

기준일: 2026-03-31

## 스프린트 요약표

이 표가 Phase 3의 현재 source of truth다.
원칙은 단순하다. `Codex = 백엔드`, `Claude Code = 프론트`다.

| Sprint | 담당 | 무엇을 하는가 | 우리 기준 | 운영 기준 | 지금 확인된 것 | 가장 큰 blocker | 다음 행동 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [P3-S1](#p3-s1-channeltalk-서버-레이어--codex) | Codex | ChannelTalk 식별 규칙, sync API, campaign preview, hard gate | `80%` | `20%` | Revenue 백엔드에 `sync-preview / sync-users / stale-users / campaign-preview`가 생겼고 `memberId = customer_key` 규칙이 API 응답으로 고정됐다 | 실제 고객 사이트 live 삽입과 `marketing=false` 상태 | P3-S2와 묶어 실제 페이지 이벤트 1건을 만든다 |
| [P3-S2](#p3-s2-channeltalk-프론트-실연동--claude-code) | Claude Code | 고객 사이트에 boot/setPage/track/updateUser를 실제로 심는다 | `90%` | `20%` | 프론트 래퍼와 Provider는 이미 있다 | 실제 고객 사이트 배포와 live QA | 상품/체크아웃/구매완료 이벤트를 실페이지에 삽입한다 |
| [P3-S3](#p3-s3-알리고-백엔드-발송기--codex) | Codex | 알리고 상태 확인, 템플릿 조회, quota 조회, test-mode 발송 wrapper | `55%` | `10%` | `7020 /health`에서 env는 모두 읽히고 `status/health/templates/quota/test-send` route가 생겼다 | Aligo provider가 `인증되지 않는 서버 IP`로 차단 | 서버 IP whitelist와 승인 템플릿 코드를 받아 testMode 1건을 성공시킨다 |
| [P3-S4](#p3-s4-crm-발송-화면--claude-code) | Claude Code | `/crm`에서 대상 선택 → 템플릿 선택 → 테스트 발송 → 결과 확인 UI | `0%` | `0%` | placeholder만 있다 | P3-S3 backend contract와 운영 정책 미완료 | Codex backend 기준으로 disabled/not-ready 상태부터 붙인다 |

## 상단 10초 요약

Phase 3의 목적은 `실험 장부에서 고른 대상`에게 `실제로 메시지를 보내는 채널`을 붙이는 것이다.
지금 결론은 명확하다. `ChannelTalk backend는 거의 닫혔고`, `Aligo backend는 wrapper까지는 올라왔지만 provider IP 차단 때문에 운영 검증이 막혀 있다`.
따라서 다음 행동은 `P3-S2 실제 페이지 삽입`과 `Aligo IP whitelist` 두 개다.

## 문서 목적

이 문서는 Phase 3에서 무엇이 실제로 구현됐고, 무엇이 아직 막혀 있으며, Codex와 Claude Code가 어디서 역할을 나눠야 하는지를 같은 언어로 정리한다.

## 이 단계가 하는 일

Phase 1이 `점수판`이면 Phase 3은 `방송실`이다.

- 점수판은 누가 실험군이고 누가 샀는지를 기록한다.
- 방송실은 그 대상에게 실제로 말을 거는 채널을 붙인다.
- 여기서 다루는 채널은 `ChannelTalk`와 `알리고`다.

즉, 이 단계는 `세그먼트 선택 -> 채널 실행 -> 발송 로그 -> 매출 연결`의 앞 절반을 만든다.

## 왜 필요한가

이 단계가 없으면 실험 장부는 있어도 실제 액션이 나가지 않는다.

- ChannelTalk 식별이 흐리면 `같은 고객`과 `같은 세션`을 한 키로 묶지 못한다.
- 알리고 발송기가 없으면 한국형 대규모 후속 메시지를 운영 화면에서 실행할 수 없다.
- hard gate가 없으면 수신동의, quiet hours, claim review가 코드가 아니라 사람 기억에 의존하게 된다.

즉, Phase 3은 `숫자를 만드는 버튼`을 붙이는 단계다.

## 현재 상태

### 확인된 것

- Revenue 백엔드에는 아래 ChannelTalk API가 있다.
  - `GET /api/crm/channeltalk/status`
  - `GET /api/crm/channeltalk/contract`
  - `GET /api/crm/channeltalk/profile-preview`
  - `GET /api/crm/channeltalk/sync-preview`
  - `POST /api/crm/channeltalk/sync-users`
  - `GET /api/crm/channeltalk/stale-users`
  - `POST /api/crm/channeltalk/campaign-preview`
- `crm_contact_policy_service.py`가 추가돼 `consent`, `claim review`, `quiet hours`, `cooldown`, `frequency cap`, `recent purchase suppression`, `fallback`을 코드로 평가한다.
- SEO 백엔드에는 아래 Aligo API가 있다.
  - `GET /api/aligo/status`
  - `GET /api/aligo/health`
  - `GET /api/aligo/profiles`
  - `GET /api/aligo/templates`
  - `GET /api/aligo/quota`
  - `POST /api/aligo/test-send`
- `7020 /health` 기준 Aligo env는 모두 읽힌다.
  - `apiKey = true`
  - `userId = true`
  - `senderKey = true`
  - `senderPhone = true`
  - `kakaoChannelId = true`
  - `ready = true`
- 실제 Aligo provider 호출은 `code=-99`, `인증되지 않는 서버 IP`로 막힌다.
- ChannelTalk 프론트 래퍼는 이미 있다.
  - `boot`
  - `shutdown`
  - `setPage`
  - `track`
  - `updateUser`

### 아직 안 된 것

- ChannelTalk `memberId = customer_key` 규칙이 실제 고객 사이트 live 트래픽에서 끝까지 검증되지는 않았다.
- `track`와 `updateUser`가 실제 상품/장바구니/체크아웃/구매완료 흐름에 다 심겨 있지 않다.
- ChannelTalk는 `marketing=false`라 campaign 실발송은 아직 blocked다.
- Aligo는 env와 wrapper는 준비됐지만 provider IP whitelist가 안 닫혀 있어 template/quota/test send 실검증이 막힌다.
- 발송 로그를 Phase 1 실험 원장과 직접 조인하는 운영 연결은 아직 없다.

### 지금 막힌 이유

- 실제 고객 사이트 배포와 live QA는 이 workspace 안에서 혼자 끝낼 수 없다.
- Aligo는 키 문제가 아니라 provider가 허용한 서버 IP에서 호출해야 한다.
- 승인 템플릿 코드가 없으면 testMode 발송도 마지막 단계까지 닫히지 않는다.

## 권장 순서

### 1. ChannelTalk live baseline부터 닫아야 한다

이미 backend contract와 hard gate는 크게 올라왔다.
따라서 지금 Phase 3에서 가장 가치가 큰 일은 `P3-S2 실제 페이지 삽입`이다.

### 2. Aligo는 IP whitelist부터 닫아야 한다

지금은 키가 없어서 못 가는 단계가 아니다.
서버 IP 허용이 안 되어 provider가 `-99`로 막는 단계다.

### 3. UI는 backend blocker가 정리된 뒤에 올려야 한다

`P3-S4`를 먼저 만들면 운영자가 눌러도 안 되는 버튼만 늘어난다.
따라서 순서는 `P3-S1 -> P3-S2 -> P3-S3 -> P3-S4`가 맞다.

## P3-S1 ChannelTalk 서버 레이어 | Codex

### 결론

`P3-S1`은 이제 `규칙 책자` 수준을 넘어 `실행용 지시서`까지 올라왔다.
아직 100%가 아닌 이유는 실제 고객 사이트 live 이벤트와 marketing on 상태가 남아 있기 때문이다.

### 무엇을 하는가

- `memberId = customer_key`를 고정한다.
- `sync-preview / sync-users / stale-users / campaign-preview`를 만든다.
- 발송 hard gate를 코드로 평가한다.

### 이번 턴 실제로 바뀐 것

- Revenue 백엔드 service와 route 추가
  - `sync-preview`
  - `sync-users`
  - `stale-users`
  - `campaign-preview`
- `dry_run`과 `live`를 분리했다.
- `CHANNELTALK_LIVE_SYNC_ENABLED=false` 기본값을 추가해 실수로 live sync가 바로 실행되지 않게 막았다.
- `contact policy`를 별도 service로 분리했다.

### 왜 도움이 되는가

- 운영자는 실제 sync 전에 어떤 payload가 나갈지 본다.
- 실발송 전에 누가 `consent`, `quiet hours`, `suppression` 때문에 막히는지 코드로 본다.
- Claude Code는 이 응답 shape를 그대로 `/crm` 발송 UI와 고객 사이트 연결에 재사용할 수 있다.

### 남은 일

- 실제 고객 사이트에 `boot / updateUser / track`를 넣어 live 이벤트 1건 확인
- `CHANNELTALK_MARKETING_ENABLED=true` 전환 여부 확인
- `CHANNELTALK_MEMBER_HASH_SECRET`가 있으면 memberHash까지 닫기

## P3-S2 ChannelTalk 프론트 실연동 | Claude Code

### 결론

`P3-S2`는 전선은 깔렸고 스위치를 아직 안 켠 상태다.

### Claude Code가 해야 하는 일

- 실제 페이지에 `boot` 삽입
- 로그인/상담완료/주문완료 시점에 `updateUser` 삽입
- 상품 조회/장바구니/체크아웃/구매완료 시점에 `track` 삽입
- `page name` 규칙을 실제 라우트에 매핑

### Codex가 이미 넘긴 것

- `memberId = customer_key` 규칙
- `page name` 규칙
- `event name` 규칙
- `campaign-preview`와 hard gate 응답 shape

## P3-S3 알리고 백엔드 발송기 | Codex

### 결론

`P3-S3`는 이제 `발신프로필만 있는 단계`는 지났다.
env 인식, status/health, template/quota/test-send wrapper까지는 올라왔고, 현재 blocker는 provider IP whitelist다.

### 무엇을 하는가

- 알리고 자격증명과 발신프로필 상태를 읽는다.
- 템플릿과 quota를 조회한다.
- testMode 발송을 준비한다.

### 이번 턴 실제로 바뀐 것

- SEO 백엔드에 `aligo.ts` 추가
- SEO 백엔드 route 추가
  - `status`
  - `health`
  - `profiles`
  - `templates`
  - `quota`
  - `test-send`
- env alias 추가
  - `ALIGO_Senderkey`
  - `ALIGO_KAKAOCHANNEL_ID`

### 실측 결과

- `GET /health`에서 Aligo readiness는 `true`
- `GET /api/aligo/health` 결과:
  - HTTP `200`
  - provider body `code=-99`
  - 메시지: `인증되지 않는 서버 IP로 부터의 호출 입니다.`
- `GET /api/aligo/templates`
  - 같은 이유로 provider 차단
- `GET /api/aligo/quota`
  - 같은 이유로 provider 차단

### 이 결과가 주는 의미

- 더 이상 `키가 없어서 안 된다`는 단계는 아니다.
- 지금 운영팀 또는 개발팀이 닫아야 하는 것은 `서버 IP whitelist`와 `승인 템플릿 코드`다.
- 이 두 개만 닫히면 `testMode=Y` 기준 1건 발송 검증으로 바로 넘어갈 수 있다.

## P3-S4 CRM 발송 화면 | Claude Code

### 결론

`P3-S4`는 아직 시작 전이다.
다만 지금은 무엇을 기다려야 하는지가 분명하다.

### Claude Code가 기다리는 backend 계약

- `sync-preview` 결과
- `campaign-preview` 결과
- Aligo `templates / quota / test-send` 응답
- hard gate blocked reason 목록

### 먼저 만들면 안 되는 이유

- backend blocker가 남은 상태에서 UI를 먼저 만들면 disabled 상태 설명만 늘어난다.
- 따라서 `P3-S3 testMode 1건` 성공 전까지는 `not-ready UI` 설계까지만 가는 것이 맞다.

## 첫 라이브 용어 정리

- 첫 operational live:
  - `상담 완료 후 14일 미구매` 시나리오를 실제 채널로 한 번 돌려 보는 것
- 첫 gold-standard causal test:
  - `checkout abandon holdout vs 6h/24h` 실험을 증분 기준으로 읽는 것

이 둘은 목적이 다르다.
Phase 3은 먼저 `operational live`를 여는 단계다.

## 다음 액션

### 지금 당장

1. Claude Code가 실제 고객 사이트에 ChannelTalk `boot / updateUser / track`를 넣는다.
2. 개발팀이 Aligo 서버 IP whitelist를 연다.
3. 운영팀이 승인된 알리고 템플릿 코드 1개를 확정한다.

### 이번 주

1. ChannelTalk live 이벤트 1건 확인
2. Aligo `template list -> quota -> testMode send` 순서로 실검증
3. `/crm` 발송 UI에 필요한 disabled/not-ready 상태 정의

### 운영 승인 후

1. ChannelTalk marketing on 여부 결정
2. Phase 1 메시지 로그와 Phase 3 발송 로그 연결
3. 첫 operational live 실행

## 개발 부록

### Codex가 이번 턴에 추가한 backend 산출물

- Revenue backend
  - `app/services/crm_contact_policy_service.py`
  - `app/services/channeltalk_service.py`
  - `app/api/crm.py`
- SEO backend
  - `src/aligo.ts`
  - `src/routes/aligo.ts`
  - `src/env.ts`
  - `src/server.ts`

### 검증

- Revenue backend
  - `python3 -m py_compile ...`
  - `pytest -q test_channeltalk_contract.py test_channeltalk_execution.py`
- SEO backend
  - `npm run typecheck`
  - `node --import tsx --test tests/aligo.test.ts`
  - `curl http://localhost:7020/health`
  - `curl http://localhost:7020/api/aligo/health`

### 현재 blocker 한 줄 요약

- ChannelTalk: live 페이지 삽입이 남았다
- Aligo: provider 서버 IP whitelist가 남았다
