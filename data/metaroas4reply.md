# metaroas4 작업 결과

작성일: 2026-04-10

## 요약

`metaroas4.md`의 지시는 크게 4개였다.

- biocom CAPI dedup 수정 효과 확인
- Meta Events Manager에서 Pixel/CAPI dedup 실제 확인
- biocom 결제완료 페이지 GTM 오류 정리
- 더클린커피는 풀 분석이 아니라 연결 상태만 sanity check

이번에 로컬에서 반영 가능한 것은 개발 반영까지 진행했다. 결론은 다음과 같다.

- biocom CAPI는 수정 효과를 확인할 수 있도록 `/api/meta/capi/log`에 post-fix 구간 필터를 추가했다.
- 다만 2026-04-10 00:00:00 UTC, 한국시간 2026-04-10 09:00:00 KST 이후 운영 CAPI 로그가 아직 0건이라, dedup 위험 그룹이 실제로 3개에서 0개로 줄었는지는 다음 `auto_sync` 이후 확인해야 한다.
- biocom 아임웹 주문 캐시는 처음 확인 시 오래된 상태였지만, 이후 `POST /api/crm-local/imweb/sync-orders`로 최신화했다. 현재 캐시는 2026-04-10T13:04:44Z, 한국시간 2026-04-10 22:04:44 KST 주문까지 들어와 있고 최신 CAPI dedup 후보 3개도 모두 캐시에 존재한다.
- 더클린커피는 `SITE_ACCOUNTS` 매핑과 계정별 Meta 토큰 선택 경로를 보강했다.
- 더클린커피 Meta API는 이제 권한/계정 매핑 문제가 아니라 토큰 만료 문제로 막힌다. `.env`의 `META_ADMANAGER_API_KEY_COFFEE`는 존재하고 backend도 길이 292자의 coffee 토큰을 읽고 있지만, Meta가 현재 그 토큰을 만료로 판정한다.
- Meta Events Manager 확인과 biocom GTM 컨테이너 수정은 로컬 코드만으로 완료할 수 없어 차단 상태로 분리했다.

## CAPI dedup 설명

CAPI dedup은 Meta Pixel 브라우저 이벤트와 Meta Conversions API 서버 이벤트가 같은 구매를 두 번 집계하지 않도록 맞춰 주는 중복 제거 절차다.

우리 상황에 맞춰 풀면 다음과 같다.

- 브라우저 Pixel은 사용자의 결제완료 페이지에서 Meta로 `Purchase` 이벤트를 보낸다.
- 서버 CAPI는 전태준 대표님이 구축한 자체 솔루션 원장, 즉 `payment_success` 원장에 들어온 주문을 기반으로 Meta로 `Purchase` 이벤트를 다시 보낸다.
- 같은 주문이 브라우저와 서버에서 둘 다 전송되면 Meta 입장에서는 이벤트가 2개처럼 보일 수 있다.
- 이때 같은 `event_name`과 같은 `event_id`를 맞춰 보내면 Meta는 둘을 같은 이벤트로 보고 dedup 처리할 수 있다.

dedup이 필요한 이유는 ROAS 해석 때문이다.

- dedup이 안 되면 같은 구매가 Meta 안에서 2번 잡혀 Meta purchase value와 Meta purchase ROAS가 과대 계산될 수 있다.
- 반대로 서버 CAPI만 보고 브라우저 Pixel dedup 여부를 확인하지 않으면, 서버 로그는 2xx 성공인데 Meta 내부에서는 구매가 과하게 잡히는 상황을 놓칠 수 있다.
- 그래서 서버 로그에서는 `orderId + eventName` 기준으로 같은 주문이 여러 번 갔는지 보고, Meta Events Manager에서는 Browser / Server 이벤트가 실제 dedup 되었는지를 별도로 확인해야 한다.

이번에 말하는 `multiEventIdGroups`는 특히 위험한 후보다.

- 같은 `orderId + eventName`인데 `event_id`가 여러 개면 Meta가 같은 주문으로 dedup하지 못할 수 있다.
- 같은 `event_id`로 여러 번 보낸 것은 재시도성 중복일 가능성이 크지만, 서로 다른 `event_id`로 간 것은 Meta ROAS 과대 가능성과 더 직접적으로 연결된다.
- 그래서 최근 7일 운영 성공 로그에서 `multiEventIdGroups: 3`이 핵심 확인 대상이었다.

