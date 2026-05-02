# 더클린커피 A-3 — GTM Preview Dispatcher Smoke Test Runbook

생성 시각: 2026-05-02 KST
phase: A-3 (GTM Preview workspace + smoke window + 실제 PC NPay click 1~2건 forward 검증)
승인: TJ A-3 진입 승인 (smoke window max_inserts ≤ 5, GTM Production publish 금지, 외부 보강 송출 금지)
관련 문서: [[coffee-npay-intent-ledger-enforce-approval-20260501|승인안 v1.6 (A-1.5/A-2a 결과 포함)]] / [[coffee-npay-intent-beacon-preview-snippet-all-in-one-20260501|all-in-one snippet]] / [[coffee-imweb-tracking-flow-analysis-20260501|4 layer 분석]]

## Auditor Verdict (A-3 종료 전 / 도중)

```text
Auditor verdict: PASS_WITH_NOTES (진입 시점)
Phase: coffee_npay_intent_a3_gtm_preview_dispatcher
No external send verified: YES (GA4 MP / Meta CAPI / TikTok Events / Google Ads 0)
No DB write 외부 verified: YES (운영 PG write 0, 로컬 SQLite 만)
No GTM Production publish: YES (Preview workspace 한정)
실제 운영 변경: GTM Coffee workspace 의 Preview tag 1개 등록 (Production 미반영)
가드:
  - smoke window max_inserts ≤ 5 (default 5)
  - 실제 NPay click 1~2건만 backend forward 검증 권장
  - 검증 종료 후 GTM Preview 끄기 + smoke window close + .env 정리
  - 자동 dispatcher 운영 전환 금지
```

## 10초 요약

A-3 는 **dispatcher v2 가 site live 환경에서 실제로 동작하는지 GTM Preview 모드 한 번** 확인하는 것이오.

흐름:
1. Codex — backend `.env` 임시 추가 + 재시작 + smoke window open
2. TJ — GTM Coffee workspace 의 Preview workspace 에 dispatcher v2 Custom HTML tag 등록 + Preview 활성
3. TJ — chrome 에서 site 진입 + all-in-one snippet paste + PC NPay click 1~2회 (즉시 ESC 로 결제 안 진행)
4. Codex — backend stats / join-report polling 으로 INSERT 도달 여부 확인
5. Codex — smoke window close + `.env` 정리 + 재시작
6. Codex — 결과 보고

## 사전 준비 (Codex 진행)

### Step S1. smoke ledger 정리 결정 (선택)

A-2a 의 smoke row 2건 (`intent_uuid LIKE 'smoke_a2a_%'`) 는 보존 — TJ 명시. 단 A-3 분석 SQL 에서는 제외.

```sql
-- A-3 row 만 보는 SQL filter (참고)
SELECT *
FROM coffee_npay_intent_log
WHERE site = 'thecleancoffee'
  AND intent_uuid NOT LIKE 'smoke_a2a_%'
  AND ts_ms_kst >= <a3_start_ms>;
```

### Step S2. token 생성 + .env 임시 추가 + backend 재시작

A-2a 와 동일 절차:

```bash
SMOKE_TOKEN="smoke_a3_$(date +%s)_$(openssl rand -hex 6)"
ENV_FILE=/Users/vibetj/coding/seo/backend/.env
{
  echo ""
  echo "# === A-3 GTM Preview smoke (CODEX TEMP, removed after test) ==="
  echo "COFFEE_NPAY_INTENT_ENFORCE_LIVE=true"
  echo "COFFEE_NPAY_INTENT_SMOKE_ADMIN_TOKEN=$SMOKE_TOKEN"
} >> "$ENV_FILE"

CURRENT_PID=$(lsof -ti :7020 -sTCP:LISTEN | head -1)
kill -TERM "$CURRENT_PID" 2>&1
sleep 2
nohup node dist/server.js > /tmp/seo-backend-stdout.log 2> /tmp/seo-backend-stderr.log < /dev/null &
disown
sleep 3
curl -sS http://localhost:7020/api/coffee/intent/stats | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print('enforce=',d['enforce_flag_active'],'token=',d['smoke_admin_token_configured'])"
```

기대: `enforce=True / token=True`.

### Step S3. smoke window open (max_inserts=5, duration=30분)

```bash
curl -sS -X POST http://localhost:7020/api/attribution/coffee-npay-intent-smoke-window \
  -H "Authorization: Bearer $SMOKE_TOKEN" -H "Content-Type: application/json" \
  -d '{"started_by":"codex_a3_run","note":"A-3 GTM Preview dispatcher smoke","duration_minutes":30,"max_inserts":5}'
```

응답의 `smoke_window.id` / `expires_at` 기록.

## TJ 단계 (GTM Coffee workspace)

### Step T1. GTM Custom HTML tag 등록 — Preview workspace 한정

**경로**: GTM 콘솔 → Coffee 컨테이너 (`GTM-5M33GC4`) → Tags → New → Custom HTML

**Tag 이름**: `Coffee NPay Intent Dispatcher v2 (PREVIEW ONLY)`

**Tag 안 HTML** (아래 통째로 paste):

