# 더클린커피 Meta 통합 작업 현황 · 2026-04-13

작성: 실리콘밸리 CSO/CMO 관점의 실행 백로그
선행 문서: `coffee/metacoffee.md` (0411 토큰 만료 기록)
근거 데이터: `backend/.env` 160~161행 `COFFEE_META_TOKEN` + `COFFEE_META_SYSTEM_USERID=61570785020842` 신규 추가

---

## 0. 오늘 이 세션에서 즉시 완료한 것 ✅

사용자가 `.env`에 시스템 유저 토큰을 넣기만 한 상태였고, 실제로 코드가 이 토큰을 **사용**하도록 연결돼 있지 않았소. 다음 작업을 완료했소.

### 0.1 env 스키마 확장
- `backend/src/env.ts`:
  - raw 로딩에 `COFFEE_META_TOKEN`, `COFFEE_META_SYSTEM_USERID` 추가
  - Zod 스키마에도 두 키 optional로 등록
- **이유**: 기존 `process.env.COFFEE_META_TOKEN`을 직접 참조하면 env 검증이 타지 않아 오타·누락이 런타임에 터짐. 스키마 통과 지점에 등록해야 개발 시점에 잡힘.

### 0.2 커피 계정 토큰 선택 로직 업데이트 (fallback chain)
- `backend/src/routes/ads.ts` `getMetaToken()`:
  ```
  COFFEE_META_TOKEN  →  META_ADMANAGER_API_KEY_COFFEE  →  META_ADMANAGER_API_KEY
  (시스템 유저 토큰)    (앱 토큰, 60일 만료)            (글로벌 메인, 60일 만료)
  ```
- `backend/src/routes/meta.ts` `getToken()`: 동일한 fallback chain 적용
- **이유**: 시스템 유저 토큰(비만료)을 최우선으로 쓰되, 없으면 기존 토큰으로 자동 폴백. 무중단 전환 + 롤백 가능성 확보.

### 0.3 `/api/meta/status` 응답 스키마 확장
- 기존: `{ coffee: { configured, tokenLength } }`
- 신규:
  ```json
  {
    "coffee": {
      "configured": true,
      "activeTokenKind": "system_user | app | fallback_global",
      "systemUser": { "configured": true, "tokenLength": 234, "userId": "61570785020842" },
      "appToken": { "configured": true, "tokenLength": 292 }
    }
  }
  ```
- **이유**: 프런트가 "지금 어떤 토큰이 활성인가"를 표시할 수 있어야 운영 중 추적 가능. 지금까지는 "뭔가 설정돼 있다"만 알 수 있었소.

### 0.4 `/ads` 페이지에 토큰 종류 뱃지 추가
- `frontend/src/app/ads/page.tsx`:
  - mount 시 `/api/meta/status` fetch
  - 더클린커피 사이트 선택 시 "선택된 사이트 상세" 헤더 옆에 뱃지 표시:
    - 🟢 **시스템 유저 토큰 사용 중 (비만료)** — 정상
    - 🟡 **앱 토큰 사용 중 (만료 가능)** — 주의
    - 🔴 **글로벌 fallback 토큰 사용 (커피 전용 토큰 없음)** — 경고
  - tooltip에 System User ID 노출
- **이유**: 운영자가 대시보드 열었을 때 **토큰 상태를 한눈에** 봐야 하오. 0411 사태처럼 만료 후 API 호출이 전부 깨지고 나서야 알게 되는 상황을 반복하면 안 됨.

### 0.5 검증
```
$ curl -s http://localhost:7020/api/meta/status | jq .coffee.activeTokenKind
"system_user"

$ curl -s "http://localhost:7020/api/meta/insights?account_id=act_654671961007474&date_preset=last_7d" | head -c 200
{"ok":true,"account_id":"act_654671961007474","date_preset":"last_7d",...}
```
- tsc: backend/frontend 양쪽 통과
- 실제 Meta Graph API 호출이 **시스템 유저 토큰으로** 정상 동작함

---

## 1. 지금 즉시 작업해야 할 것 (P0, 이번 세션 내 권고)

### 1.1 CAPI 전송도 커피 전용 토큰으로 분기 🔥 ✅ **2026-04-14 완료**

**문제**: `backend/src/metaCapi.ts:1387` `sendMetaConversion()` 은 **모든 픽셀의 CAPI 이벤트를 글로벌 `META_ADMANAGER_API_KEY` 하나로 전송** 중이오. 더클린커피 픽셀(1186437633687388)도 같은 토큰. 즉 메인 토큰이 만료되면 **모든 사이트의 CAPI가 동시에 중단**되오.

기존 `metacoffee.md` 0411 기록상 메인 `META_ADMANAGER_API_KEY` 만료일은 **2026-06-02**. 지금으로부터 약 50일 후. 그날 밤 전까지 CAPI 이벤트 전송은 유지되지만, 만료 직후 인사이트+CAPI 동시 다운됨.

**해야 할 것**:
```typescript
// metaCapi.ts sendMetaConversion 내부
const tokenForPixel = (pixelId: string): string => {
  if (pixelId === env.META_PIXEL_ID_COFFEE) {
    return (env.COFFEE_META_TOKEN ?? env.META_ADMANAGER_API_KEY_COFFEE ?? env.META_ADMANAGER_API_KEY ?? "").trim();
  }
  return env.META_ADMANAGER_API_KEY?.trim() ?? "";
};
const token = tokenForPixel(prepared.pixelId);
if (!token) throw new Error(`Meta token 미설정 for pixel ${prepared.pixelId}`);
```

**왜**:
1. **블라스트 라디우스 격리**: 한 토큰 장애가 모든 사이트로 퍼지지 않도록
2. **시스템 유저 토큰은 비만료**라 커피 CAPI는 사실상 영구 가동 가능
3. **권한 최소화 원칙**: 커피 픽셀 이벤트는 커피 토큰으로만. 주체가 틀리면 Meta가 이상 징후로 scoring할 여지도 줄임

**리스크**: 시스템 유저가 **커피 픽셀 대한 쓰기 권한**을 실제로 가지고 있어야 함. 1.2에서 검증.

**적용 결과 (2026-04-14)**:
- `backend/src/metaCapi.ts` 에 `resolveCapiToken(pixelId)` 헬퍼 추가. 커피 픽셀(`META_PIXEL_ID_COFFEE`)일 때만 `COFFEE_META_TOKEN → META_ADMANAGER_API_KEY_COFFEE → META_ADMANAGER_API_KEY` 순으로 폴백. 그 외 픽셀은 글로벌 토큰 그대로 사용.
- 실전 검증: `POST /api/meta/capi/send` 로 커피 픽셀에 Purchase 이벤트 전송 → Meta 응답 `events_received: 1`, `status: 200`, CAPI 로그에 기록 확인.
- `test_event_code: TEST_COFFEE_0414_BRANCH` 를 써서 production 픽셀 오염 없이 검증 완료.
- **로그 스키마에 `token_kind` 추가는 유보**: 스키마 변경 시 readMetaCapiSendLogs·diagnostics 파서까지 건드려야 해서 scope creep. P1로 넘김.

---

### 1.2 시스템 유저의 실제 권한 범위 검증 🔥 ✅ **2026-04-14 완료**

