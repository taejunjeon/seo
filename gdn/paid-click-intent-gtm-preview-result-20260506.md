# paid_click_intent GTM Preview 결과 보고서

작성 시각: 2026-05-06 15:45 KST
대상: biocom Google click id 보존률 개선
문서 성격: Yellow Lane Preview 실행 결과. 운영 게시, 외부 플랫폼 전송, 운영 DB write는 하지 않았다.
Status: pass after HTTPS tunnel receiver verification
Supersedes: [[paid-click-intent-gtm-preview-approval-20260506]]
Next document: [[paid-click-intent-receiver-access-result-20260506|paid_click_intent receiver 접근 검증 결과]]
Do not use for: GTM Production publish, Google Ads 전환 액션 생성/변경, conversion upload, GA4/Meta/Google Ads 전송, backend 운영 deploy

```yaml
harness_result:
  lane: Yellow
  approved_scope: Preview only
  gtm_live_latest: "141 / pause_aw308433248_upde_20260505"
  workspace_used: "fresh temporary workspace only"
  default_workspace_147_used: false
  production_publish: false
  submit: false
  platform_send: false
  backend_deploy: false
  operating_db_write: false
  cleanup: "temporary GTM workspace deleted"
  result_confidence: 0.92
```

## 후속 검증 반영

2026-05-06 15:58 KST 기준 [[paid-click-intent-receiver-access-result-20260506]]에서 임시 HTTPS tunnel 재검증을 완료했다.
직전 blocker였던 브라우저 직접 receiver 호출도 세 케이스 모두 통과했다.

추가 결론:

- `gclid`, `gbraid`, `wbraid` 세 케이스 모두 `receiverReached=true`.
- 세 케이스 모두 `receiverStatus=200`.
- 세 케이스 모두 `receiverOk=true`.
- 세 케이스 모두 `receiverHasGoogleClickId=true`.
- 세 케이스 모두 `receiverTestClickId=true`.
- tunnel/proxy는 테스트 후 종료했다.

이 문서의 초기 결론인 `browser receiver blocked`는 로컬 HTTP receiver 기준이었다.
HTTPS tunnel을 붙인 운영 유사 Preview에서는 receiver 접근까지 PASS로 정리한다.

## 10초 결론

`paid_click_intent` Preview 태그는 세 테스트 URL에서 모두 실행됐다.
`gclid`, `gbraid`, `wbraid`는 각각 browser storage와 payload에 저장됐다.

하지만 브라우저가 `https://biocom.kr` 페이지에서 `http://localhost:7020` no-send receiver로 직접 요청하는 단계는 `Failed to fetch`로 막혔다.
원인은 태그 로직 문제가 아니라 HTTPS 페이지에서 로컬 HTTP endpoint를 호출하는 브라우저 보안/mixed-content 계열 제약으로 본다.

같은 payload를 Node-side로 `POST /api/attribution/paid-click-intent/no-send`에 넣었을 때는 세 케이스 모두 `200 ok=true`로 통과했다.
따라서 현재 결론은 아래다.

```text
storage 보존: PASS
payload 생성: PASS
receiver contract: PASS
브라우저 직접 receiver 호출: BLOCKED by local HTTP receiver
```

## 실제 실행한 것

- 현재 biocom GTM live latest version을 read-only로 재확인했다.
- live latest는 `141 / pause_aw308433248_upde_20260505`였다.
- Default Workspace 147은 사용하지 않았다.
- fresh temporary workspace를 만들었다.
- Preview 전용 All Pages trigger를 만들었다.
- Preview 전용 Custom HTML tag를 만들었다.
- `quick_preview`를 실행했다.
- Playwright headless 브라우저에서 GTM preview script를 라우팅해 실행했다.
- 세 테스트 URL을 각각 열었다.
- 실행 후 temporary workspace를 삭제했다.

생성했다가 삭제한 GTM object:

```text
workspaceId: 157
workspace name: codex_paid_click_intent_preview_20260506T064725Z
tagId: 273
triggerId: 272
cleanup: deleted workspace 157
```

운영에 남긴 변경은 없다.

## 테스트 URL

```text
https://biocom.kr/?gclid=TEST_GCLID_20260506&utm_source=google&utm_medium=cpc&utm_campaign=codex_preview_20260506
https://biocom.kr/?gbraid=TEST_GBRAID_20260506&utm_source=google&utm_medium=cpc&utm_campaign=codex_preview_20260506
https://biocom.kr/?wbraid=TEST_WBRAID_20260506&utm_source=google&utm_medium=cpc&utm_campaign=codex_preview_20260506
```

`TEST_` prefix click id는 live 후보에서 차단하는 테스트 값이다.

## 결과 상세

### gclid 케이스

결과: 부분 PASS

- `window.__seo_paid_click_intent_preview_installed` 값이 생성됐다.
- `localStorage.bi_paid_click_intent_v1.gclid`에 `TEST_GCLID_20260506`이 저장됐다.
- `utm_source=google`, `utm_medium=cpc`, `utm_campaign=codex_preview_20260506`도 payload에 포함됐다.
- 브라우저 직접 receiver 호출은 `Failed to fetch`로 실패했다.
- Node-side receiver validation은 `200 ok=true`로 통과했다.
- no-send guard는 `read_only_phase`, `approval_required`, `test_click_id_rejected_for_live`를 반환했다.

