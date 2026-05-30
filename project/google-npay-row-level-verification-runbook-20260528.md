# Google NPay row-level 저장 확인 runbook - 2026-05-28

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - docs/report/text-report-template.md
  project_harness_read:
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
  required_context_docs:
    - project/google-npay-bridge-gtm-preview-smoke-result-20260528.md
    - project/google-npay-button-bridge-gtm-patch-and-bi-confirmed-plan-20260528.md
  lane: Green for script/runbook; Yellow if VM Cloud env token must be added or backend restarted
  allowed_actions:
    - local script creation
    - read-only API check
    - redacted row-level verification
    - documentation
  forbidden_actions:
    - raw gclid/gbraid/wbraid output
    - raw NPay bridge URL output
    - production DB write
    - GTM Production publish
    - Google Ads conversion send
    - VM Cloud env mutation without approval
  source_window_freshness_confidence:
    source: VM Cloud /api/attribution/npay-intents row-level read API
    window: operator supplied via --minutes and --limit
    freshness: live when token is present
    confidence: high after ok=true row-level response; currently blocked locally by missing token
```

## 한 줄 결론

NPay 버튼 클릭 row가 VM Cloud에 실제로 저장됐는지는 `/api/attribution/npay-intents`를 admin token으로 읽어 확인한다. 확인 결과는 raw click id를 보여주지 않고, `has_gclid`, `has_gbraid`, `has_wbraid`, `has_npay_bridge_url_hash`처럼 존재 여부만 본다.

## admin token이 무엇인가

여기서 말하는 admin token은 VM Cloud backend의 row-level 조회용 비밀키다.

- Google Ads 토큰이 아니다.
- GTM 토큰이 아니다.
- Google Cloud OAuth 토큰도 아니다.
- VM Cloud API가 `/api/attribution/npay-intents` 상세 row를 보여줘도 되는 요청인지 확인하는 서버용 shared secret이다.

현재 backend 코드는 아래 순서로 token을 찾는다.

1. `NPAY_INTENT_ADMIN_TOKEN`
2. `AIBIO_NATIVE_ADMIN_TOKEN`

권장값은 `NPAY_INTENT_ADMIN_TOKEN`이다. 이유는 NPay intent row 조회 전용이라 권한 범위가 좁고, 다른 admin 기능과 섞이지 않기 때문이다.

## 발급해서 env에 저장하면 도움되는가

도움된다. 다만 “로컬 `.env`에만 저장”하면 부족하다.

row-level 조회가 되려면 같은 token이 두 군데에 있어야 한다.

1. VM Cloud backend env: 요청을 받을 서버가 정답 token으로 들고 있어야 한다.
2. 로컬 Mac env: Codex가 API를 호출할 때 같은 token을 헤더에 실어야 한다.

VM Cloud에 이미 `AIBIO_NATIVE_ADMIN_TOKEN`이 설정되어 있고 그 값을 알고 있다면, 로컬에 그 값을 넣어 즉시 조회할 수 있다. 새로 만드는 경우는 `NPAY_INTENT_ADMIN_TOKEN`을 별도로 발급해서 VM Cloud와 로컬에 같은 값으로 저장하는 쪽이 더 안전하다.

## token 발급 권장 방식

```bash
openssl rand -hex 32
```

주의:

- 생성된 실제 token 값은 문서, 대화, Git commit에 쓰지 않는다.
- `.env`, 비밀번호 관리자, 또는 VM Cloud secret/env 관리 화면에만 저장한다.
- token이 노출되면 교체한다.

## 로컬 저장 위치

둘 중 하나에 저장한다.

```bash
/Users/vibetj/coding/seo/backend/.env
/Users/vibetj/coding/seo/.env
```

권장 키:

```dotenv
NPAY_INTENT_ADMIN_TOKEN=실제값은_여기에만_저장
```

로컬 스크립트는 `backend/.env`를 먼저 읽고, 그 다음 루트 `.env`를 읽는다. 둘 다 있으면 `backend/.env` 값을 우선으로 본다.

## row-level 확인 명령

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/npay-intent-row-level-check.ts \
  --base-url=https://att.ainativeos.net \
  --site=biocom \
  --source=gtm_npay_bridge_v1 \
  --minutes=240 \
  --limit=50
```

