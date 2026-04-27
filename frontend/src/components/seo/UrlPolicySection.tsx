"use client";

import { useMemo, useState } from "react";
import styles from "./seo.module.css";
import CopyButton from "./CopyButton";
import WhyCallout from "./WhyCallout";
import Glossary from "./Glossary";
import ImpactBadge from "./ImpactBadge";
import type { InventoryRow, UrlPolicyResponse } from "./seo.types";

type Props = {
  data: UrlPolicyResponse | null;
};

const TYPE_BADGES: Record<string, string> = {
  home: "홈",
  category: "카테고리",
  "lab/test service": "검사권",
  product: "상품",
  "article/column": "칼럼",
  "review/board": "리뷰/게시판",
  "cart/login/member": "장바구니/로그인",
  "search/filter": "검색/필터",
  "noisy parameter URL": "잡음 URL",
  "service/category": "서비스",
};

const STATUS_LABEL: Record<number, { label: string; tone: "ok" | "warn" | "danger" }> = {
  200: { label: "200 정상", tone: "ok" },
  301: { label: "301 영구이동", tone: "warn" },
  302: { label: "302 임시이동", tone: "warn" },
  404: { label: "404 없음", tone: "danger" },
  500: { label: "500 서버오류", tone: "danger" },
};

function statusMeta(code: number) {
  return STATUS_LABEL[code] ?? { label: `${code}`, tone: code >= 400 ? ("danger" as const) : code >= 300 ? ("warn" as const) : ("ok" as const) };
}

const PROBLEM_TYPES = new Set(["noisy parameter URL", "cart/login/member", "search/filter", "review/board"]);

function isProblemUrl(r: InventoryRow): boolean {
  if (r.isParameterUrl) return true;
  if (PROBLEM_TYPES.has(r.type)) return true;
  if (r.statusCode !== 200) return true;
  if (r.finalUrl !== r.url) return true; // redirect 후보
  return false;
}

