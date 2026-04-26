# AIBIO 자체 홈페이지 redirect map 초안

작성 시각: 2026-04-26 09:16 KST
상태: 운영 미반영 초안

## 10초 요약

이 문서는 AIBIO 아임웹 URL을 자체 홈페이지로 옮길 때 필요한 301 redirect 후보를 정리한다. 아직 운영 redirect를 걸지 않는다. 현재 목적은 인기 페이지와 광고 랜딩을 잃지 않도록 개발팀이 route를 먼저 준비하는 것이다.

## Redirect 후보

| 현재 아임웹 경로 | 현재 역할 | 자체 route 후보 | 우선순위 | 근거 | 상태 |
|---|---|---|---|---|---|
| `/` | 메인 홈페이지 | `/aibio-native` 또는 향후 `/` | 높음 | 아임웹 대표 도메인 | 초안 |
| `/main` | AIBIO 다이어트 프로그램 | `/aibio-native#programs` | 높음 | 첨부 통계 화면 인기 페이지 | 초안 |
| `/shop_view?idx=25` | 리커버리랩 이벤트/체험권 후보 | `/aibio-native#lead` 또는 `/aibio-native/ticket` | 높음 | 내부 폼 제출 주 랜딩 후보 | 초안 |
| `/59` | 대사&붓기케어 입력폼 랜딩 | `/aibio-native#lead` | 높음 | v8.1 폼 제출 테스트 페이지 | 초안 |
| `/56` | 변화 후기 후보 | `/aibio-native#programs` | 중간 | 첨부 통계 화면 인기 페이지 | 초안 |
| `/bio_pulse_M` | 바이오펄스 상세 | `/aibio-native#programs` | 중간 | 첨부 통계 화면 인기 페이지 | 초안 |

## 운영 적용 전 확인할 것

1. 아임웹 관리자에서 실제 페이지 목록 export
2. Search Console 기준 색인 URL 확인
3. Meta/Google/Naver 광고 랜딩 URL export
4. `/shop_view?idx=25`의 실제 상품/이벤트 문구 확인
5. 자체 홈페이지의 최종 도메인과 route 확정

## 적용 원칙

- 광고 랜딩과 폼 페이지부터 먼저 옮긴다.
- 블로그/후기/상세 페이지는 Search Console과 유입 데이터를 보고 순서를 정한다.
- 운영 redirect는 30일 병행 지표가 나온 뒤 적용한다.
- 바이오컴과 더클린커피 URL은 이 문서 범위에서 제외한다.
