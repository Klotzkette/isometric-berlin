# Albrechtstraße in Steglitz

V328 adds architectural detail to eight documented street fronts between the Rathaus / A103 end of Albrechtstraße and the vicinity of the Heesestraße junction. The protected ensemble includes houses 7–13, 119 and 124. The separate V328 work on the Heesestraße frontage leaves the Albrechtstraße façade of the dual-address house 120 / Heesestraße 1 outside this recipe. [Landesdenkmalamt Berlin, ensemble 09065457](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065457)

| Address | Reading used for the new fittings | Photograph by Muns |
| --- | --- | --- |
| 7 | First-floor arches, pale frames, projecting vertical trim | [2012 view](https://commons.wikimedia.org/wiki/File:120916-Steglitz-Albrechtstr._7.JPG) |
| 8 | Arched lower windows, divided upper sashes and pilaster accents | [2012 view](https://commons.wikimedia.org/wiki/File:120916-Steglitz-Albrechtstr._8.JPG) |
| 9 | Tall divided sashes, grey stone tones and paired vertical bands | [2012 view](https://commons.wikimedia.org/wiki/File:120916-Steglitz-Albrechtstr._9.JPG) |
| 10 | Wider outer bay glazing, divided sashes and layered ledges | [2012 view](https://commons.wikimedia.org/wiki/File:120916-Steglitz-Albrechtstr._10.JPG) |
| 11 | Pale frames, recessed-looking tall sashes and vertical trim | [2012 view](https://commons.wikimedia.org/wiki/File:120518-Steglitz-Albrechtstr.11.JPG) |
| 12 | Arched sashes, corner façade rhythm and shallow balcony rails | [2012 view](https://commons.wikimedia.org/wiki/File:120916-Steglitz-Albrechtstr._12.JPG) |
| 119 | Wider outer openings, cornices and loggia-inspired rails | [2014 view](https://commons.wikimedia.org/wiki/File:140302-Steglitz-Albrechtstr._119.JPG) |
| 124 | Pale frames, shallow balcony ledges and slender rails | [2012 view](https://commons.wikimedia.org/wiki/File:120922-Steglitz-Albrechtstra%C3%9Fe-124.JPG) |

The photographs establish the visible arrangement and finish. Opening dimensions, relief depths and colours are display estimates. The photographs are references only and are not packaged. Numbers 11 and 12 are available under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The other six are available under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

Albrechtstraße 13 and 117 retain their previously detailed V320 façades. Number 131 retains the V248 model. The six modern Steglitzer Höfe owners at 112b–f and 113 retain their individual original geometry. The builder’s exact source inventory keeps those owners out of the historic fittings. [LDA, house 13](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065464) · [Steglitzer Höfe construction announcement](https://www-openpr-de.b-cdn.net/news/763290/Berlin-PROJECT-Immobilien-beginnt-Bauarbeiten-an-den-Steglitzer-Hoefen.html)

## Geometry and reproduction

The source receipts use the retained Geoportal Berlin LoD2 and OpenStreetMap geometry. An exact named address and footprint overlap identify the owner. For each selected edge both original quantized wall triangles must exist, and the builder checks that the frontage faces Albrechtstraße and that the outward detail strip clears neighboring bodies. Door exclusion uses the existing mapped door receipts. All generated centimetre triangles stay within their supported frontage and height. The Minecraft version independently uses original cardinal faces and has an orthogonal stepped interpretation of the window arches.

Both recipes apply to the existing `ring182--7_13` packet. In the final decoder order, they follow the new post office and Heesestraße, and precede the street surfaces and V320. Drawn adds 2,764 triangles with 129 upper windows. Minecraft adds 2,162 triangles with 102 upper windows. The existing building bodies, roofs, navigation and ink are retained. Both modes reuse the packet’s combined mesh and its existing GPU buffer count. The complete Minecraft tile now uses 32-bit indices because the combined vertex count exceeds 65,535. Its decoded geometry is 1,551,888 bytes.

Run `uv run --no-sync python -m scripts.build_albrechtstrasse_v328 --staged /absolute/path/to/provisional.json` from the repository root. Then run `bun scripts/finalize-albrechtstrasse-v328.ts /absolute/path/to/provisional.json` from `src/app` to bind the Bun JSON guards and verify the actual decoder. Use `--check` in place of the provisional path to verify the existing recipe with the Heesestraße predecessor. The exact wire and decoded source hashes, selected walls and attribution for each house are in `geo_data/regierungsviertel/albrechtstrasse-v328-evidence.json`.
