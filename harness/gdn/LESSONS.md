# GDN Lessons

작성 시각: 2026-05-03 22:25 KST
상태: v0 기준판
목적: Google Ads/GDN ROAS 정합성 작업에서 반복되는 예외를 규칙으로 승격하기 전 기록한다
관련 문서: [[harness/gdn/README|GDN Harness]], [[harness/gdn/RULES|GDN Rules]], [[harness/common/HARNESS_GUIDELINES|Growth Data Agent Harness Guidelines]]

## 10초 요약

Lessons는 규칙이 아니다.

단일 관찰은 observation으로 남기고, 반복되면 candidate_rule로 올린다. 전송 후보를 넓히는 규칙은 TJ님 승인 없이는 approved_rule로 승격하지 않는다.

## Schema

| 필드 | 의미 |
|---|---|
| id | `gdn-lesson-001` 형식 |
| status | observation / candidate_rule / approved_rule / deprecated_rule |
| title | 한 줄 요약 |
| observed_at | 관찰 시각 |
| source | 근거 문서, API, 파일 |
| evidence_count | 반복 근거 수 |
| impact | 판단/작업에 주는 영향 |
| proposed_rule | RULES에 넣을 후보 문장 |
| confidence | low / medium / high |
| owner | TJ / Codex / Claude |
| next_review | 다시 볼 시점 |

## Lessons

### gdn-lesson-001

| 필드 | 값 |
|---|---|
| status | approved_rule |
| title | `구매완료`라는 이름만으로 confirmed purchase라고 보면 안 된다 |
| observed_at | 2026-04-25 21:55 KST |
| source | [[gdn/google-ads-internal-roas-reconciliation|Google Ads 내부 ROAS 대조 결과]], [[footer/biocomimwebcode|biocom Imweb code]] |
| evidence_count | 1 high-confidence 분석 |
| impact | Primary `구매완료` action `7130249515`가 NPay count label과 일치해 Google ROAS gap의 1순위 원인으로 분류됨 |
| proposed_rule | conversion action은 name이 아니라 action id, label, primary status, category, value source로 분류한다 |
| confidence | high |
| owner | Codex |
| next_review | Google Ads API 최신 재조회 후 |

### gdn-lesson-002

| 필드 | 값 |
|---|---|
| status | approved_rule |
| title | `All conv. value`는 운영 ROAS 분자로 쓰지 않는다 |
| observed_at | 2026-04-25 21:55 KST |
| source | [[gdn/google-ads-internal-roas-reconciliation|Google Ads 내부 ROAS 대조 결과]] |
| evidence_count | 1 high-confidence 분석 |
| impact | Secondary `TechSol - NPAY구매 50739`가 `All conv. value`를 크게 부풀림 |
| proposed_rule | 운영 ROAS 판단에서는 `Conv. value`, `All conv. value`, internal confirmed를 분리한다 |
| confidence | high |
| owner | Codex |
| next_review | 최신 Google Ads segment 재조회 후 |

### gdn-lesson-003

| 필드 | 값 |
|---|---|
| status | candidate_rule |
| title | GDN view-through는 예산 판단 보조로만 둔다 |
| observed_at | 2026-04-25 23:50 KST |
| source | [[gdn/!gdnplan|GDN Plan]] |
| evidence_count | 1 문서 판단 |
| impact | GDN은 조회 후 전환이 의미 있지만, 내부 confirmed click ROAS와 섞으면 증액 판단이 흔들림 |
| proposed_rule | view-through only 주문은 internal confirmed ROAS로 승격하지 않는다 |
| confidence | medium |
| owner | Codex |
| next_review | GDN 캠페인별 최신 read-only 재조회 후 |

## 승격 원칙

1. 전송 후보를 좁히는 규칙은 evidence 1건이라도 high confidence면 빠르게 적용할 수 있다.
2. 전송 후보를 넓히는 규칙은 evidence 3~5건 이상과 TJ님 승인이 필요하다.
3. Google Ads conversion upload와 관련된 규칙은 Red Lane 승인 전 approved_rule로 쓰지 않는다.
4. deprecated_rule은 삭제하지 않고 왜 폐기됐는지 남긴다.
