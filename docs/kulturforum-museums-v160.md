# Kulturforum museum refinements, v1.0.60

Pipeline step 10. The Gemäldegalerie and Kunstgewerbemuseum now use their
complete official wall/roof surfaces instead of the older approximate boxes.
The museum and source records remain distinct from the shared Kunstbibliothek
wing and the five Lennéstraße buildings, which are preserved.

## Retained metric sources

`kulturforumMuseumsSource.json` retains three whole official LoD2 bodies:

| Body | Source ID | Ground / wall / roof polygons |
|---|---|---:|
| Kunstgewerbemuseum | DEBE01YYK0002QYw | 1 / 117 / 1 |
| Gemäldegalerie, main body | DEBE01YYK0002Sq5 | 1 / 95 / 7 |
| Gemäldegalerie, northern body | DEBE01YYK0002V5W | 1 / 9 / 2 |

All **234 polygons**, their individual rings, original IDs and unchanged old
prism records remain retained. The two source ZIP hashes, 2 March 2026 source
date and EPSG:25833 origin `[389500, 5820000, 30]` are recorded. Tiles
[388_5818](https://gdi.berlin.de/data/a_lod2/atom/LoD2_388_5818.zip) and
[389_5818](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5818.zip) use
Geoportal Berlin's dl-de/zero-2-0 licence. Reproduce with
`uv run python -m isometric_berlin.generation.build_kulturforum_museums`.

The corrected roofs use their absolute NHN elevations, avoiding the old
addition of below-street foundation height to the delivered terrain. Main
Gemäldegalerie roof heights are 16.608–20.802 m in the viewer coordinate frame;
its northern body reaches 26.446 m. The Kunstgewerbemuseum roof is 21.693 m.
Only subterranean wall portions are clipped to the existing street ground.
No source coordinates or street levels are rewritten.

**Source limitation:** the Kunstgewerbemuseum is one generalized, flat-roof
LoD2 body. It must not be called a surveyed model of every terrace or service
structure. The exact source courtyard remains open. Additional facade members
and shallow roof details are procedural display interpretations.

## Architecture and inspected references

The [SMB architecture account](https://www.smb.museum/fileadmin/website/Institute/Institut_fuer_Museumsforschung/Publikationen/Mitteilungen/MIT039.pdf)
identifies the Kunstgewerbemuseum's red-brick cladding, exposed concrete and
metal subdivisions. Its earlier pale boxes and gold concert-hall-style canopy
were incorrect. Source-edge brick fields, vertical fins, restrained pale
courses, aluminium entrance-wing frames, glazing and red institution lettering
now supply that vocabulary. The facade structure follows source edges; bay
spacing and intermediate member dimensions are explicitly not a survey.

The [Gemäldegalerie's museum association](https://kaiser-friedrich-museumsverein.de/sammlung/museen/gemaeldegalerie-kulturforum/)
describes the rusticated base and blind upper windows on the street facades.
Those upper fields now contain pale stone instead of the former blue glass.
Lower glazing, dark metal joints, pale stone courses, source-aligned doors,
transoms, pulls and open approach rails remain legible. Entrance registers
continue the bounded Piazzetta interpretation; they are not a door-by-door
survey of the shared lobby complex.

The Gemäldegalerie entrance register uses the exposed eastern edge of the
retained shared foyer `DEBE3DUxjfT1esZV` (parent `DEBE01YYK0002SFk`), from
`[-381.5,1102.1]` to `[-388.3,1124.5]` in the viewer's horizontal frame.
This is a facade-only register: that foyer keeps its original body and native
columns and is not added to the three replacement IDs. It avoids hiding the
doors on the internal wall between the gallery and foyer. Native facade blocks
sit beyond the retained four-metre column envelope. Both museum signs use the
exterior viewer's left-to-right direction; drawn and native tests check the
actual lettering instance positions. A clear exterior QA camera is
`[-354,20,1115]`, looking at `[-384.9,8,1113.3]`; sampling its sightline against
the retained source prisms found no intervening building.
Native glyphs additionally clear the complete axis-aligned fascia envelope by
0.08 m, preventing the stepped aluminium blocks from covering parts of letters.
Tests check every glyph's separation and actual mesh rays from frontal and
oblique directions for both captions. Drawn sign positions remain unchanged.

Actually inspected external photographs:

- Marsupium, [Kunstgewerbemuseum Berlin Kulturforum entrance.jpg](https://commons.wikimedia.org/wiki/File:Kunstgewerbemuseum_Berlin_Kulturforum_entrance.jpg), CC0-1.0, 20 May 2016: red brick, concrete bands, silver wing, glazing and recessed doors.
- Oursana, [Gemäldegalerie am Kulturforum Berlin.JPG](https://commons.wikimedia.org/wiki/File:Gem%C3%A4ldegalerie_am_Kulturforum_Berlin.JPG), CC0-1.0, 2015: pale panelled common entrance and tall framed glass.
- Fridolin freudenfett / Peter Kuley, [TiergartenSigismundstraße-2.jpg](https://commons.wikimedia.org/wiki/File:TiergartenSigismundstra%C3%9Fe-2.jpg), CC BY-SA 3.0, 16 April 2011: stone-filled blind windows and rusticated lower facade. The adjacent Villa Parey is not replaced by this model.

The [official DOP 2025 spring image](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
was inspected at EPSG:25833 bounds `[388930,5818760,389270,5819050]`, layer
`dop_2025`. It confirms the Gemäldegalerie's continuous rooflight fields and
three rows of small central lanterns, plus the Kunstgewerbemuseum's gravel
roof, coping and service heads. The new glass panels are projected onto the
original roof planes; the 0.45–0.49 m lantern upstands, repeated spacing and
shallow 0.28–0.31 m service-head cues are bounded display estimates. The
source roof planes remain underneath in full. No invented high terrace
volumes are introduced. Aerial parallax is not treated as metric facade data.

No photograph, orthophoto, crop, poster artwork or texture is bundled or loaded.
The three newly used Commons files are credited in the mirrored manifests.
Existing required OSM/Geoportal attribution remains intact.

## Musikinstrumenten-Museum preservation

The [v1.0.11 corrected model](music-museum-correction-v111.md) stays intact:
15 source parts / 158 polygons, fourteen full-width rooflight bands, the
8.053 m source entrance canopy, original roof planes and exact source-cell
ownership. The neighboring Philharmonie low wing `K0003VMd` is not claimed.

The existing Andreas Praefcke photograph was inspected again. The public
entrance gains leaf divisions, silver transoms and six slim door pulls below
the unchanged canopy. Both tall oval openings gain explicit thin metal rims;
Minecraft uses stepped rims. Roof shape, public passage, gold triangular field,
slit windows and institute facade remain present. Every Lenné-only instance
record was compared with v1.0.59 and remains byte-identical: drawn full/mobile
6,922 each; native full/mobile 4,031 / 4,410.

## Runtime and checks

All four drawn modes use byte-identical static detail on touch and pointer.
Minecraft replaces the three exact source-owned column families with its own
surface-only two-metre block interpretation; it keeps the courtyard open and
never draws the smooth museum over it. Native ownership requires the exact
old source height quantisation, so taller neighboring buildings are retained.
The navigation roof callback uses the retained source roof planes / native
roof grid; small lanterns and parapet details are decorative.

| Complete layer | Draw calls | Instances | Geometry and instance bytes |
|---|---:|---:|---:|
| Gemälde + Kunstgewerbe, drawn full/mobile | 2 | 2,726 | 269,816 |
| Gemälde + Kunstgewerbe, native full/mobile | 1 | 19,143 | 1,455,228 |
| MIM + unchanged Lenné, drawn full/mobile | 2 | 11,262 | 900,924 |
| MIM + unchanged Lenné, native full | 1 | 12,326 | 937,424 |
| MIM + unchanged Lenné, native mobile | 1 | 12,286 | 934,384 |

The new evidence JSON is 55,360 bytes and compact navigation subset 7,756 bytes.
Focused tests check complete archive reproduction, all retained source prisms,
finite/bounded geometry, exact drawn touch/pointer parity, downward roof rays,
open courtyard rays, exterior-facing doors and readable lettering, conservative native ownership and
all existing MIM roof/canopy/neighbor/gap contracts. Ruff and TypeScript pass.
Browser / release validation is recorded in the combined release review; these
geometry tests do not claim physical-device testing.
