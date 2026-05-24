# Google Ads 구매완료 21건과 click id 유실 지점 Green 감사

작성 시각: 2026-05-24 12:00 KST
기준일: 2026-05-24
문서 성격: Green Lane read-only 재조사 결과
대상: 바이오컴 Google Ads ROAS 정합성

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docurule.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  required_context_docs:
    - imweb/!coderule.md
    - project/google-payment-success-exact-evidence-loss-readonly-20260523.md
    - project/google-ads-purchase-truth-click-loss-readonly-20260524.md
    - http://localhost:7010/ai-crm/harness-guide
  lane: Green
  allowed_actions:
    - Google Ads API read-only 조회
    - VM Cloud 공개 API read-only 조회
    - VM Cloud SQLite read-only SELECT 결과 정리
    - live site HTML read-only 확인
    - 로컬 문서 작성
  forbidden_actions:
    - Google Ads 전환 설정 변경
    - Google Ads offline conversion upload
    - GTM submit/create_version/publish
    - Imweb header/footer 저장
    - 운영DB 또는 VM Cloud write
    - 배포/restart
    - raw gclid/gbraid/wbraid 출력
  source_window_freshness_confidence:
    google_ads:
      source: "https://att.ainativeos.net/api/google-ads/dashboard"
      window: "last_1d=2026-05-23 KST, last_7d"
      freshness: "2026-05-24 11:58 KST 조회"
      confidence: "높음. 전환 액션 ID/라벨/Primary 여부는 Google Ads API 기반"
    order_health:
      source: "https://att.ainativeos.net/api/google-ads/click-id-health/orders"
      window: "last_1d, rolling_24h"
      freshness: "2026-05-24 11:58 KST 조회"
      confidence: "높음. 주문별 read-only 진단 API"
    vm_cloud_sql:
      source: "VM Cloud SQLite attribution_ledger/site_landing/paid_click_intent read-only"
      window: "2026-05-21 21:15 KST 이후, last_1d"
      freshness: "2026-05-24 오전 재조회"
      confidence: "중간-높음. 원장 row 기준이며 결제 플랫폼 원본 화면 대조는 별도"
