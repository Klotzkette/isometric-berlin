# Northern shopfronts — v254 / Step 10

This bounded pass refines existing Torstraße shop windows and adds small lower
shop windows along the already modelled Kastanienallee and Danziger Straße.
It preserves every old source packet, earlier pane, plinth, roof and courtyard.

| Street | Bounded addition |
| --- | --- |
| Torstraße | Slim outer casing on all 220 exact v239/v244 shopfront panes |
| Kastanienallee | 17 retail-point matches on the retained v209 ordinary fronts |
| Danziger Straße | 60 retail-point matches on the retained v244 ordinary fronts |

The 29 September 2026 Geofabrik OSM snapshot already retained in this repository
provides positively tagged shop/food-service nodes with the named street address.
Each selected point must bind unambiguously to an existing LoD2 owner within a
1 m alignment tolerance and lie within 12 m of its exposed street face. Only one
new opening is admitted per face. Multiple businesses in one building do not
imply multiple measured openings. No tenant name, sign text, merchandise or
claim about present occupancy is added.

New glass fits only into the lower-wall gap above the retained horizontal plinth
and below the earlier lowest window/sill. Its complete casing and projecting
sill stay inside that gap and away from wall ends. Existing OSM entrance nodes
and the independently placed v233 door recipes receive 2.4 m clearance. Other
building footprints must leave the one-metre approach clear. The v245 landmark
facades are absent from the ordinary source selection; v252 owners are explicitly
protected. Tor's existing glass, central mullions, crossbars, reflections, jambs
and sills remain exposed: the new casing sits outside their recorded envelopes.

These are **estimated facade fittings**, not surveyed aperture positions. OSM
establishes the source-bound retail use; LoD2 establishes the wall. New widths,
heights, casing, glass colours and reflections are display estimates. There is
no newly invented door or walking passage. Copyright/source attribution remains
OpenStreetMap contributors (ODbL-1.0) and Geoportal Berlin LoD2 (dl-de/zero-2-0).
No external photograph or texture is used.

`scripts/build_north_shopfronts_v254.py` replays the small committed source,
checks every frozen source/packet hash and writes only its v254 runtime recipe
and evidence. Initial extraction reads the existing local PBF. The source receipt
also preserves the v209/v239/v244 packet bytes and v245/v252 evidence. It records
unmatched points and entrance/vertical-gap exclusions instead of guessing gaps.

Danziger native openings follow their independently recorded orthogonal source
spans. Kastanienallee v209 has no such native spans, so its separate native
reading uses small orthogonal staircase blocks at the established northern
facade offset. Tor uses the established v239/v244 native offset. There are no
rotated smooth native sheets. Both complete families retain all 297 selected
fronts; drawn mobile and desktop use the same geometry.

The existing NorthV185 `hagenauer` batch owns construction, materials and disposal.
The additions precede the v249 tram tail so its rail slope correction remains
unchanged. No new mesh, descriptor, texture, animation, navigation solid,
coverage or residency limit is introduced. The recipe is 154,096 bytes; added
matrix/colour storage is 102,828 bytes drawn (1,353 instances), 198,132 bytes
native (2,607 instances), each below the dedicated 200 KiB check.

Validation: four Python checks verify unchanged receipts, exact old Tor panes,
actual owner binding, clear wall bands, entrance exclusion and casing containment.
The focused 18-test Bun run passes (513,694 assertions), including independent
native matrices, fixed batch counts, retained mobile detail, old northern matrix
prefix hashes and the complete unchanged v249 tram matrix/colour tail. Existing
v244 and v252 source tests are included in the final focused Python run. Full
production browser checks remain release integration work; these checks do not
claim a long-duration physical-phone soak test.
