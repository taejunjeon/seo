# 네이버/메타/구글 유입 분석 현재 상태 정본 가이드

작성 시각: 2026-05-21 23:59 KST
기준일: 2026-05-21
문서 성격: 개발계획이 아니라 현재 운영 판단 기준을 설명하는 정본 가이드

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  required_context_docs:
    - docurule.md
    - data/!data_inventory.md
    - project/naver-channel-classification-dry-run-20260521.md
    - project/naver-acquisition-analysis-green-audit-20260521.md
  lane: Green
  allowed_actions:
    - current_state_documentation
    - read_only_source_summary
    - no_send_no_write_guide
  forbidden_actions:
    - backend_deploy
    - vm_cloud_data_write
    - operational_db_write
    - gtm_publish
    - imweb_save
    - platform_send_or_upload
  source_window_freshness_confidence:
    source: VM Cloud SQLite inventory + live public API read-only audit + local code audit
    window: biocom rolling 24h / rolling 7d / last_7d
    freshness: 2026-05-21 23:59 KST
    confidence: medium_high
```

## 10초 요약

네이버, 메타, 구글 유입 분석은 같은 숫자를 보는 일이 아니다. `광고 플랫폼이 주장하는 성과`, `우리 사이트가 본 클릭/방문 흔적`, `실제 결제완료 원장`을 분리해서 봐야 한다.

예산 판단에 가장 가까운 값은 `광고비 source + 내부 confirmed 주문 원장 + 클릭/유입 evidence`가 함께 맞는 값이다. Meta/Google/Naver 화면의 플랫폼 ROAS는 참고값이고, browser pixel 이벤트나 결제 시작 이벤트는 구매완료가 아니다.

앞으로 보고할 때는 각 항목 옆에 속성을 같이 쓴다. 예: `site_landing_ledger (속성: VM Cloud SQLite 테이블)`, `/api/acquisition/channel-analysis (속성: API endpoint)`, `/ads/google-roas-report (속성: 프론트 화면)`.

## 속성 이름 기준

| 속성 | 뜻 | 예시 | 주의 |
|---|---|---|---|
| VM Cloud SQLite 테이블 | `att.ainativeos.net` 백엔드가 실시간 수집하거나 보조 원장으로 쓰는 SQLite 테이블 | `site_landing_ledger`, `attribution_ledger`, `paid_click_intent_ledger` | 운영DB가 아니다. 실시간 tracking source of truth로 본다 |
| 운영DB 테이블 | 개발팀이 관리하는 PostgreSQL dashboard DB 테이블 | `dashboard.public.tb_iamweb_users` | 운영 결제/회원 cross-check source다. 승인 없는 write 금지 |
| 로컬 SQLite 테이블 | 이 MacBook의 개발/분석용 SQLite 테이블 | `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` | live 수신 정본이 아니다. 백필/분석에는 더 풍부할 수 있다 |
| API endpoint | 프론트나 외부 호출자가 읽는 서버 URL 기능 | `/api/attribution/acquisition-summary`, `/api/acquisition/channel-analysis` | 테이블이 아니다. 내부에서 여러 source를 읽어 가공한다 |
| 백엔드 분석 기능 | API 또는 스크립트가 쓰는 코드 로직 | `backend/src/acquisitionAnalysis.ts`, `monthly-evidence-join-dry-run.ts` | 코드 기능이다. 데이터 저장소가 아니다 |
| 프론트 화면 | 사람이 보는 화면 | `/ads/google-roas-report`, `/total`, `/ads/naver` | 화면 값은 API/source/window에 따라 달라진다 |
| 외부 플랫폼 지표 | Meta/Google/Naver가 자기 기준으로 계산한 값 | Meta Ads Manager ROAS, Google Ads ROAS, Naver Ads report | 내부 confirmed 매출과 다를 수 있다 |
| 브라우저 이벤트 | 고객 브라우저나 픽셀이 관측한 행동 | Meta `InitiateCheckout`, `AddPaymentInfo`, `VirtualAccountIssued` | 결제완료가 아니다. `Purchase`도 guard 기준을 확인해야 한다 |

## 공통 정본 원칙

1. 방문/유입 수는 `site_landing_ledger`를 우선 본다.
   - 속성: VM Cloud SQLite 테이블
   - 역할: 고객이 어떤 URL/UTM/referrer/click id로 들어왔는지 남기는 고객 유입 장부

2. 결제 시작/결제 페이지 진입은 `attribution_ledger`의 `checkout_started`, `payment_page_seen`을 본다.
   - 속성: VM Cloud SQLite 테이블
   - 역할: 구매 의사가 생겼는지 보는 중간 행동 장부
   - 주의: 결제완료가 아니므로 ROAS 분자로 쓰면 안 된다.

3. 실제 결제완료 수/금액은 `attribution_ledger payment_success confirmed`를 실시간 dashboard 기준으로 본다.
   - 속성: VM Cloud SQLite 테이블
   - 역할: 내부 confirmed ROAS의 분자 후보
   - cross-check: 운영DB `tb_iamweb_users`, Toss/Imweb direct source

4. 광고 클릭과 주문 연결 evidence는 `paid_click_intent_ledger`, `site_landing_ledger`, `attribution_ledger`를 함께 본다.
   - 속성: VM Cloud SQLite 테이블 묶음
   - 역할: 광고 클릭이 실제 주문 흐름과 같은 사람/세션/주문 후보로 이어졌는지 판단
   - 주의: click-intent나 checkout만으로 purchase로 승격하지 않는다.

## 네이버 유입 현재 기준

### 사람이 이해할 결론

네이버는 `NaPm`만 있다고 paid가 아니다. 파워링크, 브랜드검색, 쇼핑검색, 자연검색 후보를 분리해야 한다.

### source별 현재 기준

| 항목 | 속성 | 현재 판단 |
|---|---|---|
| `NaPm tr=sa` 또는 `utm_source=naver` + `utm_medium=cpc/powerlink` + `n_*` 광고 파라미터 | URL evidence | 파워링크 paid 후보 |
| `naverbrandsearch` 또는 `brandsearch` UTM marker | URL evidence | 브랜드검색 후보. 브랜드검색 광고비와 연결될 때만 예산 ROAS 사용 |
| `shopping.naver` referrer 또는 `NaPm tr=slsl` | URL/referrer evidence | 쇼핑검색 후보. 쇼핑 광고비 source 확인 전까지 예산 ROAS 제외 |
| `search.naver.com`, `m.search.naver.com`, `NaPm tr=ds/nexearch` | URL/referrer evidence | 자연/브랜드 검색 후보. 예산 ROAS 제외 |
| `NaPm` 단독 | URL evidence | 네이버 유입 흔적. paid 확정 금지 |

### 네이버 관련 기능

| 이름 | 속성 | 역할 | 현재 주의점 |
|---|---|---|---|
| `site_landing_ledger` | VM Cloud SQLite 테이블 | 네이버 랜딩 URL/referrer/UTM 증거 확인 | 네이버 paid 판단은 raw URL의 `n_*`, `utm_medium`, `NaPm tr`를 파싱해야 한다 |
| `attribution_ledger` | VM Cloud SQLite 테이블 | checkout/payment_success까지 네이버 evidence가 이어졌는지 확인 | 결제 시작과 결제완료를 구분해야 한다 |
| `/api/attribution/acquisition-summary` | API endpoint | 프론트 첫 화면용 broad 유입 요약 | `Naver 검색/쇼핑`은 paid/organic 정본이 아니다 |
| `/api/acquisition/channel-analysis` | API endpoint | GA4 source/medium 기반 채널 분석 | `naverbrandsearch_..._igg`를 Meta로 오인하던 로컬 수정이 배포 대상이다 |
| `/api/ads/naver/campaign-summary` | API endpoint | Naver Ads 비용 + 내부 paid_naver evidence join 참고 | VM Cloud의 `naver_ads_daily` cache source가 아직 운영 연결되지 않아 광고비는 unavailable 상태다 |
| `monthly-evidence-join-dry-run.ts` | 백엔드 분석 스크립트 | paid_naver 내부 주문 후보 dry-run | 광고비 source와 order evidence join을 분리해서 본다 |

### 최근 관측값

source: VM Cloud SQLite read-only + live public API
window: biocom rolling 24h / rolling 7d / last_7d
freshness: 2026-05-21 23:04 KST
confidence: medium_high

- 고객 유입 장부 7일 기준: 오가닉 후보 370 rows, 파워링크 paid 후보 210 rows, 브랜드검색 후보 156 rows, 쇼핑검색 후보 6 rows.
- 주문 경로 장부 7일 기준: 파워링크 `payment_success` 후보 34 rows, 브랜드검색 `payment_success` 후보 18 rows, 오가닉 `checkout_started` 후보 355 rows.
- `/api/attribution/acquisition-summary` last_7d broad Naver row: count 49, confirmed 41, confirmed revenue 12,483,237원. 이 row는 broad 묶음이므로 paid ROAS 판단에는 직접 쓰지 않는다.
- `/api/acquisition/channel-analysis` last_7d Naver group에는 `naver/powerlink`, `m.search.naver.com/referral`, `naverbrandsearch_*`, `naver/organic`, `cr2.shopping.naver.com/referral`이 섞인다.
- Naver Ads 광고비 cache source: 로컬에는 2026-05-06~2026-05-12 `naver_ads_daily` 259 rows가 있지만, VM Cloud에는 table/env/cron이 아직 없다. 2026-05-14~2026-05-20 no-write API 직접 조회에서는 37 campaigns, 259 rows, 광고비 2,062,804원, 클릭 3,524건이 확인됐다. 운영 판단에는 stale local copy가 아니라 VM Cloud read-only sync 연결이 필요하다.

## 메타 유입 현재 기준

### 사람이 이해할 결론

Meta 화면에 찍힌 이벤트는 행동 관측값이다. 실제 예산 판단은 내부 confirmed 주문과 Meta 캠페인/광고비/클릭 evidence가 맞을 때만 한다.

### source별 현재 기준

| 항목 | 속성 | 현재 판단 |
|---|---|---|
| Meta Ads Manager ROAS | 외부 플랫폼 지표 | Meta가 주장하는 값. 내부 예산 판단의 참고값 |
| Meta Pixel `PageView`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo` | 브라우저 이벤트 | 퍼널 행동 관측값. 구매완료 아님 |
| `VirtualAccountIssued` | 브라우저 이벤트 | 가상계좌 주문 생성/미입금. 구매완료 아님 |
| Meta Pixel/CAPI `Purchase` | 브라우저 이벤트 또는 서버 전송 | payment-decision guard와 confirmed source를 확인해야 구매완료로 해석 가능 |
| `attribution_ledger payment_success confirmed` | VM Cloud SQLite 테이블 | 내부 confirmed 매출 기준 |
| Meta CAPI send log | VM Cloud 로그/reader | Meta 서버 전송 여부 확인. 전송 성공과 결제 정본은 분리 |

