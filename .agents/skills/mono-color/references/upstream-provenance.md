# Upstream provenance

- Source: https://github.com/yanliudesign/mono-color-skill
- Upstream commit: `a08c45df61ae480e2b0d78b978a304e06ba2894e`
- Retrieved: 2026-08-31
- Upstream release label: `1.2.0`
- License: MIT for source code, Skill instructions, scripts, and other software components; see the bundled `LICENSE`.

## Visual asset boundary

The upstream `examples/` directory is © 2026 Yan Liu and is explicitly excluded from the MIT License. It was not copied into this project. No upstream example artwork is redistributed by this local Skill package.

## Local adaptation

- Retained the upstream `SKILL.md` and its six machine-readable `design-system/*.json` catalogs.
- Changed the hard-coded Claude Desktop output directory to the workspace-local default `artifacts/mono-color/`.
- Added Codex interface metadata under `agents/openai.yaml`.
- Omitted upstream examples, swatches, READMEs, changelog, CI, evaluation fixtures, and optional board-building scripts because they are not required at runtime.
