목표:
이번 턴의 목표는 GTM/GA4 정리 전략을 더 토론하는 것이 아니라, 이미 확정된 전략을 바탕으로 “매출 정합성 체크 + 가상계좌 A안 검토 + 아임웹 코드 이관안”을 실행 가능한 산출물로 만드는 것이다.

이번 턴의 source of truth:
1. 정본 컨테이너 = GTM-W2Z6PHN
2. 정본 속성 = [G4] biocom.kr / property 304759974 / measurement ID G-WJFXN5E2Q1
3. 일반 구매 canonical sender = HURDLERS [이벤트전송] 구매 (유지, 건드리지 않음)
4. NPay는 purchase 정본이 아니라 버튼 클릭/진입 기반 보조 신호로 본다
5. 가상계좌는 A안 검토:
   - 신청 완료를 purchase로 유지
   - 취소/미입금 시 refund 또는 cancel 보정 추가
   단, GTM만으로 해결될지 불확실하므로 backend/DB 관점까지 포함해 설계
6. TikTok은 후순위
7. 직접 G-8 제거는 지금 즉시 하지 않는다
8. 먼저 live Imweb code version 확정이 필요하다
9. GTM-W2Z6PHN 안의 정리 방향은 유지:
   - GA4_픽셀 = 유지
   - GA4_픽셀2 = paused 유지
   - HURDLERS 구매/상세조회/주문서작성 = canonical core event 유지
10. 최신 확인 사실:
   - purchase DebugView 확인됨
   - transaction_id/value/currency/shipping 보임
   - items는 event-level source variable 존재
   - item-level 화면에서 item_id / item_name / item_brand / quantity / price 확인됨
   - 단 item-level price 스케일 이상 가능성 있음

중요 제약:
- Codex는 현재 ChatGPT 위임형/클라우드 작업 기준으로 GTM UI나 GA4 UI에 직접 로그인해서 활성/비활성 태그를 확인할 수 없다
- repo, 문서, 제공된 코드, 스크린샷, export를 바탕으로만 작업한다
- 새 컨테이너 제안 금지
- W2/G-W 정본 기준 흔들지 말 것

이번 턴에서 Codex가 해야 할 일:

1. 매출 정합성 체크 실행안 작성
- 왜 지금 즉시 스모크 테스트는 가능하고, 운영 판단용 신뢰 구간은 컷오버 후 3~7일로 봐야 하는지 설명
- GA4 데이터와 주문 DB 비교 기준 정의
- 일반 구매 / NPay / 가상계좌를 분리한 reconciliation 설계
- 최소 SQL 또는 pseudo-SQL 제시

2. 과거 데이터 소급 가능성 평가
반드시 아래를 명확히 구분해서 적어라.
- GA4 UI 과거 데이터 자체 수정/정정 가능 여부
- Measurement Protocol 72시간 backdate 가능 범위
- 왜 historical cleanup은 현실적으로 어렵고, cutover date 전/후 분리 해석이 맞는지
- DB/BI 레이어에서 별도 보정 리포트를 만드는 대안

3. 가상계좌 A안 구체화
아래를 실무적으로 비교/설계하라.
- 신청 완료를 purchase로 유지하고, 취소/미입금 시 refund 또는 cancel 보정하는 구조
- 이때 GTM으로 가능한 부분
- GTM으로는 어려운 부분
- backend / DB / admin 상태 신호가 필요한 부분
- 추천 구현 순서
- 필요한 상태값 예시 (신청완료, 입금대기, 입금완료, 취소, 환불 등)

4. refund / cancel 설계
Google Analytics 공식 refund 이벤트를 기준으로:
- 어떤 상황에 refund를 쏠지
- transaction_id 사용 방식
- 가상계좌 미입금 취소를 refund로 볼지 custom cancel로 볼지
- 광고/ROAS 관점 영향
- DB reconciliation 관점 영향

5. 아임웹 코드 이관안
반드시 아래 전제부터 적어라.
- 업로드된 코드 버전이 서로 상충하며, 어떤 버전이 live인지 먼저 확정해야 함
- 어떤 파일/버전에 direct gtag G-8이 있는지
- 어떤 버전에 없는지
그 다음:
- direct gtag G-8 제거 전제 조건
- footer의 gtag 의존 로직(user_id, rebuyz_utm, rebuyz_view)을 dataLayer/GTM로 옮기는 방법
- 지금 즉시 제거 가능한 것
- 지금은 건드리면 안 되는 것
- 최종 목표 구조

6. 사용자 역할 / GPT 역할 / Codex 역할 기준을 짧게 정리
- 무엇은 GPT 판단
- 무엇은 Codex 산출물
- 무엇은 사용자 UI 작업
이걸 운영 기준으로 고정 문구로 정리

7. 필수자료 / 참고자료
이번 턴 기준으로 정말 필요한 것만 요청
특히:
- live Imweb code version 확정에 필요한 자료
- 주문 export/DB 컬럼
- 가상계좌 상태 정의 자료
이미 확보된 자료는 다시 요구하지 말 것

출력 형식:
1) 10초 요약
2) 역할 분담 기준
3) 최신 확정 상태
4) 매출 정합성 체크 실행안
5) 과거 데이터 소급 가능성 평가
6) 가상계좌 A안 구체화
7) refund / cancel 설계
8) 아임웹 코드 이관안
9) 필수자료 / 참고자료
10) Day 0 / Day 1 / Day 3 실행 순서
11) 최종 리스크

중요:
- Codex가 GTM/GA4 UI를 직접 볼 수 있다고 가정하지 말 것
- 전략 재토론 금지
- 실행 가능한 산출물 중심으로 작성할 것