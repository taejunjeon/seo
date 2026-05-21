# 배포 의견

## 요약

진행 추천이다. 다만 한 번에 전체 사이트를 켜는 방식은 피하고, `env flag OFF 기본값 + biocom 제한 ON + 24~72시간 관찰` 방식이 안전하다.

## 왜 진행할 만한가

1. 현재 병목이 명확하다.
   - CAPI success는 정상.
   - 이벤트 매칭 품질은 낮음.
   - `em`, `ph`, `external_id`가 비어 있음.

2. 후보율이 높다.
   - 최근 7일 biocom: phone/external_id preview 369 / 369.
   - 최근 7일 thecleancoffee: phone/external_id preview 173 / 173.

3. 구현 범위가 작다.
   - `backend/src/metaCapi.ts`에서 Imweb 주문 캐시 조인.
   - phone normalize + SHA-256.
   - member code HMAC external_id.
   - send log에는 presence boolean만 기록.

## 왜 바로 전체 ON은 비추천인가

1. 고객 정보 추가 전송이다.
   - 해시되어도 Meta로 보내는 user_data가 늘어난다.
   - 따라서 운영상 Red 승인으로 보는 것이 맞다.

2. EMQ는 즉시 수치가 오르지 않을 수 있다.
   - Meta UI 반영에는 지연이 있다.
   - 성공 여부는 24~72시간 관찰이 필요하다.

3. external_id는 browser/server consistency가 중요하다.
   - 서버 CAPI만 external_id를 보내도 개선 여지는 있지만, 장기적으로는 browser pixel advanced matching 또는 동일 external_id 전략이 맞는지 별도 검토가 필요하다.

## 권장 배포 순서

### Step 1. 로컬 패치

- `MetaCapiUserData`에 `external_id` 추가.
- Imweb order cache lookup helper 추가.
- `ph` fallback source로 Imweb orderer phone 추가.
- `external_id` source로 Imweb member code HMAC 추가.
- env flag:
  - `META_CAPI_ENABLE_IMWEB_PHONE_HASH=0`
  - `META_CAPI_ENABLE_MEMBER_EXTERNAL_ID=0`
  - `META_CAPI_EXTERNAL_ID_SECRET` 필수.

### Step 2. no-send test

- same fixture로 payload presence만 확인.
- confirmed/value/duplicate/refund guard 유지 확인.
- raw output scan.

### Step 3. VM 배포, flag OFF

- deploy/restart만 수행.
- CAPI payload 기존과 동일해야 한다.
- rollback 가능성 확인.

### Step 4. biocom 제한 ON

- biocom만 24시간 제한 관찰.
- success/fail/duplicate 확인.
- Meta UI EMQ와 shared customer information 반영 확인.

### Step 5. 확장

- 문제가 없으면 thecleancoffee까지 확장.

## 추천 점수

- 로컬 패치 진행: 93%
- VM flag OFF 배포: 88%
- biocom 제한 ON: 82%
- 두 사이트 전체 ON: 63%, 24~72시간 관찰 후 판단 권장
