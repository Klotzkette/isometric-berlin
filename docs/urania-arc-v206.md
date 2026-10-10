# Step 10: Urania and Arc de 124,5° — v206

This refinement covers one existing Urania building and the nearby Bernar Venet
sculpture. It uses the two photographs supplied by the project owner. Their
file hashes are retained in `geo_data/regierungsviertel/urania-arc-v206-source.json`;
no photograph, crop, reflection image or new texture is shipped.

## Source and correction boundaries

The complete 21 official LoD2 sheets of parent `DEBE07YY900005Dq` are copied
unchanged from the retained v188 evidence. Coordinates retain the original
EPSG:25833/NHN data and the existing display transform:
`x = easting - 389500`, `z = 5820000 - northing`,
`y = NHN - 34.676 + 5.2`. The published source range is 14.735 m; the higher
roof remains at Y 19.935, the lower rear roof at Y 14.088. The actual retained
source-floor vertices are at Y 5.211. The higher roof uses the original v188
indexed mesh builder, including every position, normal and index byte.

The old authored Urania recipe was a 67.44 m proportional rectangle with a
projecting canopy, 7.8 m colored pillars and red sign. Its front was inconsistent
with the official 37.41 m street edge and the owner's photograph. Only this
exact recipe, its previous v188 upper-facade supplement, and the coarse Urania
prism yield to the complete replacement. Both historical factories remain
available with their default `includeUrania = true`; production passes `false`.
Lützowplatz and every other City West model remain unchanged.

The actual prism payload ID is **`11687794`**. `OSM-way-11687794` is its former
semantic metadata label, not the runtime prism ID. The source receipt keeps the
original prism record and payload hashes. Native mode suppresses only the 86
recorded four-metre voxel columns `[xIndex, zIndex, 52, 172, 3]` whose centers are
uniquely owned by that prism. The adjacent owner `33654713`, including its column
at `[-1610,1898]`, remains. No source packet, source prism, voxel payload, ground,
tree or navigation asset is rewritten.

Only the lower portions of street-wall sheets 4, 9 and 10 are clipped below
Y 8.55 to show the photographed entrance. Recessed glazing sits 1.65 m behind
the actual facade, with thirteen pale columns. The complete irregular rear
wing, source ground and roofs remain. The recess depth, column sections,
26-by-8 front grid, 17-by-8 return grid, blue/green/grey mirror tints and sign
sizes are visual estimates. No reflected neighbouring building is invented.
The yellow `UraniaBerlin` panel, magenta `Denksporthalle` plaque and tall yellow
return panel use original mixed-case stroke geometry. The small repeated
identity on the return is a restrained display cue, not a transcription of
unreadable event text.

## Sculpture evidence

[Bildhauerei in Berlin, Susanne Kähler and Jörg Kuhn, “Bogen 124,5 Grad”](https://bildhauerei-in-berlin.de/bildwerk/bogen-1245-grad-5325/)
identifies Bernar Venet's 1987 sculpture, black-painted welded COR-TEN steel,
its approximately 40 m span and maximum 21 m height at the longer end toward
Kleiststraße. [Berlin's 2019 art committee record](https://www.berlin.de/sen/kultur/foerderung/foerderprogramme/kunst-im-stadtraum-und-kunst-am-bau/2019_empfehlungen_bak.pdf)
confirms the An der Urania median location. Sources were checked 2026-10-10.
The 12 m figure on math.berlin conflicts with the sculpture inventory's explicit
21 m maximum. The latter is used as a catalogue constraint, not as a survey.

Retained OSM node `1239899685` gives the locator
`[-1693.171975443,1907.803344888]`. Median way `26722368` supplies the actual grass
polygon; its nearby edges give the southwest axis toward Kleiststraße. All arc
vertices stay within that polygon. The OSM artist-name typo is corrected using
the primary inventory; the artist is Bernar Venet.

The open, asymmetric circular band fits the approximate span, maximum height
and title angle 124.5°. The 1.1-by-0.55 m rectangular section, resulting radius,
end angles and positioning of the support relative to the OSM locator are
explicit display estimates. The span midpoint is anchored at the mapped node;
the node is not treated as a surveyed foundation. The taller end points
southwest. The 128-segment arc has no closing chord, crossbar or invented base
slab. Its opening and unequal ends also remain in the native block model.

## Runtime and navigation

`createUraniaArcV206(minecraft)` creates separately bounded Urania and sculpture
batches. Desktop and touch use the same full architecture. Native mode creates
only axis-aligned surface instances. Its small grid, plaque and ink depth
offsets prevent backing blocks from concealing the sign. Every instance buffer
is allocated at its final count, every mesh has a local culling bound, and both
day and night materials are present.

| Representation | Draw calls | Explicit triangles | Instances | Geometry/instance bytes |
| --- | ---: | ---: | ---: | ---: |
| Drawn | 4 | 2,627 plus unchanged indexed roof | 117 | 293,574 |
| Native | 2 | shared unit-box geometry | 7,679 | 584,900 |

The compact renderer JSON is 795,185 bytes. No large retained source layer is
replaced. The lightweight navigation JSON is separate from this rendering
payload. Its 16 parts preserve the recessed solid interior, full upper slab,
complete rear wing and thirteen columns. `uraniaArcV206RoofAt` retains both
source roof levels. The compiled pedestrian obstacle test proves an approach
between the columns is free while interior, columns, upper body and rear wing
remain solid. The raw source collision prism is replaced, not merely deleted.

Production integration uses `createCityWestDetails(profile, false)`,
`createUraniaLuetzowV188(native, false)`, the new factory, and the exact prism ID
above. `uraniaArcV206SourceColumn(x,z,bottomY,topY)` is the native coarse-column
filter; `URANIA_ARC_V206_NAVIGATION_PARTS` supplies the replacement collision.

## Rebuild and verification

Run `uv run python scripts/build_urania_arc_v206.py`. It reads only the committed
bounded receipt and writes the two renderer/navigation JSON files. The tests
rebuild the renderer in memory and compare it with the shipped data, retain all
21 official sheets, prove exact old roof buffers, verify source-plane facade
placement, test outside-observer reading direction, and check native text depth.
They independently decode the canonical voxel rows to prove all 86 suppressed
columns and the retained neighbour. Geometry preservation tests independently
compare all unrelated old objects against release v1.0.105.

Focused verification: `tests/test_urania_arc_v206.py` and the old v188 tests pass;
`src/app/tests/urania-arc-v206.test.ts`, v188 and v206 preservation tests pass.
A real Chrome browser was used for close drawn/native isolated-model views of
both subjects. The production viewer is checked separately by release QA.
Useful camera poses (38° FOV): Urania position `[-1710,27,1940]`, target
`[-1640,12,1922]`; sculpture position `[-1730,32,1865]`, target
`[-1693,14,1908]`.
