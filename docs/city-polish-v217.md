# Ordinary city paint and glazing — v1.0.117 / Step 10

The owner requested a quick, restrained reduction of the grey/black appearance
in ordinary neighbourhood buildings, particularly Moabit and old Mitte. This
pass changes display colours only; it does not claim a new street-photo survey.

## Delivered paths

- `cityColourV184.ts` retains its eight established plaster/stone families and
  every existing source-ID assignment, with slightly stronger sand, ochre,
  rose, sage and blue-grey tones. The core distant/detail factories and the
  `city` packet decoder already use this shared palette. Explicit recorded
  colours, mapped materials and authored landmark priorities continue to win.
  The packet decoder's native Minecraft reading uses the same family without
  the drawn height wash. No geographic geometry switch changes.
- `altMitteFacadeReliefV186.ts` changes only the exact existing generic pane
  recipe: a light blue-grey upper edge grades into muted lower glazing instead
  of the darker upper edge. Original recipe colour, rectangular dimensions and
  source mesh kind must all match. The existing packet decoder still rejects
  source walls, authored glazing, incomplete/clipped quads and native blocks.
  Frames, sills, mullions and the v213 measured-wall/roof receipts are unchanged.

These are illustration choices, not newly measured paint or glass. A house
recorded as grey remains grey, and no unverified replacement ornament, window
location or per-house colour identity is invented. In particular this small
pass does not rewrite the independently documented v213 measured surfaces.

## Preservation and checks

There are no new source downloads, meshes, triangles, buffers, shaders, draw
calls, scene objects or per-frame operations. The same colour cells and fixed
palette allocations are reused. Source packets, source coordinates, indices,
navigation, facade details, coverage and runtime residency budgets remain intact.
Full drawn touch/pointer detail remains equal.

The focused colour/material/old-Mitte suite passes 31 tests and 128,172 assertions.
It includes an actual retained packet (2,753 exact facade quads), synchronous and
cooperative decoding, exact authored/source colour priority, source coordinates,
old geometry fingerprints and early/late wall-colour continuity. The added
assertion checks the pane's upper sky tint through the real decoder.

The historical whole-native v211 fixture is stale after later landmark additions:
its expected 556 buffer records differ from the current 567. Running that same
test with the untouched HEAD palette reproduced the identical non-colour
mismatch; its historical fixture was not rewritten. Independent current
full/mobile native snapshots before and after this pass retain identical
geometry, colours, byte counts and records. Native outer-packet generic paint is
separately covered by the passing source-colour/decode tests.

Production build and browser screenshots are part of the parent release review.
