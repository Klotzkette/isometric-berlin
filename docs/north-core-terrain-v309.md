# Complete retained Core terrain transfer

The Humboldthain refinement intersects the retained Main-thread Core ground,
not just the surrounding packets. `NorthCoreTerrainV309.ts` therefore stages
an exact, reversible transfer of the actual Core source. It adds no new source
coverage and changes no unrelated ground, paint, material or navigation.

The settled Drawn predecessor consists of the **203,849-instance Main ground
raster plus 18 separate transferred Worker surface batches**. The Worker clears
its raster rows before constructing its building batch; a second Worker raster
is not a valid predecessor. Source receipts include all actual initial and
post-transfer client aperture cuts, exact compaction, stock primitive attributes,
original index order, Float32 instance colour words and original materials.
Worker parts also require their exact `progressiveWorldBatchId` ancestor.
The native predecessor has 185,262 retained ground instances after its actual
client apertures. The transfer owns 3,078 Drawn or 784 native rows respectively,
plus the documented intersecting Drawn surface triangles.

The production controller independently validates the three original variant
receipts. FNV-1a controls over `JSON.stringify(variant)` are:

| Variant | Control |
| --- | ---: |
| `drawn-initial` | 691981172 |
| `drawn-worker` | 2745148416 |
| `minecraft` | 398998653 |

Both Drawn receipts must match as one connected source ensemble. Partial
arrival, a different batch ancestor, a duplicated matching source, altered
source bytes, an unsupported material or wrong visual family closes admission.
The separate controller factory accepts explicit controls solely for isolated
source tests; those receipts cannot admit the production controller.

`prepareNorthCoreTerrainV309Steps(world, native, preparedModelGate, recipes)`
returns a cooperative generator whose result is a private transaction or
`null`. Preparation owns cloned geometry and matrices, complete source hashes,
outside complements, material copies and bounds. It does not change a visible
source reference, matrix word, index, visibility or scene child. Cancellation
disposes staged resources and removes source listeners.

The publisher first attaches every complete required replacement model. In
the same synchronous publication it calls `transaction.commit(liveGate)`.
The commit rechecks exact source attribute/storage identities and versions,
counts, transforms, original material bindings, resource lifetimes and the live
replacement gate before changing references. Expensive source scans, hashes
and bounds are completed during cooperative preparation. A failed commit or
`rollback()` restores the identical original geometry and instance-buffer
references and removes every owned outside complement. Repeated synchronization
does not compound the transfer or accumulate copied Toon bindings.

Retired instances receive private degenerate matrix rows; unretired rows keep
every original word. Retired indexed triangles become private degenerates,
without modifying their source buffers. Outside fragments retain the complete
original surface, including sides and bottoms, exact Float32 paint and normals.
Smooth Basic-material surfaces use neutral vertex paint with their original
material colours. Instance paint becomes exact vertex paint under the original
white material. No Float32 colour is rounded through an integer channel.

Legal mobile interleaving changes storage layout only. The source audit reads
the original logical component bytes without normalized getters or Float32
conversion. Attribute receipts bind the real storage owner, stride, offset,
version and parking metadata. Owned source clones are created before yielding,
so an uploaded parked source may retire its borrowed array at the end of the
current JavaScript job without corrupting preparation. Day, night and genuine
Schwellenraum materials remain supported. Native Toon presentation uses only
the private material-mode provenance and target-copy APIs, with explicit cleanup
on rollback; public tags or fabricated materials cannot admit a source.

The required contact model contains the corresponding new measured interior
surfaces. Core floor navigation binds to those actual rendered Float32 vertices
and indexed faces, including deliberate building-footprint holes. It activates
only through the same complete northern publication gate. The construction
recipes' lossless wordplane transport changes neither original variant receipt
nor decoded source words.

Regression coverage includes isolated transaction/lifetime tests, two
actual production Core tests and a full northern-bundle publication test for
each family. The real fixtures invoke the unchanged initial/native source
constructors, actual Worker family splitting, compaction, transfer round trip,
client aperture cuts, mobile interleaving, genuine Grade/Toon presentation and
GPU parking. The bundle test also includes the real retained hospital and v190
station constructors; it proves unchanged source bytes while staging, complete
private model admission, live collision/floor queries and byte-exact rollback.
Every cooperative bundle checkpoint also checks unchanged original geometry
and instance-buffer references, visibility and scene-child ordering. The five
private required models include both measured bridge decks and their lower
rail floors. Native revocation of that fifth model restores the complete old
Core, hospital and station ensemble. All cases retain the unchanged 60-second
limit. GPU-retirement and additive bridge-composition regressions are separate
from the unchanged original Core source controls.
