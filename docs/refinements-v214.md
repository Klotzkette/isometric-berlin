# Hospital and neighbourhood refinements — v1.0.114 / Step 10

The owner requested Bundeswehrkrankenhaus Berlin with its helipad and a red
medical helicopter approaching from approximately twenty metres, plus more
accurate surrounding houses at Gendarmenmarkt, BND, Neue Nationalgalerie and
Potsdamer Platz. This is a bounded recognition pass, not a survey of every
house in those neighbourhoods. The baseline is v1.0.113, `a5781106`.

## Architecture and evidence

- [Hospital source record](bundeswehr-hospital-v214.md): six selected measured
  building families, 69 wall planes; all 40 hospital families / 99 original
  parts remain. Cream panels, grey/turquoise bands, entrances and roof-edge
  accents supplement the original shells. The ground helipad is exact OSM way
  `51804908`, west of the hospital by the canal, not on the roof.
- [Gendarmenmarkt/BND context](gendarmen-bnd-context-v214.md): 15 existing
  surrounding-house fronts gain cornice/soffit detail without covering their
  earlier windows. The two separately identified Living 108 and Feuerlandhöfe
  fronts gain source-plane aluminium/glazing and clinker/plaster readings.
- [WZB/Potsdamer context](potsdamer-context-v214.md): the WZB outer semicircle
  receives its pastel courses and sandstone surrounds; two Rogers office
  blocks gain ceramic spandrel/metal accents. All 26 scoped source parts,
  including the original 21-part set, court openings and atrium roofs remain.

Existing packets, building volumes, navigation, streets, trees, shoreline and
the 93-stop tour are retained. The new geometry is additive, apart from thin
reference-guided facade skins visually covering generic aperture estimates on
the two explicitly documented previously unmodelled BND-neighbour fronts.
Facade subdivisions and colours remain documented estimates where unmeasured.
The individual photo credits are included in both packaged Wikimedia manifests;
no image pixels or external runtime dependencies are added.

## Rescue helicopter

`RescueHelicopterV214.ts` builds one original small red medical-aircraft mesh,
with a faceted cabin, blue-grey glazing, tail, skids, two red crosses on white
side fields, main and tail rotors. Minecraft uses its separate block reading.
It is an illustration requested by the owner, not a replica of the aircraft
or livery actually stationed at this hospital.

The illustrated 64-second cycle approaches from the west/southwest at 20 m
above the mapped pad, lands, rests for ten seconds, climbs and returns to its
approach point. It is explicitly not an operational flight route. In Flooded
Berlin, a submerged pad becomes a holding approach at least four metres above
the water; changing flood height remains safe when reduced motion is enabled.

One existing frame callback updates one fixed position buffer at at most 20 Hz
when visible. No new timer, animation history, image, shadow-atlas rebuild or
per-frame allocation is introduced. Offscreen/hidden/underside/reduced-motion
periods pause the phase. Fixed bounds contain the whole approach, rotor sweeps
and supported flood levels. Source/render arrays together total 163,392 bytes
drawn or 57,276 bytes native. There is one draw call in either representation.

## Validation

The focused source tests preserve original source digests and part records,
bound new members to measured wall polygons and verify native clearance. The
render tests check fixed buffer counts, independent mode geometry and identical
drawn mobile detail. The helicopter tests cover continuous touchdown/departure,
finite bounded vertices, reuse of the same arrays, offscreen/reduced-motion
pause and flood changes while landed and paused.

Browser checks on the production bundle passed in Chromium and mobile WebKit
for all six modes: Day, Night, Snowstorm, Schwellenraum, Flood and Minecraft.
The camera pose remained unchanged across mode switches; no page errors or
WebGL context losses were reported. Separate close views cover the hospital,
helipad, Gendarmenmarkt, Feuerlandhöfe, Living 108 and the WZB. These are browser
emulation checks, not evidence of physical iPhone stability.

A complete Pages tree comparison preserves every earlier city mesh and DZI
asset byte-for-byte except the expanded Wikimedia attribution manifest.
Previously published hashed JavaScript assets remain available for open tabs.

The final Potsdamer street view was checked again in drawn and Minecraft form
after correcting the source-owner association: thin retained street facades
sit outside the atrium/body shells. The original 802 drawn / 3,387 native
additions are retained exactly; the final context has 909 / 4,853 members.
The five focused Python tests include an exterior-visibility regression.

The configured production build passed (TypeScript and Vite). Because the
workstation disk was nearly full, the identical public assets were copied to
the built output as independent APFS file clones before packaging. No asset
was omitted. The extracted package is 875,244,906 bytes (834.699 MiB), within
the unchanged 835 MiB ceiling. Ruff formatting/lint and whitespace checks pass.
The 15 focused Bun tests pass, including integration/disposal and animation.

Full Python regression (excluding the separately run release module): 1,207
passed and four skipped. Its one stale-data failure was the Potsdamer source
hash: pytest had collected the previous 21-part profile before the street-plane
correction regenerated that receipt. With all edits frozen, the three v214
modules were rerun together: all ten Python tests pass, including all five
final Potsdamer checks. The separate final release module has 76 passing tests.
Release readiness and the extracted local-package launcher smoke both pass.
The final Potsdamer two-mode view also passes on mobile WebKit without context
loss. No known failing test remains.
