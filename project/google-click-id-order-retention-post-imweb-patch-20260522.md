작성 시각: 2026-05-22 21:22 KST
기준일: 2026-05-22
문서 성격: Google click id 주문 보존률 read-only 결과보고

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_read_only_query
    - aggregate_retention_analysis
    - result_documentation
  forbidden_actions:
    - operating_db_write
    - vm_cloud_write_or_schema_change
    - external_platform_send
    - gtm_publish
    - backend_deploy
    - raw_order_or_click_id_output
  source_window_freshness_confidence:
    source: VM Cloud SQLite /home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3
    window: post patch 2026-05-21 20:30 KST and 21:15 KST onward, compared with previous 24h windows
    freshness: queried 2026-05-22 21:18-21:22 KST
    confidence: medium_high for live tracking capture, medium for confirmed purchase interpretation because post-patch confirmed Google order sample is not yet available
```

## 10초 요약

2026-05-21 밤 아임웹 헤더/푸터 보강 이후 Google 광고 클릭 신호는 유입 장부에서 훨씬 안정적으로 잡히고 있다.
주문 완료 신호 기준으로는 보강 이후 Google 유입으로 보이는 주문 완료 이벤트가 1-2건뿐이며, 모두 미입금 가상계좌 주문이라 confirmed 구매완료 ROAS 개선까지는 아직 판정하면 안 된다.
현재 결론은 `상류 클릭 보존 개선은 확인`, `주문 완료 단계 click id 보존은 테스트 표본에서 100%`, `실제 결제완료 주문 기준은 시간 대기`다.

## 기준점

- 보강 기준 1: 2026-05-21 20:30 KST, 헤더 상단 virtual account guard v3.13 반영 이후.
- 보강 기준 2: 2026-05-21 21:15 KST, 헤더/푸터 최종 교체 안정 기준.
- 비교 기준: 각 기준점 직전 24시간.
- source: VM Cloud SQLite `attribution_ledger`, `site_landing_ledger`, `paid_click_intent_ledger`, `imweb_orders`.
- site: `biocom`.
- 개인정보/식별자 처리: raw order number, order_code, payment_code, gclid, gbraid, wbraid는 문서에 출력하지 않음.

## 확인한 결과

### 1. 주문 완료 신호 기준

결제완료 신호는 고객이 주문 완료 페이지에 도착했을 때 들어오는 주문 단계 기록이다.
아래 수치는 전체 주문과 Google 유입 추정 주문을 분리한 값이다.

| 기준 | 전체 주문 완료 이벤트 | 전체 중 click id 포함 | Google 유입 추정 주문 | Google 유입 중 click id 포함 | Google 유입 보존률 | confirmed | pending | canceled |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 직전 24h, 20:30 기준 | 51 | 4 | 4 | 4 | 100.0% | 0 | 2 | 2 |
| 보강 후, 20:30 이후 | 72 | 2 | 2 | 2 | 100.0% | 0 | 2 | 0 |
| 직전 24h, 21:15 기준 | 50 | 5 | 5 | 5 | 100.0% | 0 | 3 | 2 |
| 보강 후, 21:15 이후 | 70 | 1 | 1 | 1 | 100.0% | 0 | 1 | 0 |

해석:
- 전체 주문 기준 click id 포함률이 낮은 것은 정상이다. Naver, Meta, direct 주문까지 분모에 들어가기 때문이다.
- Google 유입으로 좁히면 보강 후 표본 1-2건은 모두 click id를 유지했다.
- 하지만 보강 이후 Google 유입 `confirmed` 주문은 아직 0건이다. 현재는 미입금 가상계좌 테스트/주문 생성 단계 보존 확인으로 봐야 한다.

### 2. Imweb 주문 생성 시각 기준

아임웹 주문 row를 생성 시각으로 자르고, 주문 완료 신호와 조인했다.

| 기준 | 생성 주문 | 주문 완료 신호 조인 | click id 포함 주문 | Google 유입 추정 주문 | Google 유입 중 click id 포함 | Google 유입 보존률 | Google confirmed | Google pending |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 직전 24h, 20:30 기준 | 70 | 51 | 4 | 4 | 4 | 100.0% | 0 | 2 |
| 보강 후, 20:30 이후 | 85 | 70 | 2 | 2 | 2 | 100.0% | 0 | 2 |
| 직전 24h, 21:15 기준 | 69 | 50 | 5 | 5 | 5 | 100.0% | 0 | 3 |
| 보강 후, 21:15 이후 | 83 | 68 | 1 | 1 | 1 | 100.0% | 0 | 1 |

해석:
- 보강 이후 생성된 주문 중 Google 유입 추정 주문은 아직 1-2건뿐이다.
- 이 주문들은 click id를 유지했다.
- 생성 주문 중 `complete_time`이 아직 0건으로 잡혀, 실제 결제완료 기준 평가는 아직 sync 지연 또는 시간 대기 상태다.

### 3. 상류 클릭/유입 장부 기준

고객이 광고 클릭 후 사이트에 들어오는 단계는 보강 효과가 크다.

| 장부 | 기준 | row | Google click row | Google click 비율 | gad_campaignid 포함 | Google click 중 gad_campaignid 비율 |
|---|---|---:|---:|---:|---:|---:|
| 고객 유입 장부 | 직전 24h, 20:30 기준 | 840 | 481 | 57.26% | 148 | 30.77% |
| 고객 유입 장부 | 보강 후, 20:30 이후 | 2,296 | 1,829 | 79.66% | 1,748 | 95.57% |
| 고객 유입 장부 | 직전 24h, 21:15 기준 | 843 | 489 | 58.01% | 175 | 35.79% |
| 고객 유입 장부 | 보강 후, 21:15 이후 | 2,253 | 1,797 | 79.76% | 1,721 | 95.77% |
| 유료 클릭 장부 | 직전 24h, 20:30 기준 | 501 | 501 | 100.0% | 160 | 31.94% |
| 유료 클릭 장부 | 보강 후, 20:30 이후 | 1,846 | 1,846 | 100.0% | 1,827 | 98.97% |
| 유료 클릭 장부 | 직전 24h, 21:15 기준 | 502 | 502 | 100.0% | 190 | 37.85% |
| 유료 클릭 장부 | 보강 후, 21:15 이후 | 1,816 | 1,816 | 100.0% | 1,797 | 98.95% |

해석:
- `gad_campaignid` 기반 캠페인 매칭 보강은 정상 작동 중이다.
- 유입 장부의 Google click 비율도 58%대에서 약 80%로 상승했다.
- 유료 클릭 장부에서는 Google click 자체는 전후 모두 100%였고, 이번 개선의 핵심은 `gad_campaignid` 보존률이 약 32-38%에서 약 99%로 오른 점이다.

## Source / Freshness

| source | 최신 시각 |
|---|---|
| VM Cloud `attribution_ledger` 전체 | 2026-05-22T12:17:51.534Z |
| VM Cloud `attribution_ledger payment_success` | 2026-05-22T11:38:49.728Z |
| VM Cloud `imweb_orders(site=biocom)` order_time | 2026-05-22T11:35:50.000Z |
| VM Cloud `imweb_orders(site=biocom)` synced_at | 2026-05-22 12:10:53 UTC |
| VM Cloud `site_landing_ledger(site=biocom)` | 2026-05-22T12:17:49.374Z |
| VM Cloud `paid_click_intent_ledger(site=biocom)` | 2026-05-22T12:17:48.928Z |

## 판정

- 상류 클릭 보존: PASS.
- `gad_campaignid` 캠페인 매칭 보강: PASS.
- 주문 완료 페이지까지 Google click id 보존: 표본 기준 PASS.
- 실제 결제완료 confirmed Google 주문 기준: HOLD.

HOLD 사유:
- 보강 이후 Google 유입 주문 완료 이벤트가 1-2건뿐이다.
- 이 표본은 모두 pending 가상계좌 주문이다.
- 보강 이후 `imweb_orders.complete_time`이 있는 Google 주문 표본이 아직 없다.

## 다음 판단 기준

1. 최소 24-72시간 더 쌓은 뒤 같은 query를 다시 실행한다.
2. Google 유입 추정 주문 중 confirmed 주문이 3건 이상 생기면 주문 보존률을 다시 판정한다.
3. confirmed Google 주문이 계속 0건이면 문제라기보다 광고/결제 volume 부족 또는 sync freshness gap으로 해석한다.
4. Google 유입 주문은 있는데 click id가 빠지는 row가 생기면, `payment_success`의 `click_id_restore_source`, `checkout_context_version`, `guard_version`부터 좁힌다.

## 2026-05-23 01:55 KST 재조회

요청: confirmed 주문 자연 발생 후 Google click id 보존률 재조회.

### 재조회 결론

confirmed 주문은 보강 이후 새로 충분히 생겼지만, 그중 Google 유입으로 분류되는 confirmed 주문은 아직 0건이다.
따라서 보강 실패가 아니라 `Google confirmed 표본 없음` 상태로 본다.

### 재조회 수치

결제완료 신호 기준:

| 기준 | 값 |
|---|---:|
| 2026-05-21 21:15 KST 이후 전체 주문 완료 이벤트 | 74 |
| 그중 confirmed 이벤트 | 69 |
| confirmed 중 click id 포함 | 0 |
| confirmed 중 Google 유입 추정 | 0 |
| Google 유입 pending 이벤트 | 1 |
| Google 유입 canceled 이벤트 | 0 |

Imweb `complete_time` 기준:

| 기준 | 값 |
|---|---:|
| 2026-05-21 21:15 KST 이후 완료 주문 | 56 |
| 그중 confirmed payment-success 조인 | 42 |
| 완료 주문 중 click id 포함 | 0 |
| 완료 주문 중 Google 유입 추정 | 0 |

confirmed 주문의 주요 유입 mix:

| 유입 | confirmed row |
|---|---:|
| meta / paid_social | 26 |
| empty / empty | 9 |
| naver / powerlink | 7 |
| naver brandsearch mobile | 4 |
| meta_biocom_yeonddle_igg | 4 |
| topbanner_mo | 3 |

### Freshness

| source | 최신 시각 |
|---|---|
| VM Cloud `payment_success` | 2026-05-22T14:32:38.435Z |
| VM Cloud `payment_success confirmed` | 2026-05-22T14:32:38.435Z |
| VM Cloud `imweb_orders(site=biocom)` order_time | 2026-05-22T14:30:51.000Z |
| VM Cloud `imweb_orders(site=biocom)` synced_at | 2026-05-22 16:40:52 UTC |
| VM Cloud `site_landing_ledger(site=biocom)` | 2026-05-22T16:54:23.539Z |
| VM Cloud `paid_click_intent_ledger(site=biocom)` | 2026-05-22T16:54:29.369Z |

### 판정 업데이트

- confirmed 주문 자연 발생: YES.
- confirmed Google 유입 주문 자연 발생: NO.
- Google confirmed 주문 click id 보존률: 아직 산출 불가.
- 다음 해석: Google 유입 confirmed 주문이 생길 때까지 대기. 현재 confirmed 주문은 Meta, Naver, direct/empty 쪽으로 보인다.

## 2026-05-23 02:05 KST Google Ads 격차 점검

요청: Google confirmed 주문을 언제 다시 봐야 하는지, Google Ads가 주장하는 전환에 비해 내부 confirmed 주문이 너무 적은지 판단.

### 한 줄 결론

재조회는 2026-05-23 10:00 KST부터 매일 오전 확인이 맞지만, 현재 숫자만으로도 `기다림`보다 `Google Ads 전환 정의와 내부 confirmed 기준의 격차 분해`가 먼저다.

### Google Ads last_7d vs 내부 confirmed

| 기준 | Google Ads 주장값 | 내부 confirmed 주문 원장 기준 |
|---|---:|---:|
| 비용 | 3,911,105원 | 3,911,105원 |
| 전환수 | 259.87 | 5건 |
| 전환가치/매출 | 37,062,795원 | 1,006,827원 |
| ROAS | 9.48 | 0.26 |
| NPay 실제 결제 보정 포함 내부 매출 | - | 6,678,027원 |
| NPay 실제 결제 보정 포함 내부 ROAS | - | 1.71 |

해석:
- Google Ads가 말하는 `구매완료`는 내부 confirmed purchase와 같은 정의가 아니다.
- 내부 confirmed에 NPay 실제 결제 보정까지 더해도 Google Ads 전환가치와는 큰 차이가 남는다.
- 따라서 단순히 Google confirmed 주문을 기다리기보다, Google Ads의 Primary 전환=입찰 학습에 쓰는 핵심 구매 신호가 실제 구매완료인지부터 정리해야 한다.

### Google Ads last_30d vs 내부 confirmed

| 기준 | Google Ads 주장값 | 내부 confirmed 주문 원장 기준 |
|---|---:|---:|
| 비용 | 19,620,025원 | 19,620,025원 |
| 전환수 | 2,119.76 | 20건 |
| 전환가치/매출 | 218,792,943원 | 4,116,027원 |
| ROAS | 11.15 | 0.21 |
| NPay 실제 결제 보정 포함 내부 매출 | - | 42,042,927원 |
| NPay 실제 결제 보정 포함 내부 ROAS | - | 2.14 |

### 왜 Google Ads 값이 커 보이는가

conversion action breakdown 기준:

| 전환 액션 | 속성 | last_7d 값 | 해석 |
|---|---|---:|---|
| 구매완료 | Primary / PURCHASE / known NPay label | 37,062,793원 | Google Ads 전환가치의 거의 전부를 차지한다. 내부 confirmed와 직접 동일시하면 안 된다. |
| TechSol - NPAY구매 50739 | Secondary / All conversions only | 35,903,443원 | 입찰 핵심값은 아니지만 All conversions에는 큰 값으로 잡힌다. |
| sign_up | Primary / non revenue action | 2건 | 구매가 아닌 액션이 primary에 섞여 있다. |
| add_to_cart | Primary true / value 0 | 0원 | 전환가치는 없지만 primary 설정 여부 확인이 필요하다. |

판정:
- `Google Ads ROAS`는 광고 플랫폼이 주장하는 값이다.
- `내부 confirmed ROAS`는 실제 결제완료 주문 원장 기준값이다.
- 예산 판단에 쓸 값은 내부 confirmed ROAS 또는 NPay 보정 포함 내부 ROAS이며, Google Ads ROAS는 현재 참고 지표로만 봐야 한다.

### 재조회 시점

무작정 24시간 대기가 아니라 다음 조건으로 본다.

1. 2026-05-23 10:00 KST: 밤사이 운영DB/VM Cloud payment_success sync가 반영된 뒤 1차 재조회.
2. 2026-05-24 10:00 KST: 보강 후 48시간권 confirmed 표본 재조회.
3. 2026-05-26 10:00 KST: 72시간 이상 누적 후 재판정.
4. 위 시점 전이라도 Google 유입 confirmed 주문이 3건 이상 생기면 즉시 재조회.

### 지금 해야 할 일

- Google confirmed 주문 표본 대기: 필요하지만 보조 작업이다.
- Google Ads 전환 정의 점검: 즉시 필요하다. 특히 `구매완료` primary 액션이 실제 결제완료 주문인지, NPay 클릭/주문생성/플랫폼 자동값인지 분리해야 한다.
- 내부 confirmed purchase 업로드 후보 설계: Red Lane이다. Google Ads에 실제 결제완료 주문만 구매로 알려주는 새 전환 통로를 만들 수 있지만, 실제 send/import 전에는 TJ님 승인이 필요하다.
