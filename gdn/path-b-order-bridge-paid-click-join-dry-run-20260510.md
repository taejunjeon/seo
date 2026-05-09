# Path B order bridge paid click join dry-run

작성 시각: 2026-05-10 00:11 KST

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  lane: Green read-only dry-run
  allowed_actions:
    - VM Cloud SQLite read-only query
    - order_bridge_ledger to paid_click_intent_ledger join dry-run
    - no-send result reporting
    - gptconfirm packaging
  forbidden_actions:
    - VM Cloud write
    - GTM Production publish
    - Google Ads/GA4/Meta/TikTok/Naver send
    - Google Ads conversion upload
    - raw email/phone/member_code/order/payment storage or logging
    - send_candidate=true
  source_window_freshness_confidence:
    source: VM Cloud SQLite order_bridge_ledger and paid_click_intent_ledger read-only snapshot
    window: order_bridge canary rows at 2026-05-09 12:39:56Z and 2026-05-09 13:06:09Z, paid_click_intent ledger through 2026-05-09 14:50:14Z
    site: biocom
    freshness: same-session read-only dry-run
    confidence: high for the two canary rows, medium for broader production inference
```

## 한 줄 결론

1시간 canary row 2건은 주문, 로그인 identity, client/session은 채워졌지만, `paid_click_intent_ledger`와 client/session/local-session 기준으로 연결되는 click row는 0건입니다. 시간 범위만으로는 후보가 수백에서 천 건 이상이라 Google Ads 전송 후보로 쓰면 안 됩니다.

## 무엇을 봤나

- 대상: VM Cloud SQLite의 `order_bridge_ledger` canary row 2건.
- 비교 대상: VM Cloud SQLite의 `paid_click_intent_ledger`.
- 방식: read-only join dry-run.
- lookback: 1d / 7d / 30d.
- join 후보:
  - `client_id`
  - `ga_session_id`
  - `local_session_id_hash` versus `sha256(paid_click_intent_ledger.local_session_id)`
  - 보조 관찰용 time window only
- 전송 상태: `send_candidate=false`, Google Ads upload 후보 0.

## 숫자 결과

### Canary row 1

- row status: `identity_only_quarantine`.
- order hash prefix: `8876ef1e`.
- email hash prefix: `40dd0240`.
- client id prefix: `349382661.1770`.
- ga session id: `1770811419`.
- local session hash prefix: `81f3369b`.
- direct click hash present: false.

1d lookback:

- time-window click rows: 1267.
- time-window unique click hash: 819.
- exact session click rows: 0.
- exact session unique click hash: 0.
- matched by client_id rows: 0.
- matched by ga_session_id rows: 0.
- matched by local_session rows: 0.
- upload candidate: false.

7d / 30d lookback:

- time-window click rows: 2169.
- time-window unique click hash: 1369.
- exact session click rows: 0.
- exact session unique click hash: 0.
- upload candidate: false.

### Canary row 2

- row status: `identity_only_quarantine`.
- order hash prefix: `bac8873b`.
- email hash prefix: `53df68eb`.
- client id prefix: `1918691045.177`.
- ga session id: `1778331567`.
- local session hash prefix: `1fae35b5`.
- direct click hash present: false.

1d lookback:

- time-window click rows: 1231.
- time-window unique click hash: 799.
- exact session click rows: 0.
- exact session unique click hash: 0.
- matched by client_id rows: 0.
- matched by ga_session_id rows: 0.
- matched by local_session rows: 0.
- upload candidate: false.

7d / 30d lookback:

- time-window click rows: 2170.
- time-window unique click hash: 1370.
- exact session click rows: 0.
- exact session unique click hash: 0.
- upload candidate: false.

## 해석

시간 범위만 보면 후보 click은 많습니다. 하지만 주문 row와 같은 client/session/local session으로 이어지는 click은 없습니다. 따라서 현재 canary row 2건은 Google Ads confirmed_purchase 후보가 아니라 `identity_only_quarantine`으로 유지해야 합니다.

이 결과는 Path B 저장 인프라 실패가 아닙니다. 주문완료 row가 실제 광고 클릭에서 출발한 세션이 아니었거나, 광고 클릭 저장값이 checkout/order complete까지 보존되지 않았거나, Tag Assistant/직접 주문완료 URL 진입 과정에서 세션이 분리됐을 가능성을 가리킵니다.

## 결정

- `send_candidate=true`: 0.
- `actual_send_candidate=true`: 0.
- Google Ads upload candidate: 0.
- Time-window-only matching: 사용 금지.
- Next diagnosis: click storage/source audit와 same-browser preservation 확인.

## 산출물

- `data/path-b-order-bridge-paid-click-join-dry-run-20260510.json`
- `gdn/path-b-order-bridge-paid-click-join-dry-run-20260510.md`
