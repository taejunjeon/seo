리인벤팅 관련 논의 필요.


• 수정 방향은 꽤 명확하오. W2 정본 purchase는 건드리지 말고, W7 support 컨테이너의 payment page 전용 custom JS/변수만 먼저 고치는
  게 맞다는 근거가 이미 있소. 이 기준으로 바로 실행 가능한 체크리스트로 정리하겠소.

• TJ님, 지금 biocom GTM 오류 정리는 이렇게 하는 게 맞소.

  핵심 판단부터 적으면:
  문제는 payment_success 적재 실패가 아니라, GTM-W7VXS4D8 안 custom script가 null.includes(...)를 치는 버그로 보는 게 맞소.
  왜냐하면 실제 원장 적재는 계속 되고 있소. 예를 들어 최신 biocom_imweb row들도 backend/src/routes/attribution.ts:451로 정상 들어
  오고, 최근 live row에는 ga_session_id / client_id / user_pseudo_id도 붙기 시작했소. 반면 콘솔 오류는 gtm.js ... includes로 별도
  뜨고 있소.

  그리고 정본 purchase sender는 GTM-W2Z6PHN 쪽을 유지하는 게 맞소. 저장소의 정리 문서도 그렇게 잡고 있소. backend/src/
  ga4Cutover.ts:446 기준:

  - 정본 컨테이너: GTM-W2Z6PHN
  - support 컨테이너: GTM-W7VXS4D8
  - 일반 구매 canonical sender: HURDLERS [이벤트전송] 구매

  즉 수정 원칙은 이거요.

  1. W2 purchase 정본은 건드리지 않는다

  - HURDLERS [이벤트전송] 구매
  - HURDLERS [이벤트전송] 주문서작성
  - GA4_픽셀

  2. W7 payment page 전용 custom JS/Custom JS Variable부터 찾는다

  - 오류 스택이 includes이므로, 거의 확실히 문자열 변수에 null이 들어왔소.
  - 의심 패턴:
      - {{변수}}.includes('...')
      - {{DOM Text}}.includes('...')
      - {{payment_method}}.includes('...')
      - {{pg_name}}.includes('...')
      - {{location.pathname}}나 query 값이 비어 있을 때 .includes(...)

  3. Tag Assistant Preview를 shop_payment_complete 페이지에서 연다

  - 꼭 홈이 아니라 실제 결제완료 URL에서 봐야 하오.
  - 컨테이너 두 개를 같이 보면 되지만, 먼저 GTM-W7VXS4D8에서:
      - Fired Tags
      - Variables
      - Custom HTML
      - Custom JavaScript Variables
        를 보시오.
  - TypeError: Cannot read properties of null (reading 'includes')가 뜨는 이벤트에서, 마지막으로 평가된 변수/태그를 찾으면 범인이
    좁혀지오.

  4. 발견된 변수/스크립트는 null-safe로 바꾼다

  - 잘못된 예:

  return {{payment_method}}.includes('가상계좌');

  - 고친 예:

  var v = {{payment_method}} || '';
  return typeof v === 'string' && v.includes('가상계좌');

  - DOM 텍스트면:

  var el = document.querySelector('.selector');
  var text = (el && el.textContent) || '';
  return text.includes('주문완료');

  - 배열 여부가 불명확하면:

  var v = {{someVar}};
  return Array.isArray(v) ? v.includes('x') : String(v || '').includes('x');

  5. 임시 우회는 shop_payment_complete에서 W7 문제 태그만 막는다

  - 범인을 바로 못 찾으면, 전체 컨테이너를 끄지 말고
  - shop_payment_complete / shop_order_done 페이지에서만
      - 문제 Custom HTML
      - 문제 Custom JS Variable을 쓰는 Tag
        를 제외하시오.
  - 이유는 W7은 support 성격이고, purchase 정본은 W2에 있으니 payment page 안정성 확보가 우선이오.

  6. 그 다음에만 legacy 정리로 간다

  - 저장소 계획상 GA4_픽셀2와 legacy G-8 축은 pause/제거 후보요. backend/src/ga4Cutover.ts:146
  - 다만 이건 현재 오류 원인 제거 후에 하시오.
  - 지금 바로 같이 건드리면 원인 추적이 흐려지오.
  실행 순서를 아주 짧게 적으면:

  1. GTM-W7VXS4D8 Preview를 shop_payment_complete URL에 붙인다.
  2. includes 에러를 내는 Custom HTML/Custom JS Variable 이름을 찾는다.
  3. 그 코드에 || '' / typeof === 'string' 가드 추가
  4. 안 잡히면 해당 태그를 payment page에서만 임시 제외
  5. publish
  6. 다시 가상계좌 주문 1건으로
      - 콘솔 에러 소멸
      - GA4 DebugView purchase 정상
      - attribution ledger 정상
        를 같이 확인

  한 줄로 요약하면:
  W2 정본 purchase는 유지하고, GTM-W7VXS4D8payment page custom JS에서null.includes를 치는 태그/변수만 찾아 null-safe 처리하거나
  payment page에서 제외하면 되오.

  원하시면 다음으로는 제가
  “GTM 작업자에게 그대로 전달할 수정 지시문” 형식으로 1페이지짜리로 써드리겠소.