현재 코드 기준으로는 CAPI `auto_sync`에서 `approvedAt`을 우선 사용해 `event_id`를 안정화하고, 이미 성공 전송한 `orderId/paymentKey + eventName` 조합은 재전송을 막는 방향으로 정리되어 있다. 다만 실제 효과는 다음 `auto_sync` 운영 로그가 생긴 뒤 확인해야 한다.

## 반영 성공

### 1. 더클린커피 Meta 계정별 토큰 선택 경로 수정

반영 파일: `backend/src/routes/ads.ts`

기존에는 `/api/ads/*` 계열에서 Meta API 호출 시 기본 토큰인 `META_ADMANAGER_API_KEY`만 사용했다. 그래서 더클린커피 계정 `act_654671961007474`를 조회해도 biocom 기본 토큰으로 접근하는 문제가 있었다.

수정 후에는 Meta API path에서 `act_...` account id를 추출하고, 더클린커피 계정이면 `META_ADMANAGER_API_KEY_COFFEE`를 우선 사용하도록 바꿨다.

검증 결과:

- `/api/meta/status`에서 coffee 토큰 설정 확인: `configured: true`, `tokenLength: 292`, `accountId: act_654671961007474`
- `/api/meta/insights?account_id=act_654671961007474&date_preset=last_7d` 호출 시 더 이상 기본 토큰 권한 문제로 실패하지 않는다.
- 현재 실패 원인은 토큰 만료로 바뀌었다.

현재 Meta API 오류:

```text
Error validating access token: Session has expired on Thursday, 09-Apr-26 23:00:00 PDT.
code: 190
error_subcode: 463
type: OAuthException
```

해석:

- 더클린커피 계정 매핑과 토큰 선택 코드는 정상 경로로 들어간다.
- `.env`에는 `META_ADMANAGER_API_KEY_COFFEE`가 있고 길이는 292자다.
- 실행 중인 backend의 `/api/meta/status`도 coffee 토큰을 `configured: true`, `tokenLength: 292`로 보고한다.
- 따라서 변수명 누락이나 계정 매핑 누락은 아니다.
- Meta 응답 기준 토큰 만료 시각은 2026-04-09 23:00:00 PDT, 한국시간 2026-04-10 15:00:00 KST다.
- 낮에 됐다면 그 시점이 한국시간 15시 이전이었거나, 현재 `.env`에 남은 값과 낮에 성공한 값이 다를 가능성을 확인해야 한다.
- 토큰을 다시 갱신한 뒤 backend를 재시작하고 같은 API를 다시 확인해야 한다.

### 2. CAPI log post-fix 검증용 `since` / `until` 필터 추가

반영 파일: `backend/src/routes/meta.ts`

`metaroas4.md`는 다음 auto_sync 이후 `/api/meta/capi/log?limit=500&scope=recent_operational&since_days=7&include_dedup_candidates=1`로 dedup 위험 그룹이 3개에서 0개 수준으로 내려가는지 보라고 했다.

문제는 `since_days=7`만 쓰면 수정 전 로그도 계속 섞인다는 점이다. 그래서 post-fix 구간만 분리해서 볼 수 있도록 `/api/meta/capi/log`에 아래 파라미터를 추가했다.

- `since`: ISO timestamp 이후 로그만 조회
- `until`: ISO timestamp 이전 로그만 조회

검증 결과:

```text
/api/meta/capi/log?limit=500&scope=recent_operational&since=2026-04-10T00:00:00.000Z&include_dedup_candidates=1
```

응답 요약:

```json
{
  "total": 0,
  "duplicateOrderEventBreakdown": {
    "retryLikeGroups": 0,
    "retryLikeRows": 0,
    "multiEventIdGroups": 0,
    "multiEventIdRows": 0
  },
  "dedupCandidateDetails": []
}
```

추가 검증:

- `since=not-a-date` 요청 시 `400`, `since must be an ISO timestamp`
- `until=not-a-date` 요청 시 `400`, `until must be an ISO timestamp`
- `since > until`이면 `400`, `since must be earlier than until`

해석:

- post-fix 구간을 분리해서 볼 수 있는 기능은 반영 완료다.
- 아직 post-fix 운영 로그가 없기 때문에 dedup 개선 효과 자체는 다음 auto_sync 이후 판정해야 한다.

