# gpt0508-18 결과보고서

작성 시각: 2026-05-10 00:11 KST

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  lane: Green read-only diagnosis and confirmation packaging
  allowed_actions:
    - VM Cloud SQLite read-only join dry-run
    - local source audit
    - scorecard update
    - gptconfirm packaging
    - scoped commit and push after validation
  forbidden_actions:
    - identity-only canary extension
    - real paid-click actual order test
    - Google Ads confirmed_purchase upload
    - GTM Production publish
    - long-term storage expansion
    - raw email/phone/member_code/order/payment storage or logging
    - send_candidate=true
  source_window_freshness_confidence:
    source: VM Cloud order_bridge_ledger, VM Cloud paid_click_intent_ledger, local GTM helper scripts
    window: canary rows 2026-05-09 KST, join dry-run 2026-05-10 00:08 KST
    site: biocom
    freshness: same-session
    confidence: high for current canary rows, medium for broader paid-click preservation diagnosis
```

## 한 줄 결론

Path B 저장과 identity bridge는 PASS지만, canary row 2건은 paid_click_intent와 세션 기준으로 연결되지 않아 click bridge는 HOLD입니다. time-window-only 매칭은 후보가 너무 많아 Google Ads 전송 후보로 쓰면 안 됩니다.

## 완료한 것

- VM Cloud SQLite를 read-only로 조회해 `order_bridge_ledger` canary row 2건과 `paid_click_intent_ledger`를 1d / 7d / 30d lookback으로 조인했습니다.
- client id, GA session id, local session hash 기준 exact match를 확인했습니다.
- Path B 주문완료 tag가 읽는 click source와 paid_click_intent tag가 저장하는 storage key를 비교했습니다.
- click bridge diagnosis와 다음 액션 분기를 정리했습니다.
- `gptconfirm/gpt0508-18/` 패키지를 만들었습니다.

## 진척률 %

- 전체 Path B bridge 기준 진척률: 약 99%.
- 이번 batch 기준 진척률: 100%.
- 운영 전송 기준 100%까지 남은 단계: same-browser click preservation 검증, paid-click-originated click bridge 확인, Google Ads send gate 별도 승인.
- 다음 병목: 주문완료 row가 실제 광고 클릭 storage와 이어지는지 확인하는 controlled same-browser flow.
- 사람이 이해할 수 있는 1문장 설명: 주문과 로그인 식별값은 안전하게 잡히지만, 광고 클릭에서 온 주문인지 아직 증명되지 않아 전송은 계속 막아둔 상태입니다.

## 핵심 숫자

- 분석 대상 order_bridge row: 2.
- row status: `identity_only_quarantine` 2건.
- order hash present: 2/2.
- email hash present: 2/2.
- client/session present: 2/2.
- direct click hash present: 0/2.
- paid_click_intent exact session match: 0/2.
- Google Ads upload candidate: 0.
- `send_candidate=true`: 0.
- `actual_send_candidate=true`: 0.

time-window-only 후보:

- row 1: 1d 1267 click rows / 819 unique click hash, 30d 2169 / 1369.
- row 2: 1d 1231 click rows / 799 unique click hash, 30d 2170 / 1370.

이 숫자는 time window 안에 광고 클릭이 많다는 뜻이지, 주문 row와 연결됐다는 뜻이 아닙니다. 전송 후보로 쓰면 과대귀속 위험이 큽니다.

## 지금 승인해도 되는 것

- Green: TEST click id same-browser preservation Preview 설계.
- Green: Path B tag의 storage read logic 보강안 작성.
- Green: paid_click_intent와 order_bridge의 post-join reliability dry-run 설계 보강.
- Green: current canary row는 계속 `identity_only_quarantine`으로 보존.

## 아직 승인하면 안 되는 것

- Google Ads confirmed_purchase upload.
- GA4/Meta/Google Ads actual send.
- `send_candidate=true`.
- real paid-click actual order test.
- GTM Production publish.
- identity-only canary 연장.
- raw email/phone/member_code/order/payment 저장 또는 logging.
- NPay click/count를 purchase로 승격.

## 검증 결과

- VM Cloud read-only join dry-run: PASS.
- Exact click bridge match: HOLD, 0/2.
- Time-window-only matching rejection: PASS.
- Source audit: PASS, primary storage key는 `bi_paid_click_intent_v1`.
- Raw storage/logging 추가: 없음.
- Platform send: 없음.
- Google Ads upload candidate: 0.

## 현재 영향 / 서버·커밋 상태

- 이번 batch는 read-only 진단과 문서 패키징입니다.
- VM Cloud write flag 변경 없음.
- GTM publish 없음.
- Google Ads/GA4/Meta/TikTok/Naver 전송 없음.
- raw email/phone/member_code/order/payment 저장 또는 logging 추가 없음.
- 커밋/push는 검증 후 이번 batch 관련 파일만 선별해 진행합니다.

## 남은 리스크

- 현재 canary row 2건은 paid-click-originated flow가 아니었을 가능성이 큽니다.
- 실제 유료 광고 클릭에서 시작한 주문 흐름은 아직 확인하지 않았습니다.
- checkout 또는 외부 결제 복귀 과정에서 browser storage가 유지되는지는 별도 same-browser test가 필요합니다.
- time-window-only 후보는 매우 많아서 attribution rule 없이 쓰면 잘못된 Google Ads 전송으로 이어질 수 있습니다.

## 확인하면 좋은 문서

1. `01-click-bridge-diagnosis.md`: 왜 click bridge가 HOLD인지 한 번에 확인하는 문서입니다.
2. `02-next-action-decision.md`: 다음 실험을 무엇부터 할지 결정하는 문서입니다.
3. `gdn/path-b-order-bridge-paid-click-join-dry-run-20260510.md`: 실제 조인 숫자와 전송 후보 0 판단 근거입니다.

## 다음 할일

### TJ님이 할 일

1. same-browser TEST click preservation을 Preview/no-send로 진행할지 확인
- 의존성: 이번 gpt0508-18 결과 확인 후 가능.
- 추천/자신감: 88%.
- 무엇을 하는가: 실제 광고 클릭이 아니라 TEST gclid로 상품상세에서 시작해 주문완료까지 같은 브라우저에서 click id가 유지되는지 확인하는 흐름을 승인합니다.
- 왜 하는가: 현재 주문 row는 identity/order/session은 잡혔지만 click id가 없어 Google Ads 전송 후보가 0입니다.
- 어떻게 하는가: `TEST click preservation 진행`이라고 답하면 Codex가 fresh workspace/Preview 또는 no-send controlled flow 문서를 준비합니다.
- 누가 하는가: TJ님은 승인과 브라우저 화면 접근, Codex는 태그 초안/검증/문서화.
- 승인 필요 여부: GTM Production publish 없이 Preview/no-send만이면 Green 또는 Yellow-lite. Production publish나 실제 광고 클릭은 별도 승인 필요.
- 성공 기준: 주문완료 단계에서 `click_id_hash_present=true`, `would_send=false`, platform send 0.
- 실패 시 다음 확인점: 상품상세 저장 실패, checkout storage 유실, order complete extraction 실패 중 어디인지 분리합니다.

### Codex가 할 일

1. same-browser preservation runbook과 Preview tag diff 준비
- 의존성: gpt0508-18 검증과 커밋/push 완료 후 독립 진행 가능.
- 추천/자신감: 90%.
- 무엇을 하는가: 상품상세 TEST gclid 진입부터 주문완료 Path B extraction까지의 체크리스트와 tag diff를 준비합니다.
- 왜 하는가: direct 주문완료 URL 테스트는 click source 확인에 부족하고, 실제 사용자 흐름에서 storage가 살아있는지 봐야 합니다.
- 어떻게 하는가: `bi_paid_click_intent_v1` 생성, local/sessionStorage 보존, order complete extraction, no-send response를 순서대로 확인하는 문서를 만듭니다.
- 누가 하는가: Codex.
- 승인 필요 여부: 문서/Preview 준비는 승인 불필요. GTM Production publish나 실제 광고 클릭/결제는 승인 필요.
- 성공 기준: 다음 batch에서 click bridge PASS/HOLD가 한눈에 구분됩니다.
- 실패 시 다음 확인점: GTM workspace quota, CORS, storage key mismatch, external checkout context를 분리합니다.
