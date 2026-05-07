# Coffee NPay 과거 매칭 종결 컨펌

작성 시각: 2026-05-07 12:28 KST
승인 시각: 2026-05-07 14:58 KST
요청 유형: Green decision confirmation
대상: 더클린커피 NPay 과거 매칭 Sprint
상태: approved / closed
데이터/DB 위치: Imweb v2 API, GA4 BigQuery `analytics_326949178`, 문서 리포트
운영DB 영향: 없음
외부 전환 전송: 없음
Codex 진행 추천 자신감: 92%

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
  lane: Green decision confirmation
  allowed_actions:
    - read-only evidence review
    - closure confirmation
    - documentation update
  forbidden_actions:
    - GA4/Meta/TikTok/Google Ads send
    - operating DB/ledger write
    - VM deploy
    - GTM publish
    - Naver API credential change
  source_window_freshness_confidence:
    source: "coffee-imweb-operational-readonly-20260501 + coffee-npay-unassigned-ga4-guard-20260501"
    window: "2026-04-23~2026-04-29 KST"
    freshness: "historical read-only fixed report"
    confidence: 0.92
```

## 10초 결론

TJ님 컨펌은 완료됐다.

**더클린커피 NPay 과거 매칭은 자동 복구 전송 없이 종결하고, 앞으로 들어오는 NPay intent 장부로 해결한다.**

이 결정은 GA4나 광고 플랫폼에 무언가를 보내는 승인이 아니다. 과거 2026-04-23~2026-04-29 window의 매칭 작업을 “분석 완료, 전송 금지, 미래 데이터로 이관”으로 닫는 결정이다.

승인된 문구:

```text
YES: Coffee NPay 과거 매칭은 자동 복구 전송 없이 종결하고, future intent/A-6로 넘긴다.
```

## 추천안

Codex 추천은 **YES**다.

```text
YES: Coffee NPay 2026-04-23~2026-04-29 과거 매칭 Sprint를 자동 복구 전송 없이 종결합니다.
Naver API 확인은 선택 보강으로 두고, Phase2 종결 조건에서 제외합니다.
다음은 NPay future intent A-5/A-6 단계로 진행합니다.
```

## 왜 이 결정을 추천하는가

실제 주문 원장과 GA4 이벤트는 총액만 비슷하고, 주문 단위 자동 매칭은 약하다.

| 항목 | 값 | 의미 |
|---|---:|---|
| Imweb NPay actual | 60건, 2,462,300원 | 실제 NPay 결제완료 주문 |
| GA4 NPay pattern | 58건, 2,359,300원 | GA4에 들어온 NPay형 purchase |
| one-to-one assigned | 42건 | 보수 기준에서만 배정 가능 |
| unassigned actual | 18건 | 자동 복구 전송 금지 |
| unassigned GA4 | 16건 | 실제 주문 자동 배정 불안정 |
| order/channel robust guard | 36/36 robust_absent | 실제 주문번호가 GA4 raw에 직접 없음 |

핵심은 GA4 transaction_id가 실제 주문번호가 아니라 `NPAY - ...` 형태의 synthetic 값이라는 점이다. 그래서 과거분을 억지로 복구하면 중복 purchase 또는 오탐 purchase 위험이 크다.

## YES를 누르면 무엇이 바뀌는가

문서 상태만 바뀐다.

- `data/!coffeedata.md`의 Phase2를 closure로 올릴 수 있다.
- `data/coffee-npay-historical-matching-closure-20260507.md`를 Phase2 종결 근거로 고정한다.
- Naver API 확인은 `Parked / Optional`로 내려간다.
- 다음 실제 작업은 A-5 monitoring closure와 A-6 no-send dry-run으로 이동한다.

## YES를 눌러도 하지 않는 것

아래는 계속 금지다.

- GA4에 과거 purchase 보내기
- Meta CAPI purchase 보내기
- TikTok Events API 보내기
- Google Ads conversion 보내기
- 운영 DB/ledger write
- VM deploy
- GTM publish
- Naver API production credential 신청/변경

## 승인 기록

TJ님은 아래 방향을 승인했다.

```text
YES: Coffee NPay 과거 매칭은 자동 복구 전송 없이 종결하고, future intent/A-6로 넘긴다.
```

따라서 NO 선택지였던 Naver API 확인 대기, ambiguous manual review 확대, 과거 복구 후보 추가 생성은 이번 Sprint 범위에서는 선택하지 않는다. 필요하면 별도 Sprint로 다시 열 수 있지만, 현재 정본에서는 Phase2 종결 조건이 아니다.

## 승인 후 Codex 작업

TJ님이 YES를 줬으므로 Codex가 아래 문서 반영을 진행한다.

1. `data/!coffeedata.md` Phase2 상태를 100% / 100%로 변경한다.
2. 다음 할일에서 Phase2 관련 항목을 제거한다.
3. `Completed Ledger`에 `Coffee NPay historical matching closed`를 추가한다.
4. 이후 작업은 Phase3 A-5 monitoring closure와 Phase4 A-6 no-send dry-run으로 이어간다.

## Auditor verdict

```text
Auditor verdict: CLOSED_APPROVED
Project: coffee-data
Phase: Coffee NPay historical matching closure
Lane: Green decision confirmation

No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Approval needed:
- none

Not approved by this document:
- platform send
- GTM publish
- DB/ledger write
- VM deploy
```
