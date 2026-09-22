# Troubleshooting

Start with the failing GitHub Actions step. The workflow is intentionally split so configuration, translation, structural verification, and Artifact upload are distinguishable.

## A merged kit fix does not appear to be active

Check the reusable workflow revision shown in the job header/log.

A consumer pinned to an immutable SHA continues to use that SHA until the caller workflow is updated. Merging a fix into `readme-i18n-kit` does not automatically change existing consumers.

This is expected behavior, not a cache problem.

## `Prepare translation configuration` fails

Common causes:

- the canonical source file does not exist;
- the consumer config path is wrong;
- JSON or regex configuration is invalid;
- the canonical source language also appears in `targetLanguages`;
- the selected target is not configured;
- the derived request budget exceeds 400.

Fix the configuration before rerunning. Preparation failures occur before translation API requests are sent.

## `OPENAI_API_KEY is required`

Confirm that the caller repository has a GitHub Actions secret named exactly:

```text
OPENAI_API_KEY
```

Do not print or paste the secret into logs while debugging.

## Authentication or permission failure during translation

Check the API project/key configuration and whether the key can access the endpoint/model required by the current workflow profile.

The workflow stops queued requests after authentication/authorization failures rather than continuing to spend request slots on later calls.

## Rate limit / 429

The request guard spaces request starts and respects server retry guidance when available, but provider-side limits still apply.

If multiple repositories share one provider project, repository-scoped GitHub concurrency does not coordinate them. Avoid overlapping runs or separate the provider projects if necessary.

## `protected token mismatch ... retrying once`

The model changed, lost, or duplicated protected Markdown/literal placeholders.

The kit retries that source line once. If token integrity is still unsafe afterward, translation fails rather than assembling structurally unsafe Markdown.

Inspect the source line and the surrounding Markdown if this happens repeatedly.

## `source-language residue ... retrying once`

A generated line matched a configured `sourceResiduePatterns` rule.

The retry uses a dedicated prompt asking for the remaining source-language prose to be translated while preserving protected tokens.

If residue still remains, the kit keeps the candidate so later languages can continue generating, then the final Quality Gate rejects the run.

Check:

- whether the text is genuinely untranslated prose;
- whether it should instead be intentionally allowlisted;
- whether the residue regex is too broad;
- whether a literal identity term should be represented in `protectedTerms` or `glossary`.

## The residue allowlist hides too much

`allowedSourceResiduePatterns` is line-level.

If any allowlist regex matches a translated line, source residue on that line is accepted. Keep allowlist expressions specific to the intended citation, URL, title, or literal.

## Final verifier fails

The generic verifier checks:

- protected-term occurrence counts;
- internal placeholder leakage;
- fenced code blocks;
- inline code content;
- Markdown link/image destinations;
- heading hierarchy;
- configured source-language residue outside fenced code blocks.

A failure here means the generated file does not satisfy a configured machine invariant.

Inspect the Artifact before changing the verifier. Do not weaken a generic structural check merely to make one translation pass.

## A fenced code block is still in the source language

That is expected. Fenced code blocks are preserved as structural content and are not translated.

If a prose explanation needs translation, keep it outside the fence.

## The translation is awkward even though the run is green

This is expected to be possible.

The Quality Gate checks machine-verifiable structure and configured invariants; it does not prove linguistic quality or semantic equivalence.

Correct the generated README during human review before publication. If the problem is systematic and generic, improve the kit. If it is repository-specific, keep the rule or correction in the caller.

## An identity term changes unrelated target-language text

Current kit revisions keep `source == target` glossary entries out of translator glossary enforcement and protect them with literal masking.

If you still see a collision:

1. confirm the caller is pinned to a revision containing the identity-mask behavior;
2. inspect whether the term is configured as a non-identity glossary entry;
3. consider whether the literal term is too short or ambiguous;
4. capture a minimal reproducible source line before changing generic behavior.

## Artifact is missing or incomplete

The upload step runs with `if: always()`.

- If some target files were generated before failure, they can appear in the Artifact.
- If translation failed before any output file existed, the upload step can only warn that no files were found.
- A single-language or partially completed run should not be mistaken for a complete `all` publication set.

## Before opening a generic bug

Capture:

- caller repository revision;
- called `readme-i18n-kit` SHA;
- selected target;
- failing step;
- relevant non-secret log lines;
- minimal source Markdown that reproduces the issue;
- relevant consumer config entries with secrets removed.

Do not include API keys or other credentials in an issue.
