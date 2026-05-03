#!/usr/bin/env python3
"""test-harness-preflight — fork detect fixture test runner.

Sprint 23.3.1 (corrective). 본 runner 는 scripts/test-harness-preflight-fixtures/
디렉토리의 fixture markdown 파일들을 read 후 _classify_fork() 의 verdict 가
expected 와 일치하는지 검증한다.

read-only — fixture / preflight-check 본체 수정 0.

사용:
    python3 scripts/test-harness-preflight.py
    python3 scripts/test-harness-preflight.py --verbose

exit 0 = PASS (모든 fixture 의 verdict 일치), 1 = FAIL.
"""
from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PREFLIGHT_PATH = ROOT / "scripts" / "harness-preflight-check.py"
FIXTURES_DIR = ROOT / "scripts" / "test-harness-preflight-fixtures"

# fixture filename → expected severity (None = PASS)
EXPECTED = {
    "good_short_redirect.md": None,           # 짧은 + 정본 link 명시 → PASS
    "good_project_local_delta.md": None,      # 짧은 + Lane phrase 적음 → PASS
    "bad_short_fork_no_link.md": "warning",   # 80-249줄 + Lane 표 다수 + link 미언급 → WARNING
    "bad_long_fork.md": "warning",             # 250-599줄 + header phrase → WARNING
    "bad_critical_fork.md": "error",          # 600+줄 + header phrase → ERROR
}


def load_preflight_module():
    """harness-preflight-check.py 의 모듈 로딩 — '_classify_fork' 가져오기 위해."""
    spec = importlib.util.spec_from_file_location("hpc", PREFLIGHT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"preflight-check 모듈 spec 실패: {PREFLIGHT_PATH}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    parser = argparse.ArgumentParser(description="test-harness-preflight fixtures")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    mod = load_preflight_module()
    classify = mod._classify_fork

    print("=== test-harness-preflight (fixture runner) ===")
    print(f"fixtures: {FIXTURES_DIR.relative_to(ROOT)}")
    print()

    results = []
    for fname, expected in EXPECTED.items():
        path = FIXTURES_DIR / fname
        if not path.exists():
            print(f"  [MISSING] {fname} — fixture 부재")
            results.append((fname, expected, "MISSING", "MISSING"))
            continue
        text = path.read_text(encoding="utf-8")
        line_count = len(text.split("\n"))
        severity, reason = classify(text, line_count)
        ok = severity == expected
        mark = "OK" if ok else "FAIL"
        results.append((fname, expected, severity, reason if args.verbose else ""))
        print(
            f"  [{mark}] {fname}: {line_count}줄, expected={expected!s}, "
            f"got={severity!s}"
            + (f" — {reason}" if args.verbose and reason else "")
        )

    failures = [r for r in results if r[1] != r[2]]
    print()
    if failures:
        print(f"=== FAIL ({len(failures)}) ===")
        for fname, expected, got, _ in failures:
            print(f"  {fname}: expected={expected!s}, got={got!s}")
        return 1
    print(f"✓ 모든 fixture 통과 ({len(results)}/{len(results)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