### 3. biocom 아임웹 주문 sync 최신화

처음 확인한 상태에서는 biocom 아임웹 로컬 캐시가 최신 CAPI 후보를 덮지 못했다.

초기 확인값:

```text
totalOrders: 5,750
lastOrderAt: 2026-04-07T15:39:13.000Z
lastOrderAt KST: 2026-04-08 00:39:13 KST
latest CAPI risk candidate 202604083892378: missing
```

실행한 sync:

```text
POST /api/crm-local/imweb/sync-orders
body: {"site":"biocom","maxPage":160}

POST /api/crm-local/imweb/sync-orders
body: {"site":"biocom","maxPage":500}
```

최종 확인값:

```text
totalOrders: 8,240
memberOrders: 6,589
phoneCustomers: 6,415
paymentAmountSum: 2,816,166,680
firstOrderAt: 2026-01-07T14:24:14.000Z
firstOrderAt KST: 2026-01-07 23:24:14 KST
lastOrderAt: 2026-04-10T13:04:44.000Z
lastOrderAt KST: 2026-04-10 22:04:44 KST
lastSyncedAt: 2026-04-10 14:22:43
```

최신 CAPI dedup 후보 3개도 이제 모두 아임웹 캐시에 있다.

```text
202604083892378: present
202604066709345: present
202604023345485: present
```

최신 후보 `202604083892378`의 아임웹 캐시 상세:

```text
order_time: 2026-04-08T01:26:11.000Z
order_time KST: 2026-04-08 10:26:11 KST
complete_time: 2026-04-09T03:50:00.000Z
complete_time KST: 2026-04-09 12:50:00 KST
payment_amount: 245,000
```

결론:

- 이전의 “4월 8일 주문이 아직 캐시에 없어 최신 CAPI dedup 후보를 아임웹까지 같이 보려면 sync가 먼저 필요하다”는 말은 sync 전에는 맞았다.
- 현재는 sync를 실행했기 때문에 이 한계는 해결됐다.
- 이제 최신 CAPI dedup 후보는 아임웹 주문 캐시와 조인해서 볼 수 있다.

### 4. 더클린커피 raw 3종 추출 파일 생성

생성 파일:

- `data/ads_site_summary_last7d_coffee_20260410.json`
- `data/ads_roas_daily_coffee_last7d_20260410.json`
- `data/meta_insights_coffee_last7d_20260410.json`

파일 생성 자체는 완료했다. 다만 아래 “중간만 완료”에 적은 것처럼 Meta API 토큰 만료 때문에 2개 파일은 502 응답을 담고 있다.

### 5. 타입체크 통과

검증 명령:

```bash
npm run typecheck
```

작업 위치:

```text
/Users/vibetj/coding/seo/backend
```

결과: 성공

## 중간만 완료

### 1. biocom CAPI dedup 수정 효과 확인

최근 7일 운영 성공 로그 기준 현재 값:

```text
total: 691
success: 691
operational: 691
manual: 0
test: 0
uniqueEventIds: 428
duplicateEventIds: 263
duplicateOrderEventGroups: 173
retryLikeGroups: 170
retryLikeRows: 427
multiEventIdGroups: 3
multiEventIdRows: 12
```

문제의 핵심 후보는 여전히 `multiEventIdGroups: 3`으로 보인다.

다만 이 값은 수정 전 로그를 포함한 최근 7일 값이다. 최신 운영 CAPI 로그는 2026-04-09T21:26:08.834Z, 한국시간 2026-04-10 06:26:08 KST이고, post-fix 기준으로 잡은 2026-04-10T00:00:00.000Z, 한국시간 2026-04-10 09:00:00 KST 이후 로그는 현재 0건이다.

따라서 지금 결론은 다음이 맞다.

- 원인 수정은 이전 작업에서 이미 들어갔다.
- 이번 작업에서 post-fix 검증용 필터는 추가했다.
- 아직 다음 auto_sync 로그가 없어서 “3개 위험 그룹이 0개로 줄었다”고 확정할 수는 없다.

다음 확인 명령:

```text
/api/meta/capi/log?limit=500&scope=recent_operational&since=2026-04-10T00:00:00.000Z&include_dedup_candidates=1&dedup_candidate_limit=10
```

기대값:

