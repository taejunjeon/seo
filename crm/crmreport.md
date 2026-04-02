# CRM 발송 시스템 리포트 + 알림톡 템플릿 API 조사

> 최종 업데이트: 2026-04-02
> 목적: 알림톡 발송 사고 기록, 해결, 템플릿 관리 API 조사

---

## ★ 변수 미치환 발송 사고 및 해결 (0402)

### 사고 내용

`TT_3872` (결과지 알림톡 채널톡 URL) 템플릿을 최고관리자 강제 발송으로 전송. 변수 `#{성함}`, `#{주문검사명}`, `#{결과지링크}`가 **미치환 상태**로 카카오톡에 도달.

### 원인

1. exact-match FAIL 상태에서 최고관리자 강제 발송으로 우회 가능했음
2. 변수 입력 UI가 없어서 변수를 채울 방법이 없었음
3. 발송 시 원본 템플릿 본문을 그대로 전송 (치환본이 아닌)

### 해결 (0402 즉시 적용)

| 수정 | 설명 |
|------|------|
| **변수 입력 폼** | 미리보기에 변수별 입력 필드 추가. 입력하면 실시간 render-preview 재호출 |
| **exact-match FAIL 발송 차단** | FAIL이면 발송 불가. 최고관리자 강제 발송으로도 우회 불가 |
| **치환 본문 전송** | `previewResult.renderedBody` (변수 치환 완료 본문)를 발송 |
| **미리보기 치환 반영** | 변수 입력 시 미리보기에 즉시 반영 |

### 재발 방지 규칙

- exact-match FAIL → 발송 버튼 disabled (예외 없음)
- 변수가 있는 템플릿은 전부 입력해야 발송 가능
- 미리보기 본문이 발송 본문과 동일 (WYSIWYG)

---

## 알리고 / 카카오 알림톡 템플릿 API 조사 보고서

> 조사일: 2026-04-02
> 목적: 알림톡 템플릿의 휴면 해제, 신규 생성, 검수 제출이 API로 가능한지 확인

---

## 요약 (결론 먼저)

| 기능 | 알리고 API | 카카오 직접 API | 비고 |
|------|-----------|---------------|------|
| 템플릿 목록 조회 | **가능** | 플랫폼별 상이 | - |
| 템플릿 신규 등록 | **가능** | 중개사(알리고 등) 통해 가능 | - |
| 템플릿 수정 | **가능** | 승인 후 수정 불가 (신규 등록 필요) | - |
| 템플릿 삭제 | **가능** | - | - |
| 검수(심사) 요청 | **가능** | 등록 시 자동 요청 | - |
| 휴면 해제 | **불가** (API 미제공) | **불가** (API 미제공) | 수동 처리 필요 |

---

## 1. 휴면(dormant) 템플릿 API 재활성화 가능 여부

### 결론: API로 불가능하다. 수동 처리만 가능하다.

알리고와 카카오 모두 휴면 해제 전용 API 엔드포인트를 제공하지 않는다.

### 휴면 전환 조건
- 템플릿 등록 후 **1년간** 상태 변경 없거나, 승인 후 추가 발송이 없는 경우 휴면 전환
- 휴면 해제 후에도 **30일간** 알림톡 발송 이력이 없으면 다시 휴면 전환
- 휴면 상태로 **1년 경과** 시 템플릿 삭제 (복구 불가)

### 수동 휴면 해제 방법

#### 알리고 사용 시
- 알리고 웹 콘솔(smartsms.aligo.in)에 로그인
- 템플릿 관리 화면에서 휴면 템플릿 선택 후 [휴면해제] 버튼 클릭
- 또는 알리고 고객센터에 문의 (02-511-4560 / cs@alipeople.kr, 평일 10:00~17:00)

#### NHN Cloud / 네이버 클라우드 사용 시
- 콘솔에서 Services > Application Services > SENS > Biz Message > AlimTalk Template
- 해당 휴면 템플릿 선택 후 [휴면해제] 버튼 클릭
- 또는 기술지원 1:1 문의에서 요청 양식 제출 (카카오 템플릿 코드 + 발신 프로필명 기재)