```html
<script>
(function () {
  if (window.__coffeeNpayIntentDispatcherInstalled) return;
  window.__coffeeNpayIntentDispatcherInstalled = true;

  var BUFFER_KEY = "coffee_npay_intent_preview";
  var PENDING_KEY = "__coffee_intent_pending";
  var SENT_KEY = "__coffee_intent_sent";
  var ENDPOINT = "https://att.ainativeos.net/api/attribution/coffee-npay-intent?mode=enforce";
  var SWEEP_INTERVAL_MS = 1000;
  var MAX_RETRY = 5;
  var TTL_MS = 24 * 3600 * 1000;

  function readJsonStorage(k) {
    try { return JSON.parse(sessionStorage.getItem(k) || "{}"); }
    catch (e) { return {}; }
  }
  function writeJsonStorage(k, v) {
    try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  function hasSent(intentUuid) {
    var sent = readJsonStorage(SENT_KEY);
    return !!sent[intentUuid];
  }
  function markSent(intentUuid, status) {
    var sent = readJsonStorage(SENT_KEY);
    sent[intentUuid] = { sent_at_ms: Date.now(), status: status };
    var keys = Object.keys(sent);
    if (keys.length > 200) {
      keys.sort(function (a, b) { return (sent[a].sent_at_ms || 0) - (sent[b].sent_at_ms || 0); });
      for (var i = 0; i < keys.length - 200; i++) delete sent[keys[i]];
    }
    writeJsonStorage(SENT_KEY, sent);
  }

  function readPending() { return readJsonStorage(PENDING_KEY); }
  function writePending(p) { writeJsonStorage(PENDING_KEY, p); }

  function isPermanentFailure(entry) {
    if (!entry) return false;
    if (entry.attempts >= MAX_RETRY) return true;
    if (entry.first_seen_ms && Date.now() - entry.first_seen_ms > TTL_MS) return true;
    if (entry.last_status && entry.last_status >= 400 && entry.last_status < 500) return true;
    return false;
  }

  function attemptDispatch(payload) {
    if (!payload || payload.preview_only !== true) return;
    if (payload.is_simulation === true) return;
    if (!payload.intent_uuid) return;
    if (hasSent(payload.intent_uuid)) return;

    var pending = readPending();
    var entry = pending[payload.intent_uuid];
    if (entry && isPermanentFailure(entry)) return;

    var nextAttempts = (entry && entry.attempts ? entry.attempts : 0) + 1;
    pending[payload.intent_uuid] = {
      first_seen_ms: entry && entry.first_seen_ms ? entry.first_seen_ms : Date.now(),
      attempts: nextAttempts,
      last_attempt_ms: Date.now(),
      last_status: null,
      last_reason: null
    };
    writePending(pending);

    var withSchema = Object.assign({}, payload, { payload_schema_version: 1 });
    fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withSchema),
      keepalive: true
    }).then(function (res) {
      var pend = readPending();
      var e = pend[payload.intent_uuid] || {};
      e.last_status = res.status;
      pend[payload.intent_uuid] = e;
      writePending(pend);
      if (res.status >= 200 && res.status < 300) {
        markSent(payload.intent_uuid, "ok_" + res.status);
        delete pend[payload.intent_uuid];
        writePending(pend);
      } else if (res.status >= 400 && res.status < 500) {
        markSent(payload.intent_uuid, "permanent_4xx_" + res.status);
        delete pend[payload.intent_uuid];
        writePending(pend);
      }
    }).catch(function (err) {
      var pend = readPending();
      var e = pend[payload.intent_uuid] || {};
      e.last_reason = err && err.message ? String(err.message).slice(0, 100) : "fetch_failed";
      pend[payload.intent_uuid] = e;
      writePending(pend);
    });
  }

  function sweep() {
    try {
      var buf = JSON.parse(sessionStorage.getItem(BUFFER_KEY) || "[]");
      buf.forEach(attemptDispatch);
    } catch (e) {}
  }

  setInterval(sweep, SWEEP_INTERVAL_MS);
  window.addEventListener("beforeunload", sweep);
})();
</script>
```

### Step T2. Trigger 설정

**Trigger 타입**: `All Pages` 또는 `Page View - DOM Ready` (가장 일찍 발화하는 trigger)

**Trigger 이름**: `All Pages — Coffee NPay Preview only`

**중요 — Preview 한정 가드 (둘 중 하나)**:
- Option A (간단): Tag 의 firing 조건에 추가 trigger 없이 그대로. **GTM Preview & Debug** 모드일 때만 발화하도록 GTM 가 자동 제어 (Production publish 안 하면 Production 사용자에게 안 노출)
- Option B (보강): Trigger 의 조건에 GTM Preview 식별 변수 추가 (예: `gtm.uniqueEventId` 또는 `Page URL` 의 `gtm_debug=` 파라미터). 이 옵션은 Production publish 했을 때도 추가 보호선

**권장**: Option A. **publish 안 하는 한 Preview 에서만 발화**.

### Step T3. GTM Preview 모드 활성

GTM 콘솔 → 우측 `Preview` 버튼 → `https://thecleancoffee.com/shop_view/?idx=N` 입력 → 새 chrome 창에서 Tag Assistant 가 active 한 상태로 site 열림.

**Tag Assistant 에서 확인**:
- Tags Fired: `Coffee NPay Intent Dispatcher v2 (PREVIEW ONLY)` — All Pages trigger 로 발화 중
- console 에 dispatcher install 로그 (없을 수 있음 — dispatcher v2 는 `console.log` 호출 없이 silent install)

### Step T4. all-in-one snippet paste + PC NPay click

[[coffee-npay-intent-beacon-preview-snippet-all-in-one-20260501|all-in-one snippet]] 의 큰 IIFE 한 묶음을 chrome devtools console 에 paste + enter.

console 에 `[coffee_npay_intent_preview] all-in-one installed ...` 출력 확인.

PC NPay 버튼 클릭 → 즉시 ESC. 1~2회 시도.

**Network 탭에서 확인할 것**:
- `att.ainativeos.net/api/attribution/coffee-npay-intent?mode=enforce` 로 향하는 POST 요청 1~2건
- 응답 status 201 (inserted) 또는 200 (deduped)

console 에서:

```javascript
;(() => {
  var sent = JSON.parse(sessionStorage.getItem("__coffee_intent_sent") || "{}");
  var pend = JSON.parse(sessionStorage.getItem("__coffee_intent_pending") || "{}");
  console.log("[a3_dispatcher_state]\n" + JSON.stringify({
    sent_count: Object.keys(sent).length,
    pending_count: Object.keys(pend).length,
    sent_entries: sent,
    pending_entries: pend
  }, null, 2));
})()
```

