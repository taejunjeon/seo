# 더클린커피 Meta Graph API 토큰 관리

## 0411 토큰 상태 점검

### 더클린커피 토큰 (META_ADMANAGER_API_KEY_COFFEE) — 만료

| 항목 | 값 |
|------|-----|
| 상태 | **만료** |
| 앱 | SEO (ID: 1576810273379275) |
| 사용자 | 김윤겸 (ID: 943953361785062) |
| 토큰 유형 | 장기 사용자 토큰 (Long-lived User Token) |
| 발급 추정 | 2026-02-09 15:00 KST |
| **만료** | **2026-04-10 15:00 KST** |
| 유효기간 | 약 60일 |
| 만료 에러 | `Session has expired on Thursday, 09-Apr-26 23:00:00 PDT` (OAuthException, code 190, subcode 463) |

결론: 사용자 추정대로 **장기 토큰(60일)**이 맞다. 2월 9일경 발급되어 정확히 60일 후인 4월 10일에 만료되었다.

### 메인 토큰 (META_ADMANAGER_API_KEY) — 유효

| 항목 | 값 |
|------|-----|
| 상태 | **유효** |
| 앱 | agentmarketing (ID: 1019654940324559) |
| 사용자 | 정희용 (ID: 1509979824181418) |
| 토큰 유형 | 장기 사용자 토큰 |
| 발급 | 2026-04-03 18:02 KST |
| 만료 | **2026-06-02 18:02 KST** |
| 유효기간 | 60일 |
| 남은 기간 | ~52일 |

단, 이 토큰은 더클린커피 광고 계정(`act_654671961007474`)에 접근 불가. 정희용 계정은 `(주)바이오컴` 비즈니스의 `act_1382574315626662`(다른 계정)만 접근 가능.

### 광고 대시보드 영향

`/ads` 페이지에서 더클린커피가 "광고 집행 없음"으로 표시되는 이유: `META_ADMANAGER_API_KEY_COFFEE` 토큰이 만료되어 API 호출 시 `OAuthException` 발생 → 데이터 없음으로 처리됨.

### 복구 방법

**방법 1: 단기 토큰 재발급 → 장기 토큰 교환 (추천)**

1. Meta for Developers > 앱 "SEO" (1576810273379275) 선택
2. Graph API Explorer에서 김윤겸 계정으로 단기 토큰 발급
3. 권한: `ads_read`, `ads_management`, `business_management`
4. 장기 토큰으로 교환:

```bash
curl -G "https://graph.facebook.com/v22.0/oauth/access_token" \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=1576810273379275" \
  --data-urlencode "client_secret=<SEO 앱 시크릿>" \
  --data-urlencode "fb_exchange_token=<새 단기 토큰>"
```

5. 발급된 장기 토큰을 `backend/.env`의 `META_ADMANAGER_API_KEY_COFFEE`에 교체
6. 백엔드 재시작

**방법 2: 시스템 사용자 토큰 (영구, 장기 운영용)**

1. Meta Business Settings > 팀키토 비즈니스 > System Users 생성
2. 시스템 사용자에게 `act_654671961007474` 광고 계정 권한 할당
3. 토큰 발급 (만료 없음)
4. `META_ADMANAGER_API_KEY_COFFEE`에 교체

### 토큰 만료 캘린더

| 토큰 | 만료일 | 남은 일 | 알림 필요일 |
|------|--------|---------|-----------|
| 더클린커피 (김윤겸) | 2026-04-10 | **만료됨** | 즉시 갱신 |
| 메인 (정희용) | 2026-06-02 | ~52일 | 2026-05-26 (7일 전) |
