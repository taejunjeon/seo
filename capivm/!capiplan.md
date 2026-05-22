# Meta Funnel CAPI Plan

작성 시각: 2026-05-21 17:37 KST
기준일: 2026-05-21
문서 성격: Meta CAPI / Browser Pixel / 전환 퍼널 복구와 운영 판단 정본
정본 운영: TJ님이 볼 문서는 이 문서 하나다. 다른 문서는 근거 보관용이며, 주요 판단과 다음 액션은 이 문서 최상단에 모은다.
보조 근거: [[capivm/capi]], [[capivm/capi4reply]], [[data/!channelfunnel]], [[project/roas]], [[docurule]]
Lane: Green documentation / local guard test / deploy approval packet
Mode: No-send / No-write / No-deploy / No-platform-send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - capivm/!capiplan.md
    - data/!channelfunnel.md
    - data/!data_inventory.md
  lane: Green documentation update + local backend guard test
  allowed_actions:
    - 기존 정본 문서 업데이트
    - read-only 근거 정리
    - 로컬 backend guard 코드 보강
    - 로컬 typecheck/test
    - approval packet 작성
    - wiki link validation
  forbidden_actions:
    - Meta CAPI 운영 Purchase 추가 전송
    - GA4 Measurement Protocol purchase 전송
    - Google Ads conversion upload
    - TikTok/Naver send/upload
    - GTM Production publish
    - Imweb header/footer 저장
    - VM Cloud backend deploy/restart
    - 운영DB write/import
    - raw order/payment/click/member/email/phone 출력
  source_window_freshness_confidence:
    source: "VM Cloud attribution ledger + Meta CAPI send log + funnel-health/roas-summary live contract + local/backend metaCapi guard test + Meta UI 캡처/사용자 관측 + biocom identity/email canary deploy reports + Google Ads final URL/landing route read-only audit + capivm/!capiplan.md + capivm/meta-utm-source-bucket-audit-20260519.md + project/!indicatoragent.md + total/!total-current.md"
    window: "2026-05-14 ~ 2026-05-21 KST incident/recovery window, 최근 7일 ROAS/퍼널/선행지표 문서 기준"
    freshness: "문서 정리 시각 2026-05-21 17:37 KST. 2026-05-21 업데이트는 biocom confirmed Purchase 한정 ph/external_id/email canary 배포 후 24시간 집계 전 상태를 반영한다. live 숫자는 API 재조회 시 달라질 수 있다."
    confidence: 0.9
