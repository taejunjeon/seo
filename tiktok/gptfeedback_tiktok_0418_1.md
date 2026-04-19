전체 평부터 말하면, **방향은 맞습니다.**  
이 로드맵은 순서가 좋습니다. 먼저 `Purchase 오염 제거`, 그다음 `TikTok 플랫폼 숫자 vs 내부 장부 비교`, 그다음에야 `Events API 조건부 도입`으로 가고 있습니다. 이 순서는 맞습니다. 지금 문서도 가장 큰 1번 오염인 “가상계좌 미입금이 구매로 잡히던 문제”가 2026-04-17 운영 적용으로 끝났고, 현재 병목은 TikTok Ads Manager 숫자와 운영 VM 장부를 같은 기간으로 맞대는 것이라고 정리합니다.

다만 냉정하게 말하면, **아직 “TikTok이 실제로 잘 되는 채널인지”를 결론내릴 단계는 아닙니다.**  
지금 확보한 값은 경고 신호로는 매우 강합니다. 같은 기간 TikTok 플랫폼 구매값이 **910,630,953원**, 플랫폼 ROAS가 **32.106**인데, 운영 VM 원장 기준 TikTok 귀속 confirmed는 **0건/0원**, pending은 **49건 / 551,095,900원**입니다. 이 정도면 “뭔가 크게 안 맞는다”는 건 확실합니다. 하지만 그 원인이 100% TikTok 플랫폼 과대집계인지, 내부 귀속 누락인지, pending이 실제로 나중에 confirmed로 많이 넘어가는 구조인지, 혹은 소스 분류 규칙이 너무 넓은지까지는 아직 분해가 덜 됐습니다.

제 핵심 의견은 이겁니다.

