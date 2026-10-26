# Tierpark Friedrichsfelde — v1.0.176

This finite eastern Tierpark companion adds visible static animals, restaurant
facade divisions, the mapped Kakadu terrace and unobstructed high-aviary frame
sections. It appends to three existing 512 m packets in each representation.
Every previous packet mesh, path, water polygon, navigation record and authored
v187/v255 detail remains a complete prefix. The complete measured Schloss,
Alfred-Brehm-Haus and Giraffenhaus models remain unchanged; this pass does not
claim a new reconstruction of those three already authored buildings.

## Identity and placement

The retained 29 September 2026 OSM extract supplies complete rings and holes.
The current operator visitor plan, marked August 2026, confirms their relative
locations. Its protected drawing was inspected locally as reference; it is not
traced, distributed or used as a texture.

| Existing source | Identification | Static display count |
|---|---|---:|
| way/336032294 | Waldbison, Bison bison athabascae, large 7,750 m² lawn beside the Bärenschaufenster entrance | 7 |
| relation/15095452 | Trampeltiere, Camelus bactrianus | 6 |
| relation/15095451 | Dromedare, Camelus dromedarius | 6 |
| way/1500282455 | Cuba/Chile flamingo water enclosure | 28 |
| way/11269694 | Terrassencafé Kakadu | facade divisions |
| way/11643310 | Patagona restaurant | facade divisions |
| way/327432794 | actual Kakadu outdoor seating polygon | 8 tables |
| relation/15126414 | named raptor aviary, explicit mapped height 9 m | 5 unobstructed posts and 5 perimeter rail segments |

The Waldbison lawn is separate from the Wisent enclosure and from the bronze
Bisonbulle sculpture. Likewise the flamingo statues are not animal anchors.
Every animal's complete rendered footprint stays inside its own enclosure and
outside paths, existing buildings and the other enclosures. Flamingos stand in
their mapped shallow-water area; terrestrial animals avoid water. Positions,
poses, animal counts, body proportions and display colours are illustrative,
not a live census or surveyed animal locations. Bisons have the dark shoulder
hump, head/beard and pale horns; the two camel species have distinct one- or
two-hump silhouettes; flamingos have pink bodies, long legs and bent necks.

The native family independently constructs orthogonal bodies and limbs at the
same positions and scale. It never loads a smooth animal double. Drawn bodies
are small faceted volumes. Both families are static and use full detail on
mobile. There are no image textures, sounds, animations or per-frame callbacks.

## Architecture and explicit limits

Restaurant panes, slender frames, mullions and transoms attach to the actual
old packet wall planes. Native facade attachments are extracted independently
from the actual orthogonal rendered walls, not rounded drawn facades. The
positions, perimeter and previous roof heights remain unchanged. Facade
subdivisions and colours are presentation estimates, not a photographic survey
of every window. The operator identifies Patagona's South American restaurant
and terrace and Kakadu's café/terrace; the complete mapped seating area binds
the eight small tables and chairs. Their real solids extend navigation without
closing routes between them.

The high raptor frame follows the exact retained enclosure boundary at its
explicit 9 m height. Only unobstructed sections are added. Its post spacing and
rail dimensions are estimated. Native top rails use an independently stepped
orthogonal construction. These sections are not claimed as a complete newly
surveyed mesh enclosure.

The operator's **9 June 2026 opening report** gives the completed new flamingo
aviary as **1,800 m²**, the pelican aviary as **1,650 m²**, both up to **10 m**
high, with **32 steel supports combined**. Those completed figures supersede
the earlier construction estimates. The retained flamingo polygon is only
**1,532.9 m² of water**; it is not the full new aviary footprint. Consequently
this pass does not fabricate a net perimeter or support positions from the
pond outline, and does not claim that the new flamingo aviary has been rebuilt.

