# Google Ads last_7d / last_30d readonly comparison - 2026-05-10

## 결론
VM Google Ads credentials는 status 조회 200으로 확인됐지만 dashboard route는 last_7d/last_30d 모두 502였다. 따라서 이번 산출은 로컬 read-only Google Ads API 스크립트로 대체했다. 숫자는 같은 계정 기준이지만, VM dashboard route hardening은 별도 Green/P1로 남는다.

## Last 7d
- cost: 3,973,244.31 KRW
- platform Conv. value: 46,489,814.17 KRW
- platform ROAS: 11.7
- primary NPay value: 46,489,804.99 KRW (100.0%)
- secondary NPay all value: 43,969,090.27 KRW

## Last 30d
- cost: 23,666,491.84 KRW
- platform Conv. value: 226,732,681.89 KRW
- platform ROAS: 9.58
- primary NPay value: 226,732,645.92 KRW (100.0%)
- secondary NPay all value: 191,473,361.51 KRW

## Opinion
- 정기 비교는 진행 추천이다. 플랫폼 주장 ROAS와 내부 confirmed ROAS를 분리하는 핵심 관측값이다.
- VM dashboard route 502는 토큰 실패가 아니라 route/query/proxy hardening 이슈로 분리한다.
- login-customer-id optional header는 로컬 route 코드에 반영했지만 VM 배포는 하지 않았다.
