# LCP/FCP 개선 분석 v1.0

작성일: 2026-02-13  
대상: BiocomAI SEO Intelligence Dashboard `Core Web Vitals` 탭(모바일/데스크톱 PageSpeed 측정)

## 1) 결론: “서버”보다 “프론트 리소스(이미지/폰트/서드파티/렌더 블로킹)”가 병목

스크린샷 기준:
- LCP: 37,519ms
- FCP: 13,277ms

PageSpeed Insights API(모바일, https://biocom.kr) 실측(2026-02-13 로컬 실행) 요약:
- Performance: 27점 (나쁨)
- FCP: 20,927ms
- LCP: 36,602ms
- Speed Index: 24,459ms
- TTI(Time to Interactive): 69,862ms
- TBT(Total Blocking Time): 1,197ms
- 요청 수: 363개
- 총 전송량: 약 26.3MB
- 스크립트: 154개 / 스타일시트: 29개
- TTFB(Initial server response time): 약 106ms 수준(=서버 응답은 상대적으로 빠름)

즉,
- HTML은 빠르게 오지만,
- “초기 화면에 뭔가(텍스트/이미지)가 그려지기까지”와 “가장 큰 요소가 뜨기까지”가 비정상적으로 오래 걸립니다.

## 2) 현재 데이터로 확인되는 직접 원인(증거 포함)

### 2.1 렌더 블로킹(초기 렌더를 막는 CSS/JS)이 많음

PageSpeed의 `render-blocking-insight` 상위 항목(일부):
- `https://vendor-cdn.imweb.me/css/site/site2.css?...` (wastedMs ~3901)
- `https://vendor-cdn.imweb.me/css/site/site.css?...` (wastedMs ~3301)
- `https://vendor-cdn.imweb.me/minify_css/vendor_blue_10.css?...` (wastedMs ~3451)
- `https://vendor-cdn.imweb.me/js/jquery.js?...` (wastedMs ~1651)
- `https://t1.daumcdn.net/kas/static/kp.js` (wastedMs ~1501)
- `https://wcs.naver.net/wcslog.js` (wastedMs ~1201)
- `https://player.vimeo.com/api/player.js` (wastedMs ~1062)
- `https://biocom.kr/css/custom.cm?...` (wastedMs ~1351)

의미:
- 초기 렌더(FCP)가 CSS/JS 다운로드 및 실행에 묶여 늘어집니다.
- 특히 “광고/분석/플레이어(비메오)” 류는 초기 화면에 필수 리소스가 아닌 경우가 많아, 지연 로딩으로 큰 개선 여지가 있습니다.

### 2.2 “대용량 이미지 + 영상”이 초기 구간에서 같이 내려옴(전송량 과다)

네트워크 요청(transferSize) 상위(일부):
- 이미지 4.2MB: `https://cdn.imweb.me/thumbnail/20241211/c8eff025bd220.png`
- 이미지 1.16MB: `https://cdn.imweb.me/thumbnail/20250318/2cb6fd2bae8a9.png`
- 비메오 영상 청크(XHR) 수백 KB~1.2MB 다수: `https://vod-adaptive-ak.vimeocdn.com/...`

의미:
- 모바일 환경 시뮬레이션(느린 네트워크)에서는 이미지/영상 전송만으로도 수~수십 초가 소요됩니다.
- LCP가 “큰 이미지(히어로/배너) 또는 영상 영역”으로 잡히면, 그 리소스가 늦게 도착하는 만큼 LCP가 늦어집니다.

### 2.3 폰트가 너무 무겁고(여러 웨이트), CSS도 과다/미사용이 큼

폰트 전송량(일부):
- Pretendard woff2 여러 웨이트가 각각 ~0.8MB 수준으로 다수 다운로드됨

미사용 CSS(`unused-css-rules`)에서 낭비 바이트가 큰 파일(일부):
- Google Fonts Noto Sans KR CSS: 92KB(거의 전량 낭비로 표시)
- `vendor-cdn.imweb.me/css/site/site2.css` (wastedBytes ~62KB)
- `vendor-cdn.imweb.me/minify_css/vendor_blue_10.css` (wastedBytes ~50KB)
- `vendor-cdn.imweb.me/css/site/site.css` (wastedBytes ~49KB)
- `vendor-cdn.imweb.me/css/tailwind.css` (wastedBytes ~19KB)

의미:
- CSS 파이프라인이 “전체 사이트 공통 CSS를 한 번에” 싣는 구조로 보이며,
- 특정 페이지에는 쓰지 않는 CSS가 많아 초기 렌더를 늦춥니다.

### 2.4 LCP Discovery 인사이트

`lcp-discovery-insight` 요약:
- “초기 문서에서 요청이 discoverable” = true
- “lazy load 미적용” = true
- “fetchpriority=high 적용 필요” = false로 표시됨

의미:
- LCP 리소스가 아예 늦게 발견되는 구조는 아닙니다.
- 다만 “초기 구간을 막는 리소스 + 대용량 리소스” 때문에 체감이 크게 느려질 가능성이 높습니다.

## 3) LCP를 줄이기 위한 “구체 액션”(우선순위/효과 중심)

아래는 “LCP 30~40초대”를 “수초대”로 줄일 때 일반적으로 가장 효과가 큰 순서입니다.

### P0. LCP 후보(대용량 이미지/히어로)부터 1차 교체/최적화

권장 목표:
- 첫 화면(Above-the-fold) 대표 이미지는 100~250KB 수준(가능하면 WebP/AVIF)
- 큰 PNG(수 MB)는 가능하면 제거(특히 투명도 없는 배너/썸네일)

구체 작업:
1) 상단 배너/대표 이미지를 WebP/AVIF로 재업로드(또는 자동 변환 설정 활용)
2) 반응형 이미지 적용: 모바일에서 작은 해상도 리소스만 내려받게 구성
3) “첫 화면에 꼭 안 보이는 이미지”는 `loading="lazy"`로 지연 로딩
4) LCP 이미지가 “lazy”로 잡히는 경우는 금지(위 LCP discovery상 lazy는 아니지만 페이지별 확인 필요)
5) LCP 이미지에 `fetchpriority="high"`(또는 preload)를 적용할 수 있는 구조면 적용