**문제**: 시스템 유저 토큰이 있다고 해서 **커피 광고 계정·픽셀에 접근 가능한지는 별개 문제**. Meta BM(Business Manager)에서 시스템 유저에 asset 권한을 명시 할당해야 함.

**즉시 실행할 검증 명령**:
```bash
# (a) 시스템 유저가 볼 수 있는 광고 계정 목록 — 커피 계정 포함 여부
curl -s "https://graph.facebook.com/v20.0/me/adaccounts?fields=id,name,account_status&access_token=${COFFEE_META_TOKEN}" | jq '.data[] | select(.id=="act_654671961007474")'

# (b) 커피 계정 직접 조회 가능 여부
curl -s "https://graph.facebook.com/v20.0/act_654671961007474?fields=id,name,currency&access_token=${COFFEE_META_TOKEN}"

# (c) 커피 픽셀 접근 가능 여부 — CAPI 쓰기 권한의 전제 조건
curl -s "https://graph.facebook.com/v20.0/1186437633687388?fields=id,name,code&access_token=${COFFEE_META_TOKEN}"

# (d) 토큰 자체 검증 (debug_token 엔드포인트)
curl -s "https://graph.facebook.com/v20.0/debug_token?input_token=${COFFEE_META_TOKEN}&access_token=${COFFEE_META_TOKEN}" | jq '.data | {type, app_id, user_id, expires_at, scopes, granular_scopes}'
```

**세 가지 가능한 결과**:
- ✅ 전부 성공 → CAPI 분기(1.1) 즉시 안전하게 적용 가능
- ⚠️ (a)(b) 성공, (c) 실패 → **픽셀 권한이 없어서** CAPI는 아직 시스템 유저로 못 쏨. BM에서 Pixel → Assigned Partners에 시스템 유저 추가 필요
- ❌ (a)(b) 실패 → 시스템 유저에 Ad Account asset 권한이 없음. BM → Business Settings → System Users → Assigned Assets에서 `act_654671961007474` 추가 필요

**왜 지금 해야 하나**: 1.1 작업의 **사전 조건**이오. 권한 없이 분기만 먼저 바꾸면 커피 CAPI가 통째로 실패하오.

**실제 검증 결과 (2026-04-14)**:
| 검증 항목 | 결과 | 비고 |
|---|---|---|
| `/61570785020842` (시스템 유저 조회) | ✅ `{id, name: "SEO"}` | 토큰 유효 |
| `/act_654671961007474` 직접 조회 | ✅ `name: "더클린커피", currency: KRW` | 광고 계정 읽기 권한 OK |
| `/1186437633687388` 커피 픽셀 직접 조회 | ✅ `name: "더클린커피 자사몰", last_fired_time: 2026-04-12T23:52:48+0000` | 픽셀 읽기 권한 OK, 활성 픽셀 |
| `POST /1186437633687388/events` 테스트 이벤트 | ✅ `events_received: 1` | **CAPI 쓰기 권한 OK** |
| `/61570785020842/assigned_ad_accounts` edge | ❌ error 100/33 | edge 제한, 개별 계정 조회(c)로 우회 |
| `debug_token` (앱 토큰으로) | ❌ 앱 토큰 0409 만료 상태라 debug 호출 실패 | 시스템 유저 토큰 자체는 정상 |

**핵심 확인**: 읽기 3건 + **쓰기 1건**(test_event_code 경유) 모두 성공. 시스템 유저 "SEO"가 커피 BM에서 광고계정+픽셀 asset 모두 할당돼 있음이 증명됨. 1.1 분기를 안전하게 적용할 수 있는 전제 충족.

---

### 1.3 토큰 health probe endpoint 신설

**문제**: 현재 `/api/meta/status`는 "env에 토큰이 있나 / 길이가 얼마인가"만 본다. **실제로 Meta API가 받아주는지**는 확인하지 않음. 0411 사태도 "값은 있는데 revoke된" 상태였음.

**해야 할 것**:
```typescript
// backend/src/routes/meta.ts 에 추가
router.get("/api/meta/health", async (_req, res) => {
  const check = async (label: string, token: string) => {
    if (!token) return { label, ok: false, reason: "missing" };
    try {
      const url = new URL(`${META_GRAPH_URL}/debug_token`);
      url.searchParams.set("input_token", token);
      url.searchParams.set("access_token", token);
      const r = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
      const body = await r.json();
      const data = body?.data;
      return {
        label,
        ok: !!data?.is_valid,
        expires_at: data?.expires_at ?? null,
        type: data?.type ?? null,
        app_id: data?.app_id ?? null,
        user_id: data?.user_id ?? null,
        error: data?.error?.message ?? null,
      };
    } catch (e: any) {
      return { label, ok: false, error: e?.message ?? String(e) };
    }
  };
  const coffeeSysUser = env.COFFEE_META_TOKEN ?? "";
  const coffeeApp = env.META_ADMANAGER_API_KEY_COFFEE ?? "";
  const main = env.META_ADMANAGER_API_KEY ?? "";
  const checks = await Promise.all([
    check("main", main),
    check("coffee_system_user", coffeeSysUser),
    check("coffee_app", coffeeApp),
  ]);
  res.json({ ok: true, checks });
});
```

**프런트 연결**: `/ads` 상단에 "토큰 건강성: main ✅ · 커피(system) ✅ · 커피(app) ⚠️ 2일 뒤 만료" 같은 라인을 하나 더 표시.

**왜**:
1. 만료 **7일 전에 알림** 받을 수 있음 (현재는 만료된 뒤에야 API 호출 실패로 감지)
2. revoke 상황도 잡음 — `is_valid: false` 로 구분됨
3. 리뷰/평가가 아니라 **운영 KPI**. 매 세션 열 때마다 1초 확인하면 끝

---

## 2. 이번 주 내 (P1)

### 2.1 `metacoffee.md` 문서 업데이트

**무엇**: 0411 만료 기록 위에 0413 복구 완료 섹션 추가.
- 새 시스템 유저 토큰 도입 완료
- activeTokenKind 확인 경로
- 1.1~1.3 체크리스트 결과 기록

**왜**: 다음 세션에서 다른 에이전트·사람이 온보딩할 때 "지금 상태가 뭐냐"를 1분에 파악해야 하오. 미래의 나 자신이 6월 2일 글로벌 토큰 만료 직전에 이 문서를 보고 판단할 것임.

### 2.2 `COFFEE_ACCOUNT_IDS` 를 env 외화

**현재**:
```typescript
// routes/meta.ts:77
const COFFEE_ACCOUNT_IDS = new Set(["act_654671961007474"]);
```
**문제**: 하드코딩. 향후 커피 서브 브랜드·대체 계정 추가 시 코드 수정 필요.

**제안**: `COFFEE_META_AD_ACCOUNT_IDS=act_654671961007474,act_xxxxx` 형태로 env로 빼고, 두 라우트(`ads.ts`, `meta.ts`)가 공유하는 helper(`backend/src/lib/metaAccounts.ts`)로 통합.

**왜**: 지금은 계정이 하나라 괜찮지만, A/B 광고 계정 분리나 해외 계정 추가 시 곧바로 걸리는 지점. 작업 비용 낮고 재사용성 높음.

