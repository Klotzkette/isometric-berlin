# Changelog

## v0.1.58

- Public web release build. Fresh `bun run build` verified reproducible
  on a clean-clone from `main`: 5.1 MB total, ~2.5 MB gzipped tarball,
  116 files, all asset paths relative (`./assets/...`, `./dzi/...`) so
  the bundle drops into any static host under any subdomain or
  sub-path.
- Pre-publish security review clean: no hardcoded secrets, no leaked
  paths in source map, no runtime LLM/connector dependencies, only
  React 19 + react-dom + OpenSeadragon 5 + lucide-react at runtime.
- Ship the built React + OpenSeadragon viewer as a release asset
  `isometric-berlin-viewer-v0.1.58.tar.gz` so it can be deployed from
  anywhere (GitHub Pages, Cloudflare Pages, Vercel, Netlify,
  `pplx.app`, an S3 bucket, or `python -m http.server` in the
  extracted directory) without rebuilding. Complements the zero-server
  `START-HERE.html` package shipped since v0.1.53.

## v0.1.57

- Add URL start parameters to `START-HERE.html` for support/debug starts:
  `lang`, `theme`, `view`, `profile`, `pixel`, `details`, `clouds`, `lite`
  and `performance`.
- Add an image-load fallback so the offline viewer switches from the detail
  overview to the pixel overview if `overview_source.png` fails to load.
- Guard keyboard shortcuts against browser/system modifier combinations and
  form-focused targets.
- Extend release readiness, package HTML tests and local smoke tests so future
  ZIPs keep the start-parameter, fallback and keyboard-guard paths.

## v0.1.56

- Add a saved lightweight performance mode to the zero-server
  `START-HERE.html` viewer, with a dedicated button and `P` shortcut.
  It removes expensive shadows / filters and cloud animation while keeping
  the map usable and visually legible.
- Replace resize reset behaviour with `refitPreservingView`, so changing
  window size preserves the current focus, zoom ratio, rotation, swivel and
  underside state instead of snapping back to the top overview.
- Extend package release-readiness, generated HTML tests and local package
  smoke checks so future downloads must keep the performance mode and
  resize-preserving path.

## v0.1.55

- Add detail and cloud toggles to `START-HERE.html`, persist both choices,
  expose G/C keyboard shortcuts and keep the buttons bilingual.
- Reduce heavy visual work while the map is being dragged by dimming the
  detail overlay and disabling costly SVG filters during active pointer
  movement.
- Add a reduced-motion guard for cloud drift / focus animation.
- Refine the visual pass with glass glints for the Reichstag dome,
  Hauptbahnhof roof and Bundeskanzleramt, plus water ripples, Tiergarten
  tree clusters and path-highlight points.
- Extend release-readiness, package HTML tests and local package smoke tests
  so the new toggles, drag optimisation and polish details stay in future
  downloads.

## v0.1.54

- Add a deterministic scene-detail overlay to the zero-server
  `START-HERE.html` viewer with translucent isometric clouds, southwest
  late-afternoon sun cues, cloud shadows, water-depth accents, tunnel branch
  hints, an ICE at Hauptbahnhof, an S-Bahn on the east-west rail line,
  Pariser-Platz / tunnel cars with night light beams, Reichstag / EU /
  US / French flags, a Spree tour boat, a pedicab / people cue and
  Gustav-Heinemann-Brücke / Zollpackhof beer-garden details.
- Tune Day/Night styling so cloud opacity, sun beams and vehicle light cones
  respond to the selected mode while the new details stay attached during
  pan, rotate, swivel and underside tunnel inspection.
- Extend release readiness, package HTML tests and HTTP smoke tests so future
  downloadable ZIPs must keep the v0.1.54 scene-detail layer.

## v0.1.53

- Extend `START-HERE.html` persistence so the offline viewer restores the
  last focused landmark, view preset or free rotation/swivel angle, and
  Tiergartentunnel underside state in addition to language, Day/Night,
  visual profile, and Pixel-Art/detail image selection.
- Make Reset/Home return the zero-server viewer to the Bundeskanzleramt
  top view and save that clean state.
- Extend package manifest, release-readiness checks, smoke tests, and
  fixture tests so future ZIPs must keep last-view restoration.

## v0.1.52

- Persist `START-HERE.html` viewer preferences locally in the browser:
  language, Day/Night mode, Atlas/Cinematic/Lab profile, and
  Pixel-Art/detail image selection now survive reloads.
- Keep the persistence fail-safe for strict `file://` browser contexts:
  if localStorage is unavailable, the offline viewer still starts with
  defaults.
