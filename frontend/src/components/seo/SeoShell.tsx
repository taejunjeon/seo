"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./seo.module.css";

export type SeoSection = {
  id: string;
  label: string;
  hint?: string;
};

type Props = {
  sections: SeoSection[];
  children: ReactNode;
};

export default function SeoShell({ sections, children }: Props) {
  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window === "undefined") return sections[0]?.id ?? "";
    const initial = window.location.hash.replace("#", "");
    if (initial && sections.some((s) => s.id === initial)) return initial;
    return sections[0]?.id ?? "";
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  const handleClick = (id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.sidebarBack}>← 메인 대시보드</Link>
        <div className={styles.sidebarBrand}>
          <span className={styles.sidebarBrandTitle}>SEO/AEO</span>
          <span className={styles.sidebarBrandSub}>biocom.kr · 운영 전 진단</span>
        </div>
        <nav className={styles.sidebarNav}>
          {sections.map((s, idx) => {
            const active = s.id === activeId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleClick(s.id)}
                className={`${styles.sidebarLink} ${active ? styles.sidebarLinkActive : ""}`}
              >
                <span className={styles.sidebarLinkIndex}>{String(idx + 1).padStart(2, "0")}</span>
                <span className={styles.sidebarLinkBody}>
                  <span className={styles.sidebarLinkLabel}>{s.label}</span>
                  {s.hint && <span className={styles.sidebarLinkHint}>{s.hint}</span>}
                </span>
              </button>
            );
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          운영 사이트·아임웹·GTM·Search Console <strong>변경 없음</strong>.<br />
          승인 전 데이터만 표시.
        </div>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
