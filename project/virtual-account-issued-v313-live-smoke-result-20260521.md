# VirtualAccountIssued v3.1.3 Live Smoke Result

작성 시각: 2026-05-21 20:45 KST
기준일: 2026-05-21
문서 성격: 아임웹 헤더 상단 v3.1.3 운영 반영 후 live smoke 결과 / read-only 판단 기록

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_context_docs:
    - docurule.md
    - project/imweb-header-top-full-v313-virtual-account-issued-20260521.md
    - project/header-guard-v313-virtual-account-issued-code-20260521.md
  lane: Green for read-only verification and documentation
  allowed_actions:
    - Meta Pixel Helper result review from TJ님 screenshot/text
    - VM Cloud public read-only API check
    - local document creation
  forbidden_actions:
    - no Imweb edit
    - no GTM publish
    - no Meta or Google Ads platform send
    - no VM Cloud deploy or restart
    - no production DB write
  source_window_freshness_confidence:
    source: TJ님 browser smoke + VM Cloud read-only API + Google Ads dashboard read-only API
    window: 2026-05-21 20:35-20:42 KST
    freshness: checked 2026-05-21 20:42 KST
    confidence: 0.92
```

## 10초 요약

아임웹 헤더 상단 v3.1.3 교체 후 가상계좌 미입금 주문에서 `VirtualAccountIssued`가 1회 발화했고, 새로고침해도 중복 증가하지 않았다. `Purchase`는 발화하지 않았고, VM Cloud `payment-decision`도 해당 주문을 `pending -> block_purchase_virtual_account`로 판단했다.

Google 클릭 ID와 `gad_campaignid` 수집도 최근 원장에서 살아 있다. 다만 raw click id 원문은 보고서에 출력하지 않는다.

## Smoke 결과

| 항목 | 결과 | 판단 |
|---|---:|---|
| `VirtualAccountIssued` 발화 | 1건 | PASS |
| 새로고침 중복 증가 | 없음 | PASS |
| 미입금 가상계좌 `Purchase` | 0건 | PASS |
| `value` | 0 | 정상. 매출이 아니라 가상계좌 발급 신호라서 0이 맞다 |
| `payment_status` | pending | 정상 |
| `payment_method` | virtual_account | 정상 |
| `is_purchase` / `is_paid` | no / no | 정상 |
| 서버 판단 | pending / block_purchase_virtual_account | PASS |

## Google 클릭 원장 확인

raw `gclid` 값은 문서에 출력하지 않았다. 대신 raw 식별자를 숨기는 read-only 집계로 확인했다.

| source | window | 확인값 | 판단 |
|---|---|---:|---|
| VM Cloud `site_landing_ledger` | 최근 7일 | Google click id rows 9,289 / `gad_campaignid` rows 156 | 수집 중 |
| VM Cloud `paid_click_intent_ledger` | 최근 7일 | Google click id rows 9,741 / `gad_campaignid` rows 168 | 수집 중 |
| VM Cloud `attribution_ledger` | 최근 7일 | Google click evidence rows 4,580 / `gad_campaignid` rows 116 | 수집 중 |
| Google campaign id `21808018766` | 최근 7일 | row 18 | 방금 테스트 캠페인 ID 계열이 원장에 존재 |
| Google campaign id `21808018766` | 최근 30일 | row 32 / confirmedRows 2 | 장기 window에도 존재 |
| site landing summary | 최근 1시간 | `paid_search` 31, `googleads_testPM_mineral_url` 12 | 테스트 유입 계열 확인 |

## Meta 진단 오류 의견

Meta 진단의 `웹사이트 InitiateCheckout 이벤트에 대한 유효한 가격 정보를 전송하세요`는 이번 가상계좌 Purchase 차단과는 다른 이슈다.

현재 해석은 이렇다.

1. 아임웹 또는 기존 Meta Pixel 경로가 `InitiateCheckout`을 보내고 있다.
2. 그 `InitiateCheckout` payload에 `value`가 없거나 0/빈 값으로 들어간다.
3. 우리 Block4 fallback은 이미 네이티브 `InitiateCheckout` 네트워크 요청이 있으면 중복 방지를 위해 richer fallback을 보내지 않는다.
4. 그래서 Meta는 `InitiateCheckout` 100%가 value 없음이라고 진단한다.

이 문제는 고칠 가치가 있다. 단, `Purchase`와 분리해서 고쳐야 한다. `InitiateCheckout value`는 주문서 진입 시점의 장바구니/주문 예상 금액이지 실제 결제완료 매출이 아니다.

## 권장 보강 방향

푸터 v4.4.4 후보로 아래를 설계한다.

1. `fbq('track', 'InitiateCheckout', ...)` wrapper 단계에서 payload에 `value`가 없으면 checkout page DOM 또는 저장된 checkout context에서 금액을 추정한다.
2. 신뢰도 높은 금액만 `value`로 넣고, `currency='KRW'`를 붙인다.
3. 실패하면 억지로 넣지 않는다.
4. `Purchase`에는 영향 주지 않는다.
5. `VirtualAccountIssued`는 계속 `value=0`을 유지한다.

## 하지 않은 것

- 아임웹 추가 수정 없음.
- GTM publish 없음.
- Meta CAPI/Google Ads 전송 없음.
- 운영DB write 없음.
- raw click id 출력 없음.

## Auditor Verdict

PASS_WITH_NOTES. 가상계좌 미입금 주문을 구매로 세지 않는 핵심 guard는 통과했다. Google click id/campaign id 원장 수집도 집계 기준으로 살아 있다. Meta `InitiateCheckout value` 경고는 별도 중간 이벤트 품질 이슈로 분리해 푸터 v4.4.4에서 보강하는 것이 좋다.