```

## OKR과 KR 진척률

### Objective

Meta 구매 신호와 중간 전환 신호를 **실제 결제완료 기준과 구분해 안전하게 복구**하고, 대표가 `/conversion-funnel` 화면에서 예산 판단에 쓸 수 있는 상태로 만든다.

쉽게 말하면:

> 실제 결제완료 주문은 Meta Purchase CAPI와 내부 ROAS 화면에 빠짐없이 잡고, 장바구니/결제 시작/회원가입/스크롤 같은 구매 전 행동은 별도 중간 전환 신호로 보내 Meta 학습 신호를 풍부하게 만든다.

### Key Results

| KR  | 연결 Phase/Sprint                          | 무엇을 달성해야 하는가                                       | 현재 진척률 | 현재 판단                                                                                                    | KR을 올리기 위한 액션플랜                                                                                                               | 100% 조건                                                                                                      |
| --- | ---------------------------------------- | -------------------------------------------------- | -----: | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| KR1 | [[#Phase1-Sprint1]]                      | 실제 결제완료만 Meta Purchase 후보로 남긴다                     |    96% | 로컬 guard/test 기준으로 `payment_page_seen`, pending/unknown, 0원/음수, 취소/환불, value mismatch가 no-send로 닫혔다      | VM Cloud에 `metaCapi` guard 보강을 배포한 뒤 live 후보 dry-run과 action queue 사유명을 재확인한다                                                 | 결제완료 + value guard + duplicate 0 row만 Purchase 후보, 나머지 후보 0                                                  |
| KR2 | [[#Phase1-Sprint2]]                      | 결제완료인데 Meta CAPI 성공 기록이 없는 row를 매일 볼 수 있게 한다       |    96% | VM Cloud cron이 매일 10시 KST confirmed-but-no-CAPI를 감시하고, 30분 grace 이후 Critical만 Slack으로 알린다. 같은 알림에 전날 내부 귀속 ROAS와 Meta Ads Manager ROAS도 포함한다 | 첫 VM 자동 실행 로그를 확인하고, 새 누락 row가 나오면 legacy backlog가 아니라 current sync issue로 사유 분류한다                               | current window 누락 row가 매일 사유별로 닫히고, legacy backlog는 `do_not_backfill`로 보존됨                                   |
| KR3 | [[#Phase2-Sprint4]]                      | Browser Pixel 중간 퍼널 신호를 복구한다                       |    90% | AddToCart / InitiateCheckout / AddPaymentInfo는 Block 4 fallback으로 복구됐고, VM Cloud live도 `/shop_cart` 장바구니 페이지 진입 28건을 반환한다 | `ViewContent`가 장바구니로 오해되지 않게 로컬 fallback guard를 VM Cloud 반영 후보로 두고, 화면 설명을 더 쉽게 맞춘다                                         | 유입 -> 장바구니 -> 결제 시작 -> 결제수단 선택 -> 실제 결제완료가 화면에서 0 없이 설명됨                                                     |
| KR4 | [[#Phase2-Sprint3]]                      | Browser Purchase는 보조 검증으로 안정화한다                    |    66% | Server CAPI가 주 경로라 즉시 장애는 아니지만, Meta UI dedup 확인에는 여전히 필요하다. 2026-05-17 기준 read-only monitor/runbook은 준비됐다        | Header Guard v3.1.1 cache, payment-decision latency, 다음 실제 결제 관찰을 묶어 매일/실제 결제 직후 구분해 확인한다                                | 실제 결제완료에서 Browser Purchase가 보이거나, 안 보여도 CAPI 성공으로 운영 누락 없음이 분리됨                                              |
| KR5 | [[#Phase2-Sprint6]]                      | `/conversion-funnel`과 ROAS 화면의 데이터 기준을 신뢰 가능하게 만든다 |    80% | site/pixel filter와 precompute/cache가 들어갔고, 기본 화면은 사전 계산값 중심으로 전환 중이다                                     | 기본은 어제 사전 계산값, 당일은 4시간 단위 cache, 강제 새로고침은 제한 버튼으로 분리한다                                                                        | 화면이 500ms 안팎으로 열리고, 각 지표에 source/unit/window/site/pixel_id/freshness가 표시됨                                    |
| KR6 | [[#Phase3-Sprint5]]                      | Meta Events Manager와 Ads Manager 표시 차이를 분리한다       |    45% | VM Cloud CAPI는 성공하지만 Meta UI/Ads attribution은 지연, 제한, action key mismatch 가능성이 남았다                       | Pixel UI에서 recent activity, Event Match Quality, data source restriction, purchase-family action key를 같은 순서로 확인한다             | CAPI 성공, Meta UI 수신, Ads Manager attribution 0의 원인이 lag/restriction/mismatch 중 하나로 닫힘                        |
| KR7 | [[#Phase3-Sprint6]], [[#Phase4-Sprint7]] | 외부 전송 준비와 실제 전송 실행을 분리한다                           |    78% | biocom confirmed Purchase 한정 ph/external_id/email canary가 켜졌고, 24시간 집계로 유지/중단 조건을 닫는 단계다             | 24시간 canary aggregate에서 success, duplicate 0, em/ph/external_id/fbc/fbp 비율, Meta UI 점수 변화를 확인한다. 더클린커피/Browser Purchase/event_id hash는 아직 확장하지 않는다 | Red 승인 전 수동 backfill/대량 send 0, canary 유지/중단 기준이 숫자로 닫히고, 문제 없으면 biocom 범위에서 유지됨                         |
| KR8 | [[#Phase2-Sprint5]]                      | Purchase 외 중간 전환 신호를 Meta CAPI로 안전하게 확장한다          |    52% | no-send payload preview가 준비됐고 AddPaymentInfo source gap이 `VM Cloud 저장 경로 없음`으로 닫혔다. CompleteRegistration/Scroll50은 GTM source와 route 설계까지 정리됐다 | VM Cloud no-send intermediate-event endpoint를 먼저 만들고, GTM은 이 endpoint만 호출하게 한 뒤 Test Events 1건 이하 smoke 승인안으로 넘어간다                                  | 중간 이벤트가 Meta Events Manager에 server source로 보이고, Purchase/ROAS 오염 0, CPA/Ads attributed ROAS 개선 여부를 비교할 수 있음 |

### KR 우선순위

1. **P0: KR1 + KR2**
   - 이유: 실제 결제완료가 Meta로 안 가거나, 보내면 안 되는 row가 가는 문제는 바로 ROAS와 입찰 학습을 오염시킨다.
   - 이번 주 성공 기준: Critical queue row가 모두 사유별로 닫힌다.

2. **P1: KR3 + KR5 + KR8**
   - 이유: 화면이 느리거나 단계가 0이면 운영자가 퍼널을 신뢰하지 못하고, 구매 전 신호가 Meta에 충분히 전달되지 않으면 학습 신호가 Purchase 한 지점에만 몰린다.
   - 이번 주 성공 기준: `/conversion-funnel`이 기본 사전 계산값으로 빠르게 열리고, 장바구니/결제 시작/결제수단 선택/회원가입/50% 스크롤을 Meta CAPI 후보로 분리한다.

3. **P2: KR4 + KR6 + KR7**
   - 이유: Browser Purchase와 Meta UI 검증은 중요하지만, Server CAPI가 살아 있는 동안 즉시 매출 누락보다 보조 검증 성격이 강하다.
   - 이번 주 성공 기준: Meta UI 확인 체크리스트와 Test Events smoke 승인안이 한 문서 안에서 닫힌다.

## 2026-05-21 우선순위 업데이트 — confirmed Purchase 누락 큐 일일 감시

### 결론

`실제 결제완료인데 Meta CAPI 성공 기록이 없는 주문`을 매일 확인하는 monitor를 VM Cloud cron으로 고정했다.

쉽게 말하면:

> 매일 아침 “구매는 됐는데 Meta에 안 알려진 주문이 있는지”를 자동으로 확인하고, 문제가 있을 때만 Slack으로 알려준다. 같은 메시지에 전날 Meta ROAS도 같이 붙여 “신호 누락”과 “광고 성과”를 한 번에 본다.

### 오늘 실행 결과

2026-05-21 22:05 KST 로컬 read-only 실행 기준:

- confirmed-but-no-CAPI: 0건 / 0원
- 최근 1일 CAPI success: 46건
- 최근 1일 CAPI failure: 0건
- duplicate event_id: 0
- Slack 알림: webhook 미설정 + 정상 상태라 skip

2026-05-21 22:26 KST Slack webhook 연결 테스트 기준:

- Slack webhook test: PASS, Slack HTTP 200
- confirmed-but-no-CAPI: 1건 / 245,000원
- 최근 1일 CAPI success: 46건
- 최근 1일 CAPI failure: 0건
- duplicate event_id: 0
- Slack 알림: critical 1건 발송
- 외부 플랫폼 전송: 0
- 운영DB write: 0
- GTM publish: 0

2026-05-21 22:37 KST live action queue read-only 재확인:

- confirmed-but-no-CAPI: 1건
- 최신 후보 safe_ref: `safe_214facdeea`
- amount bucket: 234,000원
- missing_policy: `current_missing_watch`
- source bucket: Meta evidence 있음
- 해석: 자동 backfill 대상이 아니라, 먼저 CAPI sync 사유를 분류해야 하는 현재 window 후보다.

2026-05-21 22:45 KST grace rule 적용 후 alert-only 재실행:

- confirmed-but-no-CAPI: 1건 / 234,000원
- 가장 오래된 후보 age: 9.5분
- grace: 30분
- severity: ok
- Slack 발송: skip
- 해석: CAPI sync가 따라올 수 있는 정상 대기 구간이므로, 30분 이상 남을 때만 Critical로 보낸다.

2026-05-21 23:06 KST VM Cloud smoke 실행:

- confirmed-but-no-CAPI: 0건 / 0원
- 최근 1일 CAPI success: 48건
- 최근 1일 CAPI failure: 0건
- duplicate event_id: 0
- severity: ok
- Slack 발송: skip (`alert_only` + 정상 상태)
- 어제 내부 귀속 ROAS: 1.64x
- 어제 Meta Ads Manager ROAS: 1.46x
- 어제 광고비: 3,613,405원
- 어제 내부 귀속 매출: 5,914,374원 / 18건
- 어제 Meta Ads Manager 구매 매출: 5,275,454원
- 해석: VM Cloud에서 누락 큐와 전날 ROAS를 동시에 읽을 수 있다.

근거:

- 실행 스크립트: `/Users/vibetj/coding/seo/scripts/meta-capi-daily-missing-queue-monitor.sh`
- VM Cloud 스크립트: `/home/biocomkr_sns/seo/repo/scripts/meta-capi-daily-missing-queue-monitor.sh`
- 결과 파일: `/Users/vibetj/coding/seo/data/project/meta-capi-daily-missing-queue-monitor-daily-20260521-220504.json`
- Slack 연결 테스트 결과 파일: `/Users/vibetj/coding/seo/data/project/meta-capi-daily-missing-queue-monitor-daily-20260521-222618.json`
- VM Cloud smoke 결과 파일: `/home/biocomkr_sns/seo/repo/data/project/monitoring/meta-capi-daily-missing-queue-monitor-vm-cron-smoke-20260521230627.json`
- runbook: [[capivm/meta-capi-daily-missing-queue-monitor-runbook-20260521]]

### 운영 기준

2026-05-22 12:48 KST 기준 운영 알림 모드는 `always`다.

- 누락 0건이어도 매일 오전 10:00 KST에 정상 OK 보고와 전날 Meta ROAS를 Slack으로 보낸다.
- confirmed-but-no-CAPI > 0이어도 결제완료 직후 30분 grace 안이면 Slack을 보내지 않는다.
- confirmed-but-no-CAPI > 0이고 가장 오래된 후보가 30분 이상 지나면 Critical로 Slack을 보낸다.
- CAPI failure > 0 또는 duplicate > 0이면 Slack을 보낸다.
- Slack 소음이 커지면 `META_CAPI_DAILY_MONITOR_NOTIFY_MODE=alert_only`로 되돌릴 수 있다.
- 전날 ROAS는 `roas-summary` precompute cache를 읽고, 내부 귀속 ROAS와 Meta Ads Manager ROAS를 분리해 표시한다.

### 다음 액션

1. VM Cloud `biocomkr_sns` crontab에 매일 오전 10시 KST 실행을 등록했다.
2. webhook URL은 Git에 저장하지 않고 VM Cloud `/home/biocomkr_sns/seo/repo/.local/meta-capi-daily-monitor.env`에만 보관한다.
3. 로컬 Mac crontab은 중복 알림 방지를 위해 제거했다.
4. 2026-05-22 오전 10시 첫 자동 실행 로그를 확인한다.
5. confirmed-but-no-CAPI가 새로 생기면 자동 backfill하지 않고 사유 분류부터 한다.

## 2026-05-21 우선순위 업데이트 — 이벤트 매칭 품질은 canary 관찰 단계

### 결론

Meta Purchase 신호는 회복됐고, 다음 병목은 **이벤트 매칭 품질**이다.

쉽게 말하면:

> 이제 Meta가 “구매가 있었다”는 사실은 받고 있다. 다음은 “그 구매가 어떤 사람과 어떤 광고 클릭에서 왔는지” 더 잘 알아보게 하는 단계다.

### 지금 켜진 것

현재 켜진 범위는 좁다.

- site: biocom
- event: confirmed Purchase CAPI
- user_data canary:
  - 전화번호 해시(`ph`)
  - 안전한 외부 ID(`external_id`)
  - 회원 이메일 해시(`em`)
- 제외:
  - 더클린커피
  - Browser Purchase
  - event_id hash
  - 수동 backfill
  - payment_page_seen, pending, unknown, canceled/refunded row

배포 전 Meta Events Manager 기준선은 6.0/10이고, 이후 사용자 캡처에서는 6.3/10이 관측됐다. 단, 이 점수 변화가 canary 때문이라고 확정하려면 24시간 canary 집계가 필요하다.

### 현재 관측값

초기 post-check 기준:

- ph/external_id canary:
  - biocom presence row 8건, success 8건
  - `ph=true` 2건
  - `external_id=true` 2건
  - 더클린커피 3건은 0/0으로 막힘
- email canary:
  - 최근 7일 biocom 475건 중 이메일 후보 140건, 후보율 29.5%
  - 최근 24시간 biocom 75건 중 이메일 후보 27건, 후보율 36.0%
  - 배포 직후 1건은 success 1/1이지만 이메일 후보가 없어 `em=true` 0/1

따라서 email canary는 “코드는 켜졌지만 실제 이메일 후보 주문이 들어오는지 기다리는 상태”다.

### 24시간 집계를 닫기 전에 진행 가능한 액션플랜

1. **Green: read-only 집계 쿼리와 runbook을 먼저 고정한다.**
   - 무엇을 하는가: 24시간 후 볼 숫자 목록을 미리 정한다.
   - 어떻게 하는가: CAPI send log에서 `success`, `failed`, `duplicate`, `user_data_presence.em/ph/external_id/fbc/fbp`, site/pixel/window를 aggregate로만 집계한다.
   - 왜 하는가: 24시간 뒤에 “좋아진 것 같다”가 아니라, 켜도 되는지/멈춰야 하는지를 숫자로 판단하기 위해서다.
   - 성공 기준: raw identifier 없이 canary 유지/중단 판단표가 나온다.

2. **Green: CAPI 프론트 보고서와 이 문서의 문구를 canary 상태로 맞춘다.**
   - 무엇을 하는가: “후보율 no-send 전”이라는 문구를 “biocom confirmed Purchase canary 관찰 중”으로 바꾼다.
   - 왜 하는가: 화면을 보는 사람이 이미 켜진 것과 아직 켜지지 않은 것을 헷갈리지 않게 하기 위해서다.
   - 성공 기준: 프론트 보고서와 이 문서가 같은 상태를 말한다.

3. **Yellow/운영 변경 금지: 24시간 전에는 범위를 넓히지 않는다.**
   - 하지 않는 것: 더클린커피 확장, Browser Purchase 혼합, event_id hash 변경, 수동 backfill.
   - 왜 하지 않는가: 이벤트 매칭 품질은 좋아질 수 있지만, 중복 제거와 개인정보/동의 리스크를 동시에 건드리면 원인 분리가 어려워진다.

4. **TJ님 확인 필요: 24시간 후 Meta UI 캡처를 한 번 더 확보한다.**
   - 어디에서 보는가: Meta Events Manager → biocom Pixel → Purchase → 이벤트 매칭 품질.
   - 왜 필요한가: VM Cloud는 Meta로 보낸 payload와 성공 여부는 알 수 있지만, Meta UI 점수는 로그인된 화면에서 확인해야 한다.
   - 성공 기준: 6.0/10 기준선, 6.3/10 사용자 캡처, 24시간 후 점수를 같은 조건으로 비교한다.

## 2026-05-20 우선순위 업데이트 — 더클린커피 Google Ads는 Watch로 보류

### 결론

더클린커피 Google Ads는 지금 P0가 아니다. 지금은 **추후 추적(Watch/backlog)** 으로 내리고, 실행 초점은 계속 **Meta CAPI Purchase와 Meta 중간 전환 신호**에 둔다.

쉽게 말하면:

> 더클린커피 Google 광고는 “광고가 실제로 돌고 있고 클릭이 들어오는지”부터 다시 확인해야 하는 상태다. 반면 Meta CAPI는 실제 구매 신호와 ROAS 판단에 바로 연결되어 있으므로 지금 1순위다.

### 근거

2026-05-20 read-only audit 기준 더클린커피 Google Ads는 아래처럼 닫혔다.

- Google Ads 현재 도메인 최종 URL row: 1건.
- enabled row: 0건.
- paused/removed row: 1건.
- manual UTM row: 0건.
- gclid/gbraid/wbraid 같은 Google 클릭 식별자 row: 0건.
- VM Cloud landing row: 695건.
- VM Cloud Google click/evidence row: 0건.
- Google로 보였던 194건은 `paid_search` 단서가 있지만 실제 Google Ads 클릭 식별자가 없어 `Google organic / unknown / non-Google paid_search`로 분리해야 하는 상태다.

따라서 현재 화면과 API에서는 더클린커피 Google을 “운영 중인 Google Ads 유료 유입”으로 쓰지 않는다.

### 왜 Meta CAPI가 여전히 1순위인가

Meta CAPI는 아래 3가지가 직접 매출과 연결된다.

1. 실제 결제완료 주문이 Meta Purchase로 빠짐없이 가는가.
2. 결제완료가 아닌 row가 Purchase로 잘못 가지 않는가.
3. 장바구니, 결제 시작, 결제수단 선택, 회원가입, 50% 스크롤 같은 구매 전 행동을 Purchase와 분리해 Meta 학습 신호로 줄 수 있는가.

Google Ads는 현재 “실제 유료 클릭이 들어오는지”가 먼저다. 그래서 지금은 Google route 조사를 더 파지 않고, Meta CAPI의 KR1/KR2/KR8을 먼저 닫는다.

### Google Ads 재개 조건

아래 조건 중 하나가 생기면 더클린커피 Google Ads 조사를 다시 연다.

1. TJ님이 Google Ads UI에서 더클린커피 활성 캠페인/광고그룹/광고가 실제 운영 중이라고 확인한다.
2. 실제 Google Ads 테스트 클릭을 1회 발생시켰는데 VM Cloud landing row에 gclid/gbraid/wbraid가 안 남는다.
3. Google Ads 최종 URL/추적 템플릿이 새로 바뀌었다.
4. 프론트 리포트에서 Google paid 후보 row가 다시 의미 있는 규모로 쌓인다.

그전까지 더클린커피 Google Ads는 Watch/backlog이며, capivm의 P0/P1 실행 순서를 바꾸지 않는다.

## 2026-05-19 우선순위 업데이트 — UTM 미매핑 리스크

### 결론

Meta UTM이 아직 모두 연결되지 않아 campaign/adset/landing별 미매핑이 많아도, **이 프로젝트를 먼저 진행하는 우선순위는 유지한다.**

이유는 간단하다.

1. `capivm`은 단순 리포트 프로젝트가 아니라 **현재 Meta가 실제 구매 신호를 제대로 받는지 지키는 안전장치**다.
2. UTM 미매핑은 `capivm` 밖의 별도 문제가 아니라, 이 문서의 KR5/KR6/KR8에서 닫아야 하는 **source 분류와 광고 귀속 evidence gap**이다.
3. `indicatoragent`와 `total`은 UTM과 source 분류가 좋아질수록 정확해진다. 따라서 그 앞단인 CAPI 원장과 퍼널 분류를 먼저 안정화해야 한다.

### UTM 미매핑이 실제로 만드는 문제

UTM 미매핑이 많으면 아래가 어려워진다.

- Meta 유입 주문을 campaign/adset/ad 단위로 정확히 나누기 어렵다.
- landing bucket별 구매율과 ROAS를 믿고 바로 예산 조정하기 어렵다.
- 선행지표 에이전트에서 `Meta 구매자 vs 비결제자`를 볼 때 source confidence가 내려간다.
- `/conversion-funnel`에서 `no_ledger_match`, `non_meta_or_unproven_meta`, `utm_present 기타`가 커져 운영자가 원인을 빨리 이해하기 어렵다.

하지만 아래는 여전히 볼 수 있다.

- 실제 결제완료 주문 수.
- Server CAPI Purchase 성공/누락.
- 결제 페이지 artifact와 payment_page_seen 오염 여부.
- Browser 중간 퍼널 이벤트 상태.
- Meta strong evidence가 있는 주문의 대략적인 구매 흐름.

따라서 UTM 미매핑은 **capivm를 보류할 이유가 아니라, capivm의 다음 P0/P1 개선 항목**이다.

### 새 작업 원칙

앞으로 `capivm` 안에서 UTM/source 문제를 아래처럼 다룬다.

1. **정본 매출 판단은 UTM에 의존하지 않는다.**
   - 실제 구매 여부는 VM Cloud confirmed purchase, 운영DB PAYMENT_COMPLETE, Imweb/Toss confirmed source로 본다.
   - UTM이 없어도 구매가 실제 결제완료라면 매출 정본에는 들어간다.

2. **광고 귀속 판단은 confidence를 붙인다.**
   - `strong_meta_ad_evidence`: fbc/fbclid/meta_utm/source가 강하게 붙은 row.
   - `weak_or_partial_meta_evidence`: 일부 evidence만 있는 row.
   - `no_ledger_match`: CAPI send log는 있으나 ledger/source join이 약한 row.
   - `non_meta_or_unproven_meta`: Meta라고 단정할 수 없는 row.

3. **예산 판단 화면에서는 플랫폼 주장값과 내부 원장을 분리한다.**
   - Meta Ads Manager ROAS는 광고 플랫폼이 주장하는 값이다.
   - 내부 confirmed ROAS는 VM Cloud/운영DB 결제완료 원장 기준값이다.
   - 둘이 다르면 원인 bucket을 먼저 본다.

4. **campaign/adset 단위 의사결정은 UTM 매핑 보강 후 한다.**
   - 현재는 전체 Meta 신호 복구와 누락 방지에 집중한다.
   - campaign/adset 세부 예산 이동은 source confidence가 올라간 뒤 한다.

### 우선순위 재판정

1. **1순위 유지: `capivm/!capiplan`**
   - 목표: 실제 결제완료 Purchase CAPI, 누락 큐, 중간 퍼널, source confidence를 안정화한다.
   - 성공 기준: Purchase CAPI success/missing/action queue/source bucket이 같은 화면에서 설명된다.

2. **2순위: `project/!indicatoragent`**
   - 목표: 구매 전 행동 차이를 찾는다.
   - 단, Meta-only campaign/adset 분석은 `capivm` source confidence 보강 이후 더 정확해진다.

3. **3순위: `total/!total-current`**
   - 목표: 전체 채널별 내부 confirmed ROAS와 플랫폼 주장 ROAS를 비교한다.
   - Google Ads/NPay 정합성은 중요하지만, 현재 Meta CAPI 신호 복구와 source bucket 안정화보다 뒤에 둔다.

4. **4순위: `gdn/!gdnplan_new`**
   - 목표: Google Ads 세부 정합성이다.
   - 단독 진행보다 `total`의 최신 Google Ads 섹션으로 흡수한다.

## 10초 요약

이 문서의 목적은 **Meta에 구매 신호가 제대로 들어가고 있는지, 어떤 신호를 예산 판단에 써도 되는지, 어떤 작업은 아직 승인 전 금지인지 한 곳에서 보게 하는 것**이다.
2026-05-04 이전 문서는 `Test Events 준비`가 중심이었지만, 지금은 VM Cloud의 Server CAPI Purchase 경로가 살아 있고 실제 결제완료 주문을 Meta에 보낸 기록이 쌓인다.
다만 Browser Purchase는 아직 안정적으로 보이지 않으므로, 운영 판단은 `VM Cloud 결제완료 원장 + Server CAPI 성공 로그`를 1차 기준으로 보고, Meta Events Manager UI와 Browser Purchase는 보조 검증으로 분리한다.
2026-05-19 기준으로 Meta UTM 미매핑이 많아 campaign/adset/landing 단위 분석 신뢰도가 낮아진 상태지만, 이것은 이 프로젝트를 미루는 이유가 아니라 `source confidence` bucket을 먼저 고쳐야 한다는 뜻이다.
live audit 결과 `no_ledger_match`는 바이오컴/더클린커피 모두 0건이어서 CAPI log와 원장이 끊긴 문제는 현재 크지 않다. 실제 병목은 `강한 Meta 광고 증거 있음` 비율이 바이오컴 최근 7일 48.2%, 더클린커피 최근 7일 18.7%로 낮아, `weak_or_partial_meta_evidence`와 `non_meta_or_unproven_meta`를 더 잘 나눠야 하는 점이다.
2026-05-20 기준 더클린커피 Google Ads는 실제 유료 클릭 증거가 없어 Watch/backlog로 내린다. 지금은 Google route를 더 파는 것보다 Meta CAPI Purchase 누락, 중간 전환 CAPI 후보, Meta source confidence를 먼저 닫는다.
2026-05-21 기준 이벤트 매칭 품질은 no-send 후보 검토 단계를 지나 `biocom confirmed Purchase 한정 고객 식별자 canary` 관찰 단계로 올라왔다. 24시간 집계 전에는 더클린커피, Browser Purchase, event_id hash, 수동 backfill로 범위를 넓히지 않는다.
다음 행동은 이 문서의 KR 기준으로 `24시간 canary aggregate`, `누락 큐`, `UTM/source 미매핑 bucket`, `중간 전환 CAPI 후보`, `환불/취소 guard`, `Events Manager UI 검증`, `Test Events smoke`를 순서대로 닫는 것이다.

## 지금 결론

1. **Server CAPI는 현재 구매 신호 복구의 주 경로다.**
   - 최신 카드 결제 테스트 건은 VM Cloud/Toss 기준 confirmed로 닫혔고, Meta CAPI auto-sync가 `events_received=1`을 받았다.
   - 최근 문서 기준으로 바이오컴 최근 7일 전체 결제완료 381건 중 Meta CAPI 성공은 368건이다. 이 숫자는 [[project/roas]] 기준이며, live 재조회 시 달라질 수 있다.

2. **Browser Purchase 0은 치명 장애가 아니라 보조 리스크다.**
   - Browser Purchase가 보이면 dedup과 Events Manager UI 해석이 쉬워진다.
   - 그러나 같은 주문이 Server CAPI로 이미 성공했다면, Browser Purchase를 무리하게 추가 전송하면 중복 위험이 생긴다.

3. **결제 페이지 artifact 오염은 크게 줄었다.**
   - `/shop_payment/`는 결제완료가 아니라 결제 진행 페이지다.
   - Footer v4.4 계열과 backend downgrade guard 이후에는 `/shop_payment/`가 `payment_success`로 쌓이지 않도록 분리한다.
   - `payment_page_seen`은 절대 Meta Purchase 후보가 아니다.

4. **AddToCart / InitiateCheckout / AddPaymentInfo는 Browser fallback으로 복구된 상태다.**
   - Block 4 fallback은 PageView/ViewContent를 건드리지 않고, 누락되던 중간 퍼널 이벤트만 보완한다.
   - Purchase는 Block 4에서 절대 발화하지 않는다.

5. **중간 전환 CAPI는 아직 운영 전송 단계가 아니다.**
   - 장바구니, 결제 시작, 결제수단 선택, 회원가입, 50% 스크롤은 Purchase가 아니다.
   - 이 신호들은 Meta 학습에 쓸 수 있는 보조 전환 신호가 될 수 있지만, 실제 매출이나 Purchase ROAS에 섞으면 안 된다.
   - 따라서 VM Cloud에 먼저 의미를 분리해 저장하고, payload preview와 Test Events smoke를 거친 뒤 event별로 staged CAPI 전송을 검토한다.

6. **외부 전송 확대는 KR7 Red 승인 전 금지다.**
   - Meta 대량 backfill, GA4 purchase, Google Ads upload, TikTok/Naver send는 각각 별도 승인과 no-send dry-run이 필요하다.

7. **UTM 미매핑이 많아도 capivm 우선순위는 유지한다.**
   - UTM은 campaign/adset/landing 분석의 품질을 높이는 보조 evidence다.
   - 실제 결제완료 여부와 CAPI 성공/누락 판단은 UTM 없이도 VM Cloud/운영DB/Imweb/Toss 기준으로 닫을 수 있다.
   - 따라서 먼저 `Purchase CAPI가 맞게 가는가`와 `어떤 row가 광고 귀속인지 confidence를 붙여 분류하는가`를 이 문서에서 해결한다.

8. **더클린커피 Google Ads는 추후 추적 항목이다.**
   - 2026-05-20 read-only audit에서 활성 Google Ads 유료 클릭 증거가 0건으로 보였다.
   - Google Ads를 다시 볼 조건은 `활성 캠페인 확인`, `실제 Google 테스트 클릭`, `gclid/gbraid/wbraid 누락 재현`, `새 최종 URL/추적 템플릿 변경` 중 하나가 생길 때다.
   - 그전까지 Google Ads는 `total` 또는 `gdn`의 Watch로 두고, `capivm`은 Meta CAPI와 Meta 중간 전환에 집중한다.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint        | 무엇을 하는가                                  | 왜 하는가                                                                       | 어떻게 진행하는가                                                                                  | 지금 상태                                                 | 현재 진척률 % | 100% 조건                                                                                                    | 다음 단계 / 담당                                         | 승인 필요 여부                    | Source 문서               |
| -------: | ------------------- | ---------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- | -------: | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------- | ----------------------- |
|       P0 | [[#Phase1-Sprint1]] | 실제 결제완료만 Meta Purchase 후보로 남긴다           | 허수 구매가 Meta ROAS와 입찰 학습을 오염시키면 안 된다                                         | payment_page_seen 분리, value guard, duplicate guard, confirmed source 우선순위를 적용한다            | 로컬 guard/test PASS, VM Cloud 배포 승인안 준비                      |      96% | pending/unknown/0원/취소/환불/value mismatch가 Purchase 후보 0                                                     | Codex: VM Cloud 배포 후 live 후보 dry-run과 action queue 사유명 재확인 | YES, Yellow deploy 승인 필요 | [[#OKR과 KR 진척률]]        |
|       P0 | [[#Phase1-Sprint2]] | Server CAPI 성공과 누락 큐를 매일 분리한다            | 결제완료인데 Meta로 안 간 주문을 바로 보려면 action queue가 필요하다                              | VM Cloud 결제완료 row와 Meta CAPI send log를 safe_ref 기준으로 대조한다                                  | 5/17 current monitor Critical 0, 5/14~5/15 backlog는 no-backfill 결정 |      92% | current window missing queue가 사유별로 닫히고, legacy backlog는 `do_not_backfill`로 보존됨                         | Codex: 새 current 누락 row만 일일 분류 유지                  | NO, Green                   | [[#OKR과 KR 진척률]]        |
|       P1 | [[#Phase2-Sprint3]] | Browser Purchase를 보조 검증으로 복구한다           | Server CAPI는 살아 있지만 Meta UI에서 Browser/Server dedup 품질을 보려면 Browser 신호도 필요하다 | Header Guard v3.1.1 cache, payment-decision fast path, 다음 실제 결제 관찰로 본다                     | read-only monitor/runbook 준비, 실제 Browser UI 관찰은 남음         |      66% | 실제 결제완료에서 Browser Purchase가 보이거나, 안 보여도 CAPI 성공으로 운영 누락 없음이 분리됨                                            | Codex: monitor 실행 / TJ: 실제 결제 시 UI 확인 가능            | 관찰 NO, diagnostic send는 Red | [[#OKR과 KR 진척률]]        |
|       P1 | [[#Phase2-Sprint4]] | 중간 퍼널 이벤트를 Browser 기준으로 안정화한다            | 장바구니/결제시작/결제정보가 0이면 퍼널 병목이 왜곡된다                                             | Block 4 fallback과 VM Cloud funnel-health 단계 정의를 맞춘다                                        | live `/shop_cart` 28건 확인, 로컬 `ViewContent` 제외 guard 추가 |      90% | 각 단계가 Network 또는 VM Cloud 원장 기준으로 집계되고, Purchase는 발화하지 않음                                                  | Codex: fallback guard 배포 후보와 화면 문구 검증                 | NO for docs, deploy는 Yellow | [[data/!channelfunnel]] |
|       P1 | [[#Phase2-Sprint5]] | Purchase 외 중간 전환 신호를 Meta CAPI로 확장한다     | 구매 전 행동을 서버 신호로도 보내면 Meta가 실제 구매 가능성이 높은 유입을 더 잘 학습할 수 있다                   | VM Cloud capture -> payload preview -> Test Events smoke -> event별 staged CAPI ON 순서로 간다   | AddPaymentInfo source gap audit 완료, CompleteRegistration/Scroll50 route 설계 완료 |      52% | AddToCart/InitiateCheckout/AddPaymentInfo/CompleteRegistration/Scroll50이 Purchase와 분리되어 server source로 검증됨 | Codex: no-send intermediate-event endpoint 설계/로컬 구현       | preview NO, CAPI send는 Red    | [[#OKR과 KR 진척률]]        |
|       P1 | [[#Phase2-Sprint6]] | `/conversion-funnel`과 ROAS 화면의 데이터 기준을 안정화한다 | 화면이 느리거나 기준 시점이 흔들리면 대표가 ROAS와 퍼널을 믿고 판단할 수 없다                              | 기본은 어제 사전 계산값, 당일은 4시간 단위 cache, 강제 새로고침은 제한 버튼으로 분리한다                         | 부분 반영                                                 |      80% | 화면이 500ms 안팎으로 열리고, source/unit/window/site/pixel_id/freshness가 표시됨                                  | Codex: cache 에러 guard와 data contract 검증            | 문서 NO, deploy는 Yellow        | [[#OKR과 KR 진척률]]        |
|       P1 | [[#Phase3-Sprint5]] | Meta Events Manager UI 검증을 표준 체크리스트로 만든다 | VM Cloud 로그와 Meta UI 표시가 다른 경우 지연/제한/필터를 구분해야 한다                            | Pixel/Dataset/recent activity/data sharing restriction/event match quality를 같은 화면 순서로 확인한다 | 미완                                                    |      45% | TJ님이 5분 안에 상태를 확인하고 결과를 문서에 남길 수 있음                                                                        | Codex: 체크리스트 갱신 / TJ: Meta UI 확인                   | UI 확인은 TJ                   | [[#OKR과 KR 진척률]]        |
|       P2 | [[#Phase3-Sprint6]] | Test Events smoke와 외부 전송 준비를 분리한다        | 운영 purchase count를 늘리지 않고 수신 가능성을 검증해야 한다                                   | test_event_code 기반 1건 이하 smoke, payload preview, 운영 count delta 0 조건으로 설계한다                | 설계 있음, 실행 보류                                          |      55% | test-only 수신 PASS, 운영 이벤트 증가 0, Red 승인 전 운영 send 0                                                         | Codex: smoke runbook 갱신 / TJ: 실행 승인 시 test code 제공 | YES, Red 실행 전               | [[#OKR과 KR 진척률]]        |
|       P2 | [[#Phase4-Sprint7]] | 환불/취소 보정 정책을 닫는다                         | 환불된 구매가 계속 남으면 ROAS가 과대 평가된다                                                | 운영DB, VM Cloud imweb_orders, Toss, Imweb v2 API source priority를 정한다                       | 미완                                                    |      30% | 취소/환불 row는 purchase 후보 0, 보정 이벤트는 별도 승인안으로 분리                                                              | Codex: source audit + approval packet              | audit NO, send Red          | [[#OKR과 KR 진척률]]        |

## 다음 할일

### Auto Green

#### A1. CAPI 누락 큐를 KR7 기준으로 다시 분류한다
- 무엇을 하는가: Meta 유입 증거가 있는데 같은 safe key로 성공한 Meta CAPI Purchase send log가 없는 row를 분류한다.
- 왜 하는가: 결제완료인데 Meta에 안 간 주문과 보내면 안 되는 주문을 구분해야 한다.
- 어떻게 하는가: VM Cloud attribution ledger, VM Cloud CAPI send log, 운영DB 결제완료 read-only source를 safe_ref 기준으로 대조한다.
- 성공 기준: 각 row가 `backfill_ready`, `no_send_guard`, `duplicate_or_already_sent`, `legacy_missing_payment_key`, `source_gap` 중 하나로 닫힌다.
- 실패 시 다음 확인점: safe key 생성 방식, CAPI log retention, 운영DB sync 지연, Imweb/Toss confirmed source.
- 담당: Codex.
- 승인 필요 여부: NO, Green. 실제 backfill send는 Red.
- 의존성: 없음.
- 추천 점수/자신감: 91%.

#### A2. Action queue와 KR guard 용어를 맞춘다
- 무엇을 하는가: `/conversion-funnel`의 Critical/High/Medium/Watch 항목을 no-send/dedup/value/refund guard와 같은 말로 맞춘다.
- 왜 하는가: 운영자가 화면에서 보는 위험과 문서의 전송 준비 기준이 달라지면 판단이 흔들린다.
- 어떻게 하는가: 각 카드에 source, unit, window, site, pixel_id, freshness, confidence, recommended_fix를 붙인다.
- 성공 기준: `결제완료가 있는데 Meta CAPI 전송 기록이 없음` 같은 카드가 클릭 시 safe_ref별 상세 사유를 보여준다.
- 실패 시 다음 확인점: frontend data contract, aggregate endpoint, raw id 마스킹.
- 담당: Codex.
- 승인 필요 여부: 문서/설계 NO, VM Cloud/프론트 배포는 Yellow.
- 의존성: A1 결과 일부.
- 추천 점수/자신감: 88%.

#### A3. 환불/취소 source priority를 정리한다
- 무엇을 하는가: Meta Purchase send 전 취소/환불 제외 기준을 source별로 정한다.
- 왜 하는가: 실제 결제완료라도 취소/환불이면 구매 신호로 유지하면 안 된다.
- 어떻게 하는가: 운영DB, VM Cloud imweb_orders, Toss, Imweb v2 API의 상태 필드를 primary/cross-check/fallback으로 분류한다.
- 성공 기준: 취소/환불/0원 row가 purchase 후보 0으로 빠지는 dry-run 규칙이 생긴다.
- 실패 시 다음 확인점: 운영DB sync 지연, Imweb status blank, Toss API 접근권한.
- 담당: Codex.
- 승인 필요 여부: NO, Green.
- 의존성: `data/!data_inventory.md` 최신성.
- 추천 점수/자신감: 84%.

#### A4. 중간 전환 CAPI 후보를 event별로 분리한다
- 무엇을 하는가: Purchase 외 중간 전환 신호를 `장바구니`, `결제 시작`, `결제수단 선택`, `회원가입`, `50% 스크롤`로 나눠 Meta CAPI 후보 contract를 만든다.
- 왜 하는가: 구매 신호만으로는 Meta가 학습할 표본이 적다. 구매 전 행동까지 안전하게 보내면 실질 ROAS 개선 가능성이 커진다.
- 어떻게 하는가: VM Cloud 원장에는 먼저 `purchase_candidate=false`로 저장하고, Meta CAPI는 payload preview와 Test Events smoke를 통과한 event만 staged ON 후보로 올린다.
- 성공 기준: 각 event가 Purchase와 분리되고, Meta Events Manager에서 server source 수신을 검증할 수 있는 payload가 준비된다.
- 실패 시 다음 확인점: health/wellness 제한, custom event 이름, 중복 eventID, event match quality, Ads Manager 최적화 이벤트 오염 여부.
- 담당: Codex.
- 승인 필요 여부: 설계/preview는 NO, 실제 Meta CAPI send는 Red.
- 의존성: KR3 Browser event 안정화, KR6 Meta UI 확인.
- 추천 점수/자신감: 89%.

#### A5. Meta UTM/source 미매핑을 confidence bucket으로 분리한다
- 무엇을 하는가: Meta 유입처럼 보이지만 campaign/adset/landing까지 닫히지 않는 row를 `strong_meta_ad_evidence`, `weak_or_partial_meta_evidence`, `no_ledger_match`, `non_meta_or_unproven_meta`로 나눈다.
- 왜 하는가: UTM 미매핑 row를 한 덩어리로 두면 “Meta가 잘 안 된다”와 “Meta evidence는 있는데 campaign 매핑만 약하다”가 섞인다.
- 어떻게 하는가: VM Cloud attribution ledger, site_landing_ledger, CAPI send log, fbc/fbclid/meta_utm/source fields를 read-only로 대조하고, `/conversion-funnel` metric contract에 source confidence를 붙인다.
- 성공 기준: 화면에서 `utm_present 기타`나 `미매핑`이 하나의 뭉텅이가 아니라 원인별 bucket으로 보인다. campaign/adset 세부 예산 판단은 `strong_meta_ad_evidence` 중심으로만 한다.
- 현재 감사 결과: [[capivm/meta-utm-source-bucket-audit-20260519]] 기준 `no_ledger_match`는 0건이다. 바이오컴은 최근 7일 CAPI 367건 중 strong Meta evidence 177건(48.2%), 더클린커피는 CAPI 203건 중 38건(18.7%)이다. 따라서 다음 병목은 ledger join 실패가 아니라 `weak_or_partial_meta_evidence` bucket을 live API에 따로 분리하는 것이다.
- 실패 시 다음 확인점: landing row 수집 누락, click id restore 누락, fbc/fbclid 저장 위치, campaign_id/adset_id mapping source, Meta API rate limit.
- 담당: Codex.
- 승인 필요 여부: read-only/문서/로컬 contract는 NO, VM Cloud 배포는 Yellow.
- 의존성: funnel-health source/pixel filter와 precompute cache가 정상이어야 한다.
- 추천 점수/자신감: 93%.

### Approval Needed

#### B1. Meta Events Manager UI 검증
- 무엇을 확인하는가: Pixel `1283400029487161`의 Purchase, server/browser source, Event Match Quality, data freshness, data sharing restriction 경고를 본다.
- 왜 필요한가: VM Cloud에서는 `events_received=1`이어도 Meta UI에서 건강/웰빙 제한, 표시 지연, 필터 때문에 다르게 보일 수 있다.
- 어느 화면에서 하는가: Meta Events Manager -> 데이터 세트 -> 바이오컴 Pixel -> 이벤트 개요 / 진단 / Event match quality / 데이터 신선도.
- 성공 기준: Server CAPI Purchase가 최근 수신되고, blocked/duplicate/restriction이 치명 수준으로 뜨지 않는다.
- 실패 시 다음 확인점: same-day lag, data source restriction, action key mismatch, wrong pixel/dataset.
- 담당: TJ님. Codex가 대신 못 하는 이유는 Meta UI 로그인/권한/2FA가 필요하기 때문이다.
- 승인 필요 여부: UI 확인만이라 승인 아님.
- 의존성: 없음.
- 추천 점수/자신감: 76%.

#### B2. Test Events smoke 실행 승인
- 무엇을 승인하는가: 운영 구매 수를 늘리지 않는 `test_event_code` 기반 Meta CAPI/browser smoke 1건 이하.
- 왜 필요한가: 실제 운영 purchase count를 늘리지 않고 수신 경로와 dedup을 확인해야 한다.
- 어떻게 하는가: test_event_code, 고정 eventID, 운영 count delta 0, 1건 이하 조건으로 실행한다.
- 성공 기준: Test Events에 이벤트가 보이고, 운영 Purchase count는 증가하지 않는다.
- 실패 시 다음 확인점: test_event_code 누락, wrong Pixel/Dataset, browser blocker, CORS.
- 담당: Codex + TJ님. TJ님은 test_event_code 제공이나 UI 확인이 필요할 수 있다.
- 승인 필요 여부: YES, Red에 준하는 제한 smoke.
- 의존성: B1 UI 상태 또는 최신 Pixel 상태 확인.
- 추천 점수/자신감: 67%.

### Blocked/Parked

#### C1. 실제 외부 purchase 전송 확대
- 무엇을 보류하는가: Meta 대량 backfill, GA4 Measurement Protocol purchase, Google Ads conversion upload, TikTok/Naver purchase send.
- 왜 보류하는가: 실제 광고 플랫폼의 전환값과 학습 신호를 바꾸는 작업이다.
- 재개 조건: payload preview, duplicate guard, value guard, refund/cancel guard, rollback plan, post-send verification이 준비되고 TJ님이 명시 승인한다.
- 실패 시 해석: 승인 없이 실행되면 플랫폼 ROAS와 입찰 학습 신호가 오염될 수 있다.
- 담당: TJ님 승인 + Codex 실행.
- 승인 필요 여부: YES, Red.
- 의존성: A1~A3, B1~B2.
- 추천 점수/자신감: 지금 실행 25%, 준비 작업 90%.

#### C2. 더클린커피 Google Ads 실제 유입 추적
- 무엇을 보류하는가: 더클린커피 Google Ads 유료 클릭 경로를 추가로 파는 작업.
- 왜 보류하는가: 2026-05-20 read-only audit에서 VM Cloud landing row 695건 중 Google click id/evidence가 0건이고, Google Ads current-domain URL도 paused/legacy 성격으로 보였다. 지금 계속 파면 Meta CAPI P0 작업에서 초점이 흐려진다.
- 재개 조건: TJ님이 Google Ads UI에서 활성 캠페인을 확인하거나, 실제 Google 테스트 클릭 1회 후 VM Cloud에 gclid/gbraid/wbraid가 남지 않는 재현이 생길 때.
- 실패 시 해석: 재개 조건 없이 계속 보면 organic/unknown Google 단서와 실제 Google Ads 유료 유입이 섞여 ROAS 판단이 더 흐려진다.
- 담당: TJ님이 활성 캠페인 여부 확인, Codex가 재개 조건 발생 시 read-only route audit.
- 승인 필요 여부: NO for read-only, Google Ads 설정 변경이나 전환 upload는 Red.
- 의존성: Google Ads 활성 집행 또는 테스트 클릭.
- 추천 점수/자신감: 지금 추가 진행 35%, Watch로 보류 92%.

## 문서 목적

이 문서는 Meta CAPI와 Browser Pixel 복구 작업의 현재 정본이다.
대표 관점에서는 **Meta 구매 신호가 예산 판단에 쓸 만큼 살아 있는지**를 확인하는 문서다.
개발 관점에서는 **어떤 신호가 purchase 후보이고, 어떤 신호는 절대 purchase 후보가 아닌지**를 고정하는 문서다.

## 데이터 source 기준

아래 이름을 섞어 쓰지 않는다.

- 운영DB: 개발팀이 관리하는 PostgreSQL dashboard DB다. 결제완료 cross-check source로 쓴다. write/import는 Red 승인 전 금지다.
- VM Cloud: TJ님이 관리하는 `att.ainativeos.net` 수집/보조 원장이다. attribution ledger, CAPI send log, funnel-health, roas-summary가 여기서 돈다.
- 로컬: 이 MacBook 개발 환경이다. 문서 작성, 테스트, dry-run에 쓴다.
- Meta UI/API: 광고 플랫폼이 보여주는 주장값과 이벤트 수신 화면이다. 실제 결제 정본이 아니라 platform-side attribution 결과다.

## 현재 운영 구조

### Purchase 경로

실제 결제완료 구매 신호는 아래 순서로 판단한다.

1. VM Cloud 또는 운영DB/Imweb/Toss에서 결제완료 confirmed 여부를 확인한다.
2. value guard가 금액을 검증한다.
3. 취소/환불/0원/unknown/pending은 no-send로 제외한다.
4. duplicate event_id를 확인한다.
5. 통과한 row만 Server CAPI Purchase 후보가 된다.

중요한 점:

- `footer payment_success` 단독은 confirmed가 아니다.
- `/shop_payment/` 페이지 진입은 결제완료가 아니다.
- NPay 클릭은 구매완료가 아니다. 실제 NPay 결제완료 매출은 별도 actual source로 포함해야 한다.
- Browser Purchase가 안 보여도 Server CAPI가 성공하면 운영 누락은 1차로 해소된 것으로 본다.

### payment_page_seen 경로

`payment_page_seen`은 사용자가 결제 페이지까지 갔다는 진단 신호다.
이 신호는 결제완료가 아니며 Meta Purchase 후보가 될 수 없다.

이 신호가 중요한 이유:

- 결제 페이지까지 갔지만 결제완료 판단 응답이 끊긴 row를 찾을 수 있다.
- Header Guard, payment-decision, CAPI 후보화 병목을 볼 수 있다.
- 하지만 예산 판단용 매출에는 포함하지 않는다.

### Browser funnel 경로

Block 4 fallback의 목적은 FBE/native Pixel이 놓치는 중간 퍼널 브라우저 신호를 보완하는 것이다.

현재 원칙:

- PageView와 ViewContent는 기존 FBE/native 흐름을 우선한다.
- AddToCart, InitiateCheckout, AddPaymentInfo는 누락 시 fallback으로 보완한다.
- Purchase는 fallback으로 절대 발화하지 않는다.
- Browser Purchase는 Header Guard와 payment-decision이 허용한 경우에만 가능하다.

### 중간 전환 CAPI 경로

중간 전환 CAPI의 목적은 Purchase가 일어나기 전의 의미 있는 행동을 Meta에 서버 신호로 알려 학습 표본을 늘리는 것이다.
다만 이 신호들은 실제 매출이 아니므로 Purchase, ROAS 매출, confirmed purchase count와 섞지 않는다.

대상 후보:

- `AddToCart`: 장바구니 담기 또는 장바구니 페이지 진입.
- `InitiateCheckout`: 결제 시작 또는 주문서/결제 페이지 진입.
- `AddPaymentInfo`: 결제수단 선택 또는 결제수단 입력 단계.
- `CompleteRegistration`: 회원가입 완료.
- `Scroll50`: 페이지 50% 이상 스크롤. Meta 표준 purchase가 아니므로 custom event 또는 내부 engagement 신호로 별도 검토한다.

진행 원칙:

- 먼저 VM Cloud 원장에 `purchase_candidate=false`로 저장한다.
- Meta CAPI 전송 전 payload preview와 Test Events smoke를 통과해야 한다.
- 건강/웰빙 제한과 민감 URL/콘텐츠명을 점검한 뒤 event별로 staged ON을 검토한다.
- 실질 ROAS 개선은 `광고 플랫폼이 주장하는 ROAS`만 보지 않고, 내부 confirmed ROAS, CPA, Meta attributed purchase 변화까지 같이 본다.

## 구현된 것

### 실제 결제완료 구매 신호

- Server CAPI Purchase auto-sync 경로가 VM Cloud에서 동작한다.
- 최신 결제 테스트 건은 confirmed 이후 Meta CAPI로 전송됐고 `events_received=1`을 받았다.
- 최근 문서 기준 바이오컴 최근 7일 전체 결제완료 381건 중 CAPI 성공은 368건이다. source는 [[project/roas]]다.
- CAPI failed와 duplicate는 최근 incident 문서 기준 0으로 관측됐다. 단, live에서는 재조회해야 한다.

### 결제 페이지 artifact 차단

- `/shop_payment/`는 `payment_page_seen`으로 분리한다.
- `payment_success` endpoint가 `/shop_payment/` payload를 받으면 downgrade 또는 reject하는 guard가 설계/반영됐다.
- `payment_page_seen`은 purchase candidate 0이어야 한다.

### Header Guard와 payment-decision

- Header Guard는 Purchase 발화 전에 payment-decision을 호출한다.
- v3 hotfix 이후 timeout은 8초로 늘어났다.
- v3.1.1 방향은 prefetch, decision cache, canonical cache key, fetch failure no-cache를 포함한다.
- unknown fail-open은 금지다.
- 미입금/가상계좌는 계속 block 또는 VirtualAccountIssued로 분리한다.

### 중간 퍼널 Browser 이벤트

- AddToCart / InitiateCheckout / AddPaymentInfo는 Block 4 fallback으로 복구됐다.
- fallback은 image beacon 기반으로 Network/Pixel Helper 관측이 가능하다.
- Purchase는 Block 4에서 제외되어 있다.

### 중간 전환 CAPI 후보

- 중간 전환을 Meta CAPI로 확장해야 한다는 KR을 추가했다.
- 현재는 운영 전송 단계가 아니라 설계/preview/test-only 단계다.
- 장바구니, 결제 시작, 결제수단 선택, 회원가입, 50% 스크롤은 모두 Purchase와 분리된 보조 신호로 다룬다.

### 화면/데이터 contract

- funnel-health는 site/pixel filter를 적용해 바이오컴과 더클린커피 CAPI 로그가 섞이지 않게 한다.
- funnel-health는 precompute/cache로 5분 주기 사전 계산 구조를 갖는다.
- roas-summary도 precompute/cache 방향으로 전환했다.
- `/conversion-funnel` 화면은 기본적으로 사전 계산값을 보여주고, 당일 데이터는 별도 버튼/4시간 주기 precompute로 분리하는 방향이다.

## 아직 안 된 것

- Meta Events Manager UI에서 매일 같은 기준으로 Server/Browser source와 Event Match Quality를 확인하는 루틴.
- Browser Purchase가 실제 결제완료 화면에서 안정적으로 보이는지.
- Test Events smoke를 운영 count 증가 없이 실행하는 것.
- Purchase 외 중간 전환 신호의 Meta CAPI payload preview와 Test Events smoke.
- refund/cancel event 수신과 보정 정책.
- GA4 Measurement Protocol purchase, Google Ads confirmed_purchase upload, TikTok/Naver purchase send 준비 완료.
- Meta data source restriction이 Ads Manager purchase-family key 0에 얼마나 영향을 주는지 확정.

## 막힌 이유

현재 병목은 코드 하나가 아니라 세 가지가 겹친 상태다.

1. **Meta UI 접근 병목**
   - Events Manager UI는 로그인/2FA/권한이 필요하다.
   - Codex는 VM Cloud 로그와 API는 볼 수 있지만, Meta UI 화면 자체는 TJ님 확인이 필요할 수 있다.

2. **브라우저 lifecycle 병목**
   - 결제완료 페이지는 redirect/pagehide/unload가 빠르게 일어난다.
   - payment-decision fetch가 늦거나 canceled 되면 Browser Purchase가 막힌다.
   - 그래서 Server CAPI를 주 복구 경로로 두고 Browser Purchase는 보조 진단으로 둔다.

3. **플랫폼 attribution 병목**
   - Meta는 CAPI `events_received=1`을 받더라도 Ads Manager purchase/value에 바로 귀속하지 않을 수 있다.
   - 건강/웰빙 데이터 소스 제한, same-day lag, attribution window, action key mismatch가 모두 후보 원인이다.

## Phase1-Sprint1

**이름**: 실제 결제완료만 Meta Purchase 후보로 남긴다

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

이 Sprint는 **Meta에 "구매"라고 알려도 되는 주문만 남기는 안전장치**를 만드는 작업이다.
사용자가 결제 페이지에 들어갔거나 결제수단을 눌렀다는 신호는 구매가 아니다.
실제 결제완료가 확인되고, 금액이 맞고, 취소/환불/0원이 아니고, 이미 보낸 중복 이벤트가 아닐 때만 Meta Purchase 후보로 남긴다.

### 왜 하는가

Meta에 구매가 아닌 신호를 Purchase로 보내면 광고 ROAS가 좋아 보이지만 실제 매출은 아니다.
이렇게 되면 Meta가 잘못된 사람을 학습하고, 광고 예산 판단도 틀어진다.
따라서 첫 번째 목표는 "많이 보내기"가 아니라 **보내면 안 되는 구매 신호를 확실히 막는 것**이다.

### 어떻게 개발하는가

1. `payment_page_seen`과 `payment_success`를 분리한다.
   - `payment_page_seen`은 결제 페이지에 도착했다는 뜻이다.
   - `payment_success`는 결제완료 후보라는 뜻이다.
   - `/shop_payment/`처럼 결제 진행 페이지에서 온 신호는 Purchase 후보가 될 수 없다.
2. Purchase 후보를 만들 때 source 우선순위를 적용한다.
   - 1순위: VM Cloud confirmed payment row.
   - 2순위: 운영DB PAYMENT_COMPLETE read-only cross-check.
   - 3순위: Imweb v2 API 또는 Toss confirmed fallback.
   - footer나 browser 신호 단독으로는 confirmed purchase로 보지 않는다.
3. value guard를 적용한다.
   - 후보 금액과 정본 금액이 다르면 no-send.
   - 0원, 취소, 환불, pending, unknown은 no-send.
4. duplicate guard를 적용한다.
   - 같은 safe order/payment key로 이미 Meta CAPI 성공 기록이 있으면 다시 보내지 않는다.
5. 화면과 action queue에 같은 용어를 쓴다.
   - `no_send_guard`, `duplicate_or_already_sent`, `value_mismatch`, `source_gap`처럼 사람이 원인을 이해할 수 있는 사유로 분류한다.

### 개발 계획

#### 완료된 개발

1. [Codex][완료] 결제 페이지 방문과 결제완료 후보를 분리했다.
   - 무엇: `/shop_payment/`처럼 결제 진행 페이지에서 들어온 row를 `payment_page_seen`으로 보고, Meta Purchase 후보에서 제외한다.
   - 왜: 결제 페이지까지 간 사람은 구매자가 아니다. 이 row를 Purchase로 보내면 Meta ROAS와 입찰 학습이 허수로 오염된다.
   - 어떻게: 후보 생성 로직에서 `metadata.semantic_touchpoint=payment_page_seen`, `touchpoint=payment_page_seen`, 결제 진행 URL 패턴을 no-send로 막는다.
   - 산출물: `payment_page_seen`과 `payment_success` 분리 원칙, 후보 생성 guard, 로컬 fixture.
   - 검증: 로컬 test 기준 `payment_page_seen purchase_candidate=0`.
   - 의존성: 없음. VM Cloud live 반영 여부만 남았다.
2. [Codex][완료] 금액 guard를 0원/음수/정본 금액 불일치까지 막도록 보강했다.
   - 무엇: Meta Purchase 후보 금액이 0원, 음수, source total과 불일치하면 전송 후보에서 제외한다.
   - 왜: 구매 신호가 맞더라도 금액이 틀리면 Meta ROAS가 틀어진다.
   - 어떻게: `metadataFiniteNumber`와 `metadataPositiveNumber` 의미를 분리해, 후보 금액과 정본 금액을 각각 읽은 뒤 `non_positive_value`, `value_source_total_mismatch`로 차단한다.
   - 산출물: `backend/src/metaCapi.ts` guard 보강, 0원/음수/source total 0 mismatch fixture.
   - 검증: 로컬 attribution test에서 0원/음수/source total 0 mismatch는 후보 0, 정상 양수 confirmed row만 후보 1.
   - 의존성: 없음. VM Cloud live 배포 후 같은 결과를 smoke로 확인해야 한다.
3. [Codex][완료] 중복 전송 guard 방향을 정했다.
   - 무엇: 같은 safe order/payment key로 이미 Meta CAPI 성공 기록이 있으면 다시 보내지 않는다.
   - 왜: 같은 구매를 두 번 보내면 Meta 전환수와 ROAS가 부풀려진다.
   - 어떻게: Meta CAPI send log의 successful event_id/safe key를 먼저 확인하고, 후보 생성 단계에서 `duplicate_or_already_sent`로 분리한다.
   - 산출물: duplicate guard rule, action queue reason 설계.
   - 검증: 최근 CAPI send log 기준 duplicate event_id 0을 유지하는 방향으로 설계됨.
   - 의존성: VM Cloud send log freshness.
4. [Codex][완료] 보고와 화면에서 raw identifier를 숨기는 원칙을 유지했다.
   - 무엇: 주문번호, 결제키, 클릭 ID, 회원키는 보고서/대화/Telegram/git에 직접 출력하지 않고 safe_ref와 aggregate로 본다.
   - 왜: 디버깅에는 필요하지만 운영 보고에 원문 식별자가 나오면 보안 리스크가 생긴다.
   - 어떻게: 상세 판단은 secure evidence 내부에서만 하고, 문서에는 count/amount/reason/safe_ref 수준으로 남긴다.
   - 산출물: raw identifier output 0 원칙.
   - 검증: 로컬 문서와 결과보고에서 raw id 출력 금지 유지.
   - 의존성: 없음.
5. [Codex][완료] VM Cloud 배포 후 반복 실행할 post-check runbook과 script를 준비했다.
   - 무엇: 배포 후 `/health`, funnel-health contract, site/pixel filter, Meta CAPI send log aggregate, confirmed-but-unsent queue를 한 번에 확인하는 절차를 만들었다.
   - 왜: “배포됐다”와 “실제 결제완료만 Purchase 후보로 남는다”는 다른 말이다. 배포 직후 같은 기준으로 PASS/HOLD/FAIL을 판단해야 KR1을 100%로 올릴 수 있다.
   - 어떻게: 기본은 read-only script로 두고, `/payment-page-seen` endpoint와 `/shop_payment/ downgrade` live smoke는 `ALLOW_LIVE_SMOKE=1`일 때만 실행되도록 분리했다.
   - 산출물: `scripts/meta-capi-phase1-sprint1-postcheck.sh`, `capivm/meta-capi-phase1-sprint1-postcheck-runbook-20260517.md`.
   - 검증: 스크립트 문법/check와 read-only API smoke로 확인한다.
   - 의존성: 없음. Yellow smoke는 VM Cloud 배포 승인 후에만 실행한다.

#### 남은 개발 / 운영 확인

1. [Codex][남음] VM Cloud live backend에 `metaCapi` guard 보강을 배포하고 post-check script를 실행한다.
   - 무엇: 로컬에서 통과한 `backend/src/metaCapi.ts` guard를 VM Cloud backend에 반영한다.
   - 왜: 로컬 테스트만 통과하면 실제 대시보드와 CAPI 후보 큐가 안전해졌다고 말할 수 없다. live backend가 같은 rule로 후보를 골라야 한다.
   - 어떻게: VM Cloud 파일 백업 → `metaCapi.ts` 배포 → `npm run typecheck`/`npm run build` → `pm2 restart seo-backend` → `/api/health`와 funnel-health smoke → `scripts/meta-capi-phase1-sprint1-postcheck.sh` 기본 모드 실행 → 승인된 배포 직후에만 `ALLOW_LIVE_SMOKE=1` smoke 실행.
   - 산출물: VM Cloud deploy/post-check 결과.
   - 검증: `payment_page_seen`, pending/unknown, 0원/음수, 취소/환불, value mismatch 후보 0. 정상 양수 confirmed fixture 후보 1. Meta 운영 send 0.
   - 의존성: Yellow deploy 승인과 VM Cloud 접근. 승인 없이는 실행하지 않는다.
2. [Codex][남음] live action queue 사유명을 최종 확인한다.
   - 무엇: 화면의 `결제완료가 있는데 Meta CAPI 전송 기록이 없음` 같은 큐가 실제로 `보관만, 전송하지 않음`, `duplicate_or_already_sent`, `value_mismatch`, `source_gap`처럼 사람이 이해할 수 있는 사유로 나뉘는지 확인한다.
   - 왜: 같은 누락이라도 “보내야 하는 누락”과 “일부러 안 보내는 legacy backlog”는 운영 판단이 완전히 다르다.
   - 어떻게: funnel-health/action queue response를 read-only로 조회해 reason별 count/amount를 확인하고, 화면 문구와 맞지 않으면 frontend handoff에 반영한다.
   - 산출물: reason별 live dry-run 표와 화면 문구 점검.
   - 검증: 5/14~5/15 legacy backlog는 `backfill 후보`가 아니라 `보관만, 전송하지 않음`으로 표시된다.
   - 의존성: VM Cloud guard 배포 후 수행하면 가장 정확하다.
3. [Codex][남음] 취소/환불 보정 guard는 Phase4-Sprint7과 연결해 닫는다.
   - 무엇: 이미 보낸 Purchase가 나중에 취소/환불될 때 Meta에 어떻게 보정할지 별도 rule을 완성한다.
   - 왜: Sprint1은 “보내기 전 후보를 막는 guard”가 목표이고, “이미 보낸 구매의 환불 보정”은 다른 운영 리스크다.
   - 어떻게: refund/cancel source priority, no-send/dry-run, Red 승인 전 actual correction send 0 원칙을 Phase4-Sprint7에서 이어간다.
   - 산출물: refund/cancel correction runbook.
   - 검증: 취소/환불 row가 신규 Purchase 후보 0, 보정 전송은 Red 승인 전 0.
   - 의존성: Phase4-Sprint7.
4. [TJ][보류] 실제 외부 전송 확대는 별도 Red 승인 때만 판단한다.
   - 무엇: Meta에 운영 Purchase를 추가로 보내거나 과거 누락분을 backfill하는 결정이다.
   - 왜: 광고 학습과 ROAS에 직접 영향을 주므로 Codex가 임의로 실행하면 안 된다.
   - 어떻게: Codex가 dry-run 후보, 금액, 중복 여부, 오염 리스크를 정리한 뒤 TJ님이 승인한다.
   - 산출물: Red approval packet.
   - 검증: 승인 전 Meta 운영 Purchase 추가 send 0.
   - 의존성: live guard post-check와 backfill 필요성 재판단.

### 현재 진척률

현재 진척률: 96%.

해석: 로컬 코드와 테스트 기준으로는 100% 조건을 직접 확인했다.
다만 VM Cloud live backend에는 아직 이번 guard 보강을 배포하지 않았기 때문에, 운영 반영 완료 기준으로는 96%로 둔다.
상세 개발 계획은 위처럼 `완료된 개발`과 `남은 개발 / 운영 확인`으로 분리한다.

### 완료한 것

- payment_page_seen과 payment_success를 분리했다.
- pending/unknown/0원/취소/환불/value mismatch no-send 원칙을 세웠다.
- duplicate event_id 0을 유지하는 방향으로 CAPI candidate gate를 설계했다.
- Server CAPI Purchase가 confirmed row를 Meta로 보낼 수 있다.
- 로컬 코드에서 Meta CAPI 후보 숫자 파싱을 `finite number`와 `positive number`로 분리했다.
  - 쉽게 말하면, 금액이 `0`, 음수, 또는 정본 금액과 다른 경우를 이름 혼동 없이 확실히 막는다.
- 로컬 테스트에 0원, 음수, source total 0 mismatch, 정상 양수 주문 fixture를 추가했다.
  - 검증 결과: 0원/음수/source total 0 mismatch는 후보 0, 정상 양수 주문만 후보 1.

### 100% 조건

- `payment_page_seen` purchase candidate 0.
- pending/unknown/0원/취소/환불/value mismatch no-send PASS.
- confirmed + value guard pass + duplicate 0 row만 후보.
- raw identifier output 0.

### 로컬 개발 결과

- 변경 파일:
  - `backend/src/metaCapi.ts`
  - `backend/tests/attribution.test.ts`
- 무엇을 바꿨나:
  - Meta CAPI 후보 선정 전 금액을 읽는 helper를 `metadataFiniteNumber`와 `metadataPositiveNumber`로 나눴다.
  - 후보 금액은 0/음수까지 읽은 뒤 `non_positive_value`로 막는다.
  - 환불 금액은 양수일 때만 `refund_amount_present`로 막는다.
  - 정본 금액(source total)은 0도 읽어서 후보 금액과 다르면 `value_source_total_mismatch`로 막는다.
- 왜 필요한가:
  - 함수 이름이 `positive number`처럼 보이면, 나중에 0원 주문이 어떻게 막히는지 오해할 수 있다.
  - Meta Purchase 후보는 광고 학습과 ROAS에 직접 들어가므로, 0원/음수/금액 불일치 row가 살아남으면 안 된다.
- 로컬 검증:
  - `npm run typecheck` PASS.
  - `node --import tsx --test tests/attribution.test.ts` PASS.
  - attribution test 47개 PASS.

### VM Cloud 배포 승인안

이 승인안은 **Meta에 추가 전송을 하는 작업이 아니다.**
VM Cloud backend가 앞으로 Meta CAPI 후보를 고를 때 더 안전하게 거르는 코드만 반영한다.

배포 대상:

- `backend/src/metaCapi.ts`

배포 전 pre-snapshot:

1. `https://att.ainativeos.net/api/health` 200 확인.
2. `/api/attribution/funnel-health?site=biocom&window=7d` 200 확인.
3. 현재 Meta CAPI missing/action queue count를 저장한다.
4. VM Cloud backend 파일 백업:
   - `/home/biocomkr_sns/seo/repo/backend/_meta-capi-guard-backup-YYYYMMDD-HHMMKST/metaCapi.ts.before`

