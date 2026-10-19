# Kulturforum, civic architecture and Steglitz — v1.0.146

This is a finite source-bound recognition pass, with complete mobile detail,
independent orthogonal Minecraft geometry and unchanged live memory limits.
It neither expands city coverage nor adds streaming descriptors, textures,
per-frame animation or tour stops.

The full engineering/source records are in
[kulturforum-piazzetta-v246.md](kulturforum-piazzetta-v246.md),
[nordic-kas-v246.md](nordic-kas-v246.md), and
[steglitz-details-v246.md](steglitz-details-v246.md).

## Party buildings and Robert Koch

`geo_data/regierungsviertel/civic-v246-source.json` retains exact OSM footprints,
complete existing core prisms and the delivered Rosa-Luxemburg-Stiftung surfaces,
plus hashes of their unchanged source packets. The three new facade batches sit
on those retained planes. Small openings, framing, hues and decorative dimensions
are photographic/procedural estimates, not a surveyed facade reconstruction.

- **Green headquarters, Platz vor dem Neuen Tor 1:** yellow plaster, green
  divided window frames, sills and entrance on the actual western street wall.
  The earlier grid across the building centre is retired; the entire measured
  shell and roof remain. Primary identity: [Grüne](https://www.gruene.de/service/bundesgeschaeftsstelle).
- **Willy-Brandt-Haus, Wilhelmstraße/Stresemannstraße:** pale stone courses,
  windows, tall glazed foyer and the polygonal curved prow follow the existing
  footprint. The delivered 21 m building height remains unchanged; this pass
  does not claim to replace it with the complete measured 26.492 m LoD2 model.
  [Official architectural account](https://www.willy-brandt-haus.de/das-willy-brandt-haus/das-willy-brandt-haus/).
- **Rosa-Luxemburg-Stiftung, Straße der Pariser Kommune 8A:** red brick bands,
  red window frames and pale concrete X supports, below the retained 36.44 m
  shell top. [Official 2020 opening account](https://www.rosalux.de/news/id/43270/neubau-eroeffnet).
  This is near Ostbahnhof. The Karl-Liebknecht-Haus at Rosa-Luxemburg-Platz is
  a different institution, and has not been relabelled or moved.
- **Robert Koch, Robert-Koch-Platz:** the seated marble figure now has the
  long coat, bent arms, seat back and turned bearded head. It faces west from
  its existing eastern square anchor. The base footprint and overall 5.45 m
  display height remain unchanged. [Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/robert-koch-denkmal-7894/),
  Louis Tuaillon, 1912–16; Detlev J. Pietzsch's 2009 photograph, CC BY 4.0,
  reference only. Statue proportions are estimates.

Minecraft additionally has one independent, texture-free 24-box Koch batch at
the same protected OSM owner `way/54672896`, facing west. Its 5 × 4.3 m stepped
base and 5.45 m overall height preserve the drawn display envelope. Runtime
placement samples the supplied voxel terrain (currently world Y5.2); no fixed
fallback elevation is used. The delivered building columns do not overlap this
footprint, so no source column is removed. Full/mobile use the identical model;
the focused test verifies protection, actual ground, footprint, orientation,
orthogonality and a strict 3,000-byte geometry/instance budget.

The three facade batches use final-sized instance buffers. Native fittings are projected onto actual retained native exposed wall planes;
their source/hash receipts are in `civicV246NativeFaces.json`. Half-metre
surface cells are merged only vertically when exactly adjacent and identical in
colour, retaining the same occupancy with fewer matrices. Drawn additions use
260,148 B and native additions 1,389,432 B of instance attributes, three batches
per family. They use the existing night materials and static disposal lifecycle.
There is no per-device reduction of architectural detail.

## Scope and validation

The Piazzetta correction replaces precisely the false parking-footprint block
and obsolete raised wedge, with receipts for their complete prior source data.
The full square ring, gentle surface heights and walking floor agree. Museum
buildings, nearby cafes, roofs and courtyards remain. The Steglitz pass retains
all existing Schloßstraße coverage and refines the two explicitly tagged street
segments at the Rathaus; it is not a newly surveyed entire street.

Focused source, geometry, native orthogonality, navigation and memory checks run
alongside the build. Browser checks inspect these locations in drawn and native
modes, and a mobile/desktop six-mode cycle checks context-loss and resident-buffer
limits. Full Python verification and released-byte checks are recorded in the
release notes. No finite test can guarantee freedom from browser/OS termination
on every device.
