# Charité at the Stadtbahn — v261

This is a bounded facade refinement of two distinct retained source owners:
Helmut-Ruska-Haus / Virology (`DEBE01YYK00003IB`, six parts) and the neighbouring
Edmund-Lesser-Haus (`DEBE01YYK0000AME`, four parts). The former is at
Rahel-Hirsch-Weg 3; the latter must not inherit that identification.

- [Official Virology institute](https://virologie-ccm.charite.de/) — identity and address.
- [Charité's Dermatology history](https://gedenkort.charite.de/orte/dermatologie/) — distinct post-war Lesser building.
- [Ruska southwest view, 2024](https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Rahel-Hirsch-Weg_3_S%C3%BCdwestansicht,_2024.jpg)
  and [Lesser view, 2024](https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Rahel-Hirsch-Weg_2,_2024.jpg):
  Schibo, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), inspected
  22 October 2026. Reference only; no image or photographic texture is bundled.

Ruska receives its two glazed wood-framed projecting bays, roof cornice and
guardrail, white upper arch panels and window transoms. Existing openings and
brick/plaster work remain. Lesser receives a pale plaster body, five regular
storeys, shallow ochre framing, white cross-mullions, sills and horizontal bands.
Facade dimensions, colours and projecting-bay heights are photographic display
estimates, not a survey. Measured plans, heights, holes and roof codes remain
byte-for-byte retained in the ten-part snapshot and original payload.

One static texture-free batch per mode adds 3,413 drawn or 12,256 independently
orthogonal native instances (259,388 / 931,456 instance-buffer bytes). No new
animation, descriptor, navigation solid, mobile detail reduction or live memory
allowance is introduced. Native Lesser fittings use an outward display offset
to clear the retained coarse source raster; this is a presentation approximation.
The exact source snapshot rebuild and complete source-payload hash are tested;
runtime tests check finite bounds, positive sizes, independent native matrices,
fixed transforms and a bounded allocation. Full release checks are recorded in
the combined v261 release note.

Independent exposure review corrected a concrete oriel overlap: projection
`bzFr0aOE` reaches 1.143 m beyond the parent facade and the previous fixed
1.07 m glass offset left its right-hand panes inside the retained source body.
Both oriels now derive their datum from their own maximum source projection
(1.143 / 0.918 m). Timber and glass sit 0.10 / 0.22 m in front of that datum;
trim sits 0.32 m out in drawn mode and 0.46 m in native mode, clearing native
pixel depth. Canopy/sill positions use the same source datum. Instance counts
and buffers remain **3,413 / 259,388 bytes** drawn and **12,256 / 931,456 bytes**
native. `charite-rail-v261-exposure.test.ts` ray-tests 48 glazing fields and 12
oriel mullion points against the retained source wall/roof skins in both modes,
plus exposed Lesser mullions; no other architecture was changed by this fix.