**TikTok API 승인 자체는 지금 프로젝트의 주 경로가 아닙니다.**  
API가 없어서 못 하는 일보다, **정의·기간·창구·귀속 규칙이 안 맞아서 아직 못 믿는 일**이 더 많습니다. 게다가 TikTok 공식 개발자 문서상 앱 리뷰가 승인되기 전에는 API를 쓸 수 없고, 리뷰는 며칠에서 2주 정도 걸릴 수 있습니다. 그래서 이 프로젝트를 API 승인 대기 상태로 묶어두면 손해입니다. 반대로 TikTok Ads Manager에는 이미 Custom report 생성과 즉시 export, 그리고 이메일 scheduled export가 있으므로, **API 승인 전에도 상당수 핵심 작업을 진행할 수 있습니다.** ([TikTok Developers](https://developers.tiktok.com/doc/getting-started-faq?enter_method=left_navigation&utm_source=chatgpt.com "TikTok for Developers"))

## 잘한 점

첫째, **문제 정의가 좋습니다.**  
“TikTok Ads Manager가 주장하는 ROAS”를 그대로 믿지 않고, **내부 확정매출 장부와 맞춰보겠다**는 관점이 맞습니다. 특히 `/ads/tiktok`에 새 API `GET /api/ads/tiktok/roas-comparison`을 붙여서 플랫폼 숫자와 운영 VM gap을 한 화면에서 보는 방향은 아주 좋습니다. 이건 대표 보고와 개발 검증이 같은 화면을 보게 만든다는 점에서 가치가 큽니다.

둘째, **Events API를 뒤로 미룬 판단이 맞습니다.**  
TikTok 공식 문서는 웹 측정에서 Pixel과 Events API 병행을 권장합니다. 하지만 동시에 dedup은 **같은 event_id**를 Pixel과 Events API 양쪽에 보내야 하고, 중복이 감지되면 **먼저 들어온 이벤트**가 측정/보고에 유지된다고 설명합니다. 즉, 지금처럼 Purchase 신호를 막 정리한 상태에서 서버 이벤트를 성급히 붙이면, 잘못된 첫 이벤트를 더 강하게 굳힐 위험이 있습니다. 그래서 문서처럼 **Phase 1에서 숫자 기준을 먼저 만들고, Events API는 조건부**로 미루는 게 맞습니다. ([TikTok For Business](https://ads.tiktok.com/help/article/events-api?lang=en&utm_source=chatgpt.com "About Events API | TikTok For Business"))

셋째, **Guard 전후를 나눠서 보려는 태도가 맞습니다.**  
이건 측정 프로젝트에서 아주 중요합니다. 같은 채널이라도 측정 규칙이 바뀐 시점 전후를 섞어서 보면, 플랫폼이 틀렸는지 우리가 틀렸는지 판단이 안 됩니다. 문서가 2026-04-17 적용 시점을 경계로 잡고 있는 건 올바른 접근입니다.

## 지금 가장 큰 약점

가장 큰 약점은 **“platform purchase value 910.6M” 숫자의 해석 신뢰도**입니다.  
문서에도 적었듯이, 2차 과거 XLSX에서 한국어 export 헤더가 중복되어 있고, 그중 하나를 `구매값`으로 **추정해서 표준화**했습니다. 이건 “큰 문제가 있다”는 경보로는 충분하지만, **대표 보고 숫자**로는 아직 약합니다. 그래서 지금 단계의 910.6M은 “판정 근거”라기보다 “강한 의심 신호”로 쓰는 게 맞습니다. 이 숫자를 바로 예산 회의의 최종 근거로 쓰면 위험합니다.

두 번째 약점은 **TikTok 귀속 규칙이 recall은 높지만 precision이 아직 약할 수 있다**는 점입니다.  
현재 TikTok 유입 판정은 `ttclid`, TikTok referrer, TikTok UTM, metadata URL 기준을 함께 씁니다. 이건 “놓치지 않기”에는 좋지만, 반대로 일부는 **너무 넓게 잡을 위험**도 있습니다. 특히 confirmed 0, pending 49라는 극단적 결과가 나왔을 때는 “TikTok이 다 뻥이다”라고 보기 전에, **이 49건이 진짜 TikTok 귀속으로 볼 만한 주문인지** 표본 점검을 해야 합니다.

세 번째 약점은 **어트리뷰션 윈도우를 아직 제대로 못 맞췄다**는 점입니다.  
TikTok Ads Manager는 클릭/조회 기반 어트리뷰션 윈도우를 설정할 수 있고, TikTok은 Ads Manager와 MMP의 윈도우를 맞추라고 권합니다. 안 맞추면 보고 차이가 커질 수 있습니다. 즉, 지금 gap의 일부는 “플랫폼이 틀렸다”가 아니라 **TikTok은 CTA/EVTA/VTA까지 보는데 내부는 더 보수적 기준만 보는 것**일 수 있습니다. 이걸 분리하지 않으면 gap 해석이 오염됩니다. ([TikTok For Business](https://ads.tiktok.com/help/article/about-the-attribution-window-on-tiktok-ads-manager?lang=en&utm_source=chatgpt.com "About the attribution window on TikTok Ads Manager | TikTok for Business"))

## API 승인 전에 할 수 있는 일

여기서 중요한 건, **생각보다 많이 할 수 있다**는 겁니다.  
가치 큰 순서대로 적겠습니다.

### 1. 일자별 Custom report를 먼저 고정

이게 최우선입니다.

TikTok Ads Manager는 Custom report에서 차원과 지표를 고를 수 있고, 즉시 export도 되고, scheduled export도 됩니다. scheduled export는 보통 계정 시간대 기준 새벽 5-6시쯤 메일로 옵니다. 즉, **API 승인 없이도 사실상 “반자동 일일 데이터 수집”**이 가능합니다. ([TikTok For Business](https://ads.tiktok.com/help/article?aid=9670&utm_source=chatgpt.com "Create and Manage Reports | TikTok Ads Manager"))

그래서 지금 바로 해야 할 건:

- `Date`
    
- `Campaign ID`
    
- `Campaign name`
    
- `Cost`
    
- `Purchase count`
    
- `Purchase value`
    
- `CTA purchase`
    
- `EVTA purchase`
    
- `VTA purchase`
    
- `CTA/VTA/EVTA ROAS`
    
- 사용 중인 attribution window
    

이 컬럼이 들어간 **일자별 report 포맷 1개**를 확정하는 것입니다.

### 2. `tiktok_ads_daily` 테이블 만들기

문서에도 “일자별 데이터는 새 `tiktok_ads_daily` 테이블로 분리” 방향이 적혀 있는데, 이건 API 승인 전에도 바로 가능합니다. CSV/엑셀 기반으로 먼저 만들면 됩니다. 이게 있으면 Guard 전후, 날짜별 gap, 캠페인별 급변을 볼 수 있습니다. 지금 period aggregate만으로는 “언제부터 틀어졌는지”가 안 보입니다.

### 3. Attribution window 계약 고정

이건 생각보다 중요합니다.

TikTok은 클릭/조회 기반 attribution window를 조정할 수 있고, 이 설정은 TikTok Ads Manager 보고에 직접 영향을 줍니다. TikTok도 Ads Manager와 MMP의 attribution window를 맞추라고 권합니다. 그러니 API 승인 전이라도 **“우리 내부 비교의 기본 창은 무엇인지”**를 먼저 문서로 잠가야 합니다. 이걸 안 하면 나중에 API 붙여도 여전히 숫자가 안 맞습니다. ([TikTok For Business](https://ads.tiktok.com/help/article/about-the-attribution-window-on-tiktok-ads-manager?lang=en&utm_source=chatgpt.com "About the attribution window on TikTok Ads Manager | TikTok for Business"))

### 4. 상위 pending 주문 20건 수동 감정

이건 정말 추천합니다.

지금 confirmed 0, pending 49가 핵심인데, 이 49건이 왜 pending인지부터 봐야 합니다.

- 진짜 미입금인가
    
- 나중에 confirmed로 넘어가는 구조인가
    
- TikTok 귀속 룰이 과하게 넓나
    
- `ttclid`가 실제로 붙었나
    
- 결제완료 직전/직후 식별자 carry-over가 끊겼나
    

즉, API보다 먼저 **대표 샘플 20건의 타임라인 검시**를 하는 게 값어치가 큽니다.

### 5. TikTok source 분류 정밀도 점검

지금 룰은 recall 중심입니다.  
API 승인 전에도 충분히 할 수 있습니다.

방법은 간단합니다.

- 금액 큰 pending 상위 주문 20건
    
- canceled 1건
    
- 향후 confirmed로 넘어온 주문 표본  
    에 대해 각 주문이 **무슨 이유로 TikTok 유입으로 분류됐는지** 사유 코드를 붙입니다.
    

예:

- `ttclid_direct`
    
- `utm_source_tiktok_only`
    
- `referrer_tiktok_only`
    
- `metadata_url_tiktok`
    

이렇게 해두면 나중에 “어떤 룰이 오탐이 많은지”가 바로 보입니다.

### 6. 이벤트 스키마와 event_id 규칙 먼저 고정

공식 문서상 Pixel과 Events API를 같이 쓰면 dedup에 **같은 event_id**가 필요하고, 첫 이벤트가 유지됩니다. 그러니 API 승인 전에 할 일은 서버 연동 코드 작성이 아니라, **event_id 규칙을 먼저 잠그는 것**입니다. 그래야 승인 나도 바로 안전하게 붙일 수 있습니다. ([TikTok For Business](https://ads.tiktok.com/help/article/event-deduplication?lang=id&utm_source=chatgpt.com "Tentang Deduplikasi Peristiwa | TikTok Ads Manager"))

### 7. API 런북과 권한 체크리스트 준비

이건 가볍게 해두면 좋습니다.  
API approval 전에도

- 필요한 advertiser_id
    
- read-only token 위치
    
- 저장 금지 원칙
    
- dry-run 스크립트 입력 형식
    
- 실패 시 fallback = CSV ingest  
    정도는 미리 만들어둘 수 있습니다.  
    다만 이건 핵심 경로는 아닙니다.
    

## API 승인 전에 **하지 않는 게 좋은 것**

첫째, **Events API를 먼저 붙이는 것**입니다.  
TikTok 공식 문서는 Pixel + Events API 병행을 권장하지만, 지금 프로젝트 상황에서는 그 전에 해야 할 일이 더 많습니다. 지금은 “수집량 부족”보다 “정의·귀속·창구 정렬 부족”이 더 큰 병목입니다. ([TikTok For Business](https://ads.tiktok.com/help/article/events-api?lang=en&utm_source=chatgpt.com "About Events API | TikTok For Business"))

둘째, **현재 platform ROAS 숫자를 바로 예산판단 기준으로 쓰는 것**입니다.  
일자/창구/구매값 매핑이 아직 덜 잠겨 있어서, 지금 숫자는 “경보”로는 좋지만 “예산 총량 판단” 근거로는 이릅니다.

셋째, **TikTok 프로젝트가 전체 공통 측정 문제를 밀어내는 것**입니다.  
현재 전체 프로젝트에서 `payment_success`의 핵심 식별자 3종(all-three) 커버리지가 약 50.26% 수준입니다. 이건 TikTok만의 문제가 아니라 모든 채널 공통 문제라서, 리소스가 한정되면 TikTok Events API보다 **글로벌 identity coverage 개선**이 더 큰 임팩트를 줄 가능성이 큽니다.

## 제가 권하는 다음 순서

1. **TikTok 일자별 Custom report 포맷 확정**
    
2. **scheduled export 켜기**
    
3. **`tiktok_ads_daily` 적재**
    
4. **attribution window / metric dictionary 고정**
    
5. **pending 상위 주문 20건 표본 감정**
    
6. **source 분류 사유 코드화**
    
7. **그다음에만 API 승인 기다리기**
    
8. **API 승인 후에도 Events API는 조건부**
    

즉, **API 승인 전에도 Phase 1의 대부분은 계속 갈 수 있습니다.**

## 인사이트

가장 큰 인사이트는 이겁니다.

**지금 TikTok 프로젝트의 본질은 “API 붙이기”가 아니라 “같은 숫자를 같은 뜻으로 비교하게 만들기”입니다.**  
API는 데이터를 자동으로 가져오는 수단일 뿐이고, 지금 gap의 핵심은 자동화 부족보다 **측정 계약 미정**입니다.

두 번째 인사이트는,  
**현재 huge gap은 “TikTok이 사기다”의 증거가 아니라 “측정 체계가 아직 분해되지 않았다”는 증거**에 더 가깝습니다.  
pre-guard 오염, CTA/EVTA/VTA 창구 차이, source 분류 precision, pending의 실제 fate가 다 섞여 있습니다. 이걸 하나씩 분리하면, 오히려 API 없이도 판단력이 많이 올라갑니다. ([TikTok For Business](https://ads.tiktok.com/help/article/about-the-attribution-window-on-tiktok-ads-manager?lang=en&utm_source=chatgpt.com "About the attribution window on TikTok Ads Manager | TikTok for Business"))

세 번째 인사이트는,  
**TikTok Events API는 “해결책”이 아니라 “증폭기”**라는 점입니다.  
데이터 계약이 맞으면 측정 품질을 높여주고, 계약이 틀리면 오염을 더 빠르고 더 많이 밀어넣습니다. 그래서 지금 보류 판단이 맞습니다. ([TikTok For Business](https://ads.tiktok.com/help/article/events-api?lang=en&utm_source=chatgpt.com "About Events API | TikTok For Business"))

## 최종 의견

제 판단은 이렇습니다.

- **프로젝트 방향은 좋다**
    
- **API approval은 blocker가 아니다**
    
- **지금 가장 중요한 건 일자별 export + attribution window 고정 + 표본 audit**
    
- **Events API는 아직 이르다**
    
- **리소스가 부족하면 TikTok 전용 서버 연동보다 전체 identity coverage를 우선하는 게 낫다**
    

가장 먼저 필요한 추가 자료는 딱 하나입니다.  
**TikTok Ads Manager에서 Date, Campaign ID, Purchase count/value, CTA/EVTA/VTA, ROAS, attribution window가 들어간 일자별 Custom report 한 번**입니다.  
이거 하나만 있으면 API 승인 전에도 이 프로젝트는 훨씬 더 앞으로 갈 수 있습니다.