# Spanish Embassy at Lichtensteinallee 1 — v1.0.64

Step 10 replaces the five old main-building prisms and one separate solid portico
envelope owned by the Spanish Embassy with its complete official multi-part shell
and open four-column porch. The rebuilt chancery wing,
historic street wing, chamfered entrance corner and rear roof/stair profile remain
one measured composition. The existing 93-place tour is unchanged.

## Evidence and boundaries

- [Berlin heritage record 09050276](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050276)
  identifies the Krüger brothers' 1938–1943 ensemble, its two street wings and
  chamfered entrance. The entrance balcony rests on four columns; window height
  decreases upward. The 1998–2003 rebuilding retained historic facade character
  and replaced the old political emblems with the present Spanish coat of arms.
  The viewer therefore displays a crowned shield with flanking pillars.
- The [Spanish Embassy's official contact page](https://www.exteriores.gob.es/Embajadas/berlin/de/Paginas/index.aspx)
  confirms the current address, Lichtensteinallee 1.
- [Berlin LoD2 tile 387_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_387_5819.zip)
  supplies parent `DEBE01YYK0002NgP`, with five full official parts:
  `DEBE3DKqyIGjF11M`, `DEBE3DCzDC13dOb2`, `DEBE3DCVxytVlQkz`,
  `DEBE3DkGIMvGGC26` and `DEBE3DflaRtl1pZV`. The licence is dl-de/zero-2-0;
  the archive hash is retained in `spanishEmbassyV164Source.json`.

The previously documented tour anchor `DEBE3DCzDC13dOb2` is only the low inner
part, not the whole embassy. Its 5.5 m height must not become the building's
height. The complete source extends to viewer y = 30.860 m. The transformation
uses the minimum explicit source GroundSurface datum, 32.102 m NHN, mapped to
viewer y = 5.2 m. All other source elevations retain their relative differences.
Some wall closures extend 0.074 m below that floor; they are not flattened.

All 138 original boundary surfaces are retained as source rings: 82 walls,
19 roof planes, five ground surfaces and 32 internal inter-part closure faces.
All 101 exposed wall/roof polygons are triangulated without removing vertices
or replacing roofs with boxes. Ground faces and inter-part closures remain in
the evidence and navigation payload; they are not additional coincident visible
skins. The generator tests compare every rendered wall/roof triangle union with
its source polygon and any holes.

The separately modelled official building `DEBE01YYK0003Ul3` is the portico,
not another enclosed room. Its six boundary surfaces (four walls, roof and ground)
are retained separately in `replacedPorticoEnvelope`, bringing the retained source
total to 144 surfaces. The four enclosing LoD2 wall planes are evidence of an
envelope and are not rendered: the heritage record and inspected photos show
the open four-column balcony in that footprint. Desktop whole-scene QA caught
the former generic envelope hiding those columns; its exact source owner is now
replaced in both drawn and native paths, including navigation.

The exact displaced prism IDs are `yIGjF11M`, `DC13dOb2`, `xytVlQkz`,
`IMvGGC26`, `aRtl1pZV`, `K0003Ul3`. Adjacent `gsRPMIWr`, `K0002Mrk`
and all café/park assets remain independent. Native column suppression requires
both the original footprint and its matching original base/height, never a
blanket radius.

## Visual references and uncertainty

Two freely licensed images were inspected for external visual QA only:

| File | Author | Licence | Use |
|---|---|---|---|
| [Berlin - Spanische Botschaft.jpg](https://commons.wikimedia.org/wiki/File:Berlin_-_Spanische_Botschaft.jpg) | Marek Śliwecki | CC BY-SA 4.0 | Light grey-beige stone, dark windows, roof colour, decreasing window rhythm, four-column balcony and two poles |
| [SpanishEmbassyBerlinDetailCoatofArms.png](https://commons.wikimedia.org/wiki/File:SpanishEmbassyBerlinDetailCoatofArms.png) | Sargoth | Public domain, PD-self | Present crowned quartered shield and flanking pillars |

Photographs, crops, sampled textures and fonts are not bundled or loaded. Windows
and their surrounds are bounded procedural estimates clipped inside the measured
wall planes. The corner portico, capitals, balusters, stone joints, coat-of-arms
relief and small folded flags are independently authored recognition details;
their fine dimensions are not survey measurements. The flags use representative
folds, not new per-frame simulation. The compound is not presented as a public
walk-through interior.

## Runtime and validation

All four drawn modes use identical source/detail on touch and pointer devices.
Minecraft uses its independent surface-only two-metre shell and axis-aligned
small blocks at the entrance, with no smooth double and no solid interior fill.
All transforms are frozen once after construction. The source window repetition
is instanced; the entrance details are merged.

| Representation | Mesh submissions | Rendered triangles | Geometry/instance attribute bytes | Instances |
|---|---:|---:|---:|---:|
| Drawn | 3 | 25,502 | 363,528 | 1,506 |
| Native | 2 | 51,972 | 330,452 | 4,331 |

These are CPU-side attribute byte sums, excluding driver bookkeeping/materials.
They are not claims about whole-viewer or physical-iPhone memory. The existing
streaming, distance and mobile policies are unchanged.

Focused validation: three Python tests and four Bun tests pass, including exact
source polygon coverage, unique ownership, native roof edge cells, full/mobile
geometry equality, bounded native batches, axis alignment and frozen transforms.
The release integration owns whole-viewer browser and package validation.

Reproduction (the archive remains in the ignored raw directory):

```sh
uv run python scripts/build_spanish_embassy_v164.py
uv run pytest -q tests/test_spanish_embassy_v164.py
cd src/app
bun test tests/spanish-embassy-v164.test.ts
```
