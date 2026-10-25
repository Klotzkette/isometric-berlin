# Nordbahnhof venues and mapped Mauerpark edges — Step 10 v266

This finite pass supplements existing city geometry and changes no building
envelope, tour stop, city boundary, descriptor, mobile detail rule, residency
budget, decode allowance or prefetch radius. It creates no scene root. Original
core packets and original streamed packets remain byte-for-byte intact.

## Verified places and evidence

The venues are distinct:

| Place | Verified location | Existing source binding |
| --- | --- | --- |
| HfS Ernst Busch central stages | Zinnowitzer Straße **11**, Berlin-Mitte | Full official owner `DEBE01YYK00004jQ`; stage tower part `DEBE3Dmw8vYTObj1`, café part `DEBE3DelauZI4HLM` |
| bat-Studiotheater | Belforter Straße **15**, Prenzlauer Berg | Mapped theatre node `1246402206`; complete original owner `DEBE03YY600006rz` |
| MYJUMP Berlin Mitte | Caroline-Michaelis-Straße **8** | Mapped trampoline-park node `9282901515`, retained prism `27830228`, exact existing native voxel columns |
| DB Stettiner Carrée | Caroline-Michaelis-Straße **5–11** | Existing mapped owners `OSM-way-1545436691`, `1545436690`, `1545436689`, `1546060720`; address nodes `600118967`, `600118966`, `600118969`, `600118970` |
| Mauerpark | Existing mapped park `way/233994267` | Exact tagged stone lines and wooden bench nodes inside the retained park |

