# Danziger Straße — finite street fronts, v244 / step 10

This small addition supplies glazing, thin light window frames, sills and two
horizontal facade edges on previously unfitted ordinary source buildings along
Danziger Straße. It changes no original city packet, envelope, roof, courtyard,
walking solid, pavement or street. Existing authored buildings and older facade
owners take precedence. Opening spacing, fitting dimensions and glass colours
are explicit display estimates rather than surveyed individual elevations.

## Retained source and scope

`danziger-fronts-v244-source.json.gz` freezes all **118** named primary-road ways
from `raw/outer-v159/candidate.gpkg`, the complete relevant mapped polygons,
current primary-packet SHA-256 receipts, complete source-building records and
individual accepted wall endpoints. The course runs from viewer X approximately
2803 to 5194, not merely the previously covered western tip. There is no owner
quota: all qualifying, visible, exact wall faces are retained.

The earlier v188 district selection excluded Prenzlauer Berg, while v209's local
Kollwitz/Helmholtz/Weinbergsweg treatments and v230 did not select Danziger street
faces. Thus this addition addresses an actual gap and does not cover existing
fitted windows with a second grid.

Of 370 scanned source parts, 46 are protected by earlier authored ownership,
43 by mapped special uses, named architecture, materials or a primary heritage
locator, and 23 are outside the ordinary-height range. The output contains
**138 faces belonging to 118 DEBE source owners**. A face is accepted only when
both triangles of its complete wall are present in the delivered old mesh;
navigation-only cuts cannot become fake street walls. Party/courtyard walls,
blocked approaches and geometry extending outside a primary tile are rejected.
124 faces have an unambiguous mapped building-level value. Remaining storey
spacing is estimated from the retained source height.

Native mode independently uses **599** exposed, axis-aligned spans of the same
owners' actual native walls. Each retains its complete original wall endpoints
and source-building record. These are not globally rotated drawn planes or new
block envelopes.

## Architectural boundaries

The primary [Danziger Straße 57 entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075102)
identifies Eugen Reethen's 1893–94 corner building and later workshop at
Senefelderstraße 35. Its official locator matches retained OSM **41724936** and
DEBE **DEBE03YY60000CKO**; this distinctive owner is expressly protected from the
ordinary grid. Its roof is not reconstructed from secondary descriptions.

The [school at Danziger Straße 50](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09070139)
is documented as Blankenstein/Dylewski's 1892 design, built 1893–94. Its official
locator is retained as a protection reference; it intersects none of the newly
selected ordinary street walls. No unsupported school facade is invented.

The architect's [Paragon Apartments account](https://graftlab.com/projects/paragon-apartments)
records varying-depth balcony cubes, an open corner and three courtyards. The
named mapped complex **OSM 17959154** is protected, alongside the Bruno-Taut
building **96216538**, Theater unterm Dach **18676381**, Advent-Kirche **30016539**,
SEZ **24266185** and other source-marked public buildings. Full protected IDs and
reasons remain in the frozen source, not a blanket historical style assumption.

## Measured output

| Family | Windows | Vertices | Decoded geometry | Transfer bytes |
|---|---:|---:|---:|---:|
| Drawn desktop and mobile | 2,557 | 82,928 | 1,243,920 B | 480,255 B |
| Independent native | 3,046 | 77,896 | 1,168,440 B | 365,226 B |

Eight parent tiles each receive one descriptor with both families and a single
mesh per family. Combined transfer is **845,481 B**. The largest drawn asset is
119,267 B; the largest native asset 106,037 B. Source evidence is offline-only.
The standard decoder, residency, prefetch, cancellation, disposal and navigation
paths remain unchanged. No worker imports or new model constructors are added.

The grid retains 7–75 m existing face lengths and 7–36 m eligible heights. Small
estimated drawn panes are 1.32 × 1.80 m; native panes 1.15 × 1.40 m; frame strips
are 7 cm, the sill plane lies 13 cm forward, and cornice/base strips are 13 cm
high. These are shallow details against real walls, with no new collision mass.

## Reproduction and verification

```
uv run python scripts/build_danziger_fronts_v244.py
uv run pytest -q tests/test_danziger_fronts_v244.py
```

The generator replays the frozen source and writes only its sixteen new packet
files, evidence and `danziger-fronts-v244-manifest-addition.json`. The coordinated
v244 integration owns manifest publication. Five independent tests inspect the
retained road inventory, protected footprints, every actual two-triangle wall,
full native source spans, per-rectangle containment and orthogonality, immutable
packet receipts, byte counts and unchanged empty navigation. Shifted walls and
fake partial-wall seams are explicitly rejected. The emitted native glass is
also checked against every original neighbouring native footprint; native
window omissions use their own spacing and geometry, independently of drawn.

Browser probes (viewer coordinates; elevation may be adjusted for camera style):

| Position | Eye | Target | Exact source owner |
|---|---|---|---|
| West | (3005.80, 10, -2350.17) | (3012.34, 10, -2374.30) | DEBE03YY60000D4h |
| Middle | (3576.57, 10, -2193.04) | (3569.84, 10, -2168.96) | DEBE03YY600005VR |
| East | (4537.02, 10, -1575.81) | (4552.90, 10, -1595.12) | DEBE03YY600007vn |
