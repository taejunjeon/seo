# 02. payment-decision canceled 원인

작성 시각: 2026-05-15 11:48 KST

## 판정

**A+B+D**

- A. DECISION_BACKEND_SLOW_TIMEOUT
- B. DECISION_GUARD_ABORT_TOO_SHORT
- D. DECISION_ALLOWED_BUT_BROWSER_ABORTED

## 왜 이렇게 판단했나

Header Purchase Guard v3의 현재 설정:

- `requestTimeoutMs`: 3000ms.
- `holdMs`: 100ms.
- `decisionEndpoint`: VM Cloud `payment-decision`.
- 정책: confirmed면 Purchase 통과, pending/unknown/canceled면 Purchase를 낮추거나 차단.

실측:

- payment-decision directToss ON: 3.7-3.9초.
- payment-decision directToss OFF: 2.9-3.5초.
- TJ님 브라우저 Network: payment-decision request가 `canceled`로 표시됨.

즉, 서버는 `allow_purchase`를 만들 수 있었지만 브라우저 timeout 3초 안에 안정적으로 도착하지 않았다.

## 느린 이유

현재 VM Cloud backend의 `/api/attribution/payment-decision`은 아래 일을 순서대로 한다.

1. VM Cloud attribution ledger 전체를 읽는다.
2. 운영DB `tb_iamweb_users`를 조회한다.
3. Toss direct fallback을 조회한다.
4. 필요하면 ledger fallback으로 다시 Toss를 조회한다.
5. 그 뒤 decision을 만든다.

이 구조는 안전하지만 브라우저 Purchase 직전 가드로는 느리다.

## 운영DB sync gap

이번 건은 운영DB에서 0건이었다. 하지만 VM Cloud에는 결제완료 row가 있고 Toss direct는 confirmed를 반환했다. 따라서 운영DB 0건은 `데이터 없음`이 아니라 `source_freshness_gap`이다.

운영DB를 실시간 primary로 두면 카드 결제 직후 Purchase가 늦거나 빠질 수 있다. 실시간 복구는 VM Cloud 원장 + Toss direct + Imweb direct fallback으로 가야 한다.

## 분리 판정

- C. DECISION_NOT_REACHED_BACKEND: 아님. 같은 lookup으로 서버 200 응답이 확인됐다.
- E. DECISION_BLOCKED_CORRECTLY: 아님. 서버 decision은 `allow_purchase`였다.
- F. SERVER_CAPI_SENT_UI_DELAY: 아님. 대상 safe_ref의 Meta CAPI send log는 0건이다.

## 실패가 반복되는 조건

- 완료 페이지에서 FBE/native Purchase가 발생한다.
- Header Guard가 Purchase를 가로챈다.
- payment-decision이 3초 안에 오지 않는다.
- Guard가 request를 abort하거나, page lifecycle 중 fetch가 canceled 된다.
- 결과적으로 Browser Purchase가 안 나가고 Meta Pixel Helper에도 Purchase가 안 보인다.
