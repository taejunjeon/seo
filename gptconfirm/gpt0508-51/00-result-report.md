# gpt0508-51 Result Report

작성 시각: 2026-05-13 15:28 KST  
Owner: Codex  
Lane: Green local code/docs/read-only verification.

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
    - tiktok/tiktok_off_impact_check_20260513.md
  lane: Green
  allowed_actions:
    - local frontend/backend code patch
    - VM Cloud support ledger read-only query
    - GA4 read-only cross-check
    - TikTok Ads cache/API read-only check
    - local smoke verification
    - docs/checkpoint update
  forbidden_actions:
    - TikTok ad on/off change
    - TikTok Ads API write
    - TikTok Events API send
    - GA4/Meta/Google Ads/Naver conversion send
    - operational DB write
    - VM Cloud SQLite write
    - GTM publish
    - operating deploy/restart
  source_window_freshness_confidence:
    source: "VM Cloud support ledger + GA4 Data API + local TikTok Ads cache"
    window: "baseline 2026-05-01~2026-05-07 KST; off partial 2026-05-08~2026-05-12 KST"
    freshness: "2026-05-13 15:28 KST"
    confidence: 0.86
```

## 이번에 가능해진 것

TikTok 광고를 껐더니 매출이 줄었다는 질문을 “TikTok이 실제로 빠진 것인지, Google/Meta/Naver/오가닉 쪽이 줄어든 것인지”로 나눠 볼 수 있게 됐다. 로컬 화면은 `http://localhost:7010/ads/tiktok/off-impact` 이다.

## 완료한 것

- Backend read-only API 추가: `GET /api/ads/tiktok/off-impact-audit`.
- Frontend 페이지 추가: `frontend/src/app/ads/tiktok/off-impact/page.tsx`.
- 기존 TikTok ROAS 페이지에 새 감사표 링크 추가.
- Meta 광고와 Meta 픽셀 흔적을 분리했다. `fbp`만 있는 row는 Meta 광고 성과로 확정하지 않는다.
- TikTok 미추적 가능성 감사표 문서 추가: `tiktok/tiktok_mistracking_audit_20260513.md`.
- Compact 대비 checkpoint 업데이트: `gdn/current-handoff.md`, `data/current-state.json`.

## 핵심 숫자

- 전체 일평균 매출: 16,186,246원 -> 13,310,197원.
- 전체 일평균 변화: -2,876,049원 / -17.77%.
- Meta 광고: -2,304,761원/일, 관측 하락 설명 80.14%.
- Naver 광고 후보: -517,077원/일, 관측 하락 설명 17.98%.
- 자연 소셜: -371,800원/일, 관측 하락 설명 12.93%.
- TikTok 광고: -33,429원/일, 관측 하락 설명 1.16%.
- Google 광고: +41,143원/일.
- TikTok 내부 strict 결제완료: OFF 전 0원, OFF 후 0원.
- TikTok firstTouch 후보: OFF 전 1건 / 234,000원.
- TikTok 미추적 가능성: 27/100.
- TikTok 플랫폼 과대 attribution 가능성: 70/100.

## 현재 판정

TikTok 광고 OFF 뒤 매출은 줄었다. 하지만 현재 read-only 근거만 보면 그 하락을 TikTok 직접 매출 감소로 설명하기는 어렵다. Google 광고는 같은 분류 기준에서 줄지 않았고, 하락은 Meta 광고 근거가 강한 결제완료와 Naver 광고 후보, 자연 소셜 쪽에서 주로 잡힌다.

## 검증 결과

- Backend typecheck: PASS.
- Frontend typecheck: PASS.
- API smoke: PASS.
- Desktop Playwright smoke: PASS.
- Mobile Playwright smoke: PASS, horizontal overflow false.
- No-send: YES.
- No-write: YES.
- No-deploy: YES.
- No-publish: YES.

## 하지 않은 것

- TikTok 광고 ON/OFF 변경하지 않음.
- TikTok Events API send 하지 않음.
- GA4/Meta/Google Ads/Naver 전환 전송하지 않음.
- 운영DB write/import 하지 않음.
- VM Cloud SQLite write 하지 않음.
- 운영 frontend/backend deploy/restart 하지 않음.

## 다음 할일

### Codex가 할 일

1. 7일 OFF 마감 재계산
- Codex 추천: 진행 추천.
- 추천 방향에 대한 자신감: 92%.
- Lane: Green.
- 무엇을 하는가: 2026-05-08 ~ 2026-05-14 전체 window로 새 API를 다시 실행한다.
- 왜 하는가: 현재 값은 5일 중간값이라 요일/미마감 영향이 남아 있다.
- 어떻게 하는가: `/api/ads/tiktok/off-impact-audit?baseline_start=2026-05-01&baseline_end=2026-05-07&off_start=2026-05-08&off_end=2026-05-14`.
- 성공 기준: 중단 유지, 제한 재테스트, 추적 보강 후 보류 중 하나로 판단 가능하다.
- 승인 필요: NO.

2. Naver/Meta 분류 reason code aggregate 추가
- Codex 추천: 진행 추천.
- 추천 방향에 대한 자신감: 84%.
- Lane: Green.
- 무엇을 하는가: raw 식별자 없이 channel reason code별 count/revenue aggregate를 응답에 추가한다.
- 왜 하는가: Meta는 fbp-only를 분리했지만, Naver 후보와 Meta paid 근거를 더 투명하게 보여야 한다.
- 어떻게 하는가: `backend/src/routes/ads.ts`의 channel classifier에 aggregate summary를 추가하고 화면에 접힘 섹션으로 노출한다.
- 성공 기준: paid 확정, pixel/cookie only, organic/referral, unknown이 더 명확히 나뉜다.
- 승인 필요: NO.

### TJ님이 할 일

1. TikTok 광고 재개 여부 결정
- Codex 추천: 지금 즉시 재개보다 7일 OFF 마감 후 결정 추천.
- 추천 방향에 대한 자신감: 88%.
- Lane: Yellow.
- 무엇을 하는가: `중단 유지`, `소액 제한 재테스트`, `추적 보강 후 보류` 중 하나를 선택한다.
- 왜 하는가: 광고비를 다시 켜면 비용이 바로 발생한다.
- 어떻게 하는가: 2026-05-15 이후 `http://localhost:7010/ads/tiktok/off-impact`에서 7일 window 결과를 보고 결정한다.
- 성공 기준: 예산 판단에 쓸 값과 참고만 볼 값을 분리한 결정이 나온다.
- Codex가 대신 못 하는 이유: 광고비 운영 결정은 계정 비용을 바꾸는 사업 판단이다.
- 승인 필요: YES.
