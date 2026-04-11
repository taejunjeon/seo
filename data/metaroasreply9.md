# metaroasreply9 - post-fix 경과, ROAS 방향, 주문 최신화

작성 시각: 2026-04-11 10:13:09 KST

## 1. 결론

- `post-fix` 기준은 이 문서 흐름에서 `2026-04-10 00:00:00 UTC`, 한국시간 `2026-04-10 09:00:00 KST`다.
- 현재는 `post-fix` 후 2일이 아니라 약 25시간, 즉 약 1.05일 지난 상태다.
- 만 2일 경과 시점은 `2026-04-12 09:00:00 KST`, 만 7일 경과 시점은 `2026-04-17 09:00:00 KST`다.
- biocom 아임웹 주문 캐시는 수동 최신화 후 `2026-04-11 10:05:06 KST` 주문까지 들어왔다.
- Attribution 상태 동기화는 수동 실행 결과 로컬 원장 49행을 갱신했다. 다만 현재 최근 7일 ROAS API 값은 이미 `confirmed 1.05x` 상태였고, 수동 실행 직후 추가 상승은 없었다.
- 로컬 DB auto-sync는 일부만 있다. Attribution 결제 상태 동기화는 15분 주기, CAPI 전송은 30분 주기로 있다. 아임웹 주문 캐시 최신화 auto-sync는 아직 없다.

## 2. 현재 ROAS 스냅샷

조회 API:

```bash
GET /api/ads/site-summary?date_preset=last_7d
GET /api/ads/roas/daily?account_id=act_3138805896402376&date_preset=last_7d
```

biocom 최근 7일 기준:

| 항목 | 값 |
| --- | ---: |
| 광고비 | 27,137,701원 |
| Attribution confirmed revenue | 28,452,940원 |
| Attribution confirmed orders | 102건 |
| Attribution confirmed ROAS | 1.05x |
| Attribution pending revenue | 645,700원 |
| Attribution confirmed+pending revenue | 29,098,640원 |
| Attribution confirmed+pending ROAS | 1.07x |
| Meta purchase value | 130,139,887원 |
| Meta purchase ROAS | 4.80x |
| site confirmed revenue | 96,698,243원 |
| site confirmed orders | 381건 |
| 잠정 best-case ceiling ROAS | 3.56x |

최근 7일 daily 흐름:

| 날짜 | 광고비 | Attribution confirmed | Attribution ROAS | Meta purchase value | Meta ROAS |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-04-04 | 3,429,082원 | 1,338,000원 | 0.39x | 5,337,105원 | 1.56x |
| 2026-04-05 | 2,944,291원 | 3,558,700원 | 1.21x | 14,858,274원 | 5.05x |
| 2026-04-06 | 4,152,783원 | 4,567,850원 | 1.10x | 21,785,695원 | 5.25x |
| 2026-04-07 | 4,371,859원 | 5,857,240원 | 1.34x | 19,449,075원 | 4.45x |
| 2026-04-08 | 4,703,115원 | 7,571,950원 | 1.61x | 29,744,150원 | 6.32x |
| 2026-04-09 | 4,278,721원 | 3,137,000원 | 0.73x | 23,564,352원 | 5.51x |
| 2026-04-10 | 3,257,850원 | 2,422,200원 | 0.74x | 15,401,236원 | 4.73x |

해석:

- 기존 `metaroas8reply.md`에 기록된 최근 7일 Attribution confirmed ROAS는 1.02x였다.
- 현재는 1.05x다. 주문/상태 보강 후 일부 상승한 상태로 봐도 된다.
- 다만 현재 pending을 전부 더해도 1.07x라, 같은 7일 구간의 단순 pending 확정만으로는 큰 폭 상승 여지가 작다.
- 2026-04-09, 2026-04-10 Attribution ROAS가 각각 0.73x, 0.74x로 낮아서, rolling 7일은 새 저성과 날짜가 계속 들어오면 내려갈 수도 있다.

## 2-1. Meta ROAS 기준일

먼저 용어를 분리해야 한다.

- 조회 기간: 대시보드가 광고비와 전환값을 몇 일치로 조회하는지다. 예: 1일, 7일, 14일, 30일.
- Meta 귀속창: Meta가 광고 클릭/조회 후 며칠 안에 발생한 구매를 해당 광고 성과로 잡는지다. 예: 1일 클릭, 7일 클릭, 1일 조회, 30일 클릭.

현재 우리 대시보드 조회 기간:

| 화면/API | 현재 기본값 | 현재 조회 범위 |
| --- | --- | --- |
| `/ads` | `last_7d` | 2026-04-04 - 2026-04-10 |
| `/ads/roas` | `last_7d` | 2026-04-04 - 2026-04-10 |
| `/api/ads/site-summary` | `last_7d` | 2026-04-04 - 2026-04-10 |
| `/api/ads/roas/daily` | `last_7d` | 2026-04-04 - 2026-04-10 |

즉 운영 기본 headline은 현재 30일이 아니라 최근 7일이다. 코드 기준으로도 backend 기본값은 `ADS_DEFAULT_DATE_PRESET = "last_7d"`이고, frontend `/ads`, `/ads/roas`도 `useState("last_7d")`로 시작한다.

Meta API 귀속 기준:

| 항목 | 현재 값 |
| --- | --- |
| `action_report_time` | `conversion` |
| `use_unified_attribution_setting` | `true` |
| 강제 `action_attribution_windows` 지정 | 없음 |
| 해석 | 우리가 1일/7일/30일을 API에서 강제로 고정하지 않고, Meta ad set에 설정된 attribution spec을 따른다 |

실제 biocom Meta ad set 조회 결과:

| 대상 | attribution spec | 개수 |
| --- | --- | ---: |
| 전체 ad set 64개 | 7일 클릭 + 1일 조회 | 43개 |
| 전체 ad set 64개 | 7일 클릭 + 1일 조회 + 1일 engaged video view | 7개 |
| 전체 ad set 64개 | 7일 클릭만 | 10개 |
| 전체 ad set 64개 | 1일 클릭만 | 4개 |
| 활성 ad set 32개 | 7일 클릭 + 1일 조회 | 21개 |
| 활성 ad set 32개 | 7일 클릭 + 1일 조회 + 1일 engaged video view | 4개 |
| 활성 ad set 32개 | 7일 클릭만 | 6개 |
| 활성 ad set 32개 | 1일 클릭만 | 1개 |

결론:

- 현재 우리 화면의 Meta ROAS 조회 기간은 기본 최근 7일이다.
- 현재 Meta의 실질 귀속 기준은 대부분 7일 클릭 + 1일 조회다.
- 14일 또는 30일 귀속창으로 보고 있는 상태는 아니다.
- 단, 조회 기간 7일과 Meta 귀속창 7일은 다른 개념이다. 현재 값은 “최근 7일 동안의 광고비/구매값을 보되, 구매값은 각 ad set의 귀속 설정, 대부분 7일 클릭 + 1일 조회, 에 따라 Meta가 잡은 값”으로 읽어야 한다.

