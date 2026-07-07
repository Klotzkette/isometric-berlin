# Changelog

## Unreleased

- Improve README onboarding with a clearer download/start block, link
  index, and grouped landmark inventory.
- Add a documentation index at `docs/README.md`.
- Refresh the Regierungsviertel geodata README so it lists the current
  committed artefacts instead of stale TODO placeholders.
- Refresh the reference-image README with links to Wikimedia credits,
  the atlas, and the machine-readable manifest.
- Restore the README `Local v0.1.44` status phrase expected by release
  readiness and require the Tiergartentunnel overlay in release checks.

## v0.1.44

- Add Carillon im Tiergarten, Mahnmal fuer verfolgte Zeugen Jehovas, and
  Gedenkort fuer Polen 1939-1945 as explicit QA/navigation landmarks.
- Add `geo_data/regierungsviertel/tiergartentunnel.geojson` as an
  approximate underground reference route and draw it as a dashed
  under-surface Tiergartentunnel cue.
- Expand free-license Wikimedia discovery for Carillon, Jehovah's
  Witnesses memorial, Poland memorial, and Luiseninsel future-bound
  reference candidates.
- Improve deterministic render accents for the new bell tower, bronze /
  purple memorial, boulder/apple-tree memorial, and tunnel route.

## v0.1.43

- Add Kanzlergarten / Non-Violence-Skulptur as an explicit QA/navigation
  landmark west of the Chancellery context.
- Expand free-license Wikimedia discovery for Kanzlerpark/Kanzlergarten,
  HKW/Kongresshalle, Max-Liebermann-Haus, and Reichstag dome/plenary cues.
- Strengthen deterministic render signatures for Kanzlergarten, HKW,
  Max-Liebermann-Haus, and the existing Reichstag/TIPI/forecourt detail layer.

## v0.1.42

- Add TIPI am Kanzleramt, Eduardo-Chillida-Skulptur, Reichstagsvorfeld /
  Berlin-Pavillon, and Platz der Republik Heckenbosquets as explicit
  Regierungsviertel QA/navigation landmarks in the local viewer.
- Expand free-license Wikimedia discovery for TIPI, Chillida, Reichstag
  dome/plenary, and Reichstag forecourt references while keeping the
  no-copy rule for commercial maps, official photos, and social media.
- Improve the deterministic source renderer with recognizable TIPI,
  Chillida, Reichstagskuppel/plenary, Sinti/Roma memorial, Berlin-Pavillon,
  and hedge-bosquet accent cues.

## v0.1.41

- Upgrade the offline `START-HERE.html` presentation with a more polished
  cartographic stage: technical grid, vignette/lighting treatment, stronger map
  filtering, and a selected-landmark focus ring.
- Add Atlas, Cinematic, and Lab visual profiles plus keyboard shortcuts 1/2/3
  for quick contrast/readability changes.
- Add an instrument HUD that shows selected landmark, zoom ratio, camera
  orientation, and focus state while keeping the no-Terminal Mac/Windows launch
  flow intact.

## v0.1.40

- Add Venusbassin / Goldfischteich as an explicit Tiergarten landmark using
  Wikimedia/Wikidata/OSM metadata, and extend Wikimedia reference discovery for
  modern free-license pond imagery.
- Improve the deterministic source renderer with bounded tree, shrub, and
  water-ripple texture for OSM park and water polygons.
- Document the external no-copy geolocation QA pass across official pages and
  commercial map products.

## v0.1.39

- Add `package-manifest.json` to the downloadable local package with package
  version, preferred detail image, DZI descriptor, asset hashes, attribution,
  and Google-content status.
- Strengthen release readiness so README's direct download URL must match the
  current project version.
- Validate package manifests in both the unpacked local package and the ZIP,
  including referenced asset sizes and SHA-256 hashes.

## v0.1.38

- Export the Advanced Viewer DZI from the detailed source render instead of the
  pixel-art overview.
- Add denser facade/roof micro-detail and stronger landmark building signatures
  for the Regierungsviertel render path.
