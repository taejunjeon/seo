# NPay 로그인/결제 이탈 단계 라벨 설계 - 2026-05-28

작성 시각: 2026-05-28 15:20 KST
기준일: 2026-05-28
문서 성격: 설계안 / no-send / no-write / no-deploy

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - frontrule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - project/google-npay-bridge-url-capture-v11-20260528.md
    - project/google-npay-bridge-gtm-preview-smoke-result-20260528.md
  required_context_docs:
    - project/google-npay-bridge-url-capture-v11-20260528.md
    - project/google-npay-bridge-gtm-preview-smoke-result-20260528.md
  lane: Green for design, Yellow for VM Cloud deploy, Red for Google Ads send
  allowed_actions:
    - read-only row-level check
    - local design document
    - local report/API implementation draft
  forbidden_actions:
    - GTM Production publish
    - VM Cloud backend deploy without approval
    - Google Ads conversion send
    - production DB write
    - raw NPay URL long-term storage
  source_window_freshness_confidence:
    source: VM Cloud row-level npay_intent_log API + backend/src/npayIntentLog.ts
    window: 2026-05-28 14:28-14:58 KST smoke window
    freshness: row-level check generated 2026-05-28 14:58 KST
    confidence: high for button-click capture, medium for login-exit classification until stage labels are implemented
