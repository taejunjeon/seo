# 캠페인 관리 기능 현황 및 개선 계획

> **기준일**: 2026-04-06
> **Phase**: P5 확장

---

## 구현 완료

| API | 용도 |
|-----|------|
| `GET /api/meta/campaigns/health` | 캠페인 목표 헬스체크 |
| `GET /api/meta/campaigns/:id/detail` | 광고세트 + 소재 + 타겟 + 썸네일 + 영상/이미지 구분 |
| `POST /api/meta/campaigns/:id/pause` | 일시정지 |
| `POST /api/meta/campaigns/:id/activate` | 활성화 |
| `POST /api/meta/campaigns/prepare` | 생성 사전검토 |
| `POST /api/meta/campaigns/create` | 캠페인 생성 (PAUSED) |
| `POST /api/meta/campaigns/clone-as-leads` | 기존 소재 복사 → LEADS 캠페인 생성 |

## 프론트 UI

- 캠페인 목록 (목표 배지 + 상태 + 진단)
- 행 클릭 → 소재 썸네일 카드 (영상 ▶ 버튼 / 이미지 구분)
- 타겟 지역 + 연령 배지
- 일시정지/활성화 버튼
- "LEADS로 복사" 기능
- "+ 새 캠페인 준비" 폼

---

## LEADS로 복사 실패 원인 (0406)

`adset_create_failed: Invalid parameter`

### 원인 분석 (Codex 피드백)

1. **소스 TRAFFIC 광고세트에 `promoted_object`가 없음** — LEADS 캠페인에서는 필수
2. **page_id만으로 부족할 수 있음** — 웹사이트 리드형이면 `pixel_id` + `custom_event_type=LEAD`도 필요
3. **소스의 타겟/배치 설정이 LEADS와 호환 안 될 수 있음** — TRAFFIC용 설정을 그대로 복사하면 일부 필드 충돌

### 해결 방향

**먼저 결정해야 할 것**: AIBIO가 인스턴트 폼 방식인가, 웹사이트 리드 방식인가?

| 방식 | promoted_object | 장점 | 단점 |
|------|----------------|------|------|
| **인스턴트 폼** | `page_id` + 인스턴트 폼 ID | 빠른 리드 수집, 앱 내 완성 | 리드 품질 낮을 수 있음 |
| **웹사이트 리드** | `pixel_id` + `custom_event_type=LEAD` | 리드 품질 높음, 후속 추적 가능 | 랜딩 페이지 필요, 폼 마찰 |

AIBIO는 `generate_lead` GTM 태그가 이미 있으므로 **웹사이트 리드가 더 적합** (Codex 의견).

---

## 캠페인 행 개선 계획 (Codex 피드백)

### 추가할 성과 컬럼

| 컬럼 | 표시 | 목표별 분기 |
|------|------|-----------|
| **결과** | 전환 건수 | TRAFFIC→랜딩뷰, LEADS→리드, SALES→구매 |
| **결과당 비용** | CPL/CPA | 비용/결과 |
| **CTR** | 클릭률 | 공통 |
| **지출** | 총 비용 | 공통 |
| **신호등** | 초록/노란/빨간 | CTR>2%=초록, 결과>0=초록, 목표=트래픽=빨간 |

### 진단 라벨 개선

| Before | After |
|--------|-------|
| "문제 있음" | "치명: 트래픽 목표 — 전환 최적화 안 됨" |
| "정상" | "양호" 또는 "주의: 최근 7일 리드 0" |

---

## AIBIO 전환 리드 설정 결론

- **대표 전환 이벤트**: `generate_lead` (GTM 설정 완료)
- **Meta 캠페인 목표**: `OUTCOME_LEADS`
- **방식**: 웹사이트 리드 (인스턴트 폼보다 품질 우선)
- **promoted_object**: `pixel_id` + `custom_event_type=LEAD` (page_id만으로는 부족)
- **선행 조건**: GA4에서 `generate_lead`를 전환으로 표시, Meta 픽셀에서 Lead 이벤트 인식 확인

---

## 다음 개발

| # | 작업 | 담당 |
|---|------|------|
| 1 | 캠페인 행에 결과/비용/CTR/신호등 추가 | Claude Code |
| 2 | clone-as-leads에 pixel_id + event_type 지원 | Codex |
| 3 | 진단 라벨 개선 ("문제 있음" → 원인형 라벨) | Claude Code |
| 4 | AIBIO generate_lead → Meta 전환 연결 확인 | TJ 운영 |
