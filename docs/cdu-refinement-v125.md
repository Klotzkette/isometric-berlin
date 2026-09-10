# Konrad-Adenauer-Haus recognition refinement — v1.0.25

Step 10 replaces the blank lower oval and heavily stepped upper cylinders with
a contiguous six-storey office body, timber spandrel bands, exposed window
mullions and two subtly recessed silver upper levels. The four-storey winter
garden now has actual transparent walls and roof, two glazing registers per
office floor and a recessed glazed entrance on its eastern edge. A small
procedural white CDU identification panel and the photographed roof mast make
the building easier to identify. No photograph, logo image, font or texture is
bundled or requested by this model.

## Evidence and limits

- [OSM way 25999445](https://www.openstreetmap.org/way/25999445) remains the exact
  six-point horizontal hull. The existing 18 m glass eaves and 5.35 m scene
  ground datum remain unchanged. Both source prisms `25999445` and `MwfoOvua`
  remain suppressed in the detailed and distant drawn building passes.
- [Groth Gruppe's project account](https://www.grothgruppe.de/Projekte/Bundesgeschaeftsstelle-der-CDU/)
  documents the pointed Klingelhöferstraße/Corneliusstraße site, the four-storey
  glazed winter garden and Petzinka, Pink und Partner as architects.
- [The CDU's 25th-anniversary account](https://www.cdu.de/aktuelles/cdu-deutschlands/das-konrad-adenauer-haus-feiert-den-25-geburtstag/)
  documents six floors and the ship-like building. The climate-buffer description
  and 6,300 m² usable-area metadata are retained from the existing profile, not
  newly established by that anniversary article. Groth's differing 12,600 m²
  office / 7,462 m² commercial figures are recorded without reconciling their
  area definitions. None of these areas is used to infer component dimensions.
- Ansgar Koreng's
  [141101 Berlin Konrad-Adenauer-Haus.jpg](https://commons.wikimedia.org/wiki/File%3A141101_Berlin_Konrad-Adenauer-Haus.jpg),
  **Ansgar Koreng / [CC BY-SA 3.0 DE](https://creativecommons.org/licenses/by-sa/3.0/de/)**,
  supplies the open glass frame, office bands, exposed upper windows and entry
  reading. Its description page and image were inspected.
- Reinhold Möller's
  [Berlin Konrad-Adenauer-Haus-20241207-RM-102533.jpg](https://commons.wikimedia.org/wiki/File%3ABerlin_Konrad-Adenauer-Haus-20241207-RM-102533.jpg),
  **Reinhold Möller (Ermell) / [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**,
  supplies the current white/dark CDU identification panel, turquoise roof flag,
  silver upper facade and roof shoulder. Its description page and image were
  inspected. Both photographs are external visual references only; packaged
  per-file attribution accompanies the viewer.

The 54 × 30 m inner ellipse, 53.4 × 29.2 m and 51.2 × 27.6 m upper facade
ellipses, small setbacks, window spacing, entry subdivisions, roof-shoulder
steps and mast are bounded procedural display estimates. They are not an
interior survey. The old 15.6 m lower-body height left an unintended 2.4 m gap
under upper decks starting at 18 m; the four lower levels now meet those decks.
The sign is a 3.9 × 1.7 m display panel at 16.2 m above the existing ground,
with estimated local placement behind the glass bow. Its strokes are merged
boxes rather than a political banner or a texture.

## Mode integration and budget

Day, Night, Snowstorm and Schwellenraum share the drawn model and its existing
lighting path. Minecraft receives a separate single instanced block model,
with a visible open frame around the office facades and roof plates. There is
no smooth duplicate in that mode. Boundary plinth cells shrink until their
corners remain inside the mapped hull; upper slab coordinates use the same
offsets as their corresponding office facades. No new dynamic update or
runtime asset request is introduced.

| Model | Draw calls | Stored vertices / blocks | Geometry and instance bytes |
| --- | ---: | ---: | ---: |
| Previous drawn model | 3 | 9,968 vertices | 196,128 |
| Refined drawn model | 2 | 36,924 vertices | 664,950 |
| Refined Minecraft | 1 | 2,539 blocks over one 24-vertex cube | 193,804 |

The drawn increase is 468,822 bytes and removes one draw call. Minecraft
replaces exactly 149 old 4 m source columns at 21.2 m top elevation. This removes
447 full / 149 mobile generic building instances and 264 full-profile generic
window panes. The resulting generic counts are 1,461,733 / 534,551 building
instances and 1,579,170 full-profile panes. Net model-related buffer growth is
139,768 bytes full / 182,480 bytes mobile, including the new unit cube; the
release-wide benchmark remains the overall source of truth.

## Verification

The focused test measures facade intersections across the former vertical gap,
actual transparent wall/roof geometry, source-column membership, fixed draw
and instance budgets, deterministic transforms and texture-free materials.
Every drawn vertex remains within the mapped hull plus its 0.101 m facade
frame allowance. Generic detailed and distant source-mass suppression remains
active. A regression also prevents a missing vertex-colour attribute from
turning the instance-coloured Minecraft model black.

Browser QA rendered dedicated isometric and overhead views, then the
Minecraft replacement. Reference comparison corrected excessive upper
setbacks and moved mullions out of their opaque window bands. The rendered
geometry, sign, transparent frame and mode replacement were visually checked;
the screenshots remain local QA artefacts.