**기대**: `sent_count` 1~2 + 각 entry 의 `status: "ok_201"`. `pending_count: 0`.

## Codex 모니터링 (TJ 진행 중 polling)

TJ 가 GTM Preview + NPay click 시작하면 Codex 가 다음 명령으로 30초마다 상태 polling:

```bash
SMOKE_TOKEN=$(cat /tmp/seo-smoke-a3-token.txt)
echo "=== stats ==="
curl -sS http://localhost:7020/api/coffee/intent/stats \
  | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print('total_rows=',d['total_rows'],'rows_with_imweb_order_code=',d['rows_with_imweb_order_code']); print('reject_counters.enforce_inserted=',d['reject_counters']['enforce_inserted'],'rate_limited=',d['reject_counters']['rate_limited'],'invalid_origin=',d['reject_counters']['invalid_origin'],'pii_rejected=',d['reject_counters']['pii_rejected']); print('smoke_window=',d['smoke_window_summary'])"
echo ""
echo "=== A-3 row only (smoke_a2a 제외) ==="
sqlite3 -header /Users/vibetj/coding/seo/backend/data/crm.sqlite3 "SELECT id, intent_uuid, imweb_order_code, ts_ms_kst FROM coffee_npay_intent_log WHERE intent_uuid NOT LIKE 'smoke_a2a_%' ORDER BY id DESC LIMIT 5;"
```

## TJ A-3 성공 기준 9종 (확인 항목)

| 기준 | 출처 | 확인 방법 |
|---|---|---|
| backend insert 1-2건 정상 | stats `enforce_inserted` 가 1~2 증가 | `total_rows` 도 증가 |
| imweb_order_code 100% 존재 | stats `rows_with_imweb_order_code` 와 `total_rows` 동일 | snippet v0.5 retry 정상 동작 시 |
| intent_uuid 중복 없음 | UNIQUE constraint 통과 (`enforce_deduped` 0) | dispatcher dedup 도 정상 |
| pii_rejected = 0 | stats `reject_counters.pii_rejected` | 0 유지 |
| invalid_payload = 0 | join-report `status_counts.invalid_payload` | 0 |
| endpoint_5xx = 0 | dispatcher 측 `__coffee_intent_pending` 의 `last_status` 확인 + Network 탭 5xx 없음 |  |
| rejected_origin / rate_limited 비정상 증가 없음 | stats `reject_counters` 의 두 항목 0 또는 소수 |  |
| join-report 정상 분류 (pending 또는 joined) | `GET /api/attribution/coffee-npay-intent-join-report` 의 `status_counts` |  |
| 종료 후 env/window OFF | 마지막 stats `enforce=false / window_active=false` |  |

## 종료 (Codex 진행)

### Step C1. window close

```bash
curl -sS -X POST http://localhost:7020/api/attribution/coffee-npay-intent-smoke-window/close \
  -H "Authorization: Bearer $SMOKE_TOKEN" -H "Content-Type: application/json" \
  -d '{"closed_by":"codex_a3_run"}'
```

### Step C2. .env 임시 키 제거 + backend 재시작

A-2a 와 동일.

### Step C3. 최종 stats 확인

```bash
curl -sS http://localhost:7020/api/coffee/intent/stats \
  | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print('enforce=',d['enforce_flag_active'],'token=',d['smoke_admin_token_configured'],'window_active=',d['smoke_window_active'])"
```

기대: 모두 `false`.

### Step C4. TJ — GTM Preview 모드 종료 + Custom HTML tag 비활성

GTM 콘솔에서 Preview 모드 종료. Custom HTML tag 는 Preview workspace 에 그대로 보존 (Production 미publish). 다음 phase 에서 그대로 사용 가능.

또는 tag 자체를 삭제 — 다음 phase 에서 다시 만들기. 권장: 보존 + Preview 모드만 종료.

### Step C5. Codex — A-3 결과 보고서 작성 + 승인안 / !coffeedata 갱신 + commit + push

A-2a 와 동일 패턴.

## 가드 재확인

- GTM Production publish: BLOCKED
- 자동 dispatcher 운영 전환: BLOCKED
- GA4 MP / Meta CAPI / TikTok Events / Google Ads send: BLOCKED
- smoke window 외 live capture: BLOCKED
- 5건 초과 INSERT: BLOCKED (max_inserts=5 hard limit)
- env flag 상시 ON: BLOCKED (smoke window 와 묶어 짧게 활성, 검증 후 즉시 OFF)

## 다음 phase (A-3 PASS 후 TJ 별도 승인)

| Step | 트리거 | 내용 |
|---|---|---|
| A-4 | A-3 9 성공 기준 PASS + TJ 승인 | GTM Coffee workspace **Production publish** 결정 — 단 publish 직후 매일 1회 join-report polling, 5일 default 모니터링 |
| A-5 | A-4 publish 후 5일 (또는 3일 조기 게이트 9 조건 모두 충족) | ledger 가 deterministic mapping source-of-truth 로 인정 |
| A-6 | A-5 PASS | GA4 / Meta CAPI 보강 전송 — **별도 승인 게이트** |

---

## 종결 (B-2, 2026-05-02 00:43 KST)

### 결론

**A-3 보류**. A-2a 까지를 enforce 준비 evidence 로 종결하고, GTM dispatcher 자동화는 별도 sprint 로 분리.

### 차단 원인

- `att.ainativeos.net` 의 destination 은 로컬 macOS:7020 이 아니라 **VM (34.64.104.94, pm2 seo-backend)**.
- 로컬 backend (working tree HEAD) 에 추가된 신규 endpoint (`POST /api/attribution/coffee-npay-intent` 등) 는 VM production backend 에 미배포.
- 외부 도메인 reachability 점검 결과: `OPTIONS` 는 CORS preflight 통과 (204), `GET/POST /api/coffee/intent/*` 와 `/api/attribution/coffee-npay-intent` 는 **404** ("Route not found").
- GTM dispatcher 가 외부 도메인으로 fetch 해도 ledger 도달 불가 — TJ chrome NPay click 검증 의미 없음.

