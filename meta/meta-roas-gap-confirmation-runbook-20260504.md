# Meta ROAS Gap 컨펌·실행 런북

작성 시각: 2026-05-04 01:28 KST
문서 성격: Green Lane 승인 준비 문서
대상: biocom Meta ROAS 정합성
정본 연결: `data/!datacheckplan.md`

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
    - data/bigquery_hurdlers_cutover_20260427.md
    - meta/campaign-alias-mapping.md
    - meta/meta-marketing-intent-gtm-plan-20260504.md
  lane: Green
  allowed_actions:
    - 조사 결과 문서화
    - 승인 전 runbook 작성
    - read-only source freshness 확인
    - payload preview 설계
    - TJ 확인 항목 분리
  forbidden_actions:
    - GTM Production publish
    - GTM Preview 실행
    - 광고 소재 URL live 수정
    - Meta CAPI send
    - GA4 Measurement Protocol send
    - 운영 DB write
    - backend deploy
  source_window_freshness_confidence:
    source: "공식 Meta 문서 링크 + 로컬 코드 + source freshness read-only + 기존 campaign evidence snapshot"
    window: "2026-05-04 01:26 KST 점검 기준"
    freshness: "biocom GA4 BigQuery raw는 permission denied, 로컬 imweb/toss mirror는 stale, 운영 PG는 warn, coffee GA4 BQ는 fresh"
    confidence: 0.84
```

## 10초 요약

Meta ROAS gap을 줄이는 다음 시도는 다섯 개다.

1. 랜딩 시점 `fbclid`/UTM을 `marketing_intent`로 저장한다.
2. 캠페인 매핑은 상품군 추정이 아니라 Meta campaign/adset/ad ID로 확정한다.
3. Meta attribution window와 내부 confirmed revenue를 같은 장부처럼 섞지 않는다.
4. Advanced Matching은 이메일/전화번호 해시, `_fbc`, `_fbp`, IP, user agent, `external_id` 품질을 올리는 쪽으로 간다.
5. source freshness는 biocom BigQuery 권한과 로컬 mirror stale 문제를 분리해서 복구한다.

이 문서는 TJ님이 무엇을 컨펌해야 하고, Codex가 무엇을 대신 할 수 없는지 정리한 실행 런북이다.
이 문서 자체는 Green Lane이다.
여기 적힌 GTM Preview, Production publish, 플랫폼 전송, 광고 URL live 변경은 별도 승인 전 실행하지 않는다.

## TJ님 컨펌 1: Meta `marketing_intent` GTM Preview

무엇을 컨펌하는가:

GTM Preview 전용으로 Meta 광고 랜딩 흔적 저장 태그를 시험할지 결정한다.
이 태그는 구매 이벤트를 Meta나 GA4로 보내는 태그가 아니다.
`fbclid`, `_fbc`, `_fbp`, UTM, landing URL, referrer, GA client/session id를 TJ 관리 Attribution VM의 intent 원장에 저장하는 태그다.

왜 필요한가:

결제 완료 페이지에서만 `fbclid`와 UTM을 읽으면 PG/NPay/direct 재방문 과정에서 광고 근거가 사라진다.
랜딩 시점에 먼저 저장해야 나중에 `payment_success`와 연결할 수 있다.

Codex가 대신 가능한가:

부분 가능하다.
Codex는 GTM 태그 초안, payload preview, 저장 endpoint 확인, dry-run 문서화는 할 수 있다.
하지만 GTM Preview 브라우저 연결과 실제 운영 사이트 Preview 확인은 계정 로그인, 2FA, 실제 브라우저 쿠키가 필요해 TJ님 또는 로그인 가능한 담당자가 해야 한다.

진행 추천:

추천도 78%.
이유는 NPay/TikTok intent 방식의 선례가 있고 로컬 백엔드 매칭 로직은 준비됐지만, 운영 GTM Preview는 아직 실행 전이기 때문이다.

실행 위치:

1. Google Tag Manager
2. biocom 컨테이너 `GTM-W2Z6PHN`
3. 작업 공간은 새 Preview 전용 workspace 권장
4. 운영 사이트 `https://biocom.kr`