export default function UrlPolicySection({ data }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [mode, setMode] = useState<"problems" | "all">("problems"); // 기본: 문제 있는 것만

  const filteredInventory = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.inventory.rows.filter((r) => {
      if (mode === "problems" && !isProblemUrl(r)) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!q) return true;
      return (
        r.url.toLowerCase().includes(q) ||
        r.path.toLowerCase().includes(q) ||
        r.finalUrl.toLowerCase().includes(q)
      );
    });
  }, [data, search, typeFilter, mode]);

  const problemCount = useMemo(() => {
    if (!data) return 0;
    return data.inventory.rows.filter(isProblemUrl).length;
  }, [data]);

  if (!data) {
    return (
      <section id="url-policy" className={styles.section}>
        <h2 className={styles.sectionH}>URL 정책</h2>
        <p className={styles.sectionEmpty}>URL 정책 데이터를 불러오지 못했습니다.</p>
      </section>
    );
  }

  return (
    <section id="url-policy" className={styles.section}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleGroup}>
          <h2 className={styles.sectionH}>URL 종류별 처리 기준표 <span className={styles.sectionHTech}>(URL 정책)</span></h2>
          <ImpactBadge variant="readonly" />
        </div>
        <span className={styles.sectionTag}>url_policy_matrix.csv · duplicate_url_groups.csv · url_inventory.csv</span>
      </div>

      <WhyCallout tone="info" title="이 섹션은 무엇을 정리하나요">
        <p style={{ marginBottom: 8 }}>
          한 상품을 가리키는 URL이 5개라면, 검색엔진은 다섯 갈래로 흩어진 신호를 받습니다.
          이 섹션은 <strong>유형별로 어느 URL을 「진짜」 대표 URL로 쓸지</strong>를 표로 정리합니다.
          승인된 정책은 아임웹·robots.txt·sitemap.xml에 그대로 적용됩니다.
        </p>
        <p>
          핵심 용어 (쉬운 말로):{" "}
          <Glossary term="대표 URL (canonical)" short="여러 URL 중 「이게 원본입니다」라고 검색엔진에 알려주는 표시.">
            예: /shop/123, /shop/123?ref=ad, /shop/123?utm=a 가 같은 상품이라면 셋 다 「대표 URL은 /shop/123」이라고 표시. 검색 점수가 한 URL에 모입니다.
          </Glossary>
          {" · "}
          <Glossary term="검색엔진에 제출할 URL 목록 (sitemap)" short="구글에 「우리 사이트의 진짜 페이지 목록은 이거예요」라고 보내는 파일.">
            구글봇이 사이트를 빨리 발견하도록 도와줍니다. 잡음 URL을 빼야 좋은 페이지에 색인 예산이 쓰입니다.
          </Glossary>
          {" · "}
          <Glossary term="검색결과에서 숨김 (noindex)" short="이 페이지는 구글 검색결과에 노출하지 말라는 표시.">
            로그인·장바구니·내부 검색결과처럼 사용자에게는 필요하지만 검색결과에 뜰 필요는 없는 페이지에 사용.
          </Glossary>
          {" · "}
          <Glossary term="parameter URL" short="? 뒤에 query string이 붙은 URL.">
            ?idx=, ?q=, ?bmode= 같은 형태. 같은 페이지의 변형이거나 검색·필터 결과인 경우가 많아 잡음을 만듭니다.
          </Glossary>
        </p>
      </WhyCallout>

      <h3 className={styles.colH}>유형별 정책 매트릭스</h3>
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>유형</th>
              <th>대표 URL</th>
              <th>canonical 정책</th>
              <th>sitemap 포함?</th>
              <th>noindex?</th>
              <th>다음 작업</th>
              <th>자신감</th>
            </tr>
          </thead>
          <tbody>
            {data.policies.map((p) => (
              <tr key={p.type + p.representativeUrl}>
                <td><span className={styles.typeBadge}>{TYPE_BADGES[p.type] ?? p.type}</span></td>
                <td>
                  {p.representativeUrl.startsWith("http") ? (
                    <a href={p.representativeUrl} target="_blank" rel="noreferrer" className={styles.pageCellUrl}>{p.representativeUrl}</a>
                  ) : (
                    <span className={styles.pageCellMetaSmall}>{p.representativeUrl}</span>
                  )}
                  {p.currentExamples && (
                    <div className={styles.policyExamples}>예: {p.currentExamples}</div>
                  )}
                </td>
                <td>{p.canonicalPolicy}</td>
                <td><span className={styles.policyChip} data-tone={p.sitemapPolicy.includes("제외") ? "danger" : "ok"}>{p.sitemapPolicy}</span></td>
                <td><span className={styles.policyChip} data-tone={p.noindexPolicy.includes("noindex") ? "warn" : "ok"}>{p.noindexPolicy}</span></td>
                <td>{p.action}</td>
                <td className={styles.confCell} title="이 정책 추천에 대한 확신 정도. 100%에 가까울수록 데이터 근거가 충분.">{p.confidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={styles.colH} style={{ marginTop: 28 }}>중복 의심 그룹 ({data.duplicates.length})</h3>
      <WhyCallout tone="warning">
        URL 패턴과 본문 hash를 비교해서 <strong>같은 내용을 가리키는 것으로 의심되는 URL 묶음</strong>을 자동 탐지한 결과입니다.
        각 그룹마다 「진짜 대표 URL」 1개를 정하고, 나머지는 noindex 또는 301 redirect로 정리해야 색인이 한 URL에 모입니다.
      </WhyCallout>
      <div className={styles.dupGrid}>
        {data.duplicates.map((d) => (
          <div key={d.group} className={styles.dupCard}>
            <div className={styles.dupCardHead}>
              <div>
                <div className={styles.dupCardLabel}>{d.group}</div>
                <div className={styles.dupCardMeta}>{d.count}건 · {d.types}</div>
              </div>
              <span className={styles.statusBadge} data-status={String(d.statusCodes).startsWith("2") ? "ok" : "warn"} title={`HTTP 상태 코드 ${d.statusCodes}`}>{d.statusCodes}</span>
            </div>
            <ul className={styles.dupUrlList}>
              {d.urls.slice(0, 4).map((u) => (
                <li key={u}><a href={u} target="_blank" rel="noreferrer">{u.length > 90 ? `${u.slice(0, 90)}…` : u}</a></li>
              ))}
              {d.urls.length > 4 && <li className={styles.dupMore}>+{d.urls.length - 4}건 더</li>}
            </ul>
          </div>
        ))}
      </div>

      <h3 className={styles.colH} style={{ marginTop: 28 }}>URL 인벤토리</h3>
      <WhyCallout tone="info">
        공개 사이트에서 수집한 전체 URL {data.inventory.total}건의 장부입니다.
        기본은 <strong>「문제 있는 URL만」</strong>(parameter URL · 잡음 유형 · 200 아닌 응답 · redirect 후보) 표시 — 처리 우선순위가 높은 것만 먼저 봅니다.
        분석가가 전수 검토하려면 「전체 보기」로 전환하세요.{" "}
        <Glossary term="응답 상태 (status)" short="HTTP 응답 코드.">
          200 = 정상 / 301·302 = 다른 URL로 이동 / 404 = 페이지 없음 / 500 = 서버 오류. 200이 아닌 URL이 검색엔진 제출 목록(sitemap)에 들어 있으면 구글이 헛걸음하고 색인 점수가 떨어집니다.
        </Glossary>
        {" · "}
        <Glossary term="최종 도착 URL" short="이 URL을 열었을 때 실제로 도착하는 주소.">
          예: /organicacid 를 누르면 실제로는 /organicacid_store/?idx=259 로 이동. 원래 URL과 다르면 redirect가 걸려 있다는 뜻 — 대표 URL 정리 후보.
        </Glossary>
      </WhyCallout>
      <div className={styles.invModeToggle}>
        <button type="button" className={`${styles.invModeBtn} ${mode === "problems" ? styles.invModeBtnActive : ""}`} onClick={() => setMode("problems")}>
          ⚠️ 문제 있는 URL만 ({problemCount}건)
        </button>
        <button type="button" className={`${styles.invModeBtn} ${mode === "all" ? styles.invModeBtnActive : ""}`} onClick={() => setMode("all")}>
          전체 URL 보기 ({data.inventory.total}건)
        </button>
      </div>
      <div className={styles.invToolbar}>
        <input
          type="text"
          placeholder="URL · path · 최종 URL 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.invSearch}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={styles.invSelect}>
          <option value="all">전체 유형</option>
          {data.inventory.typeCounts.map((t) => (
            <option key={t.type} value={t.type}>{TYPE_BADGES[t.type] ?? t.type} ({t.count})</option>
          ))}
        </select>
        <span className={styles.invCount}>{filteredInventory.length}건 표시</span>
        <CopyButton
          label="URL 복사"
          value={filteredInventory.map((r) => r.url).join("\n")}
          size="sm"
        />
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>URL</th>
              <th>유형</th>
              <th>응답 상태</th>
              <th>최종 URL (redirect 후)</th>
              <th>parameter URL?</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.slice(0, 200).map((r) => {
              const meta = statusMeta(r.statusCode);
              return (
                <tr key={r.url}>
                  <td><a href={r.url} target="_blank" rel="noreferrer" className={styles.pageCellUrl}>{r.url.length > 70 ? `${r.url.slice(0, 70)}…` : r.url}</a></td>
                  <td><span className={styles.typeBadge}>{TYPE_BADGES[r.type] ?? r.type}</span></td>
                  <td><span className={styles.statusBadge} data-status={meta.tone === "danger" ? "warn" : meta.tone}>{meta.label}</span></td>
                  <td className={styles.pageCellMetaSmall}>{r.finalUrl !== r.url ? r.finalUrl : "—"}</td>
                  <td>{r.isParameterUrl ? <span className={styles.policyChip} data-tone="warn">YES</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredInventory.length > 200 && (
          <div className={styles.tableMore}>최대 200건만 표시. 검색·필터로 좁혀보세요.</div>
        )}
      </div>
    </section>
  );
}
