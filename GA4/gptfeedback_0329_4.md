목표:
Biocom 웹사이트의 GA4 추적 구현을 전수 점검하고, 기존 분석 이슈의 가장 가능성 높은 원인을 “코드로 확인 가능한 것”과 “운영 화면에서 사람이 확인해야 하는 것”으로 분리해서 정리하라.

배경:
- 원래 GA4 measurement ID가 `G-WJFXN5E2Q1`였다고 알고 있었는데, 현재 사이트 삽입 코드에는 `G-8GZ48B1S59`가 직접 들어가 있다.
- 현재 헤더 코드에는 다음이 동시에 존재한다.
  - direct gtag.js for `G-8GZ48B1S59`
  - GTM container `GTM-W7VXS4D8`
  - GTM container `GTM-W2Z6PHN`
- body에도 두 GTM noscript가 있다.
- 공유받은 커스텀 스크립트에서는:
  - `gtag('set', { user_id: userID })` 사용
  - UTM을 `rebuyz_utm` localStorage에 저장
  - 단, UTM 저장은 `userID`가 있을 때만 수행
  - UTM 값이 없으면 `'0'` 문자열로 저장
  - `view_item` 전송 코드는 주석 처리되어 있음
  - 대신 `gtag('event', 'rebuyz_view', ...)`를 전송
- 기존 진단 결과:
  - `(not set)` landing 약 15%
  - `runFunnelReport purchase = 0`
  - 실제 `ecommercePurchases`는 존재
  - PG / cross-domain 단절 가능성 높음
  - DebugView와 cross-domain domain 설정 점검이 아직 남아 있음

작업 지시:
1. 저장소 전체에서 아래 키워드를 전수 검색하라.
   - `G-WJFXN5E2Q1`
   - `G-8GZ48B1S59`
   - `GTM-W7VXS4D8`
   - `GTM-W2Z6PHN`
   - `gtag(`
   - `dataLayer`
   - `view_item`
   - `add_to_cart`
   - `begin_checkout`
   - `add_payment_info`
   - `purchase`
   - `transaction_id`
   - `rebuyz_view`
   - `user_id`
   - `utm_source`
   - `cross_domain`
   - `_gl`

2. 아래를 표로 정리하라.
   - 위치 파일
   - 코드 종류 (direct gtag / GTM snippet / custom event / ecommerce / UTM persistence)
   - 현재 measurement ID 또는 GTM container ID
   - 위험도
   - 왜 위험한지
   - 바로 수정 가능한지 여부

3. 반드시 아래 질문에 각각 답하라.
   A. 현재 코드베이스 안에서 실제로 어느 GA4 measurement ID들이 살아 있는가?
   B. direct gtag와 GTM이 동시에 이벤트를 보낼 가능성이 있는가?
   C. `view_item` 표준 이벤트가 실제로 발화되는가, 아니면 `rebuyz_view`만 보내는가?
   D. `rebuyz_view`가 GTM이나 서버 코드에서 `view_item`으로 변환되는가?
   E. UTM 저장 로직이 비로그인 첫 방문 attribution을 잃게 만들 가능성이 있는가?
   F. `'0'` 문자열 저장이 source/medium 오염을 만들 가능성이 있는가?
   G. purchase 이벤트 발화가 어느 레이어에서 처리되는가?
   H. measurement ID 변경만으로도 기존 대시보드/백엔드 property 조회와 불일치가 생길 가능성이 있는가?

4. 아래 항목은 “코드로 확인 가능 / 코드로는 불가, 운영 화면 필요”로 분리하라.
   - old/new measurement ID 사용 여부
   - duplicate page_view 가능성
   - ecommerce 이벤트 누락 여부
   - GTM 내부 태그 구성
   - GA4 Admin의 cross-domain 설정
   - 실제 PG 완료 후 purchase 발화 여부
   - property / stream mismatch 여부

5. 수정 제안은 “빠른 봉합”과 “정리 수술”로 나눠라.
   - 빠른 봉합:
     - direct gtag 제거 또는 GTM 한쪽 통일 여부
     - `send_page_view` 중복 방지
     - `view_item` 표준 이벤트 복구 또는 GTM 매핑
     - UTM 저장 로직을 로그인과 분리
     - 없는 UTM 값은 `'0'` 대신 null/미전송 처리
   - 정리 수술:
     - 측정 체계를 single source of truth로 통일
     - GTM 컨테이너 2개 운영 이유 문서화
     - old/new GA4 stream/property 매핑 문서화
     - ecommerce event naming standard 문서화

6. 출력 형식:
   - 10초 요약
   - 확인된 사실
   - 강한 의심
   - 코드 수정 필요 항목
   - 운영 화면에서 확인해야 할 항목
   - 가장 먼저 할 3가지
   - 필요한 추가 자료

중요:
- “불가능”이라고 뭉뚱그리지 말고, 왜 코드만으로는 안 되는지 분리해서 설명하라.
- 추론과 사실을 구분하라.
- 가능하면 실제 수정 파일 후보까지 제시하라.