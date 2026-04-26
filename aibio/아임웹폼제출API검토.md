# AIBIO 아임웹 폼 제출 API 검토

작성 시각: 2026-04-25 15:12 KST
기준일: 2026-04-25
대상 사이트: `https://aibio.ai`
관련 프로젝트: AIBIO 리커버리랩스, Meta Lead, 내부 attribution 원장

## 10초 요약
- 현재 공개 아임웹 Open API만으로는 AIBIO의 일반 입력폼 제출 목록, 제출 내용, 제출자, 제출 시각을 바로 조회하기 어렵다.
- 아임웹 API에서 조회 가능한 것은 주문의 `결제입력폼`, 상품문의, 회원, 주문 데이터다. AIBIO 예약/상담 입력폼은 이 범위와 다르다.
- Meta 광고관리자에서 본 `Lead` 11건은 현재 구조상 `aibio_form_submit -> Meta Lead`로 보는 것이 맞다. 다만 실제 제출자 11명과 1:1 확정하려면 내부 원장 또는 아임웹 관리자 export가 필요하다.
- 지금 실무적으로 가장 안전한 방법은 아임웹 입력폼은 유지하고, 헤더/푸터 JS로 성공 제출 시점에 우리 API로 상세 원장을 저장하는 것이다. GA4/Meta에는 원문 개인정보나 건강 관심사를 보내지 않는다.
- 광고 효율 개선의 핵심은 `Lead` 수를 늘리는 것이 아니라 `고품질 Lead -> 상담 연결 -> 방문 예약` 신호를 Meta와 내부 원장에 되돌려 주는 것이다.
- 2026-04-25에 v8 후보 `aibio/imwebcode_0425_v8.md`를 만들었다. 이 후보는 이름/전화번호 원문을 보내지 않고, 전화번호 해시와 선택값 기반 리드 품질 버킷만 내부 API metadata로 보낸다.
- 2026-04-25 12:50 KST 기준 공개 페이지 `https://aibio.ai/`와 `https://aibio.ai/59`에서 푸터 v8 반영을 확인했다. 헤더 first-touch는 기존 v1 그대로 유지되고, form-submit은 v8로 교체됐다.
- 2026-04-25 12:52 KST 실제 폼 제출로 Meta `Lead`와 내부 attribution v8 수신을 확인했다. 다만 빈 기타 직접입력칸이 `goal_codes=other`로 잡힐 수 있는 경로를 발견해 v8.1 후보로 보정했다.
- 2026-04-25 13:23 KST 기준 공개 페이지 `https://aibio.ai/59`에서 v8.1 반영을 확인했다.
- 2026-04-25 15:07 KST 테스트 제출로 v8.1 내부 원장 수신과 테스트 차단 로직을 확인했다. 테스트 연락처는 내부에는 남고, Meta Lead 운영 전환에서는 제외되는 구조가 맞다.

