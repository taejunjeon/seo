# Google Ads TechSol Secondary→Off pre-audit 결과 (gpt0508-35)

작성 시각: 2026-05-10 23:00:00 KST
실행 상태: **read-only pre-audit 완료, 실제 UI 변경은 TJ 수행 필요**
자신감: 88% (TechSol Off 자체는 안전, 다만 ROAS gap의 진짜 원인은 다른 곳에 있다는 확신)

## 5줄 결론 (사람이 이해하는 언어로)

1. 어제 sprint에서 “TechSol – NPAY구매 50739 라는 광고 전환 항목을 보조(Secondary)로 내리거나 끄자”는 옵션을 제안했었소. 이번에 read-only로 깊이 audit한 결과, **이 항목은 이미 Secondary**(`primary_for_goal=false`, conversions=0)였소.
2. 즉 Google Ads의 입찰 학습은 이 항목을 이미 안 쓰고 있고, dashboard 표시(All conv. value)에만 ₩1.91억이 잡혀 보이고 있는 상태요.
3. **ROAS 차이(플랫폼 9.58 vs 내부 0.27)의 진짜 원인은 TechSol이 아니라 `구매완료(7130249515)` 라는 메인 전환 항목이오.** 이게 입찰 학습에 들어가고 conversion value 2.27억(99.99%)을 차지하오.
4. 그래서 옵션2(TechSol을 Off)는 “화면 표시값을 깨끗이 정리”하는 효과는 있지만, 진짜 ROAS 정렬을 위해선 옵션3(새 BI confirmed_purchase 전환 만들고 ‘구매완료’를 Secondary로 내리고 7일 병행)이 필요하오.
5. 본 sprint에서는 실제 UI 변경 0(승인은 받았지만 Codex가 Google Ads UI write 권한이 없음). 산출물에 TechSol 변경 절차와 옵션3 추천을 같이 담았소.

## 1. 무엇을 / 왜 / 어떻게

| 항목 | 값 |
|---|---|
| 무엇을 | conversion action 7564830949 (TechSol - NPAY구매 50739) read-only pre-audit |
| 왜 | 어제 옵션2 추천을 검증하기 전에 입찰 의존도, 다른 Primary action 영향, rollback 단순성을 실제 데이터로 확인해야 함 |
| 어떻게 | VM Cloud Google Ads dashboard last_30d API 호출 → conversionActionSegments에서 7564830949 추출 |
| 어디에서 | `https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_30d` (Google Ads API v22 read-only) |

## 2. TechSol pre-audit (사람이 이해하는 표)

| 항목 | 값 | 의미 |
|---|---|---|
| Action ID | `7564830949` | Google Ads 내부 ID |
| 이름 | `TechSol - NPAY구매 50739` | NPay 구매 라벨 |
| 상태 | ENABLED | 켜져 있음 |
| **primary_for_goal** | **false** | **입찰 학습에 직접 들어가지 않음** |
| 카테고리 | PURCHASE | 구매 분류 |
| conversions (30d) | **0** | Primary count는 0 |
| conversionValue (30d) | **₩0** | Primary value는 0 |
| allConversions (30d) | 1,960.1 | All conversions에는 잡힘 |
| allConversionValue (30d) | **₩1억 9,147만** | All conv. value 표시 |
| 연결된 캠페인 | 5개 | PM/SA 캠페인 모두 |
| classification | secondary_known_npay | 보조 NPay 라벨 |
| riskFlags | known_npay_label, all_conversions_only_value | NPay 클릭 의심 |

핵심 관찰:
- **이미 Secondary다.** Primary 신호로 학습되지 않는다.
- All conv. value에만 ₩1.91억이 잡혀 dashboard 표시값을 부풀린다.

## 3. 진짜 ROAS gap의 원인

