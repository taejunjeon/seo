# Header / Body / Footer 코드 작성·검증 원칙 (2026-04-15)

> 이 문서는 **아임웹 사이트(biocom.kr / thecleancoffee.com / AIBIO) 의 헤더·바디·푸터 삽입 코드** 를 작성하거나 수정할 때 반드시 지켜야 할 규칙을 정리한다. 모든 규칙은 실제로 발생한 버그 사례에서 나왔고, **재발 방지용** 이다.
>
> **원칙**: "한 번 당한 버그는 규칙으로 굳혀 두 번 당하지 않는다."

---

## 0. 왜 이 파일이 있는가 — 사건 기록

| 날짜 | 사건 | 원인 | 피해 | 규칙화된 원칙 |
|---|---|---|---|---|
| 2026-04-12 | 카드결제인데 `VirtualAccountIssued` 오발사 (biocom) | Purchase Guard v3 가 서버 `/payment-decision` 응답을 fallback 처리 | Meta 에 Purchase 누락 | §D, §E |
| 2026-04-14 | 커피 Purchase Guard 설치 후 카드결제 4차 주문 동일 증상 | 커피 Toss merchant 가 자회사(`iw_theclevibf`) 로 이전됐는데 backend 가 구 키 보유 | 50일간 Toss direct 조회 전부 실패 | §D, §F |
| 2026-04-15 | biocom 푸터가 **커피 라벨로 이벤트 송신** (`source: 'thecleancoffee_imweb'`, `G-JLSBXX7300`) | 템플릿 복제 후 문자열 치환 누락 | attribution 원장에 biocom 구매가 coffee 로 집계 | §A, §I, §E |
| 2026-04-15 | Meta 커피 토큰 2026-04-09 만료로 VM 서버 CAPI 404 | 로컬 `.env` 에만 새 토큰 반영, VM 미반영 | 커피 funnel CAPI 전송 전면 실패 | §F |
| 2026-04-15 | 매뉴얼 파일에서 custom "TikTok Catalog 보완 코드" 놓침 (스크레이핑) | 내가 라이브 HTML 에서 grep 범위를 좁게 잡음 | 문서 누락 | §E |
| (이전) | GA4 `GA4_구매전환_Npay` 가 비정본 `G-8GZ48B1S59` 로 발사 | GTM 태그 measurementIdOverride 수동 오설정 | 정본 속성에 구매 이벤트 누락 | §A, §I |

---

## 1. 원칙

### §A. 사이트 정체성 라벨은 **한 곳에 집중**하고 **반드시 치환 확인**한다

한 사이트의 코드를 다른 사이트로 복제할 때 가장 자주 깨지는 건 **식별자 하드코딩**이다. 아래 표가 유일 source of truth 이며, 스크립트 안에서 literal 로 쓰기보다 상수 객체 1회 선언 후 참조할 것.

| 항목 | biocom.kr | thecleancoffee.com | AIBIO |
|---|---|---|---|
| `source` (attribution 원장 키) | `biocom_imweb` | `thecleancoffee_imweb` | `aibio_imweb` |
| GA4 measurement id (정본) | `G-WJFXN5E2Q1` | `G-JLSBXX7300` | `G-PQWB91F4VQ` |
| GA4 measurement id (비정본/사용 중지) | `G-8GZ48B1S59` | — | — |
| Meta Pixel ID | `1283400029487161` | `1186437633687388` | `1068377347547682` |
| Meta 시스템 유저 토큰 env | `META_ADMANAGER_API_KEY` (global) | `COFFEE_META_TOKEN` | (미정) |
| GTM 컨테이너 ID | `GTM-W2Z6PHN` | `GTM-5M33GC4` | `GTM-T8FLZNT` |
| Google Ads 계정 (primary) | `AW-304339096` | `AW-10965703590` | (미정) |
| Google Ads 계정 (공유) | `AW-304339096` 도 coffee 쪽에 붙어 있음 | `AW-304339096` 공유 | — |
| TikTok Pixel | `D5G8FTBC77UAODHQ0KOG` ✅ 운영 중 | 없음 (TJ 확인) | 없음 |
| Toss merchant ID | `iw_biocomo8tx` | `iw_theclevibf` (2026-02-23 이후, 자회사 알로스타에프앤비) | — |
| attribution endpoint host | `https://att.ainativeos.net` | 동일 | 동일 |
| snippetVersion prefix 규칙 | `YYYY-MM-DD-biocom-<feature>-v<N>` | `YYYY-MM-DD-thecleancoffee-<feature>-v<N>` | `YYYY-MM-DD-aibio-<feature>-v<N>` |

