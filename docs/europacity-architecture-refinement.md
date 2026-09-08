# Heidestraße and Otto-Weidt-Platz architecture — v1.0.9

Pipeline step 10 adds a bounded, texture-free recognition layer to 140 existing
building parts in 21 building/facade profiles. Every selected prism is copied
byte-for-value from the shipped `lod2-prisms.json`: the original building and
OSM records, footprint rings, open courtyards, ground levels, heights and roof
presentation remain present. Repeated facade work uses two instanced cube
batches. It does not add tour stops, change the bounds, replace source volumes
or create ground-level collision barriers.

## Identity and evidence

- **KPMG / Einz Heide, Heidestraße 58:** exact OSM multipolygon
  [7433644](https://www.openstreetmap.org/relation/7433644) identifies the six
  shipped parts of Berlin LoD2 parent `DEBE00YY2TW0003e`. This is separate from
  the EINZ tower and from the neighboring `DEBE01YYK0002LDW` building. The
  [architect's account](https://www.ksp-engel.com/projekte/kpmg-headquarters-berlin)
  supports light limestone, fine pilasters, projecting/recessed rhythms and
  rounded corners; the
  [owner's account](https://www.caimmo.com/de/portfolio/projekt/buerogebaeude-heidestrasse-58/)
  supports the arcaded facade. The architect describes six storeys and the
  owner seven; the model retains the measured source envelope and uses seven
  display rows. These are recognition subdivisions, not a surveyed schedule
  of individual floor slabs or windows.
- **EINZ podium:** the seven shipped non-tower parts of parent
  `DEBE01AL2TJ0000u` receive a silver-grey facade treatment. The old separate
  rectangular podium screen was displaced approximately 40 m north of the
  actual main source body. Removing that screen and applying detail to the
  original source walls preserves all concave returns and source courts.
  The tower part `JUgwVTiy` stays outside this module.
- **Autobahn GmbH, Heidestraße 15:** the
  [operator's current address](https://www.autobahn.de/impressum) and committed
  OSM POI `10786517573` identify the three parts of
  `DEBE01AL12l0000H`. The
  [realized Staab building](https://www.staab-architekten.com/de/projects/859-geschaftshaus-am-otto-weidt-platz-berlin)
  combines a tall slab facing the square with lower street wings; the strong
  concrete base becomes finer anodised frames upstairs. The model retains
  all three source heights and implements that graded relief.
- **BUWOG THE ONE:** the current OSM relation `8885425` bounds the residential
  block north of the diagonal square. It is distinct from **Budapester Höfe**,
  relation `7636072`, immediately south of it, and **Prager Karree**, relation
  `8885424`, farther south. Exact returned OSM identity bounds accompany the
  source manifest. The
  [Grüntuch Ernst account](https://gruentuchernst.de/projekte/p387-europacity/),
  [rohdecan account](https://www.rohdecan.de/de/02-PROJEKTE//180707-B13) and
  [BUWOG account](https://www.buwog.de/wohnbauprojekte/49) describe six/seven
  storeys, clinker, large openings, stone cornices, slender metal rails and
  folded triangular canal loggias. Those cues belong to this north block;
  they are not assigned to Budapester Höfe. The two inspected Golda-Meir-Steg
  photographs show the contrasting square-facing facades on both sides.
- **QH Spring:** [CKRS](https://ckrs-architekten.de/fassade-qh-spring/)
  documents angular pigment-coloured precast concrete. The source's stepped
  blocks retain their own heights and receive deep concrete reveals.
- **QH Core:** [the developer](https://www.taurecon.com/dm-drogerie-markt-mietet-im-quartier-heidestrasse/)
  identifies Robertneun's red-brick ensemble. The retained source courtyard,
  tall corners and lower wings receive dark red masonry, strong piers,
  grouped openings and bounded ground-floor mortar cues.
- **QH Colonnades:** [Collignon](https://www.collignonarchitektur.com/en/projects/colonnades-quartier-heidestrasse)
  documents pillars, folded surfaces and recessed loggias. The existing
  OSM-derived envelope receives folded concrete reveals; this overlay does
  not pretend to survey or open an unrecorded full colonnade passage.
- **QH Track A–I:** [EM2N](https://www.em2n.ch/en/work/quartier-heidestrasse-qh-track.html)
  describes nine related industrial building types. The nine exact shipped
  OSM parts retain their separate 5–14-floor profiles. A July 2026 CC0
  photograph supports grey frames, narrow window divisions and the dark
  green ceramic spandrels. The
  [fabricator](https://www.hemmerlein-sichtbeton.de/referenzen/qh-track-berlin-01102023/)
  documents smooth and sandblasted precast concrete.
- QH Straight and the adjoining residential rows retain their independent
  OSM/LoD2 identities, source envelope and courts. Their neutral concrete or
  masonry palette, framed windows, ledges and open rails are conservative
  recognition subdivisions. Individual window positions, rail counts,
  mortar joints, shallow folded returns and opening proportions are not
  claimed as surveyed geometry.

## Geometry and visibility safeguards

Facade normals come from the actual outer and inner rings. Before emitting a
bay, the factory checks all nearby source parts, including unselected
neighbors, to suppress shared walls and buried details. The original source
roof algorithm determines the conservative eaves limit in `facadeTops`;
windows and trims do not continue through a pitched source roof. No new roof
height is invented.

Minecraft uses a separate block-only factory reading with the same source
identities. It clips each intersecting four-metre source cell in wall
coordinates and moves the whole facade bay to a common exposed plane. This
keeps glazing visible on oblique coarse walls while preserving the relative
positions of glass, frames and rails. The maximum displacement is 3.6 m;
bays requiring more clearance are omitted rather than moved through the
opposite side of a narrow court. Original building columns remain intact.

The overlay contains only shallow facade solids (at most 0.82 m depth);
upper-floor balcony details do not create new barriers across the square,
streets or ground approaches. Generic windows, facade trims and chimneys are
suppressed only for the exact owned IDs; original bodies remain rendered.

## Measured rendering budget

With the complete shipped source context and Minecraft payload:

| Profile | Batches | Instances | Rendered cube vertices | GPU arrays |
| --- | ---: | ---: | ---: | ---: |
| Smooth full | 2 | 82,545 | 1,981,080 | 6,274,068 bytes |
| Smooth mobile | 2 | 47,072 | 1,129,728 | 3,578,120 bytes |
| Minecraft full | 2 | 43,181 | 1,036,344 | 3,282,404 bytes |
| Minecraft mobile | 2 | 31,751 | 762,024 | 2,413,724 bytes |

Mobile retains every building family with wider bay spacing and fewer rail
strokes. Full/mobile mode matrices remain finite; no UV coordinates, bitmap
images, fonts or runtime photograph URLs are used. The geometry test checks
all 140 source records, outward normals, source eaves limits, neighbor
occlusion, all facade families and representative actual Three.js surface
rays through both smooth source shells and real coarse Minecraft cells.

## Visual references

Four inspected photographs are attribution-only references:

- *Berlin 20260711 Quartier Heidestraße 01.jpg* — NutzerAusBerlin, CC0.
- *Berlin-Moabit Otto-Weidt-Platz.jpg* — Definitiv, CC BY 4.0.
- *Golda-Meir-Steg Berlin 1v5.jpg* — Singlespeedfahrer, CC0.
- *Golda-Meir-Steg Berlin 2v5.jpg* — Singlespeedfahrer, CC0.

Per-file page URLs and license metadata are supplied to both release credit
manifests. Photographs, crops, diagrams and photographic textures are not
bundled or loaded. The 2021 construction state visible in older photographs
is not reproduced as a present-day construction site.
