# Google Ads / TikTok ROAS 정합성 체크 계획

최종 업데이트: 2026-04-14 KST

## 요약

이 문서는 Meta CAPI 정합성 작업에서 잡은 원칙을 Google Ads와 TikTok에도 확장하기 위한 계획이다.

핵심 목표는 단순히 “픽셀이 설치되어 있나”가 아니라, 광고 플랫폼 ROAS와 내부 Attribution ROAS가 같은 기준을 보고 있는지 확인하는 것이다.

- 기준 원칙: 결제 완료 페이지 진입만으로 Purchase를 확정하지 않고, 실제 결제 상태가 confirmed인 주문만 구매로 본다.
- 분리 원칙: 가상계좌 미입금, 주문 생성, 결제 시도, 실제 결제 확정을 서로 다른 이벤트로 분리한다.
- 대조 원칙: Google Ads/TikTok의 구매 수와 구매 전환값을 내부 원장 주문번호, 결제상태, 매출액과 교차 검증한다.

현재 전체 완성도는 약 25%다. 루트 페이지 기준 설치와 기본 발화, 공개 배포된 GTM 컨테이너의 일부 GA4 연결 상태까지 확인했다. 다만 구매 전환 이벤트의 정합성은 아직 테스트 주문과 플랫폼 리포트 대조가 필요하다.

TJ님 확인사항 반영:

- biocom GA4 정본은 `G-WJFXN5E2Q1`로 본다.
- `G-8GZ48B1S59`는 사용 중지 또는 제거를 검토해야 한다.
- 더클린커피는 현재 TikTok 광고를 운영하지 않으므로 TikTok ROAS 정합성 체크는 이번 범위에서 후순위로 둔다.

---

## 🛰️ 2026-04-15 Google Tag Gateway (태그 게이트웨이) 필요성 검토

> TJ님 질문: "구글 태그 게이트웨이는 뭐지? 필요한지 확인해서 문서 상단에 기재해"
> (AIBIO 컨테이너 `GTM-T8FLZNT` 에서 설정 모달이 떠있음)

### 한 줄 결론

**지금 당장 꼭 설치할 필요는 없지만, biocom/thecleancoffee 커머스 두 사이트에는 중기 도입 후보이다.** AIBIO(리드젠) 는 선택적.

### Google 태그 게이트웨이란?

- 정식 명칭: **Google Tag Gateway for Advertisers (GTGA)**. 2024년 하반기 공개된 기능이다.
- 무엇: 웹사이트가 GTM 컨테이너 스크립트와 Google 태그(gtag.js) 를 `www.googletagmanager.com` 이 아닌 **사이트의 자사 도메인(first-party)** 을 통해 서빙하게 해 주는 중계 계층이다.
- 왜 필요: iOS Safari 의 ITP, 광고 차단기, 기업 네트워크 방화벽 등이 `googletagmanager.com` 에서 오는 3rd-party 스크립트/쿠키를 차단하거나 7일로 만료시키는 문제를 회피하기 위함이다. Google 의 공식 주장은 "웹사이트 측정 회복률 +5~15%" 범위이다.
- 어떻게: 지원되는 CDN (현재 Cloudflare 완전 지원, Akamai/Fastly 부분 지원) 뒤에 있는 사이트라면 GTM 이 CDN 설정을 자동 감지하여 1st-party 경로로 스크립트를 reroute. 필요 시 CDN 계정 관리자 권한으로 인증.
- 연결 대상: 현재 GA4 + Google Ads 만. Meta Pixel, TikTok 등 non-Google 픽셀은 이 기능으로 회복되지 않는다 (그건 여전히 Meta CAPI / TikTok Events API 로 대응해야 함).

### 설치 시 얻는 것 / 잃는 것

| 항목 | 효과 |
|---|---|
| iOS Safari 구매 전환 측정 loss 회복 | 📈 5~15% (Google 주장) |
| 광고차단기 사용자 측정 회복 | 📈 소폭 (핵심은 ITP 회복) |
| GA4 user_id / session_id 연속성 | 📈 1st-party 쿠키 수명 장기화 |
| Google Ads 전환값 정합성 | 📈 ITP 영향 감소 |
| Meta/TikTok 픽셀 회복 | ❌ 영향 없음 (별도 서버 이벤트 필요) |
| 설치 난이도 | ⚙️ CDN 이 호환되면 매우 낮음, 아니면 어려움 |
| 비용 | 💰 Google 측 무료 (GTGA 자체) — CDN 대역폭 추가 발생 가능 |
| 리스크 | ⚠️ 동의 모드/Consent Mode 재검증, 1st-party 쿠키 동작 일부 변경 |

### 사이트별 적용 가능성

| 사이트 | 컨테이너 | 호스팅 / CDN | 설치 모달 여부 | 권장 |
|---|---|---|---|---|
| biocom.kr | `GTM-W2Z6PHN` | 아임웹 호스팅 | 미확인 | 🟡 조사 후 도입 후보 |
| thecleancoffee.com | `GTM-5M33GC4` | 아임웹 호스팅 | 미확인 | 🟡 조사 후 도입 후보 |
| AIBIO | `GTM-T8FLZNT` | 사이트 호스팅 미확인 | **모달 가능** (스크린샷) | 🟢 태그가 2개뿐이라 이득 제한적, 그러나 설치가 쉬우면 선택적 도입 가능 |

**아임웹 제약**: biocom/coffee 는 아임웹 쇼핑몰 플랫폼 위에서 운영된다. 아임웹이 자체 CDN 을 쓰는지, Cloudflare 를 쓰는지, 혹은 고객이 Cloudflare 같은 외부 CDN 을 앞에 붙일 수 있는지 아직 확인 전. GTGA 의 "no-code auto detect" 경로는 Cloudflare / Akamai / Fastly / CloudFront 같은 지원 CDN 의 관리자 권한이 전제되므로, 아임웹의 기본 호스팅 만으로는 **불가능할 가능성이 높다**.

### 판단 결과 — "지금 당장 하는 것이 맞는가"

**No, 지금 최우선이 아니다**. 근거:

1. 지금 당장 ROAS 정합성 문제의 핵심은 **ITP 로 인한 loss** 가 아니라 **정본 GA4 vs 비정본 GA4 연결 문제**, **가상계좌 구매 이중 발화**, **더클린커피 Google Ads 구매 전환 태그 부재** 이다. 이 3가지가 모두 GTGA 없이 고칠 수 있는 GTM 내부 구조 문제다.
2. biocom/coffee 는 아임웹 제약으로 GTGA 자동 설치가 안 될 가능성이 높다. 쓰려면 Cloudflare 을 앞에 세우거나 이머와 별도 계약이 필요해 초기 셋업 비용이 크다.
3. AIBIO 는 태그 2개뿐(`GA4 generate_lead`, `Google Ads 리마케팅`)이라 ITP 회복의 절대 수치가 작다. 리드젠 특성상 구매 전환 가치가 없어 Google Ads 최적화 레버리지가 적다.

### 중기 실행안 (후속 검토용)

1. **biocom/coffee 의 CDN 현황 파악** — 아임웹 기술지원팀에 "Cloudflare / 외부 CDN 프록시 허용 여부" 문의
2. **A/B 판정 기준 설정** — GTGA 도입 전후로 Google Ads 전환 수, GA4 purchase 수를 2주 비교. 기대 증분 5% 미만이면 롤백
3. **Consent Mode v2 호환성 검증** — GTGA 는 동의 설정과 상호작용이 있다. 바이오컴 데이터프라이버시 정책과 충돌 여부 사전 점검
4. **AIBIO 는 빠르게 소규모 POC** — 이미 모달이 떠있으므로 "호환성 확인하기" 단계까지만 진행해 CDN 호환 여부만 확인. 호환되면 테스트 도입, 안 되면 바로 취소

### 우선순위

지금 당장의 1~5순위는 (1) **Toss 신 라이브 키 교체**, (2) **biocom NPAY 정본 GA4 연결 최종 확인**, (3) **coffee Google Ads 구매 전환 태그 신설**, (4) **coffee UA 레거시 태그 4개 삭제**, (5) **가상계좌 2중 발화 관찰** 이다. GTGA 는 이 5가지가 끝난 뒤 6번째 이후로 둔다.

---

## 🔬 2026-04-15 GTM API 전체 태그 진단 결과 — 3개 컨테이너 scan

