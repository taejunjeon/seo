# AIBIO 리커버리랩스 유입/전환 정합성 작업 계획

작성일: 2026-04-16
대상 사이트: `https://aibio.ai`
현재 기준 전환: 구매가 아니라 **입력폼 제출 리드**

## 바로 다음에 뭐할지

1. 헤더 상단 first-touch 코드와 푸터 v6 교체는 완료됐다. 운영 attribution 원장에는 `2026-04-16 08:03:56 KST`에 `snippetVersion=2026-04-16-aibio-form-submit-v6` 폼 제출이 들어온 것을 확인했다.
2. Meta Pixel Helper에 보인 `SubscribedButtonClick`은 Meta의 자동 버튼 클릭 감지다. 우리 내부 원장 `form_submit` 수집 성공과는 별개이며, Meta 광고 최적화용 `Lead` 전환으로 보기에는 부족하다.
3. Meta `Lead` 전환 연결은 **운영 표준은 GTM**으로 확정했고, `GTM-T8FLZNT`에 `aibio_form_submit -> Meta Lead` 태그를 게시했다. 푸터에서 `fbq('track', 'Lead')`를 직접 보내는 방식은 쓰지 않는다.
4. Meta 광고관리자 CSV는 광고 ID까지 들어온 상태라 1차 개선됐지만, 아직 `웹사이트 URL`, `URL 매개변수`가 없다. 다음 export에는 이 두 컬럼을 반드시 추가한다.
5. AIBIO GTM 정본은 TJ님 판단 기준 `GTM-T8FLZNT`로 정리한다. 기존 문서의 `GTM-NM988QL`은 과거/불일치 후보로 본다.
6. Meta 광고계정 ID `377604674894011`은 광고비/캠페인 조회용이고, Pixel ID `1068377347547682`와 다르다. API에서는 `act_377604674894011` 형태로 쓴다.
7. 푸터 v7 후보는 Meta 직접 전송용이 아니라 **테스트 연락처 자동 제외용**이다. 파일은 `aibio/imwebcode_0416_v7.md`이며, 이름 `테스트` 또는 전화번호 `010-0000-0000` 계열이면 원문/해시를 저장하지 않고 `metadata.is_test_contact=true`만 보낸다.

## 2026-04-16 설치 후 검증 스냅샷

TJ님이 헤더 상단 코드와 푸터 v6를 교체한 뒤 폼 제출을 테스트했다.

### 내부 attribution 원장 확인

운영 수집 endpoint `https://att.ainativeos.net` 기준으로 AIBIO `form_submit`이 정상 적재됐다.

| 항목 | 확인값 |
|---|---|
| 적재 시각 | `2026-04-16 08:03:56 KST` |
| source | `aibio_imweb` |
| touchpoint | `form_submit` |
| snippetVersion | `2026-04-16-aibio-form-submit-v6` |
| form widget | `w20250218fdfa6318ce162` |
| trigger | `confirmInputForm` |
| GA session ID | 수집됨 |
| client_id / user_pseudo_id | 수집됨 |
| fbc / fbp | 수집됨 |
| UTM / fbclid | 수집됨 |

즉 “폼 제출이 우리 자체 attribution 원장에 들어오는가”는 통과다.

### Meta Pixel Helper 확인

Pixel Helper에는 아래 이벤트가 보였다.

| 항목 | 확인값 |
|---|---|
| Pixel ID | `1068377347547682` |
| 자동 감지 이벤트 | `SubscribedButtonClick` |
| buttonText | `맞춤형 상담 무료신청` |
| Setup method | `Automatically Detected` |

이 이벤트는 Meta가 버튼 클릭을 자동으로 잡은 것이다. 아직 표준 `Lead` 이벤트 또는 우리가 의도한 명시적 폼 제출 전환이라고 단정하면 안 된다. Meta 광고관리자에서 리드 전환으로 쓰려면 `Lead` 표준 이벤트 또는 맞춤 전환을 별도로 닫아야 한다.

### 카카오 로그인 팝업

폼 제출 후 `https://accounts.kakao.com/login/?continue=https%3A%2F%2Fpf.kakao.com%2F_jRxcPK%2Fchat#login`가 뜬 것은 AIBIO 페이지/아임웹 폼의 제출 후 이동 또는 카카오 채널 상담 연결 동작으로 보인다.

