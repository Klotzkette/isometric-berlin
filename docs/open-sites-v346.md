# Hellweg and Humboldthain — measured complete bodies

V346 resolves the missing building-part evidence recorded in the V345 audit.
It adds complete official LoD2 bodies at the two exact retained core owners.
This is a measured exterior correction, not a claim to have surveyed the
interiors, signs or every window. Huxleys and Wollankstraße are documented in
their separate V346 notes.

| Site | Previous core owner | Complete official parts | Drawn triangles | Native instances |
| --- | --- | ---: | ---: | ---: |
| Hellweg, Ellen-Epstein-Straße 1 | `35139658` | 4 | 193 | 622 |
| Humboldthain reception | `44093193` | 2 | 134 | 324 |

The official source archives are `LoD2_388_5821.zip` and
`LoD2_390_5822.zip` from the credited Geoportal Berlin LoD2 collection.
`open-sites-v346-source.json.gz` retains the full selected source sheets,
archive/input hashes and old/new footprint differences. The compiler requires
the complete named parent/leaf families; it does not pick a building by its
nearest centroid.

Hellweg's parents are `DEBE01YYK0002M4y` (three parts) and
`DEBE01YYK0003Uh4` (the adjacent side body). The old body had an arbitrary
3 m height. The new source distinguishes the long hall, lower entrance strip,
taller small roof element and side body, with all measured roof facets. Their
union covers 99.6359% of the old 9,851.195 m² polygon. The remaining 0.3641%
sliver is retained unchanged, as is the complete original body; the addition
does not turn a small source mismatch into erased geometry.

Humboldthain's parent `DEBE01YYK0003tq8` contains the two measured reception
parts `DEBE3DG8DPQNb3ri` and `DEBE3DRq7j8Z2uPp`. These cover 66.8423% of
the old combined reception/bridge/stair polygon. The older bridge, stair
branches and platform context remain; this pass does not claim to reconstruct
the entire station. The [Landesdenkmalamt station record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030444)
distinguishes the polygonal reception, enclosed connection and stepped stair
roofs. Its yellow ceramic description concerns the interior, not yellow exterior
paint. The new external plaster is a restrained estimated warm neutral.

Hellweg's [operator page](https://www.hellweg.de/markt/berlin-tiergarten/)
identifies the address. The [TLG 2015 property report](https://www.tlg.de/tlg.de/Data%20Objects/Downloads/Hauptversammlung/2018/Tagesordnungspunkt%207/DE000A12B8Z4-JA-2015-EQ-D-00.pdf),
PDF page 43 / printed page 37, supplies a site-specific aerial reference for
the hall and side building. It is historical architectural evidence, not proof
of present trading status. No future OBI brand, guessed sign position or
unverified entrance openings are represented. No reference-image pixels ship.

## Height, source preservation and navigation

Every source XZ coordinate and relative roof height is retained in Drawn.
The common vertical offset aligns the principal source ground datum with the
existing core ground: −0.27 m at Hellweg and −3.842 m at Humboldthain. This
registration is a display estimate, not a claim of freshly surveyed absolute
ground. All relative part heights are unchanged. Native is independently built
from one-metre footprint cells and quarter-metre source roof heights. Only
adjacent equal-height cells merge into runs; no sloped Native members are used.

Admission requires the unique complete original prism signature. Native also
requires every exact original `(x,z,lo,hi,kind)` column tuple and cell size.
No older triangle, line, column, navigation record or source file is retired.
The new mesh includes its own full walls and roof: unloading a separate old
core batch cannot leave its façade fittings floating.

`ThreeViewer` constructs these additions inside each existing provisional world.
They dispose with that world and are neither separate persistent overlays nor
new Worker geometry. Roof and solid queries belong to the same world, use the
same represented roof heights and require the full privately sealed model.
They stop on hidden, detached, disposed or structurally changed geometry. A
low-level walker is not snapped onto the roof. Original navigation remains.

All six modes and complete Drawn touch detail use the same construction.
The source uses the existing lossless weak JSON getter and existing static
matrix parking. There is no runtime source fetch, new decoder, timer, texture,
tour stop or increased live budget.

## Verification

```sh
uv run python -m scripts.build_open_sites_v346 --check
bun test src/app/tests/open-sites-v346.test.ts
```

The tests verify exact source and Native admission, unchanged input bytes,
complete part counts, cardinal matrices, roof ray hits versus walking heights,
wrong/absent/duplicate source rejection, all material variants, lossless source
decoding, matrix parking, and immediate navigation closure when its model is
hidden, detached, changed or disposed.
