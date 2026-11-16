# Düppel and the Brücke-Museum neighbourhood — V354

This is a finite correction of the mapped museum sites. It does not claim a new
survey of every building or a photorealistic reconstruction of the whole village.
No existing terrain, road, path, vegetation, source footprint or old navigation is
removed. There are no additional district chunks or increased live budgets.

## Museumsdorf Düppel

Düppel represents a reconstructed **medieval village of about 1170–1220**, not a
Stone Age village. Its experimental archaeology also includes two separate
Bronze Age houses. The [museum](https://www.berlin.museum/museum/museumsdorf-dueppel)
and [support association's building account](https://www.dueppel.de/museumsdorf/gebaeude/)
explain the evidence and interpretive nature of the reconstructions.

The Berlin OSM extract dated 13 November 2026 contains **37 building outlines**
within the mapped museum site, way `28147152`. The audit compares each with the
retained Drawn and Native navigation envelopes:

| Disposition | Count | Treatment |
| --- | ---: | --- |
| Existing mapped envelopes | 26 | Retained; three receive timber/reed materials and source-attached courses |
| Previously absent numbered outlines | 3 | Reconstructed timber/reed recognition models |
| Other absent outlines without a secure individual exterior match | 8 | Explicitly unresolved; no guessed houses added |

The three additions are mapped references **10, 11 and 15**: OSM ways
`346675394`, `159434613` and `159434612`. Reference 10 is an open raised hay store
with a hipped reed roof, four posts, timber deck and woven screen. The two houses
use low log walls, steep reed roofs, timber roof retainers and the clay/wood gable
distinction visible in the museum's photographs. The plans come from the mapped
outlines. Eave/ridge heights, reed thickness, log gauges and closed door leaves
are explicit photographic display estimates, not measured elevations. The
movable furnishings and historical reconstruction are not presented as excavated
certainty.

The primary visual references are Stadtmuseum Berlin's published models:

- [House 10](https://sketchfab.com/3d-models/museum-village-duppel-house-10-6eebd94c865f4383a61ce7c7a706c607)
- [House 11](https://sketchfab.com/3d-models/museum-village-duppel-house-11-fb402b6df697443caa8bcac17b4c8daf)
- [House 15](https://sketchfab.com/3d-models/museum-village-duppel-house-15-d0a5b79785be47c486f72218ee6e607a)
- [Palisade](https://sketchfab.com/3d-models/museum-village-duppel-house-1-palisade-e19cc59ae3394f1cbdb0b6ded98b855a)
- [RETOLD's Building 10 record, photographs and site diagram](https://retold.eu/case-study/system/buildings/building-10)

The Stadtmuseum models are credited to Stadtmuseum Berlin, CC BY 4.0. Only their
published images were inspected; no downloaded photogrammetric mesh or image
texture is shipped. Museum model numbering, current OSM reference tags and an
illustrated excavation plan are different evidence layers. The RETOLD point is
not used to move the mapped store: it differs from the mapped ref-10 outline by
about 24 m. The model/type correspondence is documented, not claimed as a
photogrammetric registration.

Three retained measured V326 source families, `DEBE06YYA000081C`,
`DEBE06YYA0000Ipi`, and `DEBE06YYA00009CA`, had the neutral default wall/roof
palette. Their **exact existing triangle positions and navigation survive**;
the corresponding 52 Drawn / 100 Native triangles receive timber and reed
materials, plus source-attached horizontal timber courses and fine roof reed/eave/ridge relief. The original source records remain in the repository and in the V354
evidence. All other measured buildings retain their original geometry and colour.

The wooden palisade follows OSM way `159434619`, including its tagged 4 m height.
Its source gate, node `3531946274`, remains open with a 3.2 m display clearance and
a raised lintel. Timber gauges and the opening width are photo-based estimates.
The raised store has separate platform, supports and roof collision, including
its sloping underside in Drawn; the volume under the roof stays open. Native is
constructed independently from source-contained cardinal cells, including the
open volume. It is not a snapped Drawn mesh.

Two mapped wells, the remaining unidentified huts, and the separately documented
Bronze Age experiments are retained without new guessed exterior models. Their
individual present-day appearance has not been securely registered to the map.

## Brücke-Museum and Kunsthaus Dahlem

The existing measured V190/V326 museum and studio ensemble already contains the
low white Brücke-Museum, its annex, and the three source families of Kunsthaus
Dahlem. These shells, their fittings, original positions and navigation remain
intact. The [Brücke-Museum architecture account](https://www.bruecke-museum.de/de/museum/63/architektur)
and [Kunsthaus account](https://kunsthaus-dahlem.de/haus/ueber-uns/) are the primary
building references. The
[2026 museum competition](https://www.berlin.de/sen/bauen/wettbewerbe/2026/bruecke-museum/)
is a future proposal and is not represented as already built.

The [current Café im Kunsthaus Dahlem](https://www.cafe-im-kunsthaus-dahlem.de/)
documents timber slat tables/chairs with dark folding metal frames. Four table
groups with eight chairs provide bounded recognition inside its mapped outdoor
seating polygon, way `1558604602`. Their movable arrangement, count and
dimensions are estimates. No invented café façade, sign, greenhouse or sculpture
is added to an arbitrary adjacent building.

Every furniture foot has a recorded surface sample from the **actual production
decoded host geometry**, independently for Drawn and Native. The chosen areas
are covered in both modes and remain outside mapped building footprints. This
avoids placing furniture on the flat navigation datum while the visible
Grunewald terrain is about 17–18 m high in world coordinates. The terrain and
its existing paths are unchanged. Official café photographs are reference-only;
no photograph pixels are included in the viewer. The café credits Gerald Greh
for its entrance photograph; Kunsthaus credits Gunter Lepkowski for its current
exterior photograph.

## Ownership, size and verification

`MuseumsSouthwestV354.ts` lazily loads one bounded 245,408-byte gzip recipe source. Six exact mode/host receipts cover only
`outer187--19_20`, `publicInstitutions326--19_20-p0`, and `outer187--14_11`.
All additions share those resident hosts' admission, eviction, mode changes and
disposal. There is no separate scene controller, startup inventory, remote map
query, image texture, worker-budget increase or always-resident layer.

Full raw and prepared mesh/navigation/line guards fail closed if a predecessor
changes. Material successors retire only their reproduced original triangles;
all positions, other triangles, colours, old navigation and line words are
checked through the real production decoder. New navigation is finite and
host-owned. Both the hay-store opening and palisade gate have traversal probes.
Native faces are independently cardinal. The furniture tests recheck all 192
floor samples against the real production terrain.

Validation commands:

```sh
bun test src/app/tests/museums-southwest-v354.test.ts
uv run pytest -q tests/test_museums_southwest_v354.py
uv run ruff check scripts/build_museums_southwest_v354.py tests/test_museums_southwest_v354.py
```

The production decoder, exact predecessor preservation, Native cardinality, source containment, café floor support and village walking-floor lifecycle are checked by the tests below. The finite source,
complete 37-outline inventory, estimates, old families, physical floor samples
and transfer counts are retained in
`geo_data/regierungsviertel/museums-southwest-v354-source.json.gz`.
Reference-only task files are excluded from the public payload. Reproduction
uses `build_museums_southwest_v354.py` with `PYTHONPATH=.:scripts` and the bounded
`capture-museums-southwest-v354.ts` production capture; no older mesh packets are
regenerated.

### Southern village clearing

The formerly missing ground in the southern host is now a finite part of mapped
grassland way `28147152`. Mapped buildings, woodland, water and all prior
ground/road coverage are subtracted. Source paths keep their actual courses;
1.8 m pedestrian and 3.2 m service widths are explicitly estimated. This does
not reconstruct the entire 8.3-hectare site. The existing local 3 m village
datum is retained as a display estimate, not a new DGM survey. The surface is
at 3.02 m. Native uses independent one-metre cells wholly inside the mapped
clearing and paths. The exact delivered coverage supplies a walking floor only
while its successfully admitted host recipe is resident. No prior ground or
terrain sheet, navigation entry, woodland or building is replaced.