우리 v6 attribution 코드는 카카오 로그인으로 리다이렉트하지 않는다. 현재 코드 역할은 폼 제출 시점에 자체 원장으로 전환 정보를 보내는 것이다. 다만 사용자 경험상 폼 제출 직후 카카오 로그인이 뜨는 것이 의도된 흐름인지 별도 확인이 필요하다.

### 테스트 데이터 처리

이번 테스트 URL에는 `__seo_attribution_debug=1`이 포함되어 있어 운영 성과 분석에서는 테스트로 제외하는 것이 맞다. 원장 payload의 현재 `metadata.is_debug`는 `false`로 들어왔지만, top-level landing/referrer에 debug marker가 남아 있어 분석 API의 테스트 제외 로직에서 걸러질 수 있다.

추가 보강으로 푸터 v7 후보를 만들었다. v7은 URL에 `__seo_attribution_debug=1`을 매번 붙이지 않아도, 폼 입력값이 테스트 연락처이면 원장에는 `is_test_contact=true`를 남기고 GTM에는 `aibio_form_submit_test` 이벤트를 보낸다. 따라서 테스트 연락처 제출은 내부 원장에 남되 GA4/Meta Lead 운영 태그의 `aibio_form_submit` 트리거에서는 빠진다.

| 항목 | v7 처리 |
|---|---|
| 이름이 `테스트` 또는 `test` | `metadata.is_test_contact=true`, `test_contact_reason=name_test` |
| 전화번호가 `010-0000-0000` 또는 `010-000-0000` 계열 | `metadata.is_test_contact=true`, `test_contact_reason=phone_zero` |
| 원문 이름/전화번호 | 저장하지 않음 |
| 해시 | 저장하지 않음 |
| GTM 이벤트 | 테스트 연락처면 `aibio_form_submit_test`, 일반 제출이면 `aibio_form_submit` |
| 코드 후보 | `aibio/imwebcode_0416_v7.md` |

## 현재 결론

현재 AIBIO 광고는 트래픽은 만들고 있지만, **운영 판단용 전환 데이터가 아직 약하다.**

추가로 받은 광고 레벨 CSV 2개 기준, `26.01.16 리커버리랩 예약 캠페인`은 2026-03-17부터 2026-04-15까지 `₩1,497,164`을 집행했고, 결과는 `16,917`건으로 잡혀 있다. 하지만 결과 표시 도구가 `actions:omni_landing_page_view`라서 이 값은 폼 제출이 아니라 랜딩 페이지 조회로 봐야 한다.

`리드 캠페인 (소재복사 0406_2352)`는 `₩559,743`을 집행했고 링크 클릭은 `656`건이지만, CSV상 결과는 `0`이다. 현재 Meta 캠페인에는 폼 제출/리드 전환값이 안정적으로 잡힌 근거가 없다.

즉 지금 Meta 화면에서 보이는 성과는 “예약/상담 리드가 몇 명 들어왔는지”가 아니라 “광고 클릭 후 랜딩 페이지를 본 사람이 몇 명인지”에 가깝다. AIBIO는 오프라인 센터 리드 사업이므로, 앞으로 기준 지표는 `폼 제출 수`, `폼 제출당 비용`, `상담 연결률`, `방문 예약률`, `방문 후 결제율`로 바꿔야 한다.

## 첨부 CSV 검토

현재 참조 파일:

- `/Users/vibetj/coding/seo/aibio/AIBIO-리커버리랩스-광고-2026.-3.-17.-~-2026.-4.-15. (1).csv`
- `/Users/vibetj/coding/seo/aibio/AIBIO-리커버리랩스-광고-2026.-3.-17.-~-2026.-4.-15..csv`

두 파일 모두 이제 `광고 이름`, `광고 ID`, `광고 세트 ID`, `캠페인 ID`가 들어있다. 이전 캠페인 레벨 CSV보다 한 단계 나아졌다.

### 들어있는 핵심 컬럼

공통으로 확인된 핵심 컬럼은 아래다.

| 구분 | 컬럼 |
|---|---|
| 광고 식별 | 캠페인 이름, 캠페인 ID, 광고 세트 이름, 광고 세트 ID, 광고 이름, 광고 ID |
| 집행 상태 | 광고 게재, 광고 세트 게재, 캠페인 게재 |
| 비용/트래픽 | 지출 금액, 노출, 도달, 링크 클릭, CPC, CPM, CTR |
| 결과 | 결과, 결과 표시 도구, 결과당 비용 |

