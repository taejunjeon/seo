# Growth Data Agent Reporting Template v1.1

작성 시각: 2026-05-02 23:12 KST
최근 업데이트: 2026-05-06 15:20 KST
목적: 작업 완료 보고, 승인 요청, Auditor verdict의 공통 형식
상태: 공통 하네스 기준판

## 사용 원칙

보고서는 결론 -> 범위 -> 검증 -> 리스크 -> 다음 액션 순서로 쓴다.

숫자나 판단에는 source / window / freshness / confidence를 붙인다.

운영DB, TJ 관리 Attribution VM, 로컬 개발 DB는 항상 구분해서 쓴다.

## 최종 보고 양식

```md
## 한 줄 결론

- 결론:
- Project:
- Phase:
- Lane:
- Mode:
- Auditor verdict:
- 자신감:
- 기준 시각:

## 완료한 것

| 항목 | 결과 | 근거/파일 | 데이터/DB 위치 |
|---|---|---|---|
|  | 완료 / 부분 완료 |  | 운영DB / TJ 관리 Attribution VM / 로컬 개발 DB / 외부 API / 해당 없음 |

## 프롬프트에 있거나 시도했으나 완료하지 못한 것

| 항목 | 상태 | 못 끝낸 이유 | 다음 판단 |
|---|---|---|---|
|  | 미완료 / 보류 / 불가 | 권한 부족 / 데이터 부족 / 승인 필요 / 구조상 불가 / 시간 부족 | 다시 시도 / TJ 확인 필요 / 종료 |

## 하지 않은 것

| 항목 | 상태 |
|---|---|
| No-send verified | YES / NO |
| No-write verified | YES / NO |
| No-deploy verified | YES / NO |
| No-publish verified | YES / NO |
| No-platform-send verified | YES / NO |

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source |  |
| window |  |
| freshness |  |
| site |  |
| confidence |  |

## 변경 파일

| 파일 | 변경 내용 | 범위 내 여부 |
|---|---|---|
|  |  | YES / NO |

## 검증 근거

| 검증 | 결과 | 명령/방법 | 비고 |
|---|---|---|---|
|  | 통과 / 실패 / 미실행 |  |  |

## 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
|  |  |  |

## 다음 액션

다음 액션을 제시하기 전에 먼저 판단한다.

- 데이터가 충분한가:
- 더 조사할 것이 있는가:
- 지금 바로 진행해도 되는가:
- 이미 승인된 Yellow Lane인가:
- 승인된 Yellow라면 실행을 시도했는가:
- 실행하지 않았다면 승인 부족이 아니라 접근/권한/기술 blocker인가:
- blocker라면 어느 단계에서 막혔는가:
- 진행 추천 자신감:
- 사용자가 직접 해야 하는 일이 있는가:
- 그 일을 Codex가 대신할 수 있는가:
- 대신할 수 없다면 이유:
- 사용자가 열어야 하는 화면/URL/문서/DB 위치:
- 성공으로 볼 화면/로그/row 기준:
- 실패했을 때 가장 먼저 볼 것:
- 다른 에이전트 검증이 필요한가:
- 필요하다면 이유:
- 다음 할일만 보고 추가 질문 없이 실행 가능한가:
- 필요한 URL/명령/검색어/필터/ID/order_code/ttclid/DB 경로가 빠지지 않았는가:
- 300줄을 넘는가:
- 300줄을 넘는다면 별도 상세 문서 경로와 이 답변의 요약 범위:

| Lane | 옵션 | 추천도/자신감 | 담당 | 무엇을 하는가 | 왜 하는가 | Codex가 대신 가능한가 | 어떻게 하는가 | 어디에서 확인하나 | 성공 기준 | 실패 시 해석/대응 | 다른 에이전트 검증 | 승인 필요 |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|
| Green | A | 90% | Codex |  |  | YES / NO, 이유 |  | 화면/URL/DB/문서 |  |  | 불필요 / 권장, 이유 | NO |
| Yellow | B | 80% | TJ + Codex |  |  | YES / NO, 이유 |  | 화면/URL/DB/문서 |  |  | 불필요 / 권장, 이유 | YES, sprint 승인 |
| Red | C | 50% | TJ |  |  | 대체 불가 / 제한적 가능, 이유 |  | 화면/URL/DB/문서 |  |  | 권장, 이유 | YES, 명시 승인 |
```

## 다음 액션 작성 규칙

다음 액션은 사용자가 바로 움직일 수 있게 쓴다.