```

## 10초 요약

NPay 버튼 클릭은 이제 VM Cloud에 저장된다. 이번 보강의 다음 목표는 “버튼만 누른 사람”, “네이버 로그인 화면에서 멈춘 사람”, “결제창까지 갔지만 결제하지 않은 사람”, “실제 결제완료한 사람”을 화면에서 분리하는 것이다.

원문 NPay URL을 길게 저장하지 않아도 가능하다. NPay로 넘어가는 URL의 `host`와 `path pattern`만 보고 단계 라벨을 만들면 된다.

## 왜 필요한가

Google ROAS 갭을 줄이려면 구매 전 과정을 네 단계로 나눠야 한다.

1. Google 광고 클릭 후 상품 페이지에 들어왔다.
2. NPay 버튼을 눌렀다.
3. 네이버 로그인 또는 결제창까지 들어갔다.
4. 실제 결제완료 주문이 생겼다.

지금까지는 2번과 4번 사이가 흐렸다. 그래서 “Google 클릭은 있었는데 왜 실제 구매 후보가 적은가”를 설명하기 어려웠다.

## 현재 확인된 사실

Source: VM Cloud row-level API `npay_intent_log`
Window: 2026-05-28 14:28-14:58 KST
Freshness: 2026-05-28 14:58 KST 조회
Confidence: high for storage, medium for clean-live because latest TJ smoke row was preview/debug

2026-05-28 14:56 TJ님 smoke row:

| 항목 | 확인 |
|---|---|
| NPay 버튼 클릭 저장 | yes |
| Google click id 저장 | yes |
| gclid 저장 | yes |
| NPay bridge URL hash 저장 | yes |
| NPay bridge host | `pay.naver.com` |
| 상품 | idx 198 |
| 상품가 | 35,000 |
| 환경 표시 | preview/debug |

같은 30분 window 안에 `environment=live`이면서 Google click id와 NPay bridge hash가 함께 있는 row도 있었다. 따라서 운영 live 경로도 동작 중이다.

### 2026-05-28 15:18 clean live smoke 추가 확인

TJ님이 바이오밸런스 상품에서 NPay 버튼을 클릭했고, 네이버 로그인 화면으로 이동한 뒤 로그인 후 결제창까지 갔다. 결제완료는 하지 않았다.

Source: VM Cloud row-level API `npay_intent_log`
Window: 2026-05-28 13:50-15:20 KST
Freshness: 2026-05-28 15:20 KST 조회
Output: `data/npay-bridge-v11-clean-live-button-smoke-20260528T062021Z.json`

| 항목 | 확인 |
|---|---|
| captured_at | `2026-05-28 15:18:08 KST` |
| environment | `live` |
| debug_mode | false |
| product_idx | `97` |
| product_price | `39000` |
| Google click id present | yes |
| gclid present | yes |
| gbraid present | yes |
| wbraid present | no |
| NPay bridge URL hash present | yes |
| NPay bridge host | `new-m.pay.naver.com` |
| NPay bridge observed_at | `2026-05-28 15:18:05 KST` |

해석:

- 깨끗한 운영 live 환경에서도 Google click id와 NPay 외부 결제 흐름 증거가 같은 row에 저장됐다.
- 이 테스트는 `bridge_opened`까지는 자동 확정할 수 있다.
- 다만 TJ님이 실제 브라우저에서 본 `nid.naver.com` 로그인 화면과 `orders.pay.naver.com/order/checkout` 결제창 URL은 현재 VM row에 자동 저장되지 않았다.
- 이유는 자사몰 GTM 태그가 NPay 이동 직전의 아임웹/NPay bridge URL까지는 볼 수 있지만, 브라우저가 네이버 도메인으로 넘어간 뒤의 redirect URL은 같은 태그가 더 이상 볼 수 없기 때문이다.

## 단계 라벨 정의

### 1. `button_clicked`

**사람 말:** 자사몰에서 NPay 버튼을 눌렀다.
**조건:** `npay_intent_log` row 생성.
**의미:** 구매 의사가 있었지만 아직 결제창에 갔는지는 모른다.

### 2. `bridge_opened`

**사람 말:** NPay 외부 결제 흐름으로 넘어가는 중간 문이 열렸다.
**조건:** NPay bridge URL hash가 있고 host가 `pay.naver.com`, `new-m.pay.naver.com`, `orders.pay.naver.com` 계열이다.
**의미:** 버튼 클릭 후 네이버 결제 흐름 진입 증거가 있다.

### 3. `login_required`

**사람 말:** 네이버 로그인 화면까지 갔다. 로그인하지 않고 이탈했을 수 있다.
**조건:** GTM 또는 VM receiver가 다음 URL host를 `nid.naver.com`으로 판별한다.
**의미:** “NPay 버튼은 눌렀지만 로그인 장벽에서 멈춘 후보”를 만들 수 있다.

주의: 자사몰 GTM 태그만으로는 네이버 도메인으로 이동한 뒤의 최종 redirect URL을 안정적으로 볼 수 없다. 2026-05-28 15:18 clean live smoke에서도 TJ님 브라우저는 `nid.naver.com` 로그인 화면을 봤지만, VM row에는 그 직전 bridge host인 `new-m.pay.naver.com`이 저장됐다. 따라서 자동 보고서에서는 `login_required`를 확정값이 아니라 `login_gate_possible` 또는 `external_flow_entered_not_completed` 후보로 표시하는 것이 안전하다.

### 4. `checkout_opened`

**사람 말:** 네이버 결제창까지 들어갔다.
**조건:** host가 `orders.pay.naver.com`이고 path가 `/order/checkout/` 계열이다.
**의미:** 로그인 장벽은 넘었거나 이미 로그인된 상태로 결제 직전 화면까지 갔다.

### 5. `result_opened`

**사람 말:** 네이버 결과 페이지까지 들어갔다.
**조건:** host가 `orders.pay.naver.com`이고 path가 `/order/result/` 계열이다.
**의미:** 외부 결제 완료 또는 결과 화면 진입 후보. 실제 결제완료 확정은 VM Cloud 주문 원장과 붙여야 한다.

### 6. `completed`

**사람 말:** 실제 결제완료 주문이 VM Cloud 주문 원장에 생겼다.
**조건:** NPay intent row가 실제 NPay 결제완료 주문과 A급 또는 승인된 기준으로 매칭된다.
**의미:** Google Ads 실제 구매 전환 후보 검토 가능.

### 7. `entered_not_completed`

**사람 말:** NPay 흐름에는 들어갔지만 일정 시간 안에 결제완료 주문이 없다.
**조건:** `button_clicked`, `bridge_opened`, `login_required`, `checkout_opened` 중 하나는 있으나 2-24시간 안에 matching confirmed order가 없다.
**의미:** 이탈 후보. 구매 전환으로 보내면 안 된다.

## 구현 방식

### 선택 A. GTM에서 stage를 계산해서 보낸다

권장도: 높음

GTM v1.2가 NPay URL을 발견하는 순간 아래 값을 같이 보낸다.

```json
{
  "npay_entry_stage": "checkout_opened",
  "npay_entry_host": "orders.pay.naver.com",
  "npay_entry_path_family": "order_checkout"
}
```

장점:

- 원문 URL을 서버에 저장하지 않아도 된다.
- 브라우저가 실제로 다음에 어디로 가려 했는지 가장 가까운 지점에서 분류한다.
- VM Cloud는 민감한 원문 URL 대신 stage 문자열만 저장한다.

단점:

- GTM Production publish가 필요하므로 Red Lane이다.

### 선택 B. VM receiver에서 stage를 계산한다

권장도: 중간

현재처럼 `npayBridgeUrl` 원문은 요청 payload로 받되, VM Cloud는 원문을 저장하지 않고 host/path만 판별해 stage를 저장한다.

장점:

- 정책상 원문 URL 장기 저장 없이 stage만 남길 수 있다.
- GTM 쪽 변경을 줄일 수 있다.

단점:

- 현재는 path hash만 저장하므로 이미 저장된 과거 row를 stage로 되살리기 어렵다.
- `nid.naver.com` 같은 host allowlist가 receiver에 있어야 한다.

### 선택 C. 원문 URL을 짧게 저장한다

권장도: 낮음, 디버그 전용

원문을 24시간 TTL, admin-only, 암호화 저장으로 제한하면 디버그에는 유용하다.

하지만 지금 목표는 “연결부터”이지 원문 보관이 아니다. 구매 연결은 host/path/stage/hash로 충분하다.

## 추천 설계

1. GTM v1.2는 `npay_entry_stage`, `npay_entry_host`, `npay_entry_path_family`를 계산해 보낸다.
2. VM Cloud는 stage 문자열과 host만 저장한다.
3. 원문 URL은 저장하지 않는다.
4. 로컬 보고서는 아래 퍼널을 보여준다.

```text
Google click id 있는 NPay 버튼 클릭
→ bridge_opened
→ login_gate_possible
→ checkout_opened_possible
→ completed
→ entered_not_completed
```

정확도 기준:

| 단계 | 자동 확정 가능성 | 설명 |
|---|---:|---|
| `button_clicked` | 높음 | 자사몰에서 직접 관찰 |
| `bridge_opened` | 높음 | 아임웹/NPay bridge URL을 직접 관찰 |
| `login_gate_possible` | 중간 | 네이버 로그인 redirect는 자사몰 태그가 직접 보기 어려움 |
| `checkout_opened_possible` | 중간 | 네이버 내부 checkout URL은 직접 보기 어려움 |
| `completed` | 높음 | VM Cloud 주문 원장과 조인하면 확정 |
| `entered_not_completed` | 중간-높음 | 일정 시간 안에 결제완료 주문이 없으면 이탈 후보 |

## 로컬 보고서 표시안

Frontend report: `http://localhost:7010/ads/google-roas-report`

