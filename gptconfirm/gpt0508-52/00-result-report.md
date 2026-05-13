# gpt0508-52 Result Report

작성 시각: 2026-05-13 16:35 KST  
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
    - harness/npay-recovery/README.md
  required_context_docs:
    - docurule.md
    - frontrule.md
    - tiktok/!tiktokroasplan.md
    - gptconfirm/gpt0508-51/00-result-report.md
  lane: Yellow
  allowed_actions:
    - VM Cloud frontend/backend file deploy
    - backend typecheck/build
    - seo-backend restart
    - seo-frontend restart if needed
    - VM Cloud read-only smoke
    - flat CSV cache copy
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
    source: "VM Cloud SQLite attribution_ledger direct read-only + VM Cloud repo TikTok processed CSV + GA4 Data API cross-check"
    window: "baseline 2026-05-01~2026-05-07 KST; off partial 2026-05-08~2026-05-12 KST"
    freshness: "2026-05-13 16:35 KST"
    confidence: 0.88
```

## 이번에 가능해진 것

TJ님이 TikTok 광고를 끈 뒤 매출 하락이 어디에서 잡히는지 live 화면에서 바로 볼 수 있게 됐다. 접속 주소는 `https://biocom.ainativeos.net/ads/tiktok/off-impact` 이다.

## 완료한 것

- VM Cloud frontend/backend에 TikTok OFF 영향 감사 페이지 배포.
- API 404/500/terminated 문제 대응.
- `/api/ads/tiktok/off-impact-audit`가 VM Cloud SQLite `attribution_ledger`를 직접 read-only 조회하도록 변경.
- VM Cloud repo에 TikTok processed daily campaign CSV 18개 배치.
- TikTok 광고비와 TikTok 플랫폼 주장 매출은 CSV read-only 기준으로 계산하도록 변경.
- 기존 0원 캐시를 `refresh=1`로 새로 만들고, 기본 조회는 cache hit로 빠르게 열리도록 확인.

## 핵심 숫자

- 전체 일평균 매출 변화: -2,876,049원 / -17.77%.
- 하락을 가장 크게 잡은 곳: Meta 광고.
- TikTok 광고비: 1,041,554원 -> 47원.
- TikTok 플랫폼 주장 매출: 3,218,171원 -> 0원.
- TikTok 내부 직접 결제완료 매출: 0원 -> 0원.
- TikTok first-touch 후보: 234,000원.
- TikTok 미추적 가능성: 27/100.
- 플랫폼 과대 attribution 가능성: 70/100.

## 현재 판정

TikTok을 끈 뒤 매출은 줄었다. 다만 현재 VM Cloud 보조 원장 기준으로는 하락 대부분이 TikTok 직접 결제완료가 아니라 Meta 광고 쪽에서 크게 잡힌다. TikTok은 광고비가 사실상 꺼진 것은 맞지만, 내부 직접 결제완료 매출은 0원이고 보조 후보만 234,000원이다.

## 검증 결과

- 로컬 backend typecheck: PASS.
- VM Cloud backend typecheck/build: PASS.
- VM Cloud health: PASS.
- live API refresh: PASS.
- live API cache hit: PASS.
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
- rollback backup:
  - `/home/biocomkr_sns/seo/repo/.deploy-backups/tiktok-off-impact-20260513T1608KST`
  - `/home/biocomkr_sns/seo/repo/.deploy-backups/tiktok-off-impact-csv-source-20260513T1623KST`

## 다음 할일

### Codex가 할 일

1. 7일 OFF 마감 재계산
- 추천 점수/자신감: 92%.
- 의존성: 2026-05-14 데이터가 마감되어야 한다.
- 무엇/왜/어떻게: 2026-05-08~2026-05-14 전체 기간으로 같은 API를 다시 실행해 5일 중간값의 요일 영향을 줄인다.
- 성공 기준: 중단 유지, 소액 재테스트, 추적 보강 후 보류 중 하나로 결론을 낼 수 있다.
- 승인 필요 여부: Green read-only라 승인 불필요.

2. Meta/Naver reason code 접힘 섹션 추가
- 추천 점수/자신감: 84%.
- 의존성: 없음. 병렬 가능.
- 무엇/왜/어떻게: raw 식별자 없이 “왜 Meta/Naver로 분류했는지” aggregate count/revenue를 접힘 섹션으로 추가한다.
- 성공 기준: Meta 광고, Meta 픽셀 흔적, Naver 광고 후보, 자연 유입의 분류 근거가 사람이 보기에 명확해진다.
- 승인 필요 여부: Green code patch.

### TJ님이 할 일

1. TikTok 광고 재개 여부 판단은 7일 OFF 마감 뒤 결정
- 추천 점수/자신감: 88%.
- 의존성: 7일 OFF 재계산 결과.
- 무엇/왜/어떻게: 2026-05-15 이후 live 페이지에서 7일 window 결과를 보고 `중단 유지`, `소액 제한 재테스트`, `추적 보강 후 보류` 중 하나를 고른다.
- 성공 기준: 예산 판단에 쓸 값과 참고만 볼 값을 분리한 결정이 나온다.
- Codex가 대신 못 하는 이유: 광고비 재개는 실제 비용을 바꾸는 사업 판단이다.
- 승인 필요 여부: YES.
