# Complete legacy shell colour audit (Step 10, v273)

The four earlier measured street layers use a separate shell builder. It emits
flat sRGB wall `(211,208,197)` and roof `(160,159,151)`, converted to linear colour
bytes. Citywide passes restricted to the primary `city` kind cannot reach these
layers. The v271 Weinbergspark correction covered only 75 of their families.
This pass reviews **all 1,449 complete source parents**, without a geographic
sample or a new building/terrain layer:

| Retained kind | Full source parents |
| --- | ---: |
| `city-west-street-fronts-v163` | 360 |
| `mitte-street-fronts-v166` | 437 |
| `oranien-corridors-v167` | 321 |
| `scheunenviertel-v168` | 331 |

`tauentzien-street-fronts-v165` uses the same publisher but contains no measured
shell families: its ordinary contributions are facade-only core details.
Karl-Marx-Allee's v161 architectural palette is individually authored and is not
a flat generic shell. These are audited exclusions, not missing neighbourhoods.
The primary packets, remaining Alt-Mitte v169 and core prisms have independent
companion audits; this file does not claim their coverage.

## Source and material priority

The retained September 2026 OpenStreetMap candidate snapshot supplies public
building use and material tags. The compact committed context contains only
mapped footprints, public building type/name/institution flags and facade/roof
material observations at existing source owners. No private occupant information
is added. Its input SHA-256 and each complete measured family are recorded.

Positive ordinary uses include apartments, residential houses and unnamed
retail/commercial/office buildings. Churches, schools, museums, theatres, hotels,
other special building types, named buildings and institutional flags are kept.
The generic `building=yes` tag does not establish ordinary use and cannot qualify
a family; these older source sheets retain no official function to fill that gap.
A complete LoD2 parent can span several mapped houses: eligibility requires at
least 90% coverage of the complete ground union by substantive mapped overlaps,
all with ordinary use. A foreign footprint sliver below the documented area
threshold is not silently promoted to an owner. The full measured building,
including every courtyard hole and roof part, is always retained.

Exact known material selection is stricter: one footprint must match in both
directions by at least 97%. Explicit facade colours precede material swatches;
contradictory or unknown observations preserve the existing role. Weakly matched
material evidence on any constituent also blocks fallback paint for that role.
Glass bodies are protected. Every earlier v271 owner and exact later authored
identity stays unchanged.

Only otherwise unknown ordinary paint uses the established twelve restrained
mineral-plaster and six muted-roof tones. A stable full parent identity selects
one tone across all parts and packet boundaries. Where complete adjacent source
parents have welded wall vertices, their wholly ordinary unknown-paint component
uses one common stable wall tone; roofs keep their individual parent tones. **These are contextual display
estimates, not a claim to have surveyed each house's current paint.** Existing
OpenStreetMap (ODbL-1.0) and Berlin LoD2 (dl-de/zero-2-0) attribution continues.
No reference photograph, sampled pixel or texture is introduced.

## Lossless construction and native proof

Drawn selectors require the exact original generic colour and the complete
original source plane/polygon, including holes and the retained Weinberg terrain
lift where applicable. Shared facade corners retain one consistent tone. A separate complete-source
wall graph joins only parents with the same delivered centimetre vertex. A
component qualifies only if **every** member has positively ordinary unknown
walls and no protected, previously v271-treated or mapped wall colour. Otherwise
the whole shared component is vetoed. Each original triangle is still checked
against complete source planes: same-component overlapping faces may agree on
one tone, but a foreign, unsupported or protected incident triangle vetoes its
connected colour component. This is intentionally **blockwise wall variation**
where the old mesh cannot separate houses; it never adds/splits vertices.
Native selectors are compiled separately from the native source-envelope and
original wall/roof colour. All source families, including excluded neighbouring
buildings, remain in the ambiguity proof. A shared vertex changes only when all
incident triangles agree; unresolved shared faces remain unchanged.

Runtime checks the mode, tile, mesh ordinal, kind and fingerprint of all three
immutable encoded streams before any write. All ranges are validated before the
first colour changes. Hashing, validation and writing yield cooperatively. A
small eager key index skips unrelated packets before reading weak construction
receipts. No source/public packet, geometry, index, linework, navigation, window,
door, roof shape, draw call, GPU buffer or live residency limit is changed.
The existing full drawn mobile detail and independent orthogonal native geometry
remain intact. This is static construction work, with no per-frame callback.

Focused verification covers the complete four-source inventory, positive ordinary
semantics and multi-house parents, earlier paint protection, exact source and
public packet hashes, every actual colour selector, independent native ambiguity,
malformed receipt rejection, cancellation, unchanged encoded streams and all
unselected colour/position cells. Combined integration and browser comparisons
are recorded in the release-wide v273 notes.

## Final measured verification

The complete audit identifies **890** positively ordinary families; **744**
retain at least one eligible colour role after protection. Exact selectors
reach **738 drawn families / 34,764 existing colour vertices** and **581 native
families / 193,398 existing colour vertices**. The source-wall audit approves
**34 shared components containing 160 complete parents**. Unqualified use,
protected neighbours and ambiguous geometry remain unchanged. Runtime receipts
occupy **324,278 bytes** (**87,815 bytes gzip**), with no public packet rewrite.

The final focused suite on 26 October 2026 passes **9 Python tests** and **6 Bun
tests**. A separate production-retention test covers this layer and remaining
Alt-Mitte together: their actual Vite bundles keep packet maps lazy and weak,
retain small eager rejection indices, recreate identical receipts after
simulated collection and complete active writers across collection at every
yield. The Python source and tests also pass Ruff formatting and lint checks.