`7일 클릭 + 1일 조회`의 뜻:

- 7일 클릭: 사용자가 Meta 광고를 클릭한 뒤 7일 안에 구매하면, Meta는 그 구매를 해당 광고 성과로 잡을 수 있다.
- 1일 조회: 사용자가 광고를 클릭하지 않고 보기만 했더라도, 광고 노출 후 1일 안에 구매하면 Meta는 그 구매를 해당 광고 성과로 잡을 수 있다.
- 예를 들어 4월 10일에 광고를 클릭한 사람이 4월 16일에 구매하면 7일 클릭 귀속에 들어갈 수 있다.
- 예를 들어 4월 10일에 광고를 보기만 한 사람이 4월 11일에 구매하면 1일 조회 귀속에 들어갈 수 있다.
- 반대로 광고를 보기만 하고 2일 뒤 구매한 경우는 1일 조회 귀속에는 원칙적으로 들어가지 않는다.

왜 중요하냐:

- 내부 Attribution confirmed ROAS는 우리 원장에서 확인된 결제와 Meta 유입 식별자를 기준으로 더 좁게 본다.
- Meta purchase ROAS는 광고 클릭뿐 아니라 1일 조회 구매까지 포함할 수 있어 더 넓게 잡힌다.
- 특히 사용자가 Meta 광고를 보고 바로 클릭하지 않았지만 나중에 네이버 검색, 직접 방문, 카카오톡 링크 등으로 구매한 경우에도 1일 안이면 Meta가 자기 성과로 가져갈 수 있다.
- 그래서 Meta ROAS가 내부 Attribution ROAS보다 높게 나오는 것은 이상한 일이 아니다. 문제는 현재 차이가 4-5배 수준이라 “단순 귀속창 차이”만으로 충분히 설명되는지 계속 검증해야 한다는 점이다.

운영 해석:

- `7일 클릭 + 1일 조회` Meta ROAS는 “Meta가 자기 광고 영향권 안에 있었다고 보는 매출”이다.
- 내부 Attribution confirmed ROAS는 “우리 원장에서 확인되고, Meta 유입으로 식별 가능한 확정 매출”이다.
- 예산 증액/감액 판단은 Meta ROAS 단독이 아니라 Attribution confirmed, confirmed+pending, Meta purchase를 함께 봐야 한다.

귀속창을 1일 클릭 또는 3일 클릭으로 바꾸면 실제 ROAS와 가까워지는가:

최근 7일 `2026-04-04 - 2026-04-10` 기준으로 Meta API의 `action_attribution_windows`를 직접 바꿔 비교했다.

| Meta 귀속창 | Meta purchase value | Meta purchases | Meta ROAS | Attribution confirmed 1.05x 대비 |
| --- | ---: | ---: | ---: | ---: |
| 기본값, ad set 설정 사용 | 130,139,887원 | 525건 | 4.80x | 4.6배 |
| 7일 클릭만 | 95,362,429원 | 365건 | 3.51x | 3.3배 |
| 1일 조회만 | 34,830,458원 | 161건 | 1.28x | 1.2배 |
| 1일 클릭만 | 84,517,895원 | 295건 | 3.11x | 3.0배 |
| 1일 클릭 + 1일 조회 | 119,348,353원 | 456건 | 4.40x | 4.2배 |
| 7일 클릭 + 1일 조회 | 130,192,887원 | 526건 | 4.80x | 4.6배 |
| 3일 클릭 | API 미지원 | API 미지원 | API 미지원 | 표준 Meta Insights attribution window로 직접 조회 불가 |

해석:

- 1일 클릭으로 좁히면 Meta ROAS는 `4.80x -> 3.11x`로 줄어든다. 약 35% 감소라 과대 효과는 분명히 줄어든다.
- 하지만 1일 클릭만 봐도 Attribution confirmed `1.05x`보다 여전히 약 3배 높다. 따라서 현재 격차는 1일 조회 귀속만의 문제가 아니다.
- 7일 클릭만 봐도 `3.51x`라서 여전히 내부 confirmed보다 높다. 즉 클릭 기반 귀속 자체도 내부 원장 기준보다 넓게 잡힌다.
- 1일 조회만 따로 보면 `1.28x`로 내부 Attribution confirmed와 가장 가깝지만, 이것은 조회 기여만 떼어 본 값이지 전체 Meta ROAS 대체 기준으로 쓰기 어렵다.
- 3일 클릭은 Meta API에서 `action_attribution_windows` 값으로 거절된다. 현재 API가 허용한 값은 `1d_click`, `7d_click`, `28d_click`, `1d_view` 등이고 `3d_click`은 표준 조회 옵션이 아니다.

의견:

- 보고용으로 `1d_click`을 보조 지표에 추가하는 것은 좋다. Meta 기본값보다 보수적이라 과대 해석을 줄인다.
- 하지만 1일 클릭으로 바꾼다고 Meta ROAS가 실제 Attribution ROAS에 충분히 근접하지는 않는다. 현재 데이터에서는 `3.11x` vs `1.05x`로 여전히 차이가 크다.
- 광고 세트의 실제 attribution setting을 바꾸는 것은 신중해야 한다. 보고 수치를 보수적으로 만들기 위해 운영 캠페인의 최적화 기준을 바꾸면 Meta 학습/전달에도 영향을 줄 수 있다.
- 따라서 당장 할 일은 캠페인 설정 변경이 아니라, 대시보드에 `Meta 기본값`, `Meta 1d_click`, `Attribution confirmed`를 나란히 보여주는 것이다.
- 운영 의사결정 headline은 계속 Attribution confirmed ROAS로 두고, Meta 1d_click은 “플랫폼 보수 참고값”으로 쓰는 것이 맞다.

3배 차이가 나는 이유에 대한 현재 판단:

현재 괴리감은 정상적인 의문이다. `1d_click`으로 좁혀도 `Meta 3.11x` vs `Attribution confirmed 1.05x`라서, “Meta가 1일 조회까지 포함해서 높게 보인다”만으로는 설명이 부족하다.

최근 7일 내부 원장 분포:

| 구분 | confirmed orders | confirmed revenue |
| --- | ---: | ---: |
| 내부 원장 전체 biocom confirmed | 383건 | 97,428,243원 |
| 현재 내부 Meta Attribution 규칙에 잡힌 confirmed | 102건 | 28,452,940원 |
| 내부 confirmed 중 utm/fbclid가 비어 있는 주문 | 129건 | 30,550,429원 |
| 내부 confirmed 중 기타 유입으로 잡힌 주문 | 148건 | 36,765,774원 |
| `meta...` 또는 `instagram...` source지만 fbclid가 없어 현재 규칙에서 빠진 주문 | 4건 | 1,659,100원 |

Meta와 비교:

| 구분 | purchase value 또는 revenue | orders 또는 purchases | ROAS |
| --- | ---: | ---: | ---: |
| Meta 기본값 | 130,139,887원 | 525건 | 4.80x |
| Meta 1d_click | 84,517,895원 | 295건 | 3.11x |
| 내부 전체 biocom confirmed | 97,428,243원 | 383건 | spend 대비 3.59x |
| 내부 Meta Attribution confirmed | 28,452,940원 | 102건 | 1.05x |

