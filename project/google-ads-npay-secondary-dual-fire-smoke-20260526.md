# Google Ads NPay 보조 액션 동시 발화 smoke 절차

작성 시각: 2026-05-26 18:00 KST  
기준일: 2026-05-26  
문서 성격: Green Lane / read-only runbook / no-send / no-write

```yaml
harness_preflight:
  common_harness_read:
    - "harness/common/HARNESS_GUIDELINES.md"
    - "harness/common/AUTONOMY_POLICY.md"
    - "harness/common/REPORTING_TEMPLATE.md"
  project_harness_read:
    - "AGENTS.md"
    - "docurule.md"
    - "GA4/gtm-biocom.md"
    - "GA4/npay_return_missing_20260421.md"
    - "footer/biocomimwebcode.md"
  lane: "Green until button-click smoke; actual Google Ads/GTM setting change remains Red"
  allowed_actions:
    - "read-only Google Ads API check"
    - "document smoke steps"
    - "browser network observation without payment"
  forbidden_actions:
    - "Google Ads conversion upload"
    - "Google Ads conversion action change"
    - "GTM publish"
    - "actual payment"
    - "production DB write"
    - "VM Cloud SQLite write"
  source_window_freshness_confidence:
    source: "Google Ads API live + local GTM/Imweb docs"
    window: "today and last_7d as of 2026-05-26 17:45-18:00 KST"
    freshness: "Google Ads API fetched live; GTM/Imweb evidence from local audited docs"
    confidence: "high for action role, medium-high for simultaneous-fire hypothesis until one live click smoke"
```

## 10초 요약

`NPay 버튼 클릭/결제진입(보조)`와 `TechSol - NPAY구매 50739`는 둘 다 실제 결제완료가 아니라 NPay 버튼 클릭/결제 진입 근처 신호다.  
둘은 같은 버튼 클릭에서 동시에 발화될 가능성이 높지만, 오늘 수치가 18건 vs 19건으로 완전히 같지는 않아 1회 live smoke로 동시 발화 여부를 확정해야 한다.  
이 smoke는 결제를 하지 않고 NPay 버튼 클릭 직후 Network/Tag Assistant에서 Google Ads 전환 라벨 2개가 같이 나가는지만 본다.

## 현재 확인된 사실

### Google Ads API live 확인

| 항목 | NPay 버튼 클릭/결제진입(보조) | TechSol - NPAY구매 50739 |
|---|---:|---:|
| action id | 7130249515 | 7564830949 |
| 역할 | 보조 액션 | 보조 액션 |
| 분류 | secondary_known_npay | secondary_known_npay |
| 오늘 전환 | 18 | 0 |
| 오늘 모든 전환 | 18 | 19 |
| 오늘 모든 전환값 | 4,847,000원 | 5,873,000원 |
| 의미 | 아임웹 NPay count 계열 | GTM TechSol NPay conversion 계열 |

해석:

- 둘 다 Google Ads의 입찰 주 액션은 아니다.
- 둘 다 실제 결제완료 주문으로 쓰면 안 된다.
- 수치가 완전히 같지 않으므로 같은 클릭군이지만 값 계산 또는 일부 트리거 조건 차이가 있을 수 있다.

### 문서상 트리거 근거

- `footer/biocomimwebcode.md`: 아임웹 `GOOGLE_ADWORDS_TRACE.setUseNpayCount(...)` 경로가 `NPay 버튼 클릭/결제진입(보조)` 라벨과 연결된다.
- `GA4/npay_return_missing_20260421.md`: `[248] TechSol - [GAds]NPAY구매 51163`은 NPay 버튼 클릭 시점에 발화된 것으로 기록돼 있다.
- `GA4/gtm-biocom.md`: `[248]`은 Google Ads conversion 태그이고, `[118]`은 NPay intent/dataLayer 후보로 실제 결제완료가 아니다.

## Smoke 목적

이 smoke는 매출을 만들기 위한 테스트가 아니다.  
NPay 버튼을 누르는 순간 Google Ads에 같은 성격의 보조 전환이 2개 나가는지 확인하는 테스트다.

확인하고 싶은 질문:

1. NPay 버튼 1회 클릭 시 `NPay 버튼 클릭/결제진입(보조)` 라벨이 나가는가?
2. 같은 클릭에서 `TechSol - NPAY구매 50739` 라벨도 나가는가?
3. 둘 다 나가면 같은 클릭을 두 번 세는 보조 신호로 볼 수 있는가?
4. 하나만 나가면 상품/버튼/페이지 조건 차이가 있는가?

## Smoke 실행 전 준비

1. Chrome DevTools Network 탭을 연다.
2. `Preserve log`를 켠다.
3. 검색 필터에 `pagead/conversion/304339096`을 입력한다.
4. 별도 탭 또는 Tag Assistant가 있으면 Google Ads 전환 태그도 같이 본다.
5. 테스트 상품 페이지는 NPay 버튼이 보이는 상품 상세 페이지로 연다.

