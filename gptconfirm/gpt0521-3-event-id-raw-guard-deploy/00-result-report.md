# gpt0521-3 Event ID Raw Guard Deploy

## 이번에 가능해진 것

Meta CAPI `event_id`에 주문/결제 원문 키가 직접 섞일 수 있는 위험을 확인했고, 운영 중복 제거를 깨지 않도록 OFF 기본값의 해시 전환 스위치를 추가했다.

## 왜 중요한가

`event_id`는 Meta Pixel과 CAPI가 같은 구매를 중복으로 세지 않게 맞추는 열쇠다. 기존 서버 CAPI는 구매 이벤트 ID를 주문 키 기반으로 만들 수 있었기 때문에 원문 식별자 노출 위험이 있었다. 다만 이 값을 서버에서만 갑자기 바꾸면 브라우저 Pixel과 CAPI의 dedup이 깨질 수 있어, 즉시 강제 전환하지 않고 안전 전환 준비만 배포한다.

## 변경 내용

- `META_CAPI_ENABLE_EVENT_ID_HASH` 추가: 기본값 OFF.
- `META_CAPI_EVENT_ID_SECRET` 추가: 해시 전환을 켤 때 필요한 secret.
- OFF 상태에서는 기존 event_id와 CAPI dedup 동작 유지.
- ON 상태에서는 기존 event_id material을 HMAC-SHA256으로 바꿔 Meta에 전송한다.

## 운영 판단

이번 배포는 보안 가드 준비 배포다. 실제 hashed event_id 전환은 브라우저 Purchase 경로도 같은 safe event_id를 쓰도록 맞춘 뒤 별도 승인으로 켜야 한다.

## 하지 않은 것

- Meta 운영 Purchase 추가 전송 없음.
- Browser Purchase fallback 변경 없음.
- GTM publish 없음.
- 운영DB write/import 없음.
- raw 주문/결제/member/click id 출력 없음.

## VM Cloud 배포 결과

- 배포 파일: `backend/src/env.ts`, `backend/src/metaCapi.ts`.
- 백업 경로: VM Cloud `.deploy-backups/20260521-event-id-raw-guard`.
- remote typecheck/build: PASS.
- `seo-backend` restart: PASS, restart count `4303`, status `online`.
- health check: PASS, `service=biocom-seo-backend`.
- post-check env:
  - `META_CAPI_ENABLE_EVENT_ID_HASH=false`
  - `META_CAPI_ENABLE_IMWEB_PHONE_HASH=false`
  - `META_CAPI_ENABLE_MEMBER_EXTERNAL_ID=false`
  - event/external secret present: false

## 다음 전환 조건

`META_CAPI_ENABLE_EVENT_ID_HASH=true`는 브라우저 Purchase가 서버에서 받은 safe event_id를 같은 값으로 쓰는 test-only 검증 후 켠다. 지금 켜면 CAPI와 Pixel dedup이 깨질 수 있다.
