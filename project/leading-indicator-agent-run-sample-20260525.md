# Leading Indicator Agent Sample Run Packet

작성 시각: 2026-05-25 21:44 KST
기준일: 2026-05-25
문서 성격: 선행지표 에이전트 샘플 실행 기록
Lane: Green documentation
운영 영향: 운영DB 변경 없음 / VM Cloud 배포 없음 / 외부 플랫폼 전송 없음 / 자동 예산 조정 없음

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/leading-indicator/README.md
    - harness/leading-indicator/RUN_PACKET_SCHEMA.md
    - harness/leading-indicator/EVAL_SUITE.md
    - project/leading-indicator-source-matrix-20260525.md
    - project/leading-indicator-mini-digital-twin-plan-20260525.md
  lane: Green
  allowed_actions:
    - sample_run_packet_write_local
    - documentation_update
  forbidden_actions:
    - operating_db_write
    - vm_cloud_deploy_or_restart
    - gtm_publish
    - platform_send_or_upload
    - raw_identifier_output
    - auto_budget_change
  source_window_freshness_confidence:
    source: 2026-05-17 P0 dry-run aggregate snapshot
    window: historical rolling 7d sample
    freshness: historical_sample_only
    confidence: medium for schema validation, low for current business decision
```

## 한 줄 결론

- 결론: 실행 기록 샘플은 만들 수 있고, AI가 시나리오를 자동 제안하는 구조도 표현 가능하다.
- Project: leading indicator agent
- Lane: Green
- Mode: sample run packet schema check
- Auditor verdict: PASS_WITH_NOTES
- 현재 판정: 샘플 형식은 사용 가능, 현재 운영 판단은 최신 read-only 재실행 전 HOLD
- 자신감: 88%
- 기준 시각: 2026-05-25 21:44 KST

## 10초 요약

이 파일은 실제 운영 분석 결과가 아니라, 앞으로 선행지표 에이전트가 매번 남길 실행 기록의 샘플이다.
2026-05-17 P0 dry-run의 biocom 7일 유입 10,720건, 결제완료 388건을 형식 검증용으로 사용했다.

중요한 변화는 미니 디지털 트윈이다.
운영자가 직접 값을 바꾸는 슬라이더가 아니라, 에이전트가 source freshness와 행동 병목을 보고 `현재 유지`, `결제 이탈 개선`, `콘텐츠 몰입 개선`, `트래픽 확대 전 점검` 같은 시나리오를 자동 제안한다.

## 봤던 source/window/freshness/confidence

| 항목 | 값 |
|---|---|
| source | VM Cloud funnel-health cached aggregate + local P0 dry-run docs |
| window | 2026-05-17 기준 historical rolling 7d sample |
| freshness | historical_sample_only |
| site | biocom |
| confidence | schema validation에는 medium, 현재 운영 판단에는 low |
| 주의 | 최신 source가 아니므로 광고/매출 의사결정에 쓰면 안 됨 |

## 구매 전 행동 신호 요약

| 신호 | 샘플 숫자 | 해석 | 판정 |
|---|---:|---|---|
| 유입 | 10,720건 | 방문 기준선은 충분히 큰 샘플이다 | PASS for sample |
| 결제 시작 | 2,250건 | 결제 의도는 보이지만 구매완료는 아니다 | PASS_WITH_NOTES |
| 실제 결제완료 | 388건 | 후행 정답 label로만 사용한다 | PASS |
| 결제 시작 대비 결제완료율 | 17.24% | 결제 단계 병목 후보를 볼 수 있다 | PASS_WITH_NOTES |
| 매출 | 없음 | 이 샘플에서는 매출 source를 조회하지 않았다 | HOLD |
| 광고비 | 없음 | 이 샘플에서는 광고비 source를 조회하지 않았다 | HOLD |

## AI 시나리오 제안 샘플

이 시나리오는 실제 운영 추천이 아니다.
실행 기록에 어떤 모양으로 남길지 보여주는 예시다.

### 1. 현재 흐름 유지

- 왜 제안하는가: 다른 시나리오와 비교할 기준선이 필요하다.
- 가정: 방문자 수와 전환율이 그대로 유지된다.
- 예상 주문 수: 7일 약 388건
- 매출/ROAS: HOLD. 실제 매출과 광고비 source가 없어서 계산하지 않는다.
- 사람이 읽는 해석: 현재 흐름이 유지되면 주문 수는 이 정도다. 돈 판단은 아직 하지 않는다.

### 2. 결제 이탈 1차 개선

- 왜 제안하는가: 결제 시작 2,250건 중 결제완료 388건이라 결제 단계 병목을 볼 가치가 있다.
- 가정: 결제 시작 대비 결제완료율이 1%p 오른다.
- 예상 주문 수: 7일 약 411건
- 예상 추가 주문: 약 23건
- 매출/ROAS: HOLD. 실제 매출과 광고비 source가 없어서 계산하지 않는다.
- 사람이 읽는 해석: 결제 UX 개선이 랜딩 개선보다 빠른 성과를 낼 수 있는지 확인하는 시나리오다.

### 3. 콘텐츠 몰입 개선

- 왜 제안하는가: 선행지표 온톨로지에서 콘텐츠 몰입은 구매 전 행동 후보이고, GA4 행동 join으로 검증 가능하다.
- 가정: 방문자 수는 그대로이고 구매 전환율이 상대적으로 10% 좋아진다.
- 예상 주문 수: 7일 약 427건
- 예상 추가 주문: 약 39건
- 매출/ROAS: HOLD. 실제 매출과 광고비 source가 없어서 계산하지 않는다.
- 사람이 읽는 해석: 리뷰/상세페이지/콘텐츠 개선이 실제 주문으로 이어질 수 있는지 보는 방향성 시나리오다.

### 4. 트래픽 확대 전 점검

- 왜 제안하는가: 광고비를 늘리면 방문자는 늘 수 있지만 유입 품질이 낮아질 수 있다.
- 가정: 방문자 수는 15% 늘고, 전환율은 상대적으로 5% 낮아진다.
- 예상 주문 수: 7일 약 424건
- 예상 추가 주문: 약 36건
- 매출/ROAS: HOLD. 실제 매출과 광고비 source가 없어서 계산하지 않는다.
- 사람이 읽는 해석: 예산 확대 전 방어 시나리오다. 자동 예산 변경은 하지 않는다.

## 품질 판정

| 판정 항목 | 결과 | 이유 |
|---|---|---|
| 데이터 최신성 | HOLD | 2026-05-17 snapshot이라 현재 운영 판단에는 오래됐다 |
| 비교 집단 크기 | PASS | 샘플 7일 유입 10,720건, 결제완료 388건 |
| 구매 후 행동 혼입 방지 | PASS_WITH_NOTES | 구매완료는 후행 label로만 쓰고, 추천 신호는 결제 시작 이후 병목 후보로 제한 |
| 결제 정본 분리 | PASS_WITH_NOTES | 매출 source가 없어서 구매완료 주문 수까지만 표시 |
| 미니 디지털 트윈 안전성 | PASS_WITH_NOTES | AI 시나리오는 자동 제안하지만 예산 변경/외부 전송/확정 매출 예측은 하지 않음 |

## 하지 않은 것

| 항목 | 하지 않은 이유 | 승인 필요 여부 |
|---|---|---|
| 운영DB write | 샘플 문서 작성 범위 밖 | YES |
| VM Cloud deploy/restart | 이번 작업은 로컬 문서와 샘플 파일 생성 | YES |
| GTM publish | tracking 운영 변경 없음 | YES |
| 외부 플랫폼 전송 | GA4/Meta/Google/TikTok/Naver 전환값 변경 방지 | YES |
| 자동 예산 조정 | 시뮬레이션은 판단 보조만 담당 | YES |

## 금지선 확인

| 항목 | 결과 |
|---|---|
| No-send verified | YES |
| No-write verified | YES |
| No-deploy verified | YES |
| No-publish verified | YES |
| No-platform-send verified | YES |
| raw identifier output | 0 |
| auto budget change | 0 |

## 산출물

- 기계용 JSON: `data/project/leading-indicator-agent-run-sample-20260525.json`
- 사람용 보고서: `project/leading-indicator-agent-run-sample-20260525.md`
- source matrix: `project/leading-indicator-source-matrix-20260525.md`

## 다음 할 일

### Auto Green

1. 최신 source로 실제 read-only dry-run을 다시 실행한다.
   - 무엇: VM Cloud, GA4 BigQuery, 실제 결제완료 원장, 광고비 snapshot을 같은 site/window로 읽는다.
   - 왜: 샘플은 stale이라 실제 추천 후보로 쓸 수 없다.
   - 어떻게: source matrix의 primary/cross-check 순서대로 조회하고 JSON/Markdown 실행 기록을 저장한다.
   - 성공 기준: source freshness가 fresh 또는 warn으로 기록되고, 매출/광고비 HOLD가 줄어든다.

2. AI 시나리오 제안 규칙을 코드 없이 dry-run 문서로 먼저 닫는다.
   - 무엇: 어떤 조건이면 결제 이탈 개선, 콘텐츠 몰입 개선, 트래픽 확대 전 점검을 제안할지 규칙을 쓴다.
   - 왜: 시뮬레이션이 멋대로 추천하지 않게 하기 위해서다.
   - 어떻게: `harness/leading-indicator/EVAL_SUITE.md`에 연결되는 candidate rule로 작성한다.
   - 성공 기준: 각 시나리오가 source, 이유, 금지선, HOLD 조건을 갖는다.

### Approval Needed

현재 없음.
실제 운영 화면 반영, VM Cloud 배포, Telegram 실제 발송, 광고 예산 변경, 외부 플랫폼 전송은 별도 승인 후에만 진행한다.

