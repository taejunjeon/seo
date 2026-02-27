
## Claude Code 프롬프트: 두 가지 이슈 동시 해결

이 두 문제는 서로 연결되어 있으므로 하나의 프롬프트로 같이 처리하는 것이 효율적입니다.

```
이 대시보드는 건강식품 기업 biocom.kr의 AEO/GEO 인텔리전스 대시보드야.
기술 스택: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Recharts

## 작업: 배경 톤 보정 + 네비게이션 바 높이 조정

### 문제 1: 화면 전체가 순백색이라 깊이감 없이 썰렁함
### 문제 2: 상단 네비게이션 바가 얇아서 시각적 안정감 부족

---

### 변경사항 A: 배경 레이어링 (깊이감 추가)

#### A-1. 페이지 배경색 변경
- body 또는 최상위 wrapper 배경: `#FFFFFF` → `bg-[#F8FAFB]`
  (순백에서 아주 미세한 쿨 그레이로 — 모니터 따라 거의 안 보일 정도)
- 또는 Tailwind: `bg-slate-50/70` 또는 `bg-gray-50/50`

#### A-2. 카드는 순백색 유지
- 모든 카드 컴포넌트: `bg-white` 유지
- 이렇게 하면 카드가 배경 대비 자연스럽게 "떠 있는" 느낌
- 카드 border: `border border-gray-100/80` (현재보다 살짝 더 선명하게)
- 카드 shadow: `shadow-sm` 유지 (과하지 않게)

#### A-3. 최상단 스코어 영역에 섹션 배경 추가
- AEO Score + GEO Score 카드가 있는 영역 전체를 감싸는 wrapper에:
  `bg-gradient-to-b from-slate-50/80 to-transparent`
  (위에서 아래로 자연스럽게 사라지는 미세한 배경)
- 또는 단순히 wrapper에 `bg-slate-50/40 rounded-2xl p-4 -mx-2` 
  적용해서 스코어 영역만 미세한 배경 존으로 구분
- 이렇게 하면 "여기가 핵심 지표"라는 시각적 구역 신호가 생김

#### A-4. 차트 라인 색상 강화
- 클릭/노출 추이 차트의 라인이 현재 너무 연한 색
- 클릭수 라인: `#0D9488` (teal-600) → 좀 더 선명하게
- 노출수 라인: `#94A3B8` (slate-400) → `#64748B` (slate-500)으로
- 라인 strokeWidth: 1.5 → 2
- 차트 영역 아래 fill: `fill="url(#gradient)"` 
  (라인 아래를 매우 연한 그라디언트로 채워서 존재감 추가)
```tsx
<defs>
  <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#0D9488" stopOpacity={0.12} />
    <stop offset="100%" stopColor="#0D9488" stopOpacity={0} />
  </linearGradient>
</defs>
<Area dataKey="clicks" fill="url(#clickGradient)" stroke="#0D9488" />
```

#### A-5. KPI 카드 Sparkline 색상도 강화
- 현재 미니 차트 라인이 너무 연해서 거의 안 보임
- strokeWidth: 1.5 → 2
- 상승 추세: `#10B981` (emerald-500)
- 하락 추세: `#EF4444` (red-500)

---

### 변경사항 B: 네비게이션 바 높이 및 비례 조정

#### B-1. 바 높이 증가
- 현재: 약 `h-12` (48px)
- 변경: `h-14` (56px) 또는 `h-[60px]`
- 최대 `h-16` (64px)까지 허용, 그 이상은 X

#### B-2. 바 내부 요소 수직 정렬 보정
```tsx
<header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md 
                    border-b border-gray-200/60">
  <div className="max-w-[1400px] mx-auto px-6">
    <div className="flex items-center justify-between h-14">
      
      {/* 로고: 서브텍스트와 함께 수직 중앙 */}
      <div className="flex items-center gap-2.5 shrink-0">
        <로고아이콘 className="w-7 h-7" />
        <div className="flex flex-col">
          <span className="font-semibold text-[13px] text-gray-900 leading-tight">
            Biocom AI Agent
          </span>
          <span className="text-[9px] text-gray-400 uppercase tracking-[0.08em] leading-tight">
            AEO/GEO Intelligence
          </span>
        </div>
      </div>

      {/* 탭: py 늘려서 클릭 영역 확대 */}
      <nav className="flex items-center gap-1">
        {tabs.map(tab => (
          <button className={cn(
            "px-4 py-2 text-[13px] rounded-full transition-all duration-200",
            isActive
              ? "bg-gray-900 text-white font-medium"
              : "text-gray-500 hover:text-gray-800 hover:bg-gray-100/80"
          )}>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Connected: 위치 그대로 */}
      <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        Connected
      </div>
    </div>
  </div>
</header>
```

#### B-3. 바 하단 border 미세 강화
- 현재: `border-b border-gray-100` (거의 안 보임)
- 변경: `border-b border-gray-200/60`
- 이렇게 하면 바와 콘텐츠 영역의 경계가 더 명확해짐
- 대안: border 대신 `shadow-[0_1px_3px_rgba(0,0,0,0.04)]` 로
  아주 미세한 그림자만 추가 (Linear 스타일)

---

### 변경하지 않을 것 (중요)
- 카드 레이아웃, 그리드, 컴포넌트 구조: 변경 없음
- AEO/GEO 원형 게이지: 변경 없음
- Accordion 동작: 변경 없음
- KPI 카드 내부 구조: 변경 없음
- 데이터 바인딩, 상태관리: 변경 없음
- 모바일 반응형: 지금 고려 안 함

### 검증 포인트
- 변경 후 카드가 배경 대비 자연스럽게 구분되는지 확인
- 네비바가 두꺼워진 후 로고 위아래 여백이 충분한지 확인
- 차트 라인이 눈에 잘 들어오는지 확인
- 전체 페이지가 "깔끔하면서도 따뜻한" 느낌인지 확인
```

---

## 보충 설명: "왜 색을 추가하는 게 아니라 톤 차이인가?"

이 부분이 중요한데, 대시보드에서 색을 많이 쓰면 오히려 데이터 시각화의 색상과 충돌합니다. 차트의 초록/노랑/빨강, 상태 뱃지의 색상이 데이터를 전달하는 핵심 수단인데, 배경이나 장식에도 색이 많으면 사용자가 "이 색이 데이터 의미인지 장식인지" 혼동합니다. Edward Tufte의 정보 디자인 원칙에서도 데이터 이외의 시각 요소(non-data ink)는 최소화하라고 강조합니다. 그래서 Datadog, Grafana, Amplitude 같은 전문 대시보드들이 모두 중립적 배경(흰색/연회색/다크) 위에 데이터 색상만 두드러지게 하는 방식을 씁니다.

현재 디자인은 이 방향이 맞는데, 단지 배경의 톤 차이가 0%라서 평면적으로 보이는 것뿐입니다. 배경을 순백에서 `#F8FAFB`로 바꾸는 것만으로도 체감이 크게 달라질 것이고, 차트 영역 아래의 그라디언트 fill을 추가하면 색감이 풍부해진 느낌이 들면서도 데이터 가독성은 유지됩니다.