› GTM-W7VXS4D8 컨테이너는 우리 회사가 외주를 준 CRM 회사에서 임시로 세팅한거고 나중에 없앨것임. CRM 잘한다고 해서 써봤는데 잘 못
  하고 도움이 별로 안되더라고. 그래도 너가 말한작업이 필요한지?


• TJ님, “살리기 위한 정밀 수리”는 굳이 안 해도 되오. 대신 “안전하게 영향 차단”은 필요하오.

  이유는 두 가지요.

  - GTM-W7VXS4D8는 지금도 shop_payment_complete에서 콘솔 오류를 내고 있소.
  - 하지만 정본 결제 추적은 이미 GTM-W2Z6PHN + 우리 attribution footer로 돌아가고 있소. 즉 W7을 고쳐서 유지할 이유는 약하오.

  그래서 권장 방향은 이거요.

  1. W7 내부 버그를 고쳐 살리지 말고, payment page에서 먼저 꺼라

  - shop_payment_complete
  - shop_order_done
    이 두 페이지에서 W7 태그, 특히 Custom HTML, Custom JavaScript Variable, legacy GA 태그 발화를 막는 게 우선이오.

  2. 정본은 건드리지 말라

  - GTM-W2Z6PHN
  - HURDLERS [이벤트전송] 구매
  - 우리 payment-success footer
    이 셋은 유지하시오.

  3. 그 다음 전체 제거 여부를 결정하라

  - W7이 지금 실제로 쓰는 게 CRM 회사용 보조 추적뿐이라면, 며칠 모니터링 후 사이트 전체에서 제거하는 편이 맞소.
  - 다만 제거 전에는 rebuyz_utm, rebuyz_view, vendor retargeting/세그먼트가 아직 쓰이는지 한 번만 확인하시오.

  즉 질문에 바로 답하면:

  - 내가 앞서 말한 “정밀 디버깅”은 꼭 필요하지 않소.
  - 하지만 payment page에서 W7 영향 차단은 필요하오.
  - 더 정확히는, “고쳐서 유지”가 아니라 “끄고 제거”가 맞는 작업이오.

  실행 우선순위는 이렇소.

  1. GTM-W7VXS4D8에서 payment page 발화 태그 중지
  2. 가상계좌 주문 1건 테스트
  3. 확인 항목

  - 콘솔 includes 오류 사라짐
  - GA4 purchase 정본 유지
  - /api/attribution/payment-success 정상 적재 유지

  4. 문제 없으면 W7 전체 제거 계획 확정

  원하시면 다음 답변에서
  “GTM 작업자에게 그대로 전달할 중지 대상/테스트 절차” 형식으로 아주 짧게 써드리겠소.


• TJ님, “전체 데이터가 다 안 간다”라고 단정할 수는 없지만, payment_complete 페이지에서 W7에 의존한 데이터는 신뢰하기 어렵다고 보
  는 게 맞소.

  이유는 간단하오.

  - includes 오류는 보통 그 변수/스크립트를 쓰는 태그를 깨뜨리오.
  - GTM은 한 태그나 변수에서 에러가 나도 다른 태그 전체가 전부 같이 죽는 구조는 아니오.
  - 실제로 2026-04-08 기준으로는 우리 attribution footer는 계속 정상 적재됐소. 즉 사이트 전체 추적이 완전히 죽은 건 아니오.
  - 반대로, W7이 결제완료 페이지에서 실행하려던 어떤 로직은 분명히 비정상이오. 그래서 그 로직에 묶인 CRM 전송, 구매 전환, 세그먼
    트 갱신, 리타겟팅 이벤트는 누락되거나 깨졌을 가능성이 높소.

  정리하면 이렇게 보시면 되오.

  - 확실한 것: 우리 payment-success 원장 적재는 정상
  - 높은 위험: W7이 shop_payment_complete에서 보내려던 구매/CRM 관련 데이터
  - 아직 미확정: W7의 홈/일반 페이지 데이터까지 다 망가졌는지 여부

  그래서 내일 직원들과 논의할 때 기준은 이거요.

  - CRM 회사가 계속 작업 중이면, **“W7을 살릴지”보다 “payment_complete 기준 데이터가 실제로 정상 전송됐다는 증거를 보여달라”**고
    하시오.
  - 증거는 말이 아니라 3개면 충분하오.
  - GTM Preview에서 shop_payment_complete 진입 시 fired tags 목록
  - 콘솔 에러 없는 화면
  - 실제 CRM/광고/웹훅 전송 네트워크 또는 수신 로그

  이 3개를 못 보여주면, 적어도 결제완료 페이지 기준 W7 데이터는 현재 정상이라고 보면 안 되오.
