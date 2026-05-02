# A-4 GTM Production publish 결정 + dispatcher v2.1 개선안 (2026-05-02)

상위 sprint: [[!coffeedata#다음 할일]] 항목 19 (dispatcher v2.1 개선) + 항목 20 (A-4 publish 결정).

본 문서 성격: **A-4 Production publish 의 단일 source-of-truth**. dispatcher v2.1 의 design + v2.1 PASS 후 publish 진입 게이트 + 모니터링 기준 + rollback + stop 조건을 모두 포함.

본 commit 시점 상태: **publish 안 함, env 변경 안 함, smoke window open 안 함, 외부 send 안 함**. 본 문서는 design + 승인안 + 재검증 준비.

## 0. 결론 (10초)

| 항목 | 판정 |
|---|---|
| A-3 v2 PASS | 인정 (9 성공 기준 모두 충족, 2026-05-02 KST) |
| A-4 publish 추천 여부 | **현 시점 보류 — dispatcher v2.1 Preview 재검증 PASS 후 추천** |
| 핵심 차단 | O2 imweb_order_code null 보강 (deterministic join 핵심 키) |
| dispatcher v2.1 backend 영향 | **0** (backend schema/route/validation 미변경, dispatcher HTML 만 갱신) |
| publish 시 GTM 변경 | Coffee container `GTM-5M33GC4` default workspace 에 dispatcher v2.1 tag 1개 publish |
| 외부 send | 0 (publish 후에도 GA4/Meta/TikTok/Google Ads 송출 0 유지 — A-6 별도 게이트) |

## 1. A-3 v2 PASS evidence 요약

상세는 [[coffee-npay-intent-a3-gtm-preview-dispatcher-runbook-20260502#a-3-v2-pass-2026-05-02-kst]].

| # | 기준 | 결과 |
|---|---|---|
| 1 | dispatcher 가 페이지에 install | ✅ Tag Assistant 3회 fired |
| 2 | NPay click 이 sessionStorage buffer 에 push | ✅ buffer_count=2 |
| 3 | dispatcher 가 buffer 를 fetch POST forward | ✅ sent_count=2 |
| 4 | 외부 도메인 backend 도달 | ✅ Network OPTIONS 204 + POST 200 |
| 5 | CORS preflight 정상 | ✅ Origin allow `https://thecleancoffee.com` |
| 6 | backend enforce mode INSERT | ✅ total_rows 0→3, enforce_inserted 0→3 |
| 7 | payload validation 통과 | ✅ preview_only=1, prod_code/price/quantity 캡처 |
| 8 | smoke_window 가드 동작 | ✅ inserted 0→3, remaining 5→2 |
| 9 | funnel-capi v3 호환 | ✅ funnel_capi_session_id 두 row 동일 |

## 2. O1/O2/O3 — 개선 전 문제

### O1. dispatcher race condition

**증상**: A-3 v2 ledger 의 id 분포 (1, 3, 6) — id=2/4/5 가 dedup 으로 비어 있음. enforce_deduped=3 카운터.

**원인**: dispatcher v2 의 `attemptDispatch` 가 sweep (1초 간격) 마다 buffer 의 모든 entry 를 검사하면서 fetch 보냄. 단 fetch 가 in-flight 인 동안에도 다음 sweep 이 같은 entry 를 다시 fetch 할 수 있음 (`hasSent` 체크는 응답 받은 entry 만, in-flight 추적 부재).

**영향**: 운영 무해 (UNIQUE constraint 가 dedup), 단 fetch 효율 50%. publish 후 트래픽 급증 시 backend 부하 + Cloudflare 비용 증가.

### O2. imweb_order_code null

**증상**: A-3 v2 ledger 의 site dispatcher row 2건 모두 `imweb_order_code: null`.

**원인**: NPay click 시점의 buffer entry 는 imweb_order_code 가 비어있음. snippet (preview-snippet-all-in-one) 의 line 360-363 가 imweb_order_code retry capture 메커니즘 가지지만 snippet 의 retry interval 이 dispatcher 의 1초 sweep 보다 느림 → race. dispatcher 가 capture 완료 전에 forward.

**영향 (핵심)**: imweb_order_code 는 본 프로젝트의 **deterministic join 핵심 키**. ledger row 와 `imweb_orders.order_code` 를 1:1 join 하기 위한 anchor. null 이면 attribution 정합성 검증 불가.

A-4 publish 의 가치 = "ledger 가 deterministic mapping source-of-truth 로 인정됨". imweb_order_code coverage 가 95% 미만이면 source-of-truth 라고 부를 수 없음.

### O3. payment_button_type null

**증상**: A-3 v2 ledger 의 site dispatcher row 2건 모두 `payment_button_type: null`.

**원인**: snippet 의 line 333 이 `payment_button_type: "npay"` 명시하나, 일부 hook path (intent_phase=`confirm_to_pay`) 에서 채워지지 않음.

**영향**: 운영 영향 적음 (intent_phase=confirm_to_pay → npay 추정 가능). 단 schema cleanliness + 향후 다양한 결제수단 분기 시 결정성 저하.

## 3. dispatcher v2.1 개선 내용

dispatcher v2.1 HTML 코드 전체는 [[coffee-npay-intent-a3-gtm-preview-dispatcher-runbook-20260502#a-3-v2-1-재검증]] 의 코드 블록 참조.

### 3.1 O2 보강 — imweb_order_code null wait (최우선)

**핵심 변경**: `attemptDispatch` 진입 시 `p.imweb_order_code` 가 비어있으면 **즉시 fetch 안 함**.

```js
// O2: imweb_order_code wait
var ORDER_CODE_WAIT_TIMEOUT_MS = 3000;  // 3초까지 snippet retry 시간 줌

if (!p.imweb_order_code) {
  var firstSeenMs = entry && entry.first_seen_ms ? entry.first_seen_ms : Date.now();
  var elapsedMs = Date.now() - firstSeenMs;

  if (!entry) {
    pending[p.intent_uuid] = {
      first_seen_ms: firstSeenMs,
      attempts: 0,
      last_reason: "wait_for_order_code"
    };
    writeJsonStorage(PENDING_KEY, pending);
  }

  if (elapsedMs < ORDER_CODE_WAIT_TIMEOUT_MS) return;  // 다음 sweep 까지 보류

  // 3초 timeout — block (fetch 안 함, sent_entries 에 marker)
  markSent(p.intent_uuid, "blocked_missing_imweb_order_code");
  delete pending[p.intent_uuid];
  writeJsonStorage(PENDING_KEY, pending);
  return;
}
```

**flow**:
1. NPay click → snippet 이 buffer 에 entry push (imweb_order_code null)
2. dispatcher sweep #1 (≤1s): entry 봄, imweb_order_code 없음 → pending first_seen_ms 기록만, fetch 안 함
3. snippet retry (line 360-363) 가 imweb_order_code 캡처 → buffer entry 갱신
4. dispatcher sweep #2 (≤2s): entry 의 imweb_order_code 채워짐 → 정상 fetch
5. (만약 3초 경과까지 미캡처) sweep #4 (3s): timeout → `blocked_missing_imweb_order_code` marker + fetch 안 함 + ledger 안 들어감

**효과**: ledger 의 imweb_order_code coverage **95%+ 목표** 달성. 핵심 join 키 신뢰성 확보.

### 3.2 O1 보강 — in-flight Set 추가

**핵심 변경**: 같은 `intent_uuid` 가 fetch 중이면 다음 sweep 에서 skip.

```js
// O1: in-flight Set (in-memory, page lifetime 동안 유효)
var inflight = new Set();

function attemptDispatch(p) {
  ...
  if (hasSent(p.intent_uuid)) return;
  if (inflight.has(p.intent_uuid)) return;  // NEW: in-flight skip
  ...
  inflight.add(p.intent_uuid);  // NEW
  fetch(ENDPOINT, ...).then(...).catch(...).finally(function () {
    inflight.delete(p.intent_uuid);  // NEW: 응답/실패 후 풀어줌
  });
}
```

**page reload 시점**: in-memory Set 사라짐. 단 sessionStorage 의 `__coffee_intent_sent` 가 persist → `hasSent` 가 reload 후에도 차단. 즉 in-memory + persisted 이중 안전망.

**효과**: enforce_deduped 카운터 ≈ 0 (race 0). fetch 효율 100% (필요 fetch 만 보냄).

### 3.3 O3 보강 — payment_button_type fallback

**핵심 변경**: 없으면 `intent_phase=confirm_to_pay` 일 때 "npay" 보정.

```js
// O3: payment_button_type fallback (snippet 측 보강이 우선, 본 dispatcher 는 안전망)
if (!p.payment_button_type && p.intent_phase === "confirm_to_pay") {
  p.payment_button_type = "npay";
}
```

**우선순위**: snippet 측 보강 (line 333 의 적용 path 점검 + intent_phase=`confirm_to_pay` 분기에서도 "npay" 채움) 이 더 안전. dispatcher 는 이중 안전망.

**snippet 측 보강은 별도 sprint** (19.x). 본 sprint 의 dispatcher v2.1 는 fallback 만 추가.

### 3.4 backend 영향

**없음**. dispatcher v2.1 의 fetch payload 형태는 v2 와 동일 (단지 imweb_order_code 가 더 자주 채워짐). backend schema/validation/route 미변경.

## 4. v2.1 에서 무엇이 해결됐는지

| 항목 | v2 | v2.1 |
|---|---|---|
| imweb_order_code coverage | 0% (A-3 v2 evidence 기준) | **≥95% 목표** (3초 wait + snippet retry 시간 보장) |
| enforce_deduped (race) | 3건/3 INSERT (50%) | **≈0** (in-flight Set 차단) |
| payment_button_type null | 100% (confirm_to_pay 한정 관찰) | **≈0** (snippet 우선 + dispatcher fallback) |
| fetch 효율 | 50% (race로 중복) | 100% |
| backend 부하 | dedup 처리 비용 | 정상 |

## 5. A-4 publish 추천 여부

| 시점 | 추천 |
|---|---|
| **현재 (2026-05-02, dispatcher v2.1 미검증)** | **보류** — v2.1 Preview 재검증 미수행 |
| dispatcher v2.1 PASS 후 | **추천** (단, §6 체크리스트 모두 통과 시) |

publish 추천의 핵심 게이트: **§6 publish 전 필수 체크리스트** 11개 중 9개 이상 PASS + O2 capture rate 95%+.

## 6. publish 전 필수 체크리스트 (11개)

| # | 항목 | 기대 | 측정 방법 |
|---|---|---|---|
| C-1 | dispatcher v2.1 Preview 재검증 PASS | 9 v2 기준 + 추가 3 v2.1 기준 | A-3 runbook v2.1 섹션 |
| C-2 | imweb_order_code capture rate | **≥95%** (test row 제외) | `SELECT COUNT(*) FILTER (WHERE imweb_order_code IS NOT NULL) * 100.0 / COUNT(*) FROM coffee_npay_intent_log WHERE intent_uuid NOT LIKE 'smoke_%'` |
| C-3 | enforce_deduped 카운터 | **≤5%** of enforce_inserted | stats endpoint 의 reject_counters |
| C-4 | payment_button_type null | **0건** in confirm_to_pay phase | ledger SQL |
| C-5 | invalid_origin | 0 | reject_counters |
| C-6 | rate_limited | 0 | reject_counters |
| C-7 | preview_only_violation | 0 | reject_counters |
| C-8 | is_simulation_blocked | 0 | reject_counters |
| C-9 | pii_rejected | 0 | reject_counters |
| C-10 | backend pm2 restart 안정 | 24h 내 restart < 10회 | `pm2 list` |
| C-11 | TJ 명시 publish 승인 | OK | 본 문서 §14 verdict + TJ 응답 |

## 7. publish 범위

> **2026-05-02 갱신** (sprint 20 N-2+): publish 범위 = **dispatcher + snippet installer 둘 다**. dispatcher 만 publish 하면 buffer push hook 부재 (lesson coffee-lesson-015).

| 항목 | publish 범위 |
|---|---|
| GTM container | Coffee `GTM-5M33GC4` |
| publish 대상 tag 1 | **`Coffee NPay Intent Dispatcher v2.1`** (Custom HTML, dispatcher v2.1 코드, pageview trigger) — 1차 publish (live version 18) |
| publish 대상 tag 2 | **`Coffee NPay Intent Snippet Installer v1`** (Custom HTML, all-in-one snippet IIFE + outer ready retry, windowLoaded trigger) — 2차 publish (live version 19) |
| Snippet Installer 의 retry | SITE_SHOP_DETAIL / window.confirmOrderWithCartItems ready 까지 250ms × 최대 8s wait. 이중 설치 방지 marker `__coffeeNpayIntentSnippetInstallerStarted` |
| version note | "A-4 publish 2026-05-02: dispatcher v2.1 (O1+O2+O3) + snippet installer v1 — preview only forward, backend ledger record. fetch/sendBeacon/XHR 0 (snippet), backend POST keepalive only (dispatcher). No GA4/Meta/TikTok/Google Ads send." |
| 영향 받는 시스템 | thecleancoffee.com 의 모든 페이지 (dispatcher + snippet 자동 install) |
| 영향 받지 않는 시스템 | site 의 funnel-capi v3, GA4, Meta, TikTok, Google Ads, imweb 자체, Toss, NPay 결제 path |

## 8. rollback 방법

| 시나리오 | 절차 | RTO |
|---|---|---|
| dispatcher v2.1 자체 회귀 (page error / DOM 영향) | GTM 콘솔 → Versions → 직전 published version 으로 **Roll back** | 1분 |
| backend endpoint 회귀 | `~/seo/backups/crm.sqlite3.20260501-162731.before-coffee-intent-deploy` 로 SQLite 복원 후 pm2 restart. 단 ledger 데이터 손실 위험 — `WHERE created_at < <publish_ts>` 만 복원 권장 | 5분 |
| 외부 send 의도치 활성 (절대 일어날 수 없음 — 코드에 발신 path 0) | 즉시 dispatcher tag pause + 로그 점검 | 1분 |
| imweb_order_code coverage 급락 (예: 95%→50%) | dispatcher 즉시 pause. snippet retry interval 점검. 보강 후 재 publish | 30분 |

## 9. 3일 조기 평가 기준 (early gate)

publish 후 3일 째 (`publish_ts + 72h`) 시점에 9개 조건 **모두** 충족 시 조기 closure 인정:

| # | 조건 | 임계 |
|---|---|---|
| EG-1 | imweb_order_code coverage | ≥95% |
| EG-2 | total_rows daily 증분 | 5~50건 (단주문 / 비정상 폭주 제외) |
| EG-3 | enforce_deduped ratio | ≤5% |
| EG-4 | payment_button_type null in confirm_to_pay | 0건 |
| EG-5 | invalid_origin / rate_limited / preview_only_violation / is_simulation_blocked | 모두 0 |
| EG-6 | pii_rejected | 0 |
| EG-7 | endpoint 5xx | 0 |
| EG-8 | dispatcher_fetch_failed (sessionStorage 의 pending TTL 초과) | <1% |
| EG-9 | pm2 restart 카운터 증분 | <5/일 |

EG-1~EG-9 모두 PASS → publish 안정 인정. 7-day fallback 안 거치고 다음 phase (A-5) 진입 가능.

## 10. 5일 default 모니터링 기준

publish 후 5일 default. 매일 1회 [[coffee-a4-monitoring-report-template-20260502]] 형식의 모니터링 리포트 작성. 5일째 (`publish_ts + 120h`):

- 조기 게이트 9 중 6 이상 PASS + 핵심 (EG-1, EG-3, EG-5, EG-7) 모두 PASS → **이대로 closure**
- 조기 게이트 9 중 5 이하 PASS → **7일 fallback 모니터링 진입**

## 11. 7일 fallback 조건

5일 default 미충족 시 추가 2일 + 14개 stop 조건 매일 점검:

| # | 조건 | stop 임계 |
|---|---|---|
| F-1 | imweb_order_code coverage | <80% 면 dispatcher 즉시 pause |
| F-2 | enforce_deduped ratio | >20% 면 dispatcher 즉시 pause (race regression) |
| F-3 | endpoint 5xx ratio | >1% 면 backend 점검 |
| F-4 | rate_limited 누적 | >100건/일 면 RL 정책 점검 |
| F-5 | invalid_origin | >0건 |
| F-6 | preview_only_violation | >0건 |
| F-7 | is_simulation_blocked | >0건 |
| F-8 | pii_rejected | >0건 면 즉시 dispatcher pause |
| F-9 | pm2 restart 카운터 | >20/일 면 backend 점검 |
| F-10 | site 의 funnel-capi 충돌 | sessionStorage `funnelCapi::*` 파괴 |
| F-11 | thecleancoffee.com error rate | site 자체 error rate 5% 초과 |
| F-12 | NPay 결제 완료율 회귀 | dispatcher install 전 대비 -1%p 초과 |
| F-13 | GA4/Meta/TikTok/Google Ads 의도치 송출 | >0건 (절대 일어날 수 없음) |
| F-14 | TJ 직접 stop 지시 | 즉시 |

7일째 마감 + F-1~F-14 위반 0건 + EG-1/EG-3/EG-5/EG-7 PASS → closure. 그 외 → escalation + 추가 보강.

## 12. stop 조건

publish 직후부터 7일까지 **언제든** F-1, F-2, F-8, F-13, F-14 위반 시 즉시 dispatcher pause + escalation. 운영 보호 우선.

## 13. smoke / test row 제외 규칙

리포트 / dashboard / publish closure 의사결정에서는 **반드시 test row 제외**:

```sql
SELECT *
FROM coffee_npay_intent_log
WHERE intent_uuid NOT LIKE 'smoke_%'
  AND source_version != 'a3v2_codex_sim'
  AND source_version NOT LIKE 'test_%'
  AND is_simulation = 0
  AND ts_ms_kst >= <publish_ts_ms>;
```

A-3 v2 의 ledger 3 rows (id=1 codex sim, id=3/6 site dispatcher) 는 **test row 로 제외** — A-2a/A-3 evidence 보존 목적이라 DELETE 하지 않고 SQL 필터로만 분리.

## 14. Auditor verdict

본 sprint (항목 19, dispatcher v2.1 design) 의 audit:

| 항목 | 판정 |
|---|---|
| 본 commit scope | 문서 + 스크립트만 (코드 dispatcher HTML 은 GTM 미배포) |
| GTM Production publish | 0 |
| env flag 변경 | 0 |
| smoke window open | 0 |
| backend deploy | 0 |
| GA4 / Meta / TikTok / Google Ads send | 0 |
| 자동 dispatcher 운영 전환 | 0 |
| backend dormant 유지 | enforce/token/window 모두 false |
| ledger 영향 | 0 (read-only 분석만) |

**Auditor verdict: PASS_WITH_NOTES**

PASS 사유: 본 sprint 는 design + 문서 + read-only 모니터링 스크립트만. 운영 영향 0.

NOTES:

1. dispatcher v2.1 의 chrome 측 동작 검증은 **TJ 명시 승인 후 별도 Preview 재검증 sprint** 에서 진행. 본 commit 만으로는 v2.1 가 검증되지 않음.
2. A-4 publish 는 본 commit 시점에 **여전히 보류** — §6 체크리스트 11개 중 C-1~C-4 (재검증 PASS 의존) 가 미충족.
3. snippet 측 (`preview-snippet-all-in-one-20260501`) 보강 (line 333 confirm_to_pay path 의 payment_button_type, line 360-363 imweb_order_code retry interval 점검) 은 별도 sprint 19.1 로 분리 권장. dispatcher v2.1 의 3초 wait 가 이 부족분을 일부 흡수하나 근본 해결은 아님.
4. monitoring 자동화 script ([[backend/scripts/coffee-npay-intent-monitoring-report.ts]]) 는 본 sprint 에 추가됨. 단 publish 전까지 cron 등록은 보류 — Production publish 후 매일 1회 운영 결정.

## 15. 다음 액션

| Step | 담당 | 내용 |
|---|---|---|
| 19.1 (선택) | Codex + TJ | snippet 측 보강 — line 333 path / retry interval 점검 후 갱신 |
| 19.2 | Codex + TJ | dispatcher v2.1 Preview 재검증 ([[coffee-npay-intent-a3-gtm-preview-dispatcher-runbook-20260502#a-3-v2-1-재검증]] 진입) |
| 20 | TJ + Codex | §6 체크리스트 PASS 후 A-4 GTM Production publish 결정 |
| A-5 | Codex | publish 후 5일 default 모니터링 (조기 3일 게이트 적용 가능) |
| A-6 | TJ + Codex | A-5 PASS 후 GA4 / Meta CAPI 보강 전송 — **별도 승인 게이트** |
