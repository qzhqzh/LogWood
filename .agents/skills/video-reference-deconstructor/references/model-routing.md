# Model routing

Provider behavior changes. Before promising support for a named current model, check its official documentation and record the model/version or access mode used. This reference defines compilation decisions rather than freezing a universal prompt syntax.

## Route by input mode first

- **Text-to-video:** Include the minimum visual setup plus subject, environment, and camera motion needed to establish the shot.
- **Image-to-video:** Treat the image as the source of subject, composition, palette, and lighting. Prompt mainly what moves, how it moves, camera behavior, and intended timing.
- **Start/end frame or keyframe mode:** Put state in the frames and use text to describe the transition path. Do not duplicate or contradict visible anchors.
- **Video-to-video or motion reference:** Describe intended preservation and transformation. Keep identity, structure, motion, and style controls in the provider's dedicated fields when available.
- **Storyboard or multi-shot mode:** Compile one generation unit per storyboard cell and state transitions separately. Otherwise generate shots independently and edit them together.

## Constraint routing

1. If the provider exposes a dedicated negative-prompt field, place only relevant failure constraints there and respect its length and syntax limits.
2. If negative prompting is unsupported, express the desired stable state positively and omit the universal block.
3. Put aspect ratio, duration, frame rate, seed, resolution, camera controls, and reference weights in settings when the interface exposes them.
4. If a requested control is unsupported or undocumented, label it `unsupported` or `unverified`; do not hide it inside decorative prompt wording.

## Compilation template

For each shot, compile:

```text
Intent: <one-line purpose of the shot>
Visual setup: <only what the model must establish>
Subject/environment motion: <ordered physical actions>
Camera: <framing, path, stability, focus behavior>
Timing: <beats or broad sequence supported by the model>
Style/continuity: <only the anchors not already supplied by a reference input>
Settings: <provider controls kept outside prompt text>
Constraints: <positive states or supported negative field>
Unknowns: <controls or details not confirmed for this model>
```

## Runway Gen-4 family baseline

The official Gen-4 guide checked on 2026-08-31 recommends simple motion-focused prompts, positive phrasing, and avoiding negative prompts. For image-to-video, do not repeat the entire image description. Begin with subject motion, camera motion, scene motion, and a small number of style descriptors, then iterate one variable at a time.

This is a dated baseline, not a promise about every Runway model or later release. Recheck official guidance when the exact model matters.
