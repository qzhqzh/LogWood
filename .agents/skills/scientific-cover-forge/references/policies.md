# Journal policy gates

Policy is a live editorial constraint, not a visual preference. The runtime source is `assets/journal-profiles.json`; this document explains how to interpret it.

## States

| State | Rendering | Finalization |
| --- | --- | --- |
| `allowed` | Allowed after brief/privacy checks | Allowed only after disclosure, rights, exact-spec, human, and technical gates pass |
| `permission_required` | Internal concept exploration only | Blocked until permission evidence and an exact journal profile exist |
| `prohibited` | Blocked | Blocked; create a human-illustrator brief |
| `manual_review` | Internal concept exploration only | Blocked until current official guidance is reviewed |

An expired profile is treated as `manual_review` even if its stored state says `allowed`.

## Initial profiles verified 2026-08-29

### ACS Publications / JACS Au

- ACS permits AI-generated journal cover artwork when the tool and use are disclosed; authors remain responsible for tool terms, commercial use, accuracy, and rights.
- The JACS Au author guide specifies 8.19 × 10.00 inches at 300 ppi and notes that the top 2.5 inches will be obscured by the journal title.
- Sources: [ACS AI policy](https://researcher-resources.acs.org/publish/aipolicy), [JACS Au author guide](https://researcher-resources.acs.org/publish/author_guidelines?coden=jaaucr).

### Elsevier journals

- AI-generated cover art requires prior permission from the journal editor and publisher.
- A publisher-level record is insufficient for export dimensions; an exact target-journal profile is still required.
- Source: [Elsevier generative AI policy for journals](https://www.elsevier.com/about/policies-and-standards/generative-ai-policies-for-journals).

### Nature

- Nature's cover guidance does not permit generative-AI images for covers.
- The workflow must stop before image generation and produce a human-illustrator handoff.
- Source: [Nature cover guidance](https://research-figure-guide.nature.com/covers/).

### Any unlisted journal

- Use `unverified-manual-review`.
- Record the exact journal, article type, submission phase, and current official author-guideline URL.
- Do not infer policy from another journal owned by the same publisher.

## Refresh procedure

1. Open the exact official journal guidance and publisher AI policy; do not rely on search snippets or third-party summaries.
2. Record the source URL, page update date when available, verification date, and a review date no more than 90 days later.
3. Separate publisher AI permission from journal-specific physical specifications.
4. Preserve the old profile ID for existing manifests. Add a new dated profile instead of rewriting historical runs.
5. Treat automated output as a policy snapshot. The author and editor remain the decision makers.

## Disclosure draft rules

Generate a concise draft naming the actual provider, model/version when exposed, purpose, human review, and subsequent editing. Never claim a seed or model version that the renderer did not provide. The draft is not submitted automatically and must be checked against the target journal's current wording.
