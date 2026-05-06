# paid_click_intent receiver 접근 승인안

작성 시각: 2026-05-06 15:58 KST
대상: biocom Google click id 보존 Preview 후속
문서 성격: Yellow/Red 경계 승인안. 운영 게시, 광고 플랫폼 전송, 운영 DB write는 아직 하지 않는다.
Status: executed / Option A pass
Supersedes: [[paid-click-intent-gtm-preview-result-20260506]]
Next document: [[paid-click-intent-receiver-access-result-20260506|paid_click_intent receiver 접근 검증 결과]]
Do not use for: GTM Production publish, Google Ads 전환 액션 생성/변경, conversion upload, GA4/Meta/Google Ads 전송, 운영 DB write

```yaml
harness_gate:
  current_result: "storage/payload PASS, browser receiver PASS via temporary HTTPS tunnel"
  blocker: "resolved for Preview only"
  still_forbidden:
    - GTM Production publish
    - Google Ads conversion action create/update
    - conversion upload
    - GA4/Meta/Google Ads platform send
    - operating DB write
    - confirmed purchase live dispatch
  allowed_after_tj_yes_option_a:
    - temporary HTTPS tunnel to local no-send receiver
    - GTM Preview only browser test
    - TEST_ click id only
  executed_option: "Option A"
  confidence: 0.92
```

## 실행 결과 반영

2026-05-06 15:58 KST 기준 Option A를 실행했다.
결과는 [[paid-click-intent-receiver-access-result-20260506]]에 기록했다.

핵심 결론:

- 전체 backend를 직접 tunnel에 노출하지 않고, `/api/attribution/paid-click-intent/no-send`만 통과시키는 path-limited proxy를 사용했다.
- proxy와 tunnel 모두 CORS preflight 204, POST 200을 확인했다.
- GTM Preview 재실행 결과 `gclid`, `gbraid`, `wbraid` 세 케이스 모두 브라우저 receiver `200 ok=true`를 확인했다.
- tunnel과 proxy는 테스트 후 종료했다.
- GTM Production publish, Submit, 플랫폼 전송, 운영 DB write, backend 운영 deploy는 하지 않았다.

따라서 이 문서는 더 이상 승인 대기 문서가 아니다.
다음 단계는 Google Ads landing-session 기준 보존률 분석과 GTM Production publish 승인안 작성이다.

## 10초 결론

직전 Preview에서 `gclid/gbraid/wbraid` 저장과 payload 생성은 통과했다.
no-send receiver도 payload를 받으면 정상 응답한다.
막힌 것은 운영 HTTPS 페이지가 로컬 HTTP endpoint를 직접 호출하는 브라우저 보안 제약이다.

따라서 다음 목표는 실제 전송이나 운영 게시가 아니다.
목표는 아래 한 줄이다.

```text
GTM Preview 브라우저 Network에서 no-send receiver POST 200을 본다.
```

추천은 `Option A: 임시 HTTPS tunnel`이다.
이유는 운영 backend deploy 없이, no-send/no-write endpoint만 잠깐 HTTPS로 노출해 브라우저 차단을 제거할 수 있기 때문이다.

## 현재 확인된 것

확인 완료:

- GTM live latest: `141 / pause_aw308433248_upde_20260505`
- Preview workspace: fresh temporary workspace만 사용
- Default Workspace 147: 사용하지 않음
- `gclid/gbraid/wbraid` storage 저장: PASS
- payload 생성: PASS
- Node-side receiver validation: PASS
- 테스트 click id live 후보 차단: PASS

남은 blocker:

- 브라우저 직접 receiver 호출: `Failed to fetch`
- 원인: `https://biocom.kr`에서 `http://localhost:7020` 호출

## Option A. 임시 HTTPS tunnel

### 무엇

로컬 backend 7020의 no-send receiver를 임시 HTTPS URL로 노출한다.
GTM Preview 태그의 receiver URL만 이 임시 HTTPS URL로 바꿔 다시 Preview한다.

예시:

```text
https://temporary-random-subdomain.example-tunnel.com/api/attribution/paid-click-intent/no-send
```

### 왜

현재 브라우저 차단은 로컬 HTTP endpoint 때문이라, receiver를 HTTPS로 만들면 같은 Preview에서 실제 Network POST 200을 확인할 수 있다.
운영 backend deploy나 GTM publish가 필요 없다.

### 어떻게

1. Codex가 사용 가능한 tunnel 도구를 확인한다.
2. 임시 HTTPS tunnel을 로컬 `localhost:7020`으로 연결한다.
3. `PAID_CLICK_INTENT_PREVIEW_RECEIVER_URL`을 tunnel URL로 지정한다.
4. `backend/scripts/paid-click-intent-gtm-preview.ts`를 다시 실행한다.
5. 결과에서 아래를 확인한다.
   - `storageHasClickId=true`
   - `receiverReached=true`
   - `receiverStatus=200`
   - `receiverOk=true`
   - `receiverHasGoogleClickId=true`
   - `receiverTestClickId=true`
   - `nodeReceiverOk=true`

