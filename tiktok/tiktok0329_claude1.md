# TikTok 픽셀 연동 상태 진단 (2026-03-29)

> **사이트**: biocom.kr (아임웹 기반)
> **진단자**: Claude Code
> **진단일**: 2026-03-29

---

## 1. 계정 정보 요약

| 항목 | 값 | 상태 |
|------|-----|------|
| 픽셀 코드 | `D5G8FTBC77UAODHQ0KOG` | 설치 확인됨 |
| 비즈니스 센터 ID | `7593201346678013969` | - |
| 광고 ID | `7593201373714595856` | - |
| 카탈로그 ID | `7596869359360952065` | - |
| Feed ID | `29863177` | - |
| Feed URL | **연결 실패** | "외부 노출 설정이 누락되어 연결에 실패" |
| 플랫폼 | 아임웹(imweb) | TikTok 비즈니스 플러그인 연결 |
| 파트너 | `Imweb` (tiktok_pixel.js 내 `_partner: 'Imweb'`) | - |

---

## 2. 픽셀 설치 확인 결과

### 2.1. 기본 픽셀 코드 — 정상

biocom.kr 모든 페이지에서 아래 코드가 확인됨:

```html
<!-- TikTok Pixel Code Start -->
ttq.load('D5G8FTBC77UAODHQ0KOG');
ttq.page();
<!-- TikTok Pixel Code End -->
```

추가로 아임웹 자체 TikTok 픽셀 래퍼도 로드됨:
```html
<script src='/js/tiktok_pixel.js?1757999653'></script>
TIKTOK_PIXEL.init('D5G8FTBC77UAODHQ0KOG');
```

**참고**: `analytics.tiktok.com/i18n/pixel/events.js` 직접 호출 시 **504 Gateway Timeout** 반환됨 (Akamai CDN 경유). 이는 서버사이드에서 직접 호출하면 차단되는 것이며, 브라우저에서는 정상 로드될 수 있다. 실제 픽셀 동작 여부는 TikTok Pixel Helper(Chrome 확장)로 확인해야 한다.

**결론**: 기본 PageView 추적 코드는 **정상 설치됨**. 모든 페이지에서 `ttq.page()` 호출 확인. 단, 실제 이벤트 수신 여부는 TikTok Ads Manager에서 확인 필요.

---

### 2.2. 이벤트 추적 — 부분적 구현

| 이벤트 | 페이지 | 상태 | 상세 |
|--------|--------|------|------|
| `PageView` (ttq.page) | 전 페이지 | 정상 | 자동 발화 |
| `ViewContent` | 상품 상세 (/xxx_store) | 정상 | content_id, content_name, brand, price, quantity, currency, value, event_id 포함 |
| `AddToCart` | 장바구니 (/shop_cart) | **미확인** | track 호출 없음 (서버사이드에서만 할 수도 있음) |
| `InitiateCheckout` | 결제 (/shop_payment) | **미확인** | track 호출 없음 |
| `CompletePayment` / `Purchase` | 결제 완료 | **미확인** | curl로 결제 완료 페이지 접근 불가 |
| `AddPaymentInfo` | 결제 정보 입력 | **미확인** | track 호출 없음 |

**ViewContent 이벤트 실제 예시** (organicacid_store 페이지):
```javascript
TIKTOK_PIXEL.track('ViewContent', {
    contents: [{
        content_id: '259',
        content_name: '종합 대사기능 분석',
        brand: '바이오 종합 대사기능 검사',
        price: 298000,
        quantity: 1,
    }],
    description: '대사균형이 무너지는 순간...',
    content_type: 'product',
    currency: 'KRW',
    value: 298000,
    event_id: '15f4bc45414c2ce2c92676d156040ffd'
});
```

---

### 2.3. tiktok_pixel.js 래퍼 분석

아임웹이 제공하는 `/js/tiktok_pixel.js` 파일은 TikTok 픽셀을 감싸는 래퍼로, 아래 메서드를 노출한다:

| 메서드 | 설명 |
|--------|------|
| `TIKTOK_PIXEL.init(id)` | 픽셀 ID로 초기화 + ttq.load + ttq.page |
| `TIKTOK_PIXEL.track(event_name, parameters)` | 이벤트 추적 (event_id에 이벤트명 접두사 추가) |
| `TIKTOK_PIXEL.identify(user_data)` | 사용자 식별 |

