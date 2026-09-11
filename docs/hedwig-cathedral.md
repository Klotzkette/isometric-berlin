# St Hedwig’s Cathedral at Bebelplatz

Pipeline step 10. The bounded source supplement retains parent
`DEBE01YYK00000AQ` from Geoportal Berlin tile `391_5819` (2026-03-02), with
all original wall/roof surfaces and the original OSM fallback `58608090`.
Source ground is 4.107 m in the viewer; the full envelope reaches 39.727 m,
35.620 m above its source base. The prior 18 m fallback was not a measured height.

The main circle is fitted to exact source ground points: centre
`[1580.023723,382.710048]`, radius 19.490272 m. The rear circle is centred at
`[1594.434878,405.819831]`, radius 8.56 m. The original generalized pitched
roof planes remain evidence; two curved green copper domes replace their display.
Eaves, rear dome top, panel seams and intermediate subdivisions are procedural
interpretation bounded by the retained plan and overall height.

The [official cathedral history](https://www.hedwigs-kathedrale.de/kathedrale/geschichte/)
and these inspected external photographs guide the two copper domes, low cap,
ring cornices, arched windows, six-column entrance and pediment:

- Bahnfrend, [2024 exterior](https://commons.wikimedia.org/wiki/File:St._Hedwig%27s_Cathedral_(Berlin),_2024_(01).jpg),
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Yair Haklai, [2019 exterior](https://commons.wikimedia.org/wiki/File:St._Hedwig%27s_Cathedral_(Berlin)_-_Exterior.jpg),
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

No photograph or texture is bundled. The main dome uses 84 angular segments and
fourteen curved bands. Subtle copper-coloured seam lines avoid a dark wire cage;
the curve keeps all of its polygons. Portico reliefs are small abstract facets,
not claims of exact sculptural likeness. Walking support follows the curved
silhouette and pediment rather than the old generalized source roof.

The drawn model has four static renderables, fewer than 650 KB of attributes,
and no per-frame work or texture allocation. Minecraft uses one separate
surface-block batch without solid interior infill. Its small blocks interpret
the same two domes and entrance. Focused tests verify source identity, envelope,
outward winding, actual triangle/roof-support agreement, finite buffers and
bounded geometry. The city’s existing lighting, mode and disposal policies apply.