### P0. 비메오/플레이어/영상은 ‘클릭 전’까지 로딩 금지(파사드/지연 로딩)

현 상태는 비메오 영상 청크가 초기부터 내려오는 정황이 있습니다.

구체 작업:
- 초기에는 “썸네일 + 재생 버튼”만 렌더링
- 사용자 클릭 시에만 `player.js` 및 스트리밍 요청을 시작(=Facade 패턴)
- 자동재생(autoplay), 미리 로드(preload) 옵션이 있다면 비활성화

### P1. 폰트: 웨이트 축소 + 서브셋 + swap

구체 작업:
- Pretendard 웨이트를 2개 이하로 제한(예: Regular + Bold)
- 가능하면 Variable font 1개로 통합
- `font-display: swap` 적용(FOIT 방지)
- 첫 화면에 필요한 폰트만 preload(과도한 preload는 역효과 가능)
- Noto Sans, Montserrat 등 “혼합 폰트”는 가능하면 제거/통합

### P1. 초기 렌더를 막는 리소스(렌더 블로킹) 최소화

구체 작업(가능한 범위부터):
- `kp.js`(Daum), `wcslog.js`(Naver) 등 분석/광고 스크립트는 초기 렌더 이후 로드
- `player.js`(Vimeo)는 클릭 후 로드
- jQuery가 꼭 필요하지 않다면 제거(또는 필요한 페이지에서만 로드)
- 큰 CSS(`site.css`, `site2.css`, `vendor_*.css`, `tailwind.css`)는 “초기 화면에 필요한 최소 CSS만” 남기고 나머지는 지연 로드
  - 가능하면 critical CSS(상단 영역)만 인라인, 나머지 CSS는 `media`/`onload` 기법 등으로 비동기 로드

### P2. 전체 리소스 다이어트(요청 수 363개 / 26MB → 절반 이하 목표)

구체 작업:
- 첫 화면에 필요 없는 이미지/아이콘/위젯/추적 스크립트 제거
- 중복 라이브러리(폰트/아이콘 팩 등) 정리
- “페이지별 기능”을 공통으로 다 싣는 구조라면 페이지 단위 분리 로드(가능한 환경일 때)

## 4) FCP를 줄이기 위한 “구체 액션”(우선순위/효과 중심)

FCP는 “첫 텍스트/이미지가 보이는 순간”이라,
대부분 아래 2가지가 주원인입니다.

1) 렌더 블로킹 CSS/JS가 많음  
2) 폰트 로딩이 렌더를 지연(FOIT), 혹은 CSS가 과다

따라서 FCP 개선 우선순위는:
- 렌더 블로킹 목록 상단 리소스(3.1절의 항목들)를 “지연 로딩/비동기화”
- 폰트를 `swap`로 전환
- 초기 CSS를 최소화

