# Meta funnel CAPI GTM-first 검토 결과

작성 시각: 2026-05-08 01:05 KST
대상: biocom Meta Pixel `1283400029487161`
문서 성격: Green Lane read-only + no-send payload preview + GTM-first 승인 전 계획
정본 연결: [[../total/!total-current]]
보조 이력: [[../data/!datacheckplan]]
관련 문서: [[meta-funnel-capi-readiness-20260508]], [[meta-funnel-capi-test-events-payload-preview-2026-05-08]], [[../GA4/google-tag-gateway-poc-approval-20260507]], [[../meta/meta-marketing-intent-gtm-plan-20260504]]
Do not use for: Meta Test Events 실제 호출, 운영 CAPI 전송, GTM Preview workspace 생성/수정, GTM Production publish, Imweb header/footer 수정

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - capivm/meta-funnel-capi-readiness-20260508.md
    - capivm/meta-funnel-capi-test-events-smoke-plan-20260505.md
    - total/!total-current.md
    - data/!datacheckplan.md
    - GA4/google-tag-gateway-poc-approval-20260507.md
    - meta/meta-marketing-intent-gtm-plan-20260504.md
  lane: Green read-only / no-send plan
  allowed_actions:
    - readiness 문서 확인
    - GTM live/read-only 상태 확인
    - Meta Test Events payload preview 생성
    - 정본 문서 연결 결정
    - 승인 전 계획 문서화
  forbidden_actions:
    - Meta Test Events 실제 호출
    - 운영 CAPI 전송
    - GTM Preview workspace 생성 또는 수정
    - GTM Production publish
    - Imweb header/footer 수정
    - 운영 DB 또는 Attribution VM ledger write
  source_window_freshness_confidence:
    source: "capivm/meta-funnel-capi-readiness-20260508.md + GTM API read-only + local payload preview"
    window: "2026-05-08 KST"
    freshness: "GTM live v142 확인 2026-05-08 00:55 KST, payload preview 2026-05-08 01:00 KST"
    confidence: 0.89
