# gpt0508-17 결과보고서

작성 시각: 2026-05-09 22:36 KST

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
  lane: approved Yellow execution plus Green report packaging
  allowed_actions:
    - VM Cloud limited delta deploy
    - order-complete-only limited Production publish
    - 1h identity-first hash-only canary
    - monitoring
    - rollback
    - reliability dry-run
    - gptconfirm packaging
  forbidden_actions:
    - All Pages trigger
    - existing GTM tag pause/delete
    - raw email/phone/member_code/order/payment storage
    - Google Ads/GA4/Meta/TikTok/Naver new send by Path B
    - Google Ads conversion upload
    - send_candidate=true
  source_window_freshness_confidence:
    source: VM Cloud ledger summary, GTM API live version check, PM2/log scan, canary rows
    window: 2026-05-09 21:17-22:30 KST
    freshness: same-session
    site: biocom
    confidence: high
```

## 한 줄 결론

Path B identity-first 1시간 canary는 PASS입니다. 주문완료 화면에서 hash-only row 2건이 실제로 저장됐고, click id가 없는 row는 전송 후보가 아니라 `identity_only_quarantine`으로 격리됐습니다.

## 완료한 것

- VM Cloud에 row status logic이 반영됐는지 확인했고, 부족한 live dist는 제한 delta deploy로 맞췄습니다.
- GTM fresh workspace에서 order-complete-only canary version을 만들고 1시간만 live로 열었습니다.
- VM Cloud write flag를 canary window 동안 ON으로 두고, 종료 후 OFF로 원복했습니다.
- GTM live version을 canary 이전 version 142로 rollback했습니다.
- Canary row 2건을 기준으로 reliability v2 dry-run을 만들었습니다.
- `gptconfirm/gpt0508-17/` 패키지를 만들었습니다.

## 진척률 %

- 전체 Path B bridge 기준 진척률: 약 99%.
- 이번 batch 기준 진척률: 100%.
- 운영 기준 100%까지 남은 단계: click bridge strategy 결정, identity-only quarantine row를 얼마나 더 쌓을지 결정, Google Ads send gate 별도 승인.
- 다음 병목: click id가 없는 주문완료 row를 계속 quarantine으로 쌓을지, paid-click-originated click bridge를 별도 테스트할지 결정.
- 사람이 이해할 수 있는 1문장 설명: 실제 주문완료 화면에서 hash-only 원장 저장은 성공했고, 아직 광고 클릭 연결은 없는 상태라 전송은 막아둔 상태입니다.

## canary 결과

- Baseline row_count: 2.
- Final row_count: 4.
- Canary row delta: 2.
- Row cap: 200.
- Canary status 분포:
  - `full_bridge`: 0.
  - `identity_only_quarantine`: 2.
  - `session_only_quarantine`: 0.
  - `click_missing_hold`: 0.
  - `ambiguous`: 0.
  - `do_not_send`: 0.
- Fill rate:
  - order hash: 2/2.
  - email hash: 2/2.
  - client/session: 2/2.
  - click id hash: 0/2.
- `send_candidate=true`: 0.
- `actual_send_candidate=true`: 0.

## 지금 승인해도 되는 것

- Green: canary row 기반 추가 reliability 분석.
- Green: click bridge 후보 설계.
- Green: payment-decision raw query logging hardening 설계서 보강.
- Yellow 후보: 짧은 identity-first canary 연장 또는 특정 결제수단별 fill-rate 측정.

## 아직 승인하면 안 되는 것

- Google Ads confirmed_purchase upload.
- GA4/Meta/Google Ads actual send.
- 기존 Google Ads conversion action 변경.
- All Pages trigger.
- 기존 GTM tag pause/delete.
- raw email/phone/order/member_code/payment 저장 또는 logging.
- `send_candidate=true`.
- NPay click/count를 purchase로 승격.

## 검증 결과

- VM Cloud write flag cleanup: PASS, `write_flag_on=false`.
- GTM rollback: PASS, live container version 142, canary tag live 없음.
- raw stored count: PASS, 0.
- Path B platform send count: PASS, 0.
- row cap: PASS, 2/200.
- reliability v2 dry-run: PASS, confidence C/HOLD 2건.
- payment-decision raw query logging: P1 backlog. Path B blocker 아님.

## 현재 영향 / 서버·커밋 상태

- VM Cloud backend는 online이며 write flag는 OFF입니다.
- GTM live는 canary 이전 version 142로 복구됐습니다.
- Canary version 143은 latest created version으로 남아 있지만 live가 아닙니다.
- Path B canary row 2건은 hash-only로 VM Cloud SQLite에 남아 있습니다.
- 이 보고서 작성 시점의 관련 변경은 커밋 전이며, 검증 후 선별 커밋/push 예정입니다.

## 남은 리스크

- 기존 `payment-decision` GET query raw logging은 P1 hardening으로 남아 있습니다.
- click id가 없는 row가 많으면 Google Ads upload 후보가 바로 늘지는 않습니다.
- 기존 live GTM 구매 태그는 이번 작업에서 수정하지 않았고, 기존 동작은 그대로입니다.

## 확인하면 좋은 문서

1. `02-path-b-identity-first-storage-canary-result-20260509.md`: 실제 1시간 canary에서 무엇이 저장됐는지 확인하는 문서입니다.
2. `03-path-b-reliability-v2-dry-run-result-20260509.md`: 왜 아직 Google Ads 전송 후보가 아닌지 확인하는 문서입니다.
3. `05-path-b-rollback-verification-20260509.md`: VM Cloud write flag와 GTM live rollback이 끝났는지 확인하는 문서입니다.

## 다음 할일

### TJ님이 할 일

1. click bridge를 지금 바로 밀지, identity-only row를 조금 더 쌓을지 선택
- 의존성: 이번 canary 결과 확인 후 가능.
- 추천/자신감: 82%.
- 무엇을 하는가: 다음 실험을 `click bridge 테스트`로 갈지, `identity-first canary 연장`으로 갈지 선택합니다.
- 왜 하는가: 현재 order/email/session은 잡히지만 click id는 0/2라 Google Ads 전송 판단은 아직 HOLD입니다.
- 어떻게 하는가: `click bridge 우선` 또는 `identity canary 연장`이라고 답하면 됩니다.
- 누가 하는가: TJ님이 방향을 정하고, Codex가 문서/실행 패킷을 준비합니다.
- 승인 필요 여부: 추가 Production canary나 실제 광고 클릭/결제 테스트는 승인 필요.
- 성공 기준: 다음 실험의 목적이 click fill-rate 개선인지 identity fill-rate 안정화인지 분리됩니다.
- 실패 시 다음 확인점: click bridge는 URL/storage 보존 문제, identity 연장은 row volume 부족 문제로 분리합니다.

### Codex가 할 일

1. 관련 변경 선별 커밋/push
- 의존성: 이 batch 검증 명령 통과 필요.
- 추천/자신감: 95%.
- 무엇을 하는가: Path B canary runner, canary data, gdn/gptconfirm 문서만 선별 커밋하고 push합니다.
- 왜 하는가: VM Cloud에 반영된 코드와 결과 문서를 git에 고정해야 추적이 가능합니다.
- 어떻게 하는가: backend typecheck, fixture, wiki link, harness preflight, diff check, JSON parse 후 2개 커밋으로 나눕니다.
- 누가 하는가: Codex.
- 승인 필요 여부: 이미 "알아서 정리해서 커밋 푸시" 지시가 있어 Green으로 진행.
- 성공 기준: unrelated dirty 없이 origin/main에 push됩니다.
- 실패 시 다음 확인점: 테스트 실패면 코드/문서 원인, push 실패면 인증/remote 상태로 분리합니다.
