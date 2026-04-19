# 카카오 비즈니스 CRM / 친구톡 API 연동 검토 보고서

작성일: 2026-04-19 (1.0 초안)
업데이트: 2026-04-19 (1.1 — Phase 1 구현 완료 + Kakao i Connect Message 상세 추가)
업데이트: 2026-04-20 (1.2 — §9 파트너센터 발송결과 API 조회 가능성 재검증)
대상: 더클린커피 CRM 솔루션과 카카오 비즈니스 파트너센터 CRM 연동 가능성 검토
레퍼런스 공지: https://lounge-board.kakao.com/bulletin/32860 (본문은 JS 렌더링이라 직접 스크래이프 실패. 공식 API 문서 기반으로 정리)

---

## 결론 요약

1. **카카오 파트너센터에서 직접 보낸 "CRM 할인쿠폰"의 발송결과를 API로 우리 솔루션에 가져오는 공식 경로는 없소.**
   - 파트너센터 UI로 보낸 친구톡의 성과는 **파트너센터 통계 화면**에서만 확인 가능.
   - 단, "Kakao i Connect Message" 엔터프라이즈 계약을 하면 `bizmsg-web.kakaoenterprise.com` API로 발송결과를 **우리가 직접 발송**한 건에 한해 조회 가능.
2. **고객파일 업로드 API는 공식 지원됨.** 두 가지 경로 — (A) 카카오톡 채널 고객파일 API, (B) 카카오모먼트 고객파일 API. 용도가 다름.
3. **sample.csv 포맷은 카카오톡 채널 고객파일 업로드 스키마와 정확히 일치.** `앱유저아이디, 생년월일, 국가, 지역, 성별, 연령, 구매금액, 포인트, 가입일, 최근 구매일, 응모일`이 기본 제공 String 키이며, 업로드 후 파트너센터에서 "조건별 친구그룹"을 만들어 타겟팅 친구톡 발송 가능.
4. **현 솔루션 연동 권장 방향** — 1단계: 고객파일 API로 파트너센터에 세그먼트 업로드 → 파트너센터에서 CRM 발송. 2단계(선택): Kakao i Connect Message 계약해서 발송·결과조회 전체를 API화.

---

## 1. 카카오 비즈니스 메시지 발송 경로 전체 그림

세 가지 경로가 있고, 각각 별개 시스템이오.

| 경로 | 사용자 접근 방식 | API 연동 | 용도 |
|---|---|---|---|
| **A. 파트너센터 CRM (웹 UI)** | business.kakao.com에서 GUI로 발송 | ❌ 발송 자체 API 없음. 고객파일 업로드 API만 있음 | 마케터가 직접 발송 |
| **B. Kakao i Connect Message API** | bizmsg-web.kakaoenterprise.com 엔터프라이즈 API | ✅ 발송·결과조회·Push/Polling 완전 지원 | 시스템 자동 발송 |
| **C. 대행사 API (알리고, 팝빌 등)** | 중계 서비스 API | ✅ 대행사 문서 따름 | B2B 중계 |

우리 솔루션은 이미 **알리고(aligo)**를 경로 C로 사용 중이오 (`backend/src/aligoSends.jsonl`). 이번 검토는 경로 A·B에 관한 것임.

---

## 2. 경로 A: 파트너센터 CRM 메시지 (사용자가 보낸 "할인쿠폰 CRM")

### 발송결과 조회 API — ❌ 공식 경로 없음
- 파트너센터 UI에서 직접 보낸 친구톡·알림톡의 발송결과(성공/실패·오픈·클릭)는 **파트너센터 대시보드에서만 조회**.
- Kakao Developers 공식 문서에도 "파트너센터 발송 이력 조회 API"는 존재하지 않음.
- 발송결과를 외부 시스템으로 빼려면 현 시점 유일한 방법은:
  - 파트너센터 화면에서 CSV 다운로드 → 우리 솔루션으로 수동 import
  - 자동화 원하면 경로 B(엔터프라이즈 API)로 전환해 우리가 직접 발송·조회

### 고객파일 업로드 API — ✅ 공식 지원
카카오톡 채널 REST API의 **Target User File** 엔드포인트 사용. Kakao Developers 앱과 카카오톡 채널을 연결해야 함.

#### 엔드포인트

