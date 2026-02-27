프롬프트 2: AEO/GEO Score 상세 Accordion 적용
이 변경이 두 번째인 이유는, 현재 페이지에서 가장 많은 세로 공간을 차지하면서 정보 과밀을 일으키는 구간이 바로 AEO/GEO 상세 섹션이기 때문입니다. 이것을 접으면 페이지 전체 스크롤 길이가 약 40% 줄어들어 사용자 경험이 극적으로 개선됩니다.
이 대시보드는 건강식품 기업 biocom.kr의 AEO/GEO 인텔리전스 대시보드야.
기술 스택: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Recharts

## 작업: AEO Score 상세 / GEO Score 상세 섹션을 Accordion으로 변경

### 현재 문제
- AEO Score 상세(65점) 6개 항목 + GEO Score 상세(59점) 6개 항목이
  항상 펼쳐져 있어서 세로 공간을 과도하게 차지함 (약 500px 높이)
- 오버뷰 페이지는 "전체 상황을 빠르게 파악"하는 곳인데
  세부 항목까지 모두 보여주면 인지 부하가 너무 큼
- 스코어 원형 게이지만 봐도 현재 상태는 파악 가능하므로
  상세는 필요할 때만 펼쳐보면 됨

### 변경 사항

#### 1. 기본 상태: 접힘(Collapsed)
- 페이지 로드 시 AEO/GEO 상세 섹션은 접혀 있는 상태
- 접힌 상태에서 보이는 것:
AEO Score 상세 (65점)     [점수 요약 미니바]     ▼ 상세 보기
- 미니바: 각 항목의 점수를 작은 세그먼트로 시각화
  (6개 칸이 있고, 각 칸이 초록/노랑/빨강으로 채워진 형태)

#### 2. 접힌 상태(Collapsed) 컴포넌트
```tsx
// 접힌 상태에서 보여줄 미니 요약
<div className="flex items-center justify-between cursor-pointer group"
     onClick={() => setIsOpen(!isOpen)}>
  <div className="flex items-center gap-3">
    <h3 className="text-base font-semibold text-gray-900">
      AEO Score 상세 (65점)
    </h3>
    {/* 미니 세그먼트 바 - 각 항목 상태를 한눈에 */}
    <div className="flex gap-0.5">
      {items.map(item => (
        <div
          key={item.id}
          className={cn(
            "w-5 h-1.5 rounded-full",
            item.percentage >= 80 ? "bg-emerald-400" :
            item.percentage >= 50 ? "bg-amber-400" : "bg-red-400"
          )}
          title={`${item.name}: ${item.score}/${item.max}`}
        />
      ))}
    </div>
    {/* 개선 필요 항목 수 뱃지 */}
    {lowScoreCount > 0 && (
      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
        {lowScoreCount}개 개선 필요
      </span>
    )}
  </div>
  <ChevronDown className={cn(
    "w-4 h-4 text-gray-400 transition-transform duration-300",
    isOpen && "rotate-180"
  )} />
</div>
```

#### 3. 펼침/접힘 애니메이션
- shadcn/ui의 Collapsible 컴포넌트 사용
  또는 직접 구현 시:
```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

<Collapsible open={isAeoOpen} onOpenChange={setIsAeoOpen}>
  <CollapsibleTrigger asChild>
    {/* 위의 접힌 상태 컴포넌트 */}
  </CollapsibleTrigger>
  <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
    <div className="pt-4 space-y-2">
      {/* 기존 상세 항목들 그대로 */}
    </div>
  </CollapsibleContent>
</Collapsible>
```

#### 4. 펼친 상태(Expanded) 개선
- 기존 상세 항목들은 그대로 유지하되, 아래 스타일 개선 추가:
- 0점 항목(구조화 데이터 0/20, 구조화 데이터 GEO 0/20)은
  `border-l-3 border-amber-400 bg-amber-50/50 pl-3` 로 시각 강조
- 각 항목 사이 `divide-y divide-gray-100`
- 만점 항목(20/20)은 좌측에 `border-l-3 border-emerald-400` 표시

#### 5. AEO / GEO 양쪽 동일 적용
- AEO Score 상세, GEO Score 상세 모두 동일한 Accordion 패턴
- 각각 독립적으로 펼치기/접기 가능 (하나 펼쳐도 다른 하나는 그대로)
- 상태: `const [isAeoOpen, setIsAeoOpen] = useState(false)`
         `const [isGeoOpen, setIsGeoOpen] = useState(false)`
- 기본값: 둘 다 false (접힌 상태)

#### 6. 인터랙션 디테일
- 접힌 상태 호버 시: `bg-gray-50` 배경 + 커서 pointer
- 펼침/접힘 전환: 300ms ease-out
- 접힌 상태의 미니 세그먼트 바에 각 항목 tooltip
  (hover 시 "Q&A 키워드 커버리지: 14/20" 표시)

### 주의사항
- 기존 상세 항목의 데이터, 점수, 아이콘은 모두 그대로 유지
- Accordion이 접힌 상태일 때 페이지 전체 높이가 줄어들어야 함
- 아코디언 상태는 페이지 이동 후 돌아왔을 때 접힌 상태로 리셋 (persist 불필요)