### 메타 관련 기능

| 이름 | 속성 | 역할 | 현재 주의점 |
|---|---|---|---|
| `payment-decision` | API endpoint | 브라우저 Purchase를 allow/block/unknown으로 판단 | 가상계좌 미입금은 Purchase가 아니라 `VirtualAccountIssued`여야 한다 |
| Imweb header payment guard | Imweb 헤더 코드 | Meta Purchase 오발화를 막고 pending 이벤트를 분리 | 헤더 교체 시 guard version과 value 처리 확인 필요 |
| Imweb footer Block 4 | Imweb 푸터 코드 | Meta funnel fallback 이벤트 발화 | `InitiateCheckout` value/currency가 빠지지 않아야 한다 |
| Meta CAPI route/log | 백엔드 전송 기능/로그 | 서버 이벤트 전송과 중복 제거 확인 | 플랫폼 전송/운영 publish는 Red Lane |
| `/total` | 프론트 화면 | 내부 채널/ROAS 판단 화면 | pixel 이벤트가 아니라 confirmed 매출 기준을 우선해야 한다 |

### 현재 해석 주의

- `VirtualAccountIssued`가 Meta Pixel Helper에 보이는 것은 정상이다. 미입금 가상계좌를 구매완료로 세지 않기 위한 분리 이벤트다.
- `value=0`이었던 문제는 가상계좌 pending 이벤트 자체에서는 치명적이지 않지만, `InitiateCheckout`에는 value/currency가 들어가야 Meta 진단 오류가 줄어든다.
- Meta Events Manager의 진단 메시지는 개선 신호로 참고하되, 내부 confirmed ROAS를 대체하지 않는다.