**강제 규칙**:
1. 스크립트 안의 모든 식별자는 **CONFIG 객체의 상단 선언** 을 통해서만 참조. IIFE body 안에 literal 로 다시 박지 말 것
2. 파일 이름 자체에도 사이트 slug 를 넣음 (예: `biocom_funnel_capi_0415.md`, `coffee_header_guard_0414.md`)
3. **크로스 복제 금지**: "template 복제 후 치환" 을 한 번이라도 했다면, 아래 §E 의 **Site Identity Audit** 명령을 반드시 돌려 확인

---

### §B. 이벤트 dedup 는 **event_id 공유** 로 설계한다

같은 비즈니스 이벤트 1건에 대해 브라우저 픽셀(`fbq`) 과 서버 CAPI(`POST /api/meta/capi/track`, `/api/meta/send`) 가 **동시에 2경로로 발사**된다. Meta 는 `event_id` (픽셀) ↔ `eventId` (CAPI) 가 동일하면 자동 dedup.

**강제 규칙**:
1. 모든 커스텀 `fbq('track', ...)` 호출은 `{ eventID: X }` 를 3번째 인자로 전달
2. 같은 X 를 서버 CAPI 호출의 `eventId` 필드에 그대로 복사
3. X 는 **결정론적** 이어야 함:
   - Purchase: `'purchase-' + orderCode` (재시도해도 동일)
   - InitiateCheckout: `'ic-' + checkoutId` (세션 unique)
   - ViewContent: `'vc-' + Date.now() + '-' + random` (세션별, 중복 허용)
4. 중복 억제는 **storage** 로:
   - Purchase: `localStorage.setItem('sent:purchase:' + orderCode, ...)` — 영속
   - ViewContent: `sessionStorage.setItem('sent:vc:' + contentIds, ...)` — 세션
5. 서버 응답이 500/502 여도 **브라우저 픽셀은 이미 발사됨** — 서버 실패로 dedup 깨지지 않음

---

### §C. 스크립트 태그 병합 가능성을 가정한다

aimweb 렌더러는 붙어있는 여러 `<script>` 태그를 **하나로 병합** 할 수 있음 (2026-04-15 매뉴얼 vs 라이브 비교에서 확인). 따라서:

**강제 규칙**:
1. 모든 script 블록은 **IIFE (`(function(){...})()`)** 로 감싸서 스코프 격리
2. 전역 변수 오염 금지. 필요하면 `window.__MYPROJECT_XXX__` 네임스페이스 사용
3. "이전 script 가 선언한 함수를 다음 script 에서 호출" 하는 설계 금지 — 병합되면 실행 순서 불명확
4. 블록 간 의존성이 있으면 1개 IIFE 안에 담거나 `window.dispatchEvent(new CustomEvent(...))` 로 주고받기

---

### §D. 서버 의존은 **timeout + graceful fallback** 이 기본

footer/header 코드가 `/api/*` 를 호출할 때, 서버 장애가 사용자 경험을 해치면 안 된다. 특히 **Purchase Guard v3 처럼 "구매를 차단하는" 판정 로직** 은 매우 조심.

**강제 규칙**:
1. `fetch` 호출엔 **반드시 timeout** (AbortController + 3s 이내)
2. 서버가 `5xx` 또는 timeout 이면 fallback 동작 명시:
   - Purchase Guard: "정보 없음 → 원래대로 Purchase 발사" (보수적이지만 매출 우선) OR "정보 없음 → hold" (정합성 우선) 중 **어느 쪽인지 CONFIG 에 명시**
   - Funnel CAPI: 서버 실패해도 브라우저 fbq 는 이미 발사됐으므로 무시 가능 (§B 참조)
