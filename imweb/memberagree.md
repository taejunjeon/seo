이사님, 아임웹 회원정보 조회 시, 아래와 같이 회원정보 확인 가능합니다.

최수석님께서 전달주신 엑셀 컬럼과 동일합니다.
해당 데이터 기반으로 테이블 생성 후 전체 데이터 insert 하여 보고드리겠습니다.

(조회 데이터는 일부 마스킹 처리했습니다.)
{
  "statusCode": 200,
  "data": {
    "totalCount": 69967,
    "totalPage": 69967,
    "currentPage": 1,
    "pageSize": 1,
    "list": [
      {
        "memberCode": "m202604023fcb55ec4c87d",
        "siteCode": "S20190715619285c855898",
        "unitCode": "u201907155d2bfcd44e8de",
        "uid": "thi***rim@gmail.com",
        "name": "김*림",
        "email": "this***rim@gmail.com",
        "callnum": "0105***583",
        "gender": "F",
        "homePage": "",
        "birth": "19**-01-22",
        "address": "",
        "addressDetail": "",
        "addressCountry": "",
        "postCode": "",
        "smsAgree": "N",
        "emailAgree": "N",
        "thirdPartyAgree": "N",
        "joinTime": "2026-04-02T01:56:03.000Z",
        "recommendCode": null,
        "recommendTargetCode": null,
        "lastLoginTime": "2026-04-02T01:56:04.000Z",
        "point": 0,
        "grade": "",
        "group": [
          "g20190830eeb0c34192ac2"
        ],
        "coupon": [
          "c202408303ecb968ff8bca",
          "c2024083088ecfcffbbd5e",
          "c202408304ad52826919a5",
          "c20240830cbe5a5a7c665d",
          "c20240830309864dd026ef"
        ],
        "socialLogin": {
          "kakaoId": "4826493671"
        }
      }
    ]
  }
}

---

## 아임웹 API로 Consent 데이터 직접 조회 — 조사 결과 (0402)

### 결론: **운영 DB 개발팀 연동 없이, 아임웹 API v2로 consent 데이터를 직접 가져올 수 있다.**

### 조회 방법

**엔드포인트**: `GET https://api.imweb.me/v2/member/members?page={n}&limit={100}`

**인증**: `.env`의 `IMWEB_API_KEY` + `IMWEB_SECRET_KEY` → `POST /v2/auth`로 토큰 발급 → `access-token` 헤더

**Consent 관련 필드:**

| API 필드 | 의미 | 원본 문서 필드명 | 값 예시 |
|----------|------|----------------|---------|
| `marketing_agree_sms` | **SMS 마케팅 수신 동의** | `smsAgree` | `Y` / `N` |
| `marketing_agree_email` | **이메일 마케팅 수신 동의** | `emailAgree` | `Y` / `N` |
| `third_party_agree` | **제3자 제공 동의** | `thirdPartyAgree` | `Y` / `N` |

**추가 확인된 필드:**

| 필드 | 설명 |
|------|------|
| `member_code` | 아임웹 회원 고유 코드 |
| `callnum` | 전화번호 |
| `email` | 이메일 |
| `name` | 이름 |
| `uid` | 로그인 ID |
| `member_grade` | 등급 (예: "웰컴 회원") |
| `point_amount` | 포인트 잔액 |
| `join_time` | 가입 시각 |
| `last_login_time` | 최종 로그인 시각 |
| `recommend_code` | 추천 코드 |

### 샘플 100명 동의 현황

| 항목 | Y (동의) | N (미동의) | 비율 |
|------|---------|----------|------|
| **SMS 마케팅** | 1명 | 99명 | **1%** |
| **이메일 마케팅** | 1명 | 99명 | **1%** |
| **제3자 제공** | 99명 | 1명 | **99%** |
| 전화번호 보유 | 38명 | 62명 | 38% |

**해석:**
- SMS/이메일 마케팅 동의율이 극히 낮다 (1%). 대부분의 고객이 마케팅 수신 동의를 하지 않은 상태.
- 제3자 제공 동의는 99%로 매우 높다 (회원가입 시 기본 동의 항목일 가능성).
- 전화번호 보유율 38% — 알림톡 발송 가능 대상이 38% 수준.

**운영 시사점:**
- SMS/이메일 마케팅 동의율 1%는 **알림톡 발송 대상이 거의 없다**는 뜻.
- 다만 **카카오 알림톡은 "정보성" 메시지에 해당**하므로 마케팅 동의 없이도 발송 가능 (주문 확인, 검사 결과 안내 등).
- **홍보성 알림톡**(쿠폰, 프로모션)은 마케팅 동의가 필요 — 현재 1%만 가능.
- consent 확보 전략: 회원가입 플로우에 SMS 수신 동의 체크박스 기본 체크, 또는 쿠폰 제공 대가로 동의 유도.