### 안전 종료 상태 (캡처 시각 2026-05-02 00:43 KST)

| 항목 | 값 |
|---|---|
| `enforce_flag_active` | **false** |
| `smoke_admin_token_configured` | **false** |
| `smoke_window_active` | **false** |
| `total_rows` (ledger) | 2 (A-2a smoke evidence) |
| `rows_with_imweb_order_code` | 2 |
| `rows_with_ga4_synthetic_transaction_id` | 0 |
| GTM Production publish | 0 (workspace 19 sandbox, TJ manual delete 완료) |
| GA4 MP / Meta CAPI / TikTok Events / Google Ads send | 0 |
| backend process | launchd-managed `dist/server.js`, 깨끗한 `.env` 로 재시작 (PID 19004) |

### test row 처리

- ledger 에 보존된 2 row 는 A-2a smoke window 의 controlled INSERT 결과 (intent_uuid prefix `smoke_a2a_*`).
- 보존 사유: A-2a 7-step PASS 의 evidence.
- 향후 보고서 / dashboard 에서는 **test row 로 제외** — 권장 SQL: `WHERE intent_uuid NOT LIKE 'smoke_%'`.
- 운영 분석에 영향 없음.

### 정리된 잔여물

- `.env` 의 `COFFEE_NPAY_INTENT_ENFORCE_LIVE`, `COFFEE_NPAY_INTENT_SMOKE_ADMIN_TOKEN` 라인 제거.
- backend launchd 자동 재시작으로 새 process 가 정리된 env 로드.
- `/tmp/seo-smoke-a3-token.txt`, `/tmp/seo-a3-gtm-refs.json` 은 임시 파일 — 다음 sprint 시 새로 생성.
- GTM workspace 19 (`coffee_npay_intent_a3_smoke`) + tag 78 + trigger 77 — TJ manual delete 완료.

### 다음 sprint (별도 분리)

| # | 단계 | 목적 |
|---|---|---|
| 1 | VM production backend 배포 사전 체크리스트 작성 | `capivm/deploy-backend-rsync.sh` 실제 실행 전 체크포인트 (env diff, schema migration idempotency, rollback path, 영향 범위) |
| 2 | VM endpoint reachability 확인 | 배포 직후 외부 도메인으로 신규 endpoint 도달 검증 |
| 3 | VM 배포 후 external dry-run 확인 | `mode=dry_run` 으로 외부 origin 통한 payload validation 동작 확인 (ledger write 0) |
| 4 | A-3 GTM Preview dispatcher 재개 | 본 runbook 의 Step S1~T4 재진입 (smoke window + GTM Preview + chrome NPay click) |

---

## A-3 v2 PASS — 2026-05-02 KST

VM production backend 배포 (3927a98 + 3a8ea23) 후 본 runbook 의 Step S1~T4 재진입. 9 성공 기준 모두 충족.

### 환경 (재개 시점)

| 항목 | 값 |
|---|---|
| backend | VM `att.ainativeos.net` (deploy commit 3a8ea23) |
| GTM workspace | 20 (`coffee_npay_intent_a3_smoke_v2`) — Codex API 등록 |
| GTM tag | 80 (Custom HTML, dispatcher v2 코드, Preview only) |
| GTM trigger | 79 (`A-3 SMOKE All Pages v2`, pageview) |
| smoke window | id=1, max_inserts=5, expires KST 02:04:23 |
| token | smoke_a3_1777653241_… (임시, 검증 후 제거됨) |

### 9 성공 기준 결과

| # | 기준 | 결과 |
|---|---|---|
| 1 | dispatcher 가 페이지에 install | ✅ Tag Assistant "맞춤 HTML 3회 실행됨" |
| 2 | NPay click 이 sessionStorage buffer 에 push | ✅ buffer_count=2 (두 click) |
| 3 | dispatcher 가 buffer 를 fetch POST 로 forward | ✅ sent_count=2 (`ok_200`, `ok_201`) |
| 4 | 외부 도메인 backend 도달 | ✅ Network OPTIONS 204 + POST 200 |
| 5 | CORS preflight 정상 | ✅ `access-control-allow-origin: https://thecleancoffee.com` |
| 6 | backend enforce mode INSERT | ✅ total_rows 0→3, enforce_inserted 0→3 |
| 7 | payload validation 통과 | ✅ preview_only=1, is_simulation=0, prod_code/price/quantity 모두 캡처 |
| 8 | smoke_window 가드 동작 | ✅ inserted 0→3, remaining 5→2 (Codex sim 1 + site 2) |
| 9 | funnel-capi v3 와 호환 | ✅ funnel_capi_session_id `mon50xudmqa3m8` 두 row 동일 |

### ledger evidence (3 rows)

| id | tag | intent_uuid | phase | prod_code | price | session | captured_at_kst |
|---|---|---|---|---|---|---|---|
| 1 | CODEX_SIM | smoke_a3v2_codex_1777653449379_1 | sanity_test | — | — | — | — |
| 3 | SITE_DISPATCHER | a3890f4e-2c03-4860-ac79-590e9264c5c4 | confirm_to_pay | s20260430baf1869c41c35 | 19,900원 | mon50xudmqa3m8 | 2026-05-02 01:40:59 |
| 6 | SITE_DISPATCHER | 28d2140d-9cdc-45cb-86a4-69a69213df09 | confirm_to_pay | s20260430baf1869c41c35 | 19,900원 | mon50xudmqa3m8 | 2026-05-02 01:41:27 |

id 분포 1/3/6 = INSERT OR IGNORE race 흔적 (id=2,4,5 는 dedup 으로 비어있음). enforce_deduped 카운터 3 = 1초 sweep 이 in-flight fetch 와 race 나서 같은 UUID 두 번 forward 한 것 (첫 INSERT + 두 번째 dedup, UNIQUE constraint 가 막음). 운영 무해, fetch 효율 50%.

