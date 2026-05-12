# 더클린커피 Imweb/GA4 기반 VM Cloud source 구축 가능성

작성 시각: 2026-05-12 23:34 KST
Sprint: gpt0508-48
Lane: Green read-only 검토 + 문서화
Auditor verdict: PASS_WITH_NOTES
Confidence: 90%

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
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
  required_context_docs:
    - imwebapi.md
    - data/!coffeedata.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green read-only source feasibility review
  allowed_actions:
    - local/VM Cloud env redacted check
    - local/VM Cloud SQLite SELECT
    - Imweb v2 read-only aggregate query
    - GA4 BigQuery read-only guard query
    - source guide patch
    - approval packet draft
  forbidden_actions:
    - operational DB write/import
    - VM Cloud write/schema migration/deploy/restart/cron change
    - GA4/Meta/TikTok/Google Ads/Naver send/upload
    - GTM publish
    - Imweb footer/header edit
    - secret or raw PII output
  source_window_freshness_confidence:
    source: "Imweb v2 API + VM Cloud SQLite imweb_orders + GA4 BigQuery analytics_326949178"
    window: "last 30 days, checked 2026-05-12 23:34 KST"
    freshness: "VM Cloud imweb_orders max_synced_at=2026-05-12 14:14:56, max_status_synced_at=2026-05-12 04:11:07"
    confidence: 0.90
