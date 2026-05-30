# Google ROAS 보고서 기준일 카드 배포 및 click id 병목 재조사

작성 시각: 2026-05-24 13:34 KST
문서 성격: Yellow deploy result + Green read-only diagnosis

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - gdn/attribution-data-source-decision-guide-20260511.md
    - data/!data_inventory.md
  lane:
    deploy: Yellow, TJ님 승인 후 실행
    diagnosis: Green, read-only
  allowed_actions:
    - deploy frontend/src/app/ads/google-roas-report/page.tsx only
    - deploy frontend/src/app/ads/google-roas-report/page.module.css only
    - remote backup before overwrite
    - remote frontend lint/build
    - pm2 restart seo-frontend
    - public smoke
    - VM Cloud SQLite read-only query
    - public Google Ads dashboard API read-only query
  forbidden_actions:
    - Google Ads conversion upload
    - Google Ads conversion action mutation
    - Google Ads primary goal mutation
    - GTM publish
    - Imweb header/footer mutation
    - operating DB write/import
    - VM Cloud SQLite write/schema migration
  source_window_freshness_confidence:
    source: VM Cloud frontend, VM Cloud SQLite, Google Ads dashboard API
    window: 2026-05-21 21:15 KST 이후, last_1d, last_30d
    freshness: 2026-05-24 13:27 KST read-only refresh
    confidence: high for deploy/smoke, high for stage counts, medium-high for Google Ads claim interpretation
```

## 무엇이 가능해졌나

`https://biocom.ainativeos.net/ads/google-roas-report`의 Google click id 보존률 영역에서 2026-05-21 21:15 KST 기준일과 그 이후 실제 결제완료 주문만 따로 자른 보존률을 바로 볼 수 있게 됐다.

## 왜 중요한가

최근 7일/30일 보존률은 5월 21일 밤 보강 전 주문이 섞인다. 그래서 보강 효과를 판단하려면 기준일 이후 주문만 따로 봐야 한다.

## 배포 범위

- `frontend/src/app/ads/google-roas-report/page.tsx`
- `frontend/src/app/ads/google-roas-report/page.module.css`

VM Cloud backup:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/google-roas-report-baseline-card-20260524T042315Z
```

원격 반영 후 sha256:

```text
31a7bd04c31e1b3364957ce01a0dc9b08e25549bf61dfac8e115b36ea43fcbf4  frontend/src/app/ads/google-roas-report/page.tsx
4532f662ee939aad4a9a59e6128af470a5d6b5bf0303e4a9e7cfb2be1a85e032  frontend/src/app/ads/google-roas-report/page.module.css
```

## 배포 검증

- remote frontend lint: PASS
- remote frontend build: PASS
- `pm2 restart seo-frontend --update-env`: PASS
- `pm2 save`: PASS
- `seo-frontend`: online, restart count 3
- public HTTP smoke: `https://biocom.ainativeos.net/ads/google-roas-report?deploy_smoke=20260524T0426` HTTP 200
- Playwright smoke:
  - `click id 알고리즘 업데이트 기준일` 표시
  - `2026-05-21 21:15 KST` 표시
  - `5/21 21:15 이후` 표시
  - `0 / 141건` 표시
  - `upload 후보 0건` 표시
  - page error 0, console error 0

## 기준일 이후 현재 숫자

Source: VM Cloud SQLite + public dashboard API read-only
Window: 2026-05-21 21:15 KST 이후
Freshness: 2026-05-24 13:27 KST
Confidence: high

```text
실제 결제완료 주문: 141건
Google click id 직접 보존: 0건
미보존: 141건
보존률: 0.00%
Google Ads upload 후보: 0건
```

결제수단별:

```text
CARD: 101건 / click id 0건
VIRTUAL: 7건 / click id 0건
SUBSCRIPTION: 30건 / click id 0건
NAVERPAY_ORDER: 3건 / click id 0건
```

## 단계별 병목 재조사

Source: VM Cloud SQLite read-only
Cutoff: 2026-05-21 21:15 KST
Freshness: 2026-05-24 13:27 KST

```text
고객 유입 장부: 4,060건 중 Google click id 3,128건, gad_campaignid 3,004건
유료 클릭 의도 장부: 3,212건 중 Google click id 3,212건, gad_campaignid 3,180건
결제 진입 checkout_started: 340건 중 Google click id 28건
결제 페이지 payment_page_seen: 988건 중 Google click id 78건
실제 결제완료 confirmed: 133건 중 Google click id 0건
```

해석:

1. Google 광고 클릭은 들어오고 있다.
2. 클릭 직후 저장도 된다.
3. 결제 진입과 결제 페이지 일부에도 gclid가 남는다.
4. 실제 결제완료 confirmed 주문에는 아직 직접 click id가 남은 사례가 없다.

## 오늘 테스트 주문 단서

TJ님이 2026-05-24 12:22 KST에 Google 광고 클릭 후 만든 가상계좌 미입금 주문은 click id가 끝까지 남았다.

```text
order_no: 202605245546619
site_landing: gclid + campaign 22018178848 확인
paid_click_intent: gclid + campaign 22018178848 확인
payment_page_seen: gclid 확인
checkout_started: gclid + campaign 22018178848 확인
payment_success pending: gclid + gbraid 확인
restore_source: checkout_context_v4_4_3
```

이 단서는 중요하다. 헤더/푸터 보강 로직이 모든 경로에서 죽은 것은 아니다. pending 가상계좌 경로에서는 결제완료 신호까지 복원된다.

## confirmed 주문에서 아직 안 된 것

기준일 이후 confirmed payment_success 133건을 이전 checkout/payment_page_seen row와 같은 order_id, checkout_id, ga_session_id, customer_key로 묶어 봤다.

