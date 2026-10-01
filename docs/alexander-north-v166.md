# Alexanderplatz north: source and recognition contract

Pipeline step 10 adds Park Inn, the Karl-Liebknecht-Straße frontage through
Torstraße, Schönhauser Tor and the building containing **Monsieur Vuong** at
Alte Schönhauser Straße 46. The exact restaurant is OSM node `567837367`,
inside building way `23733609`; its [operator](https://monsieurvuong.de/)
confirms that identity and address. The model does not rename it Mr. Wong.

The bounded source contains 25 complete Berlin LoD2 families with 106 leaf
parts, plus the already delivered OSM envelope of The Berlinian. All 1,262
wall/roof surfaces are retained, including the complex Pressehaus/New Podium
parts, Park Inn podium and tower, Tor atrium and source courtyard holes.
Source XYZ millimetres, measured heights, creation dates, archive URLs and
SHA-256 hashes remain in `alexanderNorthV166Evidence.json`. Only one rigid
vertical translation per family connects the source ground to the existing
outer-city `y=3` display plane. No shape is reduced or flattened. Navigation
contains the same part footprints and every triangulated roof plane.

The exact source ownership contract has 26 outer IDs and **no core prism
replacement IDs**. `alexanderNorthV166Navigation.json` keeps the original
outer polygon/height records, including their formerly simplified envelopes.
Centralized publication removes only those coarse source-owner triangles and
navigation owners before the complete replacement is installed. Streets,
parks, water, trees and all unowned packet layers remain untouched.

Park Inn tower parent `DEBE01ALcj000001` contains eight original parts;
`DEBE01YYK000023G` adds the separate low podium. Its precise tall leaf
`DEBE3DeEvGXQZFW3` is 123.306 m high and ends at viewer y=126.306 m.
The previous coarse parent envelope was 123.88 m. Both values remain in their
respective evidence; the refined leaf surface governs the model. Published
125/150 m promotional figures do not rescale the surveyed geometry. The
[hotel factsheet](https://cdn.parkinn-berlin.de/wp-content/uploads/2025/01/Factsheet-Summary-Jan2025_DE.pdf)
documents 37 room floors. Thin blue glass bays, silver frames, geometric
lettering and roof masts are explicitly estimated recognition details.

Schönhauser Tor is the present office complex at Torstraße 49, OSM way
`305213433`, official family `DEBE03YY600008OF`. It is not a recreation of the
lost customs gate. [Deka's property description](https://deka-sterne-berlin.de/sterne/Schoenhauser_Tor)
and [2026 sale notice](https://www.deka-immobilien.de/de/insights-news/aktuelles-aus-der-immobilienwelt-von-deka-immobilien/deka-immobilien-verkauft-schoenhauser-tor-in-berlin/)
give conflicting 1995/1996 and seven/eight upper-floor descriptions. These
do not change the official model. Grey bands, punched lower windows and the
lighter glazed upper levels follow the inspected freely licensed photograph.

The [Pressehaus operator](https://pressehausberlin.de/) distinguishes the
high slab, gläsernes New Podium and Pressecafé and describes the white
aluminium grid and rooftop Berliner Verlag identity. The procedural model
keeps these recognizable. The protected Pressecafé mural is not copied.
The former archive building is identified by Karl-Liebknecht-Straße 31/33:
[Bundesarchiv confirms its previous offices/public functions moved in January
2024](https://www.bundesarchiv.de/nachricht/umzug-abgeschlossen-akteneinsicht-buergerberatung-und-bibliotheksnutzung-wieder-moeglich/).

The Berlinian is retained at existing OSM way `1335157930`, with its exact
footprint and tagged 146 m envelope. [Construction participant Unidome](https://www.unidome.de/post/april-2026-the-berlinian-mit-unidome-technologie)
confirms that its structural shell had reached 146 m in April 2026.
[Berlin's planning authority](https://www.berlin.de/sen/stadtentwicklung/staedtebau/berliner-mitte/alexanderplatz/)
still lists completion in 2027, superseding OSM's stale opening date of 2026.
It therefore uses an explicitly unfinished structural-shell reading with
estimated floor seams, without claiming completed glazing or occupancy.
This does not resolve the user's ambiguous reference to a replacement tower;
no inferred replacement of Park Inn or another high-rise is performed.

Three inspected Wikimedia files supply external visual evidence only:

| File | Author | Licence | Use |
|---|---|---|---|
| [At Berlin 2024 167.jpg](https://commons.wikimedia.org/wiki/File:At_Berlin_2024_167.jpg) | Mike Peel | CC BY-SA 4.0 | Park Inn glass grid, roof screen, sign/masts |
| [Berlin, Mitte, Torstrasse 49, Wohn- und Geschaeftshaus Schoenhauser Tor.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Torstrasse_49,_Wohn-_und_Geschaeftshaus_Schoenhauser_Tor.jpg) | Jörg Zägel | CC BY-SA 3.0 | Tor lower bands and glazed crown |
| [Haus des Berliner Verlags mit Pressecafé 2022.jpg](https://commons.wikimedia.org/wiki/File:Haus_des_Berliner_Verlags_mit_Pressecaf%C3%A9_2022.jpg) | Josef Streichholz | CC BY-SA 3.0 | White slab grid and rooftop identity |

Every swatch, facade bay, sign stroke, mast size and intermediate subdivision
is procedural, not a surveyed window or a photographic reproduction. No
photograph, crop, portrait, mural, font or texture is packaged or loaded.
The restaurant locator lettering identifies the operator; it is not a copied logo.

Drawn modes use identical static geometry on pointer and touch: three draw
calls, 37,998 instances and 3,258,180 GPU bytes. Minecraft independently
samples the source surfaces into 59,427 two-metre cells, losslessly merged
into 7,955 runs; its complete reading adds orthogonal identity strokes for
9,533 instances, two draw calls and 725,804 GPU bytes. There is no invisible
solid interior or smooth detail duplicate in Minecraft.

Reproduce with `uv run python scripts/build_alexander_north_v166.py` using the
existing ignored LoD2 ZIPs and the Geofabrik-derived candidate/outline caches.
The dedicated Python tests check every source sheet and translated coordinate,
projected triangulation area, exact ownership and disjoint native cells. Bun
tests check rendered source buffers, bounded draw calls, orthogonal native
matrices, roof support and strict source-column matching. The parent task
performs shared viewer integration and browser QA.
