"use client";

import styles from "@/app/page.module.css";
import type { PageSpeedReportResponse, MdBlock } from "@/types/page";
import { parseMarkdownLite } from "@/utils/pageUtils";

/* ── JSX 반환 헬퍼 ── */
const renderInline = (text: string) => {
  const parts = text.split("`");
  return parts.map((part, idx) => {
    const isCode = idx % 2 === 1;
    if (isCode) return <code key={idx}>{part}</code>;
    return <span key={idx}>{part}</span>;
  });
};

type Props = {
  report: PageSpeedReportResponse | null;
  loading: boolean;
  error: string | null;
};

export default function PageSpeedReportTab({ report, loading, error }: Props) {
  return (
    <>
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>PageSpeed 보고서</h2>
          <span className={styles.sectionMeta}>
            {report?.updatedAt
              ? `마지막 업데이트: ${new Date(report.updatedAt).toLocaleString("ko-KR")}`
              : ""}
          </span>
        </div>

        {loading && <p className={styles.reportLoading}>보고서를 불러오는 중...</p>}
        {error && <p className={styles.reportError}>보고서 로드 실패: {error}</p>}

        {report && (
          <div className={styles.reportContent}>
            {parseMarkdownLite(report.markdown).map((block, idx) => {
              switch (block.type) {
                case "h1":
                  return <h1 key={idx}>{renderInline(block.text)}</h1>;
                case "h2":
                  return <h2 key={idx}>{renderInline(block.text)}</h2>;
                case "h3":
                  return <h3 key={idx}>{renderInline(block.text)}</h3>;
                case "hr":
                  return <hr key={idx} />;
                case "ul":
                  return (
                    <ul key={idx}>
                      {block.items.map((item, itemIdx) => (
                        <li key={itemIdx}>{renderInline(item)}</li>
                      ))}
                    </ul>
                  );
                case "ol":
                  return (
                    <ol key={idx}>
                      {block.items.map((item, itemIdx) => (
                        <li key={itemIdx}>{renderInline(item)}</li>
                      ))}
                    </ol>
                  );
                case "p":
                  return (
                    <p key={idx}>
                      {block.lines.map((line, lineIdx) => (
                        <span key={lineIdx}>
                          {renderInline(line)}
                          {lineIdx < block.lines.length - 1 ? <br /> : null}
                        </span>
                      ))}
                    </p>
                  );
                default:
                  return null;
              }
            })}
          </div>
        )}
      </section>
    </>
  );
}
