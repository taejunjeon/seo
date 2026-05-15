# 03. Next actions

작성 시각: 2026-05-15 00:32 KST

## Auto Green

### 1. Imweb confirmed 5건 bridge 후보 재검증

- 담당: Codex
- 무엇을 하는가: 5건 / 1,566,621원을 safe_ref 기준으로 운영DB, Imweb v2 API, VM Cloud cache, Meta duplicate log와 다시 대조한다.
- 왜 하는가: 실제 결제완료 row만 Meta backfill 후보가 될 수 있기 때문이다.
- 어떻게 하는가: read-only/dry-run으로 count, amount, excluded reason, duplicate risk만 남긴다.
- 성공 기준: candidate/excluded/blocked가 raw id 없이 닫힌다.
- 승인 필요: dry-run은 NO. Meta send는 별도 Red YES.
- 추천 점수/자신감: 88%
- 의존성: 없음. 바로 진행 가능.

### 2. Browser Purchase test-only 설계

- 담당: Codex
- 무엇을 하는가: 운영 구매 수가 늘지 않는 browser `Purchase` test 방법을 설계한다.
- 왜 하는가: browser/server dedup을 확인해야 직접 Pixel 삽입 여부를 판단할 수 있다.
- 어떻게 하는가: Meta Test Events 전용 code path, preview-only page, eventID/event_id pairing 방법을 approval packet으로 쓴다.
- 성공 기준: 운영 count delta 0을 사전에 보장하는 방법이 생긴다.
- 승인 필요: 설계는 NO. 실제 browser 발화는 YES.
- 추천 점수/자신감: 72%
- 의존성: Meta UI Test Events 확인이 있으면 더 정확하다.

## Approval Needed / UI 확인

### 1. Meta Test Events UI 확인

- 담당: TJ님
- 무엇을 하는가: Meta Events Manager에서 test-only `Purchase`가 보이는지 확인한다.
- 왜 하는가: Codex는 API 응답은 확인했지만, UI 표시 여부는 로그인 권한 화면에서만 최종 확인할 수 있다.
- 어떻게 하는가: Meta Events Manager > Pixel `1283400029487161` > 이벤트 테스트 탭에서 최근 `Purchase` test event를 확인한다.
- 성공 기준: test event는 보이고, 운영 이벤트 개요 구매 수는 늘지 않는다.
- 실패 시 다음 확인점: test_event_code 만료, Dataset/Pixle 필터, event_time 표시 기준, source 필터.
- Codex가 대신 못 하는 이유: Meta UI 로그인/권한 화면 접근이 없다.
- 승인 필요: NO, 확인만.
- 추천 점수/자신감: 70%

## Red Hold

### 1. 추가 Meta backfill send

- 담당: TJ님 승인 + Codex 실행
- 무엇을 하는가: confirmed bridge가 닫힌 row만 Meta CAPI Purchase로 보낸다.
- 왜 하는가: pending 전체 전송은 구매 수 오염 위험이 크다.
- 어떻게 하는가: 후보별 금액/취소/중복 guard를 닫은 approval packet 후 최대 건수와 금액을 명시한다.
- 성공 기준: attempted/success/events_received가 승인 범위와 일치하고 excluded row send가 0이다.
- 승인 필요: YES, Red.
- 추천 점수/자신감: bridge dry-run 전 45%, bridge dry-run PASS 후 재평가.
