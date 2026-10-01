# Hauptbahnhof north rail approach and Döberitzer Grünzug, v1.0.60

The requested park is the **Döberitzer Grünzug**, west of the northern railway
approach, not ULAP-Park or Nordhafenpark. [Grün Berlin](https://gruen-berlin.de/projekte/urbane-freiraeume/doeberitzer-gruenzug/ueber-das-projekt)
confirms the December 2024 opening of the first 2.6 ha phase and a 1.1 km
north–south connection. Later playground and second-phase work remains pending;
the renderer does not present future landscape plans as built.

## Evidence and source separation

- Current OSM API extract, 1 October 2026, bbox
  `13.360,52.526,13.374,52.540`, ODbL 1.0; exact node chains retained.
- Park way `185633562`, its eight intersecting mapped path ways and twelve
  mapped benches. Tagged widths/backrests/materials/seats remain source facts.
  Untagged widths and furniture dimensions are display estimates. The rendered
  mapped park segment is 24,350.24 m²; it is not claimed to encompass the whole
  officially described 4.5 ha future project. Existing trees stay in their
  original source layer.
- Four mainline tracks plus mapped switches/short connecting ways retain their
  source alignment. All six tunnel-tag transition way IDs are preserved as
  evidence, including crossovers sharing a mainline endpoint. The adjacent
  S21 two-track trough is a separate structure, not another Fernbahn tube.
- Exact west retaining wall `460595887`; exact S21 walls `1127456787` and
  `1127456788`. The missing east mainline wall follows the outside source rail
  envelope plus 3.25 m. It is explicitly a reconstruction.
- Official Berlin DOP 2025 Frühjahr, `dop_2025` WMS, EPSG:25833 bounds
  `[388750,5820920,389360,5821680]`, inspected for layout and separation of
  railway, new path and park. Licence dl-de/zero-2-0. No aerial image is shipped.
- Falk2's [north portal, I09 094](https://commons.wikimedia.org/wiki/File:I09_094_Nord-S%C3%BCd-Fernbahntunnel,_Nordportal.jpg)
  and [approach, I09 096](https://commons.wikimedia.org/wiki/File:I09_096_Nord-S%C3%BCd-Fernbahntunnel,_Nordportal.jpg),
  22 April 2012, CC BY-SA 3.0, inspected for the broad unobstructed mouth,
  retaining walls, parapets, overhead supply and east emergency stair. The newer
  S21 geometry comes from current OSM, not these historical photographs.
  Individual credits accompany the release; images remain ignored references.

OSM provides no vertical engineering survey. The mainline display floor rises
from −3.3 m at the mouth to 5.2 m over 340 m; the separate S21 floor uses its own
241 m grade. The mainline mouth has a 6.1 m open clearance and a broad concrete
head without an invented centre pier. Roof, rail, sleeper, catenary spacing and
stair subdivisions are procedural display dimensions. The 12 m covered throat
is open below its roof, not a dark rectangle on top of the terrain. This is
recognition geometry, not an as-built tunnel engineering model.

## Ownership and preservation

`build_hbf_north_approach.py` prepares the exact terrain complement. Only the
mapped/reconstructed approach footprint is removed, including the short covered
throats. Every outside raster fragment keeps its original paint and elevation.
The throat reaches the existing roof's +0.5 m front edge; its seam with the
mapped approach has no interior terrain island. This same ownership applies to
the drawn portal and native block portal, preserving the clear opening in both.
Drawn floor polygons are partitioned offline at each clamped-grade break. Their
triangles therefore follow the same elevation as the rail/sleeper profile;
the plan footprint and the separately sampled native block floor are unchanged.
The single intersecting source lawn is clipped offline with every outside part
retained. No roads or water polygons intersect this intervention.

Existing `rail-lines.json` is unchanged. Indexed small replacement fragments
preserve every old ballast/track piece outside the refined cut. Other mainline,
Stadtbahn, underground routes and Hauptbahnhof's five levels remain untouched.

The drawn factory has two draw calls (one instanced member mesh, one surface
mesh), identical on desktop and touch. Minecraft uses one native block batch.
No texture, new light source, animation loop, fetch or point-cloud cache is
introduced. Flat park/path surfaces do not replace existing buildings or trees.

## Validation

- Python tests verify per-cell exact outside-land conservation, source-lawn
  remainder, old railway remainder and the exact mapped west retaining wall.
- Bun tests verify separate source identities, local ground ownership, an
  unobstructed horizontal ray through the broad portal and finite static budgets.
- Whole-viewer browser review is recorded by the release review.

Regenerate with `uv run python -m scripts.build_hbf_north_approach`. The bounded
raw OSM response and source photographs remain in the ignored raw directory.
