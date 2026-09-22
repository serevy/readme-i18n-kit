# Setup

This guide connects a repository with one canonical Markdown README to the reusable `readme-i18n-kit` workflow.

For day-to-day operation after setup, see [usage.md](usage.md). For trust boundaries, see [security.md](security.md).

## Prerequisites

You need:

- a GitHub repository with GitHub Actions enabled;
- one canonical Markdown README, such as `README.md`;
- an OpenAI API project with API billing configured;
- an API key that can call the Chat Completions endpoint used by the workflow.

OpenAI API billing is separate from ChatGPT subscriptions. See the OpenAI billing documentation if you have not configured API billing yet:

https://help.openai.com/en/articles/9039756

The current workflow profile is intentionally fixed to OpenAI Chat Completions with `gpt-5.6-luna`, Standard service tier, and relay disabled.

## 1. Add the API key as a GitHub Actions secret

In the caller repository:

1. Open **Settings**.
2. Open **Secrets and variables** → **Actions**.
3. Create a repository secret named exactly:

```text
OPENAI_API_KEY
```

Do not put the key in the README, workflow YAML, consumer config, issue, pull request, or logs.

The reusable workflow exposes this secret only to the translation step, writes it to a mode-0600 temporary settings file, and deletes that file when the step exits.

## 2. Add the consumer config

Create:

```text
.readme-i18n/config.json
```

A Japanese-canonical example:

```json
{
  "targetLanguages": ["en", "zh-CN", "ko", "fr"],
  "protectedTerms": [
    "Example Product",
    "example-cli",
    "needs-confirmation",
    "v1.0.0"
  ],
  "glossary": [
    {
      "source": "Project",
      "target": "Project"
    },
    {
      "source": "Process",
      "target": "Process"
    },
    {
      "source": "canonical term",
      "target": "preferred translation",
      "targetLang": "en"
    }
  ],
  "sourceResiduePatterns": ["[ぁ-んァ-ヶ]"],
  "allowedSourceResiduePatterns": []
}
```

The canonical source language must not also appear in `targetLanguages`.

### `protectedTerms`

Use `protectedTerms` for literal identifiers whose **occurrence count must remain unchanged** between source and translation.

Good examples:

- repository or product names;
- version strings;
- CLI names;
- schema/status keys;
- unique identifiers.

These terms are masked before LLM translation and restored afterward. The final verifier checks that the source and translation contain the same number of occurrences.

Do not use `protectedTerms` for ordinary vocabulary that a target language may naturally introduce additional times.

### `glossary`

Use `glossary` for terminology preferences that do not require source/target occurrence counts to match.

Identity entries:

```json
{
  "source": "Project",
  "target": "Project"
}
```

are treated as **mask-only literal terms**. They are not passed to case-insensitive glossary enforcement. This avoids collisions such as an identity term `CI → CI` rewriting ordinary French `ci`.

Non-identity entries such as:

```json
{
  "source": "canonical term",
  "target": "preferred French term",
  "targetLang": "fr"
}
```

remain translation preferences and are passed to glossary enforcement.

### `sourceResiduePatterns`

These optional regular expressions detect untranslated source-language prose outside fenced code blocks.

For a Japanese canonical README, a practical starting point is:

```json
"sourceResiduePatterns": ["[ぁ-んァ-ヶ]"]
```

This catches surviving hiragana or katakana without treating Han characters alone as proof of Japanese residue.

Do not copy this pattern for a non-Japanese source. Choose patterns appropriate to the canonical language, or leave the array empty when a safe generic detector is not available.

### `allowedSourceResiduePatterns`

These optional regular expressions allow intentional source-language text on matching lines, for example an original-language bibliography entry.

The allowlist is **line-level**. Keep patterns narrow: a broad match can also allow unrelated residue on the same line.

See [`config.example.json`](../config.example.json) for the repository example.

## 3. Add the caller workflow

Create a caller workflow such as:

```text
.github/workflows/readme-i18n.yml
```

Start from [`examples/readme-i18n.yml`](../examples/readme-i18n.yml).

The important part is the reusable workflow call:

```yaml
jobs:
  translate:
    uses: serevy/readme-i18n-kit/.github/workflows/translate-readme.yml@457aa521b827c8403fceb6567fdabb00759badec
    with:
      source_file: README.md
      source_language: ja
      target: ${{ inputs.target }}
      config_path: .readme-i18n/config.json
      artifact_prefix: readme
    secrets:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

The SHA above is a reviewed repository revision at the time this guide was written. Before adopting it, review the current repository state and intentionally choose the release tag or immutable commit SHA you want to run.

For reviewed production use, do not silently follow a moving `@main` reference. The caller should explicitly update its pin after reviewing a new kit revision.

## 4. Match the workflow choices to the config

If the caller workflow exposes a target choice, its options should match `targetLanguages` plus `all`.

For example:

```yaml
options:
  - all
  - en
  - zh-CN
  - ko
  - fr
```

If the canonical README is English, change both the consumer config and `source_language`; do not leave `en` in `targetLanguages`.

## 5. Run the first translation

Open the caller repository's **Actions** tab, select the README i18n workflow, choose one target language or `all`, and run it manually.

A successful run:

1. validates the consumer config;
2. derives a bounded request budget;
3. translates the selected language(s);
4. validates generic Markdown structure and configured terminology/residue rules;
5. uploads a review Artifact.

The workflow does **not** commit, push, merge, or publish translated files.

Proceed to [usage.md](usage.md) for the review and publication flow.

## Optional repository-specific checks

The reusable verifier intentionally stays generic. If a repository has semantic invariants that are not represented by Markdown structure, protected terms, or residue rules, keep those checks in the caller repository.

Examples might include project-specific wording requirements, required sections, or domain-specific consistency checks.

## Security before first use

Read [security.md](security.md) before running the workflow with private or sensitive content.

The selected translation provider receives the Markdown content sent for translation, and the third-party translator process is inside the translation-step trust boundary. The fetch guard narrows the tested network path but is not a complete process or network sandbox.
