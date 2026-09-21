# readme-i18n-kit

Reusable README translation tooling extracted from a workflow that was first validated on a real public repository.

The kit focuses on Markdown structure protection, terminology preservation, request-rate guards, review-only Artifacts, and a human-review-first publication flow.

> Status: pre-release dogfooding.

## What it does

A caller repository keeps one canonical Markdown README and a small repository-specific config. The reusable workflow translates the canonical README into one configured target language or all target languages in a single run.

The current profile is intentionally opinionated:

- OpenAI Chat Completions
- `gpt-5.6-luna`
- Standard service tier
- relay disabled
- human review before publication
- no automatic commit, push, or merge

The model/provider profile can be generalized later. The first goal is to extract a known working path without weakening its safety boundaries.

## Quick start

Add a consumer config such as `.readme-i18n/config.json`:

```json
{
  "targetLanguages": ["en", "zh-CN", "ko", "fr"],
  "protectedTerms": [
    "Example Product",
    "Project",
    "Product",
    "Process"
  ],
  "glossary": []
}
```

Then add a caller workflow based on [`examples/readme-i18n.yml`](examples/readme-i18n.yml).

For a Japanese canonical README, the reusable workflow call is conceptually:

```yaml
jobs:
  translate:
    uses: serevy/readme-i18n-kit/.github/workflows/translate-readme.yml@main
    with:
      source_language: ja
      target: ${{ inputs.target }}
      config_path: .readme-i18n/config.json
    secrets:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Before a stable release, `@main` is convenient for dogfooding. For production use, pin a reviewed release tag or commit SHA.

## Consumer config

### `targetLanguages`

The target languages supported by that repository.

The canonical source language must not also appear in this list.

### `protectedTerms`

Literal identifiers whose **occurrence count must remain unchanged** between the canonical README and each generated translation. Each protected term is also supplied to the translator as an identity glossary entry.

Use this for names and identifiers that should neither change nor appear spontaneously, such as repository names, version strings, schema/status keys, and unique product names.

Do **not** use `protectedTerms` for ordinary vocabulary that can legitimately appear additional times in a target language. For example, a Japanese source may contain the literal term `Project` three times while an English translation naturally introduces `Project` in other sentences. In that case, put `Project` in `glossary` instead.

### `sourceResiduePatterns`

Optional regular expressions used to catch untranslated source-language text that survives outside fenced code blocks.

For a Japanese canonical README, a practical starting point is:

```json
"sourceResiduePatterns": ["[ぁ-んァ-ヶ]"]
```

This checks for surviving hiragana or katakana without treating Chinese characters alone as proof of Japanese residue.

### `allowedSourceResiduePatterns`

Optional line-level allowlist expressions for source-language text that should remain unchanged, such as an original-language publication title in a bibliography.

If any allowlist expression matches the whole translated line, source residue on that line is accepted.

Example:

```json
"allowedSourceResiduePatterns": [
  "zenn\\.dev/softbank/articles/example"
]
```

### `glossary`

Translation preferences that control terminology without requiring source/target occurrence counts to match.

Use an identity glossary entry when a canonical term should stay unchanged but may legitimately appear additional times in the translated prose.

For example:

```json
{
  "source": "Project",
  "target": "Project"
}
```

Optional translation preferences.

An entry without `targetLang` applies to every selected target language:

```json
{
  "source": "canonical term",
  "target": "preferred translation"
}
```

A language-specific entry can include `targetLang`:

```json
{
  "source": "canonical term",
  "target": "preferred French term",
  "targetLang": "fr"
}
```

See [`config.example.json`](config.example.json).

## Translation pipeline

The reusable workflow:

1. checks out the caller repository;
2. checks out this kit at the exact called-workflow commit;
3. validates the consumer config;
4. estimates a bounded request budget from README size and selected target count;
5. checks out the pinned `md-translator` source;
6. applies the whole-line Markdown patch;
7. translates the selected languages through one translator process;
8. retries one line once if protected Markdown tokens are damaged;
9. verifies Markdown structure and protected terms;
10. uploads the generated files as a review Artifact.

`all` uses every configured target language in the same translator process, so request pacing and request counting remain shared across the full run.

## Quality checks

The generic verifier currently checks:

- protected-term occurrence counts;
- internal placeholder leakage;
- fenced code blocks;
- inline code content;
- Markdown link and image destinations;
- heading hierarchy;
- optional source-language residue outside fenced code blocks.

Inline code and link destinations are compared as multisets so target-language grammar may reorder protected elements without silently deleting or rewriting them.

Repository-specific semantic checks should remain in the consumer repository instead of being hard-coded into this kit.

## Request budget

The kit estimates translatable lines outside fenced code blocks and derives a request ceiling with retry headroom.

A single run is capped at 400 requests. If the estimate exceeds that boundary, preparation fails before sending API requests and the caller should run fewer target languages at once or shorten/split the canonical document.

The reusable job timeout is 60 minutes.

## Security

See [`docs/security.md`](docs/security.md).

Important: repository-scoped GitHub concurrency does not coordinate rate limits across different repositories that share the same provider project.

## Origin

The first implementation was extracted from the multilingual README workflow used by [`serevy/semantic-decision-lab`](https://github.com/serevy/semantic-decision-lab), where the Markdown protection, request guard, multi-language `all` mode, protected-token retry, Artifact review flow, and five-language publication path were exercised before extraction.

The first separate consumer is intended to be [`serevy/pddr-kit`](https://github.com/serevy/pddr-kit), using a Japanese canonical README to test that the kit is not tied to an English source.

## License

[MIT](LICENSE)
