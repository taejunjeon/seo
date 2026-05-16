# Next actions

작성 시각: 2026-05-16 00:53 KST

## 우선순위

지금은 “우회”보다 “제한 상세 확인 + 데이터 최소화 + Ads 재조회”가 우선입니다.

## Action 1. Meta UI 제한 상세 확인

Owner: TJ님

무엇을 하는가:

- Events Manager에서 `데이터 공유 제한 적용됨`의 상세를 엽니다.
- `biocom.kr`, `biocom.imweb.me`, 한글 도메인별 제한 상태를 확인합니다.

왜 필요한가:

- 현재 Ads purchase 0이 제한 때문인지, 당일 지연인지 가르는 핵심 증거입니다.

어디에서 하는가:

- Events Manager > 데이터 세트 `바이오컴_TEMP` 또는 Pixel `1283400029487161`
- 설정/개요/진단 탭
- `카테고리 관리`, `상세 정보 보기`, `검토 요청`, `데이터 공유 제한 적용됨`

성공 기준:

- 제한되는 이벤트와 데이터 필드가 확인됩니다.

실패 시 다음 확인점:

- UI가 모호하면 화면 캡처를 Codex가 분류합니다.

승인 필요 여부:

- 없음.

의존성:

- TJ님 Meta 계정 접근 필요.

추천 점수/자신감:

- 95%.

## Action 2. 2026-05-15 Ads purchase 재조회

Owner: TJ님 + Codex

무엇을 하는가:

- Ads Manager UI와 Meta API read-only로 2026-05-15 구매가 뒤늦게 붙었는지 확인합니다.

왜 필요한가:

- 당일 지연이면 시간이 지나 구매가 붙습니다. 계속 0이면 제한/매핑 문제입니다.

어떻게 하는가:

- TJ님: Ads Manager에서 날짜 `2026. 5. 15` 단일일, 열에 `구매`, `구매 전환값`, `구매 ROAS`.
- Codex: Meta Graph API insights read-only로 purchase-family action key 재조회.

성공 기준:

- purchase key가 생기면 lag 가능성 확정.
- 계속 0이면 restriction/connection broken으로 격상.

실패 시 다음 확인점:

- API rate limit이면 UI 캡처 우선.

승인 필요 여부:

- 없음.

의존성:

- 12-24시간 경과.

추천 점수/자신감:

- 92%.

## Action 3. 데이터 최소화 승인안 작성

Owner: Codex

무엇을 하는가:

- Meta로 보내는 CAPI/Pixel payload에서 건강 상태를 암시할 수 있는 필드를 줄이는 승인안을 만듭니다.

왜 필요한가:

- 건강/웰빙 제한에서는 URL, custom_data, event_source_url, 상품명, 검사명 같은 정보가 제한을 악화시킬 수 있습니다.

어떻게 하는가:

- VM Cloud CAPI payload와 아임웹/Block 4 payload를 `필수 구매 신호`, `유지 가능`, `제거 후보`, `검토 필요`로 나눕니다.

성공 기준:

- Purchase CAPI는 유지하되 민감 정보 노출을 줄이는 patch packet이 나옵니다.

실패 시 다음 확인점:

- Meta UI가 제한 필드를 구체적으로 보여주지 않으면 보수적으로 URL/query/custom_data 최소화부터 제안합니다.

승인 필요 여부:

- 문서 작성은 Green.
- VM Cloud/아임웹 코드 반영은 Yellow/Red 성격에 따라 별도 승인 필요.

의존성:

- UI 상세 확인과 병렬 가능.

추천 점수/자신감:

- 88%.

## Action 4. 새 계정/두 번째 Pixel 보류

Owner: TJ님 + Codex

무엇을 하는가:

- 새 광고 계정이나 두 번째 Pixel 삽입을 지금 실행하지 않습니다.

왜 필요한가:

- 같은 도메인 제한이 다시 붙을 가능성이 높고, 기존 학습 데이터가 쪼개집니다.

성공 기준:

- 기존 Pixel에서 원인을 더 좁힌 뒤, 정말 필요할 때만 별도 승인안으로 검토합니다.

실패 시 다음 확인점:

- 기존 Pixel이 review 후에도 Purchase 사용 불가로 확정되면 별도 계정/데이터 소스 전략을 다시 평가합니다.

승인 필요 여부:

- 보류는 승인 불필요.
- 실제 생성/삽입은 Red 승인 필요.

의존성:

- Meta UI 제한 상세, Ads 재조회 결과.

추천 점수/자신감:

- 보류 90%.

## Action 5. Meta review request 문안 준비

Owner: Codex

무엇을 하는가:

- 제한 상세가 확인되면 Meta review request에 넣을 설명 초안을 준비합니다.

왜 필요한가:

- 검토 요청은 “우리는 민감 건강 정보를 보내지 않는다 / 구매 금액과 일반 구매 이벤트만 보낸다 / URL과 custom field를 최소화한다”는 설명이 필요합니다.

성공 기준:

- TJ님이 Meta UI에 붙여 넣거나 참고할 수 있는 짧은 설명이 준비됩니다.

실패 시 다음 확인점:

- 카테고리 변경이 아니라 데이터 사용 선언이 필요한 화면이면 문안 구조를 바꿉니다.

승인 필요 여부:

- 초안 작성은 Green.
- Meta UI 제출은 TJ님 직접 action.

의존성:

- UI 제한 상세 확인.

추천 점수/자신감:

- 80%.