### 2.3 biocom도 전용 시스템 유저 토큰으로 전환 검토

**관찰**: bioom은 아직 글로벌 `META_ADMANAGER_API_KEY`를 쓰고 있고, 이게 2026-06-02 만료. 커피 토큰과 같은 구조로 `BIOCOM_META_TOKEN` + `BIOCOM_META_SYSTEM_USERID` 발급하면 블라스트 라디우스를 사이트별로 완전히 격리 가능.

**왜**: 지금 안 하면 6월 2일에 biocom 광고 대시보드·CAPI·ROAS가 동시에 멈추는 날이 또 옴. 2개월 전 미리 발급해 테스트해야 당일 사고 없이 스왑 가능.

**블로커**: Meta BM에서 biocom 비즈니스 계정에 시스템 유저를 만들고 asset 할당하는 작업은 **사람이 해야 함**. 개발 작업이 아니라 설정 작업.

### 2.4 기존 `META_ADMANAGER_API_KEY_COFFEE` 처리 정책 결정

**옵션 A — 즉시 제거**: env에서 삭제, fallback chain 단순화
- 장점: 혼선 제거, 만료된 토큰 우연히 부활하는 리스크 제거
- 단점: 시스템 유저 토큰이 revoke되면 즉시 마비. 롤백 버퍼 없음

**옵션 B — 당분간 유지(권장)**: fallback chain 그대로 두기
- 장점: 시스템 유저 토큰 문제 시 앱 토큰으로 자동 회귀
- 단점: 앱 토큰 자체가 이미 만료된 상태일 가능성이 높음. health probe(1.3)에서 실시간 검증 필요

**결정 기준**: 1.3 health probe 결과에서 `coffee_app` 토큰이 valid로 나오면 옵션 B, 이미 expired면 옵션 A로 가서 라인 제거하고 대신 새 앱 토큰 발급받아 3단 fallback을 유지하는 게 안전.

### 2.5 토큰 로테이션 Runbook 작성

**무엇**: `coffee/runbooks/meta-token-rotation.md` 같은 운영 문서. "토큰 만료 7일 전 알림 → 신규 토큰 발급 절차 → env 교체 → 검증 체크리스트 → 롤백 경로" 단계별 기록.

**왜**: 이번처럼 사람 의존(사용자가 env 라인 직접 추가)으로 가면 **또 만료 직전까지 미뤄짐**. Runbook화해서 알림 한 번으로 흐름이 시작되게.

---

## 3. 이번 달 내 (P2)

### 3.1 커피 전용 ROAS 대시보드 심화

현재 `/ads` 페이지는 3사이트 공통 구조. 커피만의 특화 섹션이 필요하오:
- **SKU × 광고 세트 ROAS**: 콜롬비아 광고가 실제 콜롬비아 구매를 얼마 끌었는지 (지금은 계정 단위 집계만)
- **신규 vs 재구매 분리**: CAPI 이벤트의 content_ids 가 신규 구매인지 재구매인지 태깅
- **AOV 리프트 A/B**: `coffeeprice0413.md` 의 Day 0~14 과업과 연결 — 번들·쿠폰 실험의 Meta 측 전환가치 추적

**왜**: 커피는 가격 인상 실험 진행 중이고, ROAS 해석을 세그먼트별로 못 쪼개면 실험 판정 못 함.

### 3.2 CAPI 드랍률 모니터링

**문제**: CAPI 이벤트가 실제로 Meta까지 도달하는 비율을 지금 추적하지 않음. `metaCapi.ts` 는 로그는 남기지만 성공률 지표 자동 계산이 없음.

**해야 할 것**:
- `/api/meta/capi/health?window=24h` 엔드포인트에 drop_rate, dedup_rate, avg_latency 계산 추가
- 24시간 drop_rate > 5% 면 Slack/알림톡 webhook
- 커피 픽셀 단독 필터 옵션

**왜**: Meta Ads Manager 의 Events Manager 에서 "event match quality" 가 떨어지면 **ROAS 측정 정확도가 먼저 망가짐**. 문제를 실측 광고비 낭비로 체감하기 전에 시스템에서 먼저 잡아야 함.

### 3.3 Conversions API Gateway(CAPIG) 도입 검토

**배경**: Meta가 공식 권장하는 CAPI 전용 서버. 현재는 `metaCapi.ts`가 직접 Graph API 호출 중. CAPIG 로 전환하면:
- 전용 재시도·큐잉·디둡
- Meta 공식 SLA 적용
- 토큰·서명 관리 표준화

**왜 검토만**: 도입 비용(호스팅·관리)이 있고, 현재 볼륨(커피 월 1,000건 수준)에서는 overkill 일 수 있음. 볼륨이 월 5,000건 넘어가면 재검토.

---

## 4. 위험 요소 · 알아둬야 할 것

### 4.1 시스템 유저 토큰이 "영구"는 아니오
- **비만료**이지만 **revoke 가능**: BM에서 시스템 유저 삭제, asset 권한 회수, 앱 삭제 등으로 무효화됨
- 관리자 실수 한 번에 전사 광고 API 다운
- **대응**: health probe(1.3) + 알림 + 옵션 B fallback 체인 유지

### 4.2 토큰 노출 리스크
- 시스템 유저 토큰은 비만료라 **유출 시 피해 기간이 무한대**
- **대응**: 
  - `.env` 는 git ignore 확인 (이미 되어있을 것)
  - 로그에 절대 기록 금지 — `metaCapi.ts` 로그 함수에 `access_token` 파라미터 마스킹 검증 필요
  - 배포 시 secret manager(GCP Secret Manager 등)로 이전 검토

### 4.3 `COFFEE_META_SYSTEM_USERID=61570785020842` 의 용도
- 이 세션에서 **로드는 하지만 실제로 검증·로깅 외엔 쓰지 않음**
- `/me` 호출 결과와 비교해 "우리가 예상한 시스템 유저가 맞는지" sanity check 하는 용도
- 1.3 health probe 에서 `debug_token` 응답의 `user_id` 와 이 값 비교 → 불일치면 경고

### 4.4 토큰 종류 간 API 차이
- **시스템 유저 토큰**: `/me/adaccounts` 는 시스템 유저에게 할당된 것만 반환 (일부 계정 안 보일 수 있음)
- **사용자 토큰**: 개인이 접근 가능한 모든 계정 반환
- 기존 코드 일부가 "사용자 토큰 가정" 으로 작성됐을 수 있으므로, 전환 후 한 번씩 endpoint를 돌려봐야 함

---

## 5. 다음 액션 (우선순위 · 상세)

각 액션은 **왜 / 무엇을 / 어떻게** 세 축으로 기술했소. 우선순위는 "2026-06-02 글로벌 토큰 만료" 를 기준점 삼아, 만료 전 반드시 끝나야 할 것을 앞에 배치했소.

---

### 🟢 지금 바로 (완료)
1. [x] **1.2 권한 검증 curl 4건** — 2026-04-14 완료
2. [x] **1.1 CAPI 토큰 분기 코드 적용** — 2026-04-14 완료
3. [x] **tsc 통과 + 실전 CAPI 전송 검증** — 2026-04-14 완료 (`events_received: 1`)
4. [x] **1.3 `/api/meta/health` endpoint 신설** — 2026-04-14 완료 (3토큰 병렬 debug_token, self→others fallback resolver, alert_level 계산)

