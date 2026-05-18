# Leading Indicator Agent Frontend Plan

작성 시각: 2026-05-18 12:38 KST
기준일: 2026-05-18
문서 성격: 선행지표 에이전트 프론트엔드 기획 / Claude Code 구현 handoff
대상 사이트: 바이오컴, 더클린커피
Lane: Green documentation / frontend design only
Mode: No-send / No-write / No-publish / No-deploy

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - frontrule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - project/!indicatoragent.md
    - project/coffee-channel-cohort-truth-table-20260517.md
    - project/ga4-vm-row-level-safe-bridge-dry-run-20260517.md
  lane: Green documentation and frontend planning
  allowed_actions:
    - frontend_screen_design
    - data_contract_design
    - Claude_Code_handoff
    - no_send_read_only_metrics_summary
  forbidden_actions:
    - Meta_CAPI_send
    - GA4_Measurement_Protocol_send
    - Google_Ads_upload
    - TikTok_Naver_send_or_upload
    - GTM_publish
    - VM_Cloud_deploy_or_restart
    - operating_db_write
    - raw_identifier_output
  source_window_freshness_confidence:
    source: "VM Cloud SQLite + GA4 BigQuery export + local dry-run markdown/json"
    window: "최근 7일, 산출 기준 2026-05-17 KST"
    freshness: "프론트 기획 작성 시각 2026-05-18 12:38 KST"
    confidence: "thecleancoffee meta cohort medium_high, biocom meta-only medium_low until key bridge improves"
