# Remaining Alt-Mitte residential colours — Step 10 v273

This is the measured `alt-mitte-v169` part of the owner's citywide grey-house
review. It complements the independent core, primary-city and earlier-shell
reviews. It does not claim that this one source layer covers all Berlin districts.

## Complete audit and selection

The compiler audits all **8,374** official source families actually rendered by
this layer (`core` and `outer` categories), rather than choosing a few example
tiles. All original parent/part identities and complete footprints stay intact.
Every audited owner has an evidence row explaining qualification or protection.

Positive residential use is required: either the v213-proved reciprocal mapped
residential identity, or the retained official residential function
`31001_1000` / `31001_1010`. Named sites, explicit other uses and insufficient use
evidence remain unchanged. An attached classified canopy cannot qualify a family
on its own. The residential codes follow the already reviewed
[AdV building-model specification](https://sgx.geodatenzentrum.de/public/gdz/dokumentation/deu/LoD2_Pruefplan_fuer_Gebaeudemodelle.pdf).

The audit qualifies **2,183** residential families. After protection, **1,651**
families are candidates for new colour receipts. All **1,078** complete families
selected by v271 remain unchanged. The inherited v213 protection and exact
identities/short prism aliases from the later v214–v272 authored products protect
another set of **158** families (the counts can overlap). Source IDs in a facade
or site model are conservatively protected; the audit never infers architecture
from a generic grey appearance.

Any retained `building:colour`, `building:material`, `facade:colour` or
`facade:material` blocks fallback wall paint, including compound or unrecognised
values. Roof observations independently protect the roof. Unknown paint uses the
same twelve light mineral-plaster and six muted roof swatches as v271, selected
reproducibly by complete source identity. These are **contextual display
estimates**, not surveyed current paint colours. No photographs or textures are
imported; source roof shape, windows and building uses are not invented.

## Exact construction and protection

Drawn receipts require the original encoded colour, complete measured source
plane/polygon including court holes, and the existing centimetre tolerance.
Every incident triangle must agree; rejection propagates through connected faces.
Native receipts independently prove original material and complete part envelope
with the existing voxel tolerance. **Every one of the 8,374 source families**
remains a potential native ambiguity blocker, including protected, known-material,
non-residential and previously coloured neighbours. Wall/roof roles have separate
eligibility. The one actually rendered OSM-only residual shell is also retained
as a blocked source owner; its tiny footprint cannot receive guessed paint.
There is no geographic edge beyond which blockers disappear.

The output changes only selected existing destination colour cells after v213
and v271, before later explicit material writers. All original public/resident
packet bytes, coordinates, indices, linework, windows, source sheets, courtyards,
roads and navigation stay unchanged. The complete examined-packet inventory and
all exact input hashes are retained in the compressed evidence. v271 ranges are
independently checked to be disjoint from every new range.

An eager packet-key index rejects unrelated packets and mesh kinds before
accessing construction receipts. The established cooperative writer checks all
source fingerprints and every range before any write, yields during work and
keeps its current receipt alive across yields. No new geometry, GPU buffer,
texture, draw call, descriptor or per-frame work is introduced. Full mobile
detail, separate native geometry, 93 tour stops and every existing residency,
decode and prefetch limit remain unchanged.

## Verification

Focused checks verify the complete source audit, mapped-use qualification,
independent material-role protection, full native neighbour inventory, source and
packet hashes, v271-disjoint exact ranges, actual drawn/native destination bytes,
unchanged source/geometry data, idempotence, wrong-source rejection, early lazy
rejection, invalid-final-range atomicity and cancellation before colour writes.
The final receipts select **121,087 drawn colour vertices** across **1,627**
source families and **228,894 native colour vertices** across **1,307** source
families. The runtime receipt is **677,814 bytes** (**193,529 bytes gzip**).
No public source packet is rewritten.

On 26 October 2026, the focused suite passed **5 Python tests** and **4 Bun
tests**. The companion production-retention test also passed: the actual Vite
bundle leaves packet maps undecoded at startup, keeps the eager rejection index
small, reconstitutes the exact map after simulated collection and completes an
active writer even when collection is simulated between every yielded step.
This tests the compiled weak-retention path rather than only uncompressed JSON
imports. Release-wide visual comparisons and packaging remain separate checks.