배포 순서:

1. 로컬 `backend/src/metaCapi.ts`를 VM Cloud backend 동일 경로로 복사한다.
2. VM Cloud backend에서 `npm run typecheck` 실행.
3. VM Cloud backend에서 `npm run build` 실행.
4. `pm2 restart seo-backend` 실행.
5. `/api/health`와 funnel-health API smoke를 다시 확인한다.

post-snapshot 성공 기준:

1. `/api/health` 200.
2. funnel-health API 200.
3. 0원/음수/source total mismatch fixture가 remote Node smoke에서 no-send로 판정된다.
4. 정상 양수 confirmed fixture만 후보로 남는다.
5. Meta CAPI 추가 운영 send 0.
6. raw order/payment/click/member/email/phone 출력 0.

실패 조건:

1. backend 5xx 또는 restart 실패.
2. 0원/음수/value mismatch row가 후보로 남음.
3. `payment_page_seen`이 Meta Purchase 후보로 남음.
4. 배포 중 Meta CAPI send/backfill이 발생함.
5. raw identifier가 로그/응답/문서에 출력됨.

rollback:

1. 백업한 `metaCapi.ts.before`를 `backend/src/metaCapi.ts`로 되돌린다.
2. `npm run build`.
3. `pm2 restart seo-backend`.
4. `/api/health`와 funnel-health API를 다시 확인한다.

