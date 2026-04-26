"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AIBIO_ATTRIBUTION_KEYS,
  type AibioAttributionSnapshot,
  type AibioLeadDraft,
  type AibioLeadDraftReceipt,
} from "@/lib/aibio-native";

const KAKAO_CHAT_URL = "https://pf.kakao.com/_jRxcPK/chat";
const HERO_IMAGE = "https://cdn.imweb.me/thumbnail/20250124/e96dc62d45b13.jpg";
const PROGRAM_IMAGE = "https://cdn.imweb.me/thumbnail/20250124/340d5a869a6b2.jpg";
const RESULT_IMAGE = "https://cdn.imweb.me/thumbnail/20250124/1312356faa028.jpg";

const PROGRAMS = [
  {
    title: "대사 & 붓기 케어",
    body: "체성분, 생활 패턴, 회복 상태를 함께 보고 첫 방문 상담에서 관리 방향을 정합니다.",
    tag: "대표 랜딩",
  },
  {
    title: "대사 & 식욕 조절",
    body: "식욕, 스트레스, 수면 리듬처럼 체중 관리에 영향을 주는 신호를 상담 기준으로 정리합니다.",
    tag: "광고 핵심",
  },
  {
    title: "바이오펄스 & 리커버리",
    body: "센터 장비 이용과 상담 기록을 연결해 재방문과 패키지 상담으로 이어지게 설계합니다.",
    tag: "방문 전환",
  },
];

const FLOW = [
  ["01", "상담 신청", "이름, 연락처, 관심 목적을 남깁니다."],
  ["02", "상담 연결", "운영팀이 연락 상태와 예약 가능 시간을 기록합니다."],
  ["03", "방문 예약", "방문 예정일과 담당자를 한 장부로 관리합니다."],
  ["04", "체험/결제", "예약금 또는 체험권 결제로 매출 귀속을 닫습니다."],
];

const TRAFFIC_SOURCES = [
  { label: "Instagram", value: "1,050", tone: "blue" },
  { label: "Facebook", value: "661", tone: "navy" },
  { label: "Direct", value: "753", tone: "green" },
  { label: "Naver", value: "202+", tone: "mint" },
];

const initialLead: AibioLeadDraft = {
  name: "",
  phone: "",
  ageRange: "",
  purpose: "metabolism",
  channel: "",
  preferredTime: "",
  consent: false,
};

function readCookie(name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function safeReadJson(key: string): AibioAttributionSnapshot {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as AibioAttributionSnapshot) : {};
  } catch {
    return {};
  }
}

function collectAttribution(): AibioAttributionSnapshot {
  const params = new URLSearchParams(window.location.search);
  const snapshot: AibioAttributionSnapshot = {
    landing_path: window.location.pathname,
    referrer: document.referrer || "",
    fbc: readCookie("_fbc"),
    fbp: readCookie("_fbp"),
    ga_client_id: readCookie("_ga"),
  };

  for (const key of AIBIO_ATTRIBUTION_KEYS) {
    const value = params.get(key);
    if (value) snapshot[key] = value;
  }

  return Object.fromEntries(Object.entries(snapshot).filter(([, value]) => value));
}

function collectAndPersistAttribution(): AibioAttributionSnapshot {
  const latest = collectAttribution();
  const first = safeReadJson("_aibio_native_first_touch");
  const firstTouch = Object.keys(first).length > 0 ? first : { ...latest, capturedAt: new Date().toISOString() };
  const lastTouch = { ...latest, capturedAt: new Date().toISOString() };

  try {
    window.localStorage.setItem("_aibio_native_first_touch", JSON.stringify(firstTouch));
    window.localStorage.setItem("_aibio_native_last_touch", JSON.stringify(lastTouch));
  } catch {
    // Attribution capture failure must not block the MVP page.
  }

  return { ...firstTouch, ...lastTouch };
}

