# 텍스트 보고 양식

작성 시각: 2026-05-02 23:12 KST
목적: Codex/Claude/개발자가 작업 완료 후 TJ님에게 보고할 때 쓰는 공통 텍스트 양식
사용 방식: 최종 답변, Obsidian 보고서, 작업 결과 문서의 상단 요약에 복사해서 채운다
공통 하네스: `harness/common/REPORTING_TEMPLATE.md`의 짧은 답변용 축약본

## 양식

```md
## 한 줄 결론

- 결론:
- Project:
- Lane:
- Mode:
- Auditor verdict:
- 현재 판정:
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

## 검증 근거

| 검증 | 결과 | 명령/방법 | 비고 |
|---|---|---|---|
|  | 통과 / 실패 / 미실행 |  |  |

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source |  |
| window |  |
| freshness |  |
| site |  |
| confidence |  |

## 하지 않은 것

| 항목 | 하지 않은 이유 | 승인 필요 여부 |
|---|---|---|
| 운영DB write | 이번 범위 밖 / 승인 전 금지 | YES |
| 운영 배포 | 이번 범위 밖 / 승인 전 금지 | YES |
| 외부 플랫폼 전송 | GA4/Meta/Google/TikTok 전환값 변경 방지 | YES |

## No-Send / No-Write 확인

| 항목 | 결과 |
|---|---|
| No-send verified | YES / NO |
| No-write verified | YES / NO |
| No-deploy verified | YES / NO |
| No-publish verified | YES / NO |
| No-platform-send verified | YES / NO |

## 다음 액션

다음 액션을 제시하기 전에 먼저 판단한다.

- 데이터가 충분한가:
- 더 조사할 것이 있는가:
- 지금 바로 진행해도 되는가:
- 진행 추천 자신감:

| Lane | 옵션 | 추천도/자신감 | 무엇을 하는가 | 왜 하는가 | 어떻게 하는가 | 담당 | 승인 필요 |
|---|---|---:|---|---|---|---|---|
| Green | A | 90% |  |  |  | Codex / TJ / Claude | NO |
| Yellow | B | 80% |  |  |  | Codex / TJ / Claude | YES, sprint 승인 |
| Red | C | 50% |  |  |  | TJ | YES, 명시 승인 |

권장안:

-

## 승인 요청이 필요한 경우

승인 요청이 있으면 대화 답변만으로 요청하지 않는다.
별도 승인 문서를 만들고, 그 문서에 아래 내용을 자세히 적은 뒤 링크한다.
승인 문서 작성 자체는 사전 승인 없이 진행한다.
사전 승인이 필요한 것은 문서 작성이 아니라, 그 문서에 적힌 배포, 운영DB write, 외부 플랫폼 전환 전송, GTM Production publish 같은 실행이다.

| 항목 | 작성 내용 |
|---|---|
| 승인 요청 이름 | 예: `TikTok Marketing Intent Receiver VM Deploy + GTM Preview Smoke` |
| 무엇을 하는가 | 실제 실행할 작업 범위. 배포, DB write, 외부 전송, publish 여부를 분리 |
| 왜 하는가 | 사업 판단 또는 데이터 정확성에 왜 필요한지 |
| 어떻게 하는가 | 실행 순서, 명령, 확인 화면, 담당자 |
| 데이터/DB 위치 | 운영DB / TJ 관리 Attribution VM / 로컬 개발 DB / 외부 API 중 어디인지 |
| 허용 범위 | 승인하면 해도 되는 일 |
| 금지 범위 | 승인해도 하면 안 되는 일 |
| Hard Fail | 발견 즉시 중단할 조건 |
| Success Criteria | 성공으로 볼 기준 |
| Rollback | 문제 발생 시 되돌리는 방법 |
| 자신감 % | 진행 추천 정도와 근거 |

승인 문서 경로:

-

## 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
|  |  |  |

## Codex 의견

- 이 양식은 현재 구조로 충분하다.
- 다만 데이터 정합성 작업에서는 `검증 근거`, `하지 않은 것`, `데이터/DB 위치`가 꼭 필요하다.
- 이유는 “했다/안 했다”보다 “어느 DB 기준으로 봤고, 운영에 영향을 줬는지”가 의사결정에 더 중요하기 때문이다.
```

## 작성 규칙

1. **결론을 먼저 쓴다.**
   - 사용자가 가장 먼저 알아야 하는 것은 “지금 진행해도 되는가”다.

2. **완료와 미완료를 분리한다.**
   - 시도했지만 못 끝낸 작업을 숨기면 다음 의사결정이 틀어진다.

3. **DB 위치를 항상 적는다.**
   - 운영DB: 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users`
   - TJ 관리 Attribution VM: `att.ainativeos.net` 서버 내부 SQLite
   - 로컬 개발 DB: `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`

4. **다음 액션은 이유와 방법까지 쓴다.**
   - `검토 필요`만 쓰지 않는다.
   - `무엇을`, `왜`, `어떻게`, `누가`, `승인이 필요한지`를 같이 쓴다.

5. **옵션이 여러 개면 자신감 %를 붙인다.**
   - 100%: 특이사항 없이 해야 하는 일
   - 80~95%: 근거가 충분하고 진행 권고
   - 50~79%: 가능하지만 추가 확인 필요
   - 50% 미만: 지금 진행보다 조사 우선

6. **하지 않은 것도 명시한다.**
   - 운영 배포, 운영DB write, 외부 플랫폼 전환 전송처럼 위험한 작업은 “안 했다”가 중요한 정보다.

7. **승인 요청은 별도 문서로 만든다.**
   - VM 배포, 운영DB write, 외부 플랫폼 전환 전송, GTM Production publish처럼 위험이 있는 작업은 대화 답변만으로 승인 요청하지 않는다.
   - 승인 문서 작성 자체는 승인 없이 진행한다.
   - 별도 승인 문서에 `무엇을`, `왜`, `어떻게`, `허용 범위`, `금지 범위`, `Hard Fail`, `Success Criteria`, `Rollback`, `자신감 %`를 적는다.
   - 최종 답변에는 승인 문서 링크와 핵심 승인 문구만 짧게 제시한다.

8. **Auditor verdict를 남긴다.**
   - `PASS`, `PASS_WITH_NOTES`, `FAIL_BLOCKED`, `NEEDS_HUMAN_APPROVAL` 중 하나로 쓴다.
   - Green / Yellow / Red Lane과 no-send/no-write/no-deploy/no-publish/no-platform-send 확인 결과를 같이 적는다.