## 구글 유입 현재 기준

### 사람이 이해할 결론

Google Ads의 실제 성과를 보려면 `gclid/gbraid/wbraid/gad_campaignid`가 랜딩에서 주문 흐름까지 남아야 한다. Google Ads 화면 ROAS가 아니라 내부 결제완료 주문과 click id evidence를 붙여야 내부 ATT ROAS가 된다.

### source별 현재 기준

| 항목 | 속성 | 현재 판단 |
|---|---|---|
| `gclid` | Google click id URL parameter | 가장 직접적인 Google 클릭 evidence |
| `gbraid` | Google click id URL parameter | 앱/웹 privacy 흐름에서 쓰이는 Google click evidence |
| `wbraid` | Google click id URL parameter | iOS 웹-앱 privacy 흐름에서 쓰이는 Google click evidence. stale 혼입 여부 주의 |
| `gad_campaignid` | Google URL parameter | click id가 광고 캠페인으로 바로 역조회되지 않을 때 campaign join 보강 evidence |
| `paid_click_intent_ledger` | VM Cloud SQLite 테이블 | 유료 클릭 의도 no-send 증거 장부 |
| `/ads/google-roas-report` | 프론트 화면 | Google ROAS 정합성 프로젝트 보고 화면 |
| Google Ads ROAS | 외부 플랫폼 지표 | Google이 주장하는 값. 내부 confirmed ROAS와 분리 |

