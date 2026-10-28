# Step 10 — Moabit and Hohenschönhausen exterior enclosures, v281

The owner's additional “Zellengefängnis” request describes a surviving star-shaped
building. This is interpreted as the **active JVA Moabit**, OSM way172318650,
whose five panoptic wings are documented by the prison's official history and
LDA09050319. It is distinct from the **Geschichtspark Ehemaliges Zellengefängnis
Moabit** at Lehrter Straße. The latter already retains nineteen mapped wall
segments, the present-day interpretive Panoptikum and three open entrances.
No historical prison building or wall is recreated in that park.

## Bounded additions

- JVA Moabit: thirteen mapped exterior wall ways, 444.892 m of original source
  course, with five mapped gate anchors left open. These are the finite tagged
  wall traces, not an invented enclosure along every prison land-use edge.
  Two round tower owners, `DEBE01YYK0002S00` and `DEBE01YYK0002UE6`, retain their
  complete measured source skins and 15.121/15.359 m displayed tops. Additive
  upper glazing, narrow light frames and shallow caps make those existing
  towers recognizable. Other prison, court and Lesser-Ury architecture stays.
- Hohenschönhausen: the three exact OSM tower rings, ways367216384/385/386,
  gain public exterior glazing, light frames and shallow caps. The retained
  OSM tags specify height6/min_height4, placing the upper bodies at Y7–9 over
  the existing Y3 datum. The preceding east200 owner inventory already has
  raised simple bodies for385/386; their full skins remain. Only384 lacks its
  upper body and receives a thin hollow shell. It is attached above the mapped
  wall/garage corner, not a new ground-level solid. Existing ten barrier ways,
  full31-part v209 architecture, gate openings and open courts remain intact.

The committed `prison-enclosures-v281-source.json` retains every selected OSM
wall coordinate, gate and tower identity. The source is the existing
29September2026 Geofabrik Berlin PBF, SHA256
`9d193d9003e35f9a00c2a52553452946aab4d46467f1465364455e36e6a568a9`, ODbL1.0.
Moabit tower rings and translated tops come from the complete retained v166
Berlin LoD2 evidence (dl-de/zero-2-0). No new source download was needed.
The v200 retained building inventory was inspected directly to distinguish
existing Hohenschönhausen towers from the missing upper body.

## Source versus interpretation

Moabit walls lack height tags. Their 5m height, 0.48m thickness, coping,
material swatch and 4.2m gate display clearance are explicit estimates.
Mapped gates remain gaps; no current access or operational state is asserted.
Glazing subdivisions, frame widths and the shallow0.22m roof/coping lift are
recognition estimates. The lift sits above complete previous source roofs;
it does not retire or flatten them. The Hohenschönhausen body height remains
the tagged6m; the small additive cap is separately documented.

Two inspected Commons photographs support public architectural form and colour.
The2009/2010 dates are explicit and are not current photographic surveys.
Their full credits and primary source URLs are in
`prison-enclosures-v281-references.json`. Photographs remain ignored research
references; no image or protected plan is packaged, traced as metric geometry,
or loaded by the viewer. No operating security equipment, interior layouts or
non-public access information is added.

## Preservation, runtime and integration

No earlier source or proxy is removed. SHA256 receipts cover the unchanged
v166 source bodies/facades and both v209 envelope/detail files. The new module
imports only its5KB profile and common Three.js helpers, with no new descriptor,
coverage, animation, texture, residency/decode policy or tour stop.

`createPrisonEnclosuresV281(native, options, site?)` creates a separately culled
companion per site; omitted `site` creates both child groups. Full/mobile
matrices are identical. Drawn uses333 instances and five shallow cap fans in
four renderables,34,812GPU-buffer bytes. Independent cardinal native uses740
instances in two batches,57,536bytes. Native wall cells are packed without
changing their occupied volume. Geometry, buffers and materials are owned per
world and use the existing disposal/material lifecycle.

`prisonEnclosuresV281SolidAt(x,y,z,radius,native)` tests only the represented
new Moabit walls and the missing raised Hohenschönhausen tower shell, with
independent native cell collision. It does not close the whole site or replace
previous navigation. The existing source building/roof navigation remains.
Integration must add the companion in each family and this solid predicate
to the corresponding existing collision path.

Focused verification: four Python source/gate/reproduction checks, Ruff, and
four Bun construction/mobile/native/collision/disposal checks pass. The native
collision check visits every packed visible wall cell. Old source
families remain byte-identical. Full application build and actual city browser
views belong to root release integration and are not claimed by these checks.

Reproduce only the small profile with
`uv run python scripts/build_prison_enclosures_v281.py`.