---

### 🚨 2026-04-14 health probe 에서 드러난 중요한 발견

health endpoint 가 드러낸 세 가지 사실. 이 중 두 가지는 **기존 문서와 충돌**이오.

#### (1) 커피 "시스템 유저 토큰" 도 60일 만료다
- `type: SYSTEM_USER` 는 맞지만 `expires_at: 1781239816` → **2026-06-12 만료**
- 메타 BM 에서 토큰 발급 시 "Never" 옵션이 아닌 기본 "60 days" 를 선택한 상태
- 기존 가정("시스템 유저 토큰 = 비만료") 은 틀렸고, 3단 fallback 설계의 안전 버퍼가 예상보다 짧소
- **해야 할 것**: BM 에서 동일 시스템 유저로 **Never-expiring** 토큰 재발급. 재발급 시 기존 토큰도 잠시 유효하므로 무중단 교체 가능

#### (2) `COFFEE_META_SYSTEM_USERID=61570785020842` 와 실제 토큰 user_id 불일치
- debug_token 응답의 `user_id` = **122095281926692834** (이게 진짜 시스템 유저 ID)
- env 에 넣은 `61570785020842` 는 이전 curl 에서 `{id, name: "SEO"}` 반환했던 값 — 아마 **Business Manager ID** 또는 다른 SEO 엔티티
- 현재 health endpoint 가 `mismatch` 경고 정확히 포착 중
- **해야 할 것**: env 값의 의도 확인. 두 가지 옵션:
  - (a) `COFFEE_META_SYSTEM_USERID=122095281926692834` 로 교체 (실제 SU ID)
  - (b) `COFFEE_META_BM_ID=61570785020842` + `COFFEE_META_SYSTEM_USERID=122095281926692834` 분리
- 어느 쪽을 선택하든 코드의 mismatch 체크는 실제 SU ID 기준으로 돌아야 함

#### (3) 글로벌 main 토큰 만료일이 기존 기록 (2026-06-02) 과 다름
- 실측: `expires_at: 1781094837` → **2026-06-09** (기존 기록 대비 +7일)
- 원 기록(0411 metacoffee.md) 이 근사치였거나, 그 사이 토큰이 **자동 확장/재발급**됨
- main 토큰은 `type: USER`, user_id `1509979824181418`, 앱 `agentmarketing(1019654940324559)`, scopes 에 `email`, `pages_show_list` 포함 → 개인 계정 장기 토큰
- **영향**: 2.3 biocom 데드라인(2026-05-25) 을 **2026-06-01** 로 완화 가능. 하지만 여유는 여전히 작음
- **해야 할 것**: health probe 결과를 권위 있는 값으로 취급. 문서 기록은 참고만

---

---

### 🔶 오늘 내 (P0)

#### 4. 토큰 health probe endpoint 신설 (`/api/meta/health`) ✅ **2026-04-14 완료**

**왜 해야 하나**
- 지금 `/api/meta/status` 는 "env에 토큰이 존재하는가 / 길이가 얼마인가" 만 확인하오. **실제로 Meta가 그 토큰을 받아주는지**는 검증하지 않소.
- 2026-04-09 에 커피 앱 토큰이 만료됐는데, 만료 전까지 아무 경고도 없었고 **첫 API 호출 실패로 깨달았소**. 시스템 유저 토큰도 revoke 되면 같은 상황이 반복되오.
- 시스템 유저 토큰의 특성상 **비만료이지만 revocation 가능**. "만료일이 없으니 안전하다"는 **틀린 가정**이고, 권한 회수·BM 변경·앱 삭제는 **언제든** 발생 가능한 이벤트요.
- 실리콘밸리 SRE 관점: **"Observability-first"**. 관측할 수 없는 시스템은 이미 장애 상태에 있소 — 우리만 모를 뿐.

**무엇을**
- `GET /api/meta/health` 엔드포인트. 3개 토큰(main / coffee_system_user / coffee_app) 각각에 대해 Meta `debug_token` 호출을 병렬 수행하고, 다음 필드를 반환:
  ```json
  {
    "ok": true,
    "checks": [
      {
        "label": "main",
        "ok": true,
        "is_valid": true,
        "type": "USER",
        "app_id": "1019654940324559",
        "user_id": "1509979824181418",
        "expires_at": 1780000000,
        "expires_in_days": 51,
        "scopes": ["ads_management", "ads_read", ...],
        "error": null
      },
      { "label": "coffee_system_user", "ok": true, "type": "SYSTEM_USER", "expires_at": 0, "user_id": "61570785020842", ... },
      { "label": "coffee_app", "ok": false, "is_valid": false, "error": "Session has expired on 2026-04-09" }
    ]
  }
  ```
- `expires_in_days < 7` 이면 warning 플래그, `< 0` 또는 `is_valid: false` 면 critical 플래그.

**어떻게** (구체 구현 절차)
1. `backend/src/routes/meta.ts` 에 router.get("/api/meta/health") 추가
2. 내부 헬퍼 `probeToken(label, token)` 로 각 토큰을 Meta `debug_token` 에 보내고 8초 타임아웃
3. `Promise.all` 로 3개 병렬 호출
4. 응답 병합 후 `expires_in_days` 계산 (시스템 유저 토큰은 `expires_at: 0` → "never")
5. 시스템 유저 토큰의 경우 `COFFEE_META_SYSTEM_USERID` 와 `data.user_id` 비교해 불일치하면 `mismatch: true` 플래그
6. 응답 시간 상한 10초 — 초과 시 unknown 으로 마크
7. **주의**: debug_token 호출 자체는 access_token 이 필요한데, 만료된 토큰은 자기 자신으로 debug 못 함. **유효한 다른 토큰 하나**(예: main 이나 시스템 유저)를 리졸버로 써야 함. 구체적으로: 시스템 유저 토큰으로 다른 두 토큰을 디버그.
8. 단위 동작 테스트: `curl http://localhost:7020/api/meta/health | jq` 로 세 토큰 상태가 구분돼 나오는지 확인

**예상 소요**: 40분 (코드 25분 + 테스트 15분)

**성공 기준**
- `coffee_system_user.is_valid === true`
- `main.expires_in_days` 가 실제 만료일과 일치 (~50일)
- `coffee_app.error` 에 만료 메시지 반환 (기존 만료 상태 재현)