## 성공 기준

아래가 동시에 만족되면 GTM Preview smoke에서 만든 row가 VM Cloud에 저장됐다고 볼 수 있다.

1. 응답의 `ok`가 `true`다.
2. `summary.rows_from_gtm_bridge_v1`가 1 이상이다.
3. `summary.rows_with_google_click_id`가 1 이상이다.
4. `summary.rows_with_npay_bridge_url_hash`가 1 이상이다.
5. `summary.latest_captured_at_kst`가 smoke 시각 이후다.

이 기준을 만족하면 “NPay 버튼 클릭 순간에 Google click id와 NPay bridge hash가 VM Cloud row에 남았다”고 판단한다.

## 출력 예시

실제 출력은 raw click id를 숨긴다.

```json
{
  "ok": true,
  "source": {
    "api": "https://att.ainativeos.net/api/attribution/npay-intents",
    "raw_identifier_output": false,
    "token_value_output": false
  },
  "summary": {
    "rows_returned": 1,
    "rows_with_google_click_id": 1,
    "rows_with_gclid": 1,
    "rows_with_gbraid": 1,
    "rows_with_wbraid": 0,
    "rows_with_npay_bridge_url_hash": 1,
    "rows_from_gtm_bridge_v1": 1
  },
  "rows": [
    {
      "source": "gtm_npay_bridge_v1",
      "has_gclid": true,
      "has_gbraid": true,
      "has_wbraid": false,
      "has_google_click_id": true,
      "has_npay_bridge_url_hash": true,
      "npay_bridge_host": "nid.naver.com"
    }
  ]
}
```

## 실패 시 해석

### `missing_admin_token`

로컬에 token이 없다. VM Cloud row-level API를 호출하지 않은 상태다.

대응:

- VM Cloud backend에 설정된 같은 token을 로컬 `.env`에 넣는다.
- 새 token이 필요하면 `NPAY_INTENT_ADMIN_TOKEN`을 발급하고 VM Cloud env에도 같은 값으로 설정한다.

### `forbidden`

로컬 token이 VM Cloud backend의 token과 다르다.

대응:

- token 오타, 공백, 다른 환경의 token 사용 여부를 확인한다.

### `npay_intent_admin_token_not_configured`

VM Cloud backend에 row-level 조회 token이 없다.

대응:

- VM Cloud env에 `NPAY_INTENT_ADMIN_TOKEN`을 추가하고 backend를 재시작해야 한다. 이 작업은 VM Cloud env 변경이므로 Yellow Lane이다.

### rows가 0건

저장이 안 됐다고 바로 단정하면 안 된다.

먼저 아래를 나눠 확인한다.

1. `--minutes`가 너무 짧은지
2. `--source=gtm_npay_bridge_v1` 필터가 맞는지
3. GTM Preview 태그가 실제로 실행됐는지
4. VM Cloud receiver 응답이 `ok:true`였는지

### `rows_with_google_click_id`가 0

NPay 버튼 클릭 row는 남았지만 Google click id가 같이 저장되지 않았다.

의미:

- 광고 클릭 랜딩에서 click id가 브라우저 저장소까지 살아남지 못했거나
- GTM 태그가 저장소에서 click id를 읽는 로직이 실패했거나
- 테스트가 Google 광고 클릭 세션이 아니었을 수 있다.

### `rows_with_npay_bridge_url_hash`가 0

Google click id는 남았지만 NPay 외부 결제창 URL hash가 저장되지 않았다.

의미:

- 버튼 클릭은 잡았지만 `window.open`, 링크 href, form submit, location 이동 중 실제 bridge URL을 잡지 못한 것이다.
- 이 경우 NPay 결제완료 주문과 버튼 클릭 row를 강하게 이어 붙이기 어렵다.

## 이번 작업에서 추가한 로컬 도구

파일:

```text
/Users/vibetj/coding/seo/backend/scripts/npay-intent-row-level-check.ts
```