```

## 10초 요약

이 화면의 목적은 매출이 난 뒤에 ROAS를 해석하는 것이 아니라, **구매가 일어나기 전에 먼저 움직이는 행동 신호를 매일 찾는 것**이다.
첫 화면은 대표가 30초 안에 `오늘 어떤 선행지표를 키워야 하는지`, `어떤 채널/랜딩이 구매자를 만들고 있는지`, `어떤 데이터는 아직 믿으면 안 되는지`를 판단하게 만든다.
구현은 Claude Code가 담당한다. Codex는 이 문서에서 화면 구조, 문구, 데이터 계약, 검증 기준을 제공한다.

현재 더클린커피 Meta 유입 분석에서는 결제자가 비결제자보다 **중앙 체류시간이 약 48초 길다**.
반면 장바구니 신호는 결제자보다 비결제자 쪽도 높아, 단독 선행지표로 쓰면 위험하다.
따라서 첫 버전의 핵심 결론 카드는 `3분 이상 체류`, `결제 페이지 도달`, `결제완료 연결 신뢰도`를 중심으로 만든다.

## 화면이 사용자에게 주는 베네핏

### 1. 매출 결과가 아니라 오늘 바꿀 행동을 보여준다

대표가 ROAS만 보면 이미 늦다.
이 화면은 `구매한 사람은 결제 전 무엇을 했는가`를 보여줘서, 오늘 광고 소재·랜딩·쿠폰·결제 흐름 중 무엇을 고칠지 결정하게 한다.

### 2. 광고 유입의 질을 채널별로 비교한다

Meta, YouTube, 오가닉, 네이버 유입이 같은 매출을 만들어도 구매 전 행동은 다르다.
이 화면은 단순 매출 합계가 아니라 `어떤 유입이 오래 보고, 깊게 읽고, 결제 시작까지 가는지`를 비교한다.

### 3. 잘못된 숫자를 먼저 막는다

GA4와 VM Cloud가 같은 사람/주문으로 잘 붙지 않으면, 구매율처럼 보이는 숫자가 틀릴 수 있다.
화면은 `신뢰도`, `join rate`, `분류 보류`를 표시해서 덜 닫힌 숫자를 예산 판단에 쓰지 않게 한다.

## 대표가 보는 첫 질문

화면 상단의 질문은 아래 문장으로 고정한다.

> 오늘 구매를 예고하는 행동은 무엇인가?

보조 문구:

> 결제한 사람과 결제하지 않은 사람의 체류시간, 스크롤, 장바구니, 결제 시작 차이를 비교합니다. 광고 플랫폼 주장값이 아니라 VM Cloud와 GA4를 맞춰 본 내부 행동 분석입니다.

## 권장 라우트와 메뉴 위치

권장 URL:

```text
/ai-crm/leading-indicators
```

AI CRM 카드명:

```text
구매 전 선행지표
```

카드 설명:

```text
Meta·YouTube·오가닉 유입자의 체류시간, 스크롤, 결제 시작 차이로 구매 예고 신호를 찾습니다.
```

기존 `/ai-crm/conversion-funnel`은 퍼널 상태 관제 화면이다.
이 신규 화면은 퍼널 상태를 설명하는 원인을 찾는 분석 화면이다.
두 화면은 상호 링크를 둔다.

- `/conversion-funnel`: 오늘 수집/전송이 정상인가.
- `/leading-indicators`: 정상 수집된 데이터에서 구매 전 좋은 행동은 무엇인가.

## 화면 구조

### 1. 상단 판단 카드

목적:
대표가 첫 화면에서 오늘 볼 행동을 바로 잡게 한다.

구성:

1. `오늘 가장 강한 구매 예고 신호`
   - 예: `Meta 유입 결제자는 비결제자보다 48초 더 오래 봅니다`
   - 보조: `더클린커피 · 최근 7일 · safe session 기준`
2. `주의할 신호`
   - 예: `장바구니는 단독 KPI로 쓰지 마세요`
   - 보조: `Meta 비결제자 장바구니 신호가 결제자보다 높게 관측됨`
3. `데이터 신뢰도`
   - 예: `더클린커피 high / 바이오컴 보강 필요`
   - 보조: `더클린커피 GA4 join 91.0%, 바이오컴 row-level join 30%대`

운영 문구 예시:

```text
결정: 더클린커피 Meta 광고는 장바구니보다 3분 이상 체류와 결제 페이지 도달을 먼저 봅니다.
이유: 결제자가 비결제자보다 중앙 체류시간이 47.9초 길고, 장바구니는 비결제자도 높게 잡힙니다.
```

### 2. 사이트/기간/채널 필터

필터:

- 사이트: `바이오컴`, `더클린커피`
- 기간: `어제`, `최근 7일`, `최근 14일`, `최근 30일`
- 채널: `Meta`, `YouTube`, `오가닉`, `네이버`, `직접/불명`, `전체`
- 분석 기준: `구매자 vs 비결제자`, `랜딩별`, `상품별`, `캠페인별`

기본값:

- 사이트: 바이오컴
- 기간: 최근 7일
- 채널: Meta
- 단, 더클린커피 Meta 분석 카드가 준비되어 있으므로 화면 하단에 `더클린커피 Meta 예시`를 항상 노출한다.

### 3. 구매자 vs 비결제자 비교 패널

목적:
결제자와 비결제자의 행동 차이를 사람이 바로 비교하게 한다.

표시 지표:

- 유입 세션 수
- 결제 세션 수
- 결제율
- 결제금액
- 중앙 체류시간
- 90% 스크롤 도달률
- 장바구니 또는 장바구니 페이지 신호
- 결제 시작
- 결제수단 선택
- CAPI 성공 여부
- 데이터 신뢰도

더클린커피 Meta 유입 예시 값:

```text
Meta 유입 safe session: 67
GA4 연결: 61 / 67, 91.0%
결제 session: 37
비결제 또는 미조인 checkout session: 30
결제금액: 2,329,544원
결제자 중앙 체류시간: 210.8초
비결제자 중앙 체류시간: 162.9초
차이: +47.9초
결제자 scroll90: 100%
비결제자 scroll90: 100%
결제자 장바구니/장바구니 페이지 신호: 17.1%
비결제자 장바구니/장바구니 페이지 신호: 23.1%
```

사람이 읽는 해석:

```text
Meta 유입자는 장바구니보다 오래 머무는 시간이 더 좋은 선행지표 후보입니다.
장바구니 신호는 비결제자도 높게 잡혀 단독 KPI로 쓰면 오판할 수 있습니다.
```

### 4. 선행지표 후보 랭킹

목적:
분석 결과를 실행 가능한 행동 목록으로 바꾼다.

카드 형식:

1. 지표 이름
2. 추천 상태: `관리 후보`, `주의`, `아직 보류`, `데이터 부족`
3. 왜 중요한가
4. 현재 숫자
5. 어떤 액션을 해야 하는가

초기 후보:

#### 체류시간 180초 이상

상태: 관리 후보

왜:
더클린커피 Meta 결제자는 비결제자보다 중앙 체류시간이 약 48초 길다.

화면 문구:

```text
3분 이상 머무는 Meta 유입을 늘리세요.
구매자는 더 오래 읽고 결제 페이지로 이동하는 경향이 있습니다.
```

#### 결제 페이지 도달

상태: 관리 후보

왜:
결제 페이지 도달은 구매 직전 행동이다.
단, 결제완료와 혼동하면 안 된다.

화면 문구:

```text
결제 페이지 도달은 좋은 신호지만 구매완료는 아닙니다.
결제완료는 VM Cloud confirmed purchase로만 봅니다.
```

#### 장바구니 신호

상태: 주의

왜:
더클린커피 Meta에서는 비결제자 장바구니 신호도 높다.

화면 문구:

```text
장바구니는 단독 KPI가 아닙니다.
결제 페이지 도달이나 체류시간과 같이 볼 때만 의미가 있습니다.
```

#### 90% 스크롤

상태: 보류

왜:
더클린커피 Meta에서는 결제자와 비결제자가 모두 100%라 구분력이 없다.

화면 문구:

```text
이 구간에서는 scroll90이 이미 포화되어 구매자를 구분하지 못합니다.
scroll50, page_view_long, 특정 리뷰 영역 도달 같은 더 앞단 지표가 필요합니다.
```

### 5. 채널별 비교

목적:
광고 채널별로 어떤 행동이 다르게 나타나는지 본다.

초기 표시:

- Meta
- YouTube
- 네이버 paid/brand
- direct/unknown
- other

더클린커피 최근 7일 참고 결론:

- YouTube와 Meta는 구매자 체류시간이 비결제자보다 길다.
- 네이버 paid/brand는 구매율이 낮지만 구매자 체류시간이 비결제자보다 길어 랜딩/결제 흐름 개선 후보가 될 수 있다.
- direct/unknown은 구매 수가 크지만 유입 원인 분류가 약하므로 attribution 개선 후보로 표시한다.

### 6. 데이터 신뢰도 패널

목적:
화면 숫자를 예산 판단에 써도 되는지 구분한다.

필수 표시:

- source
- window
- site
- freshness
- GA4 join rate
- VM Cloud confirmed 기준 여부
- confidence
- caveat

문구 예시:

```text
더클린커피는 GA4와 VM Cloud가 safe session 기준 91.0% 연결되어 행동 비교에 쓸 수 있습니다.
바이오컴은 현재 row-level 연결률이 30%대라 Meta-only 구매자/비결제자 비교는 방향성으로만 봅니다.
```

### 7. 액션 큐

목적:
분석에서 바로 운영/개발 액션으로 이어지게 한다.

초기 액션 카드:

1. `더클린커피 Meta: 3분 이상 체류 비율을 캠페인/랜딩별로 비교`
   - 담당: Codex 데이터 dry-run / Claude Code 화면 구현
   - 승인: 없음
2. `더클린커피: AGENTSOS begin_checkout export 반영 후 재분석`
   - 담당: Codex read-only 재조회
   - 승인: 없음
   - 의존성: GA4 BigQuery daily export 적재
3. `바이오컴: Meta-only 분석 전 key bridge 보강`
   - 담당: Codex 설계, TJ님 승인 후 적용
   - 승인: raw-id Plan B 또는 key capture 변경 시 필요

## 데이터 계약

### 추천 API

신규 aggregate endpoint를 권장한다.
raw row를 많이 내려주지 말고, 화면에 필요한 집계만 반환한다.

```text
GET /api/attribution/leading-indicators
```

Query:

```text
site=biocom|thecleancoffee
window=1d|7d|14d|30d
channel=meta|youtube|naver_paid_or_brand|organic|direct_or_unknown|all
dimension=buyer_vs_leaver|channel|landing_bucket|campaign|product
```

응답 예시:

```json
{
  "site": "thecleancoffee",
  "window": "7d",
  "channel": "meta",
  "source": {
    "primary": "VM Cloud SQLite",
    "cross_check": "GA4 BigQuery export",
    "freshness_kst": "2026-05-17 17:44",
    "confidence": "high"
  },
  "headline": {
    "decision": "Meta 유입은 장바구니보다 체류시간과 결제 페이지 도달을 먼저 봅니다.",
    "buyer_dwell_delta_seconds": 47.9,
    "buyer_rate_pct": 55.22
  },
  "cohort": {
    "safe_sessions": 67,
    "ga4_joined_sessions": 61,
    "ga4_join_rate_pct": 91.04,
    "confirmed_purchase_sessions": 37,
    "dropped_checkout_sessions": 30,
    "confirmed_revenue_krw": 2329544
  },
  "comparison": {
    "buyer": {
      "p50_dwell_seconds": 210.76,
      "scroll90_rate_pct": 100,
      "cart_or_view_cart_rate_pct": 17.14,
      "begin_checkout_rate_pct": 0,
      "add_payment_info_rate_pct": 0
    },
    "non_buyer": {
      "p50_dwell_seconds": 162.88,
      "scroll90_rate_pct": 100,
      "cart_or_view_cart_rate_pct": 23.08,
      "begin_checkout_rate_pct": 0,
      "add_payment_info_rate_pct": 0
    }
  },
  "indicators": [
    {
      "id": "dwell_180s",
      "label": "3분 이상 체류",
      "status": "candidate",
      "why": "Meta 결제자가 비결제자보다 더 오래 머뭅니다.",
      "action": "랜딩/소재별 3분 이상 체류 비율을 비교합니다.",
      "confidence": "medium_high"
    },
    {
      "id": "cart_signal",
      "label": "장바구니 신호",
      "status": "caution",
      "why": "비결제자 쪽도 높게 잡혀 단독 KPI로 쓰기 어렵습니다.",
      "action": "결제 페이지 도달과 함께 봅니다.",
      "confidence": "medium"
    }
  ],
  "caveats": [
    "dropped cohort contains GA4 purchase events, so some rows may be session/window mismatch.",
    "begin_checkout and add_payment_info require rerun after AGENTSOS tag export."
  ]
}
```

### 데이터 source 우선순위

1. 결제완료 여부: VM Cloud confirmed purchase / 운영DB PAYMENT_COMPLETE cross-check
2. 행동 품질: GA4 BigQuery engagement, scroll, ecommerce event
3. 광고 유입 evidence: VM Cloud attribution source, UTM, fbc/fbclid, Meta evidence
4. 화면 표시는 aggregate only
5. raw order/payment/member/click id는 화면에 절대 노출하지 않는다

## Claude Code 구현 handoff

### 권장 파일

```text
frontend/src/app/ai-crm/leading-indicators/page.tsx
frontend/src/app/ai-crm/leading-indicators/page.module.css
```

기존 AI CRM 상단 네비게이션과 같은 Header를 유지한다.
`/conversion-funnel`에서 상단 메뉴가 사라졌던 문제가 있었으므로, 신규 페이지는 반드시 공통 AppShell/Header를 사용한다.

### 초기 구현 범위

P0 구현:

1. 페이지 shell과 필터
2. 상단 판단 카드 3개
3. 구매자 vs 비결제자 비교 패널
4. 선행지표 후보 랭킹
5. 데이터 신뢰도 패널
6. 더클린커피 Meta 분석 예시 카드

P0에서는 backend endpoint가 없으면 아래 정적 source를 임시 fallback으로 사용한다.

```text
data/project/coffee-channel-cohort-truth-table-20260517.json
data/project/ga4-vm-row-level-safe-bridge-dry-run-20260517.json
```

단, 화면에는 반드시 `샘플/최근 dry-run 기준` 배지를 붙인다.
운영 화면에서 live API처럼 보이게 만들면 안 된다.

### 화면 톤

금지:

- 큰 hero section
- 마케팅 랜딩식 설명
- raw key 먼저 노출
- `p50`, `safe hash`, `dropped_checkout` 같은 용어만 단독 표시

권장:

- “구매자는 더 오래 봤습니다”
- “장바구니는 단독 판단 금지”
- “이 숫자는 더클린커피는 믿을 수 있고, 바이오컴은 보강 필요”
- “다음에 볼 행동”

### 로딩/캐시

기본은 precomputed cache를 읽는다.
화면 상단에 기준 시간을 표시한다.

```text
데이터 기준 2026-05-17 17:44 KST · source VM Cloud + GA4 BigQuery · 최근 7일
```

강제 새로고침 버튼은 P1로 둔다.
P0에서는 분석 화면 안정성과 문구 정확도가 우선이다.

## 검증 체크리스트

Claude Code 구현 후 확인할 것:

- [ ] `/ai-crm/leading-indicators`에서 공통 상단 메뉴가 보인다.
- [ ] 기본 필터가 바이오컴/최근 7일/Meta로 뜬다.
- [ ] 더클린커피 Meta 분석 카드가 보인다.
- [ ] `결제자 중앙 체류시간 210.8초`, `비결제자 162.9초`, `차이 47.9초`가 사람 말로 표시된다.
- [ ] 장바구니는 `주의`로 표시되고, 구매 예고 확정 지표처럼 보이지 않는다.
- [ ] 바이오컴은 `Meta-only 확정 분석 전 key bridge 보강 필요`로 표시된다.
- [ ] raw order/payment/member/click id가 노출되지 않는다.
- [ ] 모바일 390px에서 카드 텍스트가 겹치지 않는다.
- [ ] Playwright screenshot으로 desktop/mobile 비어 있지 않음을 확인한다.

## P1 이후 개발 계획

### P1. live aggregate endpoint 연결

무엇:
`/api/attribution/leading-indicators`를 만들거나 기존 funnel-health에 leading indicator block을 추가한다.

왜:
정적 dry-run이 아니라 매일 갱신되는 화면이 필요하다.

어떻게:
VM Cloud precompute 방식으로 site x window x channel 조합을 미리 계산한다.
프론트는 캐시만 읽는다.

성공 기준:
화면 첫 응답 500ms 이하.
source/window/site/confidence 필드 포함.

### P2. 캠페인/랜딩별 drilldown

무엇:
Meta campaign/adset/landing bucket별로 체류시간과 결제율을 비교한다.

왜:
대표가 어떤 광고 소재와 랜딩을 키울지 결정해야 한다.

어떻게:
campaign_id/adset_id가 사람이 읽는 이름으로 매핑된 경우만 표시한다.
미매핑은 `이름 확인 필요`로 분리한다.

성공 기준:
raw 숫자 ID 단독 노출 0.

### P3. 실험 추천 에이전트

무엇:
선행지표 변화가 큰 구간에 실험안을 자동 제안한다.

왜:
분석만 보고 끝나지 않고 실제 랜딩/카피/쿠폰 개선으로 이어져야 한다.

예:

```text
Meta 유입자는 체류시간이 길수록 결제율이 높습니다.
리뷰 영역 도달 전 이탈이 많으니, 첫 화면에서 리뷰/구매평 진입 버튼을 올려보세요.
```

## 금지선

- 이 화면의 수치를 Meta CAPI 전송 기준으로 쓰지 않는다.
- GA4 purchase revenue를 실제 결제 정본으로 쓰지 않는다.
- join rate가 낮은 site/channel을 예산 판단용 전환율로 표시하지 않는다.
- raw order/payment/member/click id를 화면/문서/로그에 노출하지 않는다.
- Claude Code는 프론트 구현만 한다. GTM publish, Meta send, VM Cloud deploy는 별도 승인 전 실행하지 않는다.

## 다음 할일

### Auto Green

1. Claude Code가 P0 프론트 shell을 구현한다.
   - 산출물: `/ai-crm/leading-indicators`
   - 성공 기준: 더클린커피 Meta 분석 카드와 데이터 신뢰도 카드가 보인다.
   - 의존성: 없음. 정적 dry-run JSON fallback 사용 가능.

2. Codex가 live endpoint 설계안을 backend contract로 분리한다.
   - 산출물: leading indicator aggregate endpoint approval/design
   - 성공 기준: 프론트가 raw row 없이 aggregate만 읽도록 contract가 닫힌다.
   - 의존성: P0 화면 구성 확정.

### Approval Needed

1. live API를 VM Cloud에 배포하는 작업.
   - 이유: 배포/restart는 Yellow Lane이다.
   - 승인 전 상태: 문서/로컬 구현/dry-run까지 가능.

2. GTM/GA4 이벤트 추가 publish.
   - 이유: 외부 tag production publish는 Red/Yellow 경계 작업이다.
   - 현재 상태: 더클린커피 begin_checkout은 Preview에서 확인됐고, export 적재 후 재분석 필요.

### Blocked/Parked

1. 바이오컴 Meta-only row-level 확정 분석.
   - 막힌 이유: GA4와 VM Cloud safe join rate가 30%대라 정확한 buyer/leaver 비교가 약하다.
   - 풀 방법: key capture 보강 또는 raw-id Plan B 승인.