> TJ님 지시: "GTM 컨테이너에 service account 추가 완료. 태그 전체 진단하고 문서 업데이트해"
> 실행: `backend/scripts/gtm-audit.ts` via GTM API v2 (readonly). 결과 JSON: `gtmaudit/gtm-audit-2026-04-14.json`.

### 접근 가능 컨테이너 (3/3)

| 컨테이너 | 이름 | 태그 | 트리거 | 변수 | 템플릿 | 일시중지 | 최신 배포 버전 |
|---|---|---:|---:|---:|---:|---:|---|
| `GTM-W2Z6PHN` | biocom.kr | 56 | 80 | 58 | 4 | 5 | 135 |
| `GTM-5M33GC4` | thecleancoffee.com | 31 | 22 | 13 | 2 | 0 | 17 |
| `GTM-T8FLZNT` | AIBIO | 2 | 2 | 1 | 0 | 0 | (`UA 추적 카톡채널 이벤트 추가` 버전이 최신 헤더로 잡히나, 커스텀 이름이 달려 있음. 워크스페이스에는 태그 2개 존재) |

세 컨테이너 모두 **단일 GTM 계정 "바이오컴(최종)" (accountId 4703003246)** 안에 들어 있었음. 즉 "바이오컴 본사 계정 1개 → 하위에 biocom/coffee/aibio 컨테이너 3개" 구조.

### ✅ 사용자 앞선 작업이 API 로 확인된 항목

1. **`GA4_구매전환_Npay` (ID 43)** → `measurementIdOverride: "G-WJFXN5E2Q1"` ✔ 정본 연결 확인
2. **`GA4_구매전환_Npay 2` (ID 98)** → `paused: true` ✔ 비정본 중단 확인
3. **`GA4_픽셀 2` (ID 99, `G-8GZ48B1S59`)** → `paused: true` ✔
4. `GA4 장바구니 담기2` (ID 101) → `paused: true`
5. `구조화된 데이터_Q&A` (ID 53) → `paused: true` (FAQ schema, 기능 사용 안 함)
6. `tmp_ga4모든 링크 클릭` (ID 23) → `paused: true`

> 결론: TJ님 어젯밤 변경은 API 층에서 완전히 확인됨. 정본 활성 + 비정본 일시중지 조합이 라이브 배포(v135) 상태.

### 🔴 새로 발견한 이슈 (우선순위 순)

#### H1 [biocom] `dlv_price_vlaue` 오타 변수 — 동작은 정상, 그러나 함정

- 변수 ID 45, 이름 `dlv_price_vlaue` (vlaue 오타)
- 실제 data layer path: `eventModel.value` (정상), 기본값 0
- `GA4_구매전환_Npay` 태그가 이 변수를 `value` 파라미터로 참조
- **기능적으로는 문제 없음** (데이터 레이어 키 자체는 맞는 `eventModel.value` 로 설정됨)
- 그러나 새 태그 작성자가 동일 변수 재사용하려 `{{dlv_price_value}}` 로 오타 없이 쓰면 "undefined 변수" 가 되어 조용히 실패함. **네이밍 리네임 권장**.

#### H2 [biocom] `G-8GZ48B1S59` (비정본 GA4) 계열 태그 여전히 활성화

| ID | 이름 | 타입 | 상태 | 대상 Measurement ID |
|---|---|---|---|---|
| 97 | `[new]Google 태그` | googtag | **활성** | `G-8GZ48B1S59` |
| 100 | `G4_주문완료_요소공개2` | gaawe | **활성** | `G-8GZ48B1S59` (override) |
| 103 | `GA4_정기구독 신청 완료` | gaawe | **활성** | `G-8GZ48B1S59` (override) |
| 105 | `GA4_정기구독 해지 클릭` | gaawe | **활성** | `G-8GZ48B1S59` (override) |

> ⚠️ 네이버페이 구매 전환은 정본으로 옮겼지만, **정기구독/주문완료 이벤트 4건은 여전히 비정본으로 발화 중**. 정기구독 매출은 현재 G-8GZ48B1S59 속성에만 쌓이고 있어 정본 속성의 GA4 Exploration 에서 보이지 않음.
>
> **권장 조치**:
> 1. ID 97 (`[new]Google 태그`, 설정 태그) 을 `G-WJFXN5E2Q1` 로 변경하거나, 아예 일시중지 후 ID 38 (`GA4_픽셀`, 정본) 으로 일원화
> 2. ID 100/103/105 의 `measurementIdOverride` 를 `G-WJFXN5E2Q1` 로 교체
> 3. 변경 전 GA4 정본 속성의 `subscription_completed`, `cancel_subscription` 이벤트 수집 중단 기간 리포트 작성 (얼마나 손실됐는지 기록)

#### H3 [biocom] `G-8GZ48B1S59` 레거시 픽셀 자체 결단 필요

- ID 38 `GA4_픽셀` (정본 `G-WJFXN5E2Q1`, Initialization 트리거) **활성**
- ID 97 `[new]Google 태그` (비정본 `G-8GZ48B1S59`, Initialization 트리거) **활성**
- 두 개의 설정 태그가 동시에 init 에 발화 → 두 속성 모두 page_view 수집 중. GA4 이중 설정.
- 결단:
  - (a) ID 97 일시중지 → 정본만 수집 (깔끔하나 비정본 히스토리 연속성 끊김)
  - (b) 두 속성 병렬 유지 → 비용/관리 부담
- TJ님이 이미 비정본을 "사용 중지 또는 제거를 검토" 라고 상단 요약에 적어 두셨으므로 **(a) 권장**.

#### H4 [coffee] **Google Ads 구매 전환 태그 부재** ★★★

GTM-5M33GC4 의 `awct` (Google Ads Conversion Tracking) 태그 목록:

```
ID 26 | Google Ads - 전환추적 - 1초 회원가입  (회원가입 전환)
ID 27 | Google Ads 전환 추적-카톡채널 추가 클릭 (카톡 친구추가)
```

**구매 전환 태그가 단 하나도 없음**. 즉 더클린커피 Google Ads `AW-10965703590` 은 현재 **웹에서 발생한 구매 전환을 수집하고 있지 않을 가능성이 높음**. (사이트 footer 의 gtag 이벤트로 Ads 에 직접 쏘는 방식일 수도 있으나, GTM 외부이므로 본 audit 범위 밖. footer/body 코드 재검토 필요.)

> **조치**: `footer/coffeefooter0414.md` 와 `footer/coffee_header_guard_0414.md` 에 `gtag('event','conversion',{send_to:'AW-10965703590/xxxx'})` 같은 구매 전환 호출이 있는지 확인. 없으면 GTM 에 `awct` 태그 신설해야 함.

#### H5 [coffee] **Universal Analytics (UA) 레거시 태그 4개 — 죽은 태그**

| ID | 이름 | 타입 |
|---|---|---|
| 12 | `UA - Event -Scroll` | ua |
| 14 | `UA - PageView` | ua |
| 19 | `UA-이벤트-1초회원가입` | ua |
| 22 | `UA-이벤트-카톡채널 버튼 클릭` | ua |

- Universal Analytics 는 **2024-07-01 부로 완전 종료**. 이 태그들은 현재 GTM 컨테이너에 존재하지만 실제 발화 시 GA 서버가 데이터를 drop. **dead code**.
- **조치**: 4개 모두 삭제. 동일 기능의 GA4 버전이 이미 있는지 확인 (GA4-이벤트-1초회원가입, GA4-이벤트-카톡채널 존재함 ✔)

#### H6 [coffee] "HURDLES" ↔ "HURDLERS" 오타 혼재

- 외부 플러그인 "허들러스" 기반 태그에서 biocom 은 `HURDLERS - ...` 로 명명, coffee 는 일부 `HURDLES - ...` (오타) 로 명명됨
  - `HURDLES - [이벤트전송] 주문서작성` (ID 35)
  - `HURDLES - [이벤트전송] 구매` (ID 49)
- 기능 영향 없음 (태그 이름은 free text). 관리 명확성 위해 rename 권장.

#### H7 [biocom] 테스트 태그 잔존

