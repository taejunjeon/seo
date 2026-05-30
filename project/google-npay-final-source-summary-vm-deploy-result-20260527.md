# Google NPay Final Source Summary VM Deploy Result - 2026-05-27

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - data/!data_inventory.md
  required_context_docs:
    - docs/report/text-report-template.md
    - frontrule.md
  lane: Yellow
  allowed_actions:
    - VM Cloud backend code deploy approved by TJ
    - read-only API smoke
    - local frontend report update
  forbidden_actions:
    - Google Ads conversion upload/send
    - production DB write/import
    - GTM production publish
  source_window_freshness_confidence:
    source: VM Cloud live API https://att.ainativeos.net
    window: 2026-05-20 ~ 2026-05-26 KST and live last_7d 2026-05-21 ~ 2026-05-27 KST
    freshness: checked immediately after pm2 restart
    confidence: high
```

## 한 줄 결론

VM Cloud Google Ads dashboard summary API가 `npayBridgeReview.finalSourceSummary`와 `dateDistribution`을 내려주도록 배포했다. NPay 결제완료 22건 기준으로 기존 direct/출처 유실 16건은 Google 2건, Meta 2건, Direct/출처 없음 13건, 미분류 5건으로 더 쪼개졌다.

## 변경 파일

- `/home/biocomkr_sns/seo/repo/backend/src/routes/googleAds.ts`
- `/home/biocomkr_sns/seo/repo/backend/src/npayRoasDryRun.ts`
- local report UI: `/Users/vibetj/coding/seo/frontend/src/app/ads/google-roas-report/page.tsx`

## VM Cloud 배포

- deploy path: `/home/biocomkr_sns/seo/repo`
- backup: `.deploy-backups/google-npay-final-source-20260528T000448KST`
- process: `pm2 restart seo-backend --update-env`
- health: `https://att.ainativeos.net/health` status ok

## 2026-05-20 ~ 2026-05-26 KST 결과

- NPay 버튼 클릭: 248건
- Google click id 보존: 186건
- 실제 NPay 결제완료: 22건
- 내부 strong bridge 후보: 17건
- A급 bridge 후보: 12건
- Google Ads 전송 후보: 0건

유입 분류:

- Google 광고: 2건 / 146,600원
- Meta: 2건 / 532,900원
- Naver: 0건
- Organic 검색: 0건
- Direct/출처 없음: 13건 / 1,702,100원
- 미분류: 5건

날짜별 NPay 결제완료:

- 2026-05-20: 3건 / 561,700원
- 2026-05-21: 5건 / 448,900원
- 2026-05-22: 1건 / 496,000원
- 2026-05-23: 2건 / 94,600원
- 2026-05-24: 2건 / 167,800원
- 2026-05-25: 6건 / 861,600원
- 2026-05-26: 3건 / 348,100원

## 해석

A급 bridge 후보는 내부적으로 “NPay 결제완료 주문과 우리 사이트 NPay 버튼 클릭이 강하게 연결된다”는 뜻이다. Google Ads 전송 후보가 되려면 이보다 더 엄격하게 실제 전송 payload에 사용할 raw gclid/gbraid/wbraid가 있어야 한다. 현재 A급 후보 12건은 구매 연결은 강하지만 Google Ads 전송용 직접 click id가 없어 전송 후보 0건으로 유지한다.

## 다음 설계

수동 분해를 줄이려면 NPay 버튼 클릭 시점에 click id, UTM, campaign id, product/value, browser/session, NPay bridge URL hash를 함께 저장하고, NPay 결제완료 sync가 들어오면 서버가 자동으로 final source와 evidence grade를 계산해야 한다. 사람은 ambiguous/direct/unknown만 예외 검토한다.
