"use client";

import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import styles from "./page.module.css";

const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const couponAnalysisPeriod = "2024-11-04 ~ 2026-04-09";
const couponNameBackfillPeriod = "2026-01-27 ~ 2026-04-07";
const couponNameBackfillSummary = {
  couponMasters: 816,
  issueCouponCodes: 2238,
};
const coffeeCouponBackfillPeriod = "2025-12-30 ~ 2026-04-04";
const coffeeCouponBackfillSummary = {
  orders: 1937,
  couponOrders: 433,
  couponMasters: 72,
  issueCouponCodes: 416,
  topNames: ["가입 축하 쿠폰", "설맞이 특별 혜택 10% 쿠폰", "더클린커피 카톡 플친 10% 할인"],
};

const productCouponData = [
  {
    cat: "유기산/대사 검사",
    shortCat: "유기산/대사",
    customers: 3322,
    couponCustomers: 2086,
    rateValue: 62.8,
    rate: "62.8%",
    avg: "₩27,094",
    detail: "종합 대사기능 분석, 대사&과민증 검사 Set",
    couponNames: ["[신규가입] 즉시사용 5% 할인쿠폰", "[신규가입] 즉시사용 1만 5천원 쿠폰", "[생일축하합니다] 전제품 20% 할인쿠폰"],
    hot: true,
  },
  {
    cat: "기타 상품",
    shortCat: "기타",
    customers: 32888,
    couponCustomers: 18297,
    rateValue: 55.6,
    rate: "55.6%",
    avg: "₩21,394",
    detail: "음식물 과민증 분석, 당당케어, 썬화이버 등",
    couponNames: ["[신규가입] 즉시사용 1만 5천원 쿠폰", "[신규가입] 즉시사용 5% 할인쿠폰", "[신규가입] 즉시사용 2만 5천원 쿠폰"],
  },
  {
    cat: "호르몬 검사",
    shortCat: "호르몬",
    customers: 248,
    couponCustomers: 55,
    rateValue: 22.2,
    rate: "22.2%",
    avg: "₩22,749",
    detail: "종합 호르몬균형 분석",
    couponNames: ["[신규가입] 즉시사용 5% 할인쿠폰", "[멤버십혜택] BLUE 회원전용 5% 할인쿠폰", "[멤버십혜택] GREEN 회원전용 10% 할인쿠폰"],
  },
  {
    cat: "영양제",
    shortCat: "영양제",
    customers: 7164,
    couponCustomers: 2772,
    rateValue: 38.7,
    rate: "38.7%",
    avg: "₩18,485",
    detail: "정기구독/효소/밸런스 제품군",
    couponNames: ["상담 고객전용 - 바이오컴 건강기능식품 30% 할인", "[상담자 전용] 건강기능식품 정기구독 첫구매 70% 할인", "[신규가입] 즉시사용 1만원 쿠폰"],
    cold: true,
  },
  {
    cat: "중금속 검사",
    shortCat: "중금속",
    customers: 8880,
    couponCustomers: 2035,
    rateValue: 22.9,
    rate: "22.9%",
    avg: "₩13,811",
    detail: "영양 중금속 분석",
    couponNames: ["[신규가입] 즉시사용 1만원 쿠폰", "[신규가입] 즉시사용 1만 5천원 쿠폰", "[신규가입] 즉시사용 5% 할인쿠폰"],
  },
  {
    cat: "장내 검사",
    shortCat: "장내",
    customers: 1553,
    couponCustomers: 308,
    rateValue: 19.8,
    rate: "19.8%",
    avg: "₩15,546",
    detail: "장내 미생물/장내 환경 분석",
    couponNames: ["[신규가입] 즉시사용 1만원 쿠폰", "[신규가입] 즉시사용 5% 할인쿠폰", "[생일축하합니다] 전제품 20% 할인쿠폰"],
  },
  {
    cat: "알러지 검사",
    shortCat: "알러지",
    customers: 6894,
    couponCustomers: 0,
    rateValue: 0,
    rate: "0.0%",
    avg: "-",
    detail: "알러지/알레르기 명칭 상품",
    couponNames: ["최근 로컬 캐시 조인 기준 쿠폰 사용 주문 없음"],
    cold: true,
  },
];

