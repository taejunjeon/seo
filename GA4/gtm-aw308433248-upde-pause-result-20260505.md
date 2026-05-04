# AW-308433248 UPDE 태그 pause 실행 결과

작성 시각: 2026-05-05 01:16 KST
대상: biocom.kr GTM 컨테이너 `GTM-W2Z6PHN`
실행 승인: TJ님 `pause 진행해`
관련 문서: [[GA4/gtm]], [[GA4/gtm-container-quality-gateway-diagnosis-20260505]], [[GA4/gtm-aw308433248-upde-pause-approval-20260505]], [[docurule]]
실행 Lane: Red approved GTM Production publish

## 10초 요약

`AW-308433248`를 쓰던 legacy/non-canonical UPDE 태그 2개를 pause했다.
Default Workspace 147은 건드리지 않았다.
`Ads ID=308433248`를 `304339096`로 단순 치환하지 않았다.
`Google 태그 AW-308433248`도 추가하지 않았다.

GTM live version은 `140`에서 `141`로 변경됐다.
새 live version 이름은 `pause_aw308433248_upde_20260505`다.

## 실행 결과

- fresh workspace: `[152] codex_pause_aw308433248_upde_20260504161442`
- created version: `[141] pause_aw308433248_upde_20260505`
- live before: `[140] tiktok_marketing_intent_v1_live_20260503`
- live after: `[141] pause_aw308433248_upde_20260505`
- backup: `/Users/vibetj/coding/seo/gtmaudit/gtm-aw308433248-upde-pause-backup-20260504161442.json`
- result: `/Users/vibetj/coding/seo/gtmaudit/gtm-aw308433248-upde-pause-result-20260504161442.json`

변경된 태그:

- `[200] UPDE_register`: active -> paused
- `[204] UPDE_purchase`: active -> paused

변경하지 않은 것:

- Default Workspace 147: 저장/제출/게시/충돌해결 없음
- variable `[199] Ads ID=308433248`: 변경 없음
- `Google 태그 AW-308433248`: 추가 없음
- `[169] Google 태그 AW-304339096`: active 유지
- `[15] AW전환링커`: active 유지
- `[17] tmp_바이오컴 장바구니`: active 유지
- `[210] 구글애즈 회원가입`: active 유지
- `[248] TechSol - [GAds]NPAY구매 51163`: active 유지
- `[43]`, `[48]`, `[118]`, `[143]` 구매/NPay 관련 태그: 기존 상태 유지
- Google tag gateway: 설정 없음
- 아임웹 header/footer: 수정 없음
- GA4/Meta/TikTok/Naver 추가 전송: 없음

## 검증

GTM API read-only 재확인 결과:

- live version: `[141] pause_aw308433248_upde_20260505`
- `[200] UPDE_register`: paused
- `[204] UPDE_purchase`: paused
- `[169] Google 태그 AW-304339096`: active
- `[17] tmp_바이오컴 장바구니`: active
- `[210] 구글애즈 회원가입`: active
- `[248] TechSol - [GAds]NPAY구매 51163`: active
- `[43] GA4_구매전환_Npay`: active
- `[48] GA4_구매전환_홈피구매`: paused, 기존 상태 유지
- `[118] HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)`: active
- `[143] HURDLERS - [이벤트전송] 구매`: active

publish 전 검증:

- workspace status 변경 entity는 `[200]`, `[204]` 두 개뿐이었다.
- quick_preview compiler error 없음.
- create_version compiler error 없음.
- publish compiler error 없음.
- created version에서 guard tag `[169]`, `[17]`, `[210]`, `[248]`, `[43]`, `[48]`, `[118]`, `[143]` 요약값이 변경되지 않았다.

## 기대 효과와 한계

기대 효과:

- 운영 Google Ads 계정이 아닌 `AW-308433248`로 user-provided data 신호가 나갈 가능성을 차단했다.
- `AW-308433248` matching Google tag 누락 경고의 원인 후보를 제거했다.
- 잘못된 `308 -> 304` 치환으로 운영 전환이 중복 또는 오염되는 위험을 피했다.

한계:

- Google Tag Diagnostics 경고는 즉시 사라지지 않을 수 있다. 24시간 뒤 재확인이 필요하다.
- 이 조치는 Google tag gateway, Tag Coverage admin/404 경고, Meta CAPI, 내부 ROAS 정합성 문제를 직접 해결하지 않는다.
- `[199] Ads ID`, `[197]`, `[202]`, `[198]`, `[203]` 등은 아직 삭제하지 않았다. 삭제는 7~14일 관찰 후 cleanup 후보로 둔다.

