# TikTok GTM 계획과 설계 의도

작성 시각: 2026-05-02 20:56 KST
상태: 설계 초안 완료. 운영 publish 전.
대상: Biocom TikTok ROAS 정합성 개선
핵심 제안: **TikTok 클릭 intent 수집만 GTM으로 추가한다.**
자신감: **86%**

## 10초 요약

현재 제안은 GTM을 새로 만들어서 TikTok 전체 추적을 대체하는 것이 아니다.

GTM은 `TikTok 광고 클릭으로 들어온 흔적`만 저장한다. TikTok Purchase Guard는 계속 아임웹 헤더에 둔다. checkout/payment_success 원장도 기존 아임웹 footer 흐름을 유지한다.

이렇게 나누는 이유는 명확하다. Guard는 TikTok Pixel보다 먼저 떠야 해서 GTM이 늦을 수 있다. 반대로 클릭 intent 수집은 페이지 URL, referrer, cookie를 읽어서 TJ 관리 Attribution VM에 보내면 되므로 GTM과 잘 맞는다.

## 결론

GTM 생성은 현재 권장안이다.

단, 범위는 아래 하나로 제한한다.

```text
TikTok 광고 클릭 intent 수집
```

GTM으로 하지 않을 것:

- TikTok Purchase Guard 대체
- TikTok Events API 전송
- Meta CAPI 전송
- GA4 purchase 전송
- Google Ads conversion 전송
- 운영DB write
- 결제상태 확정 판단

## 왜 이 작업을 하는가

현재 TikTok gap의 핵심은 이렇다.

TikTok은 광고를 본 사람 또는 클릭한 사람이 나중에 구매하면 플랫폼 매출로 잡을 수 있다. 반면 우리는 `payment_success`에 TikTok UTM 또는 `ttclid`가 남아야 내부 TikTok confirmed로 본다.

문제는 사용자가 TikTok 광고를 클릭한 뒤 바로 구매하지 않는 경우다.

예시:

1. 사용자가 TikTok 광고 클릭
2. Biocom 상품상세 또는 홈 진입
3. 당일 또는 며칠 뒤 direct, Meta, 검색으로 재방문
4. 카드 결제 완료
5. TikTok은 자기 플랫폼 구매로 잡을 수 있음
6. 우리 내부 원장은 TikTok 흔적이 결제 시점에 없어서 0원으로 봄

이 중 클릭 기반 재방문 구매는 GTM `marketing_intent`로 보강할 수 있다.

조회 기반 VTA는 GTM으로도 못 잡는다. URL이나 referrer에 TikTok 클릭 흔적이 없기 때문이다. VTA는 계속 `platform-only assisted`로 분리해야 한다.

## 설계 원칙

| 원칙 | 설명 |
|---|---|
| 최소 침습 | 아임웹 헤더/푸터를 더 복잡하게 만들지 않는다 |
| no-send 기본 | 광고 플랫폼으로 전환을 새로 보내지 않는다 |
| 내부 원장만 기록 | 저장 대상은 TJ 관리 Attribution VM SQLite다 |
| strict와 후보 분리 | GTM intent는 내부 confirmed가 아니라 firstTouch 후보로만 본다 |
| VTA는 분리 | 클릭 흔적 없는 조회 기반 구매는 내부 확정 매출로 승격하지 않는다 |
| 롤백 쉬움 | 문제 발생 시 GTM tag pause로 중단한다 |

## 전체 구조

```text
TikTok 광고 클릭
  ↓
Biocom 랜딩 URL에 ttclid 또는 TikTok UTM 존재
  ↓
GTM Custom HTML tag fired
  ↓
POST /api/attribution/marketing-intent
  ↓
TJ 관리 Attribution VM SQLite attribution_ledger
  touchpoint=marketing_intent
  ↓
같은 브라우저/사용자가 7일 내 구매
  ↓
기존 payment_success 수신
  ↓
backend firstTouch 매칭
  ↓
/ads/tiktok 에 firstTouch 후보로 표시
```

## 데이터/DB 위치