---

## 2. 신규 템플릿 API 등록 가능 여부

### 결론: 알리고 API로 가능하다.

### 알리고 템플릿 등록 API

```
POST https://kakaoapi.aligo.in/akv10/template/add/
```

**필수 파라미터:**

| 파라미터 | 설명 |
|---------|------|
| apikey | 알리고 API 키 |
| userid | 알리고 사용자 ID |
| senderkey | 카카오 발신 프로필 키 |
| tpl_name | 템플릿 이름 |
| tpl_content | 템플릿 내용 (변수: `#{변수명}` 형식, 최대 1,000자) |

**선택 파라미터:**

| 파라미터 | 설명 |
|---------|------|
| tpl_button | 버튼 정보 (JSON) |
| tpl_secure | 보안 템플릿 여부 |
| tpl_type | 템플릿 유형 |
| tpl_emtype | 강조 표기 유형 |
| tpl_advert | 광고 포함 여부 |
| tpl_extra | 부가 정보 |
| tpl_title | 템플릿 제목 |
| tpl_stitle | 강조 제목 |
| image | 이미지 |

### 알리고 템플릿 수정 API

```
POST https://kakaoapi.aligo.in/akv10/template/modify/
```

주의: 카카오 정책상 **승인 완료된 템플릿은 수정 불가**하다. 신규 템플릿을 등록하고 재검수를 받아야 한다.

### 알리고 템플릿 삭제 API

```
POST https://kakaoapi.aligo.in/akv10/template/del/
```

필수: apikey, userid, senderkey, tpl_code

### 알리고 템플릿 목록 조회 API

```
POST https://kakaoapi.aligo.in/akv10/template/list/
```

필수: apikey, userid, senderkey
선택: tpl_code (특정 템플릿만 조회)

---

## 3. 검수(심사) 제출 API 가능 여부

### 결론: 알리고 API로 가능하다.

### 알리고 템플릿 검수 요청 API

```
POST https://kakaoapi.aligo.in/akv10/template/request/
```

**필수 파라미터:**

| 파라미터 | 설명 |
|---------|------|
| apikey | 알리고 API 키 |
| userid | 알리고 사용자 ID |
| senderkey | 카카오 발신 프로필 키 |
| tpl_code | 검수 요청할 템플릿 코드 |

### 검수 프로세스 흐름

```
템플릿 등록 (template/add)
    ↓
검수 요청 (template/request)
    ↓
카카오 심사 (영업일 2일 이내)
    ↓
승인 또는 반려
    ↓ (반려 시)
수정 후 재검수 요청
```

---

## 4. 검수(심사) 승인 소요 시간

| 출처 | 안내 기간 |
|------|----------|
| 카카오 비즈니스 공식 가이드 | **영업일 기준 2일 이내** 순차 처리 |
| NHN Cloud | **영업일 기준 2일 이내** |
| 알리고 | **4~5일** 소요 안내 |
| 솔라피 | **1~3영업일** |

### 참고 사항
- 실질적으로 **영업일 1~3일**이 일반적이나, 반려 후 재검수까지 포함하면 **1~2주** 소요 가능
- **긴급 검수**는 장애/오류, 오발송 관련 긴급공지 메시지에만 가능하며, 카카오 기술지원 1:1 문의로 요청
- 반려 시 수정 후 재심사 요청 필요 (재심사도 동일한 기간 소요)

---

## 5. 알리고 API 전체 엔드포인트 정리

### 카카오채널 관리

| 기능 | 엔드포인트 |
|------|-----------|
| 카카오채널 인증 | `POST /akv10/profile/auth/` |
| 카카오채널 등록 | `POST /akv10/profile/add/` |
| 카카오채널 목록 | `POST /akv10/profile/list/` |
| 카테고리 조회 | `POST /akv10/category/` |

### 템플릿 관리

