# Header Guard v3.1.1 Patch Plan

작성 시각: 2026-05-15 15:21 KST
목표: 결제완료 Browser Purchase가 실패 캐시에 막히지 않게 한다.
상태: 코드 초안/승인안 전 단계. 아임웹 Header 저장은 아직 하지 않는다.

## v3.1에서 유지할 것

- 기존 `fbq` wrapper chain
- 기존 Purchase Guard
- `requestTimeoutMs: 8000`
- `cache: 'no-store'`
- `keepalive: true`
- `VirtualAccountIssued`
- `PurchaseDecisionUnknown`
- `PurchaseBlocked`
- unknown fail-open 금지
- Block 4와 Footer는 건드리지 않음

## v3.1.1에서 바꿀 것

1. canonical cache key 도입
2. response shape tolerant parser 도입
3. fetch failure no-cache 또는 ultra-short-cache
4. failure가 allow cache를 덮어쓰지 못하게 함
5. cached allow_purchase가 있으면 즉시 original Purchase 통과
6. cached block/virtual_account는 기존 차단 유지

## 캐시 TTL 정책

| decision 종류 | cache 정책 | 이유 |
|---|---|---|
| `allow_purchase` | 2분 cache 허용 | 완료 페이지 재시도/중복 wrapper를 안정화 |
| `block_purchase_virtual_account` | 30초 이하 cache | 미입금/가상계좌는 계속 막되 결제 상태 변화 가능성 고려 |
| explicit `block_purchase` | 30초 이하 cache | 취소/환불/0원 등 명시 차단은 짧게 유지 |
| explicit server `unknown` | 5-10초 이하 cache | 서버 확인 실패나 지연 후 재시도 여지 남김 |
| `decision_fetch_failed` | 기본 no-cache | 네트워크 실패를 decision으로 보지 않음 |
| parse failure | 기본 no-cache | response shape 문제를 Purchase 차단 cache로 굳히지 않음 |

## cache write guard

```js
function isAllowPurchase(payload) {
  var decision = payload && payload.decision ? payload.decision : {};
  return decision.browserAction === 'allow_purchase' || decision.status === 'confirmed';
}

function isFetchFailure(payload) {
  var decision = payload && payload.decision ? payload.decision : {};
  return decision.reason === 'decision_fetch_failed' || payload.source === 'fetch_failed';
}

function cacheTtlMsFor(payload) {
  var decision = payload && payload.decision ? payload.decision : {};
  if (isAllowPurchase(payload)) return CONFIG.decisionCacheTtlMs;
  if (decision.browserAction === 'block_purchase_virtual_account') return 30000;
  if (decision.browserAction === 'block_purchase') return 30000;
  if (decision.status === 'unknown') return 10000;
  return 0;
}

function shouldOverwriteCache(current, next) {
  if (!next || !next.decision) return false;
  if (isFetchFailure(next)) return false;
  if (isAllowPurchase(next)) return true;
  if (current && isAllowPurchase(current)) return false;
  return cacheTtlMsFor(next) > 0;
}
```

## tolerant response parser

현재 서버는 `body.decision.browserAction`을 반환하므로 v3.1 parser와 맞다. 다만 운영 중 구조가 바뀌어도 막히지 않게 아래처럼 넓힌다.

```js
function extractDecision(responseBody) {
  var body = responseBody || {};
  var decision = body.decision || body.result || body.data || {};

  var browserAction = firstNonEmpty([
    body.browserAction,
    body.browser_action,
    decision.browserAction,
    decision.browser_action
  ]);

  var status = firstNonEmpty([
    body.status,
    decision.status
  ]);

  var reason = firstNonEmpty([
    body.reason,
    decision.reason,
    body.error,
    decision.error
  ]);

  return {
    status: status || 'unknown',
    browserAction: browserAction || 'hold_or_block_purchase',
    reason: reason || 'decision_missing',
    matchedBy: firstNonEmpty([body.matchedBy, body.matched_by, decision.matchedBy, decision.matched_by]),
    confidence: firstNonEmpty([body.confidence, decision.confidence])
  };
}
```

## writeDecisionCache v3.1.1 방향

```js
function writeDecisionCache(context, payload, source) {
  if (!payload || !payload.decision || !hasDecisionLookup(context)) return Promise.resolve(false);

  return buildSafeCacheKey(context).then(function (key) {
    try {
      var existing = readRawDecisionCacheByKey(key);
      var normalizedExisting = existing ? {
        decision: compactDecision(existing.decision || {}),
        safeRef: safeString(existing.safe_ref || existing.safeRef || fallbackSafeRef(context)),
        source: safeString(existing.source || 'session_cache')
      } : null;

      if (!shouldOverwriteCache(normalizedExisting, payload)) return false;

      var ttlMs = cacheTtlMsFor(payload);
      if (ttlMs <= 0) return false;

      var value = {
        snippetVersion: CONFIG.snippetVersion,
        cachedAt: new Date().toISOString(),
        expiresAt: Date.now() + ttlMs,
        safe_ref: payload.safeRef || fallbackSafeRef(context),
        source: source || payload.source || 'payment-decision',
        decision: compactDecision(payload.decision)
      };

      window.sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  });
}
```

## queryDecisionOnce v3.1.1 방향

```js
function queryDecisionOnce(context) {
  if (!hasDecisionLookup(context)) {
    return Promise.resolve(normalizeDecisionPayload({
      decision: {
        status: 'unknown',
        browserAction: 'hold_or_block_purchase',
        reason: 'missing_order_identifiers'
      }
    }, context, 'local_guard', 0));
  }

  return fetchWithTimeout(buildDecisionUrl(context), CONFIG.requestTimeoutMs)
    .then(function (response) {
      if (!response.ok || !response.body || response.body.ok !== true) {
        return normalizeDecisionPayload({
          decision: {
            status: 'unknown',
            browserAction: 'hold_or_block_purchase',
            reason: 'decision_endpoint_error',
            endpointStatus: response.status
          }
        }, context, 'endpoint_error', response.status);
      }
      return normalizeDecisionPayload(response.body, context, 'payment-decision', response.status);
    })
    .catch(function (error) {
      return normalizeDecisionPayload({
        decision: {
          status: 'unknown',
          browserAction: 'hold_or_block_purchase',
          reason: 'decision_fetch_failed',
          message: error && error.message ? error.message : safeString(error)
        },
        noCache: true
      }, context, 'fetch_failed', 0);
    });
}
```

## 적용 전 체크리스트

1. v3.1.1 string이 들어갔는지 확인한다.
2. old v3.1 string은 사라졌는지 확인한다.
3. 완료 URL에서 `payment-decision` 200 응답 body를 Network에서 확인한다.
4. sessionStorage cache가 `allow_purchase`면 `ev=Purchase`가 1회만 나와야 한다.
5. `decision_fetch_failed`는 2분 cache에 남으면 안 된다.
6. 미입금/가상계좌 테스트에서는 Purchase가 뜨면 안 된다.

## 운영 적용 승인 기준

v3.1.1은 아임웹 Header 코드 변경이다. Codex가 코드 초안을 만들 수 있지만, 아임웹 저장은 TJ님 외부 화면 작업이다.

승인 문구 예:

```text
[승인] Header Guard v3.1.1 canonical cache + failure no-cache 적용.
범위: 아임웹 Header의 server-payment-decision-guard-v3-1 블록만 교체.
금지: Block 4/Footer/GTM/Pixel 전체 재삽입/Meta send 변경.
성공 기준: confirmed 완료 페이지 Purchase 1회, 미입금 Purchase 0회.
```
