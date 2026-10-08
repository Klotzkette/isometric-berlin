# Covered district facades — v1.0.88

This Step 10 refinement addresses the owner's request for slightly more urban,
less blank houses in the **already covered** parts of Kreuzberg, Moabit,
Tiergarten, Wedding, Charlottenburg, Schöneberg and Friedrichshain. It has two
complementary treatments. No boundary, old packet, source geometry, navigation,
view distance or resident-budget limit changes.

## Existing core facade strokes

`districtFacadePresentationV188.ts` adds moderate contrast to the existing
`LoD2 facade axes` material. Its blue-grey strokes use a 0.78 colour multiplier
and 1.18 opacity multiplier in seven finite display rectangles. The previous
stronger urban zones keep their exact 0.6/1.4 treatment. The shader hook is
exclusive to that existing axis material; authored building surfaces, glass,
source paint and hero materials are unchanged. There are no new vertices,
attributes, buffers, draw calls, textures or CPU work per frame for this part.

The rectangles enclose the seven official Ortsteile and can include adjoining
existing blocks at their margins. They are explicitly **display ranges**, not
administrative boundaries. They do not load buildings beyond the existing city.
This treats the existing detailed Tiergarten and central Moabit geometry without
overlaying another estimated window layout on their existing facade lines.

## Previously blank outer walls

153 independent `district188-*` companion tiles add one modest estimated
street-facing window register per eligible official building owner. Each
window is a single shallow blue-grey rectangle with a light gradient; two
thin base/eave lines articulate its whole frontage. There are no guessed shop
names, doors, signs, decorative historical features or newly filled masses.
The dimension recipe uses approximately 3.8 m horizontal spacing and 3.6 m
vertical spacing, fitted inside the original wall; these are display estimates,
not measured window coordinates, storeys or historic cornices.

| Covered district | New outer frontages |
| --- | ---: |
| Charlottenburg | 1,994 |
| Kreuzberg | 1,979 |
| Schöneberg | 1,849 |
| Friedrichshain | 1,665 |
| Moabit | 264 |
| Wedding | 21 |
| Tiergarten | 0 — existing core strokes refined instead |

The 7,772 frontages carry 141,016 simple window estimates. This is a selection
of existing ordinary streets, **not every building or every window** in those
districts, and does not claim completion of the whole Wedding. No arbitrary
owner quota is applied: all eligible owners receive the same restrained recipe.
Short, tall, elevated, oblique, obstructed or protected walls are left as before.

Minecraft receives its separate 46,972 sparse window marks on matching existing
axis-aligned native faces. The complete eligible span is clipped to the finite,
flat-ended 1.6 m corridor of its own approved source frontage before subdivision;
a nearby endpoint cannot qualify an unrelated long wall. It uses no smooth
diagonal window double. Native
source stair steps and complete earlier native city remain unchanged.

## Sources and protection

The committed
[`district-facades-v188-boundaries.geojson`](../geo_data/regierungsviertel/district-facades-v188-boundaries.geojson)
retains all seven exact ALKIS Ortsteil geometries, fetched 8 October 2026 from
[Geoportal Berlin's official WFS](https://gdi.berlin.de/services/wfs/alkis_ortsteile)
in EPSG:25833 (dl-de/zero-2-0). They select existing owners only; they do not
authorize or generate geometry outside earlier coverage.

Every new frontage requires both original triangles of the actual generic
`city` wall in its immutable drawn packet, at the source footprint and retained
vertical envelope. Navigation clipping alone cannot qualify a wall. Only
official `DEBE` owners and walls 7–36 m high, 7–90 m wide and at ground level
qualify. The selected frontage faces a named mapped street, 3–30 m away,
within the documented angular threshold; five outward approach samples and
the street sightline must be free of existing buildings. Every generated window
column also receives its own full-width outward clearance check; obstructed
columns are omitted while the rest of that source frontage remains. One source owner's
longest eligible frontage is chosen deterministically.

Named streets, protected building footprints and existing facade/material tags
come from the retained [29 September 2026 Geofabrik/OSM extract](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf)
(ODbL-1.0). This finite extracted evidence is frozen in
`district-facades-v188-context.json.gz` with source and boundary hashes.
Named/public/non-residential building uses, recorded facade colours/materials
and all detected authored source IDs are conservatively excluded. Complete
previous LoD2/OSM geometry and all prior source or authored colours remain.
No new photographic reference, photograph, texture or scan is used.

## Delivery and checks

The existing serial fetch/decode/cancellation/eviction queue loads each
companion under its primary tile's exact bounds. Companions have empty
navigation, no building replacement and no ground plate. Each nonempty
companion adds one mesh/two buffers; no source packet is rewritten. The
24 MiB shared residency target and 2,048-descriptor validation ceiling remain
unchanged; the new total is 1,522 descriptors.

The complete additional drawn geometry across the region is 9,393,600 bytes;
the separate native family is 2,818,320 bytes. They do not coexist as resident
families. Compressed geometry totals 4,878,190 bytes, plus the compact shipped
evidence containing provenance and all previous descriptor fingerprints.
The source evidence also stays in `geo_data/regierungsviertel/`.

Reproduce with `uv run python scripts/build_district_facades_v188.py`. The
frozen context makes ordinary rebuilds independent of the raw OSM download.
Re-extraction requires the retained `raw/outer-v159/candidate.gpkg`; it must be
an explicit source update rather than silently substituting new road data.

Focused checks cover all 1,369 previous descriptors and all 2,738 packet hashes,
every previous manifest field including the complete footprint, every selected
original source-wall triangle, protected identities/material footprints, street
orientation, all new drawn positions inside the wall envelope and within
0.113 m of its plane, individual window-column clearance, empty companion
navigation, every native pane corner inside its own approved frontage corridor,
native axis alignment and unchanged runtime budgets. The seven Python tests and two shader/gating Bun
tests pass. Final integrated browser and release checks are reported in the
v1.0.88 release review.
