TJ님, 지금은 프론트 턴입니다. Claude Code에는 아래 프롬프트로 보내면 됩니다.

  /Users/vibetj/coding/seo 프로젝트의 프론트 작업을 진행해줘.

  먼저 아래 문서를 읽고 시작해:
  1. /Users/vibetj/coding/seo/roadmap0327.md
  2. /Users/vibetj/coding/seo/api.md
  3. /Users/vibetj/coding/seo/gptprofeedback_0327_3.md
  4. /Users/vibetj/coding/seo/backend/src/channeltalk.ts
  5. /Users/vibetj/coding/seo/frontend/src/app/layout.tsx
  6. /Users/vibetj/coding/seo/frontend/src/app/page.tsx

  공식 문서도 참고해:
  - https://developers.channel.io/en/articles/ff092122
  - https://developers.channel.io/en/articles/cca4bd14
  - https://developers.channel.io/en/categories/Introduction-a04bb274

  현재 상황:
  - Codex가 백엔드에서 ChannelTalk Access Key / Access Secret 인증은 이미 확인했다.
  - Plugin Key도 확보했다.
  - 아직 Member Hash는 활성화하지 않는다.
  - 이유는 Member Hash를 지금 켜면 memberId/memberHash가 없는 고객에게 채널톡 버튼이 안 보이거나 SDK가 깨질 수 있기 때문이다.
  - 따라서 이번 프론트 작업은 “Plugin Key 기반의 안전한 v1 연동”까지만 한다.
  - Member Hash 강제 boot는 넣지 말고, 훗날 붙일 수 있게 구조만 준비한다.

  작업 목표:
  - seo/frontend(Next.js app router)에 ChannelTalk SDK를 안전하게 붙인다.
  - 현재 페이지 전환에 맞춰 setPage를 호출할 수 있게 한다.
  - 앞으로 이벤트 track과 updateUser를 붙일 수 있도록 프론트 래퍼를 만든다.
  - 기존 UI/UX를 깨지 않게 최소 침습으로 넣는다.

  구체 작업:
  1. /Users/vibetj/coding/seo/frontend 구조를 확인하고 ChannelTalk를 넣을 최상위 client wrapper를 만든다.
  2. root layout에서 한 번만 boot되도록 구성한다.
  3. plugin key는 NEXT_PUBLIC_CHANNELTALK_PLUGIN_KEY 로 읽도록 바꿔라.
  4. frontend 쪽 env 예시 파일이 없다면 필요한 위치와 변수명을 문서화하거나 예시를 추가해라.
  5. route 변경 시 ChannelTalk setPage를 호출해라.
     - 최소한 pathname 기반 page name mapping을 둬라.
     - 예: home, diagnosis, report, dashboard 같은 식으로 의미 있는 이름.
  6. track helper를 만들어라.
     - 지금 당장 모든 화면 이벤트를 다 넣지 말고, 안전한 래퍼만 먼저 만든다.
     - 추후 ProductView/AddToCart/CheckoutBegin/CheckoutComplete 같은 이벤트를 붙일 수 있게 함수 인터페이스를 설계해라.
  7. updateUser/memberId/memberHash는 아직 강제 연결하지 말고, 향후 연결 포인트만 남겨라.
  8. 절대 Member Hash를 필수로 가정하지 말아라.
  9. ChannelTalk가 로드 실패해도 앱이 정상 동작해야 한다.
  10. 타입 안정성 유지하고, lint/build 가능한 상태로 맞춰라.

  구현 원칙:
  - 기존 디자인/레이아웃/상태 로직을 건드리지 말 것
  - 클라이언트 전용 코드로 분리할 것
  - 중복 boot 방지
  - route transition 대응
  - 추후 Codex 백엔드가 member hash endpoint를 붙일 수 있게 확장 가능한 구조로 만들 것

  원하는 산출물:
  - ChannelTalk provider 또는 client bootstrap component
  - route-aware setPage helper
  - track helper
  - env 연동 정리
  - 필요한 경우 간단한 개발자용 문서/주석

  검증:
  - npm run lint
  - 가능하면 npm run build
  - 실제로는 Member Hash 없이도 버튼이 뜨는 구조여야 한다
  - 실패 시 어디가 blocker인지 명확히 적어라

  응답 형식:
  1. 먼저 읽은 파일과 이해한 현재 제약 요약
  2. 어떤 파일을 어떻게 바꿀지 짧은 계획
  3. 실제 수정 진행
  4. 검증 결과
  5. 내가 추가로 넣어야 할 env 값/설정이 있으면 마지막에 한 줄로 정리

  중요:
  - 이번 작업은 “안전한 v1 연동”이다.
  - Member Hash 활성화 전제로 작업하면 안 된다.
  - 버튼 미노출 리스크가 생기면 안 된다.

  Claude한테 같이 덧붙일 한 줄은 이겁니다.

  지금은 Plugin Key 기반 연동만 하고, Member Hash는 구조만 준비하고 활성화는 하지 마.

  원하시면 제가 바로 Claude용 1차 검수 체크리스트도 같이 써드리겠습니다.