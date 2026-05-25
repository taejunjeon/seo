# Google Ads 구매완료 전환 설정 변경안 - 2026-05-26

작성 시각: 2026-05-26 01:05 KST  
문서 성격: Green Lane 승인안 초안 / no-send 설계 보강  
대상: 바이오컴 Google Ads ROAS 정합성

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
    - harness/npay-recovery/README.md
    - project/google-ads-npay-button-click-smoke-result-20260526.md
    - project/google-ads-confirmed-only-nosend-builder-20260526.md
  lane: Green
  allowed_actions:
    - Google Ads API read-only 해석
    - Chrome Network smoke 결과 문서화
    - no-send 후보 생성기 재실행 결과 반영
    - Google Ads 설정 변경 승인안 작성
  forbidden_actions:
    - Google Ads 전환 액션 변경
    - Google Ads conversion upload
    - Google Ads Primary/Secondary 설정 변경
    - Google Ads 캠페인/예산/입찰 변경
    - GTM publish
    - 운영DB write
    - VM Cloud SQLite write
  source_window_freshness_confidence:
    source:
      - Google Ads API dashboard-summary
      - TJ님 Chrome Network capture
      - VM Cloud public dashboard-summary
      - confirmed-only no-send builder
    window:
      - today 2026-05-26 KST
      - last_7d
      - last_30d
      - 2026-05-26 00:53~00:54 KST NPay button smoke
    freshness: 2026-05-26 01:05 KST
    confidence: high for existing 구매완료 pollution, medium for exact upload readiness until order-level evidence is written