어떻게 하는가:

1. GTM에서 새 workspace를 만든다. 이름 예시는 `meta-marketing-intent-preview-20260504`.
2. Codex가 제공할 Custom HTML 태그 초안을 붙인다.
3. 트리거는 All Pages가 아니라 Meta 근거가 있는 경우로 제한한다.
4. Preview를 실행한다.
5. 테스트 URL 예시로 접속한다.

```text
https://biocom.kr/?fbclid=TEST_META_INTENT_20260504&utm_source=meta&utm_medium=paid_social&utm_campaign=TEST_CAMPAIGN&utm_term=TEST_ADSET&utm_content=TEST_AD
```

6. Network에서 아래 요청이 1회만 보이는지 본다.

```text
POST https://att.ainativeos.net/api/attribution/marketing-intent
```

7. direct URL도 확인한다.

```text
https://biocom.kr/
```

direct URL에서는 저장 요청이 없어야 한다.

성공 기준:

1. 테스트 URL에서는 `marketing_intent` 저장 요청이 1회만 발생한다.
2. direct URL에서는 저장 요청이 없다.
3. payload에 `fbclid`, UTM, landing URL, referrer, GA client/session id가 들어간다.
4. GA4/Meta/TikTok/Google Ads 전환 전송은 0건이다.
5. 같은 URL을 새로고침해도 dedupe 때문에 row가 과도하게 늘지 않는다.

Hard Fail:

1. direct 방문에서도 intent가 저장된다.
2. `Purchase`, `Lead`, `AddToCart` 같은 플랫폼 이벤트가 같이 발사된다.
3. payload에 이메일, 전화번호, 이름 같은 개인정보 원문이 들어간다.
4. endpoint가 5xx를 반환한다.
5. 같은 한 번의 페이지뷰에서 intent가 2건 이상 저장된다.

승인 필요 여부:

Yellow Lane 승인 필요.
승인 문구 예시는 아래다.

```text
YES: biocom GTM-W2Z6PHN에서 Meta marketing_intent Preview 전용 smoke를 승인합니다.
조건: Production publish 금지, 플랫폼 전환 전송 금지, 운영 DB write 금지, direct 저장 금지, 테스트 후 결과보고.
```

## TJ님 컨펌 2: GTM Production publish

무엇을 컨펌하는가:

Preview가 통과한 뒤, Meta `marketing_intent` 저장 태그를 live 사용자에게 배포할지 결정한다.

왜 필요한가:

Preview만으로는 실제 광고 유입에서 데이터가 쌓이지 않는다.
Production publish가 되어야 실제 Meta 광고 클릭자의 랜딩 증거가 저장된다.

Codex가 대신 가능한가:

승인 없이는 불가능하다.
Production publish는 전체 사이트 tracking에 영향을 주는 Red Lane 작업이다.
Codex가 할 수 있는 것은 publish 전 diff, 태그 목록, rollback 방법, hard fail 기준을 문서로 만드는 것까지다.

진행 추천:

지금 즉시 추천도 45%.
Preview 성공 후 추천도 68%.
이유는 live publish는 안전장치가 있어도 운영 전체 tracking에 영향을 주기 때문이다.

성공 기준:

1. live publish 후 24시간 동안 intent row가 Meta 근거 있는 랜딩에서만 쌓인다.
2. direct/general traffic 저장률은 0에 가깝다.
3. platform conversion send는 0건이다.
4. `/ads`에서 Meta first-touch 후보가 read-only로 집계된다.

승인 필요 여부:

Red Lane 명시 승인 필요.
다른 에이전트 검증 권장.

## TJ님 컨펌 3: 광고 URL 파라미터 표준화

무엇을 컨펌하는가:

신규 Meta 광고 또는 수정 가능한 광고에 표준 URL 파라미터를 붙일지 결정한다.

권장 템플릿:

```text
utm_source=meta
utm_medium=paid_social
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
campaign_alias=meta_biocom_소재또는랜딩명
meta_campaign_id={{campaign.id}}
meta_adset_id={{adset.id}}
meta_ad_id={{ad.id}}
```

왜 필요한가:

현재 내부 원장에는 사람이 만든 `utm_campaign` alias가 남고, Meta 광고비 표에는 campaign ID가 남는다.
둘을 나중에 붙이면 stale audit, 수동 추정, 상품군 오분류가 생긴다.
광고 URL에 처음부터 ID를 남기면 campaign mapping은 대부분 자동 확정된다.

Codex가 대신 가능한가:

부분 가능하다.
Codex는 현재 광고별 누락 여부 CSV, URL 파라미터 템플릿, 변경 대상 후보표를 만들 수 있다.
하지만 live 광고 URL 수정은 Meta Ads Manager 계정 로그인/2FA가 필요하고, 광고 운영에 영향을 줄 수 있어 승인 없이 대신 실행하지 않는다.

진행 추천:

신규 광고부터 적용 추천도 92%.
기존 live 광고 일괄 수정 추천도 52%.
기존 광고 수정은 학습/검수/URL 오류 리스크가 있어, 새 광고·복제 광고부터 적용하는 쪽이 안전하다.

실행 위치:

1. Meta Ads Manager
2. 광고 편집 화면
3. Tracking 또는 URL Parameters 영역

성공 기준:

1. 새 유입 주문의 landing URL 또는 ledger metadata에 `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`가 남는다.
2. `/ads/campaign-mapping`에서 unmapped confirmed revenue가 줄어든다.
3. 상품군 분류와 campaign attribution이 분리되어 보인다.

실패 시 해석:

1. 주문에 ID가 안 남으면 URL 파라미터가 랜딩 전에 제거됐거나 GTM/아임웹 저장 로직이 놓친 것이다.
2. 모든 주문이 같은 ID로 남으면 Meta macro가 치환되지 않은 것이다.
3. 내부 링크에서 UTM이 덮이면 내부 링크 UTM 금지 규칙을 다시 봐야 한다.

승인 필요 여부:

신규 광고 운영 규칙 채택은 TJ/마케팅팀 컨펌 필요.
기존 live 광고 URL 수정은 플랫폼 운영 변경이므로 별도 승인 필요.

## TJ님 컨펌 4: Advanced Matching 개인정보·동의 범위

무엇을 컨펌하는가:

Meta CAPI user_data에 어떤 식별자를 보낼 수 있는지 결정한다.

현재 코드가 지원하는 값:

1. `em`: 이메일 SHA-256 해시
2. `ph`: 전화번호 SHA-256 해시
3. `fbc`: Meta click id 기반 브라우저/클릭 식별자
4. `fbp`: Meta browser id
5. `client_ip_address`
6. `client_user_agent`

추가 후보:

1. `external_id`: 내부 고객키 또는 주문자 전화번호 해시 기반 stable id
2. `fn`, `ln`, `ct`, `st`, `zp`, `country`: 주소/이름 계열. 현재는 건강 관련 상품군이라 추천하지 않는다.

왜 필요한가:

Meta는 CAPI 이벤트를 사용자와 매칭해야 광고 최적화와 attribution에 쓸 수 있다.
브라우저 쿠키만으로는 크로스디바이스, 쿠키 차단, PG/NPay 이동을 완전히 복구하지 못한다.
해시 이메일/전화번호, `_fbc`, `_fbp`, IP, user agent가 많을수록 Event Match Quality가 좋아질 가능성이 있다.

Codex가 대신 가능한가:

기술 audit은 가능하다.
Codex는 confirmed 주문 중 이메일/전화번호/fbc/fbp/IP/UA coverage를 read-only로 계산할 수 있다.
하지만 개인정보·민감정보·동의 범위 판단은 TJ님 또는 법무/개인정보 책임자가 해야 한다.
Codex가 임의로 user_data 범위를 넓혀 운영 전송하면 안 된다.

진행 추천:

coverage audit 추천도 92%.
`external_id` 후보 설계 추천도 86%.
동의 범위 확인 전 운영 payload 확장 추천도 48%.

TJ님 확인 문항:

1. 아임웹 주문자 이메일/전화번호를 Meta CAPI에 해시 전송하는 것이 현재 개인정보처리방침과 광고/마케팅 동의 범위에 포함되는가?
2. 바이오컴 상품군이 건강 관련 상품이므로 Meta의 민감 카테고리 제한이나 내부 정책상 더 보수적으로 봐야 하는가?
3. `external_id`로 회원번호 해시를 쓸지, 전화번호 해시를 쓸지, 쓰지 않을지 결정할 수 있는가?
4. Events Manager에서 Event Match Quality와 Advanced Matching Parameters 화면을 캡처해 줄 수 있는가?

성공 기준:

1. 운영 payload preview에서 개인정보 원문은 없다.
2. 이메일/전화번호는 정규화 후 SHA-256 해시만 남는다.
3. `external_id` 후보는 동일 고객이면 안정적이고, 다른 고객이면 충돌하지 않는다.
4. Events Manager에서 Event Match Quality가 유지 또는 개선된다.

승인 필요 여부:

coverage audit은 Green.
운영 CAPI payload 확장은 Red 또는 최소 Yellow 이상.
개인정보·동의 컨펌 없이는 진행 금지.

## TJ님 컨펌 5: biocom GA4 BigQuery raw 접근권

무엇을 컨펌하는가:

허들러스 `hurdlers-naver-pay.analytics_304759974` dataset에 우리 서비스 계정 read 권한을 받을지 결정한다.

왜 필요한가:

GA4 Data API는 요약값 확인에는 쓸 수 있지만, `(not set)`, NPay return, 중복 purchase, event_params 품질을 주문 단위로 깊게 분해하려면 BigQuery raw가 필요하다.
현재 source freshness에서는 biocom GA4 BigQuery가 `bigquery.datasets.get denied`로 막혀 있다.

Codex가 대신 가능한가:

권한 부여 자체는 불가능하다.
허들러스 GCP 프로젝트와 GA4 Admin 권한은 TJ님/허들러스가 갖고 있다.
Codex는 권한이 들어온 직후 read-only freshness와 sanity query를 실행할 수 있다.

진행 추천:

추천도 94%.
이건 운영 데이터 write도 아니고, ROAS 정합성 분석의 병목을 직접 푸는 read-only 권한이다.

허들러스 요청문:

```text
안녕하세요. biocom GA4 BigQuery export 조회 권한 요청드립니다.

현재 biocom GA4 property 304759974의 BigQuery export가 `hurdlers-naver-pay.analytics_304759974`에 연결된 것을 확인했습니다.
ROAS 정합성 분석과 GA4 purchase 품질 점검을 위해 read-only 조회 권한만 필요합니다.

아래 계정에 권한 부여 가능할지 확인 부탁드립니다.

계정: seo-656@seo-aeo-487113.iam.gserviceaccount.com
필요 권한:
- BigQuery Data Viewer on `hurdlers-naver-pay.analytics_304759974`
- BigQuery Job User on query 실행 project 또는 필요한 범위

확인 부탁드릴 항목:
1. dataset 존재 여부
2. dataset location
3. latest `events_YYYYMMDD` table명
4. 2026-04-01 이후 table 보존 가능 여부
5. 기존 GA4 BigQuery link 유지 가능 기한

요청 범위는 write/import가 아니라 read-only 분석입니다.
기존 link 삭제나 새 link 재연결은 별도 승인 전 진행하지 않겠습니다.
```

권한 반영 후 Codex 실행:

```bash
cd /Users/vibetj/coding/seo/backend
npm exec tsx scripts/check-source-freshness.ts -- --json
```

성공 기준:

1. `ga4_bigquery_biocom` status가 `error`에서 `fresh` 또는 `warn`으로 바뀐다.
2. latest table이 `events_YYYYMMDD`로 보인다.
3. row count, purchase count, distinct transaction_id가 출력된다.

실패 시 해석:

1. 여전히 permission denied면 service account 또는 dataset 권한이 부족하다.
2. dataset not found면 project/dataset ID가 다르거나 link가 이미 해제됐을 수 있다.
3. latest table이 오래됐으면 GA4 export 자체가 지연 또는 중단된 것이다.

승인 필요 여부:

허들러스/GCP 권한 요청은 TJ님 외부 커뮤니케이션 필요.
Codex read-only 재검증은 Green.