- `tmp_바이오컴 장바구니` (ID 17, awct, conversionLabel `QuHkCL7utYoDEJixj5EB`) — 활성화 상태
- `tmp_ga4 page_view_long 이벤트` (ID 21) — 활성화
- `tmp_구글 Ads 동적 리마케팅 잠재고객` (ID 26, HTML) — 활성화
- 접두사 `tmp_` 는 "임시/테스트" 명명 관례. 이 3개가 정말 운영용인지 확인 후 삭제 or rename 필요.

#### H8 [AIBIO] 배포 미반영 태그 1개

- 워크스페이스: 태그 2개 (`GA4 generate_lead`, `Google Ads 리마케팅`)
- 최신 배포 버전 header 에서 `numTags: 1` — 즉 둘 중 하나가 **publish 되지 않은 draft** 상태일 수 있음
- 조치: AIBIO 컨테이너 Publish 상태 확인 → 운영 중이어야 할 태그가 draft 인지 TJ 결정

### 🟢 정상 확인된 설정

- **커피 GA4 구성 태그 (ID 4)**: `tagId: G-JLSBXX7300` ✔ 커피 정본
- **커피 정기구독 이벤트 (ID 72/73)**: `measurementIdOverride: G-JLSBXX7300` ✔
- **커피 Google 태그 AW-10965703590 (ID 74)**: 커피 primary Google Ads 계정 연결 ✔
- **biocom AW-304339096 Google 태그 (ID 169)**: 활성 ✔ (공유 계정 이슈는 별도 섹션 참고)
- **biocom NPAY 구매 전환 (ID 248 `TechSol - [GAds]NPAY구매 51163`)**: `conversionId=304339096, conversionLabel=3yjICOXRmJccEJixj5EB` — live conversionLabel 수집
- **biocom 회원가입 구글 전환 (ID 210)**: `conversionId=304339096, conversionLabel=A84hCP3lt4oDEJixj5EB`
- **biocom Enhanced Conversions for Leads (UPDE)**: `UPDE_register` (ID 200), `UPDE_purchase` (ID 204) — awud (Enhanced Conversions) 타입으로 user_data 해시 전송 설정됨
- **Microsoft Clarity** 설치 확인 — biocom projectId `w7cuaasgm7`, coffee projectId `w7d44mkm7u`

### 🚫 확인된 부재 (Gap)

- **Meta Pixel (`fbq`, `1186437633687388`, `1283400029487161`) → GTM 내 태그 0개** (biocom/coffee/aibio 모두). 즉 Meta 픽셀은 GTM 경로가 아닌 **아임웹 header/footer 직접 삽입** 으로만 발화 중. 이건 이미 설계된 구조와 일치 (코드 기반 관리).
- **TikTok Pixel → GTM 내 태그 0개**. 커피는 운영 안 하므로 정상. biocom 의 TikTok 운영 여부 확인 필요.
- **Meta CAPI (server-side) → GTM 외부 backend** 에 있음 → 본 audit 범위 밖 (metaCapi.ts 로 전송).

### 다음 단계 (오늘 중 작업 가능 목록)

1. 🟡 H2 정기구독/주문완료 4개 태그 — `G-8GZ48B1S59 → G-WJFXN5E2Q1` 교체 (내가 GTM API edit 권한으로 할 수도 있지만, **GTM 배포는 사람이 직접 승인** 원칙 유지 권장. TJ님이 직접 수정)
2. 🟡 H3 `[new]Google 태그` (ID 97) 일시중지 판단 — 손실 분석 리포트 내가 작성 가능
3. 🔴 H4 커피 Google Ads 구매 전환 태그 부재 — footer 코드 재확인 및 gap 리포트
4. 🟢 H5 커피 UA 4개 삭제 — 나 혼자 edit API 로 가능. 단 TJ 승인 후
5. 🟢 H7 `tmp_*` 3개 태그 운영 여부 확정

### 감사 자동화 후속

```bash
# 전체 덤프 재생성
cd backend && npx tsx scripts/gtm-audit.ts
# 출력: ../gtmaudit/gtm-audit-<YYYY-MM-DD>.json
```

지금은 readonly 스코프만 요청 중 (`tagmanager.readonly`). 필요 시 edit 스코프 추가 가능:
```
https://www.googleapis.com/auth/tagmanager.edit.containers
```

---

## 🔐 2026-04-14 GTM 컨테이너 권한 위임 검토 — "Claude 를 관리자로 초대할 수 있는가"

> 사용자 질문: "컨테이너 권한에 너를 관리자로 초대하면 태그 내용 자세히 볼 수 있는지 검토해"
>
> 답: **이메일 초대로서 "Claude"는 등록 불가**. 하지만 이 프로젝트에 **이미 존재하는 GCP service account** 를 GTM 컨테이너에 추가하면 backend API 경로로 내가 태그 상세를 자동 조회할 수 있소. 추가 인프라 비용 0, 설정 10분.

### 한 줄 결론

**A 옵션 (service account + GTM API) 권고**. 이미 GA4 Data API 용으로 등록된 `seo-656@seo-aeo-487113.iam.gserviceaccount.com` 를 GTM 컨테이너 `GTM-W2Z6PHN` + `GTM-5M33GC4` 에 **읽기 권한**으로 추가 → backend 에 `/api/gtm/tags` 엔드포인트 신설 → 내가 Claude Code 에서 curl 로 태그 상세 조회 가능.

### 기술적 배경 — 왜 "Claude 를 초대"는 직접 안 되는가

- GTM 은 Google 계정(Gmail, Workspace) 또는 **Google Cloud service account 이메일** 에만 권한 부여 가능
- 나(Claude)는 별도 Google 계정이 없음. Anthropic 가 운영하는 LLM 에이전트일 뿐
- 따라서 "Claude 이메일 초대" 는 기술적으로 **존재하지 않음**
- 대신 내가 대리 사용할 수 있는 **service account 경로** 가 표준. 이 프로젝트는 이미 service account 기반으로 GA4 Data API 호출 중이라, 같은 계정을 GTM 에도 확장 적용만 하면 됨

### 현재 활용 가능한 인프라

- **Service account**: `seo-656@seo-aeo-487113.iam.gserviceaccount.com`
- **GCP project**: `seo-aeo-487113`
- **이미 등록된 곳**: GA4 property 3종 (biocom 304759974, coffee 326949178, aibio 326993019) — 모두 Data API viewer
- **googleapis 라이브러리**: `backend/package.json` `^171.4.0` 이미 설치. GTM API 호출 코드를 같은 라이브러리로 작성 가능

### 3가지 옵션

#### 🟢 옵션 A — Service Account + GTM API (**권장**)

**원리**: 기존 service account 를 GTM 컨테이너 사용자 목록에 추가 → backend 가 GTM API 로 태그·트리거·변수 메타데이터 조회 → 내가 endpoint 호출로 실시간 확인.

**장점**:
- 실시간 조회 (변경 즉시 반영)
- 스크린샷 불필요
- 내가 모든 태그·트리거·버전을 전수 확인 가능
- 사용자 수동 작업 없음 (설정 후)
- 이 세션의 "GA4_구매전환_Npay 정본/비정본 역전" 같은 문제를 자동 감지 가능

**단점**:
- 초기 설정 10분
- GCP Tag Manager API enable 필요
- backend 코드 50~100줄 추가

#### 🟡 옵션 B — GTM 컨테이너 JSON Export (대안)

**원리**: 사용자가 GTM admin 에서 "컨테이너 내보내기" → JSON 다운로드 → 저장소에 commit → Claude 가 파일 읽기.

**장점**:
- API enable 불필요
- 코드 변경 거의 없음
- 사용자가 쉽게 다운로드 가능 (GTM UI 로 1-click)

**단점**:
- **실시간 아님** — 변경 있을 때마다 수동 re-export 필요
- 저장소 commit 시 민감 데이터 주의 (GTM JSON 안에 trigger 조건, API key 등 포함 가능)
- "방금 수정한 태그가 제대로 들어갔는지" 확인하려면 매번 export → load 반복

#### 🔴 옵션 C — 스크린샷 (현재 상태)

**원리**: 사용자가 GTM 화면을 스크린샷으로 공유 → Claude 가 이미지 분석.

**장점**:
- 기술 설정 0
- 즉시 가능

**단점**:
- 매번 사용자 수동 작업
- 전수 확인 불가 (태그 수십 개면 모든 스크린샷 받기 불가)
- 스크린샷마다 해상도·가독성 편차

### 옵션 A 구현 단계