const otherProductBreakdown = [
  { product: "음식물 과민증 분석", rows: 21450, couponRows: 16573, rate: "77.3%" },
  { product: "내부 확인용", rows: 3640, couponRows: 0, rate: "0.0%" },
  { product: "혈당관리엔 당당케어 (120정)", rows: 1583, couponRows: 907, rate: "57.3%" },
  { product: "엔자임 베네핏 90캡슐", rows: 974, couponRows: 28, rate: "2.9%" },
  { product: "썬화이버 프리바이오틱스 1개월분", rows: 923, couponRows: 66, rate: "7.2%" },
];

const organicAcidCouponDuplicate = [
  { label: "쿠폰 상품행", value: "2,171행", sub: "상품행 기준 쿠폰 사용 수" },
  { label: "고유 쿠폰 주문", value: "2,160건", sub: "같은 주문 내 중복 상품행 11행 제거" },
  { label: "고유 고객", value: "2,086명", sub: "전화번호 기준 중복 제거" },
  { label: "반복 사용 고객", value: "66명", sub: "전체 쿠폰 고객의 3.2%, 최대 3회" },
];

export default function CouponPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <Link href="/" className={styles.backLink}>← AI CRM으로 돌아가기</Link>
            <h1 className={styles.headerTitle}>쿠폰 CRM 분석</h1>
            <p className={styles.headerSub}>바이오컴 + 더클린커피 · 쿠폰 발급/사용률 · ROI · 카테고리별 분석</p>
          </div>
        </div>
      </header>

      <main className={styles.main}>

        {/* ═══ 바이오컴 vs 커피 분리 ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>바이오컴 vs 더클린커피 쿠폰 현황</h2>
          <div className={styles.compGrid}>
            <div className={styles.compCard} style={{ borderTopColor: "var(--color-primary)" }}>
              <strong>바이오컴 (검사/영양제)</strong>
              <div className={styles.compRow}><span>전체 고객</span><span>51,714명</span></div>
              <div className={styles.compRow}><span>쿠폰 사용 고객</span><span><strong>23,036명 (44.5%)</strong></span></div>
              <div className={styles.compRow}><span>총 쿠폰 할인액</span><span>₩605,404,151 (6.1억)</span></div>
              <div className={styles.compRow}><span>평균 쿠폰 할인</span><span>₩20,760</span></div>
              <div className={styles.compRow}><span>데이터 소스</span><span>운영 주문 원장 product_name 재집계</span></div>
              <div className={styles.compRow}><span>보조 원장 행수</span><span>96,045 상품행</span></div>
              <div className={styles.compRow}><span>집계 기간</span><span>{couponAnalysisPeriod}</span></div>
            </div>
            <div className={styles.compCard} style={{ borderTopColor: "var(--color-accent)" }}>
              <strong>더클린커피</strong>
              <div className={styles.compRow}><span>아임웹 주문 캐시</span><span>{fmtNum(coffeeCouponBackfillSummary.orders)}건</span></div>
              <div className={styles.compRow}><span>쿠폰 할인 주문</span><span>{fmtNum(coffeeCouponBackfillSummary.couponOrders)}건</span></div>
              <div className={styles.compRow}><span>쿠폰명 백필</span><span>{fmtNum(coffeeCouponBackfillSummary.issueCouponCodes)}개 issue ID / {fmtNum(coffeeCouponBackfillSummary.couponMasters)}개 쿠폰</span></div>
              <div className={styles.compRow}><span>대표 쿠폰명</span><span>{coffeeCouponBackfillSummary.topNames.join(" · ")}</span></div>
              <div className={styles.compRow}><span>캐시 기간</span><span>{coffeeCouponBackfillPeriod}</span></div>
              <div className={styles.compRow}><span>Toss 매출</span><span>₩31,182,667 (2개월)</span></div>
              <div className={styles.compRow}><span>PlayAuto 고객</span><span>7,035명 (2025)</span></div>
              <div className={styles.compRow}><span>상태</span><span style={{ color: "var(--color-accent)" }}>쿠폰명 백필 완료, 전체 고객/매출 조인은 Toss·PlayAuto 보강 필요</span></div>
            </div>
          </div>
          <div className={styles.interpretBlock}>
            <strong>현재 상태</strong>: 바이오컴은 운영 주문 원장에 상품명과 쿠폰 할인금액 데이터가 있음.
            더클린커피도 최근 로컬 아임웹 주문 캐시 기준 쿠폰명 백필은 완료됨.
            다만 아래 카테고리별 분석은 아직 <strong>바이오컴 운영 주문 원장 중심</strong>이고,
            더클린커피 전체 판단은 Toss·PlayAuto와 조인한 뒤 확정해야 함.
          </div>
        </div>

        {/* ═══ 바이오컴 KPI ═══ */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>바이오컴 전체 고객</span>
            <strong className={styles.kpiValue}>51,714명</strong>
          </div>
          <div className={styles.kpiCard} style={{ borderLeft: "4px solid var(--color-primary)" }}>
            <span className={styles.kpiLabel}>고객 기준 쿠폰 사용률</span>
            <strong className={styles.kpiValue}>44.5%</strong>
            <span className={styles.kpiSub}>23,036명이 쿠폰 사용</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>총 쿠폰 할인</span>
            <strong className={styles.kpiValue}>6.1억원</strong>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>평균 할인</span>
            <strong className={styles.kpiValue}>₩20,760</strong>
          </div>
        </div>

        {/* ═══ 많이 쓰는 쿠폰 vs 안 쓰는 쿠폰 (카테고리별) ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>상품별 쿠폰 사용률: 많이 쓰는 vs 안 쓰는</h2>
          <p className={styles.sectionDesc}>
            기준 기간: {couponAnalysisPeriod}. 이 표는 사람 기준이다.
            같은 고객이 같은 카테고리를 여러 번 사도 1명으로 센다.
            유기산/대사 검사는 3,322명 중 2,086명이 쿠폰을 사용했다.
          </p>

          <div className={styles.twoCol}>
            <div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={productCouponData.map((row) => ({ cat: row.shortCat, rate: row.rateValue }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Number(v)}%`} />
                  <YAxis type="category" dataKey="cat" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${Number(v)}%`, "쿠폰 사용률"]} />
                  <Bar dataKey="rate" fill="var(--color-primary)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{ overflowX: "auto" }}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>카테고리</th>
                      <th>대표 포함 상품 / 대표 쿠폰명</th>
                      <th style={{ textAlign: "right" }}>검사/구매 고객</th>
                      <th style={{ textAlign: "right" }}>쿠폰 사용 고객</th>
                      <th style={{ textAlign: "right" }}>고객 기준 쿠폰률</th>
                      <th style={{ textAlign: "right" }}>평균 할인</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productCouponData.map((r) => (
                      <tr key={r.cat} style={r.hot ? { background: "rgba(13,148,136,0.06)" } : r.cold ? { background: "rgba(239,68,68,0.04)" } : undefined}>
                        <td><strong>{r.cat}</strong></td>
                        <td style={{ color: "var(--color-text-secondary)", fontSize: "0.76rem" }}>
                          <div>{r.detail}</div>
                          <div style={{ marginTop: 6, lineHeight: 1.55 }}>
                            <b style={{ color: "var(--color-text-primary)" }}>대표 쿠폰명</b>
                            : {r.couponNames.join(" · ")}
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>{fmtNum(r.customers)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtNum(r.couponCustomers)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: r.hot ? "var(--color-primary)" : r.cold ? "var(--color-danger)" : undefined }}>{r.rate}</td>
                        <td style={{ textAlign: "right" }}>{r.avg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.interpretBlock} style={{ marginTop: 12 }}>
                <strong>인사이트</strong>:
                <ul style={{ paddingLeft: 16, margin: "6px 0 0", lineHeight: 1.8, fontSize: "0.78rem" }}>
                  <li><strong>기타 상품</strong>은 미분류 잡상품이 아니라 음식물 과민증 분석이 가장 큼. 별도 카테고리로 빼야 해석이 정확함</li>
                  <li><strong>쿠폰명</strong>은 운영 주문 원장에는 없지만, 아임웹 쿠폰 API로 연동 가능함을 확인. 최근 로컬 아임웹 캐시의 고유 발행쿠폰코드 {fmtNum(couponNameBackfillSummary.issueCouponCodes)}개를 모두 쿠폰명으로 백필 완료</li>
                  <li><strong>유기산/대사 검사</strong>는 고객 기준 쿠폰 의존도가 62.8%로 최고. 전체 3,322명 중 2,086명이 쿠폰을 썼음</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ 기타 상품 / 유기산 쿠폰 중복 점검 ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>기타 상품 정체와 유기산/대사 쿠폰 중복 점검</h2>
          <p className={styles.sectionDesc}>
            운영 주문 원장 기준 재집계. 메인 판단은 고객 수로 보고, 상품행은 왜 숫자가 다르게 보이는지 설명하는 보조 지표로만 둔다.
          </p>

          <div className={styles.compGrid}>
            <div className={styles.compCard} style={{ borderTopColor: "var(--color-info)" }}>
              <strong>기타 상품은 무엇인가</strong>
              <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "0.8rem", lineHeight: 1.7 }}>
                현재 기타 상품은 별도 상품군이 아니라 기존 키워드 분류에 걸리지 않은 나머지다.
                가장 큰 비중은 <b>음식물 과민증 분석</b>이고, 일부 개별 영양제와 내부 확인용 상품이 같이 섞여 있다.
                따라서 기타 상품의 쿠폰 사용률 55.6%는 &quot;잡상품 할인&quot;이 아니라 음식물 과민증 분석 쿠폰 영향으로 해석해야 한다.
              </p>
              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>기타 내 대표 상품</th>
                      <th style={{ textAlign: "right" }}>상품행</th>
                      <th style={{ textAlign: "right" }}>쿠폰행</th>
                      <th style={{ textAlign: "right" }}>쿠폰률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherProductBreakdown.map((row) => (
                      <tr key={row.product}>
                        <td><b>{row.product}</b></td>
                        <td style={{ textAlign: "right" }}>{fmtNum(row.rows)}</td>
                        <td style={{ textAlign: "right" }}>{fmtNum(row.couponRows)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{row.rate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.compCard} style={{ borderTopColor: "var(--color-primary)" }}>
              <strong>유기산/대사 쿠폰은 한 명이 여러 번 썼나</strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {organicAcidCouponDuplicate.map((metric) => (
                  <div key={metric.label} style={{ display: "flex", flexDirection: "column", gap: 4, padding: 14, borderRadius: 10, background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                    <span className={styles.kpiLabel}>{metric.label}</span>
                    <b style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>{metric.value}</b>
                    <span className={styles.kpiSub}>{metric.sub}</span>
                  </div>
                ))}
              </div>
              <div className={styles.interpretBlock} style={{ marginTop: 12 }}>
                <b>결론</b>: 한 사람이 여러 번 쓴 경우는 있다. 다만 규모는 제한적이다.
                유기산/대사 쿠폰 사용은 상품행 2,171행이지만 고유 주문은 2,160건, 고유 고객은 2,086명이다.
                반복 사용 고객은 66명이고, 이들이 만든 추가 쿠폰 주문은 74건이다.
                즉 쿠폰 수가 많아 보이는 주된 이유는 고객 중복보다 <b>상품행/주문/고객 집계 단위 차이</b>다.
              </div>
              <div className={styles.compRow}><span>1회 사용 고객</span><span>2,020명</span></div>
              <div className={styles.compRow}><span>2회 사용 고객</span><span>58명</span></div>
              <div className={styles.compRow}><span>3회 사용 고객</span><span>8명</span></div>
              <div className={styles.compRow}><span>6회 이상 사용 고객</span><span>0명</span></div>
              <div className={styles.compRow}><span>전체 유기산/대사 고객</span><span>3,322명</span></div>
              <div className={styles.compRow}><span>전체 유기산/대사 주문</span><span>3,553건</span></div>
              <div className={styles.compRow}><span>아임웹 구매수량 합계</span><span>4,061개</span></div>
            </div>
          </div>

          <div className={styles.interpretBlock} style={{ marginTop: 16 }}>
            <strong>집계 기준</strong>: 화면의 메인 표는 고객 기준이다.
            유기산/대사 관련 구매 고객은 3,322명이고, 그중 쿠폰 사용 고객은 2,086명이다.
            보조로 확인한 상품행 수는 3,574행, 구매수량 합계는 4,061개다.
            실제 검사 완료 인원은 검사 결과 원장과 조인해야 확정할 수 있다.
            <br />
            <strong>쿠폰명 연동 가능 여부</strong>: 가능으로 확인했다.
            운영 주문 원장에는 쿠폰 할인금액만 있지만, 최근 로컬 아임웹 캐시의 <code>use_issue_coupon_codes</code>를
            아임웹 쿠폰 API <code>/shop/issue-coupons/:issueCode</code>에 넣으면 쿠폰명이 반환된다.
            바이오컴 기준 쿠폰 마스터 {fmtNum(couponNameBackfillSummary.couponMasters)}개와
            고유 발행쿠폰코드 {fmtNum(couponNameBackfillSummary.issueCouponCodes)}개를 로컬 테이블에 백필했고,
            {fmtNum(couponNameBackfillSummary.issueCouponCodes)}개 모두 쿠폰명 매핑에 성공했다.
            단, 쿠폰명 조인 기간은 최근 로컬 아임웹 주문 캐시 기준 {couponNameBackfillPeriod}라서,
            위 고객 기준 전체 기간({couponAnalysisPeriod})과는 다르다.
          </div>
        </div>

        {/* ═══ 할인 금액대별 재구매 영향 ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>할인 금액대별 재구매 영향</h2>
          <p className={styles.sectionDesc}>1만 미만 소액 할인이 재구매율 64.6%로 최고. 가장 효율적인 할인 구간.</p>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[
              { tier: "미사용", customers: 28555, repeatRate: 18.8, avgRev: 391375 },
              { tier: "~1만", customers: 799, repeatRate: 64.6, avgRev: 801865 },
              { tier: "1~2만", customers: 13979, repeatRate: 17.1, avgRev: 289727 },
              { tier: "2~3만", customers: 5657, repeatRate: 21.0, avgRev: 442897 },
              { tier: "3만+", customers: 2265, repeatRate: 36.8, avgRev: 656512 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="tier" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Number(v)}%`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(Number(v)/10000).toFixed(0)}만`} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="repeatRate" fill="var(--color-primary)" name="재구매율(%)" radius={[3,3,0,0]} />
              <Bar yAxisId="right" dataKey="avgRev" fill="var(--color-info)" name="평균 매출(원)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className={styles.interpretBlock} style={{ marginTop: 12 }}>
            <strong>핵심 발견</strong>: 1만 미만 소액 할인 고객(799명)이 재구매율 <strong>64.6%</strong>로 압도적 1위.
            반면 1~2만원대 중간 할인(13,979명)은 재구매율 17.1%로 <strong>미사용자(18.8%)보다도 낮다</strong>.
            이는 &quot;1~2만원 쿠폰은 일회성 가격 민감 고객을 끌어올 뿐, 충성 고객으로 전환하지 못한다&quot;는 신호.
          </div>
        </div>

        {/* ═══ 쿠폰 사용 횟수별 세그먼트 ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>쿠폰 사용 횟수별 고객 세그먼트</h2>

          <div style={{ overflowX: "auto" }}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  <th>쿠폰 사용 횟수</th>
                  <th style={{ textAlign: "right" }}>고객 수</th>
                  <th style={{ textAlign: "right" }}>평균 매출</th>
                  <th style={{ textAlign: "right" }}>평균 주문</th>
                  <th style={{ textAlign: "right" }}>평균 총 할인</th>
                  <th style={{ textAlign: "right" }}>할인 의존도</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { bucket: "0회 (미사용)", cust: 28555, rev: "₩391,375", ord: "1.48", disc: "-", dep: "-" },
                  { bucket: "1회", cust: 19315, rev: "₩288,000", ord: "1.26", disc: "₩20,481", dep: "낮음" },
                  { bucket: "2회", cust: 2226, rev: "₩647,061", ord: "2.41", disc: "₩42,470", dep: "중간" },
                  { bucket: "3~5회", cust: 988, rev: "₩1,232,267", ord: "4.79", disc: "₩75,390", dep: "높음" },
                  { bucket: "6회+", cust: 171, rev: "₩2,705,830", ord: "10.90", disc: "₩165,224", dep: "매우 높음", highlight: true },
                ].map((r) => (
                  <tr key={r.bucket} style={r.highlight ? { background: "rgba(239,68,68,0.06)" } : undefined}>
                    <td><strong>{r.bucket}</strong></td>
                    <td style={{ textAlign: "right" }}>{fmtNum(r.cust)}</td>
                    <td style={{ textAlign: "right" }}>{r.rev}</td>
                    <td style={{ textAlign: "right" }}>{r.ord}</td>
                    <td style={{ textAlign: "right" }}>{r.disc}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: r.dep === "매우 높음" ? "var(--color-danger)" : r.dep === "높음" ? "var(--color-accent)" : undefined }}>{r.dep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.interpretBlock} style={{ marginTop: 12 }}>
            <strong>쿠폰 의존 고객 위험</strong>: 6회+ 사용자 171명은 평균 ₩165,224 할인을 받으면서 ₩2,705,830 매출.
            할인 비율 약 6%. 이 고객이 <strong>쿠폰 없이도 구매할지</strong>는 검증이 필요하다.
            만약 쿠폰을 줄여도 구매한다면 연간 수천만원 마진 개선 가능.
          </div>
        </div>

        {/* ═══ CSO 전략 제안 ═══ */}
        <div className={styles.section} style={{ borderTop: "3px solid var(--color-primary)" }}>
          <h2 className={styles.sectionTitle}>CSO 전략 제안</h2>

          <div className={styles.strategyGrid}>
            <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-success)" }}>
              <div className={styles.strategyRank} style={{ background: "var(--color-success)" }}>1</div>
              <div>
                <strong>소액 할인(1만 미만)을 늘리고, 중간 할인(1~2만)을 줄여라</strong>
                <p>
                  1만 미만 할인 고객의 재구매율이 64.6%로 최고.
                  1~2만 할인은 17.1%로 미사용자보다도 낮다.
                  <strong>5,000원 쿠폰이 20,000원 쿠폰보다 재구매를 더 잘 만든다.</strong>
                  중간 할인의 마진 유출을 소액 할인으로 전환하면 재구매율 UP + 마진 보전.
                </p>
                <span className={styles.strategyTag}>즉시 실행 가능 · 마진 개선 최우선</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-danger)" }}>
              <div className={styles.strategyRank} style={{ background: "var(--color-danger)" }}>2</div>
              <div>
                <strong>유기산/대사 검사(고객 기준 62.8%)의 쿠폰 의존도를 낮춰라</strong>
                <p>
                  유기산/대사 검사는 고객 기준 쿠폰 사용률이 62.8%로 가장 높고, 평균 할인도 ₩27,094으로 크다.
                  이 카테고리만 누적 <strong>5,882만원+</strong> 쿠폰 할인이 발생했다.
                  상담 후 &quot;검사 필요성 인지&quot;가 된 고객에게는 쿠폰 없이도 전환 가능.
                  <strong>상담 완료 고객에게는 쿠폰 대신 상담사 추천 메시지</strong>로 전환 유도.
                </p>
                <span className={styles.strategyTag}>상담 CRM 연계 · callprice 데이터 활용</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-info)" }}>
              <div className={styles.strategyRank} style={{ background: "var(--color-info)" }}>3</div>
              <div>
                <strong>알러지 검사(0%)는 쿠폰이 불필요하다</strong>
                <p>
                  알러지/알레르기 명칭 상품은 쿠폰 사용이 0%다.
                  이 카테고리에 쿠폰을 발급하면 <strong>불필요한 마진 유출</strong>일 가능성이 높다.
                  영양제는 정기구독/개별 제품이 섞여 있어 상품별로 따로 봐야 한다.
                  대신 <strong>알러지 검사 → 유기산 검사 크로스셀</strong> 쿠폰은 효과적일 수 있다.
                </p>
                <span className={styles.strategyTag}>쿠폰 발급 대상에서 제외 검토</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-accent)" }}>
              <div className={styles.strategyRank} style={{ background: "var(--color-accent)" }}>4</div>
              <div>
                <strong>쿠폰 6회+ 사용자(171명) 의존도 테스트</strong>
                <p>
                  이 고객들은 평균 10.9회 주문, ₩165,224 할인을 받고 있다.
                  <strong>다음 주문에 쿠폰 없이 구매하는지</strong> A/B 테스트.
                  구매한다면 불필요한 할인이었고, 안 한다면 쿠폰 의존형 고객.
                  의존형이면 쿠폰 대신 <strong>정기구독 전환</strong>으로 고정 할인 구조로 전환.
                </p>
                <span className={styles.strategyTag}>crm-local 실험 설계</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ 더클린커피 쿠폰 전략 ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>더클린커피 쿠폰 전략 (로컬 캐시 기준)</h2>
          <p className={styles.sectionDesc}>
            아임웹 로컬 주문 캐시 기준 {fmtNum(coffeeCouponBackfillSummary.orders)}건,
            쿠폰 할인 주문 {fmtNum(coffeeCouponBackfillSummary.couponOrders)}건,
            쿠폰명 매핑 {fmtNum(coffeeCouponBackfillSummary.issueCouponCodes)}개까지 확보됨.
            전체 고객/장기 ROI는 Toss·PlayAuto 조인 후 확정.
          </p>

          <div className={styles.kpiGrid}>
            {[
              { label: "Step 1", value: "정기 동기화 고정", sub: "아임웹 주문 + 쿠폰명 캐시를 매일 갱신" },
              { label: "Step 2", value: "쿠폰별 발급/사용 추적", sub: "가입축하·설맞이·카톡 플친 쿠폰별 매출 비교" },
              { label: "Step 3", value: "15% 쿠폰 실험 결과 반영", sub: "첫구매 쿠폰 9variant 결과 → 최적 할인율 확정" },
              { label: "Step 4", value: "커피 쿠폰 ROI 대시보드", sub: "Toss 매출·PlayAuto 고객과 주문번호 조인" },
            ].map((s) => (
              <div key={s.label} className={styles.kpiCard}>
                <span className={styles.kpiLabel}>{s.label}</span>
                <strong className={styles.kpiValue}>{s.value}</strong>
                <span className={styles.kpiSub}>{s.sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ Codex 2차 의견 ═══ */}
        <div className={styles.section} style={{ borderTop: "3px solid #8b5cf6" }}>
          <h2 className={styles.sectionTitle}>Codex 2차 기술 의견</h2>
          <p className={styles.sectionDesc}>백엔드/데이터 관점에서 쿠폰 분석에 대한 보충</p>

          <div className={styles.strategyGrid}>
            <div className={styles.strategyCard} style={{ borderLeftColor: "#8b5cf6" }}>
              <div className={styles.strategyRank} style={{ background: "#8b5cf6" }}>1</div>
              <div>
                <strong>1만 미만 할인 = 재구매율 64.6%의 함정</strong>
                <p>
                  이 수치는 &quot;소액 할인이 재구매를 만든다&quot;는 뜻이 <strong>아닐 수 있다</strong>.
                  1만 미만 할인 799명은 이미 여러 번 구매한 충성 고객이 적립금/소액 쿠폰을 소진하는 패턴일 가능성.
                  즉 &quot;재구매 고객이라서 소액 쿠폰을 쓴 것&quot;이지, &quot;소액 쿠폰 때문에 재구매한 것&quot;이 아닐 수 있다.
                  <strong>인과 검증</strong>: 신규 고객에게만 소액 쿠폰을 발급하는 실험이 필요.
                </p>
                <span className={styles.strategyTag}>인과관계 vs 상관관계 구분 필요</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#8b5cf6" }}>
              <div className={styles.strategyRank} style={{ background: "#8b5cf6" }}>2</div>
              <div>
                <strong>coupon_discount와 쿠폰명 매핑의 한계</strong>
                <p>
                  운영 주문 원장은 <code>coupon_discount</code> 금액만 안정적으로 보유한다.
                  최근 로컬 아임웹 캐시는 <code>use_issue_coupon_codes</code>도 저장하고 있으며,
                  아임웹 쿠폰 API(<code>/shop/coupons</code>, <code>/shop/issue-coupons/:issueCode</code>)로
                  내부 발급 ID를 사람이 읽는 쿠폰명으로 백필했다.
                  이제 주문번호 조인을 붙이면 쿠폰별 발급/사용/미사용 + 목적별 ROI를 볼 수 있다.
                </p>
                <span className={styles.strategyTag}>아임웹 쿠폰 API 백필 완료 · 주문번호 조인 고도화 필요</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#8b5cf6" }}>
              <div className={styles.strategyRank} style={{ background: "#8b5cf6" }}>3</div>
              <div>
                <strong>커피 데이터 분리의 기술적 방법</strong>
                <p>
                  현재 <code>product_name</code> 키워드 매칭으로 커피/바이오컴을 분리했지만 80건밖에 안 잡힘.
                  이유: 아임웹 주문 동기화가 바이오컴 siteCode만 대상.
                  <strong>해결</strong>: 더클린커피 siteCode를 확보하여 별도 동기화하거나,
                  Toss <code>store=coffee</code>의 <code>orderId</code>와 PlayAuto <code>shop_ord_no</code>를 조인하면
                  커피 쿠폰 분석은 주문 원장 없이도 부분적으로 가능.
                </p>
                <span className={styles.strategyTag}>Toss+PlayAuto 크로스 조인 또는 siteCode 연동</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#8b5cf6" }}>
              <div className={styles.strategyRank} style={{ background: "#8b5cf6" }}>4</div>
              <div>
                <strong>쿠폰 ROI 자동 모니터링 구현 방안</strong>
                <p>
                  아임웹 API로 쿠폰별 발급/사용을 매일 가져오고, 주문 매출과 조인하여
                  쿠폰 코드별 <code>ROI = (쿠폰 사용 주문 순매출 - 할인액) ÷ 할인액</code>을 자동 산출.
                  ROI 1.0 이하 쿠폰은 <strong>아폴론 에이전트가 자동 경고</strong>.
                  구현 예상: 백엔드 배치 1개 + 프론트 차트 1개. crm-local SQLite에 적재 가능.
                </p>
                <span className={styles.strategyTag}>PROMETHEUS 아폴론 에이전트 연동</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
