---
id: PDDR-0002
title: Protect Markdown structure and repair only bounded line failures
decision_date: 2026-09-21
recorded_date: 2026-09-22
decision_status: accepted
delivery_status: validated
scope:
  - product
  - process
owners: []
evidence:
  - https://github.com/serevy/readme-i18n-kit/pull/3
  - https://github.com/serevy/readme-i18n-kit/pull/4
  - https://github.com/serevy/readme-i18n-kit/pull/5
  - https://github.com/serevy/readme-i18n-kit/pull/7
  - https://github.com/serevy/pddr-kit/actions/runs/35642451897
related:
  - PDDR-0001
  - PDDR-0003
supersedes: []
superseded_by: null
---

# PDDR-0002: Protect Markdown structure and repair only bounded line failures

## Summary

Translate protected Markdown as complete lines so target-language grammar can remain natural, while preserving Markdown tokens and validating the final structure. Repair only bounded, line-level failures: retry a damaged protected-token line once, and retry source-language residue once with a dedicated prompt. Keep structurally unsafe token corruption as a hard failure.

## Context and observations

Early dogfooding showed two different failure classes.

First, translated prose could leave source-language text behind even when Markdown remained structurally valid. Second, allowing protected placeholders to move for natural target-language word order exposed a structural edge case: a heading token could move into the middle of a French sentence, producing text such as `Ce que traite ## PDDR`.

A single rule for every protected token was therefore insufficient. Inline elements may need target-language reordering, while line-leading Markdown syntax must remain structurally anchored.

## Options considered

### Option A: Translate fragmented text around every Markdown token

- Description: keep every protected element fixed and translate only fragments between them.
- Benefits: simple structural preservation.
- Costs / constraints: target-language grammar can become unnatural because the model cannot reorder inline elements with surrounding prose.
- Status: rejected

### Option B: Whole-line translation with protected tokens, bounded repair, and final verification

- Description: translate complete protected lines, allow inline token reordering, validate token multisets, repair bounded failures, restore line-leading Markdown syntax deterministically, and run a final structural verifier.
- Benefits: balances natural target-language grammar with deterministic Markdown safety.
- Costs / constraints: requires a runtime patch and separate repair/verification logic.
- Status: accepted

### Option C: Trust the model to preserve Markdown without deterministic checks

- Description: rely on prompting alone.
- Benefits: simpler implementation.
- Costs / constraints: dogfooding demonstrated token and heading-position failures.
- Status: rejected

## Decision

Use whole-line LLM translation under placeholder protection.

- Inline protected elements may move when target-language grammar requires it.
- Protected-token loss, duplication, or rewriting is invalid.
- Heading, list, and blockquote prefix tokens are deterministically restored to the beginning of the translated line before final assembly.
- Protected-token corruption receives at most one line-level retry and remains a hard failure if still unsafe.
- Configured source-language residue receives at most one line-level retry using a dedicated repair prompt.
- Persistent source residue does not stop generation of later target languages; the final Quality Gate rejects the run so review Artifacts remain available for diagnosis.
- Generic structural verification remains separate from repository-specific semantic checks.

## Delivery and validation

Pull requests #3 through #5 introduced source-residue detection and bounded repair. Pull request #7 added deterministic anchoring for heading/list/blockquote prefixes after dogfooding exposed a heading-position failure.

PDDR Kit run #10 used the corrected pipeline, generated English, Simplified Chinese, Korean, and French outputs, and reported `README translation structural checks passed.` for all four target languages.

## Consequences

- The pipeline is more complex than prompt-only translation.
- Inline grammar can remain natural without allowing Markdown structure to drift.
- Repair attempts consume the same globally guarded request budget as normal translation.
- The final verifier remains authoritative for machine-checkable structure.
- Repository-specific semantic quality remains outside the generic structural verifier.

## Revisit when

Revisit if the pinned upstream translator natively supports equivalent whole-line Markdown semantics, token integrity checks, bounded repair, and structural anchoring without the runtime patch.

## Evidence

- https://github.com/serevy/readme-i18n-kit/pull/3
- https://github.com/serevy/readme-i18n-kit/pull/4
- https://github.com/serevy/readme-i18n-kit/pull/5
- https://github.com/serevy/readme-i18n-kit/pull/7
- https://github.com/serevy/pddr-kit/actions/runs/35642451897

## Related records

- PDDR-0001
- PDDR-0003
- PDDR-0004