#### 사용자가 할 것 (10분)

**Step 1: GTM 컨테이너에 service account 추가**

```
GTM 관리자 화면 접속
→ GTM-W2Z6PHN (biocom)
→ 관리자 탭 → 사용자 관리
→ "이메일 주소 추가"
→ seo-656@seo-aeo-487113.iam.gserviceaccount.com
→ 권한: "읽기" (Read-only) — 중요!
→ 컨테이너 권한: 조회 가능
→ 저장

동일하게 GTM-5M33GC4 (coffee) 에도 추가
(커피도 같이 하면 커피 GTM 진단도 가능)
```

**Step 2: GCP 에서 Tag Manager API 활성화**

```
https://console.cloud.google.com/apis/library/tagmanager.googleapis.com
→ 프로젝트 "seo-aeo-487113" 선택
→ "사용 설정(Enable)" 클릭
→ 완료 확인 (1~2분)
```

이 2단계만 사용자가 해주면 됨.

#### 내가 할 것 (30분)

**Step 3: backend 에 GTM API 클라이언트 추가**

`backend/src/gtm.ts` (신규 파일) 생성:
- `google.tagmanager('v2')` 클라이언트 초기화
- service account 인증 (기존 GA4 에서 쓰는 `JWT` 객체 재사용)
- 함수:
  - `listContainers(accountId)`
  - `listTags(accountId, containerId, workspaceId)`
  - `listTriggers(accountId, containerId, workspaceId)`
  - `listVariables(accountId, containerId, workspaceId)`
  - `getTag(accountId, containerId, workspaceId, tagId)` — 단건 상세

**Step 4: routes/gtm.ts 신규 라우터**

```typescript
GET  /api/gtm/containers
GET  /api/gtm/containers/:id/tags
GET  /api/gtm/containers/:id/tags/:tagId
GET  /api/gtm/containers/:id/triggers
GET  /api/gtm/containers/:id/variables
GET  /api/gtm/containers/:id/versions — 버전 히스토리
GET  /api/gtm/tags/search?q=purchase — 이름 검색
GET  /api/gtm/health — API 활성/service account 연결 상태
```

Read-only 로만 제공. edit API (tags.create/update/delete) 는 **제공하지 않음** (보안).

**Step 5: /health 응답 확장**

```json
"apis": {
  "gtm": {
    "apiEnabled": true,
    "containers": { "biocom": "GTM-W2Z6PHN", "coffee": "GTM-5M33GC4" },
    "lastTagCount": { "biocom": 45, "coffee": 12 },
    "ready": true
  }
}
```

**Step 6: tsc / build / VM 재배포**

### 옵션 A 로 자동화 가능한 작업 리스트

권한만 생기면 이런 질문에 즉시 답할 수 있음:

- "biocom GTM 에서 현재 **활성**인 모든 purchase 태그는?"
- "각 purchase 태그가 어느 GA4 측정 ID 에 연결돼 있나?"
- "일시중지된 태그 전수 목록과 중지일?"
- "최근 1주일 내 수정된 태그는?"
- "지금 `G-8GZ48B1S59` 에 연결된 태그 전수?"
- "`dlv_price_vlaue` 변수의 정의는? (참고: 이번 스크린샷에 오타 의심 — `value` 아닌 `vlaue`)"
- "같은 이벤트 이름(purchase) 이 복수 태그에 등록된 경우 중복 발사 여부?"
- 버전 히스토리로 "왜 `GA4_구매전환_Npay` 가 일시중지됐는지" 추적 (부분 가능 — 수정자·일시 정도)

### 권한 범위 — **Read-only 유지 권고**

| 권한 | 허용 범위 | 위험 |
|---|---|---|
| **Read** (권고) | 태그·트리거·변수·버전 **조회만** | 0. 리포팅·진단 전용 |
| Edit | 작업공간에 태그 추가/수정 | 중간. 초안만 만들지만 publish 전엔 영향 없음 |
| Publish | 컨테이너 버전 publish | 🔴 높음. live 사이트에 즉시 배포. **권고 안 함** |

**이유**: 내 판단 오류(오늘 3번 돌린 toss 진단 사이클) 가 GTM 에서 일어나면 **사이트 전체 추적 붕괴** 가능. 모든 수정은 사람이 GTM UI 에서 직접 하고, 나는 "읽고 분석하고 권고만" 하는 원칙 유지.

### 보안 고려 3가지

1. **Service account 이메일 노출**: `seo-656@seo-aeo-487113.iam.gserviceaccount.com` 가 git 에 남아도 키(private_key) 없이는 무의미. Email 자체는 공개돼도 안전
2. **권한 최소화**: GTM 읽기 권한만. edit/publish 부여 금지
3. **감사 로깅**: 내가 호출한 GTM API 요청은 backend 로그에 기록되도록 `obs.log` 로 event 남기기. 이상 패턴 발생 시 추적 가능

### 옵션 B 간이 경로 (선 적용 가능)

옵션 A 설정 중에 바로 쓰고 싶으면 옵션 B 로 임시 시작:

```
GTM 관리자 → 관리자 → 컨테이너 내보내기
→ "모든 컨테이너" 또는 특정 버전 선택
→ JSON 다운로드
→ /Users/vibetj/coding/seo/gtm/biocom-GTM-W2Z6PHN-v{N}.json 저장
→ 나한테 "파일 준비됨" 알려주기
→ 내가 파일 파싱해서 태그 전수 분석
```

이 경로는 옵션 A 가 완성될 때까지 **1회성 snapshot** 용으로 병행 가능.

### 한계 — 권한이 있어도 내가 못 하는 것

- **의사결정은 여전히 사람**: 내가 "이 태그를 꺼야 할 것 같다" 고 권고는 해도 실제 변경은 사람이 GTM UI 에서 실행
- **버전 히스토리의 수동 설명 추적**: "왜 이 태그를 일시중지했나" 같은 context 는 GTM 버전 노트에 남긴 사람만 앎
- **실시간 알림 아님**: 내가 능동 push 로 "변경됐어요" 알리는 건 아님. 사용자가 묻거나 내가 주기적 체크해야 함
- **태그 실행 로그(실제 발사 횟수)**: GTM API 가 제공 안 함. 이건 GA4 측에서 이벤트 카운트로 역추적해야 함

### 권고 결정

**내일 사용자가 할 일에 Step 1~2 추가**:

| 이번 주 작업 | 내용 | 소요 |
|---|---|---|
| 1. 커피 Toss 새 법인 키 교체 | 사업부 이전 대응 | 10분 |
| 2. 정본 GA4_구매전환_Npay 재활성화 | ✅ 완료 |
| 3. **GTM service account 초대** | biocom + coffee 컨테이너에 seo-656@... 추가 + GCP Tag Manager API enable | 10분 |
| 4. imweb/toss 자동 sync 코드 VM 배포 | 오늘 구현한 것 | 15분 |

**내가 대기 중인 것** — Step 3 완료되면:
- backend `gtm.ts` + `routes/gtm.ts` 구현 (30분)
- `curl http://localhost:7020/api/gtm/containers/GTM-W2Z6PHN/tags?filter=purchase` 로 즉시 전수 확인
- `googleadstictok.md` 의 "설치 확인 결과" 섹션을 **실시간 API 조회 결과로 갱신**
- 향후 태그 변경 발생 시 사용자가 스크린샷 안 보내도 내가 직접 확인 가능

### 이 권한이 앞으로 해결할 수 있는 사각지대

1. **정본/비정본 GA4 태그 역전** 같은 현상을 **자동 감지** — 주기적 audit 스크립트로 "같은 이벤트가 서로 다른 GA4 속성에 연결된 경우" 알림
2. **Google Ads 계정 공유 상황** (오늘 발견한 `AW-304339096` biocom+coffee 공유) 같은 태그 conflict 자동 진단
3. **GTM 변수 오타** (예: 이번 스크린샷의 `dlv_price_vlaue` — `value` 오타 의심) 같은 정적 검사
4. **Meta Pixel ID 중복 설치** (오늘 해결한 `993029601940881` 같은 레거시) GTM 내부에 남아있는지 전수 조사
5. **태그 수정 감사** — 주기적 diff 로 "지난 주 대비 새로 추가·수정·삭제된 태그" 리스트

---

## 🚨 2026-04-14 긴급 업데이트 — **GA4_구매전환_Npay 태그: 정본/비정본 역전 발견**