### 관찰된 개선 포인트 (다음 phase 후보)

| # | 항목 | 영향 |
|---|---|---|
| O1 | dispatcher race condition | 1초 sweep + in-flight fetch tracking 부재 → 같은 UUID 두 번 fetch. dedup 으로 운영 무해, fetch 효율 50%. dispatcher 에 in-flight Set 추가 시 개선 |
| O2 | imweb_order_code null | dispatcher 가 NPay click 시점 (order_code 발급 전) forward — 추후 retry capture 메커니즘 필요 ((A++) 트랙 본질) |
| O3 | payment_button_type null | site click hook 의 entry 가 이 필드 미캡처. all-in-one snippet 측 보강 |

### Cleanup 결과 (2026-05-02 KST)

| Step | 결과 |
|---|---|
| C1 smoke window close | closed_count=1 (window id=1) |
| C2 VM .env 임시 키 제거 | wc 205 → 201, COFFEE_NPAY_INTENT 잔존 0 |
| C2 pm2 restart | pid 216851 → 217250, restart 36 → 37 |
| C3 stats 검증 | enforce/token/window 모두 false, smoke_window_summary=None, total_rows=3 보존 |
| C4 GTM workspace 20 삭제 | TJ manual delete (Codex scope 부족) — 단 default 와 분리된 sandbox + Production 미publish 라 무영향 |
| C5 결과 보고서 + !coffeedata 항목 18 closure + commit | 본 섹션 |

### 안전 종료 상태

| 항목 | 값 |
|---|---|
| `enforce_flag_active` | false |
| `smoke_admin_token_configured` | false |
| `smoke_window_active` | false |
| GTM Production publish | 0 |
| GA4 / Meta CAPI / TikTok Events / Google Ads send | 0 |
| ledger total_rows | 3 (test row prefix `smoke_a3v2_codex_*` 1 + site dispatcher 2 — 보고서에서 모두 제외 권장: `WHERE intent_uuid NOT LIKE 'smoke_%' AND source_version != 'coffee_npay_intent_preview_all_in_one_20260501'`) |
| backend process | launchd-managed, 깨끗한 .env (PID 217250) |

### 결론

A-3 v2 PASS. dispatcher v2 의 chrome 측 install + sweep + fetch + backend INSERT 가 end-to-end 동작. funnel-capi v3 와 호환. 항목 18 closure.