## TJ님 컨펌 6: Meta Events Manager 확인

무엇을 컨펌하는가:

Events Manager에서 Purchase CAPI, 중간 퍼널 이벤트, Event Match Quality, Advanced Matching Parameters를 확인할지 결정한다.

왜 필요한가:

서버 로그와 로컬 테스트는 "우리가 보냈다/보낼 수 있다"를 보여준다.
Events Manager는 "Meta가 어떻게 받았고, 중복 제거와 매칭 품질을 어떻게 판단했는지"를 보여준다.

Codex가 대신 가능한가:

대부분 불가능하다.
Meta Business 계정 로그인, 2FA, Events Manager UI 접근이 필요하다.
Codex는 확인해야 할 화면과 캡처 기준을 줄 수 있고, TJ님이 캡처나 수치를 주면 해석할 수 있다.

확인 위치:

1. Meta Events Manager
2. Dataset 또는 Pixel ID `1283400029487161`
3. Overview
4. Test Events
5. Diagnostics
6. Event Match Quality

확인할 문구:

1. Purchase 이벤트가 Browser/Server로 모두 보이는지
2. 중복 제거가 잘 되고 있는지
3. Advanced Matching Parameters Sent에 `em`, `ph`, `fbc`, `fbp`, `client_ip_address`, `client_user_agent`가 보이는지
4. Event Match Quality가 낮은 이유가 표시되는지
5. Refund 또는 Purchase negative adjustment가 수신되는지

진행 추천:

추천도 80%.
운영 플랫폼 UI 증빙이므로 다른 에이전트 검증은 필수는 아니지만, Red 작업 전에는 권장한다.

## Codex가 지금 대신 수행 불가능한 것

1. GTM Preview 브라우저 연결: 계정 로그인, 2FA, 실제 브라우저 쿠키가 필요하다.
2. GTM Production publish: Red Lane이며 명시 승인 전 금지다.
3. Meta Ads Manager live 광고 URL 수정: 플랫폼 운영 변경이고 광고 학습/검수/URL 오류 리스크가 있다.
4. Meta Events Manager UI 확인: 로그인/2FA와 계정 권한이 필요하다.
5. 허들러스 GCP 권한 부여: 외부 프로젝트 관리자 권한이 필요하다.
6. 개인정보·동의 범위 판단: 기술 결정이 아니라 정책/법무 판단이다.
7. Meta CAPI/GA4 MP 운영 전송: 플랫폼 전환값을 바꾸는 Red Lane 작업이다.

## Codex가 지금 Green에서 계속 할 수 있는 것

1. `/ads`에 Meta first-touch 후보 read-only 집계 카드 설계.
2. Advanced Matching `user_data` coverage audit.
3. campaign mapping 최신 evidence 재생성 dry-run.
4. source freshness 결과를 화면/문서에 더 명확히 표시.
5. GTM Preview용 Custom HTML 초안과 payload preview 작성.
6. 권한 반영 후 biocom BigQuery read-only sanity query 실행.

## 권장 순서

1. biocom GA4 BigQuery read 권한 요청을 먼저 보낸다. 추천도 94%.
2. Codex가 `user_data` coverage audit과 `/ads` Meta first-touch 카드 설계를 진행한다. 추천도 90%.
3. Meta `marketing_intent` GTM Preview를 승인한다. 추천도 78%.
4. Preview 통과 후 Production publish 승인 문서를 별도로 만든다. 현재 추천도 45%, Preview 후 68%.
5. 신규 광고부터 URL 파라미터 표준을 적용한다. 추천도 92%.
6. 기존 live 광고 URL 일괄 수정은 보류하고, 변경 필요 광고만 별도 검토한다. 추천도 52%.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

Project: biocom Meta ROAS 정합성
Phase: gap closure planning
Lane: Green
Mode: no-send / no-write / no-deploy / no-publish

No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:

1. 이 문서는 승인 전 runbook이다.
2. 문서 작성과 read-only 점검만 수행했다.
3. GTM, Meta, GA4, 운영 DB에는 아무 변경도 하지 않았다.
