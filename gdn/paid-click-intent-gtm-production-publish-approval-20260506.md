# paid_click_intent v1 GTM Production publish 승인안

작성 시각: 2026-05-06 16:25 KST
대상: biocom GTM `GTM-W2Z6PHN`
문서 성격: Red Lane 승인 문서. 실행 결과는 [[paid-click-intent-gtm-production-publish-result-20260506]]에 기록한다.
Status: Mode B approved and executed. live version 142 published.
Supersedes: [[paid-click-intent-gtm-preview-approval-20260506]]
Depends on:
- [[paid-click-intent-gtm-preview-result-20260506]]
- [[paid-click-intent-receiver-access-result-20260506]]
- [[google-ads-landing-clickid-analysis-20260506]]
- [[paid-click-intent-production-receiver-post-smoke-20260506]]
- [[paid-click-intent-production-receiver-deploy-result-20260506]]
- [[paid-click-intent-gtm-production-publish-result-20260506]]
Do not use for: Google Ads conversion action 생성/변경, conversion upload, GA4/Meta/Google Ads purchase 전송, 운영 DB write, backend 운영 deploy

## 10초 결론

`paid_click_intent v1` 운영 게시의 목적은 구매 전환을 보내는 것이 아니다.
목적은 Google 광고 클릭 ID(`gclid/gbraid/wbraid`)를 고객이 사이트에 들어온 순간 저장하고, 이후 checkout/NPay intent/결제완료 후보와 연결할 수 있게 만드는 것이다.

현재 근거는 세 가지다.

- 운영 결제완료 주문 623건 중 Google click id가 남은 주문은 5건뿐이다. 주문 원장 기준 보존률은 0.8%다.
- 반면 GA4 BigQuery 기준 최근 7일 Google Ads 랜딩 세션 6,879개 중 6,724개에는 click id가 남아 있다. 랜딩 세션 기준 보존률은 97.75%다.
- Preview와 임시 HTTPS receiver 검증에서 `gclid/gbraid/wbraid` 3개 케이스 모두 storage 저장, payload 생성, no-send receiver `200 ok=true`가 확인됐다.
- `https://att.ainativeos.net/api/attribution/paid-click-intent/no-send`는 `OPTIONS` preflight 기준 `https://biocom.kr` Origin을 허용했다.
- 이후 production receiver route를 배포했고 TEST/negative smoke를 통과했다.
- GTM receiver-enabled publish까지 완료했다. 새 live version은 `142 (paid_click_intent_v1_receiver_20260506T150218Z)`다.

따라서 광고 URL은 대체로 정상이고, 병목은 랜딩 이후 주문 원장까지 click id가 이어지지 않는 것이다.
운영 publish는 이 병목을 풀기 위한 첫 번째 live validation 단계이며, 2026-05-07 00:02 KST 기준 완료됐다.
단, receiver가 no-write로 동작하는 동안에는 주문 원장 fill-rate가 직접 개선되지 않는다.
이 단계의 목표는 click id storage와 receiver payload가 실제 고객 환경에서 안전하게 동작하는지 확인하는 것이다.
주문 원장/Attribution VM 연결 개선은 이후 minimal ledger write가 별도 승인된 뒤 판단한다.

## TJ님 승인 문구

아래 승인 문구는 2026-05-06에 Mode B로 승인됐고 실행됐다.

```text
YES: biocom GTM live latest version 기준 fresh workspace에서 paid_click_intent v1 Production publish를 승인합니다.

범위:
- gclid/gbraid/wbraid, UTM, referrer, landing_url, client_id, ga_session_id를 1st-party storage에 저장
- checkout/NPay intent 시점에 같은 값을 payload로 재사용할 수 있게 준비
- no-send receiver 호출은 production route 배포 후 허용하되, GA4/Meta/Google Ads/TikTok/Naver 전송은 금지

금지:
- Google Ads conversion action 생성/변경
- conversion upload
- GA4/Meta/Google Ads purchase 전송
- backend 운영 deploy
- 운영 DB write
- Default Workspace 147 사용
- 기존 구매완료 Primary 변경

조건:
- 현재 GTM live latest version을 read-only로 재확인
- fresh workspace만 사용
- publish 전 version diff를 캡처/기록
- publish 직후 24h/72h 모니터링 결과를 보고
- 문제 발생 시 새 tag/trigger를 pause하거나 직전 version으로 rollback
```

## 변경 범위

### 포함

