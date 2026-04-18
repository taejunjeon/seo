#!/usr/bin/env python3
"""
Obsidian wiki 링크 검증기.

docurule.md §2-5 / §15 규칙에 따라 문서를 저장하기 전 돌린다.

사용법:
    python3 scripts/validate_wiki_links.py <문서경로> [<문서경로> ...]

종료 코드:
    0 — 모든 문서 통과
    1 — 하나 이상 오류 발견

검증 항목:
    1. [[#헤딩]] wiki 링크가 실제 헤딩과 바이트 단위로 일치하는가
    2. GitHub 스타일 앵커 `](#소문자-하이픈)`가 남아 있지 않은가
    3. <a id="..."> HTML 태그가 남아 있지 않은가

제외 대상:
    fenced code block (```...```) 과 inline code (`...`)
    → 예시·샘플 마크다운은 실제 링크가 아니므로 검증 대상 아님.
"""

import re
import sys
from pathlib import Path


def strip_code(text: str) -> str:
    text = re.sub(r"```[a-zA-Z]*\n.*?\n```", "", text, flags=re.DOTALL)
    text = re.sub(r"`[^`\n]*`", "", text)
    return text


def validate(path: Path) -> int:
    if not path.exists():
        print(f"✗ {path}: 파일 없음")
        return 1

    text = path.read_text()
    body = strip_code(text)

    headings = {
        m.group(1).strip()
        for m in re.finditer(r"^#{1,6}\s+(.+?)\s*$", body, re.MULTILINE)
    }
    wiki_links = [
        m.group(1).strip()
        for m in re.finditer(r"\[\[#([^\]\\|]+)(?:\\?\|[^\]]*)?\]\]", body)
    ]
    gh_anchors = re.findall(r"\]\(#([a-z0-9\-_]+)\)", body)
    html_ids = re.findall(r'<a\s+id\s*=\s*["\']([^"\']+)["\']', body)

    missing = [l for l in wiki_links if l not in headings]

    errors = 0
    print(f"문서: {path}")
    print(f"  헤딩 {len(headings)}개, wiki 링크 {len(wiki_links)}개")

    if missing:
        print(f"  ✗ 미매치 wiki 링크 {len(missing)}개: {missing}")
        errors += 1
    else:
        print(f"  ✓ wiki 링크 전부 헤딩과 매치")

    if gh_anchors:
        print(f"  ✗ GitHub 스타일 앵커 {len(gh_anchors)}개 (금지): {gh_anchors}")
        errors += 1
    else:
        print(f"  ✓ GitHub 스타일 앵커 없음")

    if html_ids:
        print(f"  ✗ <a id> 태그 {len(html_ids)}개 (금지): {html_ids}")
        errors += 1
    else:
        print(f"  ✓ <a id> 태그 없음")

    return errors


def main() -> int:
    if len(sys.argv) < 2:
        print("사용법: python3 scripts/validate_wiki_links.py <문서경로> [...]")
        return 2

    total_errors = 0
    for arg in sys.argv[1:]:
        total_errors += validate(Path(arg))
        print()

    if total_errors == 0:
        print("✓ 모든 문서 통과")
        return 0
    print(f"✗ {total_errors}개 오류 발견")
    return 1


if __name__ == "__main__":
    sys.exit(main())
