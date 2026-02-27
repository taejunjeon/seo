"use client";

import { useState, useMemo } from "react";
import type { AiCitationProviderResult, AiCitationProvider } from "./types";
import { PROVIDER_META } from "./types";
import styles from "./AiCitation.module.css";

type Props = {
  providers: AiCitationProviderResult[];
  siteHost: string;
};

type DomainEntry = {
  domain: string;
  count: number;
  providerSet: Set<AiCitationProvider>;
  isSelf: boolean;
};

const extractDomain = (link: string): string => {
  try {
    return new URL(link).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
};

export default function CompetitorDomainsTable({ providers, siteHost }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const domains = useMemo(() => {
    const map = new Map<string, DomainEntry>();
    const needle = siteHost.replace(/^www\./i, "").toLowerCase();

    for (const p of providers) {
      for (const s of p.samples) {
        for (const ref of s.references) {
          const domain = extractDomain(ref.link);
          if (!domain) continue;
          const existing = map.get(domain);
          if (existing) {
            existing.count++;
            existing.providerSet.add(p.provider);
          } else {
            const isSelf = domain === needle || domain.endsWith(`.${needle}`);
            map.set(domain, { domain, count: 1, providerSet: new Set([p.provider]), isSelf });
          }
        }
      }
    }

    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 15);
  }, [providers, siteHost]);

  if (domains.length === 0) return null;

  return (
    <div className={styles.competitorSection}>
      <button type="button" className={styles.accordionBtn} onClick={() => setIsOpen((v) => !v)}>
        <span>{isOpen ? "▼" : "▶"} 경쟁 출처 (인용되는 사이트 TOP {Math.min(15, domains.length)})</span>
      </button>
      {isOpen && (
        <div className={styles.samplesTableWrap}>
          <table className={styles.samplesTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>도메인</th>
                <th>인용 횟수</th>
                <th>프로바이더</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d, idx) => (
                <tr key={d.domain} className={d.isSelf ? styles.samplesRowHighlight : ""}>
                  <td className={styles.samplesCenterCell}>{idx + 1}</td>
                  <td className={styles.samplesQueryCell}>
                    {d.domain}
                    {d.isSelf && <span className={styles.selfBadge}>내 사이트</span>}
                  </td>
                  <td className={styles.samplesCenterCell}>{d.count}</td>
                  <td className={styles.samplesCenterCell}>
                    {[...d.providerSet].map((pid) => (
                      <span key={pid} className={styles.providerMiniTag} title={PROVIDER_META[pid].label}>
                        {PROVIDER_META[pid].icon}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