**실측 결과 (2026-04-14)**:
```json
{
  "alert_level": "critical",
  "checks": [
    { "label": "main", "is_valid": true, "type": "USER", "expires_in_days": 57, "user_id": "1509979824181418", "app_id": "1019654940324559" },
    { "label": "coffee_system_user", "is_valid": true, "type": "SYSTEM_USER", "expires_in_days": 59, "user_id": "122095281926692834", "app_id": "1576810273379275", "mismatch": { "expectedUserId": "61570785020842", "actualUserId": "122095281926692834" } },
    { "label": "coffee_app", "is_valid": false, "type": "USER", "expires_in_days": -4, "error": "Session has expired on 2026-04-09" }
  ],
  "warnings": [
    "coffee_system_user: userId mismatch (...)",
    "coffee_app: invalid (...)"
  ]
}
```
- **Resolver 전략**: 자기 자신 우선 → coffee_system_user → main → coffee_app 순 fallback. 첫 번째 "App_id match" 응답 채택.
- **중요한 발견 3건**: 위 "2026-04-14 health probe 에서 드러난 중요한 발견" 섹션 참조
- `critical` 알림 level 은 두 건의 warning(mismatch + expired) 때문. Meta 토큰 라우팅 자체는 정상 동작 중이며 커피 CAPI 는 `coffee_system_user` 로 잘 나가고 있음.

---

#### 5. `/ads` 페이지에 Meta health 라인 추가

**왜 해야 하나**
- 4번 endpoint 가 있어도 **운영자가 매일 열어보지 않으면 의미가 없소**. UI에 노출돼야 사고 전에 눈에 들어오오.
- 0411 만료 사태가 반복되면 "토큰 상태는 서버에 있었는데 봤어야 했네"가 됨. **대시보드가 기본으로 보여주는 위치**에 둬야 하오.
- Google SRE 표현으로 "Dashboards are the OODA loop of operations" — 관찰 → 판단 → 결정 → 행동 루프의 시작점. 가장 위에 있어야 함.

**무엇을**
- `/ads` 페이지 맨 위 헤더 영역에 **Meta 토큰 건강 라인** 1줄 추가:
  ```
  Meta 토큰: main ✅ 51일 남음  ·  커피(system) ✅ 비만료  ·  커피(app) ⚠️ 만료됨
  ```
- 항목 색상: 녹(정상, >14일), 황(경고, 7~14일), 적(7일 미만 또는 invalid)
- 라인 클릭 시 expandable 영역으로 펼쳐서 상세(user_id, scopes, 마지막 점검 시각) 표시
- `expires_in_days <= 7` 이면 라인 전체를 노란 배경으로 부각

**어떻게**
1. `frontend/src/app/ads/page.tsx` 상단 영역, 기존 "3사이트 오버뷰" 위에 배치
2. `useState<MetaHealth | null>(null)` + mount 시 1회 fetch + **5분 간격 refetch**
3. 각 토큰 블록은 inline-flex 배지 형태. tooltip 에 user_id / scopes / error 메시지
4. 렌더 조건: `metaHealth.checks.some(c => !c.ok || c.expires_in_days < 30)` 이면 라인을 상시 노출, 전부 정상이면 축약 표시 (`Meta 토큰 정상 ✓`)

**예상 소요**: 30분

**성공 기준**
- 페이지 열자마자 토큰 상태가 보임
- 일부러 `COFFEE_META_TOKEN` 을 빈 문자열로 바꾸면 "fallback 사용" 경고 표시
- 의도적으로 `COFFEE_META_TOKEN` 값 조작 시 `is_valid: false` → 적색 배지

---

#### 6. `metacoffee.md` 0411 문서에 0414 복구 섹션 추가

**왜 해야 하나**
- 기존 `coffee/metacoffee.md` 는 0411 만료 발생 기록만 있고 **후속 조치 기록이 없소**. 이대로 두면 미래의 자신(또는 다른 에이전트)이 "어떻게 해결됐는지" 몰라서 같은 조사 반복.
- Post-mortem 문서는 **장애가 끝난 직후가 가장 좋은 작성 시점**. 시간이 지나면 세부사항이 흐려지오.
- 실리콘밸리 SRE 표준: 모든 incident 는 "What happened / Why / How we fixed it / How to prevent" 4섹션으로 기록.

**무엇을**
- `coffee/metacoffee.md` 에 `## 0414 복구 완료` 섹션 추가:
  1. **원인 요약**: 장기 사용자 토큰 60일 만료
  2. **해결**: 시스템 유저 토큰(`COFFEE_META_TOKEN`) 도입, backend 3-tier fallback, CAPI 분기
  3. **검증 결과**: 권한 4건 curl 결과표 + CAPI 전송 성공 로그
  4. **재발 방지**: 4번 health probe + 5번 UI 라인 + Runbook (8번)
  5. **남은 리스크**: 글로벌 토큰 2026-06-02 만료, biocom 미전환 상태

**어떻게**
1. 기존 `metacoffee.md` 를 읽고 0411 기록 하단에 새 섹션 append
2. `metacoffee0413.md` (본 파일) 에 있는 1.1 / 1.2 / 0.x 결과를 인용 링크
3. 문서 최상단에 "**현재 상태**: 시스템 유저 토큰 운영 중 (2026-04-14~)" 한 줄 header 추가 — 다음에 열었을 때 1초 파악

**예상 소요**: 20분

**성공 기준**: 다음 세션에서 `metacoffee.md` 한 번만 읽어도 현재 상태를 재구축 없이 파악 가능

---

### 🟡 이번 주 (P1)

#### 7. `COFFEE_ACCOUNT_IDS` 를 env 외화

**왜 해야 하나**
- 현재 `backend/src/routes/meta.ts:77` 에 `const COFFEE_ACCOUNT_IDS = new Set(["act_654671961007474"])` 로 **하드코딩**. 그리고 `backend/src/routes/ads.ts:342` 에도 `accountId === "act_654671961007474"` 매직 스트링 중복.
- 커피 서브 브랜드·해외 진출·A/B 광고계정 분할 등 **계정 추가 시 두 파일을 동시에 수정**해야 함. 한쪽만 고치면 토큰이 틀리게 라우팅돼 장애. 가장 전형적인 "two-places-to-update" 버그 패턴.
- Magic string 제거는 실리콘밸리 코드 리뷰에서 자동 지적 사항. Config 는 한 곳에 모아야 함 (DRY + Single Source of Truth).

**무엇을**
- env 신규 키: `COFFEE_META_AD_ACCOUNT_IDS=act_654671961007474` (쉼표 구분 다중값 허용)
- 신규 헬퍼 파일: `backend/src/lib/metaAccounts.ts`
  ```typescript
  export const COFFEE_AD_ACCOUNT_IDS: ReadonlySet<string> = new Set(
    (env.COFFEE_META_AD_ACCOUNT_IDS ?? "act_654671961007474")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean),
  );
  export const isCoffeeAdAccount = (accountId?: string | null): boolean =>
    !!accountId && COFFEE_AD_ACCOUNT_IDS.has(accountId);
  ```
- `routes/ads.ts`, `routes/meta.ts` 양쪽에서 import 해 사용
- `metaCapi.ts` 의 `resolveCapiToken` 은 픽셀 기준이라 여기 영향 없음 (다만 주석에 "참고: 계정 리졸버는 metaAccounts.ts" 남기기)

**어떻게**
1. env.ts raw 로딩 + Zod 스키마에 `COFFEE_META_AD_ACCOUNT_IDS: z.string().optional()` 추가
2. 신규 파일 `backend/src/lib/metaAccounts.ts` 생성
3. `ads.ts` `getMetaToken`, `meta.ts` `getToken` 의 하드코딩 제거, `isCoffeeAdAccount()` 호출로 대체
4. `meta.ts` 의 기존 `COFFEE_ACCOUNT_IDS` 상수 제거
5. tsc 통과 확인
6. `curl /api/meta/insights?account_id=act_654671961007474` 재실행해 동작 동일성 확인

