# gptprofeedback_0327_2 반영 결과

기준일: 2026-03-27

## 1. 이번 피드백에서 핵심으로 반영한 내용

이번 피드백의 핵심은 아래 4가지로 정리했다.

1. Kakao보다 먼저 **ChannelTalk를 v1 실행 레이어**로 둔다.
2. **내부 DB가 source of truth**이고, ChannelTalk는 실행/운영 채널로만 쓴다.
3. 첫 라이브 실험은 `체크아웃 이탈`, `상품조회 후 미구매`, `윈백` 시나리오로 간다.
4. **재구매 코호트는 지금 바로 내부 주문 데이터만으로 병행 구축**한다.

즉, 방향은 `customer_key -> CRM 실험 원장 -> incremental gross profit / iROAS` 유지, 실행 레이어만 `ChannelTalk 우선`으로 재정렬했다.

## 2. 로드맵 업데이트 내용

수정 파일:
- `/Users/vibetj/coding/seo/roadmap0327.md`

반영 내용:
- ChannelTalk를 Kakao보다 앞선 1차 실행 레이어로 명시
- `실행은 ChannelTalk / 판정은 내부 DB` 원칙 추가
- `Phase 1.5. ChannelTalk identity/event sync` 추가
- `Phase 5.5. 재구매 코호트 병행 고도화` 추가
- Kakao는 2차 확장 채널로 재정리
- ChannelTalk 공식 문서 링크를 참고 문서에 추가

## 3. 실제 백엔드 구현 내용

이번 턴은 **DB 스키마를 바로 늘리기보다**, 즉시 가치가 나는 백엔드 골격과 조회 API를 먼저 열었다.

### 3-1. ChannelTalk 설정값 추가

수정 파일:
- `/Users/vibetj/coding/revenue/backend/app/core/settings.py`
- `/Users/vibetj/coding/revenue/backend/.env.example`

추가 env:
- `CHANNELTALK_PLUGIN_KEY`
- `CHANNELTALK_ACCESS_KEY`
- `CHANNELTALK_ACCESS_SECRET`
- `CHANNELTALK_MEMBER_HASH_SECRET`
- `CHANNELTALK_MARKETING_ENABLED`

### 3-2. ChannelTalk 실행 레이어 유틸 추가

신규 파일:
- `/Users/vibetj/coding/revenue/backend/app/services/channeltalk_service.py`

구현 내용:
- `memberId` 정규화
- Member Hash(HMAC-SHA256) 생성 헬퍼
- ChannelTalk user profile payload 생성
- ChannelTalk event payload 생성
- 현재 설정 상태와 이벤트 카탈로그 반환

현재 이벤트 카탈로그:
- `product_view`
- `add_to_cart`
- `checkout_started`
- `checkout_abandoned`
- `order_paid`
- `refund_completed`
- `repeat_purchase`

### 3-3. 내부 주문 기반 재구매 코호트 API 추가

신규 파일:
- `/Users/vibetj/coding/revenue/backend/app/services/crm_cohort_service.py`
- `/Users/vibetj/coding/revenue/backend/app/api/crm.py`

라우터 등록:
- `/Users/vibetj/coding/revenue/backend/app/main.py`

신규 API:

1. `GET /api/crm/channeltalk/status`
- ChannelTalk 설정 여부
- Marketing 활성 여부
- `tb_channeltalk_users` 스냅샷 요약
- 이벤트 카탈로그

2. `GET /api/crm/repeat-purchase-cohorts`
- 첫 구매 월 기준 코호트
- `M+0 ~ M+N` 구매율 / 재구매율
- 구매 고객 수 / 재구매 고객 수
- 주문 수
- 취소/반품 제외 `final_order_amount` 합계
- 재구매 매출 합계

기본 파라미터:
- `start_month`: 기본 최근 6개월 시작월
- `end_month`: 기본 현재월
- `max_offset`: 기본 6, 최대 12

## 4. 왜 이 구현부터 했는가

이번 턴에는 아래 원칙으로 범위를 잡았다.

- 바로 운영 가능한 백엔드부터 연다
- API 키 없이도 넣을 수 있는 것부터 넣는다
- 프론트 의존성이 큰 ChannelTalk SDK 삽입은 Claude Code가 맡게 한다
- 스키마 추가/실발송보다 먼저 조회/측정 골격을 연다

즉, 이번 턴 산출물은:

- ChannelTalk 실행 준비용 백엔드 골격
- 재구매 코호트 백엔드 API
- 업데이트된 로드맵

이다.

## 5. 검증 결과

실행한 검증:

1. `py_compile`
- 대상:
  - `app/core/settings.py`
  - `app/services/channeltalk_service.py`
  - `app/services/crm_cohort_service.py`
  - `app/api/crm.py`
  - `app/main.py`
- 결과: 성공

2. ChannelTalk 헬퍼 import 스모크
- 더미 env 주입 후 `normalize_member_id`, `build_track_payload`, `get_channeltalk_status()` 확인
- 결과: 성공

주의:
- 실제 API 호출/DB 질의 스모크는 아직 안 했다
- 이유: ChannelTalk 실키 미제공, 실제 backend dev DB/인증 컨텍스트로 서버를 올리지는 않음

## 6. 프론트 시작 필요 여부

**여기부터는 Claude Code 시작 필요**

이유:
- ChannelTalk를 실제 실행 레이어로 쓰려면 프론트에서 SDK boot 수정이 필수
- 필요한 작업:
  - `memberId/memberHash` 연결
  - `setPage` 명시
  - `track(product_view/add_to_cart/checkout_started/checkout_abandoned/order_paid)` 삽입
  - 체크아웃/랜딩/구매완료 구간 이벤트 연결

백엔드만으로는 실험 루프가 닫히지 않는다.

## 7. 다음 턴에 바로 필요한 자료

다음 5개를 받으면 ChannelTalk/Meta를 더 구체화할 수 있다.

1. ChannelTalk Marketing add-on 활성 여부
2. 현재 프론트 SDK boot에서 `memberId`/`memberHash`를 이미 쓰는지 여부
3. 체크아웃 이벤트를 프론트에서 잡는지, 서버 주문 완료 기준으로 잡는지
4. ChannelTalk plugin/access key 제공 가능 여부
5. Meta Ads Insights / Conversions API 자격증명 제공 가능 여부

## 8. 다음 우선순위 제안

다음 작업 순서는 이게 맞다.

1. Claude Code로 ChannelTalk SDK 삽입/수정
2. Codex가 `customer_key` 생성 규칙과 ChannelTalk user upsert API 연결
3. 재구매 코호트 API를 실제 프론트 화면에 연결
4. Meta 비용 ingest API 추가
5. 첫 ChannelTalk Campaign 실험 실행

