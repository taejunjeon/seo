# API 체크 메모

기준일: 2026-03-27

## 1. ChannelTalk 현재 상태

- 확인 위치: `/Users/vibetj/coding/seo/backend/.env`
- 현재 확인된 키:
  - `CHANNELTALK_ACCESSKEY`
  - `CHANNELTALK_ACCESS_SECRET`
- `CHANNELTALK_PLUGIN_KEY`도 backend `.env`에 존재함.
- 아직 없는 키:
  - `CHANNELTALK_MEMBER_HASH_SECRET`
- 현재 백엔드에서 `CHANNELTALK_ACCESSKEY`도 alias로 읽도록 보완함.
- 실제 Open API `GET /open/v5/channel` 인증은 200 응답으로 확인됨.
- 실제 채널 응답 기준 `enableMemberHash=false` 상태로 확인됨.
- 표준 변수명은 앞으로 아래 형태로 맞추는 것이 안전함.
  - `CHANNELTALK_ACCESS_KEY`
  - `CHANNELTALK_ACCESS_SECRET`
  - `CHANNELTALK_PLUGIN_KEY`
  - `CHANNELTALK_MEMBER_HASH_SECRET`
  - `CHANNELTALK_MARKETING_ENABLED`

## 2. 이번에 추가한 백엔드 API

- `GET /api/channeltalk/status`
  - 현재 env 설정 상태 확인
  - access key alias 사용 여부 확인
- `GET /api/channeltalk/health`
  - ChannelTalk Open API `GET /open/v5/channel` 호출로 실제 인증 확인
  - access key/secret 누락 시 어떤 값이 부족한지 바로 반환
- `GET /api/consultation/summary`
  - 상담 원장 요약, 상태/담당자/분석유형 분포 반환
- `GET /api/consultation/managers`
  - 상담사별 상담 건수, 완료율, 주문 매칭률 반환
- `GET /api/consultation/order-match`
  - 상담 연락처와 주문/LTR 매칭률 반환
- `GET /api/consultation/product-followup`
  - 상담 후 구매 카테고리 분포와 매출 요약 반환
- `GET /api/consultation/candidates`
  - `completed_followup`, `reschedule_recall` 시나리오 후보군 preview 반환

## 3. 공식 문서 기준 추가 필요 항목

- Open API 실연동
  - `Access Key` + `Access Secret` 둘 다 필요
- 프론트 SDK boot
  - `Plugin Key` 필요
  - 한국어 UI 기준 확인 경로: `채널 설정 > 일반 설정 > 버튼 설치 및 설정 > 채널톡 버튼 설치`
  - 영어 문서의 `Manage Plug-in`은 현재 한국어 UI에서 `버튼 설치 및 설정`에 해당
- 멤버 식별 보안 부트
  - `Member Hash Secret` 필요
  - 한국어 UI 기준 확인 경로: `채널 설정 > 보안 및 개발 > 보안`
  - `User password encryption` 영역에서 `Lookup` 클릭 후 확인
- CRM 자동 발송
  - Marketing add-on 활성 여부 확인 필요

## 3-1. Member Hash 운영 판단

- 현재는 `사용하기`를 바로 누르지 않는 것이 안전함.
- 공식 문서 기준:
  - Member Hash가 활성화된 채널에서 회원 유저로 boot할 때는 `memberId`와 `memberHash`를 함께 보내야 함.
  - 해시가 없거나 잘못되면 `unauthenticated` 상태가 되고, SDK 기능이 멈출 수 있음.
  - Member Hash가 비활성화된 채널에서는 `memberHash`를 보내지 않아도 검증이 생략됨.
- 따라서 지금 단계 결론:
  - `Plugin Key`만으로 ChannelTalk SDK 연동은 가능
  - `Member Hash`는 보안 강화를 위한 옵션이지, 지금 당장 필수는 아님
  - 프로덕션에서 버튼 미노출 리스크를 피하려면, 프론트/백엔드에 `memberId/memberHash` 배포 완료 후 활성화해야 함

## 4. 상담 CRM API 구현 현황

- 구현 위치:
  - `backend/src/consultation.ts`
  - `backend/src/routes/consultation.ts`
  - `backend/src/postgres.ts`
- 런타임 전제:
  - `DATABASE_URL` 필요
  - DB 스키마 변경 없이 운영 DB read-only 조회만 사용
- 현재 구현 완료 범위:
  - 상담 상태 표준화
  - 전화번호 기준 상담-주문-LTR 매칭
  - 상담사 KPI
  - 상담 후 구매 카테고리 집계
  - CRM 후보군 preview

