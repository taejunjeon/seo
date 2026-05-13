# gpt0508-54 Result Report

작성 시각: 2026-05-13 18:35 KST  
Owner: Codex  
Lane: Yellow approved VM Cloud frontend deploy/restart continuation.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - docurule.md
    - docs/report/text-report-template.md
    - gptconfirm/gpt0508-53/00-result-report.md
  lane: Yellow
  allowed_actions:
    - TikTok OFF frontend copy/UX consistency patch
    - frontend typecheck/build
    - seo-frontend restart
    - live browser smoke
    - scoped commit/push
  forbidden_actions:
    - TikTok ad on/off change
    - TikTok Ads API write
    - TikTok Events API send
    - GA4/Meta/Google Ads/Naver conversion send
    - operational DB write/import
    - VM Cloud SQLite write/schema migration
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: "VM Cloud SQLite attribution_ledger read-only for pre-adjustment channel classification + operational_db.public.tb_influencer_group_buy_customer read-only for group-buy correction"
    window: "baseline 2026-05-01~2026-05-07 KST; off partial 2026-05-08~2026-05-12 KST"
    freshness: "2026-05-13 18:35 KST"
    confidence: 0.91
```

## 이번에 가능해진 것

TikTok OFF 화면에서 `Meta 광고 -2,304,761원/일`과 `공동구매 제외 후 -110,098원/일`이 서로 충돌하는 것처럼 보이던 문제를 줄였다. 이제 화면은 Meta를 원인으로 단정하지 않고, `보정 전 채널 분류`와 `공동구매 보정 후 판단값`을 분리해서 보여준다.

## 왜 충돌처럼 보였나

숫자 자체가 서로 틀린 것은 아니었다. VM Cloud 보조 원장의 채널 분류에서는 Meta 유입 근거가 붙은 공동구매 주문도 Meta 라인에 들어갈 수 있다. 반면 운영DB 공동구매 보정 라인은 같은 기간 공동구매 매출 변화를 별도로 뺀다.

그래서 기존 문구처럼 `하락분이 가장 크게 잡힌 곳: Meta 광고`라고 쓰면, Meta가 하락 원인인 것처럼 읽힌다. 실제 판단 순서는 `보정 전에는 Meta가 크게 줄어 보임 -> 하지만 공동구매 감소가 전체 하락의 96.17%를 설명 -> 공동구매 제외 후 남는 하락은 -110,098원/일`이다.

## 완료한 것

- 상단 KPI 문구를 `하락분이 가장 크게 잡힌 곳`에서 `보정 전 가장 크게 줄어 보인 채널`로 변경.
- `공동구매 제외 후 남는 하락` KPI를 추가해 보정 후 판단값을 상단에 배치.
- 판단 카드 문구를 `현재 부분 기간에서는 공동구매 감소를 먼저 빼고 봐야 합니다`로 변경.
- 채널별 표 제목을 `보정 전 채널별 매출 변화`로 변경.
- 로컬 데이터 부족처럼 전체 하락이 확인되지 않는 경우에는 잔여 하락을 `비교 불가`로 표시.
- VM Cloud frontend build/restart 완료.

## 현재 live 숫자

- 전체 일평균 매출 변화: -2,876,049원.
- 보정 전 가장 크게 줄어 보인 채널: Meta 광고 -2,304,761원/일.
- 공동구매 감소 영향: -2,765,951원/일.
- 공동구매가 전체 하락을 설명하는 비중: 96.17%.
- 공동구매 제외 후 남는 하락: -110,098원/일.

## 검증 결과

- 로컬 frontend typecheck: PASS.
- 로컬 Playwright smoke: PASS.
- VM Cloud frontend typecheck/build: PASS.
- VM Cloud `seo-frontend` restart: PASS.
- live frontend 200: PASS.
- live API smoke: PASS.
- live browser smoke: PASS.
- raw email/phone/member/order/payment/click identifier scan: PASS.
- no-send/no-write/no-publish: PASS.

## 하지 않은 것

- backend API logic 변경하지 않음.
- TikTok 광고 ON/OFF 변경하지 않음.
- TikTok Ads API write 하지 않음.
- TikTok Events API send 하지 않음.
- GA4/Meta/Google Ads/Naver 전환 전송하지 않음.
- 운영DB write/import 하지 않음.
- VM Cloud SQLite write/schema migration 하지 않음.
- GTM publish 하지 않음.

## 서버 상태

- live frontend: `https://biocom.ainativeos.net/ads/tiktok/off-impact`.
- live API: `https://att.ainativeos.net/api/ads/tiktok/off-impact-audit`.
- PM2: `seo-backend`, `seo-frontend`, `seo-cloudflared` online.
- rollback backup: `/home/biocomkr_sns/seo/repo/.deploy-backups/tiktok-off-ux-consistency-20260513T1831KST`.

## 다음 할일

### Codex가 할 일

1. 7일 OFF 마감 재계산
- Codex 추천: 진행 추천.
- 추천 이유: 5일 부분 기간에서는 공동구매 영향이 너무 커서 TikTok 예산 판단을 바로 닫기 어렵다.
- 추천 방향에 대한 자신감: 92%.
- Lane: Green read-only.
- 의존성: 2026-05-14 데이터가 VM Cloud SQLite와 운영DB에 반영되어야 한다.
- 무엇을 하는가: 2026-05-08~2026-05-14 기간으로 같은 API를 다시 실행한다.
- 성공 기준: 공동구매 제외 후에도 남는 채널 하락이 있는지 확인된다.
- 승인 필요: NO.

### TJ님이 할 일

1. TikTok 예산 판단은 7일 재계산 뒤 결정
- Codex 추천: 보류 후 판단 추천.
- 추천 이유: 현재 live 화면 기준 공동구매 감소가 전체 하락의 96.17%를 설명한다.
- 추천 방향에 대한 자신감: 90%.
- Lane: 사업 판단.
- 의존성: Codex의 7일 OFF 마감 재계산.
- 무엇을 하는가: live 화면에서 `공동구매 제외 후 남는 하락`을 보고 중단 유지/소액 재테스트/추적 보강 후 보류 중 하나를 고른다.
- Codex가 대신 못 하는 이유: 광고비 재개/중단은 실제 비용을 바꾸는 결정이다.
- 승인 필요: YES.
