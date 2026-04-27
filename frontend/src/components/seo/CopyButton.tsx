"use client";

import { useState } from "react";
import styles from "./seo.module.css";

type Props = {
  value: string;
  label?: string;
  size?: "sm" | "md";
};

export default function CopyButton({ value, label = "복사", size = "sm" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`${styles.copyBtn} ${size === "md" ? styles.copyBtnMd : ""} ${copied ? styles.copyBtnCopied : ""}`}
    >
      {copied ? "복사됨" : label}
    </button>
  );
}