### 4-1. 실측 검증 결과

- `GET /api/consultation/summary?startDate=2025-12-28&endDate=2026-03-27`
  - `consultationRows=3616`
  - `distinctContacts=2987`
  - `distinctManagers=10`
- `GET /api/consultation/managers?startDate=2025-12-28&endDate=2026-03-27&limit=3`
  - `민정`: 1,580건 / 완료율 `0.842` / 주문매칭률 `0.725`
  - `경태`: 1,183건 / 완료율 `0.801` / 주문매칭률 `0.892`
  - `예진`: 368건 / 완료율 `0.932` / 주문매칭률 `0.141`
- `GET /api/consultation/product-followup?startDate=2025-12-28&endDate=2026-03-27&statusGroup=completed`
  - supplement: 고객 125명 / 주문 257건 / 매출 15,240,254원
  - other: 고객 24명 / 주문 33건 / 매출 4,446,489원
- `GET /api/consultation/candidates?scenario=completed_followup&limit=3`
  - 실제 `curl` 기준 약 `0.2s`
- `GET /api/consultation/candidates?scenario=reschedule_recall&limit=3`
  - 실제 `curl` 기준 약 `0.03s`

## 5. 다음 API 작업 우선순위

1. ChannelTalk
   - `memberId = 내부 customer_key`로 통일
   - 서버에서 `memberHash` 발급 함수 사용
   - 이후 user upsert / event track / webhook 수집으로 확장
2. Meta
   - Ads Insights read 연동
   - 그 다음 Conversions API 연결
3. 상담 CRM write-back
   - 실험군/대조군 배정 저장
   - 발송 로그 / 결과 로그 저장
4. GA4
   - 내부 실험 원장 보조용으로 유지
   - 최종 판정 원장은 내부 DB 기준 유지

## 6. 검증 메모

- 백엔드
  - `npm run typecheck` 통과
  - `npx tsx --test tests/*.test.ts` 17개 통과
- 프론트
  - `npm run build` 통과
  - `npm run lint` 실패
  - 실패 원인: 이번 ChannelTalk 작업이 아니라 기존 `AiReportTab.tsx`, `TrendSection.tsx` 등 선행 lint 에러 2건과 warning 15건
- 런타임
  - `localhost:7020/health` 정상
  - `localhost:7020/api/channeltalk/*` 정상
  - `localhost:7020/api/consultation/*` 정상
  - `localhost:7010` 프론트 정상 기동 상태

## 7. 프론트 시작 조건

- ChannelTalk v1은 이미 붙어 있으므로, 다음 Claude Code 턴은 상담 CRM 운영 화면 연결이 우선이다.
- 다음 프론트 작업 우선순위:
  - 상담 후보군 preview 테이블
  - 상담사 KPI 보드
  - 상태/분석유형/담당자 필터 UI
  - 후보군 선택 후 ChannelTalk 실행 화면 연결

## 8. 아임웹 Open API (0401 추가)

공식 문서: https://developers-docs.imweb.me/reference

자격증명 현재 상태:
- `IMWEB_API_KEY` — 확보 완료 (v1 REST API)
- `IMWEB_SECRET_KEY` — 확보 완료
- `IMWEB_CLIENT_ID/SECRET` (OAuth v2) — 미확보. 일부 API는 OAuth v2 필요
- 바이오컴 `siteCode`: `S20190715619285c855898` (확인됨)
- 더클린커피 `siteCode`: 별도 확인 필요

### 8-1. 전체 엔드포인트 목록

#### OAuth 2.0
| Method | Path | 설명 |
|--------|------|------|
| GET | `/oauth2/authorize` | 인가 코드 발급 |
| POST | `/oauth2/token` | Access Token 발급/재발급 |

#### Site-Info (사이트 정보)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/site-info` | 사이트 정보 조회 |
| GET | `/site-info/unit/{unitCode}` | 유닛 정보 조회 |
| PATCH | `/site-info/integration-complete` | 연동완료 처리 |
| PATCH | `/site-info/integration-cancellation` | 연동해제 처리 |
| PATCH | `/site-info/integration-info` | 연동정보 수정 |

