# Penguin house and Regenwaldhaus, v282

## Penguin house: complete source geometry and corrected exposed height

The four previous coarse building prisms included the height of the underground
storeys, but each was raised to the park surface. This made the penguin house
too tall. The new model retains all four measured parts, all 263 roof and wall
sheets, and every footprint coordinate unchanged in X/Z. One common rigid
offset of +1.510 m aligns the exposed lower source rim (3.690 m above NHN30)
with the existing park datum of 5.200. The highest point is consequently 12.018,
or 6.818 m above the park. The basement sheets remain in the geometry; they are
neither clipped nor individually raised. This is a documented display datum,
not a new terrain survey.

[Architect SKP](https://skp-berlin.com/zooberlin/) describes the approximately
30 m circular building as single-storey with partly two basement levels and a
dome with an approximately seven-metre interior apex. This supports the
corrected visible scale. The
[Zoo operator page](https://www.zoo-berlin.de/de/zoo-erleben/tiere-erlebniswelten/robben-pinguine)
confirms its present use. Colours and small house-name panels are illustrative
estimates, not claims of photographically measured detail. Two entrance points
come from retained OSM data and are projected onto the nearest measured facade
edge of their respective parts.

Sources: `LoD2_387_5818.zip`, parents `DEBE01YYK0002KuU` and
`DEBE01YYK0003Uyx`; children `DEBE3Dm5ne1cFFjo`, `DEBE3DgBPKel9P5i`,
`DEBE3DavnTRvf4vG`, `DEBE01YYK0003Uyx`; OSM `way/16967250`,
`node/9579925636`, `node/9579925640`.

The Minecraft building is independently sampled from all corrected sheets into
1 m cells: 340 losslessly compacted orthogonal rows. Walking collision uses the
complete roof triangles in drawn modes and actual occupied cells in Minecraft.
The ownership receipt permits replacement of only four unchanged old prism
fingerprints and 45 exactly matching native column tuples; no columns have
shared ownership. Missing, duplicated or changed source owners retain the old
native content. New overlapping neighbours protect the affected columns. The
complete required replacement scene must be attached in the same transaction
that commits the filters. Touch devices retain all parts.

## Alfred-Brehm-Haus: the present Regenwaldhaus

The former predator house is now the
[Regenwaldhaus](https://www.tierpark-berlin.de/de/tierpark-erleben/tiere-erlebniswelten/regenwaldhaus).
Its complete existing building owner `DEBE11YYI0000Nxm` (`way/11269594`, packet
`outer187-21_4`) remains unchanged, including all 124 footprint points, 125
sheets and existing navigation. The new additions follow these measured facade
edges with narrow coping and reveal details and identify three mapped entrances
(`node/288982607`, `node/305930714`, `node/427014252`). The lettering uses the
current house identity. No false present-day lion enclosure is placed here.

The missing upper hall is now a separate, additive source-supported model.
The retained OSM **line** `way/520730043` supplies its complete closed 16-corner
roof ring (1,277.251 m²); this record was absent from the polygon-only reading
of the source. The ring lies wholly inside the unchanged lower building.
The [architect/operator project submission](https://www.klimaschutzpartner-berlin.de/projekt/energetische-sanierung-des-alfred-brehm-hauses-im-tierpark-berlin-76)
describes a 16 m tall tropical hall, while the
[2020 renovation architect](https://danpearlman.com/work/alfred-brehm-haus/)
confirms preservation of its glazed roof structure.

199 retained official WMS JSON responses (180
[bDOM surface](https://gdi.berlin.de/services/wms/bdom) and 19
[DGM terrain](https://gdi.berlin.de/services/wms/dgm1) queries) support the
added upper silhouette. The median local terrain is 38.31 m NHN; the refined
roof maximum is 54.22 m NHN, or **15.91 m above terrain**. Aligning terrain to
the existing park datum of 3 m gives a model maximum of **18.91 m**. Reusing
the older body's basement-based vertical shift would incorrectly add more
than 3 m to this new roof, so it is explicitly not used.

118 safe interior samples retain their measured heights. A constrained
triangulation clips every face to the complete concave upper ring and retains
the measured crest. The perimeter eave is an explicit **estimate** of
50.125 m NHN, the median of 52 nearly level roof-band measurements. Samples
within 2 m of the sharp outer wall mix low and high surfaces and remain in
the evidence rather than becoming artificial dips. The result is an
interpolated surface profile, not surveyed construction planes or an exact
steel/glass panel pattern. Colours are restrained illustrative treatments.

All 125 original lower sheets, original source/navigation files and packet
bytes remain unchanged. New upper walls start at the old visible roof at
11.071 m and meet the estimated 14.815 m eave; the old lower-body proportions
remain a limitation. Drawn mode adds 250 roof triangles and 32 side-wall
triangles. Minecraft independently samples the source interpolation into
1,275 one-metre columns, merged to 470 orthogonal runs with half-metre
vertical steps. Its maximum is 19 m. Navigation follows the actual drawn
slopes or occupied native columns, including collision radius.

The new upper owner and its collision callback are attached only after the
exact complete parent witness passes in resident packet `outer187-21_4`.
Missing, duplicated or changed parent records fail closed. Publication,
abort, eviction and mode changes share the packet's existing lifetime; no
unloaded global obstacle or new loader is added. The runtime data occupies
18,252 bytes. The offline replay generator, all original query responses and
the preservation receipt are `build_brehm_tropical_hall_v282.py`,
`brehm-tropical-hall-v282-samples.json.gz` and
`brehm-tropical-hall-v282-receipt.json` respectively.

## Hühnerhaus: one complete measured rear aviary

The [Berlin monument inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050439)
identifies the 1908 Hühner- und Taubenhaus and the aviaries surrounding its
semicircular rear. The retained LoD2 tile contains narrow adjoining polygons
around that exact house, OSM `17957388` / LoD2 parent `DEBE01YYK0002OV0`.
The bounded addition uses only the complete low western polygon
`DEBE01YYK0003Uqa`: four wall planes, one sloping roof plane, all original
vertices and no holes. A single rigid +0.885 m translation aligns its measured
4.315 base to the existing 5.200 park surface. Its complete height remains
3.430 m, with roof elevations 7.570–8.630 in the viewer frame.

This individual aviary was absent from both the core prism inventory and the
v165 curated models. Consequently **no prior prism, source sheet or native
column is retired**. Main-house prism `17957388` and its coarse native corner
column `[-605,299,52,172,3]` remain unchanged. The one illustrative chicken's
full 0.4 m body radius plus 0.4 m clearance avoids both, as well as mapped paths,
solid buildings and water. Its small rectangular circuit is 1.0 × 0.6 m.

The [operator's 2025 report, p. 35](https://www.zoo-berlin.de/fileadmin/zoo-berlin/downloads/Investor_Relations/Geschaeftsberichte/Geschaeftsbericht_2025_digital.pdf)
confirms domestic chicken keeping in the historic house. One generic domestic
chicken is a sparse illustration, not a claim about current stock or a specific
breed in this particular compartment. The report was available as indexed
operator text during this check; a direct fetch of the PDF URL returned 404.

The authoritative rear-aviary description supports a see-through wire
interpretation. All five measured planes are represented by their complete
frames and interpolated lattice. The 0.55 m lattice spacing, 0.025 m wires,
0.08 m frames and colours are explicit recognition estimates. Drawn rods and
independently stepped cardinal Minecraft cells occupy the same measured envelope;
no opaque block fills the animal floor. The source profile is retained in the
evidence file. Other annular polygons have implausibly tall source roofs and are
left untouched rather than being flattened by analogy.

The cage is built in the existing required-site transaction. Its source-bound
walking enclosure is installed only under the same completed transaction flag;
the existing neighbouring paths remain open. This is an additive source owner,
not an extra entry in the Penguin replacement receipt.

## Reproduction and verification

`scripts/build_zoo_houses_v282.py --check` checks the entire derivation against
unchanged local inputs. `zoo-houses-v282-evidence.json.gz` stores the complete
original house profiles and SHA-256 hashes of retained sources, former models
and navigation. Five Python tests replay the source derivation. Four runtime
tests check actual geometry buffers, orthogonal native matrices, fail-closed
ownership receipts, independent roof navigation, clear air above the corrected
penguin house, and the additive cage's gated navigation and visible lattice.
The additions use no textures, private animation
loop or separate loading routine.
