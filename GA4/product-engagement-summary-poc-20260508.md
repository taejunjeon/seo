# ProductEngagementSummary POC — 50% scroll + visible_seconds 정확 측정

작성 시각: 2026-05-08 01:25 KST
대상: biocom (확장 후보: thecleancoffee, aibio)
문서 성격: Green Lane 설계 POC. 운영 구현은 별 Yellow 승인.
관련 문서: [[gtm]], [[../gdn/channel-funnel-quality-meta-google-organic-20260508]], [[../data/!bigquery_new]], [[product-engagement-summary-contract-20260505]]
Status: design / no-implementation
Do not use for: 운영 구현, GA4/Meta/Google Ads 전송, GTM publish, 운영 DB write, 광고 변경

```yaml
harness_preflight:
  lane: Green design POC (no-implementation, no-write, no-send)
  allowed_actions:
    - 설계 작성
    - 필드 정의
    - 파생 지표 정의
    - 금지선 명시
  forbidden_actions:
    - 운영 backend 구현
    - GTM publish
    - GA4/Meta/Google Ads 전송
    - 운영 DB write
    - PII / value / order 저장
    - GA4 Enhanced Measurement scroll 90% 변경
  source_window_freshness_confidence:
    source: "GA4 BigQuery raw 측정 결과 + GTM live v142 trigger 11 read + ontology"
    window: "2026-05-08 KST"
    freshness: "본 sprint Channel Funnel Quality 결과 직접 입력"
    confidence: 0.85
```

## 5줄 결론

1. GA4 Enhanced Measurement scroll 이벤트는 90% 도달 시 1회만 fire. **50% scroll은 raw에 없음**.
2. GTM live v142 의 scrollDepth trigger `[11]` (10/25/50/75/90 threshold)은 **firing tag 미연결 상태** (이전 read [[gtm]] §"체류시간/스크롤 확인" 결과).
3. 본 POC는 **클라이언트 collector + 서버 receiver no-send/no-write 설계**. 즉 paid_click_intent 와 동일 패턴 (canary 가 검증된 receiver 패턴).
4. 저장 필드: `visible_seconds`, `max_scroll_percent`, `page_path`, `product_idx`, `client_id`, `session_id`. **PII / value / order / payment / currency 절대 금지**.
5. 파생 지표: `engaged_view (visible_seconds≥45 AND max_scroll≥50)`, `deep_view (visible_seconds≥90 AND max_scroll≥75)`. 광고 플랫폼 송출 절대 금지 (read-only 분석 전용).

## 1. 문제 정의

### 현재 상태

| 측정 | 가능? | 출처 |
|---|---|---|
| 90% scroll 도달 (1회) | ✅ | GA4 Enhanced Measurement `scroll` event |
| 50% scroll 도달 | ❌ | GA4 raw 없음. GTM trigger [11]은 fire되나 firing tag 미연결 |
| 75% scroll 도달 | ❌ | 동일 |
| max scroll % per session/product | ❌ | 직접 측정 불가 |
| visible seconds (실제 화면 노출) | ❌ | engagement_time_msec 으로 부분 측정. 1초 미만 빠른 스크롤 정확 아님 |
| product 단위 attention | ❌ | view_item event는 fire되지만 시간/깊이 측정 누락 |

### 본 POC 목표

biocom Channel Funnel Quality 분석 [[../gdn/channel-funnel-quality-meta-google-organic-20260508]] 에서 paid_tiktok 의 avg_engagement 1초 같은 광고 품질 신호를 정량으로 잡으려면 **상품 페이지 단위 visible_seconds + max_scroll_percent** 가 필요.

## 2. POC 설계 — `ProductEngagementSummary` no-send/no-write 패턴

### 2.1 클라이언트 collector (imweb body 또는 GTM Custom HTML tag)

```javascript
(function() {
  if (window.__pesCollectorMounted) return;
  window.__pesCollectorMounted = true;

  // Page-scoped state
  const state = {
    visible_ms: 0,
    max_scroll_percent: 0,
    last_visible_at: null,
    page_path: location.pathname.slice(0, 200),
    product_idx: new URLSearchParams(location.search).get('idx') || '',
    client_id: getGaClientId(), // GA4 _ga cookie
    ga_session_id: getGaSessionId(), // _ga_<container> cookie
  };

  // visibility tracking (visibilitychange)
  function tickVisible() {
    if (state.last_visible_at) {
      state.visible_ms += Date.now() - state.last_visible_at;
      state.last_visible_at = document.visibilityState === 'visible' ? Date.now() : null;
    }
  }
  document.addEventListener('visibilitychange', tickVisible);
  if (document.visibilityState === 'visible') state.last_visible_at = Date.now();

  // scroll tracking (throttled 200ms)
  let scrollScheduled = false;
  function onScroll() {
    if (scrollScheduled) return;
    scrollScheduled = true;
    setTimeout(() => {
      scrollScheduled = false;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const pct = Math.min(100, Math.round(window.scrollY / docHeight * 100));
      if (pct > state.max_scroll_percent) state.max_scroll_percent = pct;
    }, 200);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // Send on pagehide / beforeunload (single shot)
  let sent = false;
  function flush(reason) {
    if (sent) return;
    tickVisible();
    sent = true;
    const payload = {
      site: 'biocom',
      page_path: state.page_path,
      product_idx: state.product_idx.slice(0, 50),
      visible_seconds: Math.round(state.visible_ms / 1000),
      max_scroll_percent: state.max_scroll_percent,
      client_id: state.client_id,
      ga_session_id: state.ga_session_id,
      reason,
      // 절대 보내지 않는 필드: email, phone, name, address, order_number, payment_key, value, currency, raw query, full url
    };
    // Beacon API for reliable send on unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/attribution/product-engagement/no-send', new Blob([JSON.stringify(payload)], {type: 'application/json'}));
    } else {
      fetch('/api/attribution/product-engagement/no-send', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload), keepalive: true});
    }
  }
  window.addEventListener('pagehide', () => flush('pagehide'));
  window.addEventListener('beforeunload', () => flush('beforeunload'));
})();
```

