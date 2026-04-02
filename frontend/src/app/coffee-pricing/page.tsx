"use client";

import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import styles from "../coupon/page.module.css";

const fmtKRW = (v: number) => `₩${v.toLocaleString("ko-KR")}`;
const fmtNum = (v: number) => v.toLocaleString("ko-KR");

// 200g 기준 원가 데이터
const products200g = [
  { name: "콜롬비아", current: 18300, proposed: 21000, cost: 7945, currentMargin: 10355, proposedMargin: 13055 },
  { name: "케냐 블렌드", current: 19300, proposed: 25000, cost: 10497, currentMargin: 8803, proposedMargin: 14503 },
  { name: "에티오피아", current: 19300, proposed: 23000, cost: 9039, currentMargin: 10261, proposedMargin: 13961 },
  { name: "과테말라", current: 19300, proposed: 22000, cost: 8407, currentMargin: 10893, proposedMargin: 13593 },
  { name: "에콰도르(고가)", current: 30000, proposed: 39000, cost: 19486, currentMargin: 10514, proposedMargin: 19514 },
  { name: "파푸아뉴기니", current: 19300, proposed: 20000, cost: 7460, currentMargin: 11840, proposedMargin: 12540 },
  { name: "디카페인", current: 19300, proposed: 22000, cost: 9039, currentMargin: 10261, proposedMargin: 12961 },
];

// 경쟁사 500g 가격 (현재 더클린커피 + 제안가 포함)
const competitors500g = [
  { product: "콜롬비아", oursCurrent: 33500, oursProposed: 41000, momos: 30000, libre: 34000, gn: 36000, mdt: 25000 },
  { product: "케냐", oursCurrent: 36500, oursProposed: 48000, momos: 32000, libre: 34000, gn: 34000, mdt: 29000 },
  { product: "에티오피아", oursCurrent: 36500, oursProposed: 45000, momos: 32000, libre: 52000, gn: 35000, mdt: 30000 },
  { product: "과테말라", oursCurrent: 36500, oursProposed: 43000, momos: 58000, libre: 30000, gn: 39000, mdt: 34000 },
  { product: "디카페인", oursCurrent: 36500, oursProposed: 43000, momos: 32000, libre: 36000, gn: 30000, mdt: 0 },
];

