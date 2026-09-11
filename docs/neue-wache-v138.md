# Neue Wache: source-bound open hall

Pipeline step 10; no catalogue or extent change. The formerly closed six-metre
OSM fallback `24240381` is replaced only in display. The source remains intact.

## Sources and interpretation

- [Landesdenkmalamt, 09095950](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095950)
  identifies the four corner risalits, Doric portico, ten winged frieze figures,
  shallow relief pediment and Tessenow's memorial hall with circular opening.
- [Staatliche Museen, Schinkel Orte](https://schinkel.smb.museum/image_orte.php?id=23)
  documents the reduced interior and Kollwitz's *Mutter mit totem Sohn*.
- Exact location: [OSM building](https://www.openstreetmap.org/way/24240381)
  and [sculpture node](https://www.openstreetmap.org/node/5253735916).
- The retained 2 March 2026 official LoD2 tile contributes both original
  envelopes, `DEBE01YYK00006wY` and `DEBE01YYK0001yAt`, including every source
  wall and roof sheet. Their top levels are 15.013 and 15.479 m in the viewer.
  `uv run python -m scripts.build_neue_wache_source` reproduces the bounded
  20,457-byte source supplement from the ignored official ZIP.

The source plan and alignment anchor the architectural shell. The 6 m fallback
was an OSM storey estimate, not the building's real height. Source ground levels
4.562/4.736 m include lower stonework; display uses the existing 5.2 m street
datum and a shallow 5.38 m interior floor. The hollow wall layout, 2.06 m central
door opening, 1.85 m oculus radius and approximately 1.6 m sculptural recognition
are photo-proportioned display dimensions, not a measured interior survey.

The two side grilles remain closed; the central gate leaves stand open against
the reveals. The original full-roof polygon is retained as evidence while the
display roof contains an actual hole. There is no glass over that opening.
The bronze figure suggests a hooded seated mother enclosing her adult son's
folded body, using a faceted mantle and small shared geometric forms.

## Reference photographs

External references, individually mirrored in both Wikimedia manifests:

- [150214 Neue Wache Berlin.jpg](https://commons.wikimedia.org/wiki/File:150214_Neue_Wache_Berlin.jpg),
  Ansgar Koreng, 14 February 2015, CC BY 3.0 DE.
- [B Neue Wache interior 1.jpg](https://commons.wikimedia.org/wiki/File:B_Neue_Wache_interior_1.jpg),
  Daniel Schwen, 27 August 2007, CC BY-SA 4.0.
- [Käthe Kollwitz, Pieta.JPG](https://commons.wikimedia.org/wiki/File:K%C3%A4the_Kollwitz,_Pieta.JPG),
  World3000, 9 February 2013, CC BY-SA 3.0.

No photo or runtime texture is bundled. Historical photographs establish the
permanent architectural form, not current temporary events or maintenance.

## Navigation and resource contract

Day, night, snow and Schwellenraum share the same static hall. Minecraft uses
native block columns and a thin stepped roof with an open oculus. The model
does not allocate lights, frame callbacks or photographic textures. Shared
geometry stays below 180 kB drawn / 230 kB native and at most seven renderables.

Only the matching source building accepts the authored interior override.
Analytical collision retains walls, piers, columns, grilles and the sculpture;
the central door and space around the figure remain passable. Tests move the
full standing capsule from the street through the gate and around the figure,
reject adjacent walls and grilles, and raycast both the entrance and oculus
against the actual geometry in both styles. Unrelated overlapping source
buildings are never exempted.

The original prism's 11.2 m top must not remain a navigation roof: it would
leave a person floating inside the hall when changing from hover to walking.
The matching source ID uses the authored roof surfaces, including the oculus,
while the raw prism remains in the source supplement. Interior ground resolves
to the shallow floor; real roof standing remains available above the roof.

The bounded granite forecourt follows the LDA paving account and the mapped
paved OSM entrance course. Slab spacing, local width and colour are display
subdivisions. The drawn pediment uses continuous planes; only the native
Minecraft version keeps stepped courses.