- GTM Custom HTML tag 1개: `paid_click_intent v1`.
- All Pages 또는 biocom 고객 페이지 범위 trigger.
- 랜딩 시점 query/referrer/session 정보를 읽어 1st-party storage에 저장.
- receiver POST는 조건부로만 실행한다.
  - 새 `gclid/gbraid/wbraid`가 들어온 랜딩.
  - 저장된 Google click id가 checkout/NPay intent 시점에 재주입되는 경우.
  - 같은 session/click id/stage 반복 POST는 dedupe.
- `TEST_`, `DEBUG_`, `PREVIEW_` prefix click id는 live candidate에서 차단.
- no-send receiver 호출 시 `would_send=false`, `no_platform_send_verified=true` 유지.
- production receiver: `https://att.ainativeos.net/api/attribution/paid-click-intent/no-send`. backend route 배포 후 TEST/negative smoke 통과.
- admin, login, logout, internal, 404 후보 페이지는 receiver POST 대상에서 제외하거나 ignore한다.
- `landing_url/current_url/referrer`는 allowlist query만 남겨 저장/전송한다.

### 제외

- Google Ads 전환 action 생성 또는 변경.
- 기존 `구매완료` Primary action 수정.
- Google Ads offline conversion upload.
- GA4/Meta/Google Ads purchase 보정 전송.
- Attribution VM 운영 DB write.
- backend 운영 배포.
- 광고 예산, 캠페인 상태, 입찰 전략 변경.

## 성공 기준

운영 publish 후 24시간 기준:

- customer funnel 핵심 페이지에서 GTM tag가 정상 로드된다.
- 랜딩 URL에 `gclid/gbraid/wbraid`가 있으면 browser storage에 저장된다.
- no-send receiver 또는 preview log에서 `has_google_click_id=true`가 확인된다.
- `TEST_`, `DEBUG_`, `PREVIEW_` click id는 live candidate에서 `live_candidate_after_approval=false`로 차단된다.
- GA4/Meta/Google Ads 전환 수가 이 publish만으로 증가하지 않는다.
- 오류율, 페이지 로드, 결제 흐름에 이상이 없다.

운영 publish 후 72시간 기준:

- Google Ads 랜딩 세션의 click id storage fill-rate가 관측된다.
- checkout/NPay intent payload에서 Google click id 재주입률이 산출된다.
- no-write receiver 단계에서는 confirmed purchase no-send dry-run의 `missing_google_click_id` 감소를 필수 성공 기준으로 보지 않는다.
- minimal ledger write 승인 전에는 `missing_google_click_id` 감소가 제한적일 수 있다.
- 실제 Google Ads 전송 후보는 여전히 0건이어야 한다. 전송은 별도 승인 전까지 금지다.

## 모니터링 지표

필수 지표:

- `paid_click_intent_received_count`
- `has_google_click_id_count`
- `test_click_id_rejected_count`
- `pii_rejected_count`
- `storage_write_success_rate`
- `receiver_status_2xx_rate`
- `checkout_payload_has_click_id_rate`
- `npay_intent_payload_has_click_id_rate`
- `confirmed_purchase_missing_google_click_id_rate`

주의:

- 현재 code inspection 기준 `paid_click_intent` 전용 observability counter는 아직 확인되지 않았다.
- counter가 없으면 `received_count`, `has_google_click_id_count`, `pii_rejected_count`는 `counter 구현 시` 지표로 둔다.
- no-write 단계에서 바로 볼 수 있는 것은 browser storage, receiver 2xx, TEST/negative smoke, raw logging 여부, 외부 전송 0건이다.
- 정확한 fill-rate는 minimal ledger write 또는 body 없는 counter가 승인·구현된 뒤 산출한다.

운영자가 보는 해석:

- `has_google_click_id`가 늘어나는 것은 좋은 신호다.
- no-write receiver 단계에서는 receiver 2xx, payload 안전성, checkout/NPay intent 재주입률이 1차 판단 기준이다.
- `confirmed_purchase_missing_google_click_id` 감소는 minimal ledger write 이후에 본격 판단한다.
- 이 publish만으로 Google Ads ROAS가 바로 정상화되지는 않는다.

## 롤백 기준

아래 중 하나라도 발생하면 즉시 중단/rollback 후보다.