### gbraid 케이스

결과: 부분 PASS

- `localStorage.bi_paid_click_intent_v1.gbraid`에 `TEST_GBRAID_20260506`이 저장됐다.
- 브라우저 직접 receiver 호출은 `Failed to fetch`로 실패했다.
- Node-side receiver validation은 `200 ok=true`로 통과했다.
- live 후보는 `test_click_id_rejected_for_live`로 차단됐다.

### wbraid 케이스

결과: 부분 PASS

- `localStorage.bi_paid_click_intent_v1.wbraid`에 `TEST_WBRAID_20260506`이 저장됐다.
- 브라우저 직접 receiver 호출은 `Failed to fetch`로 실패했다.
- Node-side receiver validation은 `200 ok=true`로 통과했다.
- live 후보는 `test_click_id_rejected_for_live`로 차단됐다.

## 산출물

- JSON 결과: `data/paid-click-intent-gtm-preview-result-20260506T064725Z.json`
- screenshot: `data/paid-click-intent-preview-20260506T064725Z-gclid.png`
- screenshot: `data/paid-click-intent-preview-20260506T064725Z-gbraid.png`
- screenshot: `data/paid-click-intent-preview-20260506T064725Z-wbraid.png`
- 실행 스크립트: `backend/scripts/paid-click-intent-gtm-preview.ts`

## 사람이 이해해야 할 해석

이번 Preview는 “Google click id를 저장하는 코드가 동작하는가”를 본 것이다.
결론은 동작한다.

다만 “실제 운영 브라우저에서 receiver까지 바로 보낼 수 있는가”는 아직 아니다.
지금 receiver가 `http://localhost:7020`이라 운영 사이트인 `https://biocom.kr`에서 직접 호출하면 브라우저가 막는다.

운영에 가까운 검증을 하려면 다음 중 하나가 필요하다.

1. HTTPS tunnel로 로컬 receiver를 임시 노출한다.
2. 제한 테스트용 HTTPS receiver를 배포한다.
3. 실제 운영 receiver 배포 승인 후 Preview에서 다시 본다.

이 셋 중 1번 또는 2번이 다음 단계로 가장 안전하다.

## 금지선 준수

- GTM Production publish: 하지 않음
- GTM Submit: 하지 않음
- Default Workspace 147 사용: 하지 않음
- Google Ads 전환 액션 생성/변경: 하지 않음
- conversion upload: 하지 않음
- GA4/Meta/Google Ads 전송: 하지 않음
- backend 운영 deploy: 하지 않음
- 운영 DB write: 하지 않음

## 다음 할 일

### Codex가 할 일

1. Receiver 접근 방식 승인안을 만들었다.
   - 무엇: `https://biocom.kr` Preview 브라우저에서 no-send receiver까지 실제 도달시키는 방법을 정한다.
   - 왜: storage/payload는 PASS였지만 브라우저 직접 receiver 호출이 HTTP localhost 때문에 막혔다.
   - 어떻게: [[paid-click-intent-receiver-access-approval-20260506]]에 HTTPS tunnel, 제한 테스트 deploy, 운영 receiver deploy 후보를 비교하고 금지선을 나눴다.
   - 다음 성공 기준: Preview 브라우저 Network에서 `POST /api/attribution/paid-click-intent/no-send`가 `200 ok=true`로 보인다.

2. GTM preview script를 재사용 가능한 smoke 도구로 정리한다.
   - 무엇: `backend/scripts/paid-click-intent-gtm-preview.ts`를 보존하고, 결과 판정이 storage/payload/receiver를 분리해서 보이도록 유지한다.
   - 왜: 다음 receiver 접근 검증 때 같은 테스트를 반복해야 한다.
   - 어떻게: `gclid/gbraid/wbraid` 3개 케이스, workspace cleanup, no publish guard를 기본값으로 둔다.

3. 문서 index를 업데이트한다.
   - 무엇: `gdn/!gdnplan.md`, `total/!total.md`에서 Preview 상태를 `실행 완료 / receiver 접근 blocked`로 바꾼다.
   - 왜: 다음 작업이 더 이상 `Preview 실행 여부 판단`으로 보이면 안 된다.
   - 어떻게: 이 결과 문서를 링크하고 다음 액션을 receiver 접근 해결로 바꾼다.

### TJ님이 할 일

현재 당장 확인할 필수 문서는 1개다.

- [[paid-click-intent-receiver-access-approval-20260506]]

다음 단계에서 TJ님 컨펌이 필요할 수 있는 것은 receiver 접근 방식이다.
추천은 `HTTPS tunnel 또는 제한 테스트 deploy`를 먼저 승인하고, 운영 receiver deploy는 그 다음으로 미루는 것이다.

## Auditor verdict

Auditor verdict: PARTIAL_PASS
No-send verified: YES, Node-side receiver validation 기준.
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Recommendation: receiver 접근 방식 승인안을 만든 뒤 Preview receiver 도달만 재검증한다.
Confidence: 86%.
