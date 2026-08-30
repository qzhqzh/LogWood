# Renderer and manifest records

The creative renderer and deterministic CLI communicate through immutable JSON records. IDs use lowercase letters, digits, and hyphens.

## PromptRecordV1

```json
{
  "schemaVersion": "1.0.0",
  "kind": "prompt",
  "id": "prompt-metaphor-1a",
  "stage": "initial",
  "conceptId": "metaphor-1",
  "content": "Compiled renderer prompt"
}
```

## CandidateRecordV1

`sourceFile` may be outside the run directory. Registration copies it into `candidates/`, inspects it, and records its SHA-256. The original path is not retained in the portable manifest.

```json
{
  "schemaVersion": "1.0.0",
  "kind": "candidate",
  "id": "initial-01",
  "stage": "initial",
  "promptId": "prompt-metaphor-1a",
  "sourceFile": "/absolute/path/to/generated.png",
  "provider": "example-renderer",
  "model": "model-reported-by-renderer",
  "modelVersion": "version-reported-by-renderer",
  "providerRequestId": "request-id-reported-by-renderer",
  "generatedAt": "2026-08-29T10:00:00.000Z",
  "desired": {
    "width": 2457,
    "height": 3000,
    "quality": "draft"
  }
}
```

Use `provider: "manual-illustrator"` when registering human-created artwork. Omit `model`, `modelVersion`, `providerRequestId`, and `seed` rather than inventing them.

When a generated-image runtime exposes the provider but not the underlying model, omit `model` and `modelVersion` and set `"modelNotExposed": true`. Never substitute a guessed model name. Do not combine `modelNotExposed` with a reported model.

## ReviewRecordV1

Use the complete shape in [critic-rubric.md](critic-rubric.md). A review is immutable and belongs to one candidate.

## DecisionRecordV1

```json
{
  "schemaVersion": "1.0.0",
  "kind": "decision",
  "id": "decision-initial",
  "stage": "initial-selection",
  "selectedCandidateIds": ["initial-01", "initial-04"],
  "reviewer": "human-author",
  "rationale": "Both preserve the mechanism and remain legible at cover scale.",
  "decidedAt": "2026-08-29T11:00:00.000Z"
}
```

Decision stages are `initial-selection`, `refine-1-selection`, and `final-selection`.

## Manifest invariants

- Maximum candidates: 6 `initial`, 4 `refine-1`, and 2 `refine-2`.
- A record ID cannot be reused, and an existing file is never overwritten.
- Audit recomputes prompt and candidate SHA-256 hashes; changed or missing evidence blocks finalization.
- Every selected candidate must exist, belong to the expected stage, have a registered review, and have no vetoes.
- Finalization candidate must equal the single `final-selection` candidate.
- Provider, model, version, seed, desired size, actual size, file hash, and timestamps remain distinct fields.
- Retries are new candidate records. Rejected files remain in the run.