- 결제 버튼, NPay 버튼, 장바구니, 결제완료 페이지 동작 이상.
- JS error 급증.
- no-send receiver가 아닌 외부 플랫폼 전송 발생.
- PII 또는 결제정보가 payload에 포함됨.
- `TEST_`, `DEBUG_`, `PREVIEW_` click id가 live candidate로 통과함.
- Google Ads/GA4/Meta 전환 수가 publish 직후 비정상 증가.

롤백 방법:

- 1순위: 새 `paid_click_intent v1` tag pause 후 publish.
- 2순위: 직전 GTM live version으로 rollback.
- 3순위: receiver endpoint 차단. 단, storage만 남는 경우에는 tag pause가 우선이다.

## 왜 지금 publish를 검토하는가

전체 주문 기준 Google click id 보존률 0.8%만 보면 Google Ads 자체가 거의 안 붙는 것처럼 보인다.
하지만 GA4 BigQuery를 보면 최근 7일 Google Ads 랜딩 세션에서는 click id가 97.75% 남아 있다.

즉 문제는 광고 URL이 아니라 아래 구간이다.

```text
landing click id 있음
-> checkout/NPay intent로 전달 약함
-> 결제완료 주문 원장/Attribution VM에 남지 않음
-> Google Ads confirmed purchase로 매칭할 수 없음
```

`paid_click_intent v1` 운영 publish는 이 구간을 보강하는 수집 단계다.

## 승인 전 체크리스트 결과

- [x] 현재 GTM live latest version 확인: `141 (pause_aw308433248_upde_20260505)`.
- [x] Default Workspace 147 미사용 확인.
- [x] fresh workspace 생성: `159`.
- [x] tag/trigger diff 기록: tag `[279]`, trigger `[278]`.
- [x] no-send/no-write/no-platform-send 유지 확인.
- [x] receiver POST 조건부/deduped tag로 publish.
- [x] admin/login/internal/404 page payload는 client-side skip + receiver reject.
- [x] production receiver endpoint TEST/negative smoke 통과.
- [x] 테스트 click id live 차단 guard 확인.
- [x] rollback 방법 기록.
- [ ] 24h/72h 모니터링 결과 작성.

## 현재 선택지

### 선택지 A. storage-only GTM publish

GTM tag가 `bi_paid_click_intent_v1` storage에만 저장하고 production receiver POST는 하지 않는다.

장점:

- backend 운영 deploy 없이 진행 가능.
- 랜딩 시점 click id 보존을 시작할 수 있다.

단점:

- 서버 receiver count와 2xx rate를 볼 수 없다.
- checkout/NPay/confirmed purchase no-send와 서버 기준으로 연결하기 어렵다.

### 선택지 B. receiver route 배포 후 receiver-enabled GTM publish

production `att.ainativeos.net`에 `POST /api/attribution/paid-click-intent/no-send` route를 배포한 뒤 publish한다.

장점:

- 서버 receiver 기준 fill-rate와 block_reason을 볼 수 있다.
- 이후 confirmed_purchase no-send와 연결하기 쉽다.

단점:

- backend 운영 deploy가 필요하다.
- backend 운영 deploy는 별도 Red Lane 승인이다.
- no-write receiver만으로는 주문 원장 fill-rate가 직접 개선되지 않는다.
- 실제 원장 연결은 minimal ledger write 승인 이후 가능하다.

Codex 추천:

- 선택지 B를 실행했다. 이번 문제는 browser storage만이 아니라 주문 원장/Attribution VM까지 click id가 이어지지 않는 문제이므로, receiver route가 있는 상태에서 publish하는 편이 낫다.

## 승인 후 Codex가 한 일

1. 현재 GTM live latest version을 read-only로 재확인했다.
2. fresh workspace `159`에서만 작업했다.
3. Production publish 전 tag/trigger diff와 rollback plan을 기록했다.
4. 승인 범위 안에서만 publish했다.
5. live smoke를 실행했다.

남은 일:

- publish 후 24h/72h read-only 모니터링 문서 작성.

## Codex가 하지 않은 일

- Submit.
- Google Ads conversion action 변경.
- conversion upload.
- GA4/Meta/Google Ads/TikTok/Naver 전송.
- 이 GTM publish 단계에서 추가 backend 운영 deploy. backend receiver deploy는 [[paid-click-intent-production-receiver-deploy-result-20260506]]에서 별도로 완료.
- 운영 DB write.
- 광고 예산/캠페인 상태 변경.

## 다음 문서

실제 publish 결과는 아래 문서로 분리했다.

```text
gdn/paid-click-intent-gtm-production-publish-result-20260506.md
```