가능성이 큰 원인:

1. Meta는 내부 Attribution보다 훨씬 넓게 구매를 가져간다.

Meta `1d_click`은 클릭 후 1일 안 구매만 보는데도 84,517,895원이다. 이 값은 내부 전체 confirmed 97,428,243원에 상당히 가깝다. 즉 Meta는 “우리 사이트 전체 구매 중 상당수는 Meta 클릭 영향권”이라고 보고 있다.

2. 우리 Attribution은 현재 너무 보수적이다.

현재 내부 Meta Attribution은 `fbclid` 또는 `utm_source=fb/facebook` 중심이다. 결제완료 페이지에서 UTM/referrer/fbclid가 사라지면 Meta 영향 주문이어도 내부 Attribution에는 잡히지 않는다. 최근 7일 confirmed 중 source가 비어 있는 매출만 30,550,429원이다. 이 중 일부가 Meta 클릭/조회 유입이었다면 내부 Attribution ROAS는 실제보다 낮게 나온다.

3. `checkout_started`가 아직 0이라 결제 전 앵커가 없다.

결제완료 시점의 정보만으로는 광고 클릭 시점과 결제 시점 사이의 식별자 손실을 복구하기 어렵다. `checkout_started`가 있어야 상품/장바구니/결제 시작 시점의 fbclid, fbc/fbp, ga_session_id, client_id를 먼저 잡아두고 결제완료와 연결할 수 있다.

4. Meta용 식별자 저장이 부족하다.

현재 로컬 원장에는 column 기준 `fbclid`는 일부 있지만, `fbc`, `fbp`는 최근 7일 confirmed 샘플에서 0건으로 보인다. Meta는 Pixel/CAPI에서 `fbp/fbc`, advanced matching, 브라우저 이벤트 등을 같이 쓰는데, 우리 내부 Attribution은 그 수준으로 매칭하지 못한다.

5. CAPI/Pixel 중복 가능성은 완전히 닫히지 않았다.

post-fix 이후 같은 주문+이벤트가 서로 다른 event_id로 나가는 고위험 중복은 0건이지만, 같은 event_id가 3회 반복되는 retry-like 로그는 남아 있다. Meta가 dedup을 잘하면 영향은 제한적이지만, Meta purchase count/value가 실제보다 높아지는 후보에서 완전히 제외하면 안 된다.

현재 판단:

- 우리 Attribution ROAS 산정방식이 “공식이 틀렸다”고 보기는 어렵다. confirmed 결제만 세고, Meta로 식별된 주문만 세는 구조라 운영 메인값으로는 보수적이고 방어적이다.
- 다만 “실제 Meta가 만든 매출”을 충분히 잡고 있느냐는 별개다. 현재는 과소계상 가능성이 꽤 크다.
- Meta ROAS도 과대 가능성이 크다. 특히 기본값 4.80x는 1일 조회와 7일 클릭까지 포함해 내부 원장보다 넓다.
- 가장 현실적인 결론은 `Meta는 과대`, `Attribution은 과소`, 실제값은 그 사이에 있을 가능성이 높다는 것이다.
- 범위감으로 보면 현재 1차 추정은 Attribution confirmed 1.05x가 하단, Meta 1d_click 3.11x가 상단에 가깝다. 실제 운영 ROAS는 아직 이 둘 사이 어딘가로 보는 것이 합리적이다.

GPT 딥리서치가 도움이 되는가:

- 도움이 되긴 하지만 우선순위는 낮다. Meta가 ROAS를 어떻게 산정하는지 일반론을 정리하는 데는 도움이 된다.
- 하지만 지금 3배 차이를 푸는 핵심은 일반 리서치가 아니라 우리 데이터의 식별자 손실, checkout_started 부재, fbc/fbp 미저장, CAPI 중복 로그, 아임웹/결제완료 원장 커버리지다.
- 따라서 GPT 딥리서치는 “보조 설명서” 용도이고, 원인 규명은 내부 로그와 API 비교가 우선이다.

`fbclid`, `UTM`, `fbc/fbp`가 무엇인가:

| 항목 | 뜻 | 왜 필요한가 |
| --- | --- | --- |
| `UTM` | 광고 URL에 붙이는 사람이 읽을 수 있는 캠페인 태그다. 예: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`. | 내부 원장에서 “이 주문이 어떤 광고/캠페인에서 왔는지” 분류하는 기본 키다. 캠페인별 Attribution ROAS를 열려면 필수다. |
| `fbclid` | 사용자가 Facebook/Instagram 광고 링크를 클릭했을 때 랜딩 URL에 붙는 Meta click id다. | Meta 광고 클릭에서 온 방문임을 내부에서 식별하는 가장 직접적인 단서다. 현재 내부 Meta Attribution도 `fbclid`가 있으면 Meta 유입으로 인정한다. |
| `_fbc` / `fbc` | Meta click id를 1st-party 형태로 저장한 값이다. 보통 `fb.1.<timestamp>.<fbclid>` 형태다. | 서버 CAPI 전송 시 Meta가 “이 서버 이벤트가 어떤 Meta 클릭과 연결되는지” 맞추는 데 도움을 준다. |
| `_fbp` / `fbp` | Meta Pixel이 브라우저에 남기는 browser id 성격의 1st-party cookie 값이다. 보통 `fb.1.<timestamp>.<random>` 형태다. | 같은 브라우저에서 발생한 Pixel 이벤트와 서버 CAPI 이벤트를 매칭하는 데 도움을 준다. |

주의:

- `fbclid`는 URL query parameter다. 결제완료 페이지까지 항상 남아 있지 않다.
- `_fbc`, `_fbp`는 cookie 또는 저장소에 남아 있어야 결제완료 시점까지 이어갈 수 있다.
- `fbc`는 `fbclid`가 있을 때만 만들거나 보존해야 한다. `fbclid` 없이 임의로 만들면 Meta 클릭 매칭 품질을 오히려 해칠 수 있다.
- `fbp`는 가능하면 Meta Pixel이 만든 `_fbp` cookie를 읽는다. 임의 생성보다는 실제 cookie/Pixel 생성값을 우선한다.

현재 코드 상태:

- backend `normalizeAttributionPayload()`는 이미 `utmSource/utm_source`, `fbclid`, `fbc`, `fbp`를 받을 수 있다.
- `fbclid`는 `attribution_ledger.fbclid` column에 저장된다.
- `fbc`, `fbp`는 현재 dedicated column이 아니라 `metadata_json` 안에 저장된다.
- `metaCapi.ts`는 CAPI 전송 시 `metadata.fbc`, `metadata.fbp`, `fbclid`를 읽어 Meta user_data에 넣는 경로가 있다.
- 즉 backend 수신/저장/전송의 기본 길은 있다. 부족한 부분은 운영 아임웹 페이지에서 이 값을 안정적으로 수집하고, checkout/payment_success payload에 계속 실어 보내는 것이다.

어디에 추가해야 하는가:

1. Meta 광고 URL parameter

Meta Ads Manager의 광고 URL parameter에 UTM을 표준화해서 붙인다.

권장 형태:

```text
utm_source=meta
&utm_medium=paid_social
&utm_campaign={{campaign.id}}
&utm_content={{ad.id}}
&utm_term={{placement}}
&utm_id={{campaign.id}}
```

운영자가 사람이 읽기 쉬운 이름도 필요하면 별도 custom parameter를 추가한다.

```text
campaign_name={{campaign.name}}
adset_id={{adset.id}}
ad_id={{ad.id}}
```

중요한 원칙:

- `utm_campaign`은 가능하면 `campaign.id`처럼 안정적인 ID로 둔다.
- 사람이 만든 `meta_biocom_yeonddle_igg` 같은 alias만 있으면 Meta campaign id/name과 직접 매칭이 어렵다.
- 이름은 바뀔 수 있고, ID는 덜 바뀐다. 캠페인별 ROAS를 열려면 ID 기반 태그가 더 안전하다.

2. 랜딩/상품/장바구니 공통 footer

모든 페이지에서 최초 유입 query와 cookie를 읽어 저장한다.

저장 대상:

```json
{
  "utm_source": "meta",
  "utm_medium": "paid_social",
  "utm_campaign": "campaign_id",
  "utm_content": "ad_id",
  "utm_term": "placement",
  "fbclid": "Meta click id",
  "fbc": "fb.1.timestamp.fbclid",
  "fbp": "_fbp cookie value",
  "landing": "first landing URL",
  "referrer": "document.referrer",
  "capturedAt": "ISO timestamp"
}
```

저장 위치:

- `localStorage`: 여러 페이지 이동 후에도 보존할 last touch 용도
- `sessionStorage`: 한 결제 세션 안에서 checkout/payment_success를 이어붙이는 용도
- cookie는 동의/운영 정책을 확인한 뒤 사용한다. 당장 내부 원장 품질 목적이면 storage 우선으로도 시작 가능하다.

수집 우선순위:

- URL query의 최신값
- 기존 storage 값
- cookie `_fbc`, `_fbp`
- referrer URL query에 남은 값

3. checkout_started payload

결제 시작 또는 주문서 진입 시점에 아래 값을 `POST /api/attribution/checkout-context`로 보낸다.

```json
{
  "touchpoint": "checkout_started",
  "source": "biocom_imweb",
  "checkoutId": "same checkout id",
  "landing": "first landing URL",
  "referrer": "document.referrer",
  "utm_source": "meta",
  "utm_medium": "paid_social",
  "utm_campaign": "campaign id",
  "utm_content": "ad id",
  "utm_term": "placement",
  "fbclid": "fbclid if present",
  "fbc": "_fbc cookie or derived fbc",
  "fbp": "_fbp cookie",
  "ga_session_id": "GA session id",
  "client_id": "GA client id",
  "user_pseudo_id": "GA user pseudo id or client id fallback",
  "metadata": {
    "snippetVersion": "2026-04-xx",
    "fbclidSource": "url|storage|referrer",
    "fbcSource": "cookie|derived_from_fbclid|storage",
    "fbpSource": "cookie|storage",
    "utmSourceOrigin": "url|storage|referrer"
  }
}
```

4. payment_success payload

결제완료 페이지에서도 같은 값을 다시 보낸다. 특히 `checkoutId`를 `checkout_started`와 동일하게 넣어야 한다.

```json
{
  "touchpoint": "payment_success",
  "source": "biocom_imweb",
  "checkoutId": "same checkout id",
  "orderId": "imweb order no",
  "paymentKey": "toss/imweb payment key",
  "amount": 245000,
  "landing": "first landing URL",
  "referrer": "document.referrer",
  "utm_source": "meta",
  "utm_medium": "paid_social",
  "utm_campaign": "campaign id",
  "utm_content": "ad id",
  "utm_term": "placement",
  "fbclid": "fbclid if present",
  "fbc": "_fbc cookie or derived fbc",
  "fbp": "_fbp cookie",
  "ga_session_id": "GA session id",
  "client_id": "GA client id",
  "user_pseudo_id": "GA user pseudo id or client id fallback",
  "metadata": {
    "snippetVersion": "2026-04-xx",
    "checkoutId": "same checkout id",
    "fbclidSource": "url|storage|referrer",
    "fbcSource": "cookie|derived_from_fbclid|storage",
    "fbpSource": "cookie|storage"
  }
}
```

구현 순서:

1. 광고 URL parameter를 ID 기반으로 표준화한다.
2. 아임웹 공통 footer에서 랜딩 query와 `_fbc`, `_fbp`를 읽어 `localStorage/sessionStorage`에 저장한다.
3. `checkout_started` 스니펫을 주문서/결제 시작 단계에 붙인다.
4. 기존 `payment_success` 스니펫이 저장된 attribution context를 재사용하도록 보강한다.
5. backend에는 이미 `fbc/fbp`를 metadata로 받는 경로가 있으므로, 우선 DB 스키마 변경 없이 적재를 확인한다.
6. 운영 24시간 후 `payment_success`, `checkout_started` 각각의 `fbclid/fbc/fbp` 포함률을 본다.
7. 안정화 후 필요하면 `fbc`, `fbp`, `utm_id` dedicated column을 추가한다. 이건 DB 스키마 변경이므로 별도 승인 후 진행한다.

성공 기준:

- 최근 24시간 `checkout_started.total > 0`
- Meta 랜딩 세션 중 `fbclid` 또는 `fbc` 포함률 70% 이상
- Meta 랜딩 세션 중 `fbp` 포함률 70% 이상
- `payment_success` row의 `checkoutId` 포함률 70% 이상
- `checkout_started -> payment_success` 조인율을 계산할 수 있음
- 내부 Meta Attribution confirmed ROAS가 현재 1.05x에서 의미 있게 올라가는지 확인

바로 확인할 SQL:

```sql
SELECT
  COUNT(*) AS rows,
  SUM(CASE WHEN TRIM(fbclid) <> '' THEN 1 ELSE 0 END) AS with_fbclid,
  SUM(CASE WHEN json_extract(metadata_json, '$.fbc') IS NOT NULL
            AND json_extract(metadata_json, '$.fbc') <> '' THEN 1 ELSE 0 END) AS with_fbc,
  SUM(CASE WHEN json_extract(metadata_json, '$.fbp') IS NOT NULL
            AND json_extract(metadata_json, '$.fbp') <> '' THEN 1 ELSE 0 END) AS with_fbp
FROM attribution_ledger
WHERE touchpoint = 'payment_success'
  AND capture_mode = 'live'
  AND source = 'biocom_imweb'
  AND logged_at >= datetime('now', '-1 day');
