# gpt0508-43 Claude Code Imweb Landing Deploy-B Sprint — 결과 보고

작성 시각: 2026-05-11 18:00:00 KST
Lane: Green code + Green deploy + Yellow GTM Preview packet ready
자신감: 90%

## 1. 이번에 가능해진 것

이제 biocom.kr 의 광고/결제 트래픽이 실제로 들어올 때마다, 그 유입 흔적이 **운영 서버의 고객 유입 장부 (site_landing_ledger)** 에 자동으로 한 줄씩 적힌다. 이번 sprint 안에 deploy 가 끝났고, deploy 후 약 15 분 안 첫 실 트래픽 2 건이 정상적으로 장부에 기록된 것을 직접 확인했다. 그 결과는 새로 노출된 화면 (`biocom.ainativeos.net/ads/site-landing`) 과 조회 기능 (`/api/attribution/site-landing/summary`) 두 곳에서 바로 볼 수 있다.

## 2. 왜 필요했는지

직전 sprint (gpt0508-42) 까지는 코드가 우리 main 에는 올라가 있었지만 **운영 서버는 옛 버전 그대로** 였다. 그 상태로는 "고객이 광고에서 들어왔는지 자연 검색에서 들어왔는지" 같은 비율을 우리 자체 DB 로 측정할 수 없었다. 그리고 보고서 양식이 여전히 개발 용어 위주라 비개발자가 첫 문단만 보고 의미를 파악하기 어려웠다.

## 3. 실제 결과

| 항목 | 값 |
|---|---|
| 운영 서버 deploy | 성공 (Claude Code 가 직접 SSH 로 실행) |
| 새 조회 기능 `summary API` | HTTP 200, 응답 안 raw 이메일/전화/주민번호/카드 패턴 0 hit |
| 새 화면 `/ads/site-landing` | biocom.ainativeos.net 200 OK, coffeevip.ainativeos.net 200 OK |
| **첫 실 트래픽 row** | **2 건** (deploy 후 약 15 분) |
| 채널 분포 | paid_search 2 건 |
| 광고 source | google.com (UTM `googleads_shopping_supplements_youngdays`) |
| 광고 클릭 ID 저장 방식 | hash 2 건 / raw 0 건 — **hash only 정책 production 100% 검증** |
| sessionKey 매칭 가능 row | 2 건 (전부) |
| 보고서 양식 v1.3 | 정본 갱신 완료, 본 보고서가 첫 적용 사례 |

## 4. 아직 안 된 것

- live row 가 아직 2 건. 의미 있는 분포 (organic vs paid 비율 등) 산출에는 72 시간 정도 자연 트래픽 수집 필요.
- naver 광고 클릭 ID (`nclick_id`) 캡쳐 / organic page_view 단독 캡쳐는 GTM Preview 작업 후보 — verdict `GTM_PREVIEW_CONDITIONAL_RECOMMENDED`, 72 시간 live 측정 후 확정.
- imweb footer 직접 수정은 last resort (parked) 그대로.
- Google Ads click_view 30d snapshot prep table 은 design 만 — Ads API credentials 필요.

## 5. Track 진척률

| Track | 이전 | 현재 | Δ |
|---|---:|---:|---:|
| A Order Truth / Payment Bridge | 99 | 99 | 0 |
| B Imweb Source Capture | 75 | 88 | +13 (deploy 후 live row 도착 → production 검증) |
| C Imweb Attribution Builder | 92 | 94 | +2 |
| D Dashboard Decision View | 87 | 90 | +3 (frontend 페이지 200) |
| E Platform Exact Attribution | 45 | 45 | 0 |
| F QA / Guard / Data Guide | 95 | 96 | +1 (v1.3 정본 갱신) |
| G Site Landing Ledger | 86 | 95 | +9 (live row 도착 + hash only 검증) |

## 6. 다음 할 일 (owner 분리 + 추천 점수표)

| Owner | Action | Claude Code 직접 가능? | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | 72시간 후 site-landing summary 재호출 + GTM verdict 재산출 | YES | — | 80 | 50 | 80 | 10 | 72 | 진행 (시간 조건) |
| TJ님 | biocom.ainativeos.net/ads/site-landing 본인 브라우저로 방문 + 1~2 페이지 클릭 | NO — 사용자 본인 트래픽 | 자연 트래픽 가속화로 live verdict 빠르게 수집 가능 | 60 | 80 | 50 | 5 | 60 | 진행 (편의 시) |
| TJ님 | GTM Container 진입 + Custom HTML 임시 Preview (gpt0508-42 작업5 packet) | NO — Web UI 자동 조작 불가 | Container admin 권한, GTM Web UI 자동화 불가 | 70 | 60 | 90 | 30 | 65 | 조건부 진행 (72h live verdict 가 60% 미만 명확해진 후) |
| Claude Code | TJ 가 GTM Container JSON export 주면 Custom HTML 충돌 검토 | YES (export 받으면) | — | 70 | 50 | 70 | 10 | 65 | 보류 (TJ export 대기) |
| TJ님 | Google Ads click_view CSV export OR Ads API credentials 발급 | NO — Google 계정 권한 | Web UI 자동 / OAuth2 발급 불가 | 50 | 30 | 70 | 30 | 50 | 보류 (1차 목표 live verdict 본 후) |

## 7. 검증 / 금지선 / commit 등 세부 사항

상세표는 `01-implementation-and-validation.md` §3 (검증) + §4 (금지선 준수) 참고. 본 보고서는 사람이 이해하는 결과만 둠. raw click_id 저장 production 검증 결과 (hash 2 / raw 0) 만 §3 표 마지막 행에 명시.

## 8. Telegram + 멀티 에이전트

- Telegram: TJ standing skip 정책 그대로. 본 sprint 도 발송 0. 별도 문서 X (본 §8 한 문단으로 통합).
- 멀티 에이전트: **활용하지 않았다**. 본 sprint 의 7 작업이 같은 산출 (gptconfirm 5 문서 + 양식 정본) 에 sequential 의존, deploy 중간 결과가 다음 작업 입력이라 sequential 이 더 효율. 멀티 에이전트가 의미 있었을 케이스 (외부 API 동시 호출 / 여러 site 병렬 audit) 는 본 sprint 에 없었음.

## 9. commit / push

(commit 직후 본 §9 에 hash 명시)

## 10. Verdict

`SPRINT_DEPLOY_B_LIVE_TRAFFIC_VERIFIED_HASH_ONLY_POLICY_100_PCT_GTM_CONDITIONAL`
