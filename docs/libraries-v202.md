# Staatsbibliotheken recognition refinement (v202 / v1.0.102)

Step 10 adds bounded architecture to both existing library houses. No building
owner, old motif, source vertex, roof plane, court, street, tree, tour stop or
navigation surface is removed. This is not a new city-coverage request.

## Ownership and metric evidence

The historic house, Unter den Linden 8, belongs to official parent
`DEBE01YYK00002vr` in tile `390_5819`, associated with OSM relation `180594`.
The existing Alt-Mitte core binding already replaces old prism `n-180594`
with its 18 complete source leaves. The v202 receipt retains that entire
existing record byte-for-value, including source attribution and the main
part's eight courtyard holes. The modern reading room is leaf
`DEBE3Do7uh0ZOkfL`, with retained world top 44.875 m; the restored street
portal roof is leaf `DEBE3DbBJ132QVQ7`, top 44.648 m. These are viewer-frame
coordinates, not claimed heights above the surrounding street.

The Scharoun house belongs to `DEBE01YYK0002PFp` in tile `389_5818`, associated
with OSM relation `9261463`. All 56 legacy LoD2 leaves and their original
panorama palette remain in place. Source wall/roof coordinates are extracted
from the already retained 2 March 2026 CityGML tile. Each leaf is aligned to
its own exact delivered prism datum (3.1–5.2 m); applying one parent ground
height would misalign adjoining detail. Complete original sheets, alignment
translations and exact legacy prisms are preserved in the offline receipt.
The upper magazine is `DEBE3DabeVfooGWp`.

The runtime supplement does not submit replacements or suppressions. The
previous `addKulturforumLibrary` motifs in `ExpandedCityDetails.ts`, panorama
colours and all original roofs stay intact. Its arrays contain attachments,
not another occupied library shell. Existing pedestrian collision continues
to own the building bodies. No new ground plate, wall across a court or
low-level portico barrier is added.

## Architectural interpretation

The [library's historic-house chronology](https://staatsbibliothek-berlin.de/die-staatsbibliothek/die-gebaeude/haus-unter-den-linden/baugeschichte)
distinguishes Ihne's historic complex, HG Merz's completed reading-room
additions and the portal cupola reconstructed in 2015. The model keeps their
separate measured bodies, adds differentiated large-storey and mezzanine
windows, thin stone surrounds, cornices, the upper reading-room glass grid
and the Ehrenhof's four-column portico with tall arched window and pediment.
The portico aligns to surveyed court-wall points `[1354.9,151.58]` and
`[1371.95,150.21]`; its local proportions, shallow projection and twelve-sided
shaft subdivision are independent presentation estimates. It starts above
the ground-level entrance region, leaving the approach clear.

The [Potsdamer Straße chronology](https://staatsbibliothek-berlin.de/die-staatsbibliothek/die-gebaeude/potsdamer-strasse/baugeschichte/)
documents Scharoun's design, Wisniewski's continuation and gold anodised
aluminium high magazines. The [library's architecture account](https://staatsbibliothek-berlin.de/die-staatsbibliothek/die-gebaeude/potsdamer-strasse/kunstobjekte)
identifies the shed roofs, light pyramids and milk-glass roof caps. Source
roof-edge ribs retain the existing folds and steps; selected measured
reading-room daylight slopes acquire a restrained glass colour. Lower public
wings receive glass bands and pale vertical fins. The high magazine stays
largely blind, with narrow gold panel joints and glazing confined to its lower
levels. No new survey claim is made for the spacing of joints or fins.

All local opening spacing, frame dimensions, colours, material shades,
portico proportions and native quantisation are labelled display estimates.
The photos are reference evidence rather than metric facades or textures.

## Inspected free visual references

All five files were inspected on 9 October 2026. Pixels remain outside the
repository and runtime. Their ready-to-merge per-file notices are in
`geo_data/regierungsviertel/libraries-v202-references.json`.

- Gunnar Klack, [Ehrenhof facade, 21 April 2023](https://commons.wikimedia.org/wiki/File:2023-04-21-Staatsbibliothek-Unter-den-Linden-Berlin.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Andreas Praefcke, [Ehrenhof portico, May 2008](https://commons.wikimedia.org/wiki/File:Berlin_Stabi_UdL_Fassade_im_Innenhof.jpg), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Gunnar Klack, [Potsdamer Straße rear, 30 March 2017](https://commons.wikimedia.org/wiki/File:Staatsbibliothek-zu-Berlin-Potsdamer-Str-Berlin-Tiergarten-03-2017b.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Gerd Eichmann, [View from Neue Nationalgalerie, 28 July 2023](https://commons.wikimedia.org/wiki/File:Berlin-Staatsbibliothek-von_Neue_Nationalgalerie-02-2023-gje.jpg), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Nylki, [Rooftop panorama, 27 July 2005](https://commons.wikimedia.org/wiki/File:Blick_vom_Kollhoff-Tower_am_Potsdamer_Platz_2005-07-27_um_11-30-26.jpg), [CC0](https://creativecommons.org/publicdomain/zero/1.0/); historic form evidence only, not current construction status.

## Runtime and verification

`createLibrariesV202(false)` creates two static, texture-free batches with
11,070 box instances and 1,302 triangles. `createLibrariesV202(true)` creates
one separate orthogonal batch containing 13,077 coalesced blocks on a 0.75 m
lattice. Equal-colour adjacent cells merge without filling a courtyard or
hidden solid interior. Potsdamer Straße native facade marks move to the corresponding retained coarse
voxel face where necessary, and roof ribs lift only to a matching source-column
top within one 4 m cell. Source columns remain unchanged.
Both representations remain below 1 MiB of geometry,
instance and colour buffers. Pointer and touch use the same drawn arrays;
mode disposal owns independent materials and buffers.

Reproduction and focused checks:

```sh
uv run python scripts/build_libraries_v202.py
uv run ruff check scripts/build_libraries_v202.py tests/test_libraries_v202.py
uv run pytest tests/test_libraries_v202.py -q
cd src/app
bun test --timeout 60000 tests/libraries-v202.test.ts
```

The four Python checks pass (source hashes, complete retained sheets,
individual datums, bounded placement and open sample approaches). The four
Bun checks pass (owner/height contract, memory bound, orthogonal native
matrices, open portal region, blind upper archive and disposal independence).
The full viewer composition and release review belong to the v1.0.102
integration checks.