## 5) “이 솔루션이 구체 개선안을 제안”하도록 만들 수 있는가?

가능합니다. 현재도 PageSpeed API를 호출하고 있으므로, 아래처럼 “진단 데이터”를 추가로 파싱해서
대시보드에 ‘추천 카드’를 노출하면 됩니다.

### 5.1 추천 생성에 필요한 데이터(이미 PageSpeed 응답에 존재)

PageSpeed(Lighthouse) 응답에서 추천 근거를 뽑을 수 있는 핵심 필드:
- `render-blocking-insight`: 렌더 블로킹 리소스 목록(각 URL, wastedMs, bytes)
- `unused-css-rules`: CSS 낭비 바이트/절감 시간(파일별 wastedBytes)
- `network-requests`: 리소스별 transferSize 상위(대용량 이미지/폰트/영상/스크립트 식별)
- `diagnostics`: `numRequests`, `numScripts`, `numStylesheets`, `totalByteWeight` 등 전반 지표
- (선택) `third-party-summary`: 서드파티별 비용(가능한 경우)

### 5.2 추천 카드 템플릿(룰 기반, 즉시 구현 가능)

예시(룰 + 출력 형태):

1) “대용량 이미지로 LCP 악화”
- 트리거: `network-requests`에서 Image transferSize > 500KB가 상위에 존재
- 출력: “상단 배너 이미지를 WebP/AVIF로 교체하고, 모바일 해상도용 리소스를 별도 제공하세요”
- 근거: 상위 이미지 URL + 크기

2) “영상/플레이어가 초기 로딩을 오염”
- 트리거: vimeocdn/player.js 요청이 초기 구간에 존재
- 출력: “비메오 임베드를 클릭 시 로드(Facade)로 바꾸고 autoplay/preload를 끄세요”
- 근거: 관련 URL + 전송량

3) “렌더 블로킹 리소스 과다”
- 트리거: `render-blocking-insight` items가 N개 이상
- 출력: “분석/광고 스크립트를 초기 렌더 이후로 지연하고, 비필수 CSS를 비동기 로드하세요”
- 근거: wastedMs 상위 5개 URL

4) “폰트 웨이트 과다”
- 트리거: `network-requests`에서 Font가 다수 + 총합이 500KB 초과
- 출력: “Pretendard 웨이트를 2개 이하로 줄이거나 Variable font로 통합 + swap 적용”
- 근거: 폰트 URL + 크기

5) “CSS 미사용이 큼”
- 트리거: `unused-css-rules.overallSavingsMs` 또는 wastedBytes가 큼
- 출력: “페이지별 CSS 분리/정리(사용하지 않는 CSS 제거) 우선 적용”
- 근거: wastedBytes 상위 CSS URL

### 5.3 UI에 노출하는 방식(사용자 행동 유도)

Core Web Vitals 탭에 다음 섹션을 추가하면 실용성이 높아집니다.
- “이번 측정에서 가장 큰 병목 Top 5”(근거 포함)
- “추천 액션 체크리스트”(완료/보류 상태 관리)
- “재측정 버튼”(개선 후 즉시 점수 확인)

## 6) 추가로 정확도를 높이기 위해 필요한 정보(선택)

더 정밀한 처방을 위해서는 아래 정보가 있으면 좋습니다.
- biocom.kr이 어떤 플랫폼/프레임워크 기반인지(임웹 기반으로 보이지만 확정 필요)
- “첫 화면(Above-the-fold)”에 실제로 어떤 요소가 LCP로 잡히는지(페이지별로 다를 수 있음)
- 개선 가능 범위(코드 수정 가능/플랫폼 설정만 가능/외부 스크립트 조정 가능 여부)

---

## 7) 추천 실행 순서(현실적인 1~2일 플랜)

Day 1 (가장 큰 폭 개선):
1) 첫 화면 대용량 이미지(WebP/AVIF, 모바일 리사이즈) 적용
2) 비메오 임베드 클릭 후 로드로 변경(초기 로드 차단)
3) 렌더 블로킹 상위 3개(광고/분석/플레이어) 지연 로드

Day 2 (안정화/고도화):
4) 폰트 웨이트 축소 + swap + (가능하면) 서브셋
5) CSS 정리(사용하지 않는 CSS 제거/페이지별 분리 시도)
6) 재측정 후 개선 전/후 수치 기록(LCP/FCP/TTI/요청수/전송량)

