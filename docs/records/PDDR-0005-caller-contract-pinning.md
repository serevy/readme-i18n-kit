---
id: PDDR-0005
title: Keep repository-specific responsibility in the caller and pin reviewed workflow revisions
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
  - https://github.com/serevy/pddr-kit/pull/20
  - https://github.com/serevy/pddr-kit/pull/27
  - https://github.com/serevy/pddr-kit/actions/runs/35642451897
related:
  - PDDR-0001
  - PDDR-0004
supersedes: []
superseded_by: null
---

# PDDR-0005: Keep repository-specific responsibility in the caller and pin reviewed workflow revisions

## Summary

Keep generic translation safety in `readme-i18n-kit` and repository-specific policy in each caller. Production consumers should call a reviewed immutable commit SHA or reviewed release tag rather than silently following a moving branch.

## Context and observations

The reusable kit cannot know every repository's canonical language, protected identifiers, terminology, intentional source-language citations, semantic invariants, publication policy, or provider budget.

PDDR Kit dogfooding also showed an operational property of immutable pins: merging a new `readme-i18n-kit` fix does not change an existing caller until that caller explicitly updates its pin. Several test runs intentionally or accidentally exercised older pins, making the active workflow revision visible and reproducible.

This creates extra update work, but it also prevents a consumer from changing behavior merely because the reusable repository's `main` branch moved.

## Options considered

### Option A: Put repository-specific semantics into the reusable kit

- Description: hard-code consumer terminology, citations, semantic checks, and publication behavior into the shared workflow.
- Benefits: less caller configuration.
- Costs / constraints: couples unrelated repositories and weakens reuse.
- Status: rejected

### Option B: Let production callers track `@main`

- Description: always run the newest reusable workflow.
- Benefits: fixes arrive immediately.
- Costs / constraints: behavior can change without a caller review, and historical runs are harder to reproduce.
- Status: rejected for reviewed production use

### Option C: Keep generic mechanics in the kit and explicit policy/pins in the caller

- Description: caller owns canonical README, language list, terminology, source-residue rules, API secret, repository-specific semantic checks, and publication; kit owns generic generation and structural safety. Caller pins a reviewed revision.
- Benefits: clear responsibility, reproducibility, repository-specific review, controlled upgrades.
- Costs / constraints: consumers must explicitly update their pins to receive fixes.
- Status: accepted

## Decision

The caller/consumer owns:

- canonical source README and source language;
- configured target languages;
- `protectedTerms`, glossary, source-residue patterns, and allowlists;
- the provider API secret and provider-side spending controls;
- repository-specific semantic checks;
- human review and publication of generated translations.

The reusable kit owns generic configuration validation, request guarding, Markdown/literal protection, bounded repair, generic structural Quality Gates, and review Artifact generation.

For reviewed production use, callers pin a reviewed immutable commit SHA or reviewed release tag. The reusable workflow checks out the kit at the exact called-workflow commit. `@main` remains acceptable for explicit dogfooding or development where following moving behavior is intentional.

## Delivery and validation

The reusable contract was introduced in pull request #1.

PDDR Kit pull request #20 added the first separate consumer with a pinned reusable-workflow revision. Subsequent PDDR Kit pull requests explicitly updated that pin as fixes were reviewed; pull request #27 updated the consumer to the identity-glossary fix.

PDDR Kit run #10 recorded the exact reusable-workflow SHA in its logs and successfully completed the four-language translation flow.

## Consequences

- Consumers do not silently receive workflow changes.
- Fix rollout requires an explicit pin-update change in each consumer.
- Repository-specific semantic logic stays out of the generic kit.
- The kit cannot coordinate concurrency across different caller repositories that share one provider project.
- Dependabot or a future dedicated updater may reduce pin-maintenance cost, but any update still needs review.

## Revisit when

Revisit after stable release tagging and consumer-update automation are established, or if the project defines a stronger compatibility contract that safely supports a moving major-version reference.

## Evidence

- https://github.com/serevy/readme-i18n-kit/pull/1
- https://github.com/serevy/pddr-kit/pull/20
- https://github.com/serevy/pddr-kit/pull/27
- https://github.com/serevy/pddr-kit/actions/runs/35642451897

## Related records

- PDDR-0001
- PDDR-0004
