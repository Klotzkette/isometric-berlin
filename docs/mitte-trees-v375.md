# Trees in Tiergarten and central Mitte

The released park file already contains a tree at every municipal catalogue coordinate in the two arrival views, within 5 cm. Its full geometry was published only after city construction and first-upload parking. In the v254 mobile WebKit check, the park request had still not started 95 seconds after the city was ready. The Berlin manifest now publishes the two tree stands at startup using the same botanical forms, dimensions, bark colours, crown meshes and instance matrices as the full drawn park.

| World X/Z bounds (m) | Municipal catalogue points | Existing park trees, all sources |
| --- | ---: | ---: |
| Eastern Tiergarten, X 5…445, Z −50…300 | 228 park and 78 street trees | 483 |
| Robert-Koch-Platz, X 425…575, Z −1100…−945 | 30 street trees | 39 |

The height of the 26 m horse chestnut at X 502.99, Z −1012.49 and its 18 m crown diameter come from the municipal register. For existing OpenStreetMap trees, the renderer retains the dimensions and botanical information of the original park file, including its display estimates.

The expanded 1.9 × 2.1 km survey covers 7,618 municipal points. The baker found 190 points beyond the old tree matching radius of 3 m. It preserves 141 additional positions with a measured trunk circumference, crown diameter and tree height. It checks the old park inventory, the separate Mitte heritage trees, dated building footprints, streets, paths and water. Ambiguous neighbouring records are excluded. The native 4 m grid has 105 previously empty cells where the whole square trunk footprint also clears those masks. The existing block-tree presentation selects 53 desktop and 25 mobile additions. Each new block shares the existing trunk and crown draws.

The drawn floor height at each tree is independent of the measured botanical height. Vertical intersections with actual ground, lane, path and lawn geometry produced ground contacts for 513 of the 522 existing trees in the two views. The nine ambiguous positions retain their original datum. At 81 positions the first ground slab lies below the later park surface. One instanced batch extends the exposed root down to that slab while every crown remains at its final position. The complete park replaces the early stands in one transaction, releases their geometry and keeps the live collision index free of duplicate source IDs.

The compact source survey (EPSG:25833), ground intersections and offline baker are retained alongside the model. The two original inventory layers are published by Geoportal Berlin under dl-de/zero-2-0. [Berlin municipal tree inventory, WFS capabilities](https://gdi.berlin.de/services/wfs/baumbestand?service=WFS&request=GetCapabilities)

To regenerate the viewer packet from the frozen sources run `python scripts/build_mitte_trees_v375.py`. To refresh the two bounded official inventories run the same command with `--capture`.
