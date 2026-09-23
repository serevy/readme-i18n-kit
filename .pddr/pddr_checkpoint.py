#!/usr/bin/env python3
"""Detect deterministic signals that recommend a PDDR checkpoint review."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable

CHECKPOINT_HEADING = "## PDDR checkpoint"
HIDDEN_MARKER = "<!-- pddr-checkpoint-signal -->"
EXPLICIT_BODY_MARKER = "[pddr-checkpoint]"
EXPLICIT_LABEL = "pddr-checkpoint"


def _clean_path(value: str) -> str:
    return value.strip().replace("\\", "/")


def _path_reason(path: str) -> str | None:
    normalized = _clean_path(path)
    if not normalized:
        return None

    lower = normalized.lower()
    parts = [part for part in lower.split("/") if part]
    name = parts[-1] if parts else lower

    safe_path = normalized.replace("`", "'")

    if name == "agents.md":
        return f"agent guidance changed: `{safe_path}`"

    if name.startswith("roadmap") or "roadmap" in parts[:-1]:
        return f"roadmap surface changed: `{safe_path}`"

    if name.startswith("architecture") or "architecture" in parts[:-1]:
        return f"architecture surface changed: `{safe_path}`"

    return None


def detect_reasons(
    changed_files: Iterable[str],
    *,
    pr_body: str = "",
    labels: Iterable[str] = (),
) -> list[str]:
    reasons: list[str] = []

    normalized_labels = {label.strip().lower() for label in labels if label.strip()}
    if EXPLICIT_LABEL in normalized_labels:
        reasons.append(f"explicit label: `{EXPLICIT_LABEL}`")

    if EXPLICIT_BODY_MARKER in pr_body.lower():
        reasons.append(f"explicit PR marker: `{EXPLICIT_BODY_MARKER}`")

    for path in changed_files:
        reason = _path_reason(path)
        if reason and reason not in reasons:
            reasons.append(reason)

    return reasons


def has_checkpoint_review(pr_body: str) -> bool:
    return CHECKPOINT_HEADING.lower() in pr_body.lower()


def marker_markdown(reasons: list[str]) -> str:
    reason_text = "; ".join(reasons)
    return (
        f"{HIDDEN_MARKER}\n"
        f"{CHECKPOINT_HEADING}\n\n"
        "- Signal: recommended\n"
        "- Review: pending\n"
        f"- Reason: {reason_text}\n\n"
        "Checkpoint Signal ≠ PDDR required.\n"
    )


def summary_markdown(
    *,
    reasons: list[str],
    review_present: bool,
) -> str:
    recommended = bool(reasons)
    if not recommended:
        review = "not-requested"
        signal = "not-recommended"
    elif review_present:
        review = "existing"
        signal = "recommended"
    else:
        review = "pending"
        signal = "recommended"

    lines = [
        CHECKPOINT_HEADING,
        "",
        f"- Signal: {signal}",
        f"- Review: {review}",
    ]
    if reasons:
        lines.append("- Reasons:")
        lines.extend(f"  - {reason}" for reason in reasons)
    lines.extend(
        [
            "",
            "Checkpoint Signal ≠ PDDR required.",
            "",
            "This summary is an execution-time trace. It does not need to be rewritten after a later audit.",
            "",
        ]
    )
    return "\n".join(lines)


def _load_event(path: Path | None) -> tuple[str, list[str]]:
    if path is None:
        return "", []
    event = json.loads(path.read_text(encoding="utf-8"))
    pull_request = event.get("pull_request") or {}
    body = pull_request.get("body") or ""
    labels = [
        item.get("name", "")
        for item in pull_request.get("labels", [])
        if isinstance(item, dict)
    ]
    return body, labels


def _write_output(path: Path, values: dict[str, bool]) -> None:
    with path.open("a", encoding="utf-8") as stream:
        for key, value in values.items():
            stream.write(f"{key}={'true' if value else 'false'}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--changed-files", type=Path, required=True)
    parser.add_argument("--event-path", type=Path)
    parser.add_argument("--github-output", type=Path)
    parser.add_argument("--summary", type=Path)
    parser.add_argument("--marker", type=Path)
    args = parser.parse_args()

    changed_files = args.changed_files.read_text(encoding="utf-8").splitlines()
    pr_body, labels = _load_event(args.event_path)
    reasons = detect_reasons(changed_files, pr_body=pr_body, labels=labels)
    review_present = has_checkpoint_review(pr_body)
    recommended = bool(reasons)
    pending = recommended and not review_present

    if args.summary:
        with args.summary.open("a", encoding="utf-8") as stream:
            stream.write(summary_markdown(reasons=reasons, review_present=review_present))

    if args.marker and pending:
        args.marker.write_text(marker_markdown(reasons), encoding="utf-8")

    if args.github_output:
        _write_output(
            args.github_output,
            {
                "recommended": recommended,
                "review_present": review_present,
                "pending": pending,
            },
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
