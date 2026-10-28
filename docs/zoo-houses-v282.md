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

The
[architect source](https://www.haas-architekten.de/projekte/glashaeuser/alfred-brehm-haus-im-tierpark-berlin)
describes the tall central tropical hall. The complete locally retained
building source instead contains only a flat roof; a reliable current profile
of the upper hall could not be derived from it. This remains an explicit gap.
The facade additions must therefore not be described as a complete
reconstruction of that tropical hall.

## Reproduction and verification

`scripts/build_zoo_houses_v282.py --check` checks the entire derivation against
unchanged local inputs. `zoo-houses-v282-evidence.json.gz` stores the complete
original house profiles and SHA-256 hashes of retained sources, former models
and navigation. Four Python tests replay the source derivation. Three runtime
tests check actual geometry buffers, orthogonal native matrices, fail-closed
ownership receipts, independent roof navigation and clear air above the
corrected penguin house. The additions use no textures, private animation
loop or separate loading routine.