**예상 소요**: 45분 (코드 30분 + 테스트 15분)

**성공 기준**
- 계정 ID 가 **코드 어디에도 하드코딩 없음** (grep `act_654671961007474` 로 소스 전체 스캔)
- env 로 하나 더 추가 시 양쪽 라우트 모두 자동 적용
- 기존 API 호출 결과 바이트 단위로 동일

---

#### 8. 토큰 로테이션 Runbook 작성 (`coffee/runbooks/meta-token-rotation.md`)

**왜 해야 하나**
- 이번에 사용자가 env 두 줄 직접 추가한 방식은 **사람 기억에 의존**. 다음에 또 다른 토큰이 만료될 때 "뭐였더라" 단계에서 30분 낭비.
- 실리콘밸리 Gold standard: **"If it's not in a Runbook, it doesn't exist."** 복잡한 운영 지식은 문서화돼 있지 않으면 한 번만 쓸 수 있음 (작성자만). 문서화되면 팀 자산.
- 장애 한가운데서 즉석 판단하는 것보다, **사전에 작성된 절차**를 따르는 것이 훨씬 안전. 장애 스트레스 상황에서 사람은 빠뜨리는 게 생김.

**무엇을**
- `coffee/runbooks/meta-token-rotation.md` 신규 파일. 다음 섹션 구성:
  1. **When to rotate**: 만료 7일 전 알림 / revoke 감지 시 / 정책상 90일 주기
  2. **Prerequisites**: BM 관리자 권한, 시스템 유저 존재 확인, asset 할당 확인
  3. **Step-by-step**: 
     - Step A: BM에서 새 시스템 유저 토큰 발급 절차 (화면 캡처 경로)
     - Step B: 로컬 `.env` 값 교체
     - Step C: backend 재시작 없이 tsx hot reload 확인
     - Step D: `curl /api/meta/health` 로 is_valid 확인
     - Step E: `curl /api/meta/capi/send` 로 test_event_code 전송
     - Step F: `/ads` 페이지에서 녹색 뱃지 확인
     - Step G: 기존 토큰 env 에서 제거 or 보존 (2.4 정책에 따라)
  4. **Rollback**: 실패 시 이전 토큰 복원 경로
  5. **Post-rotation checklist**: metacoffee.md 업데이트, 팀 공지
  6. **Troubleshooting**: 자주 발생하는 5가지 에러 코드 + 대응 (190 만료, 200 권한, 100/33 edge, 2500 /me, 10/10 spam)

**어떻게**
1. 이번 세션에서 실제 수행한 명령들을 순서대로 정리 (`grep '^COFFEE_META_TOKEN=' .env | cut -d= -f2-` 등)
2. 각 단계의 예상 출력 스냅샷 첨부 (성공/실패 구분용)
3. 화면이 필요한 BM 단계는 **텍스트 경로**로 기술: "Business Settings → Users → System Users → [선택] → Generate New Token → 앱: SEO → 권한: ads_management + ads_read + business_management"
4. 문서 최상단에 **"마지막 rotation: 2026-04-14, 다음 예정: 글로벌 토큰 2026-06-02 전"** 한 줄 상태 헤더

**예상 소요**: 1시간

**성공 기준**: 다른 사람이 이 Runbook 하나만 읽고 **30분 내에** 토큰을 교체할 수 있음

---

#### 9. 기존 커피 앱 토큰 (`META_ADMANAGER_API_KEY_COFFEE`) 처리 정책 결정

**왜 해야 하나**
- 기존 커피 앱 토큰은 2026-04-09 만료 상태로 env 에 아직 남아있소. fallback chain 의 2번째 슬롯을 차지하고 있지만 실제로 Meta 가 받아주지 않음.
- 이 토큰을 **제거할지, 새로 발급받아 유지할지** 결정해야 함. 결정이 없으면 다음 사고 때 fallback 이 작동 안 해서 놀람.
- **옵션 A (즉시 제거)**: env 에서 라인 삭제. fallback 은 system_user → global 2단으로 줄어듦. 단순하지만 system_user revoke 시 버퍼 없음.
- **옵션 B (새 앱 토큰 발급 + 유지)**: 3단 fallback 완성도 유지. 운영 복잡도 증가 (2개 토큰 모두 관리).
- **옵션 C (null 로 남기고 이름만 보존)**: fallback 이 global 로 직행. 옵션 A 와 사실상 동일.

**무엇을**
- 세 옵션의 trade-off 표를 만들어 사람 결정자(박현준) 에게 제출
- 권장안 포함: **옵션 B**, 이유는 "시스템 유저 토큰 revoke 대비 + 이미 fallback 인프라가 있어서 유지 비용 낮음"
- 결정 후 env 및 코드 업데이트

**어떻게**
1. trade-off 표 작성 (복잡도 · 안전성 · 관리비용)
2. 사람에게 "옵션 A/B/C 중 선택" 질문 (결정은 사람이)
3. 옵션 B 선택 시: Meta BM 에서 커피 앱 토큰 재발급 → `.env` 143행 교체 → health probe 로 is_valid 확인
4. 옵션 A/C 선택 시: env 143행 삭제 → fallback chain 2단으로 축소 → health probe 재확인
5. 결정 결과를 `metacoffee.md` 와 본 파일에 기록

**예상 소요**: 결정 5분 + 실행 15분

**성공 기준**: env fallback chain 의 모든 슬롯이 `is_valid: true` 상태거나, 의도적으로 null 상태 (계획됨)

---

#### 10. biocom 시스템 유저 토큰 발급 요청 (사람 작업)

**왜 해야 하나**
- biocom 과 aibio 는 여전히 **글로벌 `META_ADMANAGER_API_KEY` 하나**에 의존 중. 이 토큰 만료일은 **2026-06-02**.
- 그날 자정에 3개 사이트의 **광고 인사이트 + CAPI + 대시보드**가 **동시에** 멈추오. 블라스트 라디우스 최대.
- 이번 커피 작업을 biocom 에도 반복하면 되는데, **Meta BM 에서 사람이 해야 하는 설정 작업**(시스템 유저 생성 · asset 할당 · 토큰 발급)이 선행 조건. 개발로는 못 함.
- 2개월 전 (4/14) 에 요청하면 테스트·검증 시간이 충분. 6/1 에 요청하면 당일 사고.
- 실리콘밸리 원칙: **"Big bang deployments are fragile"**. 세 사이트를 같은 날 교체하면 한 번에 문제를 발견하는 구조 → biocom 은 지금부터 준비해야 여유 있게 분리 교체 가능.

**무엇을**
- 박현준(또는 Meta BM 관리자)에게 **작업 요청 티켓** 작성:
  - 요청 1: biocom Business Manager 에서 시스템 유저 `SEO-BIOCOM` 생성
  - 요청 2: 시스템 유저에 광고 계정 `act_3138805896402376` + 픽셀 `1283400029487161` asset 할당, 권한 `ads_management` + `ads_read` + `business_management`
  - 요청 3: 토큰 발급 후 `.env` 로 전달 (Slack DM 또는 1Password)
  - (선택) 요청 4: aibio 동일 작업
