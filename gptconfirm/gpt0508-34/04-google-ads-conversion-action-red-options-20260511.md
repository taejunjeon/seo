# Google Ads conversion action Red 옵션 3가지 (gpt0508-34)

작성 시각: 2026-05-10 22:30:00 KST
Lane: 본 산출물은 Green(packet 작성). 실제 변경은 Red 승인 게이트.
자신감: 78% (TechSol action에 의존하는 Conversion Goal 매핑이 미지)

## 5줄 결론

1. ENABLED + primary_for_goal=true PURCHASE는 사실상 `구매완료(7130249515)` 1개로 보인다. 이 신호의 원천 확인 전에는 변경 위험이 크다.
2. `TechSol - NPAY구매 50739(7564830949)`는 Secondary지만 NPay click/intent 성격이라 platform ROAS를 부풀일 수 있다.
3. Red 옵션을 3개로 분리했다 — 관찰 only / Secondary 단계 제외 / 신규 confirmed_purchase action + 기존 오염 재분류.
4. 추천 옵션은 **옵션 2(Secondary 단계 제외 + 24h smoke)**, 자신감 78%.
5. 실제 변경은 본 sprint에서 실행 안 한다. 승인 문구를 7~9절에 그대로 박아 TJ가 복사 사용 가능.

## 1. 현재 conversion action audit (46개)

### 1.1 ENABLED + primary_for_goal=true PURCHASE
| id | name | 비고 |
|---|---|---|
| 7130249515 | 구매완료 | 현재 입찰 학습 가장 영향 큰 신호로 추정 |

### 1.2 ENABLED + primary_for_goal=false PURCHASE
| id | name | 비고 |
|---|---|---|
| 7564830949 | TechSol - NPAY구매 50739 | Secondary, NPay click 성격 의심 (이전 audit risk MEDIUM) |

### 1.3 HIDDEN/legacy 주요 항목
| id | name | category | primary | 비고 |
|---|---|---|---|---|
| 781508597 | 결제완료 (전체 웹사이트 데이터) | DEFAULT | true | HIDDEN |
| 781508600 | 결제페이지 진입 (전체 웹사이트 데이터) | DEFAULT | true | actual purchase 아님 |
| 6630514046 | [G4] biocom.kr (web) 결제완료 | PURCHASE | false | HIDDEN |
| 6630514043 | [G4] biocom.kr (web) 결제페이지_진입 | DEFAULT | false | HIDDEN |
| 782218494 | Transactions (A_view) | PURCHASE | true | HIDDEN |
| 917325117 | Transactions (전체 웹사이트 데이터) | PURCHASE | true | HIDDEN |

## 2. 옵션 1 — 관찰 only

| 항목 | 값 |
|---|---|
| Google Ads 변경 | 0 |
| 추가 작업 | frontend Data Trust Guard에 NPay click warning(이번 sprint patch에 이미 반영) |
| 장점 | 위험 0, rollback 불필요, 학습 흔들림 0 |
| 위험 | NPay click 오염이 platform ROAS에 계속 남음, ROAS gap 축소 0, missing 2,121건은 그대로 |
| 예상 영향 | platform ROAS 11.7→11.7, internal confirmed ROAS 0.4→0.4, gap 그대로 |
| Rollback | n/a |

승인 문구:
```
[승인] gpt0508-34 작업4 옵션1:
Google Ads 변경 없음, frontend Data Trust Guard만 추가.
```

쓰는 시점: TJ가 광고 학습 안정성을 최우선으로 둘 때.

## 3. 옵션 2 — TechSol Secondary action을 입찰 제외 또는 Off (추천)

| 항목 | 값 |
|---|---|
| 변경 대상 | `7564830949 TechSol - NPAY구매 50739` |
| 변경 내용 | Conversion Goals 적용을 Secondary→`exclude from bidding` 또는 `Off` |
| 다른 PURCHASE 13개 | 손대지 않음 |
| 장점 | NPay click 오염 단계적 제거, primary 학습 흐름 보존, single-action rollback |
| 위험 | TechSol action 의존 캠페인 학습 흔들림 가능, 24~48h conversion volume 변동, ROAS 분자 일시 감소 |
| 예상 영향 | platform ROAS 5~15% 하락, internal confirmed ROAS 변동 없음, ROAS gap 축소 |
| Rollback | UI에서 Secondary→원래 상태 복귀 (7일 내 학습 회복) |

Smoke 24h:
- dashboard last_7d 비교: TechSol all_conversion_value 감소 폭
- internal_confirmed_roas 변동 없음 확인
- 캠페인별 cost 분포 급변 여부

승인 문구:
```
[승인] gpt0508-34 작업4 옵션2:
Google Ads UI에서 conversion action 7564830949(TechSol - NPAY구매 50739)을
Secondary 또는 Off로 전환, 24h dashboard 모니터링,
광고비 분배 급변 시 즉시 rollback.
```

쓰는 시점: TJ가 NPay click 오염 제거를 단계적으로 시도하고 싶을 때.

## 4. 옵션 3 — confirmed_purchase 전용 신규 action + 7일 병행 관찰

| 항목 | 값 |
|---|---|
| 변경 (a) | 신규 conversion action `BI confirmed_purchase` 생성, category PURCHASE, status DRAFT |
| 변경 (b) | TechSol Secondary→Off |
| 변경 (c) | 7일 신규 action 데이터 적재 (upload는 별도 Red 승인) |
| 변경 (d) | 7일 PASS 시 신규 action을 Primary로 승격 |
| 장점 | matched 31건이 정확 분리 학습, long-term gap 축소 효과 가장 큼, platform vs internal 구조적 분리 |
| 위험 | 단기 학습 2~3일 흔들림, DRAFT→Primary 승격 시 cost/conversion 분배 급변 |
| 예상 영향 | 단기 platform ROAS ±10~20%, 7일 후 ROAS gap 30~50% 축소 |
| Rollback | 신규 action DRAFT 되돌리기 + TechSol 원복 |

승인 문구:
```
[승인] gpt0508-34 작업4 옵션3:
confirmed_purchase 전용 conversion action 'BI confirmed_purchase' 신규 생성(DRAFT),
TechSol Secondary→Off, 7일 병행 관찰,
upload는 별도 Red 승인 후 진행.
```

쓰는 시점: TJ가 platform ROAS 신뢰도 자체를 구조적으로 회복하고자 할 때.

## 5. 추천 옵션과 자신감

- 추천: **옵션 2** (Secondary 단계 제외 + 24h smoke)
- 자신감: **78%**
- 미지: TechSol action을 사용하는 Conversion Goal에 다른 캠페인이 의존하는지 (UI 진입 후 확인 필요), 변경 후 입찰 알고리즘 학습 회복 기간이 정확히 며칠인지.

이유:
- 옵션 1은 병목을 안 푼다.
- 옵션 3은 구조 변경 폭이 커 회복 기간 길고 동시 변경 위험이 크다.
- 옵션 2는 단계적 제거 + rollback 단순 + 학습 흔들림을 1~2일 안에 흡수 가능.

## 6. 금지 (승인 전)

- Google Ads conversion action 실제 변경
- Google Ads confirmed_purchase upload
- GTM Production publish
- platform actual send

## 7. Verdict

`RED_OPTIONS_READY_PENDING_HUMAN_GATE`

산출 JSON: `data/google-ads-conversion-action-red-options-20260511.json`