승인 필요 여부:

- VM Cloud backend 파일 변경과 restart가 있으므로 Yellow 승인 필요.
- Meta 운영 Purchase send/backfill은 이 승인안에 포함하지 않는다.

### 역할 구분

- TJ: 실제 운영 전송 확대 여부를 승인한다.
- Codex: 후보 생성, guard, dry-run, action queue 사유 분류, VM Cloud 배포 승인안 작성을 담당한다.
- Claude Code: 화면에서 no-send 사유를 사람이 읽는 문구로 보여주는 UI를 담당한다.

## Phase1-Sprint2

**이름**: Server CAPI 성공과 누락 큐를 매일 분리한다

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

이 Sprint는 **결제는 끝났는데 Meta로 구매 신호가 안 간 주문을 매일 찾아내는 작업**이다.
대표 화면에서는 `결제완료가 있는데 Meta CAPI 전송 기록이 없음` 같은 카드로 보인다.
클릭하면 safe_ref별로 왜 빠졌는지 확인할 수 있어야 한다.

### 왜 하는가

실제 결제완료 주문이 Meta로 안 가면 광고 플랫폼은 그 구매를 학습하지 못한다.
그러면 Meta ROAS가 낮게 보이고, 잘 되는 광고도 끄는 판단을 할 수 있다.
반대로 아무 주문이나 backfill하면 중복/오염이 생긴다.
그래서 누락 row를 먼저 이유별로 쪼개야 한다.