- 받으면 `BIOCOM_META_TOKEN` / `BIOCOM_META_SYSTEM_USERID` env 로 추가
- 이후 8번 Runbook 을 따라 같은 패턴으로 backend 분기 + frontend 뱃지 적용

**어떻게**
1. Runbook 문서(8번)에 "biocom 시스템 유저 발급 체크리스트" 섹션 복제
2. 박현준에게 DM 초안 작성: "더클린커피는 4/14 시스템 유저 전환 완료. biocom 은 6/2 글로벌 토큰 만료 전 동일하게 전환 필요. BM 에서 시스템 유저 발급 부탁드립니다. 필요한 권한과 asset 목록은 [Runbook 링크]."
3. 응답 대기 중 본 문서에 "waiting on human action" 상태 표시
4. 토큰 수령 후 `backend/src/env.ts` 에 `BIOCOM_META_TOKEN` 추가, `getMetaToken/getToken` 에 biocom 분기 추가, `resolveCapiToken` 에 biocom 픽셀 분기 추가
5. tsc + CAPI test_event 검증 + frontend 뱃지 확장 (biocom 선택 시 동일한 토큰 종류 표시)

**예상 소요**: 사람 대기 1~5일, 작업은 수령 후 1시간

**성공 기준**: biocom 카드 선택 시 `/ads` 상단에 녹색 "시스템 유저 토큰 사용 중" 뱃지, `/api/meta/health` 응답에 `biocom_system_user: is_valid: true`

**데드라인**: **2026-05-25** (글로벌 토큰 만료 8일 전. 그 전까지 완료 안 되면 6/2 장애 확률 급상승)

---

### 🔷 이번 달 (P2)

#### 11. 커피 전용 ROAS SKU 분해 대시보드

**왜 해야 하나**
- 현재 `/ads` 페이지는 **계정 단위 집계**만 제공. "이번 달 커피 ROAS 2.3x" 까지는 알지만, **그 중 콜롬비아가 얼마, 케냐가 얼마** 를 분해하지 못함.
- `coffeeprice0413.md` 에서 가격 인상 실험 계획을 수립한 상태. 실험 판정을 위해선 **SKU × 채널 × 기간** 3차원 분해가 필수. 지금 데이터로는 판정 불가.
- "에티오피아부터 조정" 같은 권고도 에티오피아 광고의 실제 ROAS 를 모르면 공허. 의사결정 지원 도구로서 부재.
- 실리콘밸리 Growth 표준: **"Every dashboard should support at least one decision."** 현재 /ads 는 "지출 건강성"만 보여주고 "어떻게 최적화할지"는 안 보여줌.

**무엇을**
- `/ads` 페이지에 "커피 SKU 분해" 섹션 신설 (더클린커피 선택 시만 표시)
- 테이블: 원두별 행, 컬럼은 [광고 비용, 귀속 매출, ROAS, 주문수, AOV, 신규:재구매 비율]
- 필터: 기간(7/14/30/90일), 세그먼트(200g/500g/1kg)
- 차트: SKU × 기간 ROAS 라인 차트
- 기반 데이터:
  - Meta insights API `action_breakdowns=action_link_click_destination`, `fields=actions,action_values,purchase_roas`
  - Attribution ledger 의 `metadata.sku` 또는 `paymentKey → imweb order → product_name`
  - CAPI 이벤트의 `custom_data.content_ids` ↔ 내부 SKU 매핑 테이블

**어떻게**
1. **1단계 데이터 매핑**: Meta 광고 이름 또는 link URL 에 SKU 토큰이 박혀 있는지 조사. 없으면 광고 생성 측에서 UTM `utm_content=sku_콜롬비아_500g` 관례 수립
2. **2단계 backend API**: `GET /api/ads/coffee/roas-by-sku?date_preset=last_30d&grain=sku` 신설. 내부에서 Meta insights + attribution ledger 조인
3. **3단계 frontend 섹션**: recharts 로 테이블 + 라인 차트 렌더
4. **4단계 검증**: 특정 날짜의 직접 계산과 대시보드 값이 일치하는지 스프레드시트로 교차 검증

**예상 소요**: 2~3일 (UTM 관례 수립 + 매핑 검증 + UI 작업)

**성공 기준**
- 에티오피아 500g 광고의 지난 30일 ROAS 가 단독 숫자로 조회 가능
- `coffeeprice0413.md` 가격 A/B 실험 시 "에티오피아만 −5% CVR 하락" 같은 관측이 이 대시보드에서 직접 나옴

**리스크**: Meta insights 는 SKU 단위가 아닌 광고 단위. 광고 1개가 여러 SKU 를 다룬다면 분해 불가능. 선행 조건으로 광고 네이밍 컨벤션 합의 필수.

---

#### 12. CAPI 드랍률 모니터링 (`/api/meta/capi/health`)

**왜 해야 하나**
- 현재 CAPI 이벤트가 Meta 까지 도달하는 비율을 **추적하지 않음**. `metaCapi.ts` 는 200/non-200 로그만 남기고 성공률 지표는 자동 계산 안 됨.
- Meta Events Manager 의 "Event Match Quality" 점수가 떨어지면 **Meta 가 광고 최적화 효율을 자동으로 낮춤** → ROAS 가 아닌 실제 광고비 낭비로 직결.
- 사람이 Events Manager 를 매일 체크하지는 않음. **자동 알림** 이 없으면 1~2주 악화된 뒤에나 발견.
- 실리콘밸리 Observability 원칙: **"You can't improve what you don't measure."**

**무엇을**
- `GET /api/meta/capi/health?window=24h&pixel=coffee` 신설
- 응답 필드:
  ```json
  {
    "window_hours": 24,
    "pixel_id": "1186437633687388",
    "total_events": 1234,
    "success": { "count": 1220, "rate": 0.988 },
    "errors": { "count": 14, "rate": 0.012, "by_code": { "190": 2, "500": 10, "timeout": 2 } },
    "avg_latency_ms": 345,
    "p95_latency_ms": 890,
    "dedup": { "rate": 0.03, "potential_duplicates": 37 },
    "match_quality_proxy": {
      "email_provided": 0.72,
      "phone_provided": 0.45,
      "fbp_provided": 0.91,
      "fbc_provided": 0.34
    },
    "alert_level": "ok | warning | critical"
  }
  ```
- 알림 조건:
  - `errors.rate > 0.05` → warning
  - `errors.rate > 0.10` → critical + Slack/알림톡 webhook
  - `match_quality_proxy.email_provided < 0.5` → warning (개인정보 부족, Match Quality 하락 원인)

**어떻게**
1. `metaCapi.ts` 의 기존 CAPI 로그(`readMetaCapiSendLogs`) 를 재사용
2. `buildMetaCapiLogDiagnostics` 가 이미 일부 집계를 하고 있어서 확장 지점
3. 신규 함수 `computeCapiHealth(logs, windowHours, pixelFilter)` 작성
4. Cron 또는 백그라운드 잡으로 1시간마다 자동 실행 → threshold 넘으면 알림톡 발송 (aligo 헬퍼 재사용)
5. `/ads` 페이지에 "CAPI 24h 드랍률 1.2% / Match Quality 72%" 위젯 추가