- Extend release-readiness and package smoke coverage so future ZIPs must
  retain the preference persistence path.

## v0.1.51

- Add bilingual Deutsch/English controls to the zero-server
  `START-HERE.html` viewer and keep labels, HUD text, hints and reference
  modal copy in sync when switching language.
- Add Day/Night controls to the offline viewer. Night mode overlays lit
  windows for the Reichstag, Bundeskanzleramt and Hauptbahnhof, an
  illuminated Brandenburg Gate / Quadriga cue, selected monument accents,
  Tiergarten / Pariser Platz street lamps and stronger Tiergartentunnel
  lighting.
- Extend the package manifest, release-readiness check and local smoke test
  so bilingual UI and night-light overlays are required in future packages.

## v0.1.50

- Add a zero-server `START-HERE.html` underside mode for the
  Tiergartentunnel cutaway. The same SVG tunnel layer now stays attached
  while the map is panned, rotated, swivelled and flipped for a
  from-below inspection view.
- Further shape the tunnel with portal frames, underside glow, ceiling
  ribs, lane / tube guide marks and service-bay markers.
- Add Tunnel-Fokus and Unterseite controls plus U/F keyboard shortcuts
  to make the underground route easier to inspect locally.
- Extend package readiness and smoke tests so tunnel underside controls,
  service bays and portal markers are required in future releases.

## v0.1.49

- Pull live OpenStreetMap / Overpass evidence for the Tunnel
  Tiergarten Spreebogen B96 trunk carriageways and store the derived
  `tunnel=yes`, `layer=-2` way geometries in
  `geo_data/regierungsviertel/tiergartentunnel.geojson`.
- Keep the rendered centreline as an engineered simplification for the
  isometric cutaway, but attach the OSM way IDs and evidence count to
  both the GeoJSON and packaged viewer payload.
- Update the local package and documentation so v0.1.49 is the first
  release whose tunnel geometry is based on OSM tunnel carriageway
  geometry rather than only portal/route approximation.

## v0.1.48

- Upgrade the Tiergartentunnel representation from a reference line to
  an open-data engineered underground cutaway: two-tube rectangular
  volume, side walls, centre wall, warm lighting, ventilation / shaft
  markers and cross-section cues.
- Add public-source and precision metadata for the tunnel route, with a
  clear `geometry_status` that prevents the approximation from being
  mistaken for official surveyed as-built geometry.
- Align the deterministic source renderer and zero-server
  `START-HERE.html` launcher so regenerated tiles and the packaged HTML
  viewer use the same tunnel-volume semantics.
- Extend release readiness and local package smoke tests to require the
  new tunnel volume metadata and viewer functions.
- Rebuild the Mac/Windows/Linux ZIP and update README/version metadata to
  v0.1.48.

## v0.1.47

- Refine the Tiergartentunnel visual layer with a stronger under-surface
  tube, warm lighting dots, and ventilation / shaft markers in the
  zero-server `START-HERE.html` viewer.
- Add matching tunnel-light and ventilation cues to the deterministic
  source renderer.
- Extend release readiness and the local package smoke test so future
  packages must include tunnel lighting and ventilation metadata.
- Rebuild the Mac/Windows/Linux ZIP and update README/version metadata to
  v0.1.47.

## v0.1.46

- Add `scripts/smoke_local_package.py`, an end-to-end HTTP smoke test for
  the unzipped local package. It starts `serve-local.py`, verifies
  `START-HERE.html`, manifest version, DZI descriptor, a DZI JPEG tile,
  landmark payload, and the Tiergartentunnel overlay.
- Rebuild the Mac/Windows/Linux ZIP and update README/version metadata to
  v0.1.46.

## v0.1.45

- Add animation-frame render throttling, robust pointer-end handling, and
  resize debounce to the offline `START-HERE.html` launcher so mouse drag,
  wheel zoom, swivel and resizing stay responsive.
- Harden release readiness so future ZIPs must include the anti-freeze
  launcher logic as well as the Tiergartentunnel overlay.
- Improve README onboarding with a clearer download/start block, link
  index, and grouped landmark inventory.
- Add a documentation index at `docs/README.md`.
- Refresh the Regierungsviertel geodata README so it lists the current
  committed artefacts instead of stale TODO placeholders.
- Refresh the reference-image README with links to Wikimedia credits,
  the atlas, and the machine-readable manifest.
- Keep the README `Local v...` status phrase aligned with release
  readiness and require the Tiergartentunnel overlay in release checks.
- Rebuild the local Mac/Windows/Linux ZIP and update download links to
  v0.1.45.

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