## Phase-Sprint 요약표
| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | 공식 API 범위 확인 | Codex | 100% / 80% | [[#Phase1-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | Meta Lead 의미 정의 | Codex | 100% / 70% | [[#Phase1-Sprint2\|이동]] |
| Phase2 | [[#Phase2-Sprint3]] | 제출자 매칭 원장 설계 | TJ+Codex | 90% / 30% | [[#Phase2-Sprint3\|이동]] |
| Phase2 | [[#Phase2-Sprint4]] | 운영 데이터 교차검증 | TJ+Codex | 40% / 10% | [[#Phase2-Sprint4\|이동]] |
| Phase3 | [[#Phase3-Sprint5]] | 고품질 리드 최적화 | TJ+Codex | 70% / 25% | [[#Phase3-Sprint5\|이동]] |
| Phase3 | [[#Phase3-Sprint6]] | 아임웹 커스텀 폼 판단 | TJ+Codex | 60% / 20% | [[#Phase3-Sprint6\|이동]] |

## 문서 목적
이 문서는 AIBIO 폼 제출 데이터를 아임웹 API로 가져올 수 있는지, 그리고 Meta `Lead` 11건을 실제 제출자와 어떻게 맞춰야 하는지 정리한다.

## 결론

### 현재 판단
아임웹 API만으로 AIBIO 일반 입력폼 제출자 목록을 바로 가져오는 것은 어렵다.

아임웹 공식 문서에서 확인한 공개 범위는 아래와 같다.

| 구분 | API 가능 여부 | AIBIO 폼 제출에 대한 의미 |
|---|---|---|
| 주문 조회 | 가능 | 주문의 `order_time`, 주문자명, 이메일, 전화번호, `form` 결제입력폼은 조회 가능 |
| 상품 문의 조회 | 가능 | 상품문의의 작성자, 제목, 내용, IP, 작성시간은 조회 가능 |
| 회원 조회 | 가능 | 회원명, 이메일, 연락처, 가입일시는 조회 가능 |
| 일반 입력폼 제출 목록 | 공식 문서 기준 미확인 | AIBIO 예약/상담 폼 제출 목록을 바로 가져오는 endpoint는 보이지 않음 |
| 웹훅 | 일부 가능 | 회원/주문/장바구니/상품 삭제 등은 있으나 일반 입력폼 제출 이벤트는 보이지 않음 |

### 왜 그런가
AIBIO에서 광고 전환으로 쓰는 폼은 쇼핑 주문의 결제입력폼이 아니라, 아임웹 페이지의 상담/예약 입력폼이다.

공식 문서의 `form`은 주문 조회 응답 안에 있는 `결제입력폼 정보`다. 즉 사용자가 상품을 주문할 때 추가로 입력한 결제/주문 폼 항목이다. AIBIO의 일반 상담 폼 제출 목록과 같은 범주라고 보기 어렵다.

### 2026-04-25 아임웹 화면 확인
TJ님이 아임웹 관리자 입력폼 화면을 공유했다. 화면 기준 AIBIO에는 입력폼 응답 목록과 개별 응답 상세가 존재한다.

| 확인 항목 | 값 |
|---|---|
| 입력폼 이름 | `다이어트 페이지 DB` |
| 응답 수 | 104 |
| 목록 필드 | 이름, 연락처, 나이, 알게 된 경로, 작성자, IP, 댓글, 작성시각 |
| 상세 필드 | 이름, 연락처, 나이, 상담 목적, 알게 된 경로, 상담 신청 유형 |
| 관리자 기능 | 내보내기 버튼 확인 |
| 해석 | API endpoint는 확인되지 않았지만 관리자 export는 가능해 보임 |

캡처에는 실제 이름과 전화번호가 포함되어 있으므로, 이 문서에는 개인별 원문을 옮기지 않는다.

## Meta Lead 11건의 의미

### 현재 답
`260401_리커버리랩 이벤트2`의 `Lead` 11건은 폼 제출 리드로 보는 것이 맞다.

근거는 아래다.

| 항목 | 값 |
|---|---|
| source | Meta Marketing API v22.0 |
| 기준 window | 2026-03-26 ~ 2026-04-24 |
| 기준 시각 | 2026-04-25 11:10 KST |
| site | AIBIO |
| 광고 | `260401_리커버리랩 이벤트2` |
| action type | `lead`, `onsite_web_lead`, `offsite_conversion.fb_pixel_lead` |
| 값 | 각각 11 |
| 해석 | 세 action type은 서로 다른 33건이 아니라 같은 웹사이트 Pixel Lead의 보고 라벨로 본다 |
| confidence | 중상 |

현재 GTM 정본은 `aibio_form_submit` 이벤트를 받아 GA4 `generate_lead`와 Meta `Lead`를 보낸다. 따라서 Meta의 11건은 ChannelTalk Open이 아니라 아임웹 폼 성공 제출 후 발화한 Pixel `Lead`로 보는 것이 맞다.

다만 Meta API만으로는 실제 제출자 이름/전화번호/상담 내용 11건과 1:1 확정할 수 없다. Meta는 개인정보 원문을 반환하지 않고, 광고 보고서 action count만 제공한다. 1:1 확정에는 내부 폼 제출 원장 또는 아임웹 관리자 export가 필요하다.

## 현재 우리가 이미 수집 중인 것

AIBIO 푸터 v6/v7과 내부 attribution endpoint는 아임웹 API가 아니라 브라우저 성공 제출 시점의 자체 수집 경로다.

현재 수집 가능한 값은 아래다.

| 항목 | 현재 상태 |
|---|---|
| 제출 시각 | 가능. `clientObservedAt`, 서버 `loggedAt` |
| formId | 가능 |
| formPage | 가능 |
| formWidgetId | 가능 |
| UTM | 가능 |
| fbclid | 가능 |
| fbc/fbp | 가능 |
| GA session/client id | 가능 |
| 테스트 연락처 여부 | v7 후보에서 가능 |
| 일반 고객 이름/전화번호 원문 | 현재 저장하지 않음 |
| 일반 고객 상담 내용 원문 | 현재 저장하지 않음 |

현재 구조는 개인정보를 적게 저장하는 쪽으로 설계되어 있다. 이 방향은 맞다. 다만 Meta Lead 11건을 실제 제출자와 맞추려면 최소한 아래 중 하나가 필요하다.

1. 아임웹 관리자에서 입력폼 응답 CSV를 export한다.
2. 자체 원장에 `normalized_phone_hash` 또는 암호화된 연락처를 저장한다.
3. AIBIO CRM의 `marketing_leads`와 자체 원장을 시간/전화번호 해시 기준으로 연결한다.

## 헤더/푸터 코드로 더 가져올 수 있는가

가능하다. 이미 AIBIO 푸터 v6/v7은 아임웹 폼 제출 성공 시점에 자체 API로 `form_submit`을 보내고 있다. 같은 방식으로 화면에 보이는 입력폼 값을 더 읽어 우리 API에 저장할 수 있다.

다만 저장 위치를 나눠야 한다.

| 데이터 | 우리 API | GA4 | Meta |
|---|---|---|---|
| 제출 시각 | 가능 | 가능 | event time 가능 |
| 폼 ID/페이지/위젯 | 가능 | 가능 | 가능 |
| 이름 원문 | 가능하지만 비권장 | 금지 | 금지 |
| 전화번호 원문 | 가능하지만 비권장 | 금지 | 금지 |
| 전화번호 해시 | 가능 | 제한적, 신중 | CAPI user_data 후보 |
| 나이대 | 가능 | 가능 | 가능하지만 광고 최적화 파라미터로는 보수적 사용 |
| 유입 경로 | 가능 | 가능 | 가능 |
| 상담 신청 유형 | 가능 | 가능 | 가능 |
| 상담 목적 | 가능 | 비권장 | 비권장 |
| 증상/건강 고민 자유문 | 가능하지만 별도 보안 필요 | 금지 | 금지 |

현재 캡처의 `상담 목적`에는 체중 감량, 기초대사량 개선, 피부 미백, 식욕 개선, 붓기 개선 같은 건강/신체 관련 항목이 들어간다. 이 값은 내부 리드 품질 판정에는 유용하지만, GA4/Meta 광고 이벤트 파라미터로 보내면 민감 정보로 해석될 수 있다. 따라서 광고 플랫폼에는 보내지 않는다.

## GA4로 할 수 있는 것과 하면 안 되는 것

GA4는 원문 리드 저장소가 아니다. 이름, 전화번호, 개인 식별 가능한 내용을 보내면 안 된다. Google 공식 정책은 Analytics에 개인 식별 정보를 보내지 말라고 명시한다.

GA4에는 아래처럼 단계 이벤트만 보낸다.

| GA4 이벤트 | 의미 | 보낼 값 |
|---|---|---|
| `generate_lead` | 폼 제출 완료 | `lead_source`, `form_type`, `consult_type`, `value`, `currency` |
| `working_lead` | 상담사가 연락 시작 | `lead_status` |
| `qualify_lead` | 유효 리드 판정 | `value`, `currency`, 품질 bucket |
| `disqualify_lead` | 부적합 리드 판정 | 너무 상세하지 않은 reason bucket |
| `close_convert_lead` | 방문/결제 등 전환 | `value`, `currency` |

보내면 안 되는 값은 아래다.

- 이름
- 전화번호
- IP를 직접 식별자로 쓰는 값
- 상담 목적의 원문 건강 항목
- 자유 입력 상담 내용
- 사용자를 특정할 수 있는 form response ID

## Meta 광고 효율 개선 전략

### 1단계: 지금은 `Lead` 최적화 유지
현재 Meta 학습 신호는 `Lead`가 가장 직접적이다. `aibio_channeltalk_open`이나 랜딩 페이지 조회로 최적화 목표를 낮추면 리드 품질이 떨어질 가능성이 크다.

### 2단계: 우리 API에 리드 품질 원장 만들기
아임웹 폼 성공 제출 시점에 우리 API로 아래를 저장한다.

| 구분 | 저장값 |
|---|---|
| 식별 | `lead_id`, `form_id`, `form_widget_id`, `submitted_at` |
| 귀속 | `utm_*`, `fbclid`, `fbc`, `fbp`, landing, referrer |
| 연락처 매칭 | `normalized_phone_hash`, 필요 시 암호화 전화번호 |
| 폼 값 | 나이대, 유입 경로, 상담 신청 유형, 상담 목적 코드 |
| 품질 | 중복 여부, 유효 전화번호 여부, 테스트 여부 |
| 후속 결과 | 연락 성공, 상담 완료, 방문 예약, 방문 완료, 결제 |

### 3단계: 광고 플랫폼에는 고품질 단계만 되돌리기
Meta와 GA4에는 내부 원장 결과를 가공해서 보낸다.

| 내부 상태 | GA4 | Meta |
|---|---|---|
| 폼 제출 | `generate_lead` | `Lead` |
| 상담 시작 | `working_lead` | custom event 또는 보류 |
| 유효 리드 | `qualify_lead` | CAPI custom event 후보 |
| 방문 예약 | `close_convert_lead` 또는 `Schedule` | `Schedule` 후보 |
| 방문 후 결제 | `close_convert_lead` | 고품질 전환 후보 |

처음부터 고품질 이벤트로 광고세트 최적화를 바꾸지 않는다. 최근 7일 50건 수준의 이벤트 볼륨이 나오기 전까지는 `Lead`를 유지하고, 고품질 이벤트는 보고와 학습 보강에 쓴다.

### 4단계: 리드 점수로 소재 판단
캡처 기준 입력폼은 나이대, 유입 경로, 상담 신청 유형, 상담 목적을 받는다. 이를 내부 점수화한다.

| 점수 요소 | 예시 |
|---|---|
| 연락 가능성 | 전화번호 형식 정상, 중복 아님 |
| 상담 의도 | 문자/전화 상담 신청 유형 선택 |
| 유입 품질 | 광고/인스타그램/기타 구분 |
| 대상 적합도 | 운영 타겟 나이대 |
| 목적 적합도 | 센터가 실제로 해결 가능한 목적 |
| 후속 성과 | 상담 연결, 방문 예약, 방문 완료 |

광고 판단은 단순 `CPL`이 아니라 `qualified CPL`, `예약당 비용`, `방문당 비용`으로 바꾼다.

## 아임웹에 우리가 개발한 API를 넣을 수 있는가

넣을 수 있다. 어렵지 않다. 이미 AIBIO는 푸터 코드에서 `https://att.ainativeos.net/api/attribution/form-submit`로 데이터를 보내는 구조를 사용했다.

다만 두 가지 방식이 있다.

| 방식 | 판단 | 이유 |
|---|---|---|
| 기존 아임웹 입력폼 유지 + 헤더/푸터 JS 보강 | 1순위 | 관리자 입력폼 UI, 내보내기, 기존 운영 흐름을 유지하면서 우리 API 원장만 강화 가능 |
| HTML 커스텀 폼을 아임웹에 삽입 | 2순위 | 가능하지만 디자인/검증/스팸/개인정보/메시지 연동/관리자 응답 화면을 우리가 책임져야 함 |
| 외부 랜딩 페이지로 분리 | 3순위 | 자유도는 높지만 아임웹 운영 흐름과 분리되고 배포/호스팅/보안 책임이 커짐 |

따라서 지금은 아임웹 폼을 갈아엎지 않는다. 먼저 푸터 v8로 상세 원장을 보강하고, 내보내기 CSV와 맞춰본 뒤 부족하면 커스텀 폼을 검토한다.

## 권장 아키텍처

```text
Meta 광고
  -> AIBIO 아임웹 랜딩
  -> 기존 아임웹 입력폼 제출
  -> 푸터 JS가 성공 제출 감지
  -> 우리 API /api/attribution/form-submit 수신
  -> 내부 lead_quality 원장 저장
  -> GTM: generate_lead + Meta Lead
  -> 상담 결과 업데이트
  -> GA4/Meta CAPI에 품질 단계 이벤트만 전송
```

## v8 후보 필드

| 필드 | 설명 | 저장 위치 |
|---|---|---|
| `lead_id` | 제출 1건 식별자 | 우리 API |
| `submitted_at_client` | 브라우저 제출 시각 | 우리 API |
| `submitted_at_server` | 서버 수신 시각 | 우리 API |
| `form_name` | 예: 다이어트 페이지 DB | 우리 API |
| `form_widget_id` | 아임웹 위젯 ID | 우리 API |
| `phone_hash` | 정규화 전화번호 해시 | 우리 API |
| `phone_encrypted` | 운영 승인 시만 | 우리 API |
| `age_bucket` | 20대/30대/40대 등 | 우리 API, GA4 가능 |
| `source_path` | 광고/인스타그램 등 | 우리 API, GA4 가능 |
| `consult_type` | 문자/전화 | 우리 API, GA4 가능 |
| `goal_codes` | 내부 목적 코드 | 우리 API만 |
| `lead_score_bucket` | low/mid/high | 우리 API, GA4/Meta 가능 |
| `event_id` | Pixel/CAPI dedup | 우리 API, Meta |

`goal_codes`는 내부 분석에는 유용하지만, 광고 플랫폼 전송은 보류한다.

## 2026-04-25 v8 후보 생성 결과

생성 파일: `aibio/imwebcode_0425_v8.md`

이 후보는 기존 v7의 성공 제출 감지와 테스트 연락처 제외 로직을 유지하면서, 아래 값을 내부 API metadata에 추가한다.

| 구분 | v8 후보 처리 |
|---|---|
| 이름 | 원문 미전송. `name_present` 여부만 저장 |
| 전화번호 | 원문 미전송. 정규화 숫자의 SHA-256 해시만 내부 API metadata에 저장 |
| 나이대 | `age_bucket`으로 저장 |
| 알게 된 경로 | `source_path`로 저장 |
| 상담 신청 유형 | `consult_type`으로 저장 |
| 상담 목적 | 내부 코드 `goal_codes`로만 저장. GA4/Meta에는 미전송 |
| 리드 품질 | `lead_quality.score`, `lead_quality.bucket` 저장 |
| GA4/GTM dataLayer | `leadScoreBucket`, `consultType`, `sourcePath`, `ageBucket`만 전달 |

운영 반영 전 확인해야 할 것은 3가지다.

1. 아임웹 개인정보 수집 동의/처리방침 범위에서 내부 분석 서버에 전화번호 해시를 저장해도 되는지 확인한다.
2. `?__seo_attribution_debug=1`로 테스트 제출 1건을 보내고, metadata에 `form_fields_safe`와 `lead_quality`가 들어오는지 확인한다.
3. payload에 이름 원문, 전화번호 원문, 상담 목적 원문 문장이 들어가지 않는지 확인한다.

## 2026-04-25 푸터 v8 운영 반영 확인

TJ님이 아임웹 푸터 교체를 완료한 뒤 공개 페이지 소스를 확인했다.

| 확인 항목 | 결과 |
|---|---|
| 기준 시각 | 2026-04-25 12:50 KST |
| 확인 방법 | `curl -L -s`로 공개 HTML 소스 확인 |
| 확인 URL | `https://aibio.ai/`, `https://aibio.ai/59` |
| 헤더 first-touch | `2026-04-16-aibio-first-touch-v1` 유지 |
| 푸터 form-submit | `2026-04-25-aibio-form-submit-v8` 확인 |
| v8 전역 확인값 | `window.__AIBIO_FORM_SUBMIT_V8__` 확인 |
| v7 잔존 여부 | 확인 범위에서 `2026-04-16-aibio-form-submit-v7` 미검출 |
| confidence | 높음 |

해석은 명확하다. 헤더는 지우지 않고 유지한 것이 맞고, 푸터의 AIBIO form-submit 블록만 v8로 교체된 상태다.

아직 닫히지 않은 것은 실제 제출 수신 검증이다. 테스트 제출 1건이 들어오면 내부 원장에서 `form_fields_safe`, `lead_quality`, 원문 개인정보 미포함 여부를 확인해야 한다.

## 2026-04-25 실제 제출 수신 검증

TJ님이 `/59` 페이지에서 실제 폼 제출을 완료했고, Meta Pixel Helper 기준 `Lead` 이벤트가 정상 발화했다.

| 항목 | 결과 |
|---|---|
| 기준 시각 | 2026-04-25 12:52 KST |
| primary source | 운영 attribution API `https://att.ainativeos.net/api/attribution/ledger` |
| cross-check | Meta Pixel Helper |
| site | `aibio.ai` |
| page | `/59` |
| Meta 이벤트 | `Lead` 활성 |
| 내부 수신 | `form_submit`, `captureMode=live`, `source=aibio_imweb` |
| snippetVersion | `2026-04-25-aibio-form-submit-v8` |
| 개인정보 원문 | 이름 원문/전화번호 원문 미전송 확인 |
| 전화번호 해시 | 내부 metadata에만 존재 |
| 리드 품질 | `lead_quality.bucket=high` |
| confidence | 높음 |

수신 row에서 `form_fields_safe`와 `lead_quality`가 확인됐다. 따라서 “Meta Lead 발화 + 내부 v8 원장 수신 + 원문 개인정보 미전송”은 닫혔다.

같은 시간대에 `/shop_view?idx=25`에서 `2026-04-16-aibio-form-submit-v7` row가 1건 더 들어왔다. 공개 HTML을 다시 확인했을 때 `/shop_view?idx=25`도 현재는 v8로 내려오므로, 유력 원인은 교체 전 열려 있던 브라우저 탭 또는 캐시된 페이지에서 제출된 것이다. 현재 공개 페이지 기준 v7 잔존은 확인되지 않았다.

필드 품질 이슈도 하나 확인했다. `/59` 현재 폼에는 `상담 신청 유형` 필드가 없어서 `consult_type`이 비어 있는 것은 정상이다. 다만 빈 기타 직접입력칸이 `goal_codes=other`로 잡힐 수 있는 경로가 있어 `aibio/imwebcode_0425_v8.md`를 v8.1 후보로 보정했다.

## 2026-04-25 현재 입력폼 스냅샷

TJ님이 공유한 현재 `/59` 입력폼은 아래 구조다.

| 화면 필드 | 현재 여부 | v8.1 처리 |
|---|---|---|
| 이름 | 있음 | 원문 미전송, `name_present=true`만 저장 |
| 연락처 | 있음. 3칸 분리 입력 | 정규화 후 SHA-256 해시만 내부 metadata 저장 |
| 나이 | 있음 | `age_bucket` 저장 |
| 상담 목적 | 있음. 다중 선택 | 내부 `goal_codes`로만 저장 |
| 알게 된 경로 | 있음 | `source_path` 저장 |
| 상담 신청 유형 | 없음 | `consult_type` 공란이 정상 |
| 개인정보 수집 및 이용 동의 | 있음 | 제출 전제 조건. 이벤트 payload에는 원문 미포함 |
| 하단 고정 버튼 | 카톡 문의, 상담 신청 | 별도 CTA. 폼 제출 성공과 구분해서 봐야 함 |

상담 목적 매핑은 아래처럼 본다.

| 화면 선택값 | 내부 코드 |
|---|---|
| 체중 감량 | `weight_loss` |
| 기초대사량 개선 | `metabolism` |
| 피부 미백 | `skin_brightening` |
| 식욕 개선 | `appetite_control` |
| 붓기 개선 | `swelling` |
| 스트레스 관리 | `stress` |
| 기타 | `other` |

현재 폼에는 `문자 상담 신청`, `전화 상담 신청` 같은 상담 신청 유형 필드가 없다. 따라서 이전 아임웹 관리자 캡처에 있던 `상담 신청 유형`은 다른 폼 또는 과거 폼 기준일 가능성이 높다. 현재 `/59` 광고 판단에서는 `consult_type`을 필수 품질 조건으로 쓰지 않는다.

운영 코드 상태도 확인했다. 2026-04-25 13:23 KST 기준 공개 `/59`에는 `2026-04-25-aibio-form-submit-v8.1`이 내려오고 있다. 이후 2026-04-25 15:07 KST 테스트 제출에서 `extraction_version=2026-04-25-v8.1`과 테스트 연락처 분리가 확인됐다.

## 2026-04-25 v8.1 테스트 제출 검증

TJ님이 2026-04-25 15:07 KST에 테스트 연락처로 `/59` 폼을 제출했다.

| 항목 | 결과 |
|---|---|
| 기준 시각 | 2026-04-25 15:07 KST |
| 운영 원장 loggedAt | `2026-04-25T06:07:21.410Z` |
| source | 운영 attribution API |
| page | `/59` |
| snippetVersion | `2026-04-25-aibio-form-submit-v8.1` |
| extraction_version | `2026-04-25-v8.1` |
| is_test_contact | `true` |
| test_contact_reason | `phone_zero` |
| test_contact_matched_field | `phone` |
| lead_quality.bucket | `test` |
| 개인정보 원문 | 이름 원문/전화번호 원문 미전송 |
| goal_codes | `weight_loss` |
| confidence | 높음 |

해석: 테스트 연락처 차단은 의도대로 작동했다. `010-0000-0000` 계열 번호는 내부 원장에는 남지만, GTM에는 운영 이벤트 `aibio_form_submit`이 아니라 테스트 이벤트 `aibio_form_submit_test`로 보내는 구조다. 따라서 Meta `Lead`는 발화하지 않아야 맞다.

이 검증으로 v8.1의 세 가지 핵심 조건이 닫혔다.

1. 폼 제출 성공 시 내부 attribution 원장에 남는다.
2. 테스트 연락처는 `is_test_contact=true`, `lead_quality.bucket=test`로 분리된다.
3. 이름/전화번호 원문은 저장하지 않는다.

## 권장 데이터 기준

### Primary
실제 제출자, 제출 시각, 연락처, 상담 내용의 primary는 아임웹 관리자 입력폼 응답 또는 AIBIO CRM 원장이다.

### Cross-check
Meta `Lead`는 광고 플랫폼 보고용 cross-check다. 같은 제출을 여러 action type으로 표시할 수 있으므로 `lead`, `onsite_web_lead`, `offsite_conversion.fb_pixel_lead`를 합산하면 안 된다.

### Fallback
내부 attribution 원장은 광고 식별자와 제출 시각을 복구하는 fallback이자 분석 원장이다. 현재는 제출자 원문을 저장하지 않으므로, 제출자 확인용 primary는 아니다.

## 추천 구현안

### 최소안
아임웹 관리자에서 입력폼 응답 CSV를 주기적으로 내려받아 `aibio_form_submissions_export` 같은 로컬 테이블로 적재한다.

이 방식은 빠르다. API가 없어도 시작할 수 있다. 단점은 수동 export가 필요하다는 점이다.

### 권장안
아임웹 푸터 v8 후보를 운영 반영하면서 자체 원장 payload를 아래처럼 보강한다.

| 필드 | 저장 방식 | 이유 |
|---|---|---|
| `submitted_at` | 서버 시각 + 브라우저 시각 | Meta event time과 대조 |
| `form_id` | 원문 | GTM eventID와 대조 |
| `form_widget_id` | 원문 | 위젯별 성과 비교 |
| `form_page` | 원문 | 랜딩/CTA 비교 |
| `normalized_phone_hash` | salt 포함 SHA-256 또는 서버 암호화 | 실제 제출자 매칭 |
| `name_initial_or_empty` | 가능하면 저장 안 함 | 원문 개인정보 최소화 |
| `utm_*`, `fbclid`, `fbc`, `fbp` | 현재처럼 저장 | 광고 귀속 |
| `is_test_contact` | boolean | 테스트 제외 |
| `age_bucket` | 원문 선택값 | 품질 분석 |
| `source_path` | 원문 선택값 | 유입 품질 분석 |
| `consult_type` | 원문 선택값 | 상담 연결 방식 분석 |
| `goal_codes` | 내부 코드 | 광고 플랫폼에는 미전송 |

전화번호 원문을 저장할지는 별도 승인 사항으로 둔다. 분석 목적이면 해시만으로 충분하다. 상담 운영까지 같은 화면에서 해야 한다면 암호화 저장과 접근권한 통제가 필요하다.

### 피해야 할 것
- Meta action count만 보고 실제 제출자 수로 확정하지 않는다.
- `lead`, `onsite_web_lead`, `offsite_conversion.fb_pixel_lead`를 합산하지 않는다.
- 건강 고민, 증상, 상담 메시지 본문을 광고/분석 이벤트 payload로 보내지 않는다.
- 테스트 연락처를 운영 Lead에 섞지 않는다.

## 다음 액션
1. 완료: TJ님이 AIBIO 아임웹 관리자에서 입력폼 응답 화면과 내보내기 버튼을 확인했다.
2. 완료: Codex가 v7 기반 v8 후보를 만들었고, 실제 제출 후 빈 기타 직접입력 오인 방지를 넣은 v8.1 후보로 보정했다.
3. TJ님이 운영 반영 전, 전화번호 해시 저장이 개인정보 동의/처리방침 범위에 맞는지 확인한다.
4. 완료: TJ님이 v8 후보를 아임웹 푸터에 반영했고, Codex가 공개 페이지 소스에서 v8 반영을 확인했다.
5. 완료: Codex가 실제 수신 row를 확인해 `form_fields_safe`, `lead_quality`, 원문 개인정보 미포함 여부를 검증했다.
6. 완료: TJ님이 푸터를 v8.1 후보로 교체했고, Codex가 공개 페이지 소스에서 v8.1 반영을 확인했다.
7. 완료: 테스트 제출 1건에서 내부 원장 `extraction_version=2026-04-25-v8.1`, `is_test_contact=true`, `lead_quality.bucket=test`를 확인했다.
8. GA4에는 `generate_lead`, `working_lead`, `qualify_lead`, `close_convert_lead` 단계 이벤트만 보낸다.
9. Meta에는 현재 `Lead`를 유지하고, CAPI는 `Lead` dedup과 향후 `Schedule` 후보로 설계한다.
10. 최근 30일 기준 `Meta Lead count`, `내부 form_submit count`, `아임웹 응답 count`, `CRM marketing_leads count`를 같은 window로 비교한다.

## Phase 상세

#### Phase1-Sprint1
[[#Phase-Sprint 요약표|요약표로]]

**이름**: 공식 API 범위 확인
**상태**: 100% / 80%

- 무엇을 하는가: 아임웹 공식 Open API와 웹훅 문서를 확인해 폼 제출 조회 endpoint가 있는지 본다.
- 왜 필요한가: API로 바로 가져올 수 있으면 수동 export나 자체 원장 보강이 줄어든다.
- 확인 결과: 주문, 상품문의, 회원은 가능하지만 일반 입력폼 제출 목록 endpoint는 확인되지 않았다.
- 산출물: 이 문서의 API 범위 표.

#### Phase1-Sprint2
[[#Phase-Sprint 요약표|요약표로]]

**이름**: Meta Lead 의미 정의
**상태**: 100% / 70%

- 무엇을 하는가: 광고관리자 `Lead` 11건이 어떤 리드인지 정의한다.
- 왜 필요한가: ChannelTalk Open, 자동 버튼 클릭, 폼 제출 리드가 섞이면 광고 판단이 틀어진다.
- 확인 결과: 현재 GTM 구조상 11건은 `aibio_form_submit -> Meta Lead` 폼 제출 리드로 보는 것이 맞다.
- 남은 것: 실제 제출자 11명과의 1:1 대조.

#### Phase2-Sprint3
[[#Phase-Sprint 요약표|요약표로]]

**이름**: 제출자 매칭 원장 설계
**상태**: 90% / 30%

- 무엇을 하는가: Meta Lead, 내부 form_submit, 아임웹 응답, CRM 리드를 같은 제출로 묶는 기준을 만든다.
- 왜 필요한가: 폼 제출 이후 상담 연결률과 방문 예약률을 봐야 광고비를 늘릴 수 있다.
- 권장 조인키: `submitted_at ± 10분`, `formId`, `formPage`, `utm_campaign`, `fbclid/fbc`, `normalized_phone_hash`.
- 완료: v8 후보에서 전화번호 원문 없이 `phone_hash_sha256`과 선택값 기반 품질 필드를 내부 metadata로 보내도록 설계했다.
- 승인 필요: 전화번호 해시 저장이 개인정보 동의/처리방침 범위에 맞는지 확인.

#### Phase2-Sprint4
[[#Phase-Sprint 요약표|요약표로]]

**이름**: 운영 데이터 교차검증
**상태**: 40% / 10%

- 무엇을 하는가: 같은 기간의 Meta Lead, 내부 form_submit, 아임웹 응답, CRM 리드를 비교한다.
- 왜 필요한가: Meta 숫자만으로는 실제 상담 가능 리드인지 알 수 없다.
- 완료 기준: 최근 30일 기준 네 데이터 소스의 차이가 설명된다.
- 완료: 공개 페이지 기준 푸터 v8 반영은 확인했다.
- 다음 행동: 테스트 제출 1건을 받아 내부 원장 row를 확인하고, 아임웹 관리자 export 또는 CRM 원장 접근으로 실제 제출자 기준을 확보한다.

#### Phase3-Sprint5
[[#Phase-Sprint 요약표|요약표로]]

**이름**: 고품질 리드 최적화
**상태**: 70% / 25%

- 무엇을 하는가: 단순 폼 제출이 아니라 상담 연결/방문 예약으로 이어지는 리드를 광고 판단 기준으로 올린다.
- 왜 필요한가: AIBIO는 오프라인 센터라 폼 제출만 많아도 방문이 없으면 광고비를 늘릴 근거가 없다.
- 산출물: lead score, qualified lead 원장, 상담/방문 결과 이벤트.
- 완료: 실제 제출 row에서 `lead_quality.bucket=high` 수신을 확인했다.
- 보정: 빈 기타 직접입력칸이 `goal_codes=other`로 잡힐 수 있는 경로를 v8.1 후보에서 차단했다.
- 다음 행동: 상담 결과를 기록할 최소 상태값을 정한다. 추천은 `new`, `contacted`, `qualified`, `booked`, `visited`, `paid`, `invalid`, `duplicate`다.

#### Phase3-Sprint6
[[#Phase-Sprint 요약표|요약표로]]

**이름**: 아임웹 커스텀 폼 판단
**상태**: 60% / 20%

- 무엇을 하는가: 아임웹 기본 입력폼을 유지할지, 커스텀 HTML 폼으로 갈아탈지 판단한다.
- 왜 필요한가: 기본 입력폼은 관리자 운영이 쉽고, 커스텀 폼은 데이터 통제가 쉽다.
- 현재 판단: 지금은 기본 입력폼 유지가 맞다. 푸터 JS와 우리 API로 충분히 보강 가능하다.
- 커스텀 전환 조건: 아임웹 DOM 변경으로 수집이 자주 깨지거나, 관리자 export/운영 흐름보다 데이터 통제가 더 중요해질 때.

## 참고 문서
- 아임웹 신규 개발자 문서: [https://developers-docs.imweb.me/guide/imweb-developers](https://developers-docs.imweb.me/guide/imweb-developers)
- 아임웹 주문 이해하기: [https://developers-docs.imweb.me/guide/%EC%A3%BC%EB%AC%B8-%EC%9D%B4%ED%95%B4%ED%95%98%EA%B8%B0](https://developers-docs.imweb.me/guide/%EC%A3%BC%EB%AC%B8-%EC%9D%B4%ED%95%B4%ED%95%98%EA%B8%B0)
- 아임웹 웹훅 연동 가이드: [https://developers-docs.imweb.me/guide/%EA%B0%9C%EB%B0%9C-%EA%B0%80%EC%9D%B4%EB%93%9C-%ED%99%95%EC%9D%B8%ED%95%98%EA%B8%B0/%EC%9B%B9%ED%9B%85-%EC%97%B0%EB%8F%99-%EA%B0%80%EC%9D%B4%EB%93%9C](https://developers-docs.imweb.me/guide/%EA%B0%9C%EB%B0%9C-%EA%B0%80%EC%9D%B4%EB%93%9C-%ED%99%95%EC%9D%B8%ED%95%98%EA%B8%B0/%EC%9B%B9%ED%9B%85-%EC%97%B0%EB%8F%99-%EA%B0%80%EC%9D%B4%EB%93%9C)
- 아임웹 이전 주문 조회 문서: [https://old-developers.imweb.me/orders/get](https://old-developers.imweb.me/orders/get)
- 아임웹 이전 상품 문의 조회 문서: [https://old-developers.imweb.me/cs/get](https://old-developers.imweb.me/cs/get)
- Google Analytics PII 방지 공식 문서: [https://support.google.com/analytics/answer/6366371](https://support.google.com/analytics/answer/6366371)
- GA4 추천 이벤트 공식 문서: [https://support.google.com/analytics/answer/9268036](https://support.google.com/analytics/answer/9268036)
- GA4 추천 이벤트 개발자 문서: [https://developers.google.com/analytics/devguides/collection/ga4/reference/events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
- 로컬 GTM 기록: `aibio/gtm.md`
- 로컬 AIBIO 전환 정합성 문서: `aibio/aibio0416.md`
- 로컬 채널톡 퍼널 문서: `aibio/채널톡퍼널.md`

## 검증 기준
- wiki 링크 검증: `python3 scripts/validate_wiki_links.py aibio/아임웹폼제출API검토.md`
- API 근거는 공식 아임웹 개발자 문서 우선.
- 개인정보 원문 저장이 필요한 변경은 별도 승인 후 진행.
