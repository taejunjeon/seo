프롬프트 3: 하단 KPI 카드 4개 디자인 통일
마지막으로 KPI 카드 통일 작업입니다. 이것이 세 번째인 이유는, 위의 두 작업(헤더 정렬 + 상세 accordion)이 완료되면 KPI 카드가 화면에서 상대적으로 더 눈에 띄는 위치로 올라오기 때문에, 이때 통일시켜야 효과가 극대화됩니다.
이 대시보드는 건강식품 기업 biocom.kr의 AEO/GEO 인텔리전스 대시보드야.
기술 스택: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Recharts

## 작업: 하단 4개 KPI 카드 디자인 통일

### 현재 문제
- 총 클릭수(747), 평균 CTR(3.47%), 평균 순위(6.47)는 큰 숫자 + 텍스트 형태인데
  CWV 점수(28)만 작은 원형 게이지로 되어 있음
- 같은 줄에 있는 4개 카드가 서로 다른 시각 언어를 사용해서 리듬이 깨짐
- "실시간" 뱃지가 4개 카드 모두에 반복되어 시각적 노이즈
- 변화량 표시(+20.3%, +0.43%p, +0.4)의 포맷이 통일되지 않음

### 변경 사항

#### 1. 4개 카드 모두 동일한 레이아웃으로 통일
```tsx
interface KpiCardProps {
  label: string           // "총 클릭수"
  value: string           // "747"
  unit?: string           // "%", "점" 등
  change: number          // +20.3
  changeLabel: string     // "전주 7일"
  status: 'up' | 'down' | 'neutral'
  sparklineData?: number[] // 최근 7일 미니 추이 (선택)
}

<div className="bg-white rounded-xl border border-gray-100 p-5 
                hover:shadow-md transition-shadow duration-200">
  {/* 상단: 레이블 */}
  <div className="flex items-center justify-between mb-3">
    <span className="text-sm text-gray-500 font-medium">{label}</span>
    {/* 실시간 뱃지 제거 → 대신 미니 상태 dot만 */}
    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
  </div>

  {/* 중앙: 핵심 숫자 */}
  <div className="flex items-baseline gap-1 mb-1">
    <span className="text-3xl font-bold text-gray-900 
                     tabular-nums tracking-tight">
      {value}
    </span>
    {unit && (
      <span className="text-lg text-gray-400 font-medium">{unit}</span>
    )}
  </div>

  {/* 하단: 변화량 + 기간 */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-1">
      {status === 'up' ? (
        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
      ) : status === 'down' ? (
        <TrendingDown className="w-3.5 h-3.5 text-red-500" />
      ) : (
        <Minus className="w-3.5 h-3.5 text-gray-400" />
      )}
      <span className={cn(
        "text-sm font-medium",
        status === 'up' ? "text-emerald-600" :
        status === 'down' ? "text-red-600" : "text-gray-500"
      )}>
        {change > 0 ? '+' : ''}{change}{changeUnit}
      </span>
      <span className="text-xs text-gray-400">
        {changeLabel}
      </span>
    </div>

    {/* 우측: Sparkline 미니차트 (선택) */}
    {sparklineData && (
      <Recharts.ResponsiveContainer width={60} height={24}>
        <Recharts.LineChart data={sparklineData.map((v, i) => ({v, i}))}>
          <Recharts.Line
            type="monotone"
            dataKey="v"
            stroke={status === 'up' ? '#10B981' : '#EF4444'}
            strokeWidth={1.5}
            dot={false}
          />
        </Recharts.LineChart>
      </Recharts.ResponsiveContainer>
    )}
  </div>
</div>
```

#### 2. CWV 카드 특별 처리 (동일 레이아웃 + 추가 요소)
- CWV 점수도 동일한 카드 레이아웃 사용
- value: "28", label: "CWV 점수"
- 추가: value 숫자의 색상을 점수 기반으로 자동 적용
  - 0-49: text-red-600 (Poor)
  - 50-89: text-amber-600 (Needs Improvement)  
  - 90-100: text-emerald-600 (Good)
- change: 전주 대비 변화량
- 기존 원형 게이지는 제거하고 통일된 숫자 형태로
- 숫자 아래에 작은 인라인 바 추가:
```tsx
  <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2">
    <div 
      className="h-full rounded-full bg-red-500 transition-all duration-500"
      style={{ width: `${score}%` }}
    />
  </div>
```

#### 3. 4개 카드 그리드
```tsx
<div className="grid grid-cols-4 gap-4">
  <KpiCard label="총 클릭수" value="747" change={20.3} changeUnit="%" 
           changeLabel="전주 7일" status="up" sparklineData={[...]} />
  <KpiCard label="평균 CTR" value="3.47" unit="%" change={0.43} changeUnit="%p"
           changeLabel="전주 7일" status="up" sparklineData={[...]} />
  <KpiCard label="평균 순위" value="6.47" change={0.4} changeUnit=""
           changeLabel="전주 7일" status="up" sparklineData={[...]} />
  <KpiCard label="CWV 점수" value="28" unit="점" change={-2} changeUnit="점"
           changeLabel="전주" status="down" isCwv={true} cwvScore={28} />
</div>
```

#### 4. 스타일 디테일
- 숫자 폰트: `font-variant-numeric: tabular-nums` (숫자 정렬)
- 숫자 letter-spacing: `tracking-tight` (-0.02em)
- "실시간" 뱃지: 4개 카드에서 모두 제거
  → 대신 카드 섹션 헤더에 한 번만 "클릭 / 노출 추이  실시간" 표시
- 카드 border: `border border-gray-100` (현재 shadow보다 border가 더 깔끔)
- 호버: `hover:shadow-md hover:border-gray-200 transition-all duration-200`
- Sparkline: 높이 24px, 너비 60px, dot 없음, 곡선 부드럽게

#### 5. 변화량 포맷 통일 규칙
- 클릭수: "+20.3%" (퍼센트)
- CTR: "+0.43%p" (퍼센트포인트)  
- 순위: "+0.4" (낮을수록 좋으므로 순위 하락은 빨간색, 상승은 초록)
  ⚠️ 순위는 숫자가 작을수록 좋으므로 change가 음수(순위 상승)일 때 초록색!
  예: 6.87→6.47 = -0.4 = 초록(개선됨)
- CWV: "+2점" 또는 "-2점"

### 주의사항
- 기존 데이터 소스와 업데이트 로직은 그대로 유지
- KpiCard를 재사용 가능한 별도 컴포넌트로 분리해줘
  (예: components/dashboard/KpiCard.tsx)
- 순위 지표는 역방향 해석 로직 반드시 포함
  (순위 숫자 감소 = 개선 = 초록색)