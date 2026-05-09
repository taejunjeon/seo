# Path C member_code wrapper Preview 승인안

작성 시각: 2026-05-08 17:38 KST
최종 업데이트: 2026-05-08 20:06 KST
대상: GTM/Imweb wrapper Preview
문서 성격: Yellow Preview 승인 판단 패킷. Production publish 승인안 아님.
관련 문서: [[path-c-wrapper-preview-result-20260508]], [[path-c-member-code-source-discovery-20260508]], [[path-c-backend-deploy-approval-v2-20260508]], [[path-c-member-code-attribution-design-20260508]], [[path-c-attribution-rule-v2-20260508]]
Status: **hold_no_client_member_code_source_found** — TJ님 `wrapper Preview: YES` (2026-05-08 KST), 비로그인 safety Preview 실행 완료, 로그인 NPay 클릭 200/201/203과 source 재탐색에서 usable client-side member_code source 미발견. Production publish 금지 유지.
Do not use for: GTM Production publish, Imweb 운영 body 저장, raw member_code 운영 저장, platform send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
    - total/!total-current.md
  lane: Yellow Preview approval packet
  allowed_actions_before_approval:
    - Preview plan writing
    - read-only GTM/workspace inspection
    - no-send payload design
  forbidden_actions_before_approval:
    - GTM Production publish
    - Imweb production body change
    - raw member_code storage
    - platform send
  source_window_freshness_confidence:
    source: "Path C v2 design + canary-effect 18.4h result + wrapper Preview result + TJ Tag Assistant screenshots + GTM API read-only variable definitions + source discovery"
    window: "2026-05-08 KST"
    freshness: "approval packet updated after wrapper Preview, manual login/NPay click evidence, and source discovery 2026-05-08 20:06 KST"
    confidence: 0.90
