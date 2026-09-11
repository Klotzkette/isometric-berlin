# GRIPS-Theater and the small Hansaplatz courts

Pipeline step 10, v1.0.39. The change is bounded to the theatre and the low
shopping, arcade and U9 reception structures immediately around it. It does not
rebuild the school, nearby high-rises, streets or the library across the road.

## Evidence

- [Berlin monument inventory, Hansaviertel](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050387),
  embedded part `09050387,T,005`: the 1957 shopping centre by Ernst Zinsser and
  Hansrudolf Plarre, former cinema, restaurant and integrated U-Bahn access,
  with later extensions.
- [GRIPS contact](https://www.grips-theater.de/de/kontakt) and
  [arrival information](https://www.grips-theater.de/de/service/anreise): existing
  theatre at Altonaer Straße 22 and entrance from the covered court.
- Complete original Berlin LoD2 archives `LoD2_387_5820.zip` and
  `LoD2_387_5819.zip`, with archive hashes in
  `src/app/src/gripsHansaplatzSource.json`. Fourteen parent identities retain all
  31 leaf parts, original wall/roof surfaces and all prior display prisms.
- Original paths and stair approaches from the committed OSM GeoPackage,
  recorded separately from the authoritative building footprints.
- Five external Commons photographs, individually credited in both manifests
  and [the reference ledger](../references/wikimedia/README.md#grips-and-hansaplatz-v1039).
  These show the street lettering, grey metal panels, mural zone, red exterior
  spiral stair, glazed foyer and paired doors, glass-block station wall,
  blue canopy and raised glazed link with crossed red bracing. The photographs
  date from 2008 and 2016; they establish architectural form, not a current
  event programme or a proposed replacement theatre.

## Source and display treatment

`uv run python -m scripts.build_grips_hansaplatz_source` rebuilds the compact
supplement from ignored original archives and the retained OSM/prism files.
Each complete parent is translated vertically to the existing 5.2 m street
datum, without changing its source height or footprint. The main theatre keeps
its 8.470 m envelope height. The two uncovered courts derive from holes in the
union of surrounding footprints: approximately 245 and 130 square metres,
with only 2 mm boundary simplification. No large invented plaza fills the site.

LoD2 encloses canopies and the raised link down to the ground. The original
sheets remain in the supplement; only those lower display walls are removed
to open the documented routes. Roof vertices keep their exact translated
heights, including the small multilevel roof. Fascia and posts sample local
roof height. The raised glazed link uses an estimated 3.05 m structural depth.
Thin canopy sides and slender posts complete the open reading.

OSM footway `533899752` crosses the photographed continuous western glass-block
wall before meeting a southern stair approach. Its coarse station centreline
is retained as evidence; it does not justify an invented street-level door.
The three mapped southern stairs (`392577199`, `271846981`, `392577198`) and
covered paths `1332848648`/`1332848649` remain clear. The existing underground
representation is unchanged; this refinement adds no invented station interior.

Facade subdivisions, glazing, posts, doors, stair steps, sign sizes, mural
colour fields and paving joints are bounded recognition estimates rather than
a facade survey. The original source envelopes, lower shop heights and open
courts constrain them. No photograph, poster or new texture enters the runtime.

## Rendering and access

All drawn modes use two static batches: one merged source shell and one
instanced facade batch. Minecraft uses one native box batch with exposed
envelopes, never filled internal columns. Only the exact 31 old prism IDs and
matching voxel footprints are replaced. Independent source-roof and access
tests accompany the wider navigation inventory.

The model uses 233,548 bytes of drawn buffers and 345,688 bytes in Minecraft.
It introduces no animation callback or light. Source footprint, roof, finite
buffer, visible-foyer raycast and standing-capsule checks cover both courts,
the covered link and the three U9 approaches. See the
[release review](release-v1.0.39-review.md) for final whole-viewer checks.