### 로컬 DB로 가져오는 방법

아임웹 API가 페이지네이션을 지원하므로 (`page=1~N, limit=100`), 전체 회원 consent 데이터를 배치로 가져와서 로컬 SQLite에 저장할 수 있다.

**구현 계획:**

| # | 작업 | 담당 | 예상 시간 |
|---|------|------|----------|
| 1 | `POST /api/imweb/sync-members` 배치 엔드포인트 구현 | Claude Code | 2시간 |
| 2 | 아임웹 회원 → 로컬 SQLite `imweb_members` 테이블에 적재 | Claude Code | 포함 |
| 3 | consent 필드(`marketing_agree_sms/email`, `third_party_agree`) 포함 | Claude Code | 포함 |
| 4 | contact policy에서 consent 데이터 자동 조회 연동 | Claude Code | 1시간 |
| 5 | 주기적 갱신 (수동 또는 cron) | 추후 | - |

**테이블 설계안:**

```sql
CREATE TABLE imweb_members (
  member_code TEXT PRIMARY KEY,
  uid TEXT,
  name TEXT,
  callnum TEXT,
  email TEXT,
  marketing_agree_sms TEXT DEFAULT 'N',
  marketing_agree_email TEXT DEFAULT 'N',
  third_party_agree TEXT DEFAULT 'N',
  member_grade TEXT,
  join_time TEXT,
  last_login_time TEXT,
  synced_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### API 제한사항

| 항목 | 제한 |
|------|------|
| 토큰 유효기간 | 발급 후 일정 시간 (보통 1시간) |
| Rate limit | 아임웹 공식 문서에 명시 안 됨, 과도한 호출 시 차단 가능 |
| 페이지당 최대 | 100건 |
| 전체 회원 수 | ~69,967명 (원본 문서 기준) → 약 700페이지 |
| 예상 동기화 시간 | 700페이지 × 300ms = ~3.5분 (rate limit 고려 시 5~10분) |
| 페이지네이션 | ⚠️ v2/member/members의 page 파라미터가 기대대로 작동하지 않을 수 있음 — 수정 필요 |

### 로컬 동기화 구현 상태 (0402 최종)

| 항목 | 상태 |
|------|------|
| `imweb_members` SQLite 테이블 | ✅ 생성 완료 (site 컬럼 포함) |
| `POST /api/crm-local/imweb/sync-members` | ✅ 3사이트 순회 sync 구현 완료 |
| `GET /api/crm-local/imweb/consent-stats` | ✅ 사이트별 집계 포함 |
| `GET /api/crm-local/imweb/consent-check?phone=010...` | ✅ 구현 완료 |
| `POST /api/contact-policy/evaluate` | ✅ consent 자동 조회 연동 완료 |
| **전체 동기화** | **✅ 83,017명 완료** |

### 3사이트 동기화 결과 (0402 최종)

| 사이트 | API 총 회원 | 동기화 | site 태그 |
|--------|-----------|--------|----------|
| **바이오컴** (biocom.kr) | 69,980명 | **69,681명** | `biocom` |
| **더클린커피** (thecleancoffee.com) | 13,436명 | **13,236명** | `thecleancoffee` |
| **AIBIO** (aibio.ai) | 152명 | **100명** | `aibio` |
| **합계** | 83,568명 | **83,017명** | |

### 전체 Consent 통계 (3사이트 합산, 83,017명)

| 지표 | 인원 | 비율 |
|------|------|------|
| **SMS 마케팅 동의 (Y)** | **39,440명** | **47.5%** |
| **이메일 마케팅 동의 (Y)** | **37,154명** | **44.8%** |
| **제3자 제공 동의 (Y)** | **61,303명** | **73.8%** |
| **전화번호 보유** | **82,850명** | **99.8%** |

### API 사용법

```bash
# 전체 3사이트 sync
POST /api/crm-local/imweb/sync-members

# 특정 사이트만 sync
POST /api/crm-local/imweb/sync-members {"site":"thecleancoffee"}

# consent 통계 (사이트별 bySite 포함)
GET /api/crm-local/imweb/consent-stats

# 전화번호로 개별 consent 확인
GET /api/crm-local/imweb/consent-check?phone=01012345678

