"use client";

import Link from "next/link";

const PHASES = [
  {
    phase: "Phase 0",
    title: "구조 고정 · 데이터 계약",
    status: "done" as const,
    items: ["customer_key 규칙 확정", "이벤트 명세서 · DB 스키마", "CRM 운영자 화면 IA", "lead/콘텐츠/정책 온톨로지"],
  },
  {
    phase: "Phase 1",
    title: "CRM 실험 원장 MVP",
    status: "done" as const,
    items: ["실험/배정/전환 테이블 (SQLite)", "lead profile/event/consent ledger", "PG attribution 원장 · 토스 조인 진단", "실험 KPI 화면 + variant 비교 차트"],
  },
  {
    phase: "Phase 2",
    title: "상담 원장 정규화 · 상담사 가치",
    status: "done" as const,
    items: ["상담 상태 표준화 · 전화번호 정규화", "상담사별 성과 · 충원 시뮬레이션", "상품 믹스 · 매출 분포 시각화", "후속 관리 대상 CRM 리스트"],
  },
  {
    phase: "Phase 3",
    title: "실행 채널 연동",
    status: "done" as const,
    items: ["ChannelTalk SDK 연동", "알리고 알림톡 백엔드 + 프론트", "수신자 화이트리스트 안전 장치", "카카오 승인 템플릿 37개 연동"],
  },
  {
    phase: "Phase 4",
    title: "재구매 코호트 · 북극성 지표",
    status: "progress" as const,
    items: ["코호트 재구매율/순매출 API", "월별 코호트 히트맵", "90일 재구매 순이익 추적", "실험 라벨 오버레이"],
  },
  {
    phase: "Phase 5",
    title: "Meta 광고 데이터 연동",
    status: "planned" as const,
    items: ["Meta Ads Insights 읽기", "캠페인/광고세트 성과 UI", "Meta Conversions API 서버사이드"],
  },
  {
    phase: "Phase 6",
    title: "카카오 CRM 실행 레이어",
    status: "planned" as const,
    items: ["카카오 고객파일 export", "발송 대상 미리보기 · 상태/실패 UI"],
  },
  {
    phase: "Phase 7",
    title: "1차 증분 실험 라이브",
    status: "planned" as const,
    items: ["실험 배정 · iROAS 계산", "대조군/실험군 비교 차트", "리커버리랩 방문 쿠폰 실험"],
  },
];

const AGENT_STAGES = [
  { icon: "👁", title: "감지", desc: "전환율 급락, 상담 대기 증가, 구매 지연 등 이상징후를 자동으로 탐지" },
  { icon: "🔍", title: "분해", desc: "리드 질 문제인지, 상담사 운영 문제인지, CRM 문제인지 원인을 분해" },
  { icon: "📊", title: "우선순위화", desc: "영향도 × 신뢰도 × 실행 난이도로 어디를 먼저 고칠지 판단" },
  { icon: "🎯", title: "액션 제안", desc: "CRM 메시지, 쿠폰 실험, 상담사 코칭 등 구체적 실행안을 제안" },
  { icon: "🧠", title: "학습", desc: "실험 결과를 학습하여 다음 제안의 정확도를 높임" },
];

const CURRENT_CAPABILITIES = [
  { label: "상담 원장", value: "8,305건", desc: "상태 표준화 · 전화번호 정규화 완료" },
  { label: "주문 매칭", value: "3,630명", desc: "상담-주문 자동 매칭 (전화번호 기반)" },
  { label: "실험 엔진", value: "A/B 실험", desc: "로컬 SQLite, treatment/control 비교" },
  { label: "알림톡", value: "37개 템플릿", desc: "알리고 API, 카카오 승인 완료" },
  { label: "채널톡", value: "SDK 연동", desc: "boot/track/setPage 자동 추적" },
  { label: "GA4 연동", value: "실시간", desc: "매출 KPI, 퍼널, 데이터 품질 진단" },
];

const statusColor = (s: string) =>
  s === "done" ? "#10b981" : s === "progress" ? "#6366f1" : "#94a3b8";
const statusLabel = (s: string) =>
  s === "done" ? "완료" : s === "progress" ? "진행 중" : "계획";

