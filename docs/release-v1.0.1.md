# v1.0.1 release verification — step 10

This patch refines the Abgeordnetenhaus and Gropius Bau, gives desktop users
the same orange movement joystick as mobile users, and preserves completed
city geometry across Minecraft-to-drawn mode changes.

## Evidence and representation

The [Abgeordnetenhaus model](abgeordnetenhaus-refinement.md) retains the exact
main plan and six courts. Its faulty official 3 m height is replaced by explicit
photo-proportioned display estimates; the six valid source annexes remain.
The [Gropius Bau layer](gropius-bau-refinement.md) adds published 7/8-axis
facades to all four retained source parts. These are now in the initial exact
batch on desktop and mobile, within the existing building limits.
Both models use their own block geometry in Minecraft and reversible materials
in the drawn modes. No photograph or texture is bundled.

## Validation

- TypeScript and the production build passed. The existing large-chunk advisory
  remains; the two new architecture modules load separately.
- Ruff formatting and lint passed; the complete Python suite passed 348 tests.
- The complete frontend suite passed **1,432 tests across 179 files**, with
  no failures. It covers gesture routing, walking, source geometry, mode
  round trips, memory budgets and both complete Minecraft appearance hashes.
- Deterministic ZIP/static archives, release readiness and local package smoke
  checks passed for v1.0.1.
- Browser QA covered both buildings, Day, Night, Minecraft, Snowstorm and
  Schwellenraum, plus 390 × 844 layout. Desktop mouse drags moved forward and
  sideways in flight/walking while retaining the view heading. Touch/pen
  double-tap jumping is tested automatically; no physical phone was used.
- A real Day → Minecraft → Day browser round trip exposed and then verified
  the completed-world retention fix. Previously completion discarded its
  construction input, but the mode switch also disposed its attached batches;
  the return could no longer recreate those buildings. Completed batches now
  stay attached; unfinished work still pauses and releases its partial batches.

| Minecraft profile | Instances | Renderables | Retained buffer bytes | SHA-256 |
|---|---:|---:|---:|---|
| Full | 3,572,980 | 52 | 272,749,420 | `9ad53b3bb70e90db55589d1b26df2feefca9a12f2d599afad3af1e6b4ded3c83` |
| Mobile | 813,167 | 50 | 62,436,604 | `d70f0747edd976c74312461d7332c284cab0780d11acebe3a282e0f25da641d0` |

Synchronous hashes are compared with cooperative construction by the tests.
The exact drawn source batches retain 53,984,764 bytes, below the existing
54,135,158-byte limit. New architecture accessory costs are recorded separately
in the two building documents. The source region and 93-sight catalogue stay
unchanged. Public deployment retains earlier hashed assets for open tabs; all
3,983 files in the current production output were checked against its staged
Pages copy before publication.