```

## 10초 결론

TJ님이 준 Test Events code는 확인했다. 원문값은 파일에 저장하지 않고 `TEST*****`로만 남겼다.

실제 Meta 호출은 하지 않았다. 이번 Green Lane에서 끝낸 것은 `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`, `Lead`, `Search` 6종의 no-send payload preview와 GTM-first 적용 판단이다.

정본 연결은 [[../total/!total-current]]로 둔다. 이유는 이 이슈가 Meta CAPI만의 문제가 아니라 Google Ads ROAS, GTM live v142, paid_click_intent, 플랫폼 전송 금지선과 같이 관리되어야 하기 때문이다. [[../data/!datacheckplan]]은 2026-05-04 기준 이력과 배경으로만 쓴다.

## 왜 GTM-first인가

아임웹 header/footer를 직접 바꾸면 사이트 전역 코드에 바로 영향이 난다. 반면 Google Tag Manager는 새 workspace에서 Preview와 Tag Assistant로 발화 조건을 먼저 검증할 수 있다.

Google 공식 문서도 Preview mode가 현재 workspace 초안을 publish 전처럼 테스트하고, Tag Assistant에서 어떤 태그가 firing 되었는지 볼 수 있다고 설명한다. Custom HTML tag는 GTM template이 없는 non-Google tag도 관리할 수 있는 방식이다.

따라서 이번 건의 우선 경로는 아래다.

1. Green: no-send payload preview와 승인 전 plan 작성.
2. Yellow: fresh GTM Preview workspace에서 Test Events code가 들어간 테스트 전용 Custom HTML tag를 만든다.
3. Red: Production publish 또는 `test_event_code` 없는 운영 funnel CAPI 전송은 별도 승인 전 중지한다.

## Google tag와 Google tag gateway 구분

이번 요청의 "구글태그 추가"는 GTM에서 Custom HTML tag를 추가하는 경로로 해석했다.

Google tag gateway는 Google 측정 신호를 자사 first-party infrastructure로 라우팅하는 기능이다. Meta CAPI, NPay confirmed_purchase, Meta Test Events를 대신 해결하지 않는다. 이 내용은 [[../GA4/google-tag-gateway-poc-approval-20260507]]에 이미 분리되어 있다.

## Read-only 확인 결과

### Meta CAPI readiness

- 서버 endpoint: `POST /api/meta/capi/track`
- 허용 이벤트: `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`, `Lead`, `Search`
- 운영 Purchase CAPI: 최근 운영 로그 기준 2xx 정상.
- funnel event 운영 송출: 클라이언트 호출이 없어 0건.
- `test_event_code`: 지원됨. 없으면 운영 카운트에 반영될 수 있으므로 테스트 단계에서 필수.

### GTM live 상태

- GTM container: `GTM-W2Z6PHN` / `biocom.kr`
- live version: `142 (paid_click_intent_v1_receiver_20260506T150218Z)`
- live version 구성: tags 59, triggers 85, variables 60, templates 4
- Google tag: `Google 태그 AW-304339096` tag `169` 존재
- paid_click_intent receiver: `codex_paid_click_intent_v1_receiver_no_send` tag `279` 존재
- Meta funnel CAPI server mirror tag: `/api/meta/capi/track` 호출 tag는 live snapshot에서 확인되지 않음
- Default Workspace: workspace `147`, change count 0, conflict count 0

참고: Default Workspace dry-run cleanup script는 `workspaceChange count is 0, expected 1`로 exit 2를 냈다. 이는 과거 stale change 1건을 전제로 한 스크립트라 생긴 precondition 실패이고, 현재 상태 자체는 change/conflict 0으로 깨끗하다.

## Payload preview

상세 산출물:

- [[meta-funnel-capi-test-events-payload-preview-2026-05-08]]
- `../data/meta-funnel-capi-test-events-payload-preview-2026-05-08.json`

요약:

- `test_event_code` present: YES
- raw value written: NO
- masked value: `TEST*****`
- payload events: 6종
- network send: 0건
- GTM edit: 0건
- Imweb edit: 0건
- platform send: 0건

## Yellow 승인 전 실행안

실제 Test Events smoke는 Meta로 이벤트를 보내므로 Green이 아니다. 진행하려면 별도 Yellow 승인 문구가 필요하다.

승인 후에만 가능한 작업:

1. GTM 새 workspace를 만든다.
2. Custom HTML tag를 테스트 전용으로 추가한다.
3. `test_event_code`를 필수로 넣는다.
4. Preview mode에서만 biocom 테스트 URL을 연다.
5. Tag Assistant에서 tag fired 여부를 확인한다.
6. Meta Events Manager Test Events 탭에서 6종 수신과 event_id를 확인한다.
7. Production publish 없이 workspace를 정리하거나 보류한다.

금지:

- Submit / Publish 클릭.
- `test_event_code` 없는 운영 funnel CAPI 호출.
- Purchase event 건드리기.
- 아임웹 header/footer 수정.
- 운영 backend deploy.

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
Project: meta-funnel-capi
Lane: Green
Mode: GTM-first read-only + no-send payload preview

No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Source / window / freshness:
- source: capivm readiness doc + GTM API read-only + local payload preview
- window: 2026-05-08 KST
- site: biocom
- confidence: 0.89

Notes:
- Test Events code raw value was not committed.
- Actual Meta Test Events smoke remains Yellow because it sends events to Meta.
- GTM Production publish remains Red.
```

## 참고

- [Google Tag Manager Preview and debug containers](https://support.google.com/tagmanager/answer/6107056?hl=en-419)
- [Google Tag Manager Custom HTML tag type](https://support.google.com/tagmanager/answer/6107167?hl=en-AU)
- [Google tag gateway for advertisers](https://developers.google.com/tag-platform/tag-manager/gateway)
