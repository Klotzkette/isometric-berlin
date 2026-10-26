# Auguststraße / Oranienburger Straße: retained upper-window depth

This finite v274 addition gives already existing upper windows shallow stone heads
and outer reveals. It introduces no new window positions, glazing, building masses,
source owners, terrain, navigation, streaming roots, textures or animation.

## Exact source and protection

`scripts/build_august_fronts_v274.py` reuses the v239 exact-pane extractor with a
**new** source file, `august-fronts-v274-source.json.gz`. The original v239 source is
never overwritten and its SHA-256 remains recorded and tested. Every candidate
requires both actual delivered pane triangles and its original source wall. The
complete relevant source-file and packet hashes remain bound. Existing Berlin
ALKIS and OpenStreetMap provenance is retained; no new surveyed fitting dimensions
are claimed. References: <https://gdi.berlin.de/services/wfs/alkis_gebaeude> and
<https://www.openstreetmap.org/>.

All named owners protected by v273 remain excluded. The five photographed v270
Tacheles owners are explicitly excluded even though their older triangles still
exist in the immutable source packets. This prevents a raw-packet match from
adding obsolete window detail over the newer photographed facade models.

The extraction contains 296 exact candidate panes. Only ordinary upper windows
at least 4.5 m above their retained wall base are eligible, and the complete outer
fitting rectangle must remain inside the original wall polygon. At most twelve
openings per owner are selected, distributed over the retained window register.
The final selection contains **109 openings: 108 on Auguststraße and one on
Oranienburger Straße**. This is deliberately limited coverage, not a claim to have
rebuilt either entire street. Other Oranienburger candidates are protected or fail
the complete independent native-wall fit. Existing details on both streets remain.

## Independent native fit and bounded construction

Drawn windows receive one shallow head and two narrow outer reveals. Fitting
sections, neutral stone colours and projections are display estimates. Existing
glazing remains unobstructed. The native construction does not rotate those boxes:
each short head segment and each jamb is independently fitted to a complete actual
cardinal wall polygon from the delivered native packet. A maximum 2.5 m alignment
distance accommodates retained coarse 4 m diagonal wall steps; full section
coverage by an actual wall remains mandatory. Accepted wall planes and coverage
polygons are retained in the evidence. Native geometry is fully orthogonal.

The runtime helper `prepareAugustFrontsV274` runs within the existing cooperative
tile construction, after earlier append-only preparers. Original mesh records,
geometry/colour/index fingerprints, origin and navigation fingerprint must match.
Any mismatch, malformed basis, invalid bounds or existing capacity conflict skips
the addition without modifying the input. Prior appended parts remain by identity.
Hashing and construction yield to the existing scheduler. Reapplication is
idempotent.

The unchanged limits remain 16 mesh parts, 400,000 vertices and 2,400,000 indices per
tile. The new helper permits no more than **900 additional boxes per tile**, with
the actual maximum 336. Mobile uses the same complete selected details. No new
residency allowance, descriptor, animation or persistent decoded cache is added.

| Existing tile | Drawn boxes | Native boxes |
| --- | ---: | ---: |
| `2_-2` | 3 | 6 |
| `3_-2` | 156 | 312 |
| `4_-2` | 168 | 336 |
| Total | 327 | 654 |

The raw runtime JSON is 121,889 bytes; source and evidence gzip files are 159,784
and 157,392 bytes. These are added encoded source/download bytes, not a claim of
unchanged total memory. Actual geometry is constructed only in the existing tile
lifetime and is removed with that tile. Existing lossless delivery handles the
recipe; the runtime guard can reject before creating geometry.

## Validation

`tests/test_august_fronts_v274.py` verifies unchanged historical provenance and
packets, both real source triangles for every candidate, protected-owner exclusion,
upper-floor and source-wall containment, actual native wall coverage, deterministic
replay, full original-prefix guards and the unchanged bounds.

`src/app/tests/august-fronts-v274.test.ts` verifies exact input preservation,
orthogonal native geometry, idempotence, fail-closed source/bounds/capacity guards,
cooperative yielding, prior append preservation and the real production pipeline
for all three tiles in both modes. The pipeline test requires the new kind exactly
once and preserves every original kind. No browser inspection or claim of full
photogrammetric reconstruction is made for this bounded addition.