### 어떻게 개발하는가

1. VM Cloud confirmed purchase와 Meta CAPI send log를 safe_ref 기준으로 대조한다.
2. 성공한 send log가 없으면 missing queue로 올린다.
3. missing queue를 바로 전송하지 않고 사유별로 분류한다.
   - `current_missing_watch`: 5/17 이후 새로 생긴 누락 row. 다음 `capiAutoSync`/precompute 뒤에도 남는지 먼저 본다.
   - `backfill_ready`: 결제완료와 금액이 확실하고 중복이 없는 후보. 단 5/14~5/15 legacy backlog는 이번 결정에서 전송하지 않는다.
   - `legacy_do_not_backfill`: 과거 수리 전 backlog라 증거는 보관하지만, Meta ROAS 오염 위험 때문에 보내지 않는 후보.
   - `no_send_guard`: 취소/환불/0원/unknown 등 보내면 안 되는 후보.
   - `duplicate_or_already_sent`: 다른 event_id 또는 같은 safe key로 이미 성공한 후보.
   - `legacy_missing_payment_key`: 오래된 row라 payment key가 부족한 후보.
   - `source_gap`: VM Cloud/운영DB/Imweb/Toss source가 서로 안 맞는 후보.
4. 화면에서 카드 클릭 시 safe_ref, 금액, 사유, 다음 조치를 보여준다.
5. 실제 backfill send는 Red 승인 전까지 0으로 유지한다.

### 개발 계획 — 완료된 것

1. [Codex] missing queue를 `legacy backlog`와 `current monitor`로 나눴다.
   - `legacy backlog`: 2026-05-14~2026-05-15. Header/Footer/VM Cloud CAPI guard 수리 전 incident row다.
   - `transition day`: 2026-05-16. 수리 전/후 신호가 섞인 날이라 trend 해석에는 쓰되, 현재 품질 KPI로 단독 사용하지 않는다.
   - `current monitor`: 2026-05-17 이후. 지금 코드가 실제로 누락을 줄이고 있는지 보는 일일 KPI다.
   - 산출물: window별 count/amount/reason 기준.
   - 검증: 5/17 이후 current missing row가 next sync 후 0으로 닫힘.
   - 의존성: VM Cloud send log retention, `capiAutoSync` 실행 주기.
2. [Codex] 최근 7일 missing queue는 과거 원인 분석과 no-backfill 판단에만 쓰기로 정했다.
   - 산출물: 5/14~5/15 legacy backlog count/amount와 5/17 current monitor count/amount 분리.
   - 검증: 7일 숫자를 현재 코드 품질로 오해하지 않는다.
   - 의존성: 5/14~5/15 incident history.
3. [TJ + Codex] 5/14~5/15 legacy backlog는 backfill하지 않기로 결정했다.
   - 이유: 이미 지나간 과거 row를 Meta Purchase로 늦게 보내면 Meta ROAS가 과대 또는 잘못 보정될 수 있다.
   - 산출물: legacy backlog는 `do_not_backfill` 정책으로 보존.
   - 검증: Meta CAPI 운영 추가 전송 0.
   - 의존성: 없음.
4. [Codex] missing queue 상세 API/contract를 정리했다.
   - 산출물: safe_ref, amount, reason, recommended_action.
   - 검증: raw identifier output 0.
   - 의존성: action queue frontend.
5. [Claude Code] 카드 펼침 UI를 사람이 읽는 문구로 만들었다.
   - 산출물: `/conversion-funnel` action queue 상세.
   - 검증: 16건 같은 누락 카드가 클릭 시 row별로 보인다.
   - 의존성: API contract.

### 개발 계획 — 아직 완료되지 않은 것

1. [Codex] 5/17 이후 current monitor에서 새 누락 row가 생기면 자동으로 `current_missing_watch`로 분리한다.
   - 무엇: 새 결제완료 row가 Meta CAPI send log 없이 잠깐 보이는지, 다음 sync 뒤에도 남는지 나눈다.
   - 왜: 방금 결제된 row는 `capiAutoSync` 전이라 잠깐 누락처럼 보일 수 있다. 이를 과거 장애로 오해하면 안 된다.
   - 어떻게: `window=1d` 기준으로 같은 safe_ref가 두 번 연속 precompute tick에서 남으면 사유 분류 대상으로 올린다.
   - 산출물: current monitor action queue의 `watch -> critical` 승격 기준.
   - 검증: transient row는 다음 tick에서 사라지고, 지속 row만 reason 분류된다.
   - 의존성: precompute 5분 주기, `capiAutoSync` 주기.
2. [Codex] 5/14~5/15 backlog의 화면 문구를 `backfill 후보`가 아니라 `보관만, 전송하지 않음`으로 바꾼다.
   - 무엇: 기존 `recommended_action` 문구가 backfill 후보처럼 읽히는 부분을 바꾼다.
   - 왜: 이미 no-backfill 결정을 했으므로 UI가 TJ님에게 전송을 권하는 것처럼 보이면 안 된다.
   - 어떻게: action queue 상세 reason에 `legacy_do_not_backfill` 또는 `do_not_backfill_roas_contamination` 라벨을 추가하는 frontend/API contract를 다음 화면 패치 때 반영한다.
   - 산출물: 5/14~5/15 row는 “과거 장애 기록, 전송 안 함”으로 표시.
   - 검증: legacy row에 Red backfill 승인 요청 문구가 뜨지 않는다.
   - 의존성: `/conversion-funnel` action queue UI/contract 수정 타이밍.
3. [Codex] current monitor가 48~72시간 연속 0 또는 사유 닫힘인지 확인한다.
   - 무엇: 5/17 이후 코드가 안정적으로 누락을 만들지 않는지 본다.
   - 왜: 한 번 0이 된 것보다 며칠 유지되는 것이 운영 기준 완성도에 더 중요하다.
   - 어떻게: 하루 단위로 `confirmed_but_no_capi_send` count/amount를 기록한다.
   - 산출물: KR2 100% 승격 근거.
   - 검증: current missing 0 유지 또는 남은 row 모두 사유 분류.
   - 의존성: 실제 주문 발생량.

### 최신 관측과 판단

기준 source/window/freshness/confidence:

- source: VM Cloud `funnel-health` live API, site=`biocom`, cached source=`in_memory_precompute`.
- 기준 시각: 2026-05-17 11:34 KST.
- freshness: fresh, confidence: medium_high.

관측값:

- 최근 7일 missing queue: 14건 / 3,354,485원.
- 최근 1일 missing queue: 0건 / 0원.
- 2026-05-17 11:29 KST에는 최근 1일 3건 / 747,200원이 잠깐 보였지만, 2026-05-17 11:34 KST precompute에서는 current missing queue에서 사라졌다.
- 최근 7일 14건에는 2026-05-14~2026-05-15 incident backlog가 포함된다.

판단:

- 2026-05-17 이후 주문을 기준으로 보는 것이 현재 코드 품질 판단에는 더 맞다.
- 2026-05-14~2026-05-15를 안 보는 것이 아니라, `legacy backlog`로 따로 보관해야 한다.
- 2026-05-16은 VM Cloud 보강이 섞인 전환일이라 trend 참고용으로만 둔다.
- 따라서 Phase1-Sprint2의 daily KPI는 5/17 이후 current window를 기준으로 한다.
- 5/14~5/15는 Meta ROAS 오염 위험 때문에 backfill하지 않고, 과거 장애 기록으로만 보관한다.

