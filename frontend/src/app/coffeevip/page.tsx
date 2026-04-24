"use client";

import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from "recharts";
import styles from "../coupon/page.module.css";

// 한국 관례: 만 단위로 표기. 억 넘으면 "N억 M,MMM만" 형식.
const fmtKRW = (v: number): string => {
  if (!v || v === 0) return "₩0";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const rest = abs % 100_000_000;
    const man = Math.round(rest / 10_000);
    return `${sign}₩${eok}억${man ? ` ${man.toLocaleString("ko-KR")}만` : ""}`;
  }
  if (abs >= 10_000) {
    const man = Math.round(abs / 10_000);
    return `${sign}₩${man.toLocaleString("ko-KR")}만`;
  }
  return `${sign}₩${abs.toLocaleString("ko-KR")}`;
};
const fmtNum = (v: number) => v.toLocaleString("ko-KR");

type Tier = {
  key: string;
  name: string;
  subtitle: string;
  minSpend: number;
  targetCount: number;
  targetPct: string;
  accent: string;
  sourceRef: string;
  positioning: string;
  perks: string[];
};

// ─────────────────────────────────────────────────────────────
// 전략 1 · 개별 티어 (더클린커피 단독 구매액 기준)
// ─────────────────────────────────────────────────────────────
const TIERS_COFFEE: Tier[] = [
  {
    key: "green",
    name: "GREEN",
    subtitle: "웰컴 멤버 · 더클린 세계관의 입구",
    minSpend: 100_000,
    targetCount: 1600,
    targetPct: "22.7%",
    accent: "#65a30d",
    sourceRef: "누적 10만원+ 고객 (2회+ 재구매 1,528명 + 고액 첫 구매층 포함)",
    positioning: "아직은 '특별'은 아니지만, 이미 문 안쪽에 있다는 감각",
    perks: [
      "생일월 시즌 드립백 1세트 선물",
      "신규 원두 출시 24시간 Pre-access 알림톡",
      "재구매 골든타임(17–21일) 자동 쿠폰",
      "커핑노트 전자책 '산지로 떠나는 10분 여행'",
      "GREEN 전용 알림톡 채널 (월 2회 큐레이션 레터)",
    ],
  },
  {
    key: "crew",
    name: "CREW",
    subtitle: "더클린 크루 · 2번째 구매를 완성한 커피 애호가",
    minSpend: 300_000,
    targetCount: 620,
    targetPct: "8.8%",
    accent: "#0D9488",
    sourceRef: "3회+ 구매 고객 911명 + Toss 고액 객단가 상단",
    positioning: "공식 커뮤니티 멤버. '이 브랜드는 나를 기억한다'의 시작점",
    perks: [
      "GREEN 특전 전체 승계",
      "분기 1회 시즌 드립백 박스 (연 4회)",
      "더클린 웰니스 체험 패키지 1회 — 리커버리랩(AIBIO) 1회 방문권",
      "VIP 전용 원두 선행 판매 (일반판매 48h 전)",
      "연 1회 홈브루잉 화상 클래스",
      "전용 로고 머그잔 / 드립퍼 선물 키트 (입회 웰컴)",
    ],
  },
  {
    key: "reserve",
    name: "RESERVE",
    subtitle: "리저브 · 커피를 넘어 라이프스타일로",
    minSpend: 800_000,
    targetCount: 180,
    targetPct: "2.6%",
    accent: "#f59e0b",
    sourceRef: "6회+ VIP 383명 중 상위 절반",
    positioning: "'커피가 내 건강과 이어져 있다'는 첫 실감",
    perks: [
      "CREW 특전 전체 + 상향 조정",
      "연 1회 종합대사기능 검사 키트 제공",
      "건강기능식품 체험 2종 (오메가·마그네슘 라인, 분기 교체)",
      "저속노화 도시락 체험 4팩 (분기별 1팩)",
      "리커버리랩 AIBIO 센터 1일 체험권 (동반 1인 가능)",
      "VIP 한정 마이크로 로트 원두 패키지 연 2회 (일반판매 불가)",
      "카카오톡 전용 VIP 응대 채널 (24h 내 답변)",
    ],
  },
  {
    key: "signature",
    name: "SIGNATURE",
    subtitle: "시그니처 · 커피 매니아와 웰니스 멤버십의 교차점",
    minSpend: 2_000_000,
    targetCount: 55,
    targetPct: "0.78%",
    accent: "#8b5cf6",
    sourceRef: "슈퍼 VIP(10–19회) 117명 중 상위",
    positioning: "더클린커피 내 최상위 매니아 · 자발적 전파자의 거점",
    perks: [
      "RESERVE 특전 전체 + 격상",
      "리커버리랩 AIBIO 웰니스 회원권 3개월 이용권",
      "건강검사 키트 연 2회 (상·하반기 변화 추적 리포트)",
      "VIP 한정 원두 패키지 연 4회 — 산지 테이스팅 키트 동봉",
      "바리스타 1:1 홈브루잉 컨설팅 (화상 30분, 연 2회)",
      "바이오컴 웰니스 라운지 초대 (연 2회, 동반 1인)",
      "커피 프로필 DNA 발급 — 개인 취향·카페인 적응형 프로파일",
      "가족 1인 GREEN 등급 무료 가입권 ('세컨드 프라이밍')",
    ],
  },
  {
    key: "master",
    name: "MASTER",
    subtitle: "마스터 · 더클린커피 VVIP",
    minSpend: 5_000_000,
    targetCount: 12,
    targetPct: "0.17%",
    accent: "#0f172a",
    sourceRef: "울트라 VIP(20회+) 8명 기반 + 커피 단독 500만+ 구매층",
    positioning: "'특별'이 아니라 '유일'. 커피 한 줄기로 가장 깊이 들어온 멤버",
    perks: [
      "SIGNATURE 특전 전체 풀패키지 업그레이드",
      "리커버리랩 AIBIO 웰니스 회원권 연간 무제한 이용권",
      "바이오컴 웰니스 라운지 초대 연 4회 (동반 2인)",
      "분기별 마스터 바리스타 커핑 세션 — 개인화 산지 추천",
      "연 1회 마이크로 로트 원두 산지 다큐멘터리 키트 (생산자 영상편지 + 미출시 원두)",
      "바이오해커 네트워크 웰니스 컨설팅 연 1회 (바이오컴 영양사)",
      "빈 앰배서더 기프트 권한 — 지인 3명에게 GREEN 입회권 + 웰컴 박스 증정",
      "노쇼 보증 — 원두 품절 시 대체 원두 + 보상 쿠폰 자동 발송",
      "VIP 핫라인 — 피드백·요청 직통 채널 (월 1회 이내)",
      "개인 건강 대시보드 — 건강검사 + AIBIO 세션 + 커피 구매 연동 인사이트",
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// 전략 2 · 통합 멤버십 (바이오컴 × AIBIO × 더클린커피 합산)
// 금액대 근거: imweb_orders 실데이터 (2026-01-01 ~ 2026-04-15, 3.5개월)
//   ₩5,000만+ 5명 (평균 1.5억) / ₩1,000만+ 8명 / ₩500만+ 10명 / ₩200만+ 23명 / ₩100만+ 132명 / ₩50만+ 704명
// 연간 환산 및 바이오컴 정기구매 성향 감안해 ×1.5~2 보정
// ─────────────────────────────────────────────────────────────
const TIERS_UNIFIED: Tier[] = [
  {
    key: "initiate",
    name: "INITIATE",
    subtitle: "통합 멤버십의 입구 · 바이오컴 세계관 안으로",
    minSpend: 300_000,
    targetCount: 6068,
    targetPct: "—",
    accent: "#0ea5e9",
    sourceRef: "v3 실측 6,068명 (3채널 12개월 정합)",
    positioning: "커피·건기식·AIBIO 어느 하나라도 '습관'이 된 고객",
    perks: [
      "통합 멤버십 웰컴 키트 (원두 + 건기식 샘플 + AIBIO 1일권)",
      "모든 채널(커피/건기식/AIBIO) 신상품 24시간 Pre-access",
      "생일월 통합 기프트 박스 (연 1회)",
      "VIP 전용 알림톡 채널 (월 2회 큐레이션 레터)",
      "재구매 골든타임 쿠폰 (자동 발급)",
    ],
  },
  {
    key: "silver",
    name: "SILVER",
    subtitle: "통합 실버 · 바이오컴 중핵 멤버",
    minSpend: 1_000_000,
    targetCount: 598,
    targetPct: "—",
    accent: "#64748b",
    sourceRef: "v3 실측 598명 (2채널 13 · 1채널 585)",
    positioning: "바이오컴의 '정기구매 문화'에 정착한 고객. 이탈률이 급격히 낮은 구간",
    perks: [
      "INITIATE 특전 전체 승계",
      "AIBIO 센터 1일 체험권 연 2회 (동반 1인)",
      "건강기능식품 체험 분기 1종 (오메가·마그네슘 라인 순환)",
      "저속노화 도시락 체험 분기 1팩",
      "더클린커피 VIP 한정 원두 연 2회 발송",
      "카카오톡 전용 VIP 응대 채널 (24h 내 답변)",
    ],
  },
  {
    key: "gold",
    name: "GOLD",
    subtitle: "통합 골드 · 바이오컴 웰니스 본격 진입",
    minSpend: 2_000_000,
    targetCount: 200,
    targetPct: "—",
    accent: "#f59e0b",
    sourceRef: "v3 실측 200명 (3채널 1 · 2채널 16 · 1채널 183)",
    positioning: "커피 × 건기식 × AIBIO 3종 세트가 생활 일부가 된 고객",
    perks: [
      "SILVER 특전 전체 + 격상",
      "리커버리랩 AIBIO 웰니스 회원권 3개월 이용권",
      "연 1회 종합대사기능 검사 키트 (결과 리포트 동봉)",
      "건강기능식품 2종 + 저속노화 도시락 8팩 (분기별 2팩)",
      "VIP 한정 마이크로 로트 원두 연 4회 발송",
      "바이오컴 웰니스 라운지 초대 연 2회 (동반 1인)",
      "커피 프로필 DNA 발급 — 개인 취향·카페인 적응형 프로파일",
      "가족 1인 INITIATE 등급 무료 가입권 ('세컨드 프라이밍')",
    ],
  },
  {
    key: "platinum",
    name: "PLATINUM",
    subtitle: "통합 플래티넘 · 바이오컴 최상위 정기구매자",
    minSpend: 5_000_000,
    targetCount: 20,
    targetPct: "—",
    accent: "#8b5cf6",
    sourceRef: "v3 실측 20명 (바이오컴+AIBIO 1 · 단독 19)",
    positioning: "바이오컴이 '1년의 웰니스 플랜'을 함께 설계하는 레벨",
    perks: [
      "GOLD 특전 전체 풀패키지 업그레이드",
      "리커버리랩 AIBIO 웰니스 회원권 연 6개월 이용권",
      "건강검사 키트 연 2회 (상·하반기 변화 추적)",
      "바리스타 1:1 홈브루잉 컨설팅 (화상 30분, 연 2회)",
      "바이오컴 웰니스 라운지 초대 연 4회 (동반 2인)",
      "VIP 한정 산지 테이스팅 키트 (미출시 원두 동봉) 연 4회",
      "바이오해커 네트워크 웰니스 컨설팅 연 1회 (바이오컴 영양사)",
      "빈 앰배서더 기프트 권한 — 지인 2명 INITIATE 입회권",
      "노쇼 보증 — 커피·건기식 품절 시 대체품 + 보상 자동 발송",
    ],
  },
  {
    key: "prime",
    name: "PRIME",
    subtitle: "통합 프라임 · 바이오컴 세계관의 정상",
    minSpend: 10_000_000,
    targetCount: 3,
    targetPct: "—",
    accent: "#0f172a",
    sourceRef: "v3 실측 3명 (최고 ₩1,312만 · 바이오컴 단독 2 + 바이오컴+AIBIO 1)",
    positioning: "현대카드 M 블랙 플래티넘 + 리커버리랩 + 한남동 살롱에 비견되는 지위",
    perks: [
      "PLATINUM 특전 전체 풀패키지 업그레이드",
      "리커버리랩 AIBIO 웰니스 회원권 연간 무제한 이용권",
      "바이오컴 웰니스 라운지 초대 연 6회 (동반 3인까지)",
      "분기별 마스터 바리스타 커핑 세션 + 영양사 동반 컨설팅",
      "연 1회 산지 다큐멘터리 키트 (생산자 영상편지 + 미출시 원두)",
      "바이오해커 네트워크 웰니스 컨설팅 연 2회 (바이오컴 영양사)",
      "빈 앰배서더 기프트 권한 — 지인 5명 INITIATE 입회권 + 웰컴 박스",
      "개인 건강 대시보드 — 건강검사 + AIBIO 세션 + 커피·건기식 구매 통합 인사이트",
      "VIP 핫라인 — 피드백·요청 직통 채널 (월 1회 이내)",
      "연초 바리스타 + 영양사 동반 '올해의 웰니스 1년 플랜' 가정 방문 (수도권) 또는 화상 세팅",
    ],
  },
];

// 통합 금액대 분포 차트 — v3 실측 (2026-04-24 · 직전 12개월 기준 v3 scripts/unified-tier-v3.cjs)
// PG tb_iamweb_users + coffee_payments_excel(×coffee_orders_excel phone) + Supabase aibio_payments
const SPEND_DISTRIBUTION_UNIFIED = [
  { band: "30만–100만", customers: 5470, tier: "INITIATE" },
  { band: "100만–200만", customers: 598, tier: "SILVER" },
  { band: "200만–500만", customers: 200, tier: "GOLD" },
  { band: "500만–1,000만", customers: 20, tier: "PLATINUM" },
  { band: "1,000만+", customers: 3, tier: "PRIME" },
];

// 커피 단독 금액대 분포
const SPEND_DISTRIBUTION_COFFEE = [
  { band: "10만–30만", customers: 980, tier: "GREEN" },
  { band: "30만–80만", customers: 440, tier: "CREW" },
  { band: "80만–200만", customers: 125, tier: "RESERVE" },
  { band: "200만–500만", customers: 43, tier: "SIGNATURE" },
  { band: "500만+", customers: 12, tier: "MASTER" },
];

// 현대백화점 VIP 벤치마크 — 전략 2 통합 기준과 매핑
const HD_BENCHMARK = [
  { grade: "쟈스민 시그니처", hyundai: "추정 2억+", ours: "PRIME 상단", ourLabel: "통합 ₩50,000,000+" },
  { grade: "쟈스민 블랙", hyundai: "1.2억+", ours: "PRIME", ourLabel: "통합 ₩50,000,000+" },
  { grade: "쟈스민 블루", hyundai: "7,000만+", ours: "PLATINUM 상단", ourLabel: "통합 ₩15,000,000+" },
  { grade: "쟈스민", hyundai: "5,000만+", ours: "PLATINUM", ourLabel: "통합 ₩15,000,000+" },
  { grade: "세이지", hyundai: "3,500만+", ours: "GOLD", ourLabel: "통합 ₩5,000,000+" },
  { grade: "클럽와이피", hyundai: "1,800만+", ours: "SILVER", ourLabel: "통합 ₩2,000,000+" },
  { grade: "그린", hyundai: "900만+", ours: "INITIATE", ourLabel: "통합 ₩500,000+" },
];

const FRESH_STRATEGIES = [
  {
    rank: "01",
    title: "커피 프로필 DNA (GOLD+ / SIGNATURE+)",
    body: "커핑 노트·카페인 적응·수면 데이터를 결합해 '당신은 타임버 에티오피아 워시드 타입' 같은 개인 프로필 발급. AIBIO 검사 결과와 연동하면 '웰니스×커피'가 한 줄에 꿰어져, 단순 쇼핑이 아니라 자기이해의 도구가 된다.",
    tag: "개인화 × 웰니스 결합",
  },
  {
    rank: "02",
    title: "빈 앰배서더 기프트 권한 (PLATINUM+ / MASTER)",
    body: "최상위에게 지인을 INITIATE/GREEN 등급으로 입회시킬 초대권 부여. 현대카드 M 블랙 플래티넘의 '초대' 감각 차용. 최상위 10~20명이 1~2명만 전파해도 연 20~60명 무료 신규 유입 → CAC 절감.",
    tag: "바이럴 × 지위",
  },
  {
    rank: "03",
    title: "세컨드 프라이밍 (GOLD+ / SIGNATURE+)",
    body: "가족 1인을 INITIATE/GREEN 등급으로 무료 가입. 한 가정 안에 '우리집 주치의가 되는 웰니스' 문화를 심어, 이탈 허들을 가구 단위로 끌어올린다.",
    tag: "가구 단위 Lock-in",
  },
  {
    rank: "04",
    title: "계단형 프리세일 (전 등급 차등)",
    body: "신상품 출시 시 PRIME/MASTER 24h → PLATINUM 12h → GOLD/RESERVE 6h → SILVER/CREW 1h → 일반. '먼저 마셔본다·먼저 시도한다'는 시간 서열. 현대백화점 VIP의 본질.",
    tag: "시간 = 특권",
  },
  {
    rank: "05",
    title: "노쇼 보증 (PLATINUM+ / SIGNATURE+)",
    body: "커피·건기식 품절 시 VIP에게는 대체품 + 보상 쿠폰 자동 발송. 바이오컴 이탈 원인의 상당수가 '기다림'인데, VIP에게는 절대 끊기지 않는 약속을 한다.",
    tag: "경험 품질 차별화",
  },
  {
    rank: "06",
    title: "저속노화 챌린지 (GOLD+ / RESERVE+)",
    body: "3개월 혈당·수면·인플라메이션 개선 지표를 본인 대시보드로 추적. 바이오컴을 '생활 허브'로 포지셔닝. 실제 지표 개선 시 증언형 UGC 자산이 누적.",
    tag: "웰니스 데이터 자산화",
  },
  {
    rank: "07",
    title: "바이오컴 살롱 (PRIME / MASTER)",
    body: "월 1회 오프라인 바이오컴 라운지에서 바리스타·영양사·연구진과 식문화·수면·저속노화를 주제로 토크. 브랜드가 사교 공간을 갖는 순간 세계관이 된다.",
    tag: "커뮤니티 × 세계관",
  },
  {
    rank: "08",
    title: "캘린더 VIP 콜 (PRIME / MASTER)",
    body: "연초 바리스타 + 영양사가 전화·영상으로 '올해의 웰니스 1년 플랜' 제안. 판매가 아니라 '동행'이라는 경험 설계.",
    tag: "연간 동행 서비스",
  },
];

// ─────────────────────────────────────────────────────────────
// 정기구독 트랙 (2026-04-24 신규 · 결제내역 엑셀 분석 결과 반영)
// 더클린커피 24개월 정기결제 ₩127.4M / 556명 / 12회+ 매니아 148명
// 금액과 무관하게 "결제 약속의 지속성"으로 SIGNATURE 격상
// ─────────────────────────────────────────────────────────────
type SubTrack = {
  key: string;
  name: string;
  subtitle: string;
  threshold: string;
  count: number;
  equivalent: string;
  accent: string;
  perks: string[];
};

// 카운트는 backend `/api/coffee/subscriber-tracks` 첫 sync 결과 (2026-04-24).
// "직전 12개월 결제 회수" 기준 — lifetime 누적이 아니라 현재 active 기준
const SUBSCRIPTION_TRACKS: SubTrack[] = [
  {
    key: "subscriber",
    name: "SUBSCRIBER",
    subtitle: "구독 시작 · 12개월 내 1~5회 자동결제",
    threshold: "최근 12개월 정기결제 1~5회",
    count: 261,
    equivalent: "CREW 동급",
    accent: "#65a30d",
    perks: [
      "월 자동결제 알림톡에 등급 진척 표시 (\"다음 단계까지 N회\")",
      "구독자 전용 시즌 원두 큐레이션 레터",
      "구독 6회 도달 시 LOYALIST 자동 격상 + 환영 카드",
    ],
  },
  {
    key: "loyalist",
    name: "LOYALIST",
    subtitle: "충성 진입 · 12개월 내 6~11회 자동결제 (반년 연속)",
    threshold: "최근 12개월 정기결제 6~11회",
    count: 145,
    equivalent: "RESERVE 동급",
    accent: "#0D9488",
    perks: [
      "SUBSCRIBER 특전 전체",
      "리커버리랩 AIBIO 1일 체험권 1회 (동반 1인)",
      "LOYALIST 한정 마이크로 로트 원두 1회 발송",
      "카카오톡 전용 응대 채널 활성화",
      "12회 달성 시 MANIAC 환영 키트 예고",
    ],
  },
  {
    key: "maniac",
    name: "MANIAC",
    subtitle: "매니아 · 12개월 내 12~23회 자동결제 (1년 연속)",
    threshold: "최근 12개월 정기결제 12~23회",
    count: 19,
    equivalent: "SIGNATURE 동급 (금액 무관 즉시 격상)",
    accent: "#8b5cf6",
    perks: [
      "LOYALIST 특전 전체 + 격상",
      "MANIAC 환영 키트 발송 — 마이크로 로트 원두 + 핸드라이팅 카드",
      "바리스타 1:1 화상 컨설팅 1회 (홈브루잉 코칭)",
      "VIP 한정 산지 테이스팅 키트 분기 1회",
      "바이오컴 웰니스 라운지 초대 1회 (동반 1인)",
      "이탈 방지 시퀀스 — 해지 시도 시 \"당신은 우리의 핵심\" 메시지",
    ],
  },
  {
    key: "evergreen",
    name: "EVERGREEN",
    subtitle: "최상위 · 12개월 내 24회+ 자동결제 (2년 연속급)",
    threshold: "최근 12개월 정기결제 24회+",
    count: 2,
    equivalent: "MASTER 동급 · 영구",
    accent: "#0f172a",
    perks: [
      "MANIAC 특전 전체 풀 업그레이드",
      "EVERGREEN 명패 + 영구 라운지 초대권 (등급 강등 면제)",
      "분기 마스터 바리스타 커핑 세션 + 영양사 동반 컨설팅",
      "산지 다큐멘터리 키트 연 1회 (생산자 영상편지 동봉)",
      "VIP 핫라인 — 피드백·요청 직통 (월 1회 이내)",
      "빈 앰배서더 기프트 권한 — 지인 3명 SUBSCRIBER 입회권",
    ],
  },
];

const SUBSCRIPTION_INSIGHTS = [
  {
    title: "현금흐름 가치",
    body: "단발 ₩200만 1회보다 ₩3만 × 24회 (₩72만)가 광고비·재고 의사결정에 안정적. 24회 결제가 끝까지 갈 확률이 높을수록 LTV는 누적액보다 훨씬 큼.",
  },
  {
    title: "이탈 비용",
    body: "매월 자동결제하던 고객의 이탈은 큰 신호. 단발 구매자 대비 회복 비용이 크므로 미리 매니아 대우로 lock-in.",
  },
  {
    title: "브랜드 언어 습득",
    body: "정기구독자는 이미 '더클린커피 = 일상'이라는 언어를 습득. 빈 앰배서더·세컨드 프라이밍의 1순위 후보.",
  },
];

// ─────────────────────────────────────────────────────────────
// 섹션 점프 TOC (우측 플로팅)
// ─────────────────────────────────────────────────────────────
const TOC_ITEMS = [
  { id: "overview", label: "개요·운영 원칙", color: "#f59e0b" },
  { id: "intent", label: "3가지 의도", color: "#8b5cf6" },
  { id: "strategy1", label: "전략 1 · 커피 단독", color: "#0D9488" },
  { id: "strategy2", label: "전략 2 · 통합 멤버십", color: "#8b5cf6" },
  { id: "strategy3", label: "전략 3 · 정기구독", color: "#f59e0b" },
  { id: "progress", label: "등급 진척 시각화", color: "#10b981" },
  { id: "benchmark", label: "현대백화점 벤치마크", color: "#64748b" },
  { id: "fresh-strategies", label: "신선한 전략 8가지", color: "#0D9488" },
  { id: "growth", label: "사업 성장 기여", color: "#f59e0b" },
  { id: "roadmap", label: "실행 로드맵", color: "#3b82f6" },
];

function FloatingTOC() {
  return (
    <nav style={{
      position: "fixed", right: 20, top: "50%", transform: "translateY(-50%)",
      zIndex: 90, padding: "12px 10px",
      borderRadius: 12, background: "rgba(255,255,255,0.96)",
      border: "1px solid rgba(0,0,0,0.08)",
      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
      backdropFilter: "blur(8px)",
      fontSize: "0.72rem", lineHeight: 1.4,
      maxWidth: 180,
    }}>
      <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.14em", color: "#64748b", marginBottom: 8, textTransform: "uppercase" }}>
        Quick Jump
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {TOC_ITEMS.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "4px 8px", borderRadius: 6,
                textDecoration: "none", color: "var(--color-text-primary)",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: i.color, flexShrink: 0 }} />
              <span>{i.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// 등급 진척 진행바 (다음 등급까지 남은 금액·일수 시각화)
// 현대백화점 스타일 참고
// ─────────────────────────────────────────────────────────────
type ProgressDemo = {
  key: string;
  customerName: string;
  currentTrack: "strategy1" | "strategy2" | "strategy3";
  currentTier: string;
  nextTier: string;
  accent: string;
  primary: { label: string; current: number; target: number; unit: "원" | "회" | "일" };
  secondary?: { label: string; current: number; target: number; unit: "원" | "회" | "일" };
  note: string;
  period: string;
};

const PROGRESS_DEMOS: ProgressDemo[] = [
  {
    key: "coffee-mania",
    customerName: "김*연",
    currentTrack: "strategy1",
    currentTier: "CREW",
    nextTier: "RESERVE",
    accent: "#f59e0b",
    primary: { label: "RESERVE까지 남은 구매액", current: 522_000, target: 800_000, unit: "원" },
    secondary: { label: "이번 연도 구매 회수", current: 9, target: 12, unit: "회" },
    note: "커피 단독 CREW · 연말까지 ₩28만만 더 쓰면 RESERVE 격상 + 종합대사검사 키트 수령",
    period: "2026.01.01 ~ 2026.12.31",
  },
  {
    key: "unified-gold",
    customerName: "이*호",
    currentTrack: "strategy2",
    currentTier: "SILVER",
    nextTier: "GOLD",
    accent: "#8b5cf6",
    primary: { label: "GOLD까지 남은 통합 구매액", current: 1_820_000, target: 2_000_000, unit: "원" },
    note: "바이오컴 + 커피 크로스 구매자 · GOLD 도달 시 AIBIO 웰니스 회원권 3개월 제공",
    period: "직전 12개월 기준 (2025.04.25 ~)",
  },
  {
    key: "subscriber-maniac",
    customerName: "박*영",
    currentTrack: "strategy3",
    currentTier: "LOYALIST",
    nextTier: "MANIAC",
    accent: "#10b981",
    primary: { label: "MANIAC까지 남은 정기결제", current: 10, target: 12, unit: "회" },
    note: "10회째 자동결제 완료 · 2회만 더 지속되면 바리스타 1:1 홈브루잉 컨설팅 + 웰니스 라운지 초대",
    period: "최근 12개월 · 2025.06부터 매월 결제 중",
  },
];

function ProgressBar({ current, target, accent }: { current: number; target: number; accent: string }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        position: "relative", height: 14, borderRadius: 9999,
        background: "rgba(0,0,0,0.06)", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`,
          background: `linear-gradient(90deg, ${accent}BB, ${accent})`,
          borderRadius: 9999, transition: "width 0.4s ease-out",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
        <span>현재 <strong style={{ color: accent }}>{pct}%</strong></span>
        <span>목표까지 {100 - pct}%</span>
      </div>
    </div>
  );
}

function ProgressDemoCard({ demo }: { demo: ProgressDemo }) {
  const remaining = demo.primary.target - demo.primary.current;
  const formatValue = (v: number, unit: "원" | "회" | "일") => {
    if (unit === "원") return fmtKRW(v);
    return `${v.toLocaleString("ko-KR")}${unit}`;
  };
  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${demo.accent}44`,
      background: `linear-gradient(135deg, ${demo.accent}08, transparent)`,
      padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {demo.currentTrack === "strategy1" && "전략 1 · 커피 단독"}
            {demo.currentTrack === "strategy2" && "전략 2 · 통합 멤버십"}
            {demo.currentTrack === "strategy3" && "전략 3 · 정기구독"}
          </div>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, marginTop: 2 }}>
            {demo.customerName}님의 등급은 <strong style={{ color: demo.accent }}>{demo.currentTier}</strong>입니다.
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: 2 }}>
            실적 기간: {demo.period}
          </div>
        </div>
        <div style={{
          padding: "4px 10px", borderRadius: 9999, fontSize: "0.7rem", fontWeight: 700,
          background: `${demo.accent}18`, color: demo.accent, whiteSpace: "nowrap",
        }}>
          다음: {demo.nextTier}
        </div>
      </div>

      {/* 메인 프로그레스 */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--color-text-secondary)" }}>
          <span>{demo.primary.label}</span>
          <strong style={{ color: demo.accent, fontSize: "1rem" }}>
            {formatValue(remaining, demo.primary.unit)} 더!
          </strong>
        </div>
        <ProgressBar current={demo.primary.current} target={demo.primary.target} accent={demo.accent} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
          <span>누적 {formatValue(demo.primary.current, demo.primary.unit)}</span>
          <span>목표 {formatValue(demo.primary.target, demo.primary.unit)}</span>
        </div>
      </div>

      {/* 보조 프로그레스 */}
      {demo.secondary && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>
            <span>{demo.secondary.label}</span>
            <strong>
              {formatValue(demo.secondary.current, demo.secondary.unit)} / {formatValue(demo.secondary.target, demo.secondary.unit)}
            </strong>
          </div>
          <ProgressBar current={demo.secondary.current} target={demo.secondary.target} accent={demo.accent} />
        </div>
      )}

      {/* 혜택 안내 */}
      <div style={{
        padding: "10px 12px", borderRadius: 8,
        background: "rgba(0,0,0,0.02)", borderLeft: `3px solid ${demo.accent}`,
        fontSize: "0.8rem", color: "var(--color-text-secondary)", lineHeight: 1.55,
      }}>
        {demo.note}
      </div>
    </div>
  );
}