```

주의할 점:

- 이 값들을 추가한다고 Meta ROAS가 바로 내려가지는 않는다. Meta ROAS는 Meta가 계산한 플랫폼 값이다.
- 대신 내부 Attribution ROAS가 Meta 영향 주문을 더 많이 잡아 과소계상이 줄어들 가능성이 크다.
- CAPI 매칭 품질도 좋아질 수 있다. `fbc/fbp`가 있으면 서버 이벤트와 브라우저/광고 클릭 이벤트를 연결하기 쉬워진다.
- 개인정보/쿠키 동의 정책은 별도로 확인해야 한다. 특히 cookie를 새로 쓰는 방식은 동의 배너/개인정보 처리방침과 맞춰야 한다.

딥리서치를 시킨다면 사용할 프롬프트:

```text
Meta Ads Manager의 purchase ROAS가 내부 주문 원장 기반 ROAS보다 크게 높게 나오는 원인을 조사해줘.

맥락:
- 이커머스/검사권 판매 사이트에서 Meta 광고를 운영 중.
- Meta Ads API 기준 최근 7일 purchase ROAS는 기본 attribution setting에서 4.8x, 1d_click만 보면 3.1x.
- 내부 원장 기준 Meta-attributed confirmed ROAS는 1.05x.
- Meta ad set attribution spec은 대부분 7-day click + 1-day view.
- 내부 원장은 결제완료 페이지에서 utm_source, fbclid, ga_session_id, client_id 등을 수집하지만 checkout_started 이벤트는 아직 없음.
- CAPI는 서버에서 Purchase 전송 중이고, event_id dedup 문제를 점검 중.

조사해줄 것:
1. Meta purchase ROAS가 어떤 이벤트와 attribution window로 산정되는지.
2. 7-day click + 1-day view, 1d_click, 1d_view 각각이 내부 ROAS와 달라지는 이유.
3. Pixel/CAPI dedup, fbp/fbc, advanced matching, view-through attribution이 ROAS 과대에 미치는 영향.
4. 내부 주문 원장 기반 Attribution ROAS가 과소계상될 수 있는 흔한 원인.
5. 실무적으로 Meta ROAS와 내부 confirmed ROAS 차이를 줄이기 위한 체크리스트.