> 사용자가 GTM 관리자 화면에서 `GA4_구매전환_Npay` 태그 2개 스크린샷을 공유. 이 문서에 이미 기록된 "정본(`G-WJFXN5E2Q1`) 유지 + 비정본(`G-8GZ48B1S59`) 중지" 방향과 **실제 상태가 정반대**임이 드러남.

### 실제 GTM 태그 현황

| 태그 이름 | 측정 ID (GA4) | 상태 | 의미 |
|---|---|---|---|
| **`GA4_구매전환_Npay`** | **`G-WJFXN5E2Q1`** (**정본**) | ⏸ **일시중지** | 정본 GA4 로 네이버페이 purchase 이벤트가 나가지 **않음** |
| **`GA4_구매전환_Npay 2`** | **`G-8GZ48B1S59`** (**비정본**) | ✅ **활성** | 비정본 GA4 에 네이버페이 purchase 이벤트가 나감 |

두 태그 모두 구성 동일:
- 이벤트 이름: `purchase`
- 매개변수: `currency=KRW`, `pay_method=npay`, `value={{dlv_price_vlaue}}`, `user_time={{USER_TIME}}`
- 트리거: `purchase_npay_mo` + `purchase_npay_pc` (맞춤 이벤트)

### 해석 — 이게 왜 문제인가

**문제 1 — 정본 GA4 에 네이버페이 구매 데이터 누락**
- 현재 정본 `G-WJFXN5E2Q1` 에는 네이버페이 purchase 이벤트가 들어가지 않음
- biocom 주문 중 네이버페이 비중이 낮지 않음 (이전 기록상 `pay_type=npay` 주문 존재 확인). 누락 규모가 작지 않을 가능성
- **GA4 → Google Ads 연동 source 가 정본이라면 Google Ads 측 conversion 에서 네이버페이 구매가 집계되지 않음** → 광고 ROAS 과소 집계

**문제 2 — 문서 방향과 실제 운영 상태 불일치**
- 본 문서(위 섹션) 는 "정본 유지, 비정본 중지" 로 판단했지만 실제는 정본이 꺼져 있음
- 이게 의도된 것인지, 실수로 꺼둔 것인지, 또는 과거 어떤 이슈 때문에 일시중지했는데 재활성화를 깜빡한 건지 확인 필요

**문제 3 — 카드결제 purchase 태그는 어디에 연결돼 있는가**
- 이 세션에서는 Npay 태그 2개만 확인됨
- 일반 카드결제 purchase 태그가 `GA4_구매전환_Card` 또는 `GA4_구매전환` 같은 이름으로 **정본과 비정본 양쪽에 각각 존재** 하는지, 아니면 하나만 활성인지 확인 필요
- 카드 purchase 는 정본에 정상 발사되고 **네이버페이만 누락** 이라면 네이버페이 쪽만 부분 누락. 전부 비정본에 연결됐으면 GA4 구매 데이터 전체가 비정본으로만 흘러간다는 뜻 (더 심각)

### 💡 검토 결론 — **정본(`G-WJFXN5E2Q1`) 쪽 태그 활성화 필요**

**권고 단계**:

#### Step 1: 현황 재확인 (5분, GTM admin)
- GTM `GTM-W2Z6PHN` 관리자 화면 접속
- `purchase` 로 태그 검색해서 **현재 활성화된 purchase 태그 전부** 나열
- 각 태그의 측정 ID (`G-WJFXN...` vs `G-8GZ...`) 와 트리거 확인
- 특히 카드결제·가상계좌 purchase 태그의 GA4 연결 상태
- 목표: "정본에 있는 purchase 태그 / 비정본에 있는 purchase 태그" 를 정확히 매핑

#### Step 2: `GA4_구매전환_Npay` (정본) 일시중지 이유 확인
- GTM 태그 버전 히스토리에서 언제 일시중지됐는지
- 일시중지 사유 코멘트가 있는지
- 일시중지가 **의도적**인 경우 → 이유 파악 후 판단. 예: 과거 이벤트 중복 이슈, dlv_price_vlaue 변수 오류 등
- **실수**인 경우 → 즉시 재활성화

#### Step 3: 정본 활성화 (권고)
- `GA4_구매전환_Npay` (정본 `G-WJFXN5E2Q1`) 을 **활성화**
- GTM Workspace → Submit → Publish
- 효과: 네이버페이 구매가 정본 GA4 에도 수집되기 시작. 내일부터 리포트에 반영

#### Step 4: 비정본(`G-8GZ48B1S59`) `GA4_구매전환_Npay 2` 를 어떻게 할지
- **옵션 A**: 일시중지. 정본으로 일원화. 비정본 GA4 는 deprecated
- **옵션 B**: 병행 유지. 양쪽 GA4 에 같은 이벤트가 각 1회씩 발사됨 (서로 다른 속성이라 중복 카운트 없음). 마이그레이션 기간 동안 일시 유지
- **옵션 C**: 비정본 GA4 속성 자체를 완전 제거 (데이터 보존이 필요 없으면)

**권고**: **B (병행 1~2주) → 이후 A (비정본 중지)**. 이유:
- 마이그레이션 중 둘 다 켜두면 어느 쪽이든 데이터 누락 없음
- 1~2주 후 GA4 정본 리포트에서 네이버페이 매출이 정상 집계되는 것을 확인한 뒤 비정본 중지
- 다른 이벤트(`add_to_cart`, `subscription_completed` 등 비정본에만 있는 것)도 같은 절차로 점진 이전

### ⚠️ 중복 이벤트 걱정은 없소

혹시나 "두 태그가 모두 활성이면 purchase 이벤트가 2배 카운트되는 것 아닌가?" 라는 걱정:
- **아니오**. 두 태그는 서로 **다른 GA4 속성**(`G-WJFXN5E2Q1` vs `G-8GZ48B1S59`) 으로 이벤트를 보냄
- 각 GA4 속성 내부에서 1회씩 수신 → 속성별로 독립 집계
- 같은 GA4 속성 안에서 같은 이벤트가 두 번 발사되는 것이 아니므로 **중복 카운트 아님**
- 유일한 비용은 네트워크 요청 2회 (사용자 브라우저에서 → 각 GA4 endpoint 로 각 1회)

### 📋 사용자 확인 체크리스트 (내일 GTM admin 에서)

- [ ] `GA4_구매전환_Npay` (WJFXN) 가 왜 일시중지됐는지 이력 확인
- [ ] `GA4_구매전환_Card` / `GA4_구매전환` 등 **일반 카드결제 purchase 태그** 의 GA4 연결 상태 확인
  - 정본 쪽에 있는가? 비정본 쪽에 있는가? 둘 다?
- [ ] **가상계좌 결제 purchase 태그** (있다면) 의 GA4 연결 상태
- [ ] `AddPaymentInfo`, `InitiateCheckout` 같은 funnel 이벤트 태그의 GA4 연결 상태 (일관성 확인)
- [ ] 결정: 정본 `GA4_구매전환_Npay` 재활성화 + 병행 유지 (1~2주) → 이후 비정본 중지
- [ ] GA4 정본 속성 (`G-WJFXN5E2Q1`, property `304759974`) 리포트에서 최근 1주일 `purchase` 이벤트를 `pay_method` 로 분해했을 때 `npay` 가 0 인지 확인. 0 이면 지금까지 전혀 안 들어간 것

### 🔗 본 건이 Meta CAPI / ROAS 정합성과의 관계

- Meta CAPI 와는 직접 관계 없음 (Meta Events Manager 는 Meta Pixel 경로만 봄)
- 그러나 **Google Ads ROAS 와 GA4 리포트 일관성**에 핵심 영향
- biocom 의 Google Ads 전환 추적이 **GA4 → Google Ads 자동 연동** 방식이라면, 정본 GA4 의 purchase 이벤트가 누락되면 Google Ads conversion 에도 같이 누락
- Google Ads 광고비 효율 판단의 분자(매출) 가 네이버페이 매출만큼 **과소 집계**
- 정본 GA4 가 BigQuery export 대상이라면 BigQuery 기반 다운스트림 분석도 영향

### 🎯 기존 본 문서의 판단 재확정

