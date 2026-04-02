# Biocom 운영 DB 점검 메모

기준일: 2026-03-27  
확인 대상: `/Users/vibetj/coding/seo/backend/.env` 에 설정된 운영 DB  
주의:
- 본 문서는 집계/스키마 수준만 기록한다.
- URL, 키, 개인정보 원문은 기록하지 않는다.
- row count 중 스키마 단위 합계는 `pg_stat_user_tables` 기반 근사치이고, 핵심 테이블은 `COUNT(*)`로 재확인했다.

## 1. 한 줄 결론

이전 가정보다 운영 DB 안에 CRM 실험 재료가 더 많다.

- 상담 원장: `tb_consultation_records` 8,305건
- 주문 원장: `tb_iamweb_users` 94,672건
- 외부 주문/물류: `tb_playauto_orders` 115,316건
- 재구매/LTR 코호트: `ltr_customer_cohort` 30,546건
- ChannelTalk 유저 스냅샷: `channeltalk_users` 2,198건

즉, `상담 데이터가 너무 적어서 CRM 1차 대상이 안 된다`는 기존 판단은 수정이 필요하다.  
다만 `CS 문의 테이블(tb_cs_*)`은 아직 1건 수준이라, 실질적인 상담/CRM 원장은 `tb_consultation_records` 쪽으로 보는 것이 맞다.

## 2. 스키마 개요

| 스키마 | 테이블 수 | 근사 row 수 | 메모 |
|---|---:|---:|---|
| `public` | 48 | 406,331 | 주문, 상담, LTR, ChannelTalk, 알림 |
| `playauto_platform` | 28 | 83,338 | 외부 주문/재고/거래/권한 |
| `analytics_engine` | 2 | 0 | 아직 비어 있음 |
| `channel_integration` | 1 | 0 | 자격증명성 테이블 존재 |

## 3. 핵심 테이블 현황

### 3-1. 상담

#### `public.tb_consultation_records`

- 총 8,305건
- 기간: `2025-04-07` ~ `2026-03-27`
- 고유 연락처: 6,885
- 고유 고객명: 5,785
- 분석 타입: 61종
- 담당자: 13명
- 상담 상태: 25종

최근 월별 건수:

| 월 | 건수 |
|---|---:|
| 2026-03 | 2,850 |
| 2026-02 | 222 |
| 2026-01 | 521 |
| 2025-12 | 409 |
| 2025-11 | 453 |
| 2025-10 | 313 |
| 2025-09 | 362 |
| 2025-08 | 368 |
| 2025-07 | 449 |
| 2025-06 | 415 |
| 2025-05 | 683 |
| 2025-04 | 1,260 |

상태 분포 상위:

| 상태 | 건수 |
|---|---:|
| 완료 | 6,939 |
| 부재 | 831 |
| 변경 | 359 |
| `nan` | 58 |
| 시간 변경 | 45 |
| 취소 | 35 |

판단:
- `완료` 비중이 매우 높고, 최근 월 데이터도 존재한다.
- `nan`, `시간 변경`, `시간변경`, `완료.` 처럼 상태 표준화가 필요하다.
- 상담 CRM 실험은 더 이상 “데이터 부족”으로 바로 배제할 단계가 아니다.

#### `public.tb_cs_inquiry` / `public.tb_cs_message`

- `tb_cs_inquiry`: 1건
- `tb_cs_message`: 1건
- 생성 시각: 2026-03-27

판단:
- 이 두 테이블은 아직 운영 이력이 거의 없다.
- 상담/후속관리 분석의 기준 테이블은 `tb_cs_*`가 아니라 `tb_consultation_records`로 잡는 편이 맞다.

### 3-2. 주문/고객

#### `public.tb_iamweb_users`

- 총 94,672행
- 고유 고객번호: 51,942
- 고유 주문번호: 76,689
- 주문일 범위: `2019-09-20 11:51:00` ~ `2026-03-27 12:01:45`
- 환불 금액이 0보다 큰 행: 2,790

`payment_status` 상위 값:

| 상태 | 건수 |
|---|---:|
| `<null>` | 42,189 |
| 거래종료 | 40,739 |
| 거래개시 | 6,087 |
| PAYMENT_COMPLETE | 5,287 |
| REFUND_COMPLETE | 257 |

