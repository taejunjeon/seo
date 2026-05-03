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
COMMON_HEADER_PHRASES = [
    "Growth Data Agent Harness Guidelines v1",
    "Growth Data Agent Autonomy Policy v1",
    "Growth Data Agent Reporting Template v1",
]
COMMON_HEADER_PHRASE = COMMON_HEADER_PHRASES[0]  # 기존 하위호환

FORK_SUSPECT_PATHS = [
    "harness/!공통하네스_가이드라인.md",  # sprint 23.1 redirect 후 본문 중복 0 이어야
]

# Sprint 23.3.1 (corrective) — TJ 명시 명령에 따라 whitelist 정밀화.
#   - project-specific AUTONOMY_POLICY/README/CONTEXT_PACK/RULES 는 whitelist prefix skip 금지 (검사 대상)
#   - LESSONS.md / archive / legacy redirect 만 skip 가능
#   - 짧은 (80-249줄) project-local delta 는 PASS, 정본 fork 의심 phrase 조합이면 WARNING
#   - 250-599 WARNING, 600+ ERROR (현행 유지)

# 디렉토리 단위 skip — 본 디렉토리 안 모든 .md 는 fork detect 안 함 (외부 archive / dependency).
FORK_SCAN_DIR_SKIP_PREFIXES = [
    "harness/common/",                                # 정본 자체
    "harness/0501gpt/",                               # GPT review archive (.gitignore)
    "scripts/test-harness-preflight-fixtures/",        # fixture 디렉토리 (별도 runner 검사)
    "node_modules/",
    ".git/",
    ".obsidian/",
    ".vscode/",
    ".codex-backups/",
    "amplitude/",
    "gpt0502/",
    "frontend/node_modules/",
    "backend/node_modules/",
    "backend/dist/",
]

# 파일 단위 skip — 정본 fork 가 아닌 schema/lesson/redirect.
FORK_SCAN_LEGACY_REDIRECT_PATHS = [
    "harness/!공통하네스_가이드라인.md",   # sprint 23.1 redirect (size 검사 별도)
]
# 정규식 패턴 — match 시 fork detect skip (LESSONS, archive, legacy 폴더).
FORK_SCAN_FILE_SKIP_PATTERNS = [
    re.compile(r"^harness/[^/]+/LESSONS\.md$"),         # site 별 LESSONS — schema 길이 OK
    re.compile(r"^harness/[^/]+/archive/.*\.md$"),       # archive subdir
    re.compile(r"^harness/[^/]+/legacy/.*\.md$"),        # legacy subdir
    re.compile(r"^harness/cross-site-lessons/INDEX\.md$"),  # 본 INDEX 자체
]

