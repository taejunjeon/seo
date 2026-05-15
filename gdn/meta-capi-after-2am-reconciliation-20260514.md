---
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  lane: Green read-only reconciliation
  allowed_actions:
    - VM Cloud log aggregate read-only query
    - VM Cloud SQLite aggregate read-only query
    - documentation output
  forbidden_actions:
    - Meta CAPI send
    - Meta API mutate
    - operational DB write/import
    - VM Cloud schema migration
    - GTM publish
    - Imweb header/footer change
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud logs/meta-capi-sends.jsonl + VM Cloud SQLite data/crm.sqlite3 attribution_ledger
    window: 2026-05-14 02:00 KST 이후
    freshness: checked_at_utc=2026-05-14T10:37:29.974Z
    confidence: 0.91
---

# Meta CAPI 02시 이후 대조 리포트

## 결론

**아임웹 헤더/푸터 변경 때문에 Meta CAPI가 끊겼다는 증거는 현재 없다.**
Meta CAPI, 즉 서버가 Meta에 전환 이벤트를 보내는 경로는 2026-05-14 02:00 KST 이후에도 VM Cloud에서 계속 성공했다.

다만 Meta 화면에서 “안 잡힌다”는 말이 맞다면, 지금은 코드 중단보다 **Meta Events Manager 화면 필터, Pixel/Dataset 선택, 표시 지연, 광고관리자 전환 컬럼 기준 차이**를 먼저 의심해야 한다.

## 기준

- cutoff: 2026-05-14 02:00 KST
- cutoff UTC: 2026-05-13T17:00:00.000Z
- checked: 2026-05-14 19:37 KST
- source:
  - VM Cloud `logs/meta-capi-sends.jsonl`
  - VM Cloud SQLite `data/crm.sqlite3`의 `attribution_ledger`
  - live `https://biocom.kr` HTML presence/syntax smoke
- raw order/payment/click id output: 0

## 서버 전송 로그

VM Cloud Meta CAPI send log 기준 02:00 KST 이후:

- 자동 전송 로그: 38건
- 성공: 38건
- 실패: 0건
- Meta 응답 `events_received=1`: 38건
- 최신 성공 전송 시각: 2026-05-14T10:14:44.736Z

Pixel별 성공:

- 바이오컴 Pixel `1283400029487161`: 15건
- 더클린커피 Pixel `1186437633687388`: 23건

source별 성공:

- `biocom_imweb`: 15건
- `thecleancoffee_imweb`: 23건

## 결제완료 원장 대조

VM Cloud `attribution_ledger` 기준 02:00 KST 이후 confirmed live payment_success:

- 전체 confirmed: 39건
- 바이오컴: 15건
- 더클린커피: 24건
- min logged_at: 2026-05-13T17:26:18.209Z
- max logged_at: 2026-05-14T09:49:30.969Z

대조 결과:

- 바이오컴 confirmed 15건 vs 바이오컴 Meta CAPI 성공 15건: 일치
- 더클린커피 confirmed 24건 vs 더클린커피 Meta CAPI 성공 23건: 1건 차이
- 전체 confirmed 39건 vs Meta CAPI 성공 38건: 1건 차이

이 1건 차이는 바이오컴이 아니라 더클린커피 쪽 aggregate gap이다. 원인은 아직 단정하지 않는다. 가능한 분류는 duplicate skip, 다음 sync 대기, source/pixel resolve 차이, 또는 해당 row의 CAPI eligibility 조건 불충족이다.

## 아임웹 헤더/푸터 영향 판단

live `https://biocom.kr` HTML에서 아래가 확인됐다.

- Meta Pixel base code present
- Purchase Guard v3 present
- Funnel CAPI wrapper v3 present
- 2026-05-14 payment-success click-id v4.3 present
- target script syntax parse: ok
- `FUNNEL_CAPI_CONFIG.enableServerCapi=false`

중요한 점:

1. `enableServerCapi=false`이므로 브라우저 funnel wrapper는 원래 서버 CAPI를 직접 쏘는 모드가 아니다.
2. 서버 자동 Meta CAPI는 VM Cloud confirmed payment_success 원장과 background job이 보내는 경로다.
3. 02:00 KST 이후에도 그 서버 경로는 성공했다.
4. 따라서 이번 v4.3 header/footer 변경이 Meta CAPI 서버 전송을 끊었다는 판단은 현재 데이터와 맞지 않는다.

## Meta 화면에서 안 보일 때 먼저 볼 것

1. Pixel/Dataset이 바이오컴 `1283400029487161`인지 확인한다.
2. Events Manager에서 이벤트 이름 `Purchase`와 Server/API event source 필터를 확인한다.
3. 광고관리자 전환 컬럼이 아닌 Events Manager의 수신 이벤트 기준으로 본다.
4. Meta 표시 지연을 감안해 1~3시간 window를 둔다.
5. Browser Pixel과 Server CAPI가 event_id로 dedup되면 한 화면에서 기대한 방식과 다르게 보일 수 있다.

## 하지 않은 것

- Meta CAPI 실제 전송 새로 실행: 0
- Meta API mutate: 0
- 운영DB write/import: 0
- VM Cloud schema migration: 0
- GTM publish: 0
- Imweb header/footer 수정: 0
- raw identifier output: 0

## 다음 액션

### TJ님

Meta Events Manager에서 바이오컴 Pixel `1283400029487161` 기준으로 2026-05-14 02:00 KST 이후 `Purchase` server/API 이벤트가 보이는지 확인한다.

성공 기준: server/API Purchase가 보인다.
실패 시: 화면 캡처에서 Pixel ID, time range, event source filter, event name filter가 보이게 공유한다.

### Codex

필요하면 1건 차이가 난 더클린커피 gap을 별도 read-only로 좁힌다. 단, 바이오컴 Meta CAPI 문제와는 분리해서 본다.

상세 JSON: [data/project/meta-capi-after-2am-reconciliation-20260514.json](/Users/vibetj/coding/seo/data/project/meta-capi-after-2am-reconciliation-20260514.json)
