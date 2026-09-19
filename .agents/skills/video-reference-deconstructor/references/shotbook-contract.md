# Shotbook contract

Use this contract for full analysis. The preparation script creates the structural template; the agent fills it from the evidence frames and, when available, the video and audio.

## Evidence levels

- `observed`: Directly visible or measured by the preparation script.
- `inferred`: A reasoned interpretation that includes evidence frame IDs and `low`, `medium`, or `high` confidence.
- `unknown`: Not supported by the available material. Leave it unknown rather than inventing a value.

Camera make, exact lens, aperture, shutter, ISO, lighting power, and physical camera distance are normally `inferred` or `unknown`. Container metadata, encoded dimensions, duration, detected frame rate, and extracted timestamps may be `observed` when they come from `reference-manifest.json`.

## Global fields

- `source`: manifest path, source hash, duration, encoded dimensions, frame rate, and aspect ratio.
- `rights`: user-stated ownership or permission, redactions, protected elements that must not be reproduced.
- `intent`: what the user wants to learn or transfer from the reference.
- `target`: model, generation mode, aspect ratio, duration limits, and available reference inputs.
- `anchors`: subject/product identity, wardrobe or state, environment, palette, lighting, texture, and motion continuity.
- `creativeGrammar`: recurring composition, camera behavior, pacing, transitions, and sound-picture relationship.
- `uncertainties`: ambiguous cuts, occluded actions, inaudible or untranslated audio, and unsupported technical estimates.

## Per-shot fields

Each shot keeps its script-provided ID, time range, duration, and evidence frames, then adds:

1. `observations.subject`: visible identity-safe description and stable appearance anchors.
2. `observations.action`: start pose/state, physical motion, speed changes, gaze or object interaction, and end state.
3. `observations.environment`: location, foreground/midground/background, weather or time cues, and moving scene elements.
4. `observations.camera`: framing, angle, qualitative lens feel, camera path, stability, focus behavior, and composition.
5. `observations.lightColorMaterial`: source direction and softness, contrast, palette, grading, reflections, and material response.
6. `observations.rhythmAudio`: shot duration, internal beats, transition, visible speech, music beat, dialogue, or sound cue when supported.
7. `inferences[]`: `{ claim, evidenceFrames, confidence, reason }`.
8. `continuity`: incoming anchors, outgoing anchors, intended changes, and risks.
9. `generationUnit`: start frame, subject/environment motion, camera motion, end frame, transition intent, and model-neutral prompt brief.

## Output checks

- Every inference cites at least one evidence frame or a measured manifest field.
- No protected person, brand, dialogue, music, or story element appears in the generation brief unless permission is stated.
- Time ranges cover the reference without overlap or silent gaps after any documented cut corrections.
- Model prompts are derived from the neutral generation unit, not independently hallucinated.
- Settings are separated from semantic prompt text whenever the target exposes dedicated controls.
