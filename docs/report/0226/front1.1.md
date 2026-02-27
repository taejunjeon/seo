# Step 5 — AI Traffic API 연동 + AEO/GEO 펼치기 수정

## 선행 수정: AEO/GEO Score 상세 펼치기 연동

현재 Tab 0에서 "AEO Score 상세"와 "GEO Score 상세"가 각각 독립적으로 펼쳐진다.
AEO만 펼치면 왼쪽만 열리고 오른쪽(GEO)은 비어 보인다.

수정: 둘의 열림/닫힘 상태를 하나의 state로 통합해라.
- AEO 펼치기 버튼을 누르면 → AEO, GEO 둘 다 펼쳐짐
- GEO 펼치기 버튼을 누르면 → AEO, GEO 둘 다 펼쳐짐
- 어느 쪽이든 닫기를 누르면 → 둘 다 닫힘

page.tsx에서 AEO/GEO 펼치기 관련 state를 찾아서 하나로 합쳐라.
예: `const [scoreDetailOpen, setScoreDetailOpen] = useState(false);`
이 state를 양쪽 펼치기 버튼에 동일하게 연결.

---

## 본 작업: AI Traffic API 연동

Step 4에서 만든 컴포넌트들에 실제 API를 연결해라.

### API 엔드포인트

```
GET /api/ga4/ai-traffic?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET /api/ga4/ai-traffic/user-type?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

기간 변경 시 두 API를 동시 호출.

### 수치 포맷팅 (가장 중요)

| 지표 | API 값 예시 | 표시 형식 | 변환 |
|------|-----------|----------|------|
| bounceRate | 0.0837 | "8.4%" | x100, 소수1자리 |
| engagementRate | 0.9163 | "91.6%" | x100, 소수1자리 |
| averageSessionDuration | 1007.5 | "16분 48초" | floor(v/60)분 round(v%60)초 |
| grossPurchaseRevenue | 32980 | "32,980원" | toLocaleString + "원" |

Step 4에서 이미 pct(), dur(), fmt() 함수가 있으니 그걸 사용해라.

### 실 데이터 / fallback 표시

API 응답의 `_meta` 필드 활용:
- `_meta.type === "live"` → 초록 뱃지: "● 실시간 데이터"
- `_meta.type === "fallback"` → 주황 뱃지: "⚠ GA4 미연결"
- `_meta.notice`가 있으면 → 뱃지 옆에 notice 텍스트도 표시

### 소스 테이블

- category별 배지: ai_referral → 파란, search_legacy → 회색
- 필터 토글: "AI 유입만" / "전체"

### 신규 vs 재방문

/api/ga4/ai-traffic/user-type 연동.
summary.new + summary.returning 합이 totals보다 작으면
"일부 미분류 데이터 있음" 안내 표시.

### 로딩/에러/빈 상태

- 로딩: 스켈레톤 (이미 Step 4에서 구현됨)
- 에러: "데이터를 불러올 수 없습니다" + 재시도 버튼
- 빈 (sessions=0): "해당 기간에 AI 유입 데이터가 없습니다"

### page.tsx 정리

Step 4 리포트에 남아있다고 표시된 page.tsx의 잔여 AI Traffic 코드:
- 223~256행 구 타입 정의
- 712~722행 state 변수들
- 1091~1127행 loadAiTraffic 함수
- 1384~1385행 초기 로드

이것들은 Tab 0 요약 카드(기존 2551~2598행)가 아직 참조하고 있으므로,
지금은 건드리지 마라. Step 6에서 Tab 0 요약 카드를 교체할 때 함께 정리한다.

## 완료 확인
- [ ] AEO/GEO 펼치기가 연동되는지 (한쪽 누르면 양쪽 열림/닫힘)
- [ ] bounceRate가 "%"로 표시되는지
- [ ] 체류시간이 "분 초"로 표시되는지
- [ ] 매출이 "원" 붙어서 표시되는지
- [ ] _meta.type에 따라 뱃지 표시
- [ ] _meta.notice가 있으면 표시
- [ ] 기간 변경 시 데이터 갱신
- [ ] 카테고리 배지 표시