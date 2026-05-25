작성 시각: 2026-05-25 23:23 KST
기준일: 2026-05-25
문서 성격: VM Cloud 원본 랜딩 read-only bridge 초안

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
    - docs/agent-harness/growth-data-harness-v0.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_readonly_query
    - local_sanitized_report_write
    - bridge_design_draft
  forbidden_actions:
    - vm_cloud_sqlite_write
    - operating_db_write
    - meta_ads_mutation
    - platform_send
    - gtm_publish
    - deploy_or_restart
  source_window_freshness_confidence:
    source: VM Cloud SQLite read-only, attribution_ledger + site_landing_ledger
    window: 2026-05-18 00:00:00 ~ 2026-05-26 00:00:00 UTC
    site: biocom
    freshness: 2026-05-25 23:23 KST read-only 조회
    confidence: high for aggregate counts, medium_high for bridge interpretation
```

## 10초 요약

고객 유입 장부에는 `/iiary02` 원본 랜딩이 0건으로 보이지만, 결제/체크아웃 원장 안의 원본 랜딩 URL에는 같은 경로가 148건 남아 있다.

그래서 `site_landing_ledger`만 보면 "해당 랜딩 유입이 없다"처럼 보일 수 있지만, `attribution_ledger.metadata_json.imweb_landing_url`을 함께 읽으면 원본 랜딩 후보를 복구할 수 있다.

이 초안은 조회 전용 bridge다. 원장 write, 배포, 광고 설정 변경은 하지 않는다.

## 먼저 용어 정리

`macro가 남았다`는 말은 그로스팀이나 대표가 이해하기 어렵다. 앞으로는 아래 표현을 쓴다.

> Meta가 숫자 광고 ID로 자동 변환해야 하는 URL 매개변수가, 일부 실제 주문 기록에서는 숫자로 바뀌지 않고 템플릿 문구 그대로 저장됐다.

예상 정상값은 아래처럼 숫자가 들어오는 것이다.

```text
utm_campaign=120245003319500396
utm_term=120245700952890396
utm_content=120245701139440396
```

문제가 있는 값은 아래처럼 템플릿 문구가 그대로 남는 것이다.

```text
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
```

이 상태에서는 Meta 광고에서 온 것은 알 수 있지만, 내부 원장에서 어느 캠페인·광고세트·광고소재 매출인지 확정할 숫자 키가 없다.

## 왜 bridge가 필요한가

현재 고객 유입 장부는 실제 첫 랜딩 페이지 대신 결제 페이지, 상품 페이지, 결제완료 페이지를 랜딩처럼 기록하는 경우가 있다. 그러면 "어떤 랜딩 페이지가 매출을 만들었는가"를 볼 때 왜곡이 생긴다.

반면 결제/체크아웃 원장에는 아임웹이 넘긴 원본 랜딩 URL이 `metadata_json.imweb_landing_url` 형태로 남아 있다. 이 값을 읽기만 해서 보조 증거로 쓰면, 고객 유입 장부가 놓친 원본 랜딩을 복구할 수 있다.

## read-only bridge 규칙 초안

1. 고객 유입 장부에 원본 랜딩 path가 없을 때만 결제/체크아웃 원장의 `metadata_json.imweb_landing_url`을 보조 증거로 읽는다.
2. 숫자 campaign/adset/ad ID가 있으면 A급 매칭 재료로 쓴다.
3. 고유 campaign alias가 있고 단일 광고와만 연결되면 B급 제안으로 둔다.
4. 원본 랜딩 경로만 있고 숫자 ID가 없으면 C급 후보로 둔다.
5. `{{campaign.id}}` 같은 템플릿 문구가 그대로 남은 row는 D급 수동확인으로 둔다.
6. D급 row는 Meta 유료 유입 보조 매출로 볼 수 있지만, campaign/adset/ad 중 하나로 자동 배정하지 않는다.
7. bridge 결과를 새 방문으로 중복 가산하지 않는다. 같은 세션/일자/원본 랜딩 기준으로 dedupe해야 한다.

## `/iiary02` read-only 결과

source: VM Cloud SQLite read-only

window: 2026-05-18 00:00:00 ~ 2026-05-26 00:00:00 UTC

freshness: 2026-05-25 23:23 KST

site: biocom

```text
site_landing_ledger exact path rows: 0