아직 없는 핵심 컬럼:

- `웹사이트 URL`
- `URL 매개변수`
- `표시 링크`
- `목적지`

이 4개가 없으면 광고별 UTM을 자동 확정하기 어렵다.

### 현재 파일로 알 수 있는 것

| 파일 | 캠페인 | 광고 수 | 지출 | 링크 클릭 | 결과 | 결과 의미 |
|---|---|---:|---:|---:|---:|---|
| `(1).csv` | `리드 캠페인 (소재복사 0406_2352)` | 5 | ₩559,743 | 656 | 0 | 리드/웹사이트 리드 미집계 |
| `..csv` | `26.01.16 리커버리랩 예약 캠페인` | 8 | ₩1,497,164 | 18,349 | 16,917 | 랜딩 페이지 조회 |

상위 광고:

| 캠페인 | 광고 | 지출 | 링크 클릭 | 결과 |
|---|---|---:|---:|---:|
| `26.01.16 리커버리랩 예약 캠페인` | `260116_연뜰스토리_리커버리랩` | ₩1,306,758 | 15,780 | 14,557 |
| `26.01.16 리커버리랩 예약 캠페인` | `260116_연뜰스토리_리커버리랩 - 플레이스랜딩` | ₩190,287 | 2,568 | 2,359 |
| `리드 캠페인 (소재복사 0406_2352)` | `260116_연뜰스토리_리커버리랩 자사몰 랜딩` | ₩312,968 | 335 | 0 |
| `리드 캠페인 (소재복사 0406_2352)` | `260401_리커버리랩 이벤트2` | ₩217,668 | 268 | 0 |
| `리드 캠페인 (소재복사 0406_2352)` | `260401_리커버리랩 이벤트1` | ₩29,107 | 53 | 0 |

### 현재 파일로 아직 알 수 없는 것

- 각 광고의 실제 랜딩 URL
- 광고별 URL 매개변수
- `aibio.ai/59`, `aibio.ai/53` 중 어느 랜딩이 어느 광고에 연결됐는지
- Meta가 `Lead` 또는 웹사이트 폼 제출을 전환으로 잡고 있는지
- 우리 자체 원장 `form_submit`과 Meta 광고 행을 URL/UTM 기준으로 정확히 연결할 수 있는지

따라서 이번 CSV는 “광고 ID별 비용과 클릭 규모 확인용”으로는 개선됐지만, “광고별 폼 제출 성과 판단용”으로는 아직 부족하다.

## Meta 광고관리자 export 세팅

다음 export는 **캠페인 레벨이 아니라 광고 레벨**로 받는 것이 좋다.

### 기간

두 번 받는다.

| 용도 | 기간 |
|---|---|
| 현재 전체 분석 | 2026-03-17 ~ 2026-04-15 |
| 최근 운영 품질 확인 | 최근 7일 |

### 화면 위치

1. Meta 광고관리자에서 AIBIO 광고 계정 선택
2. 상단 탭에서 `광고` 선택
3. 기간을 위 기준으로 설정
4. `열: 광고 성과 지표` 또는 현재 선택된 열 버튼 클릭
5. `열 맞춤 설정` 클릭
6. 아래 컬럼을 검색해서 추가
7. CSV로 내보내기

### 꼭 추가할 한글 컬럼

광고 계층 식별:

| 필요한 값 | Meta 한글 컬럼명 |
|---|---|
| 캠페인 이름 | 캠페인 이름 |
| 캠페인 ID | 캠페인 ID |
| 광고 세트 이름 | 광고 세트 이름 |
| 광고 세트 ID | 광고 세트 ID |
| 광고 이름 | 광고 이름 |
| 광고 ID | 광고 ID |
| 게재 상태 | 게재 |

비용/트래픽:

| 필요한 값 | Meta 한글 컬럼명 |
|---|---|
| 지출 | 지출 금액 (KRW) |
| 노출 | 노출 |
| 도달 | 도달 |
| 빈도 | 빈도 |
| 링크 클릭 | 링크 클릭 |
| 랜딩 페이지 조회 | 랜딩 페이지 조회 |
| CTR | CTR(링크 클릭률) 또는 CTR(전체) |
| CPC | CPC(링크 클릭당 비용) 또는 CPC(전체) |

랜딩/UTM 확인:

