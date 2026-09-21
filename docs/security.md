# Security and trust boundaries

readme-i18n-kit is intentionally conservative. It generates review Artifacts; it does not commit, push, or merge translated files.

## Current trust boundaries

The current workflow:

- checks out the caller repository without persisting checkout credentials;
- checks out this kit at the exact commit that defines the called reusable workflow;
- pins the tested `md-translator` source commit;
- installs translator dependencies with `--frozen-lockfile --ignore-scripts`;
- exposes `OPENAI_API_KEY` only to the translation step;
- writes the key to a mode-0600 temporary settings file and deletes it when the step exits;
- disables the translator relay;
- permits only `POST https://api.openai.com/v1/chat/completions`;
- permits only `gpt-5.6-luna`;
- forces the Standard service tier;
- rejects redirects;
- starts HTTP requests at least eight seconds apart;
- applies a per-run request cap derived from README size and target count;
- retries a line once when protected Markdown tokens are damaged or configured source-language residue remains;
- runs Markdown, protected-term, and source-residue quality checks before uploading the review Artifact.

The request guard protects the pinned translator's global `fetch` path. It is not a complete process sandbox or network sandbox.

## Data handling

The selected translation provider receives the Markdown content sent for translation. Start with public or otherwise appropriate documentation unless you have separately reviewed the provider and dependency data-handling requirements for private content.

## Spend and rate limits

The request cap is a safety ceiling, not a monetary budget.

Use provider-side project budgets or spend limits as the authoritative cost boundary.

GitHub Actions concurrency is repository-scoped. Two different caller repositories can run at the same time even if they share one OpenAI project and its rate limit. Avoid cross-repository overlap or use separate provider projects when necessary.

## Human review

Generated translations are Artifacts for review. Structural checks can catch many forms of Markdown damage, but they do not prove linguistic quality or semantic equivalence.

A human should review translations before publishing them.

## Updating dependencies

The initial implementation deliberately pins the translator source commit and GitHub Actions SHAs. Review updates before changing those pins.
