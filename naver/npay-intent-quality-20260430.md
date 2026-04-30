# NPay Intent 수집 품질 점검

작성 시각: 2026-04-30 11:55 KST
기준일: 2026-04-30
대상: 바이오컴 `GTM-W2Z6PHN` live version `139`, `npay_intent_log`
Primary source: VM SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`, table `npay_intent_log`
Cross-check: 보호된 `GET /api/attribution/npay-intents?limit=1`, GTM API read-only live version 조회
Window: 2026-04-27 18:10 KST live publish 이후 ~ 2026-04-30 11:50 KST
Freshness: 최신 intent `2026-04-30 11:27:10 KST`, 조회 시각 대비 약 23분 전
Confidence: 88%

## 10초 요약

결론은 `유지`다. NPay intent-only live publish 이후 수집은 끊기지 않았고, 주문 매칭에 필요한 `client_id`, `ga_session_id`, `product_idx` 채움률이 기준을 넘었다.

2026-04-27 18:10 KST 이후 live intent는 251건이다. 최근 24시간 live intent는 92건이고, 이 구간의 `client_id`, `ga_session_id`, `product_idx` 채움률은 모두 100%다.

아직 purchase dispatcher를 열면 안 된다. 다음 단계는 2026-05-04 18:10 KST 이후 7일치 intent와 실제 NPay 주문을 붙여 `matched / ambiguous / unmatched` dry-run을 보는 것이다.

## 결론

| 질문 | 판단 | 근거 | 자신감 |
|---|---|---|---:|
| NPay intent 수집을 rollback해야 하나 | NO | live intent 251건, 최신 24시간에도 92건 수집 | 93% |
| `ga_session_id` 보정은 작동하나 | YES | live 이후 248/251건, 최신 24시간 92/92건 채움 | 91% |
| 상품 식별은 충분한가 | YES | `product_idx`, `product_name` 모두 251/251건 채움 | 92% |
| 중복이 과도한가 | NO | live 이후 duplicate row 22/251건, 최신 24시간 4/92건 | 84% |
| purchase 전송이 열렸나 | NO | server dispatch 0건, tag 118에 purchase call 없음 | 94% |
| 지금 바로 서버 purchase dispatcher를 켜도 되나 | NO | 아직 실제 주문 매칭률을 보지 않았다 | 78% |

## 기준 대비 결과

| 기준 | 목표 | live 이후 결과 | 최근 24시간 결과 | 판정 |
|---|---:|---:|---:|---|
| client_id 채움률 | 90% 이상 | 249/251, 99.2% | 92/92, 100% | 통과 |
| ga_session_id 채움률 | 80~90% 이상 | 248/251, 98.8% | 92/92, 100% | 통과 |
| product_idx 채움률 | 80~90% 이상 | 251/251, 100% | 92/92, 100% | 통과 |
| product_name 채움률 | 80~90% 이상 | 251/251, 100% | 92/92, 100% | 통과 |
| product_price 채움률 | 참고 | 248/251, 98.8% | 90/92, 97.8% | 통과 |
| UTM source 채움률 | 참고 | 211/251, 84.1% | 87/92, 94.6% | 양호 |
| Google click key 채움률 | 참고 | 218/251, 86.9% | 85/92, 92.4% | 양호 |
| server purchase dispatch | 0건 | 0건 | 0건 | 정상 |

## 수집량

| 구간 | live row | duplicate_count 합계 | ga_session_id row | product_idx row |
|---|---:|---:|---:|---:|
| 2026-04-27 18:10 이후 전체 | 251 | 32 | 248 | 251 |
| 최초 24시간 | 111 | 22 | 108 | 111 |
| 최근 24시간 | 92 | 4 | 92 | 92 |

일자별 수집량은 아래와 같다.

| KST 날짜 | live row | duplicate_count 합계 | ga_session_id row | product_idx row |
|---|---:|---:|---:|---:|
| 2026-04-27 | 18 | 2 | 18 | 18 |
| 2026-04-28 | 100 | 21 | 97 | 100 |
| 2026-04-29 | 98 | 9 | 98 | 98 |
| 2026-04-30 00:00~11:50 | 35 | 0 | 35 | 35 |

해석: 2026-04-28 초반에 중복 클릭 흡수가 있었지만, 최신 24시간은 중복이 줄었다. `duplicate_count`는 새 row가 늘었다는 뜻이 아니라 서버 dedupe가 같은 클릭성 호출을 기존 row에 흡수했다는 뜻이다.

## 주요 상품

| product_idx | 상품명 | live row | duplicate_count | ga_session_id row |
|---:|---|---:|---:|---:|
| 97 | 바이오밸런스 90정 | 65 | 12 | 63 |
| 198 | 뉴로마스터 60정 | 45 | 2 | 45 |
| 317 | 혈당관리엔 당당케어 | 43 | 7 | 43 |
| 171 | 풍성밸런스 90정 | 23 | 2 | 23 |
| 328 | 종합 대사기능&음식물 과민증 검사 Set | 22 | 1 | 22 |
| 300 | 영데이즈 저속노화 SOD 효소 | 21 | 2 | 21 |
| 386 | 메타드림 식물성 멜라토닌 | 20 | 3 | 20 |

상품 식별은 `product_idx`를 기준으로 쓰는 것이 맞다. 일부 상품은 같은 `product_idx`에 긴 SEO 상품명과 짧은 상품명이 섞여 들어온다.

| product_idx | 관측된 상품명 수 | 판단 |
|---:|---:|---|
| 97 | 2개 | 주문 매칭에서는 `product_idx=97`을 우선해야 함 |
| 171 | 2개 | 주문 매칭에서는 `product_idx=171`을 우선해야 함 |
| 300 | 2개 | 주문 매칭에서는 `product_idx=300`을 우선해야 함 |

## 캠페인 식별

상위 유입은 Google Shopping 캠페인이 대부분이다.

| utm_source | row | ga_session_id row | 광고 click key row |
|---|---:|---:|---:|
| googleads_shopping_supplements_biobalance | 66 | 63 | 66 |
| empty | 40 | 40 | 20 |
| googleads_shopping_supplements_neuromaster | 38 | 38 | 38 |
| googleads_shopping_supplements_poongsung | 24 | 24 | 24 |
| googleads_shopping_supplements_dangdang | 23 | 23 | 23 |
| googleads_shopping_supplements_youngdays | 22 | 22 | 22 |
| googleads_shopping_supplements_metadream | 16 | 16 | 16 |

`empty` 40건은 실패로 보지 않는다. 이 중 20건은 `gclid` 계열 click key가 있어 광고 매칭 보조키가 남아 있다.

## 확인된 한계

1. `member_code`는 0/251건이다. 로그인 회원 단위 매칭에는 아직 쓰기 어렵다.
2. 같은 `product_idx`에 상품명이 2개씩 섞이는 케이스가 있다. 주문 매칭은 상품명보다 `product_idx`, 금액, 시간, 세션을 우선해야 한다.
3. 모든 row는 아직 `match_status=pending`이다. 이는 실패가 아니라 purchase dispatcher와 주문 매칭을 아직 열지 않았기 때문이다.
4. 이 리포트는 수집 품질 점검이다. 실제 NPay 주문과의 매칭률은 별도 dry-run에서 봐야 한다.

## GTM 상태 교차 확인

2026-04-30 KST에 GTM API read-only로 확인했다.

| 항목 | 결과 |
|---|---|
| live version | `139`, `npay_intent_only_live_20260427` |
| tag 118 endpoint | `/api/attribution/npay-intent` 포함 |
| tag 118 environment | `live` |
| tag 118 debug | `false` |
| tag 118 purchase call | 없음 |
| tag 43 | `add_payment_info`, 활성 |
| tag 48 | `purchase`, paused |
| tag 143 | `purchase`, 활성. 기존 homepage canonical |

## 다음 할일

| 순서 | 담당 | 무엇을 하는가 | 왜 하는가 | 어떻게 하는가 | 시점 |
|---:|---|---|---|---|---|
| 1 | Codex | 7일 NPay intent와 실제 주문 매칭 dry-run을 만든다 | 서버 purchase dispatcher를 열 수 있는지 판단해야 한다 | `npay_intent_log`와 confirmed NPay 주문을 시간, `product_idx`, 금액, 세션 기준으로 붙인다 | 2026-05-04 18:10 KST 이후 권장 |
| 2 | Codex | 상품명 정규화 규칙을 dry-run에 넣는다 | 같은 `product_idx`의 상품명이 흔들려도 매칭이 깨지면 안 된다 | 상품명은 보조 점수로만 쓰고, `product_idx`를 1순위 키로 둔다 | dry-run 작업 시 |
| 3 | Codex | `empty` UTM row 원인을 분해한다 | Direct/organic인지, 광고 click key만 남은 케이스인지 나눠야 한다 | `gclid`, referrer, landing path 기준으로 분류 | dry-run 전후 |
| 4 | TJ | 네이버페이/아임웹 return URL 답변을 공유한다 | Option A가 가능하면 dispatcher 없이도 일부 구매 완료 추적이 쉬워진다 | 네이버 문의 답변이 오면 문서에 전달한다 | 답변 수신 시 |

## 추천

추천은 `NPay intent-only live 수집 유지`다. rollback하지 않는다.

자신감은 88%다. 수집과 필수 식별값은 충분히 좋다. 다만 실제 주문 매칭률을 아직 확인하지 않았기 때문에, purchase dispatcher나 Meta CAPI Purchase 전송은 아직 열지 않는 것이 맞다.
