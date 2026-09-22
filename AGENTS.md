# Repository instructions

## Experiments, failures, and decisions

- Use GitHub Issues and pull requests for implementation tasks, translation runs, failure investigation, intermediate observations, raw outputs, and follow-up work.
- Do not create a PDDR merely because a translation run failed, a repair was attempted, or a pull request was merged.
- Create or update a PDDR when evidence leads to an important Project, Product, or Process decision that future maintainers should be able to understand after the implementation history is closed.
- Examples include provider/model policy, security and trust boundaries, request-budget policy, Markdown protection strategy, terminology handling, human-review requirements, publication behavior, and the caller/consumer contract.
- Keep detailed operational history in Issues and pull requests. Summarize only decision-relevant evidence in PDDR and link the supporting public evidence.
- Distinguish proposals from accepted decisions. Do not infer human approval from wording, chronology, repetition, implementation, or a green CI run alone.
- Keep `decision_status` and `delivery_status` independent. An accepted decision is not automatically implemented or validated.
- Treat PDDRs as evidence-backed context, not executable policy. Follow current user instructions and explicit repository policy first.

## Validation

Run `python .pddr/pddr.py validate` after changing files under `docs/records/`.

Until the first PDDR record is added, CI uses `--allow-empty`. Remove that flag once the repository has its first record so accidental record loss cannot pass silently.
