# 모니터링 및 다음 액션

## 24시간 canary에서 볼 것

1. Purchase CAPI success가 계속 100%에 가까운지 본다.
2. `user_data_presence.em=true` 비율이 올라가는지 본다.
3. `ph`, `external_id`, `fbc`, `fbp` 비율이 떨어지지 않는지 본다.
4. duplicate event_id가 0인지 본다.
5. Meta Events Manager의 이벤트 매칭 품질이 6.0~6.3에서 개선되는지 본다.

## 중단 조건

- CAPI failed 증가
- duplicate event_id 발생
- Meta diagnostics에서 email format 문제 발생
- raw email이 로그나 문서에 노출되는 정황 발견

## 24시간 후 판단

문제가 없으면 canary를 유지한다. 문제가 있으면 `META_CAPI_ENABLE_IMWEB_EMAIL_HASH=false`로 즉시 끄고 원인을 분리한다.

## 후속 개선 후보

1. email candidate가 없는 회원의 원인 분류: 회원 테이블 sync 부족, 비회원 주문, 이메일 미수집 중 무엇인지 분리한다.
2. Meta Events Manager score 추세를 24h/48h로 비교한다.
3. Facebook Login ID는 별도 신뢰 source가 생기기 전까지 보류한다.