공식 Meta 문서와 신뢰도 높은 광고 측정 자료 위주로 출처를 붙여줘.
```

## 2-2. post-fix 이후 ROAS

post-fix 기준:

- UTC: `2026-04-10 00:00:00 UTC`
- KST: `2026-04-10 09:00:00 KST`
- Meta 광고계정 timezone: `Asia/Seoul`

계산 방식:

- Attribution confirmed revenue는 로컬 `attribution_ledger`에서 `logged_at >= 2026-04-10T00:00:00.000Z`, `source=biocom_imweb`, `payment_success`, `live`, `confirmed`, Meta 유입 조건으로 계산했다.
- Meta spend와 Meta purchase value는 Meta Insights hourly breakdown `hourly_stats_aggregated_by_advertiser_time_zone`으로 계산했다.
- 현재 대시보드의 `/api/ads/roas/daily`는 일 단위라 `post-fix 09:00 KST 이후`를 직접 표현하지 못한다. 아래 값은 별도 시간별 조회로 계산한 값이다.

현재까지 post-fix 누적 부분 구간:

- 구간: `2026-04-10 09:00 KST` 이후, 조회 시점에 Meta hourly로 잡힌 `2026-04-11 10:59 KST` row까지 포함
- 주의: 2026-04-11은 진행 중인 날짜라 spend와 purchase value가 계속 바뀐다. 운영 판단용 확정값이 아니라 현재 스냅샷이다.

| 항목 | 값 |
| --- | ---: |
| Meta spend | 3,346,183원 |
| Attribution confirmed revenue | 2,422,200원 |
| Attribution confirmed orders | 10건 |
| Attribution confirmed ROAS | 0.72x |
| Attribution pending revenue | 0원 |
| Meta purchase value | 11,777,985원 |
| Meta purchase ROAS | 3.52x |

첫 post-fix 당일 구간만 분리:

- 구간: `2026-04-10 09:00 KST` - `2026-04-10 23:59 KST`
- 이 구간은 진행 중인 2026-04-11 데이터를 제외한 첫 post-fix 당일 slice다.

| 항목 | 값 |
| --- | ---: |
| Meta spend | 2,188,336원 |
| Attribution confirmed revenue | 1,453,200원 |
| Attribution confirmed orders | 6건 |
| Attribution confirmed ROAS | 0.66x |
| Meta purchase value | 7,693,785원 |
| Meta purchase ROAS | 3.52x |

해석:

- post-fix 이후에도 Meta purchase ROAS가 Attribution confirmed ROAS보다 높다.
- 현재까지 부분 구간 기준 차이는 `Meta 3.52x` vs `Attribution confirmed 0.72x`다. Meta가 약 4.9배 높다.
- 첫 post-fix 당일 slice 기준 차이는 `Meta 3.52x` vs `Attribution confirmed 0.66x`다. Meta가 약 5.3배 높다.
- 따라서 “최근 7일 전체에서만 Meta가 높게 보인 것인지”를 시간 기준으로 잘라도, 현재까지는 Meta가 더 크게 잡히는 구조가 유지된다.
- 다만 post-fix 표본은 아직 너무 작다. Attribution confirmed 10건, 첫 당일 slice 6건 수준이라 7일 경과 후 다시 계산해야 한다.

## 3. 주문 최신화 결과

실행한 수동 최신화:

```bash
POST /api/crm-local/imweb/sync-orders
body: {"site":"biocom","maxPage":10}
```

결과:

| 항목 | 실행 전 | 실행 후 |
| --- | ---: | ---: |
| 로컬 아임웹 주문 수 | 8,240건 | 8,269건 |
| 주문 금액 합계 | 2,816,166,680원 | 2,820,648,545원 |
| 최신 주문 시각 | 2026-04-10 22:04:44 KST | 2026-04-11 10:05:06 KST |

수동 sync 응답:

- `ok: true`
- `synced: 500`
- biocom API 기준 `totalCount: 8,236`, `totalPage: 165`
- 로컬 DB 기준 최종 `totalOrders: 8,269`

주의:

- `synced: 500`은 API에서 읽어와 upsert 처리한 주문 row 수다.
- 전체 주문 수가 29건만 증가한 이유는 500건 중 대부분이 이미 로컬 DB에 있던 주문이고, 신규/변경분만 결과적으로 누적 카운트를 바꿨기 때문이다.
- 이 작업은 로컬 SQLite 주문 캐시를 최신화한 것이며, 클라우드 운영 DB를 수정한 것이 아니다.

## 4. Attribution 상태 최신화 결과

실행한 상태 동기화:

```bash
POST /api/attribution/sync-status/toss?dryRun=false&limit=500
```

결과:

| 항목 | 값 |
| --- | ---: |
| 후보 row | 264 |
| 매칭 row | 102 |
| 갱신 row | 49 |
| 실제 write row | 49 |
| 미매칭 skip | 162 |
| pending 유지 skip | 53 |
| Toss direct API fallback 매칭 | 55 |
| Toss direct API fallback error | 76 |

로컬 원장 변화:

| 항목 | 실행 전 | 실행 후 | 변화 |
| --- | ---: | ---: | ---: |
| pending payment_success | 264건 | 215건 | -49건 |
| confirmed payment_success | 434건 | 478건 | +44건 |
| canceled payment_success | 8건 | 13건 | +5건 |
| confirmed revenue | 108,606,301원 | 117,014,339원 | +8,408,038원 |
| pending revenue | 566,038,067원 | 556,041,911원 | -9,996,156원 |
| canceled revenue | 2,287,088원 | 3,875,206원 | +1,588,118원 |

해석:

- 49건이 모두 confirmed로 간 것은 아니다. 44건은 confirmed, 5건은 canceled로 정리됐다.
- 최근 주문 중 하나인 `202604111445985`는 `pending`에서 `confirmed`로 바뀌었고, `approvedAt=2026-04-11 10:07:19 KST`가 채워졌다.
- 이 동기화는 로컬 Attribution 원장 보강이다. 클라우드 운영 Postgres를 수정하지 않는다.
- 수동 실행 후 로컬 원장은 명확히 개선됐지만, 최근 7일 biocom ROAS API는 즉시 1.05x에서 더 올라가지는 않았다. 이유는 이번에 갱신된 49건 중 상당수가 현재 Meta-attributed 최근 7일 biocom 계산 범위에 직접 들어가지 않거나, 이미 background sync로 반영됐거나, canceled 처리됐기 때문으로 판단된다.

## 5. 7일 뒤 ROAS 방향성 판단

기준 시점:

- `post-fix` 7일 경과: `2026-04-17 09:00:00 KST`
- 현재 판단은 25시간치 로그만 보고 하는 예측이다. 7일치 운영 로그가 쌓인 뒤 다시 확인해야 확정할 수 있다.

### Attribution ROAS

예상 방향: 소폭 상승 또는 안정. 단, rolling 7일 기준은 내려갈 가능성도 있다.

이유:

- 데이터 품질 관점에서는 상승 압력이 있다. 결제 상태 sync가 동작하고, Toss direct API fallback으로 pending이 confirmed/canceled로 정리되고 있다.
- 기존 1.02x에서 현재 1.05x로 이미 소폭 상승했다.
- 하지만 같은 최근 7일 고정 구간에서는 pending을 전부 더해도 1.07x라 단순 확정 지연만으로 큰 상승은 어렵다.
- rolling 7일은 2026-04-09, 2026-04-10처럼 Attribution ROAS가 낮은 날짜가 계속 들어오면 오히려 내려갈 수 있다.

운영 판단:

- 7일 뒤 Attribution ROAS가 올라간다면 “광고 성과가 갑자기 좋아졌다”기보다 “post-fix 이후 결제 상태와 식별자 보강이 더 안정화됐다”는 의미가 크다.
- 7일 뒤 Attribution ROAS가 내려간다면 우선 실제 일별 매출/광고비 흐름을 봐야 한다. 데이터 문제가 아니라 최근 일별 효율 하락일 수 있다.

### Meta purchase ROAS

예상 방향: 고정 구간은 안정 또는 소폭 상승, rolling post-fix 7일은 안정 또는 소폭 하락 가능성이 더 크다.

이유:

- Meta는 플랫폼 attribution window 때문에 같은 날짜 구간의 purchase value가 뒤늦게 소폭 추가될 수 있다.
- 반대로 우리 쪽 CAPI 중복 위험을 줄이면, 새 post-fix 구간에서는 Meta purchase ROAS가 과거보다 덜 부풀 가능성이 있다.
- 현재 post-fix CAPI 로그에는 같은 주문+이벤트가 서로 다른 event_id로 나가는 고위험 중복은 0건이다.
- 다만 같은 event_id가 3회씩 반복 전송된 retry-like 중복은 아직 남아 있다. Meta dedup이 제대로 되면 과대계상 영향은 제한적이지만, 로그 품질상 제거해야 한다.

운영 판단:

- 7일 뒤 Meta purchase ROAS가 더 올라가도 내부 confirmed 매출 효율이 좋아졌다는 뜻으로 바로 보면 안 된다.
- 7일 뒤 Meta purchase ROAS가 내려가면, 실제 성과 악화일 수도 있지만 CAPI 중복/귀속 과대가 줄어든 정상화일 수도 있다.
- 따라서 운영 메인 지표는 계속 Attribution confirmed ROAS, 보조 지표는 confirmed+pending ROAS, 플랫폼 참고 지표는 Meta purchase ROAS로 보는 것이 맞다.

## 6. post-fix CAPI 로그 상태

조회:

```bash
GET /api/meta/capi/log?limit=500&scope=recent_operational&since=2026-04-10T00:00:00.000Z&include_dedup_candidates=1
```

결과:

| 항목 | 값 |
| --- | ---: |
| 운영 CAPI 로그 | 120건 |
| 성공 | 120건 |
| 실패 | 0건 |
| unique event_id | 44개 |
| duplicate event_id rows | 76건 |
| duplicate event_id groups | 38그룹 |
| unique order+event key | 44개 |
| duplicate order+event groups | 38그룹 |
| retry-like groups | 38그룹 |
| retry-like rows | 114건 |
| multi-event-id groups | 0그룹 |
| multi-event-id rows | 0건 |

해석:

- 이전처럼 `post-fix CAPI 운영 로그 0건이라 판단 불가` 상태는 아니다. 이제 운영 전송 로그가 있다.
- 가장 위험했던 유형은 “같은 주문+이벤트인데 서로 다른 event_id로 Meta에 여러 번 전송되는 경우”다. 이 유형은 현재 0건이다.
- 남아 있는 문제는 “같은 event_id가 3회씩 반복 전송되는 retry-like 중복”이다. 이것은 우리 솔루션에서 Meta로 반복 전송한 로그다. Meta에서 우리에게 보낸 것이 아니다.
- 같은 event_id 반복은 Meta dedup으로 하나만 인정될 가능성이 높지만, 호출 로그와 장애 대응을 어렵게 하므로 다음 단계에서 `orderId + eventName + eventId` 기준 성공 전송 후 재전송 차단이 필요하다.

## 7. 식별자와 checkout_started 상태

조회:

```bash
GET /api/attribution/caller-coverage?source=biocom_imweb
```

biocom live `payment_success` 기준:

| 항목 | 값 |
| --- | ---: |
| payment_success total | 612건 |
| ga_session_id 보유 | 132건, 21.57% |
| client_id 보유 | 128건, 20.92% |
| user_pseudo_id 보유 | 128건, 20.92% |
| all-three 보유 | 128건, 20.92% |

`checkout_started`:

| 항목 | 값 |
| --- | ---: |
| biocom live checkout_started | 0건 |

해석:

- 결제완료 식별자 품질은 누적 기준 20.92%까지 올라왔지만 아직 낮다.
- post-fix 최신 row만 보면 개선됐을 가능성이 크지만, 운영 판단에는 누적/최근 24시간/snippetVersion별 분리를 계속 봐야 한다.
- `checkout_started=0`은 여전히 다음 개선 1순위다. 결제 시작 지점이 없으면 광고 클릭부터 결제 완료까지의 중간 앵커가 약해서 Attribution ROAS 설명력이 제한된다.

## 7-1. 2026-04-11 새 footer + 가상계좌 테스트 주문 검증

테스트 정보:

- 적용 전 footer 백업: `/Users/vibetj/coding/seo/footer/footer_backup_0411.md`
- 새 footer: `/Users/vibetj/coding/seo/footer/footer_new_0411_1.md`
- 테스트 주문 URL: `https://biocom.kr/shop_payment_complete?order_code=o20260411b901c4ba882fd&payment_code=pa20260411330648c49a6d7&order_no=202604115025096&rk=S`
- 주문번호: `202604115025096`
- paymentCode: `pa20260411330648c49a6d7`
- paymentKey: `iw_bi20260411114727ulj68`
- 주문 시각: 2026-04-11 11:47 KST 전후
- 결제 방식: 가상계좌, 아직 미입금