```text
multiEventIdGroups: 0 또는 아주 낮은 수준
```

### 2. biocom 아임웹 주문 캐시 최신화 상태

결론: 처음 확인 시점에는 해결 안 된 상태였지만, 이후 sync를 실행해 현재는 해결됐다.

초기 확인값:

```text
endpoint: /api/crm-local/imweb/order-stats?site=biocom
totalOrders: 5,750
firstOrderAt: 2026-01-27T00:01:26.000Z
lastOrderAt: 2026-04-07T15:39:13.000Z
lastOrderAt KST: 2026-04-08 00:39:13 KST
lastSyncedAt: 2026-04-07 16:39:41
```

sync 이후 최종 확인값:

```text
endpoint: /api/crm-local/imweb/order-stats?site=biocom
totalOrders: 8,240
firstOrderAt: 2026-01-07T14:24:14.000Z
firstOrderAt KST: 2026-01-07 23:24:14 KST
lastOrderAt: 2026-04-10T13:04:44.000Z
lastOrderAt KST: 2026-04-10 22:04:44 KST
lastSyncedAt: 2026-04-10 14:22:43
```

최근 7일 CAPI dedup 위험 후보 3개를 아임웹 캐시와 대조한 최종 결과:

```text
202604083892378: present
202604066709345: present
202604023345485: present
```

가장 최신 위험 후보인 `202604083892378`은 CAPI 로그상 승인 시각이 2026-04-08 10:27:59 KST다. sync 전에는 아임웹 캐시가 2026-04-08 00:39:13 KST까지만 있어서 이 주문을 볼 수 없었다. sync 후에는 해당 주문이 캐시에 들어왔다.

해당 주문의 아임웹 캐시 값:

```text
order_no: 202604083892378
order_time: 2026-04-08T01:26:11.000Z
order_time KST: 2026-04-08 10:26:11 KST
complete_time: 2026-04-09T03:50:00.000Z
complete_time KST: 2026-04-09 12:50:00 KST
payment_amount: 245,000
synced_at: 2026-04-10 14:19:59
```

따라서 이전에 나온 “아임웹은 4월 8일 주문이 아직 캐시에 없어 최신 구간 검증에는 한계가 있다. 최신 CAPI dedup 후보를 아임웹까지 같이 보려면 biocom 아임웹 주문 sync를 먼저 최신화해야 한다”는 판단은 sync 전에는 유효했지만, 현재는 해결됐다.

### 3. 더클린커피 연결 확인

확인 결과:

- `backend/src/routes/ads.ts`의 `SITE_ACCOUNTS`에 더클린커피 계정 존재: `act_654671961007474`
- frontend 기본 계정 목록에도 더클린커피 계정 존재
- coffee 전용 토큰도 env에 설정되어 있음
- `/api/ads/site-summary?date_preset=last_7d`에서 더클린커피 row가 반환됨

하지만 더클린커피 Meta API 토큰이 만료되어 실 광고 데이터 조회는 차단됐다.

`site-summary`의 더클린커피 row:

```text
spend: 0
confirmedOrders: 0
pendingRevenue: 262,914
pendingOrders: 6
metaError: Error validating access token...
```

중요 해석:

- 여기서 `spend: 0`은 “최근 7일 광고비가 실제로 0원”이라고 확정하면 안 된다.
- 현재는 Meta API 토큰 만료로 조회가 실패했고, fallback/default 값이 0으로 표시된 상태에 가깝다.
- 토큰 갱신 후 다시 조회해야 coffee spend가 0인지 아닌지 판단할 수 있다.

### 4. 더클린커피 raw 3종 추출

파일 생성은 완료했지만 응답 상태가 섞여 있다.

```text
data/ads_site_summary_last7d_coffee_20260410.json
responseStatus: 200
ok: true
pickedSite.metaError: Meta token expired

data/ads_roas_daily_coffee_last7d_20260410.json
responseStatus: 502
ok: false
error: Meta token expired

data/meta_insights_coffee_last7d_20260410.json
responseStatus: 502
ok: false
error: Meta token expired
```

판정:

- raw 파일 생성은 성공
- raw 데이터 조회는 coffee 토큰 만료로 중간 완료
- 토큰 갱신 후 같은 3개 파일을 다시 뽑아야 한다.

## 실패 또는 외부 차단

