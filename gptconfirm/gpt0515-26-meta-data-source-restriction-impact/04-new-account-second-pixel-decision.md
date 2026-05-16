# New account / second Pixel decision

작성 시각: 2026-05-16 00:53 KST

## 결론

지금 단계에서 새 광고 계정 또는 두 번째 Pixel은 추천하지 않습니다.

추천 점수:

- 새 광고 계정 생성: 15%
- 두 번째 Pixel 운영 삽입: 20%
- 기존 Pixel 유지 + 제한 상세 확인 + 데이터 최소화: 90%

## 새 광고 계정을 지금 만들면 안 되는 이유

1. 제한은 계정만이 아니라 데이터 소스/도메인/category에 붙을 수 있습니다. 같은 `biocom.kr`을 쓰면 새 계정도 같은 제한을 받을 수 있습니다.
2. 기존 학습 이력이 끊깁니다. 지금은 최근 7일 Ads purchase가 존재하므로 기존 계정이 완전 죽었다고 볼 수 없습니다.
3. 계정 우회처럼 보일 수 있습니다. 건강/웰빙 제한이 정책성 제한이라면 새 계정으로 피하려는 시도는 리스크입니다.
4. 원인이 아직 확정되지 않았습니다. 2026-05-15 당일 지연이면 새 계정은 문제 해결이 아니라 노이즈입니다.

## 두 번째 Pixel을 지금 넣으면 안 되는 이유

1. 구매 신호가 두 군데로 쪼개집니다.
2. Browser Pixel과 Server CAPI 중복 제거가 더 어려워집니다.
3. 같은 도메인이라면 두 번째 Pixel도 같은 카테고리 제한을 받을 수 있습니다.
4. 현재 Server CAPI는 성공하고 있습니다. 먼저 제한/리포팅 문제를 해결해야 합니다.
5. 운영 페이지에 Pixel을 추가 삽입하면 GTM/아임웹/FBE/native wrapper와 중복 발화 위험이 큽니다.

## 예외적으로 검토할 수 있는 조건

새 계정 또는 두 번째 Pixel은 아래 조건이 모두 충족될 때만 다시 검토합니다.

- Meta UI 또는 Meta support가 기존 데이터 소스의 Purchase 사용 불가를 명시한다.
- 기존 Pixel의 review request가 실패한다.
- 데이터 최소화 후에도 Ads Manager purchase가 장기간 0이다.
- 새 데이터 소스가 같은 건강/웰빙 제한을 받지 않는다는 근거가 있다.
- 중복/분산/정책 리스크를 감수할 사업 판단이 있다.

## 지금 추천하는 대안

1. 기존 Pixel `1283400029487161` 유지.
2. Server CAPI Purchase 유지.
3. Browser Purchase는 보조 복구로 계속 설계하되 unguarded 발화 금지.
4. Meta UI에서 제한 상세 확인.
5. CAPI payload 데이터 최소화.
6. Meta review request 준비.
7. Ads Manager 2026-05-15 purchase 재조회.

## Source / window / confidence

- Source: TJ님 Events Manager UI evidence, gpt0515-25 CAPI/Ads evidence, public health/wellness restriction summaries
- Window: 2026-05-15 KST issue
- Freshness: 2026-05-16 00:53 KST
- Confidence: medium_high
