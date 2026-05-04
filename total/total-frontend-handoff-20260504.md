# `/total` 프론트엔드 handoff

작성 시각: 2026-05-04 19:18 KST
대상: Claude Code
담당 구분: Codex는 API/데이터 의미와 검증 기준을 제공한다. Claude Code는 `/total` 프론트엔드 화면을 구현한다.
문서 성격: Green Lane handoff 문서. 운영 배포, 운영 DB write, 외부 플랫폼 전송은 하지 않는다.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docurule.md
    - frontrule.md
  project_harness_read:
    - total/!total.md
    - total/total-api-contract-20260504.md
    - total/attribution-vm-evidence-join-contract-20260504.md
  lane: Green
  allowed_actions:
    - frontend handoff 문서 작성
    - UI 정보 구조 설계
    - 화면 문구 제안
  forbidden_actions:
    - 운영 backend 배포
    - 운영 DB write
    - 광고 플랫폼 전환 송출
    - GTM 운영 게시
  source_window_freshness_confidence:
    source: "로컬 /api/total/monthly-channel-summary dry-run, monthly evidence v0.4, total API contract"
    window: "2026-04-01~2026-04-30 KST"
    freshness: "Meta/Google fresh, TikTok local_cache, Naver blocked, NPay intent blocked"
    confidence: 0.84
