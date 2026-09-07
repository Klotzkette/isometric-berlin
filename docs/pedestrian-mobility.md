# Pedestrian movement and bridge access — step 10

The normal walking rate is now 13 m/s, up from 8.5 m/s (about 53% faster).
This is a presentation speed for exploring the city, not a claim about a real
person's walking speed. Partial joystick input remains proportional: 10% input
travels 1.3 m/s and 35% travels 4.55 m/s. Movement starts immediately and stops
on release; there is no acceleration delay. The existing four-times sprint,
eight-times fast run, jump apex limits and 22 cm collision substeps remain.
All five visual modes use the same movement solver.

## Bridge crossings

The original OSM water polygons correctly continue underneath bridges. The
pedestrian solver previously treated those polygons as a shoreline even on a
visible bridge deck. It also sampled the terrain underneath elevated decks.
The new bounded bridge support query supplies the represented deck elevation
and exempts that upper surface from the water test. Off-deck water remains
blocked, and the full 84 cm body must fit inside the bridge's surveyed width.

The following nine named public crossings use their existing source-bound
profiles: Moltkebrücke, Gustav-Heinemann-Brücke, Hugo-Preuß-Brücke,
Kronprinzenbrücke, Weidendammer Brücke, Golda-Meir-Steg, Sandkrugbrücke,
Adlerbrücke and Löwenbrücke. The ground query shares the renderer's actual OSM
bridge clusters, official inventory envelopes, plan axes, sampled deck datum,
segmented camber and road/footway levels. Hugo-Preuß retains its curved plan.
Adler and Löwen use their dedicated drawn or Minecraft floor heights. The
metric road-bridge structures are already shared with the block presentation.
They are installed on a direct Minecraft start as well as after a drawn-mode
visit. Sandkrug uses its own block-native deck, frames, rails and masts; only
its separately named smooth counterpart and bridge-class raster cells inside
the represented deck yield to that replacement.

This supplies walking support for existing geometry; it does not add invented
bridge extensions, change source shorelines or introduce new surveyed heights.
Unnamed raster clusters are not opened because they may represent railways.
The two-level Bundestag connection keeps its existing authored access policy.

## Gustav-Heinemann source conflict

The committed `osm_context_buildings.gpkg` record `OSM-way-198734078` identifies
`osm_context:bridge_support`, with `height_source` equal to
`display_fallback:building=bridge_support`. Its generic 9 m height became prism
`98734078` at base y=3.2 m, top y=12.2 m. That filled the northern public route
across the bridge with a wall. The four source plan corners remain
`[-33.4,-481.8]`, `[-33.4,-480.4]`, `[-39.9,-478.2]`, `[-39.8,-479.8]` (world x,z).

Only this identified fallback envelope is replaced by the existing authored
Gustav-Heinemann structure in drawn geometry, Minecraft and pedestrian
collision. The source record and footprint remain committed. This is not a
new opening through a real occupied building, and no unrelated prism is
suppressed. The original source identity is
[OSM way 198734078](https://www.openstreetmap.org/way/198734078); the existing
bridge evidence remains in the viewer's `GUSTAV_HEINEMANN_STRUCTURE_PROFILE`.

## Capsule clearance

Authored solid queries already accept a radius. The pedestrian helper used
that radius again on samples offset by the same radius, making the effective
body too wide near bridge rails and some narrow openings. It now retains
radius-aware central samples and uses unexpanded samples at the body's outer
edge. Existing point-only station and memorial queries retain all seven body
samples. Actual rails, walls, trees, closed building prisms and protected
memorial volumes remain active.

The concrete Löwenbrücke regression is 30 cm either side of its midspan centreline:
an 84 cm body fits within the 1.88 m deck and the authored railing query is
clear, but the former extra expansion blocked both positions.

## Verification and limits

`pedestrian-bridge-access.test.ts` loads the complete committed LoD2/context
prisms, original water polygons and terrain. It crosses each of the nine
bridges in both directions, with full keyboard and 35% analog input, in all
five modes without jumping. Separate checks stop movement over the side,
retain Löwen rail collision, and raycast actual drawn and Minecraft meshes to
check deck support heights. Existing Hauptbahnhof entry, Brandenburg Gate,
Tiergartentunnel, protected memorial, roof and retained-tree regressions remain
in force. The faster rate is tested over one second at three input strengths,
including immediate stopping.

The viewer still has a bounded map, solid closed buildings, water and protected
areas. This work fixes the specified public crossings and false clearance
blocks; it does not promise an interior route through every building or add
working station lifts. Physical phone testing is separate from deterministic
movement and gesture regression coverage.
