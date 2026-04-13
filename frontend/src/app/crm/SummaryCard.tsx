import styles from "./page.module.css";

export function SummaryCard(props: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "warn" | "success";
}) {
  return (
    <div className={`${styles.summaryCard} ${props.tone ? styles[`summaryCard${props.tone[0]!.toUpperCase()}${props.tone.slice(1)}`] : ""}`}>
      <span className={styles.summaryLabel}>{props.label}</span>
      <strong className={styles.summaryValue}>{props.value}</strong>
      {props.sub ? <span className={styles.summarySub}>{props.sub}</span> : null}
    </div>
  );
}