본 문서 초반의 "정본 `G-WJFXN5E2Q1` 유지 / 비정본 `G-8GZ48B1S59` 중지" 방향은 **여전히 옳음**. 다만 **실행 상태가 반대로 돼 있어서 방향이 무의미해진 상태**. 지금 필요한 것은:
- **정본을 먼저 활성화**
- **비정본을 나중에 중지** (순서 중요)

만약 "정본을 먼저 활성화하는 순서" 를 빠뜨리면 비정본 중지 시점에 네이버페이 데이터 완전 소멸. 현재 상태가 정확히 그 상태에 가깝음.

---

## 설치 확인 결과

| 사이트 | Google Ads / GTM | TikTok Pixel | 현재 판단 |
| --- | --- | --- | --- |
| `biocom.kr` | 설치 및 루트 페이지 발화 확인 | 설치 및 루트 페이지 발화 확인 | 기본 설치는 확인됨. 구매 이벤트 정합성은 별도 테스트 필요 |
| `thecleancoffee.com` | 설치 및 루트 페이지 발화 확인 | 현재 TikTok 광고 미운영, 루트 페이지 기준 픽셀 미확인 | Google Ads만 현재 정합성 체크 대상 |

### biocom.kr 확인 내용

확인 방식:

- `curl`로 HTML 정적 코드 확인
- Playwright 브라우저 네트워크 요청 확인

확인된 Google 관련 값:

- GTM: `GTM-W2Z6PHN`
- Google Ads: `AW-304339096`
- GA4 정본: `G-WJFXN5E2Q1`
- GA4 사용 중지 검토 대상: `G-8GZ48B1S59`
- 네이버페이/Google Ads trace로 보이는 값: `AW-304339096/r0vuCKvy-8caEJixj5EB`

공개 배포된 GTM 컨테이너 `GTM-W2Z6PHN` 점검 결과:

- `G-WJFXN5E2Q1`는 라이브 컨테이너 안에서 13회 확인됐다.
- `G-8GZ48B1S59`는 라이브 컨테이너 안에서 6회 확인됐다.
- `AW-304339096`는 라이브 컨테이너 안에서 2회 확인됐다.
- `UA-147278175-1`도 라이브 컨테이너 안에서 1회 확인됐다.

`G-8GZ48B1S59`와 연결된 것으로 보이는 라이브 태그:

| tag_id | 이벤트/역할 | 현재 판단 |
| --- | --- | --- |
| 97 | GA4 config로 보임 | 사용 중지 검토 대상 |
| 98 | `purchase` | 특히 우선 확인 필요. 구매 이벤트가 비정본 GA4로 들어갈 수 있음 |
| 100 | `test` | 사용 목적 확인 후 제거 후보 |
| 101 | `add_to_cart` | 정본 GA4로 이전 또는 제거 검토 |
| 103 | `subscription_completed` | 정본 GA4로 이전 또는 제거 검토 |
| 105 | `cancel_subscription` | 정본 GA4로 이전 또는 제거 검토 |

`G-WJFXN5E2Q1`와 연결된 것으로 보이는 라이브 태그:

| tag_id | 이벤트/역할 |
| --- | --- |
| 21 | `page_view_long` |
| 38 | GA4 config로 보임 |
| 49 | `sign_up` |
| 57 | `conseling_complete` |
| 63 | `review_submit` |
| 65 | `supplements_payment` |
| 70 | `test` |
| 79 | `consult_complete` |
| 83 | `3test_payment` |
| 171 | `user_id` |
| 179 | `add_to_cart_view_custom` |

현재 해석:

- 정본 GA4가 `G-WJFXN5E2Q1`라면 `G-8GZ48B1S59`로 나가는 태그는 점진적으로 중지하는 방향이 맞다.
- 특히 `purchase`가 `G-8GZ48B1S59`에 연결된 것으로 보여서, GA4 구매 데이터가 정본과 비정본으로 갈라질 가능성이 있다.
- 바로 삭제하기보다는 GTM 관리자 화면에서 태그명, 트리거, 최근 발화 상태, GA4 보고서 사용 여부를 확인한 뒤 비활성화하는 게 안전하다.

확인된 TikTok 관련 값:

- 사이트 로컬 스크립트: `/js/tiktok_pixel.js?1757999653`
- 콘솔 로그: `tiktok-pixel start`
- TikTok Pixel SDK ID: `D5G8FTBC77UAODHQ0KOG`
- 실제 네트워크 요청:
  - `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=D5G8FTBC77UAODHQ0KOG&lib=ttq`
  - `https://analytics.tiktok.com/api/v2/pixel`
  - `https://analytics.tiktok.com/api/v2/pixel/act`
  - `https://analytics.tiktok.com/api/v2/pixel/inter`

주의점:

- 현재 확인은 메인 페이지 기준이다.
- ROAS 정합성에는 구매 완료 페이지에서 어떤 이벤트가 어떤 값으로 나가는지가 더 중요하다.
- biocom TikTok 로컬 스크립트는 `event_id`를 `event_name + '_' + event_id` 형태로 가공한다. 나중에 TikTok Events API를 붙이면 서버 이벤트와 브라우저 이벤트의 dedup 키 설계를 이 규칙에 맞춰야 한다.

### GTM 관리자 접근 가능성

현재 내가 직접 가능한 것:

- 공개 배포된 GTM 컨테이너 JS를 가져와서 현재 라이브 사이트에 내려오는 태그 ID, GA4 측정 ID, Google Ads ID를 확인할 수 있다.
- 브라우저 네트워크 요청으로 실제 페이지에서 어떤 요청이 나가는지 확인할 수 있다.
- 공개 컨테이너에 포함된 `tag_id`, `eventName`, `measurementIdOverride`, `AW ID` 정도는 추정할 수 있다.

현재 내가 직접 불가능한 것:

- Google Tag Manager 관리자 화면에 로그인해서 태그명, 폴더, 트리거명, 변수명, 미게시 변경사항, 최근 수정자, 버전 히스토리를 직접 보는 것은 권한 없이는 불가능하다.
- GTM API도 OAuth 권한이 필요하므로, 현재 로컬 코드만으로는 관리자 수준의 활성 태그 목록을 가져올 수 없다.
- 공개 컨테이너에서 보이는 것은 “현재 배포되어 브라우저에 내려오는 코드”이지, GTM UI의 전체 설정 원본은 아니다.

TJ님이 할 수 있는 확인:

- GTM `GTM-W2Z6PHN` 관리자 화면에서 `G-8GZ48B1S59`로 검색한다.
- 검색된 태그 중 `purchase`, `add_to_cart`, `subscription_completed`, `cancel_subscription` 관련 태그의 트리거와 최근 사용 여부를 확인한다.
- 해당 GA4 속성이 실제 보고서나 광고 연동에 쓰이지 않는다면 일시정지 후 1-2일 모니터링한다.
- 문제가 없으면 삭제보다 먼저 “사용 안 함” 상태로 유지하고, 정본 `G-WJFXN5E2Q1`로 이벤트가 정상 수집되는지 확인한다.

### thecleancoffee.com 확인 내용

확인 방식:

- `curl`로 HTML 정적 코드 확인
- Playwright 브라우저 네트워크 요청 확인

확인된 Google 관련 값:

- GTM: `GTM-5M33GC4`
- Google Ads: `AW-304339096`
- Google Ads: `AW-10965703590`
- GA4: `G-JLSBXX7300`
- UA: `UA-147278175-3`
- HTML 내 Google Ads conversion snippet:
  - `AW-304339096/Xq1KCMTrt4oDEJixj5EB`
- 네이버페이/Google Ads trace로 보이는 값:
  - `AW-10965703590/OnyOCNDn2NcDEKa37ewo`

확인된 TikTok 관련 값:

- 루트 페이지 정적 HTML과 브라우저 네트워크 기준으로 TikTok Pixel 발화는 확인되지 않았다.
- 현재 더클린커피는 TikTok 광고를 운영하지 않으므로 TikTok 정합성 점검은 즉시 처리 대상에서 제외한다.

주의점:

- 루트 페이지에서 TikTok이 안 보인다고 해서 사이트 전체에 TikTok이 없다고 단정하면 안 된다.
- 다만 현재 TikTok 광고를 운영하지 않으므로, 더클린커피는 Google Ads 정합성부터 보면 된다.
- 나중에 TikTok 광고를 시작할 때는 Pixel 설치 여부와 구매 이벤트 정의를 처음부터 다시 확인해야 한다.

