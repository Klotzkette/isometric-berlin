# Berlin Junction: owner-photo correction

Pipeline step 10. This change is confined to Richard Serra's sculpture and its
visitor passage. The Philharmonie, T4 geometry, other buildings, camera controls
and rendering-distance settings are unchanged.

## Evidence and dimensions

Four photographs supplied by the owner show two uninterrupted, dark oxidised
steel plates bending in the same direction. Their upper edges lean toward each
other above a curved passage; the photographs include a cyclist at the entrance.
They are non-bundled visual references, never textures or public photo assets.
Perspective makes the near edges appear taller; the model does not invent
different plate heights or sloping top cuts.

[Susanne Kähler/Jörg Kuhn and Nicola Vösgen, Bildhauerei in Berlin, “Berlin
Junction”](https://bildhauerei-in-berlin.de/bildwerk/berlin-junction-6427/)
(accessed 2026-09-10) identifies two form-identical curved Corten-steel plates
inclined toward one another and publishes **14 m length, 3.4 m height per plate**.
The former code/documentation incorrectly attributed 13.65 × 3.90 × 0.055 m
to this inventory. That conflict is recorded here; the inventory envelope wins.
The 0.055 m display thickness is retained only as an explicitly unverified fit.
No new survey or photogrammetric accuracy is claimed.

The plan-form reading is also consistent with artist Georg Klein's original
[documentation of his installation inside the sculpture](https://www.georgklein.de/installations/001_transition_d.html).
Its diagram was used as qualitative orientation evidence only, not traced or
bundled. No sound recording or installation content is reproduced.

## Geometry and access

OSM way `187360886` retains its identity and recorded point `[-201.8, 931.8]`.
The retained LoD2 source `K0003UOE` supplies the actual curved site course. Its
end midpoints are `[-204.25, 927.20]` and `[-200.40, 939.45]`; the bend faces east.
The earlier -0.37 rad rotation faced the wrong way. The new yaw is π +
atan2(3.85, 12.25), and the fitted arc origin `[-201.017, 932.914]` aligns the
pair's end midpoint with that source chord. This is a source-derived display
fit, kept separate from the OSM identity point. The ground sampler gives y=4 m.

That same LoD2 record was still rendered as a closed white building inside the
sculpture. Exactly `K0003UOE` and one raw Minecraft column whose centre lies
inside its unchanged ring are replaced in presentation and physical collision.
The source ring and its original 3.9 m height remain committed; the published
sculpture inventory's 3.4 m height controls the new display. Surrounding source
prisms and columns are retained.
Both plates use the same conical strip, inverted vertically, with 48 arc segments
and four height bands. The 14 m value controls the longer arc edge. A 17 m middle
radius, 0.625 m inward displacement per plate, 1.75 m ground centre separation,
0.055 m thickness and dark-brown patina are bounded photographic display fits.
The centre separation at the top is 0.50 m. Neither top nor end caps span the gap.
Ink follows the perimeter, without the former repeated vertical box seams.

Four drawn modes share two plate meshes and their two perimeter-line batches.
Minecraft substitutes one surface-only instanced batch with 2,276 blocks on a
0.2 m grid. Outward rounding keeps every cube corner outside the physical
passage rather than thickening the steel into the visitor's shoulders or head.
No hidden full-volume Minecraft fill or smooth duplicate is added.

Physical collision uses the same finite conical arcs, including true endpoint
distance. Serra's protected shape follows the actual steel rather than filling
its complete OSM area. Correcting the orientation also removes the apparent
conflict with the neighbouring T4 area: its original complete protection and
geometry are unchanged. Decorative props still avoid both full source areas.

Regressions exercise 111 walking-body positions through the curve and both
entrances using the complete source-protection index. Independent checks against
the rendered Minecraft instance boxes retain at least 0.584 m clearance for the
0.42 m body radius. Ray tests against the actual drawn triangles check the open
passage and thin steel. Isometric, side, end and top views are inspected in a real
Chrome WebGL renderer; no owner photograph is loaded by the viewer.