```

## 10초 결론

TJ님 말이 맞습니다. 더클린커피는 운영DB `tb_iamweb_users`로 site 격리가 안 됐을 뿐이고, Imweb v2 API와 VM Cloud `imweb_orders.site='thecleancoffee'`로는 주문만 분리되는 source를 구축할 수 있습니다.

단, GA4는 결제 정본이 아닙니다. GA4 BigQuery는 “이 주문번호가 이미 GA4에 들어갔는지”를 보는 중복 방지 guard로 쓰고, 실제 NPay 결제 원장은 Imweb v2/VM Cloud `imweb_orders`가 맡는 구조가 맞습니다.

## 확인한 것

### 1. 키와 접근성

- 로컬 `backend/.env`에는 `GA4_COFFEE_PROPERTY_ID`, `GA4_MEASUREMENT_ID_COFFEE`, `GA4_MP_API_SECRET_COFFEE`, `IMWEB_API_KEY_COFFEE`, `IMWEB_SECRET_KEY_COFFEE`가 모두 설정돼 있습니다.
- VM Cloud에는 `IMWEB_API_KEY_COFFEE`, `IMWEB_SECRET_KEY_COFFEE`, `GA4_COFFEE_PROPERTY_ID`, BigQuery read-only service account가 설정돼 있습니다.
- secret 값은 출력하지 않았습니다.

### 2. VM Cloud에는 이미 site 분리된 coffee 주문 source가 있다

VM Cloud SQLite `imweb_orders` 기준:

| 항목 | 값 |
|---|---:|
| thecleancoffee 전체 row | 3,340 |
| thecleancoffee NPay 전체 row | 1,356 |
| thecleancoffee NPay 전체 금액 | ₩58,037,900 |
| 최신 주문 시각 | 2026-05-12T14:00:05.000Z |
| 최신 order sync | 2026-05-12 14:14:56 |
| 최신 status sync | 2026-05-12 04:11:07 |

최근 30일을 backend summary와 같은 ISO timestamp 기준으로 보면:

| 항목 | 값 |
|---|---:|
| Imweb v2 `type=npay` row | 337 |
| 총액 | ₩16,374,100 |
| `order_code` 채움 | 337 / 337 |
| `channel_order_no` 채움 | 337 / 337 |
| `complete_time` 있음 | 260 |
| `complete_time` 없음 | 77 |

따라서 “coffee 주문만 분리되는 source”는 있습니다. `complete_time`이 비어 있는 77건은 미결제 판정이 아니라 bridge/status 확인 대상입니다.

### 3. 취소/상태 반영 후 dashboard actual 후보

VM Cloud `imweb_orders.imweb_status` 기준 최근 30일 NPay 분포:

| status | rows | amount |
|---|---:|---:|
| PURCHASE_CONFIRMATION | 199 | ₩8,531,700 |
| DELIVERING | 37 | ₩1,689,600 |
| CANCEL | 31 | ₩1,796,400 |
| STANDBY | 30 | ₩2,545,000 |
| COMPLETE | 28 | ₩1,157,700 |
| blank | 11 | ₩619,800 |
| PAY_COMPLETE | 1 | ₩33,900 |

보수적으로 취소/반품/교환을 제외하면:

- status blank까지 포함한 paid non-cancel 후보: 306건 / ₩14,577,700
- status가 확정된 non-cancel만 보면: 295건 / ₩13,957,900
- 취소 제외 대상: 31건 / ₩1,796,400

실제 live summary에 `included`로 올릴 때는 status sync freshness와 blank row 처리 방식을 같이 넣어야 합니다.

### 4. GA4는 guard로 쓸 수 있지만 payment truth는 아니다

GA4 BigQuery `analytics_326949178` 최근 30일:

| 항목 | 값 |
|---|---:|
| GA4 purchase event | 975 |
| GA4 purchase revenue | ₩46,626,964 |
| Imweb NPay order/channel key | 674 |
| GA4 purchase transaction key hit | 0 |
| GA4 event_params key hit | 0 |

해석:

- GA4에 현재 더클린커피 NPay 실제 주문번호가 직접 들어가 있지는 않습니다.
- 그래서 GA4만으로 NPay 결제완료를 만들 수 없습니다.
- 대신 `order_no`와 `channel_order_no`를 BigQuery에서 robust search해서 `already_in_ga4=present/absent` guard로 쓸 수 있습니다.
- `.env`의 `GA4_MP_API_SECRET_COFFEE`는 send용입니다. matching에는 쓰면 안 되고, 실제 전송은 Red Lane입니다.

### 5. 운영DB cross-check

운영DB read-only cross-check 결과:

| source | match |
|---|---:|
| `tb_playauto_orders(shop_name='아임웹-C')` | 275 / 337 order |
| `tb_iamweb_users` | 0 / 337 order |
| `tb_sales_toss(store='coffee')` | 0 / 337 order |

해석:

- `tb_iamweb_users`로 coffee actual included를 막았던 판단은 여전히 맞습니다.
- 하지만 그것은 `tb_iamweb_users` 한정 결론입니다.
- coffee actual primary는 Imweb v2/VM Cloud `imweb_orders`로 분리해야 합니다.

## 구현 가능 구조

### summary API source rule

`site=biocom`:

- 기존 유지: 운영DB `tb_iamweb_users`의 `NAVERPAY_ORDER + PAYMENT_COMPLETE + 취소/반품 제외 + 금액 양수`

`site=thecleancoffee`:

- 새 source: VM Cloud `imweb_orders`
- 필터:
  - `site='thecleancoffee'`
  - `pay_type='npay'`
  - `order_time >= now - 30 days`는 ISO timestamp 기준
  - `payment_amount > 0`
  - `imweb_status NOT IN ('CANCEL','RETURN','EXCHANGE')`
  - `complete_time`은 legacy diagnostic으로만 유지
- 응답에는 `source='imweb_v2_vm_cloud_imweb_orders'`, `status='included'`, freshness, status blank count, cancel excluded count를 함께 넣습니다.

### GA4 matching rule

- BigQuery export `analytics_326949178`만 read-only로 조회합니다.
- `order_no`, `channel_order_no` 둘 다 robust search합니다.
- 한쪽이라도 있으면 `already_in_ga4=present`, 둘 다 없으면 `robust_absent`.
- GA4 purchase revenue를 NPay actual 매출로 쓰지 않습니다.
- GA4 Measurement Protocol secret은 이 단계에서 쓰지 않습니다.

## live 반영 전 필요한 것

이 문서까지는 Green Lane입니다. live summary에서 더클린커피 actual included로 바꾸려면 Yellow Lane이 필요합니다.

권장 순서:

1. 로컬 코드 patch: coffee용 Imweb actual reader 추가.
2. fixture/test: biocom은 운영DB actual 유지, coffee는 Imweb source included, cancel row 제외, blank status warning 검증.
3. VM Cloud deploy/restart: backend만.
4. post-snapshot: coffee actual included가 306건/₩14,577,700 근처로 붙는지 확인. status blank를 pending으로 빼면 295건/₩13,957,900 근처가 기준입니다.
5. GA4 BigQuery guard는 daily audit 또는 별도 endpoint로 분리. summary API 매 요청마다 BigQuery를 직접 때리는 구조는 비용/latency 때문에 비추천입니다.

## 금지선 검증

- 운영DB write/import: 0
- VM Cloud write/schema migration/deploy/restart/cron change: 0
- GA4/Meta/TikTok/Google Ads/Naver send/upload: 0
- GTM publish: 0
- Imweb footer/header edit: 0
- raw secret/PII/order id 출력: 0

## 다음 할일

### Codex가 할 일

1. Green 로컬 patch를 진행한다.
   - 무엇을: `npayActualConfirmedPgReader`를 site별 source router로 나누고, coffee용 `imweb_orders` reader를 추가한다.
   - 왜: live summary에서 더클린커피 NPay 매출을 bridge_pending이 아니라 actual source로 보여주기 위해서다.
   - 어떻게: `site=thecleancoffee`일 때 VM Cloud/로컬 SQLite `imweb_orders`를 읽고, 취소/반품/교환 제외 + freshness warning을 응답에 넣는다.
   - 성공 기준: backend typecheck/test PASS, coffee fixture에서 cancel 제외와 GA4 no-send guard가 보인다.
   - 승인 필요 여부: NO, 로컬 코드/테스트까지만이면 Green.
   - 의존성: 없음.
   - 추천 점수/자신감: 92%.

2. Yellow 승인안을 만든다.
   - 무엇을: VM Cloud backend deploy/restart 승인 문구, rollback, post-snapshot 기준을 작성한다.
   - 왜: live API에 반영하려면 운영 backend restart가 필요하기 때문이다.
   - 어떻게: 변경 파일, 예상 응답 숫자, 중단 조건, rollback command를 문서화한다.
   - 성공 기준: TJ님이 YES/NO로 판단 가능한 승인안 1개.
   - 승인 필요 여부: 문서 작성은 NO, deploy/restart는 YES.
   - 의존성: 1번 로컬 patch/test 이후가 가장 정확하다.
   - 추천 점수/자신감: 88%.

### TJ님이 할 일

1. live 반영 여부를 결정한다.
   - 무엇을: 더클린커피 summary API에서 Imweb actual source를 `included`로 올리는 Yellow 배포를 승인할지 결정한다.
   - 왜: 현재 live dashboard는 coffee NPay를 bridge_pending으로 두고 있어 매출이 의도적으로 보수 표시된다.
   - 어떻게: Codex가 다음에 제시할 승인 문구에 `YES` 또는 `NO`로 답하면 된다.
   - 어디에서: 대화창에서 승인. 외부 화면 클릭은 필요 없다.
   - Codex가 대신 못 하는 이유: backend deploy/restart는 Yellow Lane이라 TJ님 sprint 승인이 필요하다.
   - 성공 기준: 승인 후 post-snapshot에서 coffee actual included와 no-send/no-write invariant가 같이 보인다.
   - 실패 시 해석: 5xx, wrong included, raw PII leak, status freshness stale이면 rollback.
   - 추천 점수/자신감: 86%.
