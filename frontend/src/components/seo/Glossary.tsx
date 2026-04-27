"use client";

import { ReactNode, useState } from "react";
import styles from "./seo.module.css";

type Props = {
  term: string;
  short: string;
  children?: ReactNode;
};

export default function Glossary({ term, short, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <span className={styles.glossaryWrap}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={styles.glossaryTerm}
        aria-expanded={open}
      >
        {term}
        <span className={styles.glossaryQ}>?</span>
      </button>
      {open && (
        <span className={styles.glossaryPop}>
          <span className={styles.glossaryShort}>{short}</span>
          {children && <span className={styles.glossaryLong}>{children}</span>}
        </span>
      )}
    </span>
  );
}