새 카드 제목:

```text
NPay 외부 결제 흐름
```

카드 문구:

```text
NPay 버튼을 누른 뒤 실제 구매까지 이어졌는지 봅니다.
버튼 클릭은 구매가 아니고, 네이버 로그인/결제창 진입도 구매가 아닙니다.
실제 결제완료 주문과 붙은 건만 Google Ads 실제 구매 후보입니다.
```

표시 지표:

| 지표 | 쉬운 의미 |
|---|---|
| 버튼 클릭 | 자사몰에서 NPay 버튼을 누른 사람 |
| 로그인 화면 진입 | 네이버 로그인 화면까지 갔지만 결제 전일 수 있음 |
| 결제창 진입 | 네이버 결제 화면까지 감 |
| 실제 결제완료 | VM Cloud 주문 원장에 결제완료 주문 있음 |
| 이탈 후보 | 결제 흐름에는 들어갔지만 주문 없음 |

## 성공 기준

1. NPay 버튼 클릭 row에 `npay_entry_stage`가 채워진다.
2. `nid.naver.com` 진입은 `login_required`로 보인다.
3. `orders.pay.naver.com/order/checkout` 진입은 `checkout_opened`로 보인다.
4. 실제 결제완료 주문과 붙은 row만 `completed`로 보인다.
5. Google Ads 전송 후보는 `completed + Google click id 있음 + 중복/취소/환불 방어 통과`만 남는다.