결론:

- 새 footer는 실제 운영 페이지에서 동작했다.
- `checkout_started`가 처음으로 live row에 들어왔다.
- 테스트 주문의 `checkout_started`와 `payment_success`가 같은 `checkout_id`로 연결됐다.
- `ga_session_id`, `client_id`, `user_pseudo_id`, `fbp`가 둘 다 들어왔다.
- 가상계좌 미입금이므로 `payment_success.payment_status=pending`은 정상이다.
- `fbc`는 비어 있다. 이번 테스트가 Meta 광고 클릭 랜딩이 아니라 direct/기존 세션으로 보이기 때문에 정상일 가능성이 크다.

테스트 주문 원장 row:

| touchpoint | logged_at UTC | KST | status | order_id | payment_key | checkout_id |
| --- | --- | --- | --- | --- | --- | --- |
| `checkout_started` | 2026-04-11T02:47:23.553Z | 2026-04-11 11:47:23 KST | 없음 | 없음 | 없음 | `chk_1775875643089_e4osiqzb` |
| `payment_success` | 2026-04-11T02:47:36.988Z | 2026-04-11 11:47:36 KST | pending | `202604115025096` | `iw_bi20260411114727ulj68` | `chk_1775875643089_e4osiqzb` |

식별자 수집 결과:

| 필드 | checkout_started | payment_success | 판정 |
| --- | --- | --- | --- |
| `checkout_id` | 있음 | 있음 | 성공 |
| `ga_session_id` | `1775875624` | `1775875624` | 성공 |
| `client_id` | `773551781.1775057446` | `773551781.1775057446` | 성공 |
| `user_pseudo_id` | `773551781.1775057446` | `773551781.1775057446` | 성공, client_id fallback |
| `fbp` | `fb.1.1775057445326.994609755642926118` | 동일 | 성공 |
| `fbc` | 빈 값 | 빈 값 | Meta 클릭 유입이 아니면 정상 |
| `fbclid` | 빈 값 | 빈 값 | Meta 클릭 유입이 아니면 정상 |
| `utm_source` | 빈 값 | 빈 값 | direct 또는 UTM 없는 진입이면 정상 |

결제 상태:

- `payment_success`는 `pending`으로 들어왔다.
- `POST /api/attribution/sync-status/toss?dryRun=true&limit=20`에서 해당 주문은 `direct_payment_key`로 매칭됐다.
- 결과는 `toss status still pending`이라 skipped 처리됐다.
- 즉 Toss 조회 경로는 동작하고 있고, 미입금 가상계좌라 confirmed로 승격되지 않는 것이 정상이다.

현재 누적 coverage 변화:

| 항목 | 값 |
| --- | ---: |
| biocom live `payment_success` total | 617건 |
| `payment_success` all-three | 133건, 21.56% |
| biocom live `checkout_started` total | 2건 |
| `checkout_started` all-three | 2건, 100% |

새 footer 적용 후 2026-04-11 11:40 KST 이후 biocom row:

| 항목 | 값 |
| --- | ---: |
| 전체 row | 3건 |
| checkout_started | 2건 |
| payment_success | 1건 |
| checkout_id 보유 | 3건 |
| fbp 보유 | 3건 |
| fbc 보유 | 0건 |

좋은 점:

- 가장 큰 blocker였던 `checkout_started=0`은 해소되기 시작했다.
- `checkout_started -> payment_success` 연결 키인 `checkout_id`가 실제로 이어졌다.
- 결제완료 페이지에서만 식별자를 잡는 구조보다 훨씬 좋아졌다.
- `fbp`가 들어오기 시작했으므로 CAPI 매칭 품질 개선 가능성이 있다.

남은 확인:

- Meta 광고 클릭 URL로 들어온 주문 테스트가 필요하다. 그래야 `fbclid`와 `fbc`가 실제로 들어오는지 확인할 수 있다.
- 이번 테스트는 `initial_referrer=@direct`, `original_referrer=@direct`로 보인다. 따라서 `fbc/fbclid`가 비어 있는 것을 실패로 보면 안 된다.
- 가상계좌 입금 후 같은 주문이 `pending -> confirmed`로 승격되는지 확인해야 한다.
- 아임웹 로컬 주문 캐시에는 아직 `202604115025096`이 없다. 아임웹 주문 sync를 다시 돌린 뒤 이 주문이 들어오는지도 확인해야 한다.

다음 테스트 방법:

1. Meta 광고 또는 테스트용 URL에 `fbclid`와 UTM을 붙여 랜딩한다.
2. 같은 브라우저에서 상품 페이지, 주문서, 결제완료까지 진행한다.
3. 원장에서 `checkout_started`와 `payment_success`에 `fbclid`, `fbc`, `fbp`, `utm_source=meta`가 같이 들어왔는지 본다.
4. 가상계좌라면 입금 전에는 pending이 정상이다. 입금 후 status sync에서 confirmed로 바뀌는지 본다.

테스트용 URL 예시:

```text
https://biocom.kr/organicacid_store/?idx=259&utm_source=meta&utm_medium=paid_social&utm_campaign=test_campaign_id&utm_content=test_ad_id&fbclid=TEST_FBCLID_20260411
```

주의:

- 위 `TEST_FBCLID`는 내부 수집 테스트용이다. Meta가 실제 광고 클릭으로 인정하는 값은 아니다.
- 실제 Meta 매칭까지 보려면 진짜 Meta 광고 클릭에서 생성된 `fbclid`로 테스트해야 한다.

## 7-2. fbclid + UTM 테스트 주문 검증

테스트 정보:

- 테스트 랜딩 URL: `https://biocom.kr/organicacid_store/?idx=259&utm_source=meta&utm_medium=paid_social&utm_campaign=test_campaign_id_20260411&utm_content=test_ad_id_20260411&utm_term=test_placement&fbclid=TEST_FBCLID_20260411_1155`
- 주문완료 URL: `https://biocom.kr/shop_payment_complete?order_code=o202604119a4842646f4ab&payment_code=pa2026041183b057c0e28e0&order_no=202604110479067&rk=S`
- 주문번호: `202604110479067`
- paymentCode: `pa2026041183b057c0e28e0`
- paymentKey: `iw_bi20260411115151qOju8`
- 결제 방식: 가상계좌, 미입금

