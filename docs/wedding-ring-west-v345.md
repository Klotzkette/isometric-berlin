# Station approaches and western Ring neighbourhoods

This pass refines **81 retained residential street elevations in 28 finite groups**,
plus **four source-bound elevations beside Nordbahnhof**. It does not claim a
complete renewal of Wedding, Moabit, the Ring corridor or the western districts.

The 81 streamed buildings are individually matched against retained positive
OSM residential records, with at least **97% footprint intersection-over-union**.
Every storey count comes from the retained `building:levels` tag. Actual LoD2 wall
planes, eaves, body paint, roofs, side wings and open courts remain unchanged.
Window widths and the shallow frame, reveal, sill and transom dimensions are
contextual display estimates; they are not surveyed photographic apertures.
No doors, shops or occupants are inferred. Existing mapped door apertures stay clear.

For the four Nordbahnhof elevations, the original complete LoD2 surface records
are matched to the actual decoded resident Drawn triangles and independently
cardinal Native triangles. The existing wall shade is retained over the previous
approximate pane grid; its original geometry words are not removed. Missing,
retired or moved hosts reject all new detail on that wall. Both paths use the same
complete geometry on mobile and desktop.

## Coverage

| Requested area | Actual new work in this pass | Limit |
| --- | --- | --- |
| S1 Bornholmer Straße | Finnländische Straße, Ueckermünder Straße, Bornholmer Straße; 9 owners | Individual source fronts near the station, not the whole station neighbourhood |
| S1 Gesundbrunnen | Ramlerstraße; 3 owners with individually mapped 4/5-storey rhythms | Existing station/trench architecture and earlier Badstraße details preserved |
| S1 Humboldthain | Existing source families and station vicinity audited | No new ordinary front passed the actual supported-host selection in both modes; previous scene retained |
| S1 Nordbahnhof transition | Gartenstraße and Eichendorffstraße; 4 independently guarded resident owners | No underground or station-envelope replacement |
| S1 Wollankstraße transition | Existing source families audited | No accepted new two-mode frontage; not claimed as improved |
| Moabit | One retained Sickingenstraße residential owner | Earlier V300/V340 authored Moabit owners excluded from duplicate overlays |
| Hellweg / Ellen-Epstein-Straße 1 | Current operator address, shop/yard and actual legacy core owner audited | No new supported façade admitted; no speculative retail or yard replacement |
| Charlottenburg and western Ring approaches | Friedbergstraße, Dernburgstraße, Lietzensee-Ufer, Neue Kantstraße, Kantstraße, Leonhardtstraße, Stuttgarter Platz, Sybelstraße, Mommsenstraße, Niebuhrstraße, Damaschkestraße, Gervinusstraße; 36 owners | Finite actual street fronts |
| Schöneberg and Ring approaches | Ebersstraße, Feurigstraße, Badensche Straße, Fritz-Reuter-Straße, Freiherr-vom-Stein-Straße, Wartburgstraße; 18 owners | Existing courtyards and every source shell retained |
| Wilmersdorf | Güntzelstraße, Düsseldorfer Straße, Wittelsbacherstraße; 9 owners | Three finite groups |
| Halensee / western Ring edge | Lützenstraße and Bornstedter Straße; 5 owners | Two finite groups |

The authoritative per-owner coordinates, original records, individual storeys,
source hashes and actual Native spans are in
[`wedding-ring-west-v345-source.json`](../geo_data/regierungsviertel/wedding-ring-west-v345-source.json)
and the generated
[admission receipt](../geo_data/regierungsviertel/wedding-ring-west-v345-receipt.json).
The four resident records and exact source triangle receipts are in
[`nordbahnhof-fronts-v345-source.json`](../geo_data/regierungsviertel/nordbahnhof-fronts-v345-source.json).

## References and limits

References consulted on 14–15 November 2026 provide neighbourhood and station
context. Their photographs are references only, with no external image pixels or
textures copied into the viewer:

- [S-Bahn Berlin S1 line](https://sbahn.berlin/fahren/s1/) identifies the station sequence. Humboldthain, Gesundbrunnen and Bornholmer Straße are the selected Wedding/Gesundbrunnen corridor; Nordbahnhof and Wollankstraße are transitions.
- [Mitte's current list of preservation areas](https://www.berlin.de/ba-mitte/politik-und-verwaltung/aemter/stadtentwicklungsamt/stadtplanung/staedtebaufoerderung/erhaltungsgebiete/uebersicht-der-erhaltungsgebiete-1393066.php) supplies neighbourhood context for Badstraße, Humboldthain Nord-West, Kattegatstraße, Birkenstraße and Waldstraße.
- [Municipal Humboldthain Nord-West study, June 2025](https://www.berlin.de/ba-mitte/politik-und-verwaltung/aemter/stadtentwicklungsamt/stadtplanung/staedtebaufoerderung/erhaltungsgebiete/250610_endbericht_nu_humboldthain_nw.pdf) and [Brunnenstraße Nord ISEK, 2025](https://www.berlin.de/ba-mitte/politik-und-verwaltung/bezirksamt/beschluesse-des-bezirksamts/2025/946_2025_01_isek_brstrnord_berichtpdf_k.pdf?ts=1757063073) describe different building generations and station surroundings. They do not supply individual surveyed apertures for these selected houses.
- [Charlottenburg-Wilmersdorf residential buildings](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/wohnhaeuser/) and [Halensee's district profile](https://www.berlin.de/ba-charlottenburg-wilmersdorf/verwaltung/service-und-organisationseinheiten/sozialraumorientierte-planungskoordination/region/bzr-09-1334542.php) provide context for the western streets and Ring corridor.
- [Current Hellweg Berlin-Tiergarten operator page](https://www.hellweg.de/markt/berlin-tiergarten/) confirms Ellen-Epstein-Str. 1. Retained OSM shop way `1088827579` and customer-parking way `46349275` locate the audited corner. The operator page still uses Hellweg; no OBI branding is invented.
- Actual residential polygons, mapped storeys and road records: retained OpenStreetMap extracts under [ODbL](https://www.openstreetmap.org/copyright); measured building walls and parent envelopes: the existing credited Geoportal Berlin LoD2 source archives.

### Focused core-host follow-up

The follow-up checked the actual legacy core source inventory as well as the
streamed outer and resident Alt-Mitte families. The missing additions are not
evidence that these buildings are absent from the city:

- Humboldthain's reception/bridge/stair complex is retained core prism
  `44093193`, with a single 9 m height and one combined 20-vertex ring. The
  retained OSM record identifies `building=train_station`, Hochstraße 46 and
  three levels. This combined height does not establish the height or opening
  rhythm of each of the station's different parts. The
  [Landesdenkmalamt's station record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030444)
  distinguishes a seven-sided reception hall, the enclosed connecting bridge,
  stepped stair roofs and the platform below. It also distinguishes the
  now-rendered exterior from the yellow interior tiles. Applying an ordinary
  residential façade or yellow exterior tiles would be a false correction.
- Hellweg's retained core body is prism `35139658`, with an 11-vertex ring and
  only a 3 m fallback height. It is separate from the shop and parking records
  cited above. The current operator page establishes the address and name;
  its market photographs are generic placeholders, so they do not establish
  this building's sign position, façade bays or true height. No sign placement,
  additional storeys, yard objects or future OBI branding was inferred.
- `NorthCorridorV208` owns the northern Unter-den-Linden corridor; it is not a
  Humboldthain host. `WestIndustrialV230` owns Eiswerder, Reuter West and
  Westhafen; it is not a Hellweg host. The two audited target bodies instead
  belong to the legacy core `LoD2 prism buildings` batches and independent
  Native `Voxel building columns`.

Those Drawn core building batches can be unloaded independently of permanent
scene detail. A later source-accurate refinement must therefore bind to the
actual admitted batch and its disposal/reload lifecycle, with an independent
Native host check. Attaching a permanent decoration based only on a matching
input prism would allow floating façades after its body is unloaded. This pass
preserves these owners without such an unverified addition; its published
improvement count remains 81 streamed plus four resident elevations.

## Integration and storage

`weddingRingWestV345` is one lazy SourceQuarter catalogue entry. Its 46 losslessly encoded per-packet weak recipes
are admitted only with the corresponding existing streamed packet and retire
only the exact earlier generic pane triangles. Every earlier non-retired
triangle, line and navigation record survives. It raises no resident, transfer,
CPU, GPU or scheduling budget. The compiler retains the established 400,000
vertex / 2,400,000 index packet limits. The generated recipe currently contains
67,872 Drawn and 56,882 Native triangles, 2,597/2,162 window groups, and occupies
4,238,625 JSON bytes (1,201,915 gzip bytes before the application bundler).
The existing lossless per-packet build transform emits 1,628,364 bytes and
reconstructs only requested packet plans; all 46 getters replay byte-for-byte
after weak-cache expiry. The Nordbahnhof source data is 10,090 bytes.

`createNordbahnhofFrontsV345(world, native)` runs after the actual Alt-Mitte source
bodies exist and before static compaction. It creates only the four admitted
source-bound façades. It must not be installed as an unverified standalone mesh.

Verification:

```sh
uv run --no-sync python -m scripts.build_wedding_ring_west_v345 --check
uv run --no-sync python -m scripts.build_nordbahnhof_fronts_v345 --check
uv run --no-sync pytest -q tests/test_wedding_ring_west_v345.py
bun test src/app/tests/wedding-ring-west-v345.test.ts src/app/tests/nordbahnhof-fronts-v345.test.ts src/app/tests/wedding-ring-storage-v345.test.ts
```

The browser-unit checks compare exact previous position/colour triangle words,
allowing only the specifically receipted old-pane retirements. They also check
old ink and walking data, independent Native cardinality, aborted admission,
foreign/changed packets, missing resident hosts and translated resident parents.