| 항목 | 값 |
|---|---|
| Action ID | `7130249515` |
| 이름 | `구매완료` |
| 상태 | ENABLED |
| **primary_for_goal** | **true** |
| 카테고리 | PURCHASE |
| conversions (30d) | 2,210.99 |
| conversionValue (30d) | **₩2억 2,673만** (99.99% of platform conv. value) |
| classification | **primary_known_npay** |
| riskFlags | known_npay_label, **primary_bid_signal_is_npay** |
| 연결된 캠페인 | 5개 |

이 action이 진짜 입찰 학습 본체. ROAS gap 9.58 → 0.27의 차이를 만드는 게 이 항목의 NPay 오염이오.

## 4. 그래서 옵션 1/2/3 다시 정리

| 옵션 | 효과 | 입찰 학습 영향 | 추천 |
|---|---|---|---|
| 옵션 1 (관찰 only) | 변화 0 | 0 | 안전하지만 병목 못 풂 |
| 옵션 2 (TechSol Off) | dashboard 표시값에서 ₩1.91억 사라짐, platform ROAS 9.58 → 약 7.5~8 추정 | 거의 없음 (이미 Secondary) | 표시 정리용. 추천 자신감 78% |
| 옵션 3 (BI confirmed_purchase 신규 + 구매완료 Secondary + 7일 병행) | platform ROAS와 internal confirmed ROAS 정렬 시작 | 단기 흔들림 2~3일 | **진짜 정렬용. 추천 자신감 72%** |

## 5. 안전성 검증

- TechSol Off는 다른 Primary PURCHASE action(예: 구매완료 7130249515)에 영향 없음. 별도 ID.
- rollback은 동일 UI 화면에서 Off→Secondary 복귀 1회 클릭.
- confirmed_purchase upload, GTM publish, 운영DB write, 외부 전송 모두 0 유지.

## 6. TJ님이 직접 해야 하는 작업

이건 Codex가 대신 못 하오 (Google Ads UI write 자격증명 없음).

```
URL: https://ads.google.com/aw/conversions
필터: 이름 검색 "TechSol" 또는 ID "7564830949"
현재: ENABLED · Secondary (primary_for_goal=false) · 5 캠페인 Conversion Goal 연결
대상: ENABLED → Off (exclude from bidding) · Conversion Goal 연결 해제
Rollback: 동일 화면에서 다시 Secondary로 복귀
24h smoke: VM dashboard last_7d/last_30d 호출 비교
```

## 7. 다음 할일

### TJ님이 할 일
1. 옵션 2(TechSol Off)를 표시값 정리용으로 가벼운 마음으로 진행할지, 아니면 옵션 3(구매완료 재분류)을 별도 sprint로 본격 진행할지 결정.
   - 추천: 옵션 3 본격 진행 추천 (단, 입찰 학습 흔들림을 감내할 수 있을 때)
   - 자신감: 옵션 2 78% / 옵션 3 72%
   - Lane: Red (Google Ads conversion action 변경)
   - 의존성: TJ 사업 판단 (입찰 안정성 vs ROAS 신뢰도)

2. 옵션 2 진행 결정 시: 6절 절차로 UI 변경 + 24h smoke.
   - 자신감: 78%
   - 성공 기준: 24h 후 platform ROAS 5~15% 하락, internal confirmed ROAS 변동 0
   - 실패 시 해석: 광고비 분배가 특정 캠페인에 급변하거나 5xx 발생 → rollback

### Codex가 할 일
1. TJ가 옵션 2 또는 옵션 3 진행 결과를 알려주면 next sprint(gpt0508-36 또는 -37)에서 24h smoke 결과 audit + dashboard delta 분석.
   - 추천: 진행 추천
   - 자신감: 90%
   - Lane: Green
   - 의존성: TJ UI 변경 결과

## 8. Verdict

`PRE_AUDIT_PASS_TECHSOL_OFF_OPTIONAL_REAL_GAP_FIX_NEEDS_OPTION_3`

산출 JSON: `data/google-ads-techsol-secondary-off-preaudit-or-result-20260511.json`
