# ROAS 정합성 Phase 정리

작성 시각: 2026-04-12 13:40 KST 기준

## 바로 다음에 뭐할지

아래 항목은 Phase별 완료조건과 직접 연결된다. Phase 이름은 문서 하단의 `Phase N Detail` 헤딩으로 이동한다. Obsidian에서 HTML anchor나 GitHub식 slug 링크가 안 먹는 경우가 있어, Obsidian heading link 형식으로 연결한다.

### 지금 바로 우리가 개발 가능한 것

| 우선순위 | 연결 Phase                                                         | 현재 표시        | 바로 할 일                                                                                                                                  | 완료 기준                                                        |
| ---: | ---------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
|    1 | [[#Phase 4 Detail\|Phase 4. CAPI / Pixel dedup 검증]]              | 자사몰 카드/가상계좌 1차 통과, VM active origin 완료 | post-server-decision-guard 이후 24시간 운영 로그에서 `pending -> Purchase` 누락, `VirtualAccountIssued`, `payment-decision unknown`, CAPI failure를 확인한다. | 실제 운영분에서도 pending 주문이 Browser/Server `Purchase`로 오염되지 않는다. |
|    2 | [[#Phase 3 Detail\|Phase 3. 식별자 품질 / checkout_started]]          | 1차 완료 후 관찰 중 | 새 푸터 이후 최근 24시간/48시간 기준 `checkout_started`, `payment_success`, `fbclid/fbc/fbp`, GA 3종, `checkout_id` coverage 리포트를 만든다.                | 실제 운영 데이터에서 식별자 품질이 개선되는지 숫자로 본다.                            |
|    3 | [[#Phase 6 Detail\|Phase 6. 같은 기준 ROAS 비교 뷰]]                    | 대부분 완료       | 정기 보고 snapshot과 `/ads/roas`에도 `Meta 1d_click` headline 기준을 명시한다.                                                                        | 모든 ROAS 화면/문서에서 “Meta ROAS = 1d_click”이 기본값으로 일관된다.          |
|    4 | [[#Phase 5 Detail\|Phase 5. Campaign-level ROAS / alias review]] | 부분 완료        | `campaign-url-evidence`에서 `landingUrl=null` 고지출 광고와 여러 campaign에 걸친 alias만 추려 “예외 검토 리스트”를 만든다.                                         | 수동 확인 대상이 전체 광고가 아니라 상위 예외 목록으로 줄어든다.                        |
|    5 | [[#Phase 2 Detail\|Phase 2. Site-level ROAS 일일 보고]]              | 대부분 완료       | 보고서 수치 383건과 local ledger 381건 차이를 주문 단위로 reconcile한다.                                                                                  | site-wide confirmed orders/revenue 수치의 source mismatch가 닫힌다. |

### 시간이 지나야 확인 가능한 것

| 우선순위 | 연결 Phase                                                         | 현재 표시          | 기다릴 조건                                                    | 확인할 일                                                                                                                                                       |
| ---: | ---------------------------------------------------------------- | -------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
|    1 | [[#Phase 3 Detail\|Phase 3. 식별자 품질 / checkout_started]]          | 관찰 중           | 새 푸터 적용 후 실제 운영 유입 24시간 이상 누적                             | 테스트가 아니라 실제 Meta 광고 클릭 주문에서 `_fbc`, `_fbp`, `checkout_id`, GA 식별자가 결제완료까지 유지되는지 본다.                                                                         |
|    2 | [[#Phase 4 Detail\|Phase 4. CAPI / Pixel dedup 검증]]              | post-guard 관찰 필요 | VM 전환 및 서버형 guard 적용 후 실제 주문 24시간 이상 누적 | 자사몰 카드/가상계좌 단건 테스트는 통과했으므로, 이제 실제 운영 로그에서 confirmed/pending 분리가 유지되는지 본다. |
|    3 | [[#Phase 1 Detail\|Phase 1. Shadow Ledger 강화]]                   | 진행 중           | 가상계좌 테스트 주문 `202604115025096`, `202604110479067` 입금 또는 만료 | 입금 후 local status sync 또는 Toss direct fallback으로 `pending -> confirmed`가 되는지 확인한다.                                                                          |
|    4 | [[#Phase 5 Detail\|Phase 5. Campaign-level ROAS / alias review]] | rate limit 대기  | Meta API `User request limit reached` 해제                  | `campaign-url-evidence`를 재생성해 `creativeId`, `effectiveObjectStoryId`, `instagramPermalinkUrl` 추가 필드가 들어오는지 확인한다.                                            |

### 외부 협업 또는 권한이 필요한 것

| 우선순위 | 연결 Phase | 현재 표시 | 필요한 외부 조건 | 해야 할 일 |
|---:|---|---|---|---|
| 1 | [[#Phase 4 Detail\|Phase 4. CAPI / Pixel dedup 검증]] | 네이버페이 별도 처리 | 네이버페이/아임웹 설정 확인 또는 주문 API 확인 | 결제 완료 후 `orders.pay.naver.com`에 머무는 네이버페이는 Browser Pixel이 아니라 Server CAPI confirmed-only 경로로 별도 처리한다. |
| 2 | [[#Phase 4 Detail\|Phase 4. CAPI / Pixel dedup 검증]] | 외부 화면 필요, 우선순위 낮춤 | Meta Events Manager Test Events 접근 | 카드 결제 완료 주문에서 Browser Purchase와 Server Purchase의 `event_id`가 `Purchase.{아임웹 order_code}`로 같은지 확인한다. 서버 200 성공 로그가 있으므로 UI 확인은 추가 증빙으로 둔다. |
| 3 | [[#Phase 5 Detail\|Phase 5. Campaign-level ROAS / alias review]] | 외부 권한 필요 | 회사에서 마케팅팀 폰 또는 2FA 가능한 기기 확보 | `pages_read_engagement` 또는 Page Public Content Access 권한을 검토한다. Ads Manager UI에는 보이지만 API에서는 `landingUrl=null`인 공동구매 광고 URL 자동 수집을 목표로 한다. |
| 4 | [[#Phase 7 Detail\|Phase 7. 더클린커피 ROAS 비교 준비]] | 외부 토큰 필요 | coffee Meta token 재발급, coffee 주문/PG sync 권한 | coffee Meta token, Imweb 주문 최신 sync, PG/Toss sync 또는 direct fallback, pending status sync를 순서대로 닫는다. |

완료 또는 1차 완료로 표시할 수 있는 항목:

- [[#Phase 0 Detail\|Phase 0]]: 운영 DB 직접 수정 대신 SEO local ledger/API fallback 기준으로 분석한다는 방향은 완료.
- [[#Phase 2 Detail\|Phase 2]]: site-level 최근 7일 ROAS 대시보드와 기본 7일 기준은 1차 완료.
- [[#Phase 3 Detail\|Phase 3]]: `checkout_started=0` blocker는 새 푸터 테스트로 1차 해소.
- [[#Phase 4 Detail\|Phase 4]]: Events Manager 샘플 활동 CSV 분석, Browser Pixel Event ID 확인, Server CAPI 수동 전송은 완료. Meta UI 확인은 추가 증빙으로 둔다.
- [[#Phase 4 Detail\|Phase 4]]: 서버형 payment-decision guard를 아임웹 헤더 상단에 반영했고, 자사몰 카드 confirmed는 `Purchase`, 자사몰 가상계좌 pending은 `VirtualAccountIssued`로 1차 통과했다.
- [[#Phase 4 Detail\|Phase 4]]: `att.ainativeos.net` backend는 GCP VM active origin으로 전환 완료했다. 노트북 backend/tunnel 의존은 제거됐다.
- [[#Phase 4 Detail\|Phase 4]]: 네이버페이는 결제 완료 후 `orders.pay.naver.com`에 머물러 Browser Pixel이 실행되지 않으므로 Server CAPI confirmed-only 별도 Phase로 분리한다.
- [[#Phase 5 Detail\|Phase 5]]: 연뜰살뜰, 현서, 송율 3개 alias manual verified와 최신 audit 재생성은 완료.
- [[#Phase 6 Detail\|Phase 6]]: `/ads`와 `/ads/roas`의 Meta 참고 기준을 `1d_click`로 바꾼 것은 완료.

## 보고서 반영 판단

확인한 문서:

- [Meta ROAS와 내부 ROAS 차이 분석.md](/Users/vibetj/coding/seo/meta/Meta ROAS와 내부 ROAS 차이 분석.md)
- [Meta ROAS와 내부 ROAS 차이 분석.docx](/Users/vibetj/coding/seo/meta/Meta ROAS와 내부 ROAS 차이 분석.docx)

판단:

- `roasphase.md` 업데이트가 필요하다.
- 기존 문서의 방향은 맞지만, 보고서의 실무 체크리스트를 Phase별 완료조건으로 더 명확히 내려야 한다.
- 특히 `CAPI dedup`, `PG 리다이렉션 전 checkout_started 앵커`, `first-party cookie/localStorage 보존`, `내부 링크 UTM 제거`, `Meta 1d_click 기준 운영화`를 Phase별 상세 작업으로 연결해야 한다.
- 보고서 수치와 현재 로컬 원장 수치에는 2건 차이가 있다. 보고서는 전체 확정 주문 383건/97,428,243원을 쓰고, 현재 local normalized ledger는 381건/96,698,243원을 반환한다. 현재 운영 판단 표는 기존 local snapshot 기준을 유지하되, 이 차이는 다음 site-summary 스냅샷에서 재조정한다.

## 딥리서치 보고서에서 추가된 인사이트

- 가장 중요한 새 관점은 **Meta 구매 수가 내부 확정 주문 수보다 많다는 것**이다. 최근 7일 biocom 기준 Meta purchases는 525건이고 site confirmed orders는 381건이다. 이 차이는 단순히 "Meta는 7일 클릭 + 1일 조회라 넓게 잡는다"만으로는 부족하고, Purchase 이벤트 중복 또는 내부 confirmed 정의 차이를 함께 봐야 한다.
- Meta의 `purchase_roas`와 `website_purchase_roas`를 구분해야 한다. 내부 웹 주문 원장과 비교할 때는 웹사이트 구매 기준인 `website_purchase_roas`가 더 직접적이다. 현재 API 응답에는 두 필드가 같이 노출되지만, 운영 표에서는 어떤 필드를 쓰는지 명시해야 한다.
- Meta dedup은 만능이 아니다. Pixel과 CAPI가 같은 주문을 동시에 보낼 때 `event_id`가 같아야 중복 제거가 가능하고, 브라우저 Pixel끼리 2번 또는 서버 CAPI끼리 2번 보내는 **같은 채널 내 중복**은 Meta가 자동으로 줄여주지 않는다.
- 내부 Attribution이 낮은 이유도 더 선명해졌다. 결제완료 페이지에서만 UTM/fbclid를 읽으면 리다이렉트, 재방문, 결제 도메인 이동에서 신호를 잃는다. 따라서 랜딩 시점부터 `fbclid -> fbc`, `fbp`, UTM 첫 유입/마지막 유입을 저장해야 한다.
- 새 푸터 테스트로 `checkout_started=0` blocker는 1차 해소됐다. 이제 blocker는 "수집 기능이 없는 것"이 아니라 "실제 운영 유입에서 24시간 이상 안정적으로 이어지는지"다.
- 리인벤팅 CRM용 `GTM-W7VXS4D8`는 2026-04-11에 제거 확인됐다. live HTML과 Headless Chrome 로그에서 W7 호출과 기존 `Cannot read properties of null (reading 'includes')` 오류가 사라졌다. 상세 검증은 [redelete.md](/Users/vibetj/coding/seo/data/redelete.md)를 source로 본다.
- 보고서는 내부 링크에 UTM을 붙이면 기존 외부 유입 세션이 덮어써질 수 있다고 지적한다. 내부 배너/공지/상세페이지 간 이동에는 UTM을 쓰지 않는 운영 규칙이 필요하다.
- 2026-04-11 Meta Events Manager 샘플 활동 CSV를 확인했다. Server Purchase 44건, Browser Purchase 33건으로 서버 이벤트가 더 많고, Server `order_id` 커버리지는 20.5%, Server `content_ids/contents` 커버리지는 31.8%에 그쳤다. 이 결과는 [metareport.md](/Users/vibetj/coding/seo/meta/metareport.md)를 source로 본다.
- 2026-04-11 가상계좌 미입금 주문 `202604114568447`에서 Browser Pixel Purchase가 `value=39000`, `currency=KRW`로 발화하는 것이 확인됐다. 이 주문은 local ledger 기준 `pending`이고 서버 CAPI에는 전송되지 않았다. 즉 Meta 과대 원인에는 dedup뿐 아니라 **브라우저 Pixel이 미입금 가상계좌를 Purchase로 잡는 문제**도 포함된다.
- 2026-04-11 카드 결제 완료 주문 `202604110037075`에서 Browser Pixel Purchase Event ID가 `Purchase.o202604111e6d6e78c02e9`로 확인됐다. `o202604111e6d6e78c02e9`는 아임웹 `order_code`이므로 서버 CAPI도 Purchase에서는 이 값을 우선 사용하도록 수정했다.
- 2026-04-12 서버형 payment-decision guard를 아임웹 헤더 상단에 반영했고, 자사몰 카드 confirmed 주문은 `ev=Purchase`, 가상계좌 pending 주문은 `ev=VirtualAccountIssued`로 1차 통과했다.
- 2026-04-12 `att.ainativeos.net` backend는 GCP VM active origin으로 전환됐다. `CAPI_AUTO_SYNC_ENABLED=true`, `ATTRIBUTION_STATUS_SYNC_ENABLED=true`, `CWV_AUTO_SYNC_ENABLED=false` 상태이며 노트북 backend/tunnel 의존은 제거됐다.
- 네이버페이는 결제 완료 후 `orders.pay.naver.com/order/result/mall/...`에 머물러 우리 헤더/푸터 코드와 Pixel이 실행되지 않는다. 이 흐름은 Browser Pixel이 아니라 Server CAPI confirmed-only로 별도 처리한다.

## 현재 방향

운영 DB를 수정하지 않고, SEO 프로젝트 안에서 가능한 작업을 우선한다.

목표는 `tb_sales_toss` 같은 운영 정본 테이블을 직접 고치는 것이 아니라, 아래 로컬 경로로 site-level ROAS를 최대한 재현하고 검증하는 것이다.

- SEO local Attribution ledger
- Toss direct API fallback
- local `toss_transactions` / `toss_settlements`
- local `imweb_orders` / `imweb_members`
- Meta raw / site-summary / daily API
- CAPI send log
- 새 푸터 `checkout_started` / `payment_success` 연결 로그

개발팀 요청용 Phase B는 이 문서에서 제외한다. 지금은 외부 요청서 작성보다 우리 쪽 로컬 준정본을 더 강하게 만드는 것이 우선이다.

## 로드맵 연결 상태

2026-04-11 기준 아래 문서들은 이 문서를 Meta ROAS / Attribution ROAS 정합성 판단 source로 연결했다.

- [roadmap0327.md](/Users/vibetj/coding/seo/roadmap/roadmap0327.md): 전체 Phase 요약과 이번 주 우선순위에 반영.
- [phase1.md](/Users/vibetj/coding/seo/roadmap/phase1.md): 결제 귀속 원장, 새 푸터 관찰, 더클린커피 token/sync blocker에 반영.
- [phase3.md](/Users/vibetj/coding/seo/roadmap/phase3.md): CRM 실행 전 cross-phase blocker에 반영.
- [phase5.md](/Users/vibetj/coding/seo/roadmap/phase5.md): Meta/CAPI 후속 작업과 dedup 확인에 반영.
- [phase5_5.md](/Users/vibetj/coding/seo/roadmap/phase5_5.md): ROAS 대시보드 source-of-truth와 더클린커피 비교 보류 조건에 반영.

## Phase별 완성도

| Phase | 완성도 | 현재 상태 | 다음 액션 |
|---|---:|---|---|
| [[#Phase 0 Detail\|Phase 0. 운영 정본 대신 로컬 준정본으로 전환]] | 95% | 방향은 완료됐다. 운영 DB를 직접 수정하지 않고 local ledger + Toss direct fallback + Imweb cache + Meta raw로 site-level ROAS를 본다. | 운영 DB write가 필요한 작업은 보류하고, local ledger와 API fallback으로만 검증 가능한 지표를 유지한다. |
| [[#Phase 1 Detail\|Phase 1. Shadow Ledger 강화]] | 82% | local ledger 총 732건. `payment_success` 714건, `checkout_started` 4건, `form_submit` 14건. `payment_success` 상태는 confirmed 482건, pending 219건, canceled 13건이다. | 가상계좌 테스트 주문 2건 입금 후 pending -> confirmed 전환을 확인한다. local `/api/toss/sync` 또는 direct fallback 결과를 일별 snapshot으로 남긴다. |
| [[#Phase 2 Detail\|Phase 2. Site-level ROAS 일일 보고]] | 90% | 최근 7일 biocom 기준 spend 27,137,819원, Attribution confirmed ROAS 1.05x, confirmed+pending 1.07x, Meta `1d_click` ROAS 3.11x, Meta default ROAS 4.80x까지 재현된다. | `/ads` 기본 Meta window는 `1d_click`로 고정 완료. 다음은 `/ads/roas`와 정기 snapshot에도 같은 기준을 명시한다. |
| [[#Phase 3 Detail\|Phase 3. 식별자 품질 / checkout_started]] | 76% | `checkout_started=0` blocker는 1차 해소됐다. 새 푸터 이후 `checkout_started` 3건, `payment_success` 2건이 들어왔고 모두 `checkout_id`와 GA 3종 식별자가 있다. | 실제 운영 24시간 기준으로 `checkout_started`, `payment_success`, all-three, `fbclid/fbc/fbp`, `checkout_id` 연결률을 본다. 실제 Meta 광고 클릭에서 생성된 `fbclid`도 테스트한다. |
| [[#Phase 4 Detail\|Phase 4. CAPI / Pixel dedup 검증]] | 92% | 로컬 dedup 자동 리포트 생성 완료. 자사몰 카드 confirmed는 `Purchase.o2026041258d9051379e47`, 가상계좌 pending은 `VirtualAccountIssued.o20260412cdb6664e94ccb`로 실전 확인했다. `att.ainativeos.net`은 VM active origin으로 전환됐고 CAPI/Attribution sync가 켜져 있다. | 24시간 이상 실제 운영 로그에서 pending 주문이 Browser/Server `Purchase`로 오염되지 않는지, `payment-decision unknown` 비율이 높지 않은지 확인한다. 네이버페이는 별도 Server CAPI 경로로 분리한다. |
| [[#Phase 5 Detail\|Phase 5. Campaign-level ROAS / alias review]] | 45% | 연뜰살뜰, 현서, 송율 3개 alias는 `manual_verified`로 반영 완료. 최신 audit 재생성도 완료. `campaign-url-evidence`에서 410개 광고 중 340개는 `utm_campaign`을 자동 추출했다. | Meta API rate limit 해제 후 URL evidence를 재생성한다. `landingUrl=null` 고지출 광고와 여러 campaign에 걸친 alias만 예외 검토한다. |
| [[#Phase 6 Detail\|Phase 6. 같은 기준 ROAS 비교 뷰]] | 78% | API로 Meta attribution window별 조회가 가능하고, `/ads`와 `/ads/roas`의 Meta 참고값 요청 기준을 `1d_click`로 바꿨다. 최근 7일 기준 1d_click, 7d_click, 1d_view 값도 확인했다. | 정기 보고 snapshot에도 `Meta 1d_click`을 headline으로 고정한다. default는 Ads Manager parity 참고값으로만 둔다. |
| [[#Phase 7 Detail\|Phase 7. 더클린커피 ROAS 비교 준비]] | 25% | 더클린커피 attribution ledger는 live `payment_success` 81건, confirmed 0건, pending 4,048,651원이다. Meta API는 coffee 토큰 만료로 실패한다. | coffee Meta token 재발급, Imweb orders 최신 sync, Toss coffee/local PG sync 또는 direct fallback, pending status sync를 먼저 닫은 뒤 biocom과 같은 window별 ROAS 표를 만든다. |

## 현재 수치 메모

`biocom` 최근 7일:

- 기준 기간: 2026-04-04 - 2026-04-10
- spend: 27,137,819원
- Attribution confirmed revenue: 28,452,940원
- Attribution confirmed orders: 102건
- Attribution pending revenue: 645,700원
- Attribution confirmed+pending revenue: 29,098,640원
- Meta purchases: 525건
- Meta purchase value: 130,139,887원
- site-wide confirmed revenue: 96,698,243원
- site-wide confirmed orders: 381건
- Attribution confirmed ROAS: 1.05x
- Attribution confirmed+pending ROAS: 1.07x
- Meta `1d_click` purchase ROAS: 3.11x
- Meta default purchase ROAS: 4.80x
- best-case ceiling ROAS: 3.56x

Meta attribution window별 최근 7일:

| 기준 | purchases | purchase value | ROAS |
|---|---:|---:|---:|
| 1d_click / 운영 기준 | 295 | 84,517,896원 | 3.11x |
| Meta default / Ads Manager parity 참고 | 525 | 130,139,887원 | 4.80x |
| 7d_click | 365 | 95,362,430원 | 3.51x |
| 1d_view | 161 | 34,830,458원 | 1.28x |
| Attribution confirmed | 102 | 28,452,940원 | 1.05x |
| Attribution confirmed+pending | 106 | 29,098,640원 | 1.07x |

해석:

- 앞으로 "Meta ROAS" headline은 1d_click 3.11x를 의미한다.
- Meta 1d_click로 좁혀도 Attribution confirmed보다 약 3배 높다.
- Meta default 4.80x는 view-through와 더 긴 클릭 창이 섞인 platform reference로 봐야 한다.
- `site-wide confirmed orders 381건`보다 `Meta purchases 525건`이 많은 점은 dedup/이벤트 정의 검증이 필요한 핵심 경고다.

## Campaign alias / Meta API 권한 메모

2026-04-11 작업 결과:

- 최신 alias audit 생성: 성공
- 기준 기간: 2026-04-04 - 2026-04-10
- `data/meta_campaign_alias_audit.biocom.json` generatedAt: `2026-04-11T05:31:33.717Z`
- Meta API 광고 row: 410개
- API에서 landing URL이 잡힌 광고: 345개
- API에서 `utm_campaign`이 추출된 광고: 340개
- 자동 추출된 alias: 231개
- campaign이 1개로 좁혀지는 alias: 198개
- 여러 campaign에 걸친 alias: 33개
- manual verified alias: 연뜰살뜰, 현서, 송율 3개

현재 한계:

- 공동구매 캠페인 `120242626179290396`의 송율/연뜰살뜰/현서 광고는 Ads Manager UI에서 URL이 보이지만 현재 Meta API 응답에서는 URL이 비어 있다.
- 송율 광고 `120243539487070396`은 creative ID, body, Instagram permalink, `effective_object_story_id`는 조회되지만 landing URL은 내려오지 않는다.
- `effective_object_story_id` attachment 조회는 `pages_read_engagement` 또는 Page Public Content Access 권한 부족으로 실패한다.

해야 할 일:

- 회사에서 마케팅팀 폰 또는 2FA 가능한 기기를 확보한다.
- Meta Business/App 권한에서 `pages_read_engagement` 또는 Page Public Content Access 가능 여부를 확인한다.
- biocom Page/Instagram 게시물 attachment URL을 읽을 수 있는 토큰을 발급하거나 현재 system user 토큰 권한을 보강한다.
- 권한 확보 후 `backend/scripts/export-meta-campaign-alias-audit.ts`를 재실행해 `meta/campaign-url-evidence.biocom.json`의 `landingUrl=null` 광고가 줄어드는지 확인한다.

권한 확보 전 운영 방식:

- 전체 광고를 수동 확인하지 않는다.
- `meta/campaign-url-evidence.biocom.json`에서 `confidence=needs_manual_review`, `landingUrl=null`, spend 상위 광고만 수동 확인한다.
- 여러 campaign에 걸친 alias는 자동 확정하지 않는다.

## 새 푸터 테스트 결과

2026-04-11 11:40 KST 이후 `biocom_imweb` live row:

| touchpoint | total | all-three | checkout_id | fbclid | fbc | fbp |
|---|---:|---:|---:|---:|---:|---:|
| checkout_started | 3 | 3 | 3 | 0 | 1 | 3 |
| payment_success | 2 | 2 | 2 | 1 | 1 | 2 |

테스트 주문:

- `202604115025096`: direct 유입 테스트. `checkout_id=chk_1775875643089_e4osiqzb`, `fbp`와 GA 3종 식별자 연결 성공, `fbclid/fbc` 없음, 현재 pending.
- `202604110479067`: UTM + 테스트 `fbclid` 유입. `checkout_id=chk_1775875906804_ew03o954`, `fbclid=TEST_FBCLID_20260411_1155`, `fbc=fb.1.1775875901552.TEST_FBCLID_20260411_1155`, `fbp`와 GA 3종 식별자 연결 성공, 현재 pending.

주의:

- 두 번째 테스트는 기술적으로 `fbclid -> fbc -> checkout_started -> payment_success` 저장이 되는지 확인한 것이다.
- 진짜 Meta attribution 검증은 실제 Meta 광고 클릭에서 발급된 `fbclid`로 한 번 더 봐야 한다.

## 더클린커피 비교 상태

2026-04-11 12:30 KST 기준 더클린커피는 아직 biocom처럼 Meta ROAS와 Attribution ROAS의 배율 차이를 판단할 수 없다.

현재 확인값:

- Meta account: `act_654671961007474`
- Meta API 상태: coffee token configured, tokenLength 292, 하지만 Meta 응답은 만료 오류
- 최근 7일 site-summary: confirmed revenue 0원, pending revenue 210,299원, Meta spend/value는 토큰 만료 때문에 실측 불가
- Attribution ledger: `thecleancoffee_imweb` live `payment_success` 81건, confirmed 0건, pending 4,048,651원
- caller coverage: all-three 20/81, 24.69%
- `checkout_started`: 0건
- Imweb local cache: 1,937건, 최신 주문 2026-04-04 10:38 KST
- Toss coffee local transaction: 최신 2026-02-23 16:21 KST

판단:

- 지금 숫자로는 "더클린커피도 Meta ROAS가 과대인지" 결론을 내리면 안 된다.
- 먼저 coffee token과 로컬 정본 최신성을 복구해야 한다.
- 더클린커피는 confirmed가 0이라, Meta ROAS가 조회되더라도 내부 confirmed ROAS와 비교하면 무조건 내부 0으로 보이는 착시가 생긴다.

## 하지 않을 것

- 운영 Postgres `tb_sales_toss` 직접 수정
- 운영 DB schema 변경
- alias 자동 매핑
- Meta 광고세트 attribution setting을 숫자 축소 목적으로 변경
- Meta CAPI sync POST를 검증 목적으로 임의 실행
- Meta default ROAS 4.80x를 확정 수익성 지표나 headline Meta ROAS로 사용
- 30일 ROAS를 현재 운영 headline으로 고정
- 더클린커피를 현재 token 만료/confirmed 0 상태에서 biocom과 같은 품질로 비교

## 운영 판단 문장

현재 site-level에서는 Meta ROAS가 Attribution ROAS보다 높게 보이는 이유를 상당 부분 설명할 수 있다. Meta는 더 넓은 attribution window와 자체 매칭 신호를 쓰고, 내부 Attribution은 결제완료 시점의 식별자 유실 때문에 보수적으로 잡힌다.

다만 격차가 너무 커서 "Meta가 넓게 잡는다"만으로 끝내면 안 된다. 지금 가장 강한 blocker는 `Meta purchases 525건 > 내부 site confirmed orders 381건`이다. 광고비 증액/감액 판단 전에 Events Manager에서 주문 단위 Purchase 중복 여부를 확인하고, 새 푸터 이후 24시간 운영 데이터로 내부 식별자 품질이 실제로 유지되는지 확인해야 한다.

## Phase 완료조건 상세

### Phase 0 Detail

Phase 0. 운영 정본 대신 로컬 준정본으로 전환

현재 상태:

- 1차 완료.
- 운영 Postgres `tb_sales_toss`를 직접 수정하지 않는 원칙은 확정됐다.
- SEO local ledger, Imweb cache, Toss direct fallback, Meta API, CAPI send log를 조합해 ROAS 정합성을 검증하는 방향이다.

완료하려면:

- 운영 DB write가 필요한 작업과 로컬 검증 작업을 문서/코드에서 계속 분리한다.
- `site-summary`, `daily`, `campaign alias`, `capi log`가 모두 같은 로컬 준정본 소스를 쓰는지 주기적으로 확인한다.
- 운영 DB 최신화가 막혀도 로컬 fallback으로 확인 가능한 지표와 불가능한 지표를 화면에 구분 표시한다.

완료 기준:

- 신규 ROAS 이슈가 생겨도 “운영 DB를 직접 고쳐야만 확인 가능”이라는 병목 없이, 로컬 준정본으로 최소 site-level 판단이 가능하다.

### Phase 1 Detail

Phase 1. Shadow Ledger 강화

현재 상태:

- 진행 중.
- `payment_success`, `checkout_started`, `form_submit`가 local ledger에 쌓인다.
- 가상계좌 주문은 입금 전 `pending`으로 남으며, 입금/상태 동기화 이후 `confirmed` 전환 검증이 필요하다.

완료하려면:

- 가상계좌 테스트 주문 `202604115025096`, `202604110479067`을 입금 후 추적한다.
- 입금 후 local status sync 또는 Toss direct fallback으로 `pending -> confirmed`가 되는지 확인한다.
- `payment_key`, `order_no`, `payment_code`, `order_code` 기준으로 Imweb/Toss/local ledger가 같은 주문을 가리키는지 검증한다.
- status sync 실행 전후 `max(approved_at)`, confirmed count, pending count, revenue 변화를 snapshot으로 남긴다.

완료 기준:

- 카드와 가상계좌 모두 결제완료 수집 후 최종 상태가 local ledger에 안정적으로 반영된다.
- pending revenue가 단순 미확정인지, sync 지연인지, 입금 실패인지 주문 단위로 설명 가능하다.

### Phase 2 Detail

Phase 2. Site-level ROAS 일일 보고

현재 상태:

- 대부분 완료.
- 최근 7일 site-level ROAS는 재현 가능하다.
- 다만 보고서의 `전체 확정 383건/97,428,243원`과 현재 local normalized ledger의 `381건/96,698,243원` 사이에 2건 차이가 있어 다음 snapshot에서 reconcile이 필요하다.

완료하려면:

- `site-summary`, `daily`, `ads`, `roas` 화면의 날짜축과 광고비 축을 동일하게 맞춘다.
- `Meta 1d_click`, `Meta default`, `Attribution confirmed`, `confirmed+pending`, `best-case ceiling`을 한 표에 고정한다.
- best-case ceiling은 spend/date mismatch가 사라지기 전까지 `잠정 ceiling`으로 표기한다.
- 보고서 수치와 local ledger 수치가 다를 때 어떤 snapshot이 source인지 문서에 남긴다.

완료 기준:

- 하루 단위로 같은 기간/같은 spend/같은 주문 기준의 site-level ROAS를 재생성할 수 있다.

### Phase 3 Detail

Phase 3. 식별자 품질 / checkout_started

현재 상태:

- `checkout_started=0` blocker는 1차 해소.
- 새 푸터 이후 테스트 주문에서는 `checkout_id`와 GA 3종 식별자가 결제완료까지 이어졌다.
- 보고서가 지적한 핵심은 PG 리다이렉션 전에 UTM/fbclid/fbc/fbp를 first-party storage에 저장해야 한다는 점이다.

완료하려면:

- 실제 Meta 광고 클릭에서 발급된 `fbclid`로 주문을 1건 이상 테스트한다.
- `fbclid -> _fbc`, `_fbp`, UTM, `checkout_id`, `ga_session_id`, `client_id`, `user_pseudo_id`가 `checkout_started -> payment_success`로 이어지는지 확인한다.
- 24시간 운영 데이터에서 snippetVersion별 all-three coverage와 `fbclid/fbc/fbp` coverage를 본다.
- 내부 링크에는 UTM을 붙이지 않는 운영 규칙을 추가한다. 내부 UTM은 외부 유입 세션을 덮어쓸 수 있다.
- 결제 완료 페이지 새로고침 또는 영수증 재방문 시 같은 주문 이벤트가 중복 수집되지 않도록 first-access guard를 점검한다.

완료 기준:

- 실제 운영 주문에서 Meta 유입 식별자가 결제완료까지 보존된다.
- 유입경로 불명 주문 비중이 감소한다.

### Phase 4 Detail

Phase 4. CAPI / Pixel dedup 검증

현재 상태:

- 핵심 blocker는 1차 해소됐고, 현재는 post-guard 운영 관찰 단계다.
- 서버 CAPI는 2xx 성공이지만, Meta purchase 수가 내부 전체 확정 주문 수보다 많다는 구조는 여전히 확인 대상이다.
- 보고서는 이 구조를 단순 attribution window가 아니라 dedup failure, payment complete multiple firing, 가상계좌 미입금 Browser Purchase 오염의 복합 신호로 본다.
- 2026-04-11 로컬 자동 리포트 생성 완료:
- [최근 3일 전체 리포트](/Users/vibetj/coding/seo/data/meta_capi_dedup_phase4_20260411.md): 운영 성공 CAPI 471건, retry-like 140그룹/405 rows, multi-event-id risk 1그룹/6 rows.
- [post-fix 리포트](/Users/vibetj/coding/seo/data/meta_capi_dedup_phase4_postfix_20260411.md): 2026-04-10 00:00 KST 이후 운영 성공 CAPI 204건, retry-like 53그룹/144 rows, multi-event-id risk 0그룹.
- [현재 런타임 리포트](/Users/vibetj/coding/seo/data/meta_capi_dedup_phase4_current_runtime_20260411.md): 2026-04-11 15:18:27 KST 이후 운영 성공 CAPI 1건, retry-like 0그룹, multi-event-id risk 0그룹.
- 반복 전송은 우리 솔루션에서 Meta CAPI로 보낸 서버 전송 로그를 뜻한다. Meta가 우리에게 되돌려 보낸 로그가 아니다.
- Events Manager 확인은 Meta 계정 권한과 2FA가 필요한 외부 화면 작업이다. Codex가 할 수 있는 것은 확인할 주문/시간/event_id 후보를 좁히는 일이다.
- 2026-04-11 Meta Events Manager 샘플 활동 CSV 확인 완료:
- [Meta Purchase 이벤트 품질 점검 리포트](/Users/vibetj/coding/seo/meta/metareport.md)
- 샘플 77건 중 Server 44건, Browser 33건이다.
- Browser는 `value/currency/content_ids/contents`가 100% 있지만 `order_id`는 0건이다.
- Server는 `value/currency/content_type`은 100%지만 `order_id`는 9건, 20.5%이고 `content_ids/contents`는 14건, 31.8%다.
- Server `placedURL` 빈 값이 9건 있다.
- 이 CSV에는 `event_id`와 Meta dedup status가 없어, dedup 성공 여부는 판정할 수 없다.
- 2026-04-11 백엔드에 특정 주문 CAPI Test Events 전송 필터를 추가했다. `POST /api/meta/capi/sync`가 `order_id`, `payment_key`, `test_event_code`를 받을 수 있다.
- 2026-04-11 가상계좌 미입금 주문 `202604114568447`에서 Browser Pixel Purchase가 발화했다. Pixel Helper 기준 `value=39000`, `currency=KRW`, `content_ids=["97"]`였다.
- 같은 주문은 local ledger에서 `paymentStatus=pending`, `paymentKey=iw_bi20260411222457z2W48`, `checkoutId=chk_1775913890793_p3mzxcxu`로 확인됐다.
- 최신 CAPI 전송 로그에는 이 pending 주문이 없었다. 서버 CAPI는 미입금 가상계좌를 Purchase로 보내지 않는 현재 정책이 정상 동작 중이다.
- 따라서 Meta 과대 원인은 CAPI dedup 외에도 브라우저 Pixel이 미입금 가상계좌를 Purchase로 잡는 정의 차이가 포함된다.
- 2026-04-11 카드 결제 완료 주문 `202604110037075`에서 Browser Pixel Purchase Event ID는 `Purchase.o202604111e6d6e78c02e9`였다.
- 같은 주문은 Toss direct fallback으로 `confirmed`, `DONE`, `카드`, `approved_at=2026-04-11T14:46:26.000Z`까지 보정됐다.
- Server CAPI event_id 생성 규칙은 Purchase에서 `metadata.referrerPayment.orderCode`, `metadata.orderCode`, URL의 `order_code/orderCode`를 순서대로 찾아 `Purchase.{orderCode}`로 맞추도록 수정했다. order_code가 없을 때만 내부 주문번호 기반 fallback을 쓴다.
- 2026-04-12 00:05 KST에 같은 주문 `202604110037075`을 `test_event_code=TEST95631`로 서버 CAPI 수동 전송했다. Meta 응답은 HTTP 200, `events_received=1`, Server event_id는 `Purchase.o202604111e6d6e78c02e9`다.
- 이 주문은 수동 전송 전 2026-04-11 23:58:45 KST 운영 auto-sync에서도 이미 같은 event_id로 1회 전송됐다. 즉 서버 쪽 신규 event_id 생성 규칙은 운영/테스트 모두 적용됐다.
- 2026-04-12 문구 기반 스니펫은 서버형 payment-decision guard로 대체했다. 서버형 guard는 `FB_PIXEL.Purchase`와 직접 `fbq('track', 'Purchase')`를 감싸고, `att.ainativeos.net/api/attribution/payment-decision` 결과로 confirmed/pending을 판정한다.
- 2026-04-12 카드 confirmed 주문 `o2026041258d9051379e47 / 202604127697550`에서 `ev=Purchase`, `eid=Purchase.o2026041258d9051379e47`, HTTP 200을 확인했다.
- 2026-04-12 가상계좌 pending 주문 `o20260412cdb6664e94ccb / 202604126682764`에서 `ev=VirtualAccountIssued`, `eid=VirtualAccountIssued.o20260412cdb6664e94ccb`, HTTP 200을 확인했고 Browser `Purchase`는 보이지 않았다.
- 2026-04-12 `att.ainativeos.net` backend는 GCP VM active origin으로 전환됐다. PM2 `seo-backend`와 `seo-cloudflared`가 online이고, health 기준 `CAPI_AUTO_SYNC_ENABLED=true`, `ATTRIBUTION_STATUS_SYNC_ENABLED=true`, `CWV_AUTO_SYNC_ENABLED=false`다.
- 2026-04-12 네이버페이 주문 `2026041289545040`은 결제 완료 후 `orders.pay.naver.com/order/result/mall/2026041289545040`에 머물렀고 Pixel Helper는 `No Pixels found on this page`였다. 네이버페이는 Browser Pixel이 아니라 Server CAPI confirmed-only 별도 경로로 처리한다.

완료하려면:

- post-server-decision-guard 이후 24시간 이상 실제 운영 로그를 본다.
- 가상계좌 pending이 Browser `Purchase`나 Server CAPI `Purchase`로 나가지 않는지 확인한다.
- 카드 confirmed가 Browser `Purchase`와 Server CAPI `Purchase`로 유지되는지 확인한다.
- `payment-decision unknown` 비율이 높으면 원인 주문을 샘플링한다.
- confirmed 기준 Purchase는 서버 CAPI를 정본으로 삼는다. 가상계좌는 입금 완료 후 CAPI Purchase만 전송한다.
- CAPI `event_source_url`을 항상 절대 URL로 만든다. `/shop_payment_complete` 같은 상대경로는 `https://biocom.kr/shop_payment_complete`로 정규화한다.
- Server Purchase payload에 `custom_data.order_id`가 항상 들어가는지 로컬 응답과 Meta Test Events에서 확인한다.
- Server Purchase payload에 가능한 경우 `content_ids`, `contents`를 붙인다. 상품 단위 품질을 높이는 작업이며, dedup 1순위는 여전히 `event_id`다.
- Meta Test Events UI 확인은 추가 증빙으로 낮춘다. 서버 응답과 Network 200이 이미 확인됐기 때문이다.
- 새 테스트 주문을 계속 만들기보다 실제 운영분에서 CAPI log와 payment-decision log를 본다.
- 가상계좌 미입금 주문은 `paymentStatus=confirmed`가 아니므로 CAPI Purchase 후보에서 제외된다. 최종 dedup 검증은 카드 결제 또는 입금 완료된 테스트 주문으로 하는 것이 가장 정확하다.
- 가능하면 Events Manager에서 orderId `202604083892378` 또는 post-fix retry-like 샘플 주문을 열어 주문 1건당 Purchase 이벤트 수를 확인한다. 다만 샘플 활동 CSV만으로는 이 확인이 불가능하다.
- `Purchase` vs `purchase`처럼 event name 대소문자가 다르지 않은지 확인한다.
- Pixel과 CAPI 전송 간격이 48시간 이내인지 확인한다.
- 결제완료 페이지 새로고침, 북마크 재방문, 영수증 확인에서 Pixel Purchase가 중복 발화하지 않는지 확인한다.
- Meta Events Manager의 dedup overlap 지표가 비정상적으로 낮은지 캡처한다.
- 같은 채널 내 중복, 즉 Pixel-Pixel 중복 또는 CAPI-CAPI 중복은 Meta dedup으로 자동 해결되지 않는다는 점을 별도 검증한다.

완료 기준:

- `Meta purchases 525건 > 내부 확정 주문 381건`의 원인이 dedup 실패, view-through/long click attribution, 내부 유실 중 어디인지 주문 단위로 분해된다.
- 중복 전송이면 차단 규칙 또는 shared `event_id` 규칙까지 반영된다.
- 자사몰 가상계좌 미입금 주문완료는 Meta Browser `Purchase`로 집계되지 않는다.
- 자사몰 카드 결제 또는 입금 완료 주문은 Browser Pixel과 Server CAPI의 `event_id`가 `Purchase.{아임웹 order_code}`로 일치한다.
- 네이버페이는 자사몰 Browser guard의 완료 기준에서 분리하고, Server CAPI confirmed-only 별도 처리 기준으로 본다.

### Phase 5 Detail

Phase 5. Campaign-level ROAS / alias review

현재 상태:

- 부분 완료.
- 연뜰살뜰, 현서, 송율 3개 alias는 manual verified.
- 최신 alias audit은 `2026-04-04 ~ 2026-04-10` 기준으로 재생성됐다.
- `meta/campaign-url-evidence.biocom.json`에서 410개 광고 중 340개는 `utm_campaign`을 자동 추출했다.
- 공동구매 캠페인 일부 광고는 현재 Meta API 토큰으로 `landingUrl=null`이다.

완료하려면:

- Meta API rate limit 해제 후 `backend/scripts/export-meta-campaign-alias-audit.ts`를 재실행한다.
- `campaign-url-evidence`에 `creativeId`, `effectiveObjectStoryId`, `instagramPermalinkUrl`이 들어오는지 확인한다.
- `landingUrl=null`이면서 spend가 큰 광고만 수동 검토한다.
- 같은 alias가 여러 campaign에 걸친 경우는 자동 확정하지 않고 campaign별로 분리한다.
- 회사에서 마케팅팀 폰 또는 2FA 가능한 기기를 확보해 `pages_read_engagement` 또는 Page Public Content Access 권한을 검토한다.
- 권한 확보 후 Ads Manager UI에는 보이는 소스 URL/웹사이트 URL이 API로도 내려오는지 확인한다.

완료 기준:

- campaign-level Attribution ROAS를 계산할 수 있는 alias mapping seed가 충분히 쌓인다.
- 수동 URL 복사는 예외 작업으로만 남는다.

### Phase 6 Detail

Phase 6. 같은 기준 ROAS 비교 뷰

현재 상태:

- 대부분 완료.
- 앞으로 TJ님과 이야기할 때 `Meta ROAS` headline은 `1d_click`을 의미한다.
- Meta default는 Ads Manager parity 참고값으로만 본다.

완료하려면:

- `/ads`, `/ads/roas`, 정기 snapshot, 문서의 Meta ROAS headline을 모두 `1d_click`로 통일한다.
- default, 7d_click, 1d_view는 보조 비교값으로 표시한다.
- `purchase_roas`와 `website_purchase_roas` 중 내부 웹 주문과 비교하는 기준을 명확히 표기한다.
- view-through 전환은 운영 의사결정 headline에서 제외한다.

완료 기준:

- 같은 질문에 대해 매번 다른 Meta attribution window를 섞어 답하지 않는다.
- Meta와 내부 Attribution의 차이를 window별로 재현 가능하다.

### Phase 7 Detail

Phase 7. 더클린커피 ROAS 비교 준비

현재 상태:

- 미완료.
- Meta token 만료, 내부 confirmed 0건, Imweb/Toss local cache 최신성 부족 때문에 비교 불가다.

완료하려면:

- coffee Meta token을 재발급한다.
- coffee Imweb orders cache를 최신화한다.
- Toss coffee/local PG sync 또는 direct fallback을 복구한다.
- `thecleancoffee_imweb` live `payment_success` pending을 confirmed/canceled/pending으로 분해한다.
- 더클린커피에도 `checkout_started`와 식별자 보존 스니펫이 붙었는지 확인한다.
- biocom과 같은 기준으로 `Meta 1d_click`, `Meta default`, Attribution confirmed, confirmed+pending을 산출한다.

완료 기준:

- 더클린커피도 biocom과 동일한 기준으로 Meta ROAS와 내부 Attribution ROAS 차이를 비교할 수 있다.
