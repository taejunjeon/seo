# TikTok 픽셀 연동 상태 진단 및 다음 할 일 (2026-04-16 최신화)

> **사이트**: biocom.kr (아임웹 기반)
> **최초 진단자**: Claude Code
> **최초 진단일**: 2026-03-29
> **최신화**: 2026-04-16, Codex

---

## 0. 다음 할 일

### 0.1. Phase/SP 실행 순서 요약

담당자별로 따로 보던 일을 실제 실행 순서로 재배치했다. `SP` 링크를 누르면 아래 `4. Phase/SP 상세 실행 계획`의 상세 설명으로 이동한다.

| Phase | Sprint | 담당 | 핵심 작업 | 다음 단계로 넘어가는 기준 |
|---|---|---|---|---|
| Phase 1. 수신 확인 | [[#SP1 - Pixel Helper 설치 및 브라우저 이벤트 확인\|SP1]] | TJ님 | Chrome 확장프로그램 TikTok Pixel Helper 설치 후 실제 사이트 흐름 확인 | 이벤트별 발화 여부, pixel ID, event_id, URL 캡처 확보 |
| Phase 1. 수신 확인 | [[#SP2 - TikTok Events Manager 이벤트 수신 확인\|SP2]] | TJ님 | TikTok Ads Manager의 Events Manager에서 최근 수신 로그 확인 | 웹/서버 이벤트, 최근 수신 시간, 진단 이슈 확인 |
| Phase 1. 수신 확인 | [[#SP3 - 캠페인 화면과 아임웹 Feed 상태 확인\|SP3]] | TJ님 | 캠페인 화면에서 비용 export, 아임웹 Feed 외부 노출 설정 확인 | CSV 또는 화면 캡처, Feed 연결 상태 확보 |
| Phase 2. 내부 대조 | [[#SP4 - 이벤트 수신표 문서화 및 내부 원장 대조\|SP4]] | 에이전트 | SP1~SP3 증거를 이벤트 매트릭스와 내부 attribution 원장에 반영 | TikTok 유입 주문 샘플과 `(not set)` 가능성 정리 |
| Phase 2. 내부 대조 | [[#SP5 - Ads Manager CSV/API와 내부 ROAS 비교\|SP5]] | TJ님 + 에이전트 | 같은 기간의 광고비/전환값/내부 매출 비교 | 캠페인별 spend, attributed revenue, ROAS 차이표 작성 |
| Phase 2. 내부 대조 | [[#SP6 - 누락 여부 판정 및 보강안 결정\|SP6]] | 에이전트 | 구매 이벤트 누락인지, 이미 웹/서버 수신 중인지 판정 | 중복 전환 위험 없이 보강/보류 결정 |
| Phase 3. 구현/운영 | [[#SP7 - TikTok Pixel 클라이언트 보강\|SP7]] | 에이전트 | 누락 확정 시 아임웹 삽입용 `TIKTOK_PIXEL.track` 보강안 작성 | AddToCart/InitiateCheckout/Purchase event_id 규칙 확정 |
| Phase 3. 구현/운영 | [[#SP8 - TikTok Events API 서버사이드 범위 산정\|SP8]] | TJ님 + 에이전트 | Events API 토큰/권한/test event code 확보 후 구현 범위 산정 | Pixel/Event Source, access token, dedup 규칙 확보 |
| Phase 3. 구현/운영 | [[#SP9 - 검증 리포트와 운영 루틴 정착\|SP9]] | 에이전트 | Pixel Helper, Events Manager, 내부 원장, ROAS 리포트 반복 점검 | 주간 점검 표와 의사결정 기준 고정 |

**판단 기준**: 지금 바로 TikTok CAPI를 구현하지 않는다. 먼저 Ads Manager와 Pixel Helper에서 `CompletePayment` 또는 `Purchase`가 실제로 수신되는지 확인한다. 이미 아임웹이 웹/서버 이벤트를 보내고 있으면 새 삽입은 중복 전환 위험이 있다.

### 0.2. 첨부 TikTok Ads Manager 화면 판단

첨부 화면은 TikTok 광고관리자의 `캠페인` 목록 화면이다. 이 화면에서 TJ님이 바로 할 수 있는 일은 `SP3` 또는 `SP5`용 캠페인 지표 확인/export다.

| 확인 항목 | 이 화면에서 가능한가 | 판단 |
|---|---:|---|
| 캠페인별 비용, CPC, CPM, 노출, 클릭 확인 | 가능 | `SP5` 비교용 CSV/export 대상 |
| Pixel 이벤트가 실제로 발화했는지 확인 | 불가 | `SP1`의 Chrome 확장프로그램 Pixel Helper가 필요 |
| TikTok 서버가 이벤트를 수신했는지 확인 | 불가 | `SP2`의 Events Manager에서 확인 |
| 웹/서버 이벤트 소스, 매칭 품질, 진단 이슈 확인 | 불가 | Events Manager의 pixel/data source 상세 화면에서 확인 |
| Feed URL 외부 노출 상태 확인 | 불가 | 아임웹 관리자와 TikTok Catalog/Event Source 쪽에서 확인 |

정리하면, 이 화면에서 “픽셀 확인”을 하는 것이 아니라 `TikTok Pixel Helper`를 Chrome 확장프로그램으로 설치해 사이트에서 직접 확인하고, Ads Manager에서는 `도구 > 이벤트/Events Manager`로 이동해 TikTok 서버 수신 여부를 확인해야 한다. 캠페인 목록 화면은 이후 ROAS 비교용 광고비 데이터를 뽑는 곳으로 보면 된다.

---

## 0.3. 프로젝트 구조 파악 결과

현재 `/Users/vibetj/coding/seo`는 코드 저장소이면서 Obsidian vault다. 요청 URL `obsidian://open?vault=seo&file=tiktok%2Ftiktok0329_claude1`는 이 파일 `tiktok/tiktok0329_claude1.md`에 매핑된다.

| 영역 | 경로 | 현재 역할 |
|---|---|---|
| 프론트엔드 | `frontend/` | Next.js 16 + React 19. 로컬 포트 `7010`, 대시보드/광고/획득 분석 UI |
| 백엔드 | `backend/` | Express + TypeScript. 로컬 포트 `7020`, GA4/GSC/Meta/Attribution/CRM API |
| Attribution | `backend/src/attribution.ts`, `backend/src/routes/attribution.ts` | checkout/payment/form 원장 수집, `gclid/fbclid/ttclid` 저장 |
| 획득 분석 | `backend/src/acquisitionAnalysis.ts`, `frontend/src/app/acquisition-analysis/` | 원장 기반 채널 분류. TikTok은 `ttclid`, TikTok referrer/UTM으로 분류 |
| 광고 ROAS | `backend/src/routes/ads.ts`, `frontend/src/app/ads/` | Meta Ads 중심 ROAS/캠페인 LTV ROAS/alias review |
| Meta CAPI | `backend/src/metaCapi.ts`, `backend/src/routes/meta.ts` | Meta Purchase 및 funnel event 서버 전송. TikTok CAPI가 아님 |
| 추적 정합성 문서 UI | `frontend/src/app/tracking-integrity/` | CAPI/Pixel/Attribution 진행 상황 설명 페이지 |
| 문서/운영 메모 | `docs/`, `roadmap/`, `meta/`, `tiktok/`, 루트 `*.md` | Obsidian 문서와 작업 백업 |

작업트리는 이미 다수의 수정/미추적 파일이 있었고, 이번 최신화에서는 요청 문서와 백업 파일만 새로 다룬다.

---

## 0.4. 2026-04-16 기준 상태 업데이트

### 완료 또는 상당 부분 완료

| 항목 | 상태 | 근거 |
|---|---|---|
| 로컬 Attribution 원장 | 완료 | `checkout_started`, `payment_success`, `form_submit` 수집 API 존재 |
| `ttclid` 보존 | 완료 | Attribution payload와 ledger schema에 `ttclid` 필드 존재 |
| TikTok 채널 분류 | 완료 | `ttclid` 또는 TikTok referrer/UTM이면 `TikTok`으로 분류 |
| 획득 분석 화면 | 완료 | `/acquisition-analysis`에서 사이트별 채널/캠페인/랜딩/최근 샘플 확인 가능 |
| GA/광고 식별자 보존 | 부분 완료 | `gclid`, `fbclid`, `ttclid`, GA client/session/user pseudo id 수집 구조 존재 |
| Meta CAPI Purchase/ROAS 개선 | 진행 완료에 가까움 | Meta 전용 CAPI, dedup, campaign ROAS, LTV ROAS 구현됨 |
| Meta funnel event 서버 인프라 | Day 1 완료 | `ViewContent`, `AddToCart`, `InitiateCheckout`, `Lead`, `Search`를 Meta CAPI로 보내는 `/api/meta/capi/track` 존재 |

### 아직 완료로 보면 안 되는 것

| 항목 | 현재 판단 | 이유 |
|---|---|---|
| TikTok Ads Manager 실제 이벤트 로그 확인 | 테스트 이벤트 기준 부분 완료 | Events Manager 테스트 이벤트에서 `ViewContent`, `InitiateCheckout`, `Purchase` 브라우저 수신 확인 |
| Pixel Helper 실시간 검증 | 부분 완료 | 2026-04-16 21:02~23:02 KST 기준 상품/결제/결제완료 흐름 수동 확인됨 |
| TikTok `Purchase` 수신 | Pixel Helper + Events Manager 테스트 기준 확인 | 같은 브라우저 흐름에서 `Purchase_o20260416f90b328b2394b` 수신 |
| TikTok `InitiateCheckout` 수신 | Events Manager 테스트 기준 확인 | `InitiateCheckout_o20260416f90b328b2394b`가 브라우저 이벤트로 수신됨 |
| TikTok `AddToCart` 수신 | 미확정 | 장바구니 단계 Pixel Helper/Events Manager 결과는 아직 없음 |
| TikTok Events API/CAPI | 미구현, 즉시 구현 보류 | 웹 `Purchase`가 이미 발화되어 중복/가상계좌 과대계상 위험부터 확인 필요 |
| TikTok Ads 비용/ROAS API 연동 | 미구현 | `ads` 라우트는 Meta account 중심이다 |
| Feed URL 외부 노출 오류 | 미확정 | 아임웹 관리자 확인이 필요하다 |

---

## 0.5. 현재 결론

1. 3월 29일의 핵심 진단인 `PageView`와 `ViewContent` 설치 확인은 유지한다.
2. 이후 코드베이스에서는 TikTok 클릭 식별자(`ttclid`) 보존과 내부 원장 기반 TikTok 채널 분류가 추가되어, 이제 “TikTok 유입이 우리 내부 전환 원장에서 얼마나 잡히는지”는 볼 수 있는 구조가 생겼다.
3. 2026-04-16 23:02 KST Events Manager 테스트 이벤트 기준으로 `Purchase`와 `InitiateCheckout` 모두 브라우저 수신이 확인됐다. 따라서 “구매 이벤트 완전 누락” 또는 “체크아웃 이벤트 완전 누락”으로 단정하면 안 된다.
4. 다만 테스트 이벤트 화면은 실제 데이터에 포함되지 않는 검증 로그다. 운영 리포트/캠페인 최적화에 반영되는 실제 이벤트는 Overview/이벤트 통계와 캠페인 전환으로 별도 확인해야 한다.
5. 같은 브라우저/같은 Chrome 프로필에서 테스트해야 Events Manager 테스트 이벤트에 이어서 잡힌다. 다른 Chrome 계정/브라우저에서 주문하면 테스트 이벤트 화면에 바로 이어지지 않을 수 있다.
6. 남은 확인 대상은 `ViewContent` 2회 표시의 중복 여부, `AddToCart` 수신 여부, 가상계좌 미입금 주문의 `Purchase` 과대계상 여부, Feed URL이다.
7. 가상계좌 미입금 `Purchase` 오염은 개선 가능하다. Meta Purchase Guard처럼 TikTok 웹 `Purchase`를 서버 payment-decision으로 보류/차단하는 Browser Guard가 P0 후보이다.
8. Events API는 지금 즉시 켜지 않는다. 웹 `Purchase`가 이미 있으므로, 서버 이벤트를 추가하기 전 중복 제거와 가상계좌 미입금 주문 과대계상 문제를 먼저 확인한다.
9. Meta CAPI/Funnel 개선이 많이 진행되었지만, 이는 TikTok이 아니라 Meta용이다. 이 성과를 TikTok 완료로 오해하면 안 된다.

## 0.6. 참고 링크

- [TikTok For Business - Web Data Connection 설정/검증](https://ads.tiktok.com/help/article/get-started-pixel): Events Manager 이동, Pixel Helper, Test Events, Diagnostics 검증 경로 참고.
- [TikTok For Business - Pixel Helper 문제 해결](https://ads.tiktok.com/help/article/tiktok-pixel-helper-2.0?lang=en): pixel/event/parameter 단위 진단 기준 참고.
- [Chrome Web Store - TikTok Pixel Helper](https://chromewebstore.google.com/detail/tiktok-pixel-helper/aelgobmabdmlfmiblddjfnjodalhidnn?hl=en): Chrome 확장프로그램 설치 위치.

## 0.7. SP1 Pixel Helper 수동 확인 결과

확인 시각: 2026-04-16 21:02 KST 전후
확인 도구: Chrome 확장프로그램 `TikTok Pixel Helper`
Pixel: `biocom_tiktok_web_pixel` / ID `D5G8FTBC77UAODHQ0KOG`

| 단계 | URL/화면 | Pixel Helper 표시 이벤트 | 판단 |
|---|---|---|---|
| 상품페이지 진입 | biocom.kr 상품페이지 | `Pageview`, `ViewContent`, `ViewContent`, `Metadata Automatically Detected` | `ViewContent`는 확인됨. 단, 2회 표시되어 중복 발화인지 SP2에서 Events Manager 로그로 확인 필요 |
| 결제하기 페이지 진입 | 결제 페이지 | `Pageview`, `Metadata Automatically Detected` | `InitiateCheckout`은 보이지 않음. 결제 시작 이벤트 누락 가능성 있음 |
| 가상계좌 주문 생성 후 결제완료 | `https://biocom.kr/shop_payment_complete?order_code=o202604164178a5fbfa2b4&payment_code=pa202604165704189bba07f&order_no=202604161811321&rk=S` | `Pageview`, `Purchase`, `Metadata Automatically Detected` | Pixel Helper 기준 구매 이벤트 수신 확인 |

`Purchase` 상세:

| 항목 | 값 |
|---|---|
| Timestamp | `2026-04-16 21:02:23` |
| Setup Method | `Imweb` |
| Load Time | `251 ms` |
| content_type | `product` |
| currency | `KRW` |
| value | `36900` |
| event_id | `Purchase_o202604164178a5fbfa2b4` |
| 경고 | Manual/Auto Advanced Matching 활성화 권장 |

현재 해석:

1. `Purchase`가 Pixel Helper에서 확인됐으므로 TikTok 구매 이벤트가 완전히 빠진 상태는 아니다.
2. `InitiateCheckout`은 결제하기 페이지에서 보이지 않았으므로 보강 후보로 남긴다.
3. `ViewContent`가 상품페이지에서 2회 표시됐으므로 중복 발화인지, 하나는 자동 감지/하나는 Imweb 래퍼 이벤트인지 확인해야 한다.
4. Pixel Helper는 브라우저 발화 확인이고, TikTok Ads Manager Events Manager 반영에는 5~10분 지연될 수 있다. SP2에서 실제 수신 로그와 웹/서버 소스 구분을 확인한다.

## 0.8. SP2 Events Manager 테스트 이벤트 확인 결과

확인 시각: 2026-04-16 22:52~23:02 KST
확인 위치: TikTok Ads Manager > `biocom_tiktok_web_pixel` > 테스트 이벤트
Pixel ID: `D5G8FTBC77UAODHQ0KOG`
주의: 테스트 이벤트 활동은 실제 데이터에 포함되지 않는다. 이 화면은 “브라우저에서 TikTok 서버까지 이벤트가 도달하는지”를 확인하는 용도다.

| 순서 | 이벤트 | 수신 시간 | 연결 방법 | event_id | URL/비고 |
|---:|---|---|---|---|---|
| 1 | `ViewContent` | 2026-04-16 22:52:07 | 브라우저 | 미기록 | 같은 시각 2건 표시 |
| 2 | `ViewContent` | 2026-04-16 22:52:07 | 브라우저 | 미기록 | 중복인지 자동/수동 병행인지 확인 필요 |
| 3 | `InitiateCheckout` | 2026-04-16 22:52:13 | 브라우저 | `InitiateCheckout_o20260416f90b328b2394b` | URL `https://biocom.kr/shop_view/?idx=279`, 설정 방법 `사용자 지정 코드` |
| 4 | `Purchase` | 2026-04-16 23:02:20 | 브라우저 | `Purchase_o20260416f90b328b2394b` | URL `https://biocom.kr/shop_payment_complete?order_code=o20260416f90b328b2394b&order_no=202604165951042&payment_code=pa2026041679b7fc0b652f2&rk=S` |

`InitiateCheckout` 상세:

| 항목 | 값 |
|---|---|
| content_id | `279` |
| content_name | `혈당상승 억제엔 방탄젤리 난소화성말토덱스트린` |
| content_type | `product` |
| currency | `KRW` |
| value | `21900` |
| external_id | `8a0312b4b2eb64f2ffc5aaf21afb4ad8de90df1dc5939b955c8a443dc910c069` |
| ip | `180.65.83.254` |
| user_agent | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36` |

`Purchase` 상세:

| 항목 | 값 |
|---|---|
| content_id | `279` |
| content_name | `혈당상승 억제엔 방탄젤리 난소화성말토덱스트린 / 22% OFF : 1개 할인가` |
| quantity | `1` |
| price | `21900` |
| content_type | `product` |
| currency | `KRW` |
| value | `21900` |
| external_id | `8a0312b4b2eb64f2ffc5aaf21afb4ad8de90df1dc5939b955c8a443dc910c069` |
| ip | `180.65.83.254` |
| user_agent | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36` |

추가 Pixel Helper 확인:

| 시각 | 결제 방식/상황 | event_id | value | contents |
|---|---|---|---:|---|
| 2026-04-16 22:54:45 | 가상계좌 주문 생성 | `Purchase_o202604160aa4096942a9f` | 59800 | content_id `317`, `혈당관리엔 당당케어 (120정) / 40% OFF : 1개` |
| 2026-04-16 22:57:35 | 카드 주문 생성 | `Purchase_o2026041655d73aed6e574` | 35000 | content_id `198`, `뉴로마스터 60정 (1개월분) / 56% OFF : 1개 할인가` |

이번 확인에서 배운 점:

1. `Purchase`가 처음에 테스트 이벤트 화면에 안 보인 것은 결제 이벤트 자체가 없는 문제가 아니라, 다른 Chrome 계정/브라우저에서 주문했기 때문으로 판단한다.
2. 같은 브라우저/같은 Chrome 프로필에서 테스트하자 `Purchase`가 Events Manager 테스트 이벤트에 수신됐다.
3. `InitiateCheckout`도 Events Manager 테스트 이벤트에 수신됐다. 다만 Pixel Helper 결제 페이지 확인에서는 보이지 않았고, Events Manager URL은 상품 상세 `shop_view/?idx=279`로 찍혔다. 실제 발화 위치를 더 확인해야 한다.
4. `ViewContent`는 Events Manager 테스트 이벤트에서도 같은 시각 2건으로 표시됐다. 중복 집계 여부를 진단 탭과 이벤트 통계에서 확인해야 한다.
5. 가상계좌 주문 생성 시점에도 Pixel Helper에서 `Purchase`가 발화되므로, 미입금 주문이 TikTok 구매로 잡힐 수 있는지 별도 검증이 필요하다.

## 0.9. Events API 필요성 검토

첨부된 `이벤트 API` 화면은 TikTok Events API 서버사이드 이벤트를 만들고, 이벤트별 파라미터를 매핑하는 화면이다. 현재 결론은 **즉시 구현 보류, SP8에서 조건부 검토**다.

지금 바로 필요하지 않은 이유:

1. Pixel Helper 기준으로 웹 `Purchase`가 이미 발화된다.
2. 같은 `Purchase`를 Events API로 추가 전송하면 `event_id` 매칭이 틀릴 때 중복 전환이 생길 수 있다.
3. `event_id`를 맞춰도, 가상계좌 주문 생성 시점의 웹 `Purchase`가 먼저 들어가면 서버에서 나중에 보내는 결제확정 이벤트가 dedup 처리되어 보정 효과가 작을 수 있다.
4. 현재 가장 큰 미확정 사항은 Events API 부재가 아니라 테스트 이벤트가 아닌 실제 데이터 반영 여부, `ViewContent` 중복 여부, 가상계좌 미입금 주문의 `Purchase` 과대계상 여부다.

그래도 Events API가 필요해지는 조건:

| 조건 | 판단 |
|---|---|
| Events Manager에서 `Purchase_o202604164178a5fbfa2b4`가 안 보임 | Events API 검토 필요 |
| TikTok 인앱 브라우저/차단 환경에서 웹 이벤트 손실이 큼 | Events API 검토 필요 |
| Advanced Matching 품질이 낮고 email/phone/ttp/ttclid 전달률이 낮음 | Events API 검토 필요 |
| 가상계좌 미입금 주문까지 `Purchase`로 잡혀 ROAS가 과대평가됨 | 서버 결제확정 기준 이벤트 설계 필요 |
| 웹 `Purchase`가 안정적으로 수신되고 중복/매칭 문제가 없음 | Events API 즉시 구현 불필요 |

가상계좌 기준으로 특히 주의할 점:

- 이번 테스트는 `shop_payment_complete`에서 `Purchase`가 발화됐다.
- URL의 `order_code=o202604164178a5fbfa2b4` 기준 event_id는 `Purchase_o202604164178a5fbfa2b4`다.
- 이 시점은 “가상계좌 주문 생성”이지 실제 입금 확정이 아닐 수 있다.
- 내부 attribution 원장에서는 Toss 상태 동기화 후 `confirmed/pending/canceled`를 나눌 수 있지만, TikTok 웹 픽셀은 결제완료 페이지 진입 순간 `Purchase`를 잡는다.
- 따라서 Events API를 한다면 단순히 웹 이벤트를 하나 더 보내는 방식이 아니라, `주문 생성 = PlaceAnOrder`, `입금/결제 확정 = Purchase`처럼 의미를 분리할 수 있는지 먼저 확인해야 한다.

Events API를 진행하기 전 필수 확인:

1. TikTok Events Manager에서 현재 웹 `Purchase` 수신 여부 확인.
2. 아임웹/TikTok 플러그인에서 웹 `Purchase` 발화 시점 또는 이벤트명을 조정할 수 있는지 확인.
3. 서버 이벤트의 `event_id`가 웹 픽셀에서 보이는 최종 event_id와 같은지 확인. 현재 기준 후보는 `Purchase_o202604164178a5fbfa2b4`.
4. access token은 문서/채팅/Obsidian에 적지 않고 `.env.local` 또는 운영 secret에만 저장.
5. 테스트 이벤트 코드로 sandbox 전송 후 Events Manager에서 중복 여부 확인.

## 0.10. 가상계좌 미입금 `Purchase` 개선 검토

2026-04-16 테스트에서 가상계좌 미입금 주문도 `shop_payment_complete` 진입 시 TikTok 웹 픽셀 `Purchase`로 발화되는 것이 확인됐다. 이 상태를 그대로 두면 실제 입금 전 주문이 TikTok 구매/ROAS에 포함될 수 있다.

참고한 기존 개선 사례:

| 참고 | 핵심 |
|---|---|
| `capivm/capi.md` | Meta는 가상계좌 미입금 Browser `Purchase`를 차단하고 `VirtualAccountIssued`로 낮추는 Purchase Guard v3를 운영 |
| `footer/biocomcodemanual.md` | 헤더 상단에서 Meta `FB_PIXEL.Purchase`와 `fbq('track','Purchase')`를 감싸고 `/api/attribution/payment-decision`으로 confirmed/pending/canceled를 조회 |
| `backend/src/routes/attribution.ts` | `payment-decision`은 `confirmed -> allow_purchase`, `pending -> block_purchase_virtual_account`, `canceled -> block_purchase`, `unknown -> hold_or_block_purchase`를 반환 |
| `backend/src/metaCapi.ts` | 서버 CAPI 후보는 `payment_success + live + paymentStatus=confirmed`만 선택하고, Toss 가상계좌가 `DONE`이 아니면 전송하지 않음 |

이번 TikTok 테스트 주문을 기존 `payment-decision` endpoint로 조회한 결과:

| 주문 | 결제/상황 | endpoint 판정 | browserAction | matchedBy | 해석 |
|---|---|---|---|---|---|
| `o202604160aa4096942a9f` / `202604167857158` | 가상계좌 미입금, value `59800` | `pending` | `block_purchase_virtual_account` | `toss_direct_order_id` | TikTok `Purchase` 차단 대상 |
| `o2026041655d73aed6e574` / `202604166949380` | 카드 주문, value `35000` | `confirmed` | `allow_purchase` | `toss_direct_order_id` | TikTok `Purchase` 통과 대상 |
| `o20260416f90b328b2394b` / `202604165951042` | 가상계좌 미입금, value `21900` | `pending` | `block_purchase_virtual_account` | `toss_direct_order_id` | TikTok `Purchase` 차단 대상 |

즉 서버 판정 기반은 이미 작동한다. TikTok 쪽 개선의 병목은 결제 상태 판정 API가 아니라, TikTok 웹 픽셀 `Purchase`를 얼마나 안전하게 보류/차단/대체 이벤트로 전환하느냐다.

TikTok에도 같은 원칙은 적용 가능하다. 다만 Meta 코드 그대로는 쓸 수 없고, TikTok용 Guard를 별도로 만들어야 한다.

### 왜 개선이 필요하나

TikTok 공식 표준 이벤트 문서 기준으로 `Purchase`는 “방문자가 구매했을 때” 쓰는 이벤트이고, 특히 주문과 구매가 같은 시점일 때 사용하는 것을 권장한다. 가상계좌는 주문 생성과 실제 입금/구매 확정이 분리되므로, 미입금 상태의 `Purchase`는 ROAS 과대계상 위험이 있다.

### 권장 방향

**TikTok Browser Purchase Guard**를 Meta Purchase Guard와 같은 구조로 만든다.

동작 원칙:

1. `/shop_payment_complete` 또는 `/shop_order_done`에서만 실행한다.
2. `TIKTOK_PIXEL.track('Purchase', params)`와 가능하면 `ttq.track('Purchase', params)`를 감싼다.
3. `order_code`, `order_no`, `payment_code`, `payment_key`를 URL/referrer/event_id에서 추출한다.
4. `https://att.ainativeos.net/api/attribution/payment-decision`을 조회한다.
5. `confirmed / allow_purchase`이면 원래 `Purchase`를 그대로 통과시킨다.
6. `pending / block_purchase_virtual_account`이면 `Purchase`를 차단한다.
7. pending 이벤트는 `Purchase` 대신 `PlaceAnOrder` 또는 `VirtualAccountIssued`로 낮춘다. TikTok UI의 `주문하기` 이벤트가 `PlaceAnOrder`로 안정 수신되는지 먼저 테스트한다.
8. `canceled` 또는 `unknown`은 `Purchase`를 보내지 않고 진단용 custom event 또는 sessionStorage 로그로 남긴다.

event_id 규칙:

| 이벤트 | 후보 event_id |
|---|---|
| 확정 구매 | `Purchase_o20260416...` |
| 가상계좌 주문 생성 | `PlaceAnOrder_o20260416...` 또는 `VirtualAccountIssued_o20260416...` |
| 차단/불명 진단 | `PurchaseBlocked_o20260416...`, `PurchaseDecisionUnknown_o20260416...` |

아임웹 TikTok 래퍼 주의:

- `/js/tiktok_pixel.js`의 `TIKTOK_PIXEL.track(event_name, parameters)`는 `parameters.event_id`가 있으면 `event_name + '_' + event_id`로 바꾼 뒤 `ttq.track`을 호출한다.
- 따라서 Guard가 `TIKTOK_PIXEL.track` 앞에서 잡으면 raw `event_id=o...`를 볼 수 있고, `ttq.track` 뒤에서 잡으면 최종 `event_id=Purchase_o...`를 보게 된다.
- 안정성을 위해 `TIKTOK_PIXEL.track`과 `ttq.track` 둘 다 감싸되, 중복 처리 방지를 위한 `handledAttemptKeys`가 필요하다.

### 권장 롤아웃 순서

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| T0 문서/설계 | TikTok Guard 설계 확정 | 이 섹션 기준으로 event_id, pending 이벤트명, unknown 정책 결정 |
| T1 dry-run | Guard가 `Purchase`를 막지 않고 decision만 조회/로그 | 가상계좌는 `pending`, 카드는 `confirmed`로 판정되는지 확인 |
| T2 test enforce | 테스트 주문에서만 pending `Purchase` 차단 | 가상계좌 미입금은 `Purchase` 없음, 카드 결제는 `Purchase` 유지 |
| T3 live enforce | 운영 헤더 상단 배포 | 24시간 동안 카드 구매 누락 0, 가상계좌 미입금 Purchase 감소 확인 |
| T4 서버 보강 | 필요 시 TikTok Events API로 입금 확정 `Purchase`만 전송 | 웹/서버 event_id 중복 제거 또는 웹 Purchase 차단 후 서버 Purchase 단일화 확인 |

### 의사결정 포인트

| 선택지 | 장점 | 단점 | 현재 판단 |
|---|---|---|---|
| 그대로 둔다 | 개발 리스크 없음 | 미입금 가상계좌가 TikTok 구매/ROAS를 오염시킬 수 있음 | 권장하지 않음 |
| 웹 Purchase Guard만 추가 | Meta에서 검증된 패턴 재사용, 즉시 과대계상 완화 | 헤더 상단 삽입 필요, 카드 구매 오탐 차단 리스크 | **P0 후보** |
| TikTok Events API만 추가 | 입금 확정 기준 서버 Purchase 가능 | 웹 Purchase가 이미 있으므로 중복/디둡 문제가 더 커질 수 있음 | 단독 적용 금지 |
| 웹 Guard + 추후 서버 Purchase | 가장 정확함. 미입금은 주문 이벤트, 입금 확정은 Purchase로 분리 가능 | 구현/검증 공수 큼 | P1 후보 |

### 현재 권고

1. 바로 TikTok Events API를 붙이지 않는다.
2. 먼저 TikTok Browser Purchase Guard를 `dry-run`으로 만든다.
3. 같은 주문번호로 `/api/attribution/payment-decision`이 가상계좌 미입금 `pending`, 카드 결제 `confirmed`를 정확히 반환하는지 확인한다.
4. dry-run이 맞으면 헤더 상단에서 pending 가상계좌의 `Purchase`만 차단한다.
5. 실제 입금 완료된 가상계좌를 TikTok `Purchase`로 다시 보낼 필요가 있으면 그때 Events API를 붙인다.

### 구현 전 승인 필요

이 작업은 광고 전환 측정과 운영 ROAS에 직접 영향을 준다. 따라서 실제 아임웹 헤더 반영 전 TJ님 승인이 필요하다. 로컬 문서/초안 작성은 가능하지만, 운영 배포는 `가상계좌 1건 + 카드 1건 + 같은 브라우저 Events Manager 테스트` 절차를 먼저 통과해야 한다.

---

## 1. 계정 정보 요약

| 항목 | 값 | 상태 |
|------|-----|------|
| 픽셀 코드 | `D5G8FTBC77UAODHQ0KOG` | 설치 확인됨 |
| 비즈니스 센터 ID | `7593201346678013969` | - |
| 광고 ID | `7593201373714595856` | - |
| 카탈로그 ID | `7596869359360952065` | - |
| Feed ID | `29863177` | - |
| Feed URL | **연결 실패** | "외부 노출 설정이 누락되어 연결에 실패" |
| 플랫폼 | 아임웹(imweb) | TikTok 비즈니스 플러그인 연결 |
| 파트너 | `Imweb` (tiktok_pixel.js 내 `_partner: 'Imweb'`) | - |

---

## 2. 픽셀 설치 확인 결과

### 2.1. 기본 픽셀 코드 — 정상

biocom.kr 모든 페이지에서 아래 코드가 확인됨:

```html
<!-- TikTok Pixel Code Start -->
ttq.load('D5G8FTBC77UAODHQ0KOG');
ttq.page();
<!-- TikTok Pixel Code End -->
```

추가로 아임웹 자체 TikTok 픽셀 래퍼도 로드됨:
```html
<script src='/js/tiktok_pixel.js?1757999653'></script>
TIKTOK_PIXEL.init('D5G8FTBC77UAODHQ0KOG');
```

**참고**: `analytics.tiktok.com/i18n/pixel/events.js` 직접 호출 시 **504 Gateway Timeout** 반환됨 (Akamai CDN 경유). 이는 서버사이드에서 직접 호출하면 차단되는 것이며, 브라우저에서는 정상 로드될 수 있다. 실제 픽셀 동작 여부는 TikTok Pixel Helper(Chrome 확장)로 확인해야 한다.

**결론**: 기본 PageView 추적 코드는 **정상 설치됨**. 모든 페이지에서 `ttq.page()` 호출 확인. 단, 실제 이벤트 수신 여부는 TikTok Ads Manager에서 확인 필요.

---

### 2.2. 이벤트 추적 — 부분적 구현

| 이벤트 | 페이지 | 상태 | 상세 |
|--------|--------|------|------|
| `PageView` (ttq.page) | 전 페이지 | 정상 | 상품페이지, 결제하기 페이지, 결제완료 페이지에서 Pixel Helper 수신 확인 |
| `ViewContent` | 상품 상세 (/xxx_store) | 수신, 중복 확인 필요 | Pixel Helper와 Events Manager 테스트 이벤트에서 모두 2회 표시 |
| `AddToCart` | 장바구니 (/shop_cart) | **미확인** | 장바구니 단계 Pixel Helper 결과는 아직 없음 |
| `InitiateCheckout` | 상품/체크아웃 진입 | **수신(Events Manager 테스트 기준)** | `InitiateCheckout_o20260416f90b328b2394b` 수신. URL은 `shop_view/?idx=279`로 표시되어 실제 발화 위치 추가 확인 필요 |
| `CompletePayment` / `Purchase` | 결제 완료 | **수신(Pixel Helper + Events Manager 테스트 기준)** | `Purchase_o20260416f90b328b2394b` 수신. 가상계좌/카드 주문 생성 시점에도 Pixel Helper에서 `Purchase` 발화 |
| `AddPaymentInfo` | 결제 정보 입력 | **미확인** | track 호출 없음 |

**ViewContent 이벤트 실제 예시** (organicacid_store 페이지):
```javascript
TIKTOK_PIXEL.track('ViewContent', {
    contents: [{
        content_id: '259',
        content_name: '종합 대사기능 분석',
        brand: '바이오 종합 대사기능 검사',
        price: 298000,
        quantity: 1,
    }],
    description: '대사균형이 무너지는 순간...',
    content_type: 'product',
    currency: 'KRW',
    value: 298000,
    event_id: '15f4bc45414c2ce2c92676d156040ffd'
});
```

---

### 2.3. tiktok_pixel.js 래퍼 분석

아임웹이 제공하는 `/js/tiktok_pixel.js` 파일은 TikTok 픽셀을 감싸는 래퍼로, 아래 메서드를 노출한다:

| 메서드 | 설명 |
|--------|------|
| `TIKTOK_PIXEL.init(id)` | 픽셀 ID로 초기화 + ttq.load + ttq.page |
| `TIKTOK_PIXEL.track(event_name, parameters)` | 이벤트 추적 (event_id에 이벤트명 접두사 추가) |
| `TIKTOK_PIXEL.identify(user_data)` | 사용자 식별 |

**특이사항**: `track()` 함수에서 `event_id`가 있으면 `event_name + '_' + event_id` 형태로 변환한다. 이는 TikTok의 이벤트 중복 제거(deduplication)를 위한 것이지만, Events API(서버사이드)와의 매칭이 제대로 되려면 양쪽에서 같은 event_id 규칙을 사용해야 한다.

---

## 3. 문제 진단

### 3.1. Feed URL 연결 실패 (심각도: HIGH)

스크린샷에서 **"외부 노출 설정이 누락되어 연결에 실패했습니다"** 에러가 확인되었다.

**원인 가능성**:
1. 아임웹의 상품 피드 외부 노출 설정이 꺼져 있음
2. 카탈로그 페이지에서 Feed API 연결 상태가 비활성
3. 서비스형 상품(검사 키트)은 Feed URL 연동 대상이 아닐 수 있음 (스크린샷 하단 안내: "일부 상품군(디지털 콘텐츠, 특정 서비스형 상품 등)은 Feed URL 연동 대상이 아닐 수 있습니다")

**영향**:
- TikTok 카탈로그 광고(Dynamic Product Ads) 사용 불가
- 상품 태깅 기반 리타겟팅 제한
- 전환 최적화 광고에서 상품 데이터 매칭 불가

**해결 방법**:
1. 아임웹 관리자 > 쇼핑 설정 > 외부 노출 설정 확인
2. 카탈로그 페이지에서 Feed ID/API 연결 상태 재확인
3. 검사 서비스가 Feed URL 연동 대상 상품인지 아임웹 고객센터에 문의

---

### 3.2. 전자상거래 이벤트 누락 가능성 (심각도: HIGH)

**확인된 것**: `ViewContent`, `InitiateCheckout`, `Purchase`가 TikTok Events Manager 테스트 이벤트 또는 Pixel Helper에서 발화

**미확인/주의**: `AddToCart`, `AddPaymentInfo`, `ViewContent` 2회 표시의 중복 여부, 테스트 이벤트가 아닌 실제 데이터 반영 여부

2026-04-16 수동 확인에서 결제완료 페이지의 `Purchase`와 체크아웃 시작 이벤트가 잡혔다. 따라서 현재 문제를 “구매 이벤트 누락”으로 단정하지 않고, 아래처럼 좁혀 본다.

- 상품페이지: `ViewContent`가 2회 표시됨. Events Manager 테스트 이벤트에서도 같은 시각 2건이 잡혀 중복 여부 확인 필요.
- 체크아웃 시작: Events Manager 테스트 이벤트에 `InitiateCheckout_o20260416f90b328b2394b` 수신. URL은 `shop_view/?idx=279`로 표시되어 실제 발화 위치 확인 필요.
- 결제완료 페이지: Events Manager 테스트 이벤트에 `Purchase_o20260416f90b328b2394b` 수신. 가상계좌/카드 주문 생성 시점에도 Pixel Helper에서 `Purchase` 표시.

`AddToCart` 또는 구매 이벤트의 운영 데이터 반영이 불완전하면:
- TikTok 광고의 **구매 전환 최적화**가 불가
- **ROAS 측정이 불정확**
- **퍼널 분석 불가** (어디서 이탈하는지 TikTok 대시보드에서 볼 수 없음)

**확인 방법**:
1. TikTok Ads Manager Overview/이벤트 통계에서 테스트 이벤트가 아닌 실제 `Purchase` 추세 확인
2. `ViewContent` 2회 표시가 진단 탭에서 중복 이벤트로 잡히는지 확인
3. 장바구니 단계에서 `AddToCart`가 Pixel Helper/Events Manager에 잡히는지 확인
4. 가상계좌 미입금 주문이 실제 캠페인 구매/ROAS에 포함되는지 확인
5. 아임웹이 서버사이드(Events API)로 이벤트를 보내고 있을 수 있으므로, TikTok Ads Manager에서 "이벤트 소스" 필터를 "웹+서버" 모두로 확인

---

### 3.3. GA4 데이터와의 불일치 (심각도: MEDIUM)

GA4 소스별 전환 분석 결과:
- **tiktok 채널**: 383,449세션, 318구매, 전환율 0.08%, 매출 ₩1.2억
- **매출/세션**: ₩323 (전체 평균 ₩1,013의 1/3)

TikTok Ads Manager에서 보이는 전환 수치와 GA4의 318구매가 일치하는지 비교 필요.
불일치 원인:
- Pixel Helper에서 `Purchase`가 보여도 TikTok Events Manager에 반영되지 않거나 중복/매칭 문제가 있으면 TikTok 측 전환 카운트가 달라질 수 있음
- GA4는 UTM 파라미터(sessionSource)로 tiktok을 식별하므로 경로가 다름
- 크로스 디바이스 전환(TikTok 앱에서 보고 → 모바일 웹에서 구매)이 어트리뷰션 차이를 만들 수 있음

---

### 3.4. `(not set)` 매출 ₩1.3억의 tiktok 귀속 가능성 (심각도: MEDIUM)

GA4에서 `(not set)/(not set)` 소스의 매출이 ₩130,522,953 (전환율 19.36%)이다.
이 중 일부가 tiktok 유입일 가능성:
- TikTok 인앱 브라우저 → PG 리다이렉트 → 세션 끊김 → (not set)으로 기록
- 이 경우 tiktok의 실제 전환 성과가 과소평가되고 있을 수 있음

---

## 4. Phase/SP 상세 실행 계획

### Phase 1. 수신 확인

목표는 “TikTok 쪽에서 이미 이벤트를 받고 있는지”를 개발 전에 확인하는 것이다. 이 Phase가 끝나기 전에는 TikTok CAPI나 추가 픽셀 삽입을 진행하지 않는다.

#### SP1 - Pixel Helper 설치 및 브라우저 이벤트 확인

| 항목 | 내용 |
|---|---|
| 담당 | TJ님 |
| 도구 | Chrome 확장프로그램 `TikTok Pixel Helper` |
| 확인 위치 | biocom.kr 실제 사용자 흐름 |
| 완료 산출물 | 이벤트별 캡처 또는 표: 이벤트명, 수신 여부, pixel ID, event_id, URL, 시각 |

실행 순서:

1. Chrome에 `TikTok Pixel Helper` 확장프로그램을 설치한다.
2. Chrome에서 biocom.kr 상품 상세 페이지를 연다.
3. Pixel Helper에서 `PageView`와 `ViewContent`가 뜨는지 확인한다.
4. 장바구니 담기 화면에서 `AddToCart`가 뜨는지 확인한다.
5. 결제 시작 화면에서 `InitiateCheckout` 또는 유사 결제 시작 이벤트가 뜨는지 확인한다.
6. 결제 완료 이벤트는 실제 주문/결제 데이터가 생길 수 있으므로, 테스트 주문 또는 취소 가능한 안전한 방식이 있을 때만 확인한다. 안전한 테스트가 어렵다면 결제 완료는 SP2 Events Manager 로그로 우선 확인한다.

기록할 표:

| 이벤트 | Pixel Helper 결과 | pixel ID | event_id | 확인 URL/화면 | 비고 |
|---|---|---|---|---|---|
| PageView | 수신 | `D5G8FTBC77UAODHQ0KOG` |  | 상품페이지, 결제하기, 결제완료 | 정상 |
| ViewContent | 수신 | `D5G8FTBC77UAODHQ0KOG` |  | 상품페이지 | 2회 표시. 중복 여부 확인 필요 |
| AddToCart | 미확인 | `D5G8FTBC77UAODHQ0KOG` |  |  | 장바구니 단계 결과 필요 |
| InitiateCheckout | Pixel Helper에서는 미표시, Events Manager 테스트에서는 수신 | `D5G8FTBC77UAODHQ0KOG` | `InitiateCheckout_o20260416f90b328b2394b` | Events Manager URL `shop_view/?idx=279` | 실제 발화 위치 확인 필요 |
| CompletePayment/Purchase | 수신 | `D5G8FTBC77UAODHQ0KOG` | `Purchase_o20260416f90b328b2394b` | 결제완료 페이지 | value `21900`, currency `KRW`, Events Manager 테스트 수신 |

#### SP2 - TikTok Events Manager 이벤트 수신 확인

| 항목 | 내용 |
|---|---|
| 담당 | TJ님 |
| 도구 | TikTok Ads Manager `Events Manager` |
| 확인 위치 | Ads Manager의 이벤트/자산/도구 메뉴에서 pixel 또는 event source 상세 |
| 완료 산출물 | 최근 7일 이벤트 로그, 웹/서버 소스 여부, 진단 이슈, 매칭 품질 캡처 |

실행 순서:

1. TikTok Ads Manager에서 캠페인 화면이 아니라 `도구 > 이벤트` 또는 `Events Manager`로 이동한다.
2. Pixel/Event Source `D5G8FTBC77UAODHQ0KOG`를 연다.
3. 최근 7일 또는 테스트 이벤트 화면에서 아래 이벤트를 확인한다.
4. 이벤트 소스가 `웹`, `서버`, `웹+서버` 중 무엇인지 기록한다.
5. `CompletePayment`, `Purchase`, `PlaceAnOrder`처럼 구매에 해당하는 이벤트가 실제로 들어오는지 확인한다.
6. Diagnostics/진단 탭에 중복 이벤트, match quality, event_id 관련 경고가 있는지 캡처한다.

기록할 표:

| 이벤트 | Events Manager 수신 | 소스 | 최근 수신 시각 | 매칭/진단 이슈 | 비고 |
|---|---|---|---|---|---|
| PageView | 미기록 |  |  |  | 테스트 이벤트 목록에는 주요 표준 이벤트 중심으로 확인 |
| ViewContent | 수신 | 브라우저 | 2026-04-16 22:52:07 | 중복 여부 확인 필요 | 같은 시각 2건 |
| AddToCart | 미확인 |  |  |  |  |
| InitiateCheckout | 수신 | 브라우저 | 2026-04-16 22:52:13 | 없음/추가 확인 필요 | event_id `InitiateCheckout_o20260416f90b328b2394b` |
| CompletePayment/Purchase | 수신 | 브라우저 | 2026-04-16 23:02:20 | 없음/추가 확인 필요 | event_id `Purchase_o20260416f90b328b2394b` |

#### SP3 - 캠페인 화면과 아임웹 Feed 상태 확인

| 항목 | 내용 |
|---|---|
| 담당 | TJ님 |
| 도구 | TikTok Ads Manager 캠페인 화면, 아임웹 관리자 |
| 확인 위치 | 첨부 이미지의 캠페인 목록, 아임웹 쇼핑/상품 Feed/외부 노출 설정 |
| 완료 산출물 | 캠페인 CSV/export, Feed 연결 상태 캡처, 외부 노출 설정 상태 |

첨부된 TikTok 광고관리자 화면은 이벤트 로그 화면이 아니라 캠페인 목록이다. 여기서 할 일은 아래 두 가지다.

1. SP5 비교용으로 같은 날짜 범위의 캠페인별 `비용`, `노출수`, `클릭`, `전환`, `전환값`을 export한다.
2. 현재 화면에서는 픽셀 이벤트 발화 여부를 확인하지 않는다. Pixel 발화는 SP1, TikTok 서버 수신은 SP2에서 확인한다.

아임웹 쪽 확인 순서:

1. 아임웹 관리자에서 쇼핑 설정 또는 상품 Feed 설정을 연다.
2. 외부 노출/API/Feed URL 설정이 켜져 있는지 확인한다.
3. TikTok 카탈로그 Feed ID `29863177`와 연결 상태를 대조한다.
4. 서비스형 상품이 Feed URL 연동 대상에서 제외되는지 확인한다.

### Phase 2. 내부 대조

목표는 TJ님이 확보한 외부 증거와 내부 attribution 원장을 같은 기간, 같은 이벤트 기준으로 맞춰 보는 것이다.

#### SP4 - 이벤트 수신표 문서화 및 내부 원장 대조

| 항목 | 내용 |
|---|---|
| 담당 | 에이전트 |
| 선행 조건 | SP1~SP3 캡처 또는 CSV 확보 |
| 확인 위치 | `/api/attribution/acquisition-summary`, attribution ledger, 이 문서 |
| 완료 산출물 | Pixel Helper/Events Manager/내부 원장 통합 이벤트 매트릭스 |

작업 순서:

1. SP1 Pixel Helper 결과와 SP2 Events Manager 결과를 이 문서의 이벤트 표에 반영한다.
2. 같은 기간의 내부 attribution 원장에서 `ttclid`, TikTok referrer, TikTok UTM 주문 샘플을 추출한다.
3. GA4 `(not set)` 가능성이 있는 주문과 TikTok 클릭 식별자 보존 여부를 대조한다.
4. `웹 수신`, `서버 수신`, `미수신`, `내부 원장만 존재`를 분리한다.

#### SP5 - Ads Manager CSV/API와 내부 ROAS 비교

| 항목 | 내용 |
|---|---|
| 담당 | TJ님 + 에이전트 |
| 선행 조건 | SP3 캠페인 CSV 또는 TikTok Ads API 접근 |
| 확인 위치 | TikTok Ads Manager export, GA4, 내부 attribution 원장 |
| 완료 산출물 | 캠페인별 spend, attributed revenue, ROAS, 주문 샘플 비교표 |

작업 순서:

1. TJ님이 TikTok Ads Manager에서 기간을 고정해 캠페인별 CSV를 export한다.
2. 에이전트가 같은 기간 내부 원장과 GA4 기준 TikTok 매출을 조회한다.
3. 캠페인명/UTM/campaign ID 기준으로 매칭 가능한 항목과 불가능한 항목을 분리한다.
4. TikTok Ads Manager ROAS, GA4 ROAS, 내부 attribution ROAS의 차이를 표로 정리한다.

#### SP6 - 누락 여부 판정 및 보강안 결정

| 항목 | 내용 |
|---|---|
| 담당 | 에이전트 |
| 선행 조건 | SP1~SP5 결과 |
| 확인 위치 | 이 문서의 이벤트 매트릭스와 ROAS 비교표 |
| 완료 산출물 | `보강`, `보류`, `Events API 필요` 중 하나의 결정 |

판정 기준:

| 조건 | 결정 |
|---|---|
| `Purchase/CompletePayment`가 웹 또는 서버로 이미 안정 수신 | 추가 삽입 보류. 중복 전환 방지 우선 |
| 장바구니/결제 시작만 누락 | 해당 이벤트만 클라이언트 보강 검토 |
| 구매 이벤트가 완전히 미수신 | SP7 보강안 작성 |
| 웹 이벤트는 있는데 매칭 품질/앱 브라우저 손실이 큼 | SP8 Events API 범위 산정 |
| Feed 연결 실패가 광고 운영 병목 | Feed 설정 해결을 별도 선행 작업으로 분리 |

### Phase 3. 구현/운영

목표는 누락이 확정된 항목만 좁게 보강하고, 이후 중복과 ROAS 차이를 지속적으로 감시하는 것이다.

#### SP7 - TikTok Pixel 클라이언트 보강

| 항목 | 내용 |
|---|---|
| 담당 | 에이전트 |
| 선행 조건 | SP6에서 클라이언트 보강 필요 확정. 가상계좌 미입금 `Purchase` 과대계상은 P0 후보 |
| 확인 위치 | 아임웹 삽입 코드, `TIKTOK_PIXEL.track()` event_id 규칙 |
| 완료 산출물 | AddToCart/InitiateCheckout 보강안, TikTok Browser Purchase Guard 초안, 롤백 기준 |

작업 순서:

1. 아임웹의 기존 `tiktok_pixel.js` 래퍼가 event_id를 `event_name + '_' + event_id`로 바꾸는 규칙을 문서화한다.
2. `TIKTOK_PIXEL.track('Purchase', params)`와 `ttq.track('Purchase', params)`를 감싸는 Guard를 설계한다.
3. `/api/attribution/payment-decision` 결과가 `confirmed`일 때만 `Purchase`를 통과시키고, `pending` 가상계좌는 `Purchase`를 차단한다.
4. pending 가상계좌 대체 이벤트명을 `PlaceAnOrder` 또는 `VirtualAccountIssued` 중 하나로 테스트해 결정한다.
5. 동일 주문/동일 장바구니에서 event_id가 반복 발화되지 않도록 규칙을 정한다.
6. Pixel Helper와 Events Manager에서 카드 결제 `Purchase` 유지, 가상계좌 미입금 `Purchase` 차단, 중복 이벤트 없음까지 확인한다.

#### SP8 - TikTok Events API 서버사이드 범위 산정

| 항목 | 내용 |
|---|---|
| 담당 | TJ님 + 에이전트 |
| 선행 조건 | SP6에서 서버사이드 보강 필요 확정 |
| 필요 정보 | TikTok access token, Pixel/Event Source 권한, test event code, event_id dedup 규칙 |
| 완료 산출물 | Events API 구현 범위, 보안 항목, 테스트 절차 |

현재 상태:

- 2026-04-16 Pixel Helper 기준 웹 `Purchase`가 이미 발화됨.
- 따라서 Events API는 즉시 구현하지 않고, SP2/Events Manager에서 실제 수신과 중복 상태를 본 뒤 결정한다.
- 특히 가상계좌 주문 생성 시점의 웹 `Purchase`와 실제 입금/결제 확정 시점의 서버 `Purchase`가 의미상 다를 수 있으므로, 먼저 SP7 Browser Guard로 웹 `Purchase` 의미를 정리해야 한다.

진행 조건:

1. TikTok Events API access token을 확보한다.
2. test event code 또는 테스트 이벤트 검증 경로를 확보한다.
3. 브라우저 픽셀과 서버 이벤트가 같은 event_id로 dedup되는지 규칙을 확정한다.
4. 기존 Meta CAPI와 혼동하지 않도록 TikTok 전용 모듈/로그/환경변수를 분리한다.

#### SP9 - 검증 리포트와 운영 루틴 정착

| 항목 | 내용 |
|---|---|
| 담당 | 에이전트 |
| 선행 조건 | SP4~SP8 중 적용 범위 완료 |
| 확인 위치 | 이 문서, `/acquisition-analysis`, Ads/ROAS 화면 |
| 완료 산출물 | 주간 점검 표와 의사결정 기준 |

운영 루틴:

1. 매주 같은 날짜 범위로 TikTok Ads Manager, GA4, 내부 attribution 원장을 비교한다.
2. `CompletePayment/Purchase` 수신 끊김, event_id 중복, Feed 연결 실패를 별도 체크한다.
3. 캠페인별 ROAS가 다르게 보이면 attribution 기준 차이인지 실제 추적 누락인지 분리한다.
4. 문서 상단의 Phase/SP 요약을 최신 상태로 갱신한다.

---

## 5. tiktok 채널 성과 현황 (GA4 기준, 2026-03-29 스냅샷)

아래 수치는 2026-03-29 문서 작성 당시의 GA4 스냅샷이다. 2026-04-16 현재 최신 GA4 수치로 재조회한 값은 아니므로, 캠페인 의사결정에는 새 기간으로 다시 뽑아야 한다.

참고용으로, 당시 GA4에서 측정한 tiktok 채널 성과:

| 지표 | 값 | 비고 |
|------|-----|------|
| 총 세션 | 383,449 | 전체의 61% |
| 총 구매 | 318 | |
| 전환율 | 0.08% | 전체 평균(0.38%)의 1/5 |
| 매출 | ₩123,961,981 | 전체의 19% |
| 매출/세션 | ₩323 | 전체 평균(₩1,013)의 1/3 |

### 캠페인별 상세

| 캠페인(sessionSource) | 세션 | 구매 | 전환율 | 매출 | RPS |
|----------------------|-----:|-----:|-------:|-----:|----:|
| tiktok_biocom_yeonddle_acid | 161,721 | 46 | 0.03% | ₩19,972,036 | **₩123** |
| tiktok_biocom_iggcam_igg | 76,238 | 228 | 0.30% | ₩78,522,680 | ₩1,030 |
| tiktok_biocom_mineralcam_mineral | 76,122 | 0 | 0% | ₩0 | ₩0 |
| tiktok_biocom_bangtanjelly | 19,479 | 8 | 0.04% | ₩8,581,864 | ₩441 |
| tiktok_biocom_yeonddle_iggacidset | 16,065 | 18 | 0.11% | ₩14,112,000 | ₩878 |
| tiktok_biocom_biobalance | 13,039 | 0 | 0% | ₩0 | ₩0 |
| tiktok_biocom_acidcam_acid | 10,528 | 0 | 0% | ₩0 | ₩0 |

**핵심**:
- `iggcam_igg` 캠페인만 유일하게 의미 있는 전환(228구매, RPS ₩1,030)을 만들고 있음
- `yeonddle_acid`는 16만 세션을 쏟아붓지만 RPS ₩123으로 극히 비효율
- `mineralcam`, `biobalance`, `acidcam`은 세션만 있고 구매 0

---

## 6. 에이전트가 확인할 수 있는 것과 없는 것 (2026-04-16)

### 확인 가능
- [x] 저장소 구조와 실행 포트: 프론트 `7010`, 백엔드 `7020`
- [x] TikTok 문서 위치: `tiktok/tiktok0329_claude1.md`
- [x] Attribution 원장 필드: `gclid`, `fbclid`, `ttclid`, UTM, GA 식별자
- [x] Attribution 수집 API: `/api/attribution/checkout-context`, `/api/attribution/payment-success`, `/api/attribution/form-submit`
- [x] TikTok 내부 채널 분류 로직: `ttclid` 또는 TikTok referrer/UTM 기준
- [x] 내부 획득 분석 화면: `/acquisition-analysis`
- [x] Meta CAPI/Funnel 인프라: 구현되어 있음. 단, TikTok CAPI가 아님
- [x] 3월 29일 기준 기존 확인 내용: 픽셀 설치, `ttq.page()`, `ViewContent`, 아임웹 `tiktok_pixel.js` 래퍼
- [x] 2026-04-16 Pixel Helper 기준 `Purchase` 발화: value `36900`, event_id `Purchase_o202604164178a5fbfa2b4`
- [x] 2026-04-16 Events Manager 테스트 이벤트 기준 `InitiateCheckout`, `Purchase` 브라우저 수신

### 수동 확인 필요
- [x] TikTok Ads Manager 테스트 이벤트 내 전환 이벤트 수신 로그
- [ ] TikTok Ads Manager Overview/이벤트 통계의 실제 데이터 반영 확인
- [x] TikTok Pixel Helper를 통한 상품/결제/결제완료 흐름 1차 확인
- [ ] `AddToCart`의 웹/서버 수신 여부
- [x] 같은 브라우저 기준 `Purchase_o20260416f90b328b2394b`가 TikTok Events Manager 테스트 이벤트에 수신됐는지 확인
- [ ] 상품페이지 `ViewContent` 2회 표시가 중복 이벤트인지 확인
- [ ] 가상계좌 미입금 주문이 실제 구매/ROAS에 포함되는지 확인
- [ ] TikTok Browser Purchase Guard dry-run 초안 작성 및 카드/가상계좌 decision 검증
- [ ] TikTok Events API 서버사이드 연동 여부
- [ ] TikTok Ads Manager의 ROAS, CPA, 광고비 데이터
- [ ] 아임웹 관리자의 외부 노출 설정 상태
- [ ] Feed URL 실제 접근 가능 여부

### 주의
- Meta CAPI에서 `ViewContent`, `AddToCart`, `InitiateCheckout` 서버 전송 인프라가 생겼지만, 이는 TikTok Ads 최적화에는 직접 반영되지 않는다.
- TikTok 구매 이벤트가 이미 아임웹/TikTok 플러그인에서 서버사이드로 수신되고 있다면, 새 코드를 추가하면 중복 전환이 생길 수 있다.
- 따라서 다음 개발은 “미수신 확인 → event_id 규칙 확정 → 보강” 순서로만 진행한다.
