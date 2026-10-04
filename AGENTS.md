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

## PDDR checkpoints

At these milestones, revisit a bounded set of recent Issues and pull requests against the normal PDDR threshold:

- after a major release, translation-pipeline, or provider-policy phase boundary;
- during an Issue or roadmap audit;
- when multiple Evidence-bearing Issues or pull requests are being closed or consolidated.

### Pending checkpoint marker

PR本文に `## PDDR checkpoint` と `Review: pending` がある場合は、signalに関係するrecent Issues / PRs / Evidenceだけを対象にbounded auditします。

- SignalはPDDR作成義務ではありません。
- routine translation run、failure log、repair attempt、merge completionだけではPDDRへ昇格させません。
- durableなProject / Product / Process判断がなければno-opを正常結果とします。
- review後はPR本文のcurrent stateを `Review: completed` へ更新します。
- 過去のCheck / Job Summaryはsignal発生時点の履歴として扱い、同期更新しません。

At a checkpoint:

- Review only the recent work and existing PDDRs relevant to the milestone.
- Create or update a PDDR only when the evidence produced a durable Project, Product, or Process decision.
- Prefer updating an existing PDDR when it already represents the same decision.
- Do not promote routine translation runs, failure logs, repair attempts, or merge completion itself into a PDDR.
- If no durable decision is found, create nothing; the checkpoint is an audit, not a record quota.

## Validation

Run `python .pddr/pddr.py validate` after changing files under `docs/records/`.

CI validates records without `--allow-empty` so accidental loss of all PDDR records cannot pass silently.

## PDDR CI authoring defaults

Apply these defaults when adding or changing PDDR CI; see the [PDDR Kit adoption guide](https://github.com/serevy/pddr-kit/blob/main/docs/adoption.md) and [Kit issue #47](https://github.com/serevy/pddr-kit/issues/47).

- Set an explicit job timeout. Lightweight PDDR validation, checkpoint, and marker jobs use `timeout-minutes: 5`; justify a different budget from the actual work.
- Cancel superseded validator runs only within the same workflow and pull request. Include the ref and run ID in non-PR groups so separate main or manual runs remain independent.
- Keep checkpoint detection read-only, including PR body and label events and complete base/head comparison. Marker writes use trusted default-branch code in the separate `workflow_run` job, without PR code or artifacts and without cancellation.
- Preserve required-check identities, trigger/path coverage, validation flags, runtime versions, action pins, and permissions. Review those contracts before combining or splitting jobs.
- Add caching, matrices, parallel jobs, or artifacts only when their benefit justifies the extra work. A lightweight validator may share an existing read-only job only after preserving coverage, failure behavior, and check requirements.
- Record job counts and native execution time from normal CI in the PR; separate expected savings from measured results. These defaults retain existing project, review, and publication authority.
