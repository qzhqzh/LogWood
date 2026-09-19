# Upstream provenance

Audit baseline: 2026-08-31. Recheck the source, provider documentation, and reuse terms before importing additional wording or assets.

| Source | Version / date | License or reuse boundary | What this Skill uses |
| --- | --- | --- | --- |
| [Musolsol: 视频反推提示词](https://x.com/mmmusol/status/2094268375350583410) | Post published 2026-08-31 | No explicit software or prompt license was found in the post | Architectural study only: quick versus per-shot analysis, explicit timecodes, continuity constraints, and target-model compilation. The local instructions and script are re-authored; the long source prompt and image are not copied. |
| [Runway Gen-4 Video Prompting Guide](https://help.runwayml.com/hc/en-us/articles/39789879462419-Gen-4-Video-Prompting-Guide) | Checked 2026-08-31 | Public provider documentation | Model-routing principle: concise motion-first prompts, positive phrasing, and no automatic universal negative-prompt block for Gen-4. No provider client or example asset is copied. |
| FFmpeg / ffprobe | Runtime-provided version | Governed by the local FFmpeg build and its notices | Deterministic metadata probing, likely-cut detection, and evidence-frame extraction through subprocess calls. No FFmpeg source is bundled. |

## Maintenance rule

For future sources, record the exact URL or commit, retrieval date, license or absence of license, copied versus re-authored material, and material modifications. When reuse terms are absent or unclear, learn the method and rewrite the implementation instead of copying text, code, or media.
