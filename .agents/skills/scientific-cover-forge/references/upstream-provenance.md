# Upstream provenance

Audit baseline: 2026-08-29. Recheck upstream licenses and notices before copying any additional material.

| Upstream | Audited commit | License / constraint | What this skill uses |
| --- | --- | --- | --- |
| [PaperBanana](https://github.com/dwzhu-pku/PaperBanana) | `836455537e863b5a2f40dace487a782c0bc5ef94` | Repository `LICENSE` is Apache-2.0; its README warns that patents cover specific workflows and restrict similar third-party commercial applications; its bundled Skill declares MIT-0 | Architectural study only: separate semantic planning, styling, rendering, structured criticism, and iteration. No PaperBanana code or prompt text copied. |
| [LiveFigure](https://github.com/tsinghua-fib-lab/LiveFigure) | `c6dedb79b0716b32a448f68b58fbe1d40a2e814b` | No license file found at the audited commit | Architectural study only: persist drafts and errors, render-inspect-refine, and make surgical changes. No code or prompt text copied. |
| [K-Dense scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | `895b4be37ef0ca1cd55c6e628e7ff937ba5a1cf1` | Repository MIT; `scientific-visualization` skill declares MIT | The metadata/palette/export audit field set and network-free bounded-CLI principles informed the TypeScript implementation. Implementation is re-authored for cover art; retain this attribution. |
| OpenAI system `imagegen` skill and [image generation guide](https://developers.openai.com/api/docs/guides/image-generation) | Runtime-managed | OpenAI-provided runtime capability and documentation | Invoked as the default renderer; its structured prompt scaffold informs the render compiler. No provider client is copied into this skill. |

## Maintenance rule

For each future reuse, add the source URL, exact commit or version, file/section, license, whether material was copied or re-authored, and material modifications. When a license is absent, unclear, internally inconsistent, or paired with a patent warning, default to architectural learning rather than copying.