| 필요한 값 | Meta 한글 컬럼명 |
|---|---|
| 웹사이트 URL | 웹사이트 URL |
| URL 매개변수 | URL 매개변수 |
| 표시 링크 | 표시 링크 |
| 목적지 | 목적지 또는 랜딩 페이지 관련 컬럼 |

전환 확인:

| 필요한 값 | Meta 한글 컬럼명 |
|---|---|
| 결과 | 결과 |
| 결과 표시 도구 | 결과 표시 도구 |
| 결과당 비용 | 결과당 비용 |
| 리드 | 리드 |
| 웹사이트 리드 | 웹사이트 리드 |
| Meta 리드 | Meta 리드 또는 인스턴트 양식 리드 |
| 맞춤 전환 | 사용자 지정 전환 또는 맞춤 전환 관련 컬럼 |
| 기여 설정 | 기여 설정 |

주의:

- AIBIO는 구매 전환 사업이 아니므로 `구매 ROAS`, `구매 전환값`은 당장 핵심 지표가 아니다.
- 광고관리자 기본 기여는 `클릭 후 7일 또는 조회 후 1일`일 수 있다. 우리 내부 유입 분석과 비교할 때는 `클릭 1일` 기준도 같이 봐야 한다.
- 컬럼명이 영어와 1:1로 안 맞을 수 있으므로, 위 한글명으로 검색하는 것이 빠르다.

## 현재 삽입 코드 진단

참조 파일:

- `aibio/imwebcode.md`
- `footer/coffee_code_0415.md`

### 현재 AIBIO 코드에서 확인된 값

| 항목 | 현재 코드 기준 |
|---|---|
| Meta Pixel ID | `1068377347547682` |
| GTM | `GTM-T8FLZNT` |
| Google Ads | `AW-10976547519` |
| GA4 측정 ID | `G-PQWB91F4VQ` |
| 자체 원장 source | `aibio_imweb` |
| 폼 제출 endpoint | `https://att.ainativeos.net/api/attribution/form-submit` |
| 폼 제출 snippetVersion | `2026-04-08-formfetchfix-v5` |

### 문서와 실제 코드 불일치

기존 `aibio/aibio.md`에는 GTM 정본이 `GTM-NM988QL`로 적혀 있다. 하지만 현재 `aibio/imwebcode.md`에는 `GTM-T8FLZNT`가 들어가 있다.

또 기존 문서 일부에는 Pixel ID가 `1068377547682`로 적혀 있는데, 현재 코드와 백엔드 기본값은 `1068377347547682`다. 가운데 숫자 순서가 다르므로 단순 오타로 넘기면 안 된다.

현재 기준은 아래처럼 정리한다.

| 항목 | 현재 판단 | 이유 |
|---|---|
| GTM 정본 | `GTM-T8FLZNT` | TJ님 판단과 현재 아임웹 삽입 코드가 일치한다. |
| 오래된 GTM 후보 | `GTM-NM988QL` | 기존 문서에만 남은 과거/불일치 후보로 본다. |
| Meta Pixel ID | `1068377347547682` | 현재 코드와 백엔드 기본값 기준이다. |
| Meta 광고계정 ID | `377604674894011`, API 표기 `act_377604674894011` | 광고비/캠페인/광고세트/광고 성과 조회용이다. Pixel ID와 다르다. |

Meta 광고계정 ID와 Meta Pixel ID는 다르다. 광고계정 ID는 “광고를 집행하고 비용을 조회하는 계정”이고, Pixel ID는 “사이트에서 발생한 PageView/Lead 같은 이벤트를 받는 데이터 소스”다.

따라서 광고 CSV/API 조회에는 `act_377604674894011`을 쓰고, 브라우저 Pixel Helper / Events Manager에서는 `1068377347547682`를 확인해야 한다.

### 현재 폼 제출 코드는 작동하지만 v6 보강이 필요함

현재 AIBIO 푸터는 폼 제출을 감지해서 자체 원장으로 보내는 구조다. 이 방향은 맞다.

다만 현재 코드에는 약점이 있다.

