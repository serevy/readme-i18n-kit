---
id: PDDR-0003
title: Separate literal identity masking from translation glossary enforcement
decision_date: 2026-09-21
recorded_date: 2026-09-22
decision_status: accepted
delivery_status: validated
scope:
  - product
  - process
owners: []
evidence:
  - https://github.com/serevy/readme-i18n-kit/pull/2
  - https://github.com/serevy/readme-i18n-kit/pull/6
  - https://github.com/serevy/readme-i18n-kit/pull/8
  - https://github.com/serevy/pddr-kit/pull/28
related:
  - PDDR-0002
supersedes: []
superseded_by: null
---

# PDDR-0003: Separate literal identity masking from translation glossary enforcement

## Summary

Treat literal identity terms and translation preferences as different mechanisms. Protect literal terms by masking them before LLM translation and restoring them afterward. Send only non-identity glossary entries to translator glossary enforcement.

## Context and observations

The initial configuration distinguished `protectedTerms` from `glossary`, but identity entries such as `CI -> CI` were still supplied to the translator glossary.

Dogfooding showed two problems.

Mixed lines containing literal English identifiers and Japanese prose could remain partly untranslated. Literal masking solved that by removing identity terms from the model's translation decision.

Later human review found `celui-CI` in French output. The intended French `celui-ci` had been changed by case-insensitive post-translation glossary enforcement for the identity entry `CI -> CI`. This showed that identity preservation and translation glossary enforcement must not share the same mechanism.

## Options considered

### Option A: Use the translator glossary for all protected and identity terms

- Description: represent every preserved term as an identity glossary entry.
- Benefits: one terminology mechanism.
- Costs / constraints: case-insensitive leak-through can rewrite ordinary target-language text; mixed literal/prose lines can still influence model behavior.
- Status: rejected

### Option B: Mask literal identities and reserve glossary enforcement for actual translation preferences

- Description: mask `protectedTerms` and `source == target` glossary entries before translation; restore them afterward; pass only `source != target` entries to glossary enforcement.
- Benefits: literal preservation is deterministic and short identity terms cannot rewrite unrelated generated prose through glossary leak-through.
- Costs / constraints: the configuration has two terminology semantics that must be documented clearly.
- Status: accepted

## Decision

Use two terminology paths.

1. `protectedTerms` are literal identities whose source/target occurrence count is verified and whose occurrences are masked during translation.
2. Glossary entries where trimmed `source == target` are also treated as mask-only literal identities, but they are not subject to protected-term occurrence-count equality.
3. Only non-identity glossary entries where `source != target` are passed to the translator's glossary prompt and post-translation enforcement.

Literal terms are sorted longest-first before masking to reduce containment collisions.

## Delivery and validation

Pull request #6 introduced literal identity masking after repeated mixed-line source residue in PDDR Kit dogfooding.

Pull request #8 removed identity entries from translator glossary enforcement and added regression tests proving that identity terms appear in literal-mask metadata but not in translator glossary terms, while non-identity terminology preferences remain enforced.

The `celui-CI` artifact found during PDDR Kit human review was corrected before publication in PDDR Kit pull request #28.

## Consequences

- Literal identity preservation no longer depends on LLM compliance or case-insensitive glossary replacement.
- Non-identity terminology preferences continue to use translator glossary enforcement.
- Consumer documentation must explain the difference between occurrence-count-protected terms and identity glossary entries.
- Very short or ambiguous literal terms can still deserve careful configuration review because masking operates on literal source text.

## Revisit when

Revisit if upstream terminology handling offers boundary-aware, case-aware identity preservation that can provide equivalent guarantees without post-translation collisions.

## Evidence

- https://github.com/serevy/readme-i18n-kit/pull/2
- https://github.com/serevy/readme-i18n-kit/pull/6
- https://github.com/serevy/readme-i18n-kit/pull/8
- https://github.com/serevy/pddr-kit/pull/28

## Related records

- PDDR-0002
- PDDR-0004
