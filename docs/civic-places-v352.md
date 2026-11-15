# Civic and industrial places, V352

This finite refinement adds the previously absent Siemens Schaltwerk-Hochhaus and
two complete official building families of the Gillette factory. It does not
claim that every requested office, housing estate or garden has been rebuilt.
The broader audit below records the current identity and the unresolved geometry.
References were checked on 15 November 2026; their photographs have their own dates.

## Delivered geometry

| Host | Official parent | Parts | Public Drawn + Native bytes |
| --- | --- | ---: | ---: |
| `civic352-siemens-schaltwerk` | `DEBE05YYQ00001kM` | 20 | 416,473 |
| `civic352-gillette-factory` | `DEBE07YY90000174` + `DEBE07YY900007Wm` | 36 | 318,938 |

The four packets total **735,411 bytes**: 397 complete official source sheets,
1,080 source triangles, and 10,714 small source-clipped facade rectangles.
The final geometry contains 22,658 Drawn and 44,340 Native triangles. Each mode
uses its own building navigation and roof representation. Native is a separately
sampled, merged cardinal surface skin, not the smooth model rotated into cubes.

The authoritative input is `geo_data/regierungsviertel/civic-places-v352-source.json.gz`.
It retains every selected part, original ring, hole, wall and roof sheet, the
original official archive hashes and URLs, and the mapped identity evidence.
All 36 Gillette parts lie inside the independently mapped named factory site
`way/210080965`. The older OSM building subdivisions differ from the official
parent partitions; their individual partial overlaps are not disguised as exact
matches. The Siemens parent and mapped tower overlap by more than 98% in both
directions. Official Berlin LoD2 is dl-de-zero-2.0; OSM identity is ODbL-1.0.