- 한 줄 액션명만 쓰지 않는다.
- 모든 대화 턴에서 다음 단계가 남아 있으면 적용한다. 최종 보고뿐 아니라 중간 보고, 상태 답변, 검증 결과 답변에서도 다음 할일을 이해하기 쉽게 서술한다.
- 단순히 “다음은 X”라고 쓰지 말고 사용자가 바로 움직일 수 있는 수준으로 쓴다.
- `무엇을/왜/어떻게/어디에서/누가/승인 필요 여부/성공 기준/실패 시 해석`을 포함한다.
- 가급적 추가 질문 없이 실행할 수 있도록 텍스트 출력 안에 필요한 URL, 명령, 검색어, 필터, 화면 이름, ID, order_code, ttclid, DB 경로를 포함한다.
- 300줄을 넘어갈 정도로 길면 별도 상세 문서를 만들고, 대화에는 핵심 요약을 쓴다. 요약도 사람이 대략 무엇을 해야 하는지 알 수 있게 쓴다.
- 다음 할일을 출력하기 전에 양식과 조건이 갖춰졌는지 한 번 더 자체 체크한다. URL/명령/확인값이 빠졌으면 출력 전에 보완한다.
- 반드시 `TJ님이 할 일`과 `Codex가 할 일`을 분리한다.
- TJ님에게 요청하기 전, Codex가 API, VM, 로컬 파일, 로그, DB read-only, 자동화 스크립트로 대신 할 수 없는지 한 번 더 판단한다.
- TJ님에게만 가능한 일이라면 왜 대체 불가인지 짧게 적는다.
- 사용자가 직접 해야 하는 액션이면 버튼, 메뉴, URL, 검색어, 필터, 확인 문구를 적는다.
- DB를 확인해야 하면 운영DB / TJ 관리 Attribution VM / 로컬 개발 DB 중 어디인지 절대 생략하지 않는다.
- 결과보고서 문서가 있으면 최종 답변에도 그 다음 액션을 충분히 요약한다. 문서 링크만 제공하지 않는다.
- 이미 승인된 Yellow Lane은 `다음에 승인받기`로 쓰지 않는다. 실행을 시도한 뒤 `성공`, `실패 지점`, `접근 blocker` 중 하나로 보고한다.
- 접근 blocker는 승인 부족과 구분한다. 예: `GTM UI 2FA에서 막힘`, `Tag Assistant가 local receiver 접근 실패`, `CORS preflight는 통과했지만 browser mixed content 실패`.
- 실행을 못 했다면 Codex가 대신 계속할 수 있는 대체 작업을 같이 적는다. 예: 결과 보고서 템플릿 작성, tunnel/제한 테스트 deploy 승인안 작성, stale endpoint 검색, no-send smoke 추가.
- 자신감이 낮거나, 운영/돈/광고 플랫폼/DB/배포 영향이 크거나, 판단이 복잡한 경우 `다른 에이전트 검증 권장`이라고 표시한다.
- TJ님과 Codex가 충분히 처리 가능한 Green/Yellow 범위라면 `다른 에이전트 검증 불필요`라고 표시하고 진행한다.

## 승인 요청 양식

승인 요청이 필요하면 별도 문서를 만든다. 문서 작성 자체는 Green Lane이다.

```md
# {승인 요청 이름}

작성 시각:
요청 유형: Yellow Lane / Red Lane
대상:
데이터/DB 위치:
운영DB 영향:
외부 전환 전송:
Codex 진행 추천 자신감:

## 한 줄 결론

## 무엇을 하는가

## 왜 하는가

## 데이터가 충분한가

## 어떻게 하는가

## 허용 범위

## 금지 범위

## Hard Fail

## Success Criteria

## Rollback

## 승인 문구

## 승인 후 다음 액션

## Auditor verdict
```

## Auditor Verdict Template

```text
Auditor verdict: PASS | PASS_WITH_NOTES | FAIL_BLOCKED | NEEDS_HUMAN_APPROVAL

Project:
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

## 품질 기준

좋은 보고는 아래를 포함한다.

1. 결론
2. Lane 분류
3. 이번 작업 범위
4. 하지 않은 것
5. 변경 파일
6. source / window / freshness / confidence
7. 검증 결과
8. 운영 영향
9. 남은 리스크
10. 다음 액션 Green / Yellow / Red 분류
11. 이미 승인된 Yellow 작업의 실행 여부
12. 실행하지 못했다면 정확한 blocker와 대체 진행 항목

나쁜 보고:

- "작업 완료했습니다."
- "다음 할 일은 승인받기입니다."
- "테스트 통과했습니다."
- "Preview 승인됨. 다음에 Preview 실행하면 됩니다."

좋은 보고:

```text
Green Lane 작업 완료.
no-send/no-write/no-publish/no-deploy PASS.
scope 내 5개 파일만 변경.
다음은 Yellow Lane VM deploy + GTM Preview이며, Red Lane Production publish는 제외.
```

이미 승인된 Yellow Lane의 좋은 보고:

```text
Preview only 승인 범위 안에서 GTM Preview를 실행했다.
storage 저장은 성공했고, no-send receiver 호출은 browser mixed content로 실패했다.
Production publish, platform send, 운영 DB write는 0건이다.
다음은 local receiver 대신 tunnel 또는 제한 테스트 deploy 승인안이다.
```

## 로컬 보고 양식 연결

대화 최종답변이나 짧은 작업 보고는 `docs/report/text-report-template.md`를 사용한다.

긴 하네스 보고와 승인 요청은 이 문서의 형식을 따른다.