3. `keepalive: true` 로 unload 중에도 전송 완료되도록 설정 (brower 종료 직전 이벤트에 유리)
4. 의존 endpoint 가 **살아있는지** 는 배포 직전 `curl` 로 2번 이상 확인 (한 번은 로컬, 한 번은 `att.ainativeos.net`)
5. 의존 endpoint 의 env 변수 (예: `COFFEE_META_TOKEN`, `TOSS_LIVE_SECRET_KEY_COFFEE`) 는 **로컬과 VM 양쪽에서 resolve 되는지** 확인 (§F 참조)

---

### §E. 배포 전·후 검증은 **grep 증거 기반** 이다

"설치했다" 는 사용자 말만 믿지 말고, **라이브 HTML 에서 증거를 뽑아 확인** 한다. snippetVersion 은 이 검증을 위한 유일한 식별자.

**강제 규칙**:

#### 배포 전 (사용자에게 전달하기 전)
```bash
# 1) 새 코드의 snippetVersion 이 기존과 겹치지 않는지 확인
grep -rn "snippetVersion" footer/ meta/ capivm/

# 2) 사이트 정체성 라벨 오염 검사 (Site Identity Audit)
# biocom 코드에 coffee 라벨이 박혀있으면 즉시 중단
grep -nE "thecleancoffee|G-JLSBXX7300|iw_theclev|1186437633687388" footer/biocom*.md
# coffee 코드에 biocom 라벨
grep -nE "G-WJFXN5E2Q1|iw_biocomo8tx|1283400029487161" footer/coffee*.md
# 기대: 각각 0 매치
```

#### 배포 후 (사용자가 삽입했다고 말한 직후 ≤ 5분)
```bash
# 1) 라이브 HTML 재수집
curl -sL "https://www.biocom.kr/" -H "User-Agent: Mozilla/5.0" -o /tmp/biocom.html
curl -sL "https://thecleancoffee.com/" -H "User-Agent: Mozilla/5.0" -o /tmp/coffee.html

# 2) 구 snippetVersion 제거 확인 (0 이어야 함)
grep -c "<OLD_SNIPPET_VERSION>" /tmp/biocom.html

# 3) 새 snippetVersion 등장 확인 (≥ 1 이어야 함)
grep -c "<NEW_SNIPPET_VERSION>" /tmp/biocom.html

# 4) 사이트 정체성 오염 검사 (§A 의 치환 확인)
grep -cE "thecleancoffee_imweb|G-JLSBXX7300" /tmp/biocom.html  # 기대 0
grep -cE "biocom_imweb|G-WJFXN5E2Q1" /tmp/biocom.html          # 기대 ≥ 1

# 5) 서버 의존 endpoint live 확인
curl -s https://att.ainativeos.net/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['apis']['meta'], d['apis']['toss']['stores'])"
```

#### 실제 이벤트 흐름 검증
- 브라우저 devtools Console 에서 `[snippetVersion]` prefix 로그가 찍히는지
- Meta Events Manager → 테스트 이벤트 → `testEventCode` 로 필터 → 브라우저 + 서버 양쪽 수신 + dedup 표시
- backend 로그 (`pm2 logs seo-backend` 또는 로컬 console) 에 해당 endpoint 호출 request 찍히는지

**검증 못 한 것은 솔직하게 "검증 안 됨" 으로 남긴다.** 완료 보고에 절대 "정상 작동" 이라 적지 않는다.

---

### §F. 로컬 `.env` 와 VM `.env` 는 **항상 동기화** 한다

2026-04-15 에 한 세션 안에서 같은 유형 버그 2건 (Toss 커피 키, Meta 커피 토큰) 이 터진 근본 원인. **식별자가 로컬에만 있으면 VM 이 죽은 상태**.

