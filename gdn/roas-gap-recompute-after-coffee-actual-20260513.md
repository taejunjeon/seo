# ROAS Gap Recompute After Coffee Actual

작성 시각: 2026-05-13 02:18:00 KST
상태: Green read-only recompute 완료
Owner: Codex
Do not use for: Google Ads conversion upload, campaign budget change, GA4/Meta/TikTok/Naver send, GTM publish

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/coffee-data/README.md
    - project/sprint2.md
  lane: Green read-only ROAS recompute
  allowed_actions:
    - Google Ads dashboard read-only API
    - VM Cloud SQLite read-only aggregate
    - site summary API read-only
    - local JSON/Markdown evidence
    - scoped commit/push
  forbidden_actions:
    - platform upload/send
    - conversion action mutate
    - operational DB write
    - GTM publish
    - campaign budget change
  source_window_freshness_confidence:
    source: "Google Ads dashboard API + VM Cloud imweb_orders + site summary API"
    window: "last_7d / last_30d"
    freshness: "2026-05-13 02:18:00 KST; coffee status sync stale warning remains"
    confidence: 0.88
```

## 10초 요약

Google Ads 플랫폼이 주장하는 ROAS는 여전히 10배대다. 내부 결제완료 원장 기준 ROAS는 biocom NPay actual을 합쳐도 last_7d 3.18, last_30d 2.07이다. 더클린커피 actual을 cross-site 참고값으로 얹으면 last_7d 4.85, last_30d 2.75까지 보이지만, 이는 Google Ads 예산 판단값이 아니라 site/source 분리 참고값이다.

## 핵심 숫자

| Window | Google Ads ROAS | 내부 current ROAS | biocom NPay 보정 후 ROAS | coffee 참고 overlay ROAS | 예산 판단값 |
|---|---:|---:|---:|---:|---|
| last_7d | 10.52 | 0.41 | 3.18 | 4.85 | biocom NPay 보정 후 |
| last_30d | 10.27 | 0.29 | 2.07 | 2.75 | biocom NPay 보정 후 |

## 왜 중요한가

Google Ads ROAS는 광고 플랫폼이 자기 전환 기준으로 주장하는 값이다. 내부 confirmed ROAS는 실제 결제완료 주문 원장 기준값이다. 이 둘을 섞으면 예산 판단이 흔들린다.

이번 재계산은 NPay 실제 결제완료 매출을 내부 분자에 더해도 gap이 얼마나 남는지 본다. gap이 남는다면 다음 문제는 매출 누락보다 광고 클릭-주문 연결 evidence와 Google Ads Primary 전환 구조다.

## last_7d

| 항목 | 값 |
|---|---:|
| Google Ads cost | 3,621,241원 |
| Google Ads conversion value | 38,080,023원 |
| Google Ads ROAS | 10.52 |
| 내부 current revenue | 1,470,000원 |
| 내부 current ROAS | 0.41 |
| biocom NPay actual | 70건 / 10,041,200원 |
| biocom NPay 보정 후 내부 revenue | 11,511,200원 |
| biocom NPay 보정 후 내부 ROAS | 3.18 |
| coffee 참고 actual | 101건 / 6,034,000원 |
| coffee 참고 overlay ROAS | 4.85 |

## last_30d

| 항목 | 값 |
|---|---:|
| Google Ads cost | 22,055,514원 |
| Google Ads conversion value | 226,450,143원 |
| Google Ads ROAS | 10.27 |
| 내부 current revenue | 6,448,110원 |
| 내부 current ROAS | 0.29 |
| biocom NPay actual | 230건 / 39,254,600원 |
| biocom NPay 보정 후 내부 revenue | 45,702,710원 |
| biocom NPay 보정 후 내부 ROAS | 2.07 |
| coffee 참고 actual | 311건 / 14,970,600원 |
| coffee 참고 overlay ROAS | 2.75 |

## 판단

예산 판단에 바로 쓸 값은 biocom NPay 보정 후 내부 ROAS다. 그 기준으로 last_7d는 3.18, last_30d는 2.07이다. Google Ads 플랫폼 ROAS 10.52 / 10.27과의 차이는 각각 7.34p / 8.20p 남는다.

coffee actual overlay는 전체 내부 매출 참고값이다. latest read-only 기준 last_7d 101건 / 6,034,000원, last_30d 311건 / 14,970,600원이 확인됐다. 그러나 site/source가 다르므로 Google Ads 예산 판단값으로 쓰려면 campaign/site spend mapping이 먼저 필요하다.

`status blank`는 VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`의 `imweb_orders.imweb_status`가 비어 있다는 뜻이다. 2026-05-13 02:02 KST 확인에서 blank 16건 / 1,012,700원은 모두 `imweb_status_synced_at` marker가 없고, 최신 status sync 이후에 주문 row가 들어온 상태라 `source_freshness_gap/status sync lag`로 분류했다. 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`의 결제 상태 blank가 아니며, 미결제 단정 근거도 아니다.

## Source / Window / Freshness / Confidence

| 항목 | 값 |
|---|---|
| Google Ads source | live dashboard API read-only |
| Coffee source | VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders(site='thecleancoffee', pay_type='npay')` read-only |
| Site summary cross-check | live `/api/attribution/site-landing/summary` |
| Window | last_7d, last_30d |
| Freshness | 2026-05-13 02:18:00 KST; coffee max_synced_at 2026-05-12 16:59:56; coffee status 2026-05-12 04:11:07 |
| Confidence | 0.88 |

## 다음 할일

### Auto Green

1. Google Ads campaign/site mapping gap 줄이기
- 무엇을 하는가: coffee overlay를 예산 판단값으로 쓸 수 있는지 campaign/site 매핑을 확인한다.
- 왜 하는가: site가 다른 매출을 한 ROAS 분자에 섞으면 예산 판단이 왜곡될 수 있다.
- 성공 기준: campaign 또는 landing/site 기준으로 biocom/coffee spend와 revenue를 분리한다.
- 승인 필요: NO, read-only.
- 추천 점수/자신감: 86%.

2. Option 3 Red packet 숫자 갱신
- 무엇을 하는가: Google Ads Primary 전환 구조 변경안의 예상 효과를 최신 gap 수치로 갱신한다.
- 왜 하는가: NPay actual 보정 후에도 gap이 7~8p 남아 자동입찰 학습 신호 문제가 계속된다.
- 성공 기준: TJ님이 YES/NO로 판단 가능한 승인안이 된다.
- 승인 필요: 문서 갱신은 NO, 실제 Google Ads 변경은 YES Red.
- 추천 점수/자신감: 84%.

### Approval Needed

현재 recompute 자체에는 TJ님 승인 필요 없음. 실제 Google Ads conversion action 변경, upload/send, campaign budget 변경은 Red Lane으로 별도 명시 승인 전 금지.
