이 대시보드는 건강식품 기업 biocom.kr의 AEO/GEO 인텔리전스 대시보드야.
기술 스택: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Recharts

## 작업: 칼럼 분석 페이지 테이블 UX 개선

### 현재 문제 요약
1. 30개+ 행이 한꺼번에 표시되어 스크롤이 과도
2. 칼럼 제목이 길어서 행 높이가 들쭉날쭉
3. 종합 스코어 프로그레스 바의 차별화가 약함
4. 필터/정렬 컨트롤 없음
5. 두 테이블 간 시각적 구분 부족

---

### 변경 1: 테이블 상단에 필터 바 추가
```tsx
<div className="flex items-center justify-between mb-4">
  {/* 좌측: 타이틀 + 뱃지 */}
  <div className="flex items-center gap-3">
    <h2 className="text-lg font-bold text-gray-900">칼럼별 성과 분석</h2>
    <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 
                     rounded-full font-medium">
      실시간
    </span>
  </div>
  
  {/* 우측: 필터 컨트롤 */}
  <div className="flex items-center gap-3">
    {/* 기간 선택 */}
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      {['7일', '30일', '90일'].map(period => (
        <button className={cn(
          "px-3 py-1.5 text-xs rounded-md transition-all",
          isActive 
            ? "bg-white text-gray-900 font-medium shadow-sm" 
            : "text-gray-500 hover:text-gray-700"
        )}>
          {period}
        </button>
      ))}
    </div>
    
    {/* 검색 */}
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
      <input 
        placeholder="칼럼 검색..." 
        className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg
                   w-48 focus:outline-none focus:ring-2 focus:ring-teal-500/20 
                   focus:border-teal-500"
      />
    </div>
    
    {/* 데이터 기준 정보 */}
    <span className="text-[11px] text-gray-400">
      2026-02-04 ~ 2026-03-11 · GSC 업데이트
    </span>
  </div>
</div>
```

### 변경 2: 테이블 행 수 제한 + "더 보기"

- 기본 표시: 상위 10개 행만 보여주기
- 10개 아래에 "더 보기" 버튼:
```tsx
{!showAll && totalRows > 10 && (
  <tr>
    <td colSpan={7} className="text-center py-4">
      <button 
        onClick={() => setShowAll(true)}
        className="text-sm text-gray-500 hover:text-gray-900 
                   font-medium transition-colors inline-flex items-center gap-1"
      >
        나머지 {totalRows - 10}개 칼럼 더 보기
        <ChevronDown className="w-4 h-4" />
      </button>
    </td>
  </tr>
)}
```
- "더 보기" 클릭 시 나머지 행이 fade-in 애니메이션으로 나타남
- 펼친 후에는 "접기" 버튼으로 다시 10개로 축소 가능

### 변경 3: 칼럼 제목 한 줄 처리 + hover tooltip
```tsx
{/* 칼럼명 셀 */}
<td className="py-3 pr-4 max-w-[340px]">
  <div className="group relative">
    {/* 제목: 한 줄 truncate */}
    <p className="text-sm font-medium text-gray-900 truncate 
                  max-w-[320px] leading-snug">
      {column.title}
    </p>
    
    {/* URL: 항상 숨기고, 행 호버 시 외부링크 아이콘만 */}
    <a href={column.url} target="_blank"
       className="text-[11px] text-gray-400 hover:text-teal-600 
                  mt-0.5 inline-flex items-center gap-1
                  opacity-0 group-hover:opacity-100 transition-opacity">
      <ExternalLink className="w-3 h-3" />
      {column.url.replace('https://biocom.kr', '')}
    </a>
    
    {/* Tooltip: 전체 제목 */}
    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block
                    bg-gray-900 text-white text-xs rounded-lg px-3 py-2 
                    max-w-[400px] z-50 shadow-lg whitespace-normal">
      {column.title}
    </div>
  </div>
</td>
```

### 변경 4: 종합 스코어 시각 강화
```tsx
{/* 종합 스코어 셀 */}
<td className="py-3 text-right">
  <div className="flex items-center justify-end gap-2.5">
    {/* 프로그레스 바 */}
    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div 
        className={cn(
          "h-full rounded-full transition-all duration-500",
          score >= 40 ? "bg-emerald-500" :
          score >= 25 ? "bg-amber-500" : "bg-red-500"
        )}
        style={{ width: `${score}%` }}
      />
    </div>
    
    {/* 점수 숫자 */}
    <span className={cn(
      "text-sm font-semibold tabular-nums min-w-[28px] text-right",
      score >= 40 ? "text-emerald-700" :
      score >= 25 ? "text-amber-700" : "text-red-600"
    )}>
      {score}
    </span>
  </div>
</td>
```

### 변경 5: 행 스타일 개선
```tsx
<tr className={cn(
  "border-b border-gray-100/80 transition-colors duration-150",
  "hover:bg-slate-50/70",
  // 행 번호가 짝수일 때 미세한 배경 (스트라이프)
  index % 2 === 1 && "bg-slate-50/30"
)}>
```

추가 디테일:
- 테이블 헤더: `sticky top-0 bg-white z-10` + 하단 border 강화
  `border-b-2 border-gray-200`
- 헤더 텍스트: `text-xs font-semibold text-gray-500 uppercase tracking-wider`
- 숫자 컬럼(클릭수, 노출수, CTR, 순위): `text-right tabular-nums`
- 클릭수 0인 행: 전체 텍스트에 `text-gray-400` 적용 (시각적 디엠파시스)
- 클릭수 상위 3개 행: 좌측에 `border-l-3 border-teal-500` 강조 표시

### 변경 6: 정렬 기능 (헤더 클릭)
```tsx
{/* 정렬 가능한 테이블 헤더 */}
<th 
  onClick={() => handleSort('clicks')}
  className="py-3 px-2 text-right text-xs font-semibold text-gray-500 
             uppercase tracking-wider cursor-pointer hover:text-gray-900
             transition-colors select-none group"
>
  <div className="flex items-center justify-end gap-1">
    클릭수
    <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 
                            transition-opacity" />
  </div>
</th>
```

- 기본 정렬: 클릭수 내림차순
- 클릭 가능 컬럼: 클릭수, 노출수, CTR, 순위, 종합 스코어
- 정렬 활성 시: 해당 헤더에 작은 화살표 아이콘 표시
- 같은 헤더 다시 클릭하면 정렬 방향 토글

### 변경 7: 두 테이블 사이 섹션 구분
```tsx
{/* 칼럼 분석 테이블 끝 */}

{/* 섹션 구분선 */}
<div className="my-10 flex items-center gap-4">
  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
  <span className="text-xs text-gray-400 font-medium shrink-0">
    기타 페이지 분석
  </span>
  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
</div>

{/* 상품 페이지 테이블 */}
```

- 단순 border 대신 gradient divider로 시각적 구분
- 가운데 텍스트로 다음 섹션 예고
- 상하 margin `my-10`으로 충분한 여백

### 주의사항
- 기존 데이터 소스, API 호출, 상태 관리 로직 변경 없음
- 테이블 컬럼 순서와 데이터 포맷 유지
- 정렬 상태는 로컬 state로만 관리 (URL 파라미터 불필요)
- 검색은 클라이언트 사이드 필터링으로 구현 (이미 로드된 데이터에서)