**강제 규칙**:
1. 로컬 `backend/.env` 에 새 변수를 추가할 때마다 **즉시**:
   - `capivm/backend.env.vm.example` 의 placeholder 에도 추가
   - VM 의 `/home/biocomkr_sns/seo/shared/env/backend.env` 에 실값 append (ssh + `cat >>`)
2. VM 반영 후 **반드시** `pm2 restart seo-backend --update-env` (그냥 restart 는 env 리로드 안 함)
3. 반영 확인은 `/health` endpoint 의 `apis.{meta,toss,...}` 플래그로
4. **`.env` 의 중요한 값을 주석 처리할 때는 절대 삭제하지 말고 deprecated 표시만** — 구 Toss merchant 의 히스토리 조회처럼 나중에 필요할 수 있음

---

### §G. auto 주입 vs custom 주입 을 구분해서 관리한다

아임웹은 marketing 탭에서 설정한 항목(Meta Pixel base, GTM, GA4, Google Ads gtag, Naver WCS, TikTok Pixel, Kakao Pixel, `GOOGLE_ADWORDS_TRACE`, Keepgrow 등) 을 **자동 주입** 한다. 이것은 내 repo 의 footer 파일에 존재하지 않아도 라이브에 나타난다.

**강제 규칙**:
1. `footer/biocomcodemanual.md` / `footer/coffeecodemanual.md` = **사용자가 직접 삽입한 코드만** 기록 (4개 슬롯: 헤더 상단 / 헤더 / 바디 / 푸터)
2. `footer/biocomimwebcode.md` / `footer/coffeeimwebcode.md` = **라이브 HTML 의 모든 스크립트** 스냅샷 (auto + custom 둘 다)
3. auto 주입은 아임웹 admin UI 설정이므로 코드 수정으로 해결 불가 — 반드시 사용자에게 "아임웹 admin > 마케팅 > XX 탭에서 설정하십시오" 로 안내
4. GTM 내부 태그 관리는 **Tag Manager API 기반 `backend/scripts/gtm-audit.ts`** 로 주기 스냅샷 → repo 외부 `gtmaudit/` 에 저장 (repo commit 제외)

---

### §H. 쿠키/스토리지 키는 **일관성** 을 유지한다

- `_fbp` / `_fbc` — Meta pixel base 코드가 자동으로 set. CAPI 서버 호출 시 `getCookie('_fbp')` / `getCookie('_fbc')` 로 읽어 body 에 포함. 이 두 값이 일치해야 Meta EMQ (Event Match Quality) 점수가 7.0+ 로 올라감
- `_p1s1a_first_touch` / `_p1s1a_session_touch` / `_p1s1a_last_touch` — UTM persistence. **legacy 키** 이지만 과거 first-touch 데이터 호환 위해 유지
- `__seo_checkout_id` / `__seo_checkout_context` — checkout_started 와 payment_success 를 잇는 세션 단위 상관 키
- `sent:purchase:*` (localStorage) / `sent:vc:*` (sessionStorage) — dedup 보증 키

**강제 규칙**:
1. 새 키를 만들 때 위 prefix 네임스페이스를 따름 (`__seo_` 또는 `_p1s1a_`)
2. 키 rename 은 금지. 추가는 가능, 삭제는 최소 30일 deprecation 기간 후에만
3. storage quota 이슈 대비: 키 하나당 payload 는 2KB 이내

---

### §I. 템플릿 복제 시 **Site Identity Substitution Checklist** 실행

coffee footer → biocom footer 복제처럼 cross-site 복제는 **가장 위험한 작업**. 2026-04-15 버그가 정확히 이 시나리오.

**의무 체크리스트 (복제 직후 반드시)**:

