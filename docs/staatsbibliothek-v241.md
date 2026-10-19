# Staatsbibliothek Unter den Linden — v241

This is the renovated historic Staatsbibliothek, Unter den Linden 8, immediately west of Humboldt-Universität. It is **not** the Alte Bibliothek on Bebelplatz. OSM relation 180594 and official parent`DEBE01YYK00002vr` retain their existing v169 ownership. The old core prism`n-180594` was already source-transferred before this change.

## Architectural correction

The previous display combined a generalized flat LoD2 roof with two overlapping procedural window recipes. That produced a tall pale attic, uniform small windows and a shallow hipped portal block. The revised front has the restored convex slate Lindenkuppel and small louvred crown, three round-arched gates, four giant columns, the sculptural triangular pediment, large upper-storey windows with alternating heads, roof balustrades and the two larger corner-risalit windows. The old courtyard portico remains in its existing location; it is a separate façade from the street portal.

The correction is deliberately bounded. All 18 original source parts, their footprints, delivered ground/top values and the eight main-part courtyard holes remain in the immutable retained source record. Sixteen parts have exactly unchanged surface records. Only these displayed roof interpretations change:

- `DEBE3DbBJ132QVQ7`: the generalized portal's high vertical skirt and shallow hip become a convex cap, using its exact source footprint and maximum world height 44.648 m. Nine curved profile stations start at worldY32.2 m. The profile, eave and crown detail are visual estimates from the restored-building reference, not surveyed roof coordinates.
- `DEBE3Di3VeB8rUHf`: the outer 9 m of the street roof slopes from estimated eaveY32.2 m to the unchanged 37.773 m source ridge. Original geometry behind this band remains unchanged, including courtyard openings. The main roof and portal roof receive the slate colour seen in the reference. Polygon triangulation preserves the original roof-plan holes and coverage; no roof plate spans a court.

Source-ground datum, original navigation, courtyards, modern reading-room cube and every Potsdamer Straße library model remain unchanged. Navigation retains the conservative original source envelope; this refinement introduces no new walkable opening or passage. Exact dimensions of decorative capitals, balusters, reliefs, mullions and colours are restrained display estimates. The small sculptural figures are original abstract geometry, not copied sculptural meshes or photo textures.

## Primary references and image use

Checked 19 October 2026:

- [Staatsbibliothek: building history](https://staatsbibliothek-berlin.de/die-staatsbibliothek/die-gebaeude/haus-unter-den-linden/baugeschichte): Ihne's 1903–1914 building, restoration and the reconstructed Lindenkuppel; distinguishes the historic portal from the modern reading-room cube.
- [SPK / BBR official Lindenkuppel press dossier, 10 July 2013](https://www.preussischer-kulturbesitz.de/fileadmin/user_upload_SPK/documents/presse/pressemitteilungen/2013/130710_Pressemappe-Richtfest-Lindenkuppel.pdf): reconstruction of the lost portal dome, historic façade restoration and large historic windows. Its heights are descriptive real-building heights; the viewer retains its original source datum.
- [Staatsbibliothek official building photographs](https://staatsbibliothek-berlin.de/die-staatsbibliothek/abteilungen/generaldirektion/presse-und-oeffentlichkeitsarbeit/pressebilder/gebaeude-der-staatsbibliothek): **“Außenansicht Haus Unter den Linden”, ©Stabi Berlin**. Inspected solely as an architectural reference for the restored street façade, roof profile and window hierarchy. This press photograph is not an open-licence game asset: no image, pixels, texture, derived bitmap or photograph is included in the application or release. The site's press-use conditions and attribution remain attached to the reference; we make no CC-licence claim.
- Existing freely licensed courtyard references and their complete credits remain recorded in `geo_data/regierungsviertel/libraries-v202-references.json`. v241 adds no Commons media.

## Exact ownership and required construction

`staatsbibliothekV241Previous.json` records immutable encoded packet fingerprints plus original triangle or line indices. A changed packet fails open. The retired layers are 429 exact drawn shell triangles, 33,168 prior generic façade triangles, 21,336 native triangles and 169 obsolete roof-edge segments. Native retirement is the exact old complete-shell-and-window surface difference against the corrected complete source shell. The new packet restores 2,106 native shell triangles, preserving surfaces previously merged with old window cells. The drawn packet similarly restores 1,123 changed source-shell triangles. Unrelated packet indices never change.

The same receipt records 325 exact v202 box rows, 339 native block rows and 33 portal-roof rib surfaces. Matching requires both original row index and original value. Changed rows and every unlisted row remain. Court-portico role 8, modern reading-room role 4, all other library owners and the complete Potsdamer Straße library recipe are retained.

`architectureV241` is an explicit complete-world opt-in. Required construction now includes the retained `createLibrariesV202(native,true)` architecture and `addStaatsbibliothekV241`; only then can the corresponding old shell/window/ink layers yield. Standalone factories default to the entire legacy recipe. Cancellation publishes no partial new root. The old source JSON files and packets are never rewritten.

Receipt maps are local to a construction. Lossless JSON fields are constructor-only, weakly cached: new packet fields `drawn`,`minecraft`; receipt fields `records`,`lineRecords`,`boxes`,`blocks`,`surfaces`. Mobile and desktop use identical full geometry. Native detail is independently generated with orthogonal faces, not drawn geometry relabelled as native.

## Bounds and verification

Final required packet sizes:

| Mode | Triangles | Vertices | Meshes |
| --- | ---: | ---: | ---: |
| Drawn |26,328|27,928|1|
| Native |21,330|14,867|1|

Both remain below 65,536 vertices. Runtime JSON is 1,277,871 bytes (326,252gzip); exact receipt JSON 399,770 bytes (133,085gzip). No texture, streaming cell, draw-distance, resident-window or mobile-budget expansion is introduced.

Focused checks: 9 Python tests (including the 4 unchanged v202 library tests) and 6 Bun tests pass. They verify immutable input hashes, all 18 footprints/eight court holes, untouched rear sheets, exact old-native-minus-removal-plus-restoration equality, full recognition roles, native orthogonality, packet/row fail-open behaviour, unrelated indices, actual decoder opt-in and cancellation. Isolated previews include the complete underlying shell, retained library decorations and new model in both modes. The root release task performs the complete-city browser and package checks.

Useful world camera positions: street-front close view from `[1290,70,310]` towards `[1365,25,184]`; whole-building view from `[1230,125,340]` towards `[1360,25,110]`, Y-up. Portal centre approximately `[1366.35,190.60]` in XZ; modern reading room occupies approximately X1335–1381/Z62–103.
