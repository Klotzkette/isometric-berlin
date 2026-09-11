# Step 10: Humboldt entrance and Bebelplatz facades

`BebelplatzFacades.ts` adds shallow, static recognition geometry for three
requested fronts. Their metric envelopes are the accompanying bounded Berlin
LoD2 supplement in `bebelplatzBuildingSource.json`; canonical OSM source
records remain retained. See [the source extraction](bebelplatz-building-source.md).

## Source contracts and conflict resolution

| Front | Identity | Official parent / important part |
|---|---|---|
| HU old main building, Unter den Linden 6 | OSM relation `6647`, old runtime prism `ion-6647` | `DEBE01YYK0000Cm9` |
| Hotel de Rome, Behrenstraße 37 / Bebelplatz | OSM hotel node `1598987141`, old front prism `29982781` | `DEBE01YYK00002GD`; main front `DEBE3De9BgB1NI84`, projected column front `DEBE3DnOENcW0iq2` |
| Alte Bibliothek / Kommode, legal faculty | OSM way `24247456`, library node `639552895` | `DEBE01YYK00000v2` |

The former 9 m HU and 12 m hotel prism heights were generic context values;
they must not constrain the visible front to a half-height reconstruction.
The supplement provides the measured shell, while this module adds only doors,
window rhythms, columns, capitals, cornices and small sculptural silhouettes.
Source ground levels include basements: HU `-1.245 m`, library `1.609 m`, hotel
`3.821 m` in the viewer frame. They are not new street terrain. The entrance
threshold uses the retained approximately `5.2 m` street level, and the outer
HU gateway samples the existing DGM-derived terrain payload.

The HU centre is the exact official wall segment
`[1494.135,136.511]–[1522.051,134.087]`, with the exact flanking source walls.
The Kommode's curved cornices and window placement follow the official dense
front ring, including both concave wings and the central projection. Hotel
windows and masonry courses follow the projecting centre separately from the
flanking walls, so they remain in front of the source shell.

## Architectural evidence

- [Landesdenkmalamt: HU main building, object 09095954,T](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095954,T)
  records a 17-axis corps de logis, a five-axis central risalit with six fluted
  Corinthian columns and sculptures, rusticated base and arched principal-floor
  windows. The model adds a paired central doorway, readable steps, the six
  columns, roof figures and a separate open street gateway. The gateway's
  member sizes and short fence returns are bounded display reconstruction.
- [Landesdenkmalamt: Alte Bibliothek, object 09065002,T](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065002)
  identifies the curved Baroque front, colossal Corinthian orders of the
  central and corner risalits, and sculpted attic/cartouche. The module keeps
  the three central tall arched entrances, four window bands in the wings,
  columns and curved roof balustrade. The actual identity is also confirmed
  by [the HU legal faculty](https://www.rewi.hu-berlin.de/en/sv).
- [The hotel's lighting architects](https://www.kardorff.de/en/projects/grand-hotel-de-rome)
  identify the converted 1889 Dresdner Bank building. The photo-verified front
  retains the rusticated base, two principal upper window levels, six columns
  on the five central bays, framed windows, shallow entry canopy, roof
  balustrade and `HOTEL DE ROME` sign. No new operator branding is asserted.

Bay pitch, column diameter, window reveals, cap shapes, small stairs and
inscription heights are procedural display subdivisions, not a facade survey.
The source roof envelope remains intact; above-roof statue and cartouche cues
are identified additions rather than measured LoD2 vertices. Statues read as
small architectural silhouettes and do not claim portrait-level reconstruction.
The open courtyard and existing source building collision remain authoritative.

## External visual references and credits

These three files were inspected as external visual references only. No
photograph, crop or derived texture is bundled or loaded. Recognition details
are independently constructed procedural geometry.

| Wikimedia file | Author | License | Role |
|---|---|---|---|
| [Frontansicht des Hauptgebäudes der Humboldt-Universität in Berlin.jpg](https://commons.wikimedia.org/wiki/File:Frontansicht_des_Hauptgeb%C3%A4udes_der_Humboldt-Universit%C3%A4t_in_Berlin.jpg) | Christian Wolf (www.c-w-design.de) | [CC BY-SA 3.0 Germany](https://creativecommons.org/licenses/by-sa/3.0/de/) | 2015 front view: gate, stone, windows and columns |
| [Alte Bibliothek, Bebelplatz, Berlin-Mitte, 150926, ako.jpg](https://commons.wikimedia.org/wiki/File:Alte_Bibliothek,_Bebelplatz,_Berlin-Mitte,_150926,_ako.jpg) | Ansgar Koreng | [CC BY 3.0 Germany](https://creativecommons.org/licenses/by/3.0/de/) | 2015 front view: concave wings, orders, portals and attic |
| [Berlin-Mitte Bebelplatz Hotel de Rome 178.jpg](https://commons.wikimedia.org/wiki/File:Berlin-Mitte_Bebelplatz_Hotel_de_Rome_178.jpg) | GFreihalter | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 15 July 2025 front detail: columns, rustication, fenestration and sign |

Credits must be mirrored in the packaged per-file visual-reference manifest;
the existing visible Wikimedia visual-reference notice remains required.

## Runtime and checks

- Four Smooth instance batches, `3,413` instances, `265,412` geometry/instance
  bytes including indices. Material instances use the existing day/night policy.
- Minecraft is a separate cube-only reading: one batch, `850` blocks,
  `65,248` geometry/instance bytes. It retains the window rhythm, portals,
  columns, curved footprint and open gateway without smooth duplicate surfaces.
- All boxes, heads, column shafts and robe silhouettes reuse four tiny unit
  meshes; no runtime texture loader, animation, union or per-frame constructor.
- Mobile uses the same bounded three-front model. No city rendering distance,
  movement, source feature, other facade or catalogue inventory is changed.
- Focused tests check exact source axes, preserved library curvature, finite
  matrices, static transforms and GPU budgets, an open central HU gateway,
  exterior hotel glazing, and axis-aligned cube-only Minecraft geometry.