```

## 결론

Google Ads의 기존 `구매완료`는 실제 결제완료 전용 구매 신호로 쓰면 안 된다.

2026-05-26 smoke에서 실제 결제 없이 NPay 버튼만 눌렀는데도 Google Ads `구매완료` 라벨 요청이 나갔다. 따라서 이 전환은 “돈을 낸 주문”이 아니라 “NPay 버튼/네이버페이 진입”까지 구매처럼 세는 신호로 분리해야 한다.

단, 기존 `구매완료`는 Primary 전환이다. Primary 전환은 Google Ads가 자동입찰 학습에 쓰는 핵심 신호라서, 바로 끄거나 낮추면 광고 학습이 흔들릴 수 있다. 추천은 2단계다.

1. 지금은 설정을 바로 바꾸지 않고 보고서/예산 판단에서 `Google Ads 주장 구매`로 격리한다.
2. 실제 결제완료 전용 전환 통로를 no-send로 안정화한 뒤, 새 신호가 준비되면 기존 `구매완료`를 Secondary로 낮추는 Red 승인안을 연다.

## 현재 증거

### 1. 오늘 Google Ads가 세는 값

source: Google Ads API `dashboard-summary?date_preset=today`  
freshness: 2026-05-26 01:02 KST  
confidence: high

| 항목 | 값 | 사람 말 해석 |
|---|---:|---|
| Google Ads `구매완료` | 1건 / 249,000원 | Google Ads가 오늘 구매로 센 값 |
| 내부 confirmed 주문 | 0건 / 0원 | 내부 실제 결제완료 주문은 아직 없음 |
| 차이 | 249,000원 | Google Ads 구매와 내부 실제 구매가 맞지 않음 |
| 분류 | primary_known_npay | known NPay label 기반 Primary 구매 신호 |

### 2. 최근 7일 Google Ads가 세는 값

source: Google Ads API `dashboard-summary?date_preset=last_7d`  
freshness: 2026-05-26 01:01 KST  
confidence: high

| 항목 | 값 |
|---|---:|
| Google Ads 주장 구매값 | 38,549,636원 |
| 그중 known NPay Primary 값 | 38,549,636원 |
| known NPay 비중 | 100% |
| 내부 confirmed 매출 | 755,900원 |
| Google Ads 주장값 - 내부 confirmed | 37,793,737원 |

사람 말로 풀면, Google Ads가 최근 7일 구매라고 부르는 금액 대부분은 실제 결제완료 원장보다 훨씬 크고, known NPay label에 묶여 있다.

### 3. 버튼 클릭 smoke

source: TJ님 Chrome Network capture  
window: 2026-05-26 00:53~00:54 KST  
confidence: high

관측:

- 실제 결제: 하지 않음
- 화면: 네이버 로그인/잘못된 접근 단계
- Google Ads 요청: 발생
- 요청 라벨: 기존 `구매완료`와 같은 `AW-304339096/r0vuCKvy-8caEJixj5EB`
- 값: `value=35000`, `currency_code=KRW`

결론:

NPay 버튼 클릭 또는 네이버페이 진입만으로도 Google Ads `구매완료` 요청이 발생한다. 따라서 기존 `구매완료`는 실제 결제완료 전용이 아니다.

## 설정 변경 추천안

### 추천안 A. 지금 즉시 운영 판단에서 격리한다

상태: 권장  
실행 Lane: Green  
Google Ads 설정 변경: 없음

무엇을 하는가:

- 보고서에서 기존 `구매완료`를 `Google Ads 주장 구매`로 표시한다.
- 예산 판단은 내부 confirmed 매출 + NPay actual 결제완료 보정값을 우선한다.
- Google Ads ROAS는 참고값으로만 둔다.

왜 하는가:

기존 전환이 실제 구매가 아닌 NPay 버튼/진입 신호를 포함하는 것이 확인됐기 때문이다.

성공 기준:

보고서를 보는 사람이 `Google Ads 주장 구매`와 `내부 실제 결제완료`를 헷갈리지 않는다.

현재 상태:

로컬 보고서에 반영 완료.

## 실행 화면 기준 승인안

이 섹션은 TJ님이 Google Ads 화면에서 실제로 무엇을 눌러야 하는지 기준으로 쓴다. 지금 바로 실행하라는 뜻은 아니다. Google Ads 설정 변경은 광고 자동입찰 학습에 영향을 주므로 Red Lane이다.

### 먼저 알아야 할 말

- Primary 전환: Google Ads가 `전환수`와 `전환가치`에 넣고, 자동입찰이 배우는 핵심 신호다.
- Secondary 전환: 입찰에는 쓰지 않고 `전체 전환수`에서 관찰만 하는 보조 신호다.
- 계정 기본 목표: 새 캠페인과 대부분의 캠페인이 기본으로 따라가는 전환 목표 묶음이다.

Google 공식 도움말 기준으로 Primary는 보고서의 `Conversions` 열과 입찰 최적화에 쓰이고, Secondary는 주로 `All conversions` 관찰용이다. 계정 기본 목표에 들어간 Primary 전환은 캠페인 입찰 학습에도 쓰인다.

참고:

- https://support.google.com/google-ads/answer/11461796
- https://support.google.com/google-ads/answer/4677036

### 화면 1. 기존 `구매완료`가 실제 구매가 아니라는 것을 확인

위치:

1. Google Ads 접속
2. 왼쪽 또는 상단 메뉴에서 `목표`
3. `전환` 드롭다운
4. `요약`
5. `구매` 또는 `Purchases` 목표 안의 `구매완료` 클릭

확인할 값:

- 이름: `구매완료`
- 전환 ID/라벨: `AW-304339096/r0vuCKvy-8caEJixj5EB`
- 액션 최적화: Primary인지 확인
- 카테고리: Purchase인지 확인
- 전환수 포함 여부: `전환수` 또는 `Conversions`에 포함되는지 확인

사람 말 판단:

이 전환은 2026-05-26 smoke에서 실제 결제 없이 NPay 버튼 진입만으로 발화했다. 따라서 화면 이름이 `구매완료`여도, 지금 의미는 `실제 구매`가 아니라 `NPay 진입/버튼 신호`다.

지금 할 일:

- 설정 변경은 하지 않는다.
- 화면 캡처나 설정값 기록만 한다.

### 화면 2. 기존 `구매완료`를 Secondary로 낮추는 경우

위치:

1. `목표 > 전환 > 요약`
2. `구매` 목표 안에서 `구매완료` 선택
3. `설정 수정` 또는 `Edit settings`
4. `전환 목표 및 액션 최적화` 영역
5. `Primary`를 `Secondary`로 변경
6. 저장

바꾸면 생기는 효과:

- Google Ads가 이 신호를 핵심 구매로 덜 보거나 보지 않게 된다.
- NPay 버튼 클릭이 구매처럼 입찰 학습되는 위험이 줄어든다.
- 대신 기존 자동입찰이 보던 구매 신호가 줄어들어, 며칠간 학습 변동이 생길 수 있다.

안 바꾸면 남는 문제:

- Google Ads ROAS는 계속 높게 보일 수 있다.
- NPay 버튼 클릭 또는 진입이 실제 구매처럼 학습될 수 있다.
- 내부 confirmed ROAS와 Google Ads ROAS 차이가 계속 크게 남는다.

실행 조건:

- 실제 결제완료 전용 no-send 후보가 최소 7일 이상 안정적으로 관찰된다.
- 기존 `구매완료`와 새 실제 결제완료 후보를 같은 기간 나란히 비교한다.
- TJ님이 광고 학습 변동을 감수하고 Red 승인한다.

지금 판단:

아직 바로 낮추지 않는다. 대체할 실제 결제완료 전용 신호가 충분하지 않다.

### 화면 3. 실제 결제완료 전용 전환 액션을 관찰용으로 준비하는 경우

현재 Google Ads API에서 보이는 후보:

- 이름: `BI confirmed_purchase_offline`
- 타입: `UPLOAD_CLICKS`
- 카테고리: `PURCHASE`
- 현재 상태: Enabled
- 현재 최적화: Secondary

사람 말 판단:

이 액션은 이름과 타입상 `실제 결제완료 주문만 나중에 Google Ads에 알려주는 통로`로 쓰기 좋다. 다만 지금은 실제 전송을 하지 않는다.

나중에 할 수 있는 일:

1. 이 액션을 그대로 관찰용 Secondary로 유지한다.
2. no-send 후보 생성기에서 `ready_but_not_sent` 후보가 생기는지 본다.
3. 취소/환불/중복 방지가 통과하는지 본다.
4. 후보가 쌓이면 제한된 dry-run 승인안을 따로 만든다.

절대 지금 하지 않는 일:

- 이 액션으로 Google Ads conversion upload 실행
- 이 액션을 바로 Primary로 승격
- 기존 `구매완료`를 끄면서 동시에 새 액션을 Primary로 올리기

### 권장 실행 순서

1. 지금은 기존 `구매완료`를 보고서에서 `Google Ads 주장 구매`로만 표시한다.
2. `BI confirmed_purchase_offline`은 Secondary 관찰용 통로로 유지한다.
3. Codex가 no-send 후보표를 주문 단위로 계속 좁힌다.
4. no-send 후보가 충분히 쌓이면, TJ님이 Google Ads 화면에서 기존 `구매완료`를 Secondary로 낮추는 Red 승인 여부를 결정한다.
5. 실제 결제완료 전용 전환은 최소 7일 관찰 후에만 Primary 승격을 검토한다.

### 실행 전 체크리스트

- [ ] 기존 `구매완료`가 `AW-304339096/r0vuCKvy-8caEJixj5EB`인지 확인했다.
- [ ] `구매완료`가 Primary인지 확인했다.
- [ ] `TechSol - NPAY구매 50739`는 Secondary 관찰용으로 유지한다.
- [ ] `BI confirmed_purchase_offline`이 Secondary인지 확인했다.
- [ ] 실제 결제완료 no-send 후보가 충분히 쌓였는지 확인했다.
- [ ] 변경 전후 기준 시각을 기록했다.
- [ ] 변경 후 24시간, 72시간, 7일 비교 계획이 있다.

### 실행 후 봐야 할 숫자

| 숫자 | 왜 보는가 | 성공 기준 |
|---|---|---|
| Google Ads 주장 구매값 | 기존 `구매완료`가 얼마나 줄었는지 본다 | NPay 버튼 신호가 `전환수`에서 빠지는 방향 |
| 내부 confirmed 매출 | 실제 결제완료 기준 예산 판단값이다 | Google Ads 주장값과 차이가 줄어드는 방향 |
| 실제 결제완료 no-send 후보 | 새 통로가 작동할 준비가 됐는지 본다 | `ready_but_not_sent` 후보가 생김 |
| NPay 실제 결제완료 | NPay 매출을 빼먹지 않기 위해 본다 | 버튼 클릭이 아니라 실제 결제완료만 분리됨 |
| 취소/환불 | 잘못 보낸 전환을 막기 위해 본다 | 환불/취소 주문은 후보에서 제외 |

### 추천안 B. 실제 결제완료 전용 전환을 Secondary로 먼저 준비한다

상태: 다음 승인 후보  
실행 Lane: Red before Google Ads setting mutation  
Google Ads 설정 변경: TJ님 승인 전 금지

무엇을 하는가:

- 새 전환 액션 후보를 만든다.
- 이름 예시: `실제 결제완료 - 내부 원장 확인`
- 처음에는 Secondary 전환으로 둔다.
- Secondary 전환은 입찰 학습에는 쓰지 않고 관찰만 하는 보조 신호다.
- 실제 전송은 no-send 후보 생성기가 통과하기 전까지 하지 않는다.

왜 하는가:

기존 Primary를 바로 낮추면 Google Ads 자동입찰 학습이 끊길 수 있다. 대체할 실제 구매 신호를 먼저 관찰 상태로 준비해야 한다.

성공 기준:

- confirmed 주문만 후보가 된다.
- value > 0, currency KRW가 맞다.
- 취소/환불/미입금 가상계좌가 제외된다.
- 중복 방지 키가 있다.
- gclid/gbraid/wbraid 중 하나가 있다.
- no-send 후보 생성기에서 `send_candidate=0`이 아니라, 승인 전 `ready_but_not_sent` 같은 후보가 생긴다.

현재 상태:

아직 전송 후보 0건이다. Google Ads 설정을 바꿀 준비가 아니라, no-send 후보 품질을 올리는 단계다.

### 추천안 C. 기존 `구매완료`를 Secondary로 낮춘다

상태: 지금은 보류, 대체 신호 준비 후 검토  
실행 Lane: Red  
Google Ads 설정 변경: TJ님 명시 승인 필요

무엇을 하는가:

Google Ads UI에서 기존 `구매완료`를 Primary에서 Secondary로 낮추거나, 계정 기본 목표에서 제외한다.

왜 보류하는가:

이 액션은 현재 자동입찰 학습에 쓰이는 핵심 신호다. 바로 낮추면 Google Ads 학습이 급격히 바뀔 수 있다.

언제 실행하는가:

- 실제 결제완료 전용 전환 후보가 안정적으로 생긴다.
- 최소 7일 이상 Google 주장 구매와 내부 confirmed 구매를 나란히 비교한다.
- 전환 액션 변경 후 예산/입찰 영향을 감수할지 TJ님이 승인한다.

긴급 실행 조건:

예산 낭비가 명확하고, Google Ads가 NPay 버튼 클릭을 계속 구매로 학습하는 위험이 더 크다고 판단될 때. 이 경우에도 Red 승인 후 진행한다.

## 실제 결제완료 전용 no-send 후보 생성기 현재 상태

source: `project/google-ads-confirmed-only-nosend-builder-20260526.md`  
generated: 2026-05-26 01:01:30 KST

| 기준 | 실제 결제완료 | 매출 | click id 직접 보존 | 보존률 | 전송 후보 |
|---|---:|---:|---:|---:|---:|
| 최근 7일 | 412건 | 96,392,797원 | 3건 | 0.73% | 0건 |
| 최근 30일 | 2,173건 | 504,691,775원 | 16건 | 0.74% | 0건 |
| 5월 21일 21:15 보강 이후 | 114건 | n/a | 0건 | 0.00% | 0건 |

전송 후보가 0건인 이유:

1. 실제 결제완료 주문 대부분에 Google click id가 직접 남지 않는다.
2. 직접 evidence가 있는 aggregate 주문도 공개 API만으로는 주문별 전송 payload를 만들 수 없다.
3. Google Ads 계정에는 관찰용 offline 전환 액션이 보이지만, 이 후보를 실제로 보내는 전송 승인과 dispatcher가 열려 있지 않다.
4. 영구 evidence snapshot write를 아직 하지 않았다.

## TJ님이 나중에 실제로 보게 될 Google Ads 화면

승인 전에는 아래 화면에서 아무 것도 누르지 않는다.

화면:

Google Ads > 목표 > 전환 > 요약

확인/변경 후보:

1. 기존 `구매완료`
   - 현재 의미: NPay 버튼/진입까지 구매처럼 세는 기존 Primary 신호
   - 바꾸면 생기는 효과: Google Ads 자동입찰이 이 신호를 덜 보거나 보지 않게 된다
   - 안 바꾸면 남는 문제: Google ROAS가 실제 구매보다 계속 부풀 수 있다

2. `TechSol - NPAY구매 50739`
   - 현재 의미: NPay 보조 전환 성격
   - 권장: 관찰용 Secondary 유지
   - 주의: 실제 결제완료로 해석하지 않는다

3. 새 `실제 결제완료 - 내부 원장 확인`
   - 현재 의미: 아직 생성/전송하지 않은 후보
   - 권장: no-send 후보가 생기면 Secondary로 먼저 관찰
   - 장기 목표: 7일 이상 안정화 후 Primary 전환 후보로 승격 검토

## 하지 않은 것

- Google Ads 전환 액션 변경: 0건
- Google Ads conversion upload: 0건
- Google Ads 캠페인/예산/입찰 변경: 0건
- GTM publish: 0건
- 운영DB write: 0건
- VM Cloud SQLite write: 0건

## 다음 판단

1. 기존 Google Ads `구매완료`는 실제 구매가 아니라 `Google Ads 주장 구매`로 계속 분리한다.
2. 실제 결제완료 전용 전환 통로는 no-send 후보 생성기와 order-level evidence 보강을 먼저 한다.
3. Google Ads 설정 변경은 다음 순서로만 연다.
   - no-send 후보가 주문별로 생김
   - 중복 방지와 click id 조건이 통과함
   - 7일 이상 비교함
   - TJ님이 Red 승인함

Auditor verdict: PASS

No-send verified: YES  
No-write verified: YES  
No-deploy verified: YES  
No-publish verified: YES  
No-platform-send verified: YES
