# site_landing source evidence gap audit (gpt0508-42 작업2)

작성 시각: 2026-05-11 15:40:00 KST
verdict: **`BACKEND_EVIDENCE_PARTIAL_GTM_PREVIEW_RECOMMENDED`**

## 1. 사람이 이해하는 작업 설명

- **무엇을 했는가**: 작업 1 의 fan-out wire 가 끝난 직후 멈추지 않고, 4 handler 가 받는 evidence 의 품질과 source field 별 present rate 를 추정해 다음 sprint 가 GTM Preview 까지 가야 하는지 결정하는 audit 을 진행함.
- **왜 했는가**: fan-out wire 만으로 site_landing 이 paid traffic 만 받게 될 위험이 있어, organic / direct / referral / naver 채널 까지 자체 ledger 에 담기려면 어떤 source 가 더 필요한지 숫자로 결정해야 함.
- **어떻게 했는가**: 4 handler 의 captures 필드와 trigger scope 분석 + source field 11 종 present rate 추정 + weighted landing quality 계산 (0.61) + 4 verdict 중 분류.
- **결과가 무엇인가**: 평균 source field present rate **0.43**, weighted landing quality **0.61** — 60% 미만이라 verdict `BACKEND_EVIDENCE_PARTIAL_GTM_PREVIEW_RECOMMENDED`. 작업 5 의 GTM Preview approval packet 으로 자연스럽게 이어짐.
- **목표에 어떤 영향을 줬는가**: Track F (QA / Guard / Data Guide) 93% → 94% 추가 (audit 산출). Track G 78% 유지 (audit 자체는 신규 evidence 추가 0). 다음 sprint 의 GTM Preview 필요 여부가 숫자로 결정됨.
- **남은 병목은 무엇인가**: organic page_view 단독 landing 캡쳐는 backend handler 만으로 불가능 — GTM Preview Custom HTML 태그 또는 imweb footer page_view trigger 필요. footer 는 last resort (parked), GTM Preview 가 다음 후보.

## 2. handler 별 evidence 품질

| handler | captures (필드) | trigger scope | call 빈도 (예상) | present rate (호출 시) |
|---|---|---|---|---:|
| marketing-intent | referrer / landing / utm.* / gclid / fbclid / ttclid / gaSessionId / clientId | TikTok intent 위주 (strictTikTokReasons 가 0 이면 skipped) | 낮음 | 0.95 |
| checkout-context | referrer / landing / utm.* / click ids / gaSessionId | 체크아웃 시작 (organic+paid 둘 다) | 중간 | 0.9 |
| payment-success | referrer / landing / utm.* / click ids / gaSessionId / firstTouch enrichment | 결제 완료 (전 traffic) | 결제 건 수 | 0.95 |
| paid-click-intent | sanitized_landing_url / sanitized_referrer / utm.* / click_ids 5종 / sessionKey 3 필드 | 광고 클릭 직후 landing (gclid 있을 때만) | 광고 click 만큼 | 0.95 |

## 3. source field 별 present rate 추정

| 필드 | rate | 비고 |
|---|---:|---|
| `landing_url` | 0.95 | fan-out 가능한 endpoint 가 모두 보유 |
| `referrer` | 0.85 | direct 만 빈값 |
| `utm_source` / `utm_medium` / `utm_campaign` | 0.55 | paid 일 때만 채워짐 |
| `gclid` | 0.2 | Google 광고 클릭 시 |
| `gbraid` / `wbraid` | 0.05 / 0.03 | Google iOS/web 일부 |
| `fbclid` | 0.05 | Meta 광고 |
| **naver `nclick_id`** | **0.0** | **footer/funnel-capi v3 미캡쳐 추정 (capture gap)** |
| `client_id` | 0.7 | metadata.clientId 가 들어올 때 |
| `ga_session_id` | 0.6 | cookie 비허용 시 미수신 |
| `local_session_id_hash` | 0.5 | paid_click_intent 만 |

평균 (단순) = **0.43**.
weighted landing quality = landing×0.2 + referrer×0.2 + utm×0.3 + click_any×0.15 + session×0.15 = **0.61**.

## 4. Verdict

| 후보 verdict | 적용 여부 |
|---|---|
| EXISTING_BACKEND_EVIDENCE_SUFFICIENT | ❌ — organic landing 의 capture 가 0 |
| **BACKEND_EVIDENCE_PARTIAL_GTM_PREVIEW_RECOMMENDED** | ✅ — paid/payment/checkout 는 fan-out 충분, organic + nclick_id 는 GTM Preview 필요 |
| LANDING_SOURCE_CAPTURE_GAP_GTM_REQUIRED | △ — present rate 가 0.43 이라 GTM "권장" 수준. "필수" 라고 하기엔 fan-out 만으로도 60% 가능 |
| FOOTER_LAST_RESORT_ONLY | ❌ — GTM Preview 가 안전. footer 는 parked |

## 5. data 갭 분리 (요청 §4 충족)

| 카테고리 | 항목 |
|---|---|
| **데이터가 있는데 builder 가 못 쓰는지** | referrer host 분류 → classifier 가 이미 사용 / channel breakdown → ledger 에 저장 중 (gap 없음) |
| **데이터 자체가 안 들어오는지** | organic page_view 단독 landing / naver nclick_id / instagram organic 의 session key (cookie 제한 시) |

## 6. 금지선 준수

| invariant | 결과 |
|---|---|
| 본 audit 의 code 변경 | 0 |
| 운영DB read | 0 (audit 추정 기반) |
| external API call | 0 |
| send / upload / external | 0 |

## 7. 다음 액션

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 작업 5 GTM Preview approval packet 작성 | YES — packet 작성 까지 | — | 80 | 90 | 90 | 10 | 88 | 진행 |
| Claude Code | 작업 6 deploy approval packet 작성 | YES — packet 작성 까지 | — | 85 | 85 | 95 | 25 | 80 | 진행 |
| TJ님 | GTM Preview Container 진입 + Custom HTML 태그 임시 테스트 | NO — TJ Google 계정 GTM Container 접근 권한 필요 | Claude Code 는 GTM Web UI 자동 조작 불가. screencast 없이 publish 위험성 검토 불가 | 70 | 60 | 90 | 30 | 65 | 조건부 진행 (packet 검토 후) |
| TJ님 | backend deploy 실행 | NO — VM `34.64.104.94` taejun 계정 SSH 키 + biocomkr_sns sudo + pm2 restart 권한이 TJ 환경에만 있음 | 동일 | 90 | 80 | 95 | 25 | 80 | 조건부 진행 (작업 6 packet 검토 후) |

산출 JSON: `data/site-landing-source-evidence-gap-audit-20260511.json`
