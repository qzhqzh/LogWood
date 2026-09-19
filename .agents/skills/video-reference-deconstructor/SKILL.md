---
name: video-reference-deconstructor
description: "Analyze a reference video into shots, camera/motion notes and reusable video-generation prompts."
metadata:
  short-description: Evidence-backed reference-video shotbooks and prompts
---

# Video Reference Deconstructor

Turn a video reference into a traceable description of its visual grammar, then compile only the relevant parts into prompts for the requested video model. This skill analyzes and plans; it does not itself generate, dub, lip-sync, or edit a finished video.

## Boundaries

- Analyze only material the user may lawfully provide. Redact private footage and unpublished or confidential material before model upload.
- Learn shot structure, motion, lighting, composition, pacing, and material behavior. Do not reproduce recognizable people, protected characters, logos, dialogue, music, or a substantially identical story unless the user has the necessary rights.
- Separate visible evidence from interpretation. Never present an estimated focal length, aperture, shutter, light ratio, frame rate, or camera rig as measured fact.
- Do not promise one-to-one recreation. A reverse prompt is a production hypothesis whose usefulness must be tested in the target model.
- Do not paste a universal negative-prompt block into every model. Model controls change; compile according to the selected model's current official guidance.

## Choose the smallest useful mode

- **Quick brief:** One short reference or an early creative discussion. Return subject, action, environment, lighting, camera movement, visual style, pacing, and the main continuity anchors.
- **Shotbook:** Multi-shot references, close study, or downstream generation. Prepare deterministic evidence, analyze each shot, and emit the full contract from [references/shotbook-contract.md](references/shotbook-contract.md).
- **Model prompt pack:** The user has named a target model. Start from the shotbook and apply only that model's route from [references/model-routing.md](references/model-routing.md).

## Evidence preparation

When a local video path is available, prepare the reference before visual analysis:

```bash
bun .agents/skills/video-reference-deconstructor/scripts/prepare-reference.ts prepare \
  --input path/to/reference.mp4 \
  --out artifacts/video-reference-deconstructor/<run-id>
```

The command requires `ffmpeg` and `ffprobe`, detects likely cuts, extracts start/middle/end evidence frames, and writes a source-hashed manifest plus a shotbook template. It refuses to write into a non-empty output directory. Adjust `--scene-threshold`, `--min-shot-seconds`, or `--max-shots` only when the detected boundaries are visibly wrong.

If no local path is available, inspect the video with the available multimodal capability and state that timecodes and cuts are model-estimated. Do not fabricate a prepared manifest.

## Analysis workflow

1. Inspect the manifest and evidence frames in chronological order. Merge false-positive cuts and note missed cuts; do not silently rewrite source timestamps.
2. Record observations first: visible subject, physical action, setting, light direction and character, framing, camera motion, composition, depth, material response, text, sound cues, rhythm, and transition.
3. Record interpretations separately. Every inference needs evidence frame IDs, `low`/`medium`/`high` confidence, and a short reason. Use ranges or qualitative language when exact values cannot be measured.
4. Build global anchors for subject identity, wardrobe or product state, environment, palette, light continuity, motion rules, and aspect ratio. Identify changes that are intentional rather than treating all variation as an error.
5. Describe each shot as start state → subject/environment motion → camera motion → end state → transition. Keep one generation unit per shot unless the chosen model explicitly supports multi-shot storyboards.
6. Compile a neutral shotbook before creating provider-specific prompts. Preserve the evidence link when shortening or reorganizing a prompt.
7. For current provider behavior, consult official documentation when it is available. Mark unverified model assumptions and settings rather than treating them as portable prompt text.
8. Deliver a concise creative summary, the shotbook, the target-model prompt pack, continuity controls, and an explicit list of uncertain or unsupported claims.

## Prompt quality rules

- Prefer concrete visible motion over abstract mood commands.
- Do not restate every detail from an input image when the target is image-to-video; focus on what changes or moves.
- Treat resolution, duration, aspect ratio, frame rate, seed, reference strength, camera controls, and negative prompts as model settings when the provider exposes them separately.
- Start with the minimum prompt that preserves the shot's intent. Add detail through controlled iterations instead of issuing one contradictory wall of text.
- Translate a negative constraint into a positive stable state when the target model does not support negative prompting: for example, use “locked camera” instead of “no camera movement.”
- When audio or lip movement matters, record it as a separate synchronization requirement. This skill does not create the voice or solve lip-sync.

## Required deliverables

For Shotbook or Model Prompt Pack mode, preserve:

- `reference-manifest.json` and extracted evidence frames when the preparation script was used;
- `shotbook.json`, with observations and inferences kept separate;
- `creative-summary.md` describing transferable visual grammar rather than copied content;
- one prompt file per target model and shot;
- `uncertainties.md` listing ambiguous cuts, unsupported parameter estimates, rights limitations, and model-specific assumptions.

Store persistent results under `artifacts/video-reference-deconstructor/<run-id>/` unless the user gives another workspace-local destination. Read [references/upstream-provenance.md](references/upstream-provenance.md) only when maintaining this Skill or reusing source material.
