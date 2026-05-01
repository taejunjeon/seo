#!/usr/bin/env python3
"""
Coffee Data Harness auditor helper.

This script is intentionally read-only. It checks changed coffee/harness files for:
- Obsidian wiki link validity in markdown files.
- whitespace diff errors.
- potentially executable send/write paths in changed code files.
- unrelated staged files.

It does not query production systems and does not send GA4/Meta/TikTok/Google Ads events.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]

ALLOWED_PREFIXES = (
    "harness/coffee-data/",
    "data/!coffeedata.md",
    "data/coffee-",
    "backend/scripts/coffee-",
    "scripts/coffee_harness_audit.py",
    "docs/agent-harness/growth-data-harness-v0.md",
    "AGENTS.md",
)

EXECUTABLE_SUFFIXES = (".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".sh")
AUDITOR_SCRIPT = "scripts/coffee_harness_audit.py"

SEND_PATTERNS = re.compile(
    r"mp/collect|debug/mp/collect|sendGa4|facebook|CAPI|CompletePayment|"
    r"Google Ads|conversion upload|googleads|tiktok|events_api",
    re.IGNORECASE,
)

WRITE_PATTERNS = re.compile(
    r"\bUPDATE\b|\bINSERT\b|\bDELETE\b|\bCREATE\s+TABLE\b|\bALTER\s+TABLE\b|"
    r"\bDROP\s+TABLE\b|\bCOPY\b|match_status|dispatch_log",
    re.IGNORECASE,
)

NO_SEND_DECLARATION = re.compile(
    r":\s*(false|null|undefined|0)\b|=\s*(false|null|undefined|0)\b",
    re.IGNORECASE,
)


NUMBER_CHECKS: list[dict[str, object]] = [
    {
        "label": "Imweb NPay actual orders/amount (window 2026-04-23~29)",
        "source": "data/coffee-imweb-operational-readonly-20260501.md",
        "source_pattern": r"\|\s*Imweb NPay actual\s*\|\s*(\d+)\s*/\s*([\d,]+)\s*원\s*\|",
        "expected_substring_templates": ["{0}건, {1}원", "{0} / {1}원"],
        "expected_in": ["data/!coffeedata.md"],
    },
    {
        "label": "GA4 NPay pattern purchases (window 2026-04-23~29)",
        "source": "data/coffee-imweb-operational-readonly-20260501.md",
        "source_pattern": r"\|\s*GA4 NPay pattern\s*\|\s*(\d+)\s*/\s*([\d,]+)\s*원\s*\|",
        "expected_substring_templates": ["{0}건, {1}원", "{0} / {1}원"],
        "expected_in": ["data/!coffeedata.md"],
    },
    {
        "label": "one-to-one assigned/unassigned actual/unassigned GA4",
        "source": "data/coffee-imweb-operational-readonly-20260501.md",
        "source_pattern": (
            r"\|\s*one-to-one assigned\s*\|\s*(\d+)\s*\|[\s\S]*?"
            r"\|\s*one-to-one unassigned actual\s*\|\s*(\d+)\s*\|[\s\S]*?"
            r"\|\s*one-to-one unassigned GA4\s*\|\s*(\d+)\s*\|"
        ),
        "expected_substring_templates": [
            "assigned {0}건, unassigned actual {1}건, unassigned GA4 {2}건",
            "one-to-one 배정 {0}건, unassigned actual {1}건, unassigned GA4 {2}건",
        ],
        "expected_in": ["data/!coffeedata.md"],
    },
    {
        "label": "unassigned actual recovery labels",
        "source": "data/coffee-imweb-operational-readonly-20260501.md",
        "source_pattern": (
            r"## Unassigned Actual Historical Recovery Label Summary[\s\S]*?"
            r"\|\s*expected_synthetic_gap\s*\|\s*(\d+)\s*\|[\s\S]*?"
            r"\|\s*stop_historical_recovery\s*\|\s*(\d+)\s*\|[\s\S]*?"
            r"\|\s*manual_review_only\s*\|\s*(\d+)\s*\|[\s\S]*?"
            r"\|\s*needs_naver_api_crosscheck\s*\|\s*(\d+)\s*\|"
        ),
        "expected_substring_templates": [
            "`expected_synthetic_gap` {0} / `stop_historical_recovery` {1} / `manual_review_only` {2} / `needs_naver_api_crosscheck` {3}",
        ],
        "expected_in": ["data/!coffeedata.md"],
    },
    {
        "label": "LTV combined eligible orders/revenue",
        "source": "data/coffee-excel-ltv-dry-run-20260501.md",
        "source_pattern": (
            r"\|\s*ltv eligible orders\s*\|\s*([\d,]+)\s*\|[\s\S]*?"
            r"\|\s*ltv eligible revenue\s*\|\s*([\d,]+)원\s*\|"
        ),
        # !coffeedata 의 "12,731건 / 476,696,364원" 또는 한국어 단위 변환 모두 허용.
        # 천단위 콤마 정규화로 전처리한 값들과 Korean-unit 변환을 두 형태로 비교.
        "expected_substring_templates": [
            "{0_with_comma}건 / {1}원",
            "{0_with_comma}건/{1}원",
            "{0_with_comma}건 / {1_korean_unit}",
        ],
        "expected_in": ["data/!coffeedata.md"],
    },
    {
        "label": "2025 mismatch breakdown total",
        "source": "data/coffee-excel-payment-mismatch-2025-20260501.md",
        "source_pattern": (
            r"\|\s*orders \(year unique\)\s*\|\s*([\d,]+)\s*\|[\s\S]*?"
            r"\|\s*mismatch orders\s*\|\s*([\d,]+)\s*\|"
        ),
        "expected_substring_templates": ["{0}/{1}"],
        "expected_in": [],
    },
]


def add_thousands(num_str: str) -> str:
    cleaned = num_str.replace(",", "")
    try:
        return f"{int(cleaned):,}"
    except ValueError:
        return num_str


def to_korean_amount(num_str: str) -> str:
    cleaned = num_str.replace(",", "").replace("원", "").strip()
    try:
        n = int(cleaned)
    except ValueError:
        return num_str
    if n < 10000:
        return f"{n:,}원"
    eok, rem = divmod(n, 100_000_000)
    man, _ = divmod(rem, 10_000)
    if eok > 0 and man > 0:
        return f"{eok}억 {man:,}만원"
    if eok > 0:
        return f"{eok}억원"
    return f"{man:,}만원"


def render_template(template: str, groups: tuple[str, ...]) -> str:
    """Custom template renderer with extra placeholders.

    Supports `{i}` for raw group, `{i_with_comma}` for thousands-separated
    integer, `{i_korean_unit}` for Korean amount unit (만/억).
    """
    rendered = template
    for index, value in enumerate(groups):
        rendered = rendered.replace(f"{{{index}_with_comma}}", add_thousands(value))
        rendered = rendered.replace(f"{{{index}_korean_unit}}", to_korean_amount(value))
        rendered = rendered.replace(f"{{{index}}}", value)
    return rendered


def run_number_checks() -> tuple[list[str], list[str]]:
    failures: list[str] = []
    notes: list[str] = []
    for check in NUMBER_CHECKS:
        label = str(check["label"])
        source_path = REPO_ROOT / str(check["source"])
        if not source_path.exists():
            notes.append(f"{label}: source missing — {check['source']}")
            continue
        text = source_path.read_text(errors="ignore")
        match = re.search(str(check["source_pattern"]), text)
        if not match:
            failures.append(f"{label}: pattern not found in {check['source']}")
            continue
        groups = match.groups()
        templates = check.get("expected_substring_templates") or [check.get("expected_substring_template", "")]
        rendered_options = [render_template(str(t), groups) for t in templates]  # type: ignore[arg-type]
        notes.append(f"{label}: source values = {' | '.join(rendered_options)}")
        targets = [str(p) for p in check["expected_in"]]  # type: ignore[arg-type]
        for rel in targets:
            target_path = REPO_ROOT / rel
            if not target_path.exists():
                failures.append(f"{label}: target missing — {rel}")
                continue
            target_text = target_path.read_text(errors="ignore")
            if not any(option in target_text for option in rendered_options):
                failures.append(
                    f"{label}: none of expected substrings found in {rel} (tried: {rendered_options})"
                )
    return failures, notes


def run(args: list[str], *, check: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=REPO_ROOT,
        check=check,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def changed_files() -> list[str]:
    names: set[str] = set()
    for args in (
        ["git", "diff", "--name-only"],
        ["git", "diff", "--cached", "--name-only"],
        ["git", "ls-files", "--others", "--exclude-standard"],
    ):
        result = run(args)
        if result.returncode == 0:
            names.update(line.strip() for line in result.stdout.splitlines() if line.strip())
    return sorted(names)


def is_relevant(path: str) -> bool:
    return path.startswith(ALLOWED_PREFIXES)


def is_doc(path: str) -> bool:
    return path.endswith(".md")


def is_executable(path: str) -> bool:
    return path.endswith(EXECUTABLE_SUFFIXES)


def scan_patterns(paths: list[str], pattern: re.Pattern[str]) -> list[str]:
    matches: list[str] = []
    for rel in paths:
        path = REPO_ROOT / rel
        if not path.exists() or not path.is_file():
            continue
        try:
            text = path.read_text(errors="ignore")
        except OSError:
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            if not pattern.search(line):
                continue
            stripped = line.strip()
            if stripped.startswith(("//", "#", "*")):
                continue
            if NO_SEND_DECLARATION.search(line):
                continue
            matches.append(f"{rel}:{lineno}: {stripped[:180]}")
    return matches


def validate_wiki_links(docs: list[str]) -> tuple[bool, str]:
    if not docs:
        return True, "No markdown files to validate."
    result = run(["python3", "scripts/validate_wiki_links.py", *docs])
    output = (result.stdout + result.stderr).strip()
    return result.returncode == 0, output


def diff_check(paths: list[str]) -> tuple[bool, str]:
    if not paths:
        return True, "No files to diff-check."
    result = run(["git", "diff", "--check", "--", *paths])
    output = (result.stdout + result.stderr).strip()
    return result.returncode == 0, output


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit coffee data harness changes.")
    parser.add_argument(
        "--all-relevant",
        action="store_true",
        help="Scan all relevant coffee/harness files instead of changed files only.",
    )
    args = parser.parse_args()

    if args.all_relevant:
        git_files = run(["git", "ls-files"]).stdout.splitlines()
        files = sorted(path for path in git_files if is_relevant(path))
    else:
        files = [path for path in changed_files() if is_relevant(path)]

    unrelated_staged = [
        line.strip()
        for line in run(["git", "diff", "--cached", "--name-only"]).stdout.splitlines()
        if line.strip() and not is_relevant(line.strip())
    ]
    docs = [path for path in files if is_doc(path)]
    executable = [path for path in files if is_executable(path) and path != AUDITOR_SCRIPT]

    wiki_ok, wiki_output = validate_wiki_links(docs)
    diff_ok, diff_output = diff_check(files)
    send_matches = scan_patterns(executable, SEND_PATTERNS)
    write_matches = scan_patterns(executable, WRITE_PATTERNS)
    number_failures, number_notes = run_number_checks()

    hard_fail = False
    notes: list[str] = []

    if not wiki_ok:
        hard_fail = True
        notes.append("wiki_link_validation_failed")
    if not diff_ok:
        hard_fail = True
        notes.append("git_diff_check_failed")
    if send_matches:
        hard_fail = True
        notes.append("new_executable_send_pattern_found")
    if write_matches:
        hard_fail = True
        notes.append("new_executable_write_pattern_found")
    if unrelated_staged:
        hard_fail = True
        notes.append("unrelated_staged_files_found")
    if number_failures:
        hard_fail = True
        notes.append("number_cross_check_failed")

    verdict = "FAIL_BLOCKED" if hard_fail else "PASS_WITH_NOTES"

    print(f"Auditor verdict: {verdict}")
    print("Phase: coffee_harness_audit")
    print("No-send grep matched docs only: YES" if not send_matches else "No-send grep matched docs only: NO")
    print("New executable send path added: NO" if not send_matches else "New executable send path added: YES")
    print("Actual network send observed: NO")
    print("No-write executable path added: NO" if not write_matches else "No-write executable path added: YES")
    print("Unrelated dirty files excluded: YES" if not unrelated_staged else "Unrelated dirty files excluded: NO")
    print(f"Relevant files checked: {len(files)}")
    print(f"Markdown files checked: {len(docs)}")
    print(f"Executable files checked: {len(executable)}")

    if notes:
        print("Notes:")
        for note in notes:
            print(f"- {note}")

    if unrelated_staged:
        print("Unrelated staged files:")
        for path in unrelated_staged:
            print(f"- {path}")

    if send_matches:
        print("Executable send pattern matches:")
        for match in send_matches[:50]:
            print(f"- {match}")

    if write_matches:
        print("Executable write pattern matches:")
        for match in write_matches[:50]:
            print(f"- {match}")

    if wiki_output:
        print("\nWiki validation output:")
        print(wiki_output)

    if diff_output:
        print("\nDiff check output:")
        print(diff_output)

    print("\nNumber cross-check:")
    for note in number_notes:
        print(f"- {note}")
    if number_failures:
        print("Number cross-check failures:")
        for failure in number_failures:
            print(f"- {failure}")
    else:
        print("- all checks passed")

    return 1 if hard_fail else 0


if __name__ == "__main__":
    sys.exit(main())
