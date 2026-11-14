# Schlossplatz, Friedrichswerder and Breite Straße: bounded context v344

This addition refines 15 existing elevations belonging to ten complete resident
Alt-Mitte LoD2 families. It does not replace a building, its roof, its courtyards,
the v239 Staatsratsgebäude/Neuer Marstall owners, navigation or terrain. The
former Staatsratsgebäude houses **ESMT Berlin**, not the Hertie School.

## Named scope and visible distinctions

| Existing family | Elevations and recognition added |
| --- | --- |
| `DEBE01YYK00009Oi` | Ribbeck-Haus, Breite Straße 35: paired lower windows, four upper groups of three, portal, horizontal courses and four small Renaissance gable reliefs |
| `DEBE01YYK0000ArS` | Alter Marstall: three actual street-wall planes, pale plaster, paired windows, ground-floor grilles and the middle portal |
| `DEBE01YYK00005AY` | Berliner Stadtbibliothek: three-storey glazed street elevation with concrete floor bands and a small geometric interpretation of the A-portal |
| `DEBE01YYK00002CR` | Existing ESMT Kanzleiflügel on the Breite Straße and garden sides: five-storey administrative facade with pale spandrels, repeated paired openings and concrete bands |
| `DEBE01AL40k0003G`, `...3K`, `...3M` | Niederlagstraße 7/9/11: stone fronts, larger recessed-looking windows, shallow metal balcony rails |
| `DEBE01AL40k0003L` | Werderscher Markt 6 and church passage: ochre upper elevation and narrow vertical openings |
| `DEBE01AL40k0003O` | Schinkelplatz 2: ochre elevations toward the square and south corner |
| `DEBE01AL40k0003N` | Schinkelplatz 3: pale natural-stone elevation, taller openings and balcony/loggia relief |

Small dimensions, colour and window divisions are display estimates from the
listed photographs. LoD2 wall endpoints, vertical extent and source polygon
identities are metric anchors. This is recognisable architectural relief, not a
claim that every window, scroll, individual stone or letter was surveyed. The
library gate shows 13 × 9 small plates in Drawn; its individual A designs are
simplified. Existing roof geometry stays authoritative. Ribbeck's relief stays
below the existing measured 25.8 m roof maximum. Native retains the same named
scope using block constructions on its actual independent source faces.

## Current-site distinction

The Bauakademie is **not** depicted as an already reconstructed complete
building. Its present Musterecke and Roter Saal are separate OSM fallback
owners (`45095631` and `14046275`), not the measured Alt-Mitte parents used by
this addition. A separate source-bound `BauakademieExteriorV344` module adds
brick and fenestration relief to those existing remnants; see
[Bauakademie exterior](bauakademie-exterior-v344.md) for the independently pinned
4 m Native columns and the preserved source-height difference.
Current official sources still describe the future Bauakademie building and
the interim site. Planned Breite Straße/ESMT infill is likewise not asserted to
exist. PETRI is handled separately by the v344 integration, not this module.

## Sources inspected on 14 November 2026

Metric source: Geoportal Berlin LoD2, retained complete source extract
`geo_data/regierungsviertel/alt-mitte-v169/source-391_5819-00.json.gz`.
Source file SHA-256 is included in the generated receipt file. Official source
credits and OSM attribution remain in the project-wide source notice.

Primary architecture and photographic checks:

- [ESMT campus](https://esmt.berlin/de/ueber-uns/unser-campus) and
  [current historic tours](https://esmt.berlin/de/veranstaltungen/historische-fuehrungen).
- [Berlin's Breite Straße project](https://www.berlin.de/sen/stadtentwicklung/staedtebau/berliner-mitte/breite-strasse/): existing buildings versus future development.
- [Official 2024 competition brief](https://www.berlin.de/sen/bauen/_assets/wettbewerbe/2023/breite-strasse/brs_auslobung_ebook.pdf?ts=1721738190), pages 36–37: existing ESMT annex and sequence of monuments along Breite Straße.
- [Official 2021 competition brief](https://www.berlin.de/sen/bauen/_assets/wettbewerbe/2021/wohn-und-geschaeftsquartier/aufgabenstellung.pdf), photographs 12–16 on pages 73–74: glass library front, administrative ESMT elevation and tree-lined street space. Photographs visually inspected; future proposals were not treated as built reality.
- Landesdenkmalamt: [Ribbeck-Haus](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011239), [Alter Marstall](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011238), [Stadtbibliothek](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011240). The archived 1996 photographs establish retained architectural composition; the 2013 A-portal photograph supplies the gate rhythm, not the current state of temporary objects.
- [Schinkelplatz architecture, owner FRANKONIA](https://www.berlin-schinkelplatz.de/schinkelplatz/architektur) and [gallery](https://www.berlin-schinkelplatz.de/galerie): photographs of the ochre narrow-window corner, pale natural-stone frontage, recessed openings and metal balcony detail visually inspected. Rendered future-plan images on those pages were not used as evidence of current fabric.
- [Bauakademie future building, Bundesstiftung](https://bundesstiftung-bauakademie.de/gebaeude/kuenftiges-gebaeude), [existing sample facade](https://www.errichtungsstiftung-bauakademie.de/musterfassade.html) and [Berlin's 2026 interim exhibition](https://www.berlin.de/sen/stadtentwicklung/quartiersentwicklung/staedtebaufoerderung/nachhaltige-erneuerung/aktuell/artikel.1692819.php): existing partial site and proposed reconstruction are distinguished.

No downloaded photograph or PDF is imported into the viewer; working references
remain in the ignored raw-data directory. There are no external runtime reads,
photographic textures, new loader phases or larger residency limits.

## Admission and integration

`createSchlossplatzContextV344(world, native)` returns a `Group`, including an
empty group if no complete actual source host is available. Call it after the
actual Alt-Mitte source root has been attached, and before geometry compaction
and buffer parking. The root name, original packet identity, packed positions,
index references and world transform must all agree with the receipt. Missing,
retired, moved, reparented, edited or wrong-mode hosts receive no decoration.
The common verifier is `sourceWallHostV344.ts`, also used by the neighbouring
Gendarmenmarkt module. It retains no scene-buffer copies.

The generator reads the current resident packets. Drawn uses the exact source
wall planes. Native intersects existing cardinal triangle planes with the
verified source frontage and makes 128 supported rectangles; it does not rotate
Drawn detail into Native. The generated JSON is 107,437 bytes, 13,424 bytes with
gzip. Geometry remains instanced and texture-free: Drawn 7,378 instances / 537
window openings / 560,728 instance bytes; Native 5,634 / 531 / 428,184 bytes.
Both use three or fewer material/shape batches. Mobile uses identical geometry.

Regenerate with `uv run --no-sync python scripts/build_schlossplatz_context_v344.py`.
The focused Bun test `tests/schlossplatz-context-v344.test.ts` passes 3 tests
against the actual current packet decoder with `schlossplatzV239: true`. It
checks all ten families, unchanged source position/index arrays, cardinal Native
instances, bounded counts, and fail-closed host mutations.

Useful QA cameras (world metres; camera → target):

- Breite Straße/library: `[2165, 24, 437]` → `[2197, 15, 413]`.
- ESMT rear administrative wing: `[2170, 25, 411]` → `[2126, 16, 418]`.
- Schinkelplatz and Bauakademie context: `[1870, 28, 390]` → `[1805, 16, 344]`.
- Niederlagstraße: `[1744, 24, 332]` → `[1781, 16, 335]`.