### 구글 관련 기능

| 이름 | 속성 | 역할 | 현재 주의점 |
|---|---|---|---|
| BI / Google Click ID Bootstrap | Imweb 헤더 코드 | 랜딩 순간 gclid/gbraid/wbraid/gad_campaignid 계열 보존 | 헤더 상단에 있어야 하며 빈 값으로 기존 click id를 지우면 안 된다 |
| checkout-context | API endpoint + Imweb 푸터 코드 | 결제 페이지 진입 전 click id를 session context로 보존 | `gad_campaignid`, `gclid/gbraid/wbraid` 누락률을 계속 봐야 한다 |
| payment-success | API endpoint + Imweb 푸터 코드 | 결제완료 URL에서 order/payment key와 click id context를 보존 | pending/confirmed 구분 필요 |
| `paid_click_intent_ledger` | VM Cloud SQLite 테이블 | 광고 클릭 intent row 확인 | no-send evidence다. Google Ads 업로드가 아니다 |
| `/api/ads/google-roas-report` 계열 | API endpoint | 프론트 보고서용 health/coverage 값 | window가 `last_1d`, `rolling_24h`, `last_7d` 중 무엇인지 명시해야 한다 |

### 현재 해석 주의

- `gclid/gbraid/wbraid`만으로 모든 캠페인명이 즉시 풀리는 것은 아니다. 그래서 `gad_campaignid`는 campaign join 보강용으로 필요하다.
- `wbraid`는 privacy 흐름용 Google click id지만, 오래된 값이 결제완료 context로 복원되면 잘못된 클릭과 주문이 붙을 수 있다. 최신 결제 세션 우선순위와 stale guard가 필요하다.
- 내부 confirmed ATT ROAS는 `실제 결제완료 주문 원장 기준값`이다. Google Ads ROAS는 `광고 플랫폼이 주장하는 값`이다.

## 보고할 때의 고정 문장

앞으로 유입 분석 보고에는 아래처럼 쓴다.