Two suspicious old building-height records remain visible and unchanged:
`DEBE11YYI0000Nwj` at the flamingo shed, 20.07 m, and
`DEBE11YYI0000Lb6` beside the raptor aviary, 20.92 m. These are retained source
heights, not independently confirmed present roof heights. There is not enough
matched independent roof evidence to replace them with guessed low buildings.
No new decoration conceals or silently shortens those parents.

The existing flat y=3 ground datum is preserved, not relabelled as a new terrain
survey. Earlier main buildings, garden borders, playgrounds, high enclosures,
measured roofs and source facade frames are untouched.

## Delivery and checks

`TierparkV276.prepareTierparkV276` runs after V255 and before the existing
cooperative packet decoder. It checks the exact base mesh fingerprint, ground
fingerprint, origin, family and datum; source drift leaves the original packet
unchanged. It yields before publication. Existing cancellation, upload,
geographic culling and disposal own the additions. The two variants use six
existing descriptors: no new coverage, tour stop, loader, texture or resident
budget. Navigation gains only narrow physical table/chair members and poles.

The runtime JSON is 794,534 bytes (195,405 bytes with ordinary gzip). Retained
source evidence is 357,471 compressed bytes and the audit is 9,071 compressed
bytes. Drawn adds 12,380 triangles, native 17,196 across three packets each.
All combined old+V255+V276 packets remain below the existing mesh, vertex and
16 MiB decoded geometry ceilings. Local animal inspection was a diagnostic
projection of the actual packed triangles; it is not a browser or iPhone test.

Focused checks cover independent GPKG replay, complete previous-file hashes,
every animal's actual triangles and safe footprint, species separation,
orthogonal native geometry, actual wall attachment, mapped seating, bounded
navigation, deterministic generation into temporary files, real packet decode,
the integrated production stream, drift rejection and abort/disposal.

Focused results: 12 Python tests passed in 5.68 s, including the six new
Tierpark v276 tests and previous v255/v187 regression files. The three Bun
files passed all 12 tests and 5,897 assertions in 1.065 s. Logs are retained in
the local `~/.cache/codex-berlin-v276/tierpark-{python,bun}-final.log` files.

```sh
uv run --no-sync python -m scripts.build_tierpark_v276 --extract
uv run --no-sync pytest tests/test_tierpark_v276.py tests/test_tierpark_v255.py tests/test_east_landmarks_v187.py -q
cd src/app && bun test tests/tierpark-v276.test.ts tests/surrounding-stream-v255.test.ts tests/tierpark-v255.test.ts
```

## Primary references

Checked 26 October 2026:

- [Current Tierpark plan](https://www.tierpark-berlin.de/de/tickets-service/tierpark-plan)
- [Finished flamingo and pelican aviaries, 9 June 2026](https://www.tierpark-berlin.de/de/aktuelles/news/artikel/neues-zuhause-fuer-pelikan-flamingo-co)
- [Operator gastronomy](https://www.tierpark-berlin.de/de/tierpark-erleben/gastronomie)
- [Kakadu operator](https://marche-restaurants.de/standort/terrassencafe-kakadu-berlin/)
- [Patagona operator](https://marche-restaurants.de/standort/patagona-tierpark-berlin/)
- [Operator rally: Waldbisons beside Bärenschaufenster](https://www.zoo-berlin.de/fileadmin/tierpark/Tierpark_erleben/Angebote_fuer_Kinder/Rallyes/Kita-Hort-Rallye_Haustiere_Baeren_ab_5_Jahren.pdf)
- [Operator rally: flamingos and camel meadow](https://www.zoo-berlin.de/fileadmin/tierpark/Tierpark_erleben/Angebote_fuer_Kinder/Rallyes/Kita-Hort-Rallye_Hirsche_Kamele_ab_9_Jahren.pdf)

OSM geometry and tags remain ODbL-1.0; the retained original official building
data retain dl-de/zero-2-0. No reference image or protected plan is bundled.