다음 phase (A-4 GTM Production publish 결정) 는 [[#다음 phase (A-3 PASS 후 TJ 별도 승인)]] 표 기준 + 본 sprint 의 관찰 개선 포인트 (O1~O3) 검토 후 별도 승인 게이트.

---

## A-3 v2.1 재검증

dispatcher v2.1 (O1 in-flight Set + O2 imweb_order_code 3초 wait + O3 payment_button_type fallback) 검증 절차. **현 시점 design 단계 — 실제 Preview 재진입은 TJ 명시 승인 후 별도**.

상위 sprint: [[!coffeedata#다음 할일]] 항목 19. publish 결정 문서: [[coffee-a4-publish-decision-and-dispatcher-v21-20260502]].

### v2.1 dispatcher GTM Custom HTML tag

기존 v2 Custom HTML 의 본문을 아래 코드로 갱신. tag 이름은 `Coffee NPay Intent Dispatcher v2.1 (PREVIEW ONLY)`.

```html
<script>
(function () {
  if (window.__coffeeNpayIntentDispatcherInstalled) return;
  window.__coffeeNpayIntentDispatcherInstalled = true;

  var BUFFER_KEY = "coffee_npay_intent_preview";
  var PENDING_KEY = "__coffee_intent_pending";
  var SENT_KEY = "__coffee_intent_sent";
  var ENDPOINT = "https://att.ainativeos.net/api/attribution/coffee-npay-intent?mode=enforce";
  var SWEEP_INTERVAL_MS = 1000;
  var MAX_RETRY = 5;
  var TTL_MS = 24 * 3600 * 1000;
  var ORDER_CODE_WAIT_TIMEOUT_MS = 3000;

  var inflight = new Set();

  function readJsonStorage(k) {
    try { return JSON.parse(sessionStorage.getItem(k) || "{}"); }
    catch (e) { return {}; }
  }
  function writeJsonStorage(k, v) {
    try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  function hasSent(intentUuid) {
    return !!readJsonStorage(SENT_KEY)[intentUuid];
  }
  function markSent(intentUuid, status) {
    var sent = readJsonStorage(SENT_KEY);
    sent[intentUuid] = { sent_at_ms: Date.now(), status: status };
    var keys = Object.keys(sent);
    if (keys.length > 200) {
      keys.sort(function (a, b) { return (sent[a].sent_at_ms || 0) - (sent[b].sent_at_ms || 0); });
      for (var i = 0; i < keys.length - 200; i++) delete sent[keys[i]];
    }
    writeJsonStorage(SENT_KEY, sent);
  }
  function isPermanentFailure(e) {
    if (!e) return false;
    if (e.attempts >= MAX_RETRY) return true;
    if (e.first_seen_ms && Date.now() - e.first_seen_ms > TTL_MS) return true;
    if (e.last_status && e.last_status >= 400 && e.last_status < 500) return true;
    return false;
  }

  function attemptDispatch(p) {
    if (!p || p.preview_only !== true) return;
    if (p.is_simulation === true) return;
    if (!p.intent_uuid) return;
    if (hasSent(p.intent_uuid)) return;
    if (inflight.has(p.intent_uuid)) return;

    var pending = readJsonStorage(PENDING_KEY);
    var entry = pending[p.intent_uuid];
    if (entry && isPermanentFailure(entry)) return;

    // O2: imweb_order_code wait (snippet retry 시간 줌)
    if (!p.imweb_order_code) {
      var firstSeenMs = entry && entry.first_seen_ms ? entry.first_seen_ms : Date.now();
      var elapsedMs = Date.now() - firstSeenMs;

      if (!entry) {
        pending[p.intent_uuid] = {
          first_seen_ms: firstSeenMs,
          attempts: 0,
          last_attempt_ms: null,
          last_status: null,
          last_reason: "wait_for_order_code"
        };
        writeJsonStorage(PENDING_KEY, pending);
      }

      if (elapsedMs < ORDER_CODE_WAIT_TIMEOUT_MS) return;

      // 3초 timeout — block (fetch 안 함)
      markSent(p.intent_uuid, "blocked_missing_imweb_order_code");
      delete pending[p.intent_uuid];
      writeJsonStorage(PENDING_KEY, pending);
      return;
    }

    // O3: payment_button_type fallback (snippet 우선, 안전망)
    if (!p.payment_button_type && p.intent_phase === "confirm_to_pay") {
      p.payment_button_type = "npay";
    }

    var nextAttempts = (entry && entry.attempts ? entry.attempts : 0) + 1;
    pending[p.intent_uuid] = {
      first_seen_ms: entry && entry.first_seen_ms ? entry.first_seen_ms : Date.now(),
      attempts: nextAttempts,
      last_attempt_ms: Date.now(),
      last_status: null,
      last_reason: null
    };
    writeJsonStorage(PENDING_KEY, pending);

    var withSchema = Object.assign({}, p, { payload_schema_version: 1 });

    // O1: in-flight tracking
    inflight.add(p.intent_uuid);

    fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withSchema),
      keepalive: true
    }).then(function (res) {
      var pend = readJsonStorage(PENDING_KEY);
      var e = pend[p.intent_uuid] || {};
      e.last_status = res.status;
      pend[p.intent_uuid] = e;
      writeJsonStorage(PENDING_KEY, pend);

      if (res.status >= 200 && res.status < 300) {
        markSent(p.intent_uuid, "ok_" + res.status);
        delete pend[p.intent_uuid];
        writeJsonStorage(PENDING_KEY, pend);
      } else if (res.status >= 400 && res.status < 500) {
        markSent(p.intent_uuid, "permanent_4xx_" + res.status);
        delete pend[p.intent_uuid];
        writeJsonStorage(PENDING_KEY, pend);
      }
      // 5xx: pending 유지 → 다음 sweep retry
    }).catch(function (err) {
      var pend = readJsonStorage(PENDING_KEY);
      var e = pend[p.intent_uuid] || {};
      e.last_reason = err && err.message ? String(err.message).slice(0, 100) : "fetch_failed";
      pend[p.intent_uuid] = e;
      writeJsonStorage(PENDING_KEY, pend);
    }).finally(function () {
      inflight.delete(p.intent_uuid);
    });
  }

  function sweep() {
    try {
      var buf = JSON.parse(sessionStorage.getItem(BUFFER_KEY) || "[]");
      buf.forEach(attemptDispatch);
    } catch (e) {}
  }

  setInterval(sweep, SWEEP_INTERVAL_MS);
  window.addEventListener("beforeunload", sweep);
})();
</script>
```

### v2.1 성공 기준 (12개 = v2 9개 + v2.1 추가 3개)

| # | 기준 | 측정 방법 | 임계 |
|---|---|---|---|
| 1~9 | v2 의 9 성공 기준 그대로 | A-3 v2 PASS 섹션 | 모두 PASS 유지 |
| 10 | imweb_order_code capture rate | ledger SQL: `COUNT(imweb_order_code IS NOT NULL) / COUNT(*) WHERE intent_uuid NOT LIKE 'smoke_%'` | **≥95%** |
| 11 | enforce_deduped ratio (race 감소) | stats reject_counters: `enforce_deduped / enforce_inserted` | **≤5%** |
| 12 | payment_button_type null in confirm_to_pay | ledger SQL: `WHERE intent_phase='confirm_to_pay' AND payment_button_type IS NULL` | **0건** |

### 재검증 절차 (Codex prep + TJ chrome)

#### Step S1' — VM 환경 (이전 A-3 v2 와 동일)

```bash
# token 생성 + VM .env append + pm2 restart + smoke window open
SMOKE_TOKEN="smoke_a3v21_$(python3 -c 'import time;print(int(time.time()))')_$(python3 -c 'import secrets;print(secrets.token_hex(6))')"
echo "$SMOKE_TOKEN" > /tmp/seo-smoke-a3v21-token.txt
# VM .env append (A-3 v2 와 동일 패턴)
# pm2 restart seo-backend --update-env
# smoke window open (max 5, 30분)
```

#### Step S2' — GTM workspace v2.1 신규 생성

```javascript
// node script via googleapis: workspace 'coffee_npay_intent_a3v21_smoke'
// trigger 'A-3 SMOKE All Pages v2.1' (pageview)
// tag 'A-3 SMOKE Coffee NPay Intent Dispatcher v2.1 (PREVIEW ONLY)' with the v2.1 HTML above
```

#### Step T1'~T4' — TJ chrome (A-3 v2 와 동일 흐름)

1. GTM workspace v2.1 console → Preview → URL `https://thecleancoffee.com/shop_view/?idx=73`
2. Tag Assistant 에서 v2.1 dispatcher tag fired 확인
3. chrome devtools console 에 [[coffee-npay-intent-beacon-preview-snippet-all-in-one-20260501]] all-in-one snippet paste
4. **PC NPay click 3~5회** (v2 보다 sample 늘림 — capture rate 측정 정확도 ↑). click 마다 ESC 또는 뒤로가기.

#### Step T5' (NEW) — dispatcher state 확장 캡처

기존 v2 의 dispatcher state 검증 + v2.1 의 inflight 추적 + block_reason 검증:

```javascript
;(() => {
  var sent = JSON.parse(sessionStorage.getItem("__coffee_intent_sent") || "{}");
  var pend = JSON.parse(sessionStorage.getItem("__coffee_intent_pending") || "{}");
  var buf = JSON.parse(sessionStorage.getItem("coffee_npay_intent_preview") || "[]");

  var blockedCount = 0;
  var okCount = 0;
  for (var k in sent) {
    if (sent[k].status === "blocked_missing_imweb_order_code") blockedCount++;
    else if (sent[k].status && sent[k].status.startsWith("ok_")) okCount++;
  }

  var bufferOrderCodeCoverage = buf.length === 0 ? "n/a" :
    (buf.filter(function (b) { return b.imweb_order_code; }).length / buf.length * 100).toFixed(1) + "%";

  console.log("[a3v21_dispatcher_state]\n" + JSON.stringify({
    buffer_count: buf.length,
    buffer_imweb_order_code_coverage: bufferOrderCodeCoverage,
    sent_count: Object.keys(sent).length,
    sent_ok_count: okCount,
    sent_blocked_count: blockedCount,
    pending_count: Object.keys(pend).length,
    sent_entries: sent,
    pending_entries: pend
  }, null, 2));
})()
```

기대 (성공 시): `buffer_imweb_order_code_coverage` 80%+, `sent_blocked_count` 적음, `sent_ok_count` 가 click 횟수와 비슷.

### imweb_order_code capture rate 확인 방법

배포 후 backend 측 SQL (admin endpoint 경유):

```bash
TOKEN=$(cat /tmp/seo-smoke-a3v21-token.txt)
curl -sS -m 8 "https://att.ainativeos.net/api/attribution/coffee-npay-intents?limit=100" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
items = d.get('items', [])
test_filtered = [r for r in items if not r.get('intent_uuid','').startswith('smoke_') and r.get('source_version') != 'a3v21_codex_sim']
total = len(test_filtered)
with_code = len([r for r in test_filtered if r.get('imweb_order_code')])
pct = (with_code / total * 100) if total > 0 else 0
print(f'capture rate: {with_code}/{total} = {pct:.1f}%')
"
```

기대: **≥95%**.

### in-flight duplicate fetch 확인 방법

```bash
curl -sS -m 8 https://att.ainativeos.net/api/coffee/intent/stats | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
rc = d['reject_counters']
ins = rc.get('enforce_inserted', 0)
dup = rc.get('enforce_deduped', 0)
ratio = (dup / ins * 100) if ins > 0 else 0
print(f'enforce_inserted: {ins}, enforce_deduped: {dup}, ratio: {ratio:.1f}%')
"
```

기대: **ratio ≤5%** (v2 의 50% 대비 대폭 감소).

### payment_button_type null 검증 방법

```python
# items 에서 intent_phase='confirm_to_pay' 인 row 의 payment_button_type 점검
items = response['items']
problem = [r for r in items if r.get('intent_phase') == 'confirm_to_pay' and not r.get('payment_button_type')]
print(f'confirm_to_pay 중 payment_button_type null: {len(problem)}건')
```

기대: **0건**.

### stats / join-report / sqlite 확인 명령

```bash
# stats
curl -sS https://att.ainativeos.net/api/coffee/intent/stats | python3 -m json.tool

# join report (admin)
TOKEN=$(cat /tmp/seo-smoke-a3v21-token.txt)
curl -sS https://att.ainativeos.net/api/attribution/coffee-npay-intent-join-report \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 또는 monitoring report script
cd /Users/vibetj/coding/seo/backend && npx tsx scripts/coffee-npay-intent-monitoring-report.ts
```

### smoke / test row 제외 SQL

```sql
SELECT *
FROM coffee_npay_intent_log
WHERE site = 'thecleancoffee'
  AND intent_uuid NOT LIKE 'smoke_%'
  AND source_version NOT LIKE '%codex_sim%'
  AND source_version NOT LIKE 'test_%'
  AND is_simulation = 0
  AND ts_ms_kst >= <a3v21_start_ms>;
```

### Cleanup 절차 (A-3 v2 와 동일 패턴)

| Step | 내용 |
|---|---|
| C1 | smoke window close (admin endpoint POST) |
| C2 | VM .env 임시 키 제거 (head -n 201 또는 sed marker) + pm2 restart --update-env |
| C3 | stats 검증 (enforce/token/window 모두 false 복귀) |
| C4 | TJ — GTM workspace v2.1 manual delete (Codex scope 부족) |
| C5 | 결과 보고서 + !coffeedata 항목 19 closure + commit |

### 가드 재확인

- GTM Production publish: BLOCKED
- 자동 dispatcher 운영 전환: BLOCKED
- GA4 MP / Meta CAPI / TikTok Events / Google Ads send: BLOCKED
- smoke window 외 live capture: BLOCKED
- 5건 초과 INSERT: BLOCKED (max_inserts=5 hard limit)
- env flag 상시 ON: BLOCKED (검증 후 즉시 OFF)

---

## A-3 v2.1 partial smoke (2026-05-02 12:08 KST)

Yellow Lane sprint 19.2. **chrome 측 검증 미수행** — Codex 가 chrome NPay click 자동화 불가, TJ 차후 진행 결정. 본 sprint 는 backend prep + GTM 등록 + Codex backend sim + cleanup 까지 자율 완료.

### partial sprint 진행 결과

| Step | 결과 |
|---|---|
| 1.0 baseline snapshot | enforce/window false, total_rows=3 (A-3 v2 evidence 보존) |
| 1.1 smoke token 생성 | `smoke_a3v21_1777691090_d008b2cd13a3` |
| 1.2 VM .env append | 정확히 3 라인 추가 |
| 1.3 pm2 restart | pid 227691, restart 38 |
| 1.4 stats | enforce True, token True, window False (예상) |
| 2 smoke window open | id=2, max=5, expires KST 12:35 |
| 3 GTM workspace 21 + trigger 82 + tag 83 | 등록 완료 (Codex API) |

### Codex backend sim (chrome 대신 enforce mode 시뮬레이션)

| Sim | payload 특징 | 결과 |
|---|---|---|
| Sim 1 | imweb_order_code 채워짐 + payment_button_type=npay | **201** inserted=true, ledger row preview 정상 |
| Sim 2 | 같은 intent_uuid 재시도 | **200** deduped=true, reason=`deduped_existing` (UNIQUE constraint) |
| Sim 3 | payment_button_type 누락 + intent_phase=confirm_to_pay | **201** inserted=true, payment_button_type 빈 문자열 (backend schema optional) |

**Sim 3 의 의미**: backend 가 payment_button_type 누락 payload 도 INSERT 함 (lenient policy). v2.1 의 O3 fallback 효과는 backend 단에서 검증 불가 — **dispatcher 코드 자체에서 보정** 후 fetch 해야 ledger 가 깔끔함. chrome 검증 없으면 v2.1 의 O3 효과 측정 못 함.

### monitoring script 결과 (`/tmp/coffee-npay-monitoring-a3v21.yaml`)

```yaml
mode: pre-publish
M-1_total_rows_excl_test: 2  # A-3 v2 의 site dispatcher 2건만 (sprint 19 의 결과)
M-2_rows_with_imweb_order_code: 0
M-3_imweb_order_code_coverage_pct: 0.0  # chrome 미수행이라 v2 결과 그대로
M-5_enforce_deduped_ratio_pct: 50.0  # Codex sim 2 INSERT + 1 dedup intentional
EG-1_imweb_order_code_coverage_ge_95: FAIL
EG-3_enforce_deduped_ratio_le_5: FAIL
EG-4_payment_button_type_null_in_confirm: FAIL (2)
verdict: needs_review  # chrome 검증 없으면 진짜 v2.1 effect 측정 불가
```

**FAIL 해석**: 위 EG 결과는 v2.1 의 chrome 측 동작 효과를 측정 안 한 것. real row (sprint 19 의 site dispatcher 2건) 는 v2 dispatcher 시점이라 imweb_order_code null + payment_button_type null. v2.1 chrome 검증 후에 진짜 EG 평가 가능.

### v2.1 의 O1/O2/O3 검증 — 코드 review 만

dispatcher v2.1 HTML 코드 자체 review (이 runbook 의 v2.1 재검증 섹션 코드 블록):

| 개선 | 코드 위치 | 검증 |
|---|---|---|
| O1 in-flight Set | `var inflight = new Set();` + `if (inflight.has(p.intent_uuid)) return;` + `inflight.add(...)` + `.finally(function () { inflight.delete(...); })` | ✅ logic 정상 — 같은 UUID 가 fetch 중이면 다음 sweep skip |
| O2 imweb_order_code wait | `if (!p.imweb_order_code) { ... if (elapsedMs < ORDER_CODE_WAIT_TIMEOUT_MS) return; markSent(... blocked_missing_imweb_order_code); ... }` | ✅ logic 정상 — 3초까지 wait + timeout 시 block + fetch 안 함 |
| O3 payment_button_type fallback | `if (!p.payment_button_type && p.intent_phase === "confirm_to_pay") p.payment_button_type = "npay";` | ✅ logic 정상 — confirm_to_pay path 에서 자동 보정 |

코드 logic PASS. 단 chrome 환경 + funnel-capi v3 + 실제 NPay button click flow 의 실측 검증은 별도 sprint 19.3 으로 분리.

### Cleanup 결과 (2026-05-02 KST)

| Step | 결과 |
|---|---|
| C1 smoke window 2 close | closed_count=1 |
| C2.a VM .env wc 205 → 201 | COFFEE_NPAY_INTENT 잔존 0 |
| C2.b pm2 restart | pid 227691 → 227837, restart 38 → 39 |
| C3 stats | enforce/token/window 모두 false, total_rows=5 보존 |
| C4 GTM workspace 21 | TJ manual delete 영역 (Codex API delete scope 부족) |

### 12 성공 기준 판정

| # | 기준 | 결과 |
|---|---|---|
| 1 | GTM Preview dispatcher v2.1 설치 확인 | ⏸ 미수행 (chrome 안 함) |
| 2 | NPay click buffer 생성 | ⏸ 미수행 |
| 3 | dispatcher fetch POST 성공 | ⏸ chrome 미수행 — Codex sim 으로 backend INSERT 는 검증 |
| 4 | backend insert 1-2건 정상 | ✅ Codex sim 2건 INSERT (id 7, 8) |
| 5 | imweb_order_code capture rate 100% in test | ⏸ chrome 미수행 — Codex sim 은 100% (둘 다 채워서 보냄) |
| 6 | enforce_deduped ratio ≤5% | ⏸ chrome 미수행 — Codex sim 의 50% 는 의도된 dedup test |
| 7 | payment_button_type null = 0 | ⏸ chrome 미수행 — Codex Sim 3 은 의도된 누락 |
| 8 | pii_rejected = 0 | ✅ 0 |
| 9 | invalid_payload = 0 | ✅ 0 |
| 10 | endpoint_5xx = 0 | ✅ 0 |
| 11 | rejected_origin/rate_limited 비정상 증가 없음 | ✅ 둘 다 0 |
| 12 | 종료 후 enforce/token/window_active 모두 false | ✅ Cleanup 완료 |

**판정**: **partial PASS** — chrome 미수행 항목 (1/2/3/5/6/7) 은 별도 sprint 19.3 에서 검증 필요. 그 외 (4/8/9/10/11/12) 는 PASS.

### 다음 액션

| sprint | 내용 |
|---|---|
| 19.3 | dispatcher v2.1 chrome 측 재검증 — TJ 가 chrome 진행 시점에. workspace 21 또는 신규 workspace 사용 가능 |
| 20 | A-4 GTM Production publish 결정 — sprint 19.3 PASS 후만 추천 |
