# readme-i18n-kit

Reusable, review-first README translation tooling for GitHub Actions.

Keep one canonical Markdown README, generate one or more target-language READMEs, protect Markdown structure and literal terminology, and review the resulting Artifact before publication.

> Status: pre-release. The workflow has been dogfooded on public repositories including `semantic-decision-lab` and `pddr-kit`; PDDR Kit used it from a Japanese canonical README to generate four target languages before human-reviewed five-language publication.

## Why this exists

README translation is not only a language problem.

A useful repository workflow also needs to preserve:

- Markdown structure, links, inline code, and fenced blocks;
- repository/product identifiers and terminology;
- target-language word order around protected Markdown;
- bounded request/rate behavior;
- failure diagnostics and partial review outputs;
- a human checkpoint before publication.

`readme-i18n-kit` packages those concerns into a reusable GitHub Actions workflow.

## Current profile

The initial runtime profile is intentionally narrow:

- OpenAI Chat Completions;
- `gpt-5.6-luna`;
- Standard service tier;
- relay disabled;
- pinned `md-translator` source;
- bounded request pacing/cap;
- review Artifact output;
- no automatic commit, push, merge, or publication.

Provider/model generalization is intentionally deferred until the current safety and review contract is stable.

## Start here

- **Install it:** [`docs/setup.md`](docs/setup.md)
- **Run, review, and publish:** [`docs/usage.md`](docs/usage.md)
- **Diagnose failures:** [`docs/troubleshooting.md`](docs/troubleshooting.md)
- **Understand trust boundaries:** [`docs/security.md`](docs/security.md)
- **Understand design decisions:** [`docs/records/`](docs/records/)

## Quick start

### 1. Add a consumer config

Create `.readme-i18n/config.json`:

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
    }
  ],
  "sourceResiduePatterns": ["[ぁ-んァ-ヶ]"],
  "allowedSourceResiduePatterns": []
}
```

This example assumes a Japanese canonical README. Do not copy the Japanese residue pattern for a different source language.

### 2. Add the caller workflow

Start from [`examples/readme-i18n.yml`](examples/readme-i18n.yml).

For reviewed use, pin the reusable workflow to an intentionally reviewed release tag or immutable commit SHA rather than silently following `@main`.

### 3. Add the API secret

Create the caller repository's GitHub Actions secret:

```text
OPENAI_API_KEY
```

The current workflow requires OpenAI API billing separately from any ChatGPT subscription. See [setup](docs/setup.md) for the full prerequisite and secret flow.

### 4. Run and review

Run the caller workflow manually for one target or `all`.

The workflow generates files such as:

```text
README.en.md
README.zh-CN.md
README.ko.md
README.fr.md
```

and uploads them as a review Artifact.

Human review comes before publication.

## Configuration concepts

### `protectedTerms`

Use for literal identifiers whose occurrence count must remain unchanged.

Examples:

- product/repository names;
- version strings;
- CLI names;
- schema/status keys.

These terms are masked before LLM translation and checked again by the final verifier.

### `glossary`

Use for terminology preferences that do not require equal source/target occurrence counts.

Identity entries where `source == target` are handled as mask-only literal terms.

Non-identity entries where `source != target` remain translation preferences and are passed to glossary enforcement.

### Source residue rules

`sourceResiduePatterns` can detect untranslated source-language prose outside fenced code blocks.

`allowedSourceResiduePatterns` can allow intentional source-language text on matching lines.

The allowlist is line-level, so keep patterns narrow.

See [setup](docs/setup.md) for the complete config reference.

## Safety and quality model

The generic workflow separates three concerns:

1. **generation** — translate complete protected Markdown lines;
2. **machine checks** — preserve configured Markdown/terminology invariants;
3. **human publication review** — decide whether language quality and meaning are good enough to publish.

The final generic verifier checks:

- protected-term occurrence counts;
- internal placeholder leakage;
- fenced code blocks;
- inline code content;
- Markdown link/image destinations;
- heading hierarchy;
- configured source-language residue outside fenced code blocks.

A green run means those configured machine checks passed. It does **not** prove linguistic quality or semantic equivalence.

## Repair behavior

The workflow uses bounded line-level repair instead of unbounded retries.

- protected-token corruption: retry once, then hard-fail if still structurally unsafe;
- configured source-language residue: retry once with a dedicated repair prompt;
- persistent residue: continue generating later languages, then fail the final Quality Gate so the review Artifact can retain diagnostic outputs;
- heading/list/blockquote prefix tokens: restore deterministically to the beginning of the line if an LLM reorders them.

Literal identity terms are masked before translation and restored afterward. Identity entries are deliberately excluded from post-translation glossary enforcement to avoid collisions such as French `ci` being rewritten by an identity term `CI → CI`.

## Request controls

The workflow:

- derives a request ceiling from translatable lines and selected target count;
- caps a single run at 400 requests;
- spaces request starts by at least eight seconds;
- counts failed attempts against the request cap;
- shares pacing/counting across languages in an `all` run;
- times out the reusable job after 60 minutes.

The request cap is a safety ceiling, not a monetary budget. Provider-side spend controls remain authoritative.

GitHub concurrency is repository-scoped: different caller repositories can still overlap against the same provider project.

## Caller vs kit responsibility

The caller repository owns:

- canonical source README and source language;
- target languages;
- protected terms, glossary, residue rules, and allowlists;
- API secret and provider-side spending controls;
- repository-specific semantic checks;
- human review and publication.

The kit owns:

- generic config validation;
- request guards;
- Markdown/literal protection;
- bounded repair;
- generic structural Quality Gates;
- review Artifact generation.

This split is recorded in [PDDR-0005](docs/records/PDDR-0005-caller-contract-pinning.md).

## Project decisions

Important Project, Product, and Process decisions are recorded in [`docs/records/`](docs/records/).

Detailed implementation work, translation runs, failure investigation, and raw results stay in Issues and pull requests. PDDR keeps the decision-relevant rationale and Evidence that should remain understandable afterward.

Validate records with:

```bash
python .pddr/pddr.py validate
```

This repository uses [PDDR Kit](https://github.com/serevy/pddr-kit) v0.2.1.

It also uses the hardened optional checkpoint CI. The PR-head signal workflow is read-only, while marker writes are handled by a trusted default-branch writer. A checkpoint signal requests a bounded review; it does not require creating a PDDR, and routine translation runs, failure investigation, repair attempts, or merge completion are not promoted automatically.

## Origin and dogfooding

The first implementation was extracted from the multilingual README workflow used by [`serevy/semantic-decision-lab`](https://github.com/serevy/semantic-decision-lab).

The first separate consumer, [`serevy/pddr-kit`](https://github.com/serevy/pddr-kit), used a Japanese canonical README to exercise the reusable workflow independently. Its dogfooding exposed and helped validate source-residue repair, literal identity masking, Markdown-prefix anchoring, identity-glossary isolation, Artifact review, and human-reviewed multilingual publication.

## License

[MIT](LICENSE)
