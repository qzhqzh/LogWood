# Cover prompt pipeline

The pipeline separates scientific semantics from art direction so visual polish cannot silently change the claim. Save every stage as an artifact.

## Stage 1: semantic planner

Use this template to propose exactly three distinct metaphors. Re-author details for the brief; do not add facts.

```text
You are planning editorial cover art for a scientific journal.

SOURCE OF TRUTH
Claim: {{claim}}
Novelty: {{novelty}}
Entities: {{entities}}
Allowed relationships: {{relationships}}
Must show: {{must_show}}
Must not show: {{must_not_show}}
Uncertainties: {{uncertainties}}
Forbidden inferences: {{forbidden_inferences}}

DESTINATION
Journal profile: {{journal_profile}}
The final artwork contains no text or journal logo. Reserve the documented masthead and cover-line areas.

Propose exactly three visually and conceptually distinct metaphors. Each metaphor must map every major visual element back to the source of truth and must not resemble a chart, graphical abstract, microscopy image, or observed experimental result.

Return JSON only:
{
  "concepts": [
    {
      "id": "metaphor-1",
      "workingTitle": "...",
      "oneSentenceStory": "...",
      "visualMetaphor": "...",
      "factMapping": [{"visualElement": "...", "scientificMeaning": "..."}],
      "scientificRisks": ["..."],
      "compositionA": "...",
      "compositionB": "..."
    }
  ]
}
```

Reject concepts that rely on a decorative science collage, a literal data plot, a generic glowing molecule, or an unsupported anatomical/atomic structure.

## Stage 2: art director

Run this separately for each metaphor and composition. Preserve semantic mappings while making the image editorial rather than diagrammatic.

```text
Act as a scientific editorial art director. Transform the approved concept into one production-grade, text-free cover-art direction.

Approved scientific mapping: {{fact_mapping}}
Chosen composition: {{composition}}
Target aspect and safe areas: {{profile_geometry}}
Desired mood, palette, and medium: {{art_direction}}
Avoid: {{avoid}}

Strengthen hierarchy, negative space, lighting, material language, scale, depth, and thumbnail recognition. Preserve every scientific constraint. Do not introduce new molecules, organs, instruments, numerical values, logos, labels, typography, signatures, watermarks, brands, or real-person likenesses.

Return JSON only with:
- `scene`: concrete spatial description;
- `subject`: primary and secondary forms;
- `composition`: camera/viewpoint, focal point, negative space, and safe-area handling;
- `medium`: editorial rendering language without artist names;
- `lighting`, `palette`, `texture`;
- `scientificMapping`;
- `constraints` and `avoid`.
```

## Stage 3: renderer prompt compiler

Compile, do not improvise beyond the approved direction:

```text
USE CASE
Scientific journal cover concept artwork; portrait orientation; text-free master image.

SCIENTIFIC STORY
{{one_sentence_story}}

SCENE AND SUBJECT
{{scene}}
{{subject}}

COMPOSITION
{{composition}}
Keep the documented masthead and cover-line regions visually quiet. The focal subject must remain legible at thumbnail size.

MEDIUM AND FINISH
{{medium}}
{{lighting}}
{{palette}}
{{texture}}

TRUTH CONSTRAINTS
{{must_show}}
{{must_not_show}}
{{forbidden_inferences}}

OUTPUT CONSTRAINTS
No text, letters, numbers, labels, diagrams, axes, captions, journal marks, logos, signatures, watermarks, brands, or real-person likenesses. Do not resemble primary research imagery or claim measured evidence. Do not imitate a named artist or an existing cover.
```

When the renderer supports explicit parameters, request the profile aspect ratio and the highest non-upscaled resolution it can produce. Register desired and actual parameters separately.

## Stage 4: targeted revision

Change one controlled dimension at a time so the effect remains attributable.

```text
Edit the selected cover candidate while preserving its approved scientific mapping, subject identity, viewpoint, and all unaffected visual details.

Single requested change: {{one_change}}
Reason: {{critic_finding}}
Must remain unchanged: {{locked_elements}}

Maintain a text-free image, quiet safe areas, original aspect ratio, and every truth constraint. Do not add new scientific claims or decorative elements.
```

Round one may explore two purposeful refinements per selected direction. Round two contains exactly two single-variable final refinements of one chosen direction.

## Reference handling

- State each reference's role before use: `subject`, `style`, `layout`, or `palette`.
- Send only `model-input` references with owned, licensed, or public-domain rights.
- Convert `analysis-only` references into written design tokens; never attach the original file to the renderer.
- Prefer principles such as “large central negative space” or “translucent layered material” over copying a distinctive composition.
