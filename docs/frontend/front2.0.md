프롬프트 1: 네비게이션 정렬 및 헤더 리팩토링
이 프롬프트가 첫 번째인 이유는, 헤더는 모든 페이지에 공통으로 적용되는 컴포넌트이므로 가장 먼저 잡아야 나머지 작업에서 레이아웃 기준선이 흔들리지 않기 때문입니다.
이 대시보드는 건강식품 기업 biocom.kr의 AEO/GEO 인텔리전스 대시보드야.
기술 스택: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Recharts

## 작업: 상단 네비게이션 바 정렬 및 디자인 개선

### 현재 문제
1. 좌측 로고 "Biocom AI Agent"가 화면 최좌측 끝에 붙어 있어서
   아래 본문 콘텐츠의 좌측 마진과 정렬이 안 맞음
2. 네비게이션 탭들(오버뷰, 칼럼 분석, 키워드 분석...)이 중앙에 모여 있는데
   로고와의 간격이 불균형
3. 우측 "Connected" 상태와 좌측 로고 사이 빈 공간이 너무 넓어서 헤더가 비어 보임

### 변경 사항

#### 1. 컨테이너 정렬 통일
- 헤더 내부를 `max-w-[1400px] mx-auto px-6` 컨테이너로 감싸기
- 이 컨테이너 너비와 패딩을 본문 콘텐츠 영역과 정확히 동일하게 맞추기
- 로고의 좌측 라인 = 본문 첫 번째 카드의 좌측 라인이 되어야 함

#### 2. 헤더 레이아웃 구조
```tsx
<header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
  <div className="max-w-[1400px] mx-auto px-6">
    <div className="flex items-center justify-between h-14">
      {/* 좌측: 로고 */}
      <div className="flex items-center gap-2 shrink-0">
        <로고아이콘 />
        <div>
          <span className="font-semibold text-sm text-gray-900">Biocom AI Agent</span>
          <span className="text-[10px] text-gray-400 block -mt-0.5 tracking-wider uppercase">AEO/GEO Intelligence</span>
        </div>
      </div>

      {/* 중앙: 네비게이션 탭 */}
      <nav className="flex items-center gap-1">
        {tabs.map(tab => (
          <button className={cn(
            "px-3.5 py-1.5 text-sm rounded-full transition-all duration-200",
            isActive
              ? "bg-gray-900 text-white font-medium shadow-sm"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          )}>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* 우측: 연결 상태 */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Connected
        </div>
      </div>
    </div>
  </div>
</header>
```

#### 3. 스타일 디테일
- 헤더 높이: `h-14` (56px) — 현재보다 약간 컴팩트하게
- `backdrop-blur-md` + `bg-white/80`로 스크롤 시 글래스모피즘 효과
- 활성 탭: `bg-gray-900 text-white rounded-full` (pill 스타일)
- 비활성 탭: `text-gray-500` + hover 시 `bg-gray-100` 부드럽게
- Connected 초록 점: `animate-ping` 으로 실제 라이브 느낌
- 로고 "AEO/GEO INTELLIGENCE" 서브텍스트: `uppercase tracking-wider text-[10px]`

#### 4. 본문 콘텐츠 컨테이너도 동일하게 정렬
- 본문 영역도 `max-w-[1400px] mx-auto px-6`으로 감싸서
  헤더와 본문의 좌우 패딩이 정확히 일치하게 해줘

### 주의사항
- 기존 탭 클릭 라우팅/상태 관리 로직 그대로 유지
- 모바일 반응형은 지금 고려하지 않아도 됨 (데스크톱 우선)
- 탭 이름과 순서 변경 없음