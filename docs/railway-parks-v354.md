# Southern railway parks · V354

The finite refinement follows the mapped Dora-Duncker-Park (formerly
Flaschenhalspark), Nord-Süd-Grünzug, Hans-Baluschek-Park and Naturpark
Schöneberger Südgelände. Existing ground, active railway, older park geometry
and navigation are retained byte for byte outside the explicitly added solids.

The new host-owned meshes contain 76 mapped trees, material/edge detail on 56
supported path fragments, and 48 visible retired-track fragments beside mapped
paths. Remote, overgrown traces retain the previous representation. The two
parts of the mapped 1.4 m steel-grating walkway use the recorded 0.5 m elevation;
end transitions and grating are display approximations. No public cycle route
is invented inside Südgelände. Source routes with unverified bridge levels,
steps, tunnels or inaccessible structures are excluded from this addition.

The red Südgelände water tower uses its mapped position and footprint, the
operator's documented 50 m height, an open four-column steel frame, central
pipe, cross members, rounded tank and gallery. The nearby turntable uses its
mapped centre and documented 23 m diameter. Tank fittings, tree crowns,
sleeper spacing and turntable details are photographic estimates. Existing
terrain is not excavated to invent an unmeasured pit depth.

## Evidence

- [Dora-Duncker-Park — Grün Berlin](https://gruen-berlin.de/projekte/parks/dora-duncker-park), photographs © Lichtschwärmer.
- [Hans-Baluschek-Park — Grün Berlin](https://gruen-berlin.de/projekte/parks/hans-baluschek-park), photographs © Grün Berlin.
- [Südgelände water tower](https://www.natur-park-suedgelaende.de/bahntechnik-industriekultur/wasserturm/), drone photographs © Frank Sperling.
- [Turntable](https://www.natur-park-suedgelaende.de/bahntechnik-industriekultur/drehscheibe/) and [round paths](https://www.natur-park-suedgelaende.de/entdecken-erleben/rundwege/), Grün Berlin.
- OSM Berlin extract dated 2026-11-13. Exact selected coordinates and tags are
  retained in `railway-parks-v354-source.json.gz`; photos are not distributed.

Each Drawn and Native packet independently binds its complete raw and prepared
predecessor. Native paths, tanks and trees use cardinal construction. The
production test compares every old decoded position/colour/index and material,
retains the exact old navigation prefix, and admits only the declared added
solids. All live residency, packet and Worker ceilings remain unchanged.

The existing `network-fidelity-v326:raw` decline at host `-1_7` was observed in
the published predecessor and remains unchanged; it is not repaired implicitly
by this park work. `capture_railway_parks_v354.py` and the bounded production
capture script record the actual current predecessor before recompilation.

An independent pre-publication tree audit compared all 76 new mapped points
with 45,540 retained park-tree anchors (nearest separation 191.91 m), and
searched the actual previous prepared meshes for elevated green triangles
within 3 m of each new point. Neither check found an existing tree duplicate.
The audit is retained in the V354 release workspace.
