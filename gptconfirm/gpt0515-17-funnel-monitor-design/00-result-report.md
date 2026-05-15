# 00. Result Report

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_harness_read:
    - AGENTS.md
    - frontrule.md
    - docurule.md
  required_context_docs:
    - gptconfirm/gpt0515-15/00-result-report.md
    - gptconfirm/gpt0515-16-header-guard-v31/00-result-report.md
    - project/total.md
  lane: Green
  allowed_actions:
    - frontend UX design
    - data contract planning
    - Claude Code implementation handoff
  forbidden_actions:
    - frontend implementation
    - VM Cloud deploy/restart
    - Meta/Google/GA4/TikTok/Naver send
    - GTM publish
    - 운영DB write/import
  source_window_freshness_confidence:
    source: current incident docs + frontend rules
    window: 2026-05-15 Meta Purchase recovery
    freshness: current sprint context
    confidence: high_for_design_medium_until_data_contract_smoke
```

작성 시각: 2026-05-15 KST

## 한 줄 결론

프론트엔드 페이지는 `전환 퍼널 관제`로 설계한다. 이 화면의 목적은 “광고/자연 유입이 결제 시작, 결제완료, Meta CAPI 전송까지 어디서 새는지”를 일별·주별 퍼널로 보여주는 것이다.

## 사용자 베네핏

TJ님이 얻는 이점은 네 가지다.

1. 매출 누락을 하루 뒤가 아니라 당일에 본다.
2. Meta CAPI가 살아 있는지 감으로 보지 않고 숫자로 본다.
3. “결제 시작은 있는데 구매가 없다”와 “구매는 있는데 Meta로 안 갔다”를 분리한다.
4. UTM 유입/직접 유입/매칭 안 된 주문을 보고 광고 링크나 아임웹 코드 문제를 바로 고친다.

## 권장 화면 이름

- 메뉴 카드명: `전환 퍼널 관제`
- 페이지 제목: `오늘 전환 신호가 어디서 새는가`
- 보조 설명: `유입부터 결제완료, Meta CAPI 전송까지 한 화면에서 확인합니다. 광고 플랫폼 주장값이 아니라 VM Cloud 수집 원장 기준입니다.`

## 권장 위치

기존 AI CRM 카드 영역에 카드 1개를 추가한다.

- 위치: `https://biocom.ainativeos.net/#ai-crm`
- 카드명: `전환 퍼널 관제`
- 설명: `유입·결제 시작·결제완료·Meta CAPI 전송 누락을 일별/주별로 확인`
- 로컬 후보 URL: `http://localhost:7010/ai-crm/conversion-funnel`
- 운영 후보 URL: `https://biocom.ainativeos.net/ai-crm/conversion-funnel`

## 구성 원칙

- 첫 화면은 기술 진단이 아니라 “지금 조치가 필요한가”를 보여준다.
- 숫자는 항상 기준 시각, 집계 기간, source를 같이 표시한다.
- `운영DB`, `VM Cloud`, `Meta UI`, `GA4`를 섞어 쓰지 않는다.
- 주문/결제 정본과 광고 유입 evidence를 분리한다.
- raw 주문번호, 결제키, click id, 회원값은 기본 화면에 노출하지 않는다.

## Claude Code 구현 범위

Codex는 구현하지 않는다. Claude Code는 아래 문서를 기준으로 설계 그대로 구현한다.

- `01-ux-page-design.md`: 화면 구조
- `02-funnel-data-contract.md`: API/data contract
- `03-implementation-handoff.md`: 구현 순서와 성공 기준

## 하지 않은 것

- 프론트엔드 코드 수정 안 함
- 백엔드 API 구현 안 함
- VM Cloud 배포/restart 안 함
- 외부 플랫폼 전송 안 함
- 운영DB write/import 안 함

## 다음 판단

이 설계는 Green Lane이다. 구현은 Claude Code가 맡되, VM Cloud backend API 추가나 운영 배포는 Yellow 승인으로 분리한다.
