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
if inline_code_re.findall(source) != inline_code_re.findall(translated):
    errors.append("inline code spans changed")

link_dest_re = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
if link_dest_re.findall(source) != link_dest_re.findall(translated):
    errors.append("Markdown link/image destinations changed")

heading_re = re.compile(r"(?m)^(#{1,6})\s")
if [len(x) for x in heading_re.findall(source)] != [
    len(x) for x in heading_re.findall(translated)
]:
    errors.append("heading hierarchy changed")


if errors:
    for error in errors:
        print(f"::error::{error}")
    raise SystemExit(1)

print("README translation structural checks passed.")
