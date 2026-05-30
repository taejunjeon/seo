# Google Ads 구매완료 라벨 출처와 실제 결제완료 전환 통로 설계

작성 시각: 2026-05-24 KST
기준일: 2026-05-24
문서 성격: Green Lane read-only 조사 + no-send 설계
대상: 바이오컴 Google Ads ROAS 정합성

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docurule.md
    - frontrule.md
  lane: Green
  allowed_actions:
    - Google Ads API/GTM/API read-only 조회
    - live site HTML read-only 확인
    - VM Cloud/문서/프론트 보고서 보강
    - no-send 설계
  forbidden_actions:
    - Google Ads 전환 액션 변경
    - Google Ads conversion upload
    - GTM submit/create_version/publish
    - 운영DB 또는 VM Cloud write
    - 아임웹 코드 배포
  source_window_freshness_confidence:
    google_ads:
      source: "Google Ads API /api/google-ads/dashboard"
      window: "LAST_7_DAYS, LAST_30_DAYS"
      confidence: "높음. 전환 액션 ID/라벨/Primary 여부는 API 직접 확인"
    gtm:
      source: "GTM-W2Z6PHN live version 145 read-only"
      confidence: "높음. live 컨테이너 tag/trigger 조회"
    imweb_live_html:
      source: "https://biocom.kr/mineraltest_store/?idx=6 HTML read-only"
      confidence: "높음. live HTML에 라벨 문자열 직접 존재"
    internal_orders:
      source: "VM Cloud SQLite + 운영DB read-only summary"
      window: "2026-05-21 21:15 KST 이후"
      confidence: "중간-높음. 주문 정본과 click evidence 원장을 분리 확인"
