---
id: PDDR-0006
title: Add advisory checkpoint CI without promoting routine translation work
decision_date: 2026-09-24
recorded_date: 2026-09-24
decision_status: accepted
delivery_status: implemented
scope:
  - project
  - process
owners:
  - serevy
evidence:
  - "Maintainer approved early adoption of hardened checkpoint CI, 2026-09-24 (private)"
  - "https://github.com/serevy/pddr-kit/releases/tag/v0.2.1"
  - ".pddr/pddr_checkpoint.py"
  - ".github/workflows/pddr-checkpoint.yml"
  - ".github/workflows/pddr-checkpoint-marker.yml"
related:
  - PDDR-0001
  - PDDR-0004
  - PDDR-0005
supersedes: []
superseded_by: null
---

# PDDR-0006: Add advisory checkpoint CI without promoting routine translation work

## Summary

readme-i18n-kitで重要なProcess / Product判断の取りこぼしを減らすため、PDDR Kit v0.2.1のoptional checkpoint CIをadvisory safety netとして導入する。

routine translation run、failure log、repair attempt、merge completionだけをPDDRへ自動昇格させない。

## Context and observations

- readme-i18n-kitはprovider policy、security boundary、publication behavior、caller contractなどdurableな判断を持つ。
- 一方、日常のtranslation runやrepairは頻度が高く、それ自体をPDDR化するとnoiseになる。
- AGENTS.mdには既にmilestone checkpoint guidanceがあるが、Agent Skillが常時activeでない変更経路ではcheckpoint実行を取りこぼす可能性がある。
- PDDR Kit v0.2.1では、PR headを観測するread-only signal workflowとtrusted default-branch marker writerへ権限分離されたCheckpoint CIが提供されている。

## Options considered

### Existing AGENTS guidanceだけを使う

- Benefits: workflow追加なし。
- Costs / constraints: Agent contextが読み込まれない変更経路でcheckpoint signalが残らない。
- Status: rejected as the only mechanism

### translation failureやrepairを自動PDDR候補にする

- Benefits: operational eventsを広く拾える。
- Costs / constraints: existing record thresholdを壊し、routine noiseを増やす。
- Status: rejected

### High-confidence advisory Checkpoint CIを追加する

- Benefits: durable decision候補のreview漏れを補完しつつ、routine translation workを昇格させない。
- Costs / constraints: semantic auditはAgent / maintainerに残る。
- Status: accepted

## Decision

- PDDR Kit v0.2.1のhardened Checkpoint CIを導入する。
- signal workflowはPR headを観測するがread-onlyとする。
- PR本文 / commentへのwriteはdefault branchのtrusted `workflow_run` writerだけが担当する。
- privileged writerはPR headのcode / artifactを実行しない。
- Checkpoint SignalはPDDR requiredを意味しない。
- routine translation run、failure log、repair attempt、merge completionだけではPDDRを作らない。
- provider / security / publication / caller contractなどdurable decisionへEvidenceがつながった場合だけPDDRを作成・更新する。
- no durable decisionならno-opを正常結果とする。

## Delivery and validation

detector、read-only signal workflow、trusted marker writer、AGENTS pending-marker guidanceを実装した。

PDDR Kit v0.2.1側では同じ2段構成がconsumer E2E済みである。readme-i18n-kit自身では、導入PRがdefault branchへ入るまでtrusted marker writerのwrite pathを検証できないため、現時点のdeliveryは `implemented` とする。

導入後のhigh-signal PRでpending marker writeとcompleted回収を確認した時点で `validated` を再評価する。

## Consequences

- Agent context喪失時にもcheckpoint候補をrepository側へ残せる。
- routine translation activityをPDDR volumeへ直接変換しない。
- existing human publication / security / caller-contract decisionsを尊重する。
- write-capable tokenとPR head code executionを同じjobに置かない。
- GitHub Actions workflowが増えるが、translation runtime profile自体は変更しない。

## Revisit when

- false positive / false negativeが継続する場合。
- provider / publication workflowのreview surfaceが変わる場合。
- routine translation workがcheckpointを過剰発火させるEvidenceが出た場合。
- GitHub Actions以外へCIを移行する場合。

## Evidence

- Maintainer approval of early hardened checkpoint CI adoption, 2026-09-24 (private).
- [PDDR Kit v0.2.1](https://github.com/serevy/pddr-kit/releases/tag/v0.2.1)
- `.pddr/pddr_checkpoint.py`
- `.github/workflows/pddr-checkpoint.yml`
- `.github/workflows/pddr-checkpoint-marker.yml`
- `AGENTS.md`

## Related records

- PDDR-0001: Review generated artifacts before human publication
- PDDR-0004: Keep the initial provider profile narrow and enforce runtime request guards
- PDDR-0005: Pin reusable-workflow callers to immutable revisions
