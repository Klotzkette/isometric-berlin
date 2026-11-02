# Neukölln Arcaden and Rathaus Neukölln

These two distinctive buildings on Karl-Marx-Straße use their complete official
building bodies, with articulated roofs and open courtyards. The Arcaden include
the narrow curved corner, metal bands, glazed lower floors and thin ribbed
entrance canopy. The town hall distinguishes its older stone and rendered wings,
red roof surfaces and later annexes. Its previously missing clock tower includes
an open upper structure, gold-coloured clock markings, a copper-coloured roof
and a small Fortuna silhouette.

The reference photographs support architectural comparison. Their pixels,
historical advertising posters and former tenant names are not reproduced.
Window sizes, subdivisions, tower width and small sculptural details are
explicitly presentation dimensions. Every view and touch device receives the
complete geometry.

## Geometry and sources

The source is `LoD2_393_5815.zip` from the official Berlin building model.
All six parent objects, 80 leaf building parts and 1,104 wall and roof surfaces,
including interior rings, remain in the versioned source packet:

| Building | Complete official parent objects | Parts |
| --- | --- | ---: |
| Neukölln Arcaden | DEBE00YYpu00008U, DEBE08YYF0001IKP, DEBE00YYpu00008I, DEBE08YYF00001FF | 65 |
| Rathaus Neukölln | DEBE08AL3Rd0004a, DEBE08AL3Rd0001s | 15 |

The complete official family is translated to the existing street datum of
3 metres without changing relative heights. It covers 99.9076 percent of the
previous Arcaden footprint and 99.5139 percent of the town hall footprint.
Every remaining exterior portion of the old outline is retained in full at its
previous height. The old source remains unchanged. This addition changes no
other property or district coverage.

The tall tower is absent from the official town hall dataset: its highest parts
end at 32.654 metres in the local, untranslated reference frame. The tower is
therefore a separate reference model explicitly marked as an estimate. The
district website states 67 metres; other district documents state 68 metres.
The scene uses a total height of 67 metres above street level. Its position
follows the retained OSM Fortuna node 5299353950; the documented statue height
is 2.20 metres. The drawn roof cap has smooth faces, while the native view uses
an independently constructed orthogonal stepped roof.

The complete drawn triangle set contains 3,076 non-degenerate official triangles,
875 triangles from the preserved exterior remnants and ten additional triangles
for the estimated copper tower cap. Original polygons remain in the source even
where tiny component surfaces become degenerate on the Float32 display grid.
The bodies are supplemented by 8,993 thin facade and tower fittings and
22,662 native parts. Native navigation uses only the half-metre-wide cells
actually built, grouped by identical lower edges and indexed by row for their
actual roof height. Courtyards remain open.

## Architectural comparison

- [Bezirksamt Neukölln: town hall and Fortuna](https://www.berlin.de/ba-neukoelln/ueber-den-bezirk/sehenswertes/artikel.105690.php), including the district photograph: present tower top, stone colour, clock markings, rendered wings and red roofs.
- [Landesdenkmalamt, object 09090494](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09090494): identity and construction history of the surviving multi-wing complex. Elements lost in the war are not reconstructed.
- [Ingenieurbüro TGA Effizienz: Arcaden with Cineplex](https://www.tga-effizienz.de/details-dienstleistungen/berlin-neuk%C3%B6lln-arcaden-mit-cineplex-kino.html): a 2019 architectural photograph showing the curved corner, transoms and entrance canopy; it makes no claim about current shop occupancy.
- [Neukölln Arcaden](https://www.neukoelln-arcaden.de/): Karl-Marx-Straße 66 and entrances on Karl-Marx-Straße and Flughafenstraße.
- [Geoportal Berlin, spring 2025 orthophotos](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr): roof and courtyard comparison; perspective-displaced tower roof pixels do not replace a measured footprint.
- [OpenStreetMap, Fortuna](https://www.openstreetmap.org/node/5299353950): the local anchor from the already retained PBF dated 29 September 2026.

Accessed and compared on 2 November 2026. Berlin LoD2 and DOP: dl-de/zero-2-0;
OpenStreetMap: ODbL-1.0. Third-party architectural photographs remain references
only. URLs, image checksums and the unchanged source archive are documented in
the source packet `neukoelln-landmarks-v305-source.json.gz`.

## Validated replacement

Only the exact verified old owners `OSM-way-24315002` and
`OSM-relation-374042` in the existing packets `ring182-7_8` and `ring182-8_8`
may be retired. The complete new required model must first be attached and
privately validated through its child, geometry, storage and material identities.
The unchanged raw packets and the complete previous preparation step are
checked separately. Only the exact old triangles, roof lines and navigation
records are then retired. All unrelated triangles, roads, curbs, lines and
owners are preserved.

The previous generic v227 town hall facades retire only after the same complete
admission. Their actual constructor buffers, instance matrices and colours are
checked exactly. Other town halls remain unchanged. If the replacement is
missing or altered, the old town hall fittings become visible again. The default
always retains the complete old representation.

Reproduction: run the Python builder with `--extract --compile`, then the Bun
capture `capture-neukoelln-v305.ts`, followed by the builder with `--packets`.
The capture uses the real old constructors rather than an inferred window
distribution. Five Python checks cover all official surfaces, exterior remnants,
courtyard openings, the native footprint union and the bounded roof material
correction. Bun checks cover the four complete real packet decodings, unrelated
triangles and lines, closed defaults, all six modes, storage parking, material
binding and restoration of the old town hall fittings.

A complete material comparison of both sites with the official spring 2025
imagery corrects only two securely identified roof surfaces: the grey flat roof
of the modern town hall annex on Donaustraße and the brown-olive large upper
roof field of the Arcaden. The precise substrate or vegetation type and subtle
colour differences remain estimates. Both corrections change only existing
colour values and the tints of the actual highest native roof caps. All
positions, indices, instance dimensions, roofs, windows, navigation and colours
outside those two roofs remain byte-identical. The machine-readable evidence is
in `neukoelln-landmarks-v305-material-audit.json`; no image pixels are embedded.