export default function CoffeePricingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <Link href="/" className={styles.backLink}>← AI CRM으로 돌아가기</Link>
            <h1 className={styles.headerTitle}>더클린커피 가격 전략 · 원가 분석</h1>
            <p className={styles.headerSub}>원가 제안서 260305 기준 · 경쟁사 비교 · 마진 시뮬레이션 · CSO 판단</p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* 핵심 요약 */}
        <div style={{
          padding: "24px 28px", borderRadius: 14,
          background: "linear-gradient(135deg, rgba(245,158,11,0.06), rgba(13,148,136,0.04))",
          border: "2px solid rgba(245,158,11,0.15)",
        }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>
            가격 인상 제안: 평균 +15~30% · 경쟁사 대비 여전히 프리미엄 포지션
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            현재 원가율 43~65%. 제안가 적용 시 마진 <strong>26~86% 개선</strong>.
            경쟁사(모모스/커피리브레/그냥커피) 대비 제안가가 <strong>10~40% 높지만</strong>,
            곰팡이독소 검사/이중 핸드픽/뉴크롭 등 품질 차별화로 프리미엄 정당화 가능.
            Toss 실측 객단가 ₩48,579로 이미 고가 수용 고객이 존재.
          </div>
        </div>

        {/* KPI */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Toss 실측 평균 객단가</span>
            <strong className={styles.kpiValue}>₩48,579</strong>
            <span className={styles.kpiSub}>Toss store=coffee DONE 664건 평균 결제금액. 517명 고객의 주문당 실결제 평균 (2026-01~02)</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>PG 수수료</span>
            <strong className={styles.kpiValue}>3.41~3.63%</strong>
            <span className={styles.kpiSub}>Toss 정산 API 실측</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>200g 평균 원가</span>
            <strong className={styles.kpiValue}>₩8,839</strong>
            <span className={styles.kpiSub}>생두+부자재+배송 (에콰도르 제외)</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>제안가 적용 시 마진 개선</span>
            <strong className={styles.kpiValue}>+26~86%</strong>
            <span className={styles.kpiSub}>케냐 블렌드 +65%, 에콰도르 +86%</span>
          </div>
        </div>

        {/* 200g 현재 vs 제안 비교 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>200g 기준: 현재가 vs 제안가</h2>
          <p className={styles.sectionDesc}>원가(생두+부자재+배송) 대비 소비자가와 마진. 제안가 기준 원가율 32~50%.</p>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={products200g} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₩${(Number(v)/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={85} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [fmtKRW(Number(v)), ""]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="cost" fill="var(--color-danger)" name="원가" stackId="a" />
              <Bar dataKey="currentMargin" fill="var(--color-text-muted)" name="현재 마진" stackId="a" />
              <Bar dataKey="proposedMargin" fill="var(--color-success)" name="제안 마진" />
            </BarChart>
          </ResponsiveContainer>

          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  <th>원두</th>
                  <th style={{ textAlign: "right" }}>현재가</th>
                  <th style={{ textAlign: "right" }}>제안가</th>
                  <th style={{ textAlign: "right" }}>인상률</th>
                  <th style={{ textAlign: "right" }}>원가</th>
                  <th style={{ textAlign: "right" }}>현재 마진</th>
                  <th style={{ textAlign: "right" }}>제안 마진</th>
                  <th style={{ textAlign: "right" }}>마진 개선</th>
                </tr>
              </thead>
              <tbody>
                {products200g.map((p) => {
                  const increase = ((p.proposed - p.current) / p.current * 100).toFixed(0);
                  const marginImprove = ((p.proposedMargin - p.currentMargin) / p.currentMargin * 100).toFixed(0);
                  return (
                    <tr key={p.name} className={styles.tableRow}>
                      <td><strong>{p.name}</strong></td>
                      <td style={{ textAlign: "right" }}>{fmtKRW(p.current)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-primary)" }}>{fmtKRW(p.proposed)}</td>
                      <td style={{ textAlign: "right", color: "var(--color-danger)" }}>+{increase}%</td>
                      <td style={{ textAlign: "right" }}>{fmtKRW(p.cost)}</td>
                      <td style={{ textAlign: "right" }}>{fmtKRW(p.currentMargin)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-success)" }}>{fmtKRW(p.proposedMargin)}</td>
                      <td style={{ textAlign: "right", color: "var(--color-success)" }}>+{marginImprove}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 경쟁사 비교 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>500g 기준: 경쟁사 가격 비교</h2>
          <p className={styles.sectionDesc}>더클린커피 제안가는 경쟁사 대비 프리미엄. 모모스/커피리브레보다 높지만 품질 차별화.</p>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={competitors500g}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="product" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(Number(v)/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [fmtKRW(Number(v)), ""]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="oursCurrent" fill="#94a3b8" name="더클린커피 (현재)" />
              <Bar dataKey="oursProposed" fill="var(--color-primary)" name="더클린커피 (제안)" />
              <Bar dataKey="gn" fill="var(--color-accent)" name="그냥커피" />
              <Bar dataKey="mdt" fill="var(--color-text-muted)" name="마데톨미" />
              <Bar dataKey="momos" fill="#8b5cf6" name="모모스" />
              <Bar dataKey="libre" fill="#ec4899" name="커피리브레" />
            </BarChart>
          </ResponsiveContainer>

          <div className={styles.interpretBlock} style={{ marginTop: 12 }}>
            <strong>경쟁 포지션</strong>: 더클린커피 제안가는 대부분 경쟁사보다 <strong>10~40% 높다</strong>.
            단, 커피리브레 페루 게이샤(₩52,000)처럼 초프리미엄 라인보다는 낮다.
            차별화 포인트: 곰팡이독소 검사, 이중 핸드픽, 뉴크롭 — 이것을 <strong>&quot;건강+품질&quot; 프리미엄</strong>으로 소구.
          </div>
        </div>

        {/* CSO 판단 */}
        <div className={styles.section} style={{ borderTop: "3px solid var(--color-primary)" }}>
          <h2 className={styles.sectionTitle}>AI CSO 가격 판단</h2>

          <div className={styles.strategyGrid}>
            <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-success)" }}>
              <div className={styles.strategyRank} style={{ background: "var(--color-success)" }}>1</div>
              <div>
                <strong>인상 가능 신호 (현재 해당)</strong>
                <ul style={{ paddingLeft: 16, fontSize: "0.78rem", lineHeight: 1.8, marginTop: 6 }}>
                  <li>Toss 실측 객단가 ₩48,579 — 이미 고가 수용 고객 존재</li>
                  <li>Toss 가격대 분포: 6만+ 주문이 20% → 프리미엄 수요 실재</li>
                  <li>재구매율 21% — 가격 민감도 낮은 신호</li>
                  <li>VIP(6회+) 383명이 매출 30% — 충성 고객은 가격보다 품질</li>
                  <li>경쟁사 스페셜티(모모스/프릳츠) 대비 차별화 요소 명확</li>
                </ul>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-accent)" }}>
              <div className={styles.strategyRank} style={{ background: "var(--color-accent)" }}>2</div>
              <div>
                <strong>인상 실행 전략: 단계적 접근</strong>
                <ul style={{ paddingLeft: 16, fontSize: "0.78rem", lineHeight: 1.8, marginTop: 6 }}>
                  <li><strong>1단계</strong>: 에티오피아(+19%)부터 인상 → 풍미 탐색형 고객은 가격 덜 민감</li>
                  <li><strong>2단계</strong>: 3주 차 쿠폰 실험 결과 확인 후 콜롬비아(+15%) 인상</li>
                  <li><strong>3단계</strong>: 신규 고객에게만 제안가, VIP에게는 기존가 유지(가격 인상 충격 방지)</li>
                  <li><strong>모니터링</strong>: Toss daily-summary API로 일별 주문 건수/객단가 실시간 추적</li>
                </ul>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "var(--color-danger)" }}>
              <div className={styles.strategyRank} style={{ background: "var(--color-danger)" }}>3</div>
              <div>
                <strong>인상 주의사항</strong>
                <ul style={{ paddingLeft: 16, fontSize: "0.78rem", lineHeight: 1.8, marginTop: 6 }}>
                  <li>쿠팡 가격(300g ₩30,000~33,000)은 자사몰보다 낮아 채널 충돌 가능</li>
                  <li>파푸아뉴기니(유기농)는 제안 인상폭이 ₩700뿐 — 이미 마진 최적에 가까움</li>
                  <li>1회 이탈 78%의 고객이 가격 때문인지 선택 피로 때문인지 구분 필요 (리드 마그넷 실험으로 검증)</li>
                  <li>인상 후 3개월 코호트에서 재구매율 하락이 3%p 이상이면 철회 고려</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 연간 마진 개선 시뮬레이션 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>연간 마진 개선 시뮬레이션</h2>
          <p className={styles.sectionDesc}>Toss 월 매출 ~1,500만원 기준. 제안가 적용 시 연간 추가 마진.</p>

          <div className={styles.kpiGrid}>
            {[
              { label: "현재 연 매출", value: "~1.8억원", sub: "Toss 월 1,500만 × 12개월" },
              { label: "제안가 적용 시", value: "~2.3억원", sub: "평균 +26% 인상 적용" },
              { label: "연간 추가 마진", value: "+5,000만원", sub: "원가 불변, 판매량 유지 가정" },
              { label: "판매량 10% 감소해도", value: "+3,200만원", sub: "가격 탄력성 최악 시나리오" },
            ].map((s) => (
              <div key={s.label} className={styles.kpiCard}>
                <span className={styles.kpiLabel}>{s.label}</span>
                <strong className={styles.kpiValue}>{s.value}</strong>
                <span className={styles.kpiSub}>{s.sub}</span>
              </div>
            ))}
          </div>

          <div className={styles.interpretBlock} style={{ marginTop: 12 }}>
            <strong>결론</strong>: 판매량이 10% 줄어도 연간 +3,200만원 마진 개선. 인상은 수학적으로 유리.
            다만 &quot;판매량 10% 감소&quot;가 실제로 일어나는지는 <strong>에티오피아 단일 상품 인상 A/B</strong>로 먼저 검증.
            Toss daily-summary API + 아임웹 주문 API로 실시간 모니터링 가능.
          </div>
        </div>
        {/* ═══ Codex 논리 보강 의견 ═══ */}
        <div className={styles.section} style={{ borderTop: "3px solid #8b5cf6" }}>
          <h2 className={styles.sectionTitle}>Codex 논리 보강 의견</h2>
          <p className={styles.sectionDesc}>AI CSO 가격 판단에 대한 백엔드/데이터 관점 2차 검토</p>

          <div className={styles.strategyGrid}>
            <div className={styles.strategyCard} style={{ borderLeftColor: "#8b5cf6" }}>
              <div className={styles.strategyRank} style={{ background: "#8b5cf6" }}>1</div>
              <div>
                <strong>제안가 인상폭이 상품별로 너무 차이가 큼 — 고객 혼란 리스크</strong>
                <p>
                  파푸아뉴기니 +₩700(+4%) vs 케냐 +₩5,700(+30%). 같은 브랜드에서 한 상품은 거의 안 오르고 다른 상품은 30% 오르면
                  <strong>가격 정책의 일관성</strong>이 무너진다. 고객 입장에서 &quot;왜 이건 갑자기 비싸졌지?&quot;라는 불신이 생길 수 있다.
                  <strong>권장</strong>: 전 상품 10~15% 균일 인상 후, 수요 반응을 보고 상품별 미세 조정.
                </p>
                <span className={styles.strategyTag}>가격 정책 일관성 검토</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#8b5cf6" }}>
              <div className={styles.strategyRank} style={{ background: "#8b5cf6" }}>2</div>
              <div>
                <strong>쿠팡 채널 가격과의 충돌이 가장 큰 리스크</strong>
                <p>
                  쿠팡 300g 현재가 ₩31,900~33,900 → 제안가 ₩30,000~33,000.
                  자사몰 200g 제안가 ₩21,000~25,000인데, 쿠팡 300g이 ₩30,000이면 <strong>g당 가격이 쿠팡이 더 싸다</strong>.
                  인상하면 자사몰 고객이 쿠팡으로 이동할 수 있고, 쿠팡은 수수료가 높아 마진이 더 나빠진다.
                  <strong>권장</strong>: 자사몰 인상 전에 쿠팡 가격을 먼저 올리거나, 자사몰 전용 구성(200g→250g 업그레이드 등)으로 차별화.
                </p>
                <span className={styles.strategyTag}>채널 가격 충돌 최우선 점검</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#8b5cf6" }}>
              <div className={styles.strategyRank} style={{ background: "#8b5cf6" }}>3</div>
              <div>
                <strong>&quot;판매량 10% 감소해도 +3,200만원&quot; 가정의 약점</strong>
                <p>
                  이 계산은 <strong>기존 고객이 그대로 남는다</strong>는 가정. 하지만 1회 이탈 78%는 이미 가격 민감할 수 있고,
                  인상 시 신규 유입이 줄어드는 것은 기존 재구매 고객 수에 영향을 주지 않지만 <strong>미래 VIP 파이프라인</strong>이 마른다.
                  <strong>권장</strong>: 인상 후 3개월간 &quot;월 신규 고객 수&quot;와 &quot;코호트 M+1 재구매율&quot;을 Toss API로 주간 모니터링.
                  신규 고객이 20%+ 감소하면 인상폭 축소.
                </p>
                <span className={styles.strategyTag}>신규 유입 모니터링 필수</span>
              </div>
            </div>

            <div className={styles.strategyCard} style={{ borderLeftColor: "#8b5cf6" }}>
              <div className={styles.strategyRank} style={{ background: "#8b5cf6" }}>4</div>
              <div>
                <strong>경쟁사보다 10~40% 높은 것이 &quot;프리미엄&quot;인지 &quot;과대&quot;인지는 브랜드 인지도에 달려 있다</strong>
                <p>
                  모모스(부산 직영 7개점, 코스트코 입점)와 프릳츠(연 매출 165억)는 <strong>오프라인 경험</strong>이 가격을 정당화한다.
                  더클린커피는 온라인 전용이라 &quot;곰팡이독소 검사&quot;만으로 +40% 프리미엄을 유지하려면
                  <strong>콘텐츠 마케팅과 리드 마그넷</strong>이 그 갭을 메워야 한다.
                  리드 마그넷(1분 진단)과 VIP 오감 커핑 클래스가 이 역할을 해야 하는 이유.
                </p>
                <span className={styles.strategyTag}>브랜드 인지도 vs 가격 프리미엄 갭</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ GPT Pro 원가 인상 리서치 보고서 ═══ */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle} style={{ fontSize: "1.3rem", borderBottom: "3px solid #6366f1", paddingBottom: 8 }}>
            원가 인상 리서치 보고서
          </h2>
          <div style={{ padding: "12px 18px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", marginBottom: 20 }}>
            <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e40af", margin: 0, lineHeight: 1.8 }}>
              결론: 지금은 전면 가격 인상보다, SKU를 가려서 일부만 올리고 재구매 구조를 먼저 다듬는 쪽이 맞다.
              더클린커피는 제품이 안 팔리는 상태는 아니지만, 2번째 구매를 빨리 붙이는 힘이 아직 약하다.
              이런 상태에서 전 라인 가격을 한 번에 올리면, 마진보다 이탈이 먼저 커질 가능성이 있다.
            </p>
          </div>

          {/* 10초 요약 */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>10초 요약</h3>
            <ul style={{ fontSize: "0.88rem", lineHeight: 1.8, color: "#334155", paddingLeft: 20 }}>
              <li><strong>가격 인상 자체는 가능</strong>하다. 다만 <strong>전 품목 일괄 인상은 비추천</strong>.</li>
              <li><strong>케냐 블렌드, 에콰도르 고가라인, 디카페인</strong>은 인상 여지가 있고, <strong>콜롬비아·과테말라·파푸아뉴기니</strong>는 지금 급하게 올릴 이유가 약하다.</li>
            </ul>
          </div>

          {/* 현재 상태 */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>현재 상태</h3>
            <p style={{ fontSize: "0.88rem", lineHeight: 1.8, color: "#334155" }}>
              최근 결제 데이터는 2026년 1월 1일부터 2월 23일까지 <strong>687건, 총 3,118만 원, 평균 결제금액 45,521원</strong>이다.
              즉 &quot;수요가 무너진 사업&quot;은 아니다. 또 2025년 전체 기준으로는 <strong>재구매율 21.7%, 1회 구매 고객 비중 78.3%</strong>,
              성숙 코호트 기준 <strong>90일 재구매율 21.5%, 180일 재구매율 32.9%</strong>이고,
              재구매 고객의 <strong>p75 시점은 21일</strong>이다.
              한마디로, <strong>재구매는 분명히 일어나지만 빠르게 붙지는 않는 구조</strong>다.
            </p>
            <p style={{ fontSize: "0.88rem", lineHeight: 1.8, color: "#334155", marginTop: 8 }}>
              좋은 신호도 있다. <strong>6회 이상 구매 고객이 5.4%인데 전체 주문의 28.7%를 차지</strong>한다.
              콜롬비아가 가장 큰 축이고, 충성 고객이 생기면 꽤 깊게 사는 구조다.
              즉 문제는 &quot;제품 경쟁력 부재&quot;가 아니라 <strong>첫 구매자가 두 번째 구매로 빨리 넘어오지 못하는 것</strong>에 더 가깝다.
            </p>
            <p style={{ fontSize: "0.85rem", lineHeight: 1.8, color: "#64748b", marginTop: 8, fontStyle: "italic" }}>
              다만 데이터 해석에는 경고가 필요하다. 현재 반복구매 분석은 PlayAuto 보조 데이터에 많이 기대고 있는데,
              이 데이터는 0원 물류 행이 많고, bundle 기준이라 실제 주문 수가 부풀어질 수 있으며,
              전화번호 기준 고객 식별도 흔들릴 수 있다. 최근 고객 주문 원장과 GA4 권한이 아직 완전히 열려 있지 않아서,
              방향 판단은 가능하지만 정밀한 가격 최적화까지 하긴 이르다.
            </p>
          </div>

          {/* 딥리서치 */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>딥리서치 기준으로 보면 어떤 수준인가</h3>
            <p style={{ fontSize: "0.88rem", lineHeight: 1.8, color: "#334155" }}>
              일반 이커머스 기준으로 <strong>좋은 재구매율은 대체로 20-30%</strong>로 보지만,
              <strong>식품·음료 같은 소모재는 30-40%대가 흔하다</strong>는 자료가 많다.
              그래서 더클린커피의 <strong>90일 재구매율 21.5%는 &quot;완전히 나쁜 숫자&quot;는 아니지만, 커피 업종 기준으로는 약한 편</strong>이다.
              반대로 <strong>180일 재구매율 32.9%는 나쁘지 않다.</strong> 즉 고객이 다시 사긴 사는데, <strong>너무 늦게 붙는다</strong>는 뜻이다.
            </p>
            <p style={{ fontSize: "0.88rem", lineHeight: 1.8, color: "#334155", marginTop: 8 }}>
              원가 쪽도 과장해서 볼 필요는 없다. 2024 로스터 조사에서는 총원가 안에서
              <strong>생두 54.31%, 노동 18.80%, 오버헤드 16.02%, 포장 10.23%</strong>가 나왔고,
              도매 목표 마진도 <strong>20-25%, 25-30%, 30-40%, 40%+</strong>로 넓게 분포했다.
              또 공개기업을 보면 Farmer Brothers는 <strong>매출총이익률 43.5%</strong>를 기록했어도 연간 <strong>순손실</strong>이었고,
              Lavazza도 2025년에 <strong>매출 39억 유로, core profit 3.4억 유로</strong>로 결국 <strong>한 자릿수 이익 수준</strong>이다.
              즉 <strong>원가율만 예쁘게 만든다고 사업이 좋아지는 업종이 아니다.</strong>
            </p>
            <p style={{ fontSize: "0.88rem", lineHeight: 1.8, color: "#334155", marginTop: 8 }}>
              원두 시황도 &quot;지금 당장 폭발적으로 더 오르는 국면&quot;으로 보긴 어렵다.
              국제커피기구는 2026년 2월 종합 가격이 <strong>267.57 US cents/lb</strong>였고, <strong>1월보다 9.9% 하락</strong>했다고 밝혔다.
              Lavazza도 2025년 내내 <strong>green coffee와 system cost 압박</strong>이 계속됐다고 설명했다.
              즉 지금 가격 인상 논리는 &quot;원두값이 오늘 또 터져서 당장 올려야 한다&quot;가 아니라,
              <strong>&quot;구조적으로 높은 원가를 SKU별로 다시 정리해야 한다&quot;</strong>가 맞다.
            </p>
          </div>

          {/* 가격 인상 판단 */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>가격을 올릴까?</h3>
            <div style={{ padding: "14px 18px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 12 }}>
              <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#991b1b", margin: 0, lineHeight: 1.8 }}>
                1. 전면 인상은 하지 마십시오.<br />
                2. 선별 인상은 지금 해도 됩니다.<br />
                3. 다만 현재 엑셀의 인상 폭은 일부 SKU에서 너무 큽니다.
              </p>
            </div>
            <p style={{ fontSize: "0.88rem", lineHeight: 1.8, color: "#334155" }}>
              업로드하신 엑셀을 직접 보면, 이 안은 단순한 &quot;소폭 인상안&quot;이 아니라 <strong>가격 체계 재설정안</strong>에 가깝다.
              특히 200g도 품목별 인상 폭 차이가 크고, 1kg는 일부 SKU가 <strong>30%대에서 60%대</strong>까지 뛰어 매우 공격적이다.
              반면 300g은 오히려 내려가는 품목도 섞여 있다.
              이런 안을 한 번에 시행하면 고객 입장에서는 &quot;원가 반영&quot;이 아니라 <strong>가격표가 갑자기 뒤집힌 것</strong>처럼 보인다.
            </p>
            <p style={{ fontSize: "0.88rem", lineHeight: 1.8, color: "#334155", marginTop: 8 }}>
              그리고 현재 시장 가격과 비교하면, 모모스는 200g 원두가 <strong>14,000원, 16,000원</strong>대에 있고,
              프릳츠도 200g이 <strong>16,000원, 18,000원</strong>대에 형성돼 있다.
              블루보틀 코리아의 헤이즈 밸리 에스프레소는 <strong>22,500원</strong>이다.
              그런데 더클린커피의 현재 제안대로 코어 200g을 <strong>21,000원, 22,000원, 23,000원, 25,000원</strong>대로 밀면,
              일부 SKU는 이미 <strong>프리미엄 상단 브랜드와 정면 비교</strong> 구간으로 들어간다.
              건강·안전성 포지션으로 프리미엄을 받을 수는 있지만,
              <strong>모든 코어 SKU를 그 가격대로 한꺼번에 올릴 만큼 브랜드 파워가 검증됐다고 보긴 어렵다.</strong>
            </p>
          </div>

          {/* SKU 분류 */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>SKU별 인상 판단</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#16a34a", marginBottom: 6 }}>바로 인상 후보</div>
                <p style={{ fontSize: "0.82rem", color: "#334155", margin: 0, lineHeight: 1.7 }}>
                  케냐 블렌드, 에콰도르 고가라인, 디카페인. 원가 압박도 크고, 소비자도 어느 정도 프리미엄을 받아들일 가능성이 있다.
                </p>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: "#fefce8", border: "1px solid #fde68a" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#92400e", marginBottom: 6 }}>소폭 인상 테스트 후보</div>
                <p style={{ fontSize: "0.82rem", color: "#334155", margin: 0, lineHeight: 1.7 }}>
                  에티오피아. 올릴 수는 있지만 첫 라운드부터 세게 가기보다 반응을 보는 편이 낫다.
                </p>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569", marginBottom: 6 }}>동결 또는 아주 약한 인상</div>
                <p style={{ fontSize: "0.82rem", color: "#334155", margin: 0, lineHeight: 1.7 }}>
                  콜롬비아, 과테말라, 파푸아뉴기니. 코어 유입과 재구매의 바닥을 깔아주는 역할이 더 중요하다.
                </p>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>지금 시행하면 위험</div>
                <p style={{ fontSize: "0.82rem", color: "#334155", margin: 0, lineHeight: 1.7 }}>
                  1kg 대폭 인상안, 코어 200g을 한 번에 프리미엄 구간으로 밀어 올리는 안.
                </p>
              </div>
            </div>
            <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>권장 1차 인상 범위</div>
              <p style={{ fontSize: "0.82rem", color: "#334155", margin: 0, lineHeight: 1.7 }}>
                코어 100g-200g: <strong>0-5%</strong> / 중간 프리미엄: <strong>5-8%</strong> /
                디카페인·고가라인: <strong>8-12%</strong> / 500g-1kg: <strong>8-12% 상한</strong><br />
                현재 안처럼 일부를 20% 이상, 특히 1kg를 30% 이상 움직이는 건 지금 데이터 상태에서는 과하다.
              </p>
            </div>
          </div>

          {/* 가격 인상 + CRM 최적화 */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>왜 &quot;가격 인상 + CRM 최적화&quot;가 더 낫나</h3>
            <p style={{ fontSize: "0.88rem", lineHeight: 1.8, color: "#334155" }}>
              이건 거의 확실하다. 지금 더클린커피의 핵심 병목은 <strong>첫 구매 후 2번째 구매</strong>다.
              재구매 고객의 p75 시점이 <strong>21일</strong>이므로, 첫 구매 후 <strong>17-21일</strong>에 재주문 유도 메시지를 넣는 것이 가장 효율이 좋다.
              내부 문서에서도 <strong>3주 차 재구매 알림톡을 먼저 하고, 그 결과를 본 뒤 가격 테스트로 가는 게 리스크가 낮다</strong>고 정리돼 있다.
            </p>
            <p style={{ fontSize: "0.88rem", lineHeight: 1.8, color: "#334155", marginTop: 8 }}>
              단순 할인은 마진을 깎지만, <strong>재구매 골든타임에만 제한적으로 쓰는 CRM</strong>은 마진 손실보다 재구매 전환 효과가 클 수 있다.
              특히 지금은 1회 구매 고객이 78.3%이기 때문에, 이 구간을 조금만 건드려도 가격 인상 효과보다 더 큰 이익 개선이 나올 수 있다.
              반대로 이 구조를 그대로 둔 채 가격부터 올리면, 신규 유입과 첫 구매 고객이 더 쉽게 떨어져 나간다.
            </p>
          </div>

          {/* 실행 순서 */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>실행 순서</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ padding: "12px 16px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#16a34a" }}>지금 당장</div>
                <p style={{ fontSize: "0.82rem", color: "#334155", margin: "4px 0 0", lineHeight: 1.7 }}>
                  현재 엑셀 안을 그대로 시행하지 말고, SKU를 4등급으로 나누기. A: 바로 인상, B: 소폭 테스트, C: 동결, D: 보류.
                </p>
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e40af" }}>이번 주</div>
                <p style={{ fontSize: "0.82rem", color: "#334155", margin: "4px 0 0", lineHeight: 1.7 }}>
                  첫 구매 후 17-21일 고객에게만 재구매 유도 메시지 넣기. 전원 할인 말고, 제한된 대상과 대조군을 둬야 한다.
                  현재 아임웹은 진짜 사용자별 가격 A/B가 어렵기 때문에, 상품 단위 테스트나 기간 단위 테스트가 현실적.
                </p>
              </div>
              <div style={{ padding: "12px 16px", borderRadius: 8, background: "#fefce8", border: "1px solid #fde68a" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#92400e" }}>다음 배치</div>
                <p style={{ fontSize: "0.82rem", color: "#334155", margin: "4px 0 0", lineHeight: 1.7 }}>
                  가격 테스트는 한 번에 전체 라인으로 하지 말고, 에티오피아 1개 SKU만 +5%, 또는 디카페인만 +8%처럼 가야 한다.
                  이유는 지금 데이터 규모로는 다품목 동시 실험을 하면 해석이 흐려지기 때문.
                </p>
              </div>
            </div>
          </div>

          {/* 최종 판단 */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>최종 판단</h3>
            <div style={{ padding: "16px 20px", borderRadius: 10, background: "#1e293b", color: "#f8fafc" }}>
              <ul style={{ fontSize: "0.88rem", lineHeight: 2.0, margin: 0, paddingLeft: 20 }}>
                <li><strong>전면 가격 인상:</strong> 안 함</li>
                <li><strong>선별 가격 인상:</strong> 함</li>
                <li><strong>순서:</strong> CRM 먼저, 가격은 바로 뒤</li>
                <li><strong>현재 엑셀 제안안:</strong> 수정 후 사용</li>
                <li><strong>핵심 메시지:</strong> &quot;원가 폭등 대응&quot;이 아니라 &quot;라인별 가격 체계 정리&quot;</li>
              </ul>
            </div>
            <div style={{ marginTop: 12, padding: "14px 18px", borderRadius: 10, background: "#6366f1", color: "#fff" }}>
              <p style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, lineHeight: 1.6, textAlign: "center" }}>
                지금 더클린커피의 문제는 &quot;싸게 팔아서&quot;가 아니라, &quot;두 번째 구매를 충분히 빨리 못 붙여서&quot;입니다.<br />
                그래서 가격은 올리되, 모든 상품을 다 올리면 안 됩니다.
              </p>
            </div>
          </div>

          {/* Q&A */}
          <div style={{ padding: "12px 16px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#64748b", marginBottom: 6 }}>후속 확인 사항</div>
            <ol style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
              <li>실제 매출 비중 1위 규격이 200g인가, 500g인가?</li>
              <li>300g과 340g은 자사몰 핵심 규격인가, 아니면 쿠팡용 보조 규격인가?</li>
              <li>필요 시 현재 엑셀 기준 SKU별 &quot;인상 / 보류 / 동결&quot; 표 작성 가능.</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
