# Ring stations and Europasportpark v307

This finite correction preserves the existing 27-stop Ringbahn inventory, its
station anchors, complete mapped platforms and closed route. It replaces the
flat Gesundbrunnen and Landsberger Allee presentation only after their complete
measured terrain and architecture have been admitted together. Wedding retains
its established station, steps and historic brick viaduct; the additional
concrete underside follows its existing complete platform footprint.

## Evidence and scope

The source ledger is `geo_data/regierungsviertel/rail-sse-v307-source.json.gz`.
It keeps the exact dated PBF hash, all 27 station records, five LoD2 archive
hashes, all 38 selected building parents and their complete leaf parts, original
wall/roof sheets, court holes, mapped paths, resolved predecessor owners and
source credits. No photograph pixels or image textures are packaged.

Primary references checked on 2 November 2026:

- [S-Bahn Berlin S41](https://sbahn.berlin/fahren/s41/), the complete station order
  and approximately 37 km Ring.
- [S-Bahn Berlin Wedding](https://sbahn.berlin/fahren/bahnhofsuebersicht/wedding/)
  and [Landesdenkmalamt record 09030317](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030317),
  distinguishing the modern concrete station from the nineteenth-century
  yellow-brick viaduct.
- [DB InfraGO Gesundbrunnen](https://www.bahnhof.de/berlin-gesundbrunnen) and its
  [published station plan](https://www.bahnhof.de/downloads/station-plans/528.pdf).
- [Schüßler-Plan engineering magazine](https://www.schuessler-plan.de/datas/Publikation_plan_Magazin/SP_plan_5_Magazin.pdf),
  the existing station plate, open lightweight roof and support spans.
- [Berliner Bäder-Betriebe SSE](https://www.berlinerbaeder.de/baeder/detail/schwimm-und-sprunghalle-im-europasportpark-sse/),
  its identity, location and direct connection to Landsberger Allee.
- [Dominique Perrault Architecture](https://perraultarchitecture.com/en/projects/velodrome-and-olympic-swimming-pool-berlin/)
  and [GKD project record](https://www.gkd-group.com/de-de/architektur/projekte/olympic-velodrome-and-swimming-pool-berlin/).
  These establish the design and metal roofs; their restricted image files were
  not downloaded or claimed as inspected photographs.

Berlin DOP 2025 spring orthophotos for Wedding, Gesundbrunnen and Europasportpark
were inspected through the official WMS. DGM1 and LoD2 remain the height and
building geometry authorities. Source licences and individual credits remain
in the ledger; the OSM extract remains subject to ODbL.

## Heights, terrain and completeness

The scene datum is NHN minus 30 metres. Gesundbrunnen's measured railway floor
is generally around scene Y 11–12 m while adjacent streets are around 18–20 m.
The cutting therefore follows the real six-to-nine-metre separation. The
Europasportpark landscape lies around 25.5–25.7 m, with roof edges around 26.2 m
and lower excavated approaches around 18.5–19 m.

Both profiles use a four-metre NW/SE piecewise planar field. Their domains
exclude ordinary foreign building contacts with a 16 m allowance and subtract
the complete Humboldthain park from the railway field. A 24 m inner blend keeps
the existing outer boundary. Native geometry independently uses four-metre
horizontal cells and real vertical risers. Its walking sampler uses those same
cell heights. Cell selection first ceilings to an eighth of a metre; the final
UInt16 centimetre stream rounds to nearest with ties to even. All vertices of a
horizontal source plane use one scalar height before that rounding, so a
half-centimetre endpoint cannot produce a one-centimetre diagonal. The terrain
walking sampler matches the final centimetre plane. Float32 architectural
platforms retain the original eighth-metre delta and their actual source lifts.

`terrain_fields_v307.py` clips each original source-ground triangle once against
the union of disjoint v306 and v307 domains. Source XZ, original surface plane
and full UInt16 linear paint survive in its outside complement. Required roots
own the complete new inner surfaces. No second streamed copy is appended.

Humboldthain occupies the existing core aperture and has no surrounding-packet
ground owner. Its replacement is therefore compiled from the actual production
core, including the retained initial raster and the separately transferred
worker surface families. The capture reproduces worker compaction, transfer,
deserialization and all existing client aperture cuts. Native ground is captured
from its actual generator stage and subsequent required-site aperture cuts.
Worker core buildings have no ground raster; no fictional second worker raster
is used. Batch IDs distinguish identically named park surface meshes.

Core outside fragments retain Float32 position, RGB and normal values and the
original material class and parameters. Uniformly painted old surfaces use
neutral vertex paint with their original material colour. The field's inner
16 m reconciliation joins the actual original coarse core floor to the measured
four-metre surface. Original instance and triangle ordinals, full attribute
hashes, material values and outside fragments remain separate immutable receipts.

The small core walking index references the actual admitted render geometry and
its face ordinals. It never decodes or retains a second copy of the position or
index buffers. A bijective permutation groups new inside faces by cell; source
attributes and all oriented faces remain bit-identical. Old receipts and outside
geometry are unaffected.

## Architecture and navigation

All selected sports and access-building leaf parts retain their source sheets
and holes. The generalised closed station-roof envelopes become open canopies
with source-bound fascia and piers. Their original sheets remain in the ledger.
The complete mapped SSE roof complement absent from the LoD2 rim is retained.
Its thin roof level, roof seams, skylight rows, canopy fascia, pier section sizes
and sleeper details are explicit display estimates, clipped to their mapped or
official source boundaries. Stair axes, available widths, level intervals and
step counts come from the mapped source. Partial-level stair segments keep
their actual level intervals.

Original station name signs, tactile edges, platform geometry and fittings are
retained at the measured grade. Source roofs follow their real slopes. Native
roofs are independently constructed cardinal cells sampled from those slopes.
Navigation follows the actual roof triangles, platform cells and individual
stair treads rather than a filled station bounding rectangle.

Eight spatial meshes per mode enable ordinary frustum culling. The partition
preserves every position, colour and oriented triangle. Mobile receives the
same complete catalogue. The private completeness receipt checks actual child,
attribute, index, storage, transform and material identities, legal GPU parking,
and disposal. Public labels and foreign material clones cannot admit a root.
Legitimate privately registered Schwellenraum and Minecraft materials remain
valid. Loss of admission restores the exact old station presentation. Old mobile
station attributes may already be interleaved before lazy admission: their
logical original Float32 words are checked bitwise, with private backing,
stride, offset, version and parked-storage identities retained afterward.

## Reproduction and checks

The bounded capture scripts require an explicit external evidence directory.
Capture the published predecessor before integrating new source ownership:

```sh
cd src/app
bun scripts/capture-rail-sse-v307.ts /absolute/evidence/prepared
bun scripts/capture-rail-legacy-v307.ts
bun scripts/capture-core-terrain-v307.ts /absolute/evidence/core-predecessor
cd ../..
uv run python scripts/build_rail_sse_v307.py
uv run python scripts/build_rail_terrain_contact_v307.py /absolute/evidence/prepared
uv run python scripts/build_rail_sse_architecture_v307.py /absolute/evidence/prepared
uv run python scripts/build_rail_sse_packets_v307.py /absolute/evidence/prepared
uv run python scripts/build_core_terrain_contact_v307.py /absolute/evidence/core-predecessor
uv run pytest -q tests/test_terrain_fields_v307.py tests/test_rail_sse_v307.py
cd src/app
bun scripts/pack-core-words-v309.ts --input src/data/coreTerrainContactV307.json --out /absolute/evidence/core-packed.json --receipt /absolute/evidence/core-word-proof.json
bun scripts/pack-core-words-v309.ts --input src/data/railSseArchitectureV307.json --out /absolute/evidence/rail-packed.json --receipt /absolute/evidence/rail-word-proof.json
bun test tests/rail-sse-v307.test.ts
```

The integration build installs the proved packed derivatives and updates the
small core navigation file's geometry SHA. The build-only word packer supports
only these two finite new source families: core `meshes` and rail architecture
`models`. Their positions and indices use wrapped UInt32 axis deltas, zigzag and
byte planes, preserving every Float32 bit and index. Separate receipts prove
decoded byte equality for every stream. Colours, normals, original constructor
recipes and all outside fragments remain unchanged. Weakly held compressed
transport is owned by the integration build; it is not a second geometry source.
The separate native-plane evidence records a numerical correction of exactly
two newly authored inside Y words from 17.1250019073 to 17.125 m. Original
constructor variants, outside fragments, indices, normals and colours remain
unchanged; the previous raw and transport proofs remain explicit predecessors.

Tests cover union partition and exterior preservation, full linear colour,
native cardinal geometry, actual cutting heights, immutable Ring inventory,
source completeness, spatial partitions, render-buffer walking, exact old-owner
restoration, altered-source rejection, real material modes and GPU parking.
The integration layer separately owns atomic multi-site admission, bridge replay,
actual-core rollback, lazy loading, source-quarter composition and application
performance checks. These modules do not add coverage, tour stops or change
existing display modes or source controls.

## Source-bound road bridges

Badstraßenbrücke and Swinemünder Brücke are separate road crossings. Their deck
domains follow complete mapped axes and end caps, with the documented widths of
26.2/28.83 m and 18.6 m respectively. They are distinct from the west station
concourse and the eastern indoor pedestrian bridge.

`partition_rail_bridge_contact_v307.py` joins original source ordinals to the
existing compiled contact ranges. Of 977 identified road/path faces, 823 are
already owned by the v307 ground transfer. Only their deck-domain fragments
yield; their one original outside complement and SourceQuarter retirements
remain unchanged. The 154 other original faces require their own disjoint
complete transfer in the bridge implementation.

The exact removed measured fragments form `railBridgeUnderdeckV307.json`, which
belongs to the complete bridge required root. They retain their measured
positions and native cardinal planes, with the actual neighbouring source rail
palette `[10537, 8224, 6168]`. Its proof pins the full captures and the intersecting
3.15 m source rail faces. The old street/path paint appears in the higher deck
replay. This paired partition preserves the complete railway floor underneath
without introducing a second estimated terrain plate. The bridge model, its
lower floor and all dependent old-owner transfers share one full admission.

After generating the ordinary contact, reproduce this stage before packaging:

```sh
uv run python scripts/partition_rail_bridge_contact_v307.py geo_data/regierungsviertel/gesundbrunnen-bridge-contact-exclusions-v309.json.gz /absolute/evidence/prepared
uv run pytest -q tests/test_rail_bridge_partition_v307.py
```

The partition proof records original source ownership, compiled face ranges,
exact complement areas, new floor ranges, original attribute-prefix equality
and the remaining separately owned source ordinals. It cannot be applied twice.

### Southern Swinemünder landing and the explicit display-datum join

The road bridge's southern end meets a separately required, source-shaped
approach. Its first 48.244637 metres retain the bDOM pavement measurements:
19.02, 18.83, 18.64, 18.45, 18.24, 18.06 and 17.80 scene metres at the recorded
stations. All 21 lateral measurements and their original official responses
remain in `rail-bridge-approach-v307-source.json.gz`. The scene datum is NHN
minus 30 metres. DGM bare earth and bDOM pavement are distinct evidence layers.

The old neighbourhood used a flat three-metre display datum. After the measured
48 metres, a cubic Hermite **estimated display-datum fit** joins that legacy
surface at station 216.263380 metres. Its start derivative follows the last
measured pavement segment; its end derivative is zero. This interpolation is a
presentation reconciliation, not a claim about the real street gradient. The
bounded 64,874.784-square-metre context includes the mapped road, adjoining
side streets and sidewalks, laterally blended ground, and whole existing house
pads. It is not a new district or coverage extension.

All 39 existing house owners retain their complete source contours, courtyards,
vertex paint, roof and entrance extras, source material types, flat-shading
behaviour and navigation records. Their only body transform is rigid vertical
translation. Coincident source party-wall triangles shared by semantic owners
may be replayed for both complete owners; the original source ordinal is
retired once. The actual prepared V233 roof/entrance parts are replayed with
their house. V300, V262 and V263 have no recipe keys in the four affected tiles;
all eleven actual V249/V276/V264/V266 supplemental mode/part families have zero
triangle intersections with the final approach domain. Global and native tree
and lighting catalogues likewise have zero additional anchors in this domain.

The independent native representation uses cardinal terrain and pavement steps,
cardinal complete house contours and exact centimetre words after upward eighth-
metre quantization. Drawn and native modes receive the complete source family.
The pavement fill has actual upper and lower triangles; navigation reads the
privately admitted render buffers and a small face-ordinal index. It does not
keep a second decoded XYZ/index copy. Disposal, foreign attributes, altered
poses or missing members revoke the whole approach.

The frozen original contact, source plans and four-model underdeck remain under
their original v307 filenames and exact SHAs. Their explicitly named derivatives
are `railTerrainContactApproachV309.json`,
`railTerrainContactApproachV309Packets.json` and
`railBridgeUnderdeckApproachV309.json`. The new ground component **replaces** the
original ground component during compound source-plan composition. It is never
unioned with the original retirement list. The body-only
`railBridgeApproachV307Packets.json` remains a separate, disjoint component.
The full required bridge root includes the approach and all eight derived
underdeck models before any source geometry or old navigation yields.

Reproduce in this order after the immutable original v307 contact has been
restored and verified (9a111b6b contact, b6a2c13d plans, 9ea6b0b5 underdeck):

```sh
uv run python scripts/build_rail_bridge_approach_v307.py --profile-only
# Actual prepared source/material captures precede body reconstruction.
uv run python scripts/build_rail_bridge_approach_v307.py --ground-only
uv run python scripts/build_rail_bridge_approach_v307.py --bodies-only
uv run python scripts/build_rail_bridge_approach_v307.py --pavement-only
uv run python scripts/partition_rail_bridge_contact_v307.py --approach-derived geo_data/regierungsviertel/gesundbrunnen-bridge-contact-exclusions-v309-extension.json.gz /absolute/evidence/prepared
uv run python scripts/build_rail_bridge_approach_v307.py --navigation-only
uv run pytest -q tests/test_rail_bridge_approach_v307.py
cd src/app
bun test tests/rail-bridge-approach-v307.test.ts
```

The retained extension input adds the mapped Badstraße bridge's southern
24.12-metre, 28.83-metre-wide extension, while the main span remains 26.2 metres
wide. Its complete source partition is rebuilt from the unpartitioned derivative,
not applied as an overlapping delta. The derived ground owns 1,104 of the 1,163
original road/path ordinals; the bridge compiler owns the remaining 59.
`rail-terrain-contact-approach-v309-evidence.json.gz` and
`rail-bridge-contact-approach-v309-evidence.json.gz` record that lineage,
immutable predecessor hashes, outside complements, source paint and actual
underdeck ranges. Original v307 receipts are retained unchanged.

The unpublished approach's rejected first revision is retained with its
17-artifact handoff. Revision 2 changes only clipped-domain boundary evaluation
(tolerance 0.1 micrometre), new approach ground, pavement bottoms and their
actual face navigation, plus the paired underdeck derivative. The domain,
source retirements, full outside geometry and paint, house bodies, original
v307 controls, Core and architecture remain byte-identical. Drawn bottoms follow
the same 4-metre NW/SE planes as the support; native bottoms use the same
4-metre centre, eighth-metre and final centimetre words. Both overlap their
support by about 25 centimetres. The regression checks every actual bottom
triangle at its centre and three inset corners against the new contact,
underdeck and retained original outside: 5,548 Drawn and 45,112 native samples,
zero missing supports, least overlap 24.0/25.0 centimetres respectively.
`audit_rail_bridge_approach_contacts_v307.py` repeats this test directly from
rendered geometry and exact source plans, without substituting profile heights.

### Actual client source binding

`coreTerrainContactV307.json` and all three of its historical constructor
controls remain immutable. The original Drawn snapshot included coarse asphalt
and no tunnel course; the actual client retains the smooth road owner and
uses `scene.json.tiergartentunnel`. The explicit
`coreTerrainActualV310.json` derivative binds the finished actual client
instance guards and exact retirement ordinals to that original geometry.
It does not replace, round or repack an inner vertex, outside complement,
material, normal, index or navigation face ordinal.

The capture reads the initial factory's actual ground-option expressions from
`ThreeViewer.tsx` through the TypeScript AST, uses the manifest tunnel and
executes the required and final client aperture passes. The complete native
capture finishes the actual native generator and required-site sequence; the
first ground yield is not a settled source. The derivative compiler requires
all local source matrix and colour Float32 words to be identical, uniquely
matches every original retired row, rejects any unmatched local candidate and
retains the exact old source attributes, index, material and local transform.
Unrelated global raster differences are bound by the actual full-buffer guards.

Reproduction uses external capture paths and never overwrites the historical
snapshots:

```sh
bun run src/app/scripts/capture-core-main-actual-v310.ts /absolute/evidence/core-main-actual-v310.json
# Capture the finished native production path into core-native-actual-v310.json.
# Independently replay actual Worker production and all client storage stages:
bun run src/app/scripts/audit-core-worker-actual-v310.ts /absolute/evidence/core-predecessor/drawn-worker.json /absolute/evidence/core-worker-actual-v310-evidence.json
uv run python scripts/build_core_runtime_delta_v310.py --predecessor /absolute/evidence/core-predecessor --actual-main /absolute/evidence/core-main-actual-v310.json --actual-native /absolute/evidence/core-native-actual-v310.json
bun run src/app/scripts/finalize-core-actual-v310.ts
```

The separate actual-source controller composes the original bridge delta and
this guard/ordinal derivative before one reversible transaction. Historical
controllers continue checking the unchanged historical snapshots. A changed,
incomplete or foreign actual source remains closed; no source guard is relaxed.

The independent Worker audit executes the actual private production function
bodies extracted from `progressiveWorld.worker.ts`, including its bounded NDJSON
reader and Spreebogen terrain drape. All 18 retained mesh parts in 17 source
batches and the exact curb-ink source retain their full attribute/index bytes
and canonical materials through transfer and aperture cuts, Day, Night,
Schwellenraum, mobile interleaving, the real private ink rank, geometry parking
and upload callbacks. `core-worker-actual-v310-evidence.json.gz` retains those
complete comparison results and source-function hashes; no Worker pin changes.

### Finite JSC and V8 Worker source profiles

The Bun/JSC Worker audit above retains its exact historical profile. Running
that same actual Worker function bundle under Node/V8 reproduces the actual
Chrome Worker byte for byte. Only `surface-parks-1 / smooth parkland lawns`
differs: a nonretired block of 600 JSC triangles has 598 V8 triangles near
world X −103…−15, Z 220…323, outside the Humboldthain field. Its 28 JSC-only
and 26 V8-only triangles are retained in the separate evidence ledger.
The complete actual browser position/index streams independently match the
complete Node/V8 streams, including their SHA-256 hashes.

`coreWorkerV8V311.json` binds that exact finite source with its complete
attribute/index counts and fingerprints, immutable original/actual/bridge
anchors and a private separate controller. All 184,049 retired triangles have
identical ordered Float32 XYZ words and winding. Exactly 918 later retirement
ordinals shift by −2 after old ordinal 1,337,586; no retirement lies inside the
changed block. Every original inside mesh, outside complement, material and
navigation byte remains unchanged. Application metadata contains no duplicate
position or index buffer. The original JSC controller and all original controls
remain available; unknown source profiles remain closed.

Reproduce both engines in a fresh external directory, then generate and
finalize only the separate profile:

```sh
bun run src/app/scripts/capture-core-worker-engines-v311.ts /absolute/evidence/fresh-engine-capture
uv run python scripts/build_core_worker_v8_v311.py --captures /absolute/evidence/fresh-engine-capture --predecessor /absolute/evidence/core-predecessor/drawn-worker.json --browser-proof /absolute/evidence/actual-browser-node-v8-byte-proof.json
bun run src/app/scripts/finalize-core-worker-v8-v311.ts
uv run pytest -q tests/test_core_worker_v8_v311.py
```

`core-worker-v8-v311-evidence.json.gz` retains the independent actual-browser
proof, both engine identities, complete source stream hashes, the bounded
changed triangles and the full retired-word equality proof. The browser proof
requires both unique complete stream rows with exact byte counts, hashes and
an affirmative full-byte comparison. A note containing hash strings is not a
valid source receipt. `core-worker-v8-v311-controls.json.gz` records the separate
profile and composed V8 controls without altering their predecessors.