**특이사항**: `track()` 함수에서 `event_id`가 있으면 `event_name + '_' + event_id` 형태로 변환한다. 이는 TikTok의 이벤트 중복 제거(deduplication)를 위한 것이지만, Events API(서버사이드)와의 매칭이 제대로 되려면 양쪽에서 같은 event_id 규칙을 사용해야 한다.

---

## 3. 문제 진단

### 3.1. Feed URL 연결 실패 (심각도: HIGH)

스크린샷에서 **"외부 노출 설정이 누락되어 연결에 실패했습니다"** 에러가 확인되었다.

**원인 가능성**:
1. 아임웹의 상품 피드 외부 노출 설정이 꺼져 있음
2. 카탈로그 페이지에서 Feed API 연결 상태가 비활성
3. 서비스형 상품(검사 키트)은 Feed URL 연동 대상이 아닐 수 있음 (스크린샷 하단 안내: "일부 상품군(디지털 콘텐츠, 특정 서비스형 상품 등)은 Feed URL 연동 대상이 아닐 수 있습니다")

**영향**:
- TikTok 카탈로그 광고(Dynamic Product Ads) 사용 불가
- 상품 태깅 기반 리타겟팅 제한
- 전환 최적화 광고에서 상품 데이터 매칭 불가

**해결 방법**:
1. 아임웹 관리자 > 쇼핑 설정 > 외부 노출 설정 확인
2. 카탈로그 페이지에서 Feed ID/API 연결 상태 재확인
3. 검사 서비스가 Feed URL 연동 대상 상품인지 아임웹 고객센터에 문의

---

### 3.2. 전자상거래 이벤트 누락 가능성 (심각도: HIGH)

**확인된 것**: `ViewContent`만 클라이언트사이드에서 발화

**미확인**: `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`, `CompletePayment`

이 이벤트들이 발화되지 않으면:
- TikTok 광고의 **구매 전환 최적화**가 불가
- **ROAS 측정이 불정확** (ViewContent까지만 추적되므로)
- **퍼널 분석 불가** (어디서 이탈하는지 TikTok 대시보드에서 볼 수 없음)

**확인 방법**:
1. **TikTok Pixel Helper** (Chrome 확장) 설치 후 직접 장바구니 담기/결제 진행하며 이벤트 발화 확인
2. TikTok Ads Manager > 이벤트 관리자 > 테스트 이벤트에서 최근 이벤트 로그 확인
3. 아임웹이 서버사이드(Events API)로 이벤트를 보내고 있을 수 있으므로, TikTok Ads Manager에서 "이벤트 소스" 필터를 "웹+서버" 모두로 확인

---

### 3.3. GA4 데이터와의 불일치 (심각도: MEDIUM)

GA4 소스별 전환 분석 결과:
- **tiktok 채널**: 383,449세션, 318구매, 전환율 0.08%, 매출 ₩1.2억
- **매출/세션**: ₩323 (전체 평균 ₩1,013의 1/3)

TikTok Ads Manager에서 보이는 전환 수치와 GA4의 318구매가 일치하는지 비교 필요.
불일치 원인:
- TikTok 픽셀에서 `CompletePayment`가 발화되지 않으면, TikTok 측에서 전환을 카운트하지 못함
- GA4는 UTM 파라미터(sessionSource)로 tiktok을 식별하므로 경로가 다름
- 크로스 디바이스 전환(TikTok 앱에서 보고 → 모바일 웹에서 구매)이 어트리뷰션 차이를 만들 수 있음

---

### 3.4. `(not set)` 매출 ₩1.3억의 tiktok 귀속 가능성 (심각도: MEDIUM)

GA4에서 `(not set)/(not set)` 소스의 매출이 ₩130,522,953 (전환율 19.36%)이다.
이 중 일부가 tiktok 유입일 가능성:
- TikTok 인앱 브라우저 → PG 리다이렉트 → 세션 끊김 → (not set)으로 기록
- 이 경우 tiktok의 실제 전환 성과가 과소평가되고 있을 수 있음

---

## 4. 조치 계획

### 즉시 (오늘)

| 번호 | 작업 | 확인 방법 |
|------|------|----------|
| 1 | TikTok Pixel Helper로 ViewContent/AddToCart/InitiateCheckout/CompletePayment 발화 확인 | Chrome 확장 설치 후 실제 구매 흐름 진행 |
| 2 | TikTok Ads Manager > 이벤트 관리자에서 최근 7일 이벤트 로그 확인 | 어떤 이벤트가 실제로 수신되는지, 웹/서버 구분 |
| 3 | 아임웹 관리자에서 TikTok 연동 설정 > "외부 노출" 옵션 확인 | Feed URL 에러 해결 |

