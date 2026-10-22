# Step 10 — resolved ordinary-house colour gaps, v263

A bounded audit found why adjacent houses remain partly raw grey after v262:
the earlier colour selector deliberately rejects a footprint corner when different
source IDs share its XZ coordinates, even for separate vertices at different
heights. In drawn day mode these houses use an unlit material without a tone
curve; fog or lighting is not the cause. The v262 fallback palette is retained.

## Exact finite ownership

The compiler examines exactly nine original tiles, independently in drawn and
native form: `outer187-27_6`, `outer187--22_-5`, `east200-4_-15`,
`east200-23_17`, `north190-9_-9`, `ring182--9_8`, `city183--9_10`,
`-8_-3` and `outer187--11_18`. No further citywide scan or geometry generation.
Only raw-generic wall/roof vertices previously rejected by the corner selector
qualify. A wall needs both original triangles of its full rectangle, exactly on
a retained source ring edge and its complete base/top interval. A top triangle
must lie completely in the source polygon, respecting holes, at its stated top.
Every original incident triangle must independently resolve to the same single
source ID. Truly shared deduplicated vertices remain unchanged. An incomplete,
ambiguous or duplicate wall fails closed. No vertex splitting or index changes.

This resolves **6,924 drawn vertices belonging to 913 source IDs** and
**11,504 native vertices belonging to 760 source IDs**. These are corrected
corners, not newly reconstructed buildings or surveyed paint colours. The
highest impact is in the sampled Spandau, Niederschönhausen and Adlershof packets.
The eight v262 wall/roof swatches still provide illustrative fallback paint.
Drawn walls retain their existing grounding wash; conflicting-height parts of
one owner disable that wash as in v184. Native wall paint remains flat.

The parent integrates this adapter before **all explicit appearance writers**,
including v213, v231, v232 and v254. Mapped materials and authored treatments
therefore keep priority. Non-generic colours, authored mesh kinds, ground,
roads and lines are unchanged. Complete source hashes, origin and navigation
guard each receipt. Changed bindings fail closed before any destination write.

## Preservation, size and checks

All eighteen public packets remain byte-identical. Only existing destination
colour cells change. There are no added vertices, indices, textures, draws,
resident roots or descriptors. Existing roofs, doors, windows, road geometry,
exact owner transfers, full mobile detail, native interpretation, all live limits
and the 93-stop tour remain intact.

`greyClusterColoursV263.json` is **460,820 bytes** before build packing; its
immutable `packets` field becomes **83,684 gzip/base64 characters**, plus module
framing. The exact field is added to the existing constructor-source whitelist.
An 18-key eager index rejects unrelated tiles before reading this weak field;
missing and non-city meshes also return without a receipt read. This avoids
reconstructing the receipt graph for unrelated chunks after collection.
The decode generator holds its current receipt through every yield; render roots
retain only finished numeric buffers. After source collection, the next read
reconstructs identical values. The separate release-storage changes are recorded
in `lossless-retained-sources-v263.md`.

Compressed evidence records source hashes, incident triangle indices and their
unanimous identities. Sources are retained OpenStreetMap and Berlin LoD2, with
no additional photographs or external sources. Three Python checks cover
shared/equal-height corners, incomplete walls and all eighteen real receipts.
Two runtime checks cover exact destination cells, original immutability,
material priority and changed-source refusal. A production-bundle check covers
byte-exact reconstruction, collection during a yielded decode, strong fallback
without WeakRef, explicit setters and frozen-object contracts.