### 현재 진척률

현재 진척률: 92%.

### 완료한 것

- `/conversion-funnel` action queue에 `결제완료가 있는데 Meta CAPI 전송 기록이 없음` 카드가 생겼다.
- 카드 클릭 시 상세 row를 펼치는 방향으로 개선했다.
- safe_ref 기준 상세를 쓰고 raw order/payment/click/member 값은 문서와 화면에 노출하지 않는다.
- 5/17 이후 current monitor 기준으로 최신 missing queue가 0건 / 0원임을 확인했다.
- 5/17 11:29 KST에 잠깐 보였던 3건 / 747,200원은 11:34 KST precompute에서 사라져, current monitor는 다음 sync 후 재확인 방식이 맞다는 근거가 생겼다.
- 5/14~5/15는 현재 코드 품질 판단이 아니라 legacy backlog로 분리하는 기준을 세웠다.
- 5/14~5/15 legacy backlog는 Meta ROAS 오염 위험 때문에 backfill하지 않기로 결정했다.
- Phase1-Sprint2의 계획을 완료/미완료로 분리했다.

### 아직 완료되지 않은 것

- 5/17 이후 current monitor가 48~72시간 연속 안정적인지 확인해야 한다.
- legacy backlog UI 문구가 여전히 `backfill 후보`처럼 읽히는 부분은 다음 화면/API contract 수정 때 `do_not_backfill`로 바꿔야 한다.
- 새 current 누락 row가 생길 경우, transient sync wait인지 진짜 CAPI 누락인지 자동 분류하는 기준을 화면에 더 명확히 보여줘야 한다.

### 100% 조건

- 5/17 이후 current window에서 `confirmed_but_no_capi_send`가 48~72시간 동안 0이거나, 생긴 row가 모두 사유별로 닫힌다.
- 5/14~5/15 legacy backlog는 `legacy_do_not_backfill`로 보관되고 Meta CAPI Purchase로 전송되지 않는다.
- 실제 backfill send 0.

### 역할 구분

- TJ: 현재는 추가 승인할 일이 없다. backfill은 하지 않는 것으로 결정했다.
- Codex: 5/17 이후 current monitor, legacy no-backfill 문구 정리, no-send guard 검증을 담당한다.
- Claude Code: action queue 상세 화면과 문구를 담당한다.

## Phase2-Sprint3

**이름**: Browser Purchase 보조 검증 복구

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

이 Sprint는 **브라우저에서도 Purchase가 보이는지 확인하되, 절대 무조건 쏘지 않게 하는 작업**이다.
Server CAPI가 이미 구매를 보냈다면 Browser Purchase는 필수 매출 복구 수단이 아니라 보조 검증 신호다.
따라서 실제 결제완료이고 payment-decision이 allow_purchase를 줄 때만 통과시킨다.

### 왜 하는가

Meta Events Manager에서는 browser/server source와 dedup 상태를 같이 보여준다.
Browser Purchase가 안정적으로 보이면 Meta UI 해석이 쉬워진다.
하지만 잘못 추가하면 같은 주문을 두 번 보낼 수 있으므로, 복구보다 중복 방지가 먼저다.

### 어떻게 개발하는가

1. Header Guard가 Purchase 시도 전에 payment-decision을 호출한다.
2. payment-decision이 `allow_purchase`를 반환하면 원래 Browser Purchase를 통과시킨다.
3. pending/unknown/fetch failure이면 fail-open하지 않는다.
4. 가상계좌/미입금은 Purchase가 아니라 VirtualAccountIssued 또는 block으로 낮춘다.
5. v3.1.1 cache는 실패 응답이 allow cache를 덮어쓰지 않게 한다.
6. 다음 실제 결제에서 Network, Meta Pixel Helper, VM Cloud CAPI send log를 함께 본다.

### 개발 계획

#### 완료된 개발/설계

1. [Codex] Header Guard v3.1.1 코드와 수동 체크리스트를 만들었다.
   - 무엇: 결제완료 판단 응답이 실패했을 때 실패 캐시가 2분 동안 남지 않도록 설계했다.
   - 왜: 실패 캐시가 남으면 실제 결제완료도 Browser Purchase가 막힐 수 있다.
   - 어떻게: canonical cache key, tolerant response parser, failure no-cache 정책을 Header Guard v3.1.1 코드에 반영했다.
   - 산출물: `gptconfirm/gpt0515-19-header-guard-v31-1-code/02-header-guard-v31-1-code.md`, `03-test-checklist.md`.
   - 검증: 문서/체크리스트 기준 준비 완료. 실제 아임웹 적용 여부와 다음 결제 관찰은 별도 확인.
   - 의존성: TJ님 아임웹 헤더 적용과 실제 결제완료 화면 관찰.

2. [Codex] Browser Purchase와 Server CAPI를 분리해 보는 read-only monitor를 만들었다.
   - 무엇: VM Cloud의 `/api/attribution/funnel-health` 집계만 읽어 결제완료, Server CAPI 성공, Browser Purchase 0, payment-decision latency를 한 번에 판단한다.
   - 왜: Browser Purchase가 0이어도 Server CAPI가 성공하면 운영 매출 누락과 보조 신호 누락을 구분해야 한다.
   - 어떻게: `scripts/meta-browser-purchase-phase2-sprint3-monitor.sh`가 no-send/no-write/no-deploy 상태로 aggregate JSON을 만든다.
   - 산출물: `capivm/meta-browser-purchase-phase2-sprint3-monitor-runbook-20260517.md`, `data/project/meta-browser-purchase-phase2-sprint3-monitor-*.json`.
   - 검증: `jq` JSON parse, runbook wiki link, harness preflight, raw identifier scan으로 확인한다.
   - 의존성: VM Cloud `funnel-health` API 응답.

#### 남은 개발/검증

1. [Codex] payment-decision latency 샘플이 실제 결제 후 채워지는지 모니터링한다.
   - 무엇: p50/p95와 `allow_purchase`, `block_purchase_virtual_account`, `unknown` 분포를 본다.
   - 왜: payment-decision이 느리거나 비면 Browser Purchase가 계속 막힐 수 있다.
   - 어떻게: 위 monitor를 실제 주문 직후 1d window로 실행하고, `payment_decision_latency.available=true` 여부를 본다.
   - 산출물: `data/project/meta-browser-purchase-phase2-sprint3-monitor-<timestamp>.json`.
   - 검증: `allow_purchase` 샘플이 있고 p95가 1초 안팎이면 안정. 샘플이 없으면 다음 실제 결제까지 대기.
   - 의존성: 실제 결제완료 또는 payment-decision 호출 발생.

2. [TJ] 실제 결제완료 화면에서 Browser Purchase UI를 보조로 확인한다.
   - 무엇: Chrome Network `facebook.com/tr` 또는 Meta Pixel Helper에서 `ev=Purchase`가 1회 보이는지 확인한다.
   - 왜: Meta UI에서 Browser/Server dedup 품질을 해석하려면 브라우저 신호도 있으면 좋다.
   - 어떻게: 실제 결제완료 직후 Network 필터 `facebook.com/tr`로 `ev=Purchase`를 본다. 단, diagnostic Purchase를 따로 보내지는 않는다.
   - 산출물: 화면 캡처 또는 관찰 결과.
   - 검증: `ev=Purchase` 1회면 보조 검증 PASS. 0이어도 Server CAPI success가 있으면 운영 누락과 분리.
   - 의존성: 실제 결제완료 화면 접근. Codex는 TJ님 브라우저/Meta UI 로그인 화면을 직접 볼 수 없다.

3. [Codex] Browser Purchase가 계속 0이면 guarded fallback 승인안을 별도로 만든다.
   - 무엇: cached `allow_purchase`가 있을 때만 Browser Purchase를 보낼 수 있는 제한 fallback을 설계한다.
   - 왜: 무조건 Purchase를 보내면 같은 주문 중복과 ROAS 오염이 생긴다.
   - 어떻게: no-send 설계와 test-only 계획까지만 Green으로 만들고, 실제 발화는 Red 승인 전 중지한다.
   - 산출물: approval packet.
   - 검증: pending/unknown/failure fail-open 0, duplicate event_id 0.
   - 의존성: Browser Purchase 0이 반복되고, Server CAPI만으로 Meta UI 해석이 부족하다는 판단.

### 현재 진척률

현재 진척률: 66%.

### 현재 판단

- Browser Purchase가 보이지 않아도 Server CAPI가 성공하면 운영 매출 누락은 1차로 해소된다.
- 같은 주문에 diagnostic Purchase를 추가로 보내면 중복 위험이 있다.
- 따라서 Browser Purchase는 `다음 실제 결제에서 관찰`, `test-only`, `guarded fallback` 순서로 접근한다.
- 2026-05-17 기준 read-only monitor/runbook은 준비됐다. 다만 payment-decision 샘플은 backend restart 이후 실제 호출이 있어야 채워진다.

### 100% 조건

- payment-decision allow_purchase가 1초 안팎으로 안정 반환된다.
- cached allow_purchase가 있으면 Header Guard가 Purchase를 통과시킬 수 있다.
- unknown/fetch failure/pending은 fail-open하지 않는다.

### 역할 구분

- TJ: 실제 결제 UI와 Meta Pixel Helper/Events Manager 확인이 필요한 경우 관찰한다.
- Codex: Header Guard, payment-decision, latency, CAPI 성공 대조를 담당한다.
- Claude Code: 해당 없음.

## Phase2-Sprint4

**이름**: 중간 퍼널 Browser 이벤트 안정화

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

이 Sprint는 **구매 전 단계가 화면에서 비어 보이지 않게 만드는 작업**이다.
사용자가 유입된 뒤 장바구니까지 갔는지, 결제 시작까지 갔는지, 결제수단 선택까지 갔는지 알 수 있어야 한다.
이 단계들은 구매가 아니므로 Purchase와 분리해 보여준다.

### 왜 하는가

장바구니나 결제 시작이 0으로 보이면 어디서 이탈하는지 판단할 수 없다.
광고가 문제인지, 랜딩이 문제인지, 결제 페이지가 문제인지 구분하려면 중간 퍼널 단계가 필요하다.
또 Meta가 native Pixel로 놓치는 이벤트가 있으면 fallback으로 보완해야 한다.

### 어떻게 개발하는가

1. PageView/ViewContent는 기존 FBE/native Pixel을 우선한다.
2. AddToCart/InitiateCheckout/AddPaymentInfo가 Network에서 안 보이면 Block 4 fallback이 보완한다.
3. VM Cloud 코드만으로 새 클릭 이벤트를 과거에 만들 수 없으므로, 장바구니 단계는 우선 `장바구니 페이지 진입`으로 정의한다.
4. funnel-health는 `전체 주문 퍼널`과 `광고 귀속 퍼널`을 분리한다.
5. Purchase는 Block 4에서 절대 발화하지 않는다.

### 개발 계획

#### 완료된 개발

1. [Codex][완료] 장바구니 단계의 기준을 `장바구니 페이지 진입`으로 정했다.
   - 무엇: 장바구니 담기 클릭이 아니라 VM Cloud 고객 유입 장부의 `/shop_cart` 진입 row를 장바구니 단계의 1차 기준으로 쓴다.
   - 왜: 아임웹 코드나 GTM을 새로 건드리지 않아도, VM Cloud에 이미 남은 페이지 진입 row만으로 장바구니 단계가 0으로 비는 문제를 줄일 수 있다.
   - 어떻게: `siteLandingEvidence.cartPageViews` contract에 source, unit, `/shop_cart` path pattern, total, source별 count, series, caveat를 넣는다.
   - 산출물: `backend/src/funnelHealth.ts`의 `cartPageViews` contract.
   - 검증: 로컬 fixture에서 `landing=100`, `장바구니 페이지 진입=7`로 표시되는 테스트를 추가했다.
   - 의존성: VM Cloud `site_landing_ledger`에 `/shop_cart` row가 있어야 live 숫자가 보인다.
2. [Codex][완료] funnel-health 단계명을 `장바구니 페이지 진입`으로 명확히 표시했다.
   - 무엇: 화면/API에서 `add_to_cart` 단계를 `장바구니 페이지 진입`으로 보여준다.
   - 왜: 지금 기준은 “장바구니 담기 버튼 클릭”이 아니라 “장바구니 페이지에 실제로 들어간 흔적”이므로 이름이 정확해야 한다.
   - 어떻게: `FUNNEL_STEP_LABELS.add_to_cart`를 `장바구니 페이지 진입`으로 정의하고, metric contract에 `first-party cart page landing row`와 caveat를 붙였다.
   - 산출물: funnel-health API label/metric contract.
   - 검증: 로컬 test에서 `add_to_cart` label이 `장바구니 페이지 진입`인지 확인한다.
   - 의존성: frontend가 backend label/metric contract를 그대로 읽어야 한다.
3. [Codex][완료] `ViewContent`를 장바구니 fallback에서 제외했다.
   - 무엇: VM Cloud에 `/shop_cart` 증거가 없을 때 fallback으로 쓰는 event row를 `AddToCart`만 세도록 좁혔다.
   - 왜: `ViewContent`는 상품 조회이지 장바구니가 아니다. 이 둘을 섞으면 장바구니 단계가 좋아 보이지만 실제 장바구니 행동은 아니다.
   - 어떻게: `isAddToCartEntry`에서 `ViewContent`를 제거하고, fallback caveat도 `AddToCart event row`로 수정했다.
   - 산출물: `backend/src/funnelHealth.ts`, `backend/tests/funnel-health.test.ts`.
   - 검증: `ViewContent` 1건 + `AddToCart` 1건이 있어도 장바구니 fallback은 1건만 세는 fixture를 추가했다.
   - 의존성: 없음.
4. [Codex][완료] 전체 주문 퍼널과 광고 귀속 퍼널의 장바구니 기준을 분리했다.
   - 무엇: 전체 퍼널은 `/shop_cart` 전체 row를, 광고 귀속 퍼널은 Meta/Google/Naver/UTM 있음 bucket의 `/shop_cart` row만 쓴다.
   - 왜: 전체 주문 흐름과 광고 클릭 evidence가 붙은 흐름은 모수가 다르다. 둘을 섞으면 광고 link capture 품질을 판단할 수 없다.
   - 어떻게: `funnel_views.all_traffic`과 `funnel_views.paid_attributed`에서 `cartPageViews.byFunnelSource`를 각각 다르게 적용한다.
   - 산출물: funnel-health `funnel_views` contract.
   - 검증: source별 cart page view count가 있을 때 paid 퍼널이 전체보다 작게 나올 수 있는 구조가 준비됐다.
   - 의존성: VM Cloud source classification freshness.
5. [Codex][완료] VM Cloud live API에서 장바구니 페이지 진입 숫자가 실제로 나오는지 확인했다.
   - 무엇: 운영 화면이 읽는 `/api/attribution/funnel-health?site=biocom&window=7d`를 read-only로 조회했다.
   - 왜: 로컬 fixture만으로는 실제 `/conversion-funnel` 화면에서 장바구니가 0이 아닌지 알 수 없다.
   - 어떻게: live response의 `funnel.add_to_cart`, `site_landing_evidence.cart_page_views`, `metric_contract.metrics.cart_page_view`를 확인했다.
   - 산출물: 2026-05-17 12:09 KST 기준 live read-only 확인 결과.
   - 검증: 최근 7일 바이오컴 `장바구니 페이지 진입` 28건, source=`VM Cloud site_landing_ledger`, unit=`first_party_cart_page_landing_row`, path=`/shop_cart`.
   - 의존성: VM Cloud precompute cache. 당시 cache 기준 시각은 2026-05-17 12:09 KST, confidence=high.

#### 남은 개발 / 운영 확인

