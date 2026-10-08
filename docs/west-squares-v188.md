# KaDeWe, Tauentzienstraße and Wittenbergplatz — v1.0.88

Step 10 refines the existing West-square model. The complete nine official
building parts, 190 source surfaces, every prior window, the entrance barrel,
memorial sign and surrounding packets remain. No geographic scope, source-owner
replacement, tour stop or streaming residency limit changes. Ernst-Reuter-Platz
is byte-identical in both drawn and native geometry.

## Evidence and bounded interpretation

- **KaDeWe metric anchor:** retained LoD2 parent `DEBE07YY900002p7`, OSM way
  `60541581`, and its original 35.649 m displayed top. The source's single flat
  roof cannot describe the current rooftop organisation. Its complete original
  triangles remain rendered below the recognition additions.
- **Official current roof reference:** Geoportal Berlin
  [DOP2025 spring WMS](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr),
  layer `dop_2025`, EPSG:25833 bbox `387300,5818030,387570,5818250`, inspected
  8 October 2026 at 900 × 740 px (dl-de/zero-2-0). It distinguishes the broad
  glass hall behind the front entrance, narrow reddish perimeter roofs and
  grey service roof. It is alignment/material evidence, not a height survey.
  The QA image stays in `/tmp`; no raster is shipped or loaded by the viewer.
- **KaDeWe facade:** the already credited
  [KaDeWe front.jpg](https://commons.wikimedia.org/wiki/File:KaDeWe_front.jpg),
  Gellerj, perspective correction Arch2all, CC BY-SA 3.0, photographed 2008,
  shows pale stone, horizontal cornices, the entrance arch and roof material.
  Its commercial signs and 2008 displays are not treated as a current inventory.
  The old generic brown roof and tan wall palette is corrected to grey service
  roof and limestone-like stone. Both are visual interpretations.
- **Wittenbergplatz architecture:** Landesdenkmalamt
  [09066746](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066746)
  identifies Alfred Grenander's cruciform building, shell-limestone facing,
  pilasters and pediments. The already credited
  [U-Bahnhof Wittenbergplatz 0686.jpg](https://commons.wikimedia.org/wiki/File:U-Bahnhof_Wittenbergplatz_0686.jpg),
  Dosseman, CC BY-SA 4.0, photographed 2021, guides green cross frames,
  window heads and portal capitals. The complete three-part official roof
  remains; no new clerestory height is claimed.
- **Wittenbergplatz paving:** all rings and holes of retained OSM relations
  `5396406`, `5748424` and ways `26369804`, `26369805` distinguish the north
  and south paving areas and the two station approaches. The relations retain
  six and five holes respectively. This removes the broad unarticulated orange
  reading without filling lawns, station or fountain sites. Source is the
  retained 29 September 2026 Geofabrik Berlin extract, ODbL 1.0.
- **Tauentzienstraße:** all 27 courses and existing width values in
  `tauentzien-v165.json` supply continuous asphalt surfaces above the previous
  fragmented substrate. No route, original curb, crossing or path is deleted.
  The derived unions snap shared junctions at 1 mm to avoid rounding-induced
  self-intersections. The source coordinates themselves remain unchanged.
  Untagged widths are the existing v165 estimates, not new surveyed boundaries.
  [Berlin's street account](https://www.berlin.de/sehenswuerdigkeiten/3559941-3558930-tauentzienstrasse.html)
  confirms the Wittenbergplatz–Breitscheidplatz shopping corridor.

The glass hall is a 70 × 26 m display fit with 6.2 m rise, reaching y=41.9 m.
The source-bound roof collar is 8 m wide with 4.6 m rise. Those dimensions,
cornice heights/sections, green frame sections, landing bands, paving colours
and the 5.52/5.54 m display floor levels are explicitly unmeasured estimates.
The 174 cornice strips are individually attached to measured source walls,
under their top and above their base, rather than a second building shell.
No rooftop equipment positions, sculptures or inferred new benches are invented.

The district's [1 September 2026 fountain report](https://www.berlin.de/ba-tempelhof-schoeneberg/aktuelles/pressemitteilungen/2026/pressemitteilung.1709121.php)
records temporary planting in the two dry fountain bowls. This revision adds
neither active jets nor an invented detailed planting scheme there; the mapped
holes remain available for a separately evidenced refinement.

Both reused photographs already have complete author/licence records in the
source and shipped Wikimedia manifests. No new photo credit, texture, font,
network request, shader or animation is introduced.

## Delivery, budgets and checks

The existing `createWestSquaresV163` / `createMinecraftWestSquaresV163` entry
points construct the refinement in their existing batches. No integration code
or extra resident city is required. Full pointer and touch geometry is identical.

| Representation | Draw calls | Rendered triangles | Geometry/instance buffer bytes |
|---|---:|---:|---:|
| Drawn complete West-square group | 7 | 114,265 | 1,729,431 |
| Native complete West-square group | 4 | 484,284 | 3,069,724 |

Native has 40,357 exterior/recognition blocks, bounded below 40,500. This includes
2,389 new 2.5 m paving cells, wholly contained in their mapped source area so
holes and narrow gaps remain open. Roof and facade additions use their own
axis-aligned blocks; no smooth duplicate appears in Minecraft. This is a small
local addition within unchanged global residency limits, not a citywide budget
increase. The old 36,000 local test ceiling is replaced by the explicit 40,500
finite ceiling because the requested new native detail is present.

The new source payload is 153,931 bytes. Both older source files are retained
byte-for-byte, with their SHA-256 hashes recorded in the new payload.

- Thirteen focused Bun tests / 4,847 assertions pass: source triangles/identities,
  navigation ownership, pointer/touch equivalence, no textures, static matrices,
  the new finite buffers, all 132 built roof-collar triangles facing upward under
  FrontSide materials, and exact preservation of unrelated Ernst-Reuter detail.
- Nine focused Python tests pass: original packet/navigation preservation,
  source hash preservation, exact paving owners/holes, source-clipped roof collar
  and cornices, the original 27 road courses and bounded native cells.
- `bun --bun node_modules/typescript/bin/tsc --noEmit` passes. Plain `bun x tsc`
  used Node's default 4 GB heap and exhausted it; the project Bun runtime passes.
- Targeted Ruff format/lint passes. Release-wide regression and browser captures
  are performed by the release task.

Reproduce only this bounded payload with
`uv run python scripts/build_west_squares_v188.py`. It uses the retained ignored
OSM GeoPackage and the committed v163/v165 source files. No new downloaded raw
building data or imagery is needed for regeneration.
