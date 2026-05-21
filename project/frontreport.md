# 프론트엔드 보고서 작성 원칙

작성 시각: 2026-05-19 21:57 KST
기준일: 2026-05-19
문서 성격: 프론트엔드 보고서 화면 제작 원칙 / OKR-액션플랜
적용 대상: CAPI 보고서, 전환 퍼널 관제, 선행지표 에이전트, ROAS/광고성과 보고서
Lane: Green documentation

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - frontrule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Green documentation
  allowed_actions:
    - frontend_report_principle_documentation
    - local_frontend_copy_design
    - no_send_dry_run_design
  forbidden_actions:
    - Meta_CAPI_send
    - GA4_Measurement_Protocol_send
    - GTM_publish
    - VM_Cloud_deploy_or_restart
    - operating_db_write
    - raw_identifier_output
  source_window_freshness_confidence:
    source: "docurule.md + frontrule.md + current CAPI report implementation"
    window: "reporting principle, not data window"
    freshness: "2026-05-19 21:57 KST"
    confidence: "high"
```

## 10초 요약

좋은 프론트엔드 보고서는 예쁜 표가 아니라 **사람이 바로 판단하고 움직이게 하는 실행 보드**입니다.

그래서 모든 보고서 화면은 먼저 “지금 무슨 결정을 해야 하는가”를 말하고, 숫자는 출처와 기준 시각을 붙이며, 어려운 말은 바로 괄호로 풀어야 합니다.

예를 들어 `CAPI`라고만 쓰지 말고 `CAPI(서버가 Meta에 구매 신호를 보내는 통로)`라고 써야 합니다.

## OKR

### Objective

운영자가 30초 안에 현재 상태, 원인, 바로 다음 행동을 이해하는 보고서 화면을 만든다.

### KR1. 결론을 사람 말로 먼저 보여준다

목표: 화면 첫 영역에서 “그래서 지금 괜찮은가, 위험한가, 무엇을 해야 하는가”가 보인다.

액션플랜:

1. 제목은 기술명이 아니라 판단 문장으로 쓴다.
   - 나쁜 예: `CAPI Report`
   - 좋은 예: `구매 신호는 Meta에 가고 있고, 다음 병목은 광고 유입 증거 품질입니다`
2. 첫 카드 3개는 “정상/주의/개선”처럼 상태를 분리한다.
3. 각 카드에는 `왜 중요한가`와 `다음 액션`을 붙인다.

성공 기준:

- 비전공자가 제목과 첫 3개 카드를 보고 현재 상황을 말로 설명할 수 있다.
- “그래서 뭘 해야 하는지”가 첫 화면에서 보인다.

### KR2. 모든 숫자는 기준과 출처를 같이 보여준다

목표: 숫자가 맞는지 의심될 때 어디서 온 값인지 바로 확인할 수 있다.

필수 표시:

- source(출처): 예를 들어 `VM Cloud`, `GA4 BigQuery`, `Meta Ads Manager`
- window(기간): 예를 들어 `최근 24시간`, `최근 7일`, `2026-05-19 KST`
- site(사이트): `바이오컴`, `더클린커피`
- pixel_id 또는 측정 ID: 사이트별로 섞이지 않게 하기 위한 식별자
- last_updated_at(기준 시각): 이 숫자가 언제 계산됐는지
- confidence(신뢰도): `high`, `medium_high`, `medium`, `low`

쉬운 설명:

숫자는 영수증과 같습니다. 금액만 적혀 있고 “언제, 어디서, 무엇을 산 것인지”가 없으면 믿기 어렵습니다. 보고서 숫자도 마찬가지입니다.

### KR3. 어려운 용어는 처음 1회 괄호로 풀어쓴다

목표: 고등학생이나 비전공자도 화면을 따라올 수 있다.

예시:

- CAPI(서버가 Meta에 구매 신호를 보내는 통로)
- UTM(광고 링크에 붙는 이름표)
- source mapping(구매가 어느 유입에서 왔는지 이름표를 붙이는 작업)
- cohort(비슷한 행동을 한 사람 묶음)
- dry-run(실제 전송 없이 계산만 해보는 예행연습)
- no-send(외부 플랫폼에는 보내지 않고 내부에서만 판단하는 상태)
- value guard(금액이 틀린 구매 신호를 막는 안전장치)
- duplicate guard(같은 구매를 두 번 보내지 않게 막는 안전장치)
- lagging indicator(이미 일어난 결과 지표)
- leading indicator(결과를 만들 가능성이 높은 선행 행동 지표)

성공 기준:

- 화면 안에서 처음 등장하는 기술어는 괄호 설명을 가진다.
- 긴 설명은 `용어 풀이` 접힘 영역이나 도움말 카드로 분리한다.

### KR4. “바로 다음 할 일”은 행동 카드로 쓴다

목표: 보고서를 보고 바로 실행 순서를 정할 수 있다.

각 카드 필수 항목:

1. 무엇을 하는가
2. 왜 하는가
3. 어떻게 하는가
4. 누가 하는가
5. 성공 기준
6. 실패 시 다음 확인점
7. 승인 필요 여부
8. 의존성
9. 추천 점수/자신감%

나쁜 예:

```text
Meta UTM/source 미매핑 줄이기
```

좋은 예:

```text
무엇: Meta 구매인데 광고 이름표가 약한 주문을 원인별로 나눈다.
왜: 광고비 판단에 쓸 ROAS가 흔들리기 때문이다.
어떻게: fbc/fbclid/UTM/campaign hint를 read-only로 묶어 source alias 후보를 만든다.
성공 기준: 최근 7일 미확정 bucket의 원인별 비율과 보강할 alias 후보가 나온다.
승인 필요: 없음. 실제 플랫폼 전송이나 GTM publish는 하지 않는다.
추천 점수: 94%.
```

### KR5. 표보다 판단 카드를 먼저 배치한다

목표: 화면이 숫자 창고가 아니라 의사결정판이 된다.

권장 순서:

1. 이 화면이 답하려는 질문
2. 지금 판단
3. 핵심 숫자 3~6개
4. 왜 중요한가
5. 바로 다음 할 일
6. 상세 표
7. 원본/기술 부록

표는 필요하지만, 표만 있으면 사용자가 직접 해석해야 합니다. 보고서는 해석을 대신 해줘야 합니다.

### KR6. 원본 식별자는 절대 화면에 노출하지 않는다

목표: 보안과 개인정보 리스크를 막는다.

금지:

- raw order id
- raw payment key
- raw member id
- raw email/phone
- raw click id
- raw gclid/fbclid/fbc/fbp 값

허용:

- safe_ref
- aggregate count
- present/absent
- hash bucket
- 비율

쉬운 설명:

보고서 화면은 CCTV 원본이 아니라 상황판입니다. 개별 고객의 원본 번호를 보여주는 대신, 몇 건인지와 어떤 문제가 있는지만 보여줘야 합니다.

### KR7. SVG/도표는 복잡한 흐름을 줄일 때만 쓴다

목표: 글로 설명하면 긴 흐름을 한눈에 이해하게 한다.

사용 기준:

- 단계가 3개 이상이다.
- “서버/브라우저/광고 플랫폼”처럼 주체가 여러 개다.
- 사용자가 용어보다 흐름을 먼저 이해해야 한다.

예시:

```html
<svg aria-label="CAPI 흐름" viewBox="0 0 620 110">
  <rect x="10" y="25" width="120" height="60" rx="8" />
  <text x="70" y="60" text-anchor="middle">유입</text>
  <path d="M140 55 H220" />
  <rect x="230" y="25" width="120" height="60" rx="8" />
  <text x="290" y="60" text-anchor="middle">결제완료</text>
  <path d="M360 55 H440" />
  <rect x="450" y="25" width="150" height="60" rx="8" />
  <text x="525" y="60" text-anchor="middle">Meta CAPI 전송</text>
