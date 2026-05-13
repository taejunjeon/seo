# Next Actions And Approval

작성 시각: 2026-05-13 13:05 KST  
Owner: Codex

## 운영 반영 추천 점수

### 1. Coffee actual status monitor cron

- 추천: 진행 추천.
- 자신감: 88%.
- Lane: Yellow.
- 무엇을 승인하는가: VM Cloud에서 coffee status monitor를 정기 실행하도록 cron을 등록한다.
- 왜 필요한가: VM Cloud SQLite `imweb_orders.imweb_status` blank가 늘면 actual 포함 정책을 다시 봐야 한다.
- 성공 기준: 매 실행마다 status blank count/amount, max synced_at, max_status_synced_at, lag hours가 JSON으로 남는다.
- 실패 조건: raw identifier 노출, VM Cloud write/schema change, 외부 send/upload.
- Codex가 대신 가능한가: 승인 후 가능. 승인 전 cron 등록은 하지 않는다.

승인 후 실행 개요:

```bash
# approval after only
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes taejun@34.64.104.94
# create /home/biocomkr_sns/seo/coffee-status-monitoring/run.sh
# run backend/scripts/coffee-actual-status-monitor.ts read-only
# register cron only after approval
```

### 2. /total frontend/backend operating deploy

- 추천: 진행 추천.
- 자신감: 84%.
- Lane: Yellow.
- 무엇을 승인하는가: local `/total` decision layer patch를 운영 frontend/backend에 반영한다.
- 왜 필요한가: 로컬에서는 대표용 판단 화면이 됐지만, 운영 화면은 아직 배포 전이다.
- 성공 기준: 운영 `/total` 첫 화면에 4개 판단 카드가 보이고, coffee reference line은 budget ROAS에서 제외된다.
- 실패 조건: API 5xx, coffee line 자동 합산, raw identifier 노출, source diagnostics 기본 펼침으로 회귀.
- Codex가 대신 가능한가: 승인 후 가능. 승인 전 운영 deploy/restart는 하지 않는다.

### 3. ROAS recompute script 정기화

- 추천: 보류 후 Green 추가 조사.
- 자신감: 72%.
- Lane: Yellow if scheduled, Green if manual readiness only.
- 무엇을 승인하는가: last_7d/last_30d platform ROAS와 내부 confirmed ROAS를 정기 비교한다.
- 왜 보류인가: coffee overlay가 budget ROAS가 되려면 campaign/site spend mapping이 먼저 필요하다.
- 성공 기준: biocom budget ROAS와 coffee reference overlay가 분리된 상태로 매일 비교된다.
- 실패 조건: coffee 매출을 biocom Google Ads budget numerator에 자동 합산.

## Codex가 바로 할 수 있는 Green follow-up

1. campaign/site spend mapping read-only 설계
- 무엇: Google Ads campaign, landing URL, UTM site marker로 biocom/coffee spend 분리 가능성을 본다.
- 왜: coffee actual을 참고값에서 예산 판단값으로 올릴 수 있는지 판단하기 위해.
- 승인 필요: NO.
- 성공 기준: `cross_site_reference_only` 또는 `site_specific_budget_roas_ready` 판정.
- 추천 점수/자신감: 86%.

2. `/total` 운영 배포 packet 상세화
- 무엇: pre-snapshot, deploy, post-snapshot, rollback 명령을 문서화한다.
- 왜: TJ님이 YES/NO로 승인할 수 있게 하기 위해.
- 승인 필요: 문서 작성은 NO, 실제 deploy는 YES.
- 성공 기준: 5xx/line 합산/raw identifier/fallback 조건이 명확하다.
- 추천 점수/자신감: 84%.

## TJ님이 할 일

1. Cron 등록 여부 결정
- 무엇을 승인/확인하는가: coffee actual status monitor를 VM Cloud cron에 등록할지 결정한다.
- 왜 필요한가: status blank가 늘어도 다음 sprint까지 사람이 수동 확인하지 않아도 된다.
- 어디서 확인하나: 이 문서의 `Coffee actual status monitor cron` 섹션.
- 성공 기준: 승인하면 Codex가 cron 등록 후 첫 JSON 결과를 보고한다.
- 실패 시 해석: 승인하지 않으면 monitor script는 수동 실행만 가능하다.
- Codex가 대신 못 하는 이유: cron 등록은 운영 스케줄 변경이라 승인 전 금지다.
- 추천 점수/자신감: 88%.

2. 운영 `/total` 배포 여부 결정
- 무엇을 승인/확인하는가: local `/total` decision layer를 운영에 반영할지 결정한다.
- 왜 필요한가: 현재 TJ님이 확인 가능한 로컬 주소는 `http://localhost:7010/total`이고, 운영 반영은 별도 deploy가 필요하다.
- 성공 기준: 운영 화면에서도 첫 화면 판단 카드와 coffee reference line이 보인다.
- 실패 시 해석: 배포하지 않으면 로컬 화면에서만 확인 가능하다.
- Codex가 대신 못 하는 이유: 운영 deploy/restart는 Yellow라 승인 전 금지다.
- 추천 점수/자신감: 84%.