### 안전장치

- tunnel은 테스트 동안만 연다.
- TEST_/DEBUG_/PREVIEW_ click id만 사용한다.
- endpoint는 no-send/no-write/no-platform-send 상태를 유지한다.
- GTM Production publish는 하지 않는다.
- Google Ads/GA4/Meta 전송은 하지 않는다.
- 운영 DB write는 하지 않는다.

### 리스크

- 임시 URL이 외부에서 접근 가능하다.
- 다만 endpoint가 no-write/no-send라 데이터 반영 위험은 낮다.
- 필요하면 짧은 랜덤 토큰 query/header를 추가하는 별도 hardening을 먼저 할 수 있다.

### 추천

추천도: 84%

이유: 가장 빠르고, 운영 deploy 없이 실제 브라우저 receiver 200만 확인할 수 있다.

## Option B. 제한 테스트 deploy

### 무엇

`paid-click-intent/no-send` receiver만 HTTPS 테스트 환경에 배포한다.

### 왜

실제 운영 도메인과 가까운 네트워크 조건에서 Preview할 수 있다.
터널보다 안정적이다.

### 어떻게

1. 별도 테스트 endpoint를 만든다.
2. no-send/no-write/no-platform-send env flag를 강제한다.
3. Preview receiver URL을 테스트 endpoint로 지정한다.
4. GTM Preview만 다시 실행한다.

### 리스크

- backend deploy 성격이 있으므로 Option A보다 승인 강도가 높다.
- 잘못 설정하면 운영 endpoint와 혼동될 수 있다.

### 추천

추천도: 68%

이유: 안정적이지만 지금 단계에서는 tunnel보다 무겁다.

## Option C. 운영 receiver deploy

### 무엇

운영 backend에 receiver를 배포한다.

### 판단

지금은 비추천이다.
storage/payload와 no-send contract는 검증됐지만, 아직 browser receiver 200만 남은 단계다.
운영 deploy는 receiver 접근 확인 이후로 미룬다.

추천도: 25%

## Option D. 여기서 중지

### 무엇

현재 결과만으로 다음 설계로 넘어간다.

### 판단

비추천이다.
storage/payload는 확인됐지만 실제 브라우저 Network 200을 보지 못하면, 운영 게시 전 마지막 연결성이 비어 있다.

추천도: 20%

## TJ님 컨펌 문구

추천 답변:

```text
YES: Option A 임시 HTTPS tunnel로 paid_click_intent no-send receiver 접근 검증을 진행합니다.
조건: GTM Preview only, TEST_ click id only, no-write/no-send/no-platform-send 유지, Production publish/Submit/Google Ads 변경/플랫폼 전송/운영 DB write 금지.
```

보류하려면:

```text
HOLD: receiver 접근 검증을 보류합니다. 현재 storage/payload PASS와 Node-side receiver PASS 결과까지만 유지합니다.
```

## Codex가 승인 후 할 일

1. tunnel 도구 확인
   - 무엇: `cloudflared`, `ngrok`, 기타 HTTPS tunnel 사용 가능 여부를 확인한다.
   - 왜: 브라우저가 HTTPS URL로 receiver를 호출해야 한다.
   - 성공 기준: 임시 HTTPS URL이 `localhost:7020`으로 연결된다.

2. Preview 재실행
   - 무엇: `PAID_CLICK_INTENT_PREVIEW_RECEIVER_URL=<https tunnel>`로 `backend/scripts/paid-click-intent-gtm-preview.ts`를 실행한다.
   - 왜: 동일한 GTM Preview 코드에서 receiver 200까지 확인한다.
   - 성공 기준: 세 click id 케이스 모두 `receiverStatus=200`, `receiverOk=true`.

3. 결과 문서 작성
   - 무엇: receiver 접근 검증 결과 문서를 만든다.
   - 왜: 이후 GTM Production publish 승인안으로 넘어갈지 판단해야 한다.
   - 성공 기준: no publish, no platform send, no DB write 증거 포함.

## 금지선

- GTM Production publish 금지
- GTM Submit 금지
- Google Ads conversion action 생성/변경 금지
- Google Ads conversion upload 금지
- GA4/Meta/Google Ads 전송 금지
- 운영 DB write 금지
- confirmed purchase dispatcher 운영 전송 금지

## Auditor verdict

Auditor verdict: READY_FOR_TJ_DECISION
추천: Option A 임시 HTTPS tunnel
Confidence: 84%
