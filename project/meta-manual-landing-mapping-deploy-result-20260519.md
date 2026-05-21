# Meta 수동 검증 랜딩 매핑 backend 배포 결과

작성 시각: 2026-05-19 18:58 KST
대상: VM Cloud `seo-backend` / `/api/ads`, `/api/ads/meta-utm-diagnostics`
결과: PASS_WITH_NOTES

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - meta/campaign-alias-mapping.md
    - caio/!caio.md
  lane: Yellow
  allowed_actions:
    - VM Cloud backend target file backup
    - deploy backend/src/routes/ads.ts
    - deploy compiled backend/dist/routes/ads.js
    - backend typecheck/build
    - seo-backend restart
    - read-only API smoke/post-check
    - CAIO document update
  forbidden_actions:
    - Meta CAPI send/backfill
    - GA4 Measurement Protocol send
    - Google Ads/TikTok/Naver/Meta mutate
    - GTM submit/create_version/publish
    - Imweb header/footer save
    - operating DB write/import
    - VM Cloud SQLite schema/data write
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud Meta Ads Insights API + VM Cloud first-party attribution ledger
    window: Meta UTM diagnostics last_7d / ROAS summary last_3d,last_7d,last_30d
    freshness: 2026-05-19 18:50 KST post-check
    confidence: high for deployment, high for manual verified adset mapping, medium for remaining unmapped interpretation
```

## 10초 요약

`/songyuul07`, `/hwajung01`처럼 Meta API에 직접 나오지 않은 랜딩 경로를 내부 유입 원장과 수동 검증값으로 캠페인/광고세트에 연결하는 코드가 VM Cloud에 배포됐다.

핵심 성과는 Meta가 직접 보여주지 못한 연결을 내부 원장으로 복원한 것이다.
특히 `hwajung01`은 Meta 구매전환값이 0원인데 내부 원장 기준 매출은 5,374,000원으로 잡혀, 플랫폼 화면만 보면 놓쳤을 매출을 복원한 사례다.

## 배포 범위

- 반영 파일: `backend/src/routes/ads.ts`
- 함께 반영한 컴파일 결과: `backend/dist/routes/ads.js`
- VM 백업 경로: `/home/biocomkr_sns/seo/repo/.deploy-backups/meta-manual-landing-mapping-20260519-184705`
- `seo-backend` restart count: `4280 -> 4281`
- `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1` 유지 확인

## 운영 화면에 반영된 수동 검증 매핑

| 내부 유입 경로 | 캠페인 ID | 광고세트 ID | 운영 화면 상태 | 내부 원장 기준 매출 | 내부 원장 기준 주문 | 내부 원장 기준 ROAS |
|---|---|---|---|---:|---:|---:|
| `/songyuul07` | `120245003319500396` | `120245370784880396` | Section A ready / match 100% | 33,961,250원 | 101건 | 20.77x |
| `/hwajung01` | `120245003319500396` | `120245498758680396` | Section A ready / match 100% | 5,374,000원 | 13건 | 66.22x |

비교용 Meta 플랫폼 주장값:

| 광고세트 | Meta 구매전환값 | Meta 구매 수 | 광고비 |
|---|---:|---:|---:|
| `meta_biocom_songyuul_260512` | 6,466,800원 | 21건 | 1,634,852원 |
| `meta_biocom_hwajung_260514` | 0원 | 0건 | 81,158원 |

해석:

- `내부 원장 기준 매출`은 실제 결제완료 주문 장부와 광고 유입 증거를 연결한 값이다. 예산 판단에 우선 사용한다.
- `Meta 구매전환값`은 Meta가 자체 정책과 attribution 기준으로 보여준 참고값이다. 최근 데이터 제한 때문에 실제 내부 매출과 차이가 날 수 있다.
- 이번 수동 검증 매핑은 특히 `Meta 구매전환값이 0원이어도 내부 원장 매출이 있는 케이스`를 복원했다는 점에서 의미가 크다.

## 검증 결과

| 검증 | 결과 | 근거 |
|---|---|---|
| 로컬 backend typecheck | PASS | `npm run typecheck` |
| 로컬 backend build | PASS | `npm run build` |
| VM backend typecheck | PASS | 배포 중 원격 `npm run typecheck` |
| VM backend build | PASS | 배포 중 원격 `npm run build` |
| VM health | PASS | `https://att.ainativeos.net/health` 200 / 0.285s |
| Meta UTM diagnostics | PASS | 200 / 0.450s, `songyuul07`, `hwajung01` target adset ready 확인 |
| ROAS summary cache | PASS_WITH_NOTES | 재시작 직후 첫 요청 64.740s `live_cache_miss`, 직후 재조회 0.227s `in_memory_precompute` |
| PM2 상태 | PASS | `seo-backend online`, memory 583.1MB, restart 4281 |

## 하지 않은 것

- Meta CAPI 전송 0건.
- GA4 Measurement Protocol 전송 0건.
- Google Ads/TikTok/Naver/Meta 계정 mutate 0건.
- GTM submit/create_version/publish 0건.
- Imweb header/footer 저장 0건.
- 운영DB write/import 0건.
- VM Cloud SQLite schema/data write 0건.

## 남은 주의점

- ROAS summary는 PM2 재시작으로 in-memory cache가 한 번 비었다. 첫 요청은 느렸지만 후속 요청은 0.227s로 회복됐다.
- 남은 미맵핑은 `songyuul07`, `hwajung01` 외의 path/query 변형, 또는 campaign/adset/ad evidence가 부족한 주문일 가능성이 있다.
- 이번 매핑은 자동 추론이 아니라 수동 검증값이다. 신뢰도는 높지만, 같은 방식의 경로가 늘어나면 별도 검증 큐가 필요하다.

## Auditor Verdict

PASS_WITH_NOTES

승인된 backend 배포와 문서 업데이트만 수행했다.
운영 화면의 수동 검증 매핑 반영은 확인됐고, 외부 플랫폼 전송과 DB write는 수행하지 않았다.
단, 재시작 직후 ROAS summary cache가 비는 현상은 남아 있어 precompute 상시화 결과에서 warm-start 전략을 별도로 판단해야 한다.
