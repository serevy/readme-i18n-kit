#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

if len(sys.argv) != 4:
    raise SystemExit("usage: verify-readme-translation.py SOURCE TRANSLATED CONFIG")

source = Path(sys.argv[1]).read_text(encoding="utf-8")
translated = Path(sys.argv[2]).read_text(encoding="utf-8")
config = json.loads(Path(sys.argv[3]).read_text(encoding="utf-8"))
errors: list[str] = []

source_residue_patterns = config.get("sourceResiduePatterns", [])
allowed_source_residue_patterns = config.get("allowedSourceResiduePatterns", [])

if not isinstance(source_residue_patterns, list) or not all(
    isinstance(pattern, str) and pattern for pattern in source_residue_patterns
):
    raise SystemExit(
        "config sourceResiduePatterns must be a list of non-empty regex strings"
    )

if not isinstance(allowed_source_residue_patterns, list) or not all(
    isinstance(pattern, str) and pattern
    for pattern in allowed_source_residue_patterns
):
    raise SystemExit(
        "config allowedSourceResiduePatterns must be a list of non-empty regex strings"
    )

try:
    source_residue_res = [re.compile(pattern) for pattern in source_residue_patterns]
    allowed_source_residue_res = [
        re.compile(pattern) for pattern in allowed_source_residue_patterns
    ]
except re.error as error:
    raise SystemExit(f"invalid source residue regex: {error}") from error

protected_terms = config.get("protectedTerms", [])
if not isinstance(protected_terms, list) or not all(
    isinstance(term, str) and term for term in protected_terms
):
    raise SystemExit("config protectedTerms must be a list of non-empty strings")

for term in protected_terms:
    if source.count(term) != translated.count(term):
        errors.append(
            f"protected term count changed: {term!r}: "
            f"{source.count(term)} -> {translated.count(term)}"
        )

placeholder_re = re.compile(r"<<<[A-Z_]+_\d+>>>")
if placeholder_re.search(translated):
    errors.append("internal Markdown placeholder leaked into translated output")

tick = chr(96)
fence = tick * 3
fence_re = re.compile(
    r"(?ms)^" + re.escape(fence) + r"[^\n]*\n.*?^" + re.escape(fence) + r"[ \t]*$"
)
if fence_re.findall(source) != fence_re.findall(translated):
    errors.append("fenced code blocks changed")

inline_code_re = re.compile(
    r"(?<!" + re.escape(tick) + r")"
    + re.escape(tick)
    + r"[^" + re.escape(tick) + r"\n]+"
    + re.escape(tick)
    + r"(?!" + re.escape(tick) + r")"
)
if sorted(inline_code_re.findall(source)) != sorted(inline_code_re.findall(translated)):
    errors.append("inline code spans changed")

link_dest_re = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
if sorted(link_dest_re.findall(source)) != sorted(link_dest_re.findall(translated)):
    errors.append("Markdown link/image destinations changed")

heading_re = re.compile(r"(?m)^(#{1,6})\s")
if [len(x) for x in heading_re.findall(source)] != [
    len(x) for x in heading_re.findall(translated)
]:
    errors.append("heading hierarchy changed")


def lines_outside_fences(text: str) -> list[tuple[int, str]]:
    result: list[tuple[int, str]] = []
    in_fence = False
    opening_fence = ""

    for line_number, line in enumerate(text.splitlines(), start=1):
        stripped = line.lstrip()
        backtick_fence = chr(96) * 3
        tilde_fence = "~" * 3

        if not in_fence and (
            stripped.startswith(backtick_fence)
            or stripped.startswith(tilde_fence)
        ):
            in_fence = True
            opening_fence = stripped[:3]
            continue

        if in_fence:
            if stripped.startswith(opening_fence):
                in_fence = False
                opening_fence = ""
            continue

        result.append((line_number, line))

    return result


if source_residue_res:
    for line_number, line in lines_outside_fences(translated):
        if any(regex.search(line) for regex in source_residue_res):
            if any(
                regex.search(line) for regex in allowed_source_residue_res
            ):
                continue
            errors.append(
                "source-language residue detected at translated line "
                f"{line_number}: {line[:160]!r}"
            )


if errors:
    for error in errors:
        print(f"::error::{error}")
    raise SystemExit(1)

print("README translation structural checks passed.")
