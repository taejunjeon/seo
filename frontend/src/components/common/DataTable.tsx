"use client";

import { useMemo, useState, useCallback } from "react";
import styles from "./DataTable.module.css";

/* ── 타입 ── */
export interface DataTableColumn<T> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  data: T[];
  defaultSortKey?: keyof T & string;
  defaultSortAsc?: boolean;
  pageSize?: number;
  searchKeys?: (keyof T & string)[];
  searchPlaceholder?: string;
}

/* ── DataTable 컴포넌트 ── */
export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  defaultSortKey,
  defaultSortAsc = false,
  pageSize: initialPageSize = 20,
  searchKeys,
  searchPlaceholder = "검색...",
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<(keyof T & string) | null>(defaultSortKey ?? null);
  const [sortAsc, setSortAsc] = useState(defaultSortAsc);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  /* 검색 */
  const searched = useMemo(() => {
    if (!search.trim() || !searchKeys || searchKeys.length === 0) return data;
    const q = search.trim().toLowerCase();
    return data.filter((row) =>
      searchKeys.some((k) => {
        const v = row[k];
        return typeof v === "string" && v.toLowerCase().includes(q);
      }),
    );
  }, [data, search, searchKeys]);

  /* 정렬 */
  const sorted = useMemo(() => {
    if (!sortKey) return searched;
    const arr = [...searched];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va;
      if (typeof va === "string" && typeof vb === "string") return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return 0;
    });
    return arr;
  }, [searched, sortKey, sortAsc]);

  /* 페이지네이션 */
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = useMemo(() => sorted.slice(page * pageSize, (page + 1) * pageSize), [sorted, page, pageSize]);

  const handleSort = useCallback((key: keyof T & string) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
    setPage(0);
  }, [sortKey]);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  /* 페이지 번호 */
  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (page > 2) pages.push("...");
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
      if (page < totalPages - 3) pages.push("...");
      pages.push(totalPages - 1);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className={styles.wrapper}>
      {/* 상단: 검색 + 페이지 크기 */}
      <div className={styles.toolbar}>
        {searchKeys && searchKeys.length > 0 && (
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {search && (
              <button type="button" className={styles.clearBtn} onClick={() => handleSearch("")}>×</button>
            )}
          </div>
        )}
        <div className={styles.pageSizeWrap}>
          <select
            className={styles.pageSizeSelect}
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}개씩</option>
            ))}
          </select>
        </div>
      </div>

      {/* 테이블 */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${styles.th} ${col.sortable !== false ? styles.thSortable : ""} ${sortKey === col.key ? styles.thActive : ""}`}
                  style={{ textAlign: col.align ?? "left", width: col.width }}
                  onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                >
                  {col.label}
                  {col.sortable !== false && sortKey === col.key && (
                    <span className={styles.sortIcon}>{sortAsc ? "▲" : "▼"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles.emptyRow}>데이터가 없습니다</td>
              </tr>
            ) : (
              paged.map((row, ri) => (
                <tr key={ri} className={styles.tr}>
                  {columns.map((col) => (
                    <td key={col.key} className={styles.td} style={{ textAlign: col.align ?? "left" }}>
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className={styles.pagination}>
        <span className={styles.pageInfo}>
          총 {sorted.length.toLocaleString("ko-KR")}개 중 {(page * pageSize + 1).toLocaleString("ko-KR")}-{Math.min((page + 1) * pageSize, sorted.length).toLocaleString("ko-KR")}
        </span>
        <div className={styles.pageButtons}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹ 이전
          </button>
          {pageNumbers.map((n, i) =>
            n === "..." ? (
              <span key={`dots-${i}`} className={styles.pageDots}>…</span>
            ) : (
              <button
                key={n}
                type="button"
                className={`${styles.pageBtn} ${page === n ? styles.pageBtnActive : ""}`}
                onClick={() => setPage(n)}
              >
                {n + 1}
              </button>
            ),
          )}
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            다음 ›
          </button>
        </div>
      </div>
    </div>
  );
}
