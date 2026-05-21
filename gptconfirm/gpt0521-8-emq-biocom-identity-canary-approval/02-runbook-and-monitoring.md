작성 시각: 2026-05-21 11:36 KST
기준일: 2026-05-21
문서 성격: 바이오컴 고객 식별자 보강 canary runbook

## 실행 전 확인

1. site allowlist 패치가 VM Cloud에 배포되어 있는지 확인한다.
   - 대상 파일: `backend/src/env.ts`, `backend/src/metaCapi.ts`
   - 목표: `biocom`만 ON.
   - 더클린커피는 이번 canary에서 제외.
2. `META_CAPI_EXTERNAL_ID_SECRET`가 설정되어 있는지 확인한다.
   - 없으면 external_id 생성 불가.
3. event_id hash flag가 OFF인지 확인한다.
   - `META_CAPI_ENABLE_EVENT_ID_HASH=false`
4. no-send preview 숫자와 현재 CAPI success baseline을 기록한다.

## 권장 env

아래는 의도 설명이다. 실제 변수명은 site allowlist 패치 여부에 따라 확정한다.

```text
META_CAPI_ENABLE_IMWEB_PHONE_HASH=true
META_CAPI_ENABLE_MEMBER_EXTERNAL_ID=true
META_CAPI_EXTERNAL_ID_SECRET=<already-provisioned-secret>
META_CAPI_IDENTITY_ENRICHMENT_SITE_ALLOWLIST=biocom
META_CAPI_ENABLE_EVENT_ID_HASH=false
```

## 실행 순서

1. VM Cloud pre-snapshot.
   - health check
   - recent CAPI success/fail/duplicate
   - current `ph/external_id` presence
2. site allowlist 포함 backend 배포 또는 배포 상태 확인.
3. `biocom`만 고객 식별자 보강 ON.
4. backend restart.
5. post-check.
   - `/api/health` 200
   - recent CAPI success 정상
   - biocom payload presence 증가
   - coffee payload presence 변화 없음
6. 24시간 controlled monitoring.

## 모니터링 항목

### 0-30분

- 서버 health 200.
- CAPI failed 증가 없음.
- duplicate event_id 증가 없음.
- 더클린커피에 `ph/external_id`가 붙지 않음.

### 2-4시간

- biocom Purchase CAPI success 정상.
- `ph/external_id` presence가 신규 Purchase에서 증가.
- Meta Events Manager critical warning 없음.

### 24시간

- EMQ 점수 또는 Diagnostics 권장 조치 변화 확인.
- failed/duplicate 정상.
- 문제가 없으면 유지.
- 문제가 있으면 원인 조사 후 중단 제안.

## 24시간 후 유지 조건

아래 조건이면 별도 종료하지 않고 유지한다.

- CAPI failed spike 없음.
- duplicate event_id 0 유지.
- value guard / confirmed guard 정상.
- 더클린커피 영향 없음.
- Meta Diagnostics 악화 없음.

## Rollback

문제가 확인되고 중단이 맞다고 판단되면 아래 순서로 OFF를 제안한다.

```text
META_CAPI_ENABLE_IMWEB_PHONE_HASH=false
META_CAPI_ENABLE_MEMBER_EXTERNAL_ID=false
```

site allowlist가 적용되어 있다면 더 좁게 아래처럼 처리할 수 있다.

```text
META_CAPI_IDENTITY_ENRICHMENT_SITE_ALLOWLIST=
```

rollback 후 확인:

- `/api/health` 200.
- 신규 Purchase CAPI에서 `ph/external_id` presence 감소.
- CAPI success/fail 정상.

## 운영자 화면 확인

TJ님이 Meta UI에서 보면 좋은 화면:

1. Events Manager > 바이오컴 Pixel > Purchase > 이벤트 매칭 품질.
2. Diagnostics > Purchase 관련 새 warning.
3. 권장 조치에서 이메일/전화번호/외부 ID 항목 변화.

Codex가 볼 수 있는 화면:

1. VM Cloud CAPI send log aggregate.
2. `/api/meta/capi/log` success/fail/duplicate.
3. payload presence aggregate.
