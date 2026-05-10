# gpt0508-33 result report

작성 시각: 2026-05-10 21:50:00 KST
Lane: Green read-only / dry-run / docs / scoped package

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - frontrule.md
  required_context_docs:
    - gptconfirm/gpt0508-32/00-result-report.md
    - gdn/google-ads-dashboard-regular-comparison-20260511.md
    - gdn/campaign-funnel-quality-union-7_14_30d-20260511.md
    - gdn/google-ads-campaign-id-coverage-extension-20260511.md
    - gdn/frontend-dashboard-data-contract-v2-20260511.md
  lane: Green
  allowed_actions:
    - read-only 조사
    - no-send / dry-run
    - 로컬 JSON/Markdown 산출
    - VM dashboard read-only 조회
    - BigQuery read-only 조회
    - Google Ads click_view read-only 조회
    - Path B/order bridge evidence read-only 재검토
    - ConfirmedPurchasePrep same-window 입력 재계산 또는 검증
    - gptconfirm 패키징
    - 커밋/푸시
    - 기존 텔레그램 완료 메시지 발송
  forbidden_actions:
    - Google Ads confirmed_purchase upload
    - Google Ads conversion action 변경
    - GA4/Meta/TikTok/Naver 신규 전송
    - Meta CAPI actual Test Events 호출
    - GTM Production publish
    - frontend 구현 착수
    - 운영DB write
    - VM write/restart/deploy
    - send_candidate=true
    - actual_send_candidate=true
    - NPay click/count/add_payment_info 를 purchase로 승격
    - raw email/phone/member_code/order/payment 저장 또는 logging
    - time-window-only attribution을 예산 판단에 사용
  source_window_freshness_confidence:
    source: VM Cloud Google Ads dashboard local_first route + BigQuery archive+daily union + ConfirmedPurchasePrep same-window input + Path B / paid_click_intent artifacts
    window: Google Ads click_view 2026-04-11~2026-05-10 KST · last_7d 2026-05-03~2026-05-09 · last_30d 2026-04-10~2026-05-09 · BigQuery union 7/14/30d ending 2026-05-09 KST
    freshness: 2026-05-10 21:45:30 KST 생성. VM fetchedAt 21:41 KST (last_7d/last_30d). join-candidates 18:41 KST. ConfirmedPurchasePrep 18:35 KST.
    confidence: 0.93
```

## 5줄 결론

1. campaign_id exact/strong join을 4 evidence(gclid+click_view, Path B order bridge, Path B real evidence, paid_click_intent same-order)로 다시 돌렸고 새 budget-usable match는 0건이다.
2. missing 2,121건의 사유를 결제수단·click 증거·UTM 보유로 6 카테고리(A~G)로 나눠 사람이 볼 수 있는 blocker 표를 만들었다. 가장 큰 blocker는 홈페이지 결제 + click 부재 1,987건.
3. VM dashboard 정기 비교는 status / last_7d / last_30d 모두 200, platform vs internal ROAS 분리 표시 유지, upload_candidate_count 0.
4. BigQuery union 7/14/30d coverage PASS 유지하면서 paid_google session 29,418건 중 internal confirmed 매칭 31건뿐임을 readiness 표로 정리했다(조인 가능 31, 조인 필요 2,121, 불가 사유 다수).
5. send_candidate/actual_send_candidate=false, GA4 purchase·NPay click 승격 금지 유지. Google Ads upload/conversion action 변경 0.

## Track 진척률

- Track A. ConfirmedPurchasePrep 통합 input: 90% → 90% (+0%)
- Track B. Google Ads campaign_id 조인/ROAS 분해: 76% → 76% (+0%)
- Track C. BigQuery campaign funnel quality: 82% → 82% (+0%)
- Track D/KR6. Meta funnel CAPI Test Events readiness: 70% → 70% (+0%)
- Track E. Harness/multi-agent/HOLD Reducer: 88% → 89% (+1%)
- Track F. Frontend/Data Trust Dashboard: 52% → 52% (+0%)

본 sprint는 신규 evidence 발생이 0이라 진척률이 거의 정체다. 새 row가 안 쌓이면 missing 분류만 더 잘게 할 수 있다는 것을 데이터로 확인했다는 점이 Track E +1% 근거다.

## 완료한 것

| 항목 | 결과 | 근거/파일 | 데이터/DB 위치 |
| --- | --- | --- | --- |
| campaign_id exact join 반복 | 0 new exact/strong | gdn/google-ads-campaign-id-exact-join-repeat-20260511.md | 로컬 JSON + click_view read-only |
| ConfirmedPurchasePrep blocker breakdown | 6 카테고리화 완료 | gdn/confirmed-purchase-campaign-id-blocker-breakdown-20260511.md | 로컬 JSON |
| VM dashboard 정기 비교 반복 | PASS (200 / 200 / 200) | gdn/google-ads-dashboard-regular-comparison-repeat-20260511.md | VM Cloud / Google Ads API read-only |
| BigQuery union internal match readiness | PASS for coverage / HOLD for internal extension | gdn/campaign-funnel-quality-union-internal-match-readiness-20260511.md | BigQuery read-only |
| gptconfirm 패키지 | 완료 | gptconfirm/gpt0508-33 | 로컬 문서 |

## 멈춘 것 (HOLD)

- campaign_id missing 2,121건은 새 exact/strong evidence가 쌓일 때까지 HOLD. 다음 Green 재호출 대기.
- Google Ads upload candidate 0 유지. Red lane 변경 없음.
- frontend F0 data contract v2 구현은 본 sprint 범위 밖이라 HOLD.

## 검증 결과

- JSON parse PASS (4개 산출 JSON + 1개 manifest)
- validate_wiki_links PASS
- harness-preflight-check --strict PASS
- git diff --check PASS
- backend typecheck: code 변경 없음 (skip)
- raw email/phone/member_code/order/payment 패턴 스캔 PASS

## 남은 리스크

- 운영 imweb 주문에 gclid/gbraid/wbraid가 보존되지 않으면 budget-usable row는 다음 sprint도 정체할 가능성이 높다.
- Path B controlled traffic preview ledger가 `would_store=false`라 ledger 자체가 누적되지 않는 상태가 길어지면 exact session click row가 계속 0일 수 있다.
- 본 보고는 직전 sprint와 동일 fetchedAt 시점 기준이라 cost/conv/ROAS delta가 0이다. 하루 후 재호출 시 자연 변동을 다시 비교해야 한다.

## 다음 액션

- Google Ads upload는 HOLD 유지 (Red — 명시 승인 전 금지).
- frontend F0 data contract v2 구현 HOLD (Yellow — 별도 sprint 진입 시 재논의).
- Green 반복: ConfirmedPurchasePrep 입력 갱신 시 4 evidence join 반복 + blocker breakdown 다시 만들기.
- VM dashboard / BigQuery union read-only 호출은 24시간 주기로 반복.
