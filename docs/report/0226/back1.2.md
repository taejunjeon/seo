# Step 2.5 — [Codex] API 응답에 실 데이터/샘플 데이터 출처 태깅

작업 대상: backend/src/ga4.ts + backend/src/server.ts

---

## 배경

기획서에 있던 비교 수치 중 일부가 실 데이터가 아닌 업계 벤치마크였음이 확인됨.
(예: AI 전환율 기획서 15.9% vs 실제 0.47%)

모든 API 응답에 "이 데이터가 실제 GA4 데이터인지"를 명시하여
프론트에서 실/샘플 구분 표시가 가능하도록 한다.

---

## 변경 요구사항

### 1. 모든 AI traffic 관련 API 응답에 dataSource 메타데이터 추가

```typescript
interface DataSourceMeta {
  /** "live" = GA4 실시간 조회 결과, "fallback" = GA4 미연결 시 빈값 */
  type: "live" | "fallback";
  /** GA4 property ID (live일 때만) */
  propertyId?: string;
  /** 조회 시각 ISO */
  queriedAt: string;
  /** 조회 기간 */
  period: { startDate: string; endDate: string };
}
```

적용 대상 API:
- `GET /api/ga4/ai-traffic` → 응답에 `_meta: DataSourceMeta` 추가
- `GET /api/ga4/ai-traffic/user-type` → 동일
- `GET /api/ga4/top-sources` → 동일

### 2. GA4 미연결 시 처리

현재 GA4 credential이 없으면 0값 구조를 반환하고 있다.
이때 `_meta.type`을 `"fallback"`으로 설정하고,
`_meta.notice`에 `"GA4 미연결. 실제 데이터가 아닙니다."` 메시지를 추가해라.

```typescript
// GA4 미연결 시 응답 예시
{
  _meta: {
    type: "fallback",
    queriedAt: "2026-02-26T15:00:00Z",
    period: { startDate: "2026-01-27", endDate: "2026-02-26" },
    notice: "GA4 미연결. 실제 데이터가 아닙니다."
  },
  totals: { sessions: 0, ... }
}
```

### 3. 정상 연결 시 응답 예시

```typescript
{
  _meta: {
    type: "live",
    propertyId: "properties/XXXXXXX",
    queriedAt: "2026-02-26T15:00:00Z",
    period: { startDate: "2026-01-27", endDate: "2026-02-26" }
  },
  totals: { sessions: 215, bounceRate: 0.0837, ... }
}
```

### 4. 기존 응답 구조는 유지

`_meta`는 최상위에 추가 필드로 넣는다.
기존 `totals`, `bySource`, `byLandingPage` 등의 구조는 변경하지 마라.

---

## 완료 후 확인

1. `/api/ga4/ai-traffic` 호출 시 `_meta.type`이 `"live"`인지 확인
2. GA4 credential을 제거/무효화했을 때 `_meta.type`이 `"fallback"`인지 확인
3. `_meta.queriedAt`이 실제 호출 시각인지 확인