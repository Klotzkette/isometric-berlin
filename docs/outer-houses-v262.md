# Step 10 — ordinary outer-house palette and bounded facades, v262

The bright outer-house colour alternation came from the shared v217 fallback
palette, which assigned cyan, pink and green plaster to source IDs without a
material observation. The v230 outer pass changed only the cap colour, and
excluded the older v159, ring182 and city183 primary families. Real mapped
materials already had separate, exact v232/v254 receipts.

The v262 presentation therefore adds a dedicated outer fallback while retaining
the original core-city palette. Eight distinct warm limestone, ivory, buff,
muted clay, grey-green and cool stone display tones replace the brighter
unknown-material assignment. Eight separately selected darker neutral/earth
roof tones make the existing wall/roof division legible without colouring the
cap from its wall. These are **illustrative unknown-material swatches**, not
claims that a particular house has plaster, stone, brick tiles or slate.
Mapped brick, plaster and explicit facade/roof colours continue to come from
the original source receipts. No roof shape is inferred by this palette pass.

## Exact scope and preservation

Only complete primary packet identities qualify: numeric v159 IDs and numeric
`ring182`, `city183`, `outer187`, `north190`, `east200`, `marzahn230` IDs.
The retained manifest contains 1,635 such descriptor identities: respectively
296, 150, 67, 822, 84, 199 and 17. This is an eligibility inventory, not a count
of repainted houses. Empty packets and vertices without a unique source owner
remain unchanged. In particular the 86 suffixed outer187 Grunewald terrain
companions are outside this new selector.

The decoder still requires mesh kind `city`, one unique source owner at the
centimetre corner, and exactly the two original generic wall/roof colour values.
Authored companion families, core `alt-mitte-v169`, existing source-coloured
vertices, uncertain shared corners and all window/detail packets are excluded.
The new selector does not alter the geographic decisions controlling geometry.
Old v230 roof-only helper behavior remains intact when the new flag is absent.

The source ID selects both wall and roof independently of packet origin or
iteration order. Split owners with conflicting heights keep the established
flat-wall rule, preventing interpolated wedges. The existing terrain-relative
drawn grounding wash remains; native blocks keep flat material colours. Every
v232/v254 exact source receipt is applied afterward, so explicit mapped colours
and mapped material estimates retain precedence over the new fallback.

No packet, source vertex, index, navigation record, window, sill, cornice,
entrance, measured roof, courtyard or authored model is removed or rewritten.
The palette pass changes only existing destination colour cells. It adds no geometry,
texture, GPU buffer, draw call, descriptor, downloaded source or animation.
The implementation retains 16 tiny RGB tuples and 64 shared wall/roof pairs;
owner lookup remains temporary within the existing bounded cooperative decode.
All live residency, transfer, prefetch and decode limits remain unchanged.
Drawn mobile detail is identical to desktop; native geometry stays independent.

No new external architecture or material claim is made. The existing OSM and
Geoportal Berlin attributions continue to apply. Relevant retained evidence is
documented in [v232 materials](outer-materials-v232.md),
[v254 materials](outer-materials-v254.md) and [v230 facades](refinements-v230.md).

## Verification

`bun test --isolate --max-concurrency 1` on the five focused files
`outer-houses-v262`, `surrounding-city-colour-v184`, `outer-houses-v230`,
`outer-materials-v232`, and `outer-materials-v254` passes **21 checks**.
They cover every existing v232/v254 receipt and preserve geometry/navigation,
source bytes, non-generic colours, source-owner ambiguity, actual independent
native packets, unchanged core swatches and current window/detail topology.
The new integrated check verifies exact final source-receipt colours after
the fallback, rather than checking only a helper's return value.

Actual primary samples: `-1_-7`, `ring182--11_-3`, `city183--9_7`,
`outer187-27_7`, `north190-5_-8`, `east200-6_-17`, `marzahn230-24_-5`, each in
drawn and native mode. Adjacent `outer187-27_6` / `outer187-27_7` verify that
real clipped source owners keep matching roof/flat wall paint across origins.
A separate conflicting-height fixture verifies both source iteration orders.

Suggested internal-browser review cameras (`eye` / `target`, world coordinates):

- Ordinary outer houses near the tested adjacent packets:
  `[14010,120,3610]` / `[14100,10,3500]`.
- Mixed northern ordinary context with the preserved mapped plaster example:
  `[5151.57,65,-3683]` / `[5211.57,9,-3743]`.
- Preserved explicit yellow plaster and rose roof, OSM way `117976076`:
  `[585.91,60,5323]` / `[650.91,9,5258]`.
- Preserved explicit yellow plaster and dark green roof, OSM way `218798628`:
  `[4141.56,60,4656.53]` / `[4206.56,9,4591.53]`.