**예상 소요**: 1.5일

**성공 기준**
- 실제로 장애 시뮬레이션 (`COFFEE_META_TOKEN` 잘못된 값으로 교체) → 5분 내 warning 상태로 전환 확인
- `match_quality_proxy.email_provided` 가 실시간 계산됨

---

#### 13. Conversions API Gateway (CAPIG) 도입 비용/효과 분석 

**왜 해야 하나**
- Meta 가 공식 권장하는 **CAPIG** 는 CAPI 이벤트 전용 서버 (Meta 가 AWS 템플릿 제공). 현재 `metaCapi.ts` 는 **자체 구현**. CAPIG 로 전환 시 장점:
  - 재시도 · 큐잉 · 디둡 표준 구현
  - Meta 공식 SLA 적용
  - 토큰 관리 · 서명 · 버전 업그레이드 자동
  - CAPI 프로토콜 버전 변경 시 Meta 가 대신 처리
- 단점: 호스팅 비용 (AWS EC2 t3.small ≈ 월 $15~25), Meta BM 설정 작업, 기존 인프라에서 이전.
- **볼륨 관점**: 커피 CAPI 월 1,000건 수준이면 자체 구현으로 충분. 월 10,000건 초과하면 CAPIG 가 유리.
- 실리콘밸리 "Build vs Buy" 프레임: 도입 여부가 아니라 **"언제 Buy 로 전환할지 기준을 미리 정하는" 것**이 핵심.

**무엇을**
- 정성·정량 비교 문서 (`coffee/capig-evaluation-0414.md`) 작성:
  1. **현재 상태**: 자체 구현 코드 size, 버그 이력, 유지비용 추정
  2. **CAPIG 도입 시**: AWS 월 비용, 초기 설정 시간, 학습 곡선
  3. **Break-even 지점**: 월 이벤트 N건 이상이면 전환 유리 (추정)
  4. **의사결정 트리거**: "언제 재검토할지" — 예: 월 5,000건 도달, 또는 자체 구현 버그 3건 이상 발생
  5. **권장안**: 현 시점에서는 자체 구현 유지, 트리거 도달 시 재검토

**어떻게**
1. Meta 공식 문서(developers.facebook.com/docs/marketing-api/conversions-api/gateway) 읽기
2. 자체 구현 코드 복잡도 측정: `metaCapi.ts` 총 줄수, 지난 3개월 관련 커밋 수, 버그 수정 횟수
3. AWS CloudFormation 템플릿 훑기 — 인프라 요구사항 정리
4. 월별 CAPI 이벤트 수 집계 (`readMetaCapiSendLogs` 로 지난 3개월 카운트)
5. 10k 이벤트/월 기준 break-even 분석
6. 결과를 박현준에게 1페이지 요약 + 위 문서 링크

**예상 소요**: 0.5일 (분석 문서만)

**성공 기준**: "지금 도입 안 함" 결정에 **수치 근거** 가 붙음. "감이 아니라 데이터". 다음 재검토 트리거가 명시적.

---

### ⚫ 이번 분기 이후 (P3, 참고용)

- **토큰 자동 로테이션**: 시스템 유저 토큰은 비만료지만 90일마다 의도적으로 roll 해서 유출 리스크 최소화 (금융업 수준 보안)
- **Secret Manager 이전**: `.env` 파일에서 GCP Secret Manager 또는 Doppler 로 이전. 배포 환경에서 .env 유출 리스크 제거
- **멀티 리전 CAPI**: 한국 외 시장 진출 시 region-aware CAPI 전송 (지연 최소화)
- **GA4 ↔ Meta 크로스 검증**: GA4 의 purchase 이벤트 수와 Meta CAPI 의 Purchase 수가 ±5% 이내인지 자동 비교 (데이터 신뢰도 모니터)

---

### 요약 표 (한눈에 보기)

| # | 액션 | 우선 | 예상 시간 | 완료 시점 | 성공 기준 |
|---|---|---|---|---|---|
| 1~3 | 권한 검증 + CAPI 분기 + 테스트 | ✅ 완료 | — | 2026-04-14 | events_received: 1 |
| 4 | `/api/meta/health` endpoint | P0 | 40분 | 오늘 | 3토큰 is_valid 구분 |
| 5 | `/ads` health 라인 UI | P0 | 30분 | 오늘 | 페이지 상단 녹/황/적 배지 |
| 6 | `metacoffee.md` 0414 섹션 | P0 | 20분 | 오늘 | 1분 온보딩 가능 |
| 7 | `COFFEE_ACCOUNT_IDS` env 외화 | P1 | 45분 | 이번 주 | grep 매직스트링 0건 |
| 8 | Rotation Runbook | P1 | 1시간 | 이번 주 | 30분 내 토큰 교체 |
| 9 | 기존 앱 토큰 정책 결정 | P1 | 20분 | 이번 주 | fallback chain 상태 명시 |
| 10 | biocom 시스템 유저 요청 | P1 | 대기 1~5일 + 1h | **5/25 데드라인** | biocom 녹색 뱃지 |
| 11 | 커피 SKU ROAS 분해 | P2 | 2~3일 | 이번 달 | 에티오피아 500g 단독 ROAS |
| 12 | CAPI 드랍률 모니터 | P2 | 1.5일 | 이번 달 | 장애 5분 내 감지 |
| 13 | CAPIG 도입 분석 | P2 | 0.5일 | 이번 달 | 수치 기반 결정 |

---

## 6. 이 세션 파일 변경 요약

```
 backend/src/env.ts            |  4 ++++   # COFFEE_META_TOKEN / USERID 로딩 + 스키마
 backend/src/routes/ads.ts     |  7 ++++-  # getMetaToken fallback chain
 backend/src/routes/meta.ts    | 30 ++++-- # getToken fallback + status 응답 확장
 frontend/src/app/ads/page.tsx | 50 +++++- # metaStatus fetch + 토큰 뱃지
 4 files changed, 85 insertions(+), 6 deletions(-)
```

**검증 완료**:
- `tsc --noEmit` backend/frontend 양쪽 pass
- `GET /api/meta/status` 응답에 `activeTokenKind: "system_user"` 확인
- `GET /api/meta/insights?account_id=act_654671961007474` 정상 응답

**검증 미완료 (1.2 에서 해야 함)**:
- 시스템 유저 → 커피 픽셀 쓰기 권한
- 시스템 유저 → 커피 광고 계정 리스트 접근
- `debug_token` 의 `is_valid` / `expires_at`

---

**요지**: 사용자가 `.env` 160~161 행에 토큰 넣는 것만으로는 실제 **사용**되지 않소. 이 세션에서 backend/frontend 파이프라인 연결 + 상태 뱃지까지 마쳤고, **다음 즉시 해야 할 P0 3건(CAPI 분기 · 권한 검증 · health probe)** 이 남아 있소. 특히 CAPI 분기는 2026-06-02 글로벌 토큰 만료 전에 반드시 전환돼야 하오 — 그날 한 번에 모든 사이트 CAPI 다운을 막기 위함이오.
