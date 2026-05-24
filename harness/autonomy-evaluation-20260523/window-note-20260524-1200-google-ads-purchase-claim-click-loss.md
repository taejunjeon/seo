작성 시각: 2026-05-24 12:00 KST
문서 성격: 다른 창 작업 메모

# Window Note - Google Ads 구매완료 21건과 click id 유실 지점

## 작업 정보

- 창/에이전트: Codex
- 작업명: Google Ads `구매완료 21건`이 실제로 무엇을 세는지 분해하고, 결제완료 흐름에서 Google click id가 어디서 끊기는지 재조사
- 작성 시각: 2026-05-24 12:00 KST
- 관련 프로젝트: 바이오컴 Google Ads ROAS 정합성
- 관련 파일/URL:
  - `http://localhost:7010/ai-crm/harness-guide`
  - `project/google-ads-purchase-21-and-click-loss-green-audit-20260524.md`
  - `project/google-ads-purchase-truth-click-loss-readonly-20260524.md`
  - `project/google-payment-success-exact-evidence-loss-readonly-20260523.md`

## Lane 분류

- Lane: Green
- 분류 이유: Google Ads API, VM Cloud 공개 API, VM Cloud SQLite, live HTML을 읽기 전용으로 확인하는 작업이다. 외부 전환 전송, 광고 설정 변경, GTM publish, 운영DB/VM Cloud write, 배포가 없다.
- 적용한 기준 문서:
  - `harness/common/HARNESS_GUIDELINES.md`
  - `harness/common/AUTONOMY_POLICY.md`
  - `harness/common/REPORTING_TEMPLATE.md`
  - `http://localhost:7010/ai-crm/harness-guide`

## 실제로 한 일

- Google Ads dashboard API에서 `last_1d`의 `구매완료` 전환 액션을 분해했다.
- `구매완료`가 ID `7130249515`, Primary 전환, PURCHASE category, NPay 계열로 분류되는 라벨이라는 것을 확인했다.
- 2026-05-23 기준 Google Ads가 주장하는 구매는 21건 / 4,050,200원이며, 이 값이 `[PM]검사권 실적최대화` 6건 / 2,834,000원, `[PM]건기식 실적최대화` 15건 / 1,216,200원으로 나뉘는 것을 확인했다.
- `last_7d`에서도 Primary value 대부분이 같은 `구매완료` action에서 나오는 것을 확인했다.
- live HTML에서 같은 라벨이 `GOOGLE_ADWORDS_TRACE.setUseNpayCount(...)` 경로로 존재하는 기존 확인을 이번 해석에 반영했다.
- 내부 주문 진단 API에서 2026-05-23 결제완료 주문 61건 중 Google click id 직접 보존 0건, upload 후보 0건을 확인했다.
- 최근 24시간 기준도 결제완료 주문 32건 중 Google click id 직접 보존 0건, upload 후보 0건으로 확인했다.
- VM Cloud read-only 원장 재구성 결과를 반영해, Google click id는 landing/paid_click/checkout/payment_page 일부에는 살아 있지만 자연 발생 confirmed 주문에는 직접 붙지 않는 상태로 정리했다.

## 하지 않은 일

- 외부 전환 send/upload: 하지 않음
- 운영DB write: 하지 않음
- VM Cloud write/deploy/restart: 하지 않음
- GTM publish: 하지 않음
- Imweb save: 하지 않음
- raw identifier output: gclid/gbraid/wbraid 원문은 출력하지 않음
- 실제 결제 테스트: 하지 않음. 돈과 주문 상태가 움직이는 작업이라 Green이 아님

## 검증

- 명령/화면:
  - `curl https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_1d&campaign_limit=200&conversion_action_limit=200`
  - `curl https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_7d&campaign_limit=200&conversion_action_limit=200`
  - `curl https://att.ainativeos.net/api/google-ads/click-id-health/orders?window=last_1d&only=all&limit=5`
  - `curl https://att.ainativeos.net/api/google-ads/click-id-health/orders?window=rolling_24h&only=all&limit=5`
  - `curl http://localhost:7010/ai-crm/harness-guide`
- 결과:
  - Google Ads `last_1d` 주장 구매: 21건 / 4,050,200원
  - 내부 `last_1d` 결제완료 주문: 61건
  - 내부 `last_1d` Google click id 직접 보존 주문: 0건
  - 내부 `rolling_24h` 결제완료 주문: 32건
  - 내부 `rolling_24h` Google click id 직접 보존 주문: 0건
- source/window/freshness/confidence:
  - Google Ads API, 2026-05-23 KST, 2026-05-24 11:58 KST 조회, confidence high
  - VM Cloud order diagnostics API, 2026-05-23 KST 및 rolling 24h, 2026-05-24 11:58 KST 조회, confidence high
  - VM Cloud read-only 원장 재구성, 2026-05-21 21:15 KST 이후, confidence medium-high

## 막힌 지점

- blocker category: Red/실제 결제 영향
- 설명: “Google 광고 클릭 후 실제 paid confirmed까지 닫히는 테스트 주문”은 돈과 주문 상태가 움직인다. Codex가 Green으로 자동 수행할 수 없다.
- Green으로 더 줄일 수 있는 일:
  - 기존 원장 기준으로 Google Ads 주장값과 내부 실제 주문을 계속 분리 표시한다.
  - order-level no-send 후보 생성기를 더 보강해 `왜 upload 후보가 아닌지`를 주문별로 보여준다.
- Yellow/Red/권한/사업 판단으로 남은 일:
  - 실제 결제 confirmed 테스트 1건 수행 여부
  - 기존 Google Ads Primary 전환을 건드릴지 여부
  - Google Ads에 실제 결제완료 전용 전환을 보낼지 여부

## 다음 행동

- 무엇을: Google Ads 보고서 화면에 `Google Ads 주장 구매`, `내부 실제 결제완료`, `Google click id가 직접 붙은 실제 결제완료`를 분리해 표시한다.
- 왜: TJ님이 예산 판단할 때 Google Ads가 부르는 구매와 내부 실제 매출을 섞지 않게 하기 위해서다.
- 어떻게: 기존 `/ads/google-roas-report`의 exact evidence 카드와 conversion action 카드에 이번 수치를 반영한다.
- 누가: Codex
- 성공 기준: 2026-05-23 기준으로 `Google Ads 주장 구매 21건`과 `내부 결제완료 61건 / 직접 click id 0건`이 화면에서 다른 줄로 보인다.
- 실패 시 확인점: API shape 변경, 프론트 캐시, local backend 7020 연결 상태
- 승인 필요 여부: 없음. 프론트 read-only 표시 보강은 Green
- 추천 점수/자신감: 95%
