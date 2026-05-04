# Meta Marketing Intent GTM 보강 계획

작성 시각: 2026-05-04 00:34 KST
문서 성격: Green Lane 설계/검증 메모
대상: 바이오컴 Meta ROAS 정합성

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docs/report/text-report-template.md
    - docurule.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
  required_context_docs:
    - data/!datacheckplan.md
    - data/biocom-live-tracking-inventory-20260501.md
    - naver/!npayroas.md
    - naver/npay-7d-rerun-checklist-20260504.md
    - tiktok/!tiktokroasplan.md
  lane: Green
  allowed_actions:
    - 로컬 코드 보강
    - 로컬 테스트
    - read-only VM/운영DB 조회
    - dry-run
    - 설계/결과 문서 작성
  forbidden_actions:
    - GTM Production publish
    - permanent env flag ON
    - platform conversion send
    - production DB write
    - backend deploy
    - Imweb header/footer 수정
  source_window_freshness_confidence:
    source: "TJ 관리 Attribution VM SQLite npay_intent_log + operational_postgres.public.tb_iamweb_users + 로컬 backend tests"
    window: "NPay dry-run 2026-04-27T09:10:00Z ~ 2026-05-04T09:10:00Z, 현재 partial"
    freshness: "npay_intent_log max captured_at=2026-05-03T15:14:21.994Z, 운영DB max paid_at=2026-05-03T15:00:04Z"
    confidence: 0.86
```

## 10초 요약

Meta의 `fbclid`/UTM 유실은 결제 완료 시점에만 고치면 늦다.
랜딩 시점에 Meta 광고 흔적을 `marketing_intent`로 먼저 저장하고, 나중에 `payment_success`와 연결해야 한다.

이번 Green Lane에서 로컬 백엔드는 Meta 흔적이 있는 `marketing_intent`를 first-touch 후보로 인정하도록 보강했다.
아직 GTM publish, 운영 배포, Meta CAPI 전송은 하지 않았다.

## 현재 결론

Meta용 GTM `marketing_intent`는 진행할 가치가 있다.

이유는 세 가지다.

1. TikTok에서 같은 패턴이 이미 작동했다. `ttclid`/UTM이 있는 랜딩을 GTM으로 VM 원장에 남기고, 이후 결제와 연결했다.
2. NPay intent log도 `fbclid`, `_fbc`, `_fbp`, UTM, GA client/session id를 담는 구조라 Meta 분석에 필요한 필드 형태가 맞다.
3. 로컬 백엔드는 이제 Meta `fbclid`, `_fbc`, `_fbp`, Facebook/Instagram UTM/referrer를 first-touch 후보 근거로 인식한다.

Codex 추천도는 88%다.
단, 추천 범위는 "설계와 Preview 준비"까지다.
GTM Production publish와 Meta CAPI 전송은 별도 승인 전 금지다.

## 이번에 코드로 닫은 것

`backend/src/attribution.ts`에 Meta match reason을 추가했다.

인정하는 근거는 아래다.

1. URL 또는 payload의 `fbclid`
2. metadata의 `fbclid`, `_fbc`, `_fbp`
3. landing/referrer의 `facebook.com`, `instagram.com`
4. `utm_source=meta`, `utm_source=facebook`, `utm_source=instagram`
5. UTM campaign/medium/content/term의 `meta`, `facebook`, `instagram`, `fb`, `ig` 토큰

결과적으로 `payment_success` 자체에는 `fbclid`가 없어도, 같은 client/session의 이전 `marketing_intent`에 Meta 근거가 있으면 `metadata.firstTouch`에 남는다.
이 값은 내부 ROAS gap 분석의 보조 근거로 쓸 수 있다.

## 아직 하지 않은 것

1. GTM workspace 생성 또는 publish는 하지 않았다.
2. Imweb header/footer 코드는 수정하지 않았다.
3. Meta CAPI Purchase, funnel event, Advanced Matching 전송은 하지 않았다.
4. 운영 VM backend 배포는 하지 않았다.
5. 운영 DB write는 하지 않았다.

## GTM 설계안

Meta용 태그는 "구매 전송" 태그가 아니다.
랜딩 시점의 광고 흔적 저장 태그다.

발화 조건:

1. 현재 URL에 `fbclid`가 있다.
2. `_fbc` 또는 `_fbp` 쿠키가 있다.
3. UTM source가 `meta`, `facebook`, `instagram`, `fb`, `ig` 중 하나다.
4. referrer가 Facebook 또는 Instagram이다.

저장 필드:

1. `touchpoint=marketing_intent`
2. `source=biocom_imweb`
3. `intentChannel=meta`
4. `fbclid`, `_fbc`, `_fbp`
5. `utm_source`, `utm_medium`, `utm_campaign`, `utm_id`, `utm_term`, `utm_content`
6. landing URL, referrer
7. GA client id, GA session id, GA session number
8. `captured_at`, browser timezone

중복 방지:

1. 같은 browser에서 같은 `fbclid`/landing 조합은 24시간 dedupe한다.
2. direct 방문에는 저장하지 않는다.
3. 내부 링크 UTM은 first-touch를 덮어쓰지 않는다.

## 운영 판단 기준

이 작업은 Meta ROAS 숫자를 억지로 Meta Ads Manager와 같게 만드는 일이 아니다.
목적은 "내부 원장에서 Meta 광고 흔적이 사라진 주문"을 줄이는 것이다.

성공 기준:

1. direct 재방문 구매 중 Meta first-touch 후보가 늘어난다.
2. `/ads`에서 `Attribution confirmed`와 Meta `1d_click`의 설명 불가능한 gap이 줄어든다.
3. Meta first-touch 후보에는 `fbclid`/`_fbc`/`_fbp` 같은 근거가 함께 보인다.
4. 구매 이벤트 중복이나 플랫폼 전송은 0건이다.

실패 기준:

1. direct 방문까지 무차별 저장된다.
2. 내부 UTM이 first-touch를 덮어쓴다.
3. 같은 랜딩에서 중복 row가 과도하게 늘어난다.
4. GTM 태그가 GA4/Meta/TikTok/Google Ads 전송을 같이 수행한다.

## 다음 액션

1. Codex가 로컬 API/화면에서 `metaFirstTouchCandidate`를 집계하는 read-only 카드 설계를 만든다.
   추천도 86%.
   승인 필요 없음.

2. TJ님과 Codex가 GTM Preview 전용 workspace 승인안을 별도 문서로 만든다.
   추천도 78%.
   Preview는 Yellow Lane이고, Production publish는 Red Lane이다.

3. Preview가 통과하면 Production publish 승인 문서를 따로 만든다.
   추천도 62%.
   운영 전체 tracking에 영향이 있으므로 다른 에이전트 검증 권장.