| 기능 | 메서드 | URL | 인증 |
|---|---|---|---|
| 고객파일 생성 | POST | `https://kapi.kakao.com/v1/talkchannel/create/target_user_file` | 어드민 키 또는 REST API 키 |
| 목록 조회 | GET | `https://kapi.kakao.com/v1/talkchannel/target_user_file` | 동일 |
| 사용자 추가 | POST | `https://kapi.kakao.com/v1/talkchannel/update/target_users` | 동일 |
| 사용자 삭제 | POST | `https://kapi.kakao.com/v1/talkchannel/delete/target_users` | 동일 |
| 채널 친구 여부 조회 | GET | `https://kapi.kakao.com/v2/api/talk/channels/multi` | Service App Admin Key |

필수 파라미터:
- `channel_public_id`: 카카오톡 채널 공개 ID (예: `@thecleancoffee`)
- `file_name`: 고객파일 이름
- `schema`: 고객 속성 스키마 정의

#### 스키마: sample.csv와 완벽 일치

`devtalk.kakao.com/t/api/127233` 공식 답변 기준, **기본 제공 String 키**는 다음으로 제한됨:

```
생년월일, 국가, 지역, 성별, 연령, 구매금액, 포인트, 가입일, 최근 구매일, 응모일
```

사용자가 공유한 `sample.csv`의 헤더:
```
앱유저아이디, 이름, 생년월일, 지역, 성별, 연령, 구매금액, 포인트, 멤버십등급, 가입일, 최근구매일, 응모일
```

매핑 분석:
- `앱유저아이디` — **예약 필드(id)**. 스키마에 포함 ❌, 사용자 추가 시 `id` 파라미터 또는 파일 첫 열에서 사용.
- `이름` — 기본 제공 키가 아님 (비공식 custom 필드).
- `생년월일, 지역, 성별, 연령, 구매금액, 포인트, 가입일, 최근구매일, 응모일` — ✅ **기본 제공 String 키와 1:1 매칭**
- `멤버십등급` — ⚠️ 기본 제공 키 아님. 사용자 정의 필드는 **숫자만** 가능 → String으로 업로드 불가능. 제거하거나 숫자로 인코딩 필요.

#### 제약사항
- 사용자 정의 필드는 숫자만 지원
- 스키마에 등록되지 않은 필드는 친구그룹 목록 필터링에 사용 불가
- 유효한 고객이 1명도 없으면 스키마가 빈 객체(`{}`)로 반환됨
- 모든 API 호출은 **서버 사이드**에서만 (클라이언트 직접 호출 금지)

---

## 3. 경로 B: Kakao i Connect Message (엔터프라이즈) ★ 상세

### 3.1 서비스 정체

**Kakao i Connect Message**(공식 서비스명 "BizMessage")는 **카카오엔터프라이즈**의 자회사 **(주)디케이테크인**이 운영하는 기업 메시지 통합 발송 플랫폼이오.

- 공식 문서: https://docs.kakaoi.ai/kakao_i_connect_message/
- 서비스 소개: https://dktechin.com/service/kakaoiconnectmsg
- 상담 신청: https://dktechin.com/inquiry/consultinquiry

한 개의 API/Agent로 **6~7종 메시지 채널**을 통합 발송:

| 채널 | 타입 코드 | 용도 | 수신자 조건 |
|---|---|---|---|
| 알림톡 | `AT`, `AI`(이미지) | 정보성 (주문·결제·배송) | 친구 아닌 사용자도 가능 |
| 친구톡 | `FT`, `FI`(이미지), `FW`(와이드) | 정보성/광고성 | **채널 친구 추가자만** |
| 브랜드 메시지 | — | 프로필 표시된 광고성 | — |
| SMS/LMS/MMS (`XMS`) | — | 알림톡 실패 시 fallback 가능 | 무제한 |
| RCS (SMS/LMS/MMS/템플릿) | — | iOS/Android 통합 리치 메시지 | RCS 지원 단말 |
| 네이버톡톡 | — | 네이버 고객 | — |

**핵심 차별점**: "저렴한 우선발송" — 알림톡 → RCS → SMS 자동 fallback 순차 발송 설정 가능. 발송 성공률·비용 동시 최적화.

### 3.2 API 구조

#### 호스트
| 환경 | URL |
|---|---|
| 운영 | `bizmsg-web.kakaoenterprise.com` |
| 스테이징 | `stg-user.bizmsg.kakaoenterprise.com` |
| 금융권/공공 | 별도 분리 호스트 |

#### 인증 — OAuth 2.0
1. `ClientID` + `ClientSecret` 발급 (계약 시)
2. `POST /v2/oauth/token` 으로 Bearer 토큰 획득
3. 모든 요청에 `Authorization: Bearer {token}` 헤더

