# Ackerhalle, Rosenthaler Platz and Otto-Weidt-Platz — v1.0.85

Step 10 adds a small standalone recognition batch. Every previous source wall,
roof, window, street, path, water surface and navigation record remains unchanged.
There is no packet rebuild, new shell, texture, render target or per-frame work.

## Source anchors and display limits

**Ackerhalle / REWE:** OSM way 105154993, REWE node 348000444 and the retained
Berlin LoD2 parent `DEBE01YYK00003UA` supply the identity and exact wall planes.
Three street wall sheets from `mitte-streets-v166.json` retain their existing
ground datum. Thirty shallow members articulate terracotta bands and piers;
53 fine strokes indicate the western arched portal and its fan divisions.
No source roof, old window or passage is removed. Arch radii, member sections,
letter placement and detailed colours are visual estimates, not a facade survey.

[Berlin's Ackerhalle account](https://www.berlin.de/sehenswuerdigkeiten/3561526-3558930-markthalle-vi.html)
documents the original brick/terracotta facade and the two entrances. The
[REWE directory](https://www.rewe.de/service/deli-teilnehmende-maerkte)
confirms Ackerstraße 23. Andreas Praefcke's
[May 2008 Ackerstraße facade photograph](https://commons.wikimedia.org/wiki/File:Berlin_Markthalle_VI_Fassade_Ackerstrasse_2.jpg)
is a CC BY 3.0 external visual reference, credited in both manifests. Its old
Extra supermarket sign is not reproduced. The current REWE name is independently
drawn with the repository's geometric alphabet. No image pixels are bundled.

**Rosenthaler Platz:** twenty-two small plinth/eave members follow eligible
street-facing walls of the unchanged eleven-parent v163 source ensemble.
Selection rejects occupied outward approaches and clips members to their wall
sheets. Each original parent receives its existing v176 rigid terrain offset;
the building is never bent to the slope. Previously authored hostel lettering,
hotel identity, roofs and windows remain. The existing v163 source/material
evidence is reused; no new shop tenant or unrecorded entrance is invented.

**Otto-Weidt-Platz:** the four explicitly mapped stone bench ways
1355912009–1355912012 supply their complete open curved line courses. Sixty-one
short joined stone members stand on the existing sampled terrain, without
closing paths. The 0.5 m seat height and 0.7 m width are labelled display
dimensions, not measured sections. The existing basin outline and water remain.
[Berlin's square account](https://www.berlin.de/sen/stadtentwicklung/quartiersentwicklung/staedtebaufoerderung/nachhaltige-erneuerung/aktuell/artikel.1589135.php)
provides current place context, without deriving geometry from its protected plan.

Source hashes and exact selected wall rings are retained in
`public-places-v185-evidence.json`; the bounded OSM receipt is
`public-places-v185-osm.json` (ODbL-1.0). LoD2 and terrain remain dl-de/zero-2-0.

## Runtime

One instanced batch per representation. Drawn and touch share 113 body members,
53 arch strokes and small procedural letter strokes. Minecraft uses an independent
1,160-member axis-aligned body/stroke reading plus block letters, without solid
interior fill. Both keep final-sized buffers below 160 kB, no UV coordinates,
fixed transforms and the existing mode/material lifecycle. Focused tests cover
exact reproduction, source hashes, seat-line placement, finite buffers and native
orthogonality. Independent review checked wall containment, roof clearance,
terrain transforms and ground contact.

Rebuild: `uv run python scripts/build_public_places_v185.py`.