결론:

- `fbclid + UTM` 수집 테스트는 성공했다.
- `checkout_started`와 `payment_success`가 같은 `checkout_id`로 연결됐다.
- `utm_source=meta`, `utm_medium=paid_social`, `utm_campaign=test_campaign_id_20260411`, `utm_content=test_ad_id_20260411`, `utm_term=test_placement`가 양쪽 row에 들어왔다.
- `payment_success`에는 `fbclid=TEST_FBCLID_20260411_1155`가 들어왔다.
- `checkout_started`와 `payment_success` 모두 `fbc=fb.1.1775875901552.TEST_FBCLID_20260411_1155`를 보유했다.
- `fbp`, `ga_session_id`, `client_id`, `user_pseudo_id`도 양쪽 row에 들어왔다.
- 가상계좌 미입금이라 status sync 결과 `toss status still pending`으로 pending 유지된 것은 정상이다.

테스트 주문 원장 row:

| touchpoint | logged_at UTC | KST | status | order_id | payment_key | checkout_id |
| --- | --- | --- | --- | --- | --- | --- |
| `checkout_started` | 2026-04-11T02:51:47.236Z | 2026-04-11 11:51:47 KST | 없음 | 없음 | 없음 | `chk_1775875906804_ew03o954` |
| `payment_success` | 2026-04-11T02:51:59.839Z | 2026-04-11 11:51:59 KST | pending | `202604110479067` | `iw_bi20260411115151qOju8` | `chk_1775875906804_ew03o954` |

식별자 수집 결과:

| 필드 | checkout_started | payment_success | 판정 |
| --- | --- | --- | --- |
| `checkout_id` | `chk_1775875906804_ew03o954` | 동일 | 성공 |
| `utm_source` | `meta` | `meta` | 성공 |
| `utm_medium` | `paid_social` | `paid_social` | 성공 |
| `utm_campaign` | `test_campaign_id_20260411` | `test_campaign_id_20260411` | 성공 |
| `utm_content` | `test_ad_id_20260411` | `test_ad_id_20260411` | 성공 |
| `utm_term` | `test_placement` | `test_placement` | 성공 |
| `fbclid` | column은 비어 있음, referrer/derived fbc에 반영 | `TEST_FBCLID_20260411_1155` | payment_success 성공 |
| `fbc` | `fb.1.1775875901552.TEST_FBCLID_20260411_1155` | 동일 | 성공 |
| `fbp` | `fb.1.1775057445326.994609755642926118` | 동일 | 성공 |
| `ga_session_id` | `1775875624` | `1775875624` | 성공 |
| `client_id` | `773551781.1775057446` | `773551781.1775057446` | 성공 |
| `user_pseudo_id` | `773551781.1775057446` | `773551781.1775057446` | 성공, client_id fallback |

새 footer 적용 후 2026-04-11 11:40 KST 이후 biocom row 누적:

| 항목 | 값 |
| --- | ---: |
| 전체 row | 5건 |
| checkout_started | 3건 |
| payment_success | 2건 |
| checkout_id 보유 | 5건 |
| fbclid column 보유 | 1건 |
| fbc 보유 | 2건 |
| fbp 보유 | 5건 |

해석:

- 내부 수집 관점에서는 `fbclid -> fbc -> checkout_started/payment_success` 연결이 확인됐다.
- `checkout_started` row의 `fbclid` column은 비어 있지만 `fbc`는 정상 생성됐다. 현재 backend는 `fbclid`를 column으로 저장하고 `fbc/fbp`는 metadata에 저장한다. `checkout_started`에서 fbclid column까지 반드시 채울지는 별도 개선사항이다.
- 실제 Meta 매칭 품질까지 확인하려면 진짜 Meta 광고 클릭으로 발급된 `fbclid`로 테스트해야 한다. 이번 `TEST_FBCLID`는 내부 수집 경로 검증용이다.
- 이 상태면 내부 Attribution 과소계상을 줄이기 위한 1차 기술 조건은 충족되기 시작했다.

다음 액션:

1. 진짜 Meta 광고 클릭 URL로 같은 테스트를 1건 더 진행한다.
2. 가상계좌 입금 후 pending row가 confirmed로 승격되는지 확인한다.
3. 새 footer 적용 후 24시간 동안 `checkout_started`, `payment_success`, `fbclid/fbc/fbp`, `checkout_id` 포함률을 다시 본다.
4. `checkout_started`에서도 `fbclid` column이 비지 않도록 payload에 명시 저장할지 검토한다. 현재는 `fbc`가 있으므로 핵심 연결은 가능하다.

## 8. 로컬 DB auto-sync 존재 여부

코드 확인:

- `backend/src/server.ts`에서 `startBackgroundJobs()` 호출.
- `backend/src/bootstrap/startBackgroundJobs.ts`에서 다음 2개 job이 등록됨.

현재 있는 auto-sync:

| 작업 | 주기 | 상태 | 의미 |
| --- | ---: | --- | --- |
| Attribution status sync | 15분 | 있음 | 로컬 Attribution 원장의 pending 결제를 Toss/직접 API 기반으로 confirmed/canceled 보강 |
| CAPI auto-sync | 30분 | 있음 | confirmed 원장 row를 Meta CAPI로 자동 전송 |

아직 없는 auto-sync:

| 작업 | 상태 | 현재 실행 방식 |
| --- | --- | --- |
| 아임웹 주문 로컬 캐시 sync | 없음 | `POST /api/crm-local/imweb/sync-orders` 수동 호출 |

결론:

- “로컬 DB auto-sync가 아예 없다”는 표현은 부정확하다. Attribution 상태 sync와 CAPI sync는 있다.
- “아임웹 주문 최신화 auto-sync가 없다”가 정확한 표현이다.
- 아임웹 주문 최신화를 자동화하려면 `crmLocal.ts` 라우터 안에 묶인 sync 로직을 service 함수로 분리한 뒤, `startBackgroundJobs.ts`에서 15분 또는 30분 주기로 호출하는 구조가 맞다.
- 단, 무작정 전체 페이지를 매번 긁으면 API 부하가 크므로 최근 3~10페이지 증분 sync부터 시작하는 것이 안전하다.

## 9. 다음 액션

1. `2026-04-17 09:00 KST` 이후 같은 쿼리로 post-fix 7일 ROAS를 다시 고정 스냅샷으로 저장한다.
2. 아임웹 주문 로컬 캐시 auto-sync를 별도 service로 분리하고, 최근 페이지 증분 sync job을 추가한다.
3. CAPI retry-like 중복 38그룹을 줄이기 위해 `orderId + eventName + eventId` 기준 성공 전송 후 재전송 skip guard를 추가한다.
4. `checkout_started` 스니펫을 운영 적용해서 live row가 실제로 들어오는지 확인한다.
5. ROAS 대시보드에는 계속 3줄을 같이 노출한다: Attribution confirmed, Attribution confirmed+pending, Meta purchase.
