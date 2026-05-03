#!/usr/bin/env python3
"""harness-preflight-check — 공통 하네스 부트스트랩 + preflight 검증.

Sprint 23.1 (Green Lane). 정본: harness/common/HARNESS_GUIDELINES.md.

검증 항목:
1. common harness 정본 3 파일 존재
   - harness/common/HARNESS_GUIDELINES.md
   - harness/common/AUTONOMY_POLICY.md
   - harness/common/REPORTING_TEMPLATE.md
2. CLAUDE.md 에 "Growth Data Harness Bootstrap" 섹션 + "Harness Preflight Block" 명시
3. AGENTS.md 에 "Harness Preflight Block 강제" + "Common harness fork 금지" 명시
4. fork 의심 파일 detect — common 본문과 길게 중복되는 다른 파일
5. (sprint 단위) 최근 commit message 에 harness_preflight yaml block 명시 여부 (--check-recent-commits)
6. (tracking 작업) live tracking inventory snapshot 7일 이내 신선도 (--check-tracking)

사용:
    python3 scripts/harness-preflight-check.py
    python3 scripts/harness-preflight-check.py --strict
    python3 scripts/harness-preflight-check.py --check-tracking
    python3 scripts/harness-preflight-check.py --check-recent-commits

read-only — 파일 수정 0. exit 0 = PASS, 1 = warnings, 2 = errors.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

REQUIRED_COMMON_DOCS = [
    "harness/common/HARNESS_GUIDELINES.md",
    "harness/common/AUTONOMY_POLICY.md",
    "harness/common/REPORTING_TEMPLATE.md",
]

# CLAUDE.md / AGENTS.md 에 반드시 있어야 하는 phrase
REQUIRED_CLAUDE_PHRASES = [
    "Growth Data Harness Bootstrap",
    "harness/common/HARNESS_GUIDELINES.md",
    "Harness Preflight Block",
    "Common harness fork 금지",
]
REQUIRED_AGENTS_PHRASES = [
    "harness/common/HARNESS_GUIDELINES.md",
    "Harness Preflight Block 강제",
    "Common harness fork 금지",
]

# fork 의심 — common 본문과 같은 phrase 가 다른 파일에 길게 중복
COMMON_HEADER_PHRASE = "Growth Data Agent Harness Guidelines v1"
FORK_SUSPECT_PATHS = [
    "harness/!공통하네스_가이드라인.md",  # sprint 23.1 redirect 후 본문 중복 0 이어야
]


def check_common_docs(errors: list, warnings: list) -> None:
    for path_str in REQUIRED_COMMON_DOCS:
        path = ROOT / path_str
        if not path.exists():
            errors.append(f"[ERROR] 정본 문서 부재: {path_str}")
        elif path.stat().st_size < 100:
            warnings.append(f"[WARN] 정본 문서 size 작음 (<100 bytes): {path_str}")


def check_claude_md(errors: list, warnings: list) -> None:
    path = ROOT / "CLAUDE.md"
    if not path.exists():
        errors.append("[ERROR] CLAUDE.md 부재 (project local)")
        return
    text = path.read_text(encoding="utf-8")
    for phrase in REQUIRED_CLAUDE_PHRASES:
        if phrase not in text:
            errors.append(f"[ERROR] CLAUDE.md 누락 phrase: '{phrase}'")


def check_agents_md(errors: list, warnings: list) -> None:
    path = ROOT / "AGENTS.md"
    if not path.exists():
        errors.append("[ERROR] AGENTS.md 부재 (project local)")
        return
    text = path.read_text(encoding="utf-8")
    for phrase in REQUIRED_AGENTS_PHRASES:
        if phrase not in text:
            errors.append(f"[ERROR] AGENTS.md 누락 phrase: '{phrase}'")


def check_fork_suspects(errors: list, warnings: list) -> None:
    """common 정본 본문과 길게 중복되는 fork 의심 detect.

    sprint 23.1 redirect 후 `harness/!공통하네스_가이드라인.md` 는 본문 보존 안 함 (~30줄 redirect).
    300 줄 이상 + Common header phrase 포함 시 fork 의심.
    """
    for path_str in FORK_SUSPECT_PATHS:
        path = ROOT / path_str
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        line_count = len(text.split("\n"))
        if line_count > 300 and COMMON_HEADER_PHRASE in text:
            errors.append(
                f"[ERROR] fork 의심: {path_str} ({line_count}줄, common header phrase 포함). "
                f"redirect 로 정리해야 함 (sprint 23.1 패턴)."
            )
        elif line_count > 100 and COMMON_HEADER_PHRASE in text:
            warnings.append(
                f"[WARN] fork 의심: {path_str} ({line_count}줄, common header phrase 포함)."
            )


def check_tracking_inventory(errors: list, warnings: list) -> None:
    """tracking/GTM 작업의 live inventory snapshot 신선도.

    가장 최신 `data/coffee-live-tracking-inventory-*.md` 또는
    `data/biocom-live-tracking-inventory-*.md` 의 작성일 (filename) 이 7일 이내인지 검증.
    """
    import datetime

    today = datetime.date.today()
    for prefix in ["coffee-live-tracking-inventory-", "biocom-live-tracking-inventory-"]:
        candidates = sorted(ROOT.glob(f"data/{prefix}*.md"))
        if not candidates:
            warnings.append(f"[WARN] live tracking inventory 부재: data/{prefix}*.md")
            continue
        latest = candidates[-1]
        # filename 의 YYYYMMDD 추출
        m = re.search(r"(\d{8})\.md$", latest.name)
        if not m:
            warnings.append(f"[WARN] inventory 날짜 파싱 실패: {latest.name}")
            continue
        ds = m.group(1)
        try:
            d = datetime.date(int(ds[:4]), int(ds[4:6]), int(ds[6:8]))
        except ValueError:
            warnings.append(f"[WARN] inventory 날짜 invalid: {ds}")
            continue
        age_days = (today - d).days
        if age_days > 7:
            errors.append(
                f"[ERROR] live tracking inventory stale: {latest.name} ({age_days} 일 전). "
                f"7일 이내 snapshot 필요. tracking 작업이면 hard fail."
            )
        elif age_days > 3:
            warnings.append(
                f"[WARN] live tracking inventory aging: {latest.name} ({age_days} 일 전)."
            )


def check_recent_commits(errors: list, warnings: list, n: int = 5) -> None:
    """최근 N commit 의 message 에 harness_preflight yaml block 명시 여부.

    sprint commit 인지 detect (sprint 또는 phase 단어 포함) — 그 commit 만 검증.
    """
    try:
        out = subprocess.run(
            ["git", "log", f"-{n}", "--pretty=format:%H|%s|%b", "--no-merges"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
    except Exception as e:
        warnings.append(f"[WARN] git log 실패: {e}")
        return

    for entry in out.stdout.split("\n\n"):
        if not entry.strip():
            continue
        parts = entry.split("|", 2)
        if len(parts) < 3:
            continue
        hash_, subject, body = parts[0], parts[1], parts[2] if len(parts) > 2 else ""
        full = f"{subject}\n{body}"
        # sprint commit detect
        is_sprint = any(
            kw in full.lower()
            for kw in ["sprint", "phase ", "phase:", "lane:", "auditor verdict"]
        )
        if not is_sprint:
            continue
        # harness_preflight yaml block 명시 여부
        if "harness_preflight" not in full and "Harness Preflight" not in full:
            warnings.append(
                f"[WARN] commit {hash_[:8]} ({subject[:50]}): "
                f"sprint commit 인데 harness_preflight block 미명시"
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="harness-preflight-check")
    parser.add_argument("--strict", action="store_true", help="warning 도 error 로")
    parser.add_argument("--check-tracking", action="store_true", help="live tracking inventory 신선도 검증")
    parser.add_argument("--check-recent-commits", action="store_true", help="최근 commit 의 preflight block 검증")
    args = parser.parse_args()

    errors: list[str] = []
    warnings: list[str] = []

    print("=== harness-preflight-check ===")
    print()

    print("[1] common harness 정본 3 파일 존재")
    check_common_docs(errors, warnings)
    print()

    print("[2] CLAUDE.md Bootstrap + Preflight + fork 금지")
    check_claude_md(errors, warnings)
    print()

    print("[3] AGENTS.md Preflight + fork 금지")
    check_agents_md(errors, warnings)
    print()

    print("[4] fork 의심 파일 detect")
    check_fork_suspects(errors, warnings)
    print()

    if args.check_tracking:
        print("[5] live tracking inventory 신선도")
        check_tracking_inventory(errors, warnings)
        print()

    if args.check_recent_commits:
        print("[6] 최근 sprint commit 의 preflight block")
        check_recent_commits(errors, warnings)
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
        print("✓ 모든 검사 통과 (errors 0, warnings 0)")

    if errors:
        return 2
    if warnings and args.strict:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