The parent subsequently reviewed the palette in the internal browser and found
that the sampled outer187-27_6 houses still read as bare blocks. That observation
motivated the bounded facade addition below. This presentation subtask ran no
build, broad test suite, external browser or original public-packet rewrite.

## Bounded facade continuation

The existing v230 source-wall and named-street alignment checks are reused for
**24 sampled primary tiles**, read only with the neighbour occupancy needed
within 32 m of each tile. Fifteen samples contain qualifying previously unfitted
ordinary houses. The result adds **78 street fronts, 409 drawn windows and 308
independently orthogonal native windows**. The other nine samples remain as
delivered; no further citywide packet scan or generation is attempted.

The full old v188/v209/v230 facade owners, mapped v233 door owners, measured
v233 roof owners, current authored source identities and protected named,
non-residential or material-tagged OSM polygons are excluded. The four new
v262 measured-roof tiles are additionally excluded wholesale. OSM-only houses
require a positively ordinary residential building type in their retained
height-source record; absence of a specific-use tag alone is insufficient.

Every selected wall requires both complete original generic wall triangles at
its actual source height, a mapped named street facing its outward normal and
unobstructed approaches through the retained neighbouring building polygons.
Clipped navigation seams are not accepted as walls. The additional 1.60 m-wide
drawn sill/frame footprint is separately checked for nearby occlusion. Native
spans must independently exist in the native source, be orthogonal, face outward
and stay within the 1.6 m corridor around their drawn source front.

Window count, spacing, glazing, frame/reveal depths, central mullions and sills
are explicit display estimates, using the established v230 grid. They are not
surveyed openings. Drawn windows have five shallow quads: pale frame, dark
reveal, graded glazing, one central mullion and sill. Native windows use three
independent orthogonal quads: frame, flat glass and sill. No real entrance,
sign, shop, balcony, pitched roof or architectural style is inferred; window
rows do not assert a surveyed floor count.

`outerFacadesV262.json` stores **45,531 bytes** of compact window recipes.
`outer-facades-v262-evidence.json.gz` stores the exact fronts, streets, native
spans, source hashes and preservation receipts in **17,011 bytes**. The 190
distinct input packet hashes cover the bounded samples, their needed occupancy
neighbours and the accepted native counterparts. Original packets and manifest
descriptors remain byte-for-byte untouched by this compiler.

`prepareOuterFacadesV262` appends one small `outer-facades-v262` mesh part to
the same house transaction. The guard validates the original origin, complete
navigation fingerprint and encoded positions/colours/indices of every city mesh
before generating any fittings. Changed sources and invalid, repeated or
incomplete bindings fail closed. A repeated preparation returns the same packet.
Every earlier mesh and navigation object is retained by identity.

Hard per-tile ceilings are eight source owners, 96 drawn windows and 64 native
windows: at most **1,920 drawn / 768 native additional vertices**. Actual maxima
are 89 / 64 windows, or 1,780 / 768 vertices. The whole finite addition contains
8,180 drawn and 3,696 native stored vertices. Preparation rejects a transaction
that would exceed 16 mesh parts, 400,000 vertices or 2,400,000 indices. Fittings
join the existing interleaved destination buffers, with no extra draw call,
resident root, descriptor, texture, animation or live-budget allowance. Geometry
generation yields every 16 windows; original-source hashing yields every 64 KiB.
Drawn mobile detail is identical to desktop, and ordinary existing packet
disposal/parking/cancellation owns all generated data.

The additional three focused Bun checks pass for every generated mode recipe:
source-part identity, source immutability, exact index counts, native orthogonality,
bounded transaction size, bad-source refusal, repeat stability and actual
`outer187-27_6` integration/disposal. Three focused Python checks verify the
24-tile sample limit, preserved input hashes, exact original street walls,
independent native spans, previous-owner exclusion and spatial distribution.
Scoped Ruff formatting/lint pass. The palette/v230 regression checks also pass.

Close front review cameras (`eye` / `target`):

- Heerstraße, ordinary OSM way `285872068`, `outer187-27_6`:
  `[13995.9,23,3464.74]` / `[13973.49,7,3500.26]`.
- Heegermühler Weg, `east200-0_-15`:
  `[411.33,25.79,-7308.47]` / `[429.65,8.39,-7270.68]`.
- Gustav-Adolf-Straße, `north190-9_-9`:
  `[5094.95,25,-4222.61]` / `[5071.02,8,-4257.13]`.
- Wünschelburger Gang, `east200-24_17`:
  `[12354.55,23.28,8746.55]` / `[12368.55,7.14,8786.15]`.

These are source-derived review inputs. The parent integration task records the
later internal-browser facade review separately.
