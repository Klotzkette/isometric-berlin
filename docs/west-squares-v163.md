# West squares — v1.0.63 source review

Step 10 adds Ernst-Reuter-Platz, Wittenbergplatz and KaDeWe recognition detail.
All four drawn modes and pointer/touch devices construct the same complete
static geometry. Minecraft uses separate axis-aligned block surfaces. No
photograph, font, texture, external image request or per-frame work is added.

## Metric anchors and source ownership

- Ernst-Reuter-Platz: OSM square way `495732599`; fountain ways `4598245`
  (large) and `42023136` (small). Exact mapped grass/paving boundaries from
  relations `7146579`, `4717303`, `6152712` and ways `411717025`, `411717032`
  retain their holes and every ring vertex. The existing street network stays
  intact; this adds raised edges and the island's surface reading.
- Eight current OSM bench nodes `13816183698`–`13816183700` and
  `13816189401`–`13816189405` supply positions. Their three-seat, backless wood
  semantics come from OSM. Dimensions and orientation are display estimates.
  The older monument inventory mentions 17 benches; the model does not invent
  coordinates for the nine absent from this map extract.
- Telefunken-Hochhaus: OSM way `40452037`, official Berlin LoD2 parent
  `DEBE04YY500005HS`, five parts retained from `LoD2_385_5819.zip`.
- KaDeWe: OSM way `60541581`, LoD2 parent `DEBE07YY900002p7`; its complete
  measured body comes from `LoD2_387_5818.zip`.
- Wittenbergplatz entrance building: OSM way `26369724`, LoD2 parent
  `DEBE07YY90000A5U`, three parts retained from `LoD2_387_5818.zip`.
- The memorial is exactly OSM node `7912441064`, at longitude `13.3426655`,
  latitude `52.5017923`, beside the west entrance. The two-post metal sign has
  all twelve place names in their photographed order. The photograph spells
  `Stutthof` with one final f; this corrects the OSM inscription's typo.
  The historical name `Maidanek` remains as written on the actual sign.

The two archive URLs and SHA-256 values are in the source payload. Berlin
LoD2 is dl-de/zero-2-0; the map evidence is the retained Geofabrik Berlin
extract of 29 September 2026 (ODbL 1.0).
Coordinates use x = easting − 389500, z = 5820000 − northing, ground y = 5.2 m.

Exactly four older core display prisms are replaced: `-5396409`, `-5396410`
(KaDeWe), `26369724` and `40452037`. Their full original records stay in
`westSquaresV163Source.json` and `westSquaresV163Navigation.json`. The
replacement renders all 190 official wall/roof surfaces and retains original
source surface rings for all nine parts. No surrounding-city packet is
modified by this generator. No unrelated building or road is removed.

## Published facts and interpretation

[Berlin's monument inventory, object 09046324](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046324)
records Werner Düttmann's 1959–60 island, about 120 m diameter, two basins
approximately 20 × 20 m and 30 × 40 m, 41 small fountains and a main fountain
up to 15 m. The model uses the exact mapped basin outlines rather than forcing
those rounded descriptive dimensions onto the source. Individual jet positions,
jet shapes and water colours are procedural interpretations; there are 25 + 16
small jets and one tall jet. The shallow water is represented at the public
space datum, distinct from the city's lower natural-water datum.

[KaDeWe's own history](https://www.kadewe.de/das-kadewe-die-geschichte/)
documents the 1907 building, reconstruction of seven floors by 1956, and the
1991–96 glass roof/restaurant addition. Its official LoD2 body is a single
flat 30.45 m envelope and does not resolve that glass vault. A labelled
recognition addition supplies the glazed half-barrel and ribs above the street
entrance. The cap's 8.2 m radius, 19 m depth and intermediate elevations are
visual estimates, not newly surveyed dimensions. The original flat source roof
is retained. All generated windows are clipped to real source wall polygons;
window pitch, mullions, canopy depth and entrance lettering are interpretive.

[The district's memorial record](https://www.berlin.de/ba-tempelhof-schoeneberg/_assets/politik-und-verwaltung/bezirksamt/beschluesse/2021/11-02/mzk-1524_xx-mahnmal-wieder-ins-zentrum.pdf)
documents the 1967 memorial and the intended visual relationship to KaDeWe.
The current mapped point and inspected west-entrance photograph anchor the
location/orientation. Fine sign dimensions are display estimates. Lettering
uses repository-native vector strokes, including umlauts, never image text.

## Freely licensed visual references

All were inspected, are reference-only, and must be mirrored in the global
Wikimedia attribution manifests by the integrator. No reference pixels ship.

| Reference | Author | Licence | Role |
|---|---|---|---|
| [KaDeWe front](https://commons.wikimedia.org/wiki/File:KaDeWe_front.jpg) | Gellerj (perspective correction Arch2all) | CC BY-SA 3.0 | Stone/window rhythm, entrance, glass vault |
| [U-Bahnhof Wittenbergplatz 0686](https://commons.wikimedia.org/wiki/File:U-Bahnhof_Wittenbergplatz_0686.jpg) | Dosseman | CC BY-SA 4.0 | West entrance, pale stone, green roof, pediment, columns, sign relationship |
| [Gedenktafel Wittenbergplatz (Schön) Orte des Schreckens](https://commons.wikimedia.org/wiki/File:Gedenktafel_Wittenbergplatz_(Sch%C3%B6n)_Orte_des_Schreckens.jpg) | OTFW, Berlin | CC BY-SA 3.0 | Two-post grey metal frame, gold text, factual destination order |
| [Brunnen Berlin-Charlottenburg, Ernst-Reuter-Platz, 1](https://commons.wikimedia.org/wiki/File:Brunnen_Berlin-Charlottenburg,_Ernst-Reuter-Platz,_1.jpg) | Manfred Brückels | CC BY-SA 3.0 | Shallow pool, stone rim, slender jets |

## Runtime and validation

- Drawn: seven mesh calls, 106,517 rendered triangles including 6,720 repeated
  window/frame instances. All static transforms freeze after construction.
- Minecraft: four block batches, 33,431 exterior/recognition blocks,
  401,172 rendered triangles. No smooth model is present in that mode.
- Source payload: 810,652 bytes; navigation: 83,440 bytes (before any extra
  manifest metadata). The source archive downloads remain ignored raw data.
- Nine Bun tests / 4,436 assertions validate unchanged source triangles, ownership,
  complete identical mobile geometry, exact source identities, native roof cells,
  legacy-column height matching, native-only
  batches, no textures, and bounded draw calls. Two Python tests validate
  source-clipped window subdivision and the exact replacement set.
- `bun x tsc --noEmit` and targeted Ruff/Python checks pass.
- Browser framing and final integration are performed by the release task.

Reproduce with `uv run python scripts/build_west_squares_v163.py` after placing
the two official ZIPs and existing OSM cache/PBF in their ignored raw paths.