수정된 현실적 성공 기준:

1. 자사몰에서 관찰 가능한 `button_clicked`와 `bridge_opened`는 자동 확정한다.
2. 네이버 내부 로그인/결제창 단계는 `possible` 후보로 표시한다.
3. 실제 결제완료 주문과 붙은 row만 `completed`로 표시한다.
4. `bridge_opened`는 있지만 `completed`가 없는 row는 `entered_not_completed`로 표시한다.
5. Google Ads 전송 후보는 여전히 `completed + Google click id 있음 + 중복/취소/환불 방어 통과`만 남긴다.

## 실패 시 해석

| 실패 | 해석 | 다음 확인 |
|---|---|---|
| stage가 비어 있음 | NPay URL 발견 전 payload가 먼저 전송됨 | GTM wrapper 순서 확인 |
| `login_required`가 안 보임 | `nid.naver.com` URL을 캡처하지 못함 | host allowlist와 response parser 확인 |
| `checkout_opened`만 많고 completed가 적음 | 실제로 결제창 이탈이 많거나 주문 조인이 약함 | 실제 주문 원장 조인 기준 확인 |
| completed는 있는데 Google click id가 없음 | 유입 click id 보존 또는 bridge 조인 병목 | Google click id 저장/복원 경로 확인 |

## 실행 순서

1. Local report 계산 로직에 stage bucket을 추가한다.
   Lane: Green

2. VM Cloud receiver schema/API에 `npay_entry_stage`, `npay_entry_path_family`를 추가하는 배포 승인안을 만든다.
   Lane: Yellow

3. GTM v1.2 Preview workspace에서 stage 전송을 검증한다.
   Lane: Yellow

4. Production publish는 TJ님 명시 승인 후 진행한다.
   Lane: Red

5. 실제 Google Ads 전송은 `completed` 후보만 제한 전송한다.
   Lane: Red

## 이번 설계의 진행 추천 점수

| 선택 | 추천 |
|---|---:|
| 진행 추천 | 92% |
| 진행 미추천 | 8% |

진행 추천 이유:

- Google ROAS 갭의 핵심은 “구매 전 행동”과 “실제 구매”를 분리하는 것이다.
- 이 설계는 실제 결제 없이도 이탈 구간을 볼 수 있게 만든다.
- 원문 NPay URL을 장기 저장하지 않아도 구현 가능하다.

진행 미추천 이유:

- VM deploy와 GTM Production publish 단계는 승인과 검증이 필요하다.
- `login_required`는 직접 결제 실패가 아니라 URL 기반 이탈 후보라서 표현을 조심해야 한다.

## 하지 않은 것

| 항목 | 이유 |
|---|---|
| VM Cloud deploy | 설계 단계. Yellow 승인 전 금지 |
| GTM Production publish | Red Lane. 별도 승인 전 금지 |
| Google Ads 전환 전송 | Red Lane. 이번 범위 아님 |
| 실제 결제 테스트 | TJ님 비용/주문 영향. 이번 범위 아님 |
| raw NPay URL 저장 | 보안/개인정보상 별도 승인 전 보류 |

## Auditor verdict

PASS_DESIGN_ONLY

- PASS: row-level smoke 결과와 현재 저장 필드 기준으로 단계 라벨 설계를 작성했다.
- PASS: no-send, no-write, no-deploy, no-publish.
- NOTE: 구현과 운영 반영은 별도 Green/Yellow/Red 단계로 나뉜다.