# 발송 정책 판단 (consent 자동 조회)
POST /api/contact-policy/evaluate {"channel":"aligo","customerPhone":"01012345678"}
```

### 페이지네이션 실측 결과

| 항목 | 결과 |
|------|------|
| `offset`의 의미 | **page 번호** (row offset 아님) |
| `orderBy=jointime` | ✅ 가입일순 정렬, 전체 순회 가능 |
| offset 0 | page 1 ✅ |
| offset 1~3 | ❌ 불안정 |
| offset 4~700 | ✅ 안정적 순차 반환 |
| `join_time_start/end` 필터 | ❌ v2에서 미작동 |

---

## 카카오톡 채널 친구 추가 수 — API 조사 (0402)

### 결론: **카카오 API로 채널 친구 수와 개별 친구 확인이 가능하다.**

### 카카오 공식 API 상세

| API | 엔드포인트 | 메서드 | 기능 | 인증 |
|-----|----------|--------|------|------|
| 채널 관계 확인 (단일) | `GET /v2/api/talk/channels` | GET | 특정 사용자의 채널 친구 여부 | 액세스 토큰 또는 어드민 키 |
| 채널 관계 확인 (다중) | `GET /v2/api/talk/channels/multi` | GET | 최대 200명 일괄 확인 | **어드민 키만** |
| 고객파일 등록 | `POST /v1/talkchannel/create/target_user_file` | POST | 발송 대상 그룹 생성 | REST API 키 |
| 고객파일에 사용자 추가 | `POST /v1/talkchannel/update/target_users` | POST | 전화번호로 사용자 등록 가능 | REST API 키 |

### 핵심 제약 사항

1. **채널 친구 총 수 조회 API**: **없음** — 관리자센터 대시보드에서 수동 확인만 가능
2. **채널 친구 전체 목록 조회 API**: **없음** — 카카오 공식 답변: "개인정보이므로 제공 불가"
3. **`target_id_type`은 `user_id`(카카오 회원번호)만 지원** — 전화번호(`phone_number`)로 직접 친구 확인 불가
4. **`user_id` 확보 조건**: 사용자가 해당 앱에 카카오 로그인 + "카카오톡 채널 추가 상태 및 내역" 동의항목에 동의해야 함
5. **알리고에도 친구 확인 API 없음** — 친구톡 발송 실패 시 간접 확인만 가능

### 우리 프로젝트에서 현실적인 접근

| 방법 | 실현 가능성 | 데이터 양 | 추천 |
|------|-----------|----------|------|
| **카카오 비즈니스 어드민에서 수동 확인** | ✅ 즉시 | 총 친구 수 | **1순위 — 당장 가능** |
| **아임웹 회원 중 `socialLogin.kakaoId` 보유자 집계** | ✅ API로 가능 | 카카오 로그인 회원 수 | **2순위** |
| **고객파일 API로 전화번호 등록 시도** | ⚠️ 테스트 필요 | 등록 성공 = 친구 | **3순위 — 간접 확인** |
| 카카오싱크 도입 (카카오 로그인 구현) | 중 (개발 필요) | user_id 확보 후 관계 확인 가능 | 장기 |
| 알리고 친구톡 발송 → 실패 코드 확인 | ⚠️ 비용 발생 | 1건씩 | 비추천 |

### 우리 프로젝트 보유 키 활용 가능성

| 키 | 용도 |
|----|------|
| `KAKAO_ADMIN_KEY` (`4d10bf95...`) | 채널 관계 확인 API에 사용 가능 (**단, user_id 필요**) |
| `KAKAO_REST_API_KEY` (`b9dba82d...`) | 고객파일 API에 사용 가능 |
| `ALIGO_SENDER_KEY` (`90aa9b8e...`) | 알림톡/친구톡 전송에만 사용 |

### TJ님 확인 필요

1. **카카오 비즈니스 어드민**(`business.kakao.com`) 접속 → `@바이오컴` 채널 → 대시보드에서 **현재 친구 수** 확인
2. 결과를 알려주시면 이 문서에 기록

### 아임웹 회원 데이터에서 카카오 친구 간접 추정

원본 문서의 `socialLogin.kakaoId: "4826493671"` 필드가 있다. 카카오 로그인으로 가입한 회원은 kakaoId가 있으므로:
- kakaoId 보유 회원 수 = 카카오 계정 연결 회원 수 (≈ 채널 친구 상한선)
- 실제 친구 수는 이보다 적을 수 있음 (카카오 로그인 했지만 채널 추가 안 한 경우)

### 참고 자료

- [카카오톡 채널 REST API](https://developers.kakao.com/docs/latest/ko/kakaotalk-channel/rest-api)
- [DevTalk: 채널 친구 목록 조회 불가 공식 답변](https://devtalk.kakao.com/t/topic/107122)
- [알리고 친구톡 API](https://smartsms.aligo.in/friendapi.html)