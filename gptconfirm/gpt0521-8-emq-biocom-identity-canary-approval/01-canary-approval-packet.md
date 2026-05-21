작성 시각: 2026-05-21 11:36 KST
기준일: 2026-05-21
문서 성격: 바이오컴 Purchase CAPI 고객 식별자 보강 canary 승인 패킷

## 승인 이름

바이오컴 Purchase CAPI 고객 식별자 보강 24시간 canary

## 사람이 이해하는 설명

Meta가 구매자를 더 잘 알아보게 하기 위해, 바이오컴 실제 결제완료 구매 신호에 고객 단서 2개를 추가한다.

추가하는 단서는 전화번호를 해시한 값(`ph`)과 사이트 안에서만 같은 고객으로 묶이는 외부 ID(`external_id`)다. 원문 전화번호나 원문 회원 ID는 보내지 않는다.

## 왜 하는가

Meta Events Manager 기준 Purchase 이벤트 매칭 품질이 아직 높지 않다.

현재 CAPI는 구매 신호 자체는 잘 보내지만, 고객을 맞추는 단서가 `fbp/fbc/IP/user agent` 중심이다. `ph`와 `external_id`가 들어가면 Meta가 광고 클릭과 구매자를 더 잘 연결할 수 있고, 광고 학습과 보고 품질이 개선될 가능성이 있다.

## 허용 범위

- site: `biocom`
- event: `Purchase` only
- source: Server CAPI only
- 대상 row: confirmed purchase + value guard pass + duplicate guard pass
- 추가 field:
  - `user_data.ph`: 정규화한 전화번호의 SHA-256 해시
  - `user_data.external_id`: `site + member_code + secret` 기반 HMAC-SHA256
- 기간:
  - 1차 관찰: 24시간
  - 24시간 후 stop criteria가 없으면 계속 유지
- 문제 발생 시:
  - 먼저 원인 조사
  - 중단이 맞는 경우 TJ님에게 중단 제안

## 금지 범위

- 더클린커피 동시 ON
- bulk backfill
- 과거 누락 주문 대량 재전송
- Browser Purchase fallback 추가
- `META_CAPI_ENABLE_EVENT_ID_HASH=true`
- event_id 생성 방식 변경
- 이메일 전송
- Facebook Login ID 전송
- GTM publish
- 운영DB write/import
- raw order/payment/member/click/email/phone 출력

## Stop criteria

일반 문제는 먼저 조사하고 중단 제안으로 올린다.

- Events Manager에서 Purchase CAPI failed 증가.
- duplicate event_id 증가.
- CAPI success 대비 events_received 하락.
- EMQ 점수가 명확히 악화.
- Meta Diagnostics에서 새 privacy/data warning 발생.
- 더클린커피 payload에 `ph/external_id`가 섞인 정황.

Hard Fail은 즉시 중단 제안 대상이다.

- raw phone/member/order/payment/click ID가 로그나 payload preview에 노출.
- confirmed가 아닌 pending/unknown/canceled/refunded가 Purchase로 전송.
- value mismatch row가 Purchase로 전송.
- event_id가 의도치 않게 변경되어 dedup이 깨질 가능성.

## Success criteria

24시간 후 아래 조건이면 유지한다.

- biocom CAPI Purchase success 정상.
- failed 0 또는 기존 수준 유지.
- duplicate event_id 0 유지.
- `ph_present_rate`와 `external_id_present_rate`가 바이오컴 Purchase CAPI에서 증가.
- 더클린커피 `ph/external_id` 증가 없음.
- Meta Events Manager EMQ가 악화되지 않음.
- Diagnostics 새 critical warning 없음.

## 승인 문구

아래 문구가 있으면 실행 승인으로 본다.

```text
[승인] 바이오컴 Purchase CAPI 고객 식별자 보강 24시간 canary ON.
조건: biocom만, Purchase만, ph + site-scoped external_id만, event_id 변경 없음, 더클린커피 제외, 문제 없으면 24시간 후 유지.
문제 발생 시 Codex가 먼저 원인 조사 후 중단 제안.
```

## 현재 승인 상태

TJ님이 대화에서 canary 방향과 지속 조건을 승인했다.

로컬 패치로 site allowlist를 추가했다. 실제 실행 전 VM Cloud에 아래 파일을 배포하고 env를 설정해야 `biocom만` 조건을 만족한다.

- `backend/src/env.ts`
- `backend/src/metaCapi.ts`

이번 승인안의 실행 조건은 아래와 같다.

```text
META_CAPI_IDENTITY_ENRICHMENT_SITE_ALLOWLIST=biocom
META_CAPI_ENABLE_EVENT_ID_HASH=false
```

이 조건이 빠지면 더클린커피까지 영향을 받을 수 있으므로 canary ON을 보류한다.