#### 주요 엔드포인트

| 기능 | 메서드 | URL |
|---|---|---|
| 친구톡/알림톡 발송 | POST | `/v2/send/kakao` |
| 발송 결과 조회 (Polling) | GET | `/v2/info/message/results` |
| 결과 수신 완료 처리 | PUT | `/v2/info/message/results/complete/{report_group_no}` |
| 리스트 조회 | POST | `/v2/info/message/search` |
| 상세 조회 | GET | `/v2/info/message/search/detail/{uid}` |
| 친구톡 발송리스트 상세 | POST | `/v2/info/ft/search/detail/{uid}` |
| 친구톡 이미지 업로드 | POST | `/v2/upload/ft/image`, `/v2/upload/ft/wide/image` |

### 3.3 Push vs Polling 발송 방식

계약 시 둘 중 하나를 선택 (혼합 가능).

| 비교 항목 | Push | Polling |
|---|---|---|
| 결과 전달 | 발송 응답 body 에 즉시 포함 | 별도 조회 API (`/v2/info/message/results`) 호출 |
| 실시간성 | ★★★★ (초 단위) | ★★ (분 단위 대기) |
| 발송 성공률 | 낮음 (실패 빠르게 반환) | 높음 (서버가 재시도·최적 경로 선택) |
| 구현 복잡도 | 단순 (동기) | 폴링 루프 필요 (비동기) |
| 권장 용도 | 거래 결제알림 등 실시간 중요 | 마케팅 대량발송 (CRM) |

### 3.4 상태 코드 3단계

- `status_code`: API 호출 성공/실패 (예: `API_200`, `API_510`)
- `kko_status_code`: 카카오 측 처리 결과 (MESSAGE_OK, DISABLED_CHANNEL, TEMPLATE_MISMATCH 등)
- `sms_status_code`: 대체발송(SMS) 처리 결과 (통신사 코드)

상세 코드표는 공식 "API 메시지 상태 코드" 문서에서만 제공 — 계약 후 개발자 포털에서 접근 가능.

### 3.5 메시지 스펙 (2026-04 기준)

| 타입 | 본문 최대 | 이미지 | 특이사항 |
|---|---|---|---|
| 알림톡 `AT` | 1,000자 | 없음 | 템플릿 사전 등록·검수 필수 |
| 알림톡 `AI` | 1,000자 | 1:1 또는 2:1 | 이미지 포함 템플릿 검수 |
| 친구톡 `FT` | 1,000자 | 없음 | 수신 친구 제한 |
| 친구톡 `FI` | 1,000자 | 1:1 500x500~2500x2500 | 이미지 별도 업로드 API |
| 친구톡 `FW` | 76자 + 이미지 | 와이드 750x1125 | 배너형 광고 |
| XMS | SMS 90자 / LMS 2,000자 | MMS 지원 | 대체발송 용도 |
| RCS | 다양 | 템플릿 다양 | RCS Biz Center 별도 검수 |

### 3.6 온보딩 프로세스 (5단계)

