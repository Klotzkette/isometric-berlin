# Street fronts in Wedding and Gesundbrunnen

Eight street fronts use the retained measured wall planes and heights in both
Drawn and Minecraft. As V337 already supplies quieter wall colours, the new
window surrounds, glass, reveals, sills, plinths and eave courses leave the
existing body paint visible. Window widths, subdivisions and colour choices
are estimates. Storey counts for the four Gesundbrunnen fronts come from
retained OpenStreetMap records.

| Ortsteil | Retained street fronts | Source owners |
| --- | --- | --- |
| Wedding | Liebenwalder Straße | `DEBE01YYK0003uW3`, `DEBE01YYK0003ygv`, `DEBE01YYK00041mg`, `DEBE01YYK00047Bf` |
| Gesundbrunnen | Badstraße | `DEBE01YYK000439H`, `DEBE01YYK00044Qz`, `DEBE01YYK00047Ri` |
| Gesundbrunnen | Buttmannstraße | `DEBE01YYK0003ya6` |

The four Wedding fronts replace their earlier generic V188 pane and accent
triangles through the existing packet transaction. The other four have intact
source walls and receive new fittings. Their retained OSM apartment polygons
matched the LoD2 footprints with at least 97% overlap by intersection over
union. The compiler checks each actual Drawn wall and independent cardinal
Native span, and respects the earlier mapped entrance apertures. The measured
building bodies, roofs, courts and pedestrian navigation retain their original
words.

The official [Wedding district profile](https://www.berlin.de/ba-mitte/politik-und-verwaltung/service-und-organisationseinheiten/sozialraumorientierte-planungskoordination/bezirksregionen/artikel.1621663.php)
documents the area's Gründerzeit stock and later housing. The
[Landesdenkmalamt's Gesundbrunnen ensemble description](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030159)
records the development of Badstraße and the varied perimeter facades along
Buttmannstraße. These references describe the streetscape. OpenStreetMap
provides the mapped street alignments and residential records under [ODbL](https://www.openstreetmap.org/copyright).

The [source selection](../geo_data/regierungsviertel/wedding-gesundbrunnen-fronts-v340-source.json)
retains the original residential polygons and tags. The
[receipt](../geo_data/regierungsviertel/wedding-gesundbrunnen-fronts-v340-receipt.json)
records eight owners, 185 Drawn window groups and 149 Minecraft window groups.
The four lazy recipes use the existing packet and rendering budgets. The
new triangle buffers add 4,850 Drawn and 3,950 independent Native triangles.

Repeat the byte and admission checks from the repository root.

```sh
uv run --no-sync python -m scripts.build_wedding_gesundbrunnen_fronts_v340 --check
bun --bun test src/app/tests/wedding-gesundbrunnen-fronts-v340.test.ts
```
