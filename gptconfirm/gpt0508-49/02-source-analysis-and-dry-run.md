# gpt0508-49 Source Analysis And Dry-run

## 한 줄 결론

더클린커피 actual source는 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`가 아니라 Imweb v2 / VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders(site='thecleancoffee')`로 봐야 한다. GA4 BigQuery는 구매 매출 source가 아니라 이미 GA4에 들어간 주문인지 확인하는 guard로만 쓴다.

## VM Cloud dry-run

| 항목 | 값 |
|---|---:|
| 기준 시각 | 2026-05-13 00:24 KST |
| window | 최근 30일 |
| source | VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders` |
| site | `thecleancoffee` |
| filter | `pay_type='npay'`, `payment_amount > 0`, `order_time >= now-30d` |
| gross | 339건 / 16,631,400원 |
| 취소/반품/교환 제외 | 31건 / 1,796,400원 |
| included_with_warning 후보 | 308건 / 14,835,000원 |
| confirmed_status_only 옵션 | 295건 / 13,957,900원 |
| status blank | 13건 / 877,100원 |
| latest read-only included_with_warning | 311건 / 14,970,600원 |
| latest read-only status blank | 16건 / 1,012,700원 |
| complete_time blank | 78건 / 5,478,600원 |
| max order time | 2026-05-12T14:32:39.000Z |
| max synced_at | 2026-05-12 15:14:50 |
| max status synced_at | 2026-05-12 04:11:07 |

## live post-snapshot

2026-05-13 00:57 KST 승인 배포 후 live summary API는 같은 source rule로 coffee actual을 반환한다. dry-run 대비 일반 sync 진행으로 1건 / 67,800원이 증가했다.

| 항목 | 값 |
|---|---:|
| source | `imweb_v2_vm_cloud_imweb_orders` |
| status | `included_with_warning` |
| included_with_warning live post-snapshot | 309건 / 14,902,800원 |
| status blank live post-snapshot | 14건 / 944,900원 |
| latest read-only included_with_warning | 311건 / 14,970,600원 |
| latest read-only status blank | 16건 / 1,012,700원 |
| warnings | `ga4_guard_not_actual_source`, `status_blank_rows_included_with_warning`, `status_sync_stale_over_6h` |
| biocom regression check | PASS, 162건 / 29,463,300원 |

## status blank 의미

`status blank`는 VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`의 `imweb_orders.imweb_status`가 비어 있다는 뜻이다. 이것은 운영DB PostgreSQL `dashboard.public.tb_iamweb_users.payment_status` blank가 아니고, 로컬DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` row도 아니다. 이번 데이터에서는 `pay_type='npay'`이고 `payment_amount > 0`이며 취소/반품/교환 status가 아니므로 actual 후보에는 포함한다. 대신 `included_with_warning` 상태로 표시하고, blank count/amount와 status freshness warning을 같이 내려준다.

2026-05-13 02:02 KST root-cause query에서 blank 16건은 모두 `imweb_status_synced_at` marker가 없었다. 또 16건 모두 최신 status sync 시각 `2026-05-12 04:11:07` 이후에 VM Cloud SQLite `imweb_orders.synced_at`으로 들어왔다. 따라서 현재 원인은 결제 실패가 아니라 `source_freshness_gap/status sync lag`다.

이번 dry-run에서는 status sync 최신값이 2026-05-12 04:11:07이고 집계 시각 대비 약 11시간 전이다. 그래서 API warnings에 `status_sync_stale_over_6h`가 붙어야 한다.

## 정책 옵션 비교

| 옵션 | 포함 숫자 | 장점 | 리스크 | 추천 |
|---|---:|---|---|---|
| `included_with_warning` | latest 311건 / 14,970,600원 | actual 누락을 줄이고 blank/freshness를 화면에 같이 노출 | status blank가 나중에 cancel로 바뀔 수 있음 | 추천 86% |
| `confirmed_status_only` | 295건 / 13,957,900원 | 과대확정 리스크가 가장 낮음 | status sync lag 때문에 실제 매출 누락 가능 | 보수 대안 |
| `bridge_pending_blank` | 295 included + 13 pending | 금액과 warning 분리 가능 | response/UI 복잡도 증가 | 후속 UI 개선 후보 |

## 추천

이번 로컬 패치는 `included_with_warning`을 추천한다. 이유는 더클린커피 Imweb v2 source가 site 분리와 NPay 주문번호를 갖고 있고, blank row도 positive amount NPay order이기 때문이다. 단, status blank와 stale status sync를 숨기면 안 된다. 그래서 count/amount/freshness warning을 API response에 같이 포함했다.

## GA4 역할

GA4 BigQuery `analytics_326949178`은 actual NPay 매출 source가 아니다. gpt0508-48에서 order/channel key 674개 robust search hit가 0건이었으므로, summary API 매 요청마다 BigQuery를 호출하지 않고 별도 daily audit 또는 guard endpoint로 분리하는 것이 맞다.

## source/window/freshness/confidence

- source: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders`, Imweb v2 captured order header.
- window: 2026-04-12T15:24:27.985Z 이후 30일.
- freshness: order sync max 2026-05-12 15:14:50, status sync max 2026-05-12 04:11:07.
- confidence: 0.86. source isolation은 좋고 tests도 PASS지만, status freshness가 stale이라 warning이 필요하다.
