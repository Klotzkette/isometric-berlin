# Alt-Mitte facade edge relief — v1.0.86

Step 10 adds a small amount of depth to the otherwise generic measured buildings
throughout the frozen pre-2001 Mitte selection. It leaves the complete earlier
source inventory, packets, building shells, courtyards, windows, authored
landmarks, street surfaces and terrain unchanged. This is a graphic refinement,
not a new survey of historic window or cornice designs.

## Scope and sources

The unchanged [v169 source catalogue](alt-mitte-v169-sources.md) provides every
complete measured family, part, wall ring and hole. The conservative historical
boundary retains the documented unbuilt 310 m² 2008 addition at Schillingbrücke;
it does not add Wedding or Tiergarten. Berlin LoD2 and the official boundary are
licensed **dl-de/zero-2-0**. The bounded 3,314-road receipt comes from the retained
29 September 2026 Geofabrik Berlin extract, **© OpenStreetMap contributors,
ODbL-1.0**, whose original URL and SHA-256 are recorded. Those road courses are
selection evidence only; this addition does not create or redraw roads.

All 15,914 catalogue records are scanned. The **8,374 original v169 measured
core/outer official families** form the candidate set before the later-owner
exclusions below. Retained authored/glass
families, unresolved overlap families and OSM residuals keep their existing
appearance. Exact later v174–v185 named/modified parents are also protected,
including transferred v183 station/department-store owners and recent school,
Ackerhalle, Scheunenviertel and northern-neighbourhood accents.

## Conservative selection and limits

At most one existing street-facing wall is selected per eligible source family.
It must be vertical, at least 8 m wide/high and start at that part's source
ground datum. It must face a named mapped street within 26 m, with an unobstructed
line to that street and five clear outward frontage approaches. This rejects
party walls, internal courts, rear wings and most small sheds. Full wall
polygons, including holes and upper profiles, constrain every member.

The two additions are a 14 cm high, 25 cm deep upper edge and a 25 cm high,
16 cm deep base edge. A lower roof/gable envelope controls the upper height;
every full section rectangle must lie inside the original measured wall. No
doorway, window opening, tenant, name, full wall rectangle or roof is invented.
Profile sections and muted stone-like colours are explicitly **non-surveyed
display estimates**. The existing generic window rhythm remains a documented
estimate too; this pass cannot certify that every window matches reality.

Exactly **1,780 street walls** receive **3,560 shallow profiles**: 912 core and
868 outer families. Another 6,551 measured families have no eligible street wall;
24 are protected later authored/accents owners and 19 have mapped glass material.
No eligible family is silently dropped to satisfy a budget. Of the selected
parents, 299 retain a nonzero v176 Weinberg terrain offset. Original source
vertical datum plus that exact parent offset is used in both representations.

## Runtime and verification

The one compact 226,853-byte profile payload serves both representations. Drawn
modes allocate **3,560 instances / 270,560 instance-buffer bytes**, in **54
independently culled 512 m cells**. Minecraft creates its own **28,032 orthogonal
surface contour steps / 2,130,432 instance-buffer bytes**, only when that factory
runs. The normal/tangent projections define the native steps; no smooth members
are allocated as a second representation. There is no duplicate 1.4 MB native
JSON. Exact final-count buffers, frozen transforms, no UVs, no photographic
textures, no hidden solid fill and identical pointer/touch detail keep the
addition bounded. Both modes use the established day/night material lifecycle.

`createAltMitteEdgesV186()` and `createMinecraftAltMitteEdgesV186()` are separate
factories over the shared compact metadata. The shared landmark loader may put
both factories in the same code chunk; separate files are not claimed to be a
network-lazy split.

Focused Python tests validate every selected source wall and unchanged input
digest, unique parent, full polygon containment, actual source datum/terrain
offset, protected owners and bounded counts. Synthetic gable and wall-hole
cases reject rectangular trim in those voids. Bun tests validate culling,
frozen transforms, exact buffers, native orthogonality, signed outward normals
and bounded cell spheres. Shared build and browser QA belong to the release
integrator.

```sh
uv run python scripts/build_alt_mitte_edges_v186.py
uv run pytest tests/test_alt_mitte_edges_v186.py -q
bun test src/app/tests/alt-mitte-edges-v186.test.ts
```

Regeneration uses committed frozen source chunks and the committed bounded
street receipt. Re-extraction of that receipt requires the retained raw OSM
candidate cache. No existing city packet is rewritten by this generator.