| 약점 | 영향 |
|---|---|
| `_p1s1a_last_touch`를 읽지만 저장하는 코드가 현재 파일에 없다 | 최초 광고 유입 UTM/fbclid가 폼 제출 시점까지 안정적으로 보존되지 않을 수 있다. |
| `_fbc`, `_fbp`를 payload에 넣지 않는다 | Meta 클릭/브라우저 식별자 복구력이 biocom/coffee 최신 코드보다 낮다. |
| debug/test 제출을 payload에서 명시적으로 구분하지 않는다 | 테스트 폼 제출 제외가 URL/휴리스틱에 의존하게 된다. |
| Meta `Lead` 이벤트와 자체 `form_submit` 원장이 아직 같은 기준으로 닫혀 있지 않다 | Meta는 전환 0건처럼 보이고, 내부 원장에는 폼 제출이 잡히는 상황이 생긴다. |

이에 대한 붙여넣기용 전체 후보 코드는 `aibio/imwebcode_0416_v6.md`로 작성했다.

## 코드 삽입 방향

### 지금 바로 권장하는 방향

구매용 `Purchase` 코드는 AIBIO에 넣지 않는다. AIBIO의 메인 전환은 폼 제출이므로, `Lead` 또는 내부 원장 `form_submit` 중심으로 설계해야 한다.

가장 먼저 할 일은 아래 2개다.

1. 헤더 상단에서 최초 유입값을 저장한다.
2. 푸터 폼 제출 payload에 `fbc`, `fbp`, `first_touch`, `last_touch`, `is_test`를 보강한다.

### Meta Lead 연결 방식 판단

폼 제출을 Meta 광고관리자에서 리드 전환으로 쓰려면 Meta Pixel 쪽에도 `Lead` 이벤트가 들어가야 한다. 현재 운영 방식은 GTM `GTM-T8FLZNT`에서 `aibio_form_submit`을 받아 Meta `Lead` 태그를 발화하는 구조다.

선택지는 2개였고, 현재는 GTM 방식으로 확정했다.

| 방식 | 장점 | 단점 | 적합한 상황 |
|---|---|---|---|
| GTM에서 `aibio_form_submit` 트리거로 Meta `Lead` 태그 생성 | 운영 관리가 깔끔하다. 코드 수정 없이 GTM에서 켜고 끌 수 있다. GA4, Meta, 향후 다른 매체 태그를 한 이벤트 기준으로 묶기 좋다. 태그 발화 이력을 GTM Preview로 확인하기 쉽다. | GTM 권한이 필요하다. 태그/트리거 설정을 잘못하면 발화가 안 되거나 중복 발화될 수 있다. | GTM 접근권한이 있고, 장기 운영 기준을 만들 때 |
| 푸터에서 성공 제출 시 `fbq('track', 'Lead')` 직접 전송 | GTM 권한이 없을 때 임시 검증이 가능하다. | 현재는 GTM Lead가 게시되어 있으므로 같이 쓰면 중복 위험이 크다. | 지금은 사용하지 않음 |

결론은 아래다.

| 기준 | 권장 |
|---|---|
| 운영 표준 | GTM 방식 |
| 빠른 임시 검증 | 이제 불필요. GTM 방식 게시 완료 |
| 동시에 사용 | 금지 |
| event_id 기준 | `Lead.{formId}` 또는 `Lead.{formWidgetId}.{timestamp}`처럼 1회 제출마다 고유하게 생성 |
| 중복 방지 | 같은 폼 제출에서 GTM Lead와 푸터 Lead가 같이 나가지 않게 하나만 활성화 |

현재 AIBIO는 GTM 정본을 `GTM-T8FLZNT`로 정리했고, 장기적으로도 GTM 방식이 맞다. 이유는 AIBIO는 구매가 아니라 리드 사업이라 앞으로 `Lead`, `상담 연결`, `방문 예약`, `방문 완료`, `결제`처럼 단계가 늘어날 가능성이 높기 때문이다. 이때 모든 매체 태그를 푸터 코드에 계속 추가하면 관리가 어려워진다.

푸터 v7은 Meta 직접 전송용이 아니라 테스트 연락처 자동 분류용으로 재정의한다. 이 경우 v7은 아래 원칙을 지켜야 한다.

1. 아임웹 폼 성공 콜백 또는 성공 모달 확인 후에만 내부 원장 `form_submit`을 보낸다.
2. 이름 `테스트` 또는 전화번호 `010-0000-0000` 계열이면 원문/해시 없이 `is_test_contact=true`만 보낸다.
3. 테스트 연락처는 GTM에 `aibio_form_submit_test`로 보내고, 일반 제출만 `aibio_form_submit`으로 보낸다.
4. 푸터에서 Meta `Lead`를 직접 보내지 않는다. Meta `Lead`는 GTM 방식만 유지한다.
5. 내부 성과 판단은 자체 원장 기준으로 하고, 테스트 연락처는 `/acquisition-analysis` 운영 전환에서 제외한다.

