"use client";

import { useState } from "react";
import type { AiCitationProviderResult, AiCitationProvider } from "./types";
import { PROVIDER_META } from "./types";
import styles from "./AiCitation.module.css";

type Props = {
  providers: AiCitationProviderResult[];
  siteHost: string;
  pickedQueries: string[];
  diagUrl?: string;
};

const cellIcon = (exposure: boolean, cited: boolean) => {
  if (cited) return <span className={styles.cellCited} title="인용됨">&#x2705;</span>;
  if (exposure) return <span className={styles.cellExposure} title="출처 있으나 미인용">&#x26A0;&#xFE0F;</span>;
  return <span className={styles.cellNone} title="노출 없음">&#x274C;</span>;
};

export default function CitationSamplesTable({ providers, siteHost, pickedQueries, diagUrl }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (pickedQueries.length === 0) return null;

  const providerOrder: AiCitationProvider[] = ["google_ai_overview", "chatgpt_search", "perplexity"];
  const activeProviders = providerOrder.filter((pid) => providers.some((p) => p.provider === pid));

  const buildRow = (query: string) => {
    const cells: Record<AiCitationProvider, { exposure: boolean; cited: boolean; urlMatch: boolean }> = {
      google_ai_overview: { exposure: false, cited: false, urlMatch: false },
      chatgpt_search: { exposure: false, cited: false, urlMatch: false },
      perplexity: { exposure: false, cited: false, urlMatch: false },
    };

    for (const p of providers) {
      const sample = p.samples.find((s) => s.query === query);
      if (!sample) continue;
      const urlMatch = diagUrl
        ? sample.matchedReferences.some((r) => r.link.includes(diagUrl.replace(/^https?:\/\//i, "").replace(/\/$/, "")))
        : false;
      cells[p.provider] = {
        exposure: sample.exposure,
        cited: sample.cited,
        urlMatch,
      };
    }
    return cells;
  };

  return (
    <div className={styles.samplesSection}>
      <button type="button" className={styles.accordionBtn} onClick={() => setIsOpen((v) => !v)}>
        <span>{isOpen ? "▼" : "▶"} 표본 키워드별 상세</span>
        <span className={styles.sampleHint}>최근 30일 노출 상위 기준 {pickedQueries.length}개</span>
      </button>
      {isOpen && (
        <div className={styles.samplesTableWrap}>
          <table className={styles.samplesTable}>
            <thead>
              <tr>
                <th>키워드</th>
                {activeProviders.map((pid) => (
                  <th key={pid}>{PROVIDER_META[pid].icon} {PROVIDER_META[pid].label.replace(" Search", "").replace(" AI Overview", " AIO")}</th>
                ))}
                <th>{siteHost} 인용</th>
              </tr>
            </thead>
            <tbody>
              {pickedQueries.map((query) => {
                const cells = buildRow(query);
                const anyCited = activeProviders.some((pid) => cells[pid].cited);
                const anyUrlMatch = activeProviders.some((pid) => cells[pid].urlMatch);
                return (
                  <tr key={query} className={anyUrlMatch ? styles.samplesRowHighlight : ""}>
                    <td className={styles.samplesQueryCell}>{query}</td>
                    {activeProviders.map((pid) => (
                      <td key={pid} className={styles.samplesCenterCell}>
                        {cellIcon(cells[pid].exposure, cells[pid].cited)}
                      </td>
                    ))}
                    <td className={styles.samplesCenterCell}>
                      {anyCited
                        ? <span className={styles.citedBadge}>{anyUrlMatch ? "이 페이지 인용" : `${siteHost} 인용`}</span>
                        : <span className={styles.notCitedBadge}>미인용</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
