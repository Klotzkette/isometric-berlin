# Stadtbad Neukölln and Körnerpark Orangerie

Two demonstrably undersized OSM shells are replaced by their complete official
LoD2 building families. This is a finite correction of these buildings, not a
claim that every street of Neukölln has been resurveyed. The earlier Rathaus,
Arcaden, Rixdorf and surrounding city remain present.

| Place | Previous owner / height | Complete official parent | Parts / sheets | Measured family height |
| --- | --- | --- | --- | --- |
| Stadtbad Neukölln, Ganghoferstraße | `OSM-way-132238037`, 9 m | `DEBE08YYF00003Pp` | 5 / 69 | 20.787 m |
| Körnerpark Orangerie | `OSM-way-453832399`, 3 m | `DEBE08YYF0000B7B` | 7 / 41 | 8.411 m |

Every official roof and wall sheet, including its rings and holes, is retained.
The Stadtbad receives its measured hall roof and higher wings, pale plaster,
cream pilasters and cornices, grouped windows and semicircular fanlights. The
Orangerie receives its complete stepped body, tall arched glazing, white window
bars and green climbing vegetation around the openings. Small subdivisions and
colours are reference-derived estimates. No swimming-pool interior is asserted.

The photographs are external references only. No photograph, image texture,
font or remote image request is shipped. The district's
[Stadtbad conservation page](https://www.berlin.de/ba-neukoelln/politik-und-verwaltung/aemter/stadtentwicklungsamt/denkmalschutz/artikel.1515066.php)
and the [Galerie im Körnerpark](https://www.berlin.de/kunst-und-kultur-neukoelln/kulturorte/galerie-im-koernerpark/)
provide the architectural photographs. Credits: Bezirksamt Neukölln / Janina
Gallert (Stadtbad, 2024), and Bezirksamt Neukölln / Nihad Nino Pušija (Orangerie).
The image URLs and SHA-256 reference hashes are frozen in the source record.

The complete measured families are extracted from the already acquired
Geoportal Berlin LoD2 archives `LoD2_393_5815.zip` and
`LoD2_393_5814.zip` (dl-de/zero-2-0). Exact parent/leaf IDs, archive paths and
hashes, original OSM ownership, source sheets and interpretation limits are in
`geo_data/regierungsviertel/neukoelln-buildings-v342-source.json.gz`. Original
OSM outlines use Geofabrik's Berlin 2026-09-29 extract (ODbL-1.0).

Both families are rigidly translated onto the existing 3 m scene datum while
preserving their relative measured heights. **The sunken terrain of Körnerpark
is not corrected in this building pass.** Roof balusters, internal rooms and
unseen façade arrangements are not claimed as surveyed features. Native uses
an independent cardinal one-metre exterior skin with the same source extent;
its navigation follows the actual compiled roof cells. Mobile receives the
complete corresponding model, without a reduced-detail alternative.

## Ownership and integration

The source pin is `5566e5db024e4326177aeedd70d758619d1734f0`. All six existing
packet files and their descriptor hashes remain unchanged:
`ring182-8_8`, `ring182-8_10` and `ring182-9_8`, each Drawn and Native.
The last host contains the small measured Stadtbad edge crossing its tile
boundary. Runtime additions are finite per-host construction recipes in
`src/app/src/data/neukoellnBuildingsV342Packets.json`.

The shared stream wrapper imports this data only for those three literal host
IDs. The existing lossless codec exposes six eager keys and weakly decoded
individual packet recipes. `prepareNeukoellnBuildingsV342` is called after all
earlier quarter, cluster, senate and named-transport preparers and before V329
ground overlays. It uses the existing private `SourceQuarterPacketV303`
transaction; no new owner registry, residency limit or fetch fallback is added.

Each transaction pins the complete actual prepared predecessor, all mesh
fingerprints, origin, roof ink and navigation. It retains every original XYZ,
RGB and index word, retiring only the receipted old owner triangles during the
common aggregate decode. The complete replacement must be present before
retirement is admitted. Exact old exterior fragments outside the official or
Native roof footprint are reattached, with matching original roof ink and
navigation complements. The whole plan is rejected if any prerequisite changes.
The existing V305 Rathaus/Arcaden private admission survives both preparation
and decoding; the new building recipes also work when V305 admission is absent.

The six plans retire 859 old triangles, 57 roof-ink segments and 5 old navigation
records; they add 41 measured or retained-complement navigation records. The
original packet word receipts and full prepared guards are in
`geo_data/regierungsviertel/neukoelln-buildings-v342-packet-evidence.json`.
Finite render geometry: Stadtbad 2,268 Drawn / 11,596 Native triangles;
Orangerie 4,740 Drawn / 2,202 Native triangles, before tile clipping and retained
outside fragments. Counts are not new runtime budgets.

The runtime JSON is 642,584 bytes (223,866 bytes with ordinary gzip level 9);
the complete source record is 5,799 bytes and the ownership evidence 21,679
bytes. Actual bundled transport size is reported by the release build, which
uses the established per-packet lossless transform.

## Reproduce and verify

`scripts/build_neukoelln_buildings_v342.py --extract --out <review-directory>`
extracts the two official families, stages review candidates and compiles the
late prepared receipts. Run it with `uv run python`. Its candidate gzip packets
are **review artefacts, not deployable replacements**: copying them over the
unchanged public inputs would invalidate earlier source-owner fingerprints.
Only the compiled runtime recipes, source and evidence belong to this pass.

Targeted checks:

```sh
uv run pytest -q tests/test_neukoelln_buildings_v342.py
cd src/app
bun test tests/neukoelln-buildings-v342.test.ts
```

The five Python tests cover every source sheet, the actual outward façade
offsets, native cardinality and roof navigation, exact old-owner membership,
retained outside complements and complete models in the shipped recipes. The
four Bun tests cover the actual production aggregate and streaming path, both
states of V305 admission, every untouched vertex/index/line/nav record,
mutation rejection, cancellation, and lossless per-packet weak decoding.
All nine tests passed. Offline previews were inspected using a true per-pixel
depth buffer; centroid-sorted triangle previews were discarded because they
showed false diagonal wall occlusions.