| 기능 | 엔드포인트 |
|------|-----------|
| 템플릿 목록 조회 | `POST /akv10/template/list/` |
| 템플릿 등록 | `POST /akv10/template/add/` |
| 템플릿 수정 | `POST /akv10/template/modify/` |
| 템플릿 삭제 | `POST /akv10/template/del/` |
| 템플릿 검수 요청 | `POST /akv10/template/request/` |
| **템플릿 휴면 해제** | **API 미제공** |

### 메시지 발송

| 기능 | 엔드포인트 |
|------|-----------|
| 알림톡 전송 | `POST /akv10/alimtalk/send/` |
| 전송내역 조회 | `POST /akv10/history/list/` |
| 전송결과 상세 | `POST /akv10/history/detail/` |
| 발송가능 건수 | `POST /akv10/heartinfo/` |
| 예약 취소 | `POST /akv10/cancel/` |

기본 호스트: `https://kakaoapi.aligo.in`

---

## 6. 카카오 직접 API (Kakao i Connect Message / BizMessage)

카카오 엔터프라이즈가 제공하는 직접 BizMessage API는 주로 **메시지 발송 및 결과 조회**에 초점이 맞춰져 있다.

### 제공 API

| 기능 | 엔드포인트 |
|------|-----------|
| 알림톡 발송 | `POST /v2/send/kakao` |
| 발송 결과 조회 | `GET /v2/info/message/results` |
| 발송 결과 완료 | `PUT /v2/info/message/results/complete/{report_group_no}` |
| 발송 리스트 조회 | `POST /v2/info/message/search` |
| 발송 상세 조회 | `GET /v2/info/message/search/detail/{uid}` |

### 미제공 기능
- 템플릿 CRUD (생성/수정/삭제)는 카카오 비즈니스 웹 콘솔 또는 중개사(알리고, 솔라피, NHN Cloud 등) API를 통해 처리
- 템플릿 휴면 해제는 카카오 비즈니스 콘솔 또는 기술지원 문의로만 가능

---

## 7. 권장 사항

### 자동화 가능 범위 (알리고 API 기준)
1. **템플릿 생성 자동화**: `template/add` API로 프로그래밍 방식으로 가능
2. **검수 요청 자동화**: `template/request` API로 가능
3. **템플릿 상태 모니터링**: `template/list` API로 승인/반려 상태 확인 가능
4. **반려 시 수정 후 재검수**: `template/modify` + `template/request` 조합으로 가능

### 수동 처리 필요 항목
1. **휴면 해제**: API 미제공. 웹 콘솔에서 수동 클릭 또는 고객센터 요청 필요
2. **긴급 검수**: 카카오 기술지원 1:1 문의로만 가능

### 휴면 방지 전략
- 승인된 템플릿에 대해 **30일 이내 주기적 발송**을 유지하여 휴면 전환 방지
- 템플릿 발송 현황을 모니터링하는 cron job 또는 알림 시스템 구축 권장
- 사용하지 않는 템플릿은 삭제 후 필요 시 재생성하는 것이 관리상 유리

---

## 참고 자료

- [알리고 알림톡 API 문서](https://smartsms.aligo.in/alimapi.html)
- [알리고 API 예제](https://smartsms.aligo.in/shop/kakaoexample.html)
- [카카오 비즈니스 알림톡 심사 가이드](https://kakaobusiness.gitbook.io/main/ad/infotalk/audit)
- [NHN Cloud 알림톡 API v2.3 가이드](https://docs.nhncloud.com/ko/Notification/KakaoTalk%20Bizmessage/ko/alimtalk-api-guide/)
- [NHN Cloud 알림톡 개요 (템플릿 유의사항)](https://docs.nhncloud.com/ko/Notification/KakaoTalk%20Bizmessage/ko/alimtalk-overview/)
- [솔라피 알림톡 발송 가이드](https://solapi.com/guides/kakao-ata-guide)
- [카카오 i 커넥트 메시지 API](https://docs.kakaoi.ai/kakao_i_connect_message/bizmessage/api/api_reference/at/)
