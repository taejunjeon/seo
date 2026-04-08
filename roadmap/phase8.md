# Phase 8 — UX 정성 데이터 · 도구 도입 판단

> **최종 업데이트**: 2026-04-03
> **담당**: Codex (백엔드/설계) + Claude Code (프론트/UXUI)

## 왜 필요한가

AI Agent가 전환 저해 요인 가설을 만들려면 정성 신호 필요. BigQuery/Amplitude/Mixpanel은 실험 규모와 분석 니즈에 따라 검토한다.

### 사용자 베네핏

- **대표(TJ)**: "왜 체크아웃에서 이탈하는가?"에 대해 히트맵/리플레이/설문 기반 정성 가설을 매주 받음. AI가 "이 버튼이 안 보여서 이탈할 가능성이 높다"는 식으로 구체적 개선안 제시
- **기획팀**: 퍼널 분석을 SQL 없이 self-serve로 돌리고, 실험 결과와 UX 인사이트를 같은 맥락에서 비교
- **개발팀**: GA4 raw event를 BigQuery에서 직접 SQL로 조회하여, (not set) 귀속 문제나 전환 누락을 원인 수준까지 추적

---

## 스프린트별 완성도

| Sprint | 목표 | 담당 | 완료 |
|--------|------|------|------|
| P8-S1 | Contentsquare/Hotjar 트래킹 삽입 · 계측 | Claude Code (프론트/UXUI) | 0% |
| P8-S2 | Amplitude/Mixpanel/Braze MCP 도입 필요 여부 판단 | Codex (백엔드/설계) | 20% |
| P8-S3 | BigQuery 도입 필요 여부 판단 | Codex (백엔드/설계) | 0% |

> **Claude Code 남은 작업**: P8-S1 Contentsquare/Hotjar 트래킹 스니펫 삽입, 핵심 CTA 클릭/폼 오류/스크롤 depth 계측. 도입 결정 후 즉시 진행 가능.

---

## 상세 내용

### 기간

2026-05-03 ~ 2026-05-31

### 목표

- Meta 랜딩/체크아웃 페이지에서 왜 이탈하는지 정성 신호를 확보
- AI Agent가 UX 개선 가설을 만들 수 있게 함
- Amplitude/Mixpanel/Braze MCP 도입 필요 여부 판단

### 권장안

- 신규 도입이면 Hotjar보다 **Contentsquare Free 우선 검토**
- 이유: Funnels, Error Monitoring, GA4/Mixpanel 연동, AI trial이 함께 제공됨

---

### P8-S1: Contentsquare/Hotjar 트래킹 삽입 · 계측

**담당**: Claude Code (프론트/UXUI)

- 랜딩/체크아웃에 tracking snippet 설치
- 핵심 CTA 클릭/폼 오류/스크롤 depth 계측
- 설문/피드백 위젯 삽입
- 세션 ID와 내부 실험 ID 매핑 규칙 설계
- 주간 UX insight summary 파이프라인 설계
- AI Agent 입력용 요약 포맷 정의
- 랜딩/체크아웃 friction 유형 taxonomy 정의

---

### P8-S2: Amplitude/Mixpanel/Braze MCP 도입 필요 여부 판단

**담당**: Codex (백엔드/설계)

기간: 2026-05-17 ~ 2026-05-31

원칙:
- 초반에는 `GA4 + 내부 원장 + SQL/API`로 충분하다
- 아래 신호가 생길 때 도입 검토한다

#### 도입 검토 신호

- 마케터/기획자가 SQL 없이 퍼널/코호트/리텐션을 자주 보고 싶다
- 실험이 3개 이상 병행된다
- 세션 리플레이와 이벤트 분석을 한 화면에서 보고 싶다
- GA4만으로는 사용자 단위 실험 분석이 번거롭다

#### 권장 우선순위

