# Step 11: central civic and transit fidelity

## Scope

- Expand the owner-approved presentation radius from 5,130 m to 5,230 m.
- Add a tight north-east polygon lobe for Berliner Ensemble and Berlin
  Friedrichstraße while retaining every task-10 area.
- Refresh and clip LoD2, OSM, official tree/light/Wall data and the official
  Berlin 3D Mesh to that polygon.
- Add source-positioned recognition cues for the Hauptbahnhof tram/S15 public
  realm, Futurium/federal campus, Parliament of Trees, Berliner Ensemble,
  Friedrichstraße station, Detlev-Rohwedder-Haus, Gropius Bau,
  Abgeordnetenhaus and Topography of Terror.

## Result

- [x] Radius is versioned at 5,230 m without moving existing geometry.
- [x] `landmarks.geojson` contains 87 unique points and 38 checked relative
  relationships; no relative-placement review remains.
- [x] The official mesh contains 26 bounded base tiles, 26 settled tiles and
  22 lazy hero parts, all below the per-file repository ceiling.
- [x] New recognition details keep one coordinate set across Day, Night,
  Minecraft and Snowstorm and disappear only in the physical underside view.
- [x] Vehicles, facade rhythms and damaged Wall-crown treatment are explicitly
  identified as display approximations rather than surveyed geometry.
- [x] Selective mesh fetching can merge exact requested tiles without
  discarding the prior bounded manifest.
- [x] Metric/provenance reports, local-package instructions and release gates
  are regenerated from the enlarged source stack.

## Primary-source QA

- BVG station/fleet information for Hauptbahnhof tram services and modern
  50 m Urbanliner dimensions.
- Deutsche Bahn / S-Bahn Berlin opening information for S15 and track 22.
- Futurium's official architecture documentation for footprint, facade,
  panoramic windows, canopy and roof cues.
- Bundesfinanzministerium building history for the former
  Reichsluftfahrtministerium / Detlev-Rohwedder-Haus.
- Stiftung Berliner Mauer, Berliner Ensemble, Abgeordnetenhaus and Stiftung
  Topographie des Terrors for the memorial, theatre and historical-site cues.

Commercial map products were used only as no-copy plausibility checks under
`docs/external-geolocation-qa.md`. No screenshots, tiles, traced geometry,
textures or credentials were imported.
