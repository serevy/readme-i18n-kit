# PDDR records

Project Design Decision Records for this repository live in this directory. Create a record from `.pddr/template.md` and validate it with `python .pddr/pddr.py validate`.

Use Issues and pull requests for detailed work logs, experiments, intermediate observations, and raw results. Use PDDR for important Project, Product, or Process decisions whose rationale should remain understandable after that work is closed.

## Current records

- [PDDR-0001: Review-only translation artifacts and human publication](PDDR-0001-review-artifacts-human-publication.md)
- [PDDR-0002: Protect Markdown structure and repair only bounded line failures](PDDR-0002-markdown-structure-repair.md)
- [PDDR-0003: Separate literal identity masking from translation glossary enforcement](PDDR-0003-literal-mask-glossary.md)
- [PDDR-0004: Keep the initial provider profile narrow and enforce runtime request guards](PDDR-0004-runtime-security-boundary.md)
- [PDDR-0005: Keep repository-specific responsibility in the caller and pin reviewed workflow revisions](PDDR-0005-caller-contract-pinning.md)
