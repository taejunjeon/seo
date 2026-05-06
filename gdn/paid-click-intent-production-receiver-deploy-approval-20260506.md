# paid_click_intent production receiver 배포 승인안

작성 시각: 2026-05-06 17:10 KST
대상: `att.ainativeos.net` backend
문서 성격: Red Lane backend 운영 deploy 승인 문서. 이 문서는 승인안이며 배포를 실행하지 않는다.
Status: pending TJ approval
Supersedes: 없음
Depends on:
- [[paid-click-intent-production-receiver-post-smoke-20260506]]
- [[paid-click-intent-gtm-production-publish-approval-20260506]]
Do not use for: GTM Production publish, Google Ads conversion action 생성/변경, conversion upload, GA4/Meta/Google Ads 전송

## 10초 결론

`paid_click_intent v1`을 receiver까지 포함해 운영 게시하려면 `att.ainativeos.net`에 아래 route가 먼저 있어야 한다.

```text
POST /api/attribution/paid-click-intent/no-send
```

현재 local backend에는 route가 있고 no-write/no-send로 동작한다.
하지만 production `att.ainativeos.net` TEST POST smoke 결과는 `404 Route not found`다.

따라서 receiver-enabled GTM publish를 하려면 backend 운영 deploy 승인이 필요하다.

## TJ님 승인 문구

승인한다면 아래 문구로 승인한다.

```text
YES: att.ainativeos.net backend에 paid_click_intent no-send receiver route 배포를 승인합니다.

범위:
- POST /api/attribution/paid-click-intent/no-send route만 운영 반영
- 목적은 Google click id 보존 payload validation과 no-send preview 응답
- response는 would_send=false, no_platform_send_verified=true, no_write_verified=true 유지

금지:
- DB/ledger write
- GA4/Meta/Google Ads/TikTok/Naver 전송
- Google Ads conversion action 생성/변경
- conversion upload
- confirmed purchase dispatcher 운영 전송
- unrelated backend 변경

조건:
- 배포 전 local typecheck/smoke 통과
- 배포 후 TEST_GCLID 1건 POST smoke에서 200 ok=true 확인
- test_click_id=true, live_candidate_after_approval=false 확인
- PII/value/order field reject 확인
- 문제 발생 시 route rollback 또는 이전 backend version rollback
```

## 배포 범위

포함:

- `POST /api/attribution/paid-click-intent/no-send`
- PII/secret/order/value field reject.
- TEST/DEBUG/PREVIEW click id live candidate 차단.
- `guard` 객체와 snake_case/camelCase 호환 응답.

제외:

- `confirmed_purchase` dispatcher.
- Google Ads upload.
- GA4/Meta 전송.
- production DB insert/update.
- Attribution VM write.
- GTM publish.

## 성공 기준

배포 직후:

- `OPTIONS` preflight 204.
- `POST` TEST payload 200.
- 응답에 아래가 포함된다.

```json
{
  "ok": true,
  "dry_run": true,
  "would_store": false,
  "would_send": false,
  "no_write_verified": true,
  "no_platform_send_verified": true,
  "preview": {
    "has_google_click_id": true,
    "test_click_id": true,
    "live_candidate_after_approval": false
  }
}
```

실패 기준:

- POST 404.
- POST 5xx.
- PII/value/order field를 받아버림.
- `would_send=true`.
- `would_store=true`.
- test click id가 live candidate로 통과.

## 왜 필요한가

GTM Preview와 임시 HTTPS tunnel에서는 receiver까지 통과했다.
하지만 production receiver는 현재 POST 404다.

이 상태로 GTM tag가 receiver 호출을 포함해 운영 게시되면 브라우저에서 receiver 요청이 실패한다.
그러면 24h/72h 모니터링의 핵심인 receiver 2xx rate, payload fill-rate, block_reason 분포를 볼 수 없다.

## 배포 후 다음 단계

1. production receiver TEST POST smoke 재실행.
2. `paid_click_intent v1` GTM Production publish 승인안 재확인.
3. receiver-enabled GTM publish.
4. 24h/72h 모니터링.
5. confirmed_purchase no-send dry-run 재실행.

## 대안

backend deploy를 지금 승인하지 않는다면 storage-only GTM publish를 검토할 수 있다.
다만 storage-only는 서버 receiver count와 Attribution VM/order ledger 연결 개선을 바로 볼 수 없으므로 추천도는 낮다.

Codex 추천:

- receiver route 배포 승인 후 receiver-enabled GTM publish.
- 추천도 82%.

## 금지 유지

아래는 이 승인으로도 허용되지 않는다.

- GTM Production publish.
- Google Ads conversion action 생성/변경.
- conversion upload.
- GA4/Meta/Google Ads/TikTok/Naver 전송.
- 운영 DB/ledger write.
- 광고 예산/캠페인 상태 변경.
