#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

LANG_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--source-file", required=True)
    parser.add_argument("--source-language", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--settings-out", required=True)
    parser.add_argument("--targets-out", required=True)
    parser.add_argument("--meta-out", required=True)
    return parser.parse_args()


def require_languages(value: object) -> list[str]:
    if not isinstance(value, list) or not value:
        raise SystemExit("config targetLanguages must be a non-empty array")
    result: list[str] = []
    for item in value:
        if not isinstance(item, str) or not LANG_RE.fullmatch(item):
            raise SystemExit(f"invalid target language: {item!r}")
        if item not in result:
            result.append(item)
    return result


def translatable_line_count(text: str) -> int:
    count = 0
    in_fence = False
    opening = ""
    backtick_fence = chr(96) * 3
    tilde_fence = "~" * 3

    for line in text.splitlines():
        stripped = line.lstrip()
        if not in_fence and (
            stripped.startswith(backtick_fence)
            or stripped.startswith(tilde_fence)
        ):
            in_fence = True
            opening = stripped[:3]
            continue

        if in_fence:
            if stripped.startswith(opening):
                in_fence = False
                opening = ""
            continue

        if line.strip() and any(ch.isalpha() for ch in line):
            count += 1

    return count


args = parse_args()
config_path = Path(args.config)
source_path = Path(args.source_file)
config = json.loads(config_path.read_text(encoding="utf-8"))

if not LANG_RE.fullmatch(args.source_language):
    raise SystemExit(f"invalid source language: {args.source_language!r}")

all_targets = require_languages(config.get("targetLanguages"))
if args.source_language in all_targets:
    raise SystemExit("source language must not appear in targetLanguages")

if args.target == "all":
    targets = all_targets
elif args.target in all_targets:
    targets = [args.target]
else:
    raise SystemExit(
        f"target {args.target!r} is not 'all' or a configured target language"
    )

protected_terms = config.get("protectedTerms", [])
if not isinstance(protected_terms, list) or not all(
    isinstance(term, str) and term for term in protected_terms
):
    raise SystemExit("config protectedTerms must be a list of non-empty strings")

for field_name in ("sourceResiduePatterns", "allowedSourceResiduePatterns"):
    patterns = config.get(field_name, [])
    if not isinstance(patterns, list) or not all(
        isinstance(pattern, str) and pattern for pattern in patterns
    ):
        raise SystemExit(
            f"config {field_name} must be a list of non-empty regex strings"
        )
    for pattern in patterns:
        try:
            re.compile(pattern)
        except re.error as error:
            raise SystemExit(
                f"invalid regex in {field_name}: {pattern!r}: {error}"
            ) from error

glossary = config.get("glossary", [])
if not isinstance(glossary, list):
    raise SystemExit("config glossary must be an array")

terms: list[dict[str, str]] = []
seen: set[tuple[str, str, str]] = set()

for lang in targets:
    for term in protected_terms:
        key = (term, term, lang)
        if key not in seen:
            seen.add(key)
            terms.append(
                {"source": term, "target": term, "targetLang": lang}
            )

for entry in glossary:
    if not isinstance(entry, dict):
        raise SystemExit("each glossary entry must be an object")

    source = entry.get("source")
    target = entry.get("target")
    target_lang = entry.get("targetLang")

    if not isinstance(source, str) or not source:
        raise SystemExit("glossary source must be a non-empty string")
    if not isinstance(target, str) or not target:
        raise SystemExit("glossary target must be a non-empty string")
    if target_lang is not None and not isinstance(target_lang, str):
        raise SystemExit("glossary targetLang must be a string when present")
    if target_lang is not None and target_lang not in all_targets:
        raise SystemExit(
            f"glossary targetLang is not configured: {target_lang!r}"
        )

    entry_targets = targets if target_lang is None else [target_lang]
    for lang in entry_targets:
        if lang not in targets:
            continue
        key = (source, target, lang)
        if key not in seen:
            seen.add(key)
            terms.append(
                {"source": source, "target": target, "targetLang": lang}
            )

literal_terms_by_language: dict[str, list[str]] = {lang: [] for lang in targets}
for term in terms:
    if term["source"] != term["target"]:
        continue
    lang = term["targetLang"]
    value = term["source"]
    if value not in literal_terms_by_language[lang]:
        literal_terms_by_language[lang].append(value)

for lang in literal_terms_by_language:
    literal_terms_by_language[lang].sort(key=lambda value: (-len(value), value))

max_tokens = config.get("maxTokens", 2048)
retry_count = config.get("retryCount", 1)
request_timeout = config.get("requestTimeoutSec", 180)

if not isinstance(max_tokens, int) or max_tokens <= 0:
    raise SystemExit("config maxTokens must be a positive integer")
if not isinstance(retry_count, int) or retry_count < 0:
    raise SystemExit("config retryCount must be a non-negative integer")
if not isinstance(request_timeout, int) or request_timeout <= 0:
    raise SystemExit("config requestTimeoutSec must be a positive integer")

settings = {
    "translationMethod": "openai",
    "translationConfigs": {
        "openai": {
            "url": "https://api.openai.com/v1/chat/completions",
            "useRelay": False,
            "batchSize": 1,
            "contextBatchSize": 1,
            "delayTime": 200,
            "maxTokens": max_tokens,
        }
    },
    "systemPrompt": (
        "You are a professional technical-documentation translator. "
        "Return only the translated content. Preserve every token matching "
        "<<<[A-Z_]+_[0-9]+>>> byte-for-byte, exactly once. These tokens "
        "represent protected Markdown syntax, code, links, URLs, or other "
        "literal content. You may reorder or reposition protected tokens when "
        "required by natural target-language grammar, but never translate, "
        "split, merge, duplicate, delete, or alter a token. Before responding, "
        "verify that every <<<...>>> token from the input appears byte-for-byte "
        "exactly once in the output. Do not add spaces or alter punctuation "
        "inside a protected token. Markdown structure is validated after "
        "translation. Follow the supplied glossary exactly."
    ),
    "userPrompt": (
        "Translate the following complete Markdown line into ${targetLanguage}. "
        "Translate the surrounding prose naturally as one complete sentence "
        "while preserving all protected <<<...>>> tokens exactly as instructed."
        "\n\n${content}"
    ),
    "retryCount": retry_count,
    "requestTimeoutSec": request_timeout,
    "sourceLanguage": args.source_language,
    "targetLanguage": targets[0],
    "targetLanguages": targets,
    "multiLanguageMode": False,
    "glossaryEnabled": bool(terms),
    "activeGlossaryPresetId": "readme-i18n-kit",
    "glossaryPresets": [
        {
            "id": "readme-i18n-kit",
            "name": "Repository README terms",
            "terms": terms,
        }
    ],
}

source_text = source_path.read_text(encoding="utf-8")
line_count = translatable_line_count(source_text)

raw_derived_cap = max(
    60,
    math.ceil(line_count * len(targets) * 1.20) + 10,
)
if raw_derived_cap > 400:
    raise SystemExit(
        "estimated request budget exceeds 400; run fewer target languages "
        "in one job or shorten the canonical README"
    )
derived_cap = raw_derived_cap

configured_cap = config.get("maxRequests")
if configured_cap is not None:
    if not isinstance(configured_cap, int) or not 1 <= configured_cap <= 400:
        raise SystemExit(
            "config maxRequests must be an integer from 1 to 400"
        )
    max_requests = configured_cap
else:
    max_requests = derived_cap

Path(args.settings_out).write_text(
    json.dumps(settings, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
Path(args.targets_out).write_text(
    "\n".join(targets) + "\n",
    encoding="utf-8",
)
Path(args.meta_out).write_text(
    json.dumps(
        {
            "targets": targets,
            "translatableLineEstimate": line_count,
            "maxRequests": max_requests,
            "literalTermsByLanguage": literal_terms_by_language,
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)

print(max_requests)
