# North-Mitte existing street fronts — v1.0.139 / Step 10

This bounded pass makes existing openings more readable along Torstraße,
Linienstraße, Koppenplatz, Gipsstraße/Steinstraße (Gipsdreieck), Fehrbelliner
Straße, Veteranenstraße and the Choriner/Zehdenicker junction. It adds stone
heads and sills, a thin reveal highlight and two restrained upper glazing
reflections. It does not repaint whole facades or alter their existing windows.

## Evidence and preservation

The finite road selection comes from the retained OSM
`alt-mitte-edges-v186-streets.json`. Choriner Straße is clipped to the requested
junction/block rather than followed into a different neighbourhood. Only fronts
within 26 m of those mapped routes, facing the route and with an unobstructed
approach through retained building footprints, qualify.

Ordinary openings are replayed from the original v166/v168/v169 source recipes.
Each candidate must match **both exact centimetre-quantized triangles** in the
currently delivered old packets. This avoids inventing or shifting a new window
grid. The source snapshot records every matched quad, original wall, exact owner,
road identity, triangle fingerprint and existing v176 rigid terrain offset.
Twelve immutable packet SHA-256 receipts and sixteen input receipts establish
that earlier geometry is unchanged. Unmatched candidates remain unmodified and
are counted explicitly. The separately handled Delivery Hero, Leo-Baeck and
Google owners are excluded from this pass.

| Existing street frontage | Matched existing panes |
| --- | ---: |
| Torstraße | 1,999 |
| Linienstraße | 1,466 |
| Steinstraße | 614 |
| Fehrbelliner Straße | 489 |
| Veteranenstraße | 284 |
| Zehdenicker Straße | 231 |
| Choriner Straße | 226 |
| Gipsstraße | 208 |
| Koppenplatz | 130 |

There are 5,647 verified ordinary panes on 265 retained source owners. The
separate twenty Choriner Höfe panes replay the distinct existing v185 register
of `DEBE01YYK00005YZ`; its v230 stone joints, entrance cues and source roof edges
remain intact. The existing v176 terrain offset is applied exactly once.
[Haas Architekten](https://www.haas-architekten.de/projekte/wohnbauten/choriner-hoefe)
and [Collignon Architektur](https://www.collignonarchitektur.com/de/projekte/choriner-hoefe)
confirm that Choriner Höfe is a multi-building ensemble with varied masonry and
plaster, a set-back upper storey and a differentiated entrance. Those accounts
are architectural context; this pass does not assign an unsupported material
pattern, owner or new roof to an individual house.

Measured Berlin LoD2 planes and retained OSM streets remain authoritative.
Existing apertures are earlier procedural display estimates, not a facade
survey; matching them proves preservation, not photographic accuracy. New
material hues, reflections and fitting dimensions are also display estimates.
No photograph, photographic texture, protected plan or font is bundled.

## Bounded implementation

Run `uv run python scripts/build_north_mitte_fronts_v239.py`. The committed
bounded source is sufficient for replay. Initial extraction reads only retained
repository sources and current immutable packets. The builder does not edit
shared manifests, old packets, geometry, source navigation or runtime budgets.
It writes the descriptor addition for release integration.

Ten existing 512 m cells receive one mesh per representation. Both sets together
are approximately 3.65 MB compressed; the largest decoded packet is below
3.20 MB, inside the existing 4 MiB prefetch allowance. Drawn mobile uses the same
complete packets as desktop. Native details are independently stepped,
orthogonal surface panels, with no diagonal copied faces or smooth duplicates.

The split upper reflections occupy 22.2% of each existing pane and leave the
central mullion clear. Heads and sills are admitted only inside the original
measured wall polygon. No source shell, roof, court, doorway, terrain, road or
navigation solid is substituted; no new tour stop or district coverage appears.

Five focused tests verify all old triangle matches, unchanged sources/packets,
all nine street selections, unique opening anchors, the distinct Choriner
register, preserved mullion/glass area, orthogonal native faces and packet limits.
An offline spot inspection uses the retained Torstraße source walls and openings;
complete in-browser integration remains part of release QA.
