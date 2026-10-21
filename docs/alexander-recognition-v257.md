# CUBIX, RathausPassagen and Fernsehturm base — v1.0.157

Step10, three bounded recognition refinements inside existing coverage. The
unchanged official LoD2 packets retain every original wall, roof, part and
source vertex. No replacement owner, extra ground, collision change, tour stop,
streaming descriptor or live residency/transfer/prefetch budget is introduced.

## Exact identities

| Site | Retained source parent | OSM context | Address |
| --- | --- | --- | --- |
| CUBIX | `DEBE01YYK000097N`, five parts, tile392_5820 | way25112082 | Rathausstraße1 |
| RathausPassagen | `DEBE01YYK00003PR`, eighteen parts, tile392_5819 | way25094154 | Rathausstraße1–14 |
| Fernsehturm entrance | retained v155 sixteen-parent pavilion model | heritage09065023 | Alexanderplatz entrance opposite S-Bahnhof |

The spoken costume/Halloween shop is **Deiters**, Rathausstraße5, confirmed by
[the operator](https://www.deiters.de/l/berlin) and
[WBM's tenant page](https://www.wbm.de/gewerbe-berlin/rathauspassagen/sport-freizeit-reisen/deiters/).
[BowlingCenter am Roten Rathaus](https://www.bowling-am-roten-rathaus.de/Auf-einen-Blick/)
is at the same address in the basement. These are occupants of the long
RathausPassagen retail podium, distinct from CUBIX, Alea101 and the rear
Grunerstraße parking building. Current public sources establish their addresses
but not sufficiently precise exterior door locations: no guessed tenant sign
or fabricated underground opening is added.

## Architectural reading

[Tchoban Voss's project account](https://tchobanvoss.de/de/projects/cubix-am-alexanderplatz)
establishes the cinema completed2001, five main levels, nine auditoria behind
the public foyers and projecting glazed bays. Two inspected photographs by
Klemens Renner show the charcoal stone, three long projecting upper foyer
bands, small right-hand bays, corner returns, tall glazed entry and red CUBIX
lettering. The model adds that structure, silver mullions, slab undersides and
plain abstract poster fields. It does not reproduce film posters or neon poetry.

[WBM's current RathausPassagen view](https://www.wbm.de/gewerbe-berlin/rathauspassagen/)
shows brown panel fields, ten closely repeated residential window rows above
the pale commercial podium, a mostly closed end wall and vertical
RATHAUS PASSAGEN lettering. The three sixty-metre source facade segments and
their rear faces receive this repeated rhythm; the exact selected podium faces
receive shop glazing, pale floor bands and a shallow canopy. Backings cover only
the prior generic window interpretation at these exact faces. Source packets
and all earlier fittings remain retained and unchanged.

The [Fernsehturm operator's FAQ](https://tv-turm.de/faqs/) confirms that the
entry faces S-Bahnhof Alexanderplatz. Its source-bound fascia now identifies
the building, and fine geometric seams follow the existing measured folded roof
planes. The original v155 stairs, glass, rails, thin roof edges and open
cantilevers remain intact; there are no new ground-level obstructions.

All subdivision pitches, window and cladding colours, shallow projections,
letter sizes and roof seams are **reference-based display estimates**. The
metric evidence is only the retained official footprint/wall/roof geometry.
No reference photograph is shipped or used as a runtime texture.

## Implementation and bounded cost

`uv run python -m scripts.build_alexander_recognition_v257` reads the two
immutable retained source packets and writes a5,979-byte runtime anchor file.
Each selected face has its exact part/index, original endpoints, normal,
vertical limits and source-sheet SHA256. Complete building and packet hashes
independently identify the unchanged source. The bounded source adds no duplicate
building-shell payload.

`appendAlexanderRecognitionV257` runs once inside the existing
`AlexanderPublicRealm` builder before `finish()`. Both drawn mobile and desktop
use every fitting. Native mode separately samples orthogonal strips and stepped
letter/seam strokes; it does not reuse rotated drawn matrices. New instances
share existing block/round-member materials, draws and normal disposal.

| Family | Old group bytes retained | New instances | New bytes | Whole group bytes | Existing draws |
| --- | ---: | ---: | ---: | ---: | ---: |
| Drawn | 713,024 | 5,203 boxes +296 lines | 417,924 | 1,130,948 | 7 |
| Native | 1,026,900 | 24,690 axis-aligned boxes | 1,876,440 | 2,903,340 | 2 |

These are static geometry measurements, not a phone-memory guarantee. No
camera-dependent rebuild, new texture, fetch, animation or frame-loop work.
Targeted source tests check regeneration, all23 source parts, selected wall
receipts and podium containment. Frontend tests check independent finite native
geometry, full detail parity, nine upper glazed bays and bounded cost. Previous
pavilion navigation/ray-clearance tests retain their exact geometry hashes.

QA cameras (scene metres, fov55):

| View | Target | Camera |
| --- | --- | --- |
| CUBIX | `[2750,20,-88]` | `[2635,105,-215]` |
| RathausPassagen | `[2635,26,-10]` | `[2490,130,-155]` |
| Fernsehturm entry | `[2610,12,-182]` | `[2700,65,-250]` |

Reference-only images inspected from the architect and WBM sites are held in
the local QA cache, outside the repository. Copyright remains with Klemens
Renner / Tchoban Voss and WBM / the respective photographers. Their URLs and
reference-only restrictions are recorded in
`geo_data/regierungsviertel/alexander-recognition-v257-credits.json`.
