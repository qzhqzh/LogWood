# CoverBriefV1 contract

Use a deliberately small, redacted brief. It is an art-direction input, not a manuscript-ingestion format.

## Required meaning

- `journal.profileId` selects a dated profile from `assets/journal-profiles.json`.
- `story.claim` is the one claim the cover may communicate in plain language.
- `story.novelty` states what is new without adding numerical results.
- `entities` and `relationships` define the scientific nouns and allowed connections.
- `truth.mustShow`, `mustNotShow`, `uncertainties`, and `forbiddenInferences` form the truth boundary used by every prompt and critic.
- `privacy` must affirm that the brief is redacted and contains no manuscript, raw data, or primary research images.
- `compliance.toolCommercialUseConfirmed` records the author's check of the chosen renderer's terms; it is required by profiles such as ACS.

## Reference-image rules

Each reference declares a role and an allowed use mode:

- Roles: `subject`, `style`, `layout`, or `palette`.
- `analysis-only` references may be inspected to extract abstract design tokens but must not be sent to the renderer.
- `model-input` is permitted only when rights are `owned`, `licensed`, or `public-domain`.
- `unknown` rights are never sufficient for model input or final publication.
- Do not use `style` to request imitation of a named artist or a near-copy of a published cover.

## Example

```json
{
  "schemaVersion": "1.0.0",
  "runId": "porous-catalyst-20260829",
  "projectTitle": "Adaptive porous catalyst concept cover",
  "journal": {
    "profileId": "acs-jacs-au-2026-08",
    "publisher": "ACS Publications",
    "name": "JACS Au",
    "articleType": "Research Article",
    "officialGuidelinesUrl": "https://researcher-resources.acs.org/publish/author_guidelines?coden=jaaucr"
  },
  "story": {
    "claim": "A porous catalyst changes its local environment to favor a desired reaction pathway.",
    "novelty": "The active environment reorganizes during catalysis rather than remaining static.",
    "entities": [
      { "name": "porous catalyst", "role": "host structure" },
      { "name": "reactant", "role": "incoming molecular species" },
      { "name": "desired product", "role": "outgoing molecular species" }
    ],
    "relationships": [
      { "from": "reactant", "to": "porous catalyst", "type": "enters" },
      { "from": "porous catalyst", "to": "desired product", "type": "selectively transforms" }
    ]
  },
  "truth": {
    "mustShow": [
      "A porous host with an interior environment distinct from the exterior",
      "A clear transformation from incoming reactant to outgoing product"
    ],
    "mustNotShow": [
      "Charts, spectra, measured values, or microscope-like evidence",
      "A literal industrial reactor not used in the study"
    ],
    "uncertainties": [
      "The exact atomic transition state is not directly observed"
    ],
    "forbiddenInferences": [
      "Do not imply perfect yield or universal selectivity",
      "Do not depict atomic-resolution structures as measured evidence"
    ]
  },
  "artDirection": {
    "mood": ["precise", "luminous", "editorial"],
    "palette": ["deep blue", "warm amber", "off-white"],
    "medium": ["high-end scientific editorial illustration", "subtle volumetric depth"],
    "avoid": ["cartoon style", "neon cyberpunk", "dense labels", "stock science collage"]
  },
  "references": [],
  "privacy": {
    "redactedConfirmed": true,
    "containsUnpublishedFullText": false,
    "containsRawExperimentalData": false,
    "containsPrimaryResearchImages": false
  },
  "compliance": {
    "toolCommercialUseConfirmed": true,
    "humanScientificReviewRequired": true
  }
}
```

## Reject the brief when

- it asks the cover to reproduce or enhance observed experimental imagery;
- the core claim cannot be expressed without confidential details;
- the requested visual asserts more than the truth boundary permits;
- the target journal or policy source is absent and the user refuses manual-review status;
- a model-input reference lacks a documented right to use it.