```
□ CONFIG.snippetVersion 에 목표 사이트 slug 박혀 있음 (coffee → biocom)
□ CONFIG.source 가 목표 사이트 (예: 'biocom_imweb')
□ CONFIG.measurementIds 가 목표 사이트 정본 GA4 (예: ['G-WJFXN5E2Q1'])
□ CONFIG.pixelId 가 목표 사이트 Meta pixel
□ CONFIG.endpoint host 는 동일 (`att.ainativeos.net`) 이지만 path 는 사이트별 분기 없는지 확인
□ 파일 이름이 목표 사이트 slug 포함
□ 파일 상단 주석에도 목표 사이트 이름 (예: `<!-- biocom footer ... -->`)
□ grep 최종 확인: `grep -cE "<원본_사이트_label>" <새_파일>` = 0
```

복제 시 치환하지 않아도 되는 항목:
- attribution endpoint host (`att.ainativeos.net`) — 사이트 공통
- storage 키 네임스페이스 (`__seo_*`, `_p1s1a_*`) — 사이트 공통
- dedup 키 prefix — 사이트 공통

---

### §J. 신규 코드는 **dryRun → testEventCode → 정규 활성화** 3단계로

절대 첫 배포부터 실제 Meta/GA4 로 이벤트를 쏘지 말 것.

**강제 규칙**:
1. **1단계 dryRun**: `window.XYZ_CONFIG = { dryRun: true, debug: true }` — 서버 fetch 안 하고 console.log 만. 24시간 관찰
2. **2단계 testEventCode**: Meta Events Manager 에서 테스트 코드 받아 `testEventCode: 'TESTXXX'` 설정 → 실제 이벤트가 "테스트 이벤트" 패널에만 보임 → 정규 이벤트 카운트에 영향 없음. 또 24시간
3. **3단계 정규**: `dryRun: false, debug: false, testEventCode: ''` 로 변경 → 본 운영. 72시간 EMQ / Match Quality / 이벤트 수치 관찰
4. 각 단계마다 **snippetVersion 문자열 변경** 금지 (관찰 연속성 위해)

---

## 2. 실전 배포 체크리스트 (축약본)

### 배포 시작 전
```
[ ] §A 사이트 정체성 상수표 재확인
[ ] §I Site Identity Substitution Checklist 8항목
[ ] §E 배포 전 grep 검증 2건 (snippetVersion 중복 / label 오염)
[ ] §D 의존 endpoint 살아있음 (로컬 + VM 둘 다)
[ ] §F 로컬 `.env` ↔ VM `.env` 동기화
[ ] `dryRun: true, debug: true, testEventCode: ''` 기본값
```

### 배포 직후 (≤ 5분)
```
[ ] §E 배포 후 curl + grep 5건
[ ] Devtools Console 에 `[snippetVersion] installed` 로그 확인
[ ] Meta Events Manager > 테스트 이벤트 탭 이벤트 유입 확인 (testEventCode 기준)
[ ] backend `pm2 logs` 에서 해당 endpoint 호출 request 확인
```

### 24시간 후 (dryRun 해제 판단)
```
[ ] 콘솔 에러 0건
[ ] 서버 5xx 율 < 1%
[ ] Meta EMQ ≥ 7.0 (테스트 이벤트 기준)
[ ] 원본 footer 기능 (Purchase Guard 등) 회귀 없음
→ 위 4개 모두 충족 시에만 `dryRun: false` 로 전환
```

### 72시간 후 (정규 활성화 판정)
```
[ ] Meta Events Manager 정규 이벤트 카운트 기대 범위 (Purchase 대비 VC:AC:IC 비율 업계 평균 100:15:5:1 참조)
[ ] attribution 원장 `source` 필드가 목표 사이트 값으로 들어옴
[ ] GA4 정본 속성에 이벤트 집계
[ ] Google Ads / TikTok / Naver ROAS 지표 회귀 없음
→ 모두 통과 시 감사 완료. 감사 결과를 `meta/capimeta.md` 에 섹션 추가
```

---

## 3. 안티 패턴 (하지 말 것)

### ❌ "비슷한 사이트니까 복붙하면 되겠지"
→ 2026-04-15 biocom/coffee 라벨 크로스 오염의 원인. 반드시 §I 체크리스트.

