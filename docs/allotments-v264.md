# Step 10 — existing mapped allotment cultivation, v264

The owner requested a slightly more accurate reading of Berlin's existing
Schrebergarten areas. The retained renderer classifies `landuse=allotments` as
ordinary park green. Existing mapped huts and garden paths already have their
own source geometry. This pass adds restrained cultivation cues to the empty
parts between them, without transferring, deleting or repainting any owner.

## Sources and limits

- Retained Geofabrik/OpenStreetMap snapshot, 29 September 2026:
  `raw/outskirts-v187/candidate.gpkg`, derived from
  <https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf>.
  © OpenStreetMap contributors, ODbL 1.0. No new source download is needed.
- Complete existing drawn/native packet navigation supplies delivered ground,
  building/hut footprints, road/path surfaces, water rings and their holes.
  Exact packet SHA-256 receipts remain in `allotments-v264-evidence.json.gz`.
- Existing official Berlin tree crowns (`official_details.gpkg`, dl-de/zero-2-0)
  and core OSM vegetation points provide additional crown clearances where
  present. All existing tree geometry remains untouched, including vegetation
  outside these point catalogues. No new tree positions are generated.
- The source-context receipt keeps complete selected allotment polygons and
  adjacent OSM transport axes with original identities. Untagged path widths
  use documented conservative display widths: 2.5 m pedestrian/cycle paths,
  5 m service/track, 12 m other road classes, plus 1.2 m clearance.

The small groups contain three cultivated strips and two short, discontinuous
low hedge accents. Their spacing, orientation approximation, 8.4 × 6.4 m
conservative envelope, colours and maximum 0.62 m height are **illustrative
cultivation detail**. They do not represent measured beds, actual parcel
boundaries, cadastral ownership, planted species or surveyed current gardening.
No hut, gate, fence, path, tree or named plot is invented. No photograph,
texture, font, outside coverage or tour stop is added.

## Placement and preservation

Offline preparation intersects each full mapped allotment with the already
rendered ground of an existing primary packet. Complete group footprints must
fit the resulting polygon and remain clear of its holes, mapped path buffers,
delivered paths/roads, water, existing buildings/huts and available tree crowns.
Source-invalid near-coincident navigation holes are made valid only in the
clearance calculation, with 1 mm numerical precision; original packets and
source vertices remain unchanged. The 0.4 m garden-edge setback and 1.2 m
obstacle margins exceed this numerical tolerance.

The nearest mapped transport segment gives a local orientation cue. Small
staggered sample positions avoid drawing a continuous pseudo-parcel grid.
Separate orthogonal native footprints undergo the same complete containment
and exclusion checks. Neither family may emit more than 48 groups per packet.
Measured or previously authored buildings and vegetation always remain visible.

## Runtime and integration

`prepareAllotmentsV264(chunk, id, native)` in `AllotmentsV264.ts` runs immediately
after the existing chunk validation and **before** other preparation adapters
can alter navigation. Unknown packet IDs exit through a top-level key set before
accessing the optionally weak-packed recipe map. Existing-kind, origin and
complete navigation guards prevent double application and stale placement.
Navigation hashing yields every 512 points; generation yields every four groups.

Preparation appends one packed part, retaining all older mesh references,
lines, source origin and navigation by identity. The existing builder merges
that part into its ordinary packet mesh, so there is no dedicated resident
root, additional draw call, cached decoded copy, animation, frame loop or
texture. Cancellation discards unpublished local arrays. Normal packet upload,
parking, eviction and disposal own its lifetime. The 400,000-vertex,
2,400,000-index and sixteen-part packet limits remain checked before allocation.

A full drawn tile adds at most 3,648 vertices / 5,472 indices; a native tile
adds at most 4,800 vertices / 7,200 indices. These correspond to at most 54,720 /
72,000 packed binary bytes, or 65,664 / 86,400 bytes with twelve-byte merged
vertices and four-byte indices. Drawn mobile and desktop use the same recipe;
native construction has separate placements and orthogonal bed/hedge boxes.
Existing transport, residency, decoder and prefetch allowances remain unchanged.

Reproduce with:

```sh
uv run --no-sync python -m scripts.build_allotments_v264
uv run --no-sync pytest tests/test_allotments_v264.py
cd src/app && bun test tests/allotments-v264.test.ts
```

The Python checks validate every complete accepted footprint against the retained
source polygon, original delivered ground, existing huts/buildings, water and
paths, along with untouched original packet hashes. Runtime checks verify every
recipe, index/count/containment limits, append-only identity, stale-source
rejection, early unknown-ID exit and cancellation/retry determinism.

## Generated inventory and camera checks

The retained source has 1,013 allotment polygons. Of 508 that intersect existing
primary-packet bounds, 269 contain accepted cultivation groups after the exact
rendered-ground and obstacle checks. The others receive no speculative fill.
The recipe contains 4,420 drawn groups in 274 packets and 3,901 native groups in
264 packets; their union uses 278 existing packet IDs. The static recipe is
352,105 bytes. The source-context archive is approximately 995 KiB gzip.

Suggested scene-coordinate QA targets (Y = 3 m, flight distance 180–300 m):

| Area | Existing packet | Target X / Z |
| --- | --- | --- |
| Bornholm I, Prenzlauer Berg | `4_-9` | 2055 / -4139 |
| Canova, southern city | `city183--4_11` | -1602 / 5871 |
| Schlangengraben, Spandau | `outer187--22_-4` | -10888 / -1604 |
| Idsteiner Straße, southwest | `outer187--18_18` | -9018 / 9522 |
| Am Freibad Oberspree | `east200-17_10` | 8712 / 5615 |

The native inventory differs because a garden clearance that accepts an angled
bed group can reject its axis-aligned counterpart, and conversely. This is an
independent native interpretation, not a reduction in drawn mobile quality.
