# Eastern squares and Karl-Marx-Allee, v1.0.63

Pipeline step 10; bounded, additive recognition detail in the existing v1.0.59
scope. No bounds, source building, road, tree, movement or viewing-distance
reduction accompanies this work.

## Metric anchors and evidence

`src/app/src/data/eastSquaresV163Sources.json` retains exact OSM basin/canopy
outlines, the polygon centroids, API URLs and raw-response SHA-256 hashes.
Coordinates use EPSG:25833, x=easting−389500, z=5820000−northing.
All three anchors lie outside the detailed core on the existing outer-city
display ground y=3 m. This display level is not an elevation survey.

| Object | Exact OSM identity | Centre x,z (m) |
|---|---|---|
| Fritz Kühn, Schwebender Ring | way/24240866 | 3855.672, 125.001 |
| Urania-Weltzeituhr | way/417529567 | 2845.618, −188.915 |
| Brunnen der Völkerfreundschaft | way/52564405 | 2811.462, −285.791 |

OSM is ODbL 1.0. Published dimensions and historical descriptions supplement
these coordinates; they do not purport to measure each small sculptural part.

The [Fritz Kühn Gesellschaft](https://fritz-kuehn-gesellschaft.de/fritzkuehn/skulpturen/)
describes the 10.5 m ring, sixteen copper relief plates of 2.5 × 1.5 m,
43 peripheral jets and central water rising to 18 m. The model retains the
open steel supports, separated relief plates, independently drawn crystalline
folds, mapped waterline and broad low stone rim. The displayed intact fountain
is intentional: the user requested the complete work. The
[Senate's 4 June 2024 report](https://www.berlin.de/sen/stadtentwicklung/quartiersentwicklung/staedtebaufoerderung/nachhaltige-erneuerung/aktuell/artikel.1453454.php)
announces dismantling and plans reopening in 2027. This is **not** a claim that
the complete operating fountain is present on the construction site in 2026.

The [heritage inventory, 09060092](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09060092)
establishes Walter Womacka's two basins and seventeen rhombic copper bowls in
a rising spiral. The model includes their open vertical stems, shallow folded
bowl undersides, stepped spillways, lower outlets and the raised colourful
ceramic band. Its floral/fruit motifs are independently authored recognition
cues, not a scanned mural. The 23 m overall diameter is documented by
[Berlin's fountain guide](https://www.berlin.de/tourismus/insidertipps/5336515-2339440-brunnen-in-berlin-top-10.html).
The exact mapped water polygon remains distinct from the added rim thickness.
Intermediate bowl spacing, basin-wall heights and motif placement are display
estimates. The published 6.2 m total height is retained.

The [Berlin description of the Weltzeituhr](https://www.berlin.de/sehenswuerdigkeiten/3561749-3558930-weltzeituhr.html)
and [inventory 09020854](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020854)
establish Erich John's column, 24 time-zone faces, hour band, planetary model
and compass-rose pavement. Its mapped `building=roof, height=0` is a canopy
identity, not evidence for an occupied zero-height building or a closed block.
The model uses a narrow 2.7 m pillar with open space beneath the three-part
silver drum and open orbit bands above it. The ten-metre height and 1.5 m
column diameter are also described in the
[Weltzeituhr documentation](https://de.wikipedia.org/wiki/Weltzeituhr_(Alexanderplatz)).
Texture-free city and numeral strokes provide a representative static display;
they are not a live time service, nor a full transcription of every inscribed
city. The planetary ring angles and etched-metal subdivisions are photo fits.

## Free visual references

All three photographs were inspected; no photograph, crop or texture is
packaged or loaded by either representation.

| File | Photographer | Licence |
|---|---|---|
| [Schwebender Ring.jpg](https://commons.wikimedia.org/wiki/File:Schwebender_Ring.jpg) | Lukas Beck | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [Brunnen der Voelkerfreundschaft Berlin 1.jpg](https://commons.wikimedia.org/wiki/File:Brunnen_der_Voelkerfreundschaft_Berlin_1.jpg) | Manfred Brückels | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| [Weltzeituhr 2.png](https://commons.wikimedia.org/wiki/File:Weltzeituhr_2.png) | Enrico Mevius | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

## Avenue additions and preservation

The existing 41 Berlin LoD2 parents / 185 complete parts, paired tower crowns,
shopfronts, cornices and windows from v1.0.61 are retained. v1.0.63 adds fine
sash transoms, lintels and sill shadow lines on the same measured facade sheets.
The same source-wall clipping rejects any decoration outside a measured wall.
Fine window spacing continues to be a visual interpretation, not a per-window
survey. The v1.0.61 photograph credits and all original source rings remain
unchanged; the Schwebender Ring photograph additionally shows this sash detail.

Only drawn packets 7_0, 8_0, 9_0, 10_0 and 10_1 change. The native two-metre
interpretation remains byte-identical because these sub-block trim lines do
not replace its existing window/wall cells. `karl-marx-allee-v163-preservation.json`
compares v1.0.62 and v1.0.63 coloured-position triangle multisets and proves
that every former drawn triangle and every navigation record survives.

## Representation and runtime contract

`createEastSquaresV163()` creates three independently cullable roots containing
nine immutable merged/instanced renderables. The same full geometry and instance
bytes are used on touch and pointer devices. Day/night materials are stored on
meshes for the existing viewer lighting pipeline. No worker, decoded-payload
cache, photograph, font or continuously running animation is added.

`createMinecraftEastSquaresV163()` creates three separate cube-only batches,
without the smooth counterpart. Native cell matrices have no rotation/shear;
curves, text and water are independently sampled block forms. Memory budgets:

| Representation | Renderables | Buffer bytes | Submitted triangles |
|---|---:|---:|---:|
| Drawn | 9 | 427,354 | 82,653 |
| Native | 3 | 1,332,884 | 210,012 |

The profile exports exact duplicate-suppression IDs, focus targets and a
solid-only navigation predicate. It leaves all surrounding approaches open,
including the mosaic and space under the clock's drum. There is no new tour
entry and the established 93-place catalogue stays intact.

Seven Bun model tests pass, including exact touch parity, source coordinates,
structural counts, no texture, finite bounds, native orthogonality and open
approaches. Eight Python avenue tests pass, including measured footprint
preservation and exact equality of native output with/without the added trim.

## Rosenthaler Platz supplement

The separately committed `rosenthaler-platz-v163.json` retains eleven fixed
Berlin LoD2 parents and all forty source parts extracted from
`LoD2_391_5821.zip` (Geoportal Berlin, dl-de/zero-2-0). Original y coordinates
and all source wall/roof rings stay in the file. The packet exporter translates
only the common parent datum to existing outer-city y=3, preserving its local
height differences, pitches, dormers and open courts. Facade panes are clipped
to those measured wall sheets. Five-/six-/seven-storey registers use each
mapped OSM `building:levels`; bay spacing remains a display interpretation.

The independently located Circus Hostel is OSM way `51166236`, Berlin parent
`DEBE01YYK0000E7j`, at Weinbergsweg 1a. Its explicit OSM white colour and five
storeys agree with the inspected
[Mitte Rosenthaler Platz.jpg](https://commons.wikimedia.org/wiki/File:Mitte_Rosenthaler_Platz.jpg),
Fridolin freudenfett, 3 October 2016,
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
The model carries its white wall, grey floor borders and red name band. The
letter strokes are derived from this repository's own geometric alphabet,
not a font or photographic asset. It remains distinct from The Circus Hotel
at Rosenthaler Straße 1 (OSM POI `330264477`, parent `DEBE01YYK00000lz`). The
[operator's hostel page](https://circus-berlin.de/hostel/) supplies identity
context. The neutral cream plaster of neighbours is a conservative recognition
palette; it is not presented as a surveyed per-facade paint sample.

Exactly two Rosenthaler packets change: `3_-3`, `4_-3`, both drawn and native.
Every unowned coloured-position triangle and every original road/water/bridge
navigation record is proved to survive by the exporter. A third packet,
`5_-1`, only drops the false solid OSM clock roof envelope
`OSM-way-417529567`; the complete open `EastSquaresV163.ts` clock is its explicit
replacement. The original OSM record stays in the prepared source, and no
neighbouring building is suppressed. The clock's column-only pedestrian solid
keeps the covered space walkable.

The exporter writes a descriptor patch into an isolated directory, so unrelated
agents' changes to the shared manifest cannot be overwritten. Reproduce with:

```sh
uv run python scripts/build_rosenthaler_platz_v163.py --out /tmp/rosenthaler-v163-packets
uv run pytest tests/test_rosenthaler_platz_v163.py
```

Then merge only its three named packet descriptors and `source.rosenthalerPlatz`
into the current surrounding manifest. Source preservation reports are committed
as `rosenthaler-platz-v163-audit.json`. No new runtime building builder, data
cache or loading path is introduced. The largest packet is below 2.82 MiB
decoded, using the existing bounded loader and separate native representation.
Six additional Python tests check every transformed source triangle, every
measured navigation part, named ownership, the correct hostel identity,
orthogonal native faces and packet budgets. U8 stair reconstruction is not
claimed by this supplement; retained mapped roads and accesses remain unchanged.
