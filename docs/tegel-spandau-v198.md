# Tegel and Spandau recognition refinements, v1.0.98

Step 10 adds three bounded, texture-free recognition refinements and corrects
one erroneous shore patch. It is not an Altstadt or Tegel district rebuild.
All previous official building source sheets, OSM rings and island holes remain.

## Sites and provenance

- **Schloss Tegel:** eight pale wind-relief fields and small cornices on the
  two outward walls of each existing corner tower. The retained v194 OSM owner
  `way/24448740` controls their wall anchors. The existing palace stays intact.
  The [district description](https://www.berlin.de/ba-reinickendorf/ueber-den-bezirk/ortsteile/tegel/artikel.85006.php)
  identifies Schinkel's four towers and the eight antique wind gods from Rauch's
  workshop. Relief figures are small procedural suggestions, not reproductions
  of individual sculptural anatomy or a claim of surveyed ornament.
- **Tegeler Hafenbrücke / Sechserbrücke:** complete mapped bridge footprint
  `way/943646072`, axis `way/316133773`, red curved upper chords, hangers,
  crossed panels and side railings. The 87.474 m mapped axis and full footprint
  are exact; untagged member widths, 6.35 m arch-height estimate, colours and
  deck elevation are reference-informed display dimensions. The centre remains
  open. Its independently voxelized counterpart uses orthogonal members and
  contained deck strips, not a smooth model double. The new scope is only this
  515.193 m² footprint, of which about 122.28 m² was missing from v194 coverage.
  [District history](https://www.berlin.de/ba-reinickendorf/ueber-den-bezirk/tourismus/artikel.82629.php)
  and [heritage record 09012397](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09012397)
  support the bridge identity and construction history.
- **Zitadelle Spandau Torhaus and approach:** red-brick front material, pale
  plinth/quoins, five upper window bays, balcony rail, portal framing and a small
  arched heraldic field. The wall is anchored to the exact south edge of retained
  official LoD2 part `DEBE3DaVK9zcyYcF`, parent `DEBE05YYY00006av`. Approach
  rails follow OSM `way/4902366`; the path centre stays clear. The coarse old
  Torhaus/curtain envelopes and their collision remain unchanged: this pass does
  **not** create an enterable gateway through the existing fortress shell.
  [District site description](https://www.berlin.de/ba-spandau/ueber-den-bezirk/tourismus/sehenswertes/artikel.288536.php)
  and the freely licensed frontal photograph support the recognition details.

`tegel-spandau-v198-source.json` retains eleven complete selected features from
the existing Geofabrik Berlin 2026-09-29 source, including both whole water
owners. Its original PBF SHA-256 is retained; no new broad source download was
needed. Official source and geometry SHA-256 values that remain unchanged are
listed under `preservedInputs` in `tegel-spandau-v198-evidence.json`. The two
changed v194 runtime files are deliberately not described as byte-identical.

The three inspected free photographs, authors and licenses are recorded in
`tegel-spandau-v198-visual-references.json`: Lienhard Schulz, CC BY-SA 3.0
(Schloss Tegel, already credited); Oberlausitzerin64, CC BY-SA 4.0 (Torhaus);
Flocci Nivis, CC BY 4.0 (bridge). Images are references only, never scene textures.

## Exact harbour-mouth correction

The old v194 22 m artificial shore strip crossed the actual Tegeler Hafen and
Tegeler Fließ water at the bridge. The correction mask is the union of complete
OSM water owners `way/8659535` and `way/228201346`, intersected with that old
strip and minus the existing Tegeler See surface. Only 1,148.452 m² drawn /
1,136 m² native is affected. The independently stair-stepped native mask is
also subtracted from native land and banks; both water forms stay at the old
connected water datum of −1.15 m. The real separating land pier remains dry.

`tegel-spandau-v198-shore-repair.json` identifies all 39 drawn / 139 native
corrected false land or bank triangles. The original complete Tegel site for
each form is retained in `tegel-spandau-v198-original-*.json.gz`. Original
position/color arrays remain as an exact prefix of the corrected site; every
unchanged face, every previous lake-water face and all seven other v194 sites
remain exact. The receipt records archive and output hashes and unchanged-site
hashes. Retention tests also verify that no remaining land intersects the new
water, and that rendered water and navigation use the same correction polygon.
No wider harbour, shoreline or city geometry is regenerated.

Reproduce from the committed bounded source inventory:

```sh
uv run python scripts/build_tegel_spandau_v198.py
```

The generator runs the idempotent `repair_tegel_shore_v198.py` first. The CLI
entry point of `build_west_lakes_v194.py` likewise runs that correction after
its original build, when the v198 source is present, so a rebuild cannot
silently restore the false shore strip.

## Runtime and checks

`createTegelSpandauV198(native=false)` has four frozen, independently culled
site groups. Only the chosen style is allocated. Shared unit boxes and
final-count instance buffers keep the active drawn form at **72,734 GPU bytes,
5 draws, 884 instances**, and native at **609,940 bytes, 4 draws, 7,861 instances**.
The addition is static, has no textures or frame-loop work, and keeps the same
detail on touch and desktop. Existing runtime residency budgets are unchanged.

The lazy exports `tegelSpandauV198GroundAt(x,z,native=false)` and
`tegelSpandauV198WaterAt(x,z,native=false)` use the exact respective deck and
water forms. Bridge support (3.14 m) takes precedence over water underneath.

Focused Python tests cover source equality, complete bridge vertices, deck
coverage, clear rail corridors, source wall anchors, deterministic generation,
retention receipts and matching water geometry/navigation. Focused Bun tests
construct both styles, verify final counts, bounds, frozen transforms, native
axis alignment, budgets and actual water triangle/navigation agreement. Earlier
WestLakes-v194 and WesternLandmarks-v187 checks are included unchanged.

Standalone Day/native inspection used these world-space camera pairs:

| Site | Camera XYZ | Target XYZ | Orthographic width |
| --- | --- | --- | --- |
| Bridge | −6650, 42, −7958 | −6600, 7, −8041 | 130 m |
| Schloss Tegel | −6311, 34, −8599 | −6251, 11, −8624 | 70 m |
| Torhaus | −10708, 32, −2548 | −10730, 12, −2614 | 65 m |

These checks do not claim completed release publication or exhaustive physical
device testing; integration and release verification are recorded separately.
