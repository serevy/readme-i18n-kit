---
id: PDDR-0001
title: Review-only translation artifacts and human publication
decision_date: 2026-09-21
recorded_date: 2026-09-22
decision_status: accepted
delivery_status: validated
scope:
  - project
  - process
owners: []
evidence:
  - https://github.com/serevy/readme-i18n-kit/pull/1
  - https://github.com/serevy/pddr-kit/actions/runs/35642451897
  - https://github.com/serevy/pddr-kit/pull/28
related:
  - docs/security.md
supersedes: []
superseded_by: null
---

# PDDR-0001: Review-only translation artifacts and human publication

## Summary

Generated translations are review artifacts, not publication actions. The workflow does not automatically commit, push, merge, or replace published README files. A human reviews generated translations before publication.

## Context and observations

README translation can preserve Markdown structure and still produce linguistically awkward or semantically undesirable output. During PDDR Kit dogfooding, the automated Quality Gate reached green while later human review still found issues such as unnatural wording, Korean particle artifacts, and a French `ci` / `CI` terminology collision.

The repository therefore needs to distinguish machine-checkable structural safety from publication-quality language review.

## Options considered

### Option A: Automatically commit or merge generated translations

- Description: write generated README files back to the caller repository after a successful workflow.
- Benefits: minimal manual publication work.
- Costs / constraints: a structurally valid translation could be published before linguistic or semantic review.
- Status: rejected

### Option B: Upload review artifacts and require human publication

- Description: generate translations, run Quality Gates, upload the outputs as an Artifact, and leave repository publication to a later reviewed change.
- Benefits: keeps automation useful while preserving a human checkpoint for language quality and repository intent.
- Costs / constraints: publication remains a separate manual or reviewed step.
- Status: accepted

### Option C: Avoid automated translation

- Description: translate README files entirely by hand.
- Benefits: maximum direct control over wording.
- Costs / constraints: loses repeatable structural checks, request controls, and reusable multi-language generation.
- Status: rejected

## Decision

Use review-only Artifacts as the output of translation runs. Do not grant the translation workflow repository write permissions or automatic publication behavior. Human review is required before translated README files are published.

A green structural Quality Gate is evidence that configured machine checks passed; it is not proof of linguistic quality or semantic equivalence.

## Delivery and validation

The reusable workflow introduced in pull request #1 uses review Artifacts and does not commit, push, or merge generated files.

PDDR Kit run #10 successfully generated four target languages and passed all configured structural checks. The resulting Artifact was then human-reviewed and corrected before the five-language README publication in PDDR Kit pull request #28.

This validates the intended separation between automated generation/checking and human publication.

## Consequences

- Translation automation can remain conservative with `contents: read`.
- Human review can catch quality issues outside the generic verifier's scope.
- Publication requires an additional reviewed change.
- This decision does not imply that human review guarantees perfect translation; it preserves a required checkpoint before publication.

## Revisit when

Revisit if the project introduces a separately reviewed publication mode, such as creating a draft pull request without merging it, and that mode preserves equivalent trust and review boundaries.

## Evidence

- https://github.com/serevy/readme-i18n-kit/pull/1
- https://github.com/serevy/pddr-kit/actions/runs/35642451897
- https://github.com/serevy/pddr-kit/pull/28

## Related records

- PDDR-0002
- PDDR-0004
- PDDR-0005
