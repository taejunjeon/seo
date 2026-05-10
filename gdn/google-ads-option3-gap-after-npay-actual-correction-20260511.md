# Google Ads option3 gap 재계산 — NPay actual 합류 후 (gpt0508-36)

작성 시각: 2026-05-11 00:00:00 KST
실행 상태: 분석 + 추천 갱신 / 실제 Google Ads UI 변경 0 (Red 승인 범위 밖)
자신감: 93%

## 한 줄 결론

NPay actual 209건 / ₩3,763만 합류만으로 internal ROAS는 0.27 → 1.86으로 7배 회복하지만 platform vs internal **gap은 9.31 → 7.72로 약 17% 축소에 그치오**. 남은 gap의 본체는 여전히 `구매완료(7130249515)` 메인 action이 NPay click 오염을 입찰 학습에 직접 주입하기 때문이라, **옵션 3(BI confirmed_purchase 신규 + 구매완료 강등 + 7일 병행)이 진짜 정렬 답**임을 더 강하게 확인했소.

## Gap 재계산 표

| 시점 | platform ROAS | internal ROAS | gap | 비고 |
|---|---|---|---|---|
| **NPay 합류 전** (gpt0508-33 baseline) | 9.58 | 0.27 | **9.31** | NPay actual 누락 상태 |
| **NPay 합류 후** (이번 sprint) | 9.58 | **1.86** | **7.72** | gap 17% 축소 |
| **옵션 3 실행 후 추정** (단, Red 승인 후) | 약 2.5 ~ 3.5 | 1.86 | **약 0.7 ~ 1.7** | 학습 정렬 시작, 7일 후 재측정 필요 |

## 1. 왜 NPay 합류만으로는 부족한가

- 현재 platform conversion value 2억 2,673만 중 **99.99%**(2억 2,673만 65)가 `primary_known_npay`로 라벨링된 `구매완료(7130249515)` 메인 action에서 들어오오.
- 이 신호는 NPay 클릭/intent 성격을 입찰 학습에 직접 주입하므로 NPay actual 매출 ₩3,763만이 아무리 internal에 합류해도 platform 측 9.58은 그대로요.
- gap 7.72는 그래서 “플랫폼은 광고비 1원당 9.58원 매출이라 주장, 우리 운영DB는 1.86원 매출”이라는 차이고, 이 차이의 본체는 NPay click 오염이오.

## 2. 옵션 비교 (NPay 합류 후 갱신)

| 옵션 | 효과 | 자신감 | 단기 위험 |
|---|---|---|---|
| 옵션 1 (관찰 only) | 변화 0 | — | 0 |
| 옵션 2 (TechSol Off) | dashboard 표시 청소만, gap 거의 변화 없음 | 78% | 0 (이미 Secondary, conversions=0) |
| **옵션 3 (BI confirmed_purchase 신규 + 구매완료 강등 + 7일 병행)** | platform ROAS와 internal ROAS 정렬 시작, gap 약 6 → 약 1 수준으로 축소 추정 | **76%** (NPay 합류로 내부 앵커가 단단해져서 +4 상향) | 입찰 학습 2~3일 흔들림 |

## 3. Claude Code 추천

**옵션 3 본격 진행 추천.** 이유:
- NPay actual 합류만으로는 platform 측 NPay 클릭 오염이 풀리지 않는 게 본 sprint 데이터로 확정됨.
- internal anchor가 0.27 → 1.86으로 단단해져 옵션 3의 정렬 효과를 더 명확히 측정 가능.
- rollback은 Google Ads UI에서 원복 1회 클릭(자세히는 작업 4 산출 문서 6절 절차).

자신감: 76% (옵션 3 자체는 단기 학습 흔들림이 변수라 100% 도달 어려움).

미지 영역:
- '구매완료' 강등 시 다른 캠페인의 입찰 알고리즘이 BI confirmed_purchase로 재학습되는 속도
- Cloudflare Tunnel 또는 일관 입력 흐름이 변경 즉시 영향 받는지

## 4. 본 sprint 실행 범위

- Google Ads UI 변경: ❌ (Red 승인 범위 밖)
- 추천/근거 데이터: ✅ 갱신
- platform actual send: 0
- upload candidate: 0

## 5. 옵션 3 별도 Red 승인 문구

```
[승인] gpt0508-X 작업 Google Ads 옵션 3:
신규 conversion action 'BI confirmed_purchase' DRAFT 생성,
'구매완료(7130249515)' Secondary로 강등,
7일 병행 관찰.
upload는 본 승인에 포함되지 않음.
rollback은 동일 UI에서 원복.
```

## 6. 다음 액션

### TJ님이 할 일

1. 옵션 3 진행 결정 (Red Lane).
   - Claude Code 추천: 진행 추천
   - 자신감: 76%
   - Lane: Red
   - 의존성: TJ 사업 판단 (단기 입찰 흔들림 2~3일 감내 가능 여부)
   - 어디에서: https://ads.google.com/aw/conversions
   - Codex 대체 가능 여부: NO (Google Ads UI write 자격증명 부재)

### Claude Code가 할 일

1. (의존성: 위 1번 실행) 24h/72h/168h 후 dashboard read-only 비교 + ROAS 정렬 진행 측정.
   - 추천: 진행 추천
   - 자신감: 92%
   - Lane: Green

## 7. Verdict

`GAP_RECALCULATED_AFTER_NPAY_ACTUAL_OPTION_3_RECOMMEND_INCREASED`

산출 JSON: `data/google-ads-option3-gap-after-npay-actual-correction-20260511.json`
