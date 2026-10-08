# Step 10 · Kreuzberg, Nationaldenkmal and Viktoriapark cascade · v1.0.94

The existing official ten-metre DGM field remains byte-for-byte unchanged. Its
Viktoriapark peak is 66.58 m NHN (world Y 36.58); no second hill is added. Every
old park path, tree, road, terrain triangle, navigation ring and unrelated
building remains present.

The old octagonal proxy `DEBE02YY400001Vu` was the masonry substructure, not the
iron monument. It had a flat coarse roof. The new layer retains all eighteen
measured LoD2 surfaces (one ground, twelve walls, five roof sheets; the internal
ground sheet is not drawn). It replaces exactly that owner's 22 drawn / 181
native coarse triangles and its eight drawn outline segments. There were no
v188 district facade records for this owner to remove. The old conservative
navigation ring and height remain unchanged.

The source base envelope is world Y 36.359–46.073. It includes the raised central
podium. Above it, the green iron crown has a twelve-sided cross plan, twelve
niches with draped genii, Gothic pointed arches, ribs, pinnacles, crockets and
a flared iron cross. The 18 m crown height follows the Deutsche Stiftung
Denkmalschutz account; the Bildhauerei-in-Berlin entry also lists 22 m with an
unclear base datum, retained as a source conflict rather than added to the
measured base. Figure poses, tracery subdivisions, colours, rail thicknesses,
stair widths and rock shapes are careful visual approximations, not surveys.
The 0.229 rad display orientation follows the measured base/OSM courses; it is
not a claim that the documented historical 21-degree rotation is today's
absolute azimuth.

Ten mapped stair courses retain their exact OSM XZ paths and all 135 tagged
steps. Six north-side flights use the source-confirmed double-stair layout:
16 + 11 + 11 + 19 risers along either branch, with two short intermediate
landings, fitted between the measured base datums. Their uniform risers and
2.15 m widths are display estimates. Other steps follow the retained DGM. The
mapped upper railing course is preserved; there is no invented access gate.

## Water correction and preservation proof

The earlier park elevation pass incorrectly unioned the cascade and three
closed ponds, then assigned their entire connected surface world Y 15.88.
This placed the lower basin roughly nine metres above its surroundings. The
v194 patch changes only water Y: each original closed pond has its own level,
and the watercourses follow the same existing DGM as the hill. The lower basin
is Y 6.83, upper basin Y 30.95 and west pond Y 6.94. These are DGM-guided display
datums, not a hydrological survey; the upper/lower difference is 24.12 m,
consistent with the officially described 24 m cascade. A six-metre water-only
transition joins each pond boundary. Native water uses the existing four-metre
terrace grid and retains its original vertical-bank bottom vertices.

All 508 drawn / 349 native original water triangles retain their complete XZ
coordinates and colours. Native source bank bottoms stay at their old datum.
No terrain, existing nonwater bank, path or road vertex changes. Narrow new bank sheets follow the two exact retained union water rings (496-point exterior plus its original hole), connecting the existing DGM shore edge to its corrected water surface. This closes the previously exposed pale gaps without filling the source terrain holes. Native banks use separate axis-aligned steps. Source water tessellation
is retained rather than substituting new water outlines. Static pale foam and
faceted rocks make the mapped cascade readable; foam uses the same corrected
water heights as the patched packets.

`viktoriapark-v194-packet-audit.json` records immutable v1.0.93 input hashes,
output hashes/descriptors, owner triangle counts and exact preservation
multiset hashes. The script asserts that all 61,486 drawn / 158,593 native
nonwater/nonowner triangles survive, that water XZ triangle multisets are
identical and that every navigation value survives unchanged. Only packet
`1_6` changes. The script updates its descriptors against the latest manifest,
so other agents' concurrent entries are not overwritten.

## Sources and limitations

- Berlin LoD2 `LoD2_390_5816.zip`, exact parent and original polygon IDs retained
  in `src/app/src/data/viktoriaparkV194.json`; dl-de/zero-2-0.
- Existing ATKIS DGM1-derived `parkReliefV182.json`, no new terrain extraction.
- Retained Geofabrik Berlin 29 September 2026 OSM source: exact platform, ponds,
  cascade course, fence and step tags; © OpenStreetMap contributors, ODbL.
- [Landesdenkmalamt monument entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031258):
  Schinkel, iron Gothic form, twelve figures, octagonal base and northern double stair.
- [Deutsche Stiftung Denkmalschutz](https://www.denkmalschutz.de/denkmal/kreuzbergdenkmal.html):
  18 m iron crown and conservation materials.
- [Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/denkmal-der-befreiungskriege-5177/):
  twelve-sided cross plan, niches, genii, material and historical base alteration.
- [Berlin park information](https://www.berlin.de/tourismus/parks-und-gaerten/3560783-1740419-viktoriapark.html):
  24 m cascade, elevated base and park context.
- Three permitted Wikimedia Commons photographs, artist/license/source hashes
  in `viktoriapark-v194-credits.json`; visual proportion references only. No
  photographic texture or image is included in the viewer.

This bounded pass does not invent unmapped trees or regenerate the park. The
source hill's ten-metre samples are retained; this is not new sub-metre terrain.
Small figures are recognisable stylisation, without invented inscriptions.
The old conservative collision envelope is retained, so the full stair route
is visual detail rather than a newly surveyed pedestrian collider.

## Integration and checks

`createViktoriaparkV194(native = false)` returns a static texture-free group.
Three drawn batches / 282,836 bytes, one native batch / 911,964 bytes;
all geometry is identical on mobile and desktop. Native geometry uses only
axis-aligned box instances, with computed instance bounds. Day/night materials
follow the existing scene disposal convention. No runtime memory budget or
render distance changes.

- `uv run pytest -q tests/test_viktoriapark_v194.py`: 3 passed.
- `bun test tests/viktoriapark-v194.test.ts`: 2 passed, 71,982 assertions.
- Ruff focused scripts/tests: passed.
- Standalone global `tsc --noEmit` exceeded Node's default 4 GiB heap while
  loading the whole existing project; it did not report a model type error.
  Root handles the normal application build and browser release checks.

World-space camera poses (Y is world metres):

| View | Camera | Target |
| --- | --- | --- |
| Hill and cascade | `[710,100,3150]` | `[615,31,3410]` |
| Lower waterfall | `[650,52,3235]` | `[621,34,3420]` |
| Iron monument | `[637,69,3450]` | `[603,53,3490]` |
