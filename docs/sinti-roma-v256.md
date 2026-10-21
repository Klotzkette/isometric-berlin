# Step 10 — Sinti and Roma memorial, v256

This bounded refinement keeps the existing memorial owner at
`[307.700225593755, 186.2301389835775]`, its 4.48 m base and 0.46 m clearing
offset. No terrain, water, LoD2, OSM, navigation or tour payload is edited.

## Evidence and scope

Checked 20 October 2026:

- [Stiftung Denkmal, memorial and its elements](https://www.stiftung-denkmal.de/denkmaeler/denkmal-fuer-die-im-nationalsozialismus-ermordeten-sinti-und-roma-europas/):
  approximately 12 m dark steel water basin, low retractable granite triangle,
  daily flower, fractured stone slabs inset in grass, and 69 named places.
  The foundation also identifies the nine biographies in the exhibition
  added in October 2022. The old 2024 access notice on this page is not used
  as a current construction-status claim.
- [Dani Karavan studio catalogue](https://www.danikaravan.com/portfolio-item/germany-the-sinti-roma-memorial/):
  overall 2.5 × 60 × 60 m extent and materials. These dimensions describe
  the artwork, not a new square ground surface.
- [Mike Peel, *Berlin Sinta and Roma memorial 2014-5.jpg*](https://commons.wikimedia.org/wiki/File%3ABerlin_Sinta_and_Roma_memorial_2014-5.jpg),
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0):
  the existing licensed close reference shows fitted irregular granite slabs
  with narrow grass joints. Its per-file credit already exists in both source
  and shipped Wikimedia manifests.
- [Foundation's 2022 exhibition view](https://www.stiftung-denkmal.de/wp-content/uploads/IMG_2-1280x960.jpg),
  © Stiftung Denkmal, inspected in the browser: nine biography panels and
  three low benches support the retained exhibition reading. It is an
  external reference only; no free image-reuse licence is asserted.

Only the earlier authored paving estimate is corrected. Its 168 small
pentagonal fragments and 69 named fragments were sparse and spread as far as
roughly 19 m from the pool centre, losing the photographed fitted-paving
character. All 237 fragments survive as individual irregular slabs, with the
same 69 non-legible name marks. The new 6.27–9.55 m radius, 9 cm minimum
joints, stone outlines and colours are procedural visual estimates, not a
survey or a traced photographic layout. Neither the actual names nor the
copyrighted poem or exhibition texts are reproduced.

The complete earlier pool, black still-water material, triangle, flower,
rim engraving cues, glass enclosure, frames, doorway, nine biography cues
and three benches are retained. No graves, additional memorial structure,
animation or photograph texture is introduced.

## Rendering and preservation

The existing catalogue owner now contains mutually exclusive drawn and native
children. All five drawn modes and both pointer classes use the same full
geometry. Minecraft uses independently composed, unrotated boxes for the
stepped pool and triangle, every slab, flower, enclosure and interpretive
details. It does not display the smooth model underneath.

- Drawn: **16 renderables**, **8,927 stored vertices**, **16,225 vertices
  after instance expansion**.
- Native: **2 batches**, **890 blocks**, including a glass batch.
- No new streamed descriptor, animation callback, texture or live residency
  allowance. Existing scene construction/disposal owns both small families.

The [preservation receipt](../geo_data/regierungsviertel/sinti-roma-v256-preservation.json)
records the exact replaced authored section at baseline `c68145d6`, hashes
both unchanged parts of the original memorial builder, and checks unchanged
source ground, water, LoD2, native payload and landmark files. Existing
32 m Schwellenraum protection remains non-enterable; the dedicated-pool
filter and all walking/water behavior are unchanged.

Native browser review exposed blue fringes from the three existing coarse
basin runs beneath the independent black pool. Only these three exact runs
(seven cells belonging to the retained 113 m² source basin) receive the same
dark tint. `sintiRomaNativeWaterV256.json` records their original geometry,
source pool outline and payload hashes. All instance matrices, counts,
terrain heights, water classes and navigation data remain unchanged; nearby
water keeps its original colour. The tint adds no geometry or material.

## Reproduction and checks

`uv run python scripts/build_sinti_roma_paving_v256.py` prepares the small
deterministic slab descriptor. No runtime Voronoi operation is needed.

Focused checks: 28 passing Bun tests in `memorial-landmarks.test.ts` and
`sinti-roma-v256.test.ts`; two passing Python tests in
`tests/test_sinti_roma_v256.py`; changed Python files pass Ruff.
Tests check original source hashes, unchanged authored details, exact anchor
and water diameter, non-overlapping paving and open pool, all 237 native slabs,
orthogonal native transforms, bounded geometry and reversible visibility.

Visual-review framing: target `[307.700225593755, 4.94, 186.2301389835775]`,
existing focus distance 48 m; azimuth 0–35°, polar 45–60° for the pool and
paving, then turn toward the retained northern enclosure. A separate close
view at 25 m shows the fitted slabs and centre triangle.
