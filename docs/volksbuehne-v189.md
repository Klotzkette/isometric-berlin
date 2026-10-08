# Volksbühne and Räuberrad, v1.0.89

Pipeline step 10 adds one bounded recognition overlay at Rosa-Luxemburg-Platz.
It preserves all earlier city packets, source geometry, viewing distances,
residency limits and 93 tour stops. Day, Night, Snowstorm, Schwellenraum and
Flooded Berlin use the same full drawn detail on touch and pointer devices;
Minecraft receives its own orthogonal geometry.

## Metric ownership and retained evidence

The Volksbühne is Berlin LoD2 owner `DEBE01YYK00001YG` from
[`LoD2_392_5820.zip`](https://gdi.berlin.de/data/a_lod2/atom/LoD2_392_5820.zip),
licensed dl-de/zero-2-0. Its 75 original ground, wall and roof sheets are retained
in `geo_data/regierungsviertel/volksbuehne-v189-source.json`, alongside the
archive SHA-256. The authoritative footprint keeps its complete 60-vertex
exterior and both small rear holes. The building is independently associated
with OSM theatre `relation/5746884` and POI `node/2627106420`; OSM and official
polygons remain separate evidence. The existing parent is already owned by the
`5_-2` surrounding-city packet and its prior detailed source was preserved by
v168. Nothing in that packet is rewritten by this generator.

Source heights are 35.866–56.430 m NHN, translated to the established ground
`y=3` and roof `y=23.564`. The committed LoD2 has a uniform flat envelope, whereas
photographs show a stepped front, auditorium drum and stage volume. The explicit
source conflict is retained in both evidence and runtime metadata. This bounded
refinement preserves the delivered source envelope; it does not claim to have
surveyed or reconstructed a different roof profile.

The Räuberrad keeps exact retained OSM `node/2856686321`, world position
`[2733.036486813391, -775.1956612048671]`, and the same ground datum `y=3`.
Its OSM tags explicitly say `material=steel` and `start_date=1994`. The work is a
rust-brown steel construction, not bronze. The source is the retained
[29 September 2026 Geofabrik Berlin extract](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf),
ODbL-1.0. Its location remains over 32 m from the theatre footprint.
The nearby narrow residential owner `DEBE01YYK0000BEC` is unrelated and retained.

## Recognition and limits

[Thomas Martin's theatre account published by Berlin](https://www.berlin.de/aktuell/ausgaben/2015/juni/berliner-ereignisse/die-volksbuehne-am-rosa-luxemburg-platz-306988.php)
identifies the curved limestone front, six Muschelkalk columns and post-war flat
roofs. The [Berlin monument list](https://www.berlin.de/landesdenkmalamt/_assets/pdf-und-zip/denkmale/liste-karte-datenbank/dm_liste.pdf)
records heritage object `09080037`, the 1913–14 Oskar Kaufmann building and
1952–54 Hans Richter reconstruction.

Thin limestone facing follows the actual source edges of the front. It masks
the generic residential window pattern there while retaining every old source
sheet beneath it. The new front has six round shafts with separate grounded
bases and capitals, five tall foyer/door fields, quiet stone courses, shallow
cornices, blank red banner fields and the procedural `VOLKSBÜHNE` inscription.
Existing side detail remains; only a narrow source-aligned roof-edge member
continues around the building. The exact number of columns is documented;
individual column sections, foyer subdivisions, stone joints, lettering size
and banner dimensions are visual estimates. No temporary show poster or
historical `OST` roof sign is copied.

The Räuberrad uses a broad **flat rectangular steel plate section**, a hollow
ring, six real spokes and six open sectors. Its two slightly slanting legs end
in asymmetric feet pointing in the same direction. There is no added plinth,
solid disk or tubular torus. The independently authored display profile is
4.08 m high, with a 2.92 m ring diameter and 0.20 m plate depth. These dimensions,
small sections, alignment and foot proportions are reference-based estimates,
not a surveyed footprint. Only the OSM point is a metric map anchor. The
[architectural account by Jeanette Kunsmann](https://jeanettekunsmann.com/2020/01/08/die-rauber/)
also describes a roughly four-metre metal work. Design is credited to
**Bert Neumann (1990)** and fabrication to **Rainer Haußmann (1994)**.

## Inspected freely licensed photographs

Both photographs were opened and visually inspected before authoring. Credits
are isolated in `volksbuehne-v189-credits.json` for integration into both shared
Wikimedia manifests. No photo, crop, graffiti, sticker, font file or texture is
bundled or loaded by the viewer.

| Photograph | Photographer and selected licence | Observed use |
|---|---|---|
| [Berlin-Volksbuehne am Rosa-Luxemburg-Platz-08-2016-gje.jpg](https://commons.wikimedia.org/wiki/File:Berlin-Volksbuehne_am_Rosa-Luxemburg-Platz-08-2016-gje.jpg) | Gerd Eichmann, 12 March 2016, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Front curvature, six columns, tall glazing, stone tone, signage placement, frontal steel wheel silhouette |
| [Berlin Rosa-Luxemburg-Platz lub 2025-11-29 img03 Räuberrad.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Rosa-Luxemburg-Platz_lub_2025-11-29_img03_R%C3%A4uberrad.jpg) | Lukas Beck, 29 November 2025, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Rear close view: flat steel depth, six apertures, angled legs, both same-direction feet and dark rust material |

## Bounded runtime and verification

`createVolksbuehneV189(native=false)` plugs into the existing lazy local-family
lifecycle. It sets `dayMaterial`/`nightMaterial`, computes complete local bounds,
keeps frustum culling enabled, and freezes static matrices. Final-count buffers
are allocated directly. There is no new camera radius, resident budget,
listener, texture, timer, animation or separate mobile drawn profile.

| Representation | Renderables | Instances | Rendered vertices | Geometry and instance bytes |
|---|---:|---:|---:|---:|
| Drawn, all profiles | 3 | 1,254 | 33,552 | 173,688 |
| Minecraft | 2 | 1,547 | 37,128 | 118,868 |

Native facade pieces are independent unrotated surface blocks; the wheel uses a
small deterministic silhouette grid with all six openings and the gap between
its legs preserved. It carries no smooth geometry double or hidden solid fill.
The original source building continues to supply its established navigation;
no surrounding path or plaza is enclosed by this overlay.

Reproduce:

```bash
uv run python scripts/build_volksbuehne_v189.py
uv run pytest tests/test_volksbuehne_v189.py -q
cd src/app
bun test tests/volksbuehne-v189.test.ts
```

The Python tests compare all 75 converted official sheets against the previously
committed v168 parent, normalizing only repeated ring-closing vertices. They
check both holes, exact OSM identities and anchor, source datum, source hashes,
deterministic runtime output and individual free-licence records. Bun tests
raycast the actual drawn and native meshes through all six wheel sectors and
spokes, both legs and feet; verify grounded bases and contiguous column shafts;
and enforce exact-capacity, image-free buffers, bounded culling and orthogonal
native matrices. Three Python tests and three Bun tests pass.

Useful front camera: target `[2748,13,-811]`, eye `[2690,27,-694]`.
Useful wheel camera: target `[2733,5,-775]`, eye `[2726,7,-761]`.
Integrated visual review and release lifecycle checks are recorded separately by
the release integrator.
