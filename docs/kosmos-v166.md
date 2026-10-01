# KOSMOS — v1.0.66

This bounded refinement represents the actual **KOSMOS** event venue at
**Karl-Marx-Allee 131A**, formerly Kino Kosmos. The user phrase “Kino der
Kosmonauten” is a likely but **unconfirmed** match; no source establishes that
phrase as the venue's name. It does not become an invented map label or an
active cinema claim.

The [Landesdenkmalamt record 09085140](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09085140)
identifies the cinema, its 1959 design and 1960–1962 construction period,
the Josef Kaiser / Herbert Aust collective, low glazed foyer, pale ceramic
and silicate surfaces, and egg-shaped auditorium. The
[Berlin history walk](https://www.berlin.de/ost-west-ost-kulturbahnhoefe/en/history-walk/artikel.1604459.en.php)
confirms other use since 2005. The [current operator](https://www.kosmos-berlin.de/)
markets an event and conference venue. Its historical 1961 opening claim is
not substituted for the official inventory's construction dates.

The exact OSM way is `606479961`, with `amenity=conference_centre`,
`old_name=Kino Kosmos` and the operator website. Its complete current ring and
OSM tags stay in `kosmosV166Source.json`, along with OSM/official footprint
conflict areas, archive hashes, source URLs and licence metadata.

The existing Berlin LoD2 tile `394_5819` supplies three exact parents:

- `DEBE02YY200004oA`: historic foyer and oval auditorium, two parts.
- `DEBE02YY200002kP`: rear extensions and roof bodies, five parts.
- `DEBE02YY20001he2`: elevated inner connector, one part.

All **eight parts and 265 source boundary polygons** retain their original
polygon IDs, rings and holes. Every wall and roof is triangulated without a
footprint simplification. A common 37.785 m NHN datum maps to the existing
outer y=3 m ground; this preserves relative elevation across all three
parents, including the connector underside at y=6.012 m. No core LoD2 prism
is owned by this outer-only refinement.

[Matthias Süßen's September 2021 photograph](https://commons.wikimedia.org/wiki/File:Kosmos_Kino,_Berlin-msu-2021-352-.jpg),
**CC BY-SA 4.0**, was inspected for broad facade cues. The central glazed
field follows its three measured source plane divisions; procedural
ceramic bands flank it. Thin source-facet masonry joints follow the curved
upper auditorium, and authored KOSMOS lettering sits on the left panel.
Member sizes, individual tile distribution and colours remain estimates.
The image is external reference only: no photo, crop, texture, poster or
protected logo artwork is bundled. Per-file credit is recorded in
`kosmosV166Evidence.json` and `/tmp/kosmos-v166-attribution.json` for the root
release merge. A temporary event canopy is not inferred as permanent building
geometry from the reference photo.

Drawn geometry uses **two batches / 159,936 bytes**, including 1,158 facade
instances; pointer and touch receive identical static detail. Independent
Minecraft geometry uses **one batch / 3,840 blocks / 292,488 bytes**. Native
facade cues are orthogonal cubes, with a small outward display offset to
remain legible beyond the source block skin. No smooth model survives in
that mode. Roof navigation follows the actual measured triangles and native
source cells; exact source parts remain available to the central collision
owner.

The isolated `/tmp/v166-kosmos-packets` candidate removes only the three
coarse owners from tile `10_0`. It subtracts the exact owned triangle
multiset, preserving all later Karl-Marx-Allee refinements. The audit proves
**81,675 drawn / 119,174 native unowned triangles** and **215 unowned
navigation records** remain. Road, ground, water and bridge navigation stay
byte-equivalent as JSON values. Root applies the candidate and integrates
`createKosmosV166`, `createMinecraftKosmosV166` and `kosmosV166Profile`.

Focused validation: three Python tests compare every original source polygon
against its rendered area, check the exact identities and elevated connector,
and validate independent blocks. Three Bun tests verify measured/native roof
queries, two/one GPU batches, orthogonal native instances and full touch
parity (5,467 assertions). No full-world build or browser run is performed
by this bounded module task.

```sh
uv run python scripts/build_kosmos_v166.py
uv run pytest -q tests/test_kosmos_v166.py
cd src/app
bun test tests/kosmos-v166.test.ts
```
