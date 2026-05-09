# Harness patch summary

작성 시각: 2026-05-10 00:43 KST

## 한 줄 결론

gpt0508-18의 제안안을 실제 하네스 정본 문서에 반영했습니다. 핵심은 HOLD Reducer와 GTM workspace lifecycle을 다음 작업부터 보고/검증/auditor 기준으로 쓰게 만든 것입니다.

## 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `AGENTS.md` | HOLD 결과를 바로 TJ님 승인 대기로 넘기지 말고 Green follow-up을 먼저 수행하라는 상위 원칙 추가 |
| `harness/common/AUTONOMY_POLICY.md` | HOLD Reducer Rule, HOLD taxonomy, 필수 보고 필드 추가 |
| `harness/common/REPORTING_TEMPLATE.md` | HOLD Reducer 보고 섹션과 다음 액션 판단 질문 추가 |
| `docs/report/text-report-template.md` | HOLD Reducer 섹션, GTM Workspace Lifecycle 섹션, 다음 액션 판단 질문 추가 |
| `docurule.md` | Blocked/Parked 전에 Green으로 줄일 수 있는 원인을 먼저 줄이는 문서 규칙 추가 |
| `harness/gdn/RULES.md` | Path B HOLD Reducer와 GTM Workspace Lifecycle Rule 추가 |
| `harness/gdn/VERIFY.md` | GTM workspace lifecycle 검증 항목 추가 |
| `harness/gdn/APPROVAL_GATES.md` | GTM Preview Workspace Gate 추가 |
| `harness/gdn/AUDITOR_CHECKLIST.md` | HOLD Reducer 누락과 GTM workspace lifecycle 위반 검사 추가 |

## 새로 강제되는 행동

1. HOLD는 최종 상태가 아닙니다.
2. HOLD가 나오면 `hold_reason_category`를 적습니다.
3. Green으로 가능한 follow-up은 자동 수행합니다.
4. 보고서에는 `auto_green_followups_done`을 남깁니다.
5. 남은 작업이 Yellow/Red/권한/사업 판단일 때만 TJ님에게 넘깁니다.
6. GTM Preview는 Default Workspace를 쓰지 않습니다.
7. fresh workspace 생성 전 VM Cloud write flag를 ON으로 바꾸지 않습니다.
8. Preview 성공은 Production publish 승인으로 해석하지 않습니다.

## 적용 예시

Path B click bridge가 HOLD이면 바로 Google Ads 전송 승인 대기로 넘기지 않습니다.

먼저 아래 Green follow-up을 수행합니다.

- order bridge와 paid click intent ledger join dry-run.
- click storage/source audit.
- same-browser preservation 설계.
- ambiguous/time-window-only 후보 분리.

그 뒤에도 실제 광고 클릭/실제 결제/Production publish가 필요하면 그때만 Yellow/Red로 올립니다.

## 하지 않은 것

- `harness/common/HARNESS_GUIDELINES.md`에는 GTM Workspace Hygiene Rule이 이미 있어 중복 patch하지 않았습니다.
- `harness/npay-recovery/*`는 이번 GDN/Path B 이슈의 직접 대상이 아니어서 수정하지 않았습니다.
- 자동 auditor script는 아직 만들지 않았습니다.
