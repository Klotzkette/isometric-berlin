# Littenstraße, Stadthaus and Alte Münze — Step 10 / v297

The bounded companion retains all original source buildings, roofs, courts,
earlier courthouse fittings and navigation. It refines the three distinct
Waisenstraße houses at Zur letzten Instanz, the Altes Stadthaus exterior,
Neues Stadthaus, Palais Podewil, Verwaltungsgebäude C at Klosterstraße 59,
the existing Alte Münze street front and its industrial court buildings, and
the retained Direktorenhaus. No planned Molkenmarkt construction is shown.
The unclear dictated word “Lederla” does not create another inferred site.

## Source and architectural identity

`litten-stadthaus-v297-source.json.gz` retains the complete fifteen original
LoD2 parent records from the two unchanged v169 source tiles. All source-file
hashes, 227 exterior source-plane descriptors, the complete earlier Stadthaus
record including five courts, and exact native support polygons are retained.
Two joined mint owners have no eligible exposed wall; their complete records
and geometry remain, without invented extra fronts. Thirteen parents receive
actual new fittings. The earlier 80 m Stadthaus tower and both closed drums,
western mansard, roof hierarchy and Fortuna remain unchanged.

The operator's Instanz exterior establishes the ochre shutters, fine upper
window profiles, downpipes, vertically stacked north-return name and scales
symbol. Its photographs are currently published references, not a 2026 metric
facade survey. The three separate houses and all v257 recognition remain.
The native name fits the retained lower native return face 2.4 m lower than
the independent drawn layout; this is a labelled display fit, not a source
coordinate change.

Stadthaus additions follow the actual retained exterior window centres and
source-edge courses. They add masonry joints, east-front sills/lintels, double
piers, baluster reliefs and thin railings on the existing tower platforms.
All earlier west-front surrounds and 1,116 windows remain. The principal
Podewil front is **original surface 33**, the short western baroque block;
surface 38 belongs to its longer adjoining wing. These are kept distinct.
Verwaltungsgebäude C gains finer existing-window transoms and small south-side
shade housings, guided by its architect's completed 2013–23 window restoration.
Münze additions retain the earlier Schadow-frieze interpretation and add small
original craft-gesture/tool incisions, pier joints, Palais balcony relief, court
window bars and source-edge industrial courses; no artwork photograph is traced.

All new local dimensions, bay/room subdivisions, relief poses, rail sections,
colour choices and native fitting offsets are **display estimates**. Measured
source geometry remains authoritative. Existing routes and building collision
are unchanged; the decorative portal readings do not claim walk-through doors.

## The one exact old-estimate correction

The Podewil main front previously carried a generic five-level v169 window
estimate. The primary visual reference supports seven axes on three storeys.
Only this face receives a complete, default-off packet transfer:

| Packet key | Exactly transferred previous geometry | Complete replacement |
|---|---|---|
| `drawn:5_0` | 200 original generic fitting triangles | 21 windows, reveals, frames, piers, balcony and portal reading |
| `minecraft:alt-mitte-v169-5_0-piece-0` | 18 original dark native front faces | Same 18 occupied surface triangles in the original adjacent wall tone, plus an independent 21-window cardinal facade |

The measured drawn wall, every roof, all courts and every unrelated triangle
remain unchanged. Native occupancy stays complete: the eighteen exact dark
faces are republished at identical coordinates in their original wall tone;
this corrects obsolete window paint rather than removing the native body.
There is **no second opaque curtain wall**. The source recipe, original packet
bytes, old fitting roles and exact original surface are retained as evidence.

`prepareLittenStadthausV297(chunk, id, native, ownersReady=false)` verifies the
exact packet origin and source-mesh fingerprints, complete replacement bytes,
owner/surface identity and all receipt indices. It appends the entire new mesh
before `applyLittenStadthausTrianglesV297` may degenerate those exact old fitting
indices in decoder-owned arrays. Changed, foreign, incomplete and default-off
inputs remain untouched. The private WeakMap admission cannot be forged by a
copied public property. Navigation does not transfer. The existing controller
may re-decode only a matching candidate when its required owner becomes ready.

## Rendering and resources

`createLittenStadthausV297(native=false, {mobileLike?})` supplies one complete
static, texture-free instance batch. Drawn touch and pointer buffers are identical.
The native model uses its own cardinal fittings on **complete coplanar source
polygons**, including concavities and holes; it does not mistake a merged wall
for only those triangles that happen to form rectangular pairs.

| Additive companion | Instances | Matrix + colour bytes | Draw calls |
|---|---:|---:|---:|
| Drawn | 6,833 | 519,308 | 1 |
| Native | 11,912 | 905,312 | 1 |

Native fitting compaction unions only exactly touching/overlapping intervals
with identical cross sections, colour, source and role. Integer endpoint proofs
preserve the entire occupied volume; no raster coarsening or gap filling occurs.
The guarded Podewil meshes join their existing decoded packet draw call, rather
than creating another scene root. Existing residency, decode, prefetch, tour,
coverage, construction and package limits are not raised.

`hasCompleteLittenStadthausV297` validates private factory provenance and actual
batch, material and buffer identities. The complete flag is set only after all
geometry exists. A construction error disposes the unpublished geometry and both
day/night materials before propagating; roots retain no constructor source arrays.
The `faces`, `nativeRows`, and separate packet `packets` fields are read-only,
synchronous constructor inputs eligible for the established weak source encoding.

## References and checks

Primary sources, individual image URLs and credits are in
[`litten-stadthaus-v297-references.json`](litten-stadthaus-v297-references.json).
All images remain external inspection references; no pixels or textures ship.
The operator, LDA and dhl Architekten pages were checked on 2 November 2026.

Four Python checks prove complete original records, every native support fit,
exact native union compaction, all 21 native window groups and the single-face
transfer. Six Bun checks cover source hashes, actual recognition, exact-size
buffers and full touch parity, cardinal matrices, the seven-by-three front,
default/foreign/changed-source rejection, exact outside-index preservation, private factory provenance and failure cleanup.
Root performs final integrated build, viewer and release verification.

Suggested review poses in the unchanged world coordinates:

| View | Eye | Target |
|---|---|---|
| Instanz return and three fronts | `[2838,14,207]` | `[2867,9,230]` |
| Stadthaus east face | `[2830,49,356]` | `[2757,17,321]` |
| Stadthaus tower | `[2630,88,383]` | `[2676,60,317.5]` |
| Podewil main front | `[2769,24,278]` | `[2799,14,240]` |
| Münze street and Palais | `[2405,39,331]` | `[2492,13,389]` |
| Münze court tracts | `[2609,42,433]` | `[2547,12,426]` |