```

## 10초 요약

Google Ads 화면의 `구매완료`는 실제 결제완료 주문을 뜻한다고 바로 읽으면 안 된다.
Google Ads action은 `구매완료`라는 이름이지만, live 사이트 HTML에는 같은 라벨이 `GOOGLE_ADWORDS_TRACE.setUseNpayCount(...)`로 들어가 있다.

그래서 보고서에서는 이 값을 `실제 구매`가 아니라 `Google Ads 주장 구매`로 분리 표시했다.
기존 Primary 전환은 지금 바로 건드리지 않는다.
대신 실제 결제완료 주문만 Google Ads에 알려줄 별도 통로는 no-send dry-run으로 계속 준비한다.

## 확인한 사실

### 1. Google Ads가 구매로 세는 액션

| 항목 | 값 |
|---|---|
| 전환 액션 이름 | `구매완료` |
| 전환 액션 ID | `7130249515` |
| Google Ads 역할 | Primary 전환. Google Ads가 입찰 학습에 쓰는 핵심 구매 신호 |
| 유형 | `WEBPAGE / WEBPAGE_ONCLICK` |
| 카테고리 | `PURCHASE` |
| send_to 라벨 | `AW-304339096/r0vuCKvy-8caEJixj5EB` |
| 현재 해석 | 실제 결제완료 확정값이 아니라 Google Ads가 구매라고 주장하는 값 |

### 2. live 사이트 HTML에서 라벨이 보이는 위치

상품 상세 페이지 live HTML에 아래 코드가 있었다.

```html
GOOGLE_ADWORDS_TRACE.setUseNpayCount(true,"AW-304339096/r0vuCKvy-8caEJixj5EB");
```

이 라벨은 Google Ads `구매완료` action의 send_to 라벨과 같다.
즉 이 전환값은 이름이 `구매완료`여도, 실제 입금/결제완료 원장만 보고 찍히는 전환이라고 보기 어렵다.

### 3. GTM live 기준으로 본 관련 태그

GTM live version은 `145`, 이름은 `paid_click_intent_v3_stale_click_id_guard_20260521`이었다.

확인된 관련 태그:

| 태그 | 상태 | 의미 |
|---|---|---|
| `Google 태그 AW-304339096` | active | Google Ads 기본 태그 |
| `TechSol - [GAds]NPAY구매 51163` | active | NPay 링크 클릭 트리거 기반 Secondary 성격 태그. 라벨은 `3yjICOXR...` |
| `GA4_구매전환_Npay` | active | NPay 관련 customEvent에서 `add_payment_info`를 보냄 |
| `HURDLERS - [데이터레이어] 네이버페이 구매` 계열 | active | NPay 클릭/결제 전 단계 데이터레이어 push |
| `codex_paid_click_intent_v1_receiver_no_send` | active | 클릭 증거 수집용. 광고 전환 전송 없음 |

중요한 점은 live GTM에서 `구매완료` Primary 라벨 `r0vu...`가 독립적인 실제 결제완료 전용 태그로 보인 것이 아니라, live HTML의 아임웹 Google Adwords trace 경로에서 확인됐다는 점이다.

## 왜 문제가 되는가

Google Ads 화면에서 `구매완료`라고 보이면 보통 “실제 돈이 결제됐다”고 이해한다.
하지만 현재 구조에서는 그 이름만으로 실제 구매라고 확정할 수 없다.

쉬운 예시:

- 실제 구매: 고객이 돈을 냈고 주문이 confirmed 상태가 됐다.
- Google Ads 주장 구매: Google Ads가 어떤 태그 신호를 보고 구매라고 세었다.
- 문제 신호: NPay 버튼 클릭, 결제 시작, count가 구매처럼 들어가면 Google Ads ROAS가 높아 보인다.

따라서 예산 판단에는 아래처럼 나눠야 한다.

| 구분 | 예산 판단 용도 |
|---|---|
| Google Ads 주장 구매 | 참고값. 플랫폼이 이렇게 주장한다고만 본다 |
| 내부 실제 결제완료 | 예산 판단의 기본값 |
| Google click id가 직접 붙은 실제 결제완료 | 향후 Google Ads offline conversion upload 후보 |

## 2026-05-21 밤 보강 이후 상태

| 항목 | 값 | 해석 |
|---|---:|---|
| confirmed 결제완료 주문 | 114건 | 실제 구매 후보의 분모 |
| Google click id 직접 보존 | 0건 | Google Ads에 안전하게 다시 보낼 수 있는 직접 증거 없음 |
| 같은 GA 세션 진단 후보 | 1건 | 원인 진단용. upload 후보 아님 |
| Google Ads upload 후보 | 0건 | 그대로 유지해야 함 |

현재 병목은 “Google 광고 클릭이 아예 안 들어온다”가 아니다.
클릭 단계 evidence는 들어오지만, 실제 결제완료 주문에 직접 click id가 남지 않는다.

## 실제 결제완료 전용 전환 통로 설계

### 원칙

기존 `구매완료` Primary를 바로 건드리지 않는다.
이 신호는 현재 Google Ads 자동입찰이 학습 중인 핵심 신호라, 갑자기 바꾸면 캠페인 학습이 흔들릴 수 있다.

대신 아래 순서로 준비한다.

1. 실제 결제완료 주문만 후보로 뽑는다.
2. 취소/환불/미입금 가상계좌/테스트 주문을 제외한다.
3. 주문마다 value, currency, conversion time, 중복 방지 키를 붙인다.
4. gclid/gbraid/wbraid 중 하나가 직접 남은 주문만 Google Ads 전송 가능 후보로 올린다.
5. 처음에는 전송하지 않고 no-send dry-run 보고서만 만든다.
6. 후보 품질이 충분해지면 새 전환 액션을 Secondary 또는 observation 상태로 병행한다.
7. 7일 이상 비교 후 기존 `구매완료`를 Secondary로 낮출지 별도 Red 승인으로 결정한다.

### upload 후보가 되려면 필요한 조건

| 조건 | 왜 필요한가 |
|---|---|
| 실제 결제완료 confirmed | Google Ads에 가짜 구매를 보내지 않기 위해 |
| value > 0, currency KRW | ROAS 계산에 필요한 금액 |
| 취소/환불 아님 | 실제 매출만 남기기 위해 |
| 중복 방지 키 있음 | 같은 주문을 두 번 보내지 않기 위해 |
| gclid/gbraid/wbraid 직접 존재 | Google Ads가 클릭과 주문을 안전하게 연결하기 위해 |

지금은 마지막 조건이 0건이라 upload 후보도 0건이다.

## 테스트 주문 기록 확인

현재 문서와 대화 기록에서 확인되는 것은 Google 광고 클릭 후 checkout, 가상계좌 주문 생성, VirtualAccountIssued, canceled/pending 성격의 테스트다.
`Google 광고 클릭 -> 실제 결제완료 confirmed`까지 닫힌 테스트 기록은 찾지 못했다.

즉 “결제 완료까지 진행해보자”고 제안은 했지만, 현재 남아 있는 근거는 대부분 미입금 가상계좌 또는 진단용 흐름이다.
실제 결제까지 닫는 테스트는 돈과 외부 결제 상태가 바뀌므로 TJ님이 도와줘야 한다.
다만 지금 당장은 그 테스트보다 no-send 후보와 click id 유실 지점 보강이 먼저다.

## 하지 않은 일

- Google Ads 전환 액션을 바꾸지 않았다.
- Google Ads conversion upload를 하지 않았다.
- GTM publish를 하지 않았다.
- 운영DB 또는 VM Cloud write를 하지 않았다.
- 아임웹 코드를 바꾸지 않았다.

## 다음 할일

### Auto Green

1. Google Ads ROAS 보고서에 `Google Ads 주장 구매`와 `내부 실제 결제완료`를 계속 분리 표시한다.
   - 담당: Codex
   - 성공 기준: 화면에서 `구매완료`를 실제 구매로 오해하지 않고, 내부 confirmed 기준과 나란히 볼 수 있다.

2. 실제 결제완료 전용 no-send 후보 생성기를 보강한다.
   - 담당: Codex
   - 성공 기준: confirmed 주문 중 `eligible`, `blocked`, `blocked_reason`이 주문 단위로 나온다.

3. click id가 결제완료 주문에서 끊기는 마지막 지점을 더 좁힌다.
   - 담당: Codex
   - 성공 기준: checkout/payment_page_seen/payment_success 중 어디서 직접 evidence가 사라지는지 주문 단위로 설명된다.

### Approval Needed

1. 실제 Google 광고 클릭 후 유료 결제 confirmed 테스트를 1건 진행할지 결정한다.
   - 담당: TJ님
   - 필요한 이유: Codex는 실제 결제 수단을 사용해 돈이 나가는 테스트를 대신할 수 없다.
   - 성공 기준: 테스트 주문이 confirmed가 되고, 같은 주문에 Google click id evidence가 남는지 확인한다.
   - 승인 필요: YES. 실제 결제/취소 처리 필요.

### Blocked/Parked

1. 기존 `구매완료` Primary 변경
   - 이유: Google Ads 학습 신호를 바꾸는 Red Lane 작업이다.
   - 재개 조건: 새 confirmed-only 통로가 7일 이상 안정 관측되고, 전송 후보 품질이 충분할 때 별도 승인안으로 진행한다.
