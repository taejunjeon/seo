# reportcoffee OKR and action plan 20260522

작성 시각: 2026-05-22 01:28 KST
기준일: 2026-05-21
문서 성격: 더클린커피 매출액·광고비 비중 Slack 리포트 OKR와 실행계획
담당: Codex
상위 문서: [[reportcoffee]]
근거 문서: [[reportcoffee-weekly-aggregate-scripts-20260522]], [[reportcoffee-vm-cloud-npay-weekly-actual-20260522]]

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - data/!data_inventory.md
    - report/reportcoffee.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_read_only_aggregate
    - local_documentation
    - okr_action_plan
    - slack_no_send_design
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud SQLite imweb_orders + Coupang Wing TeamKeto ordersheets aggregate + reportcoffee source map
    window: 2026-05-15 - 2026-05-21 KST for weekly proof, monthly remains rolling 30d candidate until calendar-month script closes
    freshness: VM Cloud NPay max order_time 2026-05-21T13:21:38Z, Coupang API smoke 2026-05-21, Meta spend source from prior API probe
    confidence: medium_high for weekly sales source, medium for full Slack automation until Naver/Google/TikTok spend mapping closes
```

## 10초 요약

더클린커피 리포트의 목표는 “이번 주와 이번 달에 얼마를 벌었고, 광고비가 매출의 몇 %였는지”를 Slack에서 바로 판단하게 만드는 것이다.

지금은 자사몰 NPay 주간값, 쿠팡 TeamKeto 주간·rolling 30d 값, Slack no-send preview가 열리면서 매출 분모가 크게 선명해졌다. 남은 병목은 네이버·구글·틱톡 광고비를 더클린커피 기준으로 안전하게 붙이는 일과, 실제 Slack 발송 승인이다.

## OKR

OKR은 목표와 핵심 결과다. 목표는 “무엇을 이루려는지”이고, 핵심 결과는 “숫자로 성공을 판단하는 기준”이다.

### Objective 1. 더클린커피 주간·월간 매출을 채널별로 믿고 볼 수 있게 만든다

- KR1. 자사몰 매출은 Toss 계열과 NPay actual을 중복 없이 합산한다.
- KR2. NPay actual은 클릭이나 결제 시작이 아니라 VM Cloud `imweb_orders`의 결제완료 후보만 쓴다.
- KR3. 스마트스토어는 `tb_playauto_orders shop_name='스마트스토어'` 기준으로 금액과 TOP 상품을 낸다.
- KR4. 쿠팡은 TeamKeto ordersheets API에서 coffee/teamketo 제품군을 분리해 표시한다.
- KR5. 모든 매출 숫자는 source, window, freshness, confidence를 같이 남긴다.

현재 상태:

- 자사몰 NPay weekly actual: 72건 / 3,693,400원, VM Cloud read-only 기준.
- 쿠팡 TeamKeto weekly aggregate: 41건 / 1,968,100원, API read-only 기준.
- 쿠팡 TeamKeto rolling 30d aggregate: 161건 / 7,264,500원, API read-only 기준.
- 스마트스토어 weekly: 2,297,220원, 운영DB aggregate 후보 기준.
- 자사몰 Toss weekly: 9,611,622원, 운영DB aggregate 후보 기준.

### Objective 2. 광고비 비중을 예산 판단에 쓸 수 있는 숫자로 만든다

- KR1. 광고비 비중은 `included 광고비 / 내부 매출 합계 * 100`으로 고정한다.
- KR2. Meta 광고비는 먼저 included로 붙이고, 플랫폼 주장 구매값은 참고값으로만 둔다.
- KR3. Naver 광고비는 API/IP 또는 fresh cache가 열리기 전까지 pending으로 표시한다.
- KR4. Google/TikTok 광고비는 캠페인과 site mapping이 확인된 것만 포함한다.
- KR5. 플랫폼 전환값과 내부 결제완료 매출을 같은 분모에 섞지 않는다.

현재 상태:

- Meta spend weekly source는 열려 있다.
- Naver는 VM Cloud `naver_ads_daily` 없음으로 pending이다.
- Google/TikTok은 더클린커피 campaign mapping 전까지 pending이다.

### Objective 3. Slack 자동 보고는 실제 발송 전 no-send로 검증한다

- KR1. 주간 메시지와 rolling 30d 메시지를 각각 30초 안에 읽히는 형식으로 만든다.
- KR2. 메시지에 매출, 광고비, 광고비 비중, source warning, pending 항목이 모두 보인다.
- KR3. raw email, phone, order, payment, member code, click id는 0건이어야 한다.
- KR4. Slack 실제 발송은 TJ님이 채널과 주기를 승인하기 전까지 0건이다.
- KR5. 실패 시 “데이터 없음”, “source 다름”, “sync 지연”, “권한 부족”을 분리해 보여준다.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase1-Sprint1]] | 자사몰 매출 분모를 닫는다 | 자사몰이 가장 큰 매출 축이라 광고비 비중의 분모가 된다 | Toss weekly/monthly와 NPay VM Cloud actual을 같은 KST window로 합산하고 중복 rule을 문서화한다 | 진행 중, NPay weekly PASS | 82% | 자사몰 weekly/monthly가 Toss/NPay/기타 pending으로 분리되고 중복 합산이 없다 | Codex: no-send preview 반영 | NO, Green | [[reportcoffee-vm-cloud-npay-weekly-actual-20260522]] |
| P0 | [[#Phase1-Sprint2]] | Slack no-send 메시지를 만든다 | 실제 발송 전에 숫자와 문구를 검증해야 한다 | 주간/rolling 30d 메시지 JSON과 Markdown을 생성하고 source warning을 붙인다 | no-send preview PASS | 80% | raw 식별자 0, send 0, 매출/광고비/비중/source warning 포함 | Codex: 승인안 작성 | NO, Green | [[reportcoffee-slack-preview-20260522]] |
| P1 | [[#Phase2-Sprint1]] | 쿠팡 매출을 제품군별로 안정화한다 | TeamKeto 계정에 커피와 팀키토 상품이 섞여 있다 | ordersheets API 합계를 coffee/teamketo/other로 분류하고 월간까지 확장한다 | weekly/rolling 30d PASS | 86% | 주간/월간 쿠팡 금액과 TOP 상품이 raw 식별자 없이 나온다 | Codex: preview 반영 완료, 분류 rule 보강 | NO, Green | [[reportcoffee-weekly-aggregate-scripts-20260522]] |
| P1 | [[#Phase2-Sprint2]] | 스마트스토어 제품별 매출을 붙인다 | 채널별 매출만으로는 어떤 제품이 팔렸는지 부족하다 | PlayAuto 스마트스토어에서 취소/클레임 제외 기준과 TOP 상품을 산출한다 | source 확인 완료 | 55% | 스마트스토어 weekly/monthly 금액과 TOP 상품 5개가 나온다 | Codex: aggregate 작성 | NO, Green | [[reportcoffee]] |
| P2 | [[#Phase3-Sprint1]] | Naver 광고비 source를 연다 | Meta만 보면 전체 광고비 비중이 과소 계산된다 | VM Cloud IP 등록 후 Naver Ads read-only 수집 또는 pending rule 고정 | IP 등록 대기 | 25% | `site=thecleancoffee` Naver spend가 weekly/monthly로 나온다 | TJ님: VM Cloud IP 등록 / Codex: probe | YES, Yellow for external account setting | [[reportcoffee]] |
| P2 | [[#Phase3-Sprint2]] | Google/TikTok 광고비 mapping을 붙인다 | site mapping 없는 광고비는 더클린커피 분모와 나누면 안 된다 | campaign naming, account, landing URL을 기준으로 included/pending을 분리한다 | 미착수 | 20% | 포함 가능한 캠페인만 spend에 들어간다 | Codex: read-only mapping | NO, Green | [[!report]] |
| P3 | [[#Phase4-Sprint1]] | Slack 실제 발송 승인안을 만든다 | 자동 발송은 외부 채널로 메시지를 보내는 일이므로 승인선이 필요하다 | 채널, 주기, 실패 알림, 비밀값 보관, 중지 방법을 문서화한다 | preview 전 대기 | 15% | TJ님이 YES/NO로 승인할 수 있다 | Codex: approval packet | YES, Yellow for send | [[!report]] |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

#### A1. 스마트스토어 TOP 상품 aggregate 작성

- 무엇을 하는가: 스마트스토어 주간/월간 매출과 TOP 상품을 운영DB read-only로 산출한다.
- 왜 하는가: Slack 보고에서 채널별 매출 다음으로 제품별 매출이 필요하다.
- 어떻게 하는가: `tb_playauto_orders shop_name='스마트스토어'` 기준으로 금액, 수량, 상품명을 집계한다.
- 성공 기준: 취소/클레임 제외 기준이 명시되고 TOP 5 제품이 나온다.
- 실패 시 다음 확인점: PlayAuto 상태 컬럼과 금액 컬럼 정의를 확인한다.
- 승인 필요 여부: NO, Green read-only.
- 산출물: `report/reportcoffee-smartstore-product-aggregate-20260522.md`.
- 진척률에 미치는 영향: B 매출 source +4% 예상.
- 의존성: 운영DB read-only 접근.
- 추천 점수/자신감: 82%.

#### A2. Slack send approval packet 작성

- 무엇을 하는가: 실제 Slack 발송을 위한 승인안을 만든다.
- 왜 하는가: no-send preview는 끝났지만 실제 발송은 외부 채널 전송이라 승인선이 필요하다.
- 어떻게 하는가: 발송 채널, 주기, 실패 시 재시도, 중지 방법, 비밀값 보관 방식을 문서화한다.
- 성공 기준: TJ님이 YES/NO로 승인할 수 있다.
- 실패 시 다음 확인점: Slack connector/webhook 권한과 채널 접근 권한을 확인한다.
- 승인 필요 여부: 문서 작성은 NO, 실제 send는 YES.
- 산출물: `report/reportcoffee-slack-send-approval-20260522.md`.
- 진척률에 미치는 영향: F 자동화 readiness +10% 예상.
- 의존성: no-send preview 확인.
- 추천 점수/자신감: 76%.

### Approval Needed

#### Y1. Slack 실제 발송 채널 결정

- 무엇을 하는가: 주간/월간 보고를 받을 Slack 채널과 발송 주기를 정한다.
- 왜 하는가: 실제 Slack 발송은 외부 채널로 메시지를 보내는 작업이다.
- 어떻게 하는가: TJ님이 채널명 또는 webhook/connector 방식을 지정한다.
- 성공 기준: 발송 대상 채널 1개와 발송 주기가 확정된다.
- 실패 시 다음 확인점: Slack 권한, webhook 보관 위치, 테스트 채널 여부를 확인한다.
- 승인 필요 여부: YES, Yellow.
- 산출물: Slack send approval packet.
- 진척률에 미치는 영향: F 자동화 readiness +20% 예상.
- 의존성: no-send preview 확인 후.
- Codex가 대신 못 하는 이유: 어느 채널에 운영 리포트를 받을지는 TJ님 팀 운영 결정이다.
- 추천 점수/자신감: 72%.

#### Y2. Naver Ads VM Cloud IP 등록

- 무엇을 하는가: Naver Ads API 허용 IP를 VM Cloud IP로 등록한다.
- 왜 하는가: 자동 주간 보고는 서버에서 돌아야 하므로 PC IP보다 VM Cloud IP가 맞다.
- 어떻게 하는가: 네이버 API 관리 화면에서 허용 IP를 VM Cloud 외부 IP로 등록한다.
- 성공 기준: Codex가 read-only probe에서 HTTP 200 또는 spend row를 확인한다.
- 실패 시 다음 확인점: 계정 권한, API 상품 범위, 광고주 계정 mapping을 확인한다.
- 승인 필요 여부: YES, Yellow.
- 산출물: Naver Ads source readiness update.
- 진척률에 미치는 영향: C 광고비 source +20% 예상.
- 의존성: 네이버 관리 화면 접근.
- Codex가 대신 못 하는 이유: 외부 계정 보안 설정은 TJ님 화면 권한이 필요하다.
- 추천 점수/자신감: 82%.

### Blocked/Parked

#### P1. Google/TikTok 광고비 자동 포함

- 무엇을 하는가: Google/TikTok 광고비를 더클린커피 분모에 포함한다.
- 왜 보류인가: 캠페인과 site mapping이 아직 닫히지 않았다.
- 어떻게 풀 것인가: campaign name, landing URL, account scope를 read-only로 대조한다.
- 성공 기준: included/pending 캠페인이 분리된다.
- 승인 필요 여부: NO for read-only, platform send는 금지.
- 산출물: `report/reportcoffee-google-tiktok-spend-mapping-*.md`.
- 의존성: API token freshness와 campaign naming 확인.
- 추천 점수/자신감: 64%.

## 상세 Sprint 설명 — 각 Sprint별 무엇/왜/어떻게/% 올리려면

### Phase1-Sprint1

**이름**: 자사몰 매출 분모 닫기

- 무엇을 하는가: 자사몰 매출을 Toss 계열과 NPay actual로 나눠 같은 기간으로 합산한다.
- 왜 하는가: 자사몰 매출이 총매출의 핵심 분모라서, 이 값이 흔들리면 광고비 비중도 의미가 없다.
- 어떻게 하는가: 운영DB Toss 집계와 VM Cloud NPay actual 집계를 KST 기준으로 맞추고, `complete_time`은 진단값으로만 둔다.
- 개발 계획: NPay weekly actual은 완료됐다. 다음은 Toss와 NPay를 같은 preview 파일에 합치는 것이다.
- 현재 진척률: 82%.
- 100% 조건: 주간/월간 자사몰 매출이 중복 없이 나오고, 결제수단별 warning이 함께 표시된다.
- 역할 구분: Codex는 집계와 preview를 만든다. TJ님은 실제 Slack 발송 전 메시지만 확인한다.
- 근거: VM Cloud read-only NPay weekly actual 72건 / 3,693,400원.

### Phase1-Sprint2

**이름**: Slack no-send preview

- 무엇을 하는가: 실제 Slack 발송 없이 주간/월간 메시지를 만든다.
- 왜 하는가: 숫자와 문구를 먼저 검증해야 운영 채널에 잘못된 보고가 나가지 않는다.
- 어떻게 하는가: Markdown과 JSON을 만들고, source warning을 메시지 안에 짧게 넣는다.
- 개발 계획: no-send preview는 완료됐다. 다음은 실제 발송 승인안이다.
- 현재 진척률: 80%.
- 100% 조건: raw 식별자 0, Slack send 0, 매출/광고비/비중/source warning 포함.
- 역할 구분: Codex가 preview를 만들고, TJ님은 실제 발송 승인 전 문구를 확인한다.

### Phase2-Sprint1

**이름**: 쿠팡 매출 제품군 분리

- 무엇을 하는가: TeamKeto ordersheets 금액을 coffee/teamketo/other로 나눠 표시한다.
- 왜 하는가: TeamKeto 계정에는 더클린커피와 팀키토 상품이 섞여 있어 한 줄 합계만 보면 오해가 생긴다.
- 어떻게 하는가: 상품명 기반 힌트 분류와 TOP 상품 집계를 쓰되, 주문/고객 식별자는 출력하지 않는다.
- 개발 계획: weekly와 rolling 30d aggregate는 완료됐다. 남은 것은 분류 rule 설명 보강이다.
- 현재 진척률: 86%.
- 100% 조건: 주간/월간 쿠팡 금액과 TOP 상품이 나오고, 분류 warning이 표시된다.
- 역할 구분: Codex가 read-only API 집계를 만든다.

### Phase2-Sprint2

**이름**: 스마트스토어 제품별 매출

- 무엇을 하는가: 스마트스토어 매출과 제품별 TOP 목록을 만든다.
- 왜 하는가: 채널별 매출만 보면 어떤 제품이 성과를 만든지 알기 어렵다.
- 어떻게 하는가: 운영DB `tb_playauto_orders shop_name='스마트스토어'`를 read-only로 집계한다.
- 개발 계획: 취소/클레임 제외 기준을 먼저 확인하고, 주간/월간을 산출한다.
- 현재 진척률: 55%.
- 100% 조건: weekly/monthly 매출과 TOP 5 제품, 제외 rule이 모두 보인다.
- 역할 구분: Codex가 read-only aggregate를 만든다.

### Phase3-Sprint1

**이름**: Naver 광고비 source 열기

- 무엇을 하는가: Naver Ads spend를 더클린커피 기준으로 가져온다.
- 왜 하는가: Meta만 포함하면 광고비 비중이 실제보다 낮아질 수 있다.
- 어떻게 하는가: VM Cloud IP를 Naver API 허용 IP로 등록한 뒤 read-only probe를 실행한다.
- 개발 계획: IP 등록 전에는 pending으로 둔다.
- 현재 진척률: 25%.
- 100% 조건: weekly/monthly Naver spend가 site 기준으로 나온다.
- 역할 구분: TJ님은 IP 등록, Codex는 read-only probe와 문서화를 한다.

### Phase3-Sprint2

**이름**: Google/TikTok 광고비 mapping

- 무엇을 하는가: 더클린커피 캠페인으로 확인된 Google/TikTok 광고비만 포함한다.
- 왜 하는가: site가 다른 광고비를 섞으면 광고비 비중이 틀어진다.
- 어떻게 하는가: campaign name, landing URL, account scope를 read-only로 대조한다.
- 개발 계획: 먼저 included/pending 목록을 만든다.
- 현재 진척률: 20%.
- 100% 조건: 포함 가능한 캠페인과 보류 캠페인이 분리된다.
- 역할 구분: Codex가 Green 조사로 진행한다.

### Phase4-Sprint1

**이름**: Slack 실제 발송 승인안

- 무엇을 하는가: 자동 발송 채널, 주기, 실패 처리, 중지 방법을 문서화한다.
- 왜 하는가: Slack send는 외부 전송이라 승인 없이 실행하면 안 된다.
- 어떻게 하는가: no-send preview 통과 후 승인 패킷을 만든다.
- 개발 계획: preview v0.1 이후 작성한다.
- 현재 진척률: 15%.
- 100% 조건: TJ님이 YES/NO로 발송을 승인할 수 있다.
- 역할 구분: Codex는 승인안을 만들고, TJ님은 채널과 발송 여부를 결정한다.

## Track 진척률

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 48% | 52% | +4% |
| B | 더클린커피 매출 source 확인 | 84% | 88% | +4% |
| C | 더클린커피 광고비 source 확인 | 35% | 35% | +0% |
| D | 바이오컴 리포트 source map | 10% | 10% | +0% |
| E | Slack no-send 메시지 설계 | 50% | 70% | +20% |
| F | 자동화/배포 readiness | 34% | 40% | +6% |

## 하지 않은 것

- Slack 실제 발송: 0건.
- 운영DB write: 0건.
- VM Cloud write/import/sync/deploy/restart: 0건.
- Google Ads/GA4/Meta/TikTok/Naver send/upload: 0건.
- GTM publish: 0건.
- raw email/phone/order/payment/member_code/click_id 출력: 0건.
