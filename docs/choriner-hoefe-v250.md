# Choriner Höfe and Zehdenicker Straße 7A — v250

Two distinct sites are corrected within their existing measured buildings. No new city envelope, descriptor, material, texture, animation, draw call or touch-quality tier is introduced. The compact source-plane recipes append to the existing `NorthV185` choriner mesh.

## Identity and visual references

- [Frank Schiffer, Haus aus Stein](https://www.frankschiffer.com/projekte/haus-aus-stein/): Choriner Straße 84, completed 2012. Upper street window ribbons, two-storey glazed lobby, light clinker, floor-height windows, court glazing/balconies and stepped penthouses.
- [HAAS, Choriner Höfe](https://www.haas-architekten.de/projekte/wohnbauten/choriner-hoefe): modern nine-house ensemble, six-storey frontage plus recessed upper storey, clinker/render contrast, garden houses and side wings. The architect's site plan was inspected solely to distinguish the modern project from historical neighbours.
- [Collignon, Choriner Höfe](https://www.collignonarchitektur.com/de/projekte/choriner-hoefe): two Zehdenicker street houses, sculptural court entrance and layered white frames. Alternating projecting rectangular frames, darker reflected glazing and slim rails are the main recognition cues.
- [Gewobag, Zehdenicker Straße 7A](https://www.gewobag.de/bauen-in-berlin/bauprojekte/zehdenicker-strasse-7-a-in-prenzlauer-berg/) and [HAAS, Wohnhaus Zehdenicker Straße](https://www.haas-architekten.de/projekte/wohnbauten/wohnhaus-zehdenicker-strasse): separate 2017 infill with 17 homes and two commercial units, six full floors and recessed penthouse, blunt corner/bay, full-height windows and balconies. Cream render, gray loggia reveals and a warmer upper storey distinguish it from the Höfe.

All architect/owner images remain reference-only; no image pixels or protected plans are in the release. Exact fitting dimensions and colours are proportional display estimates, not surveyed facade measurements.

## Retained owners

| Site part | LoD2 parent | OSM identity | Existing datum treatment |
|---|---|---|---|
| Schiffer street/side/court house | DEBE01YYK00005YZ | way/235997895 | v169 source +8.24 m |
| Collignon western street house | DEBE01YYK00007np | way/235997891 | v169 source +7.41 m |
| Collignon eastern street house | DEBE01YYK0000En7 | way/235997891 | v169 source +7.48 m |
| HAAS street house | DEBE01YYK00001UT | way/235997892 | v169 source +7.42 m |
| HAAS garden house | DEBE01YYK00000vQ | way/235997894 | v169 source +8.48 m |
| Separate Zehdenicker7A | DEBE00YY1JO0001g | way/477303813 | raw LoD2 already NHN−30; no extra +6.04 m |

Choriner85 (`DEBE01YYK0000AdV`), Zehdenicker11 (`DEBE01YYK00002ty`) and more distant historical rear buildings at 9A/9B/9C are excluded. All original building parts, roof sheets, roof terraces, court holes and navigation remain intact. Native blocks use independent axis-aligned facade cells (maximum 0.70 m spacing), positioned 1.06 m farther outward than drawn fittings to clear the existing block envelope.

## Exact authored corrections

`canRefineChorinerV250()` checks fixed numeric receipts. Only the two old v185 Schiffer faces and their v205 generic-grid transoms yield. In v230, precisely the first 21 drawn or 63 native generic facade joints/reflections yield; the subsequent 29 drawn or 209 native roof-coping members remain bit-for-bit. A changed receipt fails open and retains the older feature. Complete measured source sheets and v239 packets are never suppressed. The older v239 window reflections sit behind the new shallow, source-clipped facing.

The new facing is clipped against the exact source wall including holes, sloping tops, steps and recesses. It cannot bridge a court or replace a missing wall. Glazing, balcony readings and frames are shallow accents, not new solid bodies or newly cut passages.

## Validation and integration

- Generator: `scripts/build_choriner_v250.py`, offline from retained sources.
- Evidence: `geo_data/regierungsviertel/choriner-v250-evidence.json`, with exact wall rings, owner/part/sheet links, datum receipts, source hashes and semantic member roles.
- Runtime: `src/app/src/ChorinerV250.ts`, with append and exact-replacement helpers.
- Data: `src/app/src/data/chorinerV250.json`, 139,841 bytes; 104 source planes, 3,903 drawn or 10,527 orthogonal native members.
- Scoped checks: 3 Python regressions (wall containment, source hashes/datum/identity, deterministic offline replay), 2 Bun tests with 29 assertions (fail-open receipts, preserved roof suffix, finite positive geometry, independent native rows and deterministic equal detail). Ruff passes.

Cameras are exported as `CHORINER_V250_CAMERAS` and stored in the data/evidence.
The earlier broad street poses can lie inside opposite buildings. Integrated
browser inspection instead uses these footprint-checked close views, with an
85-degree field of view:

| View | Eye | Target |
|---|---|---|
| Choriner84 | `[2371,32,-1291]` | `[2358,23,-1294]` |
| Collignon/Zehdenicker | `[2272,37,-1282]` | `[2280,23,-1297]` |
| Zehdenicker7A | `[2372,33,-1228]` | `[2386,21,-1244]` |

Integrated build, browser and release checks are recorded in
[schools-courtyards-v250.md](schools-courtyards-v250.md).
