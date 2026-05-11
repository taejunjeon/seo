# 액션 1 후속 — 로컬DB imweb_orders bridge 로 매출 join 첫 성공

작성 시각: 2026-05-11 19:30 KST
**결론: 직전 0건에서 4건 매칭으로 전환. 총 매출 ₩55만 1,000 첫 검증.**

## 1. 이번에 가능해진 것

직전 시도에서 "운영DB order_number 와 imweb URL order_code 가 다른 식별자라 매칭 0건" 으로 막혔는데, **`imwebapi.md` 문서를 읽어서 로컬DB `imweb_orders` 테이블이 두 식별자를 모두 보유한다** 는 사실을 발견. 그 bridge 로 site_landing → 로컬 → 운영DB 3-hop chain 을 만들어 L2 ladder 매출 join 을 **처음으로 성공**시켰다.

## 2. 왜 필요했는지

L2 attribution ladder 의 핵심 검증 — "광고 유입이 실제 매출로 이어졌는가" 를 우리 자체 DB 로 확인할 수 있는지. 0건이면 L2 가 작동 안 한다는 뜻이고, 1건이라도 매칭되면 schema 가 작동한다는 증거.

## 3. 어떻게 작동하는지 (비개발자용)

3 단계 매칭 (요청: imwebapi.md 문서 검색 후 진행):

1. 유입 장부 (`site_landing_ledger`) 의 결제 페이지 URL 에서 `order_code=o2026...` 추출.
2. 로컬DB 의 아임웹 주문 캐시 (`imweb_orders`) 와 그 코드로 매칭 → 운영DB 주문번호 형식 (`order_no`, 15자리 숫자) 끌어내기.
3. 그 주문번호로 운영DB `tb_iamweb_users` 의 결제 완료 row 직접 조회 → 매출 합계.

## 4. 실제로 확인된 결과

| 단계 | 결과 |
|---|---|
| Step 1 site_landing 결제 URL row | 32 |
| Step 1 unique order_code | 30 |
| Step 1 → 로컬DB imweb_orders 매칭 | **10건** (33%) |
| Step 2 → 운영DB tb_iamweb_users 매칭 | **4건** |
| Step 2 결제완료 | 4 (전부) |
| Step 2 환불/취소 | 0 |
| **총 매출** | **₩55만 1,000** |
| 결제수단 | CARD 4건 / NPay 0 |
| 평균 주문금액 | ₩13만 7,750 |
| 사이트 분포 (bridge 매칭 단계) | biocom 5 / thecleancoffee 5 |

## 5. 아임웹 API 문서 search 결과

| 문서 | 내용 |
|---|---|
| `imwebapi.md` §59-92 주문 섹션 | `GET /v2/shop/orders` 응답이 `order_no` + `order_code` + `channel_order_no` 모두 반환 |
| `imwebapi.md` §67-85 로컬 캐시 컬럼 | 로컬DB `imweb_orders` 가 두 식별자 모두 저장. 이게 본 bridge 의 핵심 |
| `imwebapi.md` §231-246 NPay 매핑 | NPay 완료 URL 끝자리 숫자 = imweb `channel_order_no`. 본 sprint 의 NPay row 도 같은 bridge 로 매칭 가능 (다음 시도 후보) |

찾은 imweb 관련 md 파일 17 개 중 본 작업에 핵심은 위 1 개. 다른 16 개는 코드/모니터링/site 별 footer/리포트.

## 6. 아직 안 된 것

- 10 bridge 매칭 중 6건 이 운영DB 에서 안 잡힘 — **운영DB sync lag** (imweb 어드민 → supabase 3~9h 지연) 또는 thecleancoffee 운영DB 미적재 가능성. 24h 뒤 같은 query 재실행 시 더 많이 매칭될 예상.
- site_landing 의 137 row 중 결제 URL 이 아닌 105 row (landing / view 페이지) 는 본 bridge 로 매칭 불가 — order_code 가 URL 에 없음. 그건 sessionKey 기반 별도 join 필요.
- NPay 매핑 (channel_order_no) 미시도.

## 7. Track 진척률

| Track | 이전 | 현재 | Δ |
|---|---:|---:|---:|
| A Order Truth / Payment Bridge | 99 | **100** | +1 (L2 매출 join 첫 성공) |
| B Imweb Source Capture | 92 | 92 | 0 |
| C Imweb Attribution Builder | 96 | **97** | +1 (bridge 경로 확정) |
| D Dashboard Decision View | 92 | 92 | 0 |
| E Platform Exact Attribution | 45 | 45 | 0 |
| F QA / Guard / Data Guide | 98 | **99** | +1 (REPORTING_TEMPLATE 정본 직접 read 적용) |
| G Site Landing Ledger | 98 | 98 | 0 |

## 8. 검증

| 검증 | 결과 |
|---|---|
| 로컬DB read | read-only, write 0 |
| 운영DB read | read-only, write 0 |
| raw order_code 출력 | transient (script 안 join 용도, 응답 JSON 의 raw_order_code_persisted_in_output: false) |
| 매칭 row 의 raw email/phone/member_code | 출력 / logging 0 |
| 본 script execution | 1 회, 결과 JSON 1 파일 |

## 9. 다음 액션

상세 owner+점수표는 본 보고서의 채팅 응답 §6 참고. 본 문서는 산출 evidence.

산출 JSON: `data/site-landing-revenue-join-v2-bridge-success-20260511.json`