</svg>
```

도표는 장식이 아니라 설명 도구입니다. 도표 없이도 이해되면 만들지 않습니다.

## 보고서 화면 표준 구조

### 1. 화면의 질문

사용자가 이 페이지에서 답을 얻어야 하는 질문을 먼저 적습니다.

예:

```text
오늘 구매 신호가 어디서 새고 있는가?
```

### 2. 지금 판단

상태를 `정상`, `주의`, `위험`, `개선`으로 나눕니다.

### 3. 숫자 카드

숫자는 최대 6개부터 시작합니다. 상세 숫자는 아래 표로 내립니다.

### 4. 원인과 의미

숫자가 왜 중요한지 설명합니다.

### 5. 바로 다음 할 일

실행 순서대로 씁니다. “검토 필요” 같은 모호한 표현만 쓰지 않습니다.

### 6. 상세 데이터

필터, 표, CSV 다운로드, 원본 링크는 마지막에 둡니다.

## 최종 체크리스트

- [ ] 화면 제목이 사람이 이해하는 판단 문장인가?
- [ ] 첫 화면에서 정상/주의/위험/개선이 보이는가?
- [ ] 모든 숫자에 source/window/site/기준 시각이 있는가?
- [ ] 어려운 용어는 첫 등장 시 괄호로 풀었는가?
- [ ] “바로 다음 할 일”에 무엇/왜/어떻게/누가/성공 기준/실패 시 해석/승인 필요 여부/추천 점수가 있는가?
- [ ] 표보다 판단 카드가 먼저 오는가?
- [ ] 원본 주문/결제/회원/클릭 식별자가 노출되지 않는가?
- [ ] 플랫폼 주장값과 내부 원장값을 섞지 않았는가?
- [ ] 외부 전송/배포/DB write가 필요한 액션은 승인 필요라고 표시했는가?
- [ ] 프론트엔드가 실패해도 사용자가 다음 행동을 알 수 있는가?
