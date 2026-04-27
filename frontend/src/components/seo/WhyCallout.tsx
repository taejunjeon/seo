"use client";

import { ReactNode } from "react";
import styles from "./seo.module.css";

type Props = {
  tone?: "info" | "warning" | "success";
  title?: string;
  children: ReactNode;
};

export default function WhyCallout({ tone = "info", title, children }: Props) {
  const icon = tone === "warning" ? "⚠️" : tone === "success" ? "✅" : "💡";
  return (
    <div className={`${styles.whyCallout} ${styles["whyCallout_" + tone]}`}>
      <span className={styles.whyIcon} aria-hidden="true">{icon}</span>
      <div className={styles.whyBody}>
        {title && <div className={styles.whyTitle}>{title}</div>}
        <div className={styles.whyText}>{children}</div>
      </div>
    </div>
  );
}
