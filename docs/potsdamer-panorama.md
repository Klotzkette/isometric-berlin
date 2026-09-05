# Potsdamer panorama reference refinement

Step 10, v0.72.43. Three owner-supplied panorama photographs received on
2026-09-05, taken from the Kollhoff observation deck, are visual evidence only.
No photograph, crop, projected image, image texture or extra network request
is added to the viewer or offline package.

## Evidence and precedence

`potsdamerPanoramaPalette.ts` records 20 complete Berlin LoD2 parent groups
and all 276 delivered child prism identities. The source GeoPackage and
compact prism payload remain unchanged. Parent membership was checked against
the committed inventory; tests verify every child and its bounded location.

The photographs support the following material sequence:

- Golden Staatsbibliothek with a pale roof landscape.
- Terracotta west-side blocks, grey upper storeys and muted planted roofs.
- Cool steel/glass buildings and two subdivided blue-grey atrium roof lights.
- Red-brown eastern courtyard blocks, followed by pale southern housing.
- Muted olive-green open lawns and varied, quieter green tree rows.

Conflict resolution is explicit: the local owner-photo colour reading takes
precedence over the general ivory facade wash and sampled tones for these
276 parts only. Original sampled tones, building classifications and source
records are retained, not rewritten or discarded. Unrelated buildings and
the general city palette are untouched. Transparent source glass keeps its
existing glazing presentation rather than becoming opaque masonry.

Existing metric footprints, holes, heights, park polygons, tree positions,
species and counts remain authoritative. Lawn colour changes do not flatten
the existing counter-twisted Tilla-Durieux terrain. Special red/silver tree
species retain their distinct colour; the ordinary foliage palette changes
only in the bounded photo surroundings. Minecraft uses that same local
foliage family without spawning more trees.

## Procedural detail, not a survey

Three west-side groups have a crisp upper metal/glass colour course starting
28.5 m above their source base, only on parts taller than 29.5 m. This is a
photo-guided display estimate, not a measured storey height. The existing
extruded walls are subdivided in place, including courtyard walls. There are
no overlapping facade skins or internal horizontal caps; outer bounds and
collision geometry are unchanged. Minecraft keeps its simpler facade hue.

The two roof lights follow LoD2 atrium footprints in parents
`DEBE00YYWk0000CD` and `DEBE00YYWk0000CB`, oriented at -19.6 degrees in the
viewer frame. Their plan centres are approximately `[206.9, 1228.8]` and
`[184.1, 1292.7]`. Elevations 42.8/42.7 m, shallow 0.65 m camber, glazing
subdivision and service boxes are procedural photo-guided estimates. The
low atrium floor parts in LoD2 are retained as floor evidence, not mistaken
for surveyed roof elevations. Roof reconstruction is separate from the
unmodified measured building envelopes.

## Bounded cost and verification

The smooth roof addition is 120 thin boxes merged into the existing expanded
detail body, below 70 KiB of stored attributes. Its Minecraft reading is 72
surface instances appended to the existing building batch, adding exactly
5,472 instance-buffer bytes in both full and mobile-like profiles. Neither
adds a draw call, hidden solid fill, material texture or scene-wide update.
Facade/foliage colour substitutions do not enlarge their existing buffers.
The subdivided upper storeys add 2,594 vertices / 37,068 retained bytes to the
production follow-up groups, which still fit the existing 49-renderable cap.

Full Minecraft remains 50 renderables with 3,397,805 instances and
259,656,668 buffer bytes. Mobile-like remains 48 renderables with 788,936
instances and 60,702,128 bytes. These exclude the separate mob/loot fields,
whose budgets and protection rules are unchanged. Appearance hashes are
intentionally updated, not claimed identical to v0.72.42.

The dedicated tests verify source identity coverage, local palette scope,
near/distant colour selection, Minecraft lookup, upper-wall colour boundaries,
absence of internal caps and bounded roof cost. Browser visual checks cover
the panorama surroundings and narrow viewport; these are not a physical
phone test or a guarantee of identical frame rates across devices.
