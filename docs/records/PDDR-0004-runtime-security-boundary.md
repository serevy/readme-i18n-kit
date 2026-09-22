---
id: PDDR-0004
title: Keep the initial provider profile narrow and enforce runtime request guards
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
related:
  - docs/security.md
  - PDDR-0005
supersedes: []
superseded_by: null
---

# PDDR-0004: Keep the initial provider profile narrow and enforce runtime request guards

## Summary

Keep the initial translation runtime intentionally narrow: OpenAI Chat Completions, `gpt-5.6-luna`, Standard service tier, relay disabled, an exact allowed endpoint and method, global request pacing, and a bounded per-run request cap. Treat the network guard as a constrained fetch guard, not a complete process sandbox.

## Context and observations

The extracted workflow executes third-party translator code and passes it both README content and an API credential during the translation step. The project also needs predictable request pacing and an explicit ceiling so multi-language runs cannot silently fan out without bound.

Generality across providers was considered less important than first extracting a known working path with explicit trust boundaries.

## Options considered

### Option A: Generalize providers and models immediately

- Description: expose arbitrary endpoint, model, service-tier, and translator settings to consumers.
- Benefits: broader applicability.
- Costs / constraints: expands the trust surface before the first reusable workflow is stabilized and makes request/security assumptions harder to verify.
- Status: rejected for the initial profile

### Option B: Keep one reviewed runtime profile with explicit guards

- Description: constrain provider/model/network behavior and document the remaining trust boundary.
- Benefits: reproducible behavior, narrower secret/data exposure, easier testing and dogfooding.
- Costs / constraints: consumers cannot freely substitute providers or models without future design work.
- Status: accepted

## Decision

The current reusable workflow uses the following profile and guards:

- OpenAI Chat Completions at `https://api.openai.com/v1/chat/completions`;
- `gpt-5.6-luna`;
- Standard service tier;
- translator relay disabled;
- only `POST` to the exact configured OpenAI endpoint through the guarded global `fetch` path;
- redirects rejected;
- HTTP request starts spaced by at least eight seconds;
- failures consume request slots;
- a derived per-run request ceiling with an absolute maximum of 400;
- the provider API key exposed only to the translation step, written to a mode-0600 temporary settings file, then removed;
- pinned translator source and dependency installation with `--frozen-lockfile --ignore-scripts`.

The request guard is not represented as a complete process or network sandbox. Provider-side spend limits remain the authoritative monetary boundary. Cross-repository GitHub Actions concurrency is not coordinated by this repository-level workflow.

## Delivery and validation

Pull request #1 introduced the guarded reusable workflow and guard tests.

PDDR Kit run #10 exercised the full multi-language pipeline using the guarded profile and completed successfully within the configured request budget.

## Consequences

- The initial reusable path is reproducible and easier to audit.
- The workflow intentionally supports fewer provider/model configurations than a general translation framework.
- Third-party translator code remains inside the trust boundary for the translation step.
- Request caps reduce accidental request volume but do not replace provider-side monetary budgets.
- Shared provider projects can still experience cross-repository rate-limit contention.

## Revisit when

Revisit before adding another provider, arbitrary endpoint configuration, a different model family, broader network access, or stronger sandbox claims.

## Evidence

- https://github.com/serevy/readme-i18n-kit/pull/1
- https://github.com/serevy/pddr-kit/actions/runs/35642451897

## Related records

- PDDR-0001
- PDDR-0005