| 구분 | 위치 | 역할 |
|---|---|---|
| 운영DB | 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users` | 실제 주문 상태 검산. 이번 GTM 작업에서 write 없음 |
| TJ 관리 Attribution VM | `att.ainativeos.net` 내부 SQLite `CRM_LOCAL_DB_PATH#attribution_ledger` | `marketing_intent`, `checkout_started`, `payment_success` 저장 |
| 로컬 개발 DB | `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` | TikTok Ads API/CSV 캐시와 로컬 대시보드 확인 |
| GTM | Biocom GTM container | `marketing_intent` tag 실행 |

## GTM으로 만들 태그

Tag name:

```text
SEO - TikTok Marketing Intent - v1
```

Tag type:

```text
Custom HTML
```

역할:

- 현재 페이지 URL에서 `ttclid` 확인
- 현재 페이지 URL에서 TikTok UTM 확인
- Referrer가 `tiktok.com`인지 확인
- GA cookie에서 `clientId`, `gaSessionId` 읽기
- `_ttp` cookie 읽기
- TJ 관리 Attribution VM endpoint로 POST
- 24시간 localStorage dedupe 적용

실제 Custom HTML 초안:

- `tiktok/tiktok_marketing_intent_gtm_v1.md`

## GTM Trigger 설계

Tag는 아래 trigger 중 하나라도 맞으면 fired 된다.

| Trigger name | Trigger type | 조건 | 의도 |
|---|---|---|---|
| `SEO - TikTok Intent - ttclid` | Initialization / Some Pages | `Page URL` contains `ttclid=` | TikTok 클릭 ID가 있는 가장 강한 근거 |
| `SEO - TikTok Intent - UTM` | Initialization / Some Pages | `Page URL` matches RegEx `utm_(source\|medium\|campaign\|content\|term)=[^&#]*tiktok` | TikTok UTM으로 들어온 클릭 근거 |
| `SEO - TikTok Intent - Referrer` | Initialization / Some Pages | `Referrer` contains `tiktok.com` | UTM이 빠졌지만 TikTok 앱/웹에서 넘어온 약한 근거 |

Tag firing option:

```text
Once per page
```

추가 중복 방지:

```text
localStorage key = __seo_tiktok_marketing_intent_sent__:{ttclid|campaign|content|path}
TTL = 24시간
```

## Backend 설계

이미 로컬 구현한 내용:

- `POST /api/attribution/marketing-intent`
- TikTok 근거가 없으면 저장하지 않고 skip
- 같은 intent는 24시간 중복 저장 방지
- 저장 시 `touchpoint=marketing_intent`
- `metadata.intentChannel=tiktok`
- `metadata.intentLookbackDays=7`
- `metadata.tiktokMatchReasons` 저장
- 이후 `payment_success`가 들어오면 7일 이내 `marketing_intent`를 firstTouch 후보로 연결

중요한 정책:

`payment_success`의 top-level `utmSource`, `ttclid`는 덮어쓰지 않는다.

이유는 firstTouch 후보를 strict confirmed처럼 보이게 만들면 다른 채널 매출을 TikTok으로 과대 승격할 위험이 있기 때문이다.

## 왜 7일인가

현재 TikTok Ads 비교 기준은 Click 7일 / View 1일 기본 window로 보고 있다.

GTM intent는 클릭 흔적만 다룬다. 그래서 `marketing_intent` firstTouch lookback도 7일로 맞춘다.

View-through 1일은 내부에서 직접 관측할 수 없다. 따라서 VTA는 내부 확정 매출이 아니라 TikTok platform-only assisted로 유지한다.

## 검증 계획

### 1단계. Backend 먼저 배포

목표:

TJ 관리 Attribution VM이 `marketing_intent`를 받을 수 있어야 한다.

검증:

```text
POST https://att.ainativeos.net/api/attribution/marketing-intent
```

성공 기준:

- HTTP 201 또는 duplicate 200
- `CRM_LOCAL_DB_PATH#attribution_ledger`에 `touchpoint=marketing_intent` row 생성
- `metadata.intentChannel=tiktok`
- `metadata.tiktokMatchReasons` 존재

### 2단계. GTM Preview

테스트 URL:

```text
https://biocom.kr/?utm_source=tiktok&utm_medium=paid&utm_campaign=codex_gtm_test&ttclid=codex_gtm_20260502
```

성공 기준:

- GTM Preview에서 `SEO - TikTok Marketing Intent - v1` fired
- Network에서 `marketing-intent` 요청 확인
- 응답 201 또는 duplicate 200

### 3단계. 같은 브라우저 카드 결제 테스트

목표:

`marketing_intent`와 `payment_success`가 이어지는지 확인한다.

성공 기준:

- `payment_success.metadata_json.firstTouch.touchpoint=marketing_intent`
- `firstTouch.ttclid=codex_gtm_20260502`
- `firstTouchMatch.source=marketing_intent`
- `/ads/tiktok` firstTouch 후보에 반영
- strict confirmed는 여전히 별도 유지

### 4단계. GTM Publish

Publish 전 조건:

- Backend receiver 배포 완료
- GTM Preview 성공
- 같은 브라우저 결제 테스트 성공
- 중복 저장 방지 확인
- `__seo_attribution_debug=1`에서 디버그 로그 정상

## 성공 기준

| 기준 | 목표 |
|---|---|
| TikTok 테스트 URL intent 저장 | 1건 이상 성공 |
| 같은 브라우저 payment_success firstTouch 연결 | 1건 이상 성공 |
| 일반 direct 페이지에서 intent 저장 | 0건 |
| 중복 새로고침 저장 | 24시간 내 duplicate 처리 |
| Purchase Guard 영향 | 없음 |
| Meta/GA4/TikTok Events API 전송 | 없음 |

## 실패 기준과 롤백

| 문제 | 대응 |
|---|---|
| Network CORS 실패 | VM CORS 설정 확인. GTM publish 금지 |
| 일반 페이지에서 과다 저장 | trigger 조건 강화 또는 tag pause |
| payment_success firstTouch 연결 실패 | clientId/gaSessionId 저장 여부 확인 |
| 구매 흐름 지연/에러 | GTM tag pause |
| Guard 동작 이상 | GTM 문제가 아니라 헤더 Guard 별도 확인 |

롤백은 GTM tag pause가 1차다.

Backend 배포 후 문제가 있으면 TJ 관리 Attribution VM에서 이전 dist 백업으로 복원한다.

## 지금 판단

GTM 생성을 권장한다.

이유:

- 아임웹 헤더/푸터를 더 건드리지 않아도 된다.
- GTM Preview로 publish 전 검증이 가능하다.
- 문제가 생기면 tag pause로 빠르게 멈출 수 있다.
- 현재 gap 중 “클릭 후 재방문 구매 누락”만 정확히 겨냥한다.

다만 이 작업으로 TikTok VTA gap이 사라지지는 않는다. VTA는 계속 플랫폼 참고값으로만 둔다.

## 다음 할일

| 순서 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 컨펌 필요 | 자신감 |
|---:|---|---|---|---|---|---:|
| 1 | Codex | TJ 관리 Attribution VM에 `marketing-intent` receiver 배포 준비 | GTM이 보낸 intent를 받을 서버가 먼저 필요하다 | 변경 파일만 선별 배포, 백업, `node --check`, `/health`, smoke fetch 확인 | YES, 배포 승인 | 88% |
| 2 | TJ | GTM workspace에서 Custom HTML tag 초안 생성 | 아임웹 코드 추가 없이 TikTok 클릭 intent를 저장한다 | `tiktok/tiktok_marketing_intent_gtm_v1.md`의 Custom HTML을 붙이고 Preview 모드 실행 | YES, GTM publish 전 승인 | 86% |
| 3 | TJ + Codex | 테스트 URL로 GTM Preview 검증 | 실제 tag fired와 VM 저장을 확인해야 publish할 수 있다 | 테스트 URL 접속, Network 201, VM ledger row 확인 | NO, preview/read-only | 90% |
| 4 | TJ + Codex | 같은 브라우저 카드 결제 1건 검증 | 클릭 intent가 구매 firstTouch 후보로 연결되는지 확인한다 | 테스트 URL 진입 후 카드 결제, `payment_success.metadata_json.firstTouch` 확인 | YES, 실제 주문 테스트 | 84% |
| 5 | TJ | 성공 시 GTM publish | 이후 7~14일 데이터를 믿을 수 있게 만든다 | publish 후 `/ads/tiktok`에서 strict / firstTouch / platform-only assisted 분리 관찰 | YES | 82% |