function TierCard({ tier, formula }: { tier: Tier; formula: string }) {
  return (
    <div style={{
      borderRadius: 14,
      border: `2px solid ${tier.accent}`,
      background: `linear-gradient(135deg, ${tier.accent}0D, transparent)`,
      padding: "20px 24px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: "0.72rem", letterSpacing: "0.15em", color: tier.accent, fontWeight: 700 }}>
            {formula}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-0.01em", marginTop: 2 }}>
            {tier.name}
          </div>
          <div style={{ fontSize: "0.88rem", color: "var(--color-text-secondary)", marginTop: 2 }}>{tier.subtitle}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>기준 연 구매</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: tier.accent, fontFamily: "var(--font-display)" }}>{fmtKRW(tier.minSpend)}+</div>
          <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)", marginTop: 2 }}>
            대상: <strong>{fmtNum(tier.targetCount)}명</strong>
            {tier.targetPct !== "—" ? <> (전체 {tier.targetPct})</> : null}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>포지셔닝</div>
          <div style={{ fontSize: "0.85rem", color: "var(--color-text-primary)", lineHeight: 1.6 }}>{tier.positioning}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 8 }}>
            <strong>대상 근거</strong>: {tier.sourceRef}
          </div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>특전 예시</div>
            <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: 9999, background: "rgba(245,158,11,0.12)", color: "#b45309", fontWeight: 600 }}>
              전략 회의를 통해 브레인스토밍 · 변경 가능
            </span>
          </div>
          <ul style={{ paddingLeft: 18, fontSize: "0.82rem", color: "var(--color-text-primary)", lineHeight: 1.75, margin: 0 }}>
            {tier.perks.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function CoffeeVipPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <Link href="/coffee" className={styles.backLink}>← 더클린커피 CRM으로 돌아가기</Link>
            <h1 className={styles.headerTitle}>바이오컴 × 더클린커피 VIP 전략</h1>
            <p className={styles.headerSub}>전략 1 · 개별 티어 (커피 단독) + 전략 2 · 통합 멤버십 (바이오컴+AIBIO+커피) + 전략 3 · 정기구독 트랙</p>
          </div>
        </div>
      </header>

      <FloatingTOC />

      <main className={styles.main}>
        {/* Hero */}
        <div style={{
          padding: "36px 40px", borderRadius: 20,
          background: "linear-gradient(135deg, #0f172a 0%, #1f2937 55%, #8b5cf6 100%)",
          color: "#fff", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -40, right: -20, fontSize: "12rem", opacity: 0.05, fontWeight: 900 }}>VIP</div>
          <div style={{ fontSize: "0.72rem", letterSpacing: "0.16em", opacity: 0.6, textTransform: "uppercase" }}>Biocom × AIBIO × TheClean Coffee</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em", marginTop: 6, marginBottom: 14, fontFamily: "var(--font-display)" }}>
            커피가 입구, 바이오컴이 집이다.
          </div>
          <p style={{ fontSize: "0.98rem", lineHeight: 1.75, maxWidth: 820, opacity: 0.92 }}>
            이 프로그램은 세 가지를 동시에 노린다. <strong style={{ color: "#c4b5fd" }}>① 특별한 사람이라는 감각</strong>을 만들고,
            <strong style={{ color: "#fcd34d" }}> ② 바이오컴 세계관(리커버리랩·건기식·저속노화)</strong>으로 자연스럽게 이동시키며,
            <strong style={{ color: "#5eead4" }}> ③ 더클린커피 매니아</strong>를 육성한다.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 22 }}>
            {[
              { icon: "✦", title: "특별감 설계", desc: "5단계 서열·Pre-access·멤버 전용 공간으로 '나만 받는 대우'" },
              { icon: "◎", title: "세계관 유입", desc: "리커버리랩 체험권·종합대사검사 키트로 자연스러운 AIBIO 진입" },
              { icon: "☕", title: "매니아 육성", desc: "마이크로 로트·커핑 세션·DNA 프로파일로 '커피를 이해하는 멤버'" },
            ].map((p) => (
              <div key={p.title} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.08)", backdropFilter: "blur(4px)" }}>
                <div style={{ fontSize: "1.2rem", marginBottom: 4 }}>{p.icon}</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{p.title}</div>
                <div style={{ fontSize: "0.78rem", opacity: 0.82, lineHeight: 1.55, marginTop: 4 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 데이터 소스 · 업데이트 배너 */}
        <div style={{
          padding: "12px 18px", borderRadius: 10,
          background: "linear-gradient(90deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))",
          border: "1px solid rgba(245,158,11,0.3)",
          fontSize: "0.82rem", color: "var(--color-text-secondary)",
          display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center",
        }}>
          <div><strong style={{ color: "#b45309" }}>📊 최종 업데이트</strong>: 2026-04-24 · 통합 등급 v3 실측 반영</div>
          <div><strong style={{ color: "#b45309" }}>🔗 데이터 소스</strong>: PG <code>tb_iamweb_users</code> · Supabase <code>aibio_payments</code> · 엑셀 <code>coffee_orders_excel</code>/<code>coffee_payments_excel</code></div>
          <div style={{ padding: "4px 10px", borderRadius: 9999, background: "rgba(239,68,68,0.08)", color: "#b91c1c", fontWeight: 600 }}>
            ⚠️ 쿠팡 Wing 데이터 미연동 — 추후 업데이트 예정
          </div>
        </div>

        {/* 갱신 정책 · 3대 전략 요약 */}
        <div id="overview" className={styles.section} style={{ borderTop: "3px solid #f59e0b", scrollMarginTop: 80 }}>
          <h2 className={styles.sectionTitle}>세 갈래 VIP 전략 · 공통 운영 원칙</h2>
          <p className={styles.sectionDesc}>전략 1은 &quot;커피 단독 금액&quot;, 전략 2는 &quot;바이오컴 전 카테고리 통합 금액&quot;, 전략 3은 &quot;정기결제 지속성&quot;. 상호 배타적이 아닌 삼중 운영.</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 16, borderRadius: 12, border: "2px solid #0D9488", background: "rgba(13,148,136,0.04)" }}>
              <div style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: "#0D9488", fontWeight: 700 }}>전략 1</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, marginTop: 2 }}>개별 티어 · 커피 단독</div>
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", marginTop: 6, lineHeight: 1.55 }}>
                커피 구매액만으로 5단계. ₩10만~₩500만. 매니아 육성·재구매 개선.
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: 12, border: "2px solid #8b5cf6", background: "rgba(139,92,246,0.04)" }}>
              <div style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: "#8b5cf6", fontWeight: 700 }}>전략 2</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, marginTop: 2 }}>통합 멤버십 · 3채널</div>
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", marginTop: 6, lineHeight: 1.55 }}>
                바이오컴×AIBIO×커피 합산 5단계. ₩30만~₩1,000만+ (v3 실측). 바이오컴+커피 크로스 120명.
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: 12, border: "2px solid #f59e0b", background: "rgba(245,158,11,0.04)" }}>
              <div style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: "#f59e0b", fontWeight: 700 }}>전략 3</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, marginTop: 2 }}>정기구독 트랙</div>
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", marginTop: 6, lineHeight: 1.55 }}>
                금액 무관 · 자동결제 횟수로 격상. MANIAC 19명·EVERGREEN 2명 자동 SIGNATURE+ 인정.
              </div>
            </div>
          </div>

          <div style={{ padding: "14px 18px", borderRadius: 10, background: "#1e293b", color: "#f8fafc" }}>
            <div style={{ fontSize: "0.75rem", letterSpacing: "0.1em", opacity: 0.7, textTransform: "uppercase", marginBottom: 6 }}>공통 운영 원칙</div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.88rem", lineHeight: 1.8 }}>
              <li><strong>갱신 주기: 연 1회</strong>. 매년 1월 1일 기준 <strong>직전 12개월 누적 구매액</strong>으로 등급 재산정.</li>
              <li>한 번 진입한 등급은 <strong>1년간 유지</strong>. 기간 만료 시 재평가, 하락 시 자동 1단계 강등.</li>
              <li>등급 승급은 실시간 반영 (도달 즉시 적용). 강등은 연 1회만.</li>
              <li>세 전략은 <strong>별도 등급으로 동시 운영</strong>. 한 고객이 전략 1 CREW·전략 2 SILVER·전략 3 MANIAC일 수 있음.</li>
              <li>모든 특전은 <strong>예시이며 전략 회의를 통한 브레인스토밍 결과로 변경 가능</strong>.</li>
            </ul>
          </div>
        </div>

        {/* 3가지 의도 */}
        <div id="intent" className={styles.section} style={{ borderTop: "3px solid #8b5cf6", scrollMarginTop: 80 }}>
          <h2 className={styles.sectionTitle}>프로그램의 3가지 의도</h2>
          <p className={styles.sectionDesc}>가격이 아닌 지위·세계관·취향으로 경쟁한다</p>

          <div className={styles.strategyGrid}>
            <div className={styles.strategyCard} style={{ borderLeftColor: "#8b5cf6" }}>
              <div className={styles.strategyRank} style={{ background: "#8b5cf6" }}>1</div>
              <div>
                <strong>&ldquo;난 특별하다&rdquo;의 설계</strong>
                <p>
                  서열은 한국 소비자의 가장 강력한 드라이버다. 현대백화점 VIP가 7단계로 촘촘하게 나뉘어 있는 이유는 &quot;다음 단계가 보이면 사람이 움직이기 때문&quot;이다.
                  할인은 누구나 준다. <strong>시간·공간·호칭</strong>은 VIP에게만 준다.
                </p>
                <span className={styles.strategyTag}>지위 경제 (Status Economy)</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#f59e0b" }}>
              <div className={styles.strategyRank} style={{ background: "#f59e0b" }}>2</div>
              <div>
                <strong>바이오컴 세계관으로의 진입</strong>
                <p>
                  커피는 가장 빈도 높은 생활 접점이다. 주 2~3회 마시는 행위에 AIBIO 체험권·건강검사·저속노화 도시락을 끼워 넣으면,
                  고객은 &quot;커피를 샀더니 건강이 정리됐다&quot;는 경험을 한다. 바이오컴 전 카테고리의 <strong>입구를 커피로 통일</strong>하는 전략.
                </p>
                <span className={styles.strategyTag}>크로스셀 깔때기</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#0D9488" }}>
              <div className={styles.strategyRank} style={{ background: "#0D9488" }}>3</div>
              <div>
                <strong>더클린커피 매니아 육성</strong>
                <p>
                  VIP는 &quot;돈 많이 쓰는 사람&quot;이 아니라 &quot;깊이 이해하는 사람&quot;이다. 마이크로 로트·커핑 세션·커피 DNA 프로파일로 고객이 <strong>브랜드 언어를 습득</strong>하게 만든다.
                  언어를 배운 고객은 이탈하지 않고 스스로 전파한다.
                </p>
                <span className={styles.strategyTag}>브랜드 언어 습득</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            전략 1 · 개별 티어 (더클린커피 단독)
            ═══════════════════════════════════════════════════════════ */}
        <div id="strategy1" className={styles.section} style={{ borderTop: "4px solid #0D9488", scrollMarginTop: 80 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.15em", fontWeight: 800, color: "#0D9488" }}>STRATEGY 1</span>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>개별 티어 · 더클린커피 단독</h2>
          </div>
          <p className={styles.sectionDesc}>
            커피 구매액만으로 5단계. 금액대 ₩100,000 ~ ₩5,000,000. 매니아 육성과 재구매율 개선이 주 목적.
          </p>

          <div style={{ display: "grid", gap: 16 }}>
            {TIERS_COFFEE.map((t, idx) => (
              <TierCard key={t.key} tier={t} formula={`COFFEE TIER · ${idx + 1} / ${TIERS_COFFEE.length}`} />
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 8 }}>전략 1 · 금액대별 대상 고객 분포</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={SPEND_DISTRIBUTION_COFFEE} layout="vertical" margin={{ left: 20, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="band" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${fmtNum(Number(v))}명`, "고객 수"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="customers" fill="#0D9488" name="고객 수">
                  <LabelList dataKey="customers" position="right" formatter={(v) => `${fmtNum(Number(v ?? 0))}명`} style={{ fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className={styles.interpretBlock} style={{ marginTop: 12 }}>
            <strong>전략 1 금액대 근거</strong>
            <ul style={{ paddingLeft: 18, margin: "8px 0 0", lineHeight: 1.8 }}>
              <li><strong>₩10만 (GREEN)</strong>: 월 1봉지 × 12개월의 절반. 습관이 형성된 고객의 자연 문턱.</li>
              <li><strong>₩30만 (CREW)</strong>: 3회+ 구매 고객 911명과 맞물림. 재구매 확정 경계.</li>
              <li><strong>₩80만 (RESERVE)</strong>: 월 약 7만원 = 하루 한 잔. AIBIO 1회 체험권 가치와 동등.</li>
              <li><strong>₩200만 (SIGNATURE)</strong>: 커피 단독 매니아의 상단. 슈퍼 VIP(10~19회) 117명 중 상위.</li>
              <li><strong>₩500만 (MASTER)</strong>: 울트라 VIP(20회+) 8명이 이미 이 수준. 커피로만 최상위.</li>
            </ul>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            전략 2 · 통합 멤버십 (바이오컴 × AIBIO × 커피)
            ═══════════════════════════════════════════════════════════ */}
        <div id="strategy2" className={styles.section} style={{ borderTop: "4px solid #8b5cf6", scrollMarginTop: 80 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.15em", fontWeight: 800, color: "#8b5cf6" }}>STRATEGY 2</span>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>통합 멤버십 · 바이오컴 × AIBIO × 더클린커피</h2>
          </div>
          <p className={styles.sectionDesc}>
            세 채널 합산 5단계. 금액대 ₩500,000 ~ ₩50,000,000. 바이오컴은 고액 구매자 밀도가 높아 상향 조정.
            실데이터 기준 최근 3.5개월만으로도 <strong>1,000만+ 고객 8명 · 최고 누적 ₩2.6억</strong>.
          </p>

          <div style={{ display: "grid", gap: 16 }}>
            {TIERS_UNIFIED.map((t, idx) => (
              <TierCard key={t.key} tier={t} formula={`UNIFIED TIER · ${idx + 1} / ${TIERS_UNIFIED.length}`} />
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 8 }}>
              전략 2 · 금액대별 대상 고객 분포
              <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 8 }}>
                (v3 실측 · 직전 12개월 · unified-tier-v3.cjs)
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={SPEND_DISTRIBUTION_UNIFIED} layout="vertical" margin={{ left: 20, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="band" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${fmtNum(Number(v))}명`, "고객 수"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="customers" fill="#8b5cf6" name="고객 수">
                  <LabelList dataKey="customers" position="right" formatter={(v) => `${fmtNum(Number(v ?? 0))}명`} style={{ fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className={styles.interpretBlock} style={{ marginTop: 12 }}>
            <strong>전략 2 v3 실측 (2026-04-24 · 직전 12개월 정합)</strong>
            <ul style={{ paddingLeft: 18, margin: "8px 0 0", lineHeight: 1.8 }}>
              <li><strong>PRIME ₩1,000만+</strong>: <strong>3명</strong> (최고 ₩13,116,200 · 바이오컴 단독 2 + 바이오컴+AIBIO 1)</li>
              <li><strong>PLATINUM ₩500만+</strong>: <strong>20명</strong> (바이오컴+AIBIO 1 + 단독 19)</li>
              <li><strong>GOLD ₩200만+</strong>: <strong>200명</strong> (3채널 1 · 2채널 16 · 1채널 183)</li>
              <li><strong>SILVER ₩100만+</strong>: <strong>598명</strong> (2채널 13 · 1채널 585)</li>
              <li><strong>INITIATE ₩30만+</strong>: <strong>6,068명</strong> (2채널 56 · 1채널 6,012)</li>
            </ul>
            <div style={{ marginTop: 10, fontSize: "0.82rem" }}>
              <strong>채널 매트릭스 (v3)</strong>: 바이오컴 only 22,993 / 커피 only 2,721 / AIBIO only 138 /
              <strong> 바이오컴+커피 120</strong> · 바이오컴+AIBIO 14 · 3채널 모두 1명.
              v2(PG Toss 기반)의 커피 812 → 2,721로 <strong>+235%</strong>, 바이오컴+커피 28 → 120으로 <strong>+328%</strong> 확장.
              이는 커피 데이터 소스를 <code>tb_sales_toss</code> → 엑셀 원본(비마스킹)으로 교체한 결과.
            </div>
            <div style={{ marginTop: 8, fontSize: "0.82rem" }}>
              <strong>왜 커피 단독보다 금액대가 높은가</strong>: 바이오컴은 건강기능식품·검사키트·AIBIO 웰니스 회원권 등 객단가 수십만~수백만 상품이 즐비. 커피 단독 티어(₩500만)와 섞으면 &quot;특별함&quot;이 소실되므로 별도 금액 체계 필수.
            </div>
            <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, background: "rgba(239,68,68,0.06)", fontSize: "0.78rem", color: "#991b1b" }}>
              ⚠️ <strong>쿠팡 Wing 데이터 미연동</strong>: 현재 통합 등급은 아임웹·스마트스토어·AIBIO만 반영. 쿠팡 매출(BIOCOM 연 ~₩6,900만 + TEAMKETO TBD)은 추후 반영 시 INITIATE~GOLD 인원이 일부 상향될 예정.
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            전략 3 · 정기구독 트랙 (전략 1·2 공통 · 2026-04-24 신설)
            결제내역 엑셀 24개월 분석 결과: ₩127.4M / 556명 / 12회+ 매니아 148명
            ═══════════════════════════════════════════════════════════ */}
        <div id="strategy3" className={styles.section} style={{ borderTop: "4px solid #f59e0b", scrollMarginTop: 80 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.15em", fontWeight: 800, color: "#f59e0b" }}>STRATEGY 3</span>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>정기구독 트랙 · 결제 약속의 지속성</h2>
          </div>
          <p className={styles.sectionDesc}>
            금액과 무관하게 <strong>정기결제 자동결제 횟수</strong>로 SIGNATURE/MASTER 격상.
            더클린커피 정기결제 실측 (2026-04-24 첫 sync · `coffee_subscriber_track`):
            <strong> 누적 결제 발생 phone 556명 / 직전 12개월 활동 427명 / EVERGREEN 2 · MANIAC 19 · LOYALIST 145 · SUBSCRIBER 261</strong>.
            전략 1·2의 금액 기준에 가려진 진성 매니아를 별도 트랙으로 인정.
          </p>

          {/* KPI 4개 — 실측 (2026-04-24 첫 sync) */}
          <div className={styles.kpiGrid} style={{ marginBottom: 20 }}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>정기결제 누적 매출</span>
              <strong className={styles.kpiValue}>₩65.8M</strong>
              <span className={styles.kpiSub}>직전 12개월 정기결제 net</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>활동 구독자 (12개월)</span>
              <strong className={styles.kpiValue}>427명</strong>
              <span className={styles.kpiSub}>전체 정기결제 phone 556명 중</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>MANIAC + EVERGREEN</span>
              <strong className={styles.kpiValue}>21명</strong>
              <span className={styles.kpiSub}>SIGNATURE 이상 자동 격상</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>휴면 위험 (churn)</span>
              <strong className={styles.kpiValue}>427명</strong>
              <span className={styles.kpiSub}>직전 30일 정기결제 없음 · 이탈 방지 시퀀스 대상</span>
            </div>
          </div>

          {/* 트랙 4단계 카드 */}
          <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
            {SUBSCRIPTION_TRACKS.map((t, idx) => (
              <div key={t.key} style={{
                borderRadius: 14,
                border: `2px solid ${t.accent}`,
                background: `linear-gradient(135deg, ${t.accent}0D, transparent)`,
                padding: "18px 22px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: t.accent, fontWeight: 700 }}>
                      SUB TRACK · {idx + 1} / {SUBSCRIPTION_TRACKS.length}
                    </div>
                    <div style={{ fontSize: "1.35rem", fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-0.01em", marginTop: 2 }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginTop: 2 }}>{t.subtitle}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>조건</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: t.accent, fontFamily: "var(--font-display)" }}>{t.threshold}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)", marginTop: 2 }}>
                      대상: <strong>{t.count > 0 ? `${fmtNum(t.count)}명` : "TBD (24개월 데이터 부족)"}</strong>
                    </div>
                    <div style={{ fontSize: "0.74rem", color: t.accent, marginTop: 2, fontWeight: 600 }}>{t.equivalent}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>운영 특전</div>
                    <span style={{ fontSize: "0.66rem", padding: "2px 8px", borderRadius: 9999, background: "rgba(245,158,11,0.12)", color: "#b45309", fontWeight: 600 }}>
                      자동 알림톡 트리거 · 변경 가능
                    </span>
                  </div>
                  <ul style={{ paddingLeft: 18, fontSize: "0.82rem", color: "var(--color-text-primary)", lineHeight: 1.75, margin: 0 }}>
                    {t.perks.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* 운영 인사이트 3가지 */}
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 8 }}>왜 금액 무관하게 격상하는가</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {SUBSCRIPTION_INSIGHTS.map((s, i) => (
              <div key={i} style={{
                padding: "14px 16px", borderRadius: 12,
                background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)",
              }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#b45309", marginBottom: 6 }}>{i + 1}. {s.title}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{s.body}</div>
              </div>
            ))}
          </div>

          <div className={styles.interpretBlock} style={{ marginTop: 8 }}>
            <strong>실행 가능성</strong>
            <ul style={{ paddingLeft: 18, margin: "6px 0 0", lineHeight: 1.75 }}>
              <li>결제수단·횟수 데이터: <code>coffee_payments_excel.payment_method=&apos;정기결제&apos;</code>로 즉시 식별. 매월 결제일에 카운터 +1 자동 증가.</li>
              <li>자동 알림톡 트리거: 기존 <code>routes/aligo</code> 인프라 재사용. n회차 결제 직후 등급 진척 메시지.</li>
              <li>등급 트랙 저장: <code>imweb_members.member_grade</code>(현재 공란) 활용 또는 신규 <code>coffee_subscriber_track</code> 테이블 신설.</li>
              <li>해지 방지: 정기결제 해지 API 호출 직전 <strong>이탈 방지 시퀀스</strong> 자동 발송 (할인 X, 호명 O).</li>
            </ul>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            등급 진척 시각화 (고객 앱·마이페이지 UX 예시)
            현대백화점 마이페이지 참고 · 프로그레스바 + 다음 등급까지 남은 실적
            ═══════════════════════════════════════════════════════════ */}
        <div id="progress" className={styles.section} style={{ borderTop: "4px solid #10b981", scrollMarginTop: 80 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.15em", fontWeight: 800, color: "#10b981" }}>CUSTOMER UX</span>
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>등급 진척 시각화 · 고객 앱 예시</h2>
          </div>
          <p className={styles.sectionDesc}>
            현대백화점 마이페이지처럼 <strong>&quot;다음 등급까지 얼마 남았다&quot;</strong>를 명확히 보여줘야 고객이 움직인다.
            금액·구매일·정기결제 횟수 3가지 축 모두 이 UX로 시각화. 아래는 실제 화면에 넣을 3개 시나리오 예시.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 16 }}>
            {PROGRESS_DEMOS.map((d) => (
              <ProgressDemoCard key={d.key} demo={d} />
            ))}
          </div>

          <div className={styles.interpretBlock} style={{ marginTop: 16 }}>
            <strong>핵심 UX 원칙 (현대백화점 사례 참고)</strong>
            <ul style={{ paddingLeft: 18, margin: "8px 0 0", lineHeight: 1.75 }}>
              <li><strong>남은 실적 강조</strong>: &quot;₩28만 더&quot; 같은 말풍선으로 목표 거리를 수치화 (IMG 사례 · &quot;452,000원 더!&quot;)</li>
              <li><strong>두 축 병치</strong>: 금액 + 구매일수처럼 다중 기준을 나란히 보여주면 달성 가능한 쪽으로 유도 가능</li>
              <li><strong>실적 기간 명시</strong>: &quot;2026.01.01 ~ 2026.12.31&quot; 표기로 리셋 시점 환기 → 연말 푸시 효과</li>
              <li><strong>다음 등급 혜택 미리보기</strong>: 프로그레스 아래 한 줄로 구체적 특전 노출 (예: &quot;AIBIO 웰니스 회원권 3개월&quot;)</li>
              <li><strong>3개 트랙 동시 노출</strong>: 한 고객이 전략 1·2·3 중 도달 가능한 트랙을 모두 보여줘 심리적 진입 장벽 최저화</li>
            </ul>
          </div>

          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 8,
            background: "rgba(16,185,129,0.06)", borderLeft: "3px solid #10b981",
            fontSize: "0.8rem", color: "var(--color-text-secondary)",
          }}>
            <strong>구현 경로</strong>: 고객 앱/마이페이지에 <code>GET /api/coffee/subscriber-tracks?phone=…</code> +
            `tb_iamweb_users` 직전 12개월 누적 + `aibio_payments` 합산하여 3개 트랙의 진척을 실시간 계산.
            알림톡 트리거 (<code>coffee_subscriber_track_log</code>)는 이미 구축돼 있어, 프로그레스 80%+ 도달 시 &quot;한 걸음 남았어요&quot; 푸시도 바로 가능.
          </div>
        </div>

        {/* 현대백화점 벤치마크 */}
        <div id="benchmark" className={styles.section} style={{ scrollMarginTop: 80 }}>
          <h2 className={styles.sectionTitle}>현대백화점 VIP ↔ 전략 2 통합 멤버십 매핑</h2>
          <p className={styles.sectionDesc}>7단계를 그대로 복제하지 않고, 5단계로 압축. 바이오컴 규모를 고려한 기준.</p>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "10px 8px" }}>현대백화점 등급</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>추정 연 구매</th>
                  <th style={{ padding: "10px 8px" }}>통합 등급 (전략 2)</th>
                  <th style={{ padding: "10px 8px" }}>기준 금액</th>
                </tr>
              </thead>
              <tbody>
                {HD_BENCHMARK.map((r) => (
                  <tr key={r.grade} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 600 }}>{r.grade}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", color: "var(--color-text-secondary)" }}>{r.hyundai}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 700, color: "#8b5cf6" }}>{r.ours}</td>
                    <td style={{ padding: "10px 8px", fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{r.ourLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 신선한 전략 */}
        <div id="fresh-strategies" className={styles.section} style={{ borderTop: "3px solid #0D9488", scrollMarginTop: 80 }}>
          <h2 className={styles.sectionTitle}>신선한 전략 제안 · 8가지</h2>
          <p className={styles.sectionDesc}>요청하신 기본 혜택 외에 &quot;지위·세계관·취향&quot;을 강화하는 추가 설계 (전략 1·2 공통 적용)</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {FRESH_STRATEGIES.map((s) => (
              <div key={s.rank} className={styles.strategyCard} style={{ borderLeftColor: "#0D9488" }}>
                <div className={styles.strategyRank} style={{ background: "#0D9488" }}>{s.rank}</div>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.body}</p>
                  <span className={styles.strategyTag}>{s.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 사업 성장 기여 */}
        <div id="growth" className={styles.section} style={{ borderTop: "3px solid #f59e0b", scrollMarginTop: 80 }}>
          <h2 className={styles.sectionTitle}>바이오컴 사업 성장에의 기여</h2>
          <p className={styles.sectionDesc}>VIP 프로그램이 만드는 4가지 수익 레버와 2가지 비수익 가치</p>

          <div className={styles.strategyGrid}>
            <div className={styles.strategyCard} style={{ borderLeftColor: "#f59e0b" }}>
              <div className={styles.strategyRank} style={{ background: "#f59e0b" }}>1</div>
              <div>
                <strong>LTV 확장 — 가격 인상 없이 매출 3배</strong>
                <p>
                  현재 커피 고객당 평균 주문 1.73회. 전략 1 티어 피라미드가 작동하면 CREW 이상 고객이 연 4~6회 구매로 이동.
                  전략 2는 바이오컴 고객 7,337명의 재구매 주기를 단축시켜 연간 구매액 1.5~2배 확장 유도.
                </p>
                <span className={styles.strategyTag}>가격 인상 저항선 우회</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#f59e0b" }}>
              <div className={styles.strategyRank} style={{ background: "#f59e0b" }}>2</div>
              <div>
                <strong>크로스셀 엔진 — 커피·건기식·AIBIO 3종 번들</strong>
                <p>
                  현재 크로스 구매 고객 17명 수준. 전략 2 통합 멤버십이 가동되면 &quot;등급 승급을 위해 다른 카테고리도 구매&quot;하는 유인 발생.
                  INITIATE → SILVER 승급에 ₩1.5M 추가 필요 → 건기식·AIBIO 체험권으로 유도.
                </p>
                <span className={styles.strategyTag}>3채널 통합 깔때기</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#f59e0b" }}>
              <div className={styles.strategyRank} style={{ background: "#f59e0b" }}>3</div>
              <div>
                <strong>정기수익 안정화 — 예측 가능한 현금흐름</strong>
                <p>
                  GOLD+ 고객 약 100명은 사실상 연간 약속 고객 (통합 기준 ₩500만+).
                  연 5억 이상이 <strong>미리 약속된 매출</strong>로 전환. 광고비/재고 투자 의사결정이 안정적.
                </p>
                <span className={styles.strategyTag}>현금흐름 안정화</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#f59e0b" }}>
              <div className={styles.strategyRank} style={{ background: "#f59e0b" }}>4</div>
              <div>
                <strong>브랜드 디펜시블 해자 — 복제 불가능성</strong>
                <p>
                  모모스/프릳츠/커피리브레는 &quot;좋은 커피&quot; 카테고리 경쟁. 바이오컴 통합 멤버십은 <strong>&quot;커피 × 건강 × 저속노화&quot;라는 카테고리 자체를 창조</strong>.
                  경쟁사가 복제하려면 AIBIO 같은 센터를 지어야 하므로 진입장벽 무한대.
                </p>
                <span className={styles.strategyTag}>카테고리 창조</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#94a3b8" }}>
              <div className={styles.strategyRank} style={{ background: "#94a3b8" }}>+</div>
              <div>
                <strong>CAC 절감 — 앰배서더 무료 유입</strong>
                <p>
                  PRIME/MASTER 20여 명이 연 1~2명씩 지인을 INITIATE/GREEN으로 데려오면 연 20~60명 무료 신규 유입.
                  CPA(획득비용) 절감 + 재구매율 2배.
                </p>
                <span className={styles.strategyTag}>비수익 가치 · 마케팅 자산</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#94a3b8" }}>
              <div className={styles.strategyRank} style={{ background: "#94a3b8" }}>+</div>
              <div>
                <strong>데이터 자산화 — 연구 근거 수집</strong>
                <p>
                  GOLD+ 고객의 종합대사검사 키트는 &quot;바이오컴 고객의 실제 건강 개선 데이터&quot;를 확보하는 통로.
                  3년 누적되면 PR·리드마그넷·영양사 네트워크의 <strong>독점 IP 자산</strong>.
                </p>
                <span className={styles.strategyTag}>비수익 가치 · IP 자산</span>
              </div>
            </div>
          </div>
        </div>

        {/* 실행 로드맵 */}
        <div id="roadmap" className={styles.section} style={{ scrollMarginTop: 80 }}>
          <h2 className={styles.sectionTitle}>실행 로드맵 · 4단계</h2>
          <p className={styles.sectionDesc}>전략 2(통합) 최상위부터 파일럿 → 전략 1(커피 단독) 대량 확산 순서</p>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ padding: "14px 18px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#16a34a", marginBottom: 4 }}>Phase 1 · 이번 달 — 전략 2 · PRIME 8~10명 파일럿</div>
              <p style={{ fontSize: "0.85rem", color: "#334155", margin: 0, lineHeight: 1.75 }}>
                바이오컴 연간 ₩5,000만+ 구매자 약 10명에게 &quot;PRIME 초대장&quot; 카카오톡 발송.
                웰니스 라운지 초대 1회 체험 → 반응 측정. <strong>최상위 체험 품질 검증</strong>이 우선.
              </p>
            </div>
            <div style={{ padding: "14px 18px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e40af", marginBottom: 4 }}>Phase 2 · 다음 달 — 전략 2 · PLATINUM·GOLD 출범</div>
              <p style={{ fontSize: "0.85rem", color: "#334155", margin: 0, lineHeight: 1.75 }}>
                바이오컴 ₩500만+ 고객 약 100명에게 GOLD·PLATINUM 초대장.
                종합대사검사 키트 · AIBIO 체험권을 <strong>온보딩 경험</strong>으로 설계. AIBIO 회원권 전환율 측정.
              </p>
            </div>
            <div style={{ padding: "14px 18px", borderRadius: 10, background: "#fefce8", border: "1px solid #fde68a" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#92400e", marginBottom: 4 }}>Phase 3 · 다음 분기 — 전략 2 · SILVER·INITIATE + 전략 1 전체</div>
              <p style={{ fontSize: "0.85rem", color: "#334155", margin: 0, lineHeight: 1.75 }}>
                통합 SILVER·INITIATE 약 1,700명 + 커피 단독 CREW·GREEN 약 2,200명 일괄 공개.
                이 시점에 <strong>3주차 재구매 알림톡과 결합</strong>해 &quot;한 번 더 사면 승급&quot; 메시지로 재구매 견인.
              </p>
            </div>
            <div style={{ padding: "14px 18px", borderRadius: 10, background: "#1e293b", color: "#f8fafc" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>Phase 4 · 6개월 후 — 세컨드 프라이밍 & 앰배서더 개방</div>
              <p style={{ fontSize: "0.85rem", margin: 0, lineHeight: 1.75, opacity: 0.9 }}>
                GOLD+/SIGNATURE+ 고객에게 &quot;가족 1인 INITIATE/GREEN 입회권&quot;, PRIME/MASTER에게 &quot;앰배서더 초대권&quot; 순차 개방.
                <strong>바이럴 엔진 가동 시점</strong>. 광고 의존도 하락 + 충성 고객 네트워크로 CAC 하락.
              </p>
            </div>
          </div>
        </div>

        {/* 최종 메시지 */}
        <div style={{
          padding: "28px 32px", borderRadius: 16,
          background: "linear-gradient(135deg, #0D9488 0%, #8b5cf6 100%)",
          color: "#fff",
        }}>
          <div style={{ fontSize: "0.72rem", letterSpacing: "0.14em", opacity: 0.7, textTransform: "uppercase", marginBottom: 8 }}>최종 정리</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.5, marginBottom: 10 }}>
            전략 1은 더클린커피 매니아를 키우고,<br />
            전략 2는 바이오컴 세계관을 완성한다.
          </div>
          <div style={{ fontSize: "0.92rem", lineHeight: 1.75, opacity: 0.95 }}>
            두 전략은 경쟁하지 않고 <strong style={{ color: "#fcd34d" }}>한 고객이 양쪽 등급을 동시에 가질 수 있다</strong>. 커피 CREW이면서 통합 SILVER, 커피 MASTER이면서 통합 PRIME.
            비교 대상이 <strong style={{ color: "#fcd34d" }}>현대카드 M 블랙 플래티넘 + 리커버리랩 + 한남동 살롱</strong>이 된다.
            고객이 스스로 &quot;다음 등급으로 가고 싶다&quot;고 말하는 구조.
          </div>
        </div>
      </main>
    </div>
  );
}
