# GDN Auditor Checklist

작성 시각: 2026-05-03 22:25 KST
상태: v0 기준판
목적: Google Ads/GDN ROAS 정합성 작업 종료 전 hard fail과 residual risk를 확인한다
관련 문서: [[harness/gdn/README|GDN Harness]], [[harness/gdn/RULES|GDN Rules]], [[harness/gdn/VERIFY|GDN Verify]], [[harness/gdn/APPROVAL_GATES|GDN Approval Gates]]

## 10초 요약

Auditor는 결과가 맞아 보이는지보다 금지선을 넘지 않았는지를 먼저 본다.

특히 Google Ads conversion upload, 전환 액션 변경, GTM publish, 운영 DB write가 승인 없이 발생하면 hard fail이다.

## Hard Fail

| 체크 | FAIL 조건 |
|---|---|
| Google Ads send | 승인 없는 conversion upload 또는 adjustment upload |
| Google Ads mutate | 승인 없는 conversion action/campaign/budget/status 변경 |
| GTM publish | 승인 없는 Production publish |
| 운영 DB write | 승인 없는 INSERT/UPDATE/DELETE/import apply |
| platform send | 승인 없는 GA4/Meta/TikTok 전송 |
| deploy | 승인 없는 VM/backend deploy |
| env | 승인 없는 운영 `.env` 변경 또는 영구 flag |
| stale GTM | 7일 이상 stale snapshot으로 tracking 결론 |
| mixed ROAS | `Conv. value`, `All conv. value`, internal confirmed를 섞어 운영 ROAS로 사용 |
| NPay label | known NPay label을 confirmed purchase로 승격 |
| view-through | view-through only를 click confirmed ROAS로 승격 |
| dirty files | unrelated dirty files를 staged/commit에 포함 |

## Soft Fail / Notes

| 체크 | Notes 조건 |
|---|---|
| Attribution VM blocked | 내부 ROAS confidence 낮춤 |
| Google Ads API blocked | CSV fallback 사용, platform confidence 낮춤 |
| GA4 raw blocked | GA4 guard unknown |
| campaign mismatch | historical/removed/other account 가능성 기록 |
| pending/canceled 존재 | 메인 분자 제외, 별도 표기 |
| 당일 Google Ads 데이터 | 보정 가능성 기록 |

## 필수 보고 항목

| 항목 | 필요 |
|---|---|
| Project | `gdn` |
| Phase | Phase0~Phase5 또는 설명 |
| Lane | Green / Yellow / Red |
| Mode | read-only / dry-run / approval-draft / smoke / live |
| No-send verified | YES/NO |
| No-write verified | YES/NO |
| No-deploy verified | YES/NO |
| No-publish verified | YES/NO |
| No-platform-send verified | YES/NO |
| Source/window/freshness | 필수 |
| Changed files | 필수 |
| Unrelated dirty files excluded | YES/NO |

## 숫자 검사

결과 보고서에는 아래를 분리해서 적는다.

| 항목 | 분리 여부 |
|---|---|
| Google Ads cost | 필수 |
| `Conv. value` | 필수 |
| `All conv. value` | 필수 |
| view-through conversions | 필수 |
| internal confirmed revenue | 필수 |
| pending/canceled | 필수 |
| primary NPay label value | 가능하면 필수 |
| secondary NPay all-conv value | 가능하면 필수 |

## 전환 액션 검사

| 항목 | 필수 |
|---|---|
| action id | 있음 |
| action name | 있음 |
| category | 있음 |
| primary_for_goal | 있음 |
| send_to / label | 있음 또는 없음 명시 |
| click/view-through lookback | 있음 |
| conversions / value / all value | 있음 |
| classification | `primary_known_npay`, `secondary_known_npay`, `helper_action`, `unknown_purchase` 등 |

## 승인안 검사

승인안에는 아래가 있어야 한다.

1. 추천안이 YES/NO로 답할 수 있다.
2. 범위가 action/order/platform 단위로 좁다.
3. 금지 범위가 명시되어 있다.
4. rollback 또는 rollback 한계가 있다.
5. post-action verification 방법이 있다.
6. source/window/freshness/confidence가 있다.
7. 7~14일 관찰 기준이 있다.

## Auditor Verdict Template

```text
Auditor verdict: PASS | PASS_WITH_NOTES | FAIL_BLOCKED | NEEDS_HUMAN_APPROVAL
Project: gdn
Phase:
Lane:
Mode:

No-send verified:
No-write verified:
No-deploy verified:
No-publish verified:
No-platform-send verified:

Changed files:
- ...

Source / window / freshness:
- source:
- window:
- freshness:
- site:
- confidence:

What changed:
- ...

What did not change:
- ...

Smoke / validation:
- ...

Unrelated dirty files excluded:
- YES/NO

Notes:
- ...

Next actions:
Green:
- ...
Yellow:
- ...
Red:
- ...
```
