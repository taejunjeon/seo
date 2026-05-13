# gpt0508-53 Result Report

작성 시각: 2026-05-13 18:10 KST  
Owner: Codex  
Lane: Yellow approved VM Cloud frontend/backend deploy/restart.

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
    - gptconfirm/gpt0508-52/00-result-report.md
  lane: Yellow
  allowed_actions:
    - VM Cloud frontend/backend file deploy
    - backend typecheck/build
    - frontend typecheck/build
    - seo-backend restart
    - seo-frontend restart
    - VM Cloud read-only smoke
    - operational DB read-only aggregate query
    - scoped commit
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
    source: "VM Cloud SQLite attribution_ledger read-only for overall revenue + operational_db.public.tb_influencer_group_buy_customer read-only for group-buy correction"
    window: "baseline 2026-05-01~2026-05-07 KST; off partial 2026-05-08~2026-05-12 KST"
    freshness: "2026-05-13 18:10 KST"
    confidence: 0.9
```

## 이번에 가능해진 것

TJ님이 TikTok 광고를 끈 뒤 매출이 줄어든 원인을 볼 때, 광고 채널 변화와 공동구매 일정 효과를 분리해서 볼 수 있게 됐다. 화면 주소는 `https://biocom.ainativeos.net/ads/tiktok/off-impact` 이다.

핵심은 “TikTok을 꺼서 매출이 줄었다”를 바로 확정하지 않고, 같은 기간 공동구매 매출이 얼마나 줄었는지 별도 라인으로 빼서 보는 것이다. 이 보정 라인은 광고 채널 매출에 섞지 않는다.

## 완료한 것

- TikTok OFF 영향 API에 공동구매 보정 라인 추가.
- TikTok OFF 화면에 `공동구매 감소 영향` KPI와 `공동구매 보정 라인` 카드 추가.
- 공동구매 상세 API에 운영DB 보조 집계 필드 추가.
- VM Cloud backend/frontend 배포 및 restart 완료.
- VM Cloud live 화면과 API smoke 완료.
- checkpoint 파일 업데이트:
  - `gdn/current-handoff.md`
  - `data/current-state.json`

## 실제 숫자

- 전체 매출 변화: OFF 전 일평균 16,186,246원 -> OFF 후 일평균 13,310,197원.
- 전체 하락: -2,876,049원 / 일.
- 공동구매 변화: OFF 전 97건 / 29,445,300원 -> OFF 후 29건 / 7,202,600원.
- 공동구매 일평균 변화: -2,765,951원 / 일.
- 관측 하락 중 공동구매 감소 설명 비중: 96.17%.
- 공동구매를 제외하고 남는 변화: -110,098원 / 일.

## 현재 판정

2026-05-01~2026-05-12 부분 기간 기준으로는 매출 하락 대부분이 TikTok 직접 효과보다 공동구매 감소와 겹쳐 보인다. 따라서 “TikTok 광고가 효과가 없었다” 또는 “TikTok을 꺼서 매출이 줄었다” 둘 중 하나를 바로 확정하면 위험하다.

예산 판단에는 두 값을 분리해서 봐야 한다.

- 예산 판단에 쓸 값: VM Cloud SQLite `attribution_ledger` read-only 기준 전체/채널별 결제완료 흐름.
- 참고로 분리해서 볼 값: 운영DB `public.tb_influencer_group_buy_customer` read-only 기준 공동구매 보정 라인.

## 검증 결과

- 로컬 backend typecheck: PASS.
- 로컬 frontend typecheck: PASS.
- VM Cloud backend typecheck/build: PASS.
- VM Cloud frontend typecheck/build: PASS.
- VM Cloud health: PASS.
- live API refresh: PASS.
- live 공동구매 summary API: PASS.
- live frontend HTML: PASS.
- live browser smoke: PASS.
- raw email/phone/member/order/payment/click identifier scan: PASS.
- no-send/no-write/no-publish: PASS.

## 하지 않은 것

- TikTok 광고 ON/OFF 변경하지 않음.
- TikTok Ads API write 하지 않음.
- TikTok Events API send 하지 않음.
- GA4/Meta/Google Ads/Naver 전환 전송하지 않음.
- 운영DB write/import 하지 않음.
- VM Cloud SQLite write/schema migration 하지 않음.
- GTM publish 하지 않음.

## 서버 상태

- VM Cloud IP: `34.64.104.94`.
- PM2: `seo-backend`, `seo-frontend`, `seo-cloudflared` online.
- live frontend: `https://biocom.ainativeos.net/ads/tiktok/off-impact`.
- live API: `https://att.ainativeos.net/api/ads/tiktok/off-impact-audit`.
- rollback backup: `/home/biocomkr_sns/seo/repo/.deploy-backups/tiktok-off-coop-adjustment-20260513T1755KST`.

