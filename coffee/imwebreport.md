# 더클린커피 아임웹 코드 삽입 검증 보고서

검증일: 2026-04-01
대상 사이트: https://thecleancoffee.com/
검증 방법: `curl` HTML 소스 분석 + 패턴 매칭

## 1. 검증 결과: 전체 통과

| # | 코드 | 위치 | 상태 | 식별값 |
|---|------|------|------|--------|
| 1 | 네이버 사이트 인증 | 헤더 상단 | ✅ | `80e2d778edd04a94edf09afe1d828dce262b0c92` |
| 2 | 네이버 웹분석 (WCS) | 헤더 상단 | ✅ | `4b725022d61ce0` |
| 3 | Meta Pixel | 헤더 상단 | ✅ | `993029601940881` |
| 4 | Google Ads (gtag) | 헤더 | ✅ | `AW-304339096` |
| 5 | Google Ads 장바구니 전환 | 헤더 | ✅ | `AW-304339096/Xq1KCMTrt4oDEJixj5EB` |
| 6 | Google Tag Manager (script) | 헤더 | ✅ | `GTM-5M33GC4` |
| 7 | Google Tag Manager (noscript) | 바디 | ✅ | `GTM-5M33GC4` |
| 8 | Beusable RUM (헤더) | 헤더 | ✅ | `b230307e145743u179` |
| 9 | Beusable RUM (바디) | 바디 | ✅ | `b230307e145743u179` (2번째) |
| 10 | Keepgrow 스크립트 | 바디 | ✅ | `56eb7c97-6325-44b2-b622-662566dfedfd` |
| 11 | Keepgrow CSS | 바디 | ✅ | `#keepgrowLogin` 스타일 |
| 12 | GA4 Measurement ID | 헤더/GTM 경유 | ✅ | HTML에 GA4 ID 존재 |
| 13 | 푸터 코드 | 푸터 | - | 현재 삽입 없음 (정상) |

## 2. 각 코드 상세

### 2-1. 네이버 (인증 + WCS)
- **site-verification**: `<meta>` 태그로 소유권 인증. 네이버 서치어드바이저에서 확인 가능.
- **WCS**: `wcs_add["wa"] = "4b725022d61ce0"` → 네이버 광고 전환 추적. `wcs_do()` 호출 확인.

### 2-2. Meta Pixel
- Pixel ID: `993029601940881`
- `PageView` 이벤트 기본 전송 확인
- `<noscript>` 폴백 이미지도 있음
- 커스텀 이벤트(AddToCart, Purchase 등)는 GTM 또는 별도 스크립트에서 처리 가능

### 2-3. Google Ads
- Conversion ID: `AW-304339096`
- 장바구니 전환: `window.location.href.endsWith('shop_cart')` 조건으로 `conversion` 이벤트 발생
- `gtag('config', 'AW-304339096')` 기본 설정 확인

### 2-4. Google Tag Manager
- Container ID: `GTM-5M33GC4`
- `<script>` (헤더) + `<noscript><iframe>` (바디) 이중 삽입 확인
- GTM 내부에서 GA4, Google Ads 추가 태그 관리 가능

### 2-5. Beusable (뷰저블)
- UX 히트맵/세션 리플레이 도구
- ID: `b230307e145743u179`
- 헤더와 바디에 2번 삽입 — `imwebcoffee.md`의 명세와 일치

### 2-6. Keepgrow (유니드컴즈)
- CRM/마케팅 자동화 도구
- UUID: `56eb7c97-6325-44b2-b622-662566dfedfd`
- `data-hosting="imweb"` 아임웹 전용 설정
- 로그인 모달 CSS도 함께 삽입

## 3. 프로메테우스 솔루션과의 연결 포인트

| 삽입 코드 | 우리 솔루션 활용 | Phase |
|----------|---------------|-------|
| Meta Pixel `993029601940881` | Meta Ads Insights API로 전환 데이터 조회 | Phase 5 |
| Google Ads `AW-304339096` | GA4 + Ads 크로스 분석 | Phase 5 |
| GTM `GTM-5M33GC4` | GA4 이벤트/전환 태그 관리 | Phase 1 (P1-S1A) |
| Beusable | UX 히트맵 데이터 → PROMETHEUS 아테나 | Phase 8 |
| Keepgrow | CRM 자동화 → 알리고/채널톡과 병행 | Phase 3 |
| 네이버 WCS | 네이버 광고 전환 추적 | 추후 |

## 4. 문서 vs 실제 코드 차이 검증

`imwebcoffee.md` 문서에서 일부 코드가 깨져 보이는 것은 **대화창/마크다운 복붙 과정의 문제**이다.
실제 아임웹에 저장된 코드는 정상이다.

| 항목 | 문서에서 | 실제 HTML | 판정 |
|------|--------|----------|------|
| GTM URL | `[https://...]()` 링크 형태 | `'https://...'` 정상 문자열 | ✅ 문서만 깨짐 |
| beusable 변수 | `w.**beusablerumclient**` 굵게 | `w.__beusablerumclient__` 정상 | ✅ 문서만 깨짐 |
| beusable src | `[//rum.beusable...]()` | `"//rum.beusable..."` 정상 | ✅ 문서만 깨짐 |
| naver wcslog | `[//wcs.naver...]()` | `"//wcs.naver..."` 정상 | ✅ 문서만 깨짐 |

**결론: 마크다운 깨진 패턴(`[...]()`이나 `**...**`)은 실제 HTML에 없음. JavaScript 정상 동작.**

## 5. 주의사항

1. **Beusable이 2번 삽입되어 있다**: 헤더와 바디에 동일 스크립트. 중복 호출로 세션 데이터가 2배로 잡힐 수 있다. 하나만 남기는 것을 권장.
2. **Keepgrow와 알리고/채널톡 역할 중복**: Keepgrow도 CRM 도구인데, 알리고 알림톡 + 채널톡과 기능이 겹칠 수 있다. 역할 분리 필요.
3. **푸터 코드 비어있음**: 현재 정상이지만, 향후 GA4 DebugView 검증이나 Toss payment success 이벤트를 넣을 수 있는 자리.
4. **Google Ads 장바구니 전환 조건**: `endsWith('shop_cart')`로 URL 체크 — 아임웹 장바구니 URL 구조가 바뀌면 작동 안 함.