역할:

- VM Cloud row-level API를 읽는다.
- raw click id를 출력하지 않는다.
- raw URL을 출력하지 않는다.
- token 값도 출력하지 않는다.
- row별로 존재 여부와 hash 존재 여부만 보여준다.

## 현재 상태

2026-05-28 02:57 KST 현재 로컬 `/Users/vibetj/coding/seo/backend/.env`에는 `NPAY_INTENT_ADMIN_TOKEN`을 새로 생성해 저장했다.

검증용 fingerprint:

```text
sha256 prefix: 7b3cbc263d1e2936
```

이 fingerprint는 token 원문이 아니다. VM Cloud env에 같은 token을 넣은 뒤 로컬과 서버가 같은 값을 쓰는지 확인할 때만 사용한다.

확인된 것:

- 스크립트 도움말 출력 정상.
- 로컬 token 생성 및 `backend/.env` 저장 완료.
- 로컬 token을 사용해 row-level 조회를 시도하면 현재 VM Cloud가 `forbidden`을 반환함.
- 따라서 VM Cloud backend env에는 아직 같은 token이 반영되지 않은 상태로 본다.

아직 확인하지 못한 것:

- 최신 GTM Preview smoke row의 exact 저장값.
- 해당 row의 `source=gtm_npay_bridge_v1`.
- 해당 row의 Google click id 존재 여부.
- 해당 row의 NPay bridge hash 존재 여부.

## 2026-05-28 12:16 KST 검증 결과

VM Cloud backend env에도 같은 `NPAY_INTENT_ADMIN_TOKEN`을 반영했고, `seo-backend`를 `--update-env`로 재시작했다.

검증:

- local token fingerprint: `7b3cbc263d1e2936`
- VM Cloud backend token fingerprint: `7b3cbc263d1e2936`
- PM2 `seo-backend`: online
- row-level API: `ok=true`
- source: `local_crm_sqlite.npay_intent_log`
- 조회 window: 최근 2일, `source=gtm_npay_bridge_v1`
- 반환 row: 2건
- `rows_with_google_click_id`: 2건
- `rows_with_gclid`: 2건
- `rows_with_gbraid`: 2건
- `rows_with_wbraid`: 0건
- `rows_with_npay_bridge_url_hash`: 0건
- `rows_from_gtm_bridge_v1`: 2건
- environment: `preview`
- latest captured: `2026-05-28 11:23:11 KST`

판단:

- row-level 조회 권한 문제는 해결됐다.
- NPay 버튼 클릭 시점에 Google click id가 VM Cloud row에 저장되는 것은 확인됐다.
- NPay 외부 결제창 URL hash는 아직 저장되지 않았다.

해석:

현재 Preview 태그는 버튼 클릭 자체와 Google click id는 잡는다. 다만 Imweb/NPay 이동 방식에서 실제 `orders.pay.naver.com` 또는 `nid.naver.com` bridge URL을 `window.open`, form submit, location method wrapper로 아직 잡지 못한 것으로 보인다. 그래서 결제완료 주문과 버튼 클릭 row를 강하게 묶기 위한 마지막 hash 증거는 추가 보강이 필요하다.

추가 확인:

- 같은 window에서 전체 source 기준 최근 2일 row 92건을 조회했다.
- 전체 92건 중 Google click id 보존 row는 70건이었다.
- 전체 92건 중 NPay bridge URL hash 보유 row는 0건이었다.
- 즉 hash 누락은 Preview 태그 2건만의 문제가 아니라 현재 운영/preview NPay intent 저장 구조 전반의 병목으로 본다.

## Auditor verdict

PASS_WITH_NOTES

- PASS: row-level 확인 절차와 redacted local checker를 만들었다.
- PASS: raw click id/token/bridge URL을 출력하지 않는 방식으로 닫았다.
- NOTE: 실제 VM Cloud row-level 조회는 admin token이 필요하다.
- NOTE: VM Cloud env에 새 token을 추가하거나 backend를 재시작하는 작업은 Yellow Lane이다.
