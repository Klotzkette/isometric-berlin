# Bundeswehrkrankenhaus Berlin — bounded v214 refinement

Step 10 adds public exterior recognition to six measured hospital families,
plus the mapped ground-level helipad. Existing city and source packets, every
hospital body, courtyards, paths and earlier details remain unchanged. There is
no hospital-roof landing pad and no new district coverage.

## Source identities

- OpenStreetMap hospital campus [way 24931203](https://www.openstreetmap.org/way/24931203)
  and separate canal-side [helipad way 51804908](https://www.openstreetmap.org/way/51804908),
  from the retained 29 September 2026 Geofabrik Berlin extract (ODbL-1.0).
- Geoportal Berlin [LoD2 tile 389_5821](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5821.zip)
  (dl-de/zero-2-0), retained locally. The source receipt keeps complete sheets
  for 40 hospital parent families / 99 parts, their original matching core
  prisms and the archive digest. All 99 current core prisms are unchanged.
- [DBV: Haus 1.1](https://www.dbv-ingenieure.de/referenzen/bundeswehrkrankenhaus-berlin-hauptgebaeude/)
  identifies the six-storey hospital refurbishment and technical extension.
  [DHL Architekten](https://www.dhl-architekten.de/projekt/bundeswehrkrankenhaus-berlin-bauunterhaltung/)
  identifies the historic garrison-hospital complex and later additions.
  Those pages are factual references; no protected image or plan is distributed.
- Marek Śliwecki's [25 May 2017 photograph](https://commons.wikimedia.org/wiki/File:Berlin_Bundeswehrkrankenhaus_Berlin.jpg),
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), guides the
  modern wing's pale panels, grey metal and turquoise/grey glazing. It is an
  external reference, credited in both Wikimedia manifests; no photographic
  pixels ship. It is not asserted to document the entire 2026 campus condition.

`build_bundeswehr_hospital_source_v214.py` reproduces the bounded receipt from
retained caches. `build_bundeswehr_hospital_v214.py` clips fittings to complete
measured wall polygons, including their holes; internal/abutting walls are
excluded. Runtime details are batched boxes, not new copies of the buildings.

The six selected parent families are `DEBE01YYK0000365`, `DEBE01YYK00004ZV`,
`DEBE01YYK000062n`, `DEBE01YYK0000Dve`, `DEBE01YYK00008AW` and
`DEBE01YYK0000CdN`. Their existing measured envelopes determine position,
orientation and height. The modern wards gain pale metal sill lines,
turquoise panels and light glazing; older pavilion wings gain thin sill,
head and eaves relief. Bay spacing, pane dimensions, tint and small profiles
are explicitly illustrative recognition estimates, not surveyed windows.
Other hospital families remain unmodified, rather than inheriting these motifs.

## Landing anchor and rendering

The exact projected helipad polygon is 210.6484 m², west of the hospital
campus. Its centroid in the viewer frame is
`[-184.229947, 5.32, -1849.876398]` (x, y, z). Horizontal geometry is mapped;
y=5.32 follows the existing flat core ground y=5.2 plus a small marking relief,
not a newly surveyed pad elevation. The thin apron retains every mapped vertex.
The H, narrow light rim and their proportions are display interpretations.
The native apron contains only one-metre cells fully inside the source polygon.

`BUNDESWEHR_HELIPAD_V214` exports this common drawn/native anchor and the
normalised `[-0.8, 0.6]` west/southwest direction for the owner's illustrative
landing animation. This is not a real flight procedure, operational approach
corridor or claim about a particular hospital-based aircraft.

Drawn detail uses two renderables and 6,671 cube instances; native uses one
renderable and 9,385 axis-aligned surface instances. The same static drawn
model is used on mobile and desktop. No textures, added shadow map, timers,
per-frame work, source suppression or residency-limit increase is introduced
by this static module. Native styling is independently generated rather than
rendering a second smooth hospital.

## Checks

- Two Python checks independently confirm every facade rectangle fits its
  full source wall, the exact pad area/centroid, native pad containment, and
  equality of all 99 saved core prism records.
- The Bun module check verifies the common ground anchor, native axis-aligned
  transforms, fixed two/one renderable count, full touch detail, texture-free
  materials and GPU attribute budgets below 515,000 / 720,000 bytes.
- Python formatter and linter pass. Whole-viewer integration and visual QA
  are performed with the release's helicopter/context integration.
