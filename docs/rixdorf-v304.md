# Richardplatz, Schudomastraße and Böhmisch-Rixdorf

The scene distinguishes the old village's low houses and courtyards from the
taller tenements around Richardplatz and along Schudomastraße. Its basis is
70 addressed building families with 217 complete official building parts.
Two additional official building families complete the same modern prayer hall
and community house on Kirchgasse; they do not extend the work area. The village
church on Richardplatz is a separate building.

All 2,452 official wall and roof surfaces, courtyard holes and outbuildings remain
in the source data. Roofs follow their measured slopes and ridge heights. This
corrects, for example, the previously undersized houses on Kirchgasse and the
tenement at Schudomastraße 51. New perimeter blocks do not cover village
courtyards, the Comenius-Garten or paths.

The five existing detailed owners for the Bethlehemskirche and smithy, including
the bell tower, fittings and surroundings, are preserved. Exactly 77 incorrect
older OSM bodies may be retired only after complete replacement geometry has
passed validation. All other triangles, lines and navigation data in the same
four existing city packets remain unchanged. The 28 old facade profiles have
their own exact instance receipts for both representations. They may be hidden
only while a complete replacement is actually loaded, and reappear when it is
unloaded.

The independent block representation uses an orthogonal exterior skin on a
one-metre grid. Its collision footprint and stepped roof heights follow the
same grid cells. Merging adjacent roof cells at the same height changes no cell.
The drawn representation retains the actual roof slopes and their associated
navigation.

Windows, narrow frames, render colours, shutters and cornices are conservative
presentation estimates. The official building data does not measure these
small subdivisions. Reference photographs establish the contrast between low
village houses, green shutters, brick, open courtyards and taller urban houses;
they are included neither as image files nor as textures. No current survey of
paintwork, tenants or shop signs is claimed.

An audit of all 77 retired owners found one explicit previous roof material:
`OSM-way-168921751` at Richardstraße 90 maps to the complete official family
`DEBE08YYF0000CEW`, comprising two parts. Both representations preserve its
`#c59d8f` roof colour from the unchanged `outer-materials-v254` evidence, encoded
as the same prior linear RGB `[142, 86, 70]`. The correction changes 14 drawn and
694 native roof triangles. Twelve native vertex copies separate roof corners
that previously shared a generic colour; the complete ordered geometric
surfaces, navigation, roof-cap geometry, walls, fittings and every other colour
remain unchanged.

Sources and photographic comparison:

- [Böhmisches Dorf, Landesdenkmalamt Berlin](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09090370).
- [Prayer hall and community house, Landesdenkmalamt Berlin](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09090376).
- [Rixdorf: history and monuments, Bezirksamt Neukölln](https://www.berlin.de/ba-neukoelln/_assets/bilder/stadtentwicklungsamt/stadtplanung/rixdorf-seine-geschichte-und-denkmale.pdf).
- [Rixdorfer Schmiede and Böhmisches Dorf, Bezirksamt Neukölln](https://www.berlin.de/tourismus-neukoelln/entdecken/artikel.1152599.php), photographic references by visitBerlin / Dagmar Schwelle.
- Official Berlin LoD2 archives 394/5814 and 394/5815, dl-de/zero-2-0; retained OSM assignments dated 29 September 2026, ODbL-1.0.

Checks cover the complete original official families, every drawn source
surface, unchanged older packets, exact transfer receipts, orthogonal block
surfaces and navigation, actual roof slopes, open courtyards and all existing
packet boundaries. The recipe loads for each packet that is actually needed;
it introduces no new runtime builder.