핵심:
- `visibilitychange` 로 실제 화면 노출 시간만 측정 (탭 백그라운드 제외)
- scroll throttle 200ms
- `pagehide` / `beforeunload` 에서 1회 flush (sendBeacon 우선)
- payload 에 PII / value / order / payment / currency 절대 포함 안 함

### 2.2 서버 receiver

`backend/src/routes/attribution.ts` 에 `POST /api/attribution/product-engagement/no-send` 추가. 패턴은 `paid_click_intent/no-send` 와 동일:

```typescript
// 의사코드
router.post("/api/attribution/product-engagement/no-send", (req, res) => {
  const body = parseBody(req.body);
  const blockReasons = ["read_only_phase", "approval_required"];

  // PII / order / payment guard (paid-click-intent와 동일 reject set 재사용)
  const rejected = findRejectedField(body); // email, phone, order_number, payment_key, value, currency 등
  if (rejected) {
    return res.status(400).json({ ok: false, ...noSendGuardAliases, reason: "pii_or_order_or_payment_field_detected", block_reasons: [...blockReasons, "pii_detected"], rejectedField: rejected });
  }

  // body size guard (예: 4KB 미만)
  if (estimateJsonSizeBytes(body) > PRODUCT_ENGAGEMENT_BODY_LIMIT_BYTES) {
    return res.status(413).json({ ok: false, error: "payload_too_large" });
  }

  // sanitize
  const preview = {
    site: body.site || "biocom",
    page_path: sanitizePath(body.page_path),
    product_idx: extractIdxOrEmpty(body.product_idx),
    visible_seconds: clamp(Number(body.visible_seconds), 0, 3600),
    max_scroll_percent: clamp(Number(body.max_scroll_percent), 0, 100),
    client_id: String(body.client_id || "").slice(0, 200),
    ga_session_id: String(body.ga_session_id || "").slice(0, 120),
    captured_at: new Date().toISOString(),
    // 파생 지표
    engaged_view: visible_seconds >= 45 && max_scroll_percent >= 50,
    deep_view:    visible_seconds >= 90 && max_scroll_percent >= 75,
    scroll_50_reached: max_scroll_percent >= 50,
    scroll_75_reached: max_scroll_percent >= 75,
    scroll_90_reached: max_scroll_percent >= 90,
    no_send: true,
    no_write: true,  // POC 단계: 저장 없음. 저장 단계는 별 Yellow 승인 (paid_click_intent canary 패턴 동일)
  };
  res.status(200).json({ ok: true, ...noSendGuardAliases, receiver: "product_engagement_no_send", preview, source: { mode: "no_write_no_send_preview" } });
});
```

POC 단계는 **no-write**. paid_click_intent 처럼 monitoring smoke 결과를 본 뒤 minimal write 별 승인.

### 2.3 receiver flag 분기 (이미 검증된 패턴)

paid_click_intent canary와 동일하게 향후 minimal write 시:

```text
PRODUCT_ENGAGEMENT_WRITE_ENABLED=false      # 기본값
PRODUCT_ENGAGEMENT_WRITE_SAMPLE_RATE=0.1    # 10% 샘플 (visit 단위)
```

flag false일 때 응답에 `would_store=false`, `mode=no_write_no_send_preview`. flag true canary 진입은 paid_click_intent 패턴 재사용.

## 3. 저장 필드 / 금지 필드

### 3.1 저장 (no-write 단계 끝나고 minimal write 승인 시)

| 필드 | 설명 |
|---|---|
| `intent_id` | UUID |
| `site` | `biocom` 단독 |
| `page_path` | query 제거 path만 (200자 제한) |
| `product_idx` | 상품 idx (50자 제한) |
| `visible_seconds` | 0~3600 |
| `max_scroll_percent` | 0~100 |
| `client_id`, `ga_session_id` | join 용 |
| `captured_at`, `received_at` | 시각 |
| `dedupe_key` | `pe:{site}:{client_id}:{ga_session_id}:{page_path}:{product_idx}` (per visit) |
| `expires_at` | 90일 TTL |
| `engaged_view`, `deep_view` (boolean 파생) | 필요 시 view 단계에서 계산 (저장 또는 view 시점 derive) |

