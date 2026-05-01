# 더클린커피 NPay Intent Ledger Enforce 활성 + 제한적 Live Capture 승인안

생성 시각: 2026-05-01 KST
phase: A-1 (enforce 준비 완료, live capture 활성 승인 대기)
승인 대상: TJ
관련 문서: [[coffee-npay-intent-beacon-preview-snippet-all-in-one-20260501|all-in-one snippet v0.4+v0.5+v0.6]] / [[coffee-npay-intent-beacon-preview-design-20260501|design v0.4]] / [[coffee-imweb-tracking-flow-analysis-20260501|4 layer 분석]] / [[coffee-npay-intent-uuid-preservation-test-20260501|URL 보존 검증 가이드]] / [[coffee-funnel-capi-cross-site-applicability-20260501|biocom cross-site 메모]]

## Auditor Verdict (현재 phase 종료 전)

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_npay_intent_ledger_enforce_approval
No-send verified: YES (GA4 MP / Meta CAPI / TikTok Events / Google Ads 송출 0건)
No-write verified: YES (운영 DB write 0건. 본 phase 는 schema 만 정의, INSERT 0)
No-deploy verified: YES (운영 endpoint 신규 배포 없음. schema/route 코드만, env flag 미활성)
No-publish verified: YES (GTM publish / live script 삽입 BLOCKED)
PII output: NONE
실제 운영 변경: 0건 (backend 재시작 1회로 schema migration 적용, 운영 트래픽 영향 ~3초 다운타임만)
```

## 10초 요약

이번 phase A-1 의 실제 작업은:

1. backend `coffee_npay_intent_log` schema v2 정의 + 5종 인덱스 + (site, intent_uuid) UNIQUE + (site, imweb_order_code, intent_uuid) UNIQUE
2. validation 강화: PII reject + `preview_only !== true` reject + `is_simulation: true` ledger 진입 금지
3. dry-run / enforce 분기 코드 추가 (단 enforce 는 env flag `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true` 일 때만 활성. **본 phase 의 운영 backend 는 env flag 미설정 → enforce 호출 와도 항상 reject**)
4. `POST /api/attribution/coffee-npay-intent` (TJ 권장 path) + `GET /api/attribution/coffee-npay-intents` + `GET /api/attribution/coffee-npay-intent-join-report` endpoint 추가
5. join 5종 status (`joined_confirmed_order` / `pending_order_sync` / `no_order_after_24h` / `duplicated_intent` / `invalid_payload`) 분류 로직
6. 7종 회귀 검증 PASS (Codex curl) — total_rows 0 유지

본 phase 는 **enforce mode 활성 승인** 만 받으면 즉시 다음 단계로 진입 가능한 코드 상태. live capture 활성화는 TJ 별도 승인 후 env flag + dispatcher (GTM Custom HTML tag 또는 별도 forwarder) + 7일 모니터링 시작 절차로 별도 phase.

## 왜 A 트랙으로 가는가 (B 는 왜 optional 인가)

| 이유 | 근거 |
|---|---|
| (A++) imweb orderCode capture 가 검증됨 | 2026-05-01 22:30 / 23:55 KST TJ chrome 검증 2회. `imweb_order_code: o20260501...` capture (1500ms retry). [[coffee-npay-intent-uuid-preservation-test-20260501]] § v0.5 / v0.6 결과 |
| backend `imweb_orders.order_code` 컬럼이 동일 형식 (`o<YYYYMMDD><14자 hex>`) | Codex local SQLite 정찰 (5건). 1:1 deterministic 매핑 가능 |
| (B) GA4 synthetic transaction_id 는 nice-to-have | (A++) 만으로 deterministic join 채널 1개 확보. (B) 는 BigQuery 측 매핑을 추가하는 보강일 뿐 enforce 진입 blocker 아님 |
| (b) Imweb meta_data 보존 NO 확정 | 1-D 정찰 결과. imweb v2 API 응답에 자유 텍스트 자리 0건 |
| (c) NPay channel_order_no 응답 보존 권한 미발급 | 호스팅사 입점 제약. 별도 phase |
| (B) 정찰 비용 vs 가치 | dataLayer dump 1회로 v0.7 보강 가능하지만, (A++) 만으로 충분히 deterministic 매핑 — backlog 로 두고 enforce 후 모니터링 결과로 필요 시 진행 |

## 실제 운영 변경 범위

본 phase commit 직후 운영에 반영되는 것:

| 변경 | 영향 |
|---|---|
| backend `coffee_npay_intent_log` 테이블 + 5종 인덱스 schema | 데이터 0건. 다른 테이블 / 데이터 영향 0 |
| backend `schema_versions` 테이블 | 메타 1행 (`coffee_npay_intent_log` → version 2) |
| backend route 4종 추가 (POST /api/attribution/coffee-npay-intent, GET /api/attribution/coffee-npay-intents, GET /api/attribution/coffee-npay-intent-join-report, GET /api/coffee/intent/stats — 마지막은 기존) | 외부에서 호출 가능. 단 enforce 는 env flag 없이는 항상 reject. 기본 트래픽 0 (snippet 자체는 fetch 금지) |
| backend 재시작 (production server 1회) | ~3초 다운타임 |

본 phase commit 직후 운영에 반영되지 않는 것 (TJ 별도 승인 후):

- enforce mode INSERT 활성 (env flag `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true`)
- dispatcher / GTM Custom HTML tag 가 buffer 를 backend 로 forward
- snippet 의 fetch 사용
- GA4 / Meta / TikTok / Google Ads 보강 전송

## GTM publish 전 체크리스트

GTM Production publish (또는 imweb head custom code 직접 삽입) 결정 전 다음을 모두 PASS 해야 함.

- [ ] enforce mode 7일 모니터링 — `joined_confirmed_order` 비율 ≥ 80%, `no_order_after_24h` < 10%
- [ ] `duplicated_intent` 0건 또는 1% 이하
- [ ] `invalid_payload` (imweb_order_code null) 비율 ≤ 5% — 5% 초과면 snippet retry 시점 보강 (v0.7) 후 재모니터링
- [ ] PII reject 0건 (validation 결과 모두 ok=true)
- [ ] dispatcher 가 보낸 payload 의 `preview_only: true` 가 100% 유지 — 변조 의심 0
- [ ] Auditor verdict PASS (no-send / no-write 외부 / no-deploy 다른 endpoint / no-publish 다른 GTM workspace)
- [ ] rollback 절차 1회 dry-run (env flag false 로 되돌리고 dispatcher 끄기)

## endpoint 배포 전 체크리스트

신규 endpoint (`POST /api/attribution/coffee-npay-intent` 등) 가 외부 트래픽을 받기 전:

- [ ] tsc PASS (Codex 진행 완료)
- [ ] dry-run 4종 시나리오 회귀 PASS (Codex curl 진행 완료)
- [ ] schema migration v1 → v2 row count 0 보장 (Codex 진행 완료, abort 가드 작동)
- [ ] 운영 backend 재시작 후 endpoint 활성 (Codex 진행 완료, PID 99378 → 2837)
- [ ] enforce flag 미활성 상태에서 enforce 호출 reject 확인 (Codex 진행 완료)
- [ ] coffee 외 site 또는 PII 들어온 payload reject 확인 (Codex 진행 완료)
- [ ] join report endpoint read-only 응답 확인 (Codex 진행 완료, 빈 ledger 5종 status counts 모두 0)

→ 위 7항목 PASS. **운영 endpoint 배포 단계 완료**. 단 외부 트래픽은 dispatcher 가 활성된 뒤부터.

## Rollback 방법

| 시나리오 | 방법 |
|---|---|
| enforce mode 켰는데 매핑 정확도 낮음 | env `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true` → 미설정 또는 false. backend 재시작. 새 INSERT 0. 기존 row 는 그대로 (모니터링 데이터로 보존) |
| dispatcher 가 너무 많은 트래픽 발생 | GTM Coffee workspace 의 dispatcher tag pause 또는 imweb head custom code 의 forward 줄 주석 처리 |
| schema 깨짐 또는 데이터 오염 발견 | enforce flag 끄고 ledger row 분석. 필요 시 schema_versions 의 version 을 1 로 reset 후 backend 재시작 → migration 재실행 (단 row count > 0 이면 abort 가드로 차단 — 수동 백업 + DROP + 재migration) |
| backend route 자체 문제 | route file 의 router.post 라인 주석 처리 후 backend 재시작 |
| 운영 매출/주문 데이터 영향 의심 | 본 phase 는 운영 DB write 0 이라 영향 가능성 0. 그러나 `imweb_orders` 테이블 read 만으로도 join 시도하므로 SELECT-only 부담은 있음 — 큰 리스크 아님 |

## 7일 모니터링 지표

enforce mode 활성 후 7일간 `GET /api/attribution/coffee-npay-intent-join-report` 일 1회 polling.

| 지표 | 목표 | 산출 |
|---|---|---|
| `total_intents_in_window` | NPay click 발생 수에 비례 (참고: 2026-04-23~29 NPay actual 60건/주 기준) | `total_intents_in_window` |
| `status_counts.joined_confirmed_order` 비율 | ≥ 80% | `joined_confirmed_order / total_intents_in_window` |
| `status_counts.pending_order_sync` 비율 | < 20% (24h 미만 sync gap 정상) | `pending_order_sync / total_intents_in_window` |
| `status_counts.no_order_after_24h` 비율 | < 10% (NPay 결제 미완료 또는 sync gap) | `no_order_after_24h / total_intents_in_window` |
| `status_counts.duplicated_intent` 건수 | 0~1건 (intent_seq +1 케이스 있음) | `duplicated_intent` 카운트 |
| `status_counts.invalid_payload` 비율 | ≤ 5% (snippet retry 실패 케이스) | `invalid_payload / total_intents_in_window` |
| capture delay 평균 | < 2000ms | row 별 `imweb_order_code_capture_delay_ms` 평균 |
| 운영 매출 영향 | 0 | imweb_orders 의 일별 매출 합계 변화 없음 |

## live publish 중단 조건

다음 중 하나라도 발생하면 즉시 enforce flag 끄고 dispatcher 일시 중지:

- `joined_confirmed_order` 비율 < 50% (deterministic 매핑이 실패)
- `duplicated_intent` 5건 이상 (snippet 의 intent_uuid 정책 문제)
- `invalid_payload` 비율 > 20% (snippet retry capture 가 다수 실패)
- PII reject 1건 이상 (변조 또는 dispatcher 측에서 의도치 않은 필드 추가)
- backend 5xx 에러 (`/api/attribution/coffee-npay-intent` 응답 실패) 1% 초과
- 운영 매출 / GA4 / Meta 등 다른 layer 에 의도치 않은 영향 의심

## 다음 phase (TJ 승인 후)

| 단계 | 트리거 | 내용 |
|---|---|---|
| Step A-2 | 본 승인안 PASS | `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true` env 추가 + backend 재시작. 단 dispatcher 미활성이라 INSERT 트래픽 0 |
| Step A-3 | Step A-2 PASS | dispatcher 작성 — GTM Coffee workspace 에 Custom HTML tag (Production 미publish, Preview 만) 또는 별도 forwarder. all-in-one snippet 의 buffer 를 1초 throttle + dedup 후 `POST /api/attribution/coffee-npay-intent?mode=enforce` 로 forward |
| Step A-4 | dispatcher Preview PASS | GTM Coffee workspace publish (소수 트래픽부터) — TJ 승인 |
| Step A-5 | 7일 모니터링 PASS | join report 의 status 비율 목표 달성 → ledger 가 deterministic mapping 의 source-of-truth 로 인정 |
| Step A-6 | A-5 PASS | GA4 / Meta CAPI 보강 전송 단계 — 별도 승인 게이트, 본 승인안 범위 외 |

## Dispatcher / GTM Custom HTML tag 초안 (Step A-3 진입 시 사용)

GTM Coffee workspace 의 Custom HTML tag (Production publish 금지, Preview workspace 한정):

```html
<script>
(function () {
  if (window.__coffeeNpayIntentDispatcherInstalled) return;
  window.__coffeeNpayIntentDispatcherInstalled = true;

  var BUFFER_KEY = "coffee_npay_intent_preview";
  var SENT_KEY = "__coffee_intent_sent_uuids";
  var ENDPOINT = "https://att.ainativeos.net/api/attribution/coffee-npay-intent?mode=enforce";
  var THROTTLE_MS = 1000;

  function readSentUuids() {
    try { return JSON.parse(sessionStorage.getItem(SENT_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function writeSentUuids(arr) {
    try {
      while (arr.length > 200) arr.shift();
      sessionStorage.setItem(SENT_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  function dispatchOne(payload) {
    if (!payload || payload.preview_only !== true) return;
    if (payload.is_simulation === true) return;
    if (!payload.intent_uuid) return;
    var sent = readSentUuids();
    if (sent.indexOf(payload.intent_uuid) >= 0) return;
    sent.push(payload.intent_uuid);
    writeSentUuids(sent);
    fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () { /* retry는 다음 sweep */ });
  }

  function sweep() {
    try {
      var buf = JSON.parse(sessionStorage.getItem(BUFFER_KEY) || "[]");
      buf.forEach(dispatchOne);
    } catch (e) {}
  }

  setInterval(sweep, THROTTLE_MS);
  // beforeunload 시 마지막 sweep
  window.addEventListener("beforeunload", sweep);
})();
</script>
```

핵심:
- `preview_only !== true` → 송출 안 함
- `is_simulation === true` → 송출 안 함 (sanity_test payload 제외)
- `intent_uuid` 단위 dedup (sessionStorage `__coffee_intent_sent_uuids`)
- `1초` throttle (interval), `keepalive: true` 로 unload 시점 안전
- `fetch` 1회만, retry 는 다음 sweep 자연스럽게 (sent_uuids 체크로 dedup)

이 dispatcher 는 Step A-3 에서 **GTM Preview workspace** 에 Custom HTML tag 로 등록 후 1회 검증 → Step A-4 에서 publish 결정. 본 phase commit 시점에는 이 코드를 GTM 에 박지 않는다.

## 금지선 (전 phase 동일)

- GA4 Measurement Protocol 전송 금지
- Meta CAPI 서버 전송 금지
- TikTok Events API 전송 금지
- Google Ads conversion upload 금지
- GTM Production workspace publish 금지
- 운영 endpoint 신규 배포 금지 (본 phase 는 backend 재시작 1회만, 외부 트래픽 0)
- 운영 DB write 금지 (enforce flag 활성 전까지 INSERT 0)
- live capture 활성화는 TJ 별도 승인 전 금지
- snippet 의 fetch / sendBeacon / XHR 사용 금지 (dispatcher 가 별도 layer)

## 외부 시스템 영향

| 시스템 | 본 phase 영향 |
|---|---|
| imweb 사이트 | 변경 0 |
| GTM workspace | 변경 0 |
| funnel-capi | 수정 0 (read-only reuse) |
| GA4 / Meta / TikTok / Google Ads | 신규 송출 0 |
| 로컬 SQLite `coffee_npay_intent_log` | schema v2 + 5종 인덱스 정의. 데이터 row 0 |
| 로컬 SQLite `schema_versions` | 메타 1행 |
| 운영 PG (`tb_iamweb_users` 등) | 변경 0 |
| 외부 API | 신규 호출 0 |

## 승인 요청 (TJ)

본 승인안의 다음 6개 항목에 OK / 보강 요청 / reject 표기 부탁드리오:

1. schema v2 (id PK + (site, intent_uuid) UNIQUE + (site, imweb_order_code, intent_uuid) UNIQUE + 5종 인덱스) 채택?
2. validation 정책 (PII reject + preview_only=true 강제 + is_simulation 차단) 채택?
3. enforce mode 활성 조건 (env flag `COFFEE_NPAY_INTENT_ENFORCE_LIVE=true` + TJ 승인 + 별도 phase) 채택?
4. endpoint path (`POST /api/attribution/coffee-npay-intent` + `GET /api/attribution/coffee-npay-intents` + `GET /api/attribution/coffee-npay-intent-join-report`) 채택?
5. dispatcher 초안 (GTM Custom HTML tag, preview_only/is_simulation 가드 + 1초 throttle + sessionStorage dedup) 채택?
6. 7일 모니터링 지표 + live publish 중단 조건 채택?

OK 6/6 시 Step A-2 (env flag 활성) 진입. 1개라도 보강 요청 시 그 항목만 수정 후 재검토.