## Phase 요약표

| Phase | 목표 | 현재 상태 | 완성도 |
| --- | --- | --- | --- |
| [Phase 0](#phase-0-기준-정리) | Meta CAPI 기준을 Google/TikTok 계획에 이식 | 완료 | 100% |
| [Phase 1](#phase-1-설치-및-기본-발화-확인) | 두 사이트의 Google/TikTok 설치 여부 1차 확인 | 루트 페이지와 공개 GTM 일부 확인, 구매 플로우 미완료 | 75% |
| [Phase 2](#phase-2-전환-이벤트-정의-정리) | 플랫폼별 “구매” 정의와 내부 confirmed 기준 매핑 | biocom GA4 정본/비정본 이슈 확인 | 25% |
| [Phase 3](#phase-3-테스트-주문-네트워크-검증) | 카드/가상계좌/네이버페이 결제에서 실제 전송 이벤트 확인 | 시작 전 | 0% |
| [Phase 4](#phase-4-서버-또는-원장-기반-정합성-확장) | Google/TikTok도 confirmed-only 서버 이벤트로 보낼지 검토 | 시작 전 | 0% |
| [Phase 5](#phase-5-플랫폼-roas와-내부-roas-대조) | Google Ads/TikTok ROAS와 내부 ROAS 차이 원인 분해 | 시작 전 | 0% |
| [Phase 6](#phase-6-운영-판단-룰-정리) | 광고 증액/감액 판단 기준 확정 | 시작 전 | 0% |

## Phase 0. 기준 정리

목표:

Meta CAPI에서 정리한 구매 이벤트 원칙을 Google Ads와 TikTok에도 동일하게 적용한다.

| 순서 | 담당 | 상태 | 작업 |
| --- | --- | --- | --- |
| 1 | 나 | 완료 | `capivm/capi.md`를 읽고 현재 Meta 기준을 정리한다. |
| 2 | 나 | 완료 | Google/TikTok 계획의 기준을 “confirmed 주문만 구매”로 고정한다. |
| 3 | TJ님 | 완료 | Meta에서 카드 결제 Purchase와 가상계좌 미입금 VirtualAccountIssued 분리가 되는 테스트 증거를 제공했다. |

현재 기준:

- 카드 결제 confirmed: Purchase 허용
- 가상계좌 미입금 pending: Purchase 차단, 별도 이벤트로 분리
- 서버 CAPI: confirmed 주문만 Purchase 전송
- event_id: 주문 단위로 중복 제거 가능한 값 사용

Google Ads와 TikTok도 같은 원칙으로 봐야 한다. 결제완료 페이지에 도착했다는 이유만으로 구매 전환을 잡으면 플랫폼 ROAS가 실제보다 높아질 수 있다.

## Phase 1. 설치 및 기본 발화 확인

목표:

두 사이트에 Google Ads와 TikTok 픽셀이 실제로 설치되어 있고, 브라우저에서 기본 요청이 나가는지 확인한다.

| 순서 | 담당 | 상태 | 작업 |
| --- | --- | --- | --- |
| 1 | 나 | 완료 | `biocom.kr` HTML에서 Google Ads, GTM, TikTok 코드 존재 여부를 확인했다. |
| 2 | 나 | 완료 | `biocom.kr` 브라우저 네트워크에서 Google Ads와 TikTok 요청 발화를 확인했다. |
| 3 | 나 | 완료 | `thecleancoffee.com` HTML에서 Google Ads, GTM 코드를 확인했다. |
| 4 | 나 | 완료 | `thecleancoffee.com` 브라우저 네트워크에서 Google Ads 요청 발화를 확인했다. |
| 5 | 나 | 완료 | `biocom.kr` 공개 GTM 컨테이너에서 `G-WJFXN5E2Q1`, `G-8GZ48B1S59`, `AW-304339096` 포함 여부를 확인했다. |
| 6 | 나 | 일부 완료 | `thecleancoffee.com` 루트 페이지에서는 TikTok 요청을 찾지 못했다. 현재 TikTok 광고 미운영이므로 후순위로 둔다. |
| 7 | TJ님 | 대기 | GTM 관리자 화면에서 `G-8GZ48B1S59` 검색 후 태그명/트리거/최근 사용 여부를 확인한다. |
| 8 | 나 | 대기 | 상품 상세, 장바구니, 결제 시작, 결제 완료 페이지까지 확장해서 이벤트를 다시 확인한다. |

왜 필요한가:

루트 페이지에서 태그가 보이는 것과 ROAS 계산에 쓰이는 구매 전환이 정상이라는 것은 다르다. 구매 전환은 결제 플로우에서 따로 확인해야 한다.

현재 결론:

- biocom Google Ads: 기본 설치 확인
- biocom TikTok: 기본 설치 확인
- biocom GA4: 정본 `G-WJFXN5E2Q1` 외에 `G-8GZ48B1S59`가 라이브 GTM에 남아 있음
- 더클린커피 Google Ads: 기본 설치 확인
- 더클린커피 TikTok: 현재 광고 미운영, 루트 페이지 기준 픽셀 미확인

## Phase 2. 전환 이벤트 정의 정리

목표:

Google Ads와 TikTok에서 어떤 이벤트가 “구매”로 잡히는지, 그 이벤트가 내부 confirmed 주문과 맞는지 정리한다.

| 순서 | 담당 | 상태 | 작업 |
| --- | --- | --- | --- |
| 1 | TJ님 | 대기 | Google Ads 전환 액션 목록을 확인한다. 전환 이름, 전환 ID/라벨, 집계 기준, 전환 가치 사용 여부가 필요하다. |
| 2 | TJ님 | 대기 | biocom GTM에서 `G-8GZ48B1S59` 연결 태그를 확인한다. 특히 `purchase` 태그가 아직 필요한지 확인한다. |
| 3 | 나 | 대기 | Google Ads 전환 라벨 중 실제 구매 ROAS에 쓰이는 라벨을 분리한다. |
| 4 | 나 | 대기 | `G-8GZ48B1S59` 이벤트를 정본 `G-WJFXN5E2Q1`로 이전해야 하는지 이벤트별로 정리한다. |
| 5 | 나 | 대기 | TikTok에서 `CompletePayment`, `Purchase`, `PlaceAnOrder` 등 어떤 이벤트를 구매로 쓰는지 확인한다. 단, 더클린커피는 현재 TikTok 광고 미운영이라 제외한다. |
| 6 | 나 | 대기 | 내부 원장 기준의 `confirmed`, `pending`, `cancelled` 상태와 플랫폼 이벤트를 매핑한다. |

확인해야 할 항목:

- Google Ads 구매 전환 액션명
- Google Ads conversion ID와 label
- 전환 가치가 동적으로 들어가는지, 고정값인지
- 전환 집계 방식이 every인지 one인지
- 전환 추적 기간
- 조회 후 전환 포함 여부
- TikTok 구매 이벤트명
- TikTok Pixel ID
- TikTok Events API 사용 여부
- TikTok dedup event_id 사용 여부

biocom GA4 정본화 체크:

- `G-WJFXN5E2Q1`가 실제 GA4 보고서와 BigQuery/Looker/운영 대시보드에서 쓰이는 정본인지 확인한다.
- `G-8GZ48B1S59`가 과거 테스트/레거시 속성이라면 GTM에서 일시정지한다.
- 단, 바로 삭제하지 말고 `purchase` 이벤트가 정본 GA4로 정상 전송되는지 먼저 확인한다.
- `G-8GZ48B1S59`의 `purchase`가 현재 유일한 구매 이벤트라면, 중지 전에 `G-WJFXN5E2Q1`로 동일 이벤트를 이전해야 한다.

왜 필요한가:

Google Ads와 TikTok은 설치된 태그가 여러 개일 수 있다. 어떤 태그가 실제 ROAS 계산에 쓰이는지 모르면, 내부 ROAS와 차이가 나도 원인을 분해할 수 없다.

## Phase 3. 테스트 주문 네트워크 검증

목표:

실제 테스트 주문에서 Google Ads와 TikTok이 구매 이벤트를 어떻게 보내는지 확인한다.

| 순서 | 담당 | 상태 | 작업 |
| --- | --- | --- | --- |
| 1 | TJ님 | 대기 | biocom 카드 결제 테스트 주문 1건을 만든다. |
| 2 | 나 | 대기 | 카드 결제 완료 페이지에서 Google Ads 구매 요청이 있는지 확인한다. |
| 3 | 나 | 대기 | 카드 결제 완료 페이지에서 TikTok 구매 요청이 있는지 확인한다. |
| 4 | TJ님 | 대기 | biocom 가상계좌 미입금 주문 1건을 만든다. |
| 5 | 나 | 대기 | 가상계좌 미입금에서 Google Ads/TikTok 구매 이벤트가 나가는지 확인한다. 나가면 과대계상 후보로 기록한다. |
| 6 | TJ님 | 대기 | 가능하면 더클린커피 카드 결제 또는 테스트 가능한 결제 플로우를 제공한다. |
| 7 | 나 | 대기 | 더클린커피 결제 완료 이벤트를 같은 방식으로 확인한다. |

네트워크에서 볼 요청:

- Google Ads:
  - `googleadservices.com/pagead/conversion`
  - `google.com/pagead/1p-conversion`
  - `google.com/pagead/1p-user-list`
  - `www.googletagmanager.com/gtag/js?id=AW-...`
- TikTok:
  - `analytics.tiktok.com/api/v2/pixel`
  - `analytics.tiktok.com/api/v2/pixel/act`
  - `analytics.tiktok.com/api/v2/pixel/inter`
  - `event`, `event_id`, `value`, `currency`, `contents`

검증 기준:

- 카드 confirmed 주문에서는 구매 전환이 1회만 나가야 한다.
- 가상계좌 미입금 주문에서는 구매 전환이 나가면 안 된다.
- 구매 전환값은 실제 결제 금액과 맞아야 한다.
- 주문 식별자는 내부 원장과 대조 가능한 값이어야 한다.
- 같은 주문이 브라우저와 서버 양쪽에서 나가면 dedup 키가 있어야 한다.

## Phase 4. 서버 또는 원장 기반 정합성 확장

목표:

Google Ads와 TikTok도 Meta CAPI처럼 서버 또는 원장 기준으로 confirmed-only 전환을 보낼 필요가 있는지 검토한다.

| 순서 | 담당 | 상태 | 작업 |
| --- | --- | --- | --- |
| 1 | 나 | 대기 | Google Ads Enhanced Conversions 또는 Offline Conversion Import가 현재 상황에 맞는지 검토한다. |
| 2 | 나 | 대기 | TikTok Events API가 현재 CAPI 백엔드 구조에 붙을 수 있는지 검토한다. |
| 3 | TJ님 | 대기 | Google Ads API, TikTok Business API 접근 권한 또는 관리자 초대가 가능한지 확인한다. |
| 4 | 나 | 대기 | 서버 전송을 붙일 경우 confirmed 주문만 보내는 구조를 설계한다. |
| 5 | 나 | 대기 | 브라우저 이벤트와 서버 이벤트의 중복 제거 키를 설계한다. |

우선순위 판단:

- Google Ads/TikTok 구매 이벤트가 이미 confirmed-only로 잘 나가면 서버 전송은 후순위다.
- 가상계좌 미입금이나 중복 구매가 잡히면 서버/원장 기반 전환 전송이 필요해진다.
- ROAS 차이가 크고 플랫폼 이벤트 원인이 확인되면, Meta CAPI 백엔드를 확장하는 것이 현실적인 선택지다.

## Phase 5. 플랫폼 ROAS와 내부 ROAS 대조

목표:

Google Ads와 TikTok의 광고 관리자 ROAS가 내부 Attribution ROAS와 왜 다른지 숫자로 분해한다.

| 순서 | 담당 | 상태 | 작업 |
| --- | --- | --- | --- |
| 1 | TJ님 | 대기 | Google Ads 캠페인 리포트를 export한다. |
| 2 | TJ님 | 대기 | TikTok Ads 캠페인 리포트를 export한다. |
| 3 | 나 | 대기 | 내부 Attribution 매출과 플랫폼 전환값을 기간별로 대조한다. |
| 4 | 나 | 대기 | 차이를 이벤트 문제, 전환 기간 문제, 조회 후 전환 문제, pending 구매 문제, 네이버페이 문제로 분해한다. |
| 5 | 나 | 대기 | 운영 판단용 기준 ROAS를 정리한다. |

필요한 Google Ads export 컬럼:

- 날짜
- 캠페인명
- 캠페인 ID
- 광고그룹명
- 광고그룹 ID
- 광고명
- 광고 ID
- 비용
- 전환
- 전환 가치
- 전환 액션
- 전환 기준 또는 attribution model

필요한 TikTok export 컬럼:

- 날짜
- Campaign name / ID
- Ad group name / ID
- Ad name / ID
- Cost
- Complete Payment 또는 Purchase 수
- Purchase value
- Attribution window
- Event name

대조 관점:

- 플랫폼 전환 기간이 내부 기준보다 긴가
- 조회 후 전환이 포함되는가
- pending 주문이 구매로 잡히는가
- 결제 완료 페이지에서 구매 이벤트가 중복 발화되는가
- 네이버페이처럼 자사몰로 돌아오지 않는 결제 수단이 플랫폼에만 잡히거나 내부에만 잡히는가
- Google Ads/TikTok 태그가 여러 개라 같은 주문을 중복으로 잡는가
- 환불/취소가 플랫폼에 반영되는가

## Phase 6. 운영 판단 룰 정리

목표:

Google Ads/TikTok 광고를 증액, 유지, 감액할 때 어떤 ROAS를 기준으로 볼지 정한다.

| 순서 | 담당 | 상태 | 작업 |
| --- | --- | --- | --- |
| 1 | 나 | 대기 | 내부 Attribution confirmed ROAS를 운영 기준으로 둘지 정리한다. |
| 2 | 나 | 대기 | Google Ads/TikTok 플랫폼 ROAS는 어떤 조건에서 참고값으로 쓸지 정리한다. |
| 3 | TJ님 | 대기 | 실제 광고 운영 의사결정에 필요한 최소 기준 ROAS와 마진 기준을 제공한다. |
| 4 | 나 | 대기 | 최종 운영 룰을 문서화한다. |

초안 룰:

- 메인 운영 기준: 내부 confirmed ROAS
- 보조 기준: 플랫폼 click-only 또는 짧은 attribution window ROAS
- 제외 또는 별도 표시: pending 주문, 가상계좌 미입금, 테스트 주문
- 추가 확인 필요: 네이버페이 구매, 서버 이벤트 중복, 환불/취소 반영

## 바로 다음에 할 일

1. biocom 결제 플로우에서 Google Ads와 TikTok 구매 이벤트를 카드/가상계좌로 각각 확인한다.
2. biocom GTM에서 `G-8GZ48B1S59` 연결 태그를 검색하고, `purchase`가 왜 비정본 GA4로 가는지 확인한다.
3. `G-8GZ48B1S59`를 바로 삭제하지 말고, `G-WJFXN5E2Q1`로 구매 이벤트가 정상 수집되는지 먼저 확인한다.
4. Google Ads 전환 액션 목록을 확보해서 어떤 conversion label이 ROAS에 쓰이는지 정리한다.
5. 플랫폼 리포트 export를 받아 내부 Attribution ROAS와 같은 기간으로 대조한다.

## 현재 결론

biocom은 Google Ads와 TikTok 모두 기본 설치와 루트 페이지 발화가 확인됐다. 따라서 다음 병목은 설치 여부가 아니라 구매 이벤트 정합성이다. 추가로, GA4 정본은 `G-WJFXN5E2Q1`인데 공개 GTM 기준 `G-8GZ48B1S59`로 연결된 구매 관련 태그가 남아 있어 정리 대상이다.

더클린커피는 Google Ads 설치와 발화는 확인됐고, 현재 TikTok 광고를 운영하지 않으므로 TikTok 정합성 체크는 후순위다.

Google Ads와 TikTok ROAS도 Meta ROAS와 같은 문제가 생길 수 있다. 결제완료 페이지 도착만으로 구매를 잡거나, 가상계좌 미입금 주문을 구매로 잡거나, 조회 후 전환을 크게 포함하면 내부 Attribution ROAS보다 높게 보일 수 있다. 따라서 다음 단계는 “태그 설치 확인”이 아니라 “결제수단별 구매 이벤트가 confirmed 기준과 맞는지 확인”이다.