The [Siemens/Berliner Zentrum Industriekultur photograph](https://industriekultur.berlin/ort/schaltwerk-hochhaus/)
supports clinker masonry, pale industrial window grids and the high brick end
towers. The [Berlin monument register](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055112)
supports Gillette's red clinker and natural-stone piers. The operator's
[September 2025 exterior photograph and current factory account](https://pgnewsroom.de/pressemeldungen/pressemitteilung-details/2025/Ein-starkes-Zeichen-fr-Innovation-und-Qualitt-Made-in-Germany-Der-Regierende-Brgermeister-Kai-Wegner-besucht-das-Gillette-Werk-in-Berlin-Tempelhof/default.aspx)
confirm that entrance material family and continued production. No reference
photo pixels, portraits, advertisements or invented tenant signs are distributed.
Window spacing, glass tone and small trim dimensions are recognition estimates,
not measured aperture surveys. Each complete rectangle must fit on its source
wall, including holes and a narrow edge margin. Outward winding is verified for
both source directions before Native sampling.

Each complete parent receives one disclosed vertical translation to the existing
3 m surrounding-city display datum. This preserves relative roof and wall heights;
it is not a claim to a new surveyed terrain model. The standard centimetre packet
codec collapses eleven sub-centimetre source slivers totalling 0.165 m². Their
original unquantized sheets remain in the source. Every non-degenerate quantized
source triangle survives with the same winding and multiplicity. No earlier
packet is changed by this refinement. The two touching Gillette parents are
packaged together and sampled jointly in Native. This gives their 18 shared
cardinal boundary cells one geometry/navigation lifetime: the union of all
14,785 occupied collision cells and every vertical collision interval is
unchanged from the independent parent derivation, while above-ground coplanar
duplicate area is zero. The new ground union is also identical. No independently
loaded sibling packet is needed to complete the common boundary.

## Current identity and unresolved geometry audit

| Requested place | Primary finding and V352 disposition |
| --- | --- |
| Autobahn GmbH | Current headquarters is **Heidestraße 15**, not its old Friedrichstraße address. [Current imprint](https://www.autobahn.de/impressum). Existing Europacity geometry remains; no unsupported facade branding is added. |
| DEGES | Current headquarters is the **Mosse-Zentrum, Zimmerstraße 54**. [Official locations](https://www.deges.de/standorte/). The nearby Mossehaus is not automatically the same physical tenant frontage. Existing press-quarter models remain. |
| Building/housing Senate, “Ferdinandplatz” | The agency lists **Württembergische Straße 6 / Fehrbelliner Platz 1**. [Official location](https://service.berlin.de/standort/123904/), [agency addresses](https://www.berlin.de/sen/stadt/ueber-uns/artikel.1246136.php). Fehrbelliner Platz is the evidence-based interpretation of the colloquial request, not a silently invented location. Existing V321 source-bounded and Native roofs remain. |
| Justice Senate near Rathaus Schöneberg | **Nordsternhaus, Salzburger Straße 21–25**. The agency describes travertine/marble and a postwar tiled replacement for the old copper roof. [Official building history](https://www.berlin.de/sen/justv/ueber-uns/historisches/gebaeude/), [monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066376). A stale OSM copper tag must not drive new paint. Existing authored models remain; precise roof-owner correction is still pending. |
| Federal justice ministry | Current public address is **Anton-Wilhelm-Amo-Straße 37**, formerly Mohrenstraße. [Ministry campaign legal notice](https://www.raus-aus-gewalt.de/datenschutzhinweis). Existing BMJV complete-source model, independent Native model and colonnade remain. No whole-quarter generic replacement is introduced. |
| DRV, Hohenzollerndamm | The architect reports **97.80 m**, aluminium facades and a completed 2018 renovation. [gmp project](https://www.gmp.de/de/projekte/681/deutsche-rentenversicherung-bund-am-hohenzollerndamm). The correctly located retained official parent `DEBE04YY50003Bls` spans the combined campus but has only **42.667 m** relative height. An independent search of all nearby official parents found no matching tall parent. This remains a real unresolved geometry discrepancy; a taller extrusion of the whole campus would be wrong. No such extrusion is shipped. |
| DRV, Ruhrstraße | A different campus, already represented by WestCivicV210. The [operator's 2026 modernization announcement](https://www.deutsche-rentenversicherung.de/Bund/DE/Presse/Pressemitteilungen/pressemitteilungen_aktuell/2026/2026-02-19-modernisierung-ruhrstrasse) concerns future phases. Those are not rendered as completed buildings. |
| Siemens Schaltwerk | Complete 20-part official tower is added. [Monument register](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09085701), [current cultural-site account](https://industriekultur.berlin/ort/schaltwerk-hochhaus/). Historic production use is distinguished from later office/training use. No future Siemensstadt Square development is invented. |
| Gillette | Complete 36-part official historic factory families are added; current production is confirmed by the operator. Separate mapped site containment, complete roof sheets and the current entrance photograph support the selection. Other buildings on the factory site remain outside this patch. |
| Former Berliner Verlag printing works | **Am Wasserwerk 11**, mapped `way/47395024`. The publisher reports printing ceased in 2024 and a proposed conversion. [Publisher's account](https://www.berliner-zeitung.de/article/neue-bauprojekte-in-lichtenberg-geplant-wohnungen-kita-und-rechenzentrum-2282847). Retain the physical industrial building; neither operating printing nor a finished data centre is asserted. A fresh, reliable facade survey is still missing. |
| Dahlem Botanical Garden, Großes Tropenhaus | The botanical garden documents **60 × 30 m**, **23 m clear height** and an external steel arch structure. [Garden description](https://bgbm-web.bgbm.fu-berlin.de/de/gewaechshaeuser/grosses-tropenhaus), [structural account](https://www.bgbm.org/tropenhaussanierung/besonderheit.htm). Candidate parent `DEBE06YYB00005Xz` has a conflicting 44.103 m source height and insufficient physical reconciliation. It is not admitted as a faithful greenhouse. This is distinct from the already authored Botanischer Volkspark Pankow. Existing garden paths and structures remain. |
| DDR housing around former Mohrenstraße | Existing complete housing/streetscape work is retained. This pass did not acquire a sufficiently precise new photo-to-owner survey for additional facades; no blanket palette substitution is claimed. |
| Marzahn and other large gardens | Existing housing, park and Gärten-der-Welt models remain. No district-wide generic treatment and no unsupported claim of a fresh complete garden reconstruction. |

The source disagreement at DRV and the greenhouse are intentionally explicit.
Directory/address confirmation establishes the place; it cannot prove a tall
building's proportions or a greenhouse's roof geometry. This audit is not a
census of all federal agencies or a photographic validation of every older model.

## Ownership, limits and reproducibility

`civic-places-v352-predecessors.json.gz` retains actual production navigation and
complete position/normal/color/index hashes for the six relevant old chunk/mode
pairs. The capture uses the current production preparers and source catalogue.
The compiler rejects changed input bytes, missing captures and any old building
overlap. New ground is the exact selected Drawn footprint, or independent Native
roof-cell domain, minus **all** intersecting preceding production ground. The
entire resulting complement is emitted, including polygon holes. No approach
rectangle or district ground is inferred. No older ground, building, navigation,
source recipe or authored detail is retired.

The renderer, upload/decode/startup/live/Worker limits, mobile detail, six modes
and tour are untouched. Integration consists only of the two static descriptors
in `city-v352/civic/civic-manifest-delta.json`. The root release owns the public
size receipt and any finite lossless compression offsets. A new manifest pin must
be regenerated after any public packet change.

From the repository root:

```sh
uv run python scripts/build_civic_places_v352.py --task-dir /path/to/city-v352/civic
uv run pytest -q tests/test_civic_places_v352.py
bun test src/app/tests/civic-places-v352.test.ts
uv run ruff check scripts/build_civic_places_v352.py tests/test_civic_places_v352.py
```

To audit current predecessor output without replacing the frozen receipt:

```sh
bun run src/app/scripts/capture-civic-predecessors-v352.ts /tmp/civic-current-production.json.gz
```

Seven Python tests verify finite source identity, full source preservation,
independent Native geometry/navigation, production-ground subtraction, public
hashes/bounds and outward source-supported fittings. Two Bun tests decode all four
new packets through the actual production builder and compare all six old
production outputs exactly with their frozen receipt. A local geometric
review of the actual exported meshes was inspected; it is not a substitute for
the root release's browser QA in context. The known, pre-existing northern
terrain-receipt issue documented in V351 is not changed by this work.