export function AibioNativeExperience() {
  const [lead, setLead] = useState<AibioLeadDraft>(initialLead);
  const [status, setStatus] = useState<"idle" | "submitting" | "ready" | "blocked" | "failed">("idle");
  const [receipt, setReceipt] = useState<AibioLeadDraftReceipt | null>(null);

  const filledRequiredCount = useMemo(() => {
    return [lead.name, lead.phone, lead.ageRange, lead.purpose, lead.channel, lead.preferredTime].filter(Boolean).length;
  }, [lead]);

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lead.name || !lead.phone || !lead.ageRange || !lead.purpose || !lead.channel || !lead.preferredTime || !lead.consent) {
      setStatus("blocked");
      return;
    }

    try {
      setStatus("submitting");
      const attribution = collectAndPersistAttribution();
      const response = await fetch("/api/aibio-native/lead-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...lead,
          landingPath: window.location.pathname,
          attribution,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) {
        setStatus("blocked");
        return;
      }
      const nextReceipt = {
        leadId: String(body.leadId),
        receivedAt: String(body.receivedAt),
        nextStatus: String(body.nextStatus),
        attributionKeys: Array.isArray(body.attributionKeys) ? body.attributionKeys.map(String) : [],
      };
      setReceipt(nextReceipt);
      window.localStorage.setItem(
        "aibio-native-lead-draft",
        JSON.stringify({
          ...nextReceipt,
          source: "aibio_native_mvp",
          mode: "dry_run_no_persistence",
        }),
      );
      setLead(initialLead);
      setStatus("ready");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <main className="aibio-native">
      <header className="site-header" aria-label="AIBIO 자체 홈페이지 MVP">
        <a className="brand" href="#top" aria-label="AIBIO Recovery Lab">
          <span className="brand-mark">AIBIO</span>
          <span className="brand-name">Recovery Lab</span>
        </a>
        <nav className="nav-links" aria-label="주요 메뉴">
          <a href="#programs">프로그램</a>
          <a href="#flow">예약 흐름</a>
          <a href="#insight">유입 분석</a>
          <a href="#lead">상담 신청</a>
        </nav>
        <a className="header-cta" href={KAKAO_CHAT_URL} target="_blank" rel="noreferrer">
          카카오 상담
        </a>
      </header>

      <section id="top" className="hero" aria-label="AIBIO Recovery Lab 소개">
        <div className="hero-copy">
          <p className="eyebrow">AIBIO Recovery Lab Native MVP</p>
          <h1>상담 예약부터 방문 전환까지 한 번에 보는 자체 홈페이지</h1>
          <p className="hero-text">
            아임웹 전체를 복제하지 않고, AIBIO 센터 운영에 필요한 랜딩, 입력폼, 리드 원장, 유입 분석, 체험권 결제 전 단계를 먼저 만듭니다.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#lead">상담 신청하기</a>
            <a className="secondary-action" href="#programs">프로그램 보기</a>
          </div>
        </div>
        <div className="hero-meter" aria-label="MVP 구현 범위">
          <span>구현 범위</span>
          <strong>랜딩 · 폼 · 리드 · 통계</strong>
        </div>
      </section>

      <section className="quick-strip" aria-label="AIBIO MVP 핵심 지표">
        <div>
          <span>현재 운영 핵심</span>
          <strong>입력폼 참여</strong>
        </div>
        <div>
          <span>우선 복제</span>
          <strong>상담예약 UX</strong>
        </div>
        <div>
          <span>결제 검증</span>
          <strong>예약금/체험권 1개</strong>
        </div>
        <div>
          <span>관리자 대체</span>
          <strong>리드 상태 장부</strong>
        </div>
      </section>

      <section id="programs" className="section two-column">
        <div className="section-copy">
          <p className="eyebrow">Program IA</p>
          <h2>아임웹 메뉴는 유지하되, 운영 목적에 맞게 다시 묶습니다.</h2>
          <p>
            첨부된 디자인 모드 기준 메뉴는 대사&붓기케어, 대사&식욕조절, 변화 후기, 기기 설명, 바이오해킹 소개입니다.
            자체 개발에서는 이 메뉴를 상담 예약과 방문 전환에 맞춰 재구성합니다.
          </p>
        </div>
        <div className="visual-panel program-visual" role="img" aria-label="AIBIO 프로그램 랜딩 이미지" />
      </section>

      <section className="program-grid" aria-label="프로그램 후보">
        {PROGRAMS.map((program) => (
          <article className="program-item" key={program.title}>
            <span>{program.tag}</span>
            <h3>{program.title}</h3>
            <p>{program.body}</p>
          </article>
        ))}
      </section>

      <section id="flow" className="section">
        <div className="section-heading">
          <p className="eyebrow">Lead Ledger</p>
          <h2>폼 제출에서 결제까지 끊기지 않는 장부가 필요합니다.</h2>
          <p>
            현재 아임웹 화면에서 가장 의미 있는 반응은 상품 문의가 아니라 입력폼 참여입니다.
            자체 홈페이지는 처음부터 리드 상태와 방문 결과를 남기는 구조로 갑니다.
          </p>
        </div>
        <div className="flow-grid">
          {FLOW.map(([step, title, body]) => (
            <article className="flow-item" key={step}>
              <span>{step}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="insight" className="section insight-section">
        <div className="insight-copy">
          <p className="eyebrow">Traffic Replacement</p>
          <h2>아임웹 통계 중 필요한 것만 자체 대시보드로 가져옵니다.</h2>
          <p>
            2026-03-28~2026-04-26 첨부 화면 기준 주요 유입은 Instagram, Facebook, Direct, Naver, Google입니다.
            자체 사이트는 GA4와 서버 이벤트로 인기 페이지와 폼 전환을 같이 봅니다.
          </p>
        </div>
        <div className="traffic-list" aria-label="주요 유입 소스">
          {TRAFFIC_SOURCES.map((source) => (
            <div className={`traffic-row ${source.tone}`} key={source.label}>
              <span>{source.label}</span>
              <strong>{source.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section two-column result-section">
        <div className="visual-panel result-visual" role="img" aria-label="AIBIO 변화 후기 랜딩 이미지" />
        <div className="section-copy">
          <p className="eyebrow">Offer MVP</p>
          <h2>쿠폰 엔진 전체 대신 첫방문 혜택 1개부터 검증합니다.</h2>
          <p>
            첨부된 쿠폰 화면에는 첫방문 AIBIKE 1회 무료 성격의 혜택이 확인됩니다.
            자체 개발 1차 범위는 쿠폰/포인트 전체가 아니라 오퍼 코드와 상담 메모 연결입니다.
          </p>
          <div className="offer-box">
            <span>오퍼 후보</span>
            <strong>첫방문 리커버리 체험 상담</strong>
            <p>상담 신청 후 운영자가 사용 여부를 기록하는 방식으로 시작합니다.</p>
          </div>
        </div>
      </section>

      <section id="lead" className="lead-section" aria-label="상담 신청 폼">
        <div className="lead-copy">
          <p className="eyebrow">Native Lead Form</p>
          <h2>운영 DB 연결 전, 로컬 MVP 폼으로 UX와 필드부터 고정합니다.</h2>
          <p>
            이 화면의 제출은 운영 서버나 광고 플랫폼으로 전송하지 않습니다. 필수 필드와 동의 UX를 검증하기 위해 브라우저 로컬 저장소에만 임시 저장합니다.
          </p>
          <div className="field-progress">
            <span>필수 입력 {filledRequiredCount}/6</span>
            <div><i style={{ width: `${(filledRequiredCount / 6) * 100}%` }} /></div>
          </div>
          <div className="attribution-preview" aria-label="수집된 유입 키">
            <span>수집된 유입 키</span>
            <strong>{receipt ? `${receipt.attributionKeys.length}개` : "제출 시"}</strong>
          </div>
        </div>

        <form className="lead-form" onSubmit={submitLead}>
          <label>
            이름
            <input
              value={lead.name}
              onChange={(event) => setLead({ ...lead, name: event.target.value })}
              placeholder="성함"
              autoComplete="name"
            />
          </label>
          <label>
            연락처
            <input
              value={lead.phone}
              onChange={(event) => setLead({ ...lead, phone: event.target.value })}
              placeholder="010-0000-0000"
              autoComplete="tel"
              inputMode="tel"
            />
          </label>
          <label>
            나이대
            <select value={lead.ageRange} onChange={(event) => setLead({ ...lead, ageRange: event.target.value })}>
              <option value="">선택</option>
              <option value="20s">20대</option>
              <option value="30s">30대</option>
              <option value="40s">40대</option>
              <option value="50s">50대 이상</option>
            </select>
          </label>
          <label>
            상담 목적
            <select value={lead.purpose} onChange={(event) => setLead({ ...lead, purpose: event.target.value })}>
              <option value="metabolism">대사/붓기 관리</option>
              <option value="appetite">식욕 조절</option>
              <option value="recovery">회복/컨디션</option>
              <option value="program">프로그램 상담</option>
            </select>
          </label>
          <label>
            알게 된 경로
            <select value={lead.channel} onChange={(event) => setLead({ ...lead, channel: event.target.value })}>
              <option value="">선택</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="naver">Naver</option>
              <option value="google">Google</option>
              <option value="referral">지인 소개</option>
            </select>
          </label>
          <label>
            연락 희망 시간
            <select value={lead.preferredTime} onChange={(event) => setLead({ ...lead, preferredTime: event.target.value })}>
              <option value="">선택</option>
              <option value="morning">오전</option>
              <option value="afternoon">오후</option>
              <option value="evening">저녁</option>
            </select>
          </label>
          <label className="consent">
            <input
              type="checkbox"
              checked={lead.consent}
              onChange={(event) => setLead({ ...lead, consent: event.target.checked })}
            />
            개인정보 수집 및 상담 연락에 동의합니다.
          </label>
          <button type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "검증 중" : "상담 신청 임시 저장"}
          </button>
          {status === "blocked" && <p className="form-message error">필수 항목과 동의를 확인해 주세요.</p>}
          {status === "failed" && <p className="form-message error">로컬 API 검증에 실패했습니다. 서버 상태를 확인해야 합니다.</p>}
          {status === "ready" && (
            <p className="form-message success">
              원문 연락처 저장 없이 접수 초안이 만들어졌습니다. 접수번호: {receipt?.leadId}
              {receipt && receipt.attributionKeys.length > 0 ? ` · 유입 키 ${receipt.attributionKeys.length}개 확인` : ""}
            </p>
          )}
        </form>
      </section>

      <footer className="site-footer">
        <span>Prototype route: /aibio-native</span>
        <span>운영 반영 전 검증용</span>
      </footer>

      <style jsx>{`
        .aibio-native {
          min-height: 100vh;
          color: #14213d;
          background: #f6f8ff;
          font-family: var(--font-sans), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .site-header {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          min-height: 72px;
          padding: 0 48px;
          background: rgba(255, 255, 255, 0.92);
          border-bottom: 1px solid rgba(38, 73, 139, 0.14);
          backdrop-filter: blur(16px);
        }

        .brand {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          min-width: 188px;
          font-weight: 800;
          letter-spacing: 0;
        }

        .brand-mark {
          color: #3758d4;
          font-size: 1.1rem;
        }

        .brand-name {
          color: #172554;
          font-size: 0.9rem;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 24px;
          color: #334155;
          font-size: 0.88rem;
          font-weight: 700;
        }

        .nav-links a,
        .header-cta,
        .primary-action,
        .secondary-action {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }

        .header-cta,
        .primary-action {
          padding: 0 18px;
          border-radius: 6px;
          color: #ffffff;
          background: #3758d4;
          font-weight: 800;
        }

        .secondary-action {
          padding: 0 18px;
          border-radius: 6px;
          color: #172554;
          background: #ffffff;
          border: 1px solid rgba(23, 37, 84, 0.18);
          font-weight: 800;
        }

        .hero {
          position: relative;
          min-height: 640px;
          display: flex;
          align-items: center;
          padding: 86px 56px;
          background-image:
            linear-gradient(90deg, rgba(6, 18, 63, 0.96) 0%, rgba(6, 18, 63, 0.84) 42%, rgba(6, 18, 63, 0.08) 74%),
            url("${HERO_IMAGE}");
          background-size: cover;
          background-position: right center;
          overflow: hidden;
        }

        .hero-copy {
          width: min(620px, 100%);
          color: #ffffff;
        }

        .eyebrow {
          margin-bottom: 14px;
          color: #42b5ff;
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        h1,
        h2,
        h3,
        p {
          letter-spacing: 0;
        }

        h1 {
          max-width: 620px;
          margin: 0 0 22px;
          font-size: 3rem;
          line-height: 1.16;
          font-weight: 900;
        }

        .hero-text {
          max-width: 560px;
          margin: 0;
          color: rgba(255, 255, 255, 0.86);
          font-size: 1.05rem;
          line-height: 1.75;
          font-weight: 600;
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 30px;
        }

        .hero-meter {
          position: absolute;
          right: 48px;
          bottom: 38px;
          width: 300px;
          min-height: 86px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
          padding: 18px 20px;
          border-radius: 8px;
          color: #172554;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.76);
        }

        .hero-meter span {
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .hero-meter strong {
          font-size: 1.05rem;
          line-height: 1.35;
        }

        .quick-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: rgba(30, 64, 175, 0.14);
          border-bottom: 1px solid rgba(30, 64, 175, 0.14);
        }

        .quick-strip div {
          min-height: 112px;
          padding: 26px 28px;
          background: #ffffff;
        }

        .quick-strip span {
          display: block;
          margin-bottom: 8px;
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .quick-strip strong {
          color: #172554;
          font-size: 1.1rem;
        }

        .section {
          padding: 86px 56px;
          background: #ffffff;
        }

        .two-column {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(360px, 1.08fr);
          gap: 48px;
          align-items: center;
        }

        .section-copy h2,
        .section-heading h2,
        .insight-copy h2,
        .lead-copy h2 {
          margin: 0 0 18px;
          color: #172554;
          font-size: 2rem;
          line-height: 1.28;
          font-weight: 900;
        }

        .section-copy p,
        .section-heading p,
        .insight-copy p,
        .lead-copy p,
        .program-item p,
        .flow-item p,
        .offer-box p {
          color: #475569;
          font-size: 0.98rem;
          line-height: 1.75;
          font-weight: 600;
        }

        .visual-panel {
          min-height: 330px;
          border-radius: 8px;
          background-size: cover;
          background-position: center;
          border: 1px solid rgba(37, 99, 235, 0.14);
        }

        .program-visual {
          background-image: url("${PROGRAM_IMAGE}");
          background-position: right center;
        }

        .result-visual {
          background-image: url("${RESULT_IMAGE}");
          background-position: right center;
          min-height: 380px;
        }

        .program-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          padding: 0 56px 86px;
          background: #ffffff;
        }

        .program-item,
        .flow-item {
          min-height: 210px;
          padding: 24px;
          border-radius: 8px;
          background: #f8fbff;
          border: 1px solid rgba(37, 99, 235, 0.12);
        }

        .program-item span,
        .flow-item span,
        .offer-box span {
          display: inline-flex;
          min-height: 28px;
          align-items: center;
          margin-bottom: 16px;
          padding: 0 10px;
          border-radius: 5px;
          color: #1d4ed8;
          background: #dbeafe;
          font-size: 0.72rem;
          font-weight: 900;
        }

        .program-item h3,
        .flow-item h3 {
          margin: 0 0 12px;
          color: #172554;
          font-size: 1.18rem;
          line-height: 1.34;
          font-weight: 900;
        }

        .section-heading {
          max-width: 760px;
          margin-bottom: 34px;
        }

        .flow-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .insight-section {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 440px);
          gap: 40px;
          align-items: start;
          background: #eef6ff;
        }

        .traffic-list {
          display: grid;
          gap: 10px;
        }

        .traffic-row {
          min-height: 58px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 0 18px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.08);
        }

        .traffic-row span {
          color: #334155;
          font-weight: 800;
        }

        .traffic-row strong {
          font-size: 1.1rem;
        }

        .traffic-row.blue strong { color: #2563eb; }
        .traffic-row.navy strong { color: #172554; }
        .traffic-row.green strong { color: #15803d; }
        .traffic-row.mint strong { color: #0f766e; }

        .result-section {
          background: #ffffff;
          grid-template-columns: minmax(360px, 1.08fr) minmax(0, 0.92fr);
        }

        .offer-box {
          margin-top: 24px;
          padding: 22px;
          border-radius: 8px;
          background: #f8fbff;
          border: 1px solid rgba(37, 99, 235, 0.12);
        }

        .offer-box strong {
          display: block;
          color: #172554;
          font-size: 1.1rem;
          line-height: 1.45;
        }

        .lead-section {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1.1fr);
          gap: 42px;
          align-items: start;
          padding: 86px 56px;
          background: #101a3f;
        }

        .lead-copy h2 {
          color: #ffffff;
        }

        .lead-copy p {
          color: rgba(255, 255, 255, 0.76);
        }

        .field-progress {
          margin-top: 28px;
          max-width: 420px;
        }

        .attribution-preview {
          max-width: 420px;
          min-height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 16px;
          padding: 14px 16px;
          border-radius: 8px;
          color: #dbeafe;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .attribution-preview span,
        .attribution-preview strong {
          font-size: 0.86rem;
          font-weight: 900;
        }

        .field-progress span {
          display: block;
          margin-bottom: 10px;
          color: #bfdbfe;
          font-size: 0.86rem;
          font-weight: 900;
        }

        .field-progress div {
          height: 10px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.16);
        }

        .field-progress i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #42b5ff;
        }

        .lead-form {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          padding: 24px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.7);
        }

        .lead-form label {
          display: grid;
          gap: 8px;
          color: #334155;
          font-size: 0.82rem;
          font-weight: 900;
        }

        .lead-form input,
        .lead-form select {
          width: 100%;
          min-height: 48px;
          padding: 0 12px;
          border: 1px solid rgba(15, 23, 42, 0.15);
          border-radius: 6px;
          color: #172554;
          background: #ffffff;
          font: inherit;
          font-weight: 700;
        }

        .lead-form input:focus,
        .lead-form select:focus {
          outline: 3px solid rgba(66, 181, 255, 0.26);
          border-color: #42b5ff;
        }

        .consent {
          grid-column: 1 / -1;
          display: flex !important;
          grid-template-columns: none !important;
          align-items: center;
          gap: 10px !important;
          min-height: 42px;
          color: #475569 !important;
          font-size: 0.86rem !important;
          font-weight: 800 !important;
        }

        .consent input {
          width: 18px;
          height: 18px;
          min-height: 18px;
        }

        .lead-form button {
          grid-column: 1 / -1;
          min-height: 52px;
          border: 0;
          border-radius: 6px;
          color: #ffffff;
          background: #3758d4;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
        }

        .lead-form button:disabled {
          cursor: wait;
          opacity: 0.72;
        }

        .form-message {
          grid-column: 1 / -1;
          margin: 0;
          padding: 12px 14px;
          border-radius: 6px;
          font-size: 0.86rem;
          font-weight: 800;
        }

        .form-message.error {
          color: #991b1b;
          background: #fee2e2;
        }

        .form-message.success {
          color: #065f46;
          background: #d1fae5;
        }

        .site-footer {
          min-height: 74px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 0 56px;
          color: #64748b;
          background: #ffffff;
          border-top: 1px solid rgba(15, 23, 42, 0.08);
          font-size: 0.82rem;
          font-weight: 800;
        }

        @media (max-width: 980px) {
          .site-header {
            padding: 0 22px;
          }

          .nav-links {
            display: none;
          }

          .hero {
            min-height: 620px;
            padding: 72px 24px 156px;
            background-position: center right;
          }

          h1 {
            font-size: 2.3rem;
          }

          .hero-meter {
            left: 24px;
            right: 24px;
            width: auto;
            bottom: 26px;
          }

          .quick-strip,
          .program-grid,
          .flow-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .two-column,
          .result-section,
          .insight-section,
          .lead-section {
            grid-template-columns: 1fr;
          }

          .section,
          .lead-section {
            padding: 64px 24px;
          }

          .program-grid {
            padding: 0 24px 64px;
          }

          .visual-panel {
            min-height: 280px;
          }
        }

        @media (max-width: 620px) {
          .site-header {
            min-height: 64px;
          }

          .brand {
            min-width: 0;
          }

          .brand-name {
            display: none;
          }

          .header-cta {
            min-height: 38px;
            padding: 0 12px;
            font-size: 0.82rem;
          }

          .hero {
            min-height: 640px;
            padding: 54px 18px 154px;
            background-image:
              linear-gradient(180deg, rgba(6, 18, 63, 0.9) 0%, rgba(6, 18, 63, 0.68) 48%, rgba(6, 18, 63, 0.26) 100%),
              url("${HERO_IMAGE}");
            background-position: center;
          }

          h1 {
            font-size: 2rem;
            line-height: 1.2;
          }

          .hero-text {
            font-size: 0.98rem;
          }

          .hero-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .primary-action,
          .secondary-action {
            width: 100%;
          }

          .quick-strip,
          .program-grid,
          .flow-grid,
          .lead-form {
            grid-template-columns: 1fr;
          }

          .quick-strip div {
            min-height: 92px;
            padding: 20px;
          }

          .section-copy h2,
          .section-heading h2,
          .insight-copy h2,
          .lead-copy h2 {
            font-size: 1.55rem;
          }

          .site-footer {
            min-height: 92px;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
            padding: 18px 24px;
          }
        }
      `}</style>
    </main>
  );
}