### 이번 주

| 번호 | 작업 | 기대 효과 |
|------|------|----------|
| 4 | 누락된 전자상거래 이벤트(AddToCart, InitiateCheckout, CompletePayment) 추가 | TikTok 구매 전환 최적화 활성화 |
| 5 | TikTok Ads Manager vs GA4 전환 수치 비교 | 어트리뷰션 차이 파악 |
| 6 | Feed URL 에러 해결 → 카탈로그 광고 활성화 | 다이나믹 리타겟팅 가능 |

### 다음 배치

| 번호 | 작업 | 기대 효과 |
|------|------|----------|
| 7 | TikTok Events API (서버사이드) 연동 검토 | 브라우저 차단/인앱 브라우저에서도 전환 추적 |
| 8 | TikTok CAPI + 브라우저 픽셀 중복 제거(event_id 매칭) | 전환 데이터 정확도 향상 |
| 9 | tiktok 캠페인별 ROAS 분석 (GA4 vs TikTok Ads Manager) | 비효율 캠페인 식별 및 예산 재배분 |

---

## 5. tiktok 채널 성과 현황 (GA4 기준, 최근 30일)

참고용으로, GA4에서 측정한 tiktok 채널의 현재 성과:

| 지표 | 값 | 비고 |
|------|-----|------|
| 총 세션 | 383,449 | 전체의 61% |
| 총 구매 | 318 | |
| 전환율 | 0.08% | 전체 평균(0.38%)의 1/5 |
| 매출 | ₩123,961,981 | 전체의 19% |
| 매출/세션 | ₩323 | 전체 평균(₩1,013)의 1/3 |

### 캠페인별 상세

| 캠페인(sessionSource) | 세션 | 구매 | 전환율 | 매출 | RPS |
|----------------------|-----:|-----:|-------:|-----:|----:|
| tiktok_biocom_yeonddle_acid | 161,721 | 46 | 0.03% | ₩19,972,036 | **₩123** |
| tiktok_biocom_iggcam_igg | 76,238 | 228 | 0.30% | ₩78,522,680 | ₩1,030 |
| tiktok_biocom_mineralcam_mineral | 76,122 | 0 | 0% | ₩0 | ₩0 |
| tiktok_biocom_bangtanjelly | 19,479 | 8 | 0.04% | ₩8,581,864 | ₩441 |
| tiktok_biocom_yeonddle_iggacidset | 16,065 | 18 | 0.11% | ₩14,112,000 | ₩878 |
| tiktok_biocom_biobalance | 13,039 | 0 | 0% | ₩0 | ₩0 |
| tiktok_biocom_acidcam_acid | 10,528 | 0 | 0% | ₩0 | ₩0 |

**핵심**:
- `iggcam_igg` 캠페인만 유일하게 의미 있는 전환(228구매, RPS ₩1,030)을 만들고 있음
- `yeonddle_acid`는 16만 세션을 쏟아붓지만 RPS ₩123으로 극히 비효율
- `mineralcam`, `biobalance`, `acidcam`은 세션만 있고 구매 0

---

## 6. Claude Code가 추가로 확인할 수 있는 것과 없는 것

### 확인 가능 (이미 수행)
- [x] 픽셀 코드 설치 여부 (HTML 소스 확인)
- [x] `ttq.page()` 호출 여부
- [x] `ViewContent` 이벤트 발화 및 파라미터 구조
- [x] tiktok_pixel.js 래퍼 코드 분석
- [x] GA4 기준 tiktok 채널 세션/매출/전환율
- [x] 플랫폼(아임웹) 및 파트너 확인

### 확인 불가 (수동 확인 필요)
- [ ] TikTok Ads Manager 내 실제 전환 이벤트 수신 로그
- [ ] TikTok Pixel Helper를 통한 실시간 이벤트 발화 확인 (브라우저 확장 필요)
- [ ] AddToCart/InitiateCheckout/CompletePayment 서버사이드 발화 여부 (아임웹 서버에서 처리할 수 있음)
- [ ] TikTok Events API(CAPI) 서버사이드 연동 여부
- [ ] TikTok Ads Manager의 ROAS, CPA, 광고비 데이터
- [ ] 아임웹 관리자의 외부 노출 설정 상태
- [ ] Feed URL 실제 접근 가능 여부 (인증 필요)