### 1. Meta Events Manager Pixel/CAPI dedup 확인

로컬 서버 로그만으로는 브라우저 Pixel과 서버 CAPI가 Meta 안에서 실제 dedup 되었는지 확정할 수 없다.

필요한 자료:

- Meta Events Manager 접속
- biocom Pixel
- Purchase 이벤트 상세
- 같은 주문 또는 같은 event_id 기준으로 Browser / Server 이벤트가 dedup 처리됐는지 확인 가능한 화면

따라서 이 항목은 개발 실패가 아니라 권한/콘솔 확인 차단이다.

### 2. biocom 결제완료 페이지 GTM 오류 정리

기존 `data/gtmerror.md`, `data/gtmerrorreply.md` 기준으로 문제는 biocom 결제완료 페이지의 외부 GTM 컨테이너 `GTM-W7VXS4D8` Custom HTML 쪽 오류로 정리되어 있다.

현재 추정 원인:

```text
Cannot read properties of null (reading 'includes')
```

즉 특정 값이 `null`인데 `.includes(...)`를 호출하는 스크립트가 결제완료 페이지에서 실행되고 있는 형태다.

이 작업은 로컬 코드에서 바로 수정할 수 없다. GTM 컨테이너 권한 또는 리인벤팅 CRM 외주사 쪽 수정이 필요하다.

요청할 조치:

- `GTM-W7VXS4D8`의 결제완료 페이지 발화 태그 중 `includes`를 쓰는 Custom HTML 확인
- `null` / `undefined` guard 추가
- 결제완료 페이지에서 해당 태그가 필요 없으면 payment complete URL에서 제외
- GTM Preview / Tag Assistant에서 오류가 사라진 화면 증빙

### 3. 더클린커피 full comparison

`metaroas4.md`도 더클린커피는 지금 풀스코프 비교가 아니라 연결 확인만 하라고 판단했다. 따라서 full comparison은 진행하지 않았다.

진행하지 않은 이유:

- coffee Meta 토큰 만료로 광고비/구매 지표를 신뢰할 수 없음
- 현재 confirmed order가 0이라 비교 표본이 약함
- biocom CAPI dedup post-fix 검증이 아직 끝나지 않음

## 변경 파일

이번 작업에서 직접 반영한 파일:

- `backend/src/routes/ads.ts`
- `backend/src/routes/meta.ts`
- `data/metaroas4reply.md`

이번 작업에서 생성된 백업 파일:

- `backend/src/routes/ads.ts.bak_20260410_metaroas4_site_token`
- `backend/src/routes/meta.ts.bak_20260410_metaroas4_capi_since_filter`

이번 작업에서 생성 또는 갱신한 raw 확인 파일:

- `data/ads_site_summary_last7d_coffee_20260410.json`
- `data/ads_roas_daily_coffee_last7d_20260410.json`
- `data/meta_insights_coffee_last7d_20260410.json`

이번 작업에서 API를 통해 갱신한 로컬 데이터:

- `backend/data/crm.sqlite3`의 `imweb_orders` biocom 캐시
- 이 파일은 git status에는 별도 변경으로 뜨지 않는 로컬 SQLite 데이터 파일이지만, `/api/crm-local/imweb/sync-orders` 실행 결과 biocom 주문 캐시는 5,750건에서 8,240건으로 최신화됐다.

## 다음 액션

1. `META_ADMANAGER_API_KEY_COFFEE`를 새 토큰으로 갱신한다.
2. backend를 재시작한다.
3. 아래 3개 더클린커피 API를 다시 확인한다.

```text
/api/ads/site-summary?date_preset=last_7d
/api/ads/roas/daily?account_id=act_654671961007474&date_preset=last_7d
/api/meta/insights?account_id=act_654671961007474&date_preset=last_7d
```

4. 다음 biocom `auto_sync` 이후 아래 CAPI dedup 쿼리를 다시 확인한다.

```text
/api/meta/capi/log?limit=500&scope=recent_operational&since=2026-04-10T00:00:00.000Z&include_dedup_candidates=1&dedup_candidate_limit=10
```

5. Meta Events Manager에서 Purchase 이벤트 상세 화면을 확인한다.
6. 리인벤팅 CRM 외주사 또는 GTM 권한 보유자에게 `GTM-W7VXS4D8` 결제완료 페이지 오류 수정을 요청한다.
