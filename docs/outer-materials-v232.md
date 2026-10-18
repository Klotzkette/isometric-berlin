# Outer-house source materials — v1.0.132 / Step 10

The existing peripheral packets store ordinary building walls and roofs in two
generic colours. Their runtime palette does not read the mapped OSM material
tags. The v230 window pass deliberately excludes material-tagged houses, so
these retained material observations were still absent from their presentation.

This small correction uses **92 ordinary unnamed source owners** across thirteen
existing outer/northern tiles. It changes **1,174 drawn and 2,844 native colour
vertices**, with **6,517 bytes** of runtime receipts for 26 existing mode packets.
No building, window, roof shape, courtyard, source coordinate, index, navigation
record, asset packet, texture or draw call is added, removed or regenerated.

## Source selection and limits

The retained `raw/outer-v159/candidate.gpkg` OSM extract supplies full footprints
and only six colour/material tags. Its hash and the bounded selection are in
`outer-materials-v232-context.json.gz`; the extract is the existing Berlin source,
not a new download. Personal/address/occupant attributes are not copied.

Selection requires one unique OSM footprint with **at least 97% intersection
coverage in both directions** against the complete retained drawn source owner.
Only already covered `outer187`, `north190`, `east200` and `marzahn230` primary
packets are considered. Named sites, amenity/tourism buildings, earlier authored
owner IDs, and every previous district/kiez/v230 facade owner are excluded.
No new district scope is created. The final accepted tiles happen to lie in the
outer187 and north190 families.

Single explicit colour tags take priority. Conflicting facade/building tags or
unresolved compound colour values are left unchanged. Untagged material hues
reuse the established restrained brick/plaster/roof-material swatches; these
swatches remain display estimates, not measured paint observations. The original
v211 height-relative wall wash is retained, including its ambiguity rule.
Native geometry receives independent flat block colours. No new window positions,
floor count, pitched roof or individual architectural detail is inferred.

## Exact preservation and runtime cost

The offline compiler proves each selected triangle belongs to a retained wall
edge or roof cap at its actual source height. It accepts only the two original
generic colour values. All incident triangles must agree before a shared vertex
can change; ambiguous shared geometry stays untouched.

The tiny runtime receipt binds each mesh's original encoded positions, colours
and indices through the established FNV guard. Changed source bytes fail closed.
The bounded v213 colour writer validates all runs before writing and yields while
hashing/decoding. It updates existing interleaved colour cells after the earlier
appearance passes. No decoded geometry, ownership map or construction payload is
retained by the new helper. GPU buffer bytes, source navigation, serial delivery,
parking/recovery and live residency budgets stay unchanged. Drawn detail is equal
on mobile and desktop; native positions remain independently orthogonal.

The source/evidence archives are offline audit inputs and are not viewer assets.
They retain original source roles and exact packet SHA-256 hashes. Attribution
continues to use OpenStreetMap contributors (ODbL 1.0) and Geoportal Berlin LoD2
(dl-de/zero-2-0). No external photograph, new licence or imagery is used.

## Validation

- Four focused Python tests pass: actual mesh receipt replay, reciprocal source
  coverage and source hashes, ambiguous-tag rejection, and rejection of changed
  heights/overlapping owners.
- Five focused Bun tests pass, including the existing v230 decoder checks:
  every one of the 26 actual mode receipts preserves positions, unselected
  colours, allocated bytes and source payloads; changed streams/kinds/packets
  reject the update; repeated application is stable. The actual integrated
  decoder retains every source position, index count and navigation record in
  both modes and reports the applied material vertices.
- Scoped Ruff formatting and lint pass. The parent release task handles the
  complete suite, production build and browser verification.

Review cameras (`eye` / `target`, world coordinates):

- Mapped brick: `[4537.85,45,-3839.42]` / `[4597.85,9,-3899.42]`.
- Mapped plaster: `[5151.57,45,-3683]` / `[5211.57,9,-3743]`.
- Mapped red roof: `[5670.36,45,-2711.54]` / `[5730.36,9,-2771.54]`.