1. [Codex][남음] 로컬 `ViewContent` 제외 guard를 VM Cloud 반영 후보로 둔다.
   - 무엇: fallback 증거가 필요할 때 `ViewContent`를 장바구니로 세지 않고 `AddToCart`만 세는 로컬 보강을 live에도 맞춘다.
   - 왜: live는 현재 `/shop_cart` 증거가 있어 장바구니가 28건으로 보이지만, 특정 window/source에서 `/shop_cart` 증거가 빠지면 fallback이 동작한다. 이때 상품 조회가 장바구니로 부풀려지면 안 된다.
   - 어떻게: 배포 승인 시 `backend/src/funnelHealth.ts`의 `isAddToCartEntry`와 metric caveat 변경을 VM Cloud에 반영한다.
   - 산출물: VM Cloud post-check에서 fallback unit=`AddToCart event row`.
   - 검증: `ViewContent`는 `browser_funnel_health`의 상품 조회로만 남고, main funnel 장바구니 fallback에는 들어가지 않는다.
   - 의존성: Yellow deploy 승인. 현재 live main path는 `/shop_cart`라 긴급도는 낮다.
2. [Claude Code][남음] 화면 설명을 “장바구니 담기 클릭”이 아니라 “장바구니 페이지 진입”으로 맞춘다.
   - 무엇: `/conversion-funnel`의 단계 설명, 툴팁, CSV label에서 이 단계가 무엇을 뜻하는지 쉽게 보이게 한다.
   - 왜: 사용자가 `장바구니 0`을 “Meta AddToCart가 0”으로 오해하면 잘못된 조치를 할 수 있다.
   - 어떻게: backend metric contract의 `cart_page_view.caveat`를 화면에서 보여주고, 펼침 패널에 “아임웹/GTM 수정 없이 VM Cloud가 받은 /shop_cart 진입 row”라고 설명한다.
   - 산출물: frontend 문구/툴팁.
   - 검증: TJ님이 화면에서 `장바구니 페이지 진입`과 `Meta AddToCart`의 차이를 바로 이해한다.
   - 의존성: Codex data contract.
3. [Codex][남음] Browser fallback Network 증거는 보조로 계속 분리한다.
   - 무엇: Meta Pixel Helper/Network 기준 AddToCart/InitiateCheckout/AddPaymentInfo 발화 여부는 별도 `browser_funnel_health`로 유지한다.
   - 왜: VM Cloud 장바구니 페이지 진입은 내부 원장 기준이고, Meta Pixel의 AddToCart 발화는 광고 플랫폼 수신 기준이다. 둘은 같은 숫자가 아니어야 정상이다.
   - 어떻게: `browser_funnel_health`에는 eventName별 count를, main funnel에는 `/shop_cart` page row를 표시한다.
   - 산출물: 내부 퍼널과 Browser Pixel health의 분리된 설명.
   - 검증: Purchase 추가 발화 0, Browser fallback 단계만 별도 표시.
   - 의존성: Block 4 fallback 유지.

### 현재 진척률

현재 진척률: 90%.

해석: 로컬 backend contract와 fixture, 그리고 VM Cloud live read-only 조회 기준으로 장바구니 단계 0 문제는 닫혔다.
다만 `ViewContent` 제외 fallback guard의 VM Cloud 반영과 frontend 문구 확인이 남아 있어 100%로 올리지는 않는다.

### 완료한 것

- AddToCart / InitiateCheckout / AddPaymentInfo fallback을 Block 4에서 발화하도록 설계/적용했다.
- Purchase는 fallback 대상에서 제외했다.
- VM Cloud 코드만으로는 기존 과거 클릭 이벤트를 새로 만들 수 없으므로, 장바구니 단계는 `장바구니 페이지 진입` 기준으로 표시하는 방향을 택했다.
- 로컬 funnel-health contract에 `/shop_cart` 장바구니 페이지 진입 evidence를 추가했다.
- `ViewContent`는 상품 조회이므로 장바구니 fallback에서 제외했다.
- `전체 주문 퍼널`과 `광고 귀속 퍼널`이 장바구니 페이지 진입 row를 서로 다른 모수로 볼 수 있게 했다.
- VM Cloud live read-only 조회에서 최근 7일 바이오컴 장바구니 페이지 진입 28건을 확인했다.

### 100% 조건

- funnel-health에서 장바구니 페이지 진입 단계가 0이 아닌 실제 row로 표시된다.
- AddToCart browser fallback은 Meta Pixel Helper/Network에서 확인 가능하다.
- Purchase 추가 발화 0.

### 역할 구분

- TJ: 별도 할 일 없음. 실제 화면에서 의미가 헷갈리면 문구 피드백만 준다.
- Codex: VM Cloud 원장 집계와 funnel-health 단계 정의를 담당한다.
- Claude Code: 화면 문구와 UI 표시를 담당한다.

## Phase2-Sprint5

**이름**: Purchase 외 중간 전환 CAPI 확장

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

이 Sprint는 **구매 전 행동도 서버 신호로 Meta에 보낼 준비를 하는 작업**이다.
대상은 장바구니, 결제 시작, 결제수단 선택, 회원가입, 50% 스크롤이다.
이 신호들은 Purchase가 아니라 Meta가 학습할 수 있는 보조 전환 신호다.

### 왜 하는가

- Purchase만 보내면 Meta가 학습할 표본이 적다.
- 구매 전 행동을 서버 신호로 보완하면 Meta가 실제 구매 가능성이 높은 유입을 더 빨리 학습할 수 있다.
- 단, 중간 전환 신호는 실제 매출이 아니므로 Purchase ROAS와 섞으면 안 된다.

### 어떻게 개발하는가

1. 각 중간 행동을 VM Cloud 원장에 먼저 저장한다.
2. 저장할 때 `purchase_candidate=false`로 명확히 둔다.
3. Meta CAPI payload preview를 만든다.
4. payload에는 raw order/payment/member/click id를 넣지 않는다.
5. health/wellness 제한을 고려해 URL, 콘텐츠명, custom_data를 최소화한다.
6. Test Events에서 1건 이하로 server source 수신을 확인한다.
7. 실제 운영 전송은 event별 Red 승인 후 staged ON한다.

### 대상 이벤트

- `AddToCart`: 장바구니 담기 또는 장바구니 페이지 진입.
- `InitiateCheckout`: 결제 시작 또는 주문서/결제 페이지 진입.
- `AddPaymentInfo`: 결제수단 선택.
- `CompleteRegistration`: 회원가입 완료.
- `Scroll50`: 50% 스크롤. health/wellness 제한과 custom event 정책을 확인한 뒤 전송 여부를 결정한다.

### 완료된 개발

1. [Codex] event별 no-send payload preview 스크립트를 만들었다.
   - 무엇: AddToCart, InitiateCheckout, AddPaymentInfo, CompleteRegistration, Scroll50을 각각 preview row로 분리한다.
   - 왜: 실제 Meta 전송 전에 어떤 이벤트가 준비됐고 어떤 이벤트가 아직 source gap인지 사람이 볼 수 있어야 한다.
   - 어떻게: VM Cloud `funnel-health` aggregate API를 읽고, event별 `send_allowed=false`, `purchase_candidate=false`, `included_in_purchase_roas=false`를 강제한 JSON을 생성한다.
   - 산출물: `scripts/meta-intermediate-capi-phase2-sprint5-preview.sh`
   - 검증: `PREVIEW_READY_NO_SEND`, raw identifier output 0, external send 0.
   - 의존성: VM Cloud funnel-health API cache가 정상이어야 한다.
2. [Codex] 중간 전환 runbook을 만들었다.
   - 무엇: event별 무엇/왜/어떻게/전송 게이트/실패 조건을 문서화했다.
   - 왜: Test Events나 staged ON은 Meta에 실제 이벤트를 보내므로, 승인 전에 기준이 있어야 한다.
   - 어떻게: `AddToCart`와 `InitiateCheckout`은 preview-ready, `AddPaymentInfo`는 source gap, `CompleteRegistration`과 `Scroll50`은 route/source 미준비로 분리했다.
   - 산출물: `capivm/meta-intermediate-capi-phase2-sprint5-preview-runbook-20260517.md`
   - 검증: wiki link validation 대상에 포함.
   - 의존성: 실제 smoke는 TJ님 승인 필요.
3. [Codex] AddPaymentInfo source gap audit을 완료했다.
   - 무엇: 결제수단 선택 신호가 왜 VM Cloud funnel-health에서 0으로 보이는지 source별로 분리했다.
   - 왜: AddPaymentInfo는 구매 직전 의도가 강하지만, source가 닫히지 않은 상태에서 Meta CAPI로 보내면 중간 전환과 Purchase 기준이 섞인다.
   - 어떻게: VM Cloud funnel-health 1d/7d cached API, 로컬 backend `funnelHealth`/`metaCapi` route, GTM export를 read-only로 대조했다.
   - 결론: 바이오컴 GTM에는 GA4/NPay 의도성 `add_payment_info`가 있지만, VM Cloud ledger의 `metadata.eventName=AddPaymentInfo`로 저장되는 경로는 없다.
   - 산출물: `capivm/addpaymentinfo-source-gap-audit-20260517.md`, `data/project/addpaymentinfo-source-gap-audit-20260517.json`
   - 검증: source gap은 `VM Cloud 저장 경로 없음`으로 닫혔고, Meta send/GTM publish/VM Cloud deploy/운영DB write는 모두 0.
   - 의존성: 다음 개발은 no-send intermediate-event endpoint가 필요하다.
4. [Codex] CompleteRegistration / Scroll50 route 설계를 완료했다.
   - 무엇: 회원가입 완료와 50% 스크롤을 Meta CAPI 후보로 만들 수 있는지 GTM source와 route를 분리했다.
   - 왜: 두 이벤트는 구매가 아니지만 Meta 학습 보조 신호가 될 수 있다. 다만 건강/웰빙 제한과 Purchase ROAS 오염을 피해야 한다.
   - 어떻게: GTM export에서 바이오컴 회원가입 태그/트리거와 scrollDepth trigger를 확인하고, VM Cloud no-send receiver -> payload preview -> Test Events smoke -> staged ON 순서로 설계했다.
   - 결론: CompleteRegistration은 source가 있어 첫 후보로 적합하고, Scroll50은 trigger 재료는 있지만 너무 넓은 engagement 신호라 내부 관찰부터 시작하는 것이 맞다.
   - 산출물: `capivm/complete-registration-scroll50-route-design-20260517.md`
   - 검증: GTM Production publish 0, Meta send 0, VM Cloud deploy 0.
   - 의존성: no-send endpoint 로컬 구현과 GTM preview/approval packet.

### 남은 개발 / 승인 필요

1. [Codex] VM Cloud no-send intermediate-event endpoint를 설계/로컬 구현한다.
   - 무엇: AddPaymentInfo, CompleteRegistration, Scroll50 같은 중간 전환을 Meta로 보내지 않고 VM Cloud에만 저장하는 endpoint를 만든다.
   - 왜: GTM이나 아임웹에서 바로 Meta CAPI send route를 호출하면 실제 외부 전송이 될 수 있다. 먼저 `purchase_candidate=false`로 안전하게 저장해야 한다.
   - 어떻게: `POST /api/attribution/intermediate-event` 후보 contract를 만들고, event allowlist, source/unit/window/site/pixel_id, no-send status, raw identifier mask를 적용한다.
   - 산출물: backend route patch + fixture + 배포 승인안.
   - 검증: VM Cloud 로컬/테스트에서 중간 event row는 저장되지만 Meta send count는 0.
   - 의존성: AddPaymentInfo source gap audit과 CompleteRegistration/Scroll50 route design.
2. [Codex] GTM 호출은 publish 전 preview/runbook으로만 준비한다.
   - 무엇: GTM이 새 no-send endpoint를 호출할 수 있는 payload와 trigger 조건을 preview용으로 문서화한다.
   - 왜: Production publish는 Red Lane이고, 중간 전환도 광고 플랫폼에 영향을 줄 수 있으므로 먼저 shape만 확인해야 한다.
   - 어떻게: 회원가입 완료 trigger, scrollDepth 50% trigger, 결제수단 선택 source 후보를 각각 preview checklist로 분리한다.
   - 산출물: GTM preview approval packet.
   - 검증: publish 0, Meta send 0, VM Cloud no-send endpoint call shape PASS.
   - 의존성: no-send endpoint 구현.
3. [TJ] Meta Test Events smoke 1건 이하를 승인한다.
   - 무엇: event별 server source가 Meta Test Events 화면에 보이는지 1건 이하로 확인한다.
   - 왜: preview만으로는 Meta가 실제로 받을 수 있는지 알 수 없다.
   - 어떻게: 승인된 event 하나만 test_event_code로 보내고, 운영 Purchase count 변화 0을 확인한다.
   - 산출물: Test Events smoke 결과.
   - 검증: server event 1건 이하, Purchase count/value 변화 0.
   - 의존성: TJ님 Meta UI 확인 또는 test code 제공.
4. [Codex] ON 이후 내부 confirmed ROAS와 Ads attributed ROAS 변화를 비교한다.
   - 무엇: 중간 전환을 켠 뒤 Meta 광고 효율이 실제로 개선됐는지 본다.
   - 왜: 중간 이벤트는 ROAS에 직접 더하면 안 되고, 학습 품질 개선 효과만 비교해야 한다.
   - 어떻게: staged ON 전/후 3~7일로 CAPI 수신, Ads attributed purchase, 내부 confirmed ROAS를 비교한다.
   - 산출물: 전/후 비교표.
   - 검증: Purchase/ROAS 오염 0.
   - 의존성: Test Events smoke PASS와 event별 staged ON 승인.

### 현재 진척률

현재 진척률: 52%.

해석: no-send preview와 source/route audit은 끝났지만, 아직 VM Cloud no-send 저장 endpoint와 GTM preview가 없으므로 운영 전송 준비 단계로는 절반을 조금 넘긴 상태다.

### 100% 조건

- Purchase 외 중간 이벤트가 Meta Events Manager에 server source로 보인다.
- 중간 이벤트가 Purchase count/value/ROAS에 섞이지 않는다.
- 건강/웰빙 제한을 고려한 URL/custom_data 최소화가 반영된다.
- event별 전송 ON/OFF와 rollback 기준이 문서화된다.

### 역할 구분

- TJ: Test Events smoke와 실제 Meta CAPI staged ON을 승인한다.
- Codex: capture contract, payload preview, no-send guard, approval packet을 담당한다.
- Claude Code: 화면에서 중간 전환 신호와 Purchase를 구분해 보여주는 UI를 담당한다.

## Phase2-Sprint6

**이름**: `/conversion-funnel`과 ROAS 화면 data contract/cache 안정화

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

이 Sprint는 **전환 퍼널 화면과 ROAS 화면을 빠르고 믿을 수 있게 만드는 작업**이다.
기본 화면은 어제 사전 계산값을 즉시 보여주고, 당일 데이터는 별도 버튼으로 본다.
각 숫자는 어떤 source, 어떤 기간, 어떤 단위인지 표시한다.

### 왜 하는가

- 화면이 오래 걸리면 운영자가 숫자를 믿기 어렵다.
- 오늘/어제/최근 7일의 기준이 섞이면 ROAS 판단이 흔들린다.
- Meta CAPI, Browser Pixel, VM Cloud 원장, Ads Manager 주장값은 source와 unit이 다르므로 화면에서 명시해야 한다.

### 어떻게 개발하는가

1. funnel-health와 roas-summary를 사전 계산 cache 중심으로 읽는다.
2. 기본 화면은 어제 데이터를 먼저 보여준다.
3. 당일 데이터는 4시간 단위 cache를 읽는다.
4. 강제 새로고침은 cooldown을 둔다.
5. `/api/ads/roas`가 500이어도 화면 전체가 멈추지 않게 한다.
6. 내부 confirmed ROAS와 광고 플랫폼 주장 ROAS를 다른 카드로 보여준다.

### 현재 반영된 것

- funnel-health는 site/pixel filter와 precompute/cache를 갖는다.
- roas-summary도 precompute/cache 구조로 전환했다.
- 기본 화면은 사전 계산값을 보여주는 방향으로 바뀌고 있다.

### 개발 계획

1. [Codex] backend cache fallback과 no-data state를 점검한다.
   - 산출물: roas-summary/funnel-health fallback rule.
   - 검증: 하나의 API 500이 전체 화면 로딩을 막지 않는다.
   - 의존성: VM Cloud backend.
2. [Claude Code] 기본 화면을 어제 데이터 중심으로 정리한다.
   - 산출물: 기준 날짜, 다음 갱신 시각, 당일 데이터 버튼.
   - 검증: 첫 화면이 사전 계산값으로 열린다.
   - 의존성: backend cache metadata.
3. [Codex] 당일 데이터 4시간 cache를 data contract에 고정한다.
   - 산출물: window/source/freshness contract.
   - 검증: today 호출이 실시간 hammer를 만들지 않는다.
   - 의존성: precompute worker.
