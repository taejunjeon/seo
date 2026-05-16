# ATT ROAS vs Ads Manager ROAS gap

작성 시각: 2026-05-16 01:51 KST

## 10초 요약

7일 합계에서는 Ads Manager ROAS가 내부 Meta evidence ROAS보다 약간 높습니다. 하지만 2026-05-15만 보면 내부 Meta evidence ROAS는 2.22x인데 Ads Manager ROAS는 0.00x입니다.

따라서 “Meta가 아예 못 받고 있다”가 아니라 “특정일, 특히 2026-05-15의 Ads attribution 반영이 비정상”으로 보는 것이 맞습니다.

## ROAS 정의

| 이름 | 쉬운 뜻 | 계산식 | 예산 판단 |
|---|---|---|---|
| 내부 ATT ROAS | 우리 원장에서 Meta 유입 evidence가 있는 실제 결제완료 매출 기준 ROAS | VM Cloud Meta evidence confirmed revenue / Meta spend | 내부 예산 판단 후보 |
| Ads Manager ROAS | Meta가 자기 광고 기여로 주장하는 구매 전환값 기준 ROAS | Meta Ads purchase value / Meta spend | 플랫폼 학습/리포팅 상태 확인 |
| 내부 전체 confirmed ROAS | 모든 유입의 실제 결제완료 매출을 Meta spend로 나눈 값 | 전체 confirmed revenue / Meta spend | Meta 성과로 쓰면 안 됨 |

## 7일 합계

| 기준 | 매출 | 비용 | ROAS |
|---|---:|---:|---:|
| 내부 Meta evidence strict | 41,969,224원 | 28,672,735원 | 1.46x |
| 내부 Meta evidence strict + CAPI 성공 | 39,563,224원 | 28,672,735원 | 1.38x |
| Ads Manager attributed purchase | 48,403,247원 | 28,672,735원 | 1.69x |
| 내부 전체 confirmed | 97,398,368원 | 28,672,735원 | 3.40x |

7일 합계 gap:

- Ads Manager ROAS - 내부 Meta evidence ROAS = **+0.22p**
- 해석: 7일 합계에서는 Meta가 우리 strict evidence보다 넓게 구매를 귀속하고 있습니다.

## 날짜별 gap

| 날짜 | 내부 ATT ROAS | Ads ROAS | gap | 해석 |
|---|---:|---:|---:|---|
| 2026-05-09 | 0.86x | 1.93x | -1.07p | Meta가 내부 evidence보다 넓게 잡음 |
| 2026-05-10 | 1.65x | 2.19x | -0.54p | 정상 범위 후보 |
| 2026-05-11 | 0.87x | 2.00x | -1.12p | Meta가 넓게 잡음 |
| 2026-05-12 | 1.42x | 2.10x | -0.68p | 정상 범위 후보 |
| 2026-05-13 | 1.85x | 2.88x | -1.03p | Meta가 넓게 잡음 |
| 2026-05-14 | 1.49x | 0.13x | +1.36p | Ads attribution 급락 시작 |
| 2026-05-15 | 2.22x | 0.00x | +2.22p | 핵심 이상치 |

## 원인 후보

1. **2026-05-15 same-day lag 또는 attribution hold**
   - 7일 구매는 존재하지만 2026-05-15 단일일 구매가 0입니다.
   - 당일/익일 지연일 가능성이 남아 있습니다.

2. **데이터 공유 제한 영향**
   - 건강/웰빙 카테고리 제한 경고가 있습니다.
   - `events_received=1`은 수신 성공이지 Ads attribution 사용 보장을 뜻하지 않습니다.

3. **브라우저 Purchase 부족**
   - Browser Purchase 0은 signal quality 보조 리스크입니다.
   - 그러나 CAPI 경로가 살아 있어 즉시 “학습 신호 전부 상실”로 보지는 않습니다.

4. **UTM/campaign 정규화 부족**
   - 숫자형 campaign UTM과 missing campaign bucket이 큽니다.
   - Ads Manager와 내부 캠페인별 대조 정확도를 낮춥니다.

## 결론

지금 예산 판단에는 Ads Manager 단일값만 쓰면 안 됩니다. 2026-05-15처럼 Ads가 0으로 보이는 날에는 내부 Meta evidence ROAS를 함께 봐야 합니다.

다만 내부 전체 confirmed ROAS 3.40x를 Meta ROAS로 쓰면 과대입니다. 예산 판단 화면에는 최소 3줄이 필요합니다.

1. Ads Manager ROAS: Meta가 주장하는 값
2. 내부 Meta evidence ROAS: 우리 원장 기준 Meta 유입 후보 값
3. 전체 confirmed ROAS: 전체 매출 건전성 참고값, Meta 성과 아님