```

## 한 줄 결론

Google Ads가 2026-05-23 하루에 `구매완료 21건`이라고 세는 값은 내부 원장에서 “Google 광고 클릭 증거가 붙은 실제 결제완료 주문 21건”으로 확인되지 않았다. 현재 가장 강한 근거는 Google Ads의 `구매완료`가 실제 결제확정 전용 신호라기보다, 아임웹/NPay 계열 웹페이지 전환 신호를 구매로 세고 있다는 점이다.

## 왜 이 조사를 Green으로 바로 했어야 했나

이 작업은 광고 설정을 바꾸거나 Google에 전환을 보내는 일이 아니다. 이미 쌓인 Google Ads API 값, VM Cloud 원장, live HTML을 읽어서 비교하는 일이다.

따라서 하네스 기준으로는 TJ님에게 매번 컨펌을 받을 일이 아니라, Codex가 바로 해야 하는 Green Lane이다. 이전처럼 “다음에 확인”으로 넘기면 속도가 떨어지고, TJ님이 작은 단위까지 지시해야 하는 상태가 된다.

이번 작업에서는 아래를 승인 없이 진행했다.

- Google Ads 1일/7일 전환 액션 분해
- 내부 결제완료 주문의 click id 보존 여부 재조회
- checkout/payment_page/payment_success 단계별 유실 지점 재구성
- 하네스 자율 진행 평가 메모 작성

멈춘 것은 외부 전송, 광고 설정 변경, 운영 write, 실제 결제 테스트뿐이다. 이들은 돈이나 운영 설정에 영향이 있어 Green이 아니다.

## Google Ads의 `구매완료 21건`은 무엇인가

Source: Google Ads API dashboard
Window: `last_1d`, Google Ads literal `YESTERDAY`, 2026-05-23 KST로 해석
Freshness: 2026-05-24 11:58 KST 조회

Google Ads가 하루치로 주장한 전체 값은 아래다.

| 항목 | 값 |
| --- | ---: |
| 광고비 | 398,078원 |
| 클릭 | 1,170 |
| Google Ads가 세는 구매 전환 | 21건 |
| Google Ads가 세는 구매 금액 | 4,050,200원 |
| Google Ads가 계산한 ROAS | 10.17 |

이 21건은 한 전환 액션에서 전부 나왔다.

| 항목 | 값 |
| --- | --- |
| 전환 액션 이름 | `구매완료` |
| 전환 액션 ID | `7130249515` |
| 역할 | Primary 전환. Google Ads가 입찰 학습에 쓰는 핵심 구매 신호 |
| 카테고리 | PURCHASE |
| 카운팅 방식 | MANY_PER_CLICK |
| 라벨 | `AW-304339096/r0vuCKvy-8caEJixj5EB` |
| 시스템 분류 | `primary_known_npay` |
| 위험 표시 | `known_npay_label`, `primary_bid_signal_is_npay` |

쉬운 말로 해석하면 이렇다.

Google Ads 화면에는 `구매완료`라고 보이지만, 이 이름만 보고 “우리 내부 주문 DB에서 결제완료된 주문”이라고 보면 안 된다. 이 액션은 NPay 계열로 분류되는 라벨을 쓰고 있고, live 사이트 HTML에서도 같은 라벨이 아래 형태로 발견됐다.

```html
GOOGLE_ADWORDS_TRACE.setUseNpayCount(true,"AW-304339096/r0vuCKvy-8caEJixj5EB");
```

즉 Google Ads의 21건은 “Google Ads가 이 라벨을 보고 구매라고 세는 값”이다. 아직 “우리 원장에서 실제 결제완료된 주문 21건”이라고 확정할 수 없다.

캠페인별로는 아래처럼 나뉘었다.

| 캠페인 | Google Ads 구매완료 건수 | Google Ads 구매완료 금액 |
| --- | ---: | ---: |
| `[PM]검사권 실적최대화` | 6건 | 2,834,000원 |
| `[PM]건기식 실적최대화` | 15건 | 1,216,200원 |

최근 7일도 같은 구조다.

| 항목 | 값 |
| --- | ---: |
| Google Ads 전체 전환값 | 35,513,162원 |
| `구매완료` 전환값 | 35,513,160원 |
| Primary value 중 `구매완료` 비중 | 거의 100% |

## 내부 주문 원장과 맞춰본 결과

Source: `/api/google-ads/click-id-health/orders?window=last_1d`
Window: 2026-05-23 KST, `payment_complete_time` 기준
Freshness: 2026-05-24 11:58 KST 조회

내부 주문 기준은 이렇게 나왔다.

| 항목 | 값 |
| --- | ---: |
| 내부 결제완료 주문 | 61건 |
| Google click id가 직접 붙은 주문 | 0건 |
| Google Ads에 보낼 수 있는 후보 | 0건 |
| click id 누락 주문 | 61건 |

이 말은 “Google 광고 주문이 무조건 0건”이라는 뜻이 아니다. 더 정확히는 “Google Ads에 다시 보내도 안전할 만큼 주문에 gclid/gbraid/wbraid가 직접 남은 건이 0건”이라는 뜻이다.

최근 24시간 기준도 같다.

| 항목 | 값 |
| --- | ---: |
| 내부 결제완료 주문 | 32건 |
| Google click id가 직접 붙은 주문 | 0건 |
| Google Ads에 보낼 수 있는 후보 | 0건 |

최근 7일 카드에 `Google click id 보존 5건`이 보이는 이유도 확인했다.

Source: `/api/google-ads/click-id-health/orders?window=last_7d&only=with_click_id`
Freshness: 2026-05-24 12:03 KST 조회

| 주문번호 | 결제수단 | 결제완료 시각 | click id 종류 |
| --- | --- | --- | --- |
| 202605179351380 | CARD | 2026-05-17 19:07 KST | gclid |
| 202605172235478 | CARD | 2026-05-17 23:23 KST | gclid |
| 202605182747344 | CARD | 2026-05-18 15:30 KST | gclid + gbraid |
| 202605199037917 | CARD | 2026-05-19 23:07 KST | gclid + gbraid |
| 202605201016693 | CARD | 2026-05-20 01:13 KST | gclid |

이 5건은 모두 2026-05-21 밤 아임웹 보강 이전 결제완료다. 따라서 “최근 7일 카드에 5건이 있으니 보강 후에도 잘 된다”가 아니다. 보강 이후 실제 결제완료 confirmed 기준으로는 아직 직접 click id 보존 0건으로 봐야 한다.

## click id는 어디까지 살아 있었나

Source: VM Cloud SQLite read-only 재구성
Window: 2026-05-21 21:15 KST 이후

5월 21일 밤 아임웹 헤더/푸터 보강 이후 Google click id 수집 자체는 좋아졌다.

| 단계 | 의미 | Google click evidence |
| --- | --- | ---: |
| site_landing | 광고 클릭 후 사이트에 도착한 흔적 | 있음. 3천 건 이상 |
| paid_click_intent | 유료 클릭으로 보이는 방문 의도 | 있음. 3천 건 이상 |
| checkout_started | 구매하기/결제 진입 | 일부 있음 |
| payment_page_seen | 결제 페이지 도달 | 일부 있음 |
| payment_success confirmed | 실제 결제완료 신호 | 0건 |

중요한 해석은 아래다.

1. 광고 클릭 수집이 망가진 상태는 아니다. 유입/유료 클릭 장부에는 Google click id가 많이 들어온다.
2. 문제는 실제 결제완료 주문으로 확정되는 순간, 그 주문 row에 Google click id가 직접 붙지 않는 것이다.
3. 그리고 최근 confirmed 주문은 “직전 checkout row에는 Google click id가 있었는데 payment_success에서만 사라진” 단순 케이스도 아니었다.
4. 같은 checkoutId 또는 같은 GA session/client로 앞단계를 찾아도, confirmed 주문으로 이어진 흐름에는 Google click evidence가 없었다.

그래서 현재 결론은 이렇다.

Google click이 결제 직전까지 항상 살아 있다가 마지막 payment_success에서만 떨어지는 것이 아니라, Google click이 남아 있는 checkout/payment_page 흐름과 실제 confirmed 주문 흐름이 아직 충분히 만나지 않고 있다. 테스트 주문, 미입금 가상계좌, 취소/대기 주문에서는 증거가 보였지만, 자연 발생 confirmed 주문에는 직접 증거가 붙지 않았다.

## 지금 예산 판단에서 봐야 하는 숫자

현재는 숫자를 세 종류로 분리해야 한다.

| 이름 | 쉬운 의미 | 예산 판단 용도 |
| --- | --- | --- |
| Google Ads 주장 구매 | Google Ads가 `구매완료` 라벨을 보고 구매라고 센 값 | 참고값. 그대로 믿고 예산을 늘리면 위험 |
| 내부 실제 결제완료 | 실제 결제완료 주문 원장 기준 매출 | 예산 판단의 기본값 |
| Google click id가 직접 붙은 실제 결제완료 | Google 광고 클릭 증거가 주문에 직접 남은 매출 | 향후 Google Ads 전송 후보 |

2026-05-23 기준으로는 아래처럼 읽는다.

| 구분 | 값 |
| --- | ---: |
| Google Ads 주장 구매 | 21건 / 4,050,200원 |
| 내부 실제 결제완료 | 61건 |
| Google click id가 직접 붙은 실제 결제완료 | 0건 |
| Google Ads upload 후보 | 0건 |

## 하네스 준수 평가

이번 작업의 Lane은 Green이다.

| 항목 | 판정 |
| --- | --- |
| read-only 조사 | 수행 |
| dry-run/문서화 | 수행 |
| 외부 전환 send/upload | 하지 않음 |
| Google Ads 설정 변경 | 하지 않음 |
| GTM publish | 하지 않음 |
| 운영DB/VM Cloud write | 하지 않음 |
| 실제 결제 테스트 | 하지 않음 |

자체 평가:

- 이전 대응은 충분히 자율적이지 않았다. 이 정도 read-only 분해는 TJ님 지시를 기다리지 않고 진행했어야 한다.
- 이번에는 Green 범위 안에서 API 조회, 원장 재구성, 문서 기록까지 진행했다.
- 앞으로 같은 유형의 작업은 `조사 -> 숫자 비교 -> 유실 지점 좁히기 -> 문서/프론트 반영안`까지 Codex가 먼저 닫고, 외부 전송/설정 변경/실제 결제 테스트가 필요한 순간에만 TJ님에게 승인 요청한다.

## 하지 않은 일

- Google Ads에 conversion upload를 보내지 않았다.
- Google Ads Primary 전환을 바꾸지 않았다.
- GTM 운영 게시를 하지 않았다.
- Imweb header/footer를 바꾸지 않았다.
- 운영DB 또는 VM Cloud에 쓰지 않았다.
- 실제 결제 테스트를 Codex가 대신 진행하지 않았다.

## 다음 판단

1. 지금 Google Ads의 `구매완료 21건`은 내부 실제 결제완료 주문과 같은 값으로 보지 않는다.
2. 예산 판단은 `내부 실제 결제완료`를 기본으로 보고, Google Ads 값은 “플랫폼 주장값”으로 분리한다.
3. Google click id가 실제 결제완료에 붙는지 보려면, 다음에는 실제 paid confirmed까지 닫히는 테스트 주문 1건이 필요하다.
4. 단, 실제 결제 테스트는 돈과 주문 상태가 움직이므로 Codex가 Green으로 자동 수행할 수 없다. TJ님이 진행하거나 별도 승인 후 제한된 방식으로 확인해야 한다.
