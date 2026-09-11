# Step 10: Maxim Gorki Theater

The model keeps the theatre behind Neue Wache at Am Festungsgraben 2. Current
retained OSM way `131835798` identifies the Singakademie; the earlier runtime
envelope is prism `31835798`, whose 9 m height was a generic theatre fallback.
Both source records remain retained. Neighbouring Palais am Festungsgraben
prism `41671582` is separate and must not be suppressed.

`scripts/build_gorki_building_source.py` extracts only Geoportal Berlin parent
`DEBE01YYK000039k` from the ignored
[LoD2 391_5819 archive](https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip).
The compact 12.5 KiB supplement retains all three parts and 64 original wall/roof
surfaces, the archive digest and 2 March 2026 creation date. Original source
elevations use the established EPSG:25833 frame, with a 3.954 m world basement
base and 26.777 m highest roof. These are not substituted street heights.

The generalized official roof incorrectly reads as a single great slope from
the entrance to the northern tower. Display geometry retains exact ground rings
but resolves a pitched hall roof, triangular south pediment and separate north
stage tower within that measured maximum. Front eaves at approximately 20.3 m,
pediment/ridge at 23.55 m and tower depth are explicit procedural display fits,
not claimed additional measurements. Raw original sheets remain unchanged in
`gorkiBuildingSource.json` and this conflict must accompany source fusion.

## Architectural evidence

- [Landesdenkmalamt, Singakademie, object 09030077](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030077)
  establishes the protected building, Carl Theodor Ottmer / Karl Friedrich
  Schinkel attribution and 1825–1827 construction.
- [Stiftung Sing-Akademie, the building's post-war history](https://www.stiftung-sing-akademie.de/33-0-Juengere-Geschichte.html)
  establishes the northern stage tower, blocked former large hall windows and
  replacement front inscription. The wide side bays are accordingly solid
  recessed wall fields, not invented glazed windows.
- [The theatre's historical walk](https://www.gorki.de/de/das-theater-und-seine-geschichte-ein-spaziergang/2017-03-04-1700)
  confirms the building's former concert-hall role. The model reads as today's
  theatre, not the unbuilt Schinkel concert-hall interior.

External visual reference: Jörg Zägel (Beek100), 13 June 2009,
[*Berlin, Mitte, Maxim-Gorki-Theater 02.jpg*](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Maxim-Gorki-Theater_02.jpg),
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
The photograph supports the three wooden portals, four tall fluted pilasters,
framed blind upper panels, pale stone, pediment and gold theatre name. It is not
used for current event banners or construction status. No photograph, crop,
poster art, proprietary font or image texture is bundled or fetched at runtime.

## Runtime and verification

- Drawn: two renderables, 364 repeated details, 43,432 stored geometry/instance
  bytes. Original and interpreted source triangles are compact static geometry.
- Minecraft: one surface-only cube batch, 1,115 instances, 85,388 bytes. No hidden
  solid fill and no smooth duplicate.
- Full/mobile retain the same model; no framebuffer, animation or rendering
  distance change. The catalogue stays at 93 places.
- Actual Chrome renders in both forms were inspected. Rays through each entrance
  meet door detail before the source wall. Roof tests distinguish the gabled hall
  from the stage tower and check that the original source JSON is not mutated.

Integration: add `createGorkiBuilding()` to the drawn world and
`createGorkiBuilding(true)` to Minecraft. Use `GORKI_BUILDING_PRISM_IDS` for
generic-prism suppression, `isGorkiBuildingReplacementColumn` for removal of the
old voxel columns, and `GORKI_BUILDING_SOURCE.parts` for source-bound collision.
Its roof callback must use `gorkiPartRoofAt(part, x, z)` from the lightweight
profile module. This shares cached authored hall/tower sheets with both visual
styles and prevents a phantom collision surface along the retired source slope.