The HfS [official stage list](https://www.hfs-berlin.de/buehnen/) establishes
11/15, rather than the initially suggested 9/24. Its Uferstudios site is separate
and is not added. The [MYJUMP operator](https://myjump.de/berlin-mitte) establishes
the Mitte address; this is distinct from JUMP House in Reinickendorf and MYJUMP
Ost. The [DB Systel access document](https://www.dbsystel.de/resource/blob/418080/771e5262de9b4aec0e5120bbccdcfdfd/Anfahrtsskizze-DB-Systel-Berlin--Caroline-Michaelis-Strasse-data.pdf)
identifies **Stettiner Carrée**, which is not the separate Nordbahnhof Carré.
The DB document is dated April 2016 and is used for location and building
identity, not a claim about today's tenants or transport schedules. Its primary
PDF text was available through the web reader; a fresh direct byte request
returned 404, recorded honestly in the reference receipt.

[O&O's HfS project](https://ortner-ortner.com/de/baukunst/projekte/kultur/hochschule-fuer-schauspielkunst-ernst-busch)
documents a timber-clad stage tower and glazed café box. Its stated 24m tower
height is contextual: the complete measured source envelope, including its
part-specific elevations, stays unchanged. The inspected exterior photograph
shows vertical timber members and horizontal rails. O&O credits Schnepp Renou,
Horst Stasny and euroluftbild.de; only the first exterior photograph was used to
identify the material rhythm. [O&O's bat project](https://www.ortner-ortner.com/en/baukunst/projekte/kultur/berliner-arbeitertheater-bat)
and its Stefan Müller exterior photograph support a central framed entrance,
two low side openings and three upper openings. The existing gable remains.
The new centre opening is a compact geometric approximation; the rounded arch
and exact window/door measurements are not claimed to be surveyed.

[Grün Berlin](https://gruen-berlin.de/pressemitteilung/mehr-gruen-fuer-die-stadt-mauerpark-eroeffnet-mit-verdoppelter-flaeche)
supports Mauerpark's granite and stone-seating character. Geometry comes from
the retained OSM extract, not from protected park plans or photographs. The
[amphitheatre maintenance report](https://gruen-berlin.de/projekt-meldung/qualifizierung-mauerpark-musterflaechen-am-amphitheater)
does not establish completed later reconstruction; no future works are invented.

Exact webpage and inspected-image SHA-256 receipts, retrieval date and reuse
limits are in `nord-mauerpark-v266-references.json`. Reference photographs are
not distributed, embedded or turned into textures. OSM remains ODbL-1.0;
official source geometry remains dl-de/zero-2-0. Earlier NOTICE attribution stays
applicable.

## Visible additions and limits

- HfS: 53 vertical timber members, 164 shallow horizontal rail sections, 13 café
  glazing panels and 20 mullions on the actual complete source surfaces.
- Bat: 26 entrance, upper/low opening, sill, mullion and cornice members.
- DB: 24 small entrance/front members across the four mapped address owners.
- MYJUMP: seven entrance glazing/frame/blank fascia members on the retained hall.
- Mauerpark: six supported line segments of mapped 0.5m stone edging and five
  mapped wooden benches. No extra park area, paths or tree removal.

Timber spacing, member widths/depths, colours and glazing subdivisions are
explicit proportional display estimates. DB and MYJUMP opening positions,
frames and blank fascia are also estimates tied to their exact retained owner
and address/use point; address nodes are **not** promoted to surveyed entrance
nodes. There is no signage, tenant logo or specific new roof machinery.

The conflicting modern LoD2 families at DB/MYJUMP are not substituted for their
previously retained geometry. MYJUMP's legacy prism remains in the main city
root. The compiler checks its exact original ring/heights and the actual original
4m native building columns; the additive detail uses the existing `1_-4` tile
lifetime. Both original root files are fingerprinted in the evidence.

Stone line IDs retained here are `1094211415`, `1094211416`, `1094211417`,
`1094211419`, `1094211420`, `1094211424`. The tagged height is preserved; width
0.28m is an estimate. Other candidate segments fail complete delivered-ground
or coverage checks and are omitted. Native edges use an independent cardinal
path with short steps, preserving source-chain endpoints and a maximum sub-metre
deviation. Bench nodes are `7660299446`, `12109030267`, `12109030268`,
`12109030269`, `12109030270`. Their material, backrest and source direction are
retained; seat/member dimensions remain estimates.

## Integration and exact retained sources

`prepareNordMauerparkV266` runs first in `buildSurroundingCityChunk`, before
`prepareFriedrichshainV266` and `prepareScheunenV265`, then the original preparer
order remains unchanged. The IDs do not overlap Friedrichshain v266. Alt-Mitte
core packets already pass through this same decoder under the prefixed keys;
there is no additional world hook or group.

| Existing packet key | Drawn boxes | Native boxes |
| --- | ---: | ---: |
| `alt-mitte-v169-1_-4-piece-0` | 24 | 6 |
| `alt-mitte-v169-1_-3-piece-0` | 250 | 250 |
| `1_-4` | 7 | 15 |
| `6_-3` | 26 | 26 |
| `3_-6` | 55 | 20 |
| `4_-6` | 6 | 84 |
| `alt-mitte-v169-1_-4-piece-2` | — | 10 |
| Total | **368** | **411** |

Drawn geometry adds 8,832 vertices / 13,248 indices; independent native adds
9,864 / 14,796. Runtime recipes are 65,812 bytes. Mobile drawn uses exactly the
same recipes and production decoder as desktop drawn. Native members are fitted
to actual delivered cardinal wall planes, rather than rotated drawn members.

Each affected packet retains its original origin and complete navigation
fingerprint plus a per-mesh fingerprint covering encoded positions, colours and
indices. Changed/missing source parts, malformed rows, non-cardinal native rows
and capacity violations fail closed. Unknown keys return before decoding.
Preparation yields while hashing and building. The 900-box safety cap is a
per-recipe rejection limit, not a new live-scene allowance; existing 16-mesh,
400,000-vertex and 2,400,000-index packet limits remain.

`nord-mauerpark-v266-context.json.gz` freezes only selected public OSM objects
and the relevant complete official owner. `nord-mauerpark-v266-evidence.json.gz`
records original source/asset SHA-256 hashes, exact source faces, member support,
native projections, park-chain receipts, bench heights and provenance. No city
asset or source archive is rewritten. Rebuild with
`uv run --no-sync python -m scripts.build_nord_mauerpark_v266`.

## Validation and QA cameras

Python checks exact old bytes, venue separation, full drawn and independent
native rectangle support, actual park ground patches, source bench bearings and
bounded existing packets. Bun checks original object identity, native triangle
orthogonality, fail-closed guards, cooperative yields, production single
application and unchanged results from every earlier source-bound preparer.

Final local results: six Python tests passed (6.36s); six Bun tests passed with
988 assertions (1.396s), including all 16 earlier preparers. Scoped Ruff and
whitespace checks pass. Evidence retains five source/reference input hashes and
29 original asset hashes. Context/evidence gzip sizes are 13,450 / 16,162 bytes.

The parent performs browser QA in the in-app browser; this subtask starts no
browser process. Inspect these cameras in drawn, native and mobile drawn:

| Site | Eye | Target | Packet(s) |
| --- | --- | --- | --- |
| HfS timber/café | `[870,18,-1435]` | `[831,17,-1490]` | `alt-mitte-v169-1_-3-piece-0`, both modes |
| Bat | `[3201.36,9,-1333.474]` | `[3209.36,7,-1347.33]` | `6_-3` |
| MYJUMP entry | `[980,9,-1579]` | `[956.86,7,-1567.14]` | `1_-4` |
| DB address 7 entry | `[901,9,-1608]` | `[877.33,7,-1593.19]` | drawn `alt-mitte-v169-1_-4-piece-0`; native that key and `1_-4` |
| Mauerpark stone edges | `[2140,10,-2665]` | `[2169,4,-2702]` | `4_-6` |
| Mauerpark west benches | `[2053,8,-2686]` | `[2030,3.6,-2686]` | `3_-6` |

The Bat eye is 16m along the exact outward façade normal `[-0.5,0.866]`.
The former 28m-away eye intersected a foreground building; the corrected full
view ray clears the original buildings with a 0.2m plan margin. Isolated MYJUMP
QA must include original main-root prism `27830228` (drawn y5.2–14.2) and the
actual native voxel columns (here y5.2–17.2), as well as `1_-4`; otherwise it shows
the streamed entrance details without their existing main-root support shell.

No commits were made by this subtask.
