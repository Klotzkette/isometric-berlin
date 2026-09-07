# Ordinary building detail and its evidence

Step 10 now retains an additive OSM semantic supplement for the existing
29,818 LoD2 prism parts. The query snapshot is **2026-09-07 06:16:21 UTC**.
`scripts/build_building_attribute_source.py` records the exact query, source
endpoint, timestamp and response SHA-256 in
`src/app/src/buildingAttributeSource.json`. Original Overpass responses remain
under ignored `geo_data/regierungsviertel/raw/osm_building_details/`.
The derived manifest is **994,834 bytes**, has no geometry or images, and is
covered by the viewer's existing © OpenStreetMap contributors attribution
(ODbL-1.0).

The requested attributes follow OpenStreetMap's
[Simple 3D Buildings schema](https://wiki.openstreetmap.org/wiki/Simple_3D_buildings)
and [building:levels definition](https://wiki.openstreetmap.org/wiki/Key:building:levels).
The committed OSM GeoPackages did not retain these tags; a fresh bounded query
supplies them without changing the official building source. Exact roof forms,
footprints, courtyard holes, source part separation and measured heights remain
with Berlin LoD2. No OSM height or roof-shape guess replaces them.

## Conservative matching

A source way must be a closed, valid building or building part, remain wholly
inside the approved polygon, cover at least **97%** of the LoD2 footprint, and
be no more than 12.5 times its area. Explicit mapped building parts take
precedence over parent semantics. Competing equal-priority tags are rejected;
the 38 detected conflicts are counted in the manifest. If an ID represents
multiple prism parts, all parts must qualify consistently, so a large matched
part cannot transfer tags to an unqualified tiny roof fragment.

The result links **12,646 prism IDs / 12,647 parts** to **11,016 OSM ways**:

| Recorded attribute | Matched prism IDs |
| --- | ---: |
| Above-ground storeys | 12,390 |
| Facade colour | 698 |
| Facade material | 439 |
| Roof colour | 834 |
| Roof material | 325 |

**17,171 prism parts have no accepted attribute match.** Missing evidence is
left missing. Rejected, unsupported and out-of-bounds ways cannot create a
building, replace an envelope, invent an entrance, or add an opening.

## Applied presentation

The full source-slice audit reports **12,617 visible matched parts** after
the established landmark replacement rules. **10,139 ordinary parts** can use
the recorded storey count within their retained wall height: **9,908 opaque
parts and 231 glass parts**. Glass mullions use the recorded count minus one
internal boundary, preserving the roof elevation. Elevated parts,
ambiguous counts, implausible floor heights and authored facade rhythms do not
receive a replacement storey grid. The count is mapped; equal subdivision and
local bay positions remain display estimates. The existing facade line batch
adds a paired head register only at the lowest and highest represented storey,
keeping intermediate sill registers and the public-place facade treatments.

**28,604 ordinary parts** receive an inset edge stroke following the retained
wall plane, including low annexes below the former facade-grid threshold.
This contributes **142,649 envelope strokes**; mapped floor registers add
**114,014 head strokes**. These strokes emphasize the source envelope without
adding a projecting cornice, false roof equipment, or surveyed-opening claim.
All four drawn modes share them. Glass already has its mullion treatment;
authored landmark facades keep their own detail.

Explicit mapped facade colours refine the ordinary source paint. Existing
sampled facade hues take precedence over material-only colour swatches;
authored landmark and panorama colours remain first. Mapped facade material
can correct a function-derived glass assumption, but may never flatten a
pitched roof. Recorded roof colours/materials refine the existing roof surface.
Named colours and uncoloured materials use documented display palette tones,
not claimed reflectance measurements.

Minecraft reads the same matched tags through the existing source-footprint
lookup, including courtyard exclusion. Roof-only and storey-only source records
remain indexed even without a facade colour; they retain the normal colour
fallback instead of acquiring an invented hue. Its mapped storey pitch is derived once
from the retained prism envelope, so neighbouring roof-step columns cannot
make the window rows slope. Recorded roof caps are also retained in the mobile
profile and stay inside the same original column bounds. Both profiles gain
subtle, distance-faded block-course lines directly in the existing building
material; these are the Minecraft display grid, not surveyed masonry joints.

## Cost and reproduction

The main drawn facade line batch totals **31,410,428 bytes**, an
**8,189,076-byte** increase over the pre-supplement baseline, within the explicit
8 MiB increase budget. The supplement adds **zero drawn renderables** and no
runtime fetch. Minecraft's column-course treatment adds no geometry, textures,
attributes or draw calls; only mapped mobile roof surfaces need a second
instance in the existing building batch.

The complete Minecraft world, including the same-pass tree reduction and
Siegessäule, Reichstag and Gate refinements, now stores 3,568,825 instances / 272,432,344 buffer
bytes in full and 809,716 / 62,173,032 in mobile. Draw counts remain 50 / 48.
Compared with v0.72.43, buffer usage grows about 4.9% / 2.4%; reduced trees
partially offset the new floor rows. These totals include geometry and spare
allocated capacity; they are not GPU frame-time measurements. The frozen
construction test checks cooperative output byte-for-byte against these
synchronous baselines.

```sh
uv run python scripts/build_building_attribute_source.py --fetch
uv run pytest tests/test_building_attribute_source.py
cd src/app
bun scripts/audit-building-attributes.ts
bun test --timeout 60000 tests/building-attributes.test.ts tests/isometric-city-world.test.ts
```

Omit `--fetch` to regenerate from an existing ignored source response. A future
fresh OSM snapshot can change the matched counts; it must be re-audited before
updating the committed manifest and budget.
