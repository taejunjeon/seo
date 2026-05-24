# GTM / GA4 인벤토리 인덱스

작성 시각: 2026-05-24 16:40 KST
기준일: 2026-05-24
문서 성격: 바이오컴·더클린커피 GTM/GA4 문서 라우터

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Green
  allowed_actions:
    - gtm_api_read_only
    - ga4_bigquery_read_only_aggregate
    - documentation_update
  forbidden_actions:
    - gtm_publish
    - gtm_submit_create_version
    - ga4_measurement_protocol_send
    - platform_send_or_upload
    - operating_db_write
    - vm_cloud_deploy
source_window_freshness_confidence:
  source: GTM API live version + GA4 BigQuery daily export
  window: all available GA4 daily export tables per site
  freshness: biocom:events_20260516, thecleancoffee:events_20260516
  confidence: high for inventory, medium for runtime firing until Preview
```

## 10초 요약

- 기존 `GA4/gtm.md`는 바이오컴 중심으로 너무 길어졌고, 더클린커피 메모까지 섞여 있었다.
- 이제 문서는 **인덱스**, **바이오컴 정본**, **더클린커피 정본**, **Preview 전용 체크리스트**로 나눈다.
- 실제 태그 수정, GTM Publish, GA4/Meta/Google/TikTok/Naver 전송은 하지 않았다.
- GTM 태그 존재와 GA4 적재 이벤트는 확인했지만, 실제 브라우저 발화 원인은 Preview only에서 확인해야 한다.

## 문서 지도

| 문서 | 무엇을 볼 때 쓰나 | 왜 필요한가 |
| --- | --- | --- |
| [바이오컴 GTM/GA4 인벤토리](gtm-biocom.md) | 바이오컴 GTM live 태그와 GA4 적재 이벤트를 볼 때 | 바이오컴 전환/장바구니/구매 이벤트 기준을 한 곳에 고정 |
| [더클린커피 GTM/GA4 인벤토리](gtm-thecleancoffee.md) | 더클린커피 GTM live 태그와 GA4 적재 이벤트를 볼 때 | HURDLERS 태그와 GA4 중간 이벤트 gap을 분리 |
| [GTM Preview 전용 체크리스트](gtm-preview-only-checklist.md) | GTM Preview를 실제로 열기 전 | Preview와 Publish를 혼동하지 않고 발화만 검증 |

## 현재 live 기준 요약

| site | GTM | live version | live tags | GA4 source | GA4 export window | GA4 event_names |
| --- | --- | --- | --- | --- | --- | --- |
| biocom | GTM-W2Z6PHN | 143 (AGENT_OS Path B identity-first canary 20260509T121717Z) | 60 | project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_* | 2026-05-07~2026-05-16 (10 tables) | 23 |
| thecleancoffee | GTM-5M33GC4 | 23 (Coffee Meta InitiateCheckout shop_payment subscription guard - 20260524T074633Z; 2026-05-24 TJ님 승인 publish + subscription guard) | 34 | project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_* | 2026-04-07~2026-05-16 (40 tables) | 16 |

더클린커피 GTM은 2026-05-24 16:47 KST read-only 재조회에서 live version 23, tags 34, triggers 25, variables 13으로 확인했다. version 23은 TJ님 승인에 따라 일반 주문서 `/shop_payment/` 전용 Meta browser `InitiateCheckout` 태그를 추가하고, 정기구독 checkout 중복 방지 guard를 보강한 게시다. Default Workspace만 남아 있고, `add_payment_info` 태그는 live GTM에 없다. 상세 판단은 [더클린커피 GTM/GA4 인벤토리](gtm-thecleancoffee.md)를 따른다.

## 운영 원칙

1. GTM 태그 이름은 관리자용 라벨이다. GA4 분석에는 `event_name`을 기준으로 본다.
2. Preview는 확인 도구이고, Submit/Create version/Publish는 운영 변경이다.
3. 구매완료 판단은 GA4 이벤트만으로 하지 않는다. 결제완료 원장과 광고 evidence를 분리한다.
4. NPay 클릭/장바구니/결제 시작/결제수단 선택은 구매 전 선행지표다. 실제 구매와 섞지 않는다.
