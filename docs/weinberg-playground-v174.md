# Weinbergspark blue rubber surface — v1.0.74

The blue rubber play area replaces the uniform sand-coloured reading locally.
The complete v166 park, equipment, mapped sandpits, sports courts and paths
remain rendered. The added surface is one small texture-free batch in drawn
modes and one independently row-merged native-block batch in Minecraft.
There is no lower-detail touch variant.

The material boundary is a visual estimate from the official Berlin
spring-2025 orthophoto, clipped to OSM playground way `49217749`, the existing
source-cut playground ground and the complement of four separately mapped
sandpits and two sports pitches. It covers 182.17 m². The colour is a visual
approximation; the 2.5 cm display offset prevents coplanar flicker and is not
a surveyed elevation. This correction does not claim surveyed rubber relief.

Sources:

- [Atelier Van Geisten, Spielplatz am Weinbergsweg](https://www.van-geisten.de/Projekte/Spiel%20und%20Freizeit/Spielplatz%20am%20Weinbergsweg/): distinct wave landscape and sand areas. No protected plan was traced.
- [Bezirksamt Mitte refurbishment description](https://www.berlin.de/ba-mitte/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/planung-entwurf-neubau/spielplatz-weinbergsweg-1373898.php): renewal of impact-absorbing surfaces and equipment.
- Geoportal Berlin, DOP 2025 spring, dl-de/zero-2.0: WMS `https://gdi.berlin.de/services/wms/dop_2025_fruehjahr`, layer `dop_2025`, EPSG:25833 bbox `391615,5821460,391740,5821570`, 1000 × 880 pixels. Reproducible material-edge pixel picks are stored in the source JSON and generator.
- [Volkspark spielplatz 2024.jpg](https://commons.wikimedia.org/wiki/File:Volkspark_spielplatz_2024.jpg), Traktorminze, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), 6 June 2024: inspected reference for blue rubber alongside retained sand. Reference-only, not bundled or used as a texture.

Rebuild: `uv run python scripts/build_weinberg_playground_v174.py`.
The spatial regression verifies that no mapped sandpit or sports pitch is
painted blue by this overlay and that drawn triangle area matches the clipped
polygon. The original v166 source data are unchanged.