### ❌ "서버 배포는 나중에, 일단 footer 먼저"
→ Purchase Guard 는 서버 `/payment-decision` 의존. 서버 없이 footer 만 있으면 가드 fallback → Purchase 누락. 반드시 서버 먼저 → footer 나중.

### ❌ "env 변수는 로컬만 바꾸면 될 것 같은데"
→ 2026-04-15 커피 Meta 토큰 만료 VM 미반영 사건. §F 강제.

### ❌ "snippetVersion 이름 좀 긴데 짧게 줄이자"
→ snippetVersion 은 유일한 grep 식별자. 줄이면 검증 불가. 규칙: `YYYY-MM-DD-<site>-<feature>-v<N>` 포맷 고정.

### ❌ "fbq + 서버 CAPI 두 번 쏘면 이중 카운트 되잖아"
→ `eventId` 공유로 Meta 가 자동 dedup. 안 쏘면 iOS ITP 손실 회복 못 함. §B 필수.

### ❌ "dryRun 없이 바로 활성화하자 시간 없어"
→ §J 3단계 건너뛰면 실패 시 rollback 어려움. "시간 없음" 은 이유 안 됨.

### ❌ "console.log 는 운영에 안 남기자 성능 저하"
→ Purchase Guard 같은 결제 차단 로직은 **사용자 제보 시 디버깅 유일 수단**. debug flag 로 on/off 하되 기본값은 off + snippetVersion 로그 1회만 남김 (`console.info`).

### ❌ "tmp_ 로 시작하는 태그는 삭제하자"
→ GTM 감사 (2026-04-15) 에서 `tmp_` 접두사 태그 3개 발견. 일부는 실제 운영 중일 수 있음. 삭제 전 반드시 "이 태그가 언제 마지막으로 발화했는가" 확인 (GTM 태그 triggering history).

### ❌ "aimweb admin UI 에 직접 코드 고쳐 넣고 repo 에 반영은 나중에"
→ 매뉴얼 파일이 stale 해짐. 반드시 **repo → admin UI 복붙** 단방향 흐름. admin UI 에서 수정한 것은 즉시 repo 로 역동기화.

---

## 4. 재검증 자동화 (TODO)

```bash
# backend/scripts/snapshot-imweb.sh (미구현)
# 매일 오전 3시 cron → /tmp/snapshots/{biocom,coffee}-YYYY-MM-DD.html
# 전날 대비 diff → snippetVersion 변경 감지 → Slack/이메일 경보
```

이걸 만들면 매뉴얼 파일 stale 감지가 자동. `footer/biocomcodemanual.md` 편집 + live HTML diff 가 불일치하면 CI 실패로 막아낼 수도 있음 (future work).

---

## 5. 참조 문서

- **전체 라이브 HTML 스냅샷**: [biocomimwebcode.md](biocomimwebcode.md) (biocom 기준)
- **custom 코드 매뉴얼 원본**: [biocomcodemanual.md](biocomcodemanual.md) (2026-04-15 coffee 라벨 오염 이슈 상단 기재)
- **커피 Purchase Guard**: [coffee_header_guard_0414.md](coffee_header_guard_0414.md)
- **커피 footer (UTM + checkout + payment)**: [coffeefooter0414.md](coffeefooter0414.md)
- **Phase 9 Funnel CAPI 스니펫**: [funnel_capi_0415.md](funnel_capi_0415.md)
- **Meta CAPI 운영 가이드 (서버 측)**: [../meta/capimeta.md](../meta/capimeta.md)
- **ROAS 정합성 로드맵**: [../capivm/googleadstictok.md](../capivm/googleadstictok.md)

---

## 6. 이 문서의 유지보수

- 새 버그를 발견하면 **§0 사건 기록 테이블** 에 1줄 추가 + 관련 원칙 섹션 보강
- 새 사이트를 추가하면 **§A 사이트 정체성 상수표** 에 열 추가
- 분기 1회 `grep -rn "snippetVersion" footer/` 전수조사 → stale 버전 제거
- 이 파일은 **짧고 안정적으로** 유지. 500줄 넘으면 분리 검토.