```text
confirmed direct click id: 0건
prior same order click: 0건
prior same checkout click: 0건
prior same GA session click: 0건
prior same customer click: 0건
```

해석:

- 현재 confirmed 주문에서는 “결제 직전까지 있었던 Google click id가 마지막 단계에서 사라졌다”는 강한 표본이 아직 없다.
- 더 정확한 표현은 “Google click id가 붙은 실제 paid confirmed 주문 표본이 아직 확인되지 않았다”이다.
- 따라서 다음 표본은 Google 광고 클릭 후 실제 paid confirmed 결제로 만들어야 병목이 닫힌다.

## Google Ads 1일 주장값과 내부 원장

Source: `https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_1d`
Date range: YESTERDAY
Freshness: 2026-05-24 13:27 KST

```text
Google Ads 주장 구매완료: 21건
Google Ads 주장 전환값: 4,050,200원
Google Ads 주장 ROAS: 10.17x
내부 주문별 click id 직접 연결: 0건
```

전환 액션:

```text
action id: 7130249515
name: 구매완료
category: PURCHASE
Primary: true
classification: primary_known_npay
riskFlags: known_npay_label, primary_bid_signal_is_npay
```

해석:

Google Ads가 구매완료라고 부르는 값은 계속 보이지만, 내부 주문번호 기준으로는 직접 연결된 주문이 없다. 이 값은 예산 판단에 바로 쓰지 말고 “Google Ads 주장 구매”로 따로 읽어야 한다.

## 금지선 준수

- Google Ads upload: 0
- Google Ads conversion action mutation: 0
- GTM publish: 0
- Imweb header/footer save: 0
- 운영DB write/import: 0
- VM Cloud SQLite write/schema migration: 0

## 2026-05-24 13:40 Google 광고 → NPay 실제 결제 테스트

TJ님 테스트:

```text
검색어: 바이오밸런스
Google 광고 클릭: 2026-05-24 13:40 KST
제품: 바이오밸런스 90정, product_idx=97
Google URL 파라미터: gad_campaignid=22018178848, gclid 있음, gbraid 있음
NPay 결제완료: 2026-05-24 13:53 KST
NPay 주문번호: 2026052431047480
```

read-only 확인:

```text
site_landing: 2026-05-24 13:40:33 KST 저장됨, gclid 있음, campaign id 있음
paid_click_intent: 2026-05-24 13:40:33/13:40:52 KST 저장됨, gclid 있음, campaign id 있음
npay_intent_log: 2026-05-24 13:40:55 KST 저장됨, gclid 있음, gbraid 있음, product_idx=97, product_price=39,000
VM Cloud imweb_orders: 2026-05-24 14:00:09 KST sync에서 channel_order_no=2026052431047480 row 생성
운영DB tb_iamweb_users: 2026-05-24 14:04 KST 조회 시 아직 row 없음
public order health API: 2026-05-24 14:09 KST rolling_24h 기준 아직 해당 주문 없음
운영DB 재조회: 2026-05-24 16:18 KST 기준 row 생성 확인
```

현재 해석:

- Google 클릭 id 자체는 사이트 랜딩, paid click intent, NPay intent까지 살아 있다.
- NPay intent row에는 `gclid/gbraid`가 있지만 `gad_campaignid` 저장 컬럼은 없다. 캠페인 id는 site_landing/paid_click_intent 쪽에 남아 있다.
- VM Cloud `imweb_orders`에는 NPay 채널 주문번호가 들어왔지만 `complete_time`과 `imweb_status`가 아직 비어 있다.
- 운영DB에는 16:18 KST 기준 결제완료 row가 들어왔다.
- 그런데 공개 click-id health API에서는 해당 주문의 `evidenceSource`가 여전히 `none`이다. 이유는 `npay_intent_log.matched_order_no`가 아직 비어 있기 때문이다.

수동 완료값을 넣은 read-only dry-run:

```text
input: order_no=202605242646467, channel_order_no=2026052431047480, paid_at=2026-05-24 13:53 KST, amount=39,000
live_intent_count: 1
confirmed_npay_order_count: 1
strong_match: 1
strong_match_b: 1
amount_match_type: final_exact
clicked_purchased_candidate: 1
```

이 dry-run은 운영DB/VM Cloud에 write하지 않았다. 수동 완료값으로는 NPay intent와 결제완료 주문이 강하게 묶인다. 다만 자동 A급 evidence로 승격하려면 운영DB `PAYMENT_COMPLETE` row 또는 이에 준하는 결제완료 정본이 먼저 들어와야 한다.

운영DB row 생성 후 수동값 없이 다시 돌린 read-only dry-run:

```text
generated_at: 2026-05-24 16:19 KST
live_intent_count: 1
confirmed_npay_order_count: 1
strong_match: 1
strong_match_b: 1
amount_match_type: final_exact
clicked_purchased_candidate: 1
```

즉 운영DB row가 들어온 뒤에는 자동 계산상으로도 강한 후보가 된다. 다만 운영 DB/VM Cloud에 write하지 않았으므로 공개 health API에는 아직 direct evidence로 올라가지 않는다.

다음 병목:

```text
1. imweb_orders/운영DB sync 후 pending NPay intent를 재매칭하는 backend 보강 필요
2. NPay intent에도 gad_campaignid를 저장할지 설계 필요. 캠페인별 Google ROAS split에는 site_landing/paid_click_intent campaign id와 주문 evidence를 연결하는 별도 join이 필요하다.
3. Google ROAS 화면의 click id health가 `npay_intent_log.matched_order_no`만 보지 말고, read-only strong match 후보도 별도 카드로 보여줄지 판단 필요
```
