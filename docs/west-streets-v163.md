# City West street fronts, v1.0.63

Pipeline step 10. This is a finite refinement of **Kurfürstendamm,
Uhlandstraße, Fasanenstraße and Meinekestraße**, clipped to the existing
v1.0.59 polygon. No new borough, terrain coverage or tour stop is introduced.

## Sources and coverage

The retained Geofabrik Berlin extract (29 September 2026, OpenStreetMap,
ODbL 1.0) supplies the complete named ways in the approved area. Both mapped
carriageways and separately mapped named footways remain distinct. The source
record contains 303 way identities, original source tags and projected
vertices. The reported line lengths count both carriageways where mapped;
they are not a claim about a boulevard's single centreline length.

The 43 m frontage search selects 360 outer Berlin LoD2 parents and 324
already displayed core prisms. Actual official building parts replace only
those explicitly identified **outer** parent envelopes. Their complete roofs,
setbacks, wings, source heights and courtyard holes survive. Every official
ZIP URL and SHA-256 is retained in
`geo_data/regierungsviertel/west-streets-v163.json` under dl-de/zero-2-0.
Eleven parents at the outer or retained-core boundary keep their existing clipped
source massing; the exporter does not publish unapproved geometry beyond that edge.

Core facades are an additive overlay on the exact delivered prism planes and
height ranges. All existing solids remain available before the detail packet
arrives and after it leaves memory. They are not replaced with inferred taller
buildings, and measured components are not stretched to fit a generic shell.
Existing City West hero identities—including the Kranzler ensemble and
Allianz-Haus—are excluded from this generic frontage pass. Dedicated hero
geometry remains independently owned.

The district's descriptions establish the mixed historic and modern boulevard
character and the commercial street frontages:

- [Kurfürstendamm](https://www.berlin.de/sehenswuerdigkeiten/3561166-3558930-kurfuerstendamm.html)
- [Fasanenstraße](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/strassen/artikel.180243.php)
- [Wintergarten ensemble](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/villen/artikel.196549.php)
- [Maison de France](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/frankreich/charlottenburg-wilmersdorf/maison-de-france-647620.php)

These are contextual references, not a claim that every individual window has
been surveyed. Bay and storey rhythm, glass, pale stone surrounds, small sills,
cornices and ground-floor shopfronts are restrained procedural indications.
Each field fits completely within its source facade polygon and faces a mapped
street. The model does not invent balconies, extra building wings or shops by
random number. No photograph, crop, sampled colour, font or runtime texture is
used; no new Wikimedia attribution is required by this change.

## Streets and pavement ownership

The asphalt boundaries come from the existing resolved outer OSM surfaces and
the unchanged delivered core road polygons. The supplement adds shallow curb
tops and vertical rises along those boundaries, plus pale sidewalk strips.
Junctions remain open because their asphalt polygons are unioned before edge
extraction. Source building footprints and water are subtracted from the
sidewalks. Neither cell boundaries nor artificial corridor cuts receive a
transverse curb. All original road/path/park/water triangles and navigation
records remain present.

An untagged 3.3 m sidewalk width and the curb's 19 cm rise are display values,
not cadastral or accessibility measurements. The outer street plane keeps
y=3 m; core City West retains its existing 5.2 m datum. Native mode uses a
separate orthogonal street and facade reading. The four drawn modes share the
same full geometry on phones and computers.

## Loading and preservation

Everything is prepared offline into the existing 512 m streaming grid. There
is no new constructor, worker, texture, global geometry cache or simultaneous
second representation at startup. `SurroundingCity` keeps its existing serial
fetching, cooperative decoder, cancellation, visibility selection and eviction.
Facade additions in an existing cell append to its packet. A previously empty
core cell gets empty navigation and does **not** change the surrounding-city
ground footprint or take terrain ownership from the detailed core.

The exporter compares each replaced packet to its independently regenerated
prepared-source baseline, then proves that all unowned coloured source
triangles remain. Ground, road, water and bridge navigation is retained exactly,
including its original vertex ordering. Drawn and native payloads must remain
under the existing 12 MiB decoded packet and per-mesh vertex/index limits.
`west-streets-v163-audit.json` records the final packet and source-part counts.

The exporter writes an **isolated patch** so independent geographical changes
cannot overwrite one another's shared manifest:

```sh
uv run python scripts/build_west_streets_v163.py --out /tmp/west-streets-v163
uv run pytest tests/test_west_streets_v163.py
```

Copy only its listed drawn/native packets into the public surrounding folder,
then merge each descriptor by `id` and its `source.westStreetsV163` field into
the current manifest. Do not replace the manifest wholesale. Source extraction
can be reproduced with `--refresh-source` from the already retained raw data.

Useful camera targets in world metres are the Ku'damm/Uhlandstraße junction
near `[-3190, 20, 1730]`, Fasanenstraße's southern street front near
`[-3000, 15, 1830]`, Meinekestraße near `[-2920, 15, 1890]`, and western
Kurfürstendamm near `[-4630, 20, 2320]`.
