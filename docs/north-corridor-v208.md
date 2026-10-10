# Northern Linden corridor — v1.0.108 / Step 10

Five already-retained building parents receive a bounded architectural pass:
Hungarian Embassy, ARD Hauptstadtstudio, Dussmann KulturKaufhaus,
Helene-Weber-Haus and Neustädtische Kirchstraße 15. Existing v197 avenue
frontages are not rebuilt. Roads, courts, terrain, source inventories, all
resident budgets and navigation remain unchanged.

## Evidence and appearance

[The source book](../geo_data/regierungsviertel/north-corridor-v208-source.json)
records checked official/architect sources, freely licensed photographs and
explicit display estimates. The Hungarian Embassy has warm mineral surfaces,
green ceramic strips, broader lower windows, finer upper glazing, a glazed
corner and shallow canopies. Its current pitched metal roof follows the full
measured source sheets. ARD keeps its complete previous authored model, with
blue glazing and more legible narrow frames and precast joints. Dussmann gains
a street-facing arcade, upper windows, red accents and vector lettering.
The two connecting parliamentary fronts receive restrained stone courses and
window framing clipped to their measured wall planes.

The source's metric footprint, wall/roof vertices and datum are not replaced by
photo estimates. Fine aperture dimensions, division rhythms, palette values,
member thicknesses, lettering and night-lit windows are explicit proportional
display estimates; the pass does not claim a surveyed interior or every window.
No photo or texture is bundled. The newly used Hungarian photo is credited to
Jörg Zägel, edited by Szilas, CC BY-SA 3.0; Dussmann and both ARD references reuse
existing credited free photographs. Full links and licences are in the source book.

## Two corrected ownership/orientation errors

The previous Hungarian decoration was axis-aligned while the measured western
and avenue walls are oblique. Its six coarse extruded owners also presented
flat caps at approximately 32.2 m, concealing the real pitched roof. Only these
six exact legacy IDs are substituted in production drawn presentation:
`YDxshLdM`, `cyb33NJD`, `dVaNVYh5`, `dxdP8ZV2`, `j66nu4dr`, `mN0gGHof`.
The parent is `DEBE01YYK00001vQ`, retained by the v169 classification because
CentralCivicDetails/heroPrismTones already own it. No spatial district filter is
introduced. The old Hungarian decoration block alone is disabled by an explicit
production option; its flag/pole are replaced here. British Embassy details and
default historical constructors remain unchanged.

`createHungarianEnvelopeV208()` is a **required** initial-city component. It
contains all 364 triangles from all wall and roof sheets of the six measured
source parts, including roof slopes and source openings. It is added before
publishing the initial drawn world, so optional-detail loading failure cannot
leave a hole. The optional `createNorthCorridorV208(false)` excludes these sheets
and contributes 58 separate shallow streetfront triangles. There is no duplicated
coplanar measured envelope. The evidence file retains complete original source
records, including ground sheets, holes and every source vertex; tests compare
all emitted wall/roof vertex sets against the independent source tile.

The previous Dussmann profile chose its east wall, beside Hotel Splendid and
another retained neighbour. Friedrichstraße is **west** of the building. The new
front follows source positions around x=1166.5…1170.9, z=54.6…111.6 and faces
negative X, not the former x=1210.7…1215.3 party wall. Existing older geometry is
retained. New details on all five owners follow their original terrain offsets.

## Minecraft and full-detail preservation

The separate native reading keeps every original 4 m voxel column and every
independent v169 navigation/shell span. Source footprints select the owned cells;
new fittings are placed outside the furthest retained owned cell over their
**entire pane width**, not only the centre point. The independent evidence lists
all nearby occupied cells and exact packet-006/007 span receipts. Attachments
that would remain hidden behind an unrelated building are omitted from the new
layer only. Nothing is deleted from earlier models. Glass and lit-panel extents
are tested against both retained raster layers, including the wider glow margin.
Each of the five owners has actual delivered native detail, including the newly
corrected Dussmann west front.

Both presentations use the same complete static detail on mobile and desktop.
No camera-distance removal, pixel-ratio reduction, texture, new collision,
courtyard wall or interior fill is introduced. Night-only panes preserve readable
illumination behind the new glass skins and use the existing lighting toggle.

## Reproduction, checks and cost

```
uv run python -m scripts.build_north_corridor_v208
uv run pytest -q tests/test_north_corridor_v208.py
cd src/app
bun test tests/north-corridor-v208.test.ts
```

Four focused Python tests and four Bun tests pass. Checks cover source equality,
all original Hungarian wall/roof vertices, measured attachment containment,
source datum, real Dussmann street side, full native pane clearance, all five
native owners, required/optional disjoint source allocation and independent
resource ownership. Full integration/browser verification belongs to the release
checks; these tests do not claim testing on a physical iPhone.

| Resource | Bytes of resident geometry | Day draws | Night extra draw |
| --- | ---: | ---: | ---: |
| Required measured Hungarian envelope | 39,312 | 1 | 0 |
| Optional drawn corridor | 161,204 | 2 | 1 |
| Native corridor | 311,344 | 1 | 1 |

Payload: 1,897 drawn members, 3,880 native members, 148/237 night panes.
`northCorridorV208.json`: 418,130 bytes; SHA-256
`93817b873215eff32d291997f7f5550d40a23bd89aab33b6edddd70e9da1867d`.
Evidence: 385,628 bytes, not imported by the runtime; SHA-256
`2ce974d4c27cce7b041a6e404ee9b4f0c9f52eddb71fa7dcbbe9c519461861b9`.

The generator only writes its two dedicated JSON files. The source receipt also
pins the official tile and original native voxel JSON byte hashes. No wider
city source, stream packet, road or previous source inventory is regenerated.