### 3.2 절대 금지

- raw request body
- email, phone, name, address
- order_number, payment_key, paid_at
- value, currency
- 카드/계좌/cookie/token raw
- full URL with query
- referrer URL with query

## 4. 파생 지표 정의

| 지표 | 공식 |
|---|---|
| `scroll_50_reached` | `max_scroll_percent >= 50` |
| `scroll_75_reached` | `max_scroll_percent >= 75` |
| `scroll_90_reached` | `max_scroll_percent >= 90` |
| `engaged_view` | `visible_seconds >= 45 AND max_scroll_percent >= 50` |
| `deep_view` | `visible_seconds >= 90 AND max_scroll_percent >= 75` |
| `bounce_like` | `visible_seconds < 3 AND max_scroll_percent < 25` |
| `attention_score (0~100)` | `min(visible_seconds/90, 1) * 50 + min(max_scroll_percent/100, 1) * 50` |

각 지표는 source_group별 비교에 사용 ([[../gdn/channel-funnel-quality-meta-google-organic-20260508]] 보강 sprint).

## 5. POC 단계 (총 4단계)

| Phase | 내용 | 승인 영역 |
|---|---|---|
| **Phase 0** (본 문서) | 설계 | Green (자율) |
| **Phase 1** | 서버 receiver no-write 구현 + 클라이언트 smoke 호출 (TJ가 imweb body or GTM 변경 시 1회 호출) | Green (서버 코드 reversible local) |
| **Phase 2** | client wiring 활성화 (모든 상품 페이지) | Yellow (GTM 또는 imweb body 변경) |
| **Phase 3** | minimal ledger write (paid_click_intent canary 패턴) | Yellow (운영 sqlite write) |

각 Phase 사이 1h smoke + 24h canary + 결과 보고.

## 6. paid_click_intent canary 와 비교

| 항목 | paid_click_intent | ProductEngagementSummary |
|---|---|---|
| 트리거 시점 | landing / checkout / NPay click 시 | pagehide / beforeunload (visit 종료) |
| 데이터 종류 | click id (gclid/gbraid/wbraid) | visible_seconds, max_scroll_percent |
| dedupe | site + click_id + session + path + stage | site + client_id + session + path + product_idx (per visit) |
| 보관기간 | 90일 (click_id_value), 180일 (hash) | 90일 |
| 패턴 | no-send/no-write → canary write → 정식 | 동일 |
| 외부 전송 | 0건 (Google Ads upload 별 승인) | **0건** (광고 송출 영원히 금지) |

## 7. 송출/사용 한계 명시

- **운영 광고 플랫폼 (GA4 MP / Meta CAPI / Google Ads / TikTok / Naver) 절대 송출 금지**.
- ProductEngagementSummary 는 **read-only 운영 분석 전용**.
- channel funnel quality, 상품별 인기도, source_group 별 attention 비교에만 활용.
- Google Ads conversion action / Meta Custom Conversion 으로 전환하려면 별도 Red 승인 + Pixel/CAPI 송출 검증 단계 필요.

## 8. 다음 자동 진행 (Phase 1 시작 시)

| 작업 | 의존성 |
|---|---|
| `backend/src/productEngagementLog.ts` 작성 (no-write, no-send, paid_click_intent 패턴 따름) | 본 POC 승인 |
| `attribution.ts` route `/api/attribution/product-engagement/no-send` 추가 | 동일 |
| 로컬 typecheck + smoke (paid_click_intent canary 절차 동일) | 동일 |
| 운영 backend deploy (no-write only) | TJ Yellow 승인 |
| 클라이언트 wiring (imweb body 또는 GTM) | 별 sprint, TJ Yellow 승인 |

## 9. TJ 영역 / 본 agent 영역

| 작업 | 영역 |
|---|---|
| 본 POC 설계 검토 | TJ + 본 agent (현재 단계) |
| 서버 코드 작성 | 본 agent 자율 (Phase 1 진입 시) |
| 운영 deploy | TJ Yellow 승인 |
| imweb body / GTM client wiring | TJ Yellow 승인 (코드 read 본 agent, 적용 TJ 또는 GTM admin) |
| 광고 플랫폼 conversion 으로 전환 | 절대 금지 (별 Red 승인 영역) |

## 10. 한 줄 결론

> 50% scroll + visible_seconds 정확 측정은 GA4 raw로 불가. 본 POC는 클라이언트 visibility/scroll collector + 서버 no-send/no-write receiver 패턴 (paid_click_intent canary 와 동일)으로 안전하게 시작 가능. **광고 플랫폼 송출은 영원히 금지**, read-only 분석 전용.