### 헤더 상단 삽입 후보

아래 코드는 Meta/GTM보다 위에 두는 것이 좋다. 목적은 사용자가 광고 URL로 들어왔을 때 UTM, `fbclid`, `gclid`, `ttclid`, `_fbc`, `_fbp`를 브라우저에 먼저 저장하는 것이다.

```html
<!-- AIBIO first-touch capture v1 -->
<script>
(function () {
  var VERSION = '2026-04-16-aibio-first-touch-v1';
  var FIRST_KEY = '_p1s1a_first_touch';
  var LAST_KEY = '_p1s1a_last_touch';

  function trim(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function readCookie(name) {
    var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
    var match = document.cookie.match(pattern);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function readJson(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  var params = new URLSearchParams(window.location.search);
  var touch = {
    source: 'aibio_imweb',
    snippetVersion: VERSION,
    capturedAt: new Date().toISOString(),
    landing: window.location.href,
    referrer: document.referrer || '',
    utm_source: trim(params.get('utm_source')),
    utm_medium: trim(params.get('utm_medium')),
    utm_campaign: trim(params.get('utm_campaign')),
    utm_content: trim(params.get('utm_content')),
    utm_term: trim(params.get('utm_term')),
    fbclid: trim(params.get('fbclid')),
    gclid: trim(params.get('gclid')),
    ttclid: trim(params.get('ttclid')),
    fbc: readCookie('_fbc'),
    fbp: readCookie('_fbp')
  };

  var hasMarketingSignal =
    touch.utm_source ||
    touch.utm_medium ||
    touch.utm_campaign ||
    touch.fbclid ||
    touch.gclid ||
    touch.ttclid ||
    touch.fbc ||
    touch.fbp;

  if (hasMarketingSignal || !readJson(FIRST_KEY).capturedAt) {
    writeJson(FIRST_KEY, touch);
  }
  if (hasMarketingSignal || !readJson(LAST_KEY).capturedAt) {
    writeJson(LAST_KEY, touch);
  }
})();
</script>
```

### 푸터 코드 보강 방향

현재 `aibio/imwebcode.md`의 기존 푸터 코드는 전체 삭제 후 `aibio/imwebcode_0416_v6.md`의 `2. 푸터 코드 전체 교체본`으로 바꾸는 것이 가장 덜 헷갈린다.

보강해야 할 필드:

| 위치 | 추가할 값 |
|---|---|
| tracking | `fbc`, `fbp` |
| payload 최상위 | `fbc`, `fbp` |
| metadata | `first_touch`, `last_touch`, `is_debug`, `snippetVersion: 2026-04-16-aibio-form-submit-v6` |

주의:

- v6 전체 교체본은 `aibio/imwebcode_0416_v6.md`에 작성 완료했다.
- 헤더 상단 코드는 이미 추가했고, 푸터는 기존 푸터 전체를 지운 뒤 v6 전체 교체본을 붙여넣는다.
- 기존 Meta Pixel/GTM/Google Ads 기본 태그는 헤더/바디 영역에 있으므로 유지한다.
- 기존 푸터의 `payment-success` 결제 추적은 이번 리드 분석 목적에서 제외한다.
- AIBIO는 구매 사이트가 아니므로 `Purchase` 이벤트 코드는 넣지 않는다.

## Phase 요약