export default function SolutionPage() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      {/* 헤더 */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: "3rem", marginBottom: 8 }}>🧠</div>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
          Biocom Growth AI Agent
        </h1>
        <p style={{ fontSize: "1.1rem", color: "#64748b", maxWidth: 600, margin: "0 auto", lineHeight: 1.7 }}>
          분석에서 실행까지 연결하는 AI CRM.
          대시보드는 <strong>눈</strong>, AI Agent는 <strong>눈 + 두뇌 + 운영 제안 엔진</strong>.
        </p>
        <Link href="/" style={{ display: "inline-block", marginTop: 16, padding: "8px 20px", borderRadius: 8, background: "#6366f1", color: "#fff", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
          대시보드로 돌아가기
        </Link>
      </div>

      {/* ═══ AI-Native OS 프레임워크 ═══ */}
      <section style={{ marginBottom: 48 }}>
        <div style={{
          padding: "32px 28px", borderRadius: 20,
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)",
          color: "#f8fafc", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(99,102,241,0.15)" }} />
          <div style={{ position: "absolute", bottom: -40, left: -40, width: 150, height: 150, borderRadius: "50%", background: "rgba(16,185,129,0.1)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#a5b4fc", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>
              Growth Operating System
            </p>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 6, lineHeight: 1.4 }}>
              선형적 성장이 아닌, 기하급수적 성장을 위한
            </h2>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 20, lineHeight: 1.4, color: "#a5b4fc" }}>
              AI 네이티브 조직의 OS
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              {[
                {
                  step: "01",
                  keyword: "Unify",
                  title: "데이터 분석",
                  desc: "흩어진 주문/상담/CRM/광고/결제를 고객 단위로 통합. 같은 사람을 같은 사람으로 보는 정본 구축.",
                  color: "#818cf8",
                  accent: "통합 기반",
                },
                {
                  step: "02",
                  keyword: "Hypothesize",
                  title: "가설 수립",
                  desc: "에너지 준위가 높은 액션 플랜 도출. 여러 페르소나의 에이전트가 교차하며 임팩트 큰 기회를 식별.",
                  color: "#34d399",
                  accent: "교차 임팩트",
                },
                {
                  step: "03",
                  keyword: "Uncover",
                  title: "실행 및 검증",
                  desc: "본질에 포커스하는 증분 방식. \"보냈다\"가 아니라 \"보냈더니 원래 없던 매출이 생겼는가\"를 실험으로 판정.",
                  color: "#fbbf24",
                  accent: "증분 검증",
                },
                {
                  step: "04",
                  keyword: "Evolve",
                  title: "진화",
                  desc: "검증에서 진실로. Working 하는 시나리오를 AI Agent 피드백 루프를 태워 지속적으로 고도화.",
                  color: "#f87171",
                  accent: "피드백 루프",
                },
              ].map((item, i) => (
                <div key={item.step} style={{
                  padding: "20px 16px", borderRadius: 14,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  position: "relative",
                }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: item.color, letterSpacing: 1, marginBottom: 4 }}>
                    STEP {item.step}
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: item.color, marginBottom: 2 }}>
                    {item.keyword}
                  </div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: 8 }}>
                    {item.title}
                  </div>
                  <p style={{ fontSize: "0.73rem", lineHeight: 1.6, margin: 0, opacity: 0.8 }}>
                    {item.desc}
                  </p>
                  <div style={{
                    marginTop: 10, padding: "3px 8px", borderRadius: 4, display: "inline-block",
                    background: `${item.color}20`, fontSize: "0.65rem", fontWeight: 700, color: item.color,
                  }}>
                    {item.accent}
                  </div>
                  {i < 3 && (
                    <div style={{
                      position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)",
                      color: "rgba(255,255,255,0.3)", fontSize: "1.2rem", fontWeight: 700,
                    }}>→</div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, textAlign: "center" }}>
              <div style={{
                display: "inline-block", padding: "10px 24px", borderRadius: 10,
                background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)",
                fontSize: "0.85rem", fontWeight: 700,
              }}>
                Unify → Hypothesize → Uncover → Evolve = Exponential Growth OS
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Agent 5단계 */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>AI Agent 작동 구조</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {AGENT_STAGES.map((stage, i) => (
            <div key={stage.title} style={{
              padding: "20px 16px", borderRadius: 14, textAlign: "center",
              background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95))",
              border: "1px solid rgba(15,23,42,0.08)",
              position: "relative",
            }}>
              <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>{stage.icon}</div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", marginBottom: 4 }}>{stage.title}</div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.5 }}>{stage.desc}</div>
              {i < AGENT_STAGES.length - 1 && (
                <div style={{ position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)", color: "#cbd5e1", fontSize: "1.2rem" }}>→</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 현재 역량 */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>현재 구축된 역량</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {CURRENT_CAPABILITIES.map((cap) => (
            <div key={cap.label} style={{
              padding: "16px 20px", borderRadius: 12,
              background: "white", border: "1px solid rgba(15,23,42,0.08)",
            }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" as const }}>{cap.label}</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{cap.value}</div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 2 }}>{cap.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CRM 실행 채널 비교 */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>CRM 실행 채널 비교: 알리고 vs 채널톡</h2>
        <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.7, marginBottom: 16 }}>
          두 채널은 경쟁이 아니라 <strong>역할 분담</strong>이다. 알리고는 &quot;정해진 시점에 정해진 메시지를 확실하게 전달&quot;하는 채널이고,
          채널톡은 &quot;고객이 사이트에 있을 때 맥락에 맞춰 대화를 이어가는&quot; 채널이다.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569" }}>비교 항목</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#10a37f" }}>알리고 (카카오 알림톡)</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#6366f1" }}>채널톡</th>
              </tr>
            </thead>
            <tbody>
              {[
                { item: "메시지 유형", aligo: "카카오 알림톡 (승인 템플릿 기반)", channel: "인앱 메시지 + 푸시 + 이메일" },
                { item: "도달률", aligo: "카카오톡 수신 — 거의 100% 도달", channel: "사이트 방문 시에만 인앱 노출" },
                { item: "발송 조건", aligo: "카카오 심사 통과 템플릿만 가능", channel: "자유 형식, 심사 불필요" },
                { item: "주요 용도", aligo: "상담 후 후속 안내, 결과지 알림, 배송 안내, 재구매 넛지", channel: "실시간 상담, 사이트 내 행동 기반 팝업, 온보딩" },
                { item: "타이밍", aligo: "D+0, D+3, D+14 등 정해진 시점", channel: "사용자가 사이트에 있는 바로 그 순간" },
                { item: "개인화", aligo: "템플릿 변수(#{name}, #{product}) 치환", channel: "행동 이벤트 기반 세그먼트 + 캠페인" },
                { item: "비용 구조", aligo: "건당 과금 (알림톡 8~15원)", channel: "월정액 (MAU 기반)" },
                { item: "실험 적합성", aligo: "treatment/control 분리 발송에 적합", channel: "사이트 내 A/B 테스트에 적합" },
                { item: "현재 상태", aligo: "API 연동 완료, 승인 템플릿 37개, 잔여 38,000+건", channel: "SDK 래퍼 완료, Plugin Key 연동, 실사이트 배포 대기" },
                { item: "API 연동", aligo: "REST API (서버사이드 발송)", channel: "JS SDK (클라이언트) + Open API (서버)" },
              ].map((row, i) => (
                <tr key={row.item} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b" }}>{row.item}</td>
                  <td style={{ padding: "10px 14px", color: "#475569" }}>{row.aligo}</td>
                  <td style={{ padding: "10px 14px", color: "#475569" }}>{row.channel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(16,163,127,0.04)", border: "1px solid rgba(16,163,127,0.15)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#10a37f", marginBottom: 6 }}>알리고가 맞는 시나리오</div>
            <ul style={{ fontSize: "0.78rem", color: "#475569", lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
              <li>상담 완료 후 14일 미구매 → 영양제 추천 알림톡</li>
              <li>검체 수령 안내 · 결과지 발송 알림</li>
              <li>통관번호 미기재 고객 안내</li>
              <li>정기구독 갱신 리마인더</li>
              <li>CRM 실험: treatment 그룹에 메시지 발송</li>
            </ul>
          </div>
          <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.15)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#6366f1", marginBottom: 6 }}>채널톡이 맞는 시나리오</div>
            <ul style={{ fontSize: "0.78rem", color: "#475569", lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
              <li>상품 상세 페이지에서 3분 이상 체류 → 상담 유도 팝업</li>
              <li>장바구니 이탈 시 실시간 메시지</li>
              <li>리포트 페이지 진입 → 추천 영양제 안내</li>
              <li>신규 방문자 온보딩 가이드</li>
              <li>고객 문의 실시간 응대 · FAQ 봇</li>
            </ul>
          </div>
        </div>

        <div style={{
          marginTop: 16, padding: "14px 18px", borderRadius: 10,
          background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)",
          fontSize: "0.82rem", color: "#78350f", lineHeight: 1.7,
        }}>
          <strong>운영 전략</strong>: 알리고로 &quot;놓친 고객을 다시 잡고&quot;, 채널톡으로 &quot;지금 있는 고객을 잡는다&quot;.
          두 채널의 실험 결과를 같은 원장(crm_experiment)에 기록하여, 어떤 채널이 어떤 시나리오에서 더 효과적인지 증분(incremental) 기준으로 비교한다.
        </div>
      </section>

      {/* 로드맵 */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>개발 로드맵</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {PHASES.map((p) => (
            <div key={p.phase} style={{
              padding: "16px 20px", borderRadius: 12,
              background: "white", border: "1px solid rgba(15,23,42,0.08)",
              borderLeft: `4px solid ${statusColor(p.status)}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: statusColor(p.status) }}>{p.phase}</span>
                  <span style={{ marginLeft: 8, fontWeight: 600, color: "#1e293b" }}>{p.title}</span>
                </div>
                <span style={{
                  fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                  background: `${statusColor(p.status)}20`, color: statusColor(p.status),
                }}>
                  {statusLabel(p.status)}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {p.items.map((item) => (
                  <span key={item} style={{
                    fontSize: "0.72rem", padding: "3px 8px", borderRadius: 6,
                    background: p.status === "done" ? "#f0fdf4" : p.status === "progress" ? "#eef2ff" : "#f8fafc",
                    color: p.status === "done" ? "#16a34a" : p.status === "progress" ? "#4338ca" : "#94a3b8",
                    border: `1px solid ${p.status === "done" ? "#bbf7d0" : p.status === "progress" ? "#c7d2fe" : "#e2e8f0"}`,
                  }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ 프로젝트 소개 ═══ */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginBottom: 20, borderBottom: "3px solid #6366f1", paddingBottom: 10 }}>
          프로젝트 소개
        </h2>

        {/* 의도와 목적 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ padding: "20px 24px", borderRadius: 14, background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 8 }}>의도</h3>
            <p style={{ fontSize: "0.85rem", lineHeight: 1.8, margin: 0, opacity: 0.95 }}>
              바이오컴의 주문/상담/CRM/광고/결제를 각각 따로 보는 방식에서 벗어나,
              고객 단위로 행동과 결과를 연결해 <strong>실험 가능한 운영체계</strong>를 만드는 것.
              결국 &quot;누구에게 무엇을 했더니, 실제로 얼마의 순증분 가치가 생겼는가&quot;를 답할 수 있게 만드는 것.
            </p>
          </div>
          <div style={{ padding: "20px 24px", borderRadius: 14, background: "#0f172a", color: "#f8fafc" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 8 }}>목적</h3>
            <p style={{ fontSize: "0.85rem", lineHeight: 1.8, margin: 0, opacity: 0.95 }}>
              대시보드를 예쁘게 만드는 게 아니라,<br />
              <strong>1.</strong> 증분 효과를 판정하고,<br />
              <strong>2.</strong> 그 판정 결과를 다시 운영 액션에 연결하고,<br />
              <strong>3.</strong> 그 반복을 회사의 기본 운영 방식으로 만드는 것.<br />
              북극성 지표는 <strong>90일 재구매 순이익</strong>, 팀 OMTM은 <strong>Incremental Gross Profit</strong>.
            </p>
          </div>
        </div>

        {/* 운영 OS란 */}
        <div style={{ padding: "20px 24px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 24 }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
            &quot;증분 실험이 가능한 AI-native 운영 OS&quot;란?
          </h3>
          <p style={{ fontSize: "0.85rem", lineHeight: 1.8, color: "#334155", marginBottom: 12 }}>
            AI가 똑똑하게 조언만 하는 조직이 아니라, 고객 단위 행동과 결과가 기록되고,
            그 기록 위에서 실험하고, 그 결과를 다시 운영에 반영하는 <strong>조직 운영체계</strong>.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { n: "1", title: "같은 사람으로 인식", desc: "customer_key로 상담 DB, 주문 DB, 채널톡, 광고 클릭 ID를 하나의 고객으로 연결" },
              { n: "2", title: "순서대로 기록", desc: "실험 배정 → 메시지 발송 → 구매 → 환불을 시간 순서대로 원장에 남김" },
              { n: "3", title: "실행과 판정 분리", desc: "실행은 ChannelTalk/Aligo, 판정은 내부 DB. 채널 도구의 내장 통계에 의존하지 않음" },
              { n: "4", title: "AI가 읽고 행동", desc: "AI가 상태를 읽고, 초안을 만들고, 정책을 체크하고, 결과를 학습하는 구조" },
            ].map((item) => (
              <div key={item.n} style={{ padding: "12px 16px", borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700 }}>{item.n}</span>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b" }}>{item.title}</span>
                </div>
                <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 증분 실험이란 */}
        <div style={{ padding: "20px 24px", borderRadius: 14, background: "#fefce8", border: "1px solid #fde68a", marginBottom: 24 }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#78350f", marginBottom: 12 }}>증분 실험이 왜 중요한가</h3>
          <p style={{ fontSize: "0.85rem", lineHeight: 1.8, color: "#334155", marginBottom: 12 }}>
            &quot;이 메시지 때문에 원래 없던 매출이 추가로 생겼는가?&quot;를 보는 실험.
            그냥 메시지 보낸 뒤 매출이 나온 걸 보는 건 거의 의미가 없다 — 원래도 살 사람이 많기 때문.
          </p>
          <div style={{ padding: "14px 18px", borderRadius: 10, background: "#fff", border: "1px solid #fde68a", marginBottom: 12 }}>
            <p style={{ fontSize: "0.82rem", color: "#334155", margin: 0, lineHeight: 1.8 }}>
              <strong>예시:</strong> 체크아웃 이탈 고객 1,000명 중<br />
              500명은 메시지 없음 → 50명 구매<br />
              500명은 리마인드 → 70명 구매<br />
              <strong>증분 = 20명</strong> (메시지 때문에 추가로 늘어난 구매)
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { title: "원래 살 사람 구분", desc: "holdout + assignment-first로 착시를 방지" },
              { title: "도구 숫자 ≠ 인과", desc: "클릭률이 높아도 순증분 매출이 없을 수 있음" },
              { title: "AI 학습 피드백", desc: "실험 결과가 없으면 AI는 자동화된 감상평 시스템" },
            ].map((item) => (
              <div key={item.title} style={{ padding: "10px 12px", borderRadius: 8, background: "#fffbeb" }}>
                <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "#92400e", marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: "0.72rem", color: "#78350f", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 페르소나별 베네핏 */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>사용자별 베네핏</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { role: "대표 (TJ)", desc: "감이 아닌 숫자로 판단. 북극성 지표와 증분 실험이 대표의 판단 언어가 됨. \"상담사를 더 뽑아야 하나?\", \"CRM 메시지가 매출을 만들었나?\"에 답할 수 있음.", color: "#6366f1" },
              { role: "운영팀 / CRM 담당자", desc: "/crm 안에서 후속관리, 발송, 실험, 결제 추적, 코호트까지 한 흐름. \"도구를 옮겨 다니는 운영\"에서 \"한 허브에서 판단하고 실행하는 운영\"으로.", color: "#10b981" },
              { role: "상담 팀장 / 상담사", desc: "상담 완료 후 미구매, 부재/변경 고객, 분석유형별 성과를 보고 누구를 다시 잡아야 하는지 명확히.", color: "#f59e0b" },
              { role: "마케터", desc: "발송 수가 아닌 상담 예약률, 첫 구매율, 90일 가치, 실험 uplift로 평가. 리드 마그넷도 \"콘텐츠\"가 아니라 \"lead asset\".", color: "#ef4444" },
              { role: "개발 / 데이터 / AI 운영팀", desc: "lead, customer, claim, policy를 같은 이름으로 부르고, 이벤트/원장/정책이 고정되면 AI 자동화가 안전. \"AI가 헛소리하지 않게 하는 기반\".", color: "#8b5cf6" },
            ].map((p) => (
              <div key={p.role} style={{ padding: "14px 18px", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
                  <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b" }}>{p.role}</span>
                </div>
                <p style={{ fontSize: "0.78rem", color: "#475569", margin: 0, lineHeight: 1.7 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI 네이티브 조직 */}
        <div style={{ padding: "20px 24px", borderRadius: 14, background: "#0f172a", color: "#f8fafc", marginBottom: 24 }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 12 }}>AI 네이티브 조직에서의 역할</h3>
          <p style={{ fontSize: "0.85rem", lineHeight: 1.8, opacity: 0.9, marginBottom: 12 }}>
            AI 네이티브 조직이 되려면 AI가 똑똑한 답변을 하는 것만으로는 부족하고,
            읽을 수 있는 정본 데이터, 행동 가능한 정책, 감사 가능한 로그, 실험으로 검증되는 피드백 루프가 있어야 한다.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { icon: "📖", label: "공용 언어", desc: "AI가 현재 고객 상태를 읽을 수 있게 하는 정본 데이터" },
              { icon: "🛡️", label: "정책 레이어", desc: "AI가 안전하게 draft/추천/제한적 실행을 하게 하는 규칙" },
              { icon: "🔬", label: "실험/원장 레이어", desc: "AI가 결과를 학습하게 하는 피드백 루프" },
              { icon: "📊", label: "운영 정본", desc: "사람과 AI가 같은 숫자를 보게 하는 단일 소스" },
            ].map((item) => (
              <div key={item.label} style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: "1.1rem", marginBottom: 2 }}>{item.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: "0.72rem", opacity: 0.8, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.85rem", fontWeight: 600, marginTop: 14, marginBottom: 0, textAlign: "center", opacity: 0.95 }}>
            이건 &quot;AI를 붙이는 부속 기능&quot;이 아니라, AI가 실제 운영자가 되기 위한 바닥 운영체계.
          </p>
        </div>

        {/* 핵심 주요 기능 */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>핵심 기능 아키텍처</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { layer: "Identity / Ontology", desc: "customer_key, lead/customer/policy/claim 정의를 고정하는 층", color: "#6366f1" },
              { layer: "Experiment Ledger", desc: "assignment-first, holdout 포함 실험 장부", color: "#8b5cf6" },
              { layer: "Attribution / Payment", desc: "checkout → payment success → Toss join → PG fee 진단", color: "#a855f7" },
              { layer: "Consultation Intelligence", desc: "상담 원장 정규화와 상담사 가치/후속관리 분석", color: "#10b981" },
              { layer: "CRM Operations Hub", desc: "/crm에서 대상 선정, 발송, 실험, 추적, 코호트를 관리", color: "#14b8a6" },
              { layer: "Execution Layer", desc: "ChannelTalk/Aligo를 통한 실제 메시지 실행", color: "#f59e0b" },
              { layer: "North-Star Analytics", desc: "90일 재구매 가치와 코호트 분석", color: "#ef4444" },
              { layer: "Lead Asset Layer", desc: "리드 마그넷/퀴즈 기반 프리-구매 리드 자산화", color: "#ec4899" },
              { layer: "AI Readiness / Governance", desc: "contact policy, run log, 가설 생성과 검증 분리", color: "#0f172a" },
            ].map((item) => (
              <div key={item.layer} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 8, background: "#fff", border: "1px solid #f1f5f9" }}>
                <span style={{ width: 6, height: 32, borderRadius: 3, background: item.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b" }}>{item.layer}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 비전 */}
      <section style={{
        padding: "24px 28px", borderRadius: 14,
        background: "linear-gradient(135deg, rgba(99,102,241,0.05), rgba(16,185,129,0.05))",
        border: "1px solid rgba(99,102,241,0.15)",
        marginBottom: 32,
      }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>최종 비전</h3>
        <p style={{ fontSize: "0.85rem", color: "#475569", lineHeight: 1.8, margin: 0 }}>
          단발성 분석 대시보드가 아니라, <strong>통합적이고 지속적으로 기회를 찾고 액션을 제안하는 그로스 AI Agent</strong>.
          상담 원장, 주문 원장, LTR 코호트, 상담사 성과, 영양제 구매 시점, 구독 전환 흐름이 이미 학습 재료로 축적되어 있다.
          여기에 고객 타임라인, 상담 대기 로그, 쿠폰 정체성, 전환 임계점 룩업, 세그먼트 진입/이탈 감시가 추가되면
          — 분석 대시보드에서 <strong>지속형 그로스 AI Agent</strong>로 진화한다.
        </p>
      </section>

      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <Link href="/" style={{ color: "#6366f1", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
          ← 대시보드로 돌아가기
        </Link>
      </div>
    </div>
  );
}
