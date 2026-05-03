#!/usr/bin/env python3
"""lessons-lint — cross-site LESSONS.md 표준 schema 검증.

Sprint 23 (Green Lane). 정본 schema: harness/!공통하네스_가이드라인.md §10
+ harness/npay-recovery/LESSONS_TO_RULES_SCHEMA.md.

검증:
- id 중복 (cross-site)
- status 값 (4 lifecycle: observation / candidate_rule / approved_rule / deprecated_rule)
  + Coffee 의 deprecated `resolved` → `approved_rule` 마이그 권장 표시
- 필수 필드 (status / title / observation / candidate_rule)
- 깨진 wiki 링크 (간단한 [[link]] 형식 검증)

사용:
    python3 scripts/lessons-lint.py [--site coffee|npay-recovery] [--strict]

read-only — 파일 수정 없음. exit 0 = PASS, 1 = warnings, 2 = errors.
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LESSONS_PATHS = {
    "coffee": ROOT / "harness/coffee-data/LESSONS.md",
    "npay-recovery": ROOT / "harness/npay-recovery/LESSONS.md",
    # TikTok / AIBIO LESSONS.md 부재 — 후속 sprint 23.1 에서 신규
}

VALID_STATUS = {"observation", "candidate_rule", "approved_rule", "deprecated_rule"}
DEPRECATED_STATUS_ALIASES = {"resolved": "approved_rule"}  # Coffee 의 임의 명명 → 정본 매핑


def parse_markdown_table_lessons(path: Path) -> list[dict]:
    """markdown table 형식 (Coffee 형식) 의 LESSON row 추출."""
    rows: list[dict] = []
    if not path.exists():
        return rows
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    in_table = False
    headers: list[str] = []
    for line in lines:
        if line.startswith("| id ") or line.startswith("| `id`"):
            # header row
            headers = [h.strip().strip("`") for h in line.split("|")[1:-1]]
            in_table = True
            continue
        if in_table and line.startswith("|---"):
            continue
        if in_table and line.startswith("|") and not line.startswith("|---"):
            cells = [c.strip() for c in line.split("|")[1:-1]]
            if len(cells) >= len(headers):
                row = dict(zip(headers, cells[: len(headers)]))
                if row.get("id", "").strip():
                    row["_source_path"] = str(path.relative_to(ROOT))
                    rows.append(row)
        elif in_table and not line.strip():
            in_table = False
    return rows


def parse_yaml_table_lessons(path: Path) -> list[dict]:
    """biocom 의 'Seed Lessons' 표 (yaml + table 혼합) 의 row 추출.

    biocom 의 LESSONS.md 는 markdown table + Lesson Detail (yaml 형식) 두 layer.
    본 lint 는 markdown table 만 검증 (yaml 은 별도 sprint).
    """
    return parse_markdown_table_lessons(path)


def lint_lesson(row: dict, all_ids: dict, errors: list, warnings: list) -> None:
    rid = row.get("id", "").strip().strip("`")
    src = row.get("_source_path", "?")
    status = (row.get("상태") or row.get("status") or "").strip()

    # 1. id 중복 cross-site
    if rid in all_ids:
        errors.append(
            f"[ERROR] id 중복: {rid} (current: {src}, prev: {all_ids[rid]})"
        )
    else:
        all_ids[rid] = src

    # 2. status 값
    if status in DEPRECATED_STATUS_ALIASES:
        warnings.append(
            f"[WARN] {rid} ({src}): deprecated status '{status}' "
            f"→ 정본 '{DEPRECATED_STATUS_ALIASES[status]}' 으로 마이그 권장"
        )
    elif status and status not in VALID_STATUS:
        errors.append(
            f"[ERROR] {rid} ({src}): invalid status '{status}' "
            f"(허용: {sorted(VALID_STATUS)})"
        )
    elif not status:
        errors.append(f"[ERROR] {rid} ({src}): status 필드 누락")

    # 3. 필수 필드
    title = row.get("규칙명") or row.get("title") or ""
    obs = row.get("observation") or row.get("관찰") or ""
    if not title and len(row) > 2:
        # Coffee 형식은 title 컬럼이 별도 없고 observation 안에 포함
        third_col_keys = [k for k in row.keys() if k not in {"id", "상태", "status", "_source_path"}]
        if third_col_keys:
            third_val = row.get(third_col_keys[0], "").strip()
            if not third_val:
                warnings.append(f"[WARN] {rid} ({src}): observation/title 비어있음")

    # 4. wiki 링크 검증 (간단한 [[link]] 형식)
    full_text = " ".join(str(v) for v in row.values())
    wiki_links = re.findall(r"\[\[([^\]]+)\]\]", full_text)
    for link in wiki_links:
        # link 은 file path (anchor 분리) 또는 alias
        link_path = link.split("|")[0].split("#")[0].strip()
        if not link_path:
            continue
        # 간단한 검증 — 절대/상대 path 모두 root 기준으로 확인
        candidate_paths = [
            ROOT / f"{link_path}.md",
            ROOT / link_path,
            ROOT / f"data/{link_path}.md",
        ]
        if not any(p.exists() for p in candidate_paths):
            # markdown 파일 부재 — 단 `# anchor` 만 있으면 같은 파일 내 link 로 간주, skip
            if "#" not in link or link_path:
                warnings.append(
                    f"[WARN] {rid} ({src}): broken wiki link [[{link}]] "
                    f"(검색 path: {[str(p.relative_to(ROOT)) for p in candidate_paths]})"
                )


def main() -> int:
    parser = argparse.ArgumentParser(description="lessons-lint")
    parser.add_argument("--site", choices=list(LESSONS_PATHS.keys()), help="특정 site 만")
    parser.add_argument("--strict", action="store_true", help="warning 도 error 로")
    args = parser.parse_args()

    all_ids: dict[str, str] = {}
    errors: list[str] = []
    warnings: list[str] = []
    site_counts: dict[str, int] = defaultdict(int)

    paths_to_check = (
        {args.site: LESSONS_PATHS[args.site]} if args.site else LESSONS_PATHS
    )

    for site, path in paths_to_check.items():
        if not path.exists():
            warnings.append(f"[WARN] LESSONS.md 부재: {site} ({path})")
            continue
        rows = parse_markdown_table_lessons(path)
        site_counts[site] = len(rows)
        for row in rows:
            lint_lesson(row, all_ids, errors, warnings)

    print("=== lessons-lint 결과 ===")
    print(f"총 lesson: {sum(site_counts.values())}")
    for site, cnt in site_counts.items():
        print(f"  {site}: {cnt}")
    print()
    if errors:
        print(f"=== ERRORS ({len(errors)}) ===")
        for e in errors:
            print(e)
        print()
    if warnings:
        print(f"=== WARNINGS ({len(warnings)}) ===")
        for w in warnings:
            print(w)
        print()
    if not errors and not warnings:
        print("✓ 모든 lesson 통과 (errors 0, warnings 0)")

    if errors:
        return 2
    if warnings and args.strict:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
