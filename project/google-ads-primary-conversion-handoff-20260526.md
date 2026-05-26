작성 시각: 2026-05-26 21:53 KST
기준일: 2026-05-26
문서 성격: 다른 Codex 창 인수인계 — Google Ads 실제 구매 주 전환 작업

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
  required_context_docs:
    - project/google-ads-upload-ledger-write-smoke-final-20260526.md
    - project/google-ads-duplicate-send-ledger-design-20260526.md
    - project/google-ads-limited-confirmed-purchase-send-approval-draft-20260526.md
  lane: Green for handoff/read-only, Yellow for VM Cloud write smoke after approval, Red for Google Ads conversion upload
  allowed_actions:
    - read-only live API check
    - no-send preview
    - approval packet refinement
    - local report update
  forbidden_actions:
    - Google Ads conversion upload without explicit TJ approval
    - Google Ads Primary/Secondary mutation without explicit TJ approval
    - VM Cloud SQLite write without write smoke approval
    - operational DB write
    - GTM publish
    - raw order/click id exposure
  source_window_freshness_confidence:
    source: VM Cloud localhost no-write API + order diagnostics aggregate
    window: last_7d
    freshness: 2026-05-26 21:53 KST
    confidence: high for current aggregate status
```

## 10초 요약

목표는 Google Ads가 실제 결제완료 주문만 구매로 학습하게 만드는 것이다.

기존 `구매완료` 전환은 `NPay 버튼 클릭/결제진입(보조)`로 낮춰졌고, `TechSol - NPAY구매 50739`는 TJ님이 삭제했다. 다음은 `BI confirmed_purchase_offline`을 실제 구매 전용 전환 통로로 살리는 것이다.

현재 준비도는 88%다. VM Cloud 장부 write smoke가 통과하면 92%, Google Ads 제한 전송 2건 수신 확인 후 95%로 본다.

## 지금 절대 하지 말 것

- Google Ads에 conversion upload 하지 말 것.
- Google Ads 설정을 Primary로 올리지 말 것.
- VM Cloud SQLite에 장부 row를 쓰지 말 것. TJ님 write smoke 승인 전까지 금지.
- 운영DB에 write하지 말 것.
- raw 주문번호, raw gclid, raw gbraid, raw wbraid를 대화/문서에 출력하지 말 것.

## 현재 live 숫자

source: VM Cloud localhost API
window: last_7d
freshness: 2026-05-26 21:53 KST
confidence: high

- 실제 구매완료 주문: 458건.
- 실제 구매완료 매출: 109,080,402원.
- Google Ads에 바로 보낼 수 있는 exact gclid 후보: 2건, 270,900원.
- 후보율: 0.4%.
- mixed Google click id 보류 후보: 2건, 485,000원.
- 내부 bridge는 있으나 Google click id가 없는 주문: 345건, 99,800,828원.
- 내부 bridge도 없는 실제 구매: 109건, 8,523,674원.
- NPay 실제 구매: 22건, 3,018,500원. 현재 모두 missing bridge 쪽이다.
- Google Ads 전송: 0건.
- VM Cloud write: 0건.

## 현재 API

VM Cloud 내부에서만 조회 가능하다. 외부 공개 도메인은 403일 수 있다.

```text
GET http://127.0.0.1:7020/api/google-ads/confirmed-purchase/upload-ledger-write-smoke-plan?site=biocom&window=last_7d&limit=2
GET http://127.0.0.1:7020/api/google-ads/confirmed-purchase/candidate-expansion?site=biocom&window=last_7d&limit=12
GET http://127.0.0.1:7020/api/google-ads/click-id-dropoff?site=biocom&window=last_7d
GET http://127.0.0.1:7020/api/google-ads/click-id-health/orders?site=biocom&window=last_7d&only=all&limit=10000
```

주의: `click-id-health/orders`는 raw 주문번호와 raw click id를 응답에 포함할 수 있다. 다른 창 Codex는 이 endpoint를 직접 출력하지 말고, 서버 안에서 aggregate만 계산해 보고해야 한다.

## 읽어야 할 문서 순서

1. `project/google-ads-upload-ledger-write-smoke-final-20260526.md`
   - 왜 봐야 하는가: 다음 실행 게이트인 VM Cloud 장부 write smoke의 성공/중단/롤백 기준이다.
2. `project/google-ads-duplicate-send-ledger-design-20260526.md`
   - 왜 봐야 하는가: 중복 전송 방지 장부의 설계와 live no-write 결과가 있다.
3. `project/google-ads-limited-confirmed-purchase-send-approval-draft-20260526.md`
   - 왜 봐야 하는가: 실제 Google Ads 제한 전송을 승인받기 위한 Red Lane 문서다.

## 추천 실행 순서

### 1. VM Cloud 장부 write smoke

Lane: Yellow.

TJ님 승인 문구가 있어야 한다.

> VM Cloud에 Google Ads 실제 구매 전송 장부 테이블을 만들고, Google Ads 전송 없이 후보 최대 2건을 ready row로만 쓰는 write smoke를 승인한다.

성공 기준은 ready row 2건 이하, replay duplicate blocked 2건, Google Ads 전송 0건이다.

### 2. Google Ads 제한 전송 2건

Lane: Red.

write smoke가 통과한 뒤에만 요청한다. 전환 액션은 `BI confirmed_purchase_offline` 하나만 쓴다.

### 3. 주 전환 승격

Lane: Red.

제한 전송이 Google Ads 화면/API에서 정상 수신되고 중복이 없으면 24시간 안에 `BI confirmed_purchase_offline`을 Primary 전환 후보로 올린다. Primary는 Google Ads가 입찰 학습에 쓰는 핵심 구매 신호라는 뜻이다.

## 지금 병목 해석

후보율 0.4%는 결제완료 주문이 적어서가 아니다. 실제 구매는 458건으로 충분하다.

문제는 Google Ads가 받을 수 있는 직접 click id가 실제 구매 주문까지 붙어 있는 건이 2건뿐이라는 점이다.

가장 큰 병목은 `내부 bridge는 있으나 Google click id가 없는 주문 345건`이다. 이 주문들은 실제 구매와 결제완료 기록은 붙었지만 Google에 보낼 gclid/gbraid/wbraid가 없다. 다음 개선은 결제완료 payload의 click id 복원과, NPay 외부 결제완료 주문번호 bridge 확장이다.

## 다음 창에서 바로 할 수 있는 Green 작업

1. 후보율 병목을 날짜/상품/결제수단별로 더 집계한다.
2. mixed Google click id 2건을 one-of 선택 규칙으로 보낼 수 있는지 no-send로만 검토한다.
3. NPay 22건 missing bridge를 NPay intent matcher와 다시 비교해 A로 올릴 수 있는지 no-write 검토표를 만든다.
4. 로컬 Google ROAS 보고서에 88/92/95 단계와 현재 후보율 0.4% 설명을 더 쉽게 표시한다.