1. **서비스 상담** — (주)디케이테크인 영업팀 상담 신청
2. **서비스 계약** — Agent 설치형 또는 API 직연동 선택, 월 최소발송량·단가 협상
3. **카카오 채널 생성** — 비즈니스 채널 인증 + BizMessage 연결
4. **Agent/API 연동 정보 획득** — ClientID/ClientSecret, 발신프로필 키(`sender_key`) 수령
5. **템플릿 등록** — 알림톡은 [Kakao Biz Message](https://bizmsg-web.kakaoenterprise.com/user), RCS는 [RCS Biz Center](https://www.rcsbizcenter.com/main) 에 템플릿 사전 등록 및 검수 통과

**템플릿 검수 기간**: 공식 기재 없음. 시장 관행상 1~3영업일.

### 3.7 단가 및 과금

**공식 문서 단가 미공개.** 계약 조건·월 발송량에 따라 협상. 시장 관행 참고치 (2025~2026 기준, 부가세 별도):

| 메시지 | 딜러사 리셀러 단가(추정) | Kakao i Connect 직접 계약(추정) |
|---|---|---|
| 알림톡 | 7~10원 / 건 | 6~8원 / 건 |
| 친구톡 | 10~15원 / 건 | 9~13원 / 건 |
| 친구톡 이미지 | 13~20원 / 건 | 12~18원 / 건 |
| SMS 대체발송 | 15원 / 건 | 15원 / 건 |
| LMS | 45원 / 건 | 45원 / 건 |

※ 단가는 영업 협상 결과이며, 공식 수치가 아니오. 알리고/솔라피/뿌리오 같은 딜러사 단가표에서 역산한 시장 관행치.

**과금 방식**: 후불 월정산이 일반적. 최소 월사용료(예: 5만원~) 또는 선충전 크레딧 방식도 있음.

### 3.8 계약 방식 두 가지

| 구분 | 직접 계약 | 공식 딜러사 경유 |
|---|---|---|
| 계약 주체 | (주)디케이테크인 | 카카오 공식 파트너사 (알리고·솔라피·뿌리오·팝빌 등) |
| 진입 장벽 | 높음 (월 발송량 요건·심사) | 낮음 (자체 가입 후 바로 사용) |
| 단가 | 낮음 | 딜러 마진 포함 |
| 추가 서비스 | 없음 | 대시보드·템플릿 관리 UI·SMS 혼합발송 등 |
| 현재 당사 | — | **알리고 사용 중** (`aligoSends.jsonl`) |

### 3.9 현 솔루션에서 직접 계약 권장 여부

- 월 1만건 이상 지속 발송하거나, Kakao 공식 기능(웹훅·리치 미디어·예약)이 필요하면 직접 계약 유리
- 월 1,000~수천 건 범위면 알리고 등 딜러사 유지가 비용·운영 부담 모두 낮음
- 현재 더클린커피 볼륨(재구매 월 1~2회 × 수백명)은 **딜러사 유지 권장**. Kakao i Connect 직접 계약은 Phase 2로 미뤄두오.

---

## 4. 경로 A 부록: 카카오모먼트 고객파일 API (별개)

**오해 주의** — 카카오모먼트는 **광고 타겟팅용** 고객파일이오. CRM 메시지 발송이 아님.

| 기능 | 메서드 | URL |
|---|---|---|
| 목록 조회 | GET | `https://apis.moment.kakao.com/openapi/v4/customerFiles` |
| 파일 등록 | POST | `https://apis.moment.kakao.com/openapi/v4/customerFiles` |
| URL 등록 | POST | `https://apis.moment.kakao.com/openapi/v4/customerFiles/url` |
| 단일/다중 삭제 | DELETE | `/openapi/v4/customerFiles/{ID}`, `/openapi/v4/customerFiles` |
| 사용 현황 | GET | `/openapi/v4/customerFiles/usages/{ID}` |

- 인증: `Authorization: Bearer ${BUSINESS_ACCESS_TOKEN}` + 헤더 `adAccountId`
- 파일: CSV 전용. 최대 10개, 총 200MB 이하
- URL 등록: 용량 제한 없음, 일 1회 자동 갱신(90일 유효)
- 계정당 최대 50개 고객파일
- 식별자: ADID 중심 (광고 타겟팅용)
- 상태 플로우: `WAITING → COMPLETE → (MODIFYING) → COMPLETE`. 등록 후 최대 6시간 내 모수 추출.

**현 과제(CRM 발송)에는 부적합** — 경로 A의 "카카오톡 채널 Target User File"이 정답.

---

## 5. Webhook/Callback

- 카카오톡 채널은 **웹훅 등록 가능**: https://developers.kakao.com/docs/latest/ko/kakaotalk-channel/callback
- 카카오톡 채널을 비즈니스 채널로 전환 + 앱 연결 후 사용 가능
- 웹훅 응답은 HTTP 2XX로 3초 이내 필수
- 단, **친구톡/알림톡 발송결과 전용 웹훅**은 경로 A에는 없음. 경로 B(Kakao i Connect Message)에서 발송한 건에 한해 결과 조회 API/콜백 사용 가능.

---

## 6. 현 솔루션 연동 권장 단계

### Phase 1 — 고객파일 업로드 자동화 ✅ 구현 완료 (2026-04-19)

우리 솔루션의 고객그룹을 카카오톡 채널 파트너센터 고객파일로 API 업로드. **파트너센터 설정만 마치면 바로 사용 가능**.

#### 구현 내역

- **신규 모듈**: `backend/src/kakaoChannelCustomerFile.ts`
  - `uploadGroupToKakaoChannel(groupId, site, fileName)` — 그룹 → 카카오 고객파일 변환·업로드 orchestrator
  - `createTargetUserFile()` — `POST https://kapi.kakao.com/v1/talkchannel/create/target_user_file`
  - `updateTargetUsers()` — `POST https://kapi.kakao.com/v1/talkchannel/update/target_users` (500명 단위 chunked 업로드)
  - 전화번호는 국제 포맷(82XXX)으로 자동 변환, `user_type="phone"` 사용
- **신규 라우트**: `POST /api/crm-local/groups/:id/kakao-upload`
  - 요청 body: `{ site: "thecleancoffee", fileName?: string }`
  - 응답: `{ ok, fileId, totalUsers, addedUsers, schema }`
- **env 추가** (`backend/src/env.ts`)
  - `KAKAO_ADMIN_KEY_COFFEE` — 더클린커피 앱 Admin Key
  - `KAKAO_CHANNEL_PUBLIC_ID_COFFEE` — `@thecleancoffee` (채널 공개 ID)
  - `KAKAO_CHANNEL_PUBLIC_ID_BIOCOM` — biocom 확장 대비
  - 기존 `KAKAO_ADMIN_KEY`는 biocom 기본키로 재사용
- **프론트엔드** (`frontend/src/app/crm/CustomerGroupsTab.tsx`)
  - 그룹 목록 row: `[발송] [엑셀] [카카오] [삭제]` — `[카카오]` 신규 주황색 버튼
  - 선택된 그룹 상세 패널: `💬 카카오 파트너센터 업로드 (N명)` 대형 버튼
  - 업로드 성공 시 `fileId`·등록 수 alert 표시, 실패 시 stage별 에러 메시지 노출

#### 스키마 매핑 (sample.csv → 카카오 고객파일)

| sample.csv 헤더 | 카카오 기본 키 | 타입 |
|---|---|---|
| 앱유저아이디 | (예약 필드, id로 사용) | — |
| 이름 | (매핑 없음, 카카오 기본키 아님) | — |
| 생년월일 | 생년월일 | string |
| 지역 | 지역 | string |
| 성별 | 성별 | string |
| 연령 | 연령 | string |
| 구매금액 | 구매금액 | string |
| 포인트 | 포인트 | string |
| 멤버십등급 | ❌ 전송 안함 (기본키 아님, 사용자정의는 숫자만) | — |
| 가입일 | 가입일 | string |
| 최근구매일 | 최근 구매일 (공백 포함) | string |
| 응모일 | 응모일 | string |

#### 검증 결과

- `tsc --noEmit` 통과 (backend/frontend 모두).
- 실제 호출 smoke test 성공 (2026-04-19):
  - 대상 그룹: `grp-1776590568375` (SMS 30-180일, 165명)
  - 응답: `{ok:true, fileId:99503, addedUsers:165/165}`
  - 파트너센터에 고객파일 ID `99503` 생성 확인됨
- 트러블슈팅 히스토리:
  1. `TALK_CHANNEL service property disabled` → Kakao Developers 콘솔 [앱 설정 → 카카오톡 채널] 활성화
  2. `ip mismatched` → 앱 [앱 설정 → 플랫폼 → 서버 IP] 에 허용 IP 추가
  3. `고객관리 정책 동의` 필요 → 콘솔 안내 따라 동의
  4. `INVALID_PARAMETER` → 요청 `Content-Type`이 `application/x-www-form-urlencoded` 여서 거부됨. **`application/json` 으로 수정**하여 해결. 공식 문서 spec 준수 필요.
  5. HTTP 200인데 **등록수 0명** → `update/target_users` 요청의 사용자 필드명이 `field_data`였는데 공식 스펙은 **`field`**. 필드명만 바꾸니 `{"request_count":165,"success_count":165}` 응답. 이름이 잘못되면 카카오는 조용히 무시하고 등록수만 0이 됨.
- 공식 스펙 확정 사항:
  - `Authorization: KakaoAK {admin_key}`, `Content-Type: application/json`
  - `create/target_user_file` body: `{channel_public_id, file_name, schema}` — schema 값은 소문자 `"string"` | `"number"`, 최대 30개 항목
  - `update/target_users` body: `{file_id, channel_public_id, user_type, users[]}` — 한번에 최대 2,000명
  - `user_type`: `"app"` (앱 회원번호) 또는 `"phone"` (카카오톡 전화번호)
  - users[i]: `{id, field}` — **`field_data` 아님**. field 값은 String/Number만 허용
  - 응답: `{file_id, request_count, success_count}`
  - **전제**: 카카오톡 채널과 친구 상태인 사용자만 실제 등록됨. 친구 아닌 번호는 `success_count`에서 제외될 수 있음

#### 파트너센터에서 할 일 (수동 선행)

1. [Kakao Developers](https://developers.kakao.com/) 로그인 → 더클린커피 앱 생성 또는 기존 앱 선택
2. **앱 설정 > 카카오톡 채널** 에서 `@thecleancoffee` 채널 연결
3. **앱 키** 탭에서 **Admin 키** 복사
4. 백엔드 `.env`에 다음 2줄 추가:
   ```
   KAKAO_ADMIN_KEY_COFFEE=...여기에 Admin Key...
   KAKAO_CHANNEL_PUBLIC_ID_COFFEE=@thecleancoffee
   ```
5. tsx watch가 자동 재시작. 프론트엔드 그룹 탭에서 `💬 카카오 파트너센터 업로드` 클릭
6. 업로드 후 [파트너센터](https://us.business.kakao.com/) > **친구그룹 관리** 에서 조건 필터로 세그먼트 생성 → CRM 발송

#### 이점·한계

**이점**:
- 현 세그먼트 빌더(재구매·동의여부·구매금액 조건) 결과를 **파트너센터에서 바로 타겟팅 발송** 가능
- 고객파일 중복 업로드 자동화 (기존은 매번 CSV 다운로드·수동 업로드)
- 발송 비용이 정기 알리고 SMS 대비 절반 (알림톡 단가 우위)

**한계**:
- **발송 자체는 여전히 파트너센터 UI**. 우리 솔루션에서 "발송 버튼"으로 알림톡/친구톡 자동 발송은 못함
- **발송 결과를 API로 못 가져옴**. 전환 분석 자동화 불가, 파트너센터에서 수동 CSV 다운로드 필요
- 이 두 한계가 아쉬우면 Phase 2(직접 계약 또는 딜러사 고도화 연동) 필요

### Phase 2 — 발송·결과조회 완전 API화 (선택, Phase 1 검증 후 재평가)

세 가지 옵션:

1. **Kakao i Connect Message 직접 계약** (경로 B)
   - (주)디케이테크인과 계약, ClientID/Secret 발급 → 백엔드에서 `POST /v2/send/kakao` 직접 호출
   - 월 1만건 이상 지속 발송하는 시점부터 단가 우위
2. **알리고 API 확장 연동** (경로 C 고도화)
   - 이미 사용 중. 발송 결과 콜백은 이미 받고 있으므로, 알리고 쪽 발송 로그를 우리 솔루션에 연결만 하면 됨
   - 가장 빠른 경로. 단, 알리고 단가는 딜러 마진 포함이라 볼륨 커질수록 불리
3. **Kakao i Connect Message Agent 설치형**
   - 서버에 Agent 설치. API보다 설정 복잡. 월 발송량 많고 다양한 채널(RCS 포함) 쓸 때 적합

**추천 순서**: Phase 1 검증 → 3개월 운영 → 월 볼륨 1만건 초과 시 옵션 2 또는 1 검토.

---

## 7. 참고 문서

### 카카오 공식 API 문서
- [카카오톡 채널 REST API (고객파일·친구 조회)](https://developers.kakao.com/docs/latest/ko/kakaotalk-channel/rest-api)
- [카카오톡 채널 웹훅](https://developers.kakao.com/docs/latest/ko/kakaotalk-channel/callback)
- [카카오 Developers 웹훅 공통](https://developers.kakao.com/docs/latest/ko/getting-started/callback)
- [카카오모먼트 고객파일 관리](https://developers.kakao.com/docs/latest/ko/kakaomoment/customer-files)

### Kakao i Connect Message (비즈메시지, (주)디케이테크인 운영)
- [서비스 소개 (디케이테크인)](https://dktechin.com/service/kakaoiconnectmsg)
- [상담 신청 (디케이테크인)](https://dktechin.com/inquiry/consultinquiry)
- [전체 문서 홈](https://docs.kakaoi.ai/kakao_i_connect_message/)
- [API 레퍼런스 전체](https://docs.kakaoi.ai/kakao_i_connect_message/bizmessage/api/api_reference/)
- [친구톡 발송 API](https://docs.kakaoi.ai/kakao_i_connect_message/bizmessage/api/api_reference/ft/)
- [알림톡 발송 API](https://docs.kakaoi.ai/kakao_i_connect_message/bizmessage/api/api_reference/at/)
- [메시지 타입별 스펙 가이드](https://docs.kakaoi.ai/kakao_i_connect_message/bizmessage/common_guide/)
- [Kakao Biz Message (템플릿 등록)](https://bizmsg-web.kakaoenterprise.com/user)
- [RCS Biz Center](https://www.rcsbizcenter.com/main)

### 파트너센터·가이드
- [카카오 비즈니스 파트너센터](https://us.business.kakao.com/)
- [카카오비즈니스 가이드](https://kakaobusiness.gitbook.io/main)
- [알림톡 가이드](https://kakaobusiness.gitbook.io/main/ad/infotalk)

### 커뮤니티 Q&A (실사용 한계)
- [고객파일 API 제약사항 질의응답](https://devtalk.kakao.com/t/api/127233) — String 기본키 한계, 사용자 정의 필드 숫자만 등의 실사용 정보
- [친구톡 수신상태 확인 API 문의](https://devtalk.kakao.com/t/api/124135)
- [카카오톡 메시지 웹훅 문의](https://devtalk.kakao.com/t/topic/128790)

### 공지
- [원본 공지(레퍼런스)](https://lounge-board.kakao.com/bulletin/32860) — 본문 스크래이프 불가(JS 렌더링)
- [카카오비즈니스 파트너센터 통합 개편](https://www.kakaocorp.com/page/detail/11840) (2025-12-08)

---

## 8. 체크리스트

### Phase 1 — 구현 상태

- [x] Kakao Channel Customer File API 클라이언트 모듈 작성 (`kakaoChannelCustomerFile.ts`)
- [x] 백엔드 라우트 `POST /api/crm-local/groups/:id/kakao-upload`
- [x] 환경변수 `KAKAO_ADMIN_KEY_COFFEE`, `KAKAO_CHANNEL_PUBLIC_ID_COFFEE` 추가 (env schema)
- [x] 스키마 매핑 (sample.csv → 카카오 기본 String 키 9개)
- [x] 500명 chunked 업로드 (batch 한도 미명시 대비 안전장치)
- [x] 프론트엔드 카카오 업로드 버튼 (그룹 행 + 상세 패널)
- [x] 타입체크(backend/frontend 모두 통과), 엔드포인트 smoke test

### 사용자 액션 (파트너센터 설정)

- [ ] Kakao Developers 앱 생성 (더클린커피 전용) 또는 기존 biocom 앱 재사용 확정
- [ ] 앱 > 카카오톡 채널 > `@thecleancoffee` 연결
- [ ] **Admin 키** 복사 → `.env`에 `KAKAO_ADMIN_KEY_COFFEE=...` 추가
- [ ] **채널 공개 ID** → `.env`에 `KAKAO_CHANNEL_PUBLIC_ID_COFFEE=@thecleancoffee` 추가
- [ ] tsx watch 재시작 대기 → 프론트엔드에서 `💬 카카오 파트너센터 업로드` 버튼 클릭
- [ ] [파트너센터](https://us.business.kakao.com/) > 친구그룹 관리에서 업로드된 파일 확인 → 친구그룹 생성 → CRM 발송 테스트

### Phase 2 — 재평가 시점 (3개월 운영 후)

- [ ] 월 발송량·전환율 통계 확보
- [ ] 월 1만건 초과 시 Kakao i Connect 직접 계약 견적 요청 (dktechin.com/inquiry/consultinquiry)
- [ ] 발송결과 API 자동화 필요성 평가 (전환 분석 지연이 운영 병목인지)
- [ ] 옵션: 알리고 콜백 연동 고도화 vs Kakao i Connect 직접 계약 vs Agent 설치

---

## 9. 파트너센터 UI 발송 메시지의 결과를 API로 가져올 수 있는가? (재검증, 2026-04-20)

**질문 맥락**: 2026-04-19 사용자가 파트너센터 [비즈도구 → CRM] 화면에서 더클린커피 할인쿠폰 메시지를 직접 발송한 이후, 그 발송 결과(성공·실패·노출·클릭 등)를 우리 솔루션 DB에 자동으로 가져올 수 있는지 검증 요청.

### 9.1 검증한 후보 경로 네 가지

| 후보 API | 호스트 | 원래 용도 | 파트너센터 CRM 발송 결과 조회 |
|---|---|---|---|
| 카카오톡 채널 REST API | `kapi.kakao.com` | 고객파일·친구관계 | ❌ — **발송 API 자체가 이 도메인에 없음**. 엔드포인트 6개 모두 customer_file 또는 channel relationship만. |
| 파트너센터 오픈 API (선물하기) | `kakaobusiness.gitbook.io` 문서 | **선물하기 상품 발송 전용** | ❌ — 상품 API 템플릿 대상. 친구톡·알림톡 CRM 메시지와 무관. |
| 카카오모먼트 Message API | `apis.moment.kakao.com/openapi/v4` | 광고 메시지 **크리에이티브 자원**(쿠폰·폼·채널톡포스트 조회) | ❌ — "메시지 크리에이티브에 쓸 자산"을 조회하는 것이지, 실제 발송 결과 아님. |
| Kakao i Connect Message (엔터프라이즈) | `bizmsg-web.kakaoenterprise.com` | 자체 발송·결과조회 | ⚠️ **제한적 가능** — 본인(해당 계약 주체)이 발송한 메시지만. **파트너센터 UI로 보낸 건은 별개 시스템이라 포함 안됨.** |

### 9.2 공식 문서 인용 (핵심 근거)

- **developers.kakao.com/docs/ko/kakaotalk-channel/common** (카카오톡 채널 이해하기 페이지):
  > "REST API: 카카오톡 채널 관계 조회 / 고객파일 등록 / 고객파일 조회 / 고객파일 사용자 추가 / 고객파일 사용자 삭제"
  → 발송 결과 조회 API는 문서 상 **존재하지 않음**.

- **kakaobusiness.gitbook.io/main/channel/run/stats** (인사이트 통계 페이지):
  > "메시지 발송수·노출수·클릭수, 친구수·프로필 조회수, 채팅 요청·쿠폰 응모수"
  → **UI 기능만 소개**. API 경로 없음.

- **kakaobusiness.gitbook.io/main/channel/run/message** (메시지 페이지):
  > "발송 내역의 통계 버튼을 누르면 메시지 발송 통계도 확인할 수 있습니다"
  → **파트너센터 웹 UI에서 개별 메시지 클릭 → 상세 화면에서만 통계 확인 가능**. 엑셀 다운로드·API 경로 언급 없음.

### 9.3 실제 검증한 사실

- 카카오톡 채널 API로 **발송 관련 엔드포인트를 프로브**한 결과 `kapi.kakao.com` 에는 `/v1/talkchannel/send/*`, `/v1/talkchannel/message/*` 같은 경로가 없음 (404).
- 파트너센터 UI는 **비공개 내부 API**를 쓰는 듯(예: 고객파일 삭제 기능도 공개 API 없음, §"삭제 검토" 섹션 참조). 외부 개발자가 재현 불가.
- 우리가 이미 쓰고 있는 **알리고(aligo)** 는 이 제약과 무관. 알리고 발송은 우리가 알리고 API로 보내기 때문에 `aligoSends.jsonl`에 그 결과가 전부 기록되고 있음.

### 9.4 권장 대응

**단기 (지금 당장 오늘 발송한 쿠폰 CRM)**:
1. 파트너센터 [CRM 관리 / 메시지 관리] 들어가서
2. 해당 메시지 클릭 → 상세 화면의 **[통계 버튼]** 클릭
3. 발송수·노출수·클릭수·오픈율 확인 후 수동 캡처/기록
4. 필요하면 날짜 기준으로 Sheets 문서 하나 만들어 수기 기록

**중기**:
- 대량 CRM을 **파트너센터 UI에서 발송하는 것을 지양**하고, 알리고 경로로 보내면 자동 결과 수집 가능 (이미 인프라 존재)
- 알리고는 친구톡 미지원 고객에 **SMS 자동 fallback** 해주므로 총 도달률도 더 나을 수 있음
- 우리 솔루션에서 그룹 선택 → [발송] 버튼 → 알리고 호출 → 콜백 결과 저장까지 이미 돌아가고 있음

**장기 (Phase 2)**:
- 볼륨 커지면 **Kakao i Connect Message 직접 계약** 해서 우리가 발송·결과조회 전부 API로 수행
- 이 경우 `/v2/info/message/results` 로 대량 결과 조회, `/v2/info/ft/search/detail/{uid}` 로 친구톡별 상세 상태 수집 가능
- 단가 절감 + 완전 자동화 동시 달성

### 9.5 결론

- **"파트너센터에서 UI로 보낸 메시지의 결과"를 API로 가져오는 공식 경로는 없다.** 2026-04-20 기준 확정.
- 결과를 자동 수집하려면 발송 자체를 **우리 솔루션에서(알리고 또는 Kakao i Connect 경유로)** 해야 한다.
- 앞으로 할인쿠폰 같은 CRM 메시지는 가능한 한 파트너센터 UI가 아니라 우리 시스템에서 발송하는 방향으로 가야 `/api/crm-local/message-log` 에 발송·전환 데이터가 모두 쌓인다.
