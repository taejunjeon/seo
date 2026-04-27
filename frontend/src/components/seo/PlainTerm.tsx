"use client";

import { ReactNode } from "react";
import styles from "./seo.module.css";

type Props = {
  plain: string;
  technical?: string;
  children?: ReactNode;
  inline?: boolean;
};

export default function PlainTerm({ plain, technical, children, inline = false }: Props) {
  if (inline) {
    return (
      <span className={styles.plainTermInline}>
        <strong>{plain}</strong>
        {technical && <span className={styles.plainTermTech}>({technical})</span>}
      </span>
    );
  }
  return (
    <div className={styles.plainTermBlock}>
      <div className={styles.plainTermHead}>
        <span className={styles.plainTermName}>{plain}</span>
        {technical && <span className={styles.plainTermTech}>({technical})</span>}
      </div>
      {children && <div className={styles.plainTermDesc}>{children}</div>}
    </div>
  );
}
