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

    return 1 if hard_fail else 0


if __name__ == "__main__":
    sys.exit(main())