1. `acquisition-summary (속성: API endpoint)`는 broad 유입 요약이다. paid/organic 정본 테이블이 아니다.
2. `channel-analysis (속성: API endpoint)`는 GA4 source/medium을 채널로 묶어 보여주는 분석 기능이다. 테이블이 아니다.
3. `site_landing_ledger (속성: VM Cloud SQLite 테이블)`는 고객 유입 장부다.
4. `attribution_ledger (속성: VM Cloud SQLite 테이블)`는 결제 시작/결제 페이지/결제완료 신호 장부다.
5. `paid_click_intent_ledger (속성: VM Cloud SQLite 테이블)`는 유료 광고 클릭 intent 장부다.
6. `Meta/Google/Naver ROAS (속성: 외부 플랫폼 지표)`는 플랫폼 주장값이다.
7. `내부 confirmed ROAS (속성: 내부 결제완료 원장 기준값)`는 예산 판단에 더 가까운 값이다.

## 지금 운영 반영 대기 중인 판단

아래는 이미 로컬에서 보강했고, 2026-05-21 23:27 KST 기준 backend deploy로 VM Cloud에 반영한 상태다.

| 항목 | 속성 | 반영 이유 | 현재 상태 |
|---|---|---|---|
| Naver `NaPm` 단독 paid 제거 | 백엔드 분석 기능 | 오가닉/쇼핑 후보가 paid_naver로 섞이는 것을 줄임 | VM Cloud 배포 완료. `/api/attribution/ledger/naver-evidence-aggregate` 200 |
| `naverbrandsearch_..._igg` Meta 오인 수정 | 백엔드 분석 기능 | `igg` 안의 `ig`를 Instagram으로 오인하지 않게 함 | VM Cloud 배포 완료. `channel-analysis`에서 Naver로 분류 확인 |
| Naver evidence aggregate class 추가 | API endpoint 내부 로직 | 파워링크/브랜드/쇼핑/오가닉 후보를 분리 | VM Cloud 배포 완료. `paid_naver`, `naver_brandsearch`, `naver_shopping_search_candidate`, `organic_naver_candidate`, `naver_referrer_or_utm_only` 분리 확인 |
| Naver Ads cache table 없음 graceful fallback | API endpoint 방어 로직 | VM Cloud에 `naver_ads_daily`가 없을 때 500 대신 `cache_info.available=false`로 원인을 보여줌 | VM Cloud 배포 완료. `/api/ads/naver/campaign-summary` 200 |
| Naver Ads 광고비 cache source 운영 연결 | VM Cloud SQLite sync 경로 | Naver ROAS 분모인 광고비를 최신 상태로 유지 | Green 조사 완료. VM table/env/cron 없음. 제한 one-shot sync 승인 필요 |

## 금지 해석

1. `NaPm 있음 = 네이버 광고`로 쓰지 않는다.
2. `InitiateCheckout 있음 = 구매완료`로 쓰지 않는다.
3. `VirtualAccountIssued 있음 = Purchase`로 쓰지 않는다.
4. `Meta/Google 화면 ROAS = 내부 confirmed ROAS`로 쓰지 않는다.
5. `API endpoint 이름 = DB 테이블 이름`으로 부르지 않는다.
6. `VM Cloud SQLite = 운영DB`로 부르지 않는다.

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source | VM Cloud SQLite inventory, live public API read-only audit, local backend code audit |
| tables | `site_landing_ledger`, `attribution_ledger`, `paid_click_intent_ledger` |
| APIs | `/api/attribution/acquisition-summary`, `/api/acquisition/channel-analysis`, `/api/ads/naver/campaign-summary`, Google ROAS report 계열 |
| site | biocom |
| window | rolling 24h, rolling 7d, last_7d |
| freshness | 2026-05-21 23:59 KST |
| confidence | medium_high. 네이버 paid/organic 구분 기준은 명확하나 쇼핑 광고비 source 연결과 Google 24h order-level health는 계속 보강 필요 |

## Auditor verdict

PASS_WITH_NOTES.

이 문서는 현재 판단 기준을 고정한다. 운영 반영은 backend deploy가 필요한 Yellow Lane이며, TJ님 승인 후 별도 배포/검증 결과로 상태를 갱신한다.
