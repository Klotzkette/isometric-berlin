# Zoo Palast — v260 additive recognition

Step 10 refines only the retained Zoo Palast owner `DEBE00YY1EZ0000h`
(OSM way `23010077`). All seven official parts, original roof/wall polygons,
v166 glazing, curved lettering and relief studs remain unchanged. The new
extract records the original source SHA-256, 22 selected wall polygon IDs and
exact facade vertices; the generator reads but never rewrites the v166 source.

The official [Landesdenkmalamt conservation account](https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/zoo-palast-641132.php)
documents the preserved original street facade. Its [exterior photograph](https://www.berlin.de/imgscale4/rbig2zu1/landesdenkmalamt/_assets/bilder/denkmalpflege/erkennen-erhalten/industriebauten/oeff_zoo_palast01_titel.jpg)
and [restored facade detail](https://www.berlin.de/landesdenkmalamt/_assets/bilder/denkmalpflege/erkennen-erhalten/industriebauten/zoo_palast07_fassade.jpg)
were inspected on 21 October 2026. The exterior is credited to Landesdenkmalamt
Berlin and the detail to Wolfgang Bittner / Landesdenkmalamt Berlin. They remain
reference-only; no photograph, crop, texture or protected plan is shipped.

The addon introduces narrow ceramic joints, collars around the existing brass
studs, a thin metal coping, three vertically stacked portholes on the actual
short right-hand auditorium return, the dark low entrance fascia and canopy
edge, brass entrance divisions and four abstract framed programme cases.
The short return is exposed in front of the retained side annex; its long
neighbouring wall would place the portholes inside the annex. Facade planes and
heights follow the measured source; small divisions, fixture placement, colours
and porthole dimensions are reference-guided display estimates. No broad facade
plane, roof or measured shell is replaced. Historical ZOOBA lettering visible
in the reference is not asserted as a current tenant, and the programme cases
carry no invented movie title, artwork or date. Existing curved ZOO PALAST
lettering remains visible and unmodified in the drawn model.

Native construction has separate axis-aligned fittings and square porthole
frames. Its local source occupancy extract places fittings outside the retained
two-metre shell rather than burying them within source blocks. A separate
orthogonal ZOO PALAST inscription follows the same source facade; the prior
native lettering remains retained. Mobile and desktop use identical full
geometry. The addon has no textures, frame loop, navigation alteration, source
suppression, coverage extension, tour change or residency-limit increase.

Integration exports in `src/app/src/ZooPalastV260.ts`:

- `createZooPalastV260(options?)`
- `createMinecraftZooPalastV260(options?)`
- `ZOO_PALAST_V260_BOUNDS`: X `[-2594,-2550]`, Z `[1368,1404]`, Y `[5.2,30]`

The drawn root is two submissions, 828 box instances and 270,936 stored geometry
and instance bytes. The native root is one submission; its local budget is
130,000 bytes. Both roots freeze static transforms and use the established
day/night material conventions. The source anchor JSON is small and does not
import the complete City West source into a second runtime module.

Checks: exact v166 source hash, polygon/vertex and original stud identity,
reproducible extraction, exact native occupancy subset, positive finite fitting
dimensions, local bounds, orthogonal native matrices, geometry byte limits and
full mobile parity. Both families were visually inspected in Safari together
with the retained complete v166 model. The source envelope's roof and foyer
proportions stay authoritative even where the historical photograph differs.

```sh
uv run python scripts/build_zoo_palast_v260.py
uv run pytest -q tests/test_zoo_palast_v260.py
cd src/app
bun test tests/zoo-palast-v260.test.ts
```