## Rollback 기준

아래 문제가 생기면 rollback한다.

- Google Ads 운영 회원가입/장바구니/NPay 전환이 예상 밖으로 급감한다.
- Tag Assistant에서 `AW-304339096` 기본 태그가 사라진다.
- GTM live version `[141]` 이후 고객 퍼널에서 태그 오류가 확인된다.

rollback 방법:

- GTM container version `[140] tiktok_marketing_intent_v1_live_20260503`으로 되돌린다.
- 또는 fresh rollback workspace에서 `[200]`, `[204]`만 `paused=false`로 복원한 version을 publish한다.

## 다음 확인

1. Google Tag Diagnostics를 24시간 뒤 다시 확인한다.
- 성공 기준: `Missing Google tags` 경고가 줄거나, 남은 경고가 다른 원인으로 분리된다.

2. 7~14일 뒤 `[199]`, `[197]`, `[202]`, `[198]`, `[203]` cleanup 여부를 판단한다.
- 성공 기준: `[200]`, `[204]` pause 후 운영 지표 문제가 없고 참조 필요성이 없다.

3. `AW-304339096` enhanced conversion이 실제 필요한지 별도 설계로 판단한다.
- 성공 기준: 기존 tag 치환이 아니라 completion trigger, conversion label, value, transaction_id, orderId, consent 기준이 명확한 새 설계가 나온다.

## 2026-05-05 Google Ads API 모니터링 가능 여부

결론:

- Codex가 Google Ads API read-only 모니터링을 할 수 있다.
- `.env` 261행의 `API_TOKEN_BIOCOM`은 backend `env.GOOGLE_ADS_DEVELOPER_TOKEN` fallback으로 연결되어 있고, 실제 API 호출에 성공했다.
- 서비스 계정 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`도 Google Ads API `v22`에서 `customers/2149990943` 조회 권한이 있다.

실제 확인:

- endpoint: `GET /api/google-ads/status`
- 결과: `ok=true`
- apiVersion: `v22`
- customerId: `2149990943`
- customer name: `바이오컴`
- customer status: `ENABLED`

last 7 days dashboard 확인:

- endpoint: `GET /api/google-ads/dashboard?date_preset=last_7d`
- 결과: `ok=true`
- cost: `4,335,480.61`
- conversions: `621.235075`
- conversionValue: `66,464,812.82`
- allConversions: `1,556.730842`
- allConversionValue: `123,370,164.77`
- ROAS: `15.33`
- campaign rows: `5`
- daily rows: `7`
- conversion action rows: `46`
- conversion action metric rows: `16`

읽을 수 있는 것:

- 고객 계정 상태
- 캠페인별 비용, 클릭, 노출, 전환, 전환값
- 일자별 비용, 전환, 전환값
- conversion action 목록
- conversion action별 전환값 세그먼트
- 내부 attribution ledger와 Google Ads API 값을 같은 기간으로 대조한 `/api/google-ads/dashboard` 응답

현재 보이는 주요 리스크:

- last 7 days 기준 primary platform conversion value 대부분이 `구매완료` conversion action에 몰려 있다.
- 해당 action은 `send_to=AW-304339096/r0vuCKvy-8caEJixj5EB`이며, 기존 문서에서 NPay/클릭성 구매 오염 후보로 보던 label이다.
- `TechSol - NPAY구매 50739`는 secondary/all conversion value로 크게 남아 있다.
- 따라서 `[200]`, `[204]` pause와 별개로 Google Ads ROAS 정합성의 다음 핵심은 NPay/구매완료 conversion action의 실제 구매 기준성 검증이다.

제한:

- Google Ads API로 비용/전환/전환액 모니터링은 가능하다.
- Google Tag Diagnostics UI의 `Missing Google tags` 경고가 화면에서 사라졌는지까지는 현재 `/api/google-ads/*`가 직접 읽지 않는다.
- Tag Assistant runtime firing 화면도 API가 아니라 브라우저/확장 프로그램/Preview 성격이라, 필요하면 별도 UI 확인이 필요하다.

운영 판단:

- `AW-304339096` 전환 수집 급감 여부는 Codex가 `GET /api/google-ads/dashboard?date_preset=last_7d`와 일자별/전환액 세그먼트로 추적한다.
- TJ님이 직접 봐야 하는 것은 Google Ads UI 전용 경고 화면이나 Tag Assistant 캡처가 필요한 경우로 축소한다.
