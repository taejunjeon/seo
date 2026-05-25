# Google NPay 외부 결제완료와 내부 click id 연결 진단 - 2026-05-25

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
  required_context_docs:
    - data/!data_inventory.md
    - AGENTS.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only snapshot
    - operational PostgreSQL read-only dry-run
    - local dry-run report generation
    - documentation
  forbidden_actions:
    - DB write/apply
    - Google Ads conversion upload
    - GA4/Meta/TikTok platform send
    - GTM publish
    - backend/frontend deploy
    - real payment test
  source_window_freshness_confidence:
    source:
      - VM Cloud SQLite snapshot: /tmp/seo-vm-crm-20260525T055307Z.sqlite3
      - operational_postgres.public.tb_iamweb_users via npay-roas-dry-run
    window:
      - target_order: 2026-05-24 13:40~13:53 KST
      - recent_check: 2026-05-23 09:00 KST ~ 2026-05-25 05:56 KST
    freshness: snapshot copied 2026-05-25 05:53 KST
    confidence: high for VM Cloud rows, medium-high for operational order dry-run, no platform send
```

## 한 줄 결론

NPay 외부 결제완료 주문은 내부 Google click id와 "이어 붙일 실마리"가 있다. 주문 생성 시각을 추가 기준으로 넣으면 TJ님 테스트 주문은 내부 분석용 strong match까지 올라간다. 다만 결제완료 row에 click id가 직접 붙은 것은 아니므로 Google Ads 전송 후보로 쓰면 안 된다.

## 이번에 확인한 주문

| 구분 | 값 |
|---|---|
| 내부 주문번호 | 202605242646467 |
| NPay 주문번호 | 2026052431047480 |
| 결제완료 시각 | 2026-05-24 13:53:24 KST |
| 상품 | 바이오밸런스 90정 (1개월분) |
| 금액 | 39,000원 |
| 결제수단 | NAVERPAY_ORDER |

## 주문 흐름별로 본 연결 상태

### 1. Google 광고 클릭 유입

- `site_landing_ledger`에 2026-05-24 13:40:33 KST Google paid search row가 있다.
- 같은 row에 Google click id가 있다.
- campaign은 `googleads_biocom_biobalance_PM(USP2)`로 잡혔다.
- 같은 client/session 값이 뒤의 NPay intent row와 이어진다.

판단: 광고 클릭 수집은 됐다.

### 2. NPay 버튼 클릭 의도

- `npay_intent_log`에 2026-05-24 13:40:55 KST row가 있다.
- 상품, 금액, Google click id, client id, GA session id가 있다.
- 이 row가 해당 NPay 결제완료 주문의 1순위 후보다.

판단: NPay 버튼을 누른 시점까지는 Google click id가 살아 있다.

### 3. NPay 외부 결제완료 주문

- 운영 주문 기준으로 실제 결제완료 주문이 있다.
- VM Cloud `imweb_orders`에도 NPay 주문 row는 있다.
- 하지만 `attribution_ledger`에는 이 주문번호나 NPay 주문번호가 들어간 row가 0건이다.
- `order_bridge_ledger`에도 같은 client/session으로 이어지는 row가 0건이다.

판단: NPay 외부 결제완료가 끝난 뒤, 우리 내부 attribution 원장으로 "이 주문번호가 이 클릭이다"라고 직접 찍히는 단계가 없다.

### 4. 자동 매칭 결과

기존 `npay-roas-dry-run` 결과:

- best candidate score: 70
- second candidate score: 60
- score gap: 10
- candidate count: 25
- amount match: exact
- product match: exact
- click id: present
- client/session: present
- member key: absent
- status: ambiguous

사람이 보면 TJ님 테스트 주문과 가장 잘 맞는 후보가 보인다. 하지만 시스템만 보면 같은 상품 클릭 후보가 여러 개라서 자동 확정은 아직 위험하다.

주문 생성 시각 bridge 보강 후 결과:

- best candidate score: 105
- second candidate score: 60
- score gap: 45
- order_create_time_bridge: exact
- order creation gap: 0분
- status: strong_match
- grade: B
- Google Ads upload candidate: 0건 유지

해석: NPay 버튼 클릭과 Imweb/NPay 주문 생성은 사실상 동시에 일어났다. 내부 분석에서는 강한 후보로 볼 수 있지만, 결제완료까지 12.5분이 걸렸고 direct payment_success row가 없으므로 Google Ads 전송 후보는 아니다.

## 내부 가상계좌 주문과 비교

비교 주문: 202605245546619

| 단계 | 주문번호 있음 | Google click id 있음 | 판단 |
|---|---:|---:|---|
| checkout_started | yes | yes | 정상 |
| payment_page_seen | yes | yes | 정상 |
| payment_success pending | yes | yes | 정상 |

가상계좌 주문은 아임웹 내부 결제완료 URL에서 끝나므로, 내부 원장에 주문번호와 Google click id가 같이 남는다. 반면 NPay는 외부 결제완료 페이지에서 끝나고, 내부 원장에는 결제완료 주문번호가 직접 들어오지 않는다.

## 최근 48시간 NPay 전체 패턴

기준: 2026-05-23 09:00 KST ~ 2026-05-25 05:56 KST

| 항목 | 값 |
|---|---:|
| NPay intent row | 55 |
| Google click id가 있는 NPay intent row | 37 |
| 실제 NPay 결제완료 주문 | 7 |
| strong match | 5 |
| ambiguous | 2 |
| Google/GA4/Meta/TikTok/Google Ads 전송 후보 | 0 |
| attribution_ledger에 주문번호가 직접 찍힌 NPay 주문 | 0 |

해석:

- NPay 버튼 클릭 시점에는 Google click id가 꽤 잘 들어온다.
- 실제 결제완료 주문도 운영 주문 원장에는 들어온다.
- 끊기는 지점은 "NPay 결제완료 주문번호와 NPay intent row를 직접 연결하는 내부 bridge"다.

## 현재 결론

1. Google click id 보존 실패가 아니다. NPay 버튼 클릭까지는 보존된다.
2. NPay 외부 결제완료 후 주문번호가 attribution 원장으로 직접 돌아오지 않는 것이 핵심 병목이다.
3. `imweb_orders.order_time`을 쓰면 NPay 버튼 클릭과 주문 생성은 더 강하게 묶을 수 있다.
4. 이 후보는 내부 분석에는 유용하지만 Google Ads에 실제 구매로 보내면 안 된다.
5. 다음 보강은 이 bridge를 화면에 별도 표시하고, 실제 write/apply는 별도 승인 뒤에만 진행하는 것이다.

## 다음 설계 방향

### 1. NPay intent 자동 재매칭 기준 보강

현재 B/ambiguous로 막힌 이유는 같은 상품 후보가 많고 member key가 없기 때문이다.

보강 방향:

- 같은 client id와 GA session id가 정확히 이어지는 후보에는 점수를 더 준다.
- 사용자가 NPay 버튼을 누른 뒤 15분 안에 같은 금액/상품으로 결제완료된 경우를 별도 등급으로 분리한다.
- 그래도 같은 조건의 후보가 2개 이상이면 계속 전송 금지한다.

### 2. NPay 결제완료 주문번호 bridge 설계

가장 좋은 상태는 NPay 외부 결제완료 후 내부에 아래 묶음이 직접 남는 것이다.

```text
NPay 주문번호
내부 주문번호
client id
GA session id
gclid/gbraid/wbraid presence
상품/금액
결제완료 시각
```

이 bridge가 생기면 지금처럼 시간/상품만으로 추측하지 않고, 주문번호 기준으로 더 강하게 묶을 수 있다.

### 3. Google Ads upload는 계속 금지

이번 조사에서 Google click id가 있는 후보는 보였지만, direct order evidence가 아니므로 Google Ads conversion upload 후보는 0건 유지가 맞다.

## 검증 명령

```bash
sqlite3 /tmp/seo-vm-crm-20260525T055307Z.sqlite3
NPAY_INTENT_DB_PATH=/tmp/seo-vm-crm-20260525T055307Z.sqlite3 \
  npx tsx backend/scripts/npay-roas-dry-run.ts \
  --start=2026-05-23T00:00:00.000Z \
  --end=2026-05-24T20:56:16.349Z \
  --format=json
```

## 감사 판단

PASS_WITH_NOTES

- read-only만 수행했다.
- DB write, 플랫폼 전송, 배포, GTM publish는 하지 않았다.
- Google Ads upload 후보는 0건으로 유지했다.
- 원문 gclid/gbraid/wbraid는 문서에 기록하지 않았다.
