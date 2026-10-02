# BND headquarters public exterior, v1.0.74

This step-10 refinement covers the publicly visible headquarters at Chausseestraße, its two gatehouses and the public visitor centre at **Chausseestraße 99a**. It adds the missing stepped silhouette, closely spaced vertical window rhythm, shallow aluminium fins, travertine gatehouse treatment and the red-brown brick visitor-centre facade. No interior room arrangement, operational installation or security system is modelled.

## Complete source preservation and the height conflict

The committed Alt-Mitte packet `source-389_5821-00.json.gz` remains unchanged. Its SHA-256 and all original polygons are recorded in `bndHeadquartersV174Evidence.json`. The four retained owners contain **235 original boundary surfaces**:

| Existing owner | Original surfaces | Treatment |
| --- | ---: | --- |
| `DEBE00YY1tw0009x` | 179 | Complete main/north-complex base and all ten courtyard holes remain |
| `DEBE00YY1tw0009m` | 42 | Complete southern/visitor building remains at its original 25.853 m height |
| `DEBE00YY1tw000BJ` | 8 | Existing small street-side part remains |
| `DEBE00YY1tw000Av` | 6 | Existing small street-side part remains |

There are **no replacement owners, source-column exclusions or removed source roofs**. The main building's 2026-03-02 LoD2 record is unusually coarse: one flat roof, `measuredHeight=13.086`, and scene elevation 18.286 m across the complex. This is inconsistent with the publicly photographed stepped building. The [architect's supplied project profile](https://www.baunetz-architekten.de/kleihues-kleihues/31527/projekt/6041574) publishes a 30 m overall height, while [Kleihues + Kleihues](https://kleihues.com/dienstgebaeude-und-zentrale-des-bundesnachrichtendienstes-berlin/) describes the shared facade rhythm and the two street-side gatehouses.

Five **mapped OSM exterior parts** therefore add upper surfaces above the existing 18.286 m roof. Each polygon is clipped to the official footprint and courtyard holes; overlapping mapped parts are resolved in descending elevation order. The complete source base stays underneath. No uniform increase is applied to the complex.

| Mapped exterior part | Upper scene elevation | Height provenance |
| --- | ---: | --- |
| [Central bar, way 753509500](https://www.openstreetmap.org/way/753509500) | 35.2 m | Published 30 m maximum above retained 5.2 m site datum |
| [Comb wings, relation 10383346](https://www.openstreetmap.org/relation/10383346) | 31.2 m | 26 m display estimate below the published maximum |
| [North gatehouse, way 107166432](https://www.openstreetmap.org/way/107166432) | 22.2 m | 17 m display estimate; mapped lower part hierarchy |
| [South gatehouse, way 107166438](https://www.openstreetmap.org/way/107166438) | 22.2 m | 17 m display estimate; mapped lower part hierarchy |
| [North-eastern wing, way 107166440](https://www.openstreetmap.org/way/107166440) | 22.2 m | 17 m display estimate; mapped lower part hierarchy |

OSM lists eight levels for the comb and ten for the central bar, while the architect lists nine overall. The evidence file records this discrepancy. OSM fixes their plan geometry and relative hierarchy; it is not presented as a height survey. The source podium's broad roof remains visible wherever no mapped upper part exists, so its simplified lower geometry is a documented remaining limitation.

## Facades and public entrance

The architect's material schedule distinguishes anodised aluminium from Zwiefalten travertine. These become geometry colours and shallow exterior members. The [BBR's public building record](https://www.museum-der-1000-orte.de/bauwerke/bauwerk/zentrum-fur-aus-und-fortbildung-und-besucherzentrum) supports the six-storey red-brown clinker character of the southern building. [The visitor centre's public page](https://www.bnd.bund.de/DE/Besucherzentrum/bnd-besucherzentrum-node.html) and OSM node `8641738412` identify its street address and public entrance area.

Facade subdivisions use measured exterior planes and mapped upper boundaries. A 0.18 m cladding sheet covers the earlier generic window *estimate*, without removing source surfaces or ownership. Narrow dark panes, shallow frames, floor joints and projecting vertical fins establish the constant rhythm. Panes are clipped at the original source roof seam, avoiding an invented blank floor. The lower gatehouse proportions use mapped exterior outlines. The visitor-centre marker is projected to the nearest source facade and uses a bounded plain-letter name band and door surround; its exact member sizes are display estimates, not surveyed construction details. All gate, entrance, window, cladding and colour values remain explicitly separated from measured geometry.

## Rendering and integration

`BndHeadquartersV174.ts` exports `createBndHeadquartersV174` and `createMinecraftBndHeadquartersV174`. Both accept the existing optional `mobileLike` argument and deliberately return the identical static detail on touch and pointer devices.

The drawn form has **two batches**, 1,335 triangles in the upper/cladding sheets and 50,410 facade instances plus 493 small lettering blocks: **4,013,456 GPU bytes**. Minecraft uses **one independent orthogonal batch**, 23,687 total instances and **1,800,860 GPU bytes**. Its upper walls and roofs are one-metre surface cells merged into lossless horizontal runs; there is no hidden solid infill. It has no smooth clone. No photograph or runtime texture is loaded in either branch.

The renderer is lazy. The budget imports a small named JSON export with a pure initializer, so unused model imports do not retain its default render payload in the geometry worker. A real production-bundler regression keeps that unused import below 8 KiB with no JSON decoding; the integrated worker remains 13,736.28 kB, below its unchanged 16 MiB limit. Offline-generated numerical render-budget metadata reads neither branch on import; a fresh-process getter audit proves the drawn factory does not read native arrays and the native factory does not read drawn arrays. `bndHeadquartersV174Profile.ts` imports only the **5,921-byte navigation payload**, not render arrays. It exports:

- `BND_HEADQUARTERS_V174_PARTS`: five additive upper collision/roof polygons, including source-clipped holes.
- `bndHeadquartersV174RoofAt(x,z,minecraft)`: mapped roof support; the native branch samples the same one-metre cells as the actual roof skin and returns the quantised top.
- `bndHeadquartersV174SolidAt(x,z,y,minecraft)`: only the added upper occupied envelope. Existing Alt-Mitte navigation still owns the original lower source mass.

Integration must retain every existing owner and native source column. Add the drawn factory to the existing lazy detail group, add the native factory only to Minecraft, and use the five upper parts/roof callback for movement. The original 93-place catalogue is unchanged.

## Inspected free visual references

These photographs were inspected at 1,280 px on 2 October 2026. All three are non-bundled visual references; their pixels, artwork and logos are not included in the model. Per-file credits are retained in the evidence and both source/public Wikimedia attribution manifests.

| Photograph | Credit and licence | Visible features inspected |
| --- | --- | --- |
| [Zentrale des Bundesnachrichtendienst, Berlin.jpg](https://commons.wikimedia.org/wiki/File:Zentrale_des_Bundesnachrichtendienst,_Berlin.jpg) | Jan Kleihues; Stefan Müller, photographer — [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Travertine street gatehouses, recessed entrance and aluminium facade rhythm |
| [2019-08-30 BND Zentrale Berlin OK 0335.jpg](https://commons.wikimedia.org/wiki/File:2019-08-30_BND_Zentrale_Berlin_OK_0335.jpg) | [Olaf Kosinsky](https://kosinsky.eu) — [CC BY-SA 3.0 Germany](https://creativecommons.org/licenses/by-sa/3.0/de/) | Rear facade's continuous vertical panes and blind metal fields |
| [2019-08-30 BND Zentrale Berlin OK 0317.jpg](https://commons.wikimedia.org/wiki/File:2019-08-30_BND_Zentrale_Berlin_OK_0317.jpg) | [Olaf Kosinsky](https://kosinsky.eu) — [CC BY-SA 3.0 Germany](https://creativecommons.org/licenses/by-sa/3.0/de/) | Public building-name placement and travertine character |

The other primary public reference is the [BBR ensemble inventory](https://www.museum-der-1000-orte.de/liegenschaften/liegenschaft/zentrale-des-bundesnachrichtendienstes). Berlin geometry remains dl-de/zero-2-0; mapped OSM geometry remains ODbL 1.0.

Reproduce with `uv run python scripts/build_bnd_headquarters_v174.py`. Focused validation: Ruff, four Python tests in `tests/test_bnd_headquarters_v174.py`, six Bun tests in `src/app/tests/bnd-headquarters-v174.test.ts`, and the production build. The tests verify deterministic output, original packet hashes, all ten source courtyards, the bounded height correction, native surface occupancy, mode separation and identical touch detail.