1. `Amplitude` 우선 검토 — 이후 Braze 계열로 갈 경우 연동 스토리가 자연스럽다
2. `Mixpanel` 대안 검토 — 이벤트 퍼널 중심 팀이고 구현 속도를 더 중시할 때
3. 둘 다 동시에 도입하지 않음

#### 도입하지 않아도 되는 조건

- 실험 수가 적고
- SQL/API 리포트로 의사결정이 충분하며
- Claude/Codex가 운영 리포트 자동화까지 커버할 수 있을 때

#### Braze MCP 판단 (0401 추가)

결론: **Braze MCP는 지금 당장 필수는 아니다.**

현재 병목은 `메시지 오케스트레이션 도구 부족`이 아니라 `실험 원장`, `결제 귀속`, `실발송 exact-match`, `send log 적재`다.

Braze MCP가 필요해질 수 있는 시점:
- 실행 채널이 3개 이상으로 늘어날 때
- 월 단위 active journey/campaign가 5개 이상으로 늘어날 때
- 마케터가 자연어로 상태를 묻고 싶어질 때
- Braze가 실제 실행 source of truth가 될 때

**2026년 상반기에는 Braze MCP 도입을 보류하는 쪽이 맞다.**

---

### P8-S3: BigQuery 도입 필요 여부 판단

**담당**: Codex (백엔드/설계)

#### BigQuery가 필요해지는 신호

- GA4 raw event를 직접 SQL로 분석해야 하는 질문이 반복될 때
- GA4 데이터와 내부 원장(주문/실험/CRM)을 조인해서 봐야 할 때
- 일별/주별 자동 리포트를 SQL 파이프라인으로 만들어야 할 때
- 실험 수가 늘어나 `(not set)` 귀속 문제를 raw event 레벨에서 진단해야 할 때
- Meta/카카오 광고 비용과 GA4 전환 이벤트를 한 테이블에서 비교해야 할 때

#### 현재 BigQuery 없이 가능한 것

- 상담사 가치 분석 → 운영 DB 직접 조회 (callprice API)
- CRM 실험 원장 → 로컬 SQLite (crm-local API)
- 재구매 코호트 → 운영 DB 직접 조회
- 북극성 지표 → callprice overview API로 근사치 산출

#### BigQuery가 있으면 추가로 가능한 것

- GA4 raw event 기반 퍼널 분석 (page_view → begin_checkout → purchase 이탈률)
- `(not set)` 매출의 실제 유입 경로 역추적
- 광고 클릭 → 세션 → 구매까지 attribution 정밀 분석
- 대규모 사용자 행동 패턴 클러스터링

#### 도입하지 않아도 되는 조건

- 실험 수가 3개 미만이고
- GA4 UI + 내부 원장 SQL로 의사결정이 충분하며
- `(not set)` 비중이 낮거나 PG 직결로 설명 가능할 때

#### 권장 시점

Phase 7(1차 증분 실험 라이브) 이후. 실험을 실제로 돌리면서 GA4 raw data 분석이 반복적으로 필요해지면 그때 도입.

#### 비용 참고

GA4 → BigQuery export는 무료 (GA4 설정에서 활성화). BigQuery 쿼리 비용은 월 1TB 무료 → 이후 $6.25/TB. 초기에는 사실상 무료.

---

## 중요한 원칙

- AI Agent는 히트맵/리플레이/설문을 기반으로 **전환 저해 요인 가설**을 제시할 수 있다
- 그러나 "전환율이 실제로 올랐는지"는 반드시 A/B 실험과 iROAS 결과로 검증해야 한다
- 정성 인사이트는 Hotjar/Contentsquare, 인과 검증은 control/treatment 실험 + iROAS

---

## 완료 기준

- [ ] 매주 AI Agent가 UX 개선 가설 3~5개를 자동 정리
- [ ] 그중 최소 1개는 실험 설계로 이어짐
- [ ] Amplitude/Mixpanel/Braze MCP 도입 여부 1페이지 결론 작성
- [ ] BigQuery 도입 여부 결론 작성