```

## 10초 결론

`/total` 화면의 목적은 "이번 달 실제 확정 매출이 어느 유입 채널에서 왔는지"를 운영자가 빠르게 판단하게 하는 것이다.

화면에서 절대 섞으면 안 되는 숫자는 두 가지다.
`내부 확정 매출`은 예산 판단의 기준이고, `플랫폼 주장값`은 참고값이다.
Meta, TikTok, Google, Naver의 conversion value는 내부 매출 합계에 더하지 않는다.

## 호출할 API

로컬 검증 endpoint:

```text
GET http://localhost:7020/api/total/monthly-channel-summary?site=biocom&month=2026-04&mode=dry_run
```

현재 7020 프로세스에 route가 반영되어 있지 않으면 개발용 임시 포트에서 확인한다.

```bash
cd backend
PORT=7022 BACKGROUND_JOBS_ENABLED=false SCHEDULED_SEND_ENABLED=false npm exec -- tsx src/server.ts
curl 'http://localhost:7022/api/total/monthly-channel-summary?site=biocom&month=2026-04&mode=dry_run'
```

운영 배포는 별도 승인 전 금지다.

## 첫 화면 정보 순서

첫 화면은 아래 5개를 위에서 아래 순서로 보여준다.

1. 내부 확정 순매출
- 표시값: `monthly_spine.confirmed_net_revenue_ab`
- 2026년 4월 biocom 예시: `499,829,436원`
- 설명 문구: "아임웹 주문과 토스 결제/취소를 맞춘 내부 장부 기준입니다."

2. 분류 완료 매출과 미분류 매출
- 표시값: `evidence.totals.assigned_revenue`, `evidence.totals.unknown_revenue`
- 예시: 분류 완료 `327,906,361원`, 미분류 `171,923,075원`
- 설명 문구: "미분류는 매출이 없다는 뜻이 아니라 유입 증거가 아직 부족한 주문입니다."

3. 채널별 내부 확정 매출
- 표시값: `evidence.channel_summary`
- 각 row에 `display_label`, `orders`, `revenue`, `confidence`를 보여준다.
- 주의: `assist_channels`는 합계에 중복 반영하지 않는다.

4. 플랫폼 참고값
- 표시값: `platform_reference.rows`
- 라벨은 반드시 "플랫폼 참고값" 또는 "광고 플랫폼 주장값"으로 쓴다.
- 설명 문구: "플랫폼 ROAS는 광고 플랫폼이 자기 기준으로 주장하는 참고값입니다. 내부 매출 합계에는 더하지 않습니다."

5. source 경고
- 표시값: `source_freshness`, `platform_reference.rows[].platformReference.freshness`
- `blocked`, `local_cache`, `fallback`, `error`는 상단 경고로 노출한다.

## 플랫폼 reference 표시 규칙

플랫폼 카드는 내부 확정 매출과 플랫폼 주장값을 나란히 보여준다.

카드 예시:

```text
Meta 광고
내부 확정 매출: 213,362,158원
플랫폼 주장값: 489,012,112원
광고비: 122,193,692원
플랫폼 ROAS: 4.00
gap: +275,649,954원
주의: 플랫폼 값은 내부 매출에 합산하지 않음
```

2026년 4월 biocom 검증값:

| platform | internal channel | internal revenue | platform value | spend | freshness |
|---|---|---:|---:|---:|---|
| Meta | `paid_meta` | 213,362,158원 | 489,012,112원 | 122,193,692원 | `fresh` |
| TikTok | `paid_tiktok` | 0원 | 598,161,397원 | 25,267,682원 | `local_cache` |
| Google | `paid_google` | 6,965,110원 | 187,242,635원 | 26,835,011원 | `fresh` |
| Naver | `paid_naver` | 83,054,093원 | 없음 | 없음 | `blocked` |

해석:
TikTok은 플랫폼 주장값은 크지만 내부 confirmed `paid_tiktok` 매출은 0원이다.
이 값은 "TikTok 광고가 실제 매출이 없다"는 확정이 아니라, 현재 내부 증거 기준으로 TikTok primary channel에 붙은 4월 A/B 매출이 없다는 뜻이다.

## TikTok freshness 경고

TikTok reference는 현재 `local_cache`다.

확인 결과:

| 항목 | 값 |
|---|---:|
| local table | `tiktok_ads_daily` |
| imported rows | 346 |
| usable rows | 224 |
| min date | 2026-03-19 |
| max date | 2026-05-03 |
| 2026년 4월 spend | 25,267,682원 |
| 2026년 4월 platform purchase value | 598,161,397원 |
| 2026년 4월 platform ROAS | 23.67 |

화면 경고 문구:

```text
TikTok 값은 로컬 TikTok Ads cache 기준입니다. 2026-05-03까지 데이터가 있으나, 구매값은 한국어 export의 중복 구매 헤더를 추정한 값이라 Ads Manager 화면 대조 전까지 참고값으로만 보세요.
```

이 경고는 `platform_reference.rows[].platformReference.freshness === "local_cache"`일 때 노출한다.

## source 경고 표시 규칙

아래 상태는 초록색으로 표시하지 않는다.

| 상태 | 화면 표현 | 운영 해석 |
|---|---|---|
| `fresh` | 최신 | 예산 판단에 사용 가능 |
| `local_cache` | 로컬 cache | 참고 가능. 최신성/원본 대조 필요 |
| `blocked` | 권한/원천 미연결 | 예산 판단 보류 |
| `error` | 조회 실패 | 예산 판단 보류 |
| `fallback` | fallback | 예산 판단 보류 |

Naver와 NPay는 현재 아래처럼 표시한다.

```text
Naver Ads source는 아직 연결되지 않았습니다.
NPay intent source도 아직 연결되지 않아 NPay 139건은 matched/unmatched 확정 전입니다.
```

## 화면에서 피해야 할 표현

아래 표현은 금지한다.

1. "TikTok ROAS 23.67이 확정됐다"
- 이유: local cache와 export 헤더 추정값이다.

2. "플랫폼 value를 합쳐 전체 매출을 계산"
- 이유: 내부 확정 매출과 플랫폼 주장값이 중복된다.

3. "unknown 매출은 무효"
- 이유: 실제 confirmed 매출이지만 유입 증거가 부족한 것이다.

4. "Naver 매출 83,054,093원이 Naver Ads 확정 매출"
- 이유: 현재는 `NaPm` 기반 paid_naver 후보이며 Naver Ads reference source는 blocked다.

## 클릭 drilldown

첫 화면에서 아래 항목은 클릭하면 상세로 내려가야 한다.

1. `unknown`
- 목적: `unknown_reasons`를 보여준다.
- 우선 사유: `missing_channel_evidence`, `vm_payment_success_missing`, `subscription_without_acquisition_evidence`

2. `platform gap`
- 목적: 내부 confirmed와 플랫폼 주장값 차이를 보여준다.
- 주의: gap은 "오류"가 아니라 attribution window, cross-device, source 유실, campaign mapping 차이일 수 있다.

3. `source warning`
- 목적: 어떤 source 때문에 예산 판단을 보류해야 하는지 보여준다.

## 구현 완료 기준

Claude Code 구현 완료 기준:

1. 첫 화면에서 내부 확정 순매출, 분류 완료 매출, 미분류 매출, 플랫폼 참고값, source 경고가 보인다.
2. 플랫폼 값에는 "참고값" 라벨이 붙는다.
3. TikTok에는 `local_cache` 경고가 보인다.
4. Naver와 NPay에는 blocked/unavailable 경고가 보인다.
5. 내부 confirmed revenue와 platform conversion value가 합산되지 않는다.
6. 모바일에서도 상단 5개 판단 정보가 접힘 없이 읽힌다.

## 다음 할일

1. Claude Code가 `/total` 페이지를 구현한다.
2. Codex가 route 응답에 `sourceDiagnostics`가 충분히 내려오는지 한 번 더 검증한다.
3. TJ님이 `/total` route 운영 배포 여부를 판단한다.

## 변경 기록

| 시각 | 변경 |
|---|---|
| 2026-05-04 19:18 KST | 최초 작성. `/total` 프론트엔드 구현용 정보 구조, 문구, TikTok local cache 경고, 구현 완료 기준 정리 |