FORK_SCAN_MIN_LINES = 250            # 250줄 이상 + phrase 포함 시 fork 의심
SHORT_FORK_MIN_LINES = 80             # 80-249줄 + phrase 조합 시 짧은 fork 의심
SHORT_FORK_MAX_LINES = FORK_SCAN_MIN_LINES  # exclusive
LANE_PHRASES = ["Green Lane", "Yellow Lane", "Red Lane"]
SHORT_FORK_LANE_THRESHOLD = 5         # Lane phrase 등장 횟수 — 정본 핵심 표 fork 의심 기준
CANONICAL_PATH_HINTS = [               # 정본 link 가 본문에 있으면 redirect 로 간주 (PASS 가능)
    "harness/common/HARNESS_GUIDELINES.md",
    "harness/common/AUTONOMY_POLICY.md",
    "harness/common/REPORTING_TEMPLATE.md",
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


def _is_fork_scan_skipped(rel_str: str) -> bool:
    """fork scan 에서 skip 할지 결정 — sprint 23.3.1 corrective."""
    if any(rel_str.startswith(p) for p in FORK_SCAN_DIR_SKIP_PREFIXES):
        return True
    if rel_str in FORK_SCAN_LEGACY_REDIRECT_PATHS:
        return True
    if any(p.match(rel_str) for p in FORK_SCAN_FILE_SKIP_PATTERNS):
        return True
    return False


def _classify_fork(text: str, line_count: int) -> tuple[str | None, str]:
    """fork 분류 — sprint 23.3.1 corrective.

    Returns: (severity, reason) — severity ∈ {"error", "warning", None}
      - 600+ + (header phrase OR Lane 표) → error
      - 250-599 + (header phrase OR Lane 표) → warning
      - 80-249 + Lane 표 (>=5) + 정본 link 미언급 → warning (짧은 fork 의심)
      - 80-249 + Lane 표 (>=5) + 정본 link 언급 (redirect 로 간주) → None (PASS)
      - 그 외 → None
    """
    has_header = any(p in text for p in COMMON_HEADER_PHRASES)
    lane_count = sum(text.count(p) for p in LANE_PHRASES)
    canonical_link = any(hint in text for hint in CANONICAL_PATH_HINTS)
    matches_canonical_table = lane_count >= SHORT_FORK_LANE_THRESHOLD

    if line_count >= 600:
        if has_header:
            return ("error", f"600줄+ 본문 fork (common header phrase 포함, Lane phrase {lane_count}회)")
        if matches_canonical_table and not canonical_link:
            return (
                "warning",
                f"600줄+ 장문 + Lane phrase {lane_count}회 + 정본 link 미언급. "
                f"common header phrase 미포함이라 ERROR 가 아닌 WARNING 유지 — project design 문서면 정본 link 추가",
            )
    if line_count >= FORK_SCAN_MIN_LINES:  # 250-599
        if has_header:
            return ("warning", f"250-599줄 본문 fork (common header phrase 포함, Lane phrase {lane_count}회)")
        if matches_canonical_table and not canonical_link:
            return (
                "warning",
                f"250-599줄 + Lane phrase {lane_count}회 + 정본 link 미언급. "
                f"project design 문서면 정본 link 추가",
            )
    if SHORT_FORK_MIN_LINES <= line_count < SHORT_FORK_MAX_LINES:  # 80-249
        if has_header:
            return ("warning", f"80-249줄 짧은 fork — common header phrase 포함 ({line_count}줄)")
        if matches_canonical_table and not canonical_link:
            return (
                "warning",
                f"80-249줄 짧은 fork 의심 — Lane phrase {lane_count}회 + 정본 link 미언급. "
                f"본 파일이 project-local delta 라면 정본 link (예: 'harness/common/AUTONOMY_POLICY.md') 명시 권장",
            )
    return (None, "")


def check_fork_global_grep(errors: list, warnings: list) -> None:
    """Y2-C (sprint 23.3 + 23.3.1 corrective) — repo 전체 markdown 에서 fork detect.

    sprint 23.3.1 corrective:
      - whitelist 좁힘: site-prefix 전체 skip 금지. project-specific AUTONOMY_POLICY/README/RULES/CONTEXT_PACK 검사 대상.
      - LESSONS.md, archive, legacy redirect 만 skip.
      - 80-249줄 짧은 fork (Lane phrase + 정본 link 미언급) WARNING 신규.
      - 250-599 WARNING, 600+ ERROR (분류 함수 _classify_fork 통합).
    """
    for md_path in ROOT.rglob("*.md"):
        try:
            rel = md_path.relative_to(ROOT)
        except ValueError:
            continue
        rel_str = str(rel)
        if _is_fork_scan_skipped(rel_str):
            continue
        try:
            text = md_path.read_text(encoding="utf-8")
        except Exception:
            continue
        line_count = len(text.split("\n"))
        severity, reason = _classify_fork(text, line_count)
        if severity == "error":
            errors.append(
                f"[ERROR] global fork 의심: {rel_str} — {reason}. "
                f"정본 (harness/common/) fork 또는 redirect 처리 필요."
            )
        elif severity == "warning":
            warnings.append(
                f"[WARN] global fork 의심: {rel_str} — {reason}. "
                f"정본 fork 인지 확인 후 redirect 또는 project-local delta 형식으로 정리."
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

    print("[4a] fork 의심 파일 detect (hardcoded list)")
    check_fork_suspects(errors, warnings)
    print()

    print("[4b] global fork detect (Y2-C — 250줄+ markdown 에서 common phrase grep)")
    check_fork_global_grep(errors, warnings)
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