주의:

- NPay 결제창이 열려도 결제는 하지 않는다.
- 로그인, 카드 선택, 결제 승인 단계까지 가지 않는다.
- 버튼 클릭 직후 Google Ads conversion request만 확인한다.

## Smoke 실행 순서

1. 상품 상세 페이지를 새로고침한다.
2. Network 필터가 비어 있는지 확인한다.
3. NPay 버튼을 1회 클릭한다.
4. NPay 창 또는 로그인 창이 뜨면 결제 진행 없이 그대로 둔다.
5. Network에서 `pagead/conversion/304339096` 요청을 확인한다.
6. 요청 URL 안의 `label=` 값을 확인한다.

## 성공 기준

아래 2개 라벨이 같은 클릭 직후 모두 보이면, 두 보조 액션은 실제로 중복 발화된 것으로 본다.

| 라벨 성격 | 판정 |
|---|---|
| 기존 아임웹 NPay count 라벨 | `NPay 버튼 클릭/결제진입(보조)` 발화 |
| TechSol NPay 라벨 | `TechSol - NPAY구매 50739` 발화 |

판정:

- 둘 다 보임: `duplicate_npay_button_signals_confirmed`
- 기존 아임웹 라벨만 보임: `imweb_npay_only`
- TechSol 라벨만 보임: `techsol_npay_only`
- 둘 다 안 보임: `smoke_not_reproduced`

## 결과별 다음 판단

### 둘 다 보이는 경우

두 액션은 같은 NPay 버튼 클릭을 서로 다른 라벨로 세는 중복 보조 신호다.  
둘 다 실제 구매완료가 아니므로 예산 판단용 ROAS에서 제외한다.  
추후 UI 정리는 `TechSol - NPAY구매 50739`를 끄거나 이름을 더 명확히 바꾸는 방식이 가능하지만, Google Ads 설정 변경은 Red Lane이다.

### 하나만 보이는 경우

상품 페이지, 버튼 유형, 로그인 상태, NPay 창 열림 방식에 따라 발화 조건이 다를 수 있다.  
이 경우 상품 2개 이상에서 한 번 더 smoke한다.

### 둘 다 안 보이는 경우

브라우저 차단, 확장프로그램, Tag Assistant 연결, NPay 버튼 노출 상태를 먼저 확인한다.

## Google Ads 실제 구매 주 액션과의 관계

이 smoke는 `BI confirmed_purchase_offline`을 바로 Primary로 올릴지 결정하는 테스트가 아니다.  
이 smoke의 목적은 기존 보조 신호가 중복인지 확인하는 것이다.

실제 구매 주 액션 후보는 별도 기준으로 봐야 한다.

1. 실제 결제완료 주문인가?
2. Google click id가 직접 붙었는가?
3. 취소/환불/중복 방지 기준이 있는가?
4. Google Ads 전송이 no-send 검토표에서 먼저 통과했는가?

현재 no-send 기준으로는 실제 전송 후보가 0건이다.  
다만 이것은 “실제 구매가 없다”는 뜻이 아니라, “Google Ads에 안전하게 보낼 직접 연결 증거가 아직 부족하다”는 뜻이다.

## 하지 않은 것

- Google Ads 전환 전송 0
- Google Ads 액션 수정 0
- GTM publish 0
- 운영DB write 0
- VM Cloud SQLite write 0
- 실제 결제 0

## Smoke 결과 — 2026-05-26 18:03 KST

TJ님이 `https://biocom.kr/DietMealBox/?idx=424` 상품에서 NPay 버튼을 1회 클릭했다.  
실제 결제는 진행하지 않았다.

Network에서 Google Ads conversion request가 2개 관측됐다.

| 순서 | 라벨 | 연결된 전환 액션 | 값 | 의미 |
|---:|---|---|---:|---|
| 1 | `3yjICOXRmJccEJixj5EB` | `TechSol - NPAY구매 50739` | 8,900원 | GTM TechSol NPay 버튼 클릭/진입 신호 |
| 2 | `r0vuCKvy-8caEJixj5EB` | `NPay 버튼 클릭/결제진입(보조)` | 11,900원 | 아임웹 NPay count 버튼 클릭/진입 신호 |

판정:

```text
duplicate_npay_button_signals_confirmed
```

사람 말로 쓰면, 같은 NPay 버튼 클릭 1회가 Google Ads 보조 전환 2개로 기록된다.  
둘 다 실제 결제완료가 아니다. 이 두 값을 구매 ROAS나 실제 매출 판단에 쓰면 안 된다.

추가로 값도 서로 다르다.

- TechSol 쪽은 상품가 8,900원으로 보인다.
- 아임웹 NPay count 쪽은 배송비 포함 총액 11,900원으로 보인다.