```

## 5줄 요약

1. 지금 승인된 것은 **운영 게시가 아니라 Preview 확인**이다.
2. Preview 1단계는 raw member_code를 네트워크로 보내지 않고, client-side placeholder hash로 “회원 코드가 페이지에 존재하는지”만 본다.
3. 확인 결과 현재 GTM/Retous/Hurdlers/Imweb browser 경로에서는 usable client-side member_code source가 없다.
4. server-side HMAC 검증은 backend v2 controlled TEST 또는 server/order bridge와 묶어 별도 진행한다.
5. Production publish, raw member_code 운영 저장, platform send, actual send는 계속 금지다.

중요: 현재 paid_click_intent canary write flag가 켜져 있을 수 있으므로, Preview 1단계는 실제 `gclid/gbraid/wbraid`를 보내지 않고 `TEST_` click id만 보낸다. 이렇게 해야 no-send receiver가 응답하되 운영 ledger에는 live 후보 row를 추가하지 않는다.

2026-05-08 19:04 KST 실행 결과: [[path-c-wrapper-preview-result-20260508]] 기준 비로그인 공개 상품 2페이지 safety는 PASS했다. receiver 200, raw member_code/PII/order/payment/value 0, live click id 0, ledger.stored 0. 2026-05-08 19:21~19:33 KST TJ님 수동 Tag Assistant 캡처에서는 로그인 NPay 클릭 흐름과 기존 NPay 태그 발화가 확인됐지만, `memberCode` 계열 후보 변수는 모두 empty/undefined였다. 2026-05-08 20:06 KST [[path-c-member-code-source-discovery-20260508]]에서도 usable client-side member_code source는 발견되지 않았다.

## 용어 번역

| 용어 | 운영자용 뜻 |
|---|---|
| Preview | 실제 사이트에 게시하지 않고 Tag Assistant에서만 임시 태그를 시험하는 모드 |
| member_code availability | 로그인 사용자의 회원 코드가 상품/결제/NPay 직전 화면에서 보이는지 |
| payload safety | 보낼 데이터에 이름/전화/이메일/주문번호/결제정보가 없는지 |
| placeholder hash | 실제 운영 join용 HMAC이 아니라, raw 값을 보내지 않고 존재 여부만 확인하는 임시 hash |
| Production publish | 운영 사이트 전체 사용자에게 태그를 실제 게시하는 일. 이번 승인 범위 밖 |
| TEST click id | Preview 확인용 가짜 click id. receiver 응답 확인에는 쓰지만 live 후보나 운영 저장 대상으로 쓰지 않는다 |

## 한 줄 결론

이 승인은 Production publish가 아니라 **Preview에서 회원 코드가 실제 페이지에 있는지와 payload가 안전한지만 확인하는 승인**이다. 값을 실제 운영 ledger에 저장하거나 광고 플랫폼으로 보내는 승인이 아니다.

## 1. TJ님이 실제로 승인하는 것

승인 화면/행동:

- GTM에서 fresh workspace를 만든다.
- Preview mode로만 Custom HTML 또는 tag 변수를 테스트한다.
- Production publish 버튼은 누르지 않는다.

승인 문구:

```text
YES: Path C member_code wrapper Preview만 승인합니다.
Production publish 금지, raw member_code 운영 저장 금지, platform send 금지.
첫 단계는 client-side placeholder hash로 member_code source availability만 확인하고,
server-side HMAC 검증은 별도 controlled TEST로 분리합니다.
```

바꾸는 설정 이름:

- 임시 Preview tag: `PathC_member_code_hash_preview_no_send`
- trigger: Preview용 Page View / checkout_start / npay_intent 테스트 trigger
- endpoint: existing no-send receiver

바꾸면 생기는 효과:

- 로그인 사용자에서 `window.imweb.user.member_code` 또는 동등 source가 실제 존재하는지 확인한다.
- wrapper가 raw member_code, PII, order/payment/value를 보내지 않는지 검증한다.
- `TEST_` click id만 써서 현재 canary write flag와 무관하게 live ledger 후보를 만들지 않는다.

현재 남는 문제:

- backend가 `member_code_hash`를 받을 준비를 해도 실제 client에서 값이 채워지는지 알 수 없다.
- Path C는 계속 `member_code_hash empty`로 남는다.
- 따라서 이 승인안은 Preview 실행 기록으로 닫고, Production publish 승인안으로 승격하지 않는다.

Codex가 대신 못 하는 이유:

- GTM/Imweb Preview 화면 접근과 로그인 사용자 세션 확인은 외부 운영 화면/계정 상태가 필요하다.
- Production publish는 Red/Yellow 승인 영역이라 자동 실행하지 않는다.

## 2. Preview 확인 matrix

| 케이스 | 확인값 | 성공 기준 |
|---|---|---|
| 로그인 사용자 / 상품상세 | member_code source 존재 여부 | source present 또는 absent가 명확히 기록 |
| 로그인 사용자 / checkout_start | same member_code 유지 여부 | hash가 동일하고 raw 미노출 |
| 로그인 사용자 / npay_intent | NPay intent 직전 source 유지 | no-send payload에 hash만 포함 |
| 비로그인 사용자 / 상품상세 | 빈 값 처리 | member_code_hash empty, 오류 없음 |
| 비로그인 사용자 / checkout_start | 빈 값 처리 | hash empty, no PII |
| 비로그인 사용자 / npay_intent | 빈 값 처리 | hash empty, no PII |

## 3. member_code source 후보

우선순위:

1. `window.imweb?.user?.member_code`
2. Imweb 공식 user/session object의 동등 필드
3. 서버 렌더 body에 이미 노출된 안전한 회원 코드 필드
4. `dataLayer.member_code`
5. `dataLayer.hurdlers_ga4.member_code`
6. `localStorage.__bs_imweb.memberCode`

2026-05-08 19:23:58 KST GTM read-only 확인 결과:

- `memberCode`: Data Layer Variable, `member_code`를 읽음.
- `Retous - [변수] memberCode`: Data Layer Variable, `hurdlers_ga4.member_code`를 읽음.
- `RETOUS - [변수] member_code`: Data Layer Variable, `member_code`를 읽음.
- `Retous - [맞춤] memberCode`: Custom JS, `localStorage.__bs_imweb.memberCode`를 읽음.

Path C에서 사용 금지:

- `phone_buy`, `phone_reg`: 전화번호 source.
- `email_buy`, `email_reg`: 이메일 source.
- `HURDLERS - [맞춤 JS] user_id`: `.email-info`를 읽으므로 이메일형 값일 수 있음.

2026-05-08 20:06 KST source 재탐색 결과:

- `dataLayer.member_code`, `dataLayer.hurdlers_ga4.member_code`, `localStorage.__bs_imweb.memberCode`, `sessionStorage.__bs_imweb_session.memberCode`, `window.imweb.user.member_code`, `window.IMWEB_MEMBER_CODE`, `window.hurdlers_member_code`, `window.hurdlers_ga4.member_code`, `window.MEMBER_UID`, `window.MEMBER_HASH`, `window.SITE_MEMBER.member_code` 모두 usable source 없음.
- `localStorage.__bs_imweb`와 `sessionStorage.__bs_imweb_session`는 device/session/UTM object다.
- `window.hurdlers_ga4`는 상품 정보 object다.
- `window.MEMBER_UID`와 `window.MEMBER_HASH` key는 공개 페이지에 있었지만 empty string이다. 로그인 세션에서 non-empty인지 여부만 추가 확인할 수 있다.
- 결론: 현재 client wrapper publish는 HOLD.

추가 controlled TEST에서 확인할 것:

- 값이 로그인 사용자에게만 존재하는가.
- checkout/NPay intent 단계에서도 사라지지 않는가.
- 값 형식이 안정적인가.
- 비로그인에서 undefined/null/empty로 안전한가.

## 4. payload safety

허용:

- `site`
- `capture_stage`
- `captured_at`
- `gclid`/`gbraid`/`wbraid`
- UTM allowlist
- `client_id`
- `ga_session_id`
- `landing_path`
- `member_code_hash`

금지:

- raw `member_code`
- email, phone, name, address
- order_number, channel_order_no
- payment_key, paid_at
- value, currency
- raw full URL query
- cookie/token

## 5. Hash 방식

Preview 선택지:

### Option A — server-side HMAC preview

- wrapper가 transient raw `member_code`를 no-send endpoint로 보낸다.
- backend가 raw를 저장/로그하지 않고 HMAC 후 `member_code_hash`만 preview response에 반환한다.
- 장점: 운영 기본안과 동일.
- 리스크: network payload에 raw가 순간적으로 포함된다. Preview evidence와 logging 금지 확인이 필요.

### Option B — client-side placeholder hash preview

- wrapper가 browser에서 임시 SHA256 hash를 만들어 보낸다.
- 장점: raw member_code가 network payload에 안 보인다.
- 리스크: 운영 HMAC과 다르므로 실제 join 검증은 안 된다.

권장:

- 운영 기본은 server-side HMAC.
- Preview 첫 단계는 Option B로 availability만 확인. raw member_code를 network payload에 싣지 않는다.
- backend v2 smoke 단계에서 Option A를 별도 controlled TEST member_code로 검증.

## 5.1 이번 승인에서 허용되는 Preview 범위

| 단계 | 허용 여부 | 이유 |
|---|---|---|
| Option B client-side placeholder hash | YES | raw member_code가 network payload에 노출되지 않고 source 존재 여부 확인 가능 |
| Option A server-side HMAC | HOLD | backend v2 smoke와 raw logging proof가 필요 |
| GTM Production publish | NO | 운영 전체 사용자에게 적용되는 변경 |
| Imweb body/footer 저장 | NO | 운영 publish와 동일한 효과 |
| platform send | NO | 광고/분석 플랫폼 전송 금지 |

## 5.2 Option B Preview tag 초안

GTM Custom HTML Preview에서만 사용하는 초안이다. Production publish 금지.

핵심 안전장치:

- raw `member_code`는 network payload에 넣지 않는다.
- 실제 `gclid/gbraid/wbraid`를 보내지 않는다.
- `TEST_GCLID_PATHC_PREVIEW_20260508`만 보내 no-send receiver 응답을 확인한다.
- `value`, `currency`, `order_number`, `payment_key`, email/phone/name/address를 넣지 않는다.

```html
<script>
(function () {
  var ENDPOINT = "https://att.ainativeos.net/api/attribution/paid-click-intent/no-send";
  var TEST_CLICK_ID = "TEST_GCLID_PATHC_PREVIEW_20260508";
  var CAPTURE_STAGE = "page_view"; // Preview에서 checkout_start / npay_intent로 복제 확인

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = values[i];
      if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
    }
    return "";
  }

  function readMemberCode() {
    var imwebUser = (window.imweb && window.imweb.user) || {};
    var hurdlers = window.hurdlers_ga4 || {};
    return firstNonEmpty([
      imwebUser.member_code,
      imwebUser.memberCode,
      window.IMWEB_MEMBER_CODE,
      window.hurdlers_member_code,
      hurdlers.member_code,
      hurdlers.memberCode
    ]);
  }

  function sha256Hex(value) {
    if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) return Promise.resolve("");
    return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)).then(function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
        return ("00" + byte.toString(16)).slice(-2);
      }).join("");
    });
  }

  function pathOnly() {
    return window.location.origin + window.location.pathname;
  }

  try {
    var rawMemberCode = readMemberCode();
    sha256Hex(rawMemberCode).then(function (hash) {
      var payload = {
        site: "biocom",
        event_name: "PathCMemberCodePreview",
        capture_stage: CAPTURE_STAGE,
        captured_at: new Date().toISOString(),
        gclid: TEST_CLICK_ID,
        member_code_hash: hash ? "preview_sha256_" + hash.slice(0, 32) : "",
        member_code_source_present: Boolean(rawMemberCode),
        landing_url: pathOnly(),
        current_url: pathOnly(),
        event_id: "PathCMemberCodePreview_" + CAPTURE_STAGE + "_" + Date.now()
      };

      window.__pathc_member_code_preview_payload = payload;
      fetch(ENDPOINT, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true
      }).then(function (res) {
        return res.text().then(function (text) {
          window.__pathc_member_code_preview_response = { status: res.status, body: text };
        });
      }).catch(function (err) {
        window.__pathc_member_code_preview_error = String(err && err.message || err);
      });
    });
  } catch (err) {
    window.__pathc_member_code_preview_error = String(err && err.message || err);
  }
})();
</script>
```

Preview 성공 기준:

- Network payload에 `member_code_hash`는 있고 raw `member_code`는 없다.
- `gclid` 값은 `TEST_GCLID_PATHC_PREVIEW_20260508`이다.
- receiver response는 `no_send_verified=true`, `no_platform_send_verified=true` 계열이다.
- response에 `source.write_flag_on=true`가 있더라도 `ledger.stored`가 없어야 한다. 있으면 즉시 중단한다.

실제 결과: payload safety와 no-send receiver는 PASS했지만, current client source가 없어 `member_code_hash`는 채워지지 않았다. 따라서 성공 기준 중 "source availability 확인"은 `absent confirmed`로 닫고, Production publish는 HOLD한다.

## 6. Preview 절차

```text
1. GTM fresh workspace 생성
2. tag 이름: PathC_member_code_hash_preview_no_send
3. Production publish 금지
4. Preview 시작. 실제 click id를 보내지 말고 `TEST_GCLID_PATHC_PREVIEW_20260508`만 사용
5. 로그인 사용자 상품상세 접속
6. checkout_start 진입
7. npay_intent 진입
8. 비로그인 사용자 동일 경로 반복
9. Network payload 확인
10. backend no-send response 확인
11. Preview workspace discard 또는 pause
```

## 7. 성공 기준

- 로그인 사용자의 member_code source 존재 여부가 단계별로 확인된다.
- 비로그인 사용자는 안전하게 empty 처리된다.
- 1단계 Option B payload에는 raw member_code가 없다.
- 1단계 Option B payload에는 live click id가 없고 `TEST_` click id만 있다.
- server-side HMAC Option A는 이번 Preview 범위가 아니라 backend v2 controlled TEST로 분리한다.
- PII/value/order/payment 필드가 없다.
- no-send receiver 응답이 `would_send=false` 계열을 유지한다.
- `ledger.stored`가 없다.
- Production publish 0.

## 8. 실패 시 해석

| 실패 | 해석 | 다음 확인 |
|---|---|---|
| `window.imweb.user.member_code` 없음 | source 후보가 틀렸을 수 있음 | Imweb SDK/global object 재탐색 |
| 로그인에서는 있음, checkout에서 없음 | stage별 context 단절 | checkout page script scope 확인 |
| NPay intent에서 없음 | NPay iframe/redirect 전 context 문제 | intent 전 단계에서 저장 필요 |
| payload에 PII 포함 | wrapper 설계 실패 | 즉시 중단, tag discard |
| raw member_code 저장 확인 | backend 설계 실패 | backend deploy HOLD |

이번 Preview의 실제 실패/보류 지점:

- `member_code_hash`가 비어 있음: wrapper 코드 문제가 아니라 current client source 부재.
- 결론: 기존 GTM 변수 기반 Production publish는 하지 않는다.

## 9. 승인 문구

Preview만 승인하려면:

```text
YES: Path C member_code wrapper Preview만 승인. Production publish 금지, raw member_code 운영 저장 금지, platform send 금지.
```

## 10. 계속 금지

- GTM Production publish.
- Imweb production body/footer 저장.
- raw member_code 운영 저장.
- GA4/Meta/Google Ads/TikTok/Naver 전송.
- confirmed_purchase actual send.

## 11. 이번 Preview 결과보고 형식

결과보고에는 아래를 사람 말로 먼저 쓴다.

```text
이번 Preview가 말하는 것:
- 로그인 사용자의 회원 코드가 페이지에 존재하는지
- checkout/NPay intent 직전에도 그 값이 유지되는지
- 보낼 payload가 개인정보/주문/결제정보 없이 안전한지

이번 Preview가 말하지 않는 것:
- 구매 매칭이 좋아졌는지
- Google Ads ROAS gap이 줄었는지
- Path C uplift가 실제로 발생했는지
```