| Phase | 완성도 | 목표 | 지금 상태 | 다음 액션 |
|---|---:|---|---|---|
| [[#Phase 1. 광고 export 정상화|Phase 1. 광고 export 정상화]] | 60% | 광고/광고세트/랜딩 URL까지 내려받기 | 광고 ID까지는 확보, URL/매개변수 없음 | TJ님이 URL 컬럼 포함 CSV 재export |
| [[#Phase 2. 삽입 코드 정본 확인|Phase 2. 삽입 코드 정본 확인]] | 75% | GTM/Pixel/GA4/Google Ads ID 일치 | GTM `GTM-T8FLZNT` 확정 방향, Pixel/광고계정 구분 완료 | Events Manager에서 Pixel 이벤트 화면 확인 |
| [[#Phase 3. 폼 제출 식별자 보강|Phase 3. 폼 제출 식별자 보강]] | 80% | UTM/fbclid/fbc/fbp를 폼 제출까지 보존 | `imwebcode_0416_v6.md` 작성 완료 | TJ님이 아임웹 삽입 후 테스트 제출 |
| [[#Phase 4. Meta Lead 전환 연결|Phase 4. Meta Lead 전환 연결]] | 25% | Meta가 폼 제출을 리드 전환으로 인식 | CSV에는 리드 전환 근거 없음 | TJ님 Events Manager 화면 제공 |
| [[#Phase 5. 운영 리드 품질 분석|Phase 5. 운영 리드 품질 분석]] | 20% | 광고 리드 -> 상담 -> 방문 -> 결제 연결 | 폼 제출까지만 있음 | 상담/방문 결과 입력 구조 필요 |

## Phase 1. 광고 export 정상화

### TJ님 할 일

1. Meta 광고관리자에서 AIBIO 광고 계정을 연다.
2. 기간을 `2026-03-17 ~ 2026-04-15`로 설정한다.
3. 상단 탭을 `광고`로 바꾼다.
4. 현재처럼 광고 ID가 보이는 상태에서 `웹사이트 URL`, `URL 매개변수`, `표시 링크`, `목적지` 컬럼을 추가한다.
5. CSV로 다시 내보낸다.
6. 같은 방식으로 최근 7일도 한 번 더 내보낸다.

### 내가 할 일

1. 새 CSV에서 광고별 URL/UTM을 파싱한다.
2. 내부 `form_submit` 원장의 `utm_campaign`, `fbclid`, landing URL과 매칭한다.
3. 캠페인/광고세트/광고별 폼 제출 수와 CPL을 계산한다.
4. `/acquisition-analysis`에 AIBIO 광고별 인사이트를 붙일 수 있는지 판단한다.

### 완료 기준

- 광고별 `웹사이트 URL`과 `URL 매개변수`가 보인다.
- `meta_recoverylab_allcareevent_aibioshop`, `meta_recoverylab_yeonddle_aibioshop` 같은 UTM 값이 어느 광고에서 왔는지 확인된다.
- 광고별 지출 대비 내부 폼 제출 수를 계산할 수 있다.

## Phase 2. 삽입 코드 정본 확인

### TJ님 할 일

Meta Events Manager에서 아래 화면을 캡처해서 공유한다.

1. AIBIO 데이터 소스 목록에서 Pixel ID가 `1068377347547682`인지 확인
2. 해당 Pixel의 최근 이벤트 목록
3. `Lead`, `PageView`, `ViewContent` 등이 들어오는지
4. 진단 탭
5. 맞춤 전환 목록

GTM에서도 아래를 확인하면 좋다.

1. AIBIO 컨테이너가 `GTM-T8FLZNT`인지
2. 현재 게시 버전
3. `aibio_form_submit` 트리거가 어떤 GA4/Google Ads 태그로 연결되는지

### 내가 할 일

1. `aibio/aibio.md`의 오래된 ID/컨테이너 정보를 최신 기준으로 정리한다.
2. 백엔드 env 기본값과 문서의 Pixel ID를 맞춘다.
3. 잘못된 컨테이너가 운영에 들어간 것으로 확인되면 교체 계획을 작성한다.
4. 광고계정 ID `act_377604674894011`과 Pixel ID `1068377347547682`를 문서/코드에서 혼동하지 않게 분리한다.

### 완료 기준

- 운영 Pixel ID, GTM ID, GA4 측정 ID, Google Ads 전환 ID가 문서와 코드에서 모두 일치한다.
- AIBIO 전환 이벤트가 어느 경로로 Meta/GA4/Google Ads에 들어가는지 한 줄로 설명 가능하다.

## Phase 3. 폼 제출 식별자 보강

### 내가 할 일

1. `aibio/imwebcode.md` 기준으로 v6 후보 코드를 만든다. 완료: `aibio/imwebcode_0416_v6.md`.
2. 헤더 상단 first-touch 저장 코드를 분리한다. 완료.
3. 푸터 form-submit payload에 `fbc`, `fbp`, `first_touch`, `last_touch`, `is_debug`를 추가한다. 완료.
4. TJ님 테스트 결과를 받으면 원장 row와 `/acquisition-analysis` 반영 여부를 확인한다.

### TJ님 할 일

1. 내가 만든 헤더/푸터 코드를 아임웹에 삽입한다.
2. 테스트 URL로 접속해서 폼을 1건 제출한다.
3. 브라우저 콘솔과 `/acquisition-analysis` 화면을 확인한다.

### 완료 기준

- 새 폼 제출 row에 `fbclid`, `fbc`, `fbp`, `ga_session_id`, `client_id`, `user_pseudo_id` 중 가능한 값이 함께 들어온다.
- 테스트 row와 운영 row를 구분할 수 있다.
- 폼 제출 유입이 `(not set)`으로 떨어지는 비율이 줄어든다.

## Phase 4. Meta Lead 전환 연결

### TJ님 할 일

1. Meta Events Manager에서 AIBIO Pixel이 `Lead` 이벤트를 안정적으로 받는지 1-2일 관찰한다.
2. Ads Manager에서 현재 캠페인 목표가 `트래픽`인지 `리드`인지 확인한다.
3. 맞춤 전환이 있다면 조건과 이벤트명을 캡처한다.
4. 푸터 v7 교체 후 테스트 연락처 제출이 `aibio_form_submit_test`로 분리되는지 확인한다.

### 내가 할 일

1. GTM 방식 게시 상태를 유지한다.
2. `트래픽 -> 리드` 전환이 필요한지 문서화한다.
3. 푸터 v7 테스트 연락처 자동 분리 코드를 제공한다.
4. 두 방식이 동시에 켜져 중복 전환이 생기지 않도록 푸터 직접 Meta `Lead` 전송은 금지한다.

### 완료 기준

- Meta 광고관리자에서 “결과”가 랜딩 페이지 조회가 아니라 리드 또는 웹사이트 리드로 잡힌다.
- 우리 내부 `form_submit` 수와 Meta `Lead` 수를 같은 기간으로 비교할 수 있다.
- 같은 폼 제출 1건이 Meta `Lead` 1건으로만 들어간다.

## Phase 5. 운영 리드 품질 분석

### TJ님 할 일

1. 폼 제출 고객이 실제 상담 연결됐는지 기록한다.
2. 방문 예약 여부를 기록한다.
3. 실제 방문/결제 여부를 기록한다.

### 내가 할 일

1. `form_submit -> 상담 -> 방문 -> 결제` 퍼널 표를 만든다.
2. 캠페인별 CPL이 아니라 캠페인별 방문예약 CPA를 계산한다.
3. AIBIO 광고 증액/축소 판단 기준을 만든다.

### 완료 기준

- 단순 리드 수가 아니라 “방문예약 1건당 광고비”를 볼 수 있다.
- 광고비 증액 여부를 폼 제출 수가 아니라 실제 방문 가능성 기준으로 판단할 수 있다.

## 내가 지금 할 수 있는 일

- 현재 CSV 파싱 및 문제점 정리. 1차 완료.
- AIBIO 삽입 코드 정본 차이 문서화. 1차 완료.
- AIBIO v6 헤더/푸터 코드 작성. 완료: `aibio/imwebcode_0416_v6.md`.
- URL/매개변수 포함 CSV를 받으면 광고별 UTM/URL 매칭
- 내부 `form_submit` 원장 기준으로 운영 전환 분석

## TJ님이 해야 하는 일

- 아임웹 푸터 코드 전체를 `aibio/imwebcode_0416_v6.md`의 `2. 푸터 코드 전체 교체본`으로 교체
- Meta 광고관리자에서 `웹사이트 URL`, `URL 매개변수` 포함 광고 레벨 CSV 재export
- Events Manager / GTM 화면 캡처 제공
- 테스트 폼 제출
- 상담/방문/결제 여부 같은 오프라인 결과 기록

## 운영 판단 기준

현재 AIBIO는 Meta ROAS로 보면 안 된다. 구매 매출이 아니라 오프라인 리드 사업이기 때문이다.

지금은 아래 순서로 봐야 한다.

1. 광고비
2. 랜딩 페이지 조회
3. 내부 폼 제출 수
4. 폼 제출당 비용
5. 상담 연결률
6. 방문 예약률
7. 방문 후 결제율

Meta 화면에서 랜딩 페이지 조회가 많이 잡혀도, 내부 폼 제출과 상담 연결이 따라오지 않으면 광고비를 늘리면 안 된다.
