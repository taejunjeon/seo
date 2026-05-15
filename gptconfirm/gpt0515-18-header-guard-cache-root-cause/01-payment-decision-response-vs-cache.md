# Payment-Decision Response vs Cache

작성 시각: 2026-05-15 15:21 KST
범위: VM Cloud read-only 로그 + 로컬 Header Guard v3.1 코드 분석
raw identifier 출력: 0

## 결론

`payment-decision` 서버는 요청을 받고 200을 반환하는 경우가 확인됐다. 동시에 같은 시간대에 browser abort로 끝난 요청도 있었다. Header Guard v3.1은 abort/fetch failure를 `decision_fetch_failed`로 바꾼 뒤 일반 decision처럼 2분 캐시에 저장한다. 따라서 사용자가 본 cache value는 서버가 `unknown`을 정상 반환해서 생겼다기보다, 브라우저 fetch 실패가 캐시로 남았을 가능성이 더 높다.

## 확인한 서버 로그

최근 payment-decision 80건 aggregate:

| 항목 | 값 |
|---|---:|
| request completed | 71 |
| request aborted | 9 |
| HTTP 200 | 71 |
| status null / aborted | 9 |
| responseTime 3초 초과 | 66 |
| camelCase request | 47 |
| snake_case request | 33 |
| payment_key 포함 | 23 |
| order_id 포함 | 23 |

최근 패턴:

- 빠른 200 응답이 있었다. 일부 요청은 약 36-39ms에 200을 반환했다.
- 느린 200 응답도 있었다. 일부 요청은 6-18초대까지 걸렸다.
- aborted 요청도 있었다. 일부 aborted 요청은 4-5초대에 끊겼다.
- 같은 시간대에 `camelCase` 요청과 `snake_case` 요청이 동시에 보였다.

## 200 OK가 allow_purchase였는가?

로그만으로는 100% 확정할 수 없다. VM Cloud request log에는 response body가 남지 않고, HTTP status/content-length/latency만 남는다.

다만 아래 사실 때문에 response shape 문제보다는 브라우저 캐시 정책 문제가 더 유력하다.

1. 현재 서버 route는 `decision.browserAction` 구조로 응답한다.
2. Header Guard v3.1 `normalizeDecisionPayload`는 `responseBody.decision.browserAction`을 읽는다.
3. 사용자가 본 `decision_fetch_failed`는 서버 response body의 일반 reason이 아니라, v3.1 fetch catch branch에서 생성되는 reason이다.
4. VM Cloud 로그에 실제 `request aborted`가 남아 있다.

판정:

- `SERVER_RETURNED_ALLOW_BUT_FRONT_CACHE_FAILED`: 가능성 있음, response body 미로그 때문에 확정은 아님.
- `SERVER_RETURNED_UNKNOWN_CORRECTLY`: 낮음. cache reason이 `decision_fetch_failed`라 서버 정상 unknown 응답과 다르다.
- `CANCELED_REQUEST_OVERWROTE_ALLOW_CACHE`: 높음.
- `RESPONSE_SHAPE_PARSE_BUG`: 낮음. 현재 서버 응답과 v3.1 parser는 기본 구조가 맞다.

## cache value가 decision_fetch_failed가 된 직접 이유

v3.1 code path:

```js
fetchWithTimeout(...)
  .then(...)
  .catch(function (error) {
    return normalizeDecisionPayload({
      decision: {
        status: 'unknown',
        browserAction: 'hold_or_block_purchase',
        reason: 'decision_fetch_failed'
      }
    }, context, 'fetch_failed', 0);
  });
```

그 뒤:

```js
return queryDecision(context).then(function (payload) {
  return writeDecisionCache(context, payload, source).then(function () {
    return payload;
  });
});
```

즉 fetch가 실패해도 `payload`가 만들어지고, `writeDecisionCache`로 들어간다.

## 문제

실패는 decision이 아니다. 하지만 v3.1은 실패도 decision처럼 취급한다. 그래서 completion page에서 한 번 canceled가 나면 다음 Purchase attempt가 2분 동안 cached unknown/block을 보고 Purchase를 막을 수 있다.

## v3.1.1 방향

1. `decision_fetch_failed`는 기본적으로 캐시하지 않는다.
2. 이미 `allow_purchase` cache가 있으면 failure가 덮어쓰지 못하게 한다.
3. explicit server block/virtual_account만 짧게 캐시한다.
4. network/parse failure는 5-10초 이하 또는 no-cache로 둔다.
5. response parser는 현재 shape 외에도 `body.browserAction`, `body.result.browserAction`을 읽도록 넓힌다.
