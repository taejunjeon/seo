# Click evidence capture gap audit (gpt0508-40 작업1)

작성 시각: 2026-05-11 12:00:00 KST
실행 상태: read-only audit / verdict `MIXED`
자신감: 90%

## 한 줄 결론

코드 매핑 버그는 없소(gclid/gbraid/wbraid/ttclid/nclick_id 모두 두 helper에서 커버). 그러나 본 sprint canary 신규 9 row 중 어느 것도 `paid_click_intent_ledger`의 같은 `ga_session_id`와 매칭되지 않아 동일 세션 paid_intent bridge가 0건이오. 즉 click 부재는 “표본이 organic이거나” 또는 “imweb 결제 페이지 origin 차이로 ga_session_id가 끊겼거나” 둘 다 가능 — verdict `MIXED`. TJ controlled traffic (광고 클릭 → 결제)로 판별 가능.

## 1. 코드 흐름 audit

| 영역 | 결과 |
|---|---|
| `recordPaymentSuccessOrderBridgeLedger` click_id 추출 | gclid / gbraid / wbraid / ttclid / nclick_id / click_id / clickId 7가지 변형 모두 커버 |
| `buildOrderBridgeIdentityHmacMaterial` click_id 추출 | 동일 7가지 변형 커버 |
| **매핑 버그** | **없음** (CLICK_PRESENT_MAPPING_BUG = 0) |

## 2. footer payload 흐름

footer `biocomimwebcode.md` Block 3:
```
tracking.gclid = firstNonEmpty([base.gclid, params.get('gclid')])
where base = lastTouch (_p1s1a_last_touch localStorage)
           + imwebSession (__bs_imweb_session sessionStorage)
           + URL params
```

다중 fallback 정상 설계. 손실 가능 시나리오 4가지:
1. 결제완료 페이지가 광고 landing과 다른 origin → sessionStorage 키 손실
2. `_p1s1a_last_touch` 가 다른 페이지에서 초기화
3. URL params가 redirect 흐름에서 사라짐
4. 사용자가 광고 클릭 없이 직접 URL/즐겨찾기로 결제 (organic / direct)

## 3. paid_click_intent_ledger cross-check

| 항목 | 값 |
|---|---|
| 누적 row | 3,656 |
| 2026-05-10 이후 누적 | **1,183** |
| 광고 클릭 landing 자체 wire | 정상 동작 |

paid_click_intent_ledger는 광고 클릭 landing 시점에 정상 누적 중. 광고 traffic 자체는 사이트에 풍부.

## 4. 11 R2 ledger row vs paid_click_intent_ledger 세션 매칭

method: `order_bridge_ledger.ga_session_id == paid_click_intent_ledger.ga_session_id` raw 직접 일치 (VM SQLite 내부에서)

| bridge_id (prefix 8) | status | paid_intent match | with click_hash | note |
|---|---|---|---|---|
| 658e925e | received | 5 | 5 | 2026-05-09 Tag Assistant evidence |
| f32cb09c | identity_only_quarantine | 5 | 5 | 2026-05-09 Tag Assistant evidence |
| 나머지 9건 | various | **0** | n/a | 본 sprint canary 신규 |

- **session match total**: 2/11
- **매칭 row 둘 다 5/9 Tag Assistant controlled traffic** — 본 sprint canary 신규 9 row는 0
- **동일 세션 paid_intent bridge 가능성**: 본 sprint scope 0

## 5. verdict 후보 평가

| 후보 | 평가 |
|---|---|
| CLICK_MISSING_ORGANIC_SAMPLE | **확률 높음** — 야간/주간 1h 표본 organic 가능 |
| CLICK_PRESENT_MAPPING_BUG | 0 — 코드 정상 |
| **CLICK_PRESENT_STORAGE_LOST_AT_CHECKOUT** | **가능성 있음** — imweb 결제 origin 차이 |
| CLICK_PRESENT_PAID_INTENT_ONLY | 0 — paid_intent 매칭 자체 0 |
| CLICK_SOURCE_BLOCKED | n/a |

→ **최종 verdict: `MIXED`** (organic + storage_lost 둘 다 가능)

## 6. 사람이 이해하는 결론

이번 sprint canary에서 광고 클릭 흔적 0건 나온 게 “사이트가 광고 클릭을 잃었다”인지 “손님들이 그냥 직접 들어와 결제했다”인지 **딱 잘라 말할 수 없소**. 두 가설을 가르는 가장 빠른 방법은 **TJ님이 직접 Google Ads 광고 1회 클릭 → 같은 흐름으로 결제 1건** 진행하는 것이오. 그 결제가 ledger에 들어왔을 때 `click_id_hash`가 살아 있으면 → organic 가설 / 죽었으면 → storage_lost 가설.

## 7. 다음 patch 후보

| 후보 | 효과 | Lane |
|---|---|---|
| **정점 canary + TJ controlled traffic** (작업 6) | 가설 판별 1번에 가능 | Yellow (이미 승인) |
| paid_click_intent bridge wire (작업 3) | 본 sprint 효과 0이지만 다음 sprint 표본 확보 후 효과 측정 | Green code |
| footer storage_lost 진단 | TJ traffic에서 click 또 없으면 imweb origin 점검 | Yellow proposed |

## 8. invariants 검증

| invariant | 결과 |
|---|---|
| raw email/phone/order/click_id 응답 노출 | 0 |
| 운영DB write | 0 |
| hash 역산 시도 | none |
| send_candidate / actual_send_candidate / upload_candidate | 0 / 0 / 0 |

## 9. 다음 액션

### Claude Code가 할 일

1. (작업 2) builder wire integration — helper 3개를 builder 안에 통합
2. (작업 3) paid_click_intent bridge helper 작성 (본 sprint 11 row 효과는 0이지만 다음 sprint를 위해 준비)
3. (작업 4) Google Ads click_view raw fetch 가능성 검토
4. (작업 5) builder dry-run v2 실행
5. (작업 6) 정점 canary 시작 + TJ controlled traffic 가이드 작성

### TJ님이 할 일

**(우선) Google Ads 광고 클릭 → 같은 흐름으로 결제 1건 controlled traffic**
- 추천: 진행 추천 / 자신감 95%
- 목표: organic vs storage_lost 가설 1번에 판별
- 절차는 작업 6 결과 산출물에 상세 박음

## 10. Verdict

`MIXED_PRIORITIZE_TJ_CONTROLLED_TRAFFIC_PROBE`

산출 JSON: `data/click-evidence-capture-gap-audit-20260511.json`
