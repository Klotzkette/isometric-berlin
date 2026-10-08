# Northern city coverage v1.0.90

The requested northern extension uses OSM administrative level 10 relations
407712 (Pankow), 407713 (Prenzlauer Berg) and 408308 (Weißensee), together
24.658 km². All four previous coverage polygons are subtracted exactly,
leaving **13.584 km²**, 84 new independent 512 m cells and 9,278 building records.
This interpretation covers the connected neighbourhoods through Weißensee;
it does not include the entire administrative Bezirk Pankow through Buch.

`build_north_city_v190.py` reuses the existing source exporter. Every available
LoD2 footprint and height envelope, otherwise full OSM footprint and tagged
height/levels, is retained. Missing heights and street widths are labelled
estimates; ordinary new terrain uses the established flat baseline. Colours
are restrained display choices, not a photographic facade survey. Parks,
water, courtyards and unbuilt land stay open. The seven complete source owners
at the Weißensee cemetery hall replace only their exact overlap in one new cell.
The inventory and navigation are retained.

Every previous cell descriptor and footprint remains unchanged by this append.
Other v190 site/terrain changes have separate exact-owner or altitude receipts.
Each new cell has its own lossless drawn and independently native Minecraft
packet. Serial request concurrency, decode and resident-memory budgets are unchanged.
The navigation envelope and ground scope include the addition before cells load,
so a mode change does not teleport a walker out of the new neighbourhoods.

Sources: retained Geofabrik Berlin 2026-09-29 (ODbL-1.0); Berlin official LoD2
(dl-de/zero-2-0). Full archive hashes and source inventories accompany the manifest.
