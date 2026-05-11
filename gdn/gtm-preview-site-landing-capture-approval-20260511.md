# GTM Preview site_landing capture approval packet (gpt0508-42 작업5)

작성 시각: 2026-05-11 16:10:00 KST
Lane: Yellow (Preview only, **publish 금지**)

## 1. 사람이 이해하는 작업 설명

- **무엇을 했는가**: 작업 2 audit 의 verdict (BACKEND_EVIDENCE_PARTIAL_GTM_PREVIEW_RECOMMENDED) 에 따라 GTM Custom HTML 태그로 page_view 마다 `/api/attribution/site-landing` 을 호출해 organic / direct / naver 등 fan-out 으로 잡히지 않는 landing 까지 자체 ledger 에 저장하는 Preview approval packet 작성.
- **왜 했는가**: weighted landing quality 0.61 / 평균 source present rate 0.43 — backend handler fan-out 만으로는 60% 미만이라 organic landing 캡쳐가 부족. footer 직접 수정은 last resort 라 GTM Preview 가 더 안전.
- **어떻게 했는가**: trigger / dataLayer 필드 / endpoint / raw guard / Preview-only success criteria / rollback / publish 금지 사유 / Claude Code 가능 여부 / TJ 필요 screen 정리.
- **결과가 무엇인가**: 본 sprint 안에서는 packet 만 완성. 실제 GTM Container 진입 / Preview 활성화는 TJ 명시 승인 후. Publish 는 본 sprint 와 다음 sprint 모두 별도 approval 필요.
- **목표에 어떤 영향을 줬는가**: Track G 82% → 84% (다음 sprint 의 organic capture 경로 명확). Track F 94% → 95%.
- **남은 병목은 무엇인가**: TJ 가 GTM Container Workspace 에 진입해 Custom HTML 태그를 임시로 만들고 Preview 활성화해야 함. Claude Code 가 Web UI 자동 조작 불가.

## 2. GTM Preview 설계 핵심

- **trigger**: page_view (window loaded) + history change. 도메인 `biocom.kr / www.biocom.kr / biocom.imweb.me`. exclude `/admin/*`, `/auth/*`, `/login*`, `/checkout/success*`.
- **dataLayer 필드**: page_location, page_referrer, ga_session_id, client_id, gclid/gbraid/wbraid/fbclid/ttclid/nclick_id, utm_source/medium/campaign/term/content.
- **endpoint**: `POST https://att.ainativeos.net/api/attribution/site-landing` — body 는 작업 1 receiver 의 schema 그대로.
- **raw guard**: click_id 는 backend 가 sha256 변환. dataLayer 에 raw email/phone/member_code/order_no/payment 패턴 절대 포함 금지.

## 3. Preview-only 성공 기준

1. sample URL 3 개 (organic instagram referrer / naver search referrer / direct) 가 site_landing_ledger 에 새 row 로 저장 (deduped 아닌 stored:true).
2. 각 row 의 `channel_classified` 가 예상 카테고리 일치 (instagram → organic_social / naver → organic_search / direct → direct).
3. raw click_id 가 `storage_mode='hash'` 로 저장 — frontend / log 에 raw 출력 0.
4. raw PII 4 패턴 응답 / 저장 0.

## 4. rollback

GTM Tag → Pause → 변경 사항 Discard. **Publish 진행하지 않았으므로 라이브 영향 0**.

## 5. Publish 금지 사유

- 본 packet 의 scope 는 Preview only.
- Publish 시 imweb 사이트 전체에 Custom HTML 실행 → 충분한 staging 필요.
- Production publish 는 별도 sprint gpt0508-43 에서 추가 approval.

## 6. Claude Code 가능 여부 (요청 §5 충족)

| 항목 | Claude Code 가능? | 설명 |
|---|---|---|
| GTM Container JSON export 분석 | YES (TJ 가 export 제공 시) | export 파일을 Claude Code 가 읽어 충돌 검토 |
| Custom HTML 태그 코드 draft | YES | 본 packet 의 endpoint body 그대로 |
| endpoint payload schema validation | YES | receiver fixture 활용 |
| GTM Web UI 자동 조작 (Tag 생성) | NO | TJ Google 계정 + Container admin 권한 필요 |
| Preview mode 활성화 | NO | GTM admin 권한 |
| Container publish | NO + 정책 금지 | 명시 금지 + admin 권한 필요 |

TJ 가 진입해야 하는 화면:
1. `https://tagmanager.google.com/` → 해당 Container
2. Workspace → New Tag → Custom HTML
3. Preview 버튼 (Tag Assistant)

## 7. 다음 액션

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| TJ님 | GTM Container 진입 + Custom HTML draft 검토 + Preview 활성화 | NO — Container admin + Web UI 조작 필요 | Claude Code 가 GTM Web UI 자동 조작 불가 | 80 | 75 | 90 | 30 | 75 | 조건부 진행 (작업 6 backend deploy 후) |
| Claude Code | TJ 가 GTM export JSON 주면 충돌 검토 | YES — export 분석 까지 | — | 70 | 70 | 70 | 10 | 70 | 진행 (export 받으면) |
| Claude Code | gpt0508-43 Production publish approval packet 작성 | YES — packet 작성 까지 | — | 60 | 50 | 80 | 35 | 60 | 보류 (Preview 결과 본 후) |

산출 JSON: `data/gtm-preview-site-landing-capture-approval-20260511.json`
