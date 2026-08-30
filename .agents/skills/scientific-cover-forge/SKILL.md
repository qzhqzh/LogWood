---
name: scientific-cover-forge
description: Create policy-aware, traceable scientific journal cover concept art from a redacted research brief, including concept exploration, image generation, critique, human selection, safe-area previews, and technical export checks. Use for journal cover artwork; do not use for experimental data figures, primary research images, graphical abstracts, or manuscript figure editing.
metadata:
  short-description: Policy-aware scientific journal cover concepts
---

# Scientific Cover Forge

Turn a redacted scientific story into a reviewable journal-cover candidate pack. Treat the result as concept artwork until the target journal policy, human scientific review, rights, and technical export gates all pass.

## Non-negotiable boundaries

- Do not ingest a full unpublished manuscript, raw experimental data, or primary research images such as microscopy, histology, radiology, gels, or blots.
- Do not present generated imagery as observed evidence, a data figure, a graphical abstract, or a faithful rendering of measurements.
- Do not generate or bake in journal logos, mastheads, cover lines, signatures, watermarks, or scientific labels. Produce a separate generic safe-area preview.
- Do not imitate a named living artist or closely reproduce an existing cover. Public covers may inform abstract design analysis, not model input, unless their rights explicitly permit that use.
- Do not claim journal compliance or acceptance. A successful run produces a submission candidate pack, not a compliance certificate.
- Never bypass a policy, permission, resolution, rights, or human-selection gate by editing metadata or silently changing the target.

## Read only what the run needs

1. Read [references/brief-contract.md](references/brief-contract.md) before accepting or drafting the input brief.
2. Read [references/policies.md](references/policies.md) before any rendering. Policy records are dated snapshots and must be rechecked when expired.
3. Read [references/prompt-pipeline.md](references/prompt-pipeline.md) when planning concepts, compiling render prompts, or refining a candidate.
4. Read [references/critic-rubric.md](references/critic-rubric.md) before evaluating generated candidates.
5. Read [references/renderer-contract.md](references/renderer-contract.md) when registering results or adding a non-default renderer.
6. Read [references/upstream-provenance.md](references/upstream-provenance.md) only when maintaining this skill or reusing upstream material.

## Initialize every run first

Use the CLI from the repository root. It is intentionally network-free and stores immutable evidence around model work:

```bash
bun .agents/skills/scientific-cover-forge/scripts/cover-forge.ts init \
  --brief path/to/cover-brief.json \
  --out artifacts/scientific-covers/<run-id>
```

Inspect `policy-snapshot.json` and `run-manifest.json` before calling an image tool:

- If `generationAllowed` is `false`, do not render. Deliver the generated `human-illustrator-brief.md` instead.
- If `finalizationBlocked` is `true`, generation may continue only as internal concept exploration. Preserve the `concept-only` status and do not describe the artwork as submit-ready.
- If the exact journal is not represented by a current profile, use the manual-review profile and require an official journal URL before finalization.

## Generation workflow

### 1. Lock scientific truth

Use `truth-sheet.json` as the source of truth. Map every visual element to a stated entity, relationship, or metaphor. Mark uncertainty visibly in the plan rather than inventing detail.

### 2. Plan six genuinely different drafts

Create three distinct visual metaphors, each with two composition strategies. Save each structured concept and compiled prompt. Avoid six cosmetic variations of one idea.

The render prompt must request:

- portrait cover art with the target profile's aspect ratio;
- a text-free editorial composition with reserved masthead and cover-line space;
- a scientifically plausible metaphor, not a data-like result;
- no logos, labels, signatures, watermarks, recognizable brands, or real-person likenesses;
- the concrete `mustShow`, `mustNotShow`, and `forbiddenInferences` constraints from the brief.

Use the installed `imagegen` skill/tool as the default renderer. If it is unavailable, stop after producing `RenderRequestV1` records; do not silently switch providers. Save every output under the run directory and register it through the CLI.

### 3. Register prompts, candidates, reviews, and decisions

Create a JSON record matching [references/renderer-contract.md](references/renderer-contract.md), then run:

```bash
bun .agents/skills/scientific-cover-forge/scripts/cover-forge.ts register \
  --run artifacts/scientific-covers/<run-id> \
  --record path/to/record.json
```

Limits are enforced: 6 initial candidates, up to 4 round-one refinements, and 2 round-two refinements. Retries get new candidate IDs and remain in the manifest.

### 4. Critique before selection

Inspect each image at full size and as a thumbnail. Register a structured review for every candidate in the stage. A selected candidate must have no unresolved veto. Never let the model make the final human decision.

Generate the comparison and optional safe-area preview:

```bash
bun .agents/skills/scientific-cover-forge/scripts/cover-forge.ts sheet \
  --run artifacts/scientific-covers/<run-id> \
  --stage initial

bun .agents/skills/scientific-cover-forge/scripts/cover-forge.ts sheet \
  --run artifacts/scientific-covers/<run-id> \
  --candidate <candidate-id>
```

Pause for human choice after the initial six and after round one. Round two produces two single-variable refinements of the chosen direction, followed by one explicit final human decision.

### 5. Audit and finalize

Audit the final selection before export:

```bash
bun .agents/skills/scientific-cover-forge/scripts/cover-forge.ts audit \
  --run artifacts/scientific-covers/<run-id> \
  --candidate <candidate-id>

bun .agents/skills/scientific-cover-forge/scripts/cover-forge.ts finalize \
  --run artifacts/scientific-covers/<run-id> \
  --candidate <candidate-id> \
  --format png
```

Finalization must fail when policy or permission is unresolved, prompt or candidate integrity has changed, the candidate is not the recorded final human selection, the file is undersized, its aspect ratio is outside tolerance, transparency is present, or the target lacks an exact technical profile. Do not upscale an undersized image or fake DPI. If finalization fails, use `production-handoff.md` for the next production step.

## Required deliverables

Preserve the complete run directory: normalized brief, truth sheet, policy snapshot, prompts, original candidates, structured reviews, human decisions, contact sheets, safe-area previews, audits, hashes, disclosure draft, and final files when eligible. Never delete rejected candidates from the evidence trail.