#### Member-Info (회원 정보)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/member-info/members` | 회원 목록 조회 |
| GET | `/member-info/members/cursor` | 회원 목록 (커서 기반) |
| GET | `/member-info/members/{memberUid}` | 회원 상세 조회 |
| GET | `/member-info/members/{memberUid}/wish-list` | 위시리스트 |
| GET | `/member-info/members/{memberUid}/carts` | 장바구니 |
| PATCH | `/member-info/members/{memberUid}/agree-info` | 동의 정보 수정 |
| PUT | `/member-info/members/{memberUid}/groups` | 회원 그룹 변경 |
| PUT | `/member-info/members/{memberUid}/grade` | 회원 등급 변경 |
| GET | `/member-info/groups` | 회원 그룹 목록 |
| GET | `/member-info/grades` | 쇼핑 등급 목록 |

#### Community (커뮤니티)
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | `/community/qna` | Q&A 조회/답변 |
| GET/POST | `/community/review` | 구매평 조회/작성 |
| GET/PUT/DELETE | `/community/review/{reviewNo}` | 구매평 상세 |

#### Promotion (프로모션) — 쿠폰/적립금
| Method | Path | 설명 |
|--------|------|------|
| GET | `/promotion/shop-point` | 적립금 정보 |
| GET | `/promotion/shop-point-log` | 적립금 이력 |
| PUT | `/promotion/shop-point/change/member/{memberUid}` | 회원별 적립금 지급/차감 |
| **GET** | **`/promotion/shop-coupon`** | **쿠폰 목록 조회** |
| **GET** | **`/promotion/shop-coupon/{shopCouponCode}`** | **쿠폰 상세 조회** |
| **POST** | **`/promotion/shop-coupon/{couponCode}/issue`** | **쿠폰 발급** |
| **GET** | **`/promotion/shop-coupon/{shopCouponCode}/coupon-issue`** | **쿠폰별 발급 목록** |
| **GET** | **`/promotion/shop-coupon/member/{memberUid}/coupon-issue`** | **회원별 쿠폰 발급 목록** |

### 8-2. 쿠폰 API 상세 분석

**할인 쿠폰 사용 데이터 조회 가능 여부: 가능**

확인된 데이터 경로 3가지:

1. **주문 데이터에서 쿠폰 사용 금액 확인**
   - `GET /shop/orders` 응답에 포함되는 필드:
     - `itemCouponDiscount` — 상품 쿠폰 할인 금액
     - `deliveryCouponDiscount` — 배송비 쿠폰 할인
     - `totalDiscountPrice` — 총 할인 금액 (등급할인+쿠폰)
   - 즉, **어떤 주문에서 쿠폰으로 얼마를 할인받았는지** 확인 가능

2. **쿠폰별 발급 현황 조회**
   - `GET /promotion/shop-coupon/{shopCouponCode}/coupon-issue`
   - 특정 쿠폰이 **누구에게 발급되었고, 사용되었는지** 목록 조회
   - 쿠폰 타입: 지정발행, 고객다운로드, 자동발급, 코드생성

3. **회원별 쿠폰 보유/사용 현황**
   - `GET /promotion/shop-coupon/member/{memberUid}/coupon-issue`
   - 특정 회원이 **보유한 쿠폰 목록과 사용 여부** 확인
   - 회원 조회 시 `coupon` 배열에 발급된 쿠폰 코드 목록도 포함

### 8-3. 쿠폰 분석에서 할 수 있는 것

| 분석 항목 | 가능 여부 | 데이터 소스 |
|----------|----------|-----------|
| 쿠폰별 발급 수 | 가능 | `shop-coupon/{code}/coupon-issue` |
| 쿠폰별 사용 수 / 사용률 | 가능 | 발급 목록에서 사용 여부 필터 |
| 주문별 쿠폰 할인 금액 | 가능 | 주문 API `itemCouponDiscount` |
| 회원별 쿠폰 보유/사용 이력 | 가능 | `shop-coupon/member/{uid}/coupon-issue` |
| 쿠폰 생성/관리 | 가능 | `shop-coupon` POST (v2 OAuth 필요할 수 있음) |
| 쿠폰 발급 (특정 회원에게) | 가능 | `shop-coupon/{code}/issue` POST |
| 쿠폰 사용이 재구매로 이어졌는지 | 가능 | 쿠폰 사용 주문 + 동일 고객 후속 주문 조인 |

## 9. 참고 문서

- Channel Developers Introduction: https://developers.channel.io/en/categories/Introduction-a04bb274
- Get a Channel: https://developers.channel.io/docs/get-a-channel-1
- Marketing Campaigns: https://docs.channel.io/help/en/articles/Marketing-Campaigns--9064c609
- 아임웹 Open API: https://developers-docs.imweb.me/reference
