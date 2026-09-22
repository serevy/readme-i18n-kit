# Usage

This guide covers normal operation after [setup](setup.md).

The central rule is simple:

> A green workflow means the configured machine checks passed. It does not mean the translation is ready to publish without human review.

That separation was validated during PDDR Kit dogfooding: a four-language run passed all structural checks, then human review still found language-quality issues that were corrected before publication.

## Run one language or all languages

The caller workflow can request:

- one language listed in `targetLanguages`; or
- `all`.

Using `all` runs every configured target language through the same translator process, so global request pacing and request counting are shared across the run.

For large canonical READMEs, preparation may reject an `all` run before API access if the derived request budget would exceed the hard ceiling. In that case, run fewer target languages at once or shorten/split the canonical document.

## Generated file names

For a canonical file:

```text
README.md
```

a target language such as `fr` is generated as:

```text
README.fr.md
```

The same stem/extension rule applies to other source file names.

## Review Artifact

The workflow uploads a review Artifact named:

```text
<artifact_prefix>-<target>
```

For example:

```text
readme-all
readme-fr
```

Artifacts are retained for 7 days by the current reusable workflow.

The upload step uses `if: always()`. If a run fails after some outputs were generated, the Artifact can still contain partial translations for diagnosis. If failure occurs before any output exists, the upload step warns that no files were found.

## Human review checklist

Before publishing a generated README, review at least:

- meaning: does the translation preserve the source claim rather than merely sounding fluent?
- terminology: are product names, identifiers, and preferred terms correct?
- source residue: is untranslated prose intentional?
- Markdown: do headings, lists, links, inline code, and fenced blocks render correctly?
- code fences: fenced code is intentionally preserved rather than translated;
- references: are names, titles, citations, and URLs represented as intended?
- grammar: check target-language particles, articles, spacing, punctuation, and word order;
- language switchers: verify links and the active-language label;
- repository-specific semantics: apply any checks the generic verifier cannot know.

Do not infer linguistic quality from a green structural Quality Gate.

## Publish through a reviewed repository change

After human review:

1. correct the generated files as needed;
2. add or update the translated README files in a normal branch;
3. review the diff;
4. publish through the caller repository's normal pull-request/merge process.

The translation workflow deliberately has `contents: read` and does not publish for you.

## Language switchers

If the canonical README contains a language switcher, preserve language labels intentionally.

A label that must remain unchanged but may appear naturally in target prose is usually better represented as an identity glossary entry than as a `protectedTerm`, because `protectedTerms` also enforce equal occurrence counts.

Example:

```json
{
  "source": "Français",
  "target": "Français"
}
```

Identity glossary entries are mask-only and are not passed to post-translation glossary enforcement.

## Update a consumer to a new kit revision

Production consumers should run a reviewed immutable commit SHA or reviewed release tag.

To update:

1. review the new `readme-i18n-kit` revision and its relevant decision/security changes;
2. update the `uses:` pin in the caller workflow;
3. merge that change through the caller repository's normal review process;
4. run a translation;
5. confirm the job header/log shows the expected reusable-workflow revision.

A merged fix in `readme-i18n-kit` does not change an existing consumer until its pin is updated. This is intentional.

## Tune terminology

Choose the mechanism based on the guarantee you need:

| Need | Configuration |
|---|---|
| Exact literal identifier and equal occurrence count | `protectedTerms` |
| Preserve a literal term without equal-count enforcement | identity `glossary` entry |
| Prefer a translated target term | non-identity `glossary` entry |
| Detect untranslated source prose | `sourceResiduePatterns` |
| Allow intentional source prose on specific lines | `allowedSourceResiduePatterns` |

Keep short identity terms deliberate. Literal masking protects exact source occurrences, but very short strings can still be poor configuration choices if they appear as substrings inside unrelated source words.

## Translation pipeline

The reusable workflow currently:

1. checks out the caller repository without persisted credentials;
2. checks out `readme-i18n-kit` at the exact called-workflow revision;
3. validates the consumer config;
4. estimates a bounded request budget;
5. checks out the pinned `md-translator` source;
6. applies the tested whole-line Markdown patch;
7. masks literal identity terms;
8. translates the selected languages;
9. restores leading heading/list/blockquote syntax when the model reorders it;
10. restores literal terms and Markdown placeholders;
11. retries one line once for protected-token corruption or configured source-language residue;
12. runs the final generic verifier;
13. uploads the review Artifact.

Protected-token corruption remains a hard failure if it is still unsafe after the bounded retry.

Persistent source residue is kept for the final Quality Gate so later target languages can still be generated and included in the diagnostic Artifact.

## Request budget and concurrency

The kit derives a request ceiling from translatable lines and selected target count, with retry headroom.

- maximum per run: 400 requests;
- reusable job timeout: 60 minutes;
- requests are globally paced within one translation process;
- repository-scoped concurrency prevents overlapping README translation runs inside one caller repository.

Concurrency is not coordinated across different repositories. Two callers sharing one provider project can still contend for the same provider rate limit.

Provider-side budgets or spend limits remain the authoritative monetary boundary.

## If a run fails

See [troubleshooting.md](troubleshooting.md).

Do not repeatedly rerun a deterministic configuration or structure failure without first inspecting the failing step and Artifact.
