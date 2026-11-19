# Nikolaikirche: corrected exterior

The previous church looked like a beige apartment building: the general Alt-Mitte
facade recipe placed ordinary rectangular windows on its two LoD2 parts, and the
generalized tower roof formed one large asymmetric gable beneath the two added
spires. V353 replaces that exact church-owned geometry with a specific exterior.

The westwork now has grey fieldstone courses and irregular stone colour variation,
a darker lower stage, a lighter upper stage and two oculi. At the west entrance,
the stepped stone surround frames the two timber door leaves. The low lights
and plaques are separate from the entrance. The brick belfry has two dark Gothic window
groups, clock faces, pale blind-lancet panels and cornices. Each copper helmet has
its own flared base, narrowing profile, standing seams and gold terminal. The hall
has a longitudinal terracotta roof and polygonal choir end; the southwest
Liebfrauenkapelle and northern sacristy receive separate lower roofs. The chapel's
stepped front and the tall hall windows are exterior interpretations.

## Evidence and limits

The complete original source family `DEBE01YYK00001VX`, with tower part
`DEBE3DJ5QoacFhgE` and hall part `DEBE3DUWfKmI0Hwu`, remains in the immutable V169
and V239 sources and is copied into the V353 source receipt. Its exact footprint,
ground at display Y=3 m, hall ridge elevation and tower placement remain anchors.
The mapped total height is 84.4 m above that ground.

The [Berlin monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011267)
establishes the fieldstone westwork, brick hall with ambulatory, side chapel,
sacristy and reconstructed twin towers. The contracted restorer's
[2016–2021 project photographs and facade drawings](https://www.rao-berlin.de/projekt/denkmalrestauration-der-nikolaikirche-berlin/)
show the material divisions, paired Gothic openings, west clock faces and copper
profiles. The [museum operator](https://www.berlin.museum/museum/nikolaikirche)
confirms the current building identity and reconstructed museum exterior.

Facade bay dimensions, stone-joint pattern, colours, roof subdivisions and copper
profile proportions are bounded photographic display estimates, not a measured
facade survey. The original LoD2 two-plane roofs are retained as source evidence,
but explicitly superseded where their generalized shape contradicts the exterior
photographs. No copyrighted photograph is distributed as a texture. No interior,
new entrance route or individual-stone reproduction is claimed.

## Exact ownership and loading

Five source-quarter transactions share the lifetime of their existing hosts:

| Host / mode | Exact old church material superseded | Successor |
| --- | --- | --- |
| `4_0`, Drawn | 2,611 shell and generic-facade triangles; two navigation records | Church body, openings and corrected roof navigation |
| `4_0`, Native | 3,906 church surface triangles; two navigation records | Independently cardinal body and roof-column navigation |
| `nikolai239-4_0`, Drawn | 1,524 old church-fitting/spire triangles | Separate copper helmets and terminals |
| `nikolai239-4_0`, Native | 16,584 old church-fitting/spire triangles | Independently cardinal copper helmets |
| `4_0-alt-mitte-v169-1`, Drawn | 473 exact old church wire segments | Corrected eave/ridge lines and real thin eave cappings |

All other buildings, fittings, source words, materials, ground, roads, water and
navigation remain outside those transactions. Raw public source packets are not
edited. Complete raw/prepared fingerprints and navigation/ink guards must match
before replacement. Missing or altered successors leave the original local
source intact. The neighbouring-house recipes precede the church in the catalogue;
their corrected faces are explicitly outside the church retirement.

Native uses its own one-metre footprint columns, analytic roof and helmet profiles,
cardinal facade planes and stepped Gothic openings. It is not a snapped Drawn mesh.
The compressed recipe is loaded only for these hosts, bounded before inflation,
and reconstructed weakly. Existing streaming/disposal, all six modes, full mobile
detail and live/startup/Worker budgets are unchanged.

## Verification

`src/app/tests/nikolaikirche-v353.test.ts` runs the actual production decoder in
both representations, checks every old raw vertex/material word and all unrelated
index words, checks the complete navigation complement and exact ink retirement,
and exercises changed-source/missing-successor failures. Native faces are checked
for cardinal normals. `tests/test_nikolaikirche_v353.py` independently reconstructs
the original source recipes and checks their exact retirement, the measured plan
coverage and the bounded architectural additions.

Reproduce after the neighbouring-house recipes are final:

```sh
uv run python scripts/build_nikolaikirche_v353.py /tmp/nikolaikirche-v353
uv run python scripts/build_nikolaikirche_v353.py /tmp/nikolaikirche-v353 --capture
uv run pytest tests/test_nikolaikirche_v353.py -q
cd src/app
bun test tests/nikolaikirche-v353.test.ts
```

The capture invokes the production predecessor preparation in catalogue order;
`--plans` can also consume an existing completed capture. Browser review of the
actual west/east views is recorded in the parent V353 release evidence.
