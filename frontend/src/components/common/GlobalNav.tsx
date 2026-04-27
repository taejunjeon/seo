"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./GlobalNav.module.css";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

const NAV_TABS = ["오버뷰", "칼럼", "키워드", "AI 보고서", "CWV", "행동", "진단", "AI CRM", "솔루션"];
const TAB_SLUGS = ["overview", "column", "keyword", "ai-report", "cwv", "behavior", "diagnosis", "ai-crm", "solution"];

const ROUTE_TABS: { label: string; href: string; slug: string; accent?: boolean }[] = [
  { label: "SEO 분석", href: "/seo", slug: "seo", accent: true },
];

export default function GlobalNav({ activeSlug }: { activeSlug?: string }) {
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    const ac = new AbortController();
    fetch(`${API_BASE_URL}/health`, { signal: ac.signal, cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(); setConnectionStatus("ok"); })
      .catch(() => { if (!ac.signal.aborted) setConnectionStatus("error"); });
    return () => ac.abort();
  }, []);

  return (
    <nav className={styles.topNav}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.navBrand}>
          <span className={styles.navBrandIcon}>🧠</span>
          <div className={styles.navBrandText}>
            <span className={styles.navBrandTitle}>Biocom <span className={styles.navBrandAccent}>AI Agent</span></span>
            <span className={styles.navBrandSub}>AEO/GEO Intelligence</span>
          </div>
        </Link>
        <div className={styles.navTabs}>
          {NAV_TABS.map((tab, i) => {
            const slug = TAB_SLUGS[i];
            const isActive = activeSlug === slug;
            return (
              <Link
                key={tab}
                href={i === 0 ? "/" : `/#${slug}`}
                className={`${styles.navTab} ${isActive ? styles.navTabActive : ""}`}
              >
                {tab}
              </Link>
            );
          })}
          <span className={styles.navDivider} aria-hidden="true" />
          {ROUTE_TABS.map((tab) => {
            const isActive = activeSlug === tab.slug;
            return (
              <Link
                key={tab.slug}
                href={tab.href}
                className={`${styles.navTab} ${tab.accent ? styles.navTabAccent : ""} ${isActive ? styles.navTabActive : ""}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className={styles.navRight}>
          <div className={styles.statusWrap}>
            <span className={styles.statusDotWrap}>
              <span className={styles.statusDotPing} data-status={connectionStatus} />
              <span className={styles.statusDot} data-status={connectionStatus} />
            </span>
            <span className={styles.statusText}>
              {connectionStatus === "ok" ? "Connected" : connectionStatus === "error" ? "Disconnected" : "Checking..."}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
