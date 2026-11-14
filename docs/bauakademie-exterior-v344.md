# Bauakademie: present remnants, exterior v344

The existing Musterecke and Roter Saal receive bounded architectural relief.
No complete future Bauakademie, former printed scaffold facade or guessed site
building is added. Neither source body nor navigation is removed or replaced.

## Evidence and present state

The [Bundesstiftung's site description](https://bundesstiftung-bauakademie.de/gebaeude/standort-und-grundstueck)
identifies the 2001/2002 reconstructed northeast corner and the 2004/2005 sample
room built as exposed brickwork. The [Errichtungsstiftung's current sample-facade
page](https://www.errichtungsstiftung-bauakademie.de/musterfassade.html), updated
6 November 2026, explicitly distinguishes the two retained remnants from the
scaffold enclosure dismantled in December 2019.

Photographic references visually inspected on 14 November 2026:

- [Bundesstiftung history](https://bundesstiftung-bauakademie.de/gebaeude/geschichte/geschichte-der-bauakademie), Anke Illing photograph of the freestanding Musterecke: red brick, projecting cornices, large subdivided window groups and small upper windows.
- [Errichtungsstiftung sample facade](https://www.errichtungsstiftung-bauakademie.de/musterfassade.html): photographs by Horst Draheim and Renate Schoele show the two real elevations, segmental ground-floor window heads and terra-cotta bands.
- [Bundesstiftung's 2024 Eiche project](https://bundesstiftung-bauakademie.de/gebaeude/geschichte/projekt-eiche), exterior photograph “Eröffnung Eiche 2”: exposed-brick Roter Saal with tall, pale-framed glazing alongside the freestanding sample corner. The temporary projection artwork is not copied into the model.

Brick colour, masonry cadence, window subdivisions and decorative panels are
compact display interpretations of those photographs, not a survey of every
brick or relief. The Musterecke's diagonal source backing receives brick
material but **no invented third historic window facade**. The hall's opening
rhythm is an approximation within its exact retained footprint. No photographic
textures or external runtime image requests are used.

## Exact admission and source preservation

`createBauakademieExteriorV344(prisms, voxels?)` returns a `Group`, which can be
empty. Each remnant requires the complete exact existing prism identity,
footprint, holes, base, height, class, roof and tone:

| Remnant | Existing prism | Drawn height | Actual Native receipt |
| --- | --- | --- | --- |
| Musterecke | `45095631` | 21 m | One existing 4 m column, base 5.2 m, top 29.2 m |
| Roter Saal | `14046275` | 5 m | Fifteen existing 4 m columns, base 5.2 m, top 13.2 m |

The source Native heights differ from Drawn. This additive treatment preserves
those existing heights and distributes the same architectural reading over the
actual column faces; it does not claim the coarse Native heights are surveyed
corrections. Missing or modified source/column records suppress the affected
remnant. Native decoration is independently placed on four cardinal column
faces, never rotated from the triangular Drawn geometry. Adjacent low temporary
columns are excluded by the pinned source height and source-plan centres.

Reproduce receipts with
`uv run --no-sync python scripts/build_bauakademie_exterior_v344.py`.
Input sources are the current checked-in `lod2-prisms.json` and
`minecraft-voxels.json`, retaining their existing project-wide credits.

Drawn uses 3,944 instances, 24 grouped openings and 299,744 instance bytes;
Native uses 5,156, 34 and 391,856 bytes. Both stay within three material/shape
batches, without textures, new load phases, residency changes or a reduced
mobile variant. `tests/bauakademie-exterior-v344.test.ts` passes three tests:
unchanged source data, bounded remnant-only geometry, cardinal Native matrices,
and rejection of changed/absent sources or columns.

QA: a camera east/northeast of `[1871, 341]` shows the two historic window faces;
the view from the Schinkelplatz modern buildings sees the preserved diagonal
source backing, now brick-red rather than a bare grey prism. The separate low
Roter Saal is centred near `[1858, 365]`.