4. [Claude Code] 각 카드에 쉬운 용어를 붙인다.
   - 산출물: `내부 confirmed ROAS`, `광고 플랫폼 주장 ROAS`, `참고용 보조 신호`.
   - 검증: TJ님이 예산 판단용/참고용을 구분할 수 있다.

### 현재 진척률

현재 진척률: 80%.

### 100% 조건

- `/conversion-funnel` 첫 화면이 500ms 안팎으로 열린다.
- 기본 화면에는 기준 데이터 날짜와 다음 갱신 시각이 보인다.
- 당일 데이터는 4시간 단위 cache 기준으로만 표시되고, 실시간 호출은 강제 새로고침으로 분리된다.
- `roas-summary` 또는 `ads/roas` 일부 실패가 화면 전체 로딩을 막지 않는다.
- 각 지표가 `내부 confirmed ROAS`, `광고 플랫폼 주장 ROAS`, `참고용 보조 신호` 중 무엇인지 구분된다.

### 역할 구분

- TJ: 화면 문구가 의사결정에 충분한지 피드백한다.
- Codex: backend data contract, cache fallback, API smoke를 담당한다.
- Claude Code: 화면 레이아웃, 버튼, 기준 시각 표시, 오류 상태 UI를 담당한다.

## Phase3-Sprint5

**이름**: Meta Events Manager UI 검증

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

이 Sprint는 **VM Cloud에서는 성공이라고 보이는 구매 신호가 Meta 화면에서도 정상 수신되는지 확인하는 작업**이다.
서버 로그와 Meta UI가 다르게 보일 때, 지연인지 제한인지 필터 문제인지 구분한다.

### 왜 하는가

VM Cloud의 `events_received=1`은 Meta가 이벤트를 받았다는 중요한 근거다.
하지만 Ads Manager 구매 수나 ROAS에 바로 보인다는 뜻은 아니다.
Meta UI에서 data source restriction, match quality, freshness, purchase-family action key를 같이 확인해야 한다.

### 어떻게 개발/운영하는가

1. Codex는 Graph API나 VM Cloud 로그로 가능한 부분을 먼저 확인한다.
2. UI 권한이 필요한 부분만 TJ님이 Meta Events Manager에서 본다.
3. 확인 결과를 `지연`, `제한`, `필터`, `action key mismatch`, `정상` 중 하나로 분류한다.
4. 같은 체크 순서를 runbook으로 고정한다.

### 확인할 화면

- Events Manager -> 바이오컴 Pixel -> 이벤트 개요.
- Event Match Quality.
- 데이터 신선도.
- 진단.
- 데이터 소스 제한 / 건강 및 웰빙 category 상세.

### 개발 계획

1. [Codex] Meta API read-only로 purchase-family action key를 먼저 조회한다.
   - 산출물: action key breakdown.
   - 검증: Ads Manager 0이 key mismatch인지 확인.
   - 의존성: API rate limit/권한.
2. [TJ] Meta Events Manager UI에서 data restriction과 recent activity를 확인한다.
   - 이유: 일부 화면은 로그인/2FA가 필요하다.
   - 산출물: UI 상태 캡처 또는 텍스트 결과.
   - 검증: Server CAPI Purchase recent activity 확인.
3. [Codex] UI/API/VM Cloud 결과를 하나의 원인표로 합친다.
   - 산출물: lag/restriction/filter/mismatch 판정.
   - 검증: 다음 액션이 Red/Green으로 분리된다.

### 현재 진척률

현재 진척률: 45%.

### 100% 조건

- Server CAPI Purchase recent activity가 보인다.
- data sharing restriction 영향 범위를 확인한다.
- Ads Manager raw purchase-family key 0이 same-day lag인지 제한/연결 문제인지 구분한다.

### 역할 구분

- TJ: Meta UI 로그인/2FA가 필요한 화면을 확인한다.
- Codex: API read-only 조회와 원인 분류를 담당한다.
- Claude Code: 해당 없음.

## Phase3-Sprint6

**이름**: Test Events smoke와 외부 전송 준비 분리

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

이 Sprint는 **운영 구매 수를 늘리지 않고 Meta가 이벤트를 받을 수 있는지 테스트하는 작업**이다.
실제 광고 계정 수치에 영향을 주지 않도록 test_event_code를 쓰고, 1건 이하로 제한한다.

### 왜 하는가

운영 Purchase를 테스트로 늘리면 ROAS와 학습 신호가 오염된다.
하지만 Test Events smoke 없이 바로 운영 전송을 켜면 수신 실패나 dedup 실패를 늦게 발견한다.
그래서 test-only와 운영 send를 문서와 절차에서 분리한다.

### 어떻게 개발/운영하는가

1. event별 payload preview를 만든다.
2. test_event_code가 있을 때만 Meta Test Events로 1건 이하 전송한다.
3. 운영 Purchase count가 증가하지 않는지 pre/post로 확인한다.
4. pass한 payload만 staged ON 승인 후보가 된다.

### 원칙

- test_event_code 없이 Purchase 테스트를 보내지 않는다.
- 운영 Purchase count delta 0을 pre/post로 확인한다.
- smoke는 1건 이하로 제한한다.
- 실제 운영 send/backfill은 별도 Red 승인 전 금지다.

### 개발 계획

1. [Codex] Test Events payload preview를 만든다.
   - 산출물: event별 payload preview.
   - 검증: raw identifier 0, Purchase/중간 이벤트 분리.
   - 의존성: KR8 payload contract.
2. [TJ] test_event_code를 제공하거나 Meta UI에서 Test Events 탭을 연다.
   - 이유: Meta UI 로그인/권한이 필요하다.
   - 산출물: test_event_code 또는 UI 확인.
   - 검증: 운영 count delta 0.
3. [Codex] 1건 이하 smoke 결과를 PASS/PARTIAL/BLOCKED로 기록한다.
   - 산출물: smoke result.
   - 검증: events_received 또는 Test Events UI 수신.

### 현재 진척률

현재 진척률: 55%.

### 100% 조건

- Test Events에서 이벤트가 보인다.
- 운영 이벤트 카운트는 늘지 않는다.
- eventID/dedup 기준이 문서화된다.

### 역할 구분

- TJ: test_event_code 제공 또는 Meta UI 확인을 담당한다.
- Codex: payload preview, smoke 실행안, pre/post 검증을 담당한다.
- Claude Code: 해당 없음.

## Phase4-Sprint7

**이름**: 환불/취소 guard와 보정 정책

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

### 무엇을 하는가

이 Sprint는 **취소/환불된 주문이 계속 구매로 남아 ROAS를 부풀리지 않게 하는 작업**이다.
구매를 보낸 뒤 취소나 환불이 생기면, 어떤 source를 기준으로 제외하거나 보정할지 정한다.

### 왜 하는가

결제완료만 보내도 나중에 취소/환불이 생기면 실제 매출은 줄어든다.
그런데 Meta/GA4/Google Ads에 구매 신호만 남아 있으면 광고 성과가 과대 평가된다.
따라서 환불/취소는 Purchase 후보 제외와 보정 정책이 필요하다.

### 어떻게 개발하는가

1. source별 취소/환불 상태를 정리한다.
2. purchase 후보 생성 시 취소/환불 row를 no-send 처리한다.
3. 이미 보낸 구매에 대한 보정은 플랫폼별로 따로 승인안을 만든다.
4. 보정 이벤트는 실제 외부 전송이므로 Red 승인 전 실행하지 않는다.

### 필요한 source 판단

- 운영DB: 결제완료/취소/환불 cross-check.
- VM Cloud imweb_orders: Imweb v2 상태와 site 분리.
- Toss: 카드 결제 상태 보조 확인.
- Imweb v2 API: 운영DB sync 지연 시 direct fallback.

### 개발 계획

1. [Codex] 운영DB/VM Cloud/Toss/Imweb v2의 취소·환불 필드를 inventory로 정리한다.
   - 산출물: source priority 표.
   - 검증: source/window/freshness/confidence 기록.
   - 의존성: API/DB read-only 접근.
2. [Codex] purchase 후보 dry-run에 refund/cancel guard를 붙인다.
   - 산출물: excluded count/amount.
   - 검증: 취소/환불 row purchase 후보 0.
   - 의존성: source priority.
3. [Codex] 플랫폼별 보정 승인안을 만든다.
   - 산출물: Meta/GA4/Google Ads correction approval packet.
   - 검증: send 전 payload preview와 rollback/postcheck.
   - 의존성: Red 승인.

### 현재 진척률

현재 진척률: 30%.

### 100% 조건

- 취소/환불 row는 purchase send 후보 0.
- 보정 이벤트가 필요하면 별도 Red approval packet으로 분리.
- 기존 purchase send log와 refund/cancel source가 safe_ref 기준으로 조인된다.

### 역할 구분

- TJ: 실제 보정 이벤트 전송 여부를 승인한다.
- Codex: source audit, guard dry-run, 승인안을 담당한다.
- Claude Code: 화면에서 환불/취소 보정 상태를 보여주는 UI가 필요할 때 담당한다.

## 운영 금지선

이번 문서 업데이트에서 하지 않은 것은 아래다.

- Meta CAPI 운영 Purchase 추가 전송 0.
- GA4 Measurement Protocol purchase 전송 0.
- Google Ads conversion upload 0.
- TikTok/Naver send/upload 0.
- GTM Production publish 0.
- Imweb header/footer 저장 0.
- VM Cloud backend deploy/restart 0.
- 운영DB write/import 0.
- raw order/payment/click/member/email/phone 출력 0.

앞으로도 아래는 TJ님 명시 승인 전 금지다.

- 대량 Meta CAPI backfill.
- Browser Purchase unguarded fallback.
- Pixel 전체 재삽입.
- `test_event_code` 없는 Purchase smoke.
- GA4/Google Ads/TikTok/Naver 실제 purchase 전송.
- 운영DB write/import.
- GTM Production publish.

## Source / Window / Freshness / Confidence

| 항목 | 값 |
|---|---|
| primary source | VM Cloud attribution ledger, VM Cloud Meta CAPI send log |
| cross-check source | 운영DB PAYMENT_COMPLETE, Imweb v2 API, Toss status, Meta Events Manager UI |
| window | 2026-05-14 ~ 2026-05-17 KST incident/recovery window, 최근 7일 funnel/ROAS |
| freshness | 문서 작성 시각 2026-05-17 01:24 KST. 숫자는 실행 시점에 live 재조회 필요 |
| site | biocom 중심, thecleancoffee는 site/pixel filter로 분리 |
| confidence | 0.86. Server CAPI 성공 판단은 high, Meta UI/Ads attribution 해석은 medium |

## 확인 근거

정본/계획 문서:

- [[data/!channelfunnel]]: 채널 퍼널 OKR와 action plan.
- [[project/roas]]: 최근 7일 바이오컴/더클린커피 내부 ATT ROAS와 매체 주장 ROAS 비교.

incident 패키지 근거:

- `gptconfirm/gpt0515-20-browser-purchase-capi-status`: 최신 카드 결제 건 CAPI 전송 성공과 Browser Purchase 보조 분리.
- `gptconfirm/gpt0515-22`: site/pixel filter와 missing queue data contract.
- `gptconfirm/gpt0515-23`: funnel-health site/pixel filter 운영 반영.
- `gptconfirm/gpt0515-24` ~ `gptconfirm/gpt0515-27`: today truth table, Ads attribution gap, data source restriction, 7일 Meta cohort 분석.

코드/운영 근거:

- VM Cloud `attribution_ledger`: 고객 유입/결제 단계 원장.
- VM Cloud Meta CAPI send log: Meta로 보낸 Purchase 전송 결과.
- `backend/src/funnelHealth.ts`: funnel-health site/pixel filter와 단계별 집계.
- `backend/src/roasSummaryPrecompute.ts`: ROAS summary precompute/cache.
- Header Guard v3.1.1: payment-decision cache/failure handling.
- Footer Block 3 v4.4.x: payment_page_seen / payment_success split.
- Block 4 v0.4 계열: AddToCart / InitiateCheckout / AddPaymentInfo fallback.

## Auditor verdict

Verdict: **PASS_WITH_NOTES**

이 문서 업데이트는 Green Lane 문서 작업과 로컬 backend guard 테스트다.
정본 경로 `capivm/!capiplan.md` 하나만 유지했다.
실제 외부 전송, VM Cloud 배포/restart, 운영DB write, GTM publish는 하지 않았다.

남은 notes:

- Meta Events Manager UI는 TJ님 권한으로 직접 확인이 필요하다.
- Browser Purchase는 Server CAPI가 살아 있는 동안 보조 리스크로 관리한다.
- refund/cancel guard는 아직 100%가 아니다.
- 모든 숫자는 live API/로그 재조회 시 달라질 수 있으므로 source/window/freshness를 붙여 보고해야 한다.

## 변경 이력

- 2026-05-04 23:28 KST: `capi`, `capi4reply`, `data/!datacheckplan`, 당시 코드 기준으로 메타 퍼널 CAPI 진행상황과 계획을 정본 문서로 신규 작성.
- 2026-05-05 02:05 KST: [[capivm/meta-funnel-capi-test-events-smoke-plan-20260505]] 링크와 준비 상태 반영. 실제 Test Events 전송은 별도 승인 게이트로 유지.
- 2026-05-17 00:59 KST: `capivm/!capiplan.md`를 2026-05-17 기준 정본으로 업데이트. Server CAPI live path, payment_page_seen split, Block 4 fallback, 외부 전송 준비, funnel-health/ROAS cache 상태를 반영.
- 2026-05-17 01:11 KST: 여러 문서 관리 부담을 줄이기 위해 OKR, KR 진척률, KR별 액션플랜을 이 문서 최상단에 흡수. TJ님이 볼 정본은 `capivm/!capiplan.md` 하나로 고정.
- 2026-05-17 01:11 KST: Purchase 외 중간 전환 신호를 Meta CAPI로 확장하는 KR8을 추가. 장바구니, 결제 시작, 결제수단 선택, 회원가입, 50% 스크롤은 Purchase와 분리된 보조 전환 신호로 정의.
- 2026-05-17 01:24 KST: 각 Phase/Sprint 상세 섹션에 `무엇을 하는가`, `왜 하는가`, `어떻게 개발/운영하는가`, `개발 계획`, `역할 구분`을 보강. `docurule.md` 규칙은 이미 존재해 별도 수정하지 않음.
- 2026-05-17 01:37 KST: Phase1-Sprint1 KR1을 96%로 갱신. 로컬 `metaCapi` guard에서 finite/positive number 의미를 분리하고, 0원/음수/source total 0 mismatch fixture를 추가해 47개 attribution test PASS. VM Cloud 배포 승인안을 같은 섹션에 추가.
- 2026-05-17 12:02 KST: Phase1-Sprint1 상세 개발 계획을 `완료된 개발`과 `남은 개발 / 운영 확인`으로 분리. KR1 진척률은 VM Cloud live post-check 전까지 96%로 유지.
- 2026-05-17 12:09 KST: Phase2-Sprint4 상세 개발 계획을 `완료된 개발`과 `남은 개발 / 운영 확인`으로 분리. 로컬 funnel-health에서 `ViewContent`를 장바구니 fallback에서 제외하고, 장바구니 단계는 `/shop_cart` 페이지 진입 또는 `AddToCart` event row만 쓰도록 명확화. VM Cloud live read-only에서 최근 7일 바이오컴 장바구니 페이지 진입 28건 확인.
- 2026-05-17 12:27 KST: Phase1-Sprint1 post-check runbook/script 추가. 기본은 read-only API contract 확인이며, `ALLOW_LIVE_SMOKE=1`은 승인된 VM Cloud 배포 직후 `/payment-page-seen`과 `/shop_payment/ downgrade`를 확인할 때만 사용.
- 2026-05-17 13:02 KST: Phase2-Sprint5 KR8을 46%로 갱신. `scripts/meta-intermediate-capi-phase2-sprint5-preview.sh`와 runbook을 추가해 AddToCart/InitiateCheckout은 no-send preview-ready, AddPaymentInfo는 source gap, CompleteRegistration/Scroll50은 route/source 미준비로 분리했다. 실제 Meta send는 0.
- 2026-05-17 14:38 KST: Phase2-Sprint5 KR8을 52%로 갱신. AddPaymentInfo source gap을 `VM Cloud 저장 경로 없음`으로 닫고, CompleteRegistration/Scroll50은 GTM source 확인 + VM Cloud no-send route 설계까지 완료했다. 실제 Meta send/GTM publish/VM Cloud deploy는 0.