## 남은 리스크

- OFF 후 기간은 2026-05-08~2026-05-12 5일 부분 기간이다. 7일 전체 마감 뒤 재계산해야 요일 효과가 줄어든다.
- 운영DB 공동구매 라인은 광고 채널 매출을 대체하는 값이 아니다. 공동구매 일정 효과를 분리해서 보는 참고 라인이다.
- VM Cloud 상품명/마스터 기반 공동구매 매칭은 2026년 5월 공동구매를 잘 잡지 못했다. 그래서 API에 운영DB 보조 집계 필드를 붙였다.

## 확인하면 좋은 문서

1. `gptconfirm/gpt0508-53/00-result-report.md`  
   이번 작업의 판단 근거와 숫자를 한 문서에서 확인할 수 있다.
2. `gdn/current-handoff.md`  
   새 세션이나 compact 이후 바로 이어갈 때 필요한 4개 항목만 남긴 checkpoint다.
3. `data/current-state.json`  
   live metric, source/window/freshness/confidence, 서버 상태를 기계가 읽을 수 있는 형태로 남겼다.

## 다음 할일

### Codex가 할 일

1. 7일 OFF 마감 재계산
- Codex 추천: 진행 추천.
- 추천 이유: 5일 부분 기간보다 7일 기간이 요일 효과를 덜 탄다.
- 추천 방향에 대한 자신감: 92%.
- Lane: Green read-only.
- 의존성: 2026-05-14 데이터가 VM Cloud SQLite와 운영DB에 들어와야 한다.
- 무엇을 하는가: baseline 2026-05-01~2026-05-07, off 2026-05-08~2026-05-14로 live API를 다시 실행한다.
- 왜 하는가: TikTok 중단 유지, 소액 재테스트, 추적 보강 후 보류 중 하나를 더 안전하게 고르기 위해서다.
- 어떻게 하는가: `/api/ads/tiktok/off-impact-audit`에 새 날짜 파라미터와 `refresh=1`을 붙여 read-only 재계산한다.
- 성공 기준: 공동구매 보정 후에도 남는 하락이 어느 채널에 남는지 확인된다.
- 실패 시 해석/대응: source freshness gap이면 VM Cloud 원장 freshness와 운영DB 공동구매 날짜 필드를 먼저 확인한다.
- 승인 필요: NO.

2. 공동구매 보정 라인에 7일/14일 비교 toggle 추가
- Codex 추천: 진행 추천.
- 추천 이유: TJ님이 한 화면에서 “부분 기간 착시인지”를 바로 볼 수 있다.
- 추천 방향에 대한 자신감: 82%.
- Lane: Green 또는 Yellow. 로컬 patch는 Green, VM Cloud deploy는 Yellow.
- 의존성: 7일 재계산 결과.
- 무엇을 하는가: 화면에서 5일 부분 기간, 7일 마감 기간, 14일 확장 기간을 비교할 수 있게 한다.
- 성공 기준: 공동구매 영향과 광고 채널 영향이 기간별로 분리되어 보인다.
- 실패 시 해석/대응: API 응답이 무거워지면 캐시 키를 기간별로 분리한다.
- 승인 필요: 운영 deploy는 YES, 로컬 설계/패치는 NO.

### TJ님이 할 일

1. TikTok 예산 판단은 7일 OFF 마감 뒤 결정
- Codex 추천: 보류 후 판단 추천.
- 추천 이유: 현재 5일 부분 기간에서는 공동구매 감소가 하락의 96.17%를 설명한다.
- 추천 방향에 대한 자신감: 90%.
- Lane: 사업 판단.
- 의존성: Codex의 7일 OFF 마감 재계산.
- 무엇을 하는가: `https://biocom.ainativeos.net/ads/tiktok/off-impact`에서 7일 결과를 보고 `중단 유지`, `소액 제한 재테스트`, `추적 보강 후 보류` 중 하나를 고른다.
- 왜 하는가: 실제 광고비를 다시 켤지 여부는 비용이 발생하는 결정이기 때문이다.
- 어떻게 하는가: 화면 상단 KPI와 공동구매 보정 라인의 `공동구매 제외 후 변화`를 본다.
- 성공 기준: 예산 판단에 쓸 값과 참고만 볼 값을 섞지 않고 결정한다.
- 실패 시 해석/대응: 공동구매 제외 후에도 특정 광고 채널 하락이 크면 해당 채널 source rule을 다시 감사한다.
- Codex가 대신 못 하는 이유: 광고비 재개/중단은 실제 비용을 바꾸는 사업 판단이다.
- 승인 필요: YES.
