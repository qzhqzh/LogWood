# Structured cover critic

Evaluate the actual image, not just its prompt. Review at full resolution, at contact-sheet size, and with the target safe-area overlay.

## Scores

Score each axis from 1 (unacceptable) to 5 (excellent):

- `scientificFidelity`: every depicted relationship stays within the truth sheet.
- `metaphorMapping`: the visual metaphor communicates the intended story without a caption.
- `originality`: the result avoids generic AI-science clichés and close resemblance to a reference.
- `composition`: focal hierarchy, negative space, depth, and target safe areas work together.
- `thumbnailReadability`: the core idea survives reduction.
- `technicalReadiness`: no malformed forms, accidental text, watermark, transparency, obvious seams, or low-quality regions.
- `rightsSafety`: no recognizable protected character, product, logo, artist imitation, or unjustified reference dependency.

## Veto codes

Any veto makes a candidate ineligible for human selection until resolved:

- `invented-evidence`
- `unsupported-scientific-structure`
- `primary-research-image-lookalike`
- `misleading-data-like-encoding`
- `visible-text-or-logo`
- `copyright-or-imitation-risk`
- `real-person-or-brand`
- `safe-area-conflict`
- `severe-generation-artifact`
- `confidential-content-exposure`

Do not use a low aesthetic score as a veto; reserve vetoes for truth, policy, rights, privacy, or material production failures.

## Review record

```json
{
  "schemaVersion": "1.0.0",
  "kind": "review",
  "id": "review-initial-01",
  "candidateId": "initial-01",
  "scores": {
    "scientificFidelity": 5,
    "metaphorMapping": 4,
    "originality": 4,
    "composition": 4,
    "thumbnailReadability": 3,
    "technicalReadiness": 4,
    "rightsSafety": 5
  },
  "vetoes": [],
  "findings": [
    "The scientific mapping is accurate.",
    "The main transformation becomes weak at thumbnail size."
  ],
  "nextEdit": "Increase only the scale and luminance separation of the transformation boundary."
}
```

## Selection rules

- Register one review for every candidate in the stage before recording a decision.
- The initial human decision selects one or two of six candidates.
- The round-one decision selects exactly one reviewed candidate.
- The final decision selects exactly one of the two reviewed round-two candidates.
- A human decision records reviewer, time, selected IDs, and rationale. Model ranking may inform but cannot replace it.
