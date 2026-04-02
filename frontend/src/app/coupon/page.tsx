"use client";

import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import styles from "./page.module.css";

const fmtKRW = (v: number) => `₩${v.toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");
const COLORS = ["#0D9488", "#3b82f6", "#F59E0B", "#EF4444", "#8b5cf6", "#ec4899"];

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
              <div className={styles.compRow}><span>총 주문</span><span>95,021건</span></div>
              <div className={styles.compRow}><span>쿠폰 사용 주문</span><span><strong>28,526건 (30.0%)</strong></span></div>
              <div className={styles.compRow}><span>총 쿠폰 할인액</span><span>₩592,859,491 (5.9억)</span></div>
              <div className={styles.compRow}><span>평균 쿠폰 할인</span><span>₩20,783</span></div>
              <div className={styles.compRow}><span>데이터 소스</span><span>아임웹 주문 원장</span></div>
            </div>
            <div className={styles.compCard} style={{ borderTopColor: "var(--color-accent)" }}>
              <strong>더클린커피</strong>
              <div className={styles.compRow}><span>아임웹 주문</span><span>80건 (매우 적음)</span></div>
              <div className={styles.compRow}><span>쿠폰 사용</span><span>0건</span></div>
              <div className={styles.compRow}><span>Toss 매출</span><span>₩31,182,667 (2개월)</span></div>
              <div className={styles.compRow}><span>PlayAuto 고객</span><span>7,035명 (2025)</span></div>
              <div className={styles.compRow}><span>상태</span><span style={{ color: "var(--color-accent)" }}>아임웹 커피 원장 미연동 → Toss/PlayAuto 기반</span></div>
            </div>
          </div>
          <div className={styles.interpretBlock}>
            <strong>현재 상태</strong>: 바이오컴은 아임웹 주문 원장에 쿠폰 데이터가 풍부하게 있음.
            더클린커피는 아임웹에 80건뿐이라 쿠폰 분석이 불가 — 커피 siteCode 연동 후 분석 가능.
            아래 분석은 <strong>바이오컴 데이터 중심</strong>.
          </div>
        </div>

        {/* ═══ 바이오컴 KPI ═══ */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>바이오컴 총 주문</span>
            <strong className={styles.kpiValue}>95,021건</strong>
          </div>
          <div className={styles.kpiCard} style={{ borderLeft: "4px solid var(--color-primary)" }}>
            <span className={styles.kpiLabel}>쿠폰 사용률</span>
            <strong className={styles.kpiValue}>30.0%</strong>
            <span className={styles.kpiSub}>28,526건이 쿠폰 사용</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>총 쿠폰 할인</span>
            <strong className={styles.kpiValue}>5.9억원</strong>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>평균 할인</span>
            <strong className={styles.kpiValue}>₩20,783</strong>
          </div>
        </div>

        {/* ═══ 많이 쓰는 쿠폰 vs 안 쓰는 쿠폰 (카테고리별) ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>상품별 쿠폰 사용률: 많이 쓰는 vs 안 쓰는</h2>
          <p className={styles.sectionDesc}>유기산/대사 검사는 61%가 쿠폰 사용. 알러지 검사는 0%. 영양제는 2.7%.</p>

          <div className={styles.twoCol}>
            <div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={[
                  { cat: "유기산/대사", rate: 61.2, avg: 27128 },
                  { cat: "기타", rate: 34.4, avg: 20933 },
                  { cat: "호르몬", rate: 22.4, avg: 22749 },
                  { cat: "중금속", rate: 20.1, avg: 13836 },
                  { cat: "장내", rate: 17.4, avg: 15557 },
                  { cat: "영양제", rate: 2.7, avg: 10033 },
                  { cat: "알러지", rate: 0, avg: 0 },
                ]} layout="vertical">
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
                      <th style={{ textAlign: "right" }}>주문</th>
                      <th style={{ textAlign: "right" }}>쿠폰 사용률</th>
                      <th style={{ textAlign: "right" }}>평균 할인</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { cat: "유기산/대사 검사", orders: 3492, rate: "61.2%", avg: "₩27,128", hot: true },
                      { cat: "기타 상품", orders: 69096, rate: "34.4%", avg: "₩20,933", hot: false },
                      { cat: "호르몬 검사", orders: 250, rate: "22.4%", avg: "₩22,749", hot: false },
                      { cat: "중금속 검사", orders: 10852, rate: "20.1%", avg: "₩13,836", hot: false },
                      { cat: "장내 검사", orders: 1829, rate: "17.4%", avg: "₩15,557", hot: false },
                      { cat: "영양제", orders: 1405, rate: "2.7%", avg: "₩10,033", cold: true },
                      { cat: "알러지 검사", orders: 8178, rate: "0.0%", avg: "-", cold: true },
                    ].map((r) => (
                      <tr key={r.cat} style={r.hot ? { background: "rgba(13,148,136,0.06)" } : r.cold ? { background: "rgba(239,68,68,0.04)" } : undefined}>
                        <td><strong>{r.cat}</strong></td>
                        <td style={{ textAlign: "right" }}>{fmtNum(r.orders)}</td>
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
                  <li><strong>유기산/대사 검사</strong>가 쿠폰 의존도 최고(61%). 가격이 높아 할인 없이는 구매 결정이 어려운 것</li>
                  <li><strong>알러지 검사</strong>는 쿠폰 0% — 이미 가격 수용성이 높거나 보험/필수 검사로 인식</li>
                  <li><strong>영양제</strong> 쿠폰 2.7% — 상담 후 추천으로 구매하므로 쿠폰 불필요</li>
                </ul>
              </div>
            </div>
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
                <strong>유기산/대사 검사(61%)의 쿠폰 의존도를 낮춰라</strong>
                <p>
                  유기산/대사 검사는 쿠폰 사용률이 61%로 가장 높고, 평균 할인도 ₩27,128으로 최대.
                  이 카테고리만 연간 <strong>5,800만원+</strong> 마진 유출.
                  상담 후 &quot;검사 필요성 인지&quot;가 된 고객에게는 쿠폰 없이도 전환 가능.
                  <strong>상담 완료 고객에게는 쿠폰 대신 상담사 추천 메시지</strong>로 전환 유도.
                </p>
                <span className={styles.strategyTag}>상담 CRM 연계 · callprice 데이터 활용</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-info)" }}>
              <div className={styles.strategyRank} style={{ background: "var(--color-info)" }}>3</div>
              <div>
                <strong>알러지 검사(0%)와 영양제(2.7%)는 쿠폰이 불필요하다</strong>
                <p>
                  알러지 검사와 영양제는 이미 쿠폰 없이 잘 팔리고 있다.
                  이 카테고리에 쿠폰을 발급하면 <strong>불필요한 마진 유출</strong>.
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
          <h2 className={styles.sectionTitle}>더클린커피 쿠폰 전략 (데이터 확보 후)</h2>
          <p className={styles.sectionDesc}>현재 아임웹 커피 원장 미연동. siteCode 확보 후 아래 분석 가능.</p>

          <div className={styles.kpiGrid}>
            {[
              { label: "Step 1", value: "커피 siteCode 연동", sub: "아임웹 API로 커피 주문 + 쿠폰 데이터 수집" },
              { label: "Step 2", value: "쿠폰별 발급/사용 추적", sub: "아임웹 Promotion API → 쿠폰 코드별 ROI" },
              { label: "Step 3", value: "15% 쿠폰 실험 결과 반영", sub: "첫구매 쿠폰 9variant 결과 → 최적 할인율 확정" },
              { label: "Step 4", value: "커피 쿠폰 ROI 대시보드", sub: "바이오컴과 동일 구조로 커피 전용 쿠폰 분석" },
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
                <strong>coupon_discount 필드의 한계</strong>
                <p>
                  현재 분석은 <code>tb_iamweb_users.coupon_discount</code> 금액만 보고 있다.
                  <strong>어떤 쿠폰이 사용되었는지</strong>(코드명, 발급 목적, 유효기간)는 이 필드만으로 알 수 없다.
                  아임웹 Promotion API(<code>/promotion/shop-coupon</code>)를 연동하면
                  쿠폰별 발급/사용/미사용 + 목적별 ROI를 볼 수 있다.
                </p>
                <span className={styles.strategyTag}>아임웹 Promotion API 연동 권장</span>
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
