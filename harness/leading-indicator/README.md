# Leading Indicator Harness

작성 시각: 2026-05-25 19:15 KST
기준일: 2026-05-25
문서 성격: 선행지표 에이전트 Green Lane 패키지 인덱스
Lane: Green documentation

## 10초 요약

이 폴더는 구매 전 선행지표 에이전트가 같은 규칙으로 실행되게 만드는 문서형 하네스다.
지금 단계에서는 읽기, 계산, 보고만 다룬다.
운영DB 변경, VM Cloud 배포, GTM 게시, 외부 플랫폼 전송은 이 폴더의 실행 범위 밖이다.

## 포함 문서

| 문서 | 역할 |
|---|---|
| `TOOL_REGISTRY.md` | 어떤 도구가 읽기 전용인지, 승인 후 작업인지, 자동 실행 금지인지 정리 |
| `EVAL_SUITE.md` | 추천 후보를 바로 써도 되는지 품질 판정 |
| `RUN_PACKET_SCHEMA.md` | 실행 결과를 JSON/Markdown 한 쌍으로 남기는 양식 |
| `project/leading-indicator-source-matrix-20260525.md` | 숫자별 primary/cross-check/fallback source 기준 |
| `data/project/leading-indicator-agent-run-sample-20260525.json` | 기계가 읽는 샘플 실행 기록 |
| `project/leading-indicator-agent-run-sample-20260525.md` | 사람이 읽는 샘플 실행 보고서 |

## 연결 문서

| 문서 | 역할 |
|---|---|
| `ontology/leading-indicator-ontology-extension-20260525.md` | 구매 전 행동을 설명하는 온톨로지 확장 |
| `project/leading-indicator-mini-digital-twin-plan-20260525.md` | AI가 자동 제안하는 매출/주요 지표 what-if 시뮬레이터 설계 |
| `project/!indicatoragent.md` | 선행지표 에이전트 기존 설계 정본 |
| `harness/!harness.md` | Growth Data Agent Harness 기준 |

## 실행 원칙

1. source/window/freshness/confidence를 항상 남긴다.
2. 추천 후보에는 품질 판정을 붙인다.
3. 결제 후 행동을 구매 전 신호로 쓰지 않는다.
4. 플랫폼 주장값과 내부 결제완료 매출을 섞지 않는다.
5. Green Lane에서는 읽기, 문서, 로컬 계산, 정적 보고만 한다.
6. 미니 디지털 트윈은 사람이 직접 값을 바꾸는 슬라이더가 아니라, 에이전트가 source 기준선을 읽고 시나리오를 자동 제안하는 방식으로 시작한다.

## 금지선

- 운영DB write/import 금지
- VM Cloud deploy/restart 금지
- GTM Preview/Production publish 금지
- GA4/Meta/Google Ads/TikTok/Naver send/upload 금지
- raw customer/order/payment/ad-click identifier 출력 금지
- 미니 디지털 트윈 결과로 자동 예산 조정 금지

## 현재 상태

- 문서형 하네스 초안: 작성 완료
- 코드 구현: 없음
- 자동 실행: 없음
- 외부 영향: 없음