따라서 `All conversions` 또는 `All conv. value`는 실제 구매 매출보다 더 크게 보일 수 있다.  
예산 판단용 화면에서는 `Conversions`와 `All conversions` 모두 실제 결제완료 기준과 분리해서 읽어야 한다.

## 결과 이후 권장 판단

### 즉시 고정할 판단

`NPay 버튼 클릭/결제진입(보조)`와 `TechSol - NPAY구매 50739`는 둘 다 실제 결제완료가 아니다.  
둘은 같은 NPay 버튼 클릭에서 중복 발화됐다.  
앞으로 두 액션은 구매 액션이 아니라 `NPay click/entry 보조 신호`로만 해석한다.

### 값 기준 판단

같은 버튼 클릭에서 값이 2개로 갈렸다.

- `TechSol - NPAY구매 50739`: 8,900원
- `NPay 버튼 클릭/결제진입(보조)`: 11,900원

이번 상품은 상품가가 8,900원이고 고객이 배송비 3,000원을 부담한다.  
따라서 실제 고객이 결제하려고 진입한 총액은 11,900원이다.

판단:

```text
NPay 버튼 클릭/진입 보조 신호를 1개만 남긴다면 11,900원을 보내는 `NPay 버튼 클릭/결제진입(보조)`를 살리는 것이 더 낫다.
```

이유:

1. Google Ads에서 전환값은 고객이 실제로 결제하려는 금액에 가까워야 한다.
2. 8,900원은 상품가만 보고 배송비를 빠뜨린 값이다.
3. 둘 다 실제 결제완료가 아니므로 Primary 전환으로 쓰면 안 되지만, 보조 관찰값으로는 총 결제 예정액인 11,900원이 더 해석하기 쉽다.

### 오늘 건수 1건 차이 해석

오늘 API에서는 `NPay 버튼 클릭/결제진입(보조)`가 18건, `TechSol - NPAY구매 50739`가 모든 전환 기준 19건으로 1건 차이가 있었다.

현재 가장 가능성이 높은 이유는 아래 3가지다.

1. 두 전환 액션의 추적 기간이 다르다.
   - `NPay 버튼 클릭/결제진입(보조)`: 클릭 후 7일
   - `TechSol - NPAY구매 50739`: 클릭 후 90일
   - 같은 오늘 발생한 버튼 클릭이라도, 어떤 과거 광고 클릭에 귀속되는지는 Google Ads가 각 액션의 추적 기간으로 따로 계산한다.

2. 두 태그가 읽는 버튼/값의 출처가 다르다.
   - `NPay 버튼 클릭/결제진입(보조)`는 아임웹 NPay count 계열이다.
   - `TechSol - NPAY구매 50739`는 GTM TechSol 계열이다.
   - 같은 클릭에서 동시에 뜨는 것은 확인됐지만, 모든 상품/페이지/로그인 상태에서 항상 1:1이라고 단정하면 안 된다.

3. Google Ads는 웹사이트 전환의 주문번호 단위 상세 목록을 그대로 내주지 않는다.
   - 그래서 “추가 1건이 정확히 어느 사람/어느 클릭인지”는 현재 aggregate API만으로는 직접 증명할 수 없다.
   - 대신 설정 차이, 라벨, Network smoke, 오늘 집계 차이로 원인을 좁혀 판단한다.

사람 말로 정리하면, 같은 NPay 버튼 클릭에서 둘 다 뜨는 것은 확인됐지만 Google Ads가 집계할 때는 두 액션을 완전히 같은 규칙으로 세지 않는다.  
따라서 1건 차이는 버그라기보다 `추적 기간 차이 + 태그 출처 차이 + Google Ads 집계 방식 차이`로 보는 것이 현재 가장 타당하다.

### 다음 선택지

1. 둘 다 유지하되 보고서에서 실제 구매와 완전히 분리한다.
   - 장점: 과거 비교가 쉽다.
   - 단점: Google Ads `All conversions`가 계속 헷갈린다.

2. `TechSol - NPAY구매 50739`를 끄거나 이름을 `NPay 버튼 클릭(중복 보조)`로 바꾼다.
   - 장점: 중복 관찰 신호를 줄인다.
   - 단점: Google Ads UI 변경이므로 Red Lane 승인과 24시간 모니터링이 필요하다.

3. 아임웹 NPay count도 장기적으로 제거하고, NPay 실제 결제완료만 내부 원장에서 Google에 보내는 구조로 전환한다.
   - 장점: 가장 정확하다.
   - 단점: `BI confirmed_purchase_offline` canary 전송과 duplicate/refund guard가 먼저 필요하다.

권장:

```text
단기: 둘 다 Secondary 유지 + 보고서에서 구매와 분리
중기: TechSol 중복 보조 신호 OFF 또는 rename
본 작업: BI confirmed_purchase_offline 실제 구매 canary 1~4건 준비
```
