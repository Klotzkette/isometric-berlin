# Hauptbahnhof forecourt paving — V354

The actual candidate view showed large green raster rectangles on the paved
Hauptbahnhof forecourts. This bounded correction paints only the corresponding
existing ground surfaces. It adds no triangles, instances, textures, heights,
navigation records or new coverage. Original ground arrays and source files
remain intact, including every existing road, planted area and authored detail.

## Complete source owners

The current official Berlin ALKIS WFS was read on 16 November 2026, in
EPSG:25833, within eastings 389250–389550 and northings 5820350–5821050.
The retained receipt contains the full returned geometry and properties of
the three selected owners, all local official vegetation polygons, two mapped
paving owners from the retained 13 November OSM extract and the preceding
core green surfaces. Polygon rings and holes are preserved.

| Owner | Meaning | Treatment |
|---|---|---|
| `DEBE01YYK0003sLP` | Washingtonplatz, `AX_Platz` | Intersected with OSM pedestrian relation `10726692`, preserving its holes and western grove |
| `DEBE01YYK0003sQ2` | Europaplatz Süd, `AX_Platz` | Existing hardscape only |
| `DEBE01YYK0003sOJ` | Adjoining northern station apron, `AX_Strassenverkehr` | Existing grass/brick fallback paint only; asphalt remains untouched |
| OSM relation `20783801` | Europaplatz north, mapped concrete surface | All six source holes preserved |

The [construction engineer's Washingtonplatz record](https://www.voessing.de/de/projekte/washingtonplatz-am-hauptbahnhof-berlin--endausbau~pr612)
documents schlesischer Granit, approximately 6,000 m² of slabs and 9,000 m² of
small setts, plus the western tree grove. These reported construction totals
are context, not the area of this mask. Its pale neutral stone colours are
explicit display estimates; no surveyed joint pattern is claimed.

The [official Europaplatz Süd programme](https://www.berlin.de/sen/bauen/baukultur/berliner-plaetzeprogramm/europaplatz-sued-1567894.php)
and [2026 construction notice](https://www.berlin.de/sen/stadt/presse/pressemeldungen/pressemitteilung.1637393.php)
distinguish the ongoing redesign from the existing station forecourt. This
pass does not portray its proposed trees, furniture, new paving pattern or
cycle facilities as completed. Existing authored temporary work areas remain.

After subtracting all protected vegetation, the Drawn mask is 21,392.076 m².
20,806.843 m² of old grass/brick source paint falls within it; this is a source
intersection measurement, not a claim that every square metre is visible.
Native independently admits exactly 1,100 original 4 m cells wholly contained
inside the same hardscape, totalling 17,600 m². Boundary cells crossing a
planted hole are not recoloured.

## Runtime and validation

Only factory-marked `Drawn ground slabs` and `Voxel ground runs` qualify.
The shader retains earlier hooks and changes only the original grass/brick
palette on upward ground faces within the fixed local masks. All polygon
tests follow a station-local bounding-box rejection; there is no frame-loop
traversal, terrain rebuild or new allocation proportional to city geometry.
Day/night materials, Worker restoration, mode clones and existing GPU program
retirement are supported. Actual disposal ends finish inheritance.

Independent Python checks reconstruct the complete source-mask difference,
verify source hashes and prove the exact Native cell subset. Four Bun tests
check the real shader composition, preserved buffers, planted/outside samples,
Worker roundtrip, clone behaviour and disposal. Final browser verification is
performed by the release integration, rather than inferred from these tests.

No other nearby plaza was changed without equally specific source evidence.
