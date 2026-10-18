# Hansaviertel architecture, v237

The Hansa-Bibliothek receives its complete four measured wings, including the open southeast courtyard corner, instead of the previous rectangular interpretation. Fifteen named Interbau buildings receive shallow facade articulation on their retained source walls. The additions use three ordinary streamed companion packets; no permanent scene group, texture or residency limit is added.

## Source and scope

`geo_data/regierungsviertel/hansa-architecture-v237-source.json.gz` retains 49 complete LoD2 parts for 16 parent buildings, their original wall and roof rings, matching unchanged core prism rows, archive checksums, and the relevant retained native columns. The two existing local Berlin LoD2 archives are `387_5819` and `387_5820`; no new coverage is generated. The source date is 2026-03-01, license dl-de/zero-2-0. Coordinates remain the existing local Berlin frame; the library uses one documented rigid vertical display shift to meet the existing ground at y=5.2 m.

The buildings are the library, Schwedenhaus, Niemeyer-Haus, Eiermann-Haus, Aalto-Haus, Vago-Haus, Hassenpflug, Van den Broek/Bakema, Schwippert, Baldessari, Giraffe, Eternit/Paul Baumgarten, Kay Fisker, Otto Heinrich Senn, Franz Schuster and Max Taut. Non-library geometry is additive: source bodies, roofs and all previous authored details remain. Only parts with a matching original rendered prism receive facade additions; an additional archived Fisker part is retained as evidence, without creating a new building body.

Architectural references checked during this change:

- [Berlin Stadtbibliothek: library architecture/history](https://www.berlin.de/stadtbibliothek-mitte/bibliotheken/hansabibliothek/architektur-geschichte/): low atrium building, concrete frame, recessed plinth and courtyard glazing.
- [Landesdenkmalamt: Hansabücherei](https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/hansabuecherei-im-hansaviertel-641033.php) and [listed Hansaviertel ensemble](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050387,T): library and station reception building, brick infill, four wings and open southeast corner.
- [Hansaviertel building inventory](https://hansaviertel.berlin/bauwerke/) provides names and address associations. Individual references distinguish the [Schwedenhaus](https://hansaviertel.berlin/bauwerke/altonaer-strasse-3-9-schwedenhaus/), [Niemeyer](https://hansaviertel.berlin/bauwerke/altonaer-strasse-4-14-oscar-niemeyer/), [Eiermann](https://hansaviertel.berlin/bauwerke/bartningallee-2-4-egon-eiermann/), [Aalto](https://hansaviertel.berlin/bauwerke/klopstockstrasse-30-32-alvar-aalto/), [Vago](https://hansaviertel.berlin/bauwerke/klopstockstrasse-14-18-pierre-vago/) and [Schwippert](https://hansaviertel.berlin/bauwerke/bartningallee-16-hans-schwippert/) buildings.

The model distinguishes the Schwedenhaus's red north/blue south balcony panels, Vago's white/grey/blue/yellow panels, blank slab ends, slender balcony rails and floor edges. Window axes, panel sequences, railing dimensions, glass tones and entrance subdivision are restrained architectural display estimates, not measured openings. The existing non-library solid envelopes remain; this change does not claim to reconstruct Niemeyer's open pilotis or every split-level interior. The ambiguous “Glasturm” is not assigned an invented identity. Shell Paulstraße 20 is separately verified by the parent task, outside these architecture packets.

## Narrow library correction

The only retired original core IDs are `UfOiMKPI`, `5yW3Z2oo`, `Ldcl7dCO`, `RRTGvA3Y`. Their exact original rows remain in the source receipt and `src/app/src/data/hansaLibraryV237.json`. The complete old authored wall/glass block from `v1.0.136:src/app/src/CityRecognitionRefinements.ts`, plus its full-file checksum, is retained in `libraryProxyReceipt`.

The replacement uses all original measured wall and roof surfaces, shifted together to ground. Its inward glass, concrete framing and external brick infill distinguish the courtyard from the outer walls. The old authored water, garden, Gropius and every other authored object stay unchanged. The parent integration retires only these four rendered prisms and their exact native footprint columns, and uses the same measured roof surfaces for walking support. Point (-1953.5, 155.6) remains outside every wing in both representations. No new global navigation barrier or filled courtyard is introduced.

## Drawn, mobile and native

The drawn model triangulates the library's original surfaces and places facade plates against original wall axes. Mobile loads the identical drawn packets. The independently compiled native library uses 0.25 m orthogonal footprint steps and flat per-part roof levels. Its details use orthogonal steps. Other native facades attach conservatively to the exposed faces of the retained 4 m core columns, with separate offsets for reveals, glass, frames and rails. Unbacked panels are omitted, so details are not buried inside the old coarse body or suspended beyond its height.

The three packet IDs are `hansa237--5_0`, `hansa237--4_-1`, `hansa237--4_0`. They contain no added ground or collision footprints. The manifest contribution has an empty ground footprint. All prior packet files are unchanged; normal loader disposal and resident limits apply.

| Geometry | Drawn/mobile | Native |
| --- | ---: | ---: |
| Total uploaded buffer bytes | 1,993,116 | 3,595,116 |
| Largest packet bytes | 1,003,452 | 1,768,944 |
| Largest packet vertices | 64,688 | 85,741 |
| Largest packet indices | 113,598 | 185,013 |

Each packet contains one mesh part and remains below existing 400,000-vertex/2,400,000-index limits. No runtime generation or retained secondary geometry cache is introduced.

## Reproduction and checks

`PYTHONPATH=.:scripts uv run python scripts/build_hansa_architecture_v237.py` replays the compact retained source. `--refresh-source` rereads the already retained archives and original core files. It writes the library profile, packets, `hansa-v237-manifest-addition.json` and `hansa-architecture-v237-evidence.json`.

`uv run pytest tests/test_hansa_architecture_v237.py -q` passes five focused checks: original source/checksum and owner preservation; exact shifted library roofs, grounded wings and open courtyard; all named houses in both families with actual decoded buffer and orthogonality limits; native attachment outside original columns; byte-identical compiler replay into a temporary output directory. Parent integration additionally tests library walking and the unchanged water geometry.

Useful world-space review targets: library (-1954, 7, 155), Schwedenhaus (-1907, 20, 193), Niemeyer (-1849, 20, 93), Eiermann (-1893, 20, 8), Aalto (-2017, 20, 169), Vago (-2085, 20, 258), northern towers (-1800, 35, -100), Giraffe (-2210, 35, 403). Compare the grounded library wings and courtyard at low eye height; the northern towers and slab balconies are most legible from a medium oblique view.