attribution bridge source rows: 148
metadata text mentions: 151
metadata text mentions without usable imweb_landing_url: 3
rows with UTM: 148
rows with fbclid: 136
numeric ID rows: 132
template phrase rows: 16
generic alias rows: 148
checkout_started rows: 94
confirmed payment rows: 54
confirmed revenue: ₩19,636,820
first logged_at UTC: 2026-05-18T01:46:09.396Z
last logged_at UTC: 2026-05-25T12:22:13.380Z
```

참고로 `metadata_json` 텍스트 안에 `/iiary02`가 보이는 row는 151건이다. 그중 3건은 실제로 파싱 가능한 `imweb_landing_url` 값이 없어 원본 랜딩 URL bridge의 직접 재료로 쓰지 않았다. 그래서 이전 수기 조사에서 말한 "관련 151건"과 이 초안의 "원본 랜딩 URL bridge 148건"은 서로 다른 기준이다.

## 등급별 결과

| 등급 | 뜻 | row | checkout_started | confirmed payment | confirmed revenue |
|---|---|---:|---:|---:|---:|
| A | 숫자 campaign/adset/ad ID가 있어 광고 계층 매칭 재료로 쓸 수 있음 | 132 | 84 | 48 | ₩17,742,820 |
| D | Meta가 숫자로 바꿔줘야 하는 템플릿 문구가 그대로 남음 | 16 | 10 | 6 | ₩1,894,000 |

## campaign evidence rollup

| campaign evidence | row | checkout_started | confirmed payment | confirmed revenue | top term | top content |
|---|---:|---:|---:|---:|---|---|
| 120245003319500396 | 115 | 72 | 43 | ₩15,005,770 | 120245700952890396 89건, 120245956430970396 26건 | 120245701139440396 89건, 120245956430950396 26건 |
| 120242626179290396 | 17 | 12 | 5 | ₩2,737,050 | 120242626179270396 17건 | 120245955028820396 17건 |
| {{campaign.id}} | 16 | 10 | 6 | ₩1,894,000 | {{adset.id}} 16건 | {{ad.id}} 16건 |

## 템플릿 문구 그대로 남은 row 해석

Meta가 실제 숫자 광고 ID로 바꿔줘야 하는 URL 매개변수가 일부 원장 row에서 템플릿 문구 그대로 남은 상태입니다. Meta 유료 유입인 것은 보이지만 campaign/adset/ad를 확정할 숫자 키가 없습니다.

이번 조회에서 템플릿 문구 그대로 남은 row는 16건이고, 이 중 실제 결제완료는 6건, 금액은 ₩1,894,000이다.

같은 세션 안에서 그보다 앞선 숫자 UTM row는 0건이었다. 즉 원장 안의 다른 row를 끌어와 숫자 campaign/adset/ad로 자동 치환할 근거는 아직 없다.

## 운영 반영 전 필요한 결정

이 초안은 read-only bridge다. 지금 바로 원장을 바꾸지 않는다.

운영 반영을 하려면 아래 중 하나를 선택해야 한다.

1. 보고서/프론트에서만 bridge를 읽어 보조 증거로 보여준다. 운영 write 없음.
2. 백엔드 helper로 bridge를 만들고 테스트 후 VM Cloud 배포를 승인받는다.
3. 장기적으로 원본 랜딩 필드를 별도 저장하도록 schema 변경 또는 backfill 설계를 만든다. 이 경우 write/schema 변경이므로 별도 명시 승인이 필요하다.

## Auditor verdict

PASS_WITH_NOTES.

읽기 전용 집계와 로컬 산출물 작성만 수행했다. VM Cloud write, 운영DB write, Meta 광고 설정 변경, 플랫폼 전송, GTM publish, 배포는 수행하지 않았다.