판단:
- 고객/주문 식별 기반은 충분히 크다.
- 다만 `payment_status` 값이 한글/영문/null 혼재라 정규화가 필요하다.
- 결제 완료 판정은 단일 상태값 비교보다 `paid_price`, `payment_complete_time`, 환불 컬럼을 함께 보는 방식이 안전하다.

#### `public.tb_playauto_orders`

- 총 115,316행
- shop 수: 10
- 주문 상태 종류: 14
- `created_at` 범위: `2026-03-13 01:30:55` ~ `2026-03-13 07:06:33`

판단:
- 외부 주문/물류 데이터는 충분히 많다.
- 다만 현재 확인한 `created_at` 범위가 매우 짧게 보이므로, 적재 방식 또는 백필 기준을 한 번 더 확인할 필요가 있다.

### 3-3. 재구매/LTR

#### `public.ltr_customer_cohort`

- 총 30,546행
- 고유 고객번호: 30,546
- 코호트 월 수: 27
- `base_date` 범위: `2024-01-02` ~ `2026-03-26`

판단:
- 재구매 코호트는 이미 바로 활용 가능한 수준이다.
- 기존 roadmap의 “코호트는 지금 바로 구축”은 유지하되, 실제 DB 원장이 이미 있으므로 초기 구축 비용이 더 낮다.

### 3-4. ChannelTalk

#### `public.channeltalk_users`

- 총 2,198행
- 전화번호 보유: 2,198
- 이메일 보유: 2,198
- `lastSeenAt` 보유: 2,198
- `lastSeenAt` 범위: `2024-02-02T05:30:48.347Z` ~ `2025-02-12T02:06:39.532Z`
- 주요 referrer 상위:
  - `https://kauth.kakao.com/` 598
  - `https://m.search.naver.com/` 256
  - `https://litt.ly/` 198
  - `https://link.inpock.co.kr/` 185
  - `https://www.youtube.com/` 117

#### `public.tb_channeltalk_users`

- 0행

판단:
- 실제 데이터가 있는 테이블은 `tb_channeltalk_users`가 아니라 `channeltalk_users`다.
- 다만 최신 `lastSeenAt`가 2025-02-12이므로 현재는 live sync가 끊겼거나 정지된 스냅샷일 가능성이 높다.
- ChannelTalk는 “식별 보강용 자료”로는 유효하지만, 최신 운영 원장으로 바로 신뢰하기는 어렵다.

## 4. 기존 판단 대비 수정 포인트

기존에는 `상담 데이터가 얕다`고 봤는데, 운영 DB 기준으로는 아래처럼 정정해야 한다.

- 정정 1: 상담 원장 자체는 적지 않다.
  - `tb_consultation_records` 8,305건, 고유 연락처 6,885건이면 실험 세그먼트 후보군이 나온다.
- 정정 2: `tb_cs_*`는 아직 거의 비어 있다.
  - 즉 “상담 기능 데이터”와 “상담 원장 데이터”를 분리해서 봐야 한다.
- 정정 3: ChannelTalk는 데이터는 있으나 최신성이 약하다.
  - 신규 SDK/Open API 연동으로 다시 살려야 한다.
- 정정 4: 주문/고객/LTR 기반은 충분히 강하다.
  - CRM 첫 실험을 체크아웃/미구매/윈백만으로 좁게 볼 필요는 있지만,
  - 상담 후속 실험도 이제 후보군으로 재검토 가능하다.

## 5. 다음 설계에 바로 반영할 내용

1. 상담 후속 CRM을 백로그가 아니라 실험 후보군으로 다시 올린다.
2. `tb_consultation_records.consultation_status` 표준화 테이블이 필요하다.
3. `tb_iamweb_users.payment_status` 정규화 규칙이 필요하다.
4. ChannelTalk는 `channeltalk_users` 기준으로 보되, 최신 sync 복구 여부를 별도 확인한다.
5. CRM 식별키는 아래 조합이 유력하다.
   - 상담: `customer_contact`
   - 주문: `customer_number`, `customer_email`
   - ChannelTalk: `profile_mobileNumber`, `profile_email`

## 6. 메모

- `.env` 파싱 중 경고가 나는 라인이 있었지만, DB 연결 자체는 성공했다.
- 이번 점검은 읽기 전용으로 수행했고, 스키마/데이터 변경은 하지 않았다